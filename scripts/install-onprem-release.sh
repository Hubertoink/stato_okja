#!/bin/sh

# Release-based StatO On-Prem installer. This script is shipped as a release
# asset; the workflow replaces the placeholder with the immutable release tag.

set -eu

REPOSITORY='Hubertoink/stato_okja'
BUNDLED_RELEASE_TAG='__STATO_RELEASE_TAG__'
RELEASE_TAG=${STATO_RELEASE_TAG:-}
INSTALL_DIR=${STATO_INSTALL_DIR:-"$PWD/stato"}

say() { printf '\n==> %s\n' "$1"; }
fail() { printf '\nFehler: %s\n' "$1" >&2; exit 1; }
require_command() { command -v "$1" >/dev/null 2>&1 || fail "'$1' wurde nicht gefunden. $2"; }

random_hex() {
  od -An -N "$1" -tx1 /dev/urandom | tr -d ' \n'
}

get_env_value() {
  value=$(sed -n "s|^$1=||p" "$ENV_FILE" | tail -n 1)
  [ -n "$value" ] || fail "Variable '$1' fehlt oder ist leer in $ENV_FILE."
  printf '%s' "$value"
}

set_env_value() {
  key=$1
  value=$2
  escaped=$(printf '%s' "$value" | sed 's/[&|\\]/\\&/g')
  sed "s|^${key}=.*$|${key}=${escaped}|" "$ENV_FILE" > "$ENV_FILE.tmp"
  mv "$ENV_FILE.tmp" "$ENV_FILE"
}

ensure_env_value() {
  if ! grep -q "^$1=" "$ENV_FILE"; then printf '\n%s=%s\n' "$1" "$2" >> "$ENV_FILE"; fi
}

compose() {
  if [ "$TLS_ENABLED" = true ]; then
    docker compose --profile internal-tls -f "$RUNTIME_COMPOSE" --env-file "$ENV_FILE" "$@"
  else
    docker compose -f "$RUNTIME_COMPOSE" --env-file "$ENV_FILE" "$@"
  fi
}

test_host_port_available() {
  port=$1
  probe_name="stato-onprem-port-probe-$$"
  frontend_image="ghcr.io/hubertoink/stato-frontend:$(get_env_value STATO_FRONTEND_IMAGE_TAG)"
  if docker run -d --rm --name "$probe_name" --entrypoint sh -p "$port:8080" "$frontend_image" -c 'sleep 30' >/dev/null 2>&1; then
    docker rm -f "$probe_name" >/dev/null 2>&1 || true
    return 0
  fi
  docker rm -f "$probe_name" >/dev/null 2>&1 || true
  return 1
}

update_default_local_origin() {
  port=$1
  if [ "$port" -eq 80 ]; then suffix=''; else suffix=":$port"; fi
  for key in APP_ORIGIN CORS_ORIGINS; do
    value=$(get_env_value "$key")
    case "$value" in
      http://localhost|http://127.0.0.1) set_env_value "$key" "$value$suffix" ;;
    esac
  done
}

resolve_first_install_http_port() {
  [ ! -f "$MARKER_FILE" ] || return 0
  [ "$(get_env_value STATO_TLS_MODE | tr '[:upper:]' '[:lower:]')" = off ] || return 0

  configured_port=$(get_env_value HTTP_PORT)
  case "$configured_port" in ''|*[!0-9]*) fail 'HTTP_PORT muss eine Portnummer zwischen 1 und 65535 sein.' ;; esac
  [ "$configured_port" -ge 1 ] && [ "$configured_port" -le 65535 ] || fail 'HTTP_PORT muss eine Portnummer zwischen 1 und 65535 sein.'
  if test_host_port_available "$configured_port"; then return 0; fi

  [ "$configured_port" -eq 80 ] || fail "HTTP_PORT=$configured_port ist bereits belegt. Bitte in config/stato.env einen freien Port setzen und den Installer erneut ausführen."
  fallback_port=''
  for candidate in 8080 8081 8082 8083 8084 8085 8086 8087 8088 8089 8090; do
    if test_host_port_available "$candidate"; then fallback_port=$candidate; break; fi
  done
  [ -n "$fallback_port" ] || fail 'Keiner der lokalen HTTP-Ports 8080 bis 8090 ist verfügbar. Bitte HTTP_PORT in config/stato.env manuell setzen.'
  set_env_value HTTP_PORT "$fallback_port"
  update_default_local_origin "$fallback_port"
  printf '%s\n' "  [Hinweis] Host-Port 80 ist belegt. Die neue lokale Installation verwendet http://localhost:$fallback_port."
}

create_pre_update_backup() {
  say 'Sicherheitsbackup vor dem Update erstellen'
  compose up -d --no-build --wait --wait-timeout 120 postgres backup
  compose exec -T backup /usr/local/bin/stato-container-backup
  inside_path=$(compose exec -T backup sh -lc 'ls -td /backups/stato-container-* | head -1')
  [ -n "$inside_path" ] || fail 'Das erzeugte Sicherheitsbackup konnte nicht gefunden werden.'
  backup_id=$(compose ps -q backup)
  [ -n "$backup_id" ] || fail 'Der Backup-Container konnte nicht ermittelt werden.'
  mkdir -p "$BACKUP_DIR"
  docker cp "$backup_id:$inside_path" "$BACKUP_DIR"
}

say 'Voraussetzungen prüfen'
require_command docker 'Bitte Docker Engine bzw. Docker Desktop installieren.'
require_command curl 'Bitte curl installieren.'
require_command tar 'Bitte tar installieren.'
if command -v sha256sum >/dev/null 2>&1; then
  checksum() { sha256sum "$1"; }
else
  require_command shasum 'Bitte sha256sum oder shasum installieren.'
  checksum() { shasum -a 256 "$1"; }
fi
require_command od 'Bitte die POSIX-Core-Utilities installieren.'
docker compose version >/dev/null 2>&1 || fail "Das Docker-Compose-Plugin fehlt (erwartet: 'docker compose')."
docker info >/dev/null 2>&1 || fail 'Docker ist nicht erreichbar.'

if [ -z "$RELEASE_TAG" ]; then
  if [ "$BUNDLED_RELEASE_TAG" != '__STATO_RELEASE_TAG__' ]; then
    RELEASE_TAG=$BUNDLED_RELEASE_TAG
  else
    RELEASE_TAG=$(curl -fsSL -A 'StatO-OnPrem-Installer' "https://api.github.com/repos/$REPOSITORY/releases/latest" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)
  fi
fi
[ -n "$RELEASE_TAG" ] || fail 'Die aktuelle StatO-Release-Version konnte nicht ermittelt werden.'
case "$RELEASE_TAG" in v*) VERSION=${RELEASE_TAG#v} ;; *) VERSION=$RELEASE_TAG ;; esac
case "$VERSION" in *[!0-9A-Za-z.+-]*|'') fail "Ungueltiger Release-Tag: $RELEASE_TAG" ;; esac

mkdir -p "$(dirname "$INSTALL_DIR")"
INSTALL_DIR=$(cd "$(dirname "$INSTALL_DIR")" && pwd)/$(basename "$INSTALL_DIR")
CONFIG_DIR="$INSTALL_DIR/config"
ENV_FILE="$CONFIG_DIR/stato.env"
RUNTIME_COMPOSE="$INSTALL_DIR/compose.yaml"
MARKER_FILE="$INSTALL_DIR/.stato-onprem-runtime"
RELEASE_DIR="$INSTALL_DIR/releases/$VERSION"
BACKUP_DIR="$INSTALL_DIR/backups"
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT INT TERM

say "Release $RELEASE_TAG herunterladen"
ASSET="StatO-v$VERSION.tar.gz"
BASE_URL="https://github.com/$REPOSITORY/releases/download/$RELEASE_TAG"
curl -fsSL "$BASE_URL/SHA256SUMS" -o "$TEMP_DIR/SHA256SUMS"
curl -fsSL "$BASE_URL/$ASSET" -o "$TEMP_DIR/$ASSET"
EXPECTED_HASH=$(grep -E "[[:space:]]\*?$ASSET$" "$TEMP_DIR/SHA256SUMS" | awk '{print $1}' | head -n 1)
[ -n "$EXPECTED_HASH" ] || fail "Pruefsumme fuer '$ASSET' fehlt."
ACTUAL_HASH=$(checksum "$TEMP_DIR/$ASSET" | awk '{print $1}')
[ "$EXPECTED_HASH" = "$ACTUAL_HASH" ] || fail 'Die Pruefsumme des Release-Bundles stimmt nicht.'
mkdir -p "$TEMP_DIR/bundle"
tar -xzf "$TEMP_DIR/$ASSET" -C "$TEMP_DIR/bundle"
for path in compose.yaml config/stato.env.example config/Caddyfile config/legal/manifest.json; do
  [ -f "$TEMP_DIR/bundle/$path" ] || fail "Release-Bundle ist unvollstaendig: $path"
done

if [ ! -f "$MARKER_FILE" ] && docker volume ls --format '{{.Name}}' | grep -Fx 'stato-onprem-postgres-data' >/dev/null; then
  fail 'Ein vorhandenes On-Prem-Datenvolume wurde erkannt. Dieses neue Release-Installationsverfahren startet es absichtlich nicht. Nutze fuer die bestehende Installation weiter den bisherigen Installer und migriere erst mit einer getesteten Migrationsanleitung.'
fi

mkdir -p "$INSTALL_DIR" "$CONFIG_DIR" "$(dirname "$RELEASE_DIR")"
umask 077
# Use the previous runtime and credentials until its backup has completed.
if [ -f "$MARKER_FILE" ]; then
  TLS_ENABLED=false
  [ "$(get_env_value STATO_TLS_MODE)" != internal ] || TLS_ENABLED=true
  create_pre_update_backup
  SNAPSHOT_DIR="$BACKUP_DIR/runtime-$(date -u +%Y%m%d-%H%M%S)"
  mkdir -p "$SNAPSHOT_DIR"
  cp -R "$CONFIG_DIR" "$SNAPSHOT_DIR/config"
  cp "$RUNTIME_COMPOSE" "$MARKER_FILE" "$INSTALL_DIR/VERSION" "$SNAPSHOT_DIR/"
fi
if [ ! -d "$RELEASE_DIR" ]; then cp -R "$TEMP_DIR/bundle" "$RELEASE_DIR"; fi
if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$INSTALL_DIR/.env.onprem" ]; then
    cp "$INSTALL_DIR/.env.onprem" "$ENV_FILE"
    printf '%s\n' '  [OK] Vorhandene .env.onprem nach config/stato.env uebernommen.'
  else
    cp "$TEMP_DIR/bundle/config/stato.env.example" "$ENV_FILE"
  fi
fi
[ -f "$CONFIG_DIR/Caddyfile" ] || cp "$TEMP_DIR/bundle/config/Caddyfile" "$CONFIG_DIR/Caddyfile"
[ -d "$CONFIG_DIR/legal" ] || cp -R "$TEMP_DIR/bundle/config/legal" "$CONFIG_DIR/legal"
chmod 600 "$ENV_FILE"

ensure_env_value HTTP_BIND_ADDRESS 0.0.0.0
ensure_env_value STATO_TLS_MODE off
ensure_env_value STATO_PUBLIC_HOST ''
ensure_env_value HTTPS_BIND_ADDRESS 0.0.0.0
ensure_env_value HTTPS_PORT 443
ensure_env_value INITIAL_SETUP_ENABLED true
ensure_env_value INITIAL_SETUP_TOKEN GENERATED_BY_INSTALLER
setup_token=$(get_env_value INITIAL_SETUP_TOKEN)
if [ "$setup_token" = GENERATED_BY_INSTALLER ]; then set_env_value INITIAL_SETUP_TOKEN "$(random_hex 32)"; fi
ensure_env_value STATO_FRONTEND_IMAGE_TAG ''
[ "$(get_env_value POSTGRES_PASSWORD)" != GENERATED_BY_INSTALLER ] || set_env_value POSTGRES_PASSWORD "StatoDb_$(random_hex 24)_A9!"
[ "$(get_env_value JWT_SECRET)" != GENERATED_BY_INSTALLER ] || set_env_value JWT_SECRET "$(random_hex 48)"
set_env_value STATO_IMAGE_TAG "$VERSION"
set_env_value STATO_FRONTEND_IMAGE_TAG "onprem-$VERSION"

if [ -n "${STATO_INTERNAL_TLS_HOST:-}" ]; then
  set_env_value STATO_TLS_MODE internal
  set_env_value STATO_PUBLIC_HOST "$STATO_INTERNAL_TLS_HOST"
fi

TLS_ENABLED=false
TLS_MODE=$(get_env_value STATO_TLS_MODE | tr '[:upper:]' '[:lower:]')
case "$TLS_MODE" in
  off) ;;
  internal)
    PUBLIC_HOST=$(get_env_value STATO_PUBLIC_HOST)
    case "$PUBLIC_HOST" in *://*|*/*|*:*|*' '*|.*|*..*|*.) fail 'STATO_PUBLIC_HOST muss ein DNS-Name ohne Protokoll, Pfad oder Port sein.' ;; *.*) ;; *) fail 'STATO_PUBLIC_HOST muss einen DNS-Namen enthalten.' ;; esac
    HTTPS_PORT_VALUE=$(get_env_value HTTPS_PORT)
    case "$HTTPS_PORT_VALUE" in ''|*[!0-9]*) fail 'HTTPS_PORT muss eine Portnummer zwischen 1 und 65535 sein.' ;; esac
    [ "$HTTPS_PORT_VALUE" -ge 1 ] && [ "$HTTPS_PORT_VALUE" -le 65535 ] || fail 'HTTPS_PORT muss eine Portnummer zwischen 1 und 65535 sein.'
    if [ "$HTTPS_PORT_VALUE" -eq 443 ]; then PUBLIC_URL="https://$PUBLIC_HOST"; else PUBLIC_URL="https://$PUBLIC_HOST:$HTTPS_PORT_VALUE"; fi
    set_env_value HTTP_BIND_ADDRESS 127.0.0.1
    set_env_value APP_ORIGIN "$PUBLIC_URL"
    set_env_value CORS_ORIGINS "$PUBLIC_URL"
    set_env_value AUTH_REFRESH_COOKIE_SECURE true
    TLS_ENABLED=true
    ;;
  *) fail "STATO_TLS_MODE muss 'off' oder 'internal' sein (aktueller Wert: '$TLS_MODE')." ;;
esac

cp "$TEMP_DIR/bundle/compose.yaml" "$RUNTIME_COMPOSE"
for file in onprem-runtime.sh onprem-runtime.ps1 START.md OPERATIONS.md; do
  if [ -f "$TEMP_DIR/bundle/$file" ]; then cp "$TEMP_DIR/bundle/$file" "$INSTALL_DIR/$file"; fi
done
say 'Compose-Konfiguration prüfen'
compose config --quiet
say 'Release-Images laden'
compose pull postgres backend frontend backup
if [ "$TLS_ENABLED" = true ]; then compose pull caddy; fi
say 'HTTP-Port pruefen'
resolve_first_install_http_port

say 'PostgreSQL starten und Zugang synchronisieren'
compose up -d --no-build --wait --wait-timeout 120 postgres
SYNC_SQL="SELECT format('ALTER ROLE %I PASSWORD %L', current_user, :'password') \gexec"
printf '%s\n' "$SYNC_SQL" | compose exec -T postgres sh -c 'exec psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --set "password=$POSTGRES_PASSWORD"'
SCHEMA_STATE=$(printf '%s\n' "SELECT CASE WHEN to_regclass('public.users') IS NULL THEN 'missing' ELSE 'present' END;" | compose exec -T postgres sh -c 'exec psql --tuples-only --no-align --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1')
case "$SCHEMA_STATE" in missing|present) ;; *) fail 'Der Datenbankstatus konnte nicht ermittelt werden.' ;; esac

say 'Berechtigungen des Upload-Verzeichnisses prüfen'
compose run --rm --no-deps --user 0 --cap-add CHOWN --cap-add DAC_OVERRIDE --cap-add FOWNER --entrypoint sh backend -c 'mkdir -p /app/uploads/images /app/uploads/project-documents && chown -R node:node /app/uploads'
if [ "$SCHEMA_STATE" = missing ]; then
  say 'Leere Datenbank initialisieren'
  DB_SYNCHRONIZE=true DB_MIGRATIONS_RUN=false compose up -d --no-build --force-recreate --wait --wait-timeout 120 backend
  compose up -d --no-build --force-recreate --wait --wait-timeout 120 backend
fi

say 'StatO starten'
compose up -d --no-build --wait --wait-timeout 180
compose exec -T frontend wget -q -O /dev/null http://127.0.0.1:8080/api/health
compose ps
printf '%s\n' "$RELEASE_TAG" > "$MARKER_FILE"
printf '%s\n' "$VERSION" > "$INSTALL_DIR/VERSION"
printf '\nInstallation: %s\nKonfiguration: %s\nRelease:      %s\n' "$INSTALL_DIR" "$ENV_FILE" "$RELEASE_TAG"
printf 'Adresse:      %s\nEinrichtungscode: INITIAL_SETUP_TOKEN in %s\n' "$(get_env_value APP_ORIGIN)" "$ENV_FILE"
