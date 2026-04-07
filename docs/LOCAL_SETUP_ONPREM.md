# StatO 2.0 – Local/On‑Prem Setup (Docker)

Dieses Dokument beschreibt ein **On‑Prem / Local** Setup, bei dem StatO vollständig auf einem eigenen PC/Server läuft (ohne die von uns bereitgestellten Online‑Backends wie `api.stato-okja.de` / `devapi.stato-okja.de`).

Ziel: Ein Kommune/Träger kann StatO in einem eigenen Netzwerk betreiben (VM, Bare Metal, NAS, Kubernetes/Compose), inkl. Datenbank und optional Mail‑Server.

---

## Architektur (Container)

**Minimal nötig**
- **PostgreSQL** (Datenbank)
- **Backend** (NestJS API)
- **Frontend** (React/Vite Build, ausgeliefert über Nginx)

**Optional (empfohlen je nach Betrieb)**
- **Reverse Proxy + TLS** (z. B. Caddy/Traefik/Nginx) vor dem Frontend
- **SMTP** (für Einladungen/Passwort‑Reset)
  - lokal zum Testen: Mailpit
  - produktiv: euer SMTP/Exchange/Relay
- **Object Storage (MinIO)** ist im Repo vorbereitet, wird aber im aktuellen `docker-compose.prod.yml` nicht benötigt. Wenn ihr Datei‑Anhänge später über S3/MinIO abbildet, könnt ihr MinIO ergänzen.

---

## Ports (Standard)

- Frontend: `80` (HTTP) → später i. d. R. per Reverse Proxy auf `443` (HTTPS)
- Backend: `3000` (intern im Docker‑Netz; optional extern für Debug)
- Postgres: `5432` (nur intern empfohlen)

---

## Wichtige Umgebungsvariablen (Backend)

Siehe auch: `backend/BACKEND_CONTAINER_ENV.md` und `backend/.env.example`.

**Minimal für On‑Prem**
- `NODE_ENV=production`
- `PORT=3000`
- `API_PREFIX=api`
- `APP_ORIGIN=https://<eure-domain>` (wichtig für Links in Mails)
- `CORS_ORIGINS=https://<eure-domain>` (oder mehrere Origins kommasepariert)
- `DB_TYPE=postgres`
- `DB_HOST=postgres` (Compose‑Service‑Name)
- `DB_PORT=5432`
- `DB_USERNAME=...`
- `DB_PASSWORD=...`
- `DB_DATABASE=...`
- `JWT_SECRET=<langer-random-string>`
- `SUPERADMIN_EMAIL=admin@<kommune>.de`
- `SUPERADMIN_PASSWORD=<starkes-passwort>` (empfohlen; initiales Start-Passwort)
  - Standard: `SUPERADMIN_PASSWORD_FORCE=false`, dann bleibt ein später geändertes Passwort bei Neustarts erhalten.
  - Nur für Ops-Fälle: `SUPERADMIN_PASSWORD_FORCE=true` setzt das Superadmin-Passwort beim Backend-Start neu auf den Wert aus `SUPERADMIN_PASSWORD`.

**SMTP (optional, produktiv empfohlen)**
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

**Branding / Instanzname (optional, On‑Prem)**
- `PUBLIC_APP_NAME=StatO`
- `PUBLIC_ORG_NAME=Stadt Mannheim` (führt zu Login-Titel `StatO - Stadt Mannheim`)
- `PUBLIC_LOGIN_SUBTITLE=OKJA Statistik & Dokumentation`

---

## Frontend: API‑Anbindung (wichtig für On‑Prem)

Damit das Frontend **nicht** gegen öffentliche APIs läuft, gibt es zwei saubere Betriebsarten:

### Option A (empfohlen): Nginx „proxy mode“
Das Frontend wird auf derselben Domain ausgeliefert und Nginx proxyt `/api/*` und `/uploads/*` an den Backend‑Container.
- Vorteil: Kein CORS‑Stress, „same origin“.
- Im Repo vorhanden: `frontend/nginx.proxy.conf`
- Im `frontend/Dockerfile` auswählbar via `NGINX_MODE=proxy`

### Option B: API Base URL per Build‑Arg
Frontend wird mit `VITE_API_BASE_URL` gebaut (z. B. `https://backend.intern/api`).
- Vorteil: getrennte Domains möglich.
- Nachteil: CORS muss sauber eingestellt sein.

---

## Kurzanleitung: On‑Prem mit `NGINX_MODE=proxy`

Ziel: **Eine Domain**, Frontend und API laufen „same origin“. Das Frontend spricht intern über Nginx‑Proxy mit dem Backend via `/api/*`.

1) **DNS / URL festlegen**
- Entscheide die URL, z. B. `https://stato.kommune.local` (oder `http://<server-ip>` für Test ohne TLS).

2) **ENV Datei anlegen**

```bash
# Windows
copy .env.onprem.example .env.onprem

# macOS/Linux
cp .env.onprem.example .env.onprem
```

3) **`.env.onprem` ausfüllen** (Pflicht)
- `APP_ORIGIN=https://stato.kommune.local`
- `CORS_ORIGINS=https://stato.kommune.local`
- `JWT_SECRET=<sehr lang & random>`
- `SUPERADMIN_EMAIL=...` / `SUPERADMIN_PASSWORD=...`
- `POSTGRES_*` (DB Name/User/Passwort)
- `DB_SYNCHRONIZE=true` für den ersten Start mit leerer Datenbank

4) **Sicherstellen, dass Proxy‑Mode aktiv ist**
- In `docker-compose.onprem.yml` ist `frontend.build.args.NGINX_MODE=proxy` bereits gesetzt.
- `VITE_API_BASE_URL` muss dafür **nicht** gesetzt werden.

5) **Container bauen & starten**

```bash
docker compose -f docker-compose.onprem.yml --env-file .env.onprem up -d --build
```

6) **Migrationen ausführen (einmalig nach Erststart / nach Updates)**

Variante A (empfohlen, wenn Node auf dem Server verfügbar ist):

```bash
cd backend
npm ci
npm run migration:run
```

Variante B (ohne Node-Installation, via One‑Shot Container):

```bash
docker run --rm -it \
  --network stato-onprem \
  -v "$PWD/backend:/app" \
  -w /app \
  node:20-alpine sh -lc "npm ci && npm run migration:run"
```

7) **Funktionstest / Checkpoints**
- Frontend: `http(s)://<eure-domain>` lädt.
- API über Proxy: `http(s)://<eure-domain>/api/health` (oder ein anderer API‑Endpoint) antwortet.
- Login mit `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` funktioniert.

8) **TLS (Produktiv)**
- Empfohlen: Reverse Proxy (Caddy/Traefik/Nginx) vor den `frontend`‑Container schalten und nur `443` nach außen öffnen.
- Danach `APP_ORIGIN` und `CORS_ORIGINS` auf die finale `https://` URL setzen.

---

## On‑Prem Docker Compose (Beispiel)

Im Repo ist ein simples Compose‑Setup enthalten:
- `docker-compose.onprem.yml`
- `.env.onprem.example`

Empfohlenes Vorgehen:

```bash
# Windows
copy .env.onprem.example .env.onprem

# macOS/Linux
cp .env.onprem.example .env.onprem
```

Dann mindestens `APP_ORIGIN`, `CORS_ORIGINS`, `JWT_SECRET`, `SUPERADMIN_*` und die DB‑Credentials in `.env.onprem` setzen.

Zusätzlich unterstützt das On-Prem-Compose inzwischen auch optionale Variablen wie `TZ`, `APP_ENV`, `NODE_ENV`, `DB_LOGGING`, `DB_REQUIRE_SSL`, `DB_SSL`, `DB_SSL_REJECT_UNAUTHORIZED`, `VITE_ENABLE_DEV_TOOLS` und `ENABLE_ORG_MOVE`.

Für `ENABLE_ORG_MOVE` gilt bewusst:

- Standard `false`
- erst bei `true` wird Organisationsverschiebung im Backend und im Frontend freigeschaltet
- nach Änderung des Werts den Frontend-Container neu bauen

Die vollständige Beschreibung steht in [docs/DOCKER_ONPREM_SETUP.md](../docs/DOCKER_ONPREM_SETUP.md).

---

## Start/Stop

```bash
# Start (Build + run)
docker compose -f docker-compose.onprem.yml --env-file .env.onprem up -d --build

# Logs
docker compose -f docker-compose.onprem.yml --env-file .env.onprem logs -f --tail=200

# Stop
docker compose -f docker-compose.onprem.yml --env-file .env.onprem down
```

---

## Datenbank-Migrationen (wichtig!)

Für die automatische Laufzeit-Migration ist die relevante Variable:

- `DB_MIGRATIONS_RUN=true`

Zusätzlich muss gelten:

- `DB_SYNCHRONIZE=false`

Wenn `DB_SYNCHRONIZE=true` gesetzt ist, werden Migrationen absichtlich übersprungen. Das ist nur für frische Bootstrap-Setups sinnvoll.

Aktuell werden Migrationen in der Entwicklung per TypeORM + TS ausgeführt (siehe `backend/package.json` Scripts). Der Production‑Backend‑Container installiert **nur Produktions‑Dependencies** – je nach Setup kann das bedeuten, dass `npm run migration:run` **im Container nicht** verfügbar ist.

Empfehlung für On‑Prem:

### Variante 1: Migrationen auf dem Server (Node.js installiert)
1. Repo auf den Server kopieren/klonen
2. `cd backend && npm ci`
3. `npm run migration:run`
4. Danach `docker compose up -d`

### Variante 2: „Migrations“-One‑Shot Container
Ihr könnt einen One‑Shot Container mit Node nutzen, der den `backend/` Ordner mountet und die Migrationen ausführt:

```bash
docker run --rm -it \
  --network stato-onprem \
  -v "$PWD/backend:/app" \
  -w /app \
  node:20-alpine sh -lc "npm ci && npm run migration:run"
```

Hinweis: Dafür muss das Compose‑Netzwerk (`stato-onprem`) existieren und Postgres bereits laufen.

---

## Backups (On‑Prem Betrieb)

- **Postgres**: Backup via `pg_dump` (regelmäßig) oder Volume‑Backup.
- **Uploads**: `stato-onprem-backend-uploads` Volume sichern (enthält u.a. Bilder unter `/uploads/images`).

Beispiel `pg_dump` (wenn Postgres nicht nach außen exposed ist):

```bash
docker exec -t <postgres-container> pg_dump -U <user> <db> > stato_backup.sql
```

---

## Produktions-Hinweise / Hardening

- Setze zwingend ein starkes `JWT_SECRET` (stabil, nicht wechselnd).
- Setze `SUPERADMIN_PASSWORD` und ändere es nach Übergabe.
- Exponiere Postgres nicht nach außen (nur internes Docker‑Netz).
- Nutze TLS (Reverse Proxy) und sichere Admin‑Zugänge.
- Logging/Monitoring: je nach Kommune z. B. Promtail/Loki, ELK, oder Docker‑Logdriver.

---

## Troubleshooting

- **Frontend lädt, aber API 404/405**: Stelle sicher, dass `NGINX_MODE=proxy` gebaut wurde oder `VITE_API_BASE_URL` korrekt ist.
- **CORS Fehler** (Option B): `CORS_ORIGINS` muss exakt die Frontend‑Origin enthalten.
- **Login geht nicht nach Neustart**: `JWT_SECRET` darf nicht wechseln.
- **Uploads fehlen nach Neustart**: Volume `stato-onprem-backend-uploads` muss persistent sein.
