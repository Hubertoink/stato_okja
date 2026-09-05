#!/bin/sh
# Run from the installed release directory. No Docker socket in the application.
set -eu
cd "$(dirname "$0")"
compose() { docker compose --env-file config/stato.env -f compose.yaml "$@"; }
case "${1:-status}" in
  status)
    compose ps
    compose exec -T backup sh -c 'if [ -f /backups/last-success.txt ]; then cat /backups/last-success.txt; else echo "Noch kein erfolgreiches automatisches Backup."; fi'
    ;;
  backup)
    compose exec -T backup /usr/local/bin/stato-container-backup
    ;;
  restore)
    [ "${3:-}" = 'RESTORE STATO BACKUP' ] || { echo "Usage: sh onprem-runtime.sh restore /absolute/backup/path 'RESTORE STATO BACKUP'" >&2; exit 1; }
    backup_path=$(cd "$2" && pwd)
    for file in postgres.dump uploads.tar.gz SHA256SUMS; do test -s "$backup_path/$file"; done
    # Verify locally before stopping anything. Checksum entries are never executed.
    (cd "$backup_path"
      # Older container backups recorded absolute /backups/... paths. Verify
      # their local basenames instead, never paths supplied by the archive.
      checked_db=false; checked_uploads=false
      while read -r expected file; do
        printf '%s' "$expected" | grep -Eq '^[a-fA-F0-9]{64}$'
        printf '%s' "$file" | grep -Eq '^(/backups/stato-container-[A-Za-z0-9-]+/)?(postgres.dump|uploads.tar.gz|config.tar.gz|VERSION)$'
        file=${file##*/}
        if command -v sha256sum >/dev/null 2>&1; then actual=$(sha256sum "$file"); else actual=$(shasum -a 256 "$file"); fi
        [ "$(printf '%s' "$expected" | tr 'A-F' 'a-f')" = "${actual%% *}" ]
        [ "$file" != postgres.dump ] || checked_db=true
        [ "$file" != uploads.tar.gz ] || checked_uploads=true
      done < SHA256SUMS
      [ "$checked_db" = true ] && [ "$checked_uploads" = true ])
    compose up -d --wait --wait-timeout 120 postgres
    compose stop frontend backend backup
    db_id=$(compose ps -q postgres)
    docker cp "$backup_path/postgres.dump" "$db_id:/tmp/stato-restore.dump"
    compose exec -T postgres sh -ec 'pg_restore --exit-on-error --clean --if-exists --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB" /tmp/stato-restore.dump; rm /tmp/stato-restore.dump'
    # Restore only the application upload volume, via its declared mount.
    upload_id=$(compose ps -aq backend)
    docker cp "$backup_path/uploads.tar.gz" "$upload_id:/app/uploads/.stato-restore.tar.gz"
    compose run --rm --no-deps --user 0 --cap-add CHOWN --cap-add DAC_OVERRIDE --cap-add FOWNER --entrypoint sh backend -ec 'cd /app/uploads; find . -mindepth 1 -maxdepth 1 ! -name .stato-restore.tar.gz -exec rm -rf {} +; tar -xzf .stato-restore.tar.gz; rm .stato-restore.tar.gz; chown -R node:node .'
    compose up -d --wait --wait-timeout 180 postgres backend frontend backup
    compose exec -T frontend wget -q -O /dev/null http://127.0.0.1:8080/api/health
    echo 'Wiederherstellung erfolgreich.'
    ;;
  *) echo 'Commands: status, backup, restore' >&2; exit 1 ;;
esac
