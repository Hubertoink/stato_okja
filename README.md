# Stato 2.0 - OKJA Statistik-System

Statistik- und Dokumentationssystem für offene Kinder- und Jugendarbeit (OKJA).

## 🎯 Projektziele

- **Zielgruppe:** OKJA-Teams, Leitung, Träger
- **Mehrbenutzer-Betrieb** mit klaren Rollen
- **Datenschutz-konform**, offline-tolerant
- Wissenschaftliche Kategorisierung nach Landesjugendamt-Standard

## 🚀 Quick Start

## 🧭 Betriebsarten (Hosted vs. On‑Prem)

StatO kann grundsätzlich auf zwei Arten genutzt werden:

- **Hosted (von uns betrieben):** Frontend unter `https://app.stato-okja.de` (Dev: `https://devapp.stato-okja.de`) spricht mit dem Backend unter `https://api.stato-okja.de/api` (Dev: `https://devapi.stato-okja.de/api`).
- **On‑Prem / Local (selbst betrieben):** Betrieb im eigenen Netz/auf eigener Infrastruktur via Docker Compose.
	- Anleitung: [docs/LOCAL_SETUP_ONPREM.md](docs/LOCAL_SETUP_ONPREM.md)
	- Schritt-für-Schritt Docker-Anleitung: [docs/DOCKER_ONPREM_SETUP.md](docs/DOCKER_ONPREM_SETUP.md)
	- Dateien: [docker-compose.onprem.yml](docker-compose.onprem.yml) + [.env.onprem.example](.env.onprem.example)
	- Vollständige Beschreibung der Backend-Container-Variablen: [backend/BACKEND_CONTAINER_ENV.md](backend/BACKEND_CONTAINER_ENV.md)

### Voraussetzungen
- Node.js 20+
- Docker & Docker Compose
- npm oder pnpm

### Lokale Entwicklung starten

```bash
# Repository klonen und Dependencies installieren
npm install

# Docker Services starten (PostgreSQL, MinIO)
docker-compose up -d

# Backend starten
cd backend
npm install
npm run migration:run
npm run start:dev

# Frontend starten (neues Terminal)
cd frontend
npm install
npm run dev
```

Die Anwendung ist dann erreichbar unter:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- MinIO Console: http://localhost:9001

## 📁 Projektstruktur

```
stato-2.0/
├── backend/          # NestJS Backend API
│   ├── src/
│   │   ├── auth/
│   │   ├── activities/
│   │   ├── taxonomy/
│   │   ├── staff/
│   │   ├── locations/
│   │   ├── stats/
│   │   └── common/
│   └── test/
├── frontend/         # React + Vite Frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── stores/
│   │   ├── hooks/
│   │   └── styles/
│   └── public/
├── docker-compose.yml
└── docs/
```

## 🎨 Design-System

### Farbpalette
- **Viridian** `#6b9080` - Primäre Aktionen, Buttons
- **Cambridge Blue** `#a4c3b2` - Navigation, Sekundär
- **Mint Green** `#cce3de` - Neutrale Tags, Status
- **Azure Web** `#eaf4f4` - Hintergründe, Cards
- **Mint Cream** `#f6fff8` - Haupthintergrund

## 👥 Rollen & Berechtigungen

- **Admin:** Vollzugriff, Konfiguration
- **Leitung:** Vollzugriff auf Aktivitäten/Statistiken
- **Mitarbeitende:** CRUD für eigene Aktivitäten
- **Ehrenamtliche:** Eingeschränkte Erfassung
- **Analyst:** Nur Lesen & Exporte

## 📊 Funktionsumfang

### Tätigkeiten
- Offene Tür/Bereich
- Angebote/Projekte (offen/geschlossen)
- Veranstaltungen
- Aufsuchende Arbeit

### Erfassung
- Datum/Zeit, Dauer, Standort
- Teilnehmende nach Geschlecht (m/w/divers)
- Alterskohorten (frei definierbar)
- Kategorien (Landesjugendamt-Standard)
- Tags mit Synonymen
- Mitarbeitende-Zuordnung
- Notizen, Anhänge

### Statistik
- KPI-Dashboards
- Zeitreihen-Analysen
- Verteilungen (Kategorien, Tags, Kohorten)
- Standort-/Raum-Analysen
- CSV/PDF Export

## 🛠️ Technologie-Stack

### Backend
- **Framework:** NestJS + TypeScript
- **Datenbank:** PostgreSQL (Produktion), SQLite (Dev)
- **ORM:** TypeORM
- **Auth:** JWT (Access + Refresh Token)
- **Storage:** MinIO (S3-kompatibel)

### Frontend
- **Framework:** React 18 + TypeScript
- **Build:** Vite
- **State:** Zustand + React Query
- **Routing:** React Router v6
- **UI:** Custom Components + Tailwind CSS
- **PWA:** Offline-Support via Service Worker

## 📝 API-Endpunkte (Übersicht)

### Auth
- `POST /auth/login` - Login
- `POST /auth/refresh` - Token erneuern

### Activities
- `GET /activities` - Liste mit Filtern
- `POST /activities` - Neue Aktivität
- `PATCH /activities/:id` - Bearbeiten
- `DELETE /activities/:id` - Löschen

### Taxonomy
- `GET/POST/PATCH/DELETE /categories`
- `GET/POST/PATCH/DELETE /tags`
- `GET/POST/PATCH/DELETE /cohorts`

### Stats
- `GET /stats/summary` - KPI-Übersicht
- `GET /stats/by-category` - Verteilung nach Kategorien
- `GET /stats/by-cohort` - Alterskohorten-Analyse
- `GET /export/csv` - Daten-Export

## 🔒 Datenschutz & Sicherheit

- Keine personenbezogenen Daten von Teilnehmenden
- Nur aggregierte Zählungen
- HTTPS-Pflicht in Produktion
- Rollen-basierte Zugriffskontrolle
- Audit-Logs für Änderungen
- Rate Limiting auf Auth-Endpoints

## 🧪 Testing

```bash
# Unit Tests
npm run test

# Coverage Report
npm run test:cov
```

## 📦 Deployment

```bash
# Production Build
docker-compose -f docker-compose.prod.yml up -d

# Migrations ausführen
npm run migration:run
```

Wichtige Betriebsvariablen:

- `TRUST_PROXY=true`
	- Für Hosted-Betrieb hinter Mittwald oder einem Reverse Proxy empfohlen.
	- Sorgt dafür, dass Sicherheitsfunktionen wie Rate-Limits mit der echten Client-IP statt nur mit der Proxy-IP arbeiten.
- `RATE_LIMIT_TTL=60`
- `RATE_LIMIT_MAX=100`
- `AUTH_RATE_LIMIT_TTL=60`
- `AUTH_RATE_LIMIT_MAX=10`
	- Empfohlene Hosted-Standardwerte für globales Backend-Rate-Limiting und strengere Limits auf Login-, Invite- und Passwort-Reset-Endpunkten.
- `AUTH_2FA_ENABLED=false`
- `AUTH_2FA_CODE_TTL=600`
	- Optionale E-Mail-Zwei-Faktor-Authentifizierung für den Login.
	- Standard ist bewusst `false`, weil dafür eine funktionierende SMTP-Konfiguration erforderlich ist.
	- Wichtig: `APP_ORIGIN` muss auf die echte Frontend-URL zeigen, weil die 2FA-E-Mail einen Direktlink zurück zur Login-Seite enthält, der den Code im gleichen Browser automatisch eintragen kann.
- `ENABLE_ORG_MOVE=false`
	- Standardwert: Organisationsverschiebung ist komplett deaktiviert.
	- Nur wenn der Wert bewusst auf `true` gesetzt wird, werden die Move-Endpunkte im Backend freigeschaltet und der Verschieben-Button im Frontend-Build angezeigt.
	- Für Docker/On-Prem muss der Frontend-Container nach einer Änderung neu gebaut werden, da das Frontend den Schalter als Build-Variable nutzt.
- `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`
	- Für den allerersten produktiven oder staging Erststart mit leerer Datenbank muss `SUPERADMIN_EMAIL` explizit gesetzt sein und darf kein Platzhalter wie `admin@example.org` sein.
	- `SUPERADMIN_PASSWORD` muss für diesen Bootstrap-Fall mindestens 12 Zeichen sowie Großbuchstaben, Kleinbuchstaben, Zahl und Sonderzeichen enthalten.
	- Ein 8-stelliges Passwort mit Sonderzeichen reicht für diesen Bootstrap-Fall also nicht mehr.
	- Bestehende Instanzen bleiben davon unberührt, solange bereits ein Superadmin existiert und `SUPERADMIN_PASSWORD_FORCE=false` bleibt.

Hinweis zu Migrationen:

- Für automatische Migrationen beim Backend-Start gilt: `DB_MIGRATIONS_RUN=true`
- Gleichzeitig muss `DB_SYNCHRONIZE=false` gesetzt sein, sonst werden Migrationen absichtlich übersprungen.
- Auch bei frischen Docker-/Bootstrap-Datenbanken ist der empfohlene Pfad: Migrationen nutzen und `DB_SYNCHRONIZE=false` lassen.

Weitere Hinweise für Hosting bei Mittwald (inkl. Subdomains, Registry und ENV):
- DEPLOY_MITTWALD.md

Produktive ENV-Beispielwerte:
- env.production.example

## 🗓️ Roadmap

- [x] Projektsetup & Architektur
- [ ] Backend Core (Auth, CRUD)
- [ ] Frontend Erfassung
- [ ] Statistik-Dashboard
- [ ] Rollen & RBAC
- [ ] Attachments & Storage
- [ ] PWA & Offline-Support
- [ ] Beta-Rollout

## 📄 Lizenz

Proprietär - © 2025 OKJA Team

## 📞 Support

Bei Fragen: [support@okja-stato.de](mailto:support@okja-stato.de)
