# Security Hardening Plan 2026-05-02

Stand: 2026-05-02

Diese Datei hält die Umsetzung der ersten beiden Security-Pakete fest: Container/Deployment-Härtung und Auth/API-Sicherheit rund um kurze Access Tokens, Refresh Tokens und CSRF-Schutz.

## 1. Container-Security und Deployment

### Umgesetzt

- Backend- und Frontend-Dockerfiles nutzen jetzt den Repository-Root als Build-Kontext, damit `npm ci` mit dem Workspace-Lockfile verwendet wird.
- Backend-Runtime läuft als Non-Root-User `node`.
- Frontend-Runtime nutzt `nginxinc/nginx-unprivileged` und lauscht intern auf Port `8080`; Compose mappt weiterhin Host-Port `80` auf den Frontend-Container.
- `.dockerignore` reduziert den Build-Kontext und verhindert, dass lokale Artefakte, `node_modules`, `.env`-Dateien oder Build-Ausgaben in Images landen.
- `docker-compose.onprem.yml` und `docker-compose.prod.yml` setzen für Backend und Frontend:
  - `read_only: true`
  - `tmpfs` für benötigte Schreibpfade
  - `cap_drop: [ALL]`
  - `security_opt: no-new-privileges:true`
- Postgres bekommt `no-new-privileges:true`; `cap_drop: [ALL]` ist dort bewusst nicht gesetzt, weil das offizielle Postgres-Image beim Start Dateirechte im Daten- und Socket-Verzeichnis korrigieren muss.
- Healthchecks sind ergänzt:
  - Postgres via `pg_isready`
  - Backend via `/api/health`
  - Frontend via `/healthz`
- Nginx setzt zusätzlich `server_tokens off` und `Strict-Transport-Security`.
- GitHub Actions bauen Backend/Frontend weiter als Images, jetzt mit root-Kontext, SBOM/Provenance für Buildx und zusätzlichem Security-Scan-Job.
- Trivy scannt Backend- und Frontend-Images auf `HIGH`/`CRITICAL` Findings und lädt SARIF in GitHub Security hoch.
- Eine Repository-SBOM wird als SPDX-JSON-Artefakt erzeugt.
- Dependabot ist für npm, GitHub Actions und Dockerfiles aktiviert.

### Betriebsnotizen

- Bei bestehenden On-Prem-Volumes kann der Backend-Upload-Volume-Besitz noch root-basiert sein. Falls Uploads nach dem Update nicht schreibbar sind, muss das Volume einmalig auf den Container-User korrigiert werden.
- Das Frontend läuft intern nicht mehr auf Port `80`, sondern auf `8080`. Extern bleibt die Compose-Veröffentlichung `80:8080`.
- `read_only` ist für Backend/Frontend aktiv; zusätzliche Schreibpfade müssen künftig explizit als Volume oder `tmpfs` modelliert werden.

## 2. API- und Backend-Sicherheit

### Umgesetzt

- Standard-Lebensdauer für Access Tokens ist von `12h` auf `15m` reduziert.
- Neuer Refresh-Token-Mechanismus:
  - Refresh Token wird als `HttpOnly` Cookie `stato_refresh_token` gesetzt.
  - Refresh Token ist ein opaker Token aus ID und Secret.
  - Serverseitig werden nur Hashes gespeichert.
  - Jede Refresh-Nutzung rotiert Refresh Token und CSRF-Token.
  - Passwortänderungen und Passwort-Resets widerrufen bestehende Refresh Sessions.
- Neuer CSRF-Schutz für Refresh:
  - Backend gibt zusätzlich `refresh_csrf_token` an das Frontend zurück.
  - Frontend speichert dieses Token tablokal in `sessionStorage`.
  - `/auth/refresh` akzeptiert nur Requests mit passendem `X-CSRF-Token` Header.
- Neuer Logout-Endpunkt `/auth/logout` löscht das Refresh-Cookie und widerruft die Refresh Session, wenn der CSRF-Header vorhanden ist.
- Frontend sendet API-Requests mit `withCredentials: true`, damit das `HttpOnly` Refresh-Cookie genutzt werden kann.
- Frontend erneuert Access Tokens bei `401` automatisch über `/auth/refresh` und wiederholt den ursprünglichen Request einmal.
- Auth-Requests nutzen DTOs mit `class-validator` statt reinem TypeScript-Body-Typing.
- Backend-Health-Endpunkt `/api/health` ist ergänzt und für Container-Healthchecks nutzbar.

### Neue/Geänderte ENV-Werte

| Variable | Default | Zweck |
| --- | --- | --- |
| `JWT_ACCESS_EXPIRATION` | `15m` | Kurze Access-Token-Lebensdauer. |
| `JWT_REFRESH_EXPIRATION` | `7d` | Lebensdauer der Refresh Session. Unterstützt Werte wie `30m`, `12h`, `7d`. |
| `AUTH_REFRESH_COOKIE_SAMESITE` | `lax` | SameSite-Policy für das Refresh-Cookie: `lax`, `strict` oder `none`. |
| `AUTH_REFRESH_COOKIE_SECURE` | abgeleitet | Optionaler Override. Ohne Override ist das Cookie in Strict-Security-Mode secure. |

### Prüfpfade

- Login muss `access_token`, `refresh_csrf_token` und Userdaten liefern; das Refresh Token darf nur als `HttpOnly` Cookie gesetzt werden.
- Nach Ablauf des Access Tokens muss ein normaler API-Request automatisch einen Refresh auslösen und danach erfolgreich wiederholt werden.
- Logout muss das Cookie entfernen und die lokale Session leeren.
- Passwortwechsel muss alte Refresh Tokens ungültig machen.
- On-Prem-Compose muss alle Services als healthy anzeigen, bevor das Frontend als healthy gilt.

## Noch offen nach Paket 1 und 2

- Multi-Device-Session-Tabelle, Backend-Endpunkte und Profil-UI sind im Folgepaket umgesetzt. Details: [SECURITY_PRIORITIES_2026-05-02.md](SECURITY_PRIORITIES_2026-05-02.md)
- Zentrale Exception-Filter/API-Fehlerform ist umgesetzt; weitere DTO-Abdeckung ausserhalb der kritischen Systemdaten-Endpunkte bleibt ein inkrementeller Ausbaupunkt.
- Produktives Logging ist fuer Invite-/Reset-Links gehaertet: Bei fehlendem SMTP wird im Strict-Security-Mode nicht mehr geloggt, sondern ein Fehler geworfen.
- Backup-/Restore-Automatisierung, Restore-Testprotokoll und TOM-/DSGVO-/ISO-Nachweise sind dokumentiert:
  - [BACKUP_RESTORE_RUNBOOK_2026-05-02.md](BACKUP_RESTORE_RUNBOOK_2026-05-02.md)
  - [TOM_DSGVO_ISO_EVIDENCE_2026-05-02.md](TOM_DSGVO_ISO_EVIDENCE_2026-05-02.md)
- Dependency-Findings wurden reduziert; verbleibende High-Findings erfordern Major-Upgrades und sind separat klassifiziert: [DEPENDENCY_FINDINGS_2026-05-02.md](DEPENDENCY_FINDINGS_2026-05-02.md)
- Optional: API-Versionierung (`/api/v1`) als eigener Migrationsschritt.
