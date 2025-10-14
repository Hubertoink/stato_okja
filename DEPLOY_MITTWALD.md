# Deployment auf Mittwald (Modus B)

Dieses Dokument beschreibt, wie du das Projekt auf Mittwald mit separater API-Domain betreibst:

## 1) Images aus GHCR verwenden

- CI baut und pusht Images nach GHCR:
  - Backend: `ghcr.io/<Owner>/stato-backend:latest`
  - Frontend: `ghcr.io/<Owner>/stato-frontend:latest`
– Optional Tags (z. B. `v2.0.0`) verwenden für reproduzierbare Deploys.
- Entweder Packages auf `Public` stellen oder Mittwald mit GHCR-Login (PAT mit `read:packages`) konfigurieren.

## 2) Domains

- Frontend: `app.stato-okja.de` → Frontend-Container
- Backend: `api.stato-okja.de` → Backend-Container
- SSL (Let's Encrypt) für beide aktivieren.

## 3) Backend-Container

- Image: `ghcr.io/<Owner>/stato-backend:latest`
- Port: 3000
- Volume: `/app/uploads` (persistent)
- ENV:
  - `NODE_ENV=production`
  - `PORT=3000`
  - `API_PREFIX=api`
  - `APP_ORIGIN=https://app.stato-okja.de`
  - `JWT_SECRET=<sicherer_wert>`
  - `CORS_ORIGINS=https://app.stato-okja.de`
  - `DB_TYPE=postgres`
  - `DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE`
  - Optional: `DB_SYNCHRONIZE=false`, `DB_LOGGING=false`

## 4) Frontend-Container

- Image: `ghcr.io/<Owner>/stato-frontend:latest`
- Port: 80
- ENV zur Build-Zeit: `VITE_API_BASE_URL=https://api.stato-okja.de/api`
  - Die CI übergibt den Wert automatisch via Workflow-Variable `FRONTEND_API_BASE_URL`.
  - Stelle im Repo unter `Settings → Secrets and variables → Actions → Variables` den Wert ein.

## 5) Managed Dienste

- Postgres: Mittwald Managed PostgreSQL empfohlen
- S3/Storage: Externen S3-Dienst bevorzugen; alternativ vorerst `/app/uploads` Volume nutzen.

## 6) Health Checks

- API Beispiel: `https://api.stato-okja.de/api/stats/summary`
- Frontend lädt `https://app.stato-okja.de` und spricht mit `https://api.stato-okja.de/api`.
