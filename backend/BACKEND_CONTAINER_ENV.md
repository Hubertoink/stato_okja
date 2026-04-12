# Backend Container – Environment Variables

Dieses Dokument beschreibt die Environment-Variablen, die der Stato-Backend-Container versteht (Pflicht/optional), inkl. typischer Werte für Docker/Compose.

Referenz: [backend/.env.example](../backend/.env.example)

## Quickstart (minimal lauffähig)

Für einen laufenden Backend-Container brauchst du mindestens:

- **DB-Zugangsdaten** (damit TypeORM verbinden kann)
- **JWT_SECRET** (sonst ist Auth unsicher / Tokens brechen bei Neustarts)
- optional: **SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD** (für reproduzierbares Seed-Login)

## Server / HTTP

- `NODE_ENV` (optional)
  - Default: `development`
  - Üblich: `production` im Live-Betrieb

- `APP_ENV` (optional)
  - Default: *(leer)*
  - Empfohlen für Dev-Container: `development`
  - Wird u. a. von den Dev-Tools geprüft. Wenn `NODE_ENV=production` oder `APP_ENV=production` gesetzt ist, bleiben die Testdaten-Tools deaktiviert.

- `PORT` (optional)
  - Default: `3000`
  - Port, auf dem NestJS lauscht.

- `API_PREFIX` (optional)
  - Default: `api`
  - Damit sind Endpoints typischerweise unter `/<API_PREFIX>/...` erreichbar.

- `CORS_ORIGINS` (optional, aber meist nötig)
  - Default: `http://localhost:5173`
  - Komma-separierte Liste erlaubter Origins, z. B. `https://app.example.com,https://admin.example.com`

- `APP_ORIGIN` (optional, aber wichtig für Mails)
  - Default: `http://localhost:5173`
  - Wird genutzt, um Links in Invite-/Reset-E-Mails zu bauen (z. B. `${APP_ORIGIN}/reset-password?...`).

## Branding (Login-Seite / On-Prem)

Diese Variablen sind **optional** und werden vom Backend über `GET /auth/public-config` bereitgestellt. Das Frontend nutzt sie u. a. auf der Login-Seite, um Instanz-/Orga-Branding anzuzeigen.

- `PUBLIC_APP_NAME` (optional)
  - Default: `StatO`
  - Basisname der Anwendung.

- `PUBLIC_ORG_NAME` (optional)
  - Default: *(leer)*
  - Wenn gesetzt, wird der Login-Titel als `${PUBLIC_APP_NAME} - ${PUBLIC_ORG_NAME}` angezeigt (z. B. `StatO - Stadt Mannheim`).

- `PUBLIC_LOGIN_SUBTITLE` (optional)
  - Default: `OKJA Statistik & Dokumentation`
  - Untertitel auf der Login-Seite.

- `PUBLIC_LIVE_REFRESH_INTERVAL_MS` (optional)
  - Default: `15000`
  - Polling-Intervall fuer Dashboard, Aktivitaeten und Statistik in Millisekunden.
  - `0` deaktiviert Polling; Fokus-Refetch bleibt aktiv.

## Datenbank (TypeORM)

- `DB_TYPE` (optional)
  - Default: `postgres`
  - Unterstützt: Postgres (Default) und dev-Varianten von SQLite (siehe Code in `src/config/typeorm.config.ts`).

**Für Postgres (typisch in Docker):**

- `DB_HOST` (optional)
  - Default: `localhost`
  - In Compose meist: `postgres` (Service-Name)

- `DB_PORT` (optional)
  - Default: `5432`

- `DB_USERNAME` (optional)
  - Default: `stato_user`

- `DB_PASSWORD` (optional)
  - Default: `stato_dev_password`

- `DB_DATABASE` (optional)
  - Default: `stato_dev`

- `DB_SYNCHRONIZE` (optional)
  - Default: `false`
  - Vorsicht: In Production i. d. R. `false` lassen.

- `DB_MIGRATIONS_RUN` (optional)
  - Default: automatisch `true` nur bei `NODE_ENV=production`, sonst `false`
  - Empfehlung für Docker-/On-Prem-Umgebungen: explizit `true` setzen, wenn das Schema beim Container-Start per Migration aktualisiert werden soll.
  - Besonders wichtig, wenn `NODE_ENV=development` für Dev-Tools genutzt wird: ohne `DB_MIGRATIONS_RUN=true` laufen Migrationen sonst nicht automatisch.

- `DB_LOGGING` (optional)
  - Default: `true`

- Zeitzonen-Hinweis
  - Der Backend-Container erzwingt fuer Postgres-Verbindungen eine UTC-Session.
  - Grund: aeltere Tabellen koennen `timestamp without time zone` verwenden; mit UTC bleiben JSON-Zeitstempel und Dashboard-Audit-Logs stabil.
  - `TZ=Europe/Berlin` im Container aendert nur die Prozess-/OS-Zeitzone, aber nicht verlaesslich die Zeitsemantik von Postgres-`now()` auf der Datenbankseite.

**SSL (nur wenn DB es erfordert):**

- `DB_SSL` (optional)
  - Werte: `true|false|require|1`

- `DB_SSL_REJECT_UNAUTHORIZED` (optional)
  - Default: `false`
  - Setze auf `true`, wenn du saubere Zertifikate hast.

## Auth / JWT

- `JWT_SECRET` (**Pflicht in Production**)
  - Ohne gesetztes Secret nutzt der Code einen unsicheren Dev-Default.
  - Wichtig: Wenn du `JWT_SECRET` änderst, werden bestehende Tokens ungültig (alle Nutzer müssen sich neu einloggen).

- `JWT_ACCESS_EXPIRATION` (optional)
  - Default: `12h` (Backend)
  - Beispielwerte: `15m`, `1h`, `12h`, `1d`
  - Steuert, wie lange Access-Tokens gültig sind.

- `INVITE_TOKEN_EXPIRATION` (optional)
  - Default: `7d`

- `RESET_TOKEN_EXPIRATION` (optional)
  - Default: `1h`

## Passwort-Reset-Modus (On-Prem relevant)

- `PASSWORD_RESET_MODE` (optional)
  - Werte: `email`, `admin_temp_password`, `hybrid`
  - Default: `email`

Bedeutung:

- `email`
  - Standardverhalten wie bisher
  - Benutzer können „Passwort vergessen?“ nutzen
  - Superadmin stößt Reset-Link per E-Mail an

- `admin_temp_password`
  - Kein Self-Service-Reset per E-Mail
  - Login-Seite blendet „Passwort vergessen?“ aus
  - Superadmin setzt in der Benutzerverwaltung ein temporäres Passwort
  - Der Benutzer wird nach Login auf die Passwortänderung geführt

- `hybrid`
  - Beide Wege sind verfügbar
  - Superadmin kann zwischen Reset-Link und temporärem Passwort wählen

Empfehlung für On-Prem ohne Mailversand:

- `PASSWORD_RESET_MODE=admin_temp_password`

Hinweis: In [backend/.env.example](../backend/.env.example) existiert auch `JWT_REFRESH_EXPIRATION` – aktuell wird im Backend-Code aber kein Refresh-Token-Flow genutzt.

## Seed Superadmin (Startup)

Beim Start stellt das Backend sicher, dass ein `superadmin` existiert.

- `SUPERADMIN_EMAIL` (empfohlen)
  - Default im Code: eine Dev-Mailadresse
  - Wird für das **initiale** Superadmin-Konto genutzt.
  - Optional erzwingen (überschreibt bestehende E-Mail beim Start): `SUPERADMIN_EMAIL_FORCE=true`

- `SUPERADMIN_PASSWORD` (optional, aber empfohlen)
  - Wird für das **initiale** Superadmin-Konto genutzt (wenn noch keines existiert).
  - Wenn nicht gesetzt und noch kein Superadmin existiert, ist das Default-Passwort `admin`.
  - Wichtig: Das Passwort wird **nicht** bei jedem Start überschrieben (damit UI-Passwortänderungen nicht „zurückspringen“).
  - Optional erzwingen (setzt bestehendes Passwort beim Start neu): `SUPERADMIN_PASSWORD_FORCE=true`

## Dev-Tools / Testdaten

Für die Testdaten-Funktion unter `Einstellungen -> Testdaten` muss der Backend-Container in einer Dev-Umgebung laufen.

Empfohlen:

- `NODE_ENV=development`
- `APP_ENV=development`

Wichtig:

- Sobald eine der beiden Variablen auf `production` steht, sind die Dev-Tools im Backend deaktiviert.
- Das betrifft insbesondere die automatische Erzeugung realistischer Projekte und Aktivitäten für Testzwecke.

Weitere Details stehen in [backend/src/dev-tools/README.md](../backend/src/dev-tools/README.md).

## SMTP (Einladungen / Passwort Reset)

- `SMTP_HOST` (optional)
  - Wenn **nicht** gesetzt: Backend sendet keine Mails, sondern loggt die Links (Invite/Reset) in die Konsole.

- `SMTP_PORT` (optional)
  - Default: `587`
  - Für Mailpit lokal oft: `1025`

- `SMTP_USER` / `SMTP_PASS` (optional)
  - Wenn leer: Backend versucht unauthenticated SMTP (z. B. Mailpit).

- `SMTP_FROM` (optional)
  - Default: `no-reply@stato.local`

Hinweis:

- Wenn `PASSWORD_RESET_MODE=admin_temp_password` gesetzt ist, ist SMTP für Passwort-Resets nicht erforderlich.
- SMTP kann dann weiterhin für Einladungen oder andere Mailfunktionen genutzt werden.

## Docker Compose – Beispielwerte

Wenn dein Backend-Container im selben Compose-Netzwerk läuft wie Postgres/Mailpit aus der Repo-Compose:

- `DB_HOST=postgres`
- `DB_PORT=5432`
- `SMTP_HOST=mailpit`
- `SMTP_PORT=1025`

Beispiel (Ausschnitt) für einen Backend-Service:

```yaml
services:
  backend:
    image: <dein-backend-image>
    environment:
      NODE_ENV: development
      APP_ENV: development
      PORT: 3000
      API_PREFIX: api
      CORS_ORIGINS: http://localhost:5173
      APP_ORIGIN: http://localhost:5173

      DB_TYPE: postgres
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USERNAME: stato_user
      DB_PASSWORD: stato_dev_password
      DB_DATABASE: stato_dev

      JWT_SECRET: <setze_einen_langen_random_string>
      JWT_ACCESS_EXPIRATION: 12h

      SMTP_HOST: mailpit
      SMTP_PORT: 1025
      SMTP_FROM: no-reply@stato.local

      SUPERADMIN_EMAIL: admin@example.org
      SUPERADMIN_PASSWORD: admin00
```

## Troubleshooting

- **Login klappt, dann plötzlich 401 nach Neustart**: Prüfe, dass `JWT_SECRET` stabil gesetzt ist (nicht wechselnd).
- **Frontend darf nicht auf API zugreifen (CORS)**: `CORS_ORIGINS` muss die Frontend-Origin enthalten.
- **Einladungen/Reset kommen nicht an**: Setze `SMTP_HOST` (oder nutze Mailpit) und prüfe `APP_ORIGIN` für korrekte Links.
