#!/bin/sh
set -eu
interval=${BACKUP_INTERVAL_SECONDS:-0}
case "$interval" in ''|*[!0-9]*) echo 'Invalid BACKUP_INTERVAL_SECONDS' >&2; exit 1 ;; esac
if [ "$interval" -eq 0 ]; then exec sleep infinity; fi
[ "$interval" -ge 60 ] || { echo 'Backup interval must be at least 60 seconds.' >&2; exit 1; }
trap 'exit 0' TERM INT
while :; do
  if ! /usr/local/bin/stato-container-backup; then
    echo 'Automatic backup failed; see container logs. Retrying at the next interval.' >&2
  fi
  sleep "$interval" &
  wait $! || true
done
