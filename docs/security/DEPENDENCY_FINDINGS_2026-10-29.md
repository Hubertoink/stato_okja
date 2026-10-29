# Dependency findings — 2026-10-29

## Security updates on dev

The 27 open Dependabot alerts were grouped into six packages. This update keeps
the existing major versions and addresses all findings with a published patch:

| Package | Previous | Updated |
| --- | --- | --- |
| Electron (desktop runtime) | 44.5.1 | 44.10.0 |
| undici (frontend test tools) | 8.11.2 | 8.12.3 |
| undici (desktop build/download tools) | 7.30.0 / 6.29.0 | 7.30.1 / 6.29.1 |
| fast-uri (both lockfiles) | 3.1.8 | 3.1.9 |
| serialize-javascript (build tools) | 7.0.7 | 7.1.4 |
| Vitest and @vitest/mocker | 4.1.11 | 4.1.12 |

Electron is declared as a development dependency but is shipped as the desktop
runtime. Its compromised-certificate mitigation is therefore relevant to users,
not just build machines. See the
[Electron advisory](https://github.com/electron/electron/security/advisories/GHSA-jr5w-w6x2-84p9).

## Remaining finding

[GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
affects deepmerge 4.3.1. No patched release was available at the time of this
update. The dependency is used by Jest, Rollup/Workbox and Nest build tooling;
it is not a production dependency in the root lockfile. Exploitation requires
attacker-controlled merge inputs. Build and test configurations must remain
trusted.

The root audit reports nine LOW entries: deepmerge and its affected parent
packages. These are not nine independent advisories. npm's suggested forced
remediation includes downgrading Jest to 25.1.0 and vite-plugin-pwa to 0.2.1;
those incompatible downgrades are not applied. The advisory remains visible
and should be revisited when deepmerge or its consumers publish a safe update.
No alert is dismissed and no audit suppression is introduced.

## Audit results

- `npm audit --package-lock-only --json`: 0 critical, 0 high, 0 moderate,
  9 low (the deepmerge dependency chain above).
- `npm audit --prefix desktop --package-lock-only --json`: 0 findings.
- `npm audit --omit=dev --package-lock-only --json`: 0 findings.

## Validation

- Backend tests: 44 suites / 242 tests passed; one suite / three tests skipped
  by the existing environment-dependent test configuration.
- Frontend TypeScript and UI primitive checks passed.
- Frontend tests: all 83 suites / 357 tests passed with `--maxWorkers=2`.
  The initial unbounded run alongside builds timed out on two asynchronous UI
  waits; the complete bounded rerun passed without test or application changes.
- Backend and frontend production builds passed, including PWA generation.
- Desktop lint, 11 unit tests and the real Electron smoke suite passed.
- Windows NSIS installer built successfully with Electron 44.10.0.
- Application version consistency and `git diff --check` passed.

The local default toolchain was Node 22 / npm 10. Its workspace install hit an
internal npm peer-resolution error. Root dependency updates and web validation
used Node 24.22.2 (the project's supported major); npm 11.21.1 resolved the
workspace successfully. No global toolchain or project engine setting changed.

## Delivery

The dev push triggers the Windows desktop workflow, including Electron smoke
tests and a new installer artifact. Existing desktop installations are not
patched by a source push: they must install a rebuilt client. A production
desktop release additionally needs a new application version and the normal
release from main. Dependabot alerts on main remain open until the updated
lockfiles reach that branch. No production rollout is implied by these audits;
previously deployed containers and clients must be checked separately.
