#!/usr/bin/env bash
# Fail closed on scanner errors and on fixable HIGH/CRITICAL vulnerabilities.
# Callers supply immutable digests so promotion cannot race a mutable tag.
set -euo pipefail

image_ref="${1:?Image digest is required}"
platform_list="${2:?Comma-separated platforms are required}"
if [[ ! "$image_ref" =~ @sha256:[a-f0-9]{64}$ ]]; then
  echo 'Security checks require an immutable sha256 image reference.' >&2
  exit 1
fi
IFS=',' read -r -a platforms <<< "$platform_list"
status=0
for platform in "${platforms[@]}"; do
  trivy image --image-src remote --platform "$platform" \
    --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed \
    --exit-code 1 --timeout 10m "$image_ref" || status=1
done
exit "$status"
