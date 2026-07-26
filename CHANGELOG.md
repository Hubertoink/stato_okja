# StatO – Changelog

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
und dieses Projekt hält sich an [Semantic Versioning](https://semver.org/lang/de/).

---

## [Unreleased]

### In Entwicklung
- JWT Refresh Token Rotation
- Rate Limiting für Auth-Endpoints
- E2E Tests mit Playwright
- PDF-Export für Berichte
- Attachment-Upload mit MinIO
- Offline-PWA Funktionalität
- Azure AD OIDC Integration

---

## [1.0.1] - 2026-07-26

### Added
- Demo-Umfragen mit Beispielantworten, Auswertung und Verlauf ergänzt.

### Changed
- Die zusätzliche Beschreibung auf der Übersichtsseite der Umfragen entfernt.

### Fixed
- Windows-On-Prem-Installer kann die Berechtigungen eines bestehenden Upload-Volumes
  wiederherstellen, obwohl der Backend-Container standardmäßig alle Capabilities ablegt.
- Docker-Builds schließen TypeScript-Buildcache aus und erzeugen dadurch zuverlässig
  das Backend-Startartefakt.

---

## [1.0.0] - 2026-07-26

### Added
- Wiederholbare Umfragen mit Runden, Antwortauswertung, Verlauf und Exporten.
- On-Prem-Installer für Linux/macOS und Windows sowie versionierte GHCR-Images.
- Automatische Prüfung eines frischen PostgreSQL-Bootstraps mit allen Migrationen.

### Changed
- Produkt-, Browser- und PWA-Bezeichnung auf **StatO** vereinheitlicht.
- Release-Prozess mit Versionsprüfung, SBOM, Provenance und veröffentlichten
  Installationsartefakten eingeführt.

### Fixed
- Detailansicht von Umfragen für mobile Bildschirme optimiert.
- PostgreSQL-Migrationen bei einem frischen Bootstrap und erneutem Start
  idempotent gemacht.

---

## [2.0.0] - 2025-10-10

### 🎉 Initiales Release

#### Added - Backend
- **NestJS Projekt-Setup** mit TypeScript
- **TypeORM Integration** mit PostgreSQL/SQLite
- **Datenmodell** komplett implementiert:
  - Activity Entity (Kern-Feature)
  - Category, Tag, Cohort (Taxonomy)
  - Location, Staff
  - Attachment, AuditLog
- **REST API Endpunkte**:
  - Activities CRUD mit Filtern
  - Taxonomy Management (Categories, Tags, Cohorts)
  - Staff Management
  - Locations Management
  - Statistics Endpoints (Summary, By Category, By Cohort)
- **Swagger/OpenAPI Dokumentation** auf `/api/docs`
- **Docker Compose** Setup:
  - PostgreSQL Container
  - MinIO Container (S3-kompatibel)
- **Environment Configuration** mit .env

#### Added - Frontend
- **React 18 + TypeScript** mit Vite
- **Tailwind CSS** mit Stato Farbpalette
- **React Router** mit geschützten Routes
- **React Query** für Server State Management
- **Basis-Komponenten**:
  - Layout mit Navigation
  - Dashboard mit KPI-Karten
  - Activity List mit Filtern
  - Activity Form (vollständiges Erfassungsformular)
  - Statistics Dashboard (Platzhalter)
  - Settings Page (Platzhalter)
  - Login Page
- **Design System**:
  - Viridian Farbschema
  - Responsive Layout
  - Mobile-friendly Components

#### Added - Dokumentation
- **README.md** mit Projekt-Übersicht
- **GETTING_STARTED.md** mit Schritt-für-Schritt Setup
- **SETUP.md** mit detaillierten Workflows
- **ARCHITECTURE.md** mit System-Diagrammen
- **API_COLLECTION.md** mit Request-Beispielen
- **Development_Note.txt** mit Projekt-Briefing

#### Technical
- **TypeScript** durchgängig (Backend & Frontend)
- **ESLint & Prettier** Konfiguration
- **Git Ignore** für Node, Docker, IDE
- **Package.json Scripts** für Dev/Build/Test

---

## Roadmap

### Version 2.1.0 (geplant: November 2025)
- [ ] Vollständiges Auth-Modul (JWT Guards, RBAC)
- [ ] Seed-Daten Script mit Beispiel-Aktivitäten
- [ ] Validierung: Kohorten-Summen = Gesamt-Teilnehmende
- [ ] Tag-Autocomplete mit Synonym-Matching
- [ ] Mitarbeitenden-Zuordnung Picker
- [ ] Export: CSV-Download implementiert

### Version 2.2.0 (geplant: Dezember 2025)
- [ ] Attachment-Upload (MinIO Integration)
- [ ] Audit-Log UI
- [ ] Rich-Text Notizen (Markdown)
- [ ] Notiz-Templates (Reflexion, Lernziele, etc.)
- [ ] Statistik: Echte Charts (Recharts Integration)
- [ ] PDF-Export für Berichte

### Version 2.3.0 (geplant: Januar 2026)
- [ ] PWA Service Worker
- [ ] Offline-Modus mit IndexedDB
- [ ] Push-Notifications
- [ ] Mobile-Optimierungen
- [ ] Accessibility Audit (WCAG AA)
- [ ] Performance-Optimierungen

### Version 3.0.0 (geplant: Q1 2026)
- [ ] Azure AD OIDC Integration
- [ ] Multi-Tenant Support
- [ ] Advanced Analytics
- [ ] Custom Reports Builder
- [ ] Daten-Import (CSV)
- [ ] API Rate Limiting
- [ ] Backup & Restore Funktionen

---

## Bekannte Probleme

### Backend
- [ ] Auth-Modul noch Platzhalter (keine JWT-Guards)
- [ ] Migrations müssen manuell erstellt werden
- [ ] Keine Seed-Daten vorhanden
- [ ] Stats-Endpunkte nur Beispiel-Implementierung

### Frontend
- [ ] Keine echte API-Integration (Dummy-Daten)
- [ ] Auth-State nicht persistent
- [ ] Formular-Validierung fehlt
- [ ] Charts sind nur Platzhalter
- [ ] Keine Error-Boundaries
- [ ] Loading-States fehlen

---

## Support & Feedback

- **Issues:** GitHub Issues (Link einfügen)
- **Diskussionen:** GitHub Discussions
- **Email:** support@okja-stato.de

---

**Legende:**
- `Added`: Neue Features
- `Changed`: Änderungen an existierenden Features
- `Deprecated`: Features die bald entfernt werden
- `Removed`: Entfernte Features
- `Fixed`: Bug-Fixes
- `Security`: Sicherheits-Updates
