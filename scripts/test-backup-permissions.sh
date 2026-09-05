#!/usr/bin/env bash
set -euo pipefail
image="${1:-stato-backup:distribution-review}"
test_id="stato-backup-permissions-$$-$RANDOM"
cleanup() {
  docker rm -f "$test_id-db" >/dev/null 2>&1 || true
  docker volume rm "$test_id-config" "$test_id-copy" "$test_id-data" >/dev/null 2>&1 || true
  docker network rm "$test_id-net" >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker network create "$test_id-net" >/dev/null
for suffix in config copy data; do docker volume create "$test_id-$suffix" >/dev/null; done
mounts=(-v "$test_id-config:/mnt/config" -v "$test_id-copy:/mnt/backup-copy" -v "$test_id-data:/test")
docker run --rm "${mounts[@]}" --entrypoint sh "$image" -ec '
  mkdir -p /test/uploads
  printf "test configuration\n" > /mnt/config/stato.env
  chown -R 1001:1001 /mnt/config /mnt/backup-copy
  chmod 700 /mnt/config /mnt/backup-copy
  chmod 600 /mnt/config/stato.env
'
docker run -d --name "$test_id-db" --network "$test_id-net" --network-alias postgres \
  --tmpfs /var/lib/postgresql/data -e POSTGRES_PASSWORD=disposable-test-password postgres:16-alpine >/dev/null
options=(--rm --network "$test_id-net" --read-only --tmpfs /tmp --security-opt no-new-privileges:true --cap-drop ALL
  "${mounts[@]}" -e PGHOST=postgres -e PGUSER=postgres -e PGDATABASE=postgres -e PGPASSWORD=disposable-test-password
  -e BACKUP_OUTPUT_DIR=/test/backups -e BACKUP_UPLOADS_DIR=/test/uploads)
if docker run "${options[@]}" --entrypoint /usr/local/bin/stato-container-backup "$image"; then
  echo 'Expected backup without filesystem capability to fail on protected host files.' >&2
  exit 1
fi
echo 'Reproduced Linux permission failure.'
docker run "${options[@]}" --cap-add DAC_OVERRIDE --cap-add CHOWN --entrypoint /usr/local/bin/stato-container-backup "$image"
docker run --rm "${mounts[@]}" --entrypoint sh "$image" -ec '
  test -s /test/backups/last-success.txt
  set -- /mnt/backup-copy/stato-container-*
  test "$#" -eq 1
  cd "$1"
  test "$(stat -c %u config.tar.gz)" = 1001
  sha256sum -c SHA256SUMS
  tar -xOzf config.tar.gz ./stato.env | cmp - /mnt/config/stato.env
'
echo 'Protected configuration and second destination backed up successfully.'
