# Contributing to Stato 2.0

Vielen Dank für dein Interesse, zu Stato 2.0 beizutragen! 🎉

---

## 📋 Code of Conduct

Bitte behandle alle Contributors mit Respekt. Dieses Projekt soll ein inklusives und positives Umfeld bieten.

---

## 🚀 Wie kann ich beitragen?

### Bug Reports

Wenn du einen Bug findest:

1. **Prüfen**, ob der Bug bereits gemeldet wurde (GitHub Issues)
2. **Neues Issue erstellen** mit:
   - Klarer Titel
   - Schritte zur Reproduktion
   - Erwartetes vs. tatsächliches Verhalten
   - Screenshots (falls relevant)
   - Umgebung (OS, Node Version, Browser)

**Beispiel:**
```markdown
### Bug: Activity Form speichert keine Tags

**Schritte:**
1. Neue Aktivität erstellen
2. Tags eingeben
3. Speichern

**Erwartet:** Tags werden gespeichert
**Tatsächlich:** Tags fehlen nach Speichern

**Umgebung:**
- Windows 11
- Node v20.10.0
- Chrome 120.0
```

### Feature Requests

Für neue Features:

1. **Diskussion eröffnen** (GitHub Discussions)
2. **Beschreibe**:
   - Use Case / Problem
   - Vorgeschlagene Lösung
   - Alternativen
   - Mockups/Wireframes (optional)

### Pull Requests

1. **Fork** das Repository
2. **Branch erstellen**: `git checkout -b feature/mein-feature`
3. **Änderungen machen** (siehe Code-Standards unten)
4. **Testen** (Unit + E2E)
5. **Commit**: aussagekräftige Messages (siehe Konventionen)
6. **Push**: `git push origin feature/mein-feature`
7. **Pull Request erstellen**

---

## 💻 Development Setup

Siehe [GETTING_STARTED.md](GETTING_STARTED.md) für vollständiges Setup.

**Quick Start:**
```powershell
git clone <repo-url>
cd Stato_2.0
npm install
cd backend && npm install
cd ../frontend && npm install
docker-compose up -d
cd backend && npm run migration:run
npm run start:dev # Backend
# Neues Terminal:
cd frontend && npm run dev
```

---

## 📝 Code Standards

### TypeScript

- **Strict Mode** ist aktiv
- **Keine `any` Types** (außer begründete Ausnahmen)
- **Interface über Type** für Objekte
- **Enums** für feste Wertelisten

**Gut:**
```typescript
interface Activity {
  id: string;
  date: Date;
  type: ActivityType;
}
```

**Schlecht:**
```typescript
const activity: any = { ... };
```

### Naming Conventions

| Element | Convention | Beispiel |
|---------|-----------|----------|
| Komponenten | PascalCase | `ActivityForm.tsx` |
| Hooks | camelCase mit `use` | `useActivities.ts` |
| Services | PascalCase + Service | `ActivitiesService` |
| Constants | UPPER_SNAKE_CASE | `MAX_FILE_SIZE` |
| Interfaces | PascalCase (kein `I` Prefix) | `Activity`, nicht `IActivity` |

### Backend (NestJS)

- **DTOs** für alle Request/Response Bodies
- **class-validator** für Validierung
- **Swagger Decorators** für API-Docs
- **Service-Controller Trennung**

**Beispiel:**
```typescript
// DTO
export class CreateActivityDto {
  @IsDate()
  @ApiProperty()
  date: Date;

  @IsEnum(ActivityType)
  @ApiProperty({ enum: ActivityType })
  type: ActivityType;
}

// Controller
@Post()
@ApiOperation({ summary: 'Create activity' })
create(@Body() dto: CreateActivityDto) {
  return this.service.create(dto);
}
```

### Frontend (React)

- **Functional Components** mit Hooks
- **Props Interfaces** für alle Components
- **React Query** für API-Calls
- **Tailwind** für Styling (keine inline styles)

**Beispiel:**
```typescript
interface ActivityCardProps {
  activity: Activity;
  onEdit: (id: string) => void;
}

export function ActivityCard({ activity, onEdit }: ActivityCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-bold">{activity.type}</h3>
      <button onClick={() => onEdit(activity.id)}>Edit</button>
    </div>
  );
}
```

### CSS/Styling

- **Tailwind Utility-First**
- **Custom CSS nur für Sonderfälle**
- **Responsive Design** (mobile first)
- **Stato Farbpalette** verwenden:
  - `viridian`, `cambridge-blue`, `mint-green`, `azure-web`, `mint-cream`

---

## 🧪 Testing

### Unit Tests

```powershell
# Backend
cd backend
npm run test

# Frontend
cd frontend
npm run test
```

**Mindestens testen:**
- Services (Business Logic)
- Utilities
- Komplexe Components

**Beispiel (Jest):**
```typescript
describe('ActivityService', () => {
  it('should calculate total participants', () => {
    const activity = { countMale: 5, countFemale: 3, countDiverse: 1 };
    const total = calculateTotal(activity);
    expect(total).toBe(9);
  });
});
```

---

## 📦 Commit Konventionen

Wir folgen [Conventional Commits](https://www.conventionalcommits.org/):

**Format:**
```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**Types:**
- `feat`: Neues Feature
- `fix`: Bug-Fix
- `docs`: Dokumentation
- `style`: Formatierung (kein Code-Änderung)
- `refactor`: Code-Umstrukturierung
- `test`: Tests hinzufügen/ändern
- `chore`: Build/Tool-Konfiguration

**Beispiele:**
```
feat(activities): add cohort validation

fix(auth): resolve JWT expiration issue

docs(api): update authentication examples

style(frontend): format ActivityForm component

refactor(backend): extract activity validation logic

test(activities): add unit tests for service

chore(deps): update NestJS to v10.3
```

**Scope (optional):**
- `activities`, `auth`, `taxonomy`, `stats`
- `frontend`, `backend`, `docker`, `docs`

---

## 🔀 Pull Request Process

### 1. Before PR

- [ ] Branch ist up-to-date mit `main`
- [ ] Code folgt Style-Guide
- [ ] Tests laufen durch
- [ ] Keine Console-Logs/Debugger
- [ ] Dokumentation aktualisiert (falls nötig)

### 2. PR Template

Titel:
```
feat(activities): Add export to CSV functionality
```

Beschreibung:
```markdown
## Änderungen
- Export-Button im Activity-Dashboard
- CSV-Generation im Backend
- Download-Trigger im Frontend

## Testing
- [ ] Manuell getestet
- [ ] Unit Tests hinzugefügt
- [ ] E2E Test aktualisiert

## Screenshots
[Screenshot einfügen]

## Breaking Changes
Keine

## Related Issues
Closes #42
```

### 3. Review Process

- Mind. 1 Approval erforderlich
- Alle Kommentare müssen resolved sein
- CI muss grün sein

### 4. Nach Merge

- Branch löschen
- Issue schließen (falls vorhanden)
- Changelog aktualisieren (bei Releases)

---

## 🏗️ Projekt-Struktur

```
Stato_2.0/
├── backend/
│   ├── src/
│   │   ├── activities/       # Activities Module
│   │   ├── auth/             # Authentication
│   │   ├── taxonomy/         # Categories/Tags/Cohorts
│   │   ├── staff/            # Staff Management
│   │   ├── locations/        # Locations
│   │   ├── stats/            # Statistics
│   │   ├── common/           # Shared Code (Enums, DTOs)
│   │   ├── config/           # Configuration
│   │   └── database/         # Migrations & Seeds
│   └── test/                 # E2E Tests
│
├── frontend/
│   └── src/
│       ├── components/       # Reusable Components
│       ├── pages/            # Route Pages
│       ├── api/              # API Client
│       ├── stores/           # Zustand Stores
│       ├── hooks/            # Custom Hooks
│       ├── types/            # TypeScript Types
│       └── utils/            # Utilities
│
└── docs/                     # Dokumentation
```

---

## 🎯 Prioritäten

### High Priority
- [ ] Auth-Modul vervollständigen
- [ ] Seed-Daten Script
- [ ] Frontend-Backend Integration
- [ ] Validierungen

### Medium Priority
- [ ] Attachment-Upload
- [ ] PWA Features
- [ ] E2E Tests
- [ ] Accessibility

### Low Priority
- [ ] Advanced Analytics
- [ ] PDF-Export
- [ ] Multi-Tenancy

---

## 📞 Fragen?

- **GitHub Discussions** für allgemeine Fragen
- **GitHub Issues** für Bugs/Features
- **Email:** dev@okja-stato.de

---

**Danke für deinen Beitrag! 🙏**
