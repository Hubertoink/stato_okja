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
- Frontend und Backend koennen miteinander sprechen, ohne dass der Frontend-Container direkten DB-Zugriff braucht

Wichtig zur Sicherheitsgrenze:

- Für On-Prem bleibt genau dieser eine öffentliche Einstiegspunkt der empfohlene Standard.
- Das Backend sollte im Standard nicht zusätzlich mit eigenem öffentlichen Port exponiert werden.
- Eine Trennung in Frontend-Port und Backend-Port wäre on-prem nur dann sinnvoll, wenn davor bewusst ein eigener Reverse Proxy oder eine Firewall-Regelung betrieben wird.
- Die Compose-Datei trennt das interne Netz jetzt zusätzlich in `frontend-backend` und `backend-db`, damit der DB-Service nicht mehr im gleichen Docker-Netz wie das Frontend hängt.

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

## Schnellinstallation mit einem Befehl

Die Installer pruefen Git, Docker und Docker Compose, holen den Branch `main`,
erzeugen beim ersten Lauf eine lokale `.env.onprem` mit individuellen
Zufalls-Secrets und starten alle Container. Eine bereits vorhandene
`.env.onprem` wird bei erneuter Ausfuehrung nicht ueberschrieben.

Linux/macOS:

```bash
curl -fsSL https://raw.githubusercontent.com/Hubertoink/stato_okja/main/scripts/install-onprem.sh | sh
```

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/Hubertoink/stato_okja/main/scripts/install-onprem.ps1 | iex
```

Standardmaessig wird in ein Unterverzeichnis `stato_okja` des aktuellen
Verzeichnisses installiert. Das Ziel kann vorgegeben werden:

```bash
curl -fsSL https://raw.githubusercontent.com/Hubertoink/stato_okja/main/scripts/install-onprem.sh | STATO_INSTALL_DIR=/opt/stato sh
```

```powershell
$env:STATO_INSTALL_DIR = 'C:\Stato'; irm https://raw.githubusercontent.com/Hubertoink/stato_okja/main/scripts/install-onprem.ps1 | iex
```

Der Installer zeigt das initial generierte Superadmin-Passwort am Ende einmal
an. Es steht ausserdem in `.env.onprem` und sollte nach dem ersten Login
geaendert werden. Fuer den produktiven Betrieb danach mindestens Domain, E-Mail,
Branding und HTTPS-Einstellungen pruefen.

## Manuelle Installation

### Schritt 1: Repo auf den Zielserver bringen

Beispiel:

```bash
git clone <euer-repo-url>
cd stato_okja
```

Wenn das Repo nicht per Git kommt, reicht auch ein vollständiges Verzeichnis auf dem Server, solange alle Compose-, Backend- und Frontend-Dateien enthalten sind.

### Schritt 2: ENV-Datei anlegen

Aus der Vorlage eine produktive On-Prem-Datei erzeugen:

```bash
cp .env.onprem.example .env.onprem
```

Unter Windows PowerShell alternativ:

```powershell
Copy-Item .env.onprem.example .env.onprem
```

### Schritt 3: Variablen in `.env.onprem` setzen

Mindestens diese Variablen müssen sauber gesetzt sein:

### Datenbank

- `POSTGRES_DB`: Name der Datenbank
- `POSTGRES_USER`: Datenbankbenutzer
- `POSTGRES_PASSWORD`: starkes DB-Passwort

### Anwendung / URLs

- `APP_ORIGIN`: öffentliche URL des Frontends, z. B. `https://stato.meine-kommune.de`
- `CORS_ORIGINS`: erlaubte Frontend-Origin, meist identisch zu `APP_ORIGIN`
- `API_PREFIX`: optional, Default ist `api`
- `TRUST_PROXY`: im On-Prem-Proxy-Standard auf `true`, damit Backend-Rate-Limits die echte Client-IP statt nur den Frontend-Container sehen

### Sicherheit / Auth

- `JWT_SECRET`: lang, zufällig, stabil, nicht bei jedem Deploy ändern
- `JWT_ACCESS_EXPIRATION`: optional, Standard z. B. `12h`
- `PASSWORD_RESET_MODE`: `email`, `admin_temp_password` oder `hybrid`
- `AUTH_2FA_ENABLED`: optionale E-Mail-Zwei-Faktor-Authentifizierung für den Login, Standard `false`
- `AUTH_2FA_CODE_TTL`: Gültigkeit des E-Mail-Codes in Sekunden, Standard `600`
- `APP_ORIGIN` muss auf die echte Frontend-URL zeigen, damit der Direktlink aus der 2FA-E-Mail den Code wieder in die Login-Seite zurückgeben kann

### Frischer Erststart / Schema-Bootstrap

- `DB_SYNCHRONIZE`: im produktiven On-Prem-Betrieb auf `false` lassen
- `DB_MIGRATIONS_RUN`: auf `true` setzen, damit das Backend Migrationen beim Container-Start ausführt
- `DB_LOGGING`: optional, für produktionsnahe On-Prem-Instanzen meist `false`
- `RATE_LIMIT_TTL`: Zeitfenster für das globale Backend-Rate-Limit in Sekunden, Standard `60`
- `RATE_LIMIT_MAX`: maximale Requests pro Client-IP innerhalb des Zeitfensters, Standard `100`
- `AUTH_RATE_LIMIT_TTL`: Zeitfenster für strengere Auth-Endpunkte in Sekunden, Standard `60`
- `AUTH_RATE_LIMIT_MAX`: maximale Requests pro Client-IP auf Login, Invite und Passwort-Reset innerhalb des Auth-Zeitfensters, Standard `10`
- `LOGIN_MAX_FAILED_ATTEMPTS`: falsche Passworteingaben bis zur Kontosperre, Standard `5`
- `LOGIN_LOCKOUT_MINUTES`: Dauer der Kontosperre in Minuten, Standard `10`

### Optional: externe Postgres-Datenbank mit TLS

- `DB_REQUIRE_SSL`: nur relevant bei externer Datenbank
- `DB_SSL`: aktiviert TLS für die DB-Verbindung
- `DB_SSL_REJECT_UNAUTHORIZED`: Zertifikatsprüfung für TLS-Verbindungen

Für den mitgelieferten lokalen `postgres`-Service sollten diese Werte normalerweise `false` bleiben.

### Initialer Superadmin

- `SUPERADMIN_EMAIL`: Login des ersten Superadmins
- `SUPERADMIN_PASSWORD`: starkes Passwort
- `SUPERADMIN_EMAIL_FORCE`: optional, Default `false`
- `SUPERADMIN_PASSWORD_FORCE`: optional, Default `false`

Mindestanforderung im produktiven/staging Bootstrap:

- `SUPERADMIN_EMAIL` muss explizit gesetzt sein und darf kein Platzhalter wie `admin@example.org` sein.
- `SUPERADMIN_PASSWORD` muss mindestens 12 Zeichen und jeweils mindestens einen Großbuchstaben, Kleinbuchstaben, eine Zahl und ein Sonderzeichen enthalten.
- Ein 8-stelliges Passwort mit Sonderzeichen reicht für diesen produktiven Bootstrap also nicht aus.

Präzises Verhalten:

- Beim allerersten Start, wenn noch kein `superadmin` existiert, werden `SUPERADMIN_EMAIL` und `SUPERADMIN_PASSWORD` für die initiale Anlage verwendet.
- Solange `SUPERADMIN_EMAIL_FORCE=false` und `SUPERADMIN_PASSWORD_FORCE=false` bleiben, wird ein bereits existierender Superadmin bei weiteren Container-Starts **nicht** automatisch überschrieben.
- Wenn `SUPERADMIN_EMAIL_FORCE=true` gesetzt ist, schreibt das Backend beim Start die E-Mail des vorhandenen Superadmins auf den Wert aus `SUPERADMIN_EMAIL` um.
- Wenn `SUPERADMIN_PASSWORD_FORCE=true` gesetzt ist, schreibt das Backend beim Start den Passwort-Hash des vorhandenen Superadmins neu, also effektiv das Passwort auf den Wert aus `SUPERADMIN_PASSWORD` zurück.
- Die Änderung passiert nur beim Start des Backend-Containers. Ein bloßes Ändern der `.env.onprem` ohne Container-Neustart löst noch nichts aus.

Wichtig zur Auswirkung auf bestehende Installationen:

- Wenn bereits ein Superadmin in der Datenbank existiert und `SUPERADMIN_PASSWORD_FORCE=false` bleibt, blockiert ein kürzeres ENV-Passwort den normalen Produktivstart nicht.
- Relevant ist die strenge Prüfung also beim ersten Seed einer leeren produktiven/staging Datenbank, bei `SUPERADMIN_PASSWORD_FORCE=true` oder wenn ein bestehender Superadmin keinen Passwort-Hash hat.

Empfehlung:

- Für normalen Betrieb beide Flags auf `false` lassen.
- Nur für einen bewussten Admin-Reset kurzzeitig auf `true` setzen, Backend neu starten und danach wieder auf `false` zurückstellen.

### Optional: Branding

- `PUBLIC_APP_NAME`
- `PUBLIC_ORG_NAME`
- `PUBLIC_LOGIN_SUBTITLE`
- `PUBLIC_LIVE_REFRESH_INTERVAL_MS`
  - Default: `15000`
  - Polling fuer Dashboard, Aktivitaeten und Statistik in Millisekunden.
  - `0` deaktiviert Polling; Fokus-Refetch bleibt aktiv.

### Optional: SMTP

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

Hinweis: Feinsteuerung wie `RESET_TOKEN_EXPIRATION` oder `INVITE_TOKEN_EXPIRATION` ist im On-Prem-Standard bewusst nicht Teil der Basisvorlage. Für die meisten On-Prem-Setups reicht `PASSWORD_RESET_MODE` als Schalter; Token-Laufzeiten sind erst bei gezielt konfiguriertem Mail-Flow relevant.

### Optional: Laufzeitumgebung

- `TZ`: Container-Zeitzone, z. B. `Europe/Berlin`
- `APP_ENV`: steuert u. a. die Backend-Dev-Tools
- `NODE_ENV`: steuert Runtime-Verhalten des Backends

### Optional: Dev Tools

- `VITE_ENABLE_DEV_TOOLS=false`
- `ENABLE_ORG_MOVE=false`

Für einen echten On-Prem-Produktivbetrieb sollte das normalerweise `false` bleiben.

Zusätzlich bei `ENABLE_ORG_MOVE`:

- Standard ist bewusst `false`, damit Organisationsverschiebungen nicht versehentlich im Betrieb genutzt werden.
- Erst bei `ENABLE_ORG_MOVE=true` werden die Move-Endpunkte im Backend aktiviert und der Verschieben-Button in den Frontend-Build aufgenommen.
- Nach einer Änderung des Werts muss der Frontend-Container neu gebaut werden.

## Vollständiges Beispiel für `.env.onprem`

Die gepflegte, kommentierte Vorlage ist
[`.env.onprem.example`](../.env.onprem.example). Die drei Werte
`GENERATED_BY_INSTALLER` werden von den Schnellinstallern automatisch ersetzt;
bei der manuellen Installation muessen dort eigene sichere Werte eingetragen
werden.

```env
POSTGRES_DB=stato_prod
POSTGRES_USER=stato_user
POSTGRES_PASSWORD=GENERATED_BY_INSTALLER

HTTP_PORT=80
APP_ORIGIN=http://localhost
CORS_ORIGINS=http://localhost
API_PREFIX=api
TRUST_PROXY=true

JWT_SECRET=GENERATED_BY_INSTALLER
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
AUTH_REFRESH_COOKIE_SAMESITE=lax
AUTH_REFRESH_COOKIE_SECURE=false
INVITE_TOKEN_EXPIRATION=7d
RESET_TOKEN_EXPIRATION=1h
AUTH_2FA_ENABLED=false
AUTH_2FA_CODE_TTL=600
DB_SYNCHRONIZE=false
DB_MIGRATIONS_RUN=true
DB_LOGGING=false
STRICT_SECURITY_MODE=true
SWAGGER_ENABLED=false
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_TTL=60
AUTH_RATE_LIMIT_MAX=10
LOGIN_MAX_FAILED_ATTEMPTS=5
LOGIN_LOCKOUT_MINUTES=10
DB_REQUIRE_SSL=false
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=false
ENABLE_ORG_MOVE=false
PASSWORD_RESET_MODE=admin_temp_password

SUPERADMIN_EMAIL=admin@stato.local
SUPERADMIN_PASSWORD=GENERATED_BY_INSTALLER
SUPERADMIN_EMAIL_FORCE=false
SUPERADMIN_PASSWORD_FORCE=false

PUBLIC_APP_NAME=StatO
PUBLIC_ORG_NAME=Stadt Musterstadt
PUBLIC_LOGIN_SUBTITLE=OKJA Statistik und Dokumentation
PUBLIC_LIVE_REFRESH_INTERVAL_MS=15000

# Optional SMTP
# SMTP_HOST=mail.kommune.local
# SMTP_PORT=587
# SMTP_USER=mailer
# SMTP_PASS=CHANGE_ME
# SMTP_FROM=no-reply@kommune.local

TZ=Europe/Berlin

VITE_ENABLE_DEV_TOOLS=false
APP_ENV=production
NODE_ENV=production
```

### Schritt 4: Container starten

Der On-Prem-Stack wird mit der vorhandenen Compose-Datei gestartet:

```bash
docker compose -f docker-compose.onprem.yml --env-file .env.onprem up -d --build
```

Dadurch werden gebaut bzw. gestartet:

- `postgres`
- `backend`
- `frontend`

### Schritt 5: Start prüfen

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

### Schritt 6: Datenbank-Migrationen prüfen

Im On-Prem-Compose ist der empfohlene Produktionspfad bereits voreingestellt:

- `DB_SYNCHRONIZE=false`
- `DB_MIGRATIONS_RUN=true`

Damit führt der Backend-Container Migrationen beim Start automatisch aus. Prüfe nach dem Start die Backend-Logs; dort erscheinen Migrations- oder Datenbankfehler, falls das Schema nicht angelegt werden konnte.

Manuelle Migrationen sind nur für Sonderfälle nötig, etwa wenn ein separates Deployment-System die Datenbank vor dem Backend-Start aktualisiert. Dann muss dieselbe Datenbank-Konfiguration aus `.env.onprem` verwendet werden.

### Schritt 7: Login testen

Nach erfolgreichem Start:

1. Frontend im Browser öffnen
2. Mit `SUPERADMIN_EMAIL` und `SUPERADMIN_PASSWORD` anmelden
3. Prüfen, ob Projekte, Benutzerverwaltung und Statistik erreichbar sind

## Container-Architektur im On-Prem-Compose

### PostgreSQL

Im Compose wird Postgres als Service `postgres` gestartet.

Wichtige Punkte:

- Daten liegen persistent im dedizierten Volume `stato-onprem-postgres-data`
- Hostname innerhalb des Docker-Netzes ist `postgres`
- das Backend nutzt genau diesen Service-Namen als `DB_HOST`

Hinweis:

- Das On-Prem-Compose nutzt eigene Docker-Ressourcen, damit es nicht mit einem zuvor gestarteten Dev-Setup im selben Checkout kollidiert.

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

- `stato-onprem-backend-uploads`

### Frontend

Der Frontend-Container wird aus [frontend/Dockerfile](../frontend/Dockerfile) gebaut.

Wichtig für On-Prem:

- `NGINX_MODE=proxy` ist im On-Prem-Compose gesetzt
- dadurch proxyt Nginx `/api/*` intern an das Backend
- `VITE_API_BASE_URL` muss in diesem Modus nicht gesetzt werden

Das ist die empfohlene Betriebsart für einen einzelnen On-Prem-Host.

## Ports und Netzwerk

Standardmäßig im On-Prem-Compose:

- Frontend: Host-Port `${HTTP_PORT:-80}` auf Container-Port `8080`
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

Für interne DNS-Namen enthält das Repository einen optionalen Caddy-Modus mit
interner PKI, Zertifikatsexport und Anleitung für Windows-Client-PCs bzw. AD-
Gruppenrichtlinien: [Caddy internes TLS](CADDY_INTERNAL_TLS_ONPREM.md).

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

## Passwort-Reset ohne Mailversand

Für klassische On-Prem-Installationen ohne SMTP empfiehlt sich:

```env
PASSWORD_RESET_MODE=admin_temp_password
```

Dann gilt:

- der Link „Passwort vergessen?“ wird im Frontend deaktiviert
- der Superadmin kann in der Benutzerverwaltung ein temporäres Passwort setzen
- der betroffene Benutzer muss dieses nach dem Login sofort ändern

Alternativ ist auch möglich:

```env
PASSWORD_RESET_MODE=hybrid
```

Dann kann der Superadmin je nach Situation zwischen Reset-Link und temporärem Passwort wählen.

## Dev Tools auf On-Prem

Die Dev-Tools bestehen aus zwei Ebenen:

- Backend-Freigabe über `NODE_ENV` und `APP_ENV`
- Frontend-Menü über `VITE_ENABLE_DEV_TOOLS`

Für einen normalen On-Prem-Produktivbetrieb gilt:

- `NODE_ENV=production`
- `VITE_ENABLE_DEV_TOOLS=false`

Wenn die Dev-Tools bewusst in einer Testinstanz genutzt werden sollen, braucht es zusätzlich eine nicht-produktive Backend-Konfiguration und einen Frontend-Build mit `VITE_ENABLE_DEV_TOOLS=true`.

## Organisationsverschiebung auf On-Prem

Die Organisationsverschiebung ist ebenfalls feature-flagged:

- `ENABLE_ORG_MOVE=false`: Standard, keine Verschiebung im Backend und keine Verschieben-Aktion im Frontend
- `ENABLE_ORG_MOVE=true`: Verschiebung bewusst freigegeben

Wichtig:

- Das Backend liest `ENABLE_ORG_MOVE` zur Laufzeit.
- Das Frontend bekommt denselben Wert als Build-Argument. Nach einer Änderung ist deshalb ein `docker compose ... up -d --build` nötig.

## Updates einspielen

Bei neuen Versionen:

```bash
git pull
docker compose -f docker-compose.onprem.yml --env-file .env.onprem up -d --build
```

Danach die Backend-Logs prüfen. Mit `DB_MIGRATIONS_RUN=true` und `DB_SYNCHRONIZE=false` führt der Backend-Container neue Migrationen beim Start automatisch aus.

## Backup-Empfehlung

Mindestens zwei Dinge sichern:

- Postgres-Datenbank
- Upload-Volume des Backends

Betroffene Volumes im On-Prem-Setup:

- `stato-onprem-postgres-data`
- `stato-onprem-backend-uploads`

Beispiel für DB-Export:

```bash
docker exec -t $(docker ps --filter name=postgres --format "{{.ID}}") pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > stato_backup.sql
```

Fuer den regelmaessigen Betriebsbackup-Pfad stehen zusaetzlich PowerShell-Skripte bereit:

```powershell
.\scripts\onprem-backup.ps1 -ComposeFile docker-compose.onprem.yml -EnvFile .env.onprem -RetentionDays 14
.\scripts\onprem-restore.ps1 -BackupDir .\backups\stato-onprem-YYYYMMDD-HHMMSS -ConfirmText "RESTORE STATO BACKUP"
```

Die Skripte laufen ueber Docker Compose und koennen auch mit einem Docker-Context auf einem externen Host genutzt werden, solange die Docker CLI den richtigen Compose-Stack erreicht. Details, Automatisierung und Restore-Testprotokoll: [security/BACKUP_RESTORE_RUNBOOK_2026-05-02.md](security/BACKUP_RESTORE_RUNBOOK_2026-05-02.md)

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

- ist das Volume `stato-onprem-backend-uploads` persistent?
- wurde der Container nicht versehentlich ohne Volume neu erzeugt?

### Frontend liefert 502, Backend kommt nicht hoch

Prüfen:

- zeigen die Backend-Logs `password authentication failed for user`?
- zeigen die Postgres-Logs `database "stato_prod" does not exist`?
- lief vorher bereits das Dev-Compose im selben Checkout?

Bei `password authentication failed` passt meist das Passwort im vorhandenen
Postgres-Volume nicht mehr zu `.env.onprem`. Ein normales `down`/`up` ändert das
gespeicherte Datenbankpasswort nicht. Den Installer erneut ausführen; er gleicht
das Passwort ohne Löschen der Daten ab, korrigiert bei älteren Upload-Volumes die
Berechtigungen und startet den Stack neu:

```powershell
.\scripts\install-onprem.ps1
```

```bash
sh ./scripts/install-onprem.sh
```

Bei `database "stato_prod" does not exist` prüfen, ob `POSTGRES_DB` oder
`POSTGRES_USER` nach der ersten Initialisierung geändert wurden. Diese Namen
werden bei einem bestehenden Volume nicht automatisch umbenannt.

### Nach Neustart sind Logins ungültig

Prüfen:

- `JWT_SECRET` stabil gesetzt?
- wurde der Wert versehentlich geändert?

## Empfehlung für den praktischen Betrieb

Für einen eigenen On-Prem-Rechner ist der einfachste und sauberste Weg:

1. [docker-compose.onprem.yml](../docker-compose.onprem.yml) nutzen
2. `.env.onprem` sauber ausfüllen
3. mit dem On-Prem-Installer bauen und starten
4. Backend-Logs prüfen, damit automatische Migrationen erfolgreich gelaufen sind
5. nur das Frontend nach außen freigeben
6. HTTPS davor setzen

Damit läuft StatO vollständig selbst gehostet mit Frontend-, Backend- und Datenbank-Container auf einer eigenen Infrastruktur.
