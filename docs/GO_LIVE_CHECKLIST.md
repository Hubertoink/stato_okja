# Go-Live Checkliste – Stato 2.0

Diese Datei beschreibt, was für den Produktivbetrieb (Go-Live) noch zu tun ist und wie eine empfohlene Infrastruktur aussieht. Sie ist als Schritt-für-Schritt-Leitfaden gedacht.

## 1) Überblick

- Ziel-Setup: Ein Server (oder VM) mit Docker/Compose, ein Reverse-Proxy mit HTTPS, Postgres-Datenbank und die App (Frontend + Backend).  
- Frontend und Backend laufen hinter derselben Domain (Same-Origin). Das Frontend ruft das Backend unter `/api` auf.  
- Uploads werden aus dem Backend unter `/uploads/*` bedient und müssen persistent gespeichert werden.

## 2) Voraussetzungen auf dem Server

- Öffentliche Domain (z. B. `app.example.org`) mit A-Record auf die Server-IP.
- Offene Ports: 80 (HTTP) und 443 (HTTPS).
- Installiert: Docker und Docker Compose.
- Optional: Zugriff auf ein Container-Registry (falls Images vorab gebaut und gepusht werden sollen).

## 3) Empfohlene Architektur

- Reverse-Proxy (eine der Optionen):
  - Caddy (automatisches HTTPS, sehr einfach)
  - Traefik (automatisches HTTPS, dynamisches Routing)
  - Nginx (+ Certbot für Let’s Encrypt)
- Dienste:
  - `backend` (NestJS, Port 3000)
  - `frontend` (statische Dateien; via Nginx o. Ä. ausliefern)
  - `postgres` (Produktions-Datenbank, persistentes Volume)
  - Optional: `minio` (S3-kompatibel). Aktuell werden Uploads lokal abgelegt; MinIO ist nicht zwingend.

Routing (Reverse-Proxy):
- `/` → Frontend (statische Build-Dateien)
- `/api` → Backend:3000
- `/uploads` → Backend:3000

## 4) Environment-Variablen (Backend)

In `backend`-Container setzen:

- Server/Allgemein
  - `PORT=3000`
  - `API_PREFIX=api` (Backend läuft unter `/api`)
  - `CORS_ORIGINS=https://app.example.org` (Komma-separiert möglich; sollte Domain des Frontends enthalten)
  - `JWT_SECRET=ein_langes_geheimes_token`

- Datenbank (siehe auch `src/config/typeorm.config.ts`)
  - `DB_TYPE=postgres`
  - `DB_HOST=postgres`
  - `DB_PORT=5432`
  - `DB_USERNAME=stato_user`
  - `DB_PASSWORD=<sicheres_passwort>`
  - `DB_DATABASE=stato_prod`
  - `DB_SYNCHRONIZE=false` (in Produktion migrations-basiert arbeiten)
  - `DB_LOGGING=false`

- E-Mail (optional, für Einladungen/Passwort-Setzen)
  - `SMTP_HOST` / `SMTP_PORT` (587 oder 465)
  - `SMTP_USER` / `SMTP_PASS`
  - `SMTP_FROM` (z. B. `no-reply@example.org`)

Hinweis: Ist SMTP nicht konfiguriert, werden Einladungslinks lediglich im Backend-Log ausgegeben.

## 5) Environment-Variablen (Postgres)

Im `postgres`-Container setzen (Compose):

- `POSTGRES_DB=stato_prod`
- `POSTGRES_USER=stato_user`
- `POSTGRES_PASSWORD=<sicheres_passwort>`

Persistente Volumes für Postgres-Daten unbedingt konfigurieren (Compose: `volumes:`).

## 6) Persistente Daten

- Postgres-Daten (Volume): tägliche Backups via `pg_dump` einrichten.
- Backend-Uploads (Volume): `uploads/` Verzeichnis des Backend-Containers (z. B. Volume `backend-uploads:/app/uploads`).

## 7) Datenbank-Schema: Migrationen vs. Synchronize

- Produktion: `DB_SYNCHRONIZE=false` setzen und Migrationen nutzen.
- Erster Start: Entweder
  1) Migrationen laufen lassen (`npm run migration:run` im Backend-Container), oder
  2) Einmalig `DB_SYNCHRONIZE=true` zum Schemaaufbau setzen, danach wieder `false`.  
     Empfohlen ist (1), da reproduzierbar.

Superadmin: Beim Start sorgt die Auth-Initialisierung dafür, dass ein Superadmin existiert. Nach Go-Live das Standardpasswort umgehend ändern.

## 8) Reverse-Proxy & HTTPS

Variante A – Caddy (einfach):
- Caddy konfiguriert die Domain und leitet `/api` & `/uploads` zum Backend weiter, `/` bedient das Frontend (oder leitet an den Frontend-Container).
- Zertifikate werden automatisch per Let’s Encrypt verwaltet.

Variante B – Nginx + Certbot:
- Nginx als Reverse-Proxy, `/api` & `/uploads` → Backend:3000, `/` → Frontend.
- Certbot für Zertifikate, automatische Erneuerung (Cron/systemd timer) einrichten.

Variante C – Traefik:
- Label-basiertes Routing in Docker-Compose, automatische Zertifikate mit ACME/Let’s Encrypt.

Wichtig: Frontend und Backend über dieselbe Domain ausliefern, da das Frontend `/api` ohne Hostname nutzt (Same-Origin empfohlen).

## 9) Beispiel-Struktur (docker-compose.prod.yml – stark vereinfacht)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: stato_prod
      POSTGRES_USER: stato_user
      POSTGRES_PASSWORD: <secure>
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks: [stato]

  backend:
    build: ./backend
    environment:
      PORT: 3000
      API_PREFIX: api
      JWT_SECRET: <secure>
      CORS_ORIGINS: https://app.example.org
      DB_TYPE: postgres
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USERNAME: stato_user
      DB_PASSWORD: <secure>
      DB_DATABASE: stato_prod
      DB_SYNCHRONIZE: 'false'
    depends_on:
      - postgres
    volumes:
      - backend-uploads:/app/uploads
    networks: [stato]

  frontend:
    build: ./frontend
    # Entweder Frontend direkt ausliefern oder nur Build und dann Reverse-Proxy nutzt die statischen Dateien
    networks: [stato]

  # reverse-proxy (Caddy/Traefik/Nginx) hier ergänzen

volumes:
  postgres-data: {}
  backend-uploads: {}

networks:
  stato: {}
```

Hinweis: Für einen vollwertigen Setup kommt ein Reverse-Proxy-Service hinzu (Caddy/Nginx/Traefik) mit passenden Routen und Zertifikaten.

## 10) Rollout- und Update-Strategie

- Images bauen und ausrollen (entweder auf dem Server bauen oder CI/CD nutzen).
- Reihung bei Updates: Datenbank-Migrationen zuerst ausführen, dann Backend/Frontend neu starten.
- Kurze Downtime ist i. d. R. ausreichend; Zero-Downtime ist mit Load-Balancing/Blue-Green möglich.

## 11) Backups & Monitoring

- Postgres: Tägliche Dumps per `pg_dump`, Rotation und Offsite-Aufbewahrung.
- Uploads: Regelmäßige Datei-Backups (z. B. tar/rsync, S3-Upload o. Ä.).
- Logs: Reverse-Proxy- und Backend-Logs beobachten, optional zentral einsammeln.

## 12) Sicherheit & Betrieb

- Starke Passwörter/Secrets (DB, JWT, SMTP).
- Firewall nur auf benötigte Ports (80/443) öffnen.
- Admin-/Superadmin-Passwort nach Inbetriebnahme ändern.
- CORS passend konfigurieren (`CORS_ORIGINS`).
- Regelmäßige Updates der Basis-Images.

## 13) Optional: MinIO (S3)

Aktuell werden Uploads lokal gespeichert. Wer MinIO nutzen möchte:
- MinIO-Container (oder externen S3-Dienst) bereitstellen.
- Backend `email/uploads`-Logik so anpassen, dass statt lokaler Disk ein S3-Client genutzt wird.
- Bucket, Policy und Credentials konfigurieren.

## 14) Kurze Checkliste vor Go-Live

- [ ] Domain zeigt auf Server-IP.
- [ ] Reverse-Proxy mit Zertifikaten aktiv.
- [ ] Postgres läuft, Volume persistiert, Backups eingeplant.
- [ ] Backend-Container mit korrekten ENV-Variablen.
- [ ] Frontend gebaut und ausgeliefert.
- [ ] DB-Schema vorhanden (Migrationen gelaufen).
- [ ] Superadmin existiert; Passwort geändert.
- [ ] Uploads-Verzeichnis persistent.
- [ ] E-Mail (optional) getestet.
- [ ] Health-Check: Login, Aktivitäten-Liste, Erstellen/Bearbeiten, Uploads.

---

Fragen oder Anpassungswünsche? Diese Datei kann als lebendes Dokument gepflegt und um konkrete Server-/Proxy-Konfigurationen ergänzt werden.
