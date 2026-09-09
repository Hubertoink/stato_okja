# Upload Storage and Edit Conflicts

## Deployment

Run the migrations before starting the new application version:

- `StoredUploadScopes20260909120000` creates `stored_uploads` and backfills access grants from existing project images, templates, banners, avatars and process files.
- `ActivityVersion20260909121000` adds the activity version counter.

The deployment configurations use `UPLOAD_SCOPE_QUOTA_BYTES=536870912` by default (512 MiB per scope). Invalid or non-positive values fall back to this default. PostgreSQL reservations use transaction-scoped advisory locks, so concurrent uploads cannot both consume the last available capacity. SQLite development mode does not provide that concurrent reservation guarantee.

Configure `TRUST_PROXY=1` for the supplied deployments: only the nearest proxy hop is trusted. `true` remains an alias for one hop; an unset value disables trust. Explicit proxy IPs/CIDRs or a different fixed hop count are supported for controlled topologies. Do not expose the backend directly to clients when using a hop count. In Mittwald, route the backend through its hosting ingress and keep the hop count at one unless the verified ingress topology requires otherwise.

All bundled nginx configurations replace incoming `X-Forwarded-For` with `$remote_addr`. An additional upstream proxy may therefore cause clients to share one rate-limit bucket. Recover individual client IPs only by configuring nginx real-IP handling for the exact trusted upstream addresses; never trust every private network.

## Access and Accounting

Uploads require authentication and an active organization scope. Knowing a filename is not sufficient. Superadmins can read registered uploads across organizations. Ordinary users can read files granted to their effective organization or their personal scope. Avatar uploads receive grants for the owner and their active memberships at upload time.

Images referenced by an available global or ancestor project template remain readable, provided the template's owning scope has a grant. Saving a project with such an image creates an idempotent grant for the target organization after checking visibility, and charges that organization for the image. The grant survives archiving or deleting the source template. Private ancestor images cannot be adopted by supplying their URL. Grants are not automatically transferred when a user changes memberships or a record moves between organizations.

File writes are asynchronous. Failed writes release their reservations. File uploads are limited to 12 MiB; image originals to 10 MiB and re-encoded images to 3 MiB. Each upload endpoint allows ten requests per minute per configured throttling identity. Protected responses use `private, no-store`; the frontend blob cache is separated by session and organization.

An asynchronous maintenance pass runs at startup and hourly. It reconciles recorded sizes with files on disk, including legacy and restored uploads. Restore scans the actual files and updates all registered sizes in the import transaction before committing; imported size metadata is not trusted. A scan failure rolls back the restore. Administrative deletion releases the associated quota after the file is removed.

Registered files with no project, template, avatar, banner, project-document or process reference are automatically removed after seven days. Both file modification time and all registration timestamps must be older than the grace period. Unknown legacy files are left untouched. Old registrations for missing files are removed; fresh in-flight reservations are preserved. Keep regular backups and avoid reusing long-abandoned unsaved upload URLs.

## Activity API

Activity responses include `version`. Editors send that baseline as `expectedVersion` in PATCH requests. A stale baseline returns HTTP 409 without changing the activity. The frontend retains the unsaved form and reports the conflict; reload and reconcile the changes before retrying.

The update and relation writes commit in one transaction after an atomic version comparison. Acknowledgment changes increment the version too. `expectedVersion` remains optional for existing API clients, but clients omitting it cannot detect edits made before their request began.

## Local Verification

The disposable Docker environment is available at `http://localhost:18080`. The smoke test is restricted to a database named `stato_review`. It creates temporary organizations, users, sessions and an isolated migration schema, then removes its own fixtures. It does not initialize or change the administrator account.

From the repository root, with Docker group access:

```sh
docker exec -i stato-review-backend-1 node < scripts/test-review-security.cjs
```

The script verifies PostgreSQL upgrade migrations, generated upload IDs, authenticated file access, tenant isolation, inherited template sharing, concurrent quota reservations and concurrent activity saves. Avoid running it repeatedly within one minute because the normal HTTP upload rate limits remain enabled.