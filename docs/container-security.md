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

## Dependency follow-up

The follow-up updates React Router to 7.18.2 and Vite to the security-supported
6.4 line, plus the compatible minor/patch dependency group. The lockfile includes
fast-uri 3.1.7, postcss-selector-parser 6.1.4, fflate 0.8.3 and nanoid 3.3.18.
js-yaml 3/4 stay on their respective patched major versions; Swagger 11.4.7
brings patched js-yaml 5.3.0, replacing the Docker-only npm installation.
The Trivy setup action is pinned to 0.3.1, including its script-injection fix.

Router regressions cover public survey links, protected deep links, navigation,
restricted admin routes and password/terms gates. ELK compatibility tests check
branch layouts in both application directions for non-overlapping nodes.

Node 26 Docker updates are deferred while the project requires Node 24 LTS.
TypeScript 7 is deferred because ts-jest still needs the TypeScript 5 compiler API.
Dependabot ignores those major updates until a deliberate toolchain migration.
The optional Lucide and concurrently major updates remain separate reviews.

## Triage on 2026-11-17

The default-branch scan reported 227 open Trivy findings: 226 Debian Bookworm
package findings and one npm finding, representing 105 distinct vulnerability
identifiers. Frontend and backup scans were empty. The increase followed the
2026-11-11 backend switch from Alpine to Bookworm for the Node security release;
the scan immediately before that change contained only the npm finding.

### npm dependencies

The root and desktop manifests override only affected minimatch versions
(`>=7 <11.0.1`) to 11.0.1. This covers the runtime archiver/readdir-glob chain,
Nest CLI, lint/test/build tooling and electron-builder, including nested 9.x
copies. Unaffected 3.x and 5.x consumers retain their existing major-version API.
The root also overrides affected glob versions (`>=9 <=14.0.1`) to 14.0.2 after
the follow-up audit identified its cancellation bug in development dependencies.
Keep these overrides until the parent packages require patched versions.

- [minimatch advisory, CVE-2026-118764](https://github.com/advisories/GHSA-g3hv-75wg-m249)
- [glob advisory, CVE-2026-118773](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)

Both lockfile audits reported zero vulnerabilities after these changes. This is
a point-in-time result, not a guarantee against future advisories. Validation
covered backend tests (including streamed ZIP exports), frontend tests and PWA
build, and desktop tests and Windows directory packaging.

### Desktop runtime

Electron 44.11.1 and 44.11.3 still embed Node 24.22.2, so the existing runtime
gate correctly blocks their installers. Desktop moves to Electron 45.3.3,
whose embedded Node 24.22.3 passes the unchanged gate. This is a major Electron
upgrade; the real Electron smoke suite covers startup, server connections,
sandbox/IPC isolation, previews/downloads, updater integrity, saved credentials,
offline recovery and window controls.
Source: [Electron 45.3.3 release](https://github.com/electron/electron/releases/tag/v45.3.3).

### Bookworm findings that do not affect the reported binary packages

| Finding | GitHub alerts | Vendor evidence |
| --- | --- | --- |
| CVE-2023-45853, zlib1g | #812 | Debian does not build the affected contrib/minizip code into the Bookworm zlib binaries. |
| CVE-2026-3184, util-linux binaries | #421, #492, #699, #718, #756, #767, #801, #809 | Bookworm's util-linux source does not build the affected login program; it moved there only in 2.40.2-3. |

Sources: [Debian zlib assessment](https://security-tracker.debian.org/tracker/CVE-2023-45853)
and [Debian util-linux assessment](https://security-tracker.debian.org/tracker/CVE-2026-3184).
These conclusions apply to those specific Bookworm packages, not every package
or future version with the same CVE. A missing fixed version alone is not a
reason to dismiss an alert. For example, Bookworm's PAM CVE-2025-6020 and zlib
CVE-2026-85091 remain vendor-confirmed package issues, whose exploitability also
depends on which functionality the application invokes.

All-severity reporting and publication gates remain enabled. No blanket CVE
ignore list or bulk alert dismissal is introduced by this triage.

### Backend runtime

The official Node 24 Alpine images now supply Node 24.22.3 for AMD64 and ARM64.
The backend returns to that image family, updates Alpine packages, and rejects
any base below the existing Node 24.22.3 security baseline. No manually downloaded
Node binary or curl dependency stack is added. The native sharp smoke test still
runs inside every built architecture before publication.

Both AMD64 and ARM64 backend candidates had zero Trivy findings across all
severities with the 2026-11-17 database and passed native sharp image processing.
The AMD64 backend also started against an isolated PostgreSQL 16 database,
applied all 53 migrations and served a healthy API with a read-only rootfs,
non-root user and all capabilities dropped.
A Trixie comparison still had 202 findings, including
46 HIGH, so switching to newer Debian alone was not selected. Scan counts are
vendor/package-based and do not substitute for compatibility tests or prove that
every reported CVE is reachable from StatO. Existing Bookworm deployments need
an updated image; source changes alone do not remediate installed containers.
