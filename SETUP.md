# StatO – Setup Guide

## 🚀 Schnellstart

### 1. Voraussetzungen prüfen

```powershell
# Node.js Version prüfen (mindestens v20)
node --version

# Docker Version prüfen
docker --version
docker-compose --version

# Git Version prüfen
git --version
```

### 2. Projekt klonen und Dependencies installieren

```powershell
cd <Pfad-zum-Repository>

# Root Dependencies
npm install

# Backend Dependencies
cd backend
npm install
cd ..

# Frontend Dependencies
cd frontend
npm install
cd ..
```

### 3. Umgebungsvariablen konfigurieren

```powershell
# Backend .env Datei erstellen
Copy-Item backend\.env.example backend\.env

# Frontend .env Datei (optional)
# Vite verwendet standardmäßig .env.local
```

**Backend .env anpassen:**
```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=stato_user
DB_PASSWORD=stato_dev_password
DB_DATABASE=stato_dev
JWT_SECRET=CHANGE_THIS_IN_PRODUCTION
```

### 4. Docker Services starten

```powershell
# PostgreSQL und MinIO starten
docker-compose up -d

# Logs verfolgen
docker-compose logs -f

# Services prüfen
docker-compose ps
```

### 5. Datenbank initialisieren

```powershell
cd backend

# Migrations ausführen
npm run migration:run

# Seed-Daten laden (optional)
npm run seed
```

### 6. Backend starten

```powershell
# Im backend Ordner
npm run start:dev
```

Backend läuft auf: http://localhost:3000  
API Dokumentation: http://localhost:3000/api/docs

### 7. Frontend starten (neues Terminal)

```powershell
cd frontend
npm run dev
```

Frontend läuft auf: http://localhost:5173

---

## 🎯 Entwicklungs-Workflows

### Backend entwickeln

```powershell
cd backend

# Development Mode (Hot Reload)
npm run start:dev

# Tests ausführen
npm run test

# Coverage Report
npm run test:cov

# TypeScript prüfen
npm run build
```

### Frontend entwickeln

```powershell
cd frontend

# Development Server
npm run dev

# TypeScript prüfen
npm run type-check

# Production Build testen
npm run build
npm run preview
```

### Datenbank-Änderungen

```powershell
cd backend

# Neue Migration erstellen
npm run migration:create -- src/database/migrations/MigrationName

# Migration generieren (aus Entity-Änderungen)
npm run migration:generate -- src/database/migrations/MigrationName

# Migrations anwenden
npm run migration:run

# Migration rückgängig machen
npm run migration:revert
```

---

## 📦 Docker Management

### Services verwalten

```powershell
# Alle Services starten
docker-compose up -d

# Bestimmten Service starten
docker-compose up -d postgres

# Services stoppen
docker-compose stop

# Services stoppen und entfernen
docker-compose down

# Services neu bauen
docker-compose up -d --build

# Volumes auch löschen (ACHTUNG: Datenverlust!)
docker-compose down -v
```

### Datenbank-Zugriff

```powershell
# PostgreSQL Shell
docker exec -it stato-postgres psql -U stato_user -d stato_dev

# SQL Befehle ausführen
docker exec -it stato-postgres psql -U stato_user -d stato_dev -c "SELECT * FROM staff;"
```

### MinIO Console

- URL: http://localhost:9001
- Username: `minioadmin`
- Password: `minioadmin123`

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

---

## 🔧 Troubleshooting

### Port bereits belegt

```powershell
# Port-Nutzung prüfen
netstat -ano | findstr :3000
netstat -ano | findstr :5432

# Prozess beenden (PID ersetzen)
taskkill /PID <PID> /F
```

### Docker-Probleme

```powershell
# Docker neu starten
docker-compose restart

# Logs ansehen
docker-compose logs postgres
docker-compose logs minio

# Container-Status prüfen
docker ps -a
```

### Dependencies-Probleme

```powershell
# Node Modules neu installieren
Remove-Item -Recurse -Force node_modules
npm install

# Cache löschen
npm cache clean --force
```

### Datenbank zurücksetzen

```powershell
# Docker Volume löschen
docker-compose down -v

# Neu aufsetzen
docker-compose up -d
cd backend
npm run migration:run
npm run seed
```

---

## 📊 Seed-Daten

Die Seed-Daten umfassen:

- **Kategorien:** Landesjugendamt-Standard
- **Tags:** Beispiel-Tags (Sport, Kreativ, Medien, etc.)
- **Kohorten:** 6-9, 10-13, 14-17, 18-21, 22+
- **Standorte:** Haupthaus, Medienraum, Werkraum
- **Staff:** Admin-User, Test-Mitarbeitende
- **Beispiel-Aktivitäten:** 10 Test-Einträge

### Admin-Zugangsdaten (nach Seed)

- **Email:** admin@okja.de
- **Passwort:** Admin123!

---

## 🔒 Produktion

### Build erstellen

```powershell
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build
```

### Docker Production Build

```powershell
docker-compose -f docker-compose.prod.yml up -d
```

### Wichtige Sicherheitshinweise

1. **JWT_SECRET** ändern
2. **Datenbank-Passwörter** ändern
3. **HTTPS** aktivieren (nginx + Let's Encrypt)
4. **CORS** Einstellungen anpassen
5. **Rate Limiting** konfigurieren

---

## 📝 Nächste Schritte

1. ✅ Projekt-Setup abgeschlossen
2. ⬜ Auth-Module vollständig implementieren
3. ⬜ Frontend-Backend-Integration testen
4. ⬜ Seed-Daten erstellen und laden
5. ⬜ Validierungen verfeinern
6. ⬜ E2E-Tests schreiben
7. ⬜ PWA-Features aktivieren
8. ⬜ Deployment vorbereiten

---

## 🆘 Support

Bei Problemen:
1. Logs prüfen: `docker-compose logs -f`
2. Backend-Logs: Terminal mit `npm run start:dev`
3. Browser-Konsole: F12 in Chrome/Edge

---

**Viel Erfolg mit StatO! 🎉**
