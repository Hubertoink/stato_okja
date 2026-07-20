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

say "Compose-Konfiguration pruefen und StatO starten"
docker compose -f docker-compose.onprem.yml --env-file "$ENV_FILE" config --quiet
docker compose -f docker-compose.onprem.yml --env-file "$ENV_FILE" up -d --build

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
printf '\nNach Aenderungen an .env.onprem neu bauen/starten mit:\n'
printf '  cd "%s" && docker compose -f docker-compose.onprem.yml --env-file .env.onprem up -d --build\n' "$INSTALL_DIR"
