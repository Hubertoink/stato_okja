#!/usr/bin/env bash
# An isolated database and disposable volumes; never uses deployment data.
set -euo pipefail
image="${1:-stato-backup:security-scan}"
test_id="stato-backup-test-$$-$RANDOM"
db_container="$test_id-db"
network="$test_id-net"
volume="$test_id-data"
cleanup() {
  docker rm -f "$db_container" >/dev/null 2>&1 || true
  docker volume rm "$volume" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker network create "$network" >/dev/null
docker volume create "$volume" >/dev/null
docker run -d --name "$db_container" --network "$network" --network-alias postgres \
  --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_USER=backup_test -e POSTGRES_PASSWORD=disposable-backup-test-password \
  -e POSTGRES_DB=source postgres:16-alpine >/dev/null

for attempt in {1..30}; do
  if docker exec "$db_container" pg_isready -U backup_test -d source >/dev/null 2>&1; then break; fi
  if [ "$attempt" = 30 ]; then echo 'Test database did not become ready.' >&2; exit 1; fi
  sleep 1
done
docker run --rm --network "$network" -v "$volume:/test" \
  -e PGHOST=postgres -e PGUSER=backup_test -e PGPASSWORD=disposable-backup-test-password \
  -e PGDATABASE=source -e BACKUP_OUTPUT_DIR=/test/backups -e BACKUP_UPLOADS_DIR=/test/uploads \
  --entrypoint sh "$image" -ec '
    mkdir -p /test/uploads
    printf "backup fixture\n" > /test/uploads/example.txt
    psql -v ON_ERROR_STOP=1 -c "CREATE TABLE fixture (id integer PRIMARY KEY, value text); INSERT INTO fixture VALUES (1, '\''restored'\'');"
    stato-container-backup
    set -- /test/backups/*
    if [ "$#" -ne 1 ] || [ ! -d "$1" ]; then
      echo "Expected exactly one backup directory in the disposable volume." >&2
      exit 1
    fi
    backup_dir=$1
    sha256sum -c "$backup_dir/SHA256SUMS"
    psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE restored;"
    pg_restore --exit-on-error --no-owner --no-acl -d restored "$backup_dir/postgres.dump"
    test "$(psql -d restored -Atc "SELECT value FROM fixture WHERE id = 1")" = restored
    mkdir /test/restored-uploads
    tar -xzf "$backup_dir/uploads.tar.gz" -C /test/restored-uploads
    cmp /test/uploads/example.txt /test/restored-uploads/example.txt
    echo "Database and uploads restored successfully."
  '
