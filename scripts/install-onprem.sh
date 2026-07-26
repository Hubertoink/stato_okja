#!/bin/sh

# StatO On-Prem bootstrap for Linux and macOS.
# Environment overrides: STATO_REPO_URL, STATO_BRANCH, STATO_INSTALL_DIR,
# STATO_IMAGE_TAG.

set -eu

REPOSITORY_URL="${STATO_REPO_URL:-https://github.com/Hubertoink/stato_okja.git}"
BRANCH="${STATO_BRANCH:-main}"
IMAGE_TAG="${STATO_IMAGE_TAG:-}"

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
  compose ps --all || true
  if [ "$TLS_ENABLED" = true ]; then
    compose logs --no-color --tail 120 postgres backend caddy || true
  else
    compose logs --no-color --tail 120 postgres backend || true
  fi
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

get_env_value() {
  key=$1
  value=$(sed -n "s|^${key}=||p" "$ENV_FILE" | tail -n 1)
  [ -n "$value" ] || fail "Variable '$key' fehlt oder ist leer in $ENV_FILE."
  printf '%s' "$value"
}

ensure_env_value() {
  key=$1
  default_value=$2
  if grep -q "^${key}=" "$ENV_FILE"; then
    return
  fi
  printf '\n%s=%s\n' "$key" "$default_value" >> "$ENV_FILE"
}

assert_no_existing_onprem_data_for_fresh_config() {
  # The on-prem Compose file deliberately uses a stable, named Docker volume so
  # data survives updates and a moved checkout. A new .env file must never be
  # paired silently with that existing database: its generated admin password
  # would not apply to the already-seeded superadmin.
  volume_name=stato-onprem-postgres-data
  if docker volume inspect "$volume_name" >/dev/null 2>&1; then
    fail "Der persistente Docker-Volume '$volume_name' existiert bereits, aber .env.onprem fehlt. Der Installer bricht ab, damit kein neues, ungueltiges Startpasswort ausgegeben wird. Fuer die bestehende Installation die bisherige .env.onprem wiederherstellen; fuer eine bewusst neue Installation den vorhandenen Datenbestand erst explizit sichern und entfernen."
  fi
}

compose() {
  if [ "$TLS_ENABLED" = true ]; then
    docker compose --profile internal-tls -f docker-compose.onprem.yml --env-file "$ENV_FILE" "$@"
  else
    docker compose -f docker-compose.onprem.yml --env-file "$ENV_FILE" "$@"
  fi
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
  if git -C "$INSTALL_DIR" show-ref --verify --quiet "refs/tags/$BRANCH"; then
    git -C "$INSTALL_DIR" checkout --detach "$BRANCH"
  elif git -C "$INSTALL_DIR" show-ref --verify --quiet "refs/heads/$BRANCH"; then
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
  assert_no_existing_onprem_data_for_fresh_config
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

# Add TLS defaults to installations created before the optional Caddy mode.
ensure_env_value HTTP_BIND_ADDRESS 0.0.0.0
ensure_env_value STATO_TLS_MODE off
ensure_env_value STATO_PUBLIC_HOST ''
ensure_env_value HTTPS_BIND_ADDRESS 0.0.0.0
ensure_env_value HTTPS_PORT 443
ensure_env_value STATO_IMAGE_TAG ''

# An explicit environment value is useful for one-command installs; otherwise
# retain the version selected in .env.onprem for subsequent installer runs.
if [ -n "${STATO_IMAGE_TAG:-}" ]; then
  replace_env_value STATO_IMAGE_TAG "$STATO_IMAGE_TAG"
fi
if [ -z "$IMAGE_TAG" ]; then
  IMAGE_TAG=$(sed -n 's/^STATO_IMAGE_TAG=//p' "$ENV_FILE" | tail -n 1)
fi

# One-command opt-in for internal HTTPS, e.g.
# curl ... | STATO_INTERNAL_TLS_HOST=stato.intern.example.de sh
if [ -n "${STATO_INTERNAL_TLS_HOST:-}" ]; then
  replace_env_value STATO_TLS_MODE internal
  replace_env_value STATO_PUBLIC_HOST "$STATO_INTERNAL_TLS_HOST"
fi

TLS_MODE=$(get_env_value STATO_TLS_MODE | tr '[:upper:]' '[:lower:]')
TLS_ENABLED=false
PUBLIC_URL=

case "$TLS_MODE" in
  off)
    ;;
  internal)
    PUBLIC_HOST=$(get_env_value STATO_PUBLIC_HOST)
    case "$PUBLIC_HOST" in
      *://*|*/*|*:*|*' '*|.*|*..*|*.)
        fail "STATO_PUBLIC_HOST muss ein DNS-Name ohne Protokoll, Pfad oder Port sein, z. B. stato.intern.example.de."
        ;;
      *.*)
        ;;
      *)
        fail "STATO_PUBLIC_HOST muss ein DNS-Name mit mindestens einem Punkt sein, z. B. stato.intern.example.de."
        ;;
    esac

    HTTPS_PORT_VALUE=$(get_env_value HTTPS_PORT)
    case "$HTTPS_PORT_VALUE" in
      ''|*[!0-9]*) fail "HTTPS_PORT muss eine Portnummer zwischen 1 und 65535 sein." ;;
    esac
    if [ "$HTTPS_PORT_VALUE" -lt 1 ] || [ "$HTTPS_PORT_VALUE" -gt 65535 ]; then
      fail "HTTPS_PORT muss eine Portnummer zwischen 1 und 65535 sein."
    fi

    if [ "$HTTPS_PORT_VALUE" -eq 443 ]; then
      PUBLIC_URL="https://$PUBLIC_HOST"
    else
      PUBLIC_URL="https://$PUBLIC_HOST:$HTTPS_PORT_VALUE"
    fi
    say "Internes HTTPS mit Caddy fuer $PUBLIC_URL aktivieren"
    replace_env_value HTTP_BIND_ADDRESS 127.0.0.1
    replace_env_value APP_ORIGIN "$PUBLIC_URL"
    replace_env_value CORS_ORIGINS "$PUBLIC_URL"
    replace_env_value AUTH_REFRESH_COOKIE_SECURE true
    TLS_ENABLED=true
    ;;
  *)
    fail "STATO_TLS_MODE muss 'off' oder 'internal' sein (aktueller Wert: '$TLS_MODE')."
    ;;
esac

say "Compose-Konfiguration pruefen"
compose config --quiet

say "PostgreSQL starten und Datenbankzugang synchronisieren"
if ! compose up -d --wait --wait-timeout 120 postgres; then
  show_compose_diagnostics
  fail "PostgreSQL konnte nicht gestartet werden."
fi

# POSTGRES_PASSWORD is only applied while PostgreSQL initializes an empty
# volume. Keep an existing database usable when .env.onprem changes later.
SYNC_SQL="SELECT format('ALTER ROLE %I PASSWORD %L', current_user, :'password') \gexec"
if ! printf '%s\n' "$SYNC_SQL" | \
  compose exec -T postgres sh -c \
    'exec psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --set "password=$POSTGRES_PASSWORD"'; then
  show_compose_diagnostics
  fail "Das PostgreSQL-Passwort aus .env.onprem konnte nicht synchronisiert werden."
fi

# The historical migrations extend an already existing application schema.
# Detect a truly empty database so the installer can create that base schema
# once before running the migrations in a second, production-safe phase.
if ! SCHEMA_STATE=$(printf '%s\n' "SELECT CASE WHEN to_regclass('public.users') IS NULL THEN 'missing' ELSE 'present' END;" | \
  compose exec -T postgres sh -c \
    'exec psql --tuples-only --no-align --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1'); then
  show_compose_diagnostics
  fail "Der Schema-Status der PostgreSQL-Datenbank konnte nicht ermittelt werden."
fi
case "$SCHEMA_STATE" in
  missing) FRESH_DATABASE=true ;;
  present) FRESH_DATABASE=false ;;
  *)
    show_compose_diagnostics
    fail "Der Schema-Status der PostgreSQL-Datenbank konnte nicht ermittelt werden."
    ;;
esac

if [ -n "$IMAGE_TAG" ]; then
  say "Veroeffentlichte StatO-Images $IMAGE_TAG aus GHCR laden"
  if ! compose pull backend frontend backup; then
    show_compose_diagnostics
    fail "Die veroeffentlichten StatO-Images konnten nicht geladen werden. Pruefe STATO_IMAGE_TAG und die Netzwerkverbindung."
  fi
else
  say "StatO-Images bauen"
  if ! compose build; then
    show_compose_diagnostics
    fail "Die StatO-Images konnten nicht gebaut werden. Die Diagnose steht oberhalb dieser Meldung."
  fi
fi

# Volumes created by older images can still belong to root. Repair ownership
# before the unprivileged backend starts; existing uploaded files stay intact.
say "Berechtigungen des persistenten Upload-Verzeichnisses pruefen"
if ! compose run --rm --no-deps --user 0 --cap-add CHOWN --entrypoint sh backend -c \
    'mkdir -p /app/uploads/images /app/uploads/project-documents && chown -R node:node /app/uploads'; then
  show_compose_diagnostics
  fail "Die Berechtigungen des Upload-Verzeichnisses konnten nicht repariert werden."
fi

if [ "$FRESH_DATABASE" = true ]; then
  say "Leere Datenbank: Basisschema einmalig erzeugen"
  # TypeORM runs migrations before synchronize(). The first phase therefore
  # creates the current entity schema without migrations; the second phase
  # records and applies the regular migrations with synchronize disabled.
  if ! (
    export DB_SYNCHRONIZE=true
    export DB_MIGRATIONS_RUN=false
    compose up -d --force-recreate --wait --wait-timeout 120 backend
  ); then
    show_compose_diagnostics
    fail "Das Basisschema der leeren PostgreSQL-Datenbank konnte nicht erzeugt werden."
  fi

  say "Datenbankmigrationen auf dem Basisschema abschliessen"
  if ! compose up -d --force-recreate --wait --wait-timeout 120 backend; then
    show_compose_diagnostics
    fail "Die Datenbankmigrationen auf dem neuen Basisschema konnten nicht abgeschlossen werden."
  fi
fi

say "StatO starten"
if [ -n "$IMAGE_TAG" ]; then
  START_ARGUMENTS='-d --no-build'
else
  START_ARGUMENTS='-d'
fi
if ! compose up $START_ARGUMENTS; then
  show_compose_diagnostics
  fail "StatO konnte nicht vollstaendig gestartet werden. Die Diagnose steht oberhalb dieser Meldung."
fi

say "StatO wurde gestartet"
compose ps

printf '\nInstallation: %s\n' "$INSTALL_DIR"
printf 'Konfiguration: %s/%s\n' "$INSTALL_DIR" "$ENV_FILE"
if [ "$TLS_ENABLED" = true ]; then
  printf 'Aufruf:        %s\n' "$PUBLIC_URL"
  printf 'Caddy-CA:      ./scripts/export-onprem-caddy-root.sh\n'
else
  printf 'Aufruf:        http://localhost (bzw. http://<server-ip>)\n'
fi
printf 'Superadmin:    admin@stato.local\n'
if [ "$ENV_CREATED" = true ]; then
  printf 'Startpasswort: %s\n' "$ADMIN_PASSWORD"
  printf '\nBitte das Startpasswort sicher notieren und nach dem ersten Login aendern.\n'
fi
printf '\nNach Aenderungen an .env.onprem den Installer erneut ausfuehren mit:\n'
printf '  cd "%s" && sh ./scripts/install-onprem.sh\n' "$INSTALL_DIR"
