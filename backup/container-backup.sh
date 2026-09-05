#!/bin/sh
set -eu
umask 077

: "${PGHOST:=postgres}"
: "${PGPORT:=5432}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${BACKUP_OUTPUT_DIR:=/backups}"
: "${BACKUP_UPLOADS_DIR:=/mnt/uploads}"
: "${BACKUP_RETENTION_DAYS:=14}"
: "${BACKUP_PREFIX:=stato-container}"

case "$BACKUP_RETENTION_DAYS" in
  ''|*[!0-9]*)
    echo "BACKUP_RETENTION_DAYS must be a non-negative integer." >&2
    exit 1
    ;;
esac

if [ ! -d "$BACKUP_UPLOADS_DIR" ]; then
  echo "Uploads directory not found: $BACKUP_UPLOADS_DIR" >&2
  exit 1
fi

mkdir -p "$BACKUP_OUTPUT_DIR"
exec 9>"$BACKUP_OUTPUT_DIR/.backup.lock"
flock -w 180 9 || { echo 'Another backup is still running.' >&2; exit 1; }

timestamp="$(date -u +%Y%m%d-%H%M%S)"
generated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
backup_root="$BACKUP_OUTPUT_DIR/$BACKUP_PREFIX-$timestamp-$$"
final_root="$backup_root"
backup_root="$BACKUP_OUTPUT_DIR/.$BACKUP_PREFIX-$timestamp-$$.incomplete"
incomplete_root="$backup_root"
trap 'if [ -d "$incomplete_root" ]; then rm -rf "$incomplete_root"; fi' EXIT
db_dump_path="$backup_root/postgres.dump"
uploads_archive_path="$backup_root/uploads.tar.gz"

mkdir -p "$backup_root"

echo "Waiting for Postgres at $PGHOST:$PGPORT..."
attempt=1
while ! pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" >/dev/null 2>&1; do
  if [ "$attempt" -ge 30 ]; then
    echo "Postgres is not ready after $attempt attempts." >&2
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep 2
done

echo "Creating Postgres custom-format dump..."
export PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE
pg_dump --format=custom --no-owner --no-acl --file="$db_dump_path"

echo "Archiving uploads from $BACKUP_UPLOADS_DIR..."
tar -czf "$uploads_archive_path" -C "$BACKUP_UPLOADS_DIR" .

extra_files=''
if [ -d /mnt/config ]; then
  tar -czf "$backup_root/config.tar.gz" -C /mnt/config .
  extra_files="$extra_files, {\"path\": \"config.tar.gz\", \"purpose\": \"Instance configuration including secrets\"}"
fi
if [ -n "${STATO_BACKUP_VERSION:-}" ]; then
  printf '%s\n' "$STATO_BACKUP_VERSION" > "$backup_root/VERSION"
  extra_files="$extra_files, {\"path\": \"VERSION\", \"purpose\": \"Installed image version\"}"
fi
(cd "$backup_root" && sha256sum postgres.dump uploads.tar.gz > SHA256SUMS
  if [ -f config.tar.gz ]; then sha256sum config.tar.gz >> SHA256SUMS; fi
  if [ -f VERSION ]; then sha256sum VERSION >> SHA256SUMS; fi)

cat > "$backup_root/manifest.json" <<EOF
{
  "format": "stato-container-backup",
  "schemaVersion": 1,
  "generatedAt": "$generated_at",
  "databaseHost": "$PGHOST",
  "databaseName": "$PGDATABASE",
  "uploadsDir": "$BACKUP_UPLOADS_DIR",
  "retentionDays": $BACKUP_RETENTION_DAYS,
  "files": [
    { "path": "postgres.dump", "purpose": "Postgres custom-format dump" },
    { "path": "uploads.tar.gz", "purpose": "Backend uploads volume archive" },
    { "path": "SHA256SUMS", "purpose": "Backup file checksums" }$extra_files
  ]
}
EOF

mv "$backup_root" "$final_root"
backup_root="$final_root"
# A mounted second destination can be a host directory on separate storage.
if [ -d /mnt/backup-copy ]; then
  cp -R "$backup_root" /mnt/backup-copy/
  # Keep exported private files readable by the owner of the destination,
  # including non-root Docker users on Linux.
  destination_owner=$(stat -c '%u:%g' /mnt/backup-copy)
  chown -R "$destination_owner" "/mnt/backup-copy/$(basename "$backup_root")"
fi
printf '%s\n' "$generated_at" > "$BACKUP_OUTPUT_DIR/last-success.txt"

if [ "$BACKUP_RETENTION_DAYS" -gt 0 ]; then
  find "$BACKUP_OUTPUT_DIR" -mindepth 1 -maxdepth 1 -type d -name "$BACKUP_PREFIX-*" -mtime +"$BACKUP_RETENTION_DAYS" -exec rm -rf {} +
fi

echo "Backup created: $backup_root"
echo "Database dump: $backup_root/postgres.dump"
echo "Uploads archive: $backup_root/uploads.tar.gz"
