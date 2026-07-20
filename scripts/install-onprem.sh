#!/bin/sh

# StatO On-Prem bootstrap for Linux and macOS.
# Environment overrides: STATO_REPO_URL, STATO_BRANCH, STATO_INSTALL_DIR.

set -eu

REPOSITORY_URL="${STATO_REPO_URL:-https://github.com/Hubertoink/stato_okja.git}"
BRANCH="${STATO_BRANCH:-main}"

if [ -n "${STATO_INSTALL_DIR:-}" ]; then
  INSTALL_DIR=$STATO_INSTALL_DIR
elif [ -d "$PWD/.git" ] && [ -f "$PWD/docker-compose.onprem.yml" ]; then
  INSTALL_DIR=$PWD
else
  INSTALL_DIR=$PWD/stato_okja
fi

say() {
  printf '\n==> %s\n' "$1"
}

fail() {
  printf '\nFehler: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "'$1' wurde nicht gefunden. Bitte zuerst $2 installieren."
}

show_compose_diagnostics() {
  say "Docker-Diagnose"
  docker compose -f docker-compose.onprem.yml --env-file "$ENV_FILE" ps --all || true
  docker compose -f docker-compose.onprem.yml --env-file "$ENV_FILE" \
    logs --no-color --tail 120 postgres backend || true
}

random_hex() {
  byte_count=$1
  od -An -N "$byte_count" -tx1 /dev/urandom | tr -d ' \n'
}

replace_env_value() {
  key=$1
  value=$2
  escaped_value=$(printf '%s' "$value" | sed 's/[&|\\]/\\&/g')
  sed "s|^${key}=.*$|${key}=${escaped_value}|" "$ENV_FILE" > "$ENV_FILE.tmp"
  mv "$ENV_FILE.tmp" "$ENV_FILE"
}

require_command git Git
require_command docker Docker
require_command od "die POSIX-Core-Utilities"

docker compose version >/dev/null 2>&1 || fail "Das Docker-Compose-Plugin fehlt (erwartet: 'docker compose')."
docker info >/dev/null 2>&1 || fail "Docker ist nicht erreichbar. Bitte den Docker-Dienst starten."

if [ -d "$INSTALL_DIR/.git" ]; then
  say "Vorhandene StatO-Installation aus Branch '$BRANCH' aktualisieren"

  if [ -n "$(git -C "$INSTALL_DIR" status --porcelain --untracked-files=no)" ]; then
    fail "Im Zielverzeichnis gibt es lokale Git-Aenderungen: $INSTALL_DIR. Bitte zuerst sichern/committen oder STATO_INSTALL_DIR anders setzen."
  fi

  git -C "$INSTALL_DIR" fetch origin "$BRANCH"
  if git -C "$INSTALL_DIR" show-ref --verify --quiet "refs/heads/$BRANCH"; then
    git -C "$INSTALL_DIR" checkout "$BRANCH"
    git -C "$INSTALL_DIR" merge --ff-only "origin/$BRANCH"
  else
    git -C "$INSTALL_DIR" checkout --track -b "$BRANCH" "origin/$BRANCH"
  fi
elif [ -e "$INSTALL_DIR" ] && [ -n "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]; then
  fail "Das Zielverzeichnis ist nicht leer und kein Git-Checkout: $INSTALL_DIR"
else
  say "StatO aus Branch '$BRANCH' klonen"
  git clone --branch "$BRANCH" --single-branch "$REPOSITORY_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
ENV_FILE=.env.onprem

if [ ! -f "$ENV_FILE" ]; then
  say "Lokale Konfiguration mit individuellen Secrets erzeugen"
  cp .env.onprem.example "$ENV_FILE"

  DB_PASSWORD="StatoDb_$(random_hex 24)_A9!"
  JWT_SECRET=$(random_hex 48)
  ADMIN_PASSWORD="Stato_$(random_hex 16)_A9!"

  replace_env_value POSTGRES_PASSWORD "$DB_PASSWORD"
  replace_env_value JWT_SECRET "$JWT_SECRET"
  replace_env_value SUPERADMIN_PASSWORD "$ADMIN_PASSWORD"
  chmod 600 "$ENV_FILE"
  ENV_CREATED=true
else
  say "Vorhandene .env.onprem beibehalten"
  ENV_CREATED=false
fi

say "Compose-Konfiguration pruefen"
docker compose -f docker-compose.onprem.yml --env-file "$ENV_FILE" config --quiet

say "PostgreSQL starten und Datenbankzugang synchronisieren"
if ! docker compose -f docker-compose.onprem.yml --env-file "$ENV_FILE" \
  up -d --wait --wait-timeout 120 postgres; then
  show_compose_diagnostics
  fail "PostgreSQL konnte nicht gestartet werden."
fi

# POSTGRES_PASSWORD is only applied while PostgreSQL initializes an empty
# volume. Keep an existing database usable when .env.onprem changes later.
SYNC_SQL="SELECT format('ALTER ROLE %I PASSWORD %L', current_user, :'password') \gexec"
if ! printf '%s\n' "$SYNC_SQL" | \
  docker compose -f docker-compose.onprem.yml --env-file "$ENV_FILE" \
    exec -T postgres sh -c \
      'exec psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --set "password=$POSTGRES_PASSWORD"'; then
  show_compose_diagnostics
  fail "Das PostgreSQL-Passwort aus .env.onprem konnte nicht synchronisiert werden."
fi

say "StatO-Images bauen"
if ! docker compose -f docker-compose.onprem.yml --env-file "$ENV_FILE" build; then
  show_compose_diagnostics
  fail "Die StatO-Images konnten nicht gebaut werden. Die Diagnose steht oberhalb dieser Meldung."
fi

# Volumes created by older images can still belong to root. Repair ownership
# before the unprivileged backend starts; existing uploaded files stay intact.
say "Berechtigungen des persistenten Upload-Verzeichnisses pruefen"
if ! docker compose -f docker-compose.onprem.yml --env-file "$ENV_FILE" \
  run --rm --no-deps --user 0 --cap-add CHOWN --entrypoint sh backend -c \
    'mkdir -p /app/uploads/images /app/uploads/project-documents && chown -R node:node /app/uploads'; then
  show_compose_diagnostics
  fail "Die Berechtigungen des Upload-Verzeichnisses konnten nicht repariert werden."
fi

say "StatO starten"
if ! docker compose -f docker-compose.onprem.yml --env-file "$ENV_FILE" up -d; then
  show_compose_diagnostics
  fail "StatO konnte nicht vollstaendig gestartet werden. Die Diagnose steht oberhalb dieser Meldung."
fi

say "StatO wurde gestartet"
docker compose -f docker-compose.onprem.yml --env-file "$ENV_FILE" ps

printf '\nInstallation: %s\n' "$INSTALL_DIR"
printf 'Konfiguration: %s/%s\n' "$INSTALL_DIR" "$ENV_FILE"
printf 'Aufruf:        http://localhost (bzw. http://<server-ip>)\n'
printf 'Superadmin:    admin@stato.local\n'
if [ "$ENV_CREATED" = true ]; then
  printf 'Startpasswort: %s\n' "$ADMIN_PASSWORD"
  printf '\nBitte das Startpasswort sicher notieren und nach dem ersten Login aendern.\n'
fi
printf '\nNach Aenderungen an .env.onprem den Installer erneut ausfuehren mit:\n'
printf '  cd "%s" && sh ./scripts/install-onprem.sh\n' "$INSTALL_DIR"
