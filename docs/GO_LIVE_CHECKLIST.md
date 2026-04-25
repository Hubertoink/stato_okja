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
  - `APP_ORIGIN=https://app.example.org` (Öffentliche URL des Frontends; wird in E-Mail-Links genutzt)
  - `CORS_ORIGINS=https://app.example.org` (Komma-separiert möglich; sollte Domain des Frontends enthalten)
  - `JWT_SECRET=ein_langes_geheimes_token`
  - `SUPERADMIN_EMAIL=admin@example.org` (optional; Seed/Erzwingung der Superadmin-E-Mail)

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
- Erster Start und Updates: `DB_MIGRATIONS_RUN=true` setzen, damit der Backend-Container Migrationen beim Start automatisch ausführt.
- `DB_SYNCHRONIZE=true` ist nicht der empfohlene Produktionspfad, weil Migrationen dann absichtlich übersprungen werden.

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
- [ ] E-Mail (SMTP/Absender) eingerichtet und getestet (inkl. Passwort-Reset).
- [ ] Health-Check: Login, Aktivitäten-Liste, Erstellen/Bearbeiten, Uploads.

## 15) E-Mail & Passwort-Reset für den Live-Betrieb

Dieser Abschnitt beschreibt, wie das Versenden von E-Mails (Einladungen, Passwort-Reset) produktiv aktiviert wird.

### 15.1 SMTP-Provider auswählen

- Mögliche Dienste: Brevo (Sendinblue), Mailgun, Postmark, AWS SES, Microsoft 365/Exchange.
- Benötigte Daten: Host, Port (587 empfohlen, 465 möglich), Benutzername, Passwort/API-Key, Absender-Adresse (From).

### 15.2 Environment-Variablen setzen (Backend)

In `docker-compose.prod.yml` unter `services.backend.environment`:

- `SMTP_HOST`: z. B. `smtp-relay.brevo.com`
- `SMTP_PORT`: `587` (STARTTLS) oder `465` (SSL)
- `SMTP_USER`: z. B. `smtp-user@deinedomain.de` oder provider-spezifisch
- `SMTP_PASS`: SMTP-Passwort oder API-Key
- `SMTP_FROM`: z. B. `no-reply@deinedomain.de`
- `APP_ORIGIN`: z. B. `https://stato.deinedomain.de`
- `CORS_ORIGINS`: z. B. `https://stato.deinedomain.de`
- `JWT_SECRET`: langer, geheimer Wert
- `SUPERADMIN_EMAIL`: E-Mail für den Superadmin (optional; initiales Seed-Konto)
  - Optional erzwingen: `SUPERADMIN_EMAIL_FORCE=true`

Hinweis: Bei Port `465` wird SSL verwendet, bei `587` STARTTLS. Der Code wählt das automatisch basierend auf dem Port.

### 15.3 DNS & Zustellbarkeit

- SPF: TXT-Record, der den SMTP-Dienst autorisiert (Anleitung des Providers folgen)
- DKIM: Provider stellt Schlüssel/CNAMEs bereit – unbedingt setzen
- DMARC: Optional, aber empfohlen (z. B. `v=DMARC1; p=quarantine; rua=mailto:dmarc@deinedomain.de`)

Ohne korrekte SPF/DKIM-Einträge landen E-Mails oft im Spam.

### 15.4 Testen

1) Deployment mit gesetzten ENV-Variablen neu starten
2) In der App:
  - Auf der Login-Seite „Passwort vergessen?“ → E-Mail eingeben → es sollte eine Mail mit Link `APP_ORIGIN/reset-password?token=...` ankommen.
  - Als Superadmin (Benutzer verwalten) kann über das Schlüssel-Icon ein Reset-Link an einen Nutzer gesendet werden.
3) Provider-Panel prüfen (Zustellungen, Bounces). Falls kein SMTP gesetzt ist, schreibt das Backend den Link ins Log („SMTP not configured…“).

### 15.5 Troubleshooting

- TLS-Fehler: Bei Port/SSL-Mismatch auf korrekten Port wechseln (587/STARTTLS oder 465/SSL).
- Ausgehende Verbindungen blockiert: Firewall/Provider erlaubt Outbound auf 587/465?
- Falsche Links in E-Mails: `APP_ORIGIN` korrekt (inkl. `https://` und Domain)?
- CORS-Probleme: `CORS_ORIGINS` enthält die Frontend-Domain.

### 15.6 Sicherheit

- `JWT_SECRET` stark/zufällig setzen.
- Token-Gültigkeit: Einladungen (`INVITE_TOKEN_EXPIRATION`, Default `7d`), Passwort-Reset (`RESET_TOKEN_EXPIRATION`, Default `1h`).
- Superadmin-Passwort nach dem ersten Login ändern.

---

Fragen oder Anpassungswünsche? Diese Datei kann als lebendes Dokument gepflegt und um konkrete Server-/Proxy-Konfigurationen ergänzt werden.
