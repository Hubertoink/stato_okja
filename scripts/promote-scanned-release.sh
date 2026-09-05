#!/usr/bin/env bash
# Scan the requested release itself, including manual promotions of old tags.
set -euo pipefail
version="${1:?Release version is required}"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
shift
(( $# > 0 ))
checked_refs=()
for image in "$@"; do
  image="${image,,}"
  digest="$(docker buildx imagetools inspect "$image:$version" --format '{{.Manifest.Digest}}')"
  image_ref="$image@$digest"
  # Release images must include both supported architectures.
  bash scripts/check-container-security.sh "$image_ref" linux/amd64,linux/arm64
  checked_refs+=("$image_ref")
done
# No latest tag is changed until every image has passed.
for image_ref in "${checked_refs[@]}"; do
  docker buildx imagetools create --tag "${image_ref%@*}:latest" "$image_ref"
done
