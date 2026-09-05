# Container security

## Build and publication policy

- The daily scan runs at 05:23 UTC on the default branch. It rebuilds the current
  source with fresh base images and runtime package layers; it does not deploy.
- SARIF reports retain all vulnerability severities, including findings without
  a published fix. Existing backend/frontend/backup categories remain stable.
- Scanner errors and fixable HIGH/CRITICAL findings block publication. LOW/MEDIUM
  findings remain visible for triage and are not silently suppressed.
- Publishing jobs first upload an untagged candidate by its content digest. Every
  requested architecture is scanned before deployment/release tags are assigned
  to that same digest. SBOM/provenance attestations are retained; no rebuild takes
  place after approval by the scanner. A failed candidate may remain untagged in
  GHCR but is never promoted by this workflow.
- Manual and automatic `latest` promotions resolve release tags to immutable
  digests, scan AMD64 and ARM64, and only start tagging after all images pass.
- A green scan of rebuilt source does not certify previously deployed images.
  Existing installations need a new tested release and container replacement.

## Runtime images

Backend and backup refresh Alpine packages at build time. Publication and scan
builds invalidate the `runner` stage so Docker does not retain an old package
upgrade layer. The backup copies PostgreSQL 16 client tools and libpq from the
official image onto the same Alpine release, with only their runtime libraries.
It does not contain the PostgreSQL server, extensions or gosu. Nginx does not
include the unused image-filter module and its X11/libuuid dependency chain.

## Validation

```sh
node --test scripts/container-security.test.mjs
bash scripts/test-backup-image.sh stato-backup:security-scan
```

The backup test creates an isolated database, network and volume, verifies dump
checksums, restores into a second database and compares restored upload contents.
It removes its disposable resources on exit. On Windows/Git Bash, set
`MSYS_NO_PATHCONV=1` when calling it to preserve Docker mount paths.

## Triage on 2026-09-05

The original 40 alerts were ten OpenSSL CVEs repeated for libssl3 and libcrypto3
in the backend and backup images. Updating 3.5.7-r0 to 3.5.8-r0 addresses them.
Fresh scans also exposed util-linux findings inherited through unused libuuid
dependencies (removed with the unused server/image-filter components), and two
qs findings (CVE-2026-82417, CVE-2026-82562), addressed with qs 6.16.0.

Dependabot alerts, automated security fixes, secret scanning and push protection
were enabled in GitHub. Newly visible npm alerts also cover build tooling and
other application dependencies. Review the generated Dependabot PRs separately;
a clean final container scan does not establish that the complete npm dependency
tree is free of vulnerabilities. Frontend lint is now part of the quality gate.
