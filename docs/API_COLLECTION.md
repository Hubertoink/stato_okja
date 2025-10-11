# Stato 2.0 API Collection

Beispiel-Requests für Testing mit REST-Clients (Postman, Insomnia, Thunder Client)

## Base URL
```
http://localhost:3000/api
```

---

## 🔐 Authentication

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "admin@okja.de",
  "password": "Admin123!"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "admin@okja.de",
    "name": "Admin User",
    "role": "admin"
  }
}
```

### Refresh Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGc..."
}
```

---

## 📋 Activities

### Get All Activities
```http
GET /activities?from=2025-10-01&to=2025-10-31&type=open_door
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- `from` (optional): Start date (YYYY-MM-DD)
- `to` (optional): End date (YYYY-MM-DD)
- `type` (optional): Activity type
- `locationId` (optional): Location UUID
- `staffId` (optional): Staff UUID

### Get Activity by ID
```http
GET /activities/{id}
Authorization: Bearer {accessToken}
```

### Create Activity
```http
POST /activities
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "date": "2025-10-10",
  "startTime": "14:00:00",
  "endTime": "16:00:00",
  "durationMinutes": 120,
  "type": "open_door",
  "locationId": "uuid-location",
  "countMale": 8,
  "countFemale": 6,
  "countDiverse": 1,
  "countTotal": 15,
  "cohorts": [
    {
      "cohortId": "uuid-cohort-6-9",
      "count": 5
    },
    {
      "cohortId": "uuid-cohort-10-13",
      "count": 10
    }
  ],
  "categories": [
    "uuid-category-1"
  ],
  "tags": [
    "uuid-tag-1",
    "uuid-tag-2"
  ],
  "staff": [
    "uuid-staff-1"
  ],
  "notes": "Sehr gut besucht, tolle Stimmung!",
  "goals": "Kontakte knüpfen, Vertrauen aufbauen"
}
```

### Update Activity
```http
PATCH /activities/{id}
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "countTotal": 18,
  "notes": "Aktualisiert: 3 Teilnehmende kamen später dazu"
}
```

### Delete Activity
```http
DELETE /activities/{id}
Authorization: Bearer {accessToken}
```

---

## 🏷️ Taxonomy

### Categories

#### Get All Categories
```http
GET /taxonomy/categories?active=true
Authorization: Bearer {accessToken}
```

#### Create Category
```http
POST /taxonomy/categories
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name": "Sport & Bewegung",
  "standardRef": "LJA-01-Sport",
  "description": "Alle sportlichen Aktivitäten",
  "color": "#a4c3b2",
  "active": true
}
```

#### Update Category
```http
PATCH /taxonomy/categories/{id}
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "active": false
}
```

### Tags

#### Get All Tags
```http
GET /taxonomy/tags?active=true&search=fußball
Authorization: Bearer {accessToken}
```

#### Create Tag
```http
POST /taxonomy/tags
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name": "Fußball",
  "synonyms": ["soccer", "kicken"],
  "color": "#cce3de",
  "active": true
}
```

### Cohorts

#### Get All Cohorts
```http
GET /taxonomy/cohorts?active=true
Authorization: Bearer {accessToken}
```

#### Create Cohort
```http
POST /taxonomy/cohorts
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name": "6-9 Jahre",
  "minAge": 6,
  "maxAge": 9,
  "sortOrder": 1,
  "active": true
}
```

---

## 👥 Staff

### Get All Staff
```http
GET /staff?active=true
Authorization: Bearer {accessToken}
```

### Get Staff by ID
```http
GET /staff/{id}
Authorization: Bearer {accessToken}
```

### Create Staff Member
```http
POST /staff
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "email": "max.mustermann@okja.de",
  "password": "SecurePassword123!",
  "name": "Max Mustermann",
  "role": "employee",
  "phone": "+49 123 456789",
  "notes": "Hauptverantwortlich für Medienraum",
  "active": true
}
```

**Roles:**
- `admin`
- `lead`
- `employee`
- `volunteer`
- `helper`
- `analyst`

### Update Staff Member
```http
PATCH /staff/{id}
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "phone": "+49 987 654321",
  "notes": "Jetzt auch für Werkraum zuständig"
}
```

---

## 📍 Locations

### Get All Locations
```http
GET /locations?active=true
Authorization: Bearer {accessToken}
```

### Create Location
```http
POST /locations
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name": "Medienraum",
  "address": "Jugendhaus, 1. OG",
  "roomType": "media",
  "description": "Raum mit PCs, Konsolen, VR-Equipment",
  "active": true
}
```

### Update Location
```http
PATCH /locations/{id}
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "description": "Neu: zusätzliche Gaming-PCs"
}
```

---

## 📊 Statistics

### Get Summary Stats
```http
GET /stats/summary?from=2025-10-01&to=2025-10-31
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "totalActivities": 42,
  "totalParticipants": 387,
  "totalMale": 198,
  "totalFemale": 175,
  "totalDiverse": 14,
  "totalDuration": 1260,
  "averageParticipants": 9.2
}
```

### Get Stats by Category
```http
GET /stats/by-category?from=2025-10-01&to=2025-10-31
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "categories": [
    {
      "name": "Sport & Bewegung",
      "count": 12,
      "participants": 156
    },
    {
      "name": "Kreativität",
      "count": 8,
      "participants": 94
    }
  ]
}
```

### Get Stats by Cohort
```http
GET /stats/by-cohort?from=2025-10-01&to=2025-10-31
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "cohorts": [
    {
      "name": "6-9 Jahre",
      "count": 45,
      "male": 23,
      "female": 20,
      "diverse": 2
    },
    {
      "name": "10-13 Jahre",
      "count": 132,
      "male": 68,
      "female": 62,
      "diverse": 2
    }
  ]
}
```

### Export CSV
```http
GET /export/csv?from=2025-10-01&to=2025-10-31&type=activities
Authorization: Bearer {accessToken}
```

**Response:** CSV File Download

---

## 🧪 Testing Tips

### 1. Environment Setup (Postman/Insomnia)

**Variables:**
```
baseUrl: http://localhost:3000/api
accessToken: (set after login)
```

### 2. Pre-request Scripts (Postman)

Automatisch Token setzen nach Login:
```javascript
// In Login Request → Tests Tab
const response = pm.response.json();
pm.environment.set("accessToken", response.accessToken);
```

### 3. Authorization Header

Alle geschützten Requests:
```
Authorization: Bearer {{accessToken}}
```

### 4. Test Data IDs

Nach Seed-Daten haben folgende Entities bekannte IDs:
- Admin User: `admin@okja.de`
- Standard-Location: "Haupthaus"
- Standard-Kategorie: "Offene Tür"

Verwende `GET /categories`, `GET /locations` etc. um UUIDs zu ermitteln.

---

## 📝 Response Codes

| Code | Bedeutung |
|------|-----------|
| 200 | OK - Erfolgreiche GET/PATCH/DELETE |
| 201 | Created - Erfolgreiche POST |
| 400 | Bad Request - Validierungsfehler |
| 401 | Unauthorized - Fehlende/ungültige Auth |
| 403 | Forbidden - Keine Berechtigung |
| 404 | Not Found - Ressource nicht gefunden |
| 500 | Internal Server Error - Server-Fehler |

---

## 🔄 Workflow Example: Complete Activity Creation

1. **Login:**
   ```
   POST /auth/login
   → Erhalte accessToken
   ```

2. **Get necessary IDs:**
   ```
   GET /locations → locationId
   GET /taxonomy/categories → categoryIds
   GET /taxonomy/cohorts → cohortIds
   GET /staff → staffIds
   ```

3. **Create Activity:**
   ```
   POST /activities
   → Mit allen IDs aus Schritt 2
   ```

4. **Verify:**
   ```
   GET /activities/{newActivityId}
   → Prüfe ob korrekt angelegt
   ```

5. **Update if needed:**
   ```
   PATCH /activities/{newActivityId}
   → Anpassungen vornehmen
   ```

6. **Get Stats:**
   ```
   GET /stats/summary
   → Neue Activity sollte in Stats erscheinen
   ```

---

**API Version:** 2.0.0  
**Last Updated:** Oktober 2025
