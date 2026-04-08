# Go-Live Leitfaden – Mittwald (Docker Deploy + Varnish)

Dieser Leitfaden beschreibt, wie du Stato 2.0 komplett bei Mittwald betreibst – inklusive Docker Deploy, Reverse-Proxy (Varnish/Nginx), E-Mail (SMTP) und persistenter Datenhaltung.

## Zielbild

- Alles bei Mittwald: Postgres, Backend (NestJS), Frontend (Nginx)
- Öffentliche Domain: `https://app.<deinedomain>` (einfach) oder `https://app.<...>` + `https://api.<...>` (getrennt)
- Varnish/Proxy routet: `/` → Frontend, `/api` → Backend
- E-Mail über Mittwald SMTP

## 1) Vorbereitung

- Repository: aktueller Stand auf `main` ist produktionsbereit
- Stelle sicher, dass folgende Dateien passen:
  - `docker-compose.prod.yml` (liefert Postgres, Backend, Frontend)
  - `backend/.env.production.example` (ENV-Beispiele für PROD)
  - `frontend/nginx.conf` (leitet `/api` und `/uploads` auf Backend)

## 2) DNS & TLS

- Lege `app.<deinedomain>` (und optional `api.<deinedomain>`, `uploads.<deinedomain>`) im Mittwald DNS an
- Aktiviere TLS/SSL-Zertifikate für die Domain(s) über Mittwald

Empfehlung – Single-Domain Setup:
- `app.<deinedomain>` zeigt auf Varnish/Proxy bei Mittwald
- Routen (siehe Abschnitt Proxy) bedienen Frontend+Backend unter derselben Domain

## 3) ENV-Variablen (wichtig!)

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

## 4) Docker Deploy (Compose)

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

## 5) Proxy-/Routing-Konfiguration (Varnish/Nginx)

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
  - Volume `postgres-data` regelmäßig sichern (DB)
  - Volume `backend-uploads` sichern (Datei-Uploads)
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
