# Stato 2.0 - OKJA Statistik-System

Statistik- und Dokumentationssystem für offene Kinder- und Jugendarbeit (OKJA).

## 🎯 Projektziele

- **Zielgruppe:** OKJA-Teams, Leitung, Träger
- **Mehrbenutzer-Betrieb** mit klaren Rollen
- **Datenschutz-konform**, offline-tolerant
- Wissenschaftliche Kategorisierung nach Landesjugendamt-Standard

## 🚀 Quick Start

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

# E2E Tests
npm run test:e2e

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

<<<<<<< HEAD
Weitere Hinweise für Hosting bei Mittwald (inkl. Subdomains, Registry und ENV):
=======
Weitere Hinweise für Hosting bei Mittwald (inklusive Subdomains, Registry und ENV) findest du in:
>>>>>>> 85ae415 (fix(backend): remove missing UploadsModule from AppModule for CI build)
- DEPLOY_MITTWALD.md

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
