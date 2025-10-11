# Stato 2.0 - Architektur-Dokumentation

## 📐 Systemarchitektur

### Übersicht

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │  Dashboard  │  │  Activities  │  │  Statistics    │ │
│  └─────────────┘  └──────────────┘  └────────────────┘ │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │   Login     │  │  Settings    │  │  Activity Form │ │
│  └─────────────┘  └──────────────┘  └────────────────┘ │
│                                                          │
│  React Query · Zustand · React Router · Tailwind CSS    │
└──────────────────────────┬──────────────────────────────┘
                           │ REST API (JSON)
                           │ HTTP/HTTPS
┌──────────────────────────▼──────────────────────────────┐
│                  Backend (NestJS)                        │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌──────────┐ │
│  │  Auth   │  │Activity │  │Taxonomy  │  │  Stats   │ │
│  └────┬────┘  └────┬────┘  └────┬─────┘  └────┬─────┘ │
│       │            │             │              │       │
│  ┌────▼────────────▼─────────────▼──────────────▼────┐ │
│  │              TypeORM (ORM Layer)                   │ │
│  └─────────────────────────┬──────────────────────────┘ │
└────────────────────────────┼────────────────────────────┘
                             │ SQL
                             │
┌────────────────────────────▼────────────────────────────┐
│              PostgreSQL (Produktion)                     │
│                 SQLite (Development)                     │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│          MinIO (S3-kompatibel) - Attachments             │
└──────────────────────────────────────────────────────────┘
```

---

## 🗄️ Datenmodell

### Entity Relationship Diagram (vereinfacht)

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Activity   │◄───────►│   Category   │         │     Tag      │
│──────────────│    M:N  │──────────────│         │──────────────│
│ id           │         │ id           │         │ id           │
│ date         │         │ name         │         │ name         │
│ type         │         │ standardRef  │         │ synonyms[]   │
│ countMale    │         │ active       │         │ active       │
│ countFemale  │         └──────────────┘         └──────────────┘
│ countDiverse │                                         ▲
│ countTotal   │                                         │ M:N
│ cohorts[]    │                                         │
│ notes        │         ┌──────────────┐                │
└──────┬───────┘         │   Location   │                │
       │                 │──────────────│                │
       │ M:1             │ id           │                │
       └────────────────►│ name         │                │
                         │ roomType     │                │
                         └──────────────┘                │
       ┌─────────────────────────────────────────────────┘
       │
       │ M:N
       ▼
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│    Staff     │         │  Attachment  │         │   Cohort     │
│──────────────│         │──────────────│         │──────────────│
│ id           │         │ id           │         │ id           │
│ email        │         │ filename     │         │ name         │
│ name         │         │ mimeType     │         │ minAge       │
│ role         │         │ storageRef   │         │ maxAge       │
│ active       │         └──────────────┘         │ sortOrder    │
└──────────────┘                                   └──────────────┘
```

### Activity Entity (Kern)

```typescript
Activity {
  id: UUID
  date: Date
  startTime: Time
  endTime: Time
  durationMinutes: Integer
  type: Enum(open_door|project_open|project_closed|event|outreach)
  
  // Relations
  location: Location (M:1)
  categories: Category[] (M:N)
  tags: Tag[] (M:N)
  staff: Staff[] (M:N)
  attachments: Attachment[] (1:N)
  
  // Counts
  countMale: Integer
  countFemale: Integer
  countDiverse: Integer
  countTotal: Integer
  
  // Cohorts (JSONB)
  cohorts: [{ cohortId: UUID, count: Integer }]
  
  // Documentation
  notes: Text
  goals: Text
  
  // Audit
  createdBy: Staff
  updatedBy: Staff
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

## 🔐 Authentifizierung & Autorisierung

### Rollen-Hierarchie

```
┌─────────────────────────────────────────────────┐
│                    ADMIN                         │
│  • Vollzugriff auf alle Funktionen              │
│  • Benutzer- & Rechteverwaltung                 │
│  • System-Konfiguration                         │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│                    LEAD                          │
│  • Vollzugriff auf Aktivitäten & Statistiken    │
│  • Team-Management                              │
│  • Export-Funktionen                            │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│                  EMPLOYEE                        │
│  • CRUD für eigene Aktivitäten                  │
│  • Lesen von Team-Aktivitäten                   │
│  • Basis-Statistiken                            │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│            VOLUNTEER / HELPER                    │
│  • Create & Read eigene Einträge                │
│  • Keine Konfigurations-Rechte                  │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│                  ANALYST                         │
│  • Nur Lesen & Export                           │
│  • Keine Bearbeitung                            │
└──────────────────────────────────────────────────┘
```

### JWT Token-Flow

```
1. Login (POST /api/auth/login)
   ├─► Credentials Validation
   ├─► Generate Access Token (15min)
   ├─► Generate Refresh Token (7d)
   └─► Return Tokens + User Info

2. API Request
   ├─► Bearer Token in Header
   ├─► JWT Verify & Decode
   ├─► Role-Based Guard Check
   └─► Execute Request

3. Token Refresh (POST /api/auth/refresh)
   ├─► Validate Refresh Token
   ├─► Generate new Access Token
   └─► Return new Access Token
```

---

## 📡 API-Struktur

### Endpunkt-Übersicht

```
/api
├─ /auth
│  ├─ POST   /login          # Login
│  ├─ POST   /refresh        # Token erneuern
│  └─ POST   /logout         # Logout
│
├─ /activities
│  ├─ GET    /               # Liste (Filter: from, to, type, location, staff)
│  ├─ GET    /:id            # Detail
│  ├─ POST   /               # Neu erstellen
│  ├─ PATCH  /:id            # Bearbeiten
│  └─ DELETE /:id            # Löschen
│
├─ /taxonomy
│  ├─ /categories
│  │  ├─ GET    /            # Alle Kategorien
│  │  ├─ POST   /            # Neue Kategorie
│  │  ├─ PATCH  /:id         # Bearbeiten
│  │  └─ DELETE /:id         # Löschen
│  │
│  ├─ /tags
│  │  ├─ GET    /            # Alle Tags (search parameter)
│  │  ├─ POST   /            # Neues Tag
│  │  ├─ PATCH  /:id         # Bearbeiten
│  │  └─ DELETE /:id         # Löschen
│  │
│  └─ /cohorts
│     ├─ GET    /            # Alle Kohorten
│     ├─ POST   /            # Neue Kohorte
│     ├─ PATCH  /:id         # Bearbeiten
│     └─ DELETE /:id         # Löschen
│
├─ /staff
│  ├─ GET    /               # Alle Mitarbeitende
│  ├─ GET    /:id            # Detail
│  ├─ POST   /               # Neu erstellen
│  ├─ PATCH  /:id            # Bearbeiten
│  └─ DELETE /:id            # Löschen
│
├─ /locations
│  ├─ GET    /               # Alle Standorte
│  ├─ GET    /:id            # Detail
│  ├─ POST   /               # Neu erstellen
│  ├─ PATCH  /:id            # Bearbeiten
│  └─ DELETE /:id            # Löschen
│
└─ /stats
   ├─ GET    /summary        # KPI-Zusammenfassung
   ├─ GET    /by-category    # Verteilung nach Kategorien
   ├─ GET    /by-cohort      # Verteilung nach Alterskohorten
   └─ GET    /export/csv     # CSV-Export
```

### Beispiel-Request/Response

**POST /api/activities**

Request:
```json
{
  "date": "2025-10-10",
  "startTime": "14:00",
  "endTime": "16:00",
  "type": "open_door",
  "locationId": "uuid-location",
  "countMale": 8,
  "countFemale": 6,
  "countDiverse": 1,
  "countTotal": 15,
  "cohorts": [
    { "cohortId": "uuid-cohort-1", "count": 7 },
    { "cohortId": "uuid-cohort-2", "count": 8 }
  ],
  "categoryIds": ["uuid-cat-1", "uuid-cat-2"],
  "tagIds": ["uuid-tag-1"],
  "staffIds": ["uuid-staff-1"],
  "notes": "Tolle Stimmung, viele neue Gesichter."
}
```

Response:
```json
{
  "id": "uuid-activity",
  "date": "2025-10-10",
  "type": "open_door",
  "location": {
    "id": "uuid-location",
    "name": "Medienraum"
  },
  "countTotal": 15,
  "categories": [...],
  "tags": [...],
  "staff": [...],
  "createdAt": "2025-10-10T14:30:00Z"
}
```

---

## 🎨 Frontend-Architektur

### State Management

```
┌──────────────────────────────────────────────┐
│           Zustand (Global State)              │
│  • User Session                               │
│  • App Settings                               │
│  • UI State (Sidebar, Modals)                │
└──────────────────┬───────────────────────────┘
                   │
┌──────────────────▼───────────────────────────┐
│       React Query (Server State)             │
│  • Activities (useQuery)                     │
│  • Taxonomy (useQuery)                       │
│  • Stats (useQuery)                          │
│  • Mutations (useMutation)                   │
└──────────────────────────────────────────────┘
```

### Component-Hierarchie

```
App
├─ Layout
│  ├─ Header
│  ├─ Navigation
│  ├─ Main
│  │  ├─ Dashboard
│  │  ├─ Activities
│  │  │  ├─ ActivityList
│  │  │  ├─ ActivityForm
│  │  │  └─ ActivityFilter
│  │  ├─ Statistics
│  │  │  ├─ KPISummary
│  │  │  ├─ Charts
│  │  │  └─ ExportButtons
│  │  └─ Settings
│  │     ├─ CategoryManager
│  │     ├─ TagManager
│  │     └─ CohortManager
│  └─ Footer
└─ Login
```

---

## 🔄 Datenfluss

### Activity-Erfassung Flow

```
1. User öffnet ActivityForm
   └─► Load Locations, Categories, Tags, Cohorts (React Query)

2. User füllt Formular aus
   └─► Local State (react-hook-form)

3. User klickt "Speichern"
   ├─► Validation (Zod Schema)
   ├─► useMutation(createActivity)
   ├─► POST /api/activities
   ├─► Backend Validation
   ├─► Database Insert
   ├─► Response mit Activity-Objekt
   ├─► React Query Cache Invalidation
   └─► Navigate to ActivityList

4. ActivityList wird automatisch aktualisiert
   └─► Re-fetch durch Cache Invalidation
```

---

## 🛡️ Sicherheitskonzept

### Input-Validierung

```
Frontend (Client)
├─ Zod Schema Validation
└─ React Hook Form

Backend (Server)
├─ class-validator DTOs
├─ TypeScript Types
└─ NestJS ValidationPipe

Database
└─ TypeORM Entity Constraints
```

### Datenschutz-Maßnahmen

1. **Keine personenbezogenen Daten von Teilnehmenden**
   - Nur aggregierte Zählungen
   - Keine Namen, Adressen, etc.

2. **Zugriffskontrolle**
   - RBAC (Role-Based Access Control)
   - Standort-/Team-basierte Sichtbarkeit

3. **Audit-Trail**
   - Alle Änderungen protokolliert
   - CreatedBy / UpdatedBy Felder

4. **Daten-Verschlüsselung**
   - HTTPS in Produktion
   - Passwörter: bcrypt
   - JWT: Signiert mit Secret

---

## 📊 Performance-Optimierungen

### Backend
- Database Indexes auf häufige Queries (date, type, location)
- Eager Loading für Relations
- Pagination für große Listen

### Frontend
- React Query Caching (5min staleTime)
- Lazy Loading von Routes
- Optimistic Updates bei Mutations
- Virtualized Lists für lange Tabellen

---

## 🚀 Deployment

### Production Stack

```
┌──────────────────────────────────────────┐
│           NGINX (Reverse Proxy)          │
│  • HTTPS Termination                     │
│  • Static File Serving (Frontend)       │
│  • API Proxy to Backend                 │
└────────────┬─────────────────────────────┘
             │
┌────────────▼─────────────────────────────┐
│        Docker Containers                 │
│  ┌────────────────┐  ┌────────────────┐ │
│  │  NestJS API    │  │  PostgreSQL    │ │
│  └────────────────┘  └────────────────┘ │
│  ┌────────────────┐                     │
│  │     MinIO      │                     │
│  └────────────────┘                     │
└──────────────────────────────────────────┘
```

---

Erstellt: Oktober 2025  
Version: 2.0.0
