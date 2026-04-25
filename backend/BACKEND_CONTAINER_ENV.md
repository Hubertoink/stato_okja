# Backend Container Environment

Diese Referenz beschreibt die Environment-Variablen, die der StatO-Backend-Container zur Laufzeit liest. Sie ist die zentrale Quelle fuer Docker/Compose-Setups; konkrete Beispielwerte stehen in [.env.onprem.example](../.env.onprem.example) und [env.production.example](../env.production.example).

Wichtig: echte Werte gehoeren in lokale `.env*`-Dateien oder Secret Stores. Sie sollten nie in Git landen. Die vorhandene [.gitignore](../.gitignore) ignoriert `.env*`-Dateien und laesst nur die Example-Dateien zu.

## Betriebsarten

| Modus | Typische Dateien | Beschreibung |
| --- | --- | --- |
| On-Prem / Local | [docker-compose.onprem.yml](../docker-compose.onprem.yml), [.env.onprem.example](../.env.onprem.example) | Frontend, Backend und Postgres laufen gemeinsam. Das Frontend ist der oeffentliche Einstiegspunkt und proxyt `/api/*` intern an das Backend. |
| Off-Prem / Hosted | [docker-compose.prod.yml](../docker-compose.prod.yml), [env.production.example](../env.production.example) | Betrieb hinter einem Reverse Proxy, Load Balancer oder Plattform-Proxy. Frontend und Backend koennen getrennte Domains haben. |
| Entwicklung | [docker-compose.yml](../docker-compose.yml), [backend/.env.example](./.env.example) | Lokale Services und lokale Node-Prozesse. Sicherheitsdefaults sind bewusst lockerer. |

## Minimaler Produktionssatz

Fuer einen produktiven Backend-Container muessen mindestens diese Werte bewusst gesetzt sein:

```env
NODE_ENV=production
APP_ENV=production
APP_ORIGIN=https://stato.example.org
CORS_ORIGINS=https://stato.example.org
JWT_SECRET=<mindestens-32-zeichen-zufaellig-und-stabil>
POSTGRES_PASSWORD=<starkes-db-passwort>
SUPERADMIN_EMAIL=admin@example.org
SUPERADMIN_PASSWORD=<starkes-initialpasswort>
DB_MIGRATIONS_RUN=true
DB_SYNCHRONIZE=false
SWAGGER_ENABLED=false
```

Der produktive Erststart einer leeren Datenbank ist streng: `SUPERADMIN_EMAIL` darf kein Platzhalter sein und `SUPERADMIN_PASSWORD` muss mindestens 12 Zeichen mit Grossbuchstaben, Kleinbuchstaben, Zahl und Sonderzeichen enthalten.

## Server und HTTP

| Variable | Default | Beschreibung |
| --- | --- | --- |
| `NODE_ENV` | `development` | Setzt den Runtime-Modus. `production` und `staging` aktivieren Strict-Security-Pruefungen. |
| `APP_ENV` | leer | App-spezifischer Modus. `production` deaktiviert Dev-/Seed-Tools. |
| `STRICT_SECURITY_MODE` | abgeleitet aus `NODE_ENV` | `true` erzwingt Produktions-Sicherheitschecks auch ohne `NODE_ENV=production`. |
| `PORT` | `3000` | Interner Port des NestJS-Backends. |
| `API_PREFIX` | `api` | Globaler API-Prefix, z. B. `/api`. |
| `APP_ORIGIN` | `http://localhost:5173` | Oeffentliche Frontend-URL fuer Invite-, Reset- und 2FA-Links. |
| `CORS_ORIGINS` | `http://localhost:5173` | Komma-separierte erlaubte Browser-Origins. |
| `TRUST_PROXY` | `true` in production/staging, sonst `false` | Aktiviert Express `trust proxy`. Hinter Reverse Proxy oder On-Prem-Nginx empfohlen, damit Rate-Limits echte Client-IPs sehen. |
| `TZ` | Prozessdefault | Container-/Prozess-Zeitzone. Fuer deutsche Installationen meist `Europe/Berlin`. |
| `SWAGGER_ENABLED` | `false` in Strict Mode, sonst `true` | Schaltet `/api/docs` frei oder ab. In Produktion normalerweise `false`. |

## Datenbank und Migrationen

| Variable | Default | Beschreibung |
| --- | --- | --- |
| `DB_TYPE` | `postgres` | Produktiv `postgres`. Dev-Varianten fuer SQLite/SQL.js sind im Code vorhanden. |
| `DB_HOST` | `localhost` | In Compose meist `postgres`. |
| `DB_PORT` | `5432` | Postgres-Port. |
| `DB_USERNAME` | `stato_user` | Datenbankbenutzer. In Compose meist aus `POSTGRES_USER`. |
| `DB_PASSWORD` | `stato_dev_password` | Datenbankpasswort. In Compose meist aus `POSTGRES_PASSWORD`. |
| `DB_DATABASE` | `stato_dev` | Datenbankname. In Compose meist aus `POSTGRES_DB`. |
| `POSTGRES_DB` | Compose-spezifisch | Initialer DB-Name fuer den Postgres-Container. |
| `POSTGRES_USER` | Compose-spezifisch | Initialer DB-Benutzer fuer den Postgres-Container. |
| `POSTGRES_PASSWORD` | erforderlich in Compose | Initiales DB-Passwort fuer Postgres und Backend. |
| `DB_SYNCHRONIZE` | `false` | TypeORM-Schema-Sync. Fuer Produktion `false` lassen. |
| `DB_MIGRATIONS_RUN` | `true` bei `NODE_ENV=production`, sonst `false` | Fuehrt Migrationen beim Backend-Start aus. Greift nur, wenn `DB_SYNCHRONIZE=false` ist. |
| `DB_LOGGING` | `false` | SQL-Logging. In Produktion normalerweise `false`. |
| `DB_REQUIRE_SSL` | `true` fuer externe DBs im Strict Mode, sonst abhaengig vom Host | Erzwingt TLS fuer externe Postgres-Verbindungen. Fuer den lokalen Compose-Service `postgres` normalerweise `false`. |
| `DB_SSL` | `false` | Aktiviert TLS zur Datenbank (`true`, `1` oder `require`). |
| `DB_SSL_REJECT_UNAUTHORIZED` | `false` | Zertifikatspruefung. Fuer externe Produktionsdatenbanken mit korrekten Zertifikaten `true`. |

Hinweis: Postgres-Sessions werden vom Backend auf UTC gesetzt. `TZ=Europe/Berlin` ist trotzdem sinnvoll fuer Prozesslogs und zeitbezogene Auswertungen, aendert aber nicht die DB-Session-Zeitzone.

## Auth, JWT und Passwoerter

| Variable | Default | Beschreibung |
| --- | --- | --- |
| `JWT_SECRET` | unsicherer Dev-Fallback | Pflicht in Strict Mode. Mindestens 32 Zeichen, zufaellig, stabil. Eine Aenderung invalidiert bestehende Logins. |
| `JWT_ACCESS_EXPIRATION` | `12h` | Gueltigkeit von Access Tokens, z. B. `15m`, `1h`, `12h`. |
| `INVITE_TOKEN_EXPIRATION` | `7d` | Gueltigkeit von Einladungslinks. |
| `RESET_TOKEN_EXPIRATION` | `1h` | Gueltigkeit von Passwort-Reset-Links. |
| `PASSWORD_RESET_MODE` | `email` | `email`, `admin_temp_password` oder `hybrid`. |
| `AUTH_2FA_ENABLED` | `false` | Aktiviert E-Mail-2FA fuer Login. Erfordert funktionierendes SMTP, mindestens `SMTP_HOST`. |
| `AUTH_2FA_CODE_TTL` | `600` | Gueltigkeit des 2FA-Codes in Sekunden. |

`PASSWORD_RESET_MODE` im Detail:

| Wert | Wirkung |
| --- | --- |
| `email` | Self-Service-Passwortreset per Mail. SMTP empfohlen. |
| `admin_temp_password` | Kein Self-Service-Reset. Superadmin setzt temporaeres Passwort in der Benutzerverwaltung. Gut fuer On-Prem ohne SMTP. |
| `hybrid` | Beide Wege sind verfuegbar. |

## Superadmin-Seed

| Variable | Default | Beschreibung |
| --- | --- | --- |
| `SUPERADMIN_EMAIL` | Dev-Platzhalter | E-Mail fuer den initialen Superadmin. In Produktion/Staging explizit setzen. |
| `SUPERADMIN_PASSWORD` | `admin`, wenn leer und nicht Strict Mode | Initiales Passwort. In Produktion/Staging starkes Passwort erforderlich. |
| `SUPERADMIN_EMAIL_FORCE` | `false` | `true` ueberschreibt beim Backend-Start die E-Mail des bestehenden Superadmins. Danach wieder auf `false` setzen. |
| `SUPERADMIN_PASSWORD_FORCE` | `false` | `true` setzt beim Backend-Start das Passwort des bestehenden Superadmins neu. Danach wieder auf `false` setzen. |

Fuer normalen Betrieb bleiben beide Force-Flags `false`. Sie sind nur fuer bewusste Admin-Resets gedacht.

## SMTP und E-Mail

| Variable | Default | Beschreibung |
| --- | --- | --- |
| `SMTP_HOST` | leer | SMTP-Host. Wenn leer, werden Mails nicht versendet; Invite-/Reset-Links werden geloggt. |
| `SMTP_PORT` | `587` | SMTP-Port. `465` wird als secure SMTP behandelt. |
| `SMTP_USER` | leer | SMTP-Benutzer. Wenn leer, versucht das Backend unauthentifiziertes SMTP. |
| `SMTP_PASS` | leer | SMTP-Passwort. |
| `SMTP_FROM` | `no-reply@stato.local` | Absenderadresse. |

Wenn `AUTH_2FA_ENABLED=true` gesetzt ist, wird SMTP beim Backend-Start verifiziert. Schlaegt die Verbindung fehl, startet das Backend nicht. Fuer Passwort-Reset ohne SMTP ist `PASSWORD_RESET_MODE=admin_temp_password` der passende On-Prem-Modus.

## Branding und Public Config

Diese Werte liefert das Backend ueber `GET /auth/public-config` an das Frontend.

| Variable | Default | Beschreibung |
| --- | --- | --- |
| `PUBLIC_APP_NAME` | `StatO` | Anzeigename der App. |
| `PUBLIC_ORG_NAME` | leer | Optionaler Organisationsname auf der Login-Seite. |
| `PUBLIC_LOGIN_SUBTITLE` | `OKJA Statistik & Dokumentation` | Untertitel auf der Login-Seite. |
| `PUBLIC_LIVE_REFRESH_INTERVAL_MS` | `15000` | Polling fuer Dashboard, Aktivitaeten und Statistik. `0` deaktiviert Polling, Fokus-Refetch bleibt aktiv. |

## Rate Limiting

| Variable | Default | Beschreibung |
| --- | --- | --- |
| `RATE_LIMIT_TTL` | `60` | Globales Rate-Limit-Zeitfenster in Sekunden. |
| `RATE_LIMIT_MAX` | `100` | Globale maximale Requests je Client-IP und Zeitfenster. |
| `AUTH_RATE_LIMIT_TTL` | `60` | Strengeres Auth-Zeitfenster in Sekunden. |
| `AUTH_RATE_LIMIT_MAX` | `10` | Maximale Requests fuer Login, Invite und Passwort-Reset je Client-IP und Auth-Zeitfenster. |

Wenn alle Nutzer nur als Proxy-IP erscheinen, ist meist `TRUST_PROXY` falsch gesetzt oder der vorgelagerte Proxy uebergibt keine Forwarded-Header.

## Feature Flags und Dev-/Seed-Tools

| Variable | Default | Beschreibung |
| --- | --- | --- |
| `ENABLE_ORG_MOVE` | `false` | Aktiviert Organisationsverschiebungen im Backend. Das Frontend braucht denselben Wert als Build-Argument `VITE_ENABLE_ORG_MOVE`. |
| `SEED_ALLOW_PROD` | `false` | Erlaubt Seed-Skripte in Production/Staging nur bei explizitem `true`. Nicht im Normalbetrieb setzen. |
| `SEED_ORGS` | `5` | Anzahl Organisationen fuer Seed-Skripte. |
| `SEED_STAFF_PER_ORG` | `10` | Mitarbeitende je Organisation fuer Seed-Skripte. |
| `SEED_ACTIVITIES` | `10000` | Aktivitaeten fuer Seed-Skripte. |
| `SEED_PROJECTS_PER_ORG` | `8` | Projekte je Organisation fuer Seed-Skripte. |
| `SEED_CLEAR` | `false` | Loescht vorhandene Seed-Daten vor dem Seed-Lauf, wenn `true`. |

Backend-Dev-Tools sind deaktiviert, sobald `NODE_ENV=production` oder `APP_ENV=production` gesetzt ist. Das Frontend-Menue ist separat ein Build-Flag (`VITE_ENABLE_DEV_TOOLS`) und gehoert in die Frontend-/Compose-Konfiguration.

## Docker-Beispiele

### On-Prem mit internem Postgres

```env
APP_ORIGIN=https://stato.kommune.example
CORS_ORIGINS=https://stato.kommune.example
TRUST_PROXY=true
POSTGRES_DB=stato_prod
POSTGRES_USER=stato_user
POSTGRES_PASSWORD=<starkes-db-passwort>
JWT_SECRET=<langer-zufaelliger-wert>
PASSWORD_RESET_MODE=admin_temp_password
DB_MIGRATIONS_RUN=true
DB_SYNCHRONIZE=false
SWAGGER_ENABLED=false
```

### Off-Prem mit externer Postgres-Datenbank

```env
APP_ORIGIN=https://app.example.com
CORS_ORIGINS=https://app.example.com
TRUST_PROXY=true
DB_HOST=db.example.com
DB_PORT=5432
DB_USERNAME=stato_user
DB_PASSWORD=<starkes-db-passwort>
DB_DATABASE=stato_prod
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
DB_REQUIRE_SSL=true
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_FROM=no-reply@example.com
```

## Troubleshooting

| Symptom | Pruefung |
| --- | --- |
| Backend startet in Produktion nicht | `JWT_SECRET`, `POSTGRES_PASSWORD`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` und DB-SSL-Policy pruefen. |
| Login wird nach Neustart ungueltig | `JWT_SECRET` muss stabil bleiben. |
| API wird von Browser blockiert | `CORS_ORIGINS` muss exakt zur Browser-Origin passen. Im On-Prem-Proxy-Modus ist Same-Origin bevorzugt. |
| Swagger ist nicht erreichbar | In Strict Mode ist Swagger per Default aus. Nur bewusst mit `SWAGGER_ENABLED=true` aktivieren. |
| 2FA-Login startet nicht | `AUTH_2FA_ENABLED=true` erfordert SMTP, mindestens `SMTP_HOST`; Backend-Logs zeigen die SMTP-Verifikation. |
| Migrationen laufen nicht | `DB_SYNCHRONIZE=false` und `DB_MIGRATIONS_RUN=true` setzen. |
| Rate-Limits treffen alle Nutzer gleichzeitig | `TRUST_PROXY=true` und Forwarded-Header des Reverse Proxy pruefen. |