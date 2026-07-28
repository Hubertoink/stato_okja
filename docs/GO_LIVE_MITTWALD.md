# Go-Live Leitfaden – Mittwald (Docker Deploy)

Dieser Leitfaden beschreibt, wie du StatO komplett bei Mittwald betreibst – inklusive Docker-Deployment, Domain-Zuordnung, E-Mail (SMTP) und persistenter Datenhaltung. Der empfohlene Weg ist der unten beschriebene vollständige Stack mit dem Mittwald-Installer. Die manuelle Proxy-/Container-Konfiguration bleibt als Alternative möglich.

## Zielbild

- Alles bei Mittwald: Postgres, Backend (NestJS), Frontend (Nginx) und Backup
- Empfohlener Stack: öffentliche Domain `https://app.<deinedomain>` auf den Frontend-Service; dieser routet `/api` und `/uploads` intern an das Backend
- Alternative: getrennte Frontend-/API-Domains mit eigener Varnish- oder Proxy-Konfiguration
- E-Mail über Mittwald SMTP

## Empfohlener Weg: Stack per Mittwald-Installer

Der bereitgestellte Stack enthält PostgreSQL, Backend, Frontend und den
Backup-Service. Dadurch müssen die Container im mStudio nicht einzeln
konfiguriert werden. Der Installer erzeugt beim ersten Lauf individuelle,
persistente DB- und JWT-Secrets; bei späteren Updates werden diese nicht
überschrieben.

Voraussetzungen auf dem eigenen Rechner:

1. Die Mittwald-CLI `mw` ist installiert.
2. Ein mStudio-API-Token wurde einmalig mit `mw login token` hinterlegt.
3. Im Zielprojekt existiert ein Stack; dessen ID liefert `mw stack ls`.

Zuerst die Konfiguration ohne API-Aufruf vorbereiten:

```powershell
git clone https://github.com/Hubertoink/stato_okja.git
cd stato_okja
.\scripts\install-mittwald.ps1 -StackId <STACK-ID> -AppOrigin https://app.example.org -AdminEmail admin@example.org -PrepareOnly
```

Danach mit denselben Parametern deployen:

```powershell
.\scripts\install-mittwald.ps1 -StackId <STACK-ID> -AppOrigin https://app.example.org -AdminEmail admin@example.org
```

Im mStudio wird anschließend die Domain einmalig dem Service `frontend` auf
Port `8080` zugeordnet. Der Frontend-Container leitet `/api` und `/uploads`
intern an das Backend weiter; eine separate öffentliche API-Domain ist dafür
nicht nötig.

Für ein Update `STATO_IMAGE_TAG` in der lokalen Installer-Konfiguration auf
den gewünschten Release-Tag setzen und den Installer erneut ausführen. Der
vollständige Referenzablauf einschließlich One-Liner-Variante steht in
[`DEPLOY_MITTWALD.md`](../DEPLOY_MITTWALD.md).

Der Stack enthält außerdem den Service `backup`. Im mStudio einen
Container-Cronjob auf `backup` mit dem Befehl
`/usr/local/bin/stato-container-backup` einrichten, beispielsweise täglich um
03:00 Uhr. Das Volume `backup-data` zusätzlich über Mittwald-Volume- bzw.
Projektbackups oder einen separaten Export sichern.

## 1) Vorbereitung

Dieser Abschnitt gehört zur manuellen Alternative. Beim Installer sind die
benötigten Stack-Dateien bereits hinterlegt.

- Repository: aktueller Stand auf `main` ist produktionsbereit
- Stelle sicher, dass folgende Dateien passen:
  - `docker-compose.prod.yml` (liefert Postgres, Backend, Frontend)
  - `backend/.env.production.example` (ENV-Beispiele für PROD)
  - `frontend/nginx.conf` (leitet `/api` und `/uploads` auf Backend)

## 2) DNS & TLS

Beim empfohlenen Installer-Stack wird `app.<deinedomain>` im mStudio dem
Service `frontend` auf Port `8080` zugeordnet; TLS wird dort für die Domain
aktiviert. Die folgenden Hinweise gelten für die manuelle Proxy-Alternative.

- Lege `app.<deinedomain>` (und optional `api.<deinedomain>`, `uploads.<deinedomain>`) im Mittwald DNS an
- Aktiviere TLS/SSL-Zertifikate für die Domain(s) über Mittwald

Empfehlung – Single-Domain Setup:
- `app.<deinedomain>` zeigt auf Varnish/Proxy bei Mittwald
- Routen (siehe Abschnitt Proxy) bedienen Frontend+Backend unter derselben Domain

## 3) ENV-Variablen (wichtig!)

Beim Installer-Stack werden die grundlegenden Werte und individuellen Secrets
in dessen persistenter lokaler Konfiguration verwaltet. Die folgenden
Variablen werden nur für die manuelle Alternative direkt in Mittwald gesetzt.

Setze in Mittwald (Projekt-Umgebung oder Deployment-Variablen):

- App/Links
  - `APP_ORIGIN=https://app.<deinedomain>`
  - `CORS_ORIGINS=https://app.<deinedomain>`
- Sicherheit
  - `JWT_SECRET=<langer_random_string_mit_mindestens_32_zeichen>`
- Datenbank (nur wenn du NICHT die Compose-Postgres nutzt)
  - `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`
  - `DB_SYNCHRONIZE=false`, `DB_LOGGING=false`
  - Externe DB mit TLS: `DB_SSL=true`, `DB_SSL_REJECT_UNAUTHORIZED=true`
  - Vertraute Nicht-SSL-DB: `DB_REQUIRE_SSL=false`, `DB_SSL=false`
- SMTP (Mittwald)
  - `SMTP_HOST`, `SMTP_PORT=587` (oder `465` bei SSL), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM=noreply@<deinedomain>`
- Seed-Admin
  - `SUPERADMIN_EMAIL=<dein_admin_login>` (Start-Passwort ist `admin`, direkt nach Login ändern)

Hinweis: Wenn du die Postgres-DB aus dem Compose nutzt, brauchst du DB_* meist nicht setzen (Compose-Defaults greifen).

Wichtig:
- `JWT_SECRET` ist in Produktion Pflicht. Fehlende oder kurze Werte verhindern den Backend-Start absichtlich.
- Einen geeigneten Wert kannst du z. B. mit `openssl rand -base64 48` erzeugen.
- Fuer Postgres gilt standardmaessig: Externe Hosts sollen TLS nutzen. Wenn eure DB bewusst intern und ohne TLS betrieben wird, muss das explizit mit `DB_REQUIRE_SSL=false` freigegeben werden.

## 4) Manuelles Docker-Deploy (Compose, Alternative)

Für neue Installationen den Installer im Abschnitt „Empfohlener Weg“ verwenden.
Dieser Abschnitt ist für bestehende oder bewusst manuell konfigurierte
Deployments gedacht.

- Nutze `docker-compose.prod.yml` als Basis. Es enthält folgende Services:
  - `postgres`: Postgres 16
  - `backend`: NestJS API, liest ENV, exponiert Port 3000 intern
  - `frontend`: Nginx, exponiert Port 80 intern und proxyt `/api` auf `backend:3000`
- Volumes:
  - `postgres-data`: persistente DB-Daten
  - `backend-uploads`: persistente Uploads (`/app/uploads`)

Bei Mittwald:
- Lege die Compose-Datei im Deploy-Bereich an (oder CI/CD), wähle produktiven Stack/Projekt
- Hinterlege ENV (siehe 3)
- Starte das Deployment

## 5) Manuelle Proxy-/Routing-Konfiguration (Varnish/Nginx)

Single-Domain (empfohlen für Einfachheit):
- Domain: `app.<deinedomain>` → Varnish → interner Nginx (oder direkt auf Frontend-Container)
- Routes:
  - `/api` → `backend:3000/api`
  - `/` → `frontend:80` (SPA)
- Caching-Hinweis:
  - `/api`: nicht cachen (Authorization, dynamische Inhalte)

Multi-Domain (optional, sauber getrennt):
- `app.<deinedomain>` → Frontend
- `api.<deinedomain>` → Backend
- Passe `frontend/nginx.conf` an, damit `/api` auf `https://api.<deinedomain>/api/` proxyt
- `APP_ORIGIN` immer auf die Frontend-URL setzen

## 6) Erstinbetriebnahme

- Nach dem ersten Start meldest du dich mit dem Seed-Admin an:
  - E-Mail: `SUPERADMIN_EMAIL` (oder Default `Hubertoink@outlook.com`)
  - Passwort: `admin`
- Unbedingt sofort Passwort ändern (Profil → Passwort) oder den Reset-Flow nutzen
- SMTP prüfen: Sende eine Einladung/Passwort-Reset (Postfach/Spam kontrollieren)

## 7) Backups & Updates

- Backups:
  - Wenn Postgres als Compose-Service laeuft: den Service `backup` per Mittwald Container-Cronjob ausfuehren lassen. Befehl: `/usr/local/bin/stato-container-backup`.
  - Der Backup-Container erstellt einen Postgres-Custom-Dump, sichert das Upload-Volume und schreibt nach `/backups` im Volume `backup-data`.
  - `backup-data` zusaetzlich ueber Mittwald-Projektbackups/Volume-Backups oder einen separaten Export absichern.
  - Wenn Mittwald Managed PostgreSQL genutzt wird: DB-Backup ueber Mittwald/Managed-DB-Backup oder separaten `pg_dump` gegen den Managed-DB-Host einrichten; Upload-Volume separat sichern.
  - In der Superadmin-Datenverwaltung gibt es zusaetzlich den fachlichen ZIP-Export/Restore und eine Betriebsbackup-Kachel mit Kopiervorlagen.
  - Details: `docs/security/BACKUP_RESTORE_RUNBOOK_2026-05-02.md`
- Updates/Deployments:
  - Neue Versionen auf `main` pushen → Mittwald-Deploy-Job neu anstoßen
  - Zero-Downtime je nach Mittwald-Rollout-Strategie (Rolling/Blue-Green)

## 8) Troubleshooting

- 403/401 bei API:
  - CORS_ORIGINS stimmt nicht mit `APP_ORIGIN` überein → anpassen
- Einladungs-/Reset-Links falsch:
  - `APP_ORIGIN` falsch → auf öffentliche Frontend-URL setzen
- Mails kommen nicht an:
  - SMTP_* prüfen; SPF/DKIM/DMARC für Absenderdomain bei Mittwald setzen
- 404 bei direktem Reload im Frontend:
  - SPA muss `index.html` serven (in `frontend/nginx.conf` via `try_files` korrekt)
- Geschuetzte Bilder laden nicht:
  - Pruefen, ob der Benutzer eingeloggt ist und das Frontend gegen die richtige API-Domain laeuft
  - Backend-Volume `backend-uploads` vorhanden
  - Keine alte Proxy-Regel fuer eine oeffentliche `/uploads`-Auslieferung erzwingen
- DB verbindet nicht:
  - Fehler `The server does not support SSL connections`: `DB_SSL=false` setzen und, falls der Host trotzdem als extern gilt, zusaetzlich `DB_REQUIRE_SSL=false`
  - Fehler `DB_SSL ... muss aktiviert sein`: DB bietet TLS an, aber `DB_SSL=true` und `DB_SSL_REJECT_UNAUTHORIZED=true` fehlen

## 9) Sicherheitstipps

- `JWT_SECRET` nicht im Repo; nur via ENV setzen
- `SUPERADMIN_EMAIL` auf produktives Postfach setzen
- Zugang zum Mittwald-Deploy absichern (2FA, Deployment-Keys)
- DB extern nicht öffentlich exposen (nur intern vernetzen)

---

Bei Bedarf erstelle ich dir eine Domain-spezifische Beispiel-ENV (`.env.production`) und optional eine Varnish-Konfigurationsskizze (Routen/Caching) passend zu deiner Domainstruktur.
