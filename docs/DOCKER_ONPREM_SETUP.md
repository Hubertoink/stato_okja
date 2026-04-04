# StatO On-Prem Docker Setup

Diese Anleitung beschreibt ein vollständiges Docker-Setup für einen eigenen Server oder On-Prem-Rechner mit drei Containern:

- PostgreSQL
- Backend
- Frontend

Ziel ist ein Betrieb ohne Mittwald, ohne externe StatO-API und ohne lokale Node-Entwicklungsumgebung für den eigentlichen App-Betrieb.

Die Anleitung orientiert sich an den vorhandenen Repo-Dateien:

- [docker-compose.onprem.yml](../docker-compose.onprem.yml)
- [.env.onprem.example](../.env.onprem.example)
- [frontend/Dockerfile](../frontend/Dockerfile)
- [backend/BACKEND_CONTAINER_ENV.md](../backend/BACKEND_CONTAINER_ENV.md)

## Zielbild

Empfohlen ist folgende Topologie:

- `frontend` liefert die React-App per Nginx aus
- `frontend` proxyt `/api/*` intern an `backend`
- `backend` spricht intern mit `postgres`
- nur der `frontend`-Container ist von außen erreichbar

Vorteile:

- kein separates CORS-Konstrukt nötig
- nur ein öffentlicher Einstiegspunkt
- einfache URL-Struktur unter einer Domain

## Voraussetzungen

Auf dem Server sollten vorhanden sein:

- Docker
- Docker Compose Plugin, also `docker compose`
- Git oder eine andere Möglichkeit, das Repo auf den Server zu bringen
- genügend freier Speicher für DB, Uploads und Images

Empfohlen für Produktion:

- Linux-Server oder VM
- feste Domain oder interne DNS-Auflösung
- Reverse Proxy oder Firewall-Regeln für HTTPS

## Verwendete Dateien

Für den On-Prem-Betrieb werden primär diese Dateien genutzt:

- [docker-compose.onprem.yml](../docker-compose.onprem.yml): startet Postgres, Backend und Frontend
- [.env.onprem.example](../.env.onprem.example): Beispiel für produktionsnahe Variablen
- [frontend/nginx.proxy.conf](../frontend/nginx.proxy.conf): Frontend im Proxy-Modus

Wichtig: Im On-Prem-Compose ist der Frontend-Build bereits auf `NGINX_MODE=proxy` gesetzt. Das Frontend spricht also standardmäßig nicht gegen eine öffentliche API, sondern gegen den internen Backend-Service.

## Schritt 1: Repo auf den Zielserver bringen

Beispiel:

```bash
git clone <euer-repo-url>
cd stato_okja
```

Wenn das Repo nicht per Git kommt, reicht auch ein vollständiges Verzeichnis auf dem Server, solange alle Compose-, Backend- und Frontend-Dateien enthalten sind.

## Schritt 2: ENV-Datei anlegen

Aus der Vorlage eine produktive On-Prem-Datei erzeugen:

```bash
cp .env.onprem.example .env.onprem
```

Unter Windows PowerShell alternativ:

```powershell
Copy-Item .env.onprem.example .env.onprem
```

## Schritt 3: Variablen in `.env.onprem` setzen

Mindestens diese Variablen müssen sauber gesetzt sein:

### Datenbank

- `POSTGRES_DB`: Name der Datenbank
- `POSTGRES_USER`: Datenbankbenutzer
- `POSTGRES_PASSWORD`: starkes DB-Passwort

### Anwendung / URLs

- `APP_ORIGIN`: öffentliche URL des Frontends, z. B. `https://stato.meine-kommune.de`
- `CORS_ORIGINS`: erlaubte Frontend-Origin, meist identisch zu `APP_ORIGIN`
- `API_PREFIX`: optional, Default ist `api`

### Sicherheit / Auth

- `JWT_SECRET`: lang, zufällig, stabil, nicht bei jedem Deploy ändern
- `JWT_ACCESS_EXPIRATION`: optional, Standard z. B. `12h`

### Initialer Superadmin

- `SUPERADMIN_EMAIL`: Login des ersten Superadmins
- `SUPERADMIN_PASSWORD`: starkes Passwort

### Optional: Branding

- `PUBLIC_APP_NAME`
- `PUBLIC_ORG_NAME`
- `PUBLIC_LOGIN_SUBTITLE`

### Optional: SMTP

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

### Optional: Dev Tools

- `VITE_ENABLE_DEV_TOOLS=false`

Für einen echten On-Prem-Produktivbetrieb sollte das normalerweise `false` bleiben.

## Vollständiges Beispiel für `.env.onprem`

```env
POSTGRES_DB=stato_prod
POSTGRES_USER=stato_user
POSTGRES_PASSWORD=CHANGE_ME_STRONG

APP_ORIGIN=https://stato.kommune.local
CORS_ORIGINS=https://stato.kommune.local
API_PREFIX=api

JWT_SECRET=CHANGE_ME_SUPER_LONG_RANDOM_STRING
JWT_ACCESS_EXPIRATION=12h
DB_MIGRATIONS_RUN=true
PASSWORD_RESET_MODE=admin_temp_password

SUPERADMIN_EMAIL=admin@kommune.local
SUPERADMIN_PASSWORD=CHANGE_ME_STRONG

PUBLIC_APP_NAME=StatO
PUBLIC_ORG_NAME=Stadt Musterstadt
PUBLIC_LOGIN_SUBTITLE=OKJA Statistik und Dokumentation

# Optional SMTP
# SMTP_HOST=mail.kommune.local
# SMTP_PORT=587
# SMTP_USER=mailer
# SMTP_PASS=CHANGE_ME
# SMTP_FROM=no-reply@kommune.local

VITE_ENABLE_DEV_TOOLS=false
```

## Schritt 4: Container starten

Der On-Prem-Stack wird mit der vorhandenen Compose-Datei gestartet:

```bash
docker compose -f docker-compose.onprem.yml --env-file .env.onprem up -d --build
```

Dadurch werden gebaut bzw. gestartet:

- `postgres`
- `backend`
- `frontend`

## Schritt 5: Start prüfen

Status prüfen:

```bash
docker compose -f docker-compose.onprem.yml --env-file .env.onprem ps
```

Logs prüfen:

```bash
docker compose -f docker-compose.onprem.yml --env-file .env.onprem logs -f --tail=200
```

Wenn alles korrekt läuft:

- Frontend ist auf Port `80` erreichbar
- Backend ist intern im Docker-Netz erreichbar
- Postgres ist intern im Docker-Netz erreichbar

Beispiel:

- `http://<server-ip>` oder
- `https://<eure-domain>` wenn davor ein TLS-Proxy oder Load Balancer läuft

## Schritt 6: Datenbank-Migrationen ausführen

Für einen funktionierenden Produktionsstart müssen die Migrationen gegen die neue Datenbank gelaufen sein.

Wichtig: Wenn der Backend-Container mit `NODE_ENV=development` läuft, werden Migrationen im aktuellen Backend standardmäßig **nicht** automatisch ausgeführt. Setze in diesem Fall `DB_MIGRATIONS_RUN=true`, sonst fehlen neue Spalten trotz korrekt gebautem Container.

Es gibt dafür zwei praktikable Wege.

### Variante A: direkt auf dem Server mit Node.js

Wenn auf dem Server Node.js verfügbar ist:

```bash
cd backend
npm ci
npm run migration:run
```

Danach zurück ins Repo-Root und den Stack starten oder neu starten.

### Variante B: One-shot Node-Container

Wenn auf dem Server kein Node lokal installiert werden soll:

```bash
docker run --rm -it \
  --network stato \
  -v "$PWD/backend:/app" \
  -w /app \
  node:20-alpine sh -lc "npm ci && npm run migration:run"
```

Hinweise:

- Das Netzwerk `stato` wird von [docker-compose.onprem.yml](../docker-compose.onprem.yml) angelegt.
- Postgres muss dafür bereits laufen.

## Schritt 7: Login testen

Nach erfolgreichem Start:

1. Frontend im Browser öffnen
2. Mit `SUPERADMIN_EMAIL` und `SUPERADMIN_PASSWORD` anmelden
3. Prüfen, ob Projekte, Benutzerverwaltung und Statistik erreichbar sind

## Container-Architektur im On-Prem-Compose

### PostgreSQL

Im Compose wird Postgres als Service `postgres` gestartet.

Wichtige Punkte:

- Daten liegen persistent im Volume `postgres-data`
- Hostname innerhalb des Docker-Netzes ist `postgres`
- das Backend nutzt genau diesen Service-Namen als `DB_HOST`

### Backend

Der Backend-Container nutzt unter anderem diese Werte:

- `NODE_ENV=production`
- `PORT=3000`
- `DB_HOST=postgres`
- `DB_PORT=5432`
- `DB_USERNAME=${POSTGRES_USER}`
- `DB_PASSWORD=${POSTGRES_PASSWORD}`
- `DB_DATABASE=${POSTGRES_DB}`
- `APP_ORIGIN=${APP_ORIGIN}`
- `CORS_ORIGINS=${CORS_ORIGINS}`
- `JWT_SECRET=${JWT_SECRET}`
- `SUPERADMIN_EMAIL=${SUPERADMIN_EMAIL}`
- `SUPERADMIN_PASSWORD=${SUPERADMIN_PASSWORD}`

Uploads werden persistent gespeichert im Volume:

- `backend-uploads`

### Frontend

Der Frontend-Container wird aus [frontend/Dockerfile](../frontend/Dockerfile) gebaut.

Wichtig für On-Prem:

- `NGINX_MODE=proxy` ist im On-Prem-Compose gesetzt
- dadurch proxyt Nginx `/api/*` intern an das Backend
- `VITE_API_BASE_URL` muss in diesem Modus nicht gesetzt werden

Das ist die empfohlene Betriebsart für einen einzelnen On-Prem-Host.

## Ports und Netzwerk

Standardmäßig im On-Prem-Compose:

- Frontend: `80:80`
- Backend: nicht nach außen exposed
- Postgres: nicht nach außen exposed

Das ist bewusst sinnvoll, weil nur das Frontend öffentlich erreichbar sein sollte.

Wenn der Server direkt im internen Netz läuft, kann man vorerst auch nur Port `80` nutzen. Für produktive Nutzung wird jedoch HTTPS empfohlen.

## HTTPS / Reverse Proxy

Für produktiven Betrieb empfohlen:

- Reverse Proxy vor dem Frontend, z. B. Nginx, Traefik oder Caddy
- TLS-Zertifikate am Reverse Proxy terminieren
- nur `443` nach außen öffnen

Dann sollten diese Variablen exakt zur finalen URL passen:

- `APP_ORIGIN=https://stato.eure-domain.de`
- `CORS_ORIGINS=https://stato.eure-domain.de`

## SMTP einrichten

Wenn Einladungs- oder Passwort-Reset-Mails funktionieren sollen, SMTP konfigurieren:

```env
SMTP_HOST=mail.example.org
SMTP_PORT=587
SMTP_USER=mailer@example.org
SMTP_PASS=CHANGE_ME
SMTP_FROM=no-reply@example.org
```

Wenn `SMTP_HOST` nicht gesetzt ist, werden Mail-Links typischerweise nur geloggt und nicht versendet.

## Dev Tools auf On-Prem

Die Dev-Tools bestehen aus zwei Ebenen:

- Backend-Freigabe über `NODE_ENV` und `APP_ENV`
- Frontend-Menü über `VITE_ENABLE_DEV_TOOLS`

Für einen normalen On-Prem-Produktivbetrieb gilt:

- `NODE_ENV=production`
- `VITE_ENABLE_DEV_TOOLS=false`

Wenn die Dev-Tools bewusst in einer Testinstanz genutzt werden sollen, braucht es zusätzlich eine nicht-produktive Backend-Konfiguration und einen Frontend-Build mit `VITE_ENABLE_DEV_TOOLS=true`.

## Updates einspielen

Bei neuen Versionen:

```bash
git pull
docker compose -f docker-compose.onprem.yml --env-file .env.onprem up -d --build
```

Danach, falls Migrationen vorhanden sind, erneut:

```bash
cd backend
npm ci
npm run migration:run
```

## Backup-Empfehlung

Mindestens zwei Dinge sichern:

- Postgres-Datenbank
- Upload-Volume des Backends

Betroffene Volumes im On-Prem-Setup:

- `postgres-data`
- `backend-uploads`

Beispiel für DB-Export:

```bash
docker exec -t $(docker ps --filter name=postgres --format "{{.ID}}") pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > stato_backup.sql
```

## Häufige Fehlerbilder

### Frontend lädt, aber API antwortet nicht

Prüfen:

- läuft `backend` wirklich?
- wurde der Frontend-Container mit dem On-Prem-Compose gebaut?
- ist `NGINX_MODE=proxy` aktiv?

### Login oder Einladungslinks zeigen auf falsche URL

Prüfen:

- `APP_ORIGIN` korrekt gesetzt?
- stimmt das Protokoll, also `http` versus `https`?

### CORS-Fehler

Prüfen:

- `CORS_ORIGINS` exakt auf die Frontend-Origin gesetzt?
- wird wirklich dieselbe Domain genutzt wie im Browser?

### Uploads fehlen nach Neustart

Prüfen:

- ist das Volume `backend-uploads` persistent?
- wurde der Container nicht versehentlich ohne Volume neu erzeugt?

### Nach Neustart sind Logins ungültig

Prüfen:

- `JWT_SECRET` stabil gesetzt?
- wurde der Wert versehentlich geändert?

## Empfehlung für den praktischen Betrieb

Für einen eigenen On-Prem-Rechner ist der einfachste und sauberste Weg:

1. [docker-compose.onprem.yml](../docker-compose.onprem.yml) nutzen
2. `.env.onprem` sauber ausfüllen
3. mit `docker compose ... up -d --build` starten
4. Migrationen ausführen
5. nur das Frontend nach außen freigeben
6. HTTPS davor setzen

Damit läuft StatO vollständig selbst gehostet mit Frontend-, Backend- und Datenbank-Container auf einer eigenen Infrastruktur.