# Backend Container Environment

Diese Referenz beschreibt die Environment-Variablen, die der StatO-Backend-Container zur Laufzeit liest. Sie ist die zentrale Quelle fuer Docker/Compose-Setups; konkrete Beispielwerte stehen in [deploy/onprem/stato.env.example](../deploy/onprem/stato.env.example) und [env.production.example](../env.production.example).

Wichtig: echte Werte gehoeren in lokale `.env*`-Dateien oder Secret Stores. Sie sollten nie in Git landen. Die vorhandene [.gitignore](../.gitignore) ignoriert `.env*`-Dateien und laesst nur die Example-Dateien zu.

## Betriebsarten

| Modus | Typische Dateien | Beschreibung |
| --- | --- | --- |
| On-Prem / Local | [deploy/onprem/compose.yaml](../deploy/onprem/compose.yaml), [deploy/onprem/stato.env.example](../deploy/onprem/stato.env.example) | Frontend, Backend und Postgres laufen gemeinsam. Das Frontend ist der oeffentliche Einstiegspunkt und proxyt `/api/*` intern an das Backend. |
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

Der produktive Erststart einer leeren Datenbank ist streng: `SUPERADMIN_EMAIL` darf kein Platzhalter sein und `SUPERADMIN_PASSWORD` muss mindestens 12 Zeichen mit Grossbuchstaben, Kleinbuchstaben, Zahl und Sonderzeichen enthalten. On-Prem kann alternativ `INITIAL_SETUP_ENABLED=true` setzen: Dann wird das Passwort einmalig beim ersten Browser-Aufruf vergeben und nicht als Klartext-ENV gespeichert.

## GitHub Schnellreferenz

Die folgende Tabelle ist als praktische Referenz fuer GitHub Deployments gedacht, z. B. fuer Repository Variables, Environment Variables oder Secrets in GitHub Actions. Best Practice: alles mit Zugangsdaten, Tokens oder Passwoertern als Secret pflegen; reine Konfigurationswerte als Variable.

| Variable | GitHub-Empfehlung | Erwartete Werte / Format | Beschreibung |
| --- | --- | --- | --- |
| `TZ` | Variable | z. B. `Europe/Berlin`, `UTC` | Zeitzone des Backend-Containers. Beeinflusst Logs und prozessnahe Zeitdarstellung; fuer deutsche Installationen meist `Europe/Berlin`. |
| `DB_MIGRATIONS_RUN` | Variable | `true` oder `false` | Steuert, ob das Backend beim Start TypeORM-Migrationen automatisch ausfuehrt. Fuer reproduzierbare Deployments in Produktion normalerweise `true`. |
| `PASSWORD_RESET_MODE` | Variable | `email`, `admin_temp_password` oder `hybrid` | Legt fest, wie Passwort-Resets funktionieren: per E-Mail, nur ueber temporaeres Admin-Passwort oder hybrid. |
| `USER_PROVISIONING_MODE` | Variable | `email` (empfohlen) oder `local` | Steuert die Anlage neuer Benutzer: E-Mail-Einladung via SMTP oder lokale Anlage mit temporärem Passwort. |
| `VITE_ENABLE_DEV_TOOLS` | Variable | `true` oder `false` | Frontend-Build-Flag, nicht vom Backend gelesen. Aktiviert nur das Dev-Tools-Menue im Frontend und sollte in Produktion normalerweise `false` sein. |
| `APP_ENV` | Variable | typischerweise `development`, `staging` oder `production` | App-spezifischer Modus. `production` deaktiviert Dev- und Seed-Funktionen auch dann, wenn `NODE_ENV` abweichend gesetzt ist. |
| `NODE_ENV` | Variable | typischerweise `development`, `test` oder `production` | Standard-Node-Runtime-Modus. `production` aktiviert produktionsnahe Defaults und strengere Sicherheitspruefungen. |
| `PUBLIC_ORG_NAME` | Variable | Freitext, z. B. `Stadt Musterstadt` | Optionaler Organisationsname fuer Branding auf Login-Seite und Public Config. Kein Secret. |
| `SUPERADMIN_EMAIL` | Variable | gueltige E-Mail-Adresse, z. B. `admin@example.org` | E-Mail-Adresse fuer den initialen Superadmin beim Erststart. Sollte bewusst gesetzt sein, ist aber typischerweise kein Secret. |
| `AUTH_2FA_ENABLED` | Variable | `true` oder `false` | Aktiviert E-Mail-basierte Zwei-Faktor-Anmeldung. Nur sinnvoll, wenn SMTP korrekt konfiguriert ist. |
| `AUTH_2FA_CODE_TTL` | Variable | Ganzzahl in Sekunden, z. B. `600` | Gueltigkeit des 2FA-Codes in Sekunden. Bestimmt, wie lange ein zugesandter Code genutzt werden kann. |
| `DB_PASSWORD` | Secret | starkes Passwort als Freitextwert | Passwort der Datenbankverbindung des Backends. Muss geheim bleiben und sollte nie als normale Variable gepflegt werden. |
| `JWT_SECRET` | Secret | langer zufaelliger String, mindestens 32 Zeichen | Zentrales Signatur-Secret fuer Auth-Tokens. Muss lang, zufaellig und stabil sein; Aenderungen machen bestehende Logins ungueltig. |
| `DB_HOST` | Variable | Hostname oder DNS-Name, z. B. `postgres`, `db.example.com` | Hostname der Datenbank. In Docker Compose oft `postgres`, bei externer DB z. B. ein DNS-Name oder Hostname. |
| `PORT` | Variable | Portnummer, meist `3000` | Interner Port, auf dem das NestJS-Backend lauscht. Meist `3000`, oft nur intern relevant. |
| `DB_PORT` | Variable | Portnummer, meist `5432` | TCP-Port der Datenbank, bei Postgres standardmaessig `5432`. |
| `DB_DATABASE` | Variable | Datenbankname, z. B. `stato_prod` | Name der Datenbank, mit der sich das Backend verbindet. |
| `DB_USERNAME` | Variable | Benutzername, z. B. `stato_user` | Benutzername fuer die Datenbankverbindung des Backends. Kann als Variable gepflegt werden; nur das Passwort gehoert ins Secret. |
| `DB_SYNCHRONIZE` | Variable | `true` oder `false` | Aktiviert TypeORM-Schema-Sync. Fuer Produktion Best Practice: `false`, damit stattdessen Migrationen genutzt werden. |
| `DB_LOGGING` | Variable | `true` oder `false` | Schaltet SQL-Logging ein oder aus. In Produktion meist `false`, um Logs schlank und datensparsam zu halten. |
| `API_PREFIX` | Variable | Pfadsegment ohne fuehrenden Slash, meist `api` | Globaler API-Prefix des Backends, typischerweise `api`, wodurch Endpoints unter `/api/...` erreichbar sind. |
| `CORS_ORIGINS` | Variable | eine oder mehrere Origins, komma-separiert, z. B. `https://app.example.com` | Erlaubte Browser-Origins fuer CORS. Muss zur oeffentlichen Frontend-URL passen, sonst blockiert der Browser Requests. |
| `APP_ORIGIN` | Variable | vollstaendige URL, z. B. `https://app.example.com` | Oeffentliche URL des Frontends. Wird fuer Links in Einladungen, Passwort-Resets und 2FA-Mails genutzt. |
| `SMTP_HOST` | Variable | Hostname, z. B. `smtp.example.com`; optional leer | Hostname des SMTP-Servers. Wenn leer, versendet das Backend keine E-Mails. Im Strict-Security-Mode werden Invite-/Reset-Links dann nicht geloggt, sondern der Vorgang schlaegt fehl. |
| `SMTP_PORT` | Variable | Portnummer, meist `587` oder `465` | Port des SMTP-Servers, meist `587` oder `465` je nach Setup. |
| `SMTP_USER` | Variable oder Secret | Benutzername oder Mailadresse, z. B. `mailer@example.com` | SMTP-Benutzername. Wenn er intern sensibel ist, als Secret pflegen; technisch reicht oft auch eine Variable. |
| `SMTP_PASS` | Secret | SMTP-Passwort als Freitextwert | Passwort fuer den SMTP-Zugang. Muss immer als Secret gepflegt werden. |
| `SMTP_FROM` | Variable | gueltige Absenderadresse, z. B. `no-reply@example.com` | Absenderadresse fuer Invite-, Reset- und ggf. 2FA-Mails. Kein Secret, aber funktional wichtig fuer Mail-Zustellung. |

Hinweis zu GitHub: `JWT_SECRET`, `DB_PASSWORD` und `SMTP_PASS` sollten immer Secrets sein. Reine Konfiguration wie `APP_ORIGIN`, `NODE_ENV` oder `DB_PORT` gehoert in Variables. Mischfaelle wie `SMTP_USER` haengen von eurem Sicherheitsmodell ab, sind aber haeufig noch als Variable vertretbar.

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
| `DB_BOOTSTRAP_ON_EMPTY` | `true` in Produktion/Staging | Erstellt bei einer wirklich leeren Postgres-DB einmalig das Basisschema und fuehrt danach Migrationen aus. Bei einer unvollstaendigen DB wird aus Sicherheitsgruenden abgebrochen. |
| `DB_LOGGING` | `false` | SQL-Logging. In Produktion normalerweise `false`. |
| `DB_REQUIRE_SSL` | `true` fuer externe DBs im Strict Mode, sonst abhaengig vom Host | Erzwingt TLS fuer externe Postgres-Verbindungen. Fuer den lokalen Compose-Service `postgres` normalerweise `false`. |
| `DB_SSL` | `false` | Aktiviert TLS zur Datenbank (`true`, `1` oder `require`). |
| `DB_SSL_REJECT_UNAUTHORIZED` | `false` | Zertifikatspruefung. Fuer externe Produktionsdatenbanken mit korrekten Zertifikaten `true`. |

Hinweis: Postgres-Sessions werden vom Backend auf UTC gesetzt. `TZ=Europe/Berlin` ist trotzdem sinnvoll fuer Prozesslogs und zeitbezogene Auswertungen, aendert aber nicht die DB-Session-Zeitzone.

## Auth, JWT und Passwoerter

| Variable | Default | Beschreibung |
| --- | --- | --- |
| `JWT_SECRET` | unsicherer Dev-Fallback | Pflicht in Strict Mode. Mindestens 32 Zeichen, zufaellig, stabil. Eine Aenderung invalidiert bestehende Logins. |
| `JWT_ACCESS_EXPIRATION` | `15m` | Gueltigkeit von Access Tokens, z. B. `15m`, `1h`, `12h`. |
| `JWT_REFRESH_EXPIRATION` | `7d` | Gueltigkeit der serverseitigen Refresh Session, z. B. `12h`, `7d`, `30d`. |
| `AUTH_REFRESH_COOKIE_SAMESITE` | `lax` | SameSite-Policy fuer das HttpOnly-Refresh-Cookie: `lax`, `strict` oder `none`. |
| `AUTH_REFRESH_COOKIE_SECURE` | abgeleitet aus Strict Mode | Optionaler Override fuer das Secure-Flag des Refresh-Cookies. In Produktion normalerweise `true`. |
| `INVITE_TOKEN_EXPIRATION` | `24h` | Gueltigkeit von Einladungslinks (maximal 24 Stunden). |
| `RESET_TOKEN_EXPIRATION` | `1h` | Gueltigkeit von Passwort-Reset-Links. |
| `PASSWORD_RESET_MODE` | `email` | `email`, `admin_temp_password` oder `hybrid`. |
| `USER_PROVISIONING_MODE` | `email` | `email` nutzt SMTP-Einladungen und ist der empfohlene Modus. `local` aktiviert die lokale Benutzeranlage; das gesetzte temporäre Passwort muss beim ersten Login geändert werden. |
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
| `INITIAL_SETUP_ENABLED` | `false` | Erlaubt bei leerer Datenbank einmalig die Passwortvergabe im Browser; nach Anlage eines Superadmins ist der Endpunkt geschlossen. |

Fuer normalen Betrieb bleiben beide Force-Flags `false`. Sie sind nur fuer bewusste Admin-Resets gedacht.

## SMTP und E-Mail

| Variable | Default | Beschreibung |
| --- | --- | --- |
| `SMTP_HOST` | leer | SMTP-Host. Wenn leer, werden Mails nicht versendet. Invite-/Reset-Links werden nur ausserhalb von Strict-Security-Mode geloggt. |
| `SMTP_PORT` | `587` | SMTP-Port. `465` wird als secure SMTP behandelt. |
| `SMTP_USER` | leer | SMTP-Benutzer. Wenn leer, versucht das Backend unauthentifiziertes SMTP. |
| `SMTP_PASS` | leer | SMTP-Passwort. |
| `SMTP_FROM` | `no-reply@stato.local` | Absenderadresse. |

Wenn `AUTH_2FA_ENABLED=true` gesetzt ist, wird SMTP beim Backend-Start verifiziert. Schlaegt die Verbindung fehl, startet das Backend nicht. Fuer Passwort-Reset ohne SMTP ist `PASSWORD_RESET_MODE=admin_temp_password` der passende On-Prem-Modus. In Produktion/Staging oder bei `STRICT_SECURITY_MODE=true` werden Invite-/Reset-Links ohne SMTP nicht in Logs ausgegeben.

Fuer vollständig interne On-Prem-Installationen ohne SMTP kann zusätzlich
`USER_PROVISIONING_MODE=local` gesetzt werden. Dann erscheint in der
Benutzerverwaltung sowie beim Anlegen einer Organisation die lokale
Benutzeranlage mit einem temporären Passwort. Dieser Modus ist bewusst nicht
der Standard; die Passwortübergabe muss sicher außerhalb von StatO erfolgen.

## Branding und Public Config

Diese Werte liefert das Backend ueber `GET /auth/public-config` an das Frontend.

| Variable | Default | Beschreibung |
| --- | --- | --- |
| `PUBLIC_APP_NAME` | `StatO` | Anzeigename der App. |
| `PUBLIC_ORG_NAME` | leer | Optionaler Organisationsname auf der Login-Seite. |
| `PUBLIC_LOGIN_SUBTITLE` | `OKJA Statistik & Dokumentation` | Untertitel auf der Login-Seite. |
| `PUBLIC_LIVE_REFRESH_INTERVAL_MS` | `30000` | Polling fuer Dashboard, Aktivitaeten und Statistik. `0` deaktiviert Polling, Fokus-Refetch bleibt aktiv. |
| `STATS_OVERVIEW_CACHE_TTL_MS` | `0` | Cache-Dauer fuer zusammengefasste Statistikabfragen; standardmaessig deaktiviert, damit Aktivitaetsaenderungen sofort sichtbar sind. |

## Rate Limiting

| Variable | Default | Beschreibung |
| --- | --- | --- |
| `RATE_LIMIT_TTL` | `60` | Globales Rate-Limit-Zeitfenster in Sekunden. |
| `RATE_LIMIT_MAX` | `100` | Globale maximale Requests je Client-IP und Zeitfenster. |
| `AUTH_RATE_LIMIT_TTL` | `60` | Strengeres Auth-Zeitfenster in Sekunden. |
| `AUTH_RATE_LIMIT_MAX` | `10` | Maximale Requests fuer Login, Invite und Passwort-Reset je Client-IP und Auth-Zeitfenster. |
| `LOGIN_MAX_FAILED_ATTEMPTS` | `5` | Anzahl falscher Passworteingaben, bevor das Benutzerkonto gesperrt wird. |
| `LOGIN_LOCKOUT_MINUTES` | `10` | Dauer der Benutzersperre nach zu vielen falschen Passworteingaben in Minuten. |

Wenn alle Nutzer nur als Proxy-IP erscheinen, ist meist `TRUST_PROXY` falsch gesetzt oder der vorgelagerte Proxy uebergibt keine Forwarded-Header.

## Feature Flags und Dev-/Seed-Tools

| Variable | Default | Beschreibung |
| --- | --- | --- |
| `ENABLE_ORG_MOVE` | `false` | Aktiviert Organisationsverschiebungen im Backend. Das Frontend braucht denselben Wert als Build-Argument `VITE_ENABLE_ORG_MOVE`. |
| `ENABLE_PROCESSES` | `true` | Globaler Laufzeitschalter fuer ProzessO. Bei `false` bleibt die Organisationsfreigabe unveraendert gespeichert, ProzessO und seine API sind jedoch fuer alle Organisationen deaktiviert. |
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
