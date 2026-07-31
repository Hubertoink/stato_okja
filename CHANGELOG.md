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

## [1.1.3] - 2026-07-31

### Fixed
- Das veröffentlichte On-Prem-Frontend erhält einen eigenen, versionierten
  Proxy-Image-Tag und leitet `/api` ausschließlich an den lokalen
  `backend`-Container weiter. Es kann damit keine öffentliche StatO-API mehr
  als Upstream verwenden.
- Bei einer frischen lokalen Installation weicht der Release-Installer bei
  belegtem Standardport 80 sicher auf den ersten freien Port von 8080 bis 8090
  aus und passt die lokale Standardadresse entsprechend an.

### Changed
- Der Release-Installer verwaltet `STATO_FRONTEND_IMAGE_TAG` getrennt von
  `STATO_IMAGE_TAG`, damit das On-Prem-Frontend immer im internen Proxy-Modus
  ausgeführt wird.

---

## [1.1.2] - 2026-07-31

### Changed
- Der On-Prem-Betrieb verwendet künftig ein geprüftes, versioniertes
  Release-Bundle statt eines Git-Checkouts und lokaler Docker-Builds.
- Die lokale On-Prem-Konfiguration liegt getrennt unter `config/stato.env`.

### Added
- Release-Installer für Windows PowerShell und Linux/macOS mit
  Prüfsummenprüfung, Release-Pinning und automatischem Sicherheitsbackup vor
  Folgeupdates.

### Security
- Bestehende Legacy-On-Prem-Datenvolumes werden vom neuen Installer nicht
  automatisch übernommen; dadurch ist eine unbeabsichtigte Stack-Migration
  ausgeschlossen.

---

## [1.1.1] - 2026-07-31

### Changed
- Eigene KPI-Karten werden auf mobilen Geräten ebenfalls kompakt in zwei
  Spalten dargestellt.

---

## [1.1.0] - 2026-07-31

### Changed
- Dashboard- und Statistik-KPIs werden auf mobilen Geräten kompakt als
  2×2-Raster dargestellt.
- Die Statistik-Paginierung zeigt auf Mobilgeräten die verkürzte Form
  „1 von 9“, damit die Seitenangabe nicht umbrechen muss.

### Fixed
- Fehlende Leerzeichen in der Statistik bei Eintragszahl, Seitenangabe und
  Tabellenbereich („Zeige 1–50 von 411“) behoben.

---

## [1.0.17] - 2026-07-30

### Added
- Generator für individuelle `.env.onprem`-Konfigurationen inklusive lokaler
  Secret-Erzeugung und begleitender On-Prem-Dokumentation.

### Fixed
- Aktionsflächen und Bearbeiten-Symbole bleiben in allen dunklen Themes
  kontrastreich und konsistent.
- Logbucheinträge auf dem Dashboard erhalten wieder ein sichtbares Hover- und
  Fokus-Highlight.

---

## [1.0.16] - 2026-07-30

### Added
- Sprachumschaltung und lokalisierte Rechtstexte stehen auch auf der
  Anmeldeseite zur Verfügung.

### Changed
- Das Sprachsymbol im Login-Footer ist linksbündig angeordnet und hebt sich
  in der Akzentfarbe stärker ab.

---

## [1.0.15] - 2026-07-29

### Fixed
- In der Tagesauswahl des Kalenders steht wieder ein korrektes Leerzeichen
  zwischen „Aktivitäten am“ und dem formatierten Datum.

---

## [1.0.14] - 2026-07-29

### Fixed
- Der Dialog „Einrichtung geschlossen“ wird im Kalender wieder klar und
  ungedimmt über dem abgedunkelten Seitenhintergrund dargestellt.

---

## [1.0.13] - 2026-07-29

### Added
- Die StatO-Oberfläche ist jetzt vollständig auf Deutsch und Englisch
  verfügbar. Benutzer können ihre bevorzugte Sprache im Profil wählen;
  Organisationsadministratoren können zusätzlich eine Standardsprache für
  ihre Einrichtung festlegen.
- Datums- und Zahlenformate sowie systemweite Beschriftungen folgen der
  gewählten Sprache.

### Fixed
- Der Dialog „Einrichtung geschlossen“ im Kalender lässt sich wieder
  vollständig bedienen. Der visuelle Hintergrund blockiert weder
  Schaltflächen noch Formularfelder.

---

## [1.0.12] - 2026-07-28

### Fixed
- Die Benutzeranlage lehnt E-Mail-Adressen mit Umlauten oder anderen
  Nicht-ASCII-Zeichen nun im Browser und im Backend ab.
- Nach dem Ändern eines temporären Passworts wird das aktualisierte
  Benutzerprofil sofort übernommen. Die Passwortpflicht endet ohne erneutes
  Anmelden; gegebenenfalls werden anschließend die Nutzungsbedingungen zur
  Zustimmung angezeigt.

---

## [1.0.11] - 2026-07-28

### Added
- On-Prem-Installationen können Benutzer und Organisations-Admins optional
  lokal mit einem temporären Passwort anlegen. Der neue Schalter
  `USER_PROVISIONING_MODE=local` benötigt keinen SMTP-Server; das Passwort
  muss beim ersten Login geändert werden.
- Der Mittwald-Go-Live-Leitfaden beschreibt den neuen Stack-Installer,
  die Domain-Zuordnung, Updates und den Backup-Cronjob.

### Changed
- E-Mail-Einladungen über SMTP bleiben der sichere, empfohlene Standard für
  neue Benutzer (`USER_PROVISIONING_MODE=email`).

---

## [1.0.10] - 2026-07-27

### Added
- Die Projektverknüpfung im Umfrage-Editor zeigt nun das Projektbild mit
  farbigem Fallback an.

### Fixed
- Die Aktivitätsansicht zeigt bei null Treffern keine doppelte Leerzustandsmeldung
  mehr; Aktionsleiste und Suchfelder sind mit den übrigen Übersichten abgestimmt.

---

## [1.0.9] - 2026-07-27

### Changed
- TypeORM wurde von 0.3 auf 1.1 aktualisiert. Historische Migrationen,
  sichere WHERE-Kriterien und der Production-Docker-Layer sind kompatibel
  angepasst und gegen PostgreSQL geprüft.

---

## [1.0.8] - 2026-07-26

### Added
- Die Einrichtung des ersten On-Prem-Administratorkontos zeigt nun dieselbe
  Live-Prüfung der Passwortanforderungen wie der Passwortwechsel.

---

## [1.0.7] - 2026-07-26

### Added
- Beim ersten Start einer On-Prem-Installation führt StatO durch die sichere
  Einrichtung eines initialen Administratorkontos einschließlich Passwort.
- KPI-Editor und Dashboard-Logbuch wurden erweitert und überarbeitet.

---

## [1.0.6] - 2026-07-26

### Added
- Die On-Prem-Installer zeigen beim Start ein StatO-Banner und verständliche
  Statusprüfungen für Git, Docker und Docker Compose an.

### Fixed
- Bei einer nicht laufenden Docker-Engine liefern die On-Prem-Installer klare
  Schritt-für-Schritt-Hinweise statt einer technischen Docker-Pipe-Fehlermeldung.

---

## [1.0.5] - 2026-07-26

### Fixed
- Kategorien und Tags behalten frei gewählte Farben und zeigen diese zuverlässig
  in ihren Verwaltungslisten an.
- Die Projektfarbe wird bei breiten Ansichten unterhalb des Bildbereichs angeordnet.

---

## [1.0.4] - 2026-07-26

### Added
- Einheitlicher Farbwähler für Kategorien, Tags und Projektfarben mit Hex-Eingabe,
  Farbton-, Sättigungs- und Helligkeitssteuerung.
- Würfel-Schaltfläche für zufällig erzeugte, kontrastreiche Farben.

### Changed
- Die bisherigen festen Farbpaletten in den Kategorie- und Tag-Formularen durch den
  gemeinsamen Farbwähler ersetzt.

---

## [1.0.3] - 2026-07-26

### Fixed
- Verwaiste, verwundbare `brace-expansion`-Kopie aus dem Backend-Produktimage entfernt.
- Automatischer GitHub-Release checkt das Repository aus, bevor er die Release-Artefakte
  und Release Notes veröffentlicht.

---

## [1.0.2] - 2026-07-26

### Security
- Backend-Image aktualisiert `body-parser` auf 2.3.0 und `brace-expansion` auf 2.1.2.
- Swagger verwendet im Produktimage die gepatchte transitive Abhängigkeit `js-yaml` 5.2.2.
- Frontend-Image aktualisiert beim Build die Alpine-Laufzeitpakete, einschließlich
  OpenSSL, Expat, Libxml2 und Libpng.

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
