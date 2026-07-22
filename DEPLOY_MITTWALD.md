# Deployment auf Mittwald (Modus B)

Dieses Dokument beschreibt, wie du das Projekt auf Mittwald mit separater API-Domain betreibst:

## 1) Images aus GHCR verwenden

- CI baut und pusht Images nach GHCR:
  - Backend (Prod/main): `ghcr.io/<Owner>/stato-backend:latest`
  - Frontend (Prod/main): `ghcr.io/<Owner>/stato-frontend:latest`
  - Backup (Prod/main): `ghcr.io/<Owner>/stato-backup:latest`
  - Backend (Dev/dev): `ghcr.io/<Owner>/stato-backend:dev`
  - Frontend (Dev/dev): `ghcr.io/<Owner>/stato-frontend:dev`
  - Backup (Dev/dev): `ghcr.io/<Owner>/stato-backup:dev`
– Optional Tags (z. B. `v2.0.0`) verwenden für reproduzierbare Deploys.
- Entweder Packages auf `Public` stellen oder Mittwald mit GHCR-Login (PAT mit `read:packages`) konfigurieren.

## 2) Domains

- Frontend: `app.stato-okja.de` → Frontend-Container
- Backend: `api.stato-okja.de` → Backend-Container
- SSL (Let's Encrypt) für beide aktivieren.

### Dev-Umgebung

- Frontend: `devapp.stato-okja.de` → Frontend-Container (Image-Tag `:dev`)
- Backend: `devapi.stato-okja.de` → Backend-Container (Image-Tag `:dev`)

Wichtig: Wenn deine Dev-Umgebung „komisch alte Features“ zeigt, läuft sehr oft noch `:latest` (main) statt `:dev`.

## 3) Backend-Container

- Image (Prod): `ghcr.io/<Owner>/stato-backend:latest`
- Image (Dev): `ghcr.io/<Owner>/stato-backend:dev`
- Port: 3000
- Volume: `/app/uploads` (persistent)
- ENV:
  - `NODE_ENV=production`
  - `PORT=3000`
  - `API_PREFIX=api`
  - `APP_ORIGIN=https://app.stato-okja.de`
  - `TRUST_PROXY=true`
  - `JWT_SECRET=<zufaelliger_wert_mit_mindestens_32_zeichen>`
  - `AUTH_2FA_ENABLED=false`
  - `AUTH_2FA_CODE_TTL=600`
  - `CORS_ORIGINS=https://app.stato-okja.de`
  - `RATE_LIMIT_TTL=60`
  - `RATE_LIMIT_MAX=100`
  - `AUTH_RATE_LIMIT_TTL=60`
  - `AUTH_RATE_LIMIT_MAX=10`
  - `LOGIN_MAX_FAILED_ATTEMPTS=5`
  - `LOGIN_LOCKOUT_MINUTES=10`
  - `DB_TYPE=postgres`
  - `DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE`
  - Optional: `DB_SYNCHRONIZE=false`, `DB_LOGGING=false`
  - Fuer externe DB mit TLS: `DB_SSL=true`, `DB_SSL_REJECT_UNAUTHORIZED=true`
  - Fuer bewusst vertraute Nicht-SSL-DB: `DB_REQUIRE_SSL=false`, `DB_SSL=false`

Wichtig:
- Der Backend-Container startet in Produktion nur, wenn `JWT_SECRET` gesetzt ist, kein Platzhalter ist und mindestens 32 Zeichen hat.
- `APP_ORIGIN` muss exakt auf die öffentliche Frontend-URL zeigen. Die 2FA-E-Mail verwendet diese URL für einen Direktlink, der den Code im gleichen Browser automatisch in die Login-Maske eintragen kann.
- Ein sicherer Beispielwert kann lokal erzeugt werden mit `openssl rand -base64 48`.
- Wenn Mittwald fuer den Backend-Service keine Umgebungsvariable gesetzt hat, endet der Container genau mit dem Fehler aus deinem Log.
- `TZ=Europe/Berlin` im Backend-Container behebt keine verschobenen Audit-Log-Zeiten zuverlaessig. Entscheidend ist die Postgres-Session-Zeitzone bzw. der Spaltentyp (`timestamp without time zone` vs. `timestamptz`).
- Das Backend erzwingt deshalb fuer Postgres jetzt UTC auf der DB-Session. Neue Audit-Logs werden damit konsistent gespeichert, auch wenn Mittwald oder die DB selbst lokal auf Europe/Berlin laufen.

## 4) Frontend-Container

- Image (Prod): `ghcr.io/<Owner>/stato-frontend:latest`
- Image (Dev): `ghcr.io/<Owner>/stato-frontend:dev`
- Port: 80
- ENV zur Build-Zeit: `VITE_API_BASE_URL=https://api.stato-okja.de/api`
  - Die CI übergibt den Wert automatisch via Workflow-Variable `FRONTEND_API_BASE_URL`.
  - Stelle im Repo unter `Settings → Secrets and variables → Actions → Variables` den Wert ein.

Für Dev setzt die CI automatisch `VITE_API_BASE_URL=https://devapi.stato-okja.de/api`.

## 5) Managed Dienste

- Postgres: Mittwald Managed PostgreSQL empfohlen
- S3/Storage: Externen S3-Dienst bevorzugen; alternativ vorerst `/app/uploads` Volume nutzen.

## 5.1) Backup-Container bei Compose-Postgres

Wenn Postgres als Container im selben Stack laeuft, kann der Service `backup` fuer Mittwald-Cronjobs genutzt werden:

- Image (Prod): `ghcr.io/<Owner>/stato-backup:latest`
- Image (Dev): `ghcr.io/<Owner>/stato-backup:dev`
- Kein oeffentlicher Port
- Volumes:
  - `backend-uploads:/mnt/uploads:ro`
  - `backup-data:/backups`
- ENV:
  - `PGHOST=postgres`
  - `PGPORT=5432`
  - `PGUSER`, `PGPASSWORD`, `PGDATABASE` passend zur Compose-Postgres-DB
  - `BACKUP_RETENTION_DAYS=14`
- Mittwald-Cronjob:
  - Typ `Container`
  - Container `backup`
  - Befehl `/usr/local/bin/stato-container-backup`
  - Intervall z. B. `0 3 * * *`
- Das Volume `backup-data` zusaetzlich ueber Mittwald-Projektbackups/Volume-Backups oder einen separaten Export absichern.

## 6) Health Checks

- API Beispiel: `https://api.stato-okja.de/api/stats/summary`
- Frontend lädt `https://app.stato-okja.de` und spricht mit `https://api.stato-okja.de/api`.

## 7) Typischer Fehler beim Deploy

Fehlerbild:
- `JWT_SECRET muss mindestens 32 Zeichen lang sein und darf kein Platzhalter sein.`

Ursache:
- In Mittwald fehlt `JWT_SECRET` komplett oder der Wert ist zu kurz.

Behebung:
1. Im Mittwald-Docker-Deploy den Backend-Service oeffnen.
2. Unter Umgebungsvariablen `JWT_SECRET` setzen.
3. Einen neu generierten Zufallswert mit mindestens 32 Zeichen eintragen, z. B. Ausgabe von `openssl rand -base64 48`.
4. Deployment erneut starten.

Weiteres moegliches Fehlerbild:
- `DB_SSL muss fuer externe Postgres-Verbindungen in dieser Umgebung aktiviert sein.`
- `The server does not support SSL connections`

Einordnung:
- Wenn deine Datenbank TLS anbietet, setze `DB_SSL=true` und `DB_SSL_REJECT_UNAUTHORIZED=true`.
- Wenn deine Datenbank bewusst ohne TLS nur im vertrauenswuerdigen internen Netz erreichbar ist, setze explizit `DB_REQUIRE_SSL=false` und `DB_SSL=false`.
