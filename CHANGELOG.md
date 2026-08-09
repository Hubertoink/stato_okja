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

## [1.5.1] - 2026-08-09

### Changed
- Die äußeren Rahmen der Dashboard-Bereiche wurden entfernt; innere Karten und
  Bedienelemente behalten ihre visuelle Abgrenzung.
- Statistik-Tooltips zeigen den Wochentag an und verwenden konsistente
  Navigationsicons.

---

## [1.5.0] - 2026-08-08

### Changed
- KPI- und Projekt-Editoren folgen jetzt dem gemeinsamen, themefähigen
  Formularstandard der Aktivitäten. Der Projekt-Editor ist kompakter und
  verwendet konsistente Oberflächen für seine Bereiche.
- Logbuch- und Daily-Log-Karten auf dem Dashboard verwenden denselben
  rahmenlosen Kartenstil wie die Statistik.

### Fixed
- Die Statistik zeigt für Alterskohorten den hinterlegten Altersbereich statt
  der frei wählbaren Kohortenbezeichnung.
- Der Hinweis für weitere Kalenderaktivitäten ist wieder verfügbar und nutzt
  den üblichen Tooltip-Stil ohne Pfeil.

---

## [1.4.8] - 2026-08-08

### Changed
- Schließen-, Highlight-, Such-, Filter- und Formularaktionen wurden weiter
  auf gemeinsame UI-Primitives vereinheitlicht.
- Formmodale für Projekte, Aktivitäten, Logbuch und Umfragen verwenden jetzt
  dieselben Oberflächenebenen und einheitlich abgesetzte Eingabefelder.

### Fixed
- Der PNG- und PDF-Export des Teilnehmer-Zeitverlaufs verwendet eine direkte,
  robuste SVG-Erfassung.
- Änderungen an Alterskohorten werden auch im Aktivitätsmodal auf dem Desktop
  sichtbar hervorgehoben.

---

## [1.4.7] - 2026-08-08

### Changed
- Buttons, Icon-Aktionen und Eingabefelder verwenden in den zentralen
  Arbeitsbereichen nun gemeinsame, themefähige UI-Primitives. Das umfasst
  unter anderem Projekte, Aktivitäten, Logbuch, Umfragen, Statistik und Kalender.
- Projektfilter und Archivansicht bleiben lokal erhalten; Suche und geöffnete
  Filterdialoge bleiben bewusst temporär.

### Fixed
- Die Kalendernavigation verwendet konsistente Chevron-Buttons mit passenden
  Touchzielen.
- Das direkte Schließen einer unveränderten Kalender-Aktivität löst keinen
  Verwerf-Dialog mehr aus.

---

## [1.4.6] - 2026-08-08

### Changed
- Modale folgen nun einheitlich dem StatO-Design: Textfelder haben in allen
  Editoren eine dezente, themefähige Abhebung; Verlaufsschalter und der
  Login-Button sind einfarbig.
- Modale lassen sich konsistent per Klick außerhalb schließen; auf Mobilgeräten
  schließt die Browser-Zurückgeste zuerst das geöffnete Modal.
- Die Auswahl von Logbuch-Aktivitäten lädt nur noch die benötigte Seite statt
  alle Aktivitäten auf einmal.

### Fixed
- Die mobile Loginansicht ist statisch und kann nicht mehr unnötig vertikal
  verschoben werden.
- Das Verknüpfen einer Aktivität im Logbuch öffnet anschließend zuverlässig
  den Logbucheintrag.
- Zählfelder für Alterskohorten ignorieren Scrollgesten. Vom gespeicherten
  Stand abweichende Werte werden im Bearbeitungsmodus sichtbar markiert und
  geben nach bewussten Änderungen direktes Feedback.

---

## [1.4.5] - 2026-08-07

### Changed
- Umfragedaten lassen sich direkt aus der Liste als PDF oder Excel exportieren.
- Exporte enthalten sämtliche Umfragerunden; Excel ergänzt je Runde die
  Auswertung und verfügbare Rohantworten.

### Fixed
- Export- und Archivaktionen sind in der Umfragenliste visuell semantisch
  eingefärbt und dadurch besser unterscheidbar.

---

## [1.4.4] - 2026-08-07

### Changed
- Die Umfragenliste bietet nun einen direkten CSV-Export der verfügbaren
  Rohantworten, ohne zuvor die Umfrageauswertung öffnen zu müssen.

### Fixed
- PDF- und PNG-Exporte der Umfrageauswertung verwenden eine exportfreundliche
  CSS2-Farbpalette und funktionieren damit auch in CSS-Color-4-Dark-Themes.

---

## [1.4.3] - 2026-08-07

### Changed
- Umfrageauswertungen verwenden in allen Diagrammen konsistente, theme-aware
  Achsen, Raster, Legenden und Verlaufstooltips.
- Exportauswahl und Tab-Fokus in Umfrageansichten folgen dem Dark-Theme und den
  gemeinsamen StatO-Interaktionsmustern.

### Fixed
- Der mobile Tageserfassungs-Header schließt nun ohne sichtbaren Abstand an
  die Kohortenleiste an.
- Löschaktionen und Suchfelder in Umfragen bleiben auch im Dark Theme klar
  lesbar und visuell konsistent.

---

## [1.4.2] - 2026-08-07

### Changed
- Projekt-, Aktivitäts- und Erfassungsdialoge verwenden nun konsistentere
  Formular-, Aktions- und Responsive-Layouts.
- Die Tageserfassung richtet sich visuell und strukturell stärker am
  Aktivitätsdialog aus; mobile Aktionen folgen dem normalen Scrollfluss.

### Fixed
- Start- und Endzeiten werden in Projekten, Aktivitäten und Abschlüssen
  geprüft: unvollständige oder nicht aufsteigende Zeiträume lassen sich nicht
  speichern.
- Kontraste, Ausrichtung und Zustände in Dark Themes wurden in den geprüften
  Dialogen und Logbuchansichten vereinheitlicht.

---

## [1.4.1] - 2026-08-07

### Fixed
- Projektmodal-Footer scrollt jetzt mit dem Formularinhalt statt dauerhaft am
  unteren Viewport-Rand zu stehen.
- Abbrechen-Aktionen verwenden in allen Editor- und Modalvarianten einen klar
  sichtbaren Rahmen, auch im Standard-Dark-Theme.
- Die übrigen lokalen UI-Verbesserungen für Formulare, Navigation und
  Aktivitäten sind in den Release-Stand übernommen.

## [1.4.0] - 2026-08-07

### Added
- Nutzer können ihren bevorzugten Hell-/Dunkelmodus speichern.
- Bearbeitungsformulare warnen vor dem Verwerfen ungespeicherter Änderungen.

### Changed
- Mobile Formulare, Modals und Navigation wurden umfassend für kleinere
  Viewports, die Bildschirmtastatur und konsistente Theme-Darstellung verfeinert.
- Backend, Frontend-Build und CI verwenden jetzt Node.js 24 LTS.

### Fixed
- Der Backend-Docker-Build entfernt einen lokalen TypeScript-Build-Cache, damit
  das Runtime-Bundle bei Builds aus einem Quell-Checkout vollständig erzeugt wird.

---

## [1.3.5] - 2026-08-02

### Changed
- Beim vollständigen Statistik-PDF kann die Aktivitätenliste optional als
  eigene, paginierte Tabelle ergänzt werden. Große Datenmengen bleiben damit
  exportierbar, ohne leere Seiten zu erzeugen.

### Fixed
- Der Statistik-PDF-Export zeigt seinen Ladezustand jetzt sofort vor dem Laden
  aller Aktivitäten und sperrt parallele Exporte. Dadurch werden doppelte
  Anfragen und Rate-Limit-Fehler vermieden.

---

## [1.3.4] - 2026-08-02

### Fixed
- Der vollständige Statistik-PDF-Export blendet interaktive Schalter und
  Diagramm-Exportaktionen während des Renderns aus. Dadurch gelangen keine von
  html2canvas nicht unterstützten CSS-Farb-Funktionen mehr in das PDF.

---

## [1.3.3] - 2026-08-02

### Changed
- Ferien werden im Kalender wochenübergreifend als durchgängige Wochenbänder
  dargestellt.
- Logbuch-Verknüpfungen zeigen die Projektfarbe und das Projektbild und führen
  direkt zur projektbezogenen Aktivitätsansicht.

### Fixed
- PNG- und PDF-Exporte einzelner Statistikdiagramme verwenden jetzt dieselbe
  exportkompatible Farbpalette wie der große Statistik-PDF-Export.
- Logbuch-Einträge sowie der Bearbeitungsmodus bleiben beim Öffnen vom Dashboard
  im Dashboard-Workflow; Schließen, Abbrechen und Speichern reißen den Nutzer
  nicht mehr auf die Logbuchseite.
- Die Checkboxen im Daily Log haben einen klaren Hover-Zustand.

---

## [1.3.2] - 2026-08-02

### Changed
- Auswahl-Buttons für Zeiträume, Ansichten und Statistikbereiche verwenden jetzt
  eine gemeinsame, animierte Darstellung mit lesbarem Hover-Zustand.

### Fixed
- Der Backend-Produktionscontainer verwendet für `brace-expansion` ausschließlich
  eine gegen CVE-2026-14257 gepatchte Version.

---

## [1.3.1] - 2026-08-02

### Added
- Neue Amigo-Illustrationen für die KPI-Karten sowie für leere Daily-Log-,
  Logbuch- und Umfrageansichten.

### Changed
- Bei vorhandenen Daily-Log- und Logbucheinträgen erscheinen die jeweiligen
  Illustrationen dezent im Hintergrund; Leerzustände sind damit konsistent
  und ohne unnötige Aktionen gestaltet.

---

## [1.3.0] - 2026-08-02

### Added
- Das Dashboard bietet im monatlichen Verlauf jetzt eine Auswahl zwischen
  Wochen-, Monats- und Jahresansicht.

### Fixed
- KPI-Karten in Statistik und Dashboard verwenden konsistente Illustrationen
  und Hinweise zum jeweils dargestellten Zeitraum.
- Teilnehmende und Stunden werden auch bei unvollständigen Alt- oder Testdaten
  belastbar ausgewertet; neue Aktivitäten speichern Teilnehmendenzahl und Dauer
  nach einheitlichen Datenregeln.
- PDF-Berichte, Datenexport/-import und die vollständige Datenlöschung sind
  robuster abgesichert. Upload-Dateien werden beim Gesamtlöschen zuverlässig
  entfernt, während die administrative Anmeldung erhalten bleibt.
- Diagramm-Tooltips folgen jetzt der Farbgebung des aktiven Themes.

---

## [1.2.0] - 2026-08-01

### Added
- Superadmins sehen im Superadmin-Bereich alle Benutzer, nach
  Organisationszugehörigkeit getrennt.

### Fixed
- Die Desktop-Hauptnavigation zeigt nur noch Icons und bleibt dadurch auch
  bei langen Beschriftungen vollständig sichtbar. Die Bezeichnungen bleiben
  per Tooltip und für Screenreader verfügbar.
- Die Darstellung von Admin-Daten und Navigation ist kontrastreicher und
  kompakter.
- Audit-Karten und Organisations-Setup sind auf kleineren Ansichten besser
  ausgerichtet.

---

## [1.1.8] - 2026-08-01

### Fixed
- Die Darstellung von Admin-Daten und Navigation ist kontrastreicher und
  kompakter.
- Audit-Karten und Organisations-Setup sind auf kleineren Ansichten besser
  ausgerichtet.

---

## [1.1.7] - 2026-08-01

### Added
- Organisations-Admins und Superadmins können lokale Kategorien, Tags,
  Kohorten und Einrichtungen als YAML exportieren, eine Vorlage herunterladen
  und Daten kontrolliert wieder importieren.
- Der Import zeigt vor der Übernahme eine Vorschau der neuen und bereits
  vorhandenen Einträge und ist auf Deutsch und Englisch verfügbar.

### Fixed
- Durch Vererbung gesperrte Bereiche werden im Import-Check deutlich markiert
  und übersprungen; erlaubte Bereiche lassen sich weiterhin importieren.
- Die Import-Sperre wird zusätzlich serverseitig durchgesetzt und kann nicht
  über eine manipulierte Anfrage umgangen werden.
- In der Organisationsübersicht wird „0 direkt“ mit korrektem Abstand angezeigt.

---

## [1.1.6] - 2026-08-01

### Fixed
- Nach einem erzwungenen Passwortwechsel wird die zuvor widerrufene Sitzung
  sofort durch eine neue ersetzt. Die Zustimmung zu den Nutzungsbedingungen
  kann dadurch direkt anschließend gespeichert werden.
- Die Benutzerverwaltung benennt den Kontext eindeutig als „Benutzer von
  Orga …“ beziehungsweise „Benutzer ohne Organisation“.
- Das Zurücksetzen eines Passworts setzt die Eingaben verdeckt zurück und
  zeigt nur noch einen Sichtbarkeits-Schalter an.

---

## [1.1.5] - 2026-08-01

### Added
- Neue Rolle **Editor**: besitzt alle Rechte von Benutzer:innen und kann
  Einstellungen wie Taxonomien verwalten, archivieren und löschen.
- Der Rollenwechsel erklärt die Berechtigungen von Benutzer:in, Editor und
  Administrator kompakt auf Deutsch und Englisch.

### Fixed
- Einstellungsmodale schließen auf Mobilgeräten korrekt am unteren Rand ab;
  ihre Aktionsschaltflächen sind rechtsbündig, gut erreichbar und einheitlich
  positioniert.
- Horizontales Scrollen in mobilen Einrichtungen- und Einstellungsansichten
  beseitigt.
- Kontraste von Einstellungsoberflächen und dem Kalender-Badge
  „Geschlossen“ in dunklen Themes verbessert.
- Löschen und Archivieren von Kategorien, Tags und Kohorten ist serverseitig
  auf Editor:innen und Administrator:innen beschränkt; Archivieren wird im
  Bestätigungsdialog hervorgehoben.

### Security
- Alle verwundbaren `brace-expansion`-Abhängigkeiten im Lockfile auf gepatchte
  Versionen aktualisiert.

---

## [1.1.4] - 2026-08-01

### Fixed
- Fehlende Leerzeichen in der Anzeige „Besprochen von“ korrigiert.
- Aktionsleisten in den Einstellungs- und Teammitglied-Modalen an den Dark
  Mode angepasst.
- Debriefing-Felder im Logbuch an die Farbgebung der Umfrage-Fragekarten
  angepasst.
- XLSX-Download im Datenexport-Modal im Dark Mode als klar sichtbaren Button
  dargestellt.

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
