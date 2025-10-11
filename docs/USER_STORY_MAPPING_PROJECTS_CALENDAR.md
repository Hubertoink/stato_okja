# User Story Mapping – Projekte/Angebote + Kalender (Next Milestone)

Datum: 2025-10-10

Ziel: Von reiner Aktivitätserfassung zu Angebots-/Projektlogik mit visueller Kalenderplanung. Aktivitäten werden Projekten zugeordnet, wodurch Planung, Wiederverwendung und Statistik vereinfacht werden.

## Begriffe
- Projekt/Angebot (Project): Wiederverwendbarer Container mit Meta-Daten (Titel, Typ, Kategorie, Zielgruppe, Bild/Icon, Beschreibung).
- Aktivität (Activity): Konkreter Termin/Eintrag, optional abgeleitet aus einem Projekt.

## Epics → Stories → Tasks (+Akzeptanzkriterien)

### Epic A: Projektverwaltung (CRUD, Kachelübersicht)
Rollen: Admin, Leitung, Mitarbeitende (mind. WRITE für Anlage/Bearbeiten)

- Story A1: Projekt anlegen
  - Als Mitarbeitende/r möchte ich ein Projekt mit Titel, Typ, Kategorie, Zielgruppe, Bild/Icon und Beschreibung anlegen.
  - Akzeptanzkriterien:
    - Pflicht: Titel, Typ
    - Optional: Kategorie, Zielgruppe, Bild/Icon (URL oder Upload), Beschreibung
    - Validierung: Titel 2–120 Zeichen; Typ ∈ ActivityType; Kategorie existiert
    - Nach Speichern erscheint das Projekt in der Kachelansicht
  - Tasks (Backend):
    - Entity `Project` + Repository + DTOs (create/update) + ValidationPipe
    - Controller: `POST /projects` (201), `GET /projects`, `GET /projects/:id`
    - Optional: Bild als URL-Feld; Upload später per Attachments
  - Tasks (Frontend):
    - Seite `Projects` (Kachelansicht) + `ProjectForm` (Dialog/Seite)
    - React Query Hooks (`useProjects`, `useCreateProject`)

- Story A2: Projekt bearbeiten/archivieren
  - Akzeptanzkriterien:
    - `PATCH /projects/:id` ändert Felder
    - Archivierte Projekte sind standardmäßig ausgeblendet, Filter „Archiviert anzeigen“ vorhanden

- Story A3: Projekt duplizieren
  - Akzeptanzkriterien:
    - „Duplizieren“ erzeugt neues Projekt mit identischen Feldern (Titel + „(Kopie)“)

### Epic B: Aktivitäten aus Projekten ableiten

- Story B1: Projektauswahl beim Anlegen einer Aktivität
  - Als Nutzer/in wähle ich ein Projekt (Kachel-Modal). Basisdaten (Typ, Kategorie, Zielgruppe, Bild/Icon) werden im Formular vorbelegt.
  - Akzeptanzkriterien:
    - Projekt ist optional; auch „ohne Projekt“ möglich
    - `Activity.projectId` wird gespeichert

- Story B2: Konsistenz der Statistik
  - Akzeptanzkriterien:
    - Aktivitäten mit Projekt erscheinen in Auswertungen pro Projekt/Kategorie

### Epic C: Kalenderintegration (Planung & Dokumentation)

- Story C1: Kalender anzeigen (Monat/Woche/Tag)
  - Akzeptanzkriterien:
    - Aktivitäten erscheinen farbcodiert (Farbe aus Kategorie/Projekt) mit Icon und Kurzinfo (Titel, TN)
    - Auswahl einer Aktivität öffnet Detail/Editor

- Story C2: Aktivität im Kalender anlegen
  - Akzeptanzkriterien:
    - Klick auf freien Slot → Projektauswahl → Aktivität-Form vorbefüllt

- Story C3: Drag & Drop (verschieben/duplizieren)
  - Akzeptanzkriterien:
    - DnD ändert Datum/Uhrzeit; optional Duplizieren mit Modifier-Taste

### Epic D: Statistik-Erweiterung

- Story D1: Summen nach Projekt
  - Akzeptanzkriterien:
    - Neues Endpoint `GET /stats/by-project` liefert Anzahl Aktivitäten, Summe Teilnehmende, Dauer

- Story D2: Vergleich offene vs. geschlossene Angebote
  - Akzeptanzkriterien:
    - Neues Endpoint `GET /stats/by-project-type`

### Epic E: UX & Mobile

- Story E1: Mobile Bottom-Sheet-Editor
  - Akzeptanzkriterien:
    - Auf Mobilgeräten öffnet sich ein Bottom-Sheet für Aktivitäts-Quick-Edit

- Story E2: Kachel-Design & Farbschema
  - Akzeptanzkriterien:
    - Farben laut Palette; Bild/Icon pro Projekt

## Datenmodell & Validierung

### Neue Entity: Project
- id: uuid (PK)
- title: string (2–120, required)
- type: enum ActivityType (PROJECT_OPEN/PROJECT_CLOSED/EVENT/OPEN_DOOR/OUTREACH)
- categoryId: uuid (nullable)
- targetGroup: string (0–120)
- imageUrl: string (nullable)
- description: text (nullable)
- archived: boolean (default false)
- createdAt, updatedAt

Relationen:
- Activity.projectId (nullable, many-to-one)

Index:
- (title), (archived), (categoryId)

DTO (Backend):
- CreateProjectDto { title, type, categoryId?, targetGroup?, imageUrl?, description? }
- UpdateProjectDto: Partial<CreateProjectDto> + archived?

### Activity-Erweiterung
- Feld `projectId: string | null`
- Relation `@ManyToOne(() => Project)` (eager: optional)

Validierung:
- Wenn projectId gesetzt, muss Project existieren

## API-Design

- Projects
  - GET /projects?search=&archived=
  - GET /projects/:id
  - POST /projects
  - PATCH /projects/:id
  - DELETE /projects/:id (soft delete optional → hier: archivieren via PATCH)

Beispiel POST /projects
```
{
  "title": "Medienfezz",
  "type": "EVENT",
  "categoryId": "<uuid>",
  "targetGroup": "12–16 Jahre",
  "imageUrl": "https://…/medienfezz.png",
  "description": "Wöchentliches Medienangebot"
}
```

- Activities
  - POST /activities → akzeptiert optional `projectId`
  - GET /activities?from=&to=&projectId=&categoryId=&locationId=&type=

- Stats
  - GET /stats/by-project?from=&to=
  - GET /stats/by-project-type?from=&to=

## Frontend – Routen & Komponenten

- Neue Seiten
  - `/projects` → `Projects.tsx` (Liste/Kacheln, Suche/Filter, Create/Edit Dialog)
  - `/calendar` → `Calendar.tsx` (Monat/Woche/Tag, DnD, Quick-Create)

- Neue Komponenten
  - `ProjectCard`, `ProjectForm`, `ProjectPickerModal`

- Hooks (React Query)
  - `useProjects()`, `useCreateProject()`, `useUpdateProject()`, `useProject(id)`
  - `useActivities()` erweitert um `projectId`

- Kalenderbibliothek
  - Vorschlag: FullCalendar (`@fullcalendar/react`, Plugins: daygrid, timegrid, interaction) – gute DnD/Responsive-Unterstützung

## Backend – Tasks

1) Entity + Migration
- `Project` Entity (TypeORM) – SQLite-kompatible Column Types (kein JSONB)
- Migration erstellen; Dev: `synchronize=true` okay, Prod: Migration pflegen

2) Module/Service/Controller
- `projects` Module (CRUD) mit DTOs/Validation
- Activities: `projectId` optional annehmen/speichern; Relation laden in `findAll/findOne`

3) Stats
- `StatsService.byProject(from,to)` und `byProjectType(from,to)`

4) Tests
- Unit-Tests für Service/Controller; e2e: CRUD + Filter

## Frontend – Tasks

1) Projektverwaltung
- Seiten/Komponenten erstellen; API-Client + Hooks; Kachelansicht mit Suche/Filter

2) Aktivität aus Projekt
- `ActivityForm` mit Projekt-Picker; Prefill Felder (type, category, targetGroup, image)

3) Kalenderansicht
- FullCalendar integrieren; Events-Adapter (Activities → Events)
- DnD: PATCH Aktivität bei Verschieben; Quick-Create via SlotSelect → ProjectPicker

4) UX/Mobile
- Bottom-Sheet auf Mobil; Icons/Bilder sichtbar

5) Tests
- Frontend-Komponenten-Tests, einfache e2e (Cypress optional)

## Nichtfunktionale Anforderungen
- Performance: Kalender lädt nur sichtbaren Zeitraum (lazy fetch)
- Sicherheit: RBAC auf Projekt-CRUD (Admin/Leitung volle Rechte; Mitarbeitende beschränkt)
- Barrierefreiheit: Tastaturbedienung, ausreichende Kontraste

## Definition of Done
- Alle CRUD-Flows für Projekte inkl. Validierung und Archivfilter
- Aktivitäten lassen sich Projekten zuordnen; Formular-Prefill funktioniert
- Kalender zeigt/erstellt/verschiebt Aktivitäten
- Neue Stats-Endpunkte liefern korrekte Aggregationen; Diagramme eingebunden
- Tests: mind. 70% Statements im betroffenen Code, Happy-Path e2e
- Docs: README Abschnitt „Projekte & Kalender“ + API Collection aktualisiert

## Risiken & Folgearbeiten
- Bild-Upload: zunächst URL-Feld; echter Upload über bestehende Attachments/MinIO in späterem Sprint
- DnD in Mobile: eingeschränkt – Alternativ: Long-Press Menü
- Migrations in Prod notwendig (SQLite/PG Unterschiede)

## Aufwandsschätzung (grobe T-Shirt-Sizes)
- Backend: M-L
- Frontend (Projekte): M
- Frontend (Kalender): L
- Stats + Charts: M
- Tests/Docs/Polish: M

---

Nächste sinnvolle Umsetzung: Epic A (Project CRUD) + B1 (Projektauswahl in Aktivität). Danach Kalender (Epic C).
