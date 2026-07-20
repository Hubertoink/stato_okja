#!/bin/sh

# Export the persistent internal Caddy root certificate for client trust setup.
set -eu

INSTALL_DIR=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
ENV_FILE="$INSTALL_DIR/.env.onprem"
DESTINATION=${1:-"$INSTALL_DIR/stato-onprem-caddy-root.crt"}

fail() {
  printf '\nFehler: %s\n' "$1" >&2
  exit 1
}

get_env_value() {
  key=$1
  value=$(sed -n "s|^${key}=||p" "$ENV_FILE" | tail -n 1)
  [ -n "$value" ] || fail "Variable '$key' fehlt oder ist leer in $ENV_FILE."
  printf '%s' "$value"
}

command -v docker >/dev/null 2>&1 || fail "'docker' wurde nicht gefunden."
[ -f "$ENV_FILE" ] || fail "Konfiguration nicht gefunden: $ENV_FILE"
[ "$(get_env_value STATO_TLS_MODE | tr '[:upper:]' '[:lower:]')" = internal ] || \
  fail "STATO_TLS_MODE=internal ist nicht aktiviert. Caddy stellt kein internes Stammzertifikat bereit."

CONTAINER_ID=$(docker compose --profile internal-tls -f "$INSTALL_DIR/docker-compose.onprem.yml" \
  --env-file "$ENV_FILE" ps -q caddy)
[ -n "$CONTAINER_ID" ] || fail "Der Caddy-Container läuft nicht. Bitte zuerst den On-Prem-Installer mit STATO_TLS_MODE=internal ausführen."

docker cp "$CONTAINER_ID:/data/caddy/pki/authorities/local/root.crt" "$DESTINATION"
printf 'Caddy-Stammzertifikat exportiert: %s\n' "$DESTINATION"
