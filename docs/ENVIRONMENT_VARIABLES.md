# Environment-Variablen

Diese Datei ist die zentrale Git-Referenz fuer die im Repository verwendeten Environment-Variablen, ihre moeglichen Werte und ihre Funktion.

## Quellen im Repository

- `.env.onprem.example`: produktionsnahes On-Prem-Beispiel
- `env.production.example`: Hosted-/Off-Prem-Beispiel
- `backend/.env.example`: lokale Entwicklungswerte
- `backend/BACKEND_CONTAINER_ENV.md`: Backend-spezifische Detailreferenz

Wichtig:

- Echte Zugangsdaten gehoeren nicht nach Git, sondern in lokale `.env`-Dateien, Secrets Stores oder Deployment-Secrets.
- Alles mit Passwoertern, Tokens oder Schluesseln sollte als Secret gepflegt werden.
- Frontend-Build-Variablen muessen beim Build des Frontends gesetzt werden, nicht erst zur Laufzeit im Browser.

## Betriebsarten

| Modus | Typische Datei | Zweck |
| --- | --- | --- |
| Entwicklung | `backend/.env.example` | Lokale Node- und Frontend-Entwicklung |
| On-Prem | `.env.onprem.example` | Frontend, Backend und Postgres in eigenem Compose-Stack |
| Hosted / Off-Prem | `env.production.example` | Deployment hinter Reverse Proxy oder externer Plattform |

## Server und HTTP

| Variable | Optionen / Format | Funktion |
| --- | --- | --- |
| `NODE_ENV` | `development`, `test`, `production` | Schaltet Runtime-Defaults fuer Node und Sicherheitsverhalten. Produktion sollte `production` setzen. |
| `APP_ENV` | meist `development`, `staging`, `production` | App-spezifischer Modus. `production` deaktiviert Dev- und Seed-Pfade auch dann, wenn `NODE_ENV` abweicht. |
| `STRICT_SECURITY_MODE` | `true`, `false` | Erzwingt produktionsnahe Sicherheitspruefungen auch ausserhalb von `NODE_ENV=production`. |
| `TZ` | z. B. `Europe/Berlin`, `UTC` | Zeitzone fuer Container und Prozess-Logs. |
| `PORT` | Portnummer, meist `3000` | Interner Port des Backends. |
| `API_PREFIX` | Pfadsegment wie `api` | Prefix fuer alle API-Routen, typischerweise `/api`. |
| `APP_ORIGIN` | vollstaendige URL | Oeffentliche URL des Frontends. Wird fuer Reset-, Invite- und 2FA-Links verwendet. |
| `CORS_ORIGINS` | eine oder mehrere Origins, komma-separiert | Legt fest, von welchen Browser-Origins API-Requests erlaubt sind. |
| `TRUST_PROXY` | `true`, `false` | Muss hinter Nginx, Varnish oder anderem Reverse Proxy meist `true` sein, damit echte Client-IPs erkannt werden. |
| `SWAGGER_ENABLED` | `true`, `false` | Aktiviert oder deaktiviert die Swagger-Doku des Backends. In Produktion meist `false`. |

## Datenbank und Migrationen

| Variable | Optionen / Format | Funktion |
| --- | --- | --- |
| `DB_TYPE` | meist `postgres` | Datenbank-Treiber des Backends. |
| `DB_HOST` | Hostname, z. B. `postgres`, `db.example.com` | Zielhost der Datenbankverbindung. |
| `DB_PORT` | Portnummer, meist `5432` | TCP-Port der Datenbank. |
| `DB_USERNAME` | Benutzername | DB-Benutzer fuer das Backend. |
| `DB_PASSWORD` | Passwort | Passwort der Datenbankverbindung. Secret. |
| `DB_DATABASE` | Datenbankname | Name der genutzten Datenbank. |
| `POSTGRES_DB` | Datenbankname | Initialer Datenbankname fuer den mitgelieferten Postgres-Container. |
| `POSTGRES_USER` | Benutzername | Initialer Benutzer fuer den mitgelieferten Postgres-Container. |
| `POSTGRES_PASSWORD` | Passwort | Initiales Passwort fuer den mitgelieferten Postgres-Container. Secret. |
| `DB_SYNCHRONIZE` | `true`, `false` | TypeORM Schema-Sync. Fuer produktive Umgebungen auf `false` lassen. |
| `DB_MIGRATIONS_RUN` | `true`, `false` | Fuehrt Migrationen beim Backend-Start automatisch aus. Fuer reproduzierbare Deployments meist `true`. |
| `DB_LOGGING` | `true`, `false` | Aktiviert SQL-Logging. In Produktion normalerweise `false`. |
| `DB_REQUIRE_SSL` | `true`, `false` | Erzwingt SSL fuer externe Datenbanken. Fuer lokalen Compose-Postgres meist `false`. |
| `DB_SSL` | `true`, `false`, teilweise `require` | Aktiviert TLS fuer die Datenbankverbindung. |
| `DB_SSL_REJECT_UNAUTHORIZED` | `true`, `false` | Steuert die Zertifikatspruefung bei SSL-Verbindungen. |

## Auth und Sicherheit

| Variable | Optionen / Format | Funktion |
| --- | --- | --- |
| `JWT_SECRET` | zufaelliger String mit mindestens 32 Zeichen | Signatur-Secret fuer JWTs und Sessions. Secret und stabil halten. |
| `JWT_ACCESS_EXPIRATION` | Zeitangabe wie `15m`, `1h`, `12h` | Gueltigkeit des Access-Tokens. |
| `JWT_REFRESH_EXPIRATION` | Zeitangabe wie `7d`, `30d` | Gueltigkeit der Refresh-Session. |
| `AUTH_REFRESH_COOKIE_SAMESITE` | `lax`, `strict`, `none` | SameSite-Attribut fuer das HttpOnly-Refresh-Cookie. |
| `AUTH_REFRESH_COOKIE_SECURE` | `true`, `false` | Optionaler Override fuer das Secure-Flag des Refresh-Cookies. Unter HTTPS in Produktion typischerweise `true`. |
| `INVITE_TOKEN_EXPIRATION` | Zeitangabe wie `24h` | Gueltigkeit von Einladungslinks (maximal 24 Stunden). |
| `RESET_TOKEN_EXPIRATION` | Zeitangabe wie `1h` | Gueltigkeit von Passwort-Reset-Links. |
| `PASSWORD_RESET_MODE` | `email`, `admin_temp_password`, `hybrid` | Legt fest, ob Passwort-Resets per Mail, nur durch Admins oder in beiden Modi moeglich sind. |
| `USER_PROVISIONING_MODE` | `email` (Standard), `local` | `email` nutzt Einladungen per SMTP und ist empfohlen. `local` aktiviert die lokale Benutzeranlage mit einem durch den Admin gesetzten temporären Passwort; dieses muss beim ersten Login geändert werden. |
| `AUTH_2FA_ENABLED` | `true`, `false` | Aktiviert E-Mail-basierte Zwei-Faktor-Anmeldung. Benoetigt funktionierendes SMTP. |
| `AUTH_2FA_CODE_TTL` | Sekunden, z. B. `600` | Gueltigkeit eines 2FA-Codes. |

## Rate Limiting und Paging

| Variable | Optionen / Format | Funktion |
| --- | --- | --- |
| `RATE_LIMIT_TTL` | Sekunden, meist `60` | Zeitfenster fuer das globale Rate-Limit. |
| `RATE_LIMIT_MAX` | Ganzzahl, z. B. `100` | Maximal erlaubte Requests pro Client innerhalb des globalen Fensters. |
| `AUTH_RATE_LIMIT_TTL` | Sekunden, meist `60` | Zeitfenster fuer strengere Auth-Endpunkte wie Login oder Reset. |
| `AUTH_RATE_LIMIT_MAX` | Ganzzahl, z. B. `10` | Maximal erlaubte Requests pro Client auf Auth-Endpunkte. |
| `LOGIN_MAX_FAILED_ATTEMPTS` | Ganzzahl, meist `5` | Falsche Passworteingaben bis zur Kontosperre. |
| `LOGIN_LOCKOUT_MINUTES` | Minuten, meist `10` | Dauer der Kontosperre nach zu vielen falschen Passworteingaben. |
| `DEFAULT_PAGE_SIZE` | Ganzzahl, z. B. `20` | Standardgroesse paginierter API-Antworten in der Entwicklung. |
| `MAX_PAGE_SIZE` | Ganzzahl, z. B. `100` | Harte Obergrenze fuer API-Listen pro Request. |

## Superadmin und Branding

| Variable | Optionen / Format | Funktion |
| --- | --- | --- |
| `SUPERADMIN_EMAIL` | gueltige E-Mail-Adresse | Initiale Superadmin-Adresse fuer Erststart oder bewussten Reset. |
| `SUPERADMIN_PASSWORD` | starkes Passwort | Initiales Superadmin-Passwort. In produktiven Bootstrap-Faellen mindestens 12 Zeichen mit Gross-/Kleinbuchstaben, Zahl und Sonderzeichen. |
| `SUPERADMIN_EMAIL_FORCE` | `true`, `false` | Wenn `true`, wird die bestehende Superadmin-Mail beim Backend-Start ueberschrieben. Nur fuer bewusste Admin-Resets. |
| `SUPERADMIN_PASSWORD_FORCE` | `true`, `false` | Wenn `true`, wird das bestehende Superadmin-Passwort beim Start neu gesetzt. Nur fuer bewusste Resets. |
| `INITIAL_SETUP_ENABLED` | `true`, `false` | Erlaubt bei leerer Datenbank einmalig die Passwortvergabe im Browser. Danach ist der Setup-Endpunkt geschlossen. |
| `PUBLIC_APP_NAME` | Freitext | Anzeigename der Anwendung. |
| `PUBLIC_ORG_NAME` | Freitext | Optionaler Organisationsname, z. B. fuer die Login-Seite. |
| `PUBLIC_LOGIN_SUBTITLE` | Freitext | Untertitel auf der Login-Seite. |
| `PUBLIC_LIVE_REFRESH_INTERVAL_MS` | Millisekunden, z. B. `30000`, `0` | Polling-Intervall fuer Dashboard, Aktivitaeten und Statistik. `0` deaktiviert Polling. |
| `STATS_OVERVIEW_CACHE_TTL_MS` | Millisekunden, z. B. `30000`, `0` | Cache-Dauer fuer zusammengefasste Statistikabfragen. `0` deaktiviert den Cache. |

## SMTP und E-Mail

| Variable | Optionen / Format | Funktion |
| --- | --- | --- |
| `SMTP_HOST` | Hostname oder leer | SMTP-Server fuer Einladungen, Passwort-Reset und 2FA. |
| `SMTP_PORT` | Portnummer, meist `587` oder `465` | SMTP-Port. |
| `SMTP_USER` | Benutzername oder E-Mail | SMTP-Loginname. Haengt vom Mailanbieter ab. |
| `SMTP_PASS` | Passwort | SMTP-Passwort. Secret. |
| `SMTP_FROM` | gueltige Absenderadresse | Absenderadresse fuer Systemmails. |

## Storage und Uploads

Diese Variablen kommen vor allem in lokalen Entwicklungs- oder S3/MinIO-Setups vor.

| Variable | Optionen / Format | Funktion |
| --- | --- | --- |
| `MINIO_ENDPOINT` | Hostname, z. B. `localhost` | Zielhost des MinIO- oder S3-kompatiblen Speichers. |
| `MINIO_PORT` | Portnummer, z. B. `9000` | Port des MinIO-Dienstes. |
| `MINIO_USE_SSL` | `true`, `false` | Aktiviert HTTPS fuer die Storage-Verbindung. |
| `MINIO_ACCESS_KEY` | Zugriffsschluessel | Loginname fuer MinIO/S3. Secret. |
| `MINIO_SECRET_KEY` | geheimes Kennwort | Secret-Key fuer MinIO/S3. Secret. |
| `MINIO_BUCKET` | Bucket-Name | Ziel-Bucket fuer Attachments und Uploads. |

## Feature-Flags und Seeds

| Variable | Optionen / Format | Funktion |
| --- | --- | --- |
| `ENABLE_ORG_MOVE` | `true`, `false` | Aktiviert Organisationsverschiebungen im Backend und steuert im Compose-Build auch das zugehoerige Frontend-Flag. |
| `VITE_ENABLE_DEV_TOOLS` | `true`, `false` | Frontend-Build-Flag fuer das Dev-Tools-Menue. In Produktion normalerweise `false`. |
| `VITE_ENABLE_ORG_MOVE` | `true`, `false` | Frontend-Build-Flag fuer die Organisationsverschiebung. Wird in Compose meist aus `ENABLE_ORG_MOVE` abgeleitet. |
| `SEED_ALLOW_PROD` | `true`, `false` | Erlaubt Seed-Skripte ausnahmsweise in produktionsnahen Umgebungen. Standardmaessig deaktiviert. |
| `SEED_ORGS` | Ganzzahl | Anzahl erzeugter Organisationen fuer Seeds. |
| `SEED_STAFF_PER_ORG` | Ganzzahl | Anzahl Mitarbeitender pro Organisation fuer Seeds. |
| `SEED_ACTIVITIES` | Ganzzahl | Anzahl erzeugter Aktivitaeten fuer Seeds. |
| `SEED_PROJECTS_PER_ORG` | Ganzzahl | Anzahl erzeugter Projekte pro Organisation fuer Seeds. |
| `SEED_CLEAR` | `true`, `false` | Loescht vorhandene Seed-Daten vor einem Seed-Lauf. |

## Typische Kombinationen

### On-Prem mit internem Postgres

```env
NODE_ENV=production
APP_ENV=production
APP_ORIGIN=https://stato.example.org
CORS_ORIGINS=https://stato.example.org
TRUST_PROXY=true
POSTGRES_DB=stato_prod
POSTGRES_USER=stato_user
POSTGRES_PASSWORD=<starkes-passwort>
JWT_SECRET=<mindestens-32-zeichen>
PASSWORD_RESET_MODE=admin_temp_password
DB_MIGRATIONS_RUN=true
DB_SYNCHRONIZE=false
SWAGGER_ENABLED=false
VITE_ENABLE_DEV_TOOLS=false
```

### Hosted mit externer Postgres-Datenbank

```env
NODE_ENV=production
APP_ENV=production
APP_ORIGIN=https://app.example.org
CORS_ORIGINS=https://app.example.org
TRUST_PROXY=true
DB_HOST=db.example.org
DB_PORT=5432
DB_USERNAME=stato_user
DB_PASSWORD=<starkes-passwort>
DB_DATABASE=stato_prod
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
JWT_SECRET=<mindestens-32-zeichen>
DB_MIGRATIONS_RUN=true
DB_SYNCHRONIZE=false
```

## Hinweise fuer GitHub und Deployments

- Als Secrets pflegen: `JWT_SECRET`, `DB_PASSWORD`, `POSTGRES_PASSWORD`, `SMTP_PASS`, `MINIO_SECRET_KEY`, meist auch `MINIO_ACCESS_KEY`.
- Als normale Variablen pflegen: `APP_ORIGIN`, `CORS_ORIGINS`, `NODE_ENV`, `APP_ENV`, `PORT`, `DB_HOST`, `DB_PORT`, `PUBLIC_*`, `RATE_LIMIT_*`.
- Bei Frontend-Build-Flags wie `VITE_ENABLE_DEV_TOOLS` und `VITE_ENABLE_ORG_MOVE` gilt: Aenderungen erfordern einen neuen Frontend-Build.

## Verwandte Dateien

- `backend/BACKEND_CONTAINER_ENV.md`
- `docs/DOCKER_ONPREM_SETUP.md`
- `docs/LOCAL_SETUP_ONPREM.md`
- `docs/GO_LIVE_MITTWALD.md`
- `.env.onprem.example`
- `env.production.example`
- `backend/.env.example`
