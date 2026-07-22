# StatO – Erste Schritte

## ✅ Installation & Setup (Schritt für Schritt)

### Phase 1: Grundsetup (5 Minuten)

1. **Terminal öffnen** (PowerShell als Administrator)

2. **In Projekt-Verzeichnis navigieren:**
   ```powershell
   cd <Pfad-zum-Repository>
   ```

3. **Root Dependencies installieren:**
   ```powershell
   npm install
   ```
   
   Dies installiert `concurrently` für parallele Prozesse.

### Phase 2: Backend einrichten (10 Minuten)

4. **Backend Dependencies installieren:**
   ```powershell
   cd backend
   npm install
   ```
   
   ⏳ Dies kann 2-3 Minuten dauern (viele Packages).

5. **Environment-Datei erstellen:**
   ```powershell
   Copy-Item .env.example .env
   ```

6. **Zurück ins Root-Verzeichnis:**
   ```powershell
   cd ..
   ```

### Phase 3: Frontend einrichten (10 Minuten)

7. **Frontend Dependencies installieren:**
   ```powershell
   cd frontend
   npm install
   ```
   
   ⏳ Dies kann 2-3 Minuten dauern.

8. **Zurück ins Root-Verzeichnis:**
   ```powershell
   cd ..
   ```

### Phase 4: Docker Services starten (5 Minuten)

9. **Docker Desktop prüfen:**
   - Docker Desktop muss laufen
   - Überprüfen: Symbol in Taskleiste oder `docker --version`

10. **PostgreSQL & MinIO starten:**
    ```powershell
    docker-compose up -d
    ```
    
    ⏳ Beim ersten Mal werden Images heruntergeladen (~300MB).

11. **Services-Status prüfen:**
    ```powershell
    docker-compose ps
    ```
    
    ✅ Sollte anzeigen:
    - `stato-postgres` → Up
    - `stato-minio` → Up

### Phase 5: Datenbank initialisieren (2 Minuten)

12. **Warten bis PostgreSQL bereit ist:**
    ```powershell
    # 10 Sekunden warten
    Start-Sleep -Seconds 10
    ```

13. **Migrations ausführen:**
    ```powershell
    cd backend
    npm run migration:run
    ```
    
    ✅ Sollte erfolgreich Tables erstellen.

14. **Optional: Seed-Daten laden:**
    ```powershell
    npm run seed
    ```
    
    📊 Erstellt Test-Daten, Admin-User, Kategorien, etc.

### Phase 6: Anwendung starten (2 Minuten)

15. **Backend starten (dieses Terminal offen lassen):**
    ```powershell
    # Im backend Ordner
    npm run start:dev
    ```
    
    ✅ Warten bis: `🚀 StatO Backend running on: http://localhost:3000`

16. **Neues Terminal öffnen** → Frontend starten:
    ```powershell
    cd frontend
    npm run dev
    ```
    
    ✅ Warten bis: `  ➜  Local:   http://localhost:5173/`

### Phase 7: Testen 🎉

17. **Browser öffnen:**
    - Frontend: http://localhost:5173
    - Backend API Docs: http://localhost:3000/api/docs
    - MinIO Console: http://localhost:9001

18. **Login (falls Seed-Daten geladen):**
    - Email: `admin@okja.de`
    - Passwort: `Admin123!`

---

## 🔥 Quick Commands (nach Setup)

### Alles auf einmal starten:

```powershell
# Empfohlen: startet Docker-Services + Backend + Frontend in einem Schritt
npm run dev:full

# Alternativ (2 Schritte):
docker-compose up -d
npm run dev
```

Hinweis: Wenn das Frontend `api/auth/login` mit **500** meldet, ist das in der Dev-Umgebung oft nur der Vite-Proxy, weil das Backend auf `localhost:3000` nicht läuft.
Schnellcheck: `Test-NetConnection localhost -Port 3000` (muss `TcpTestSucceeded : True` sein).

### Einzeln starten:

```powershell
# Terminal 1: Backend
cd backend
npm run start:dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

### Stoppen:

```powershell
# Backend/Frontend: STRG+C im jeweiligen Terminal

# Docker Services:
docker-compose stop
```

---

## 🐛 Häufige Probleme & Lösungen

### Problem: "Port 3000 already in use"

```powershell
# Prozess finden und beenden
netstat -ano | findstr :3000
# PID notieren, dann:
taskkill /PID <PID> /F
```

### Problem: "Cannot connect to PostgreSQL"

```powershell
# Docker-Status prüfen
docker-compose ps

# Logs ansehen
docker-compose logs postgres

# Neustart
docker-compose restart postgres
```

### Problem: "npm install" schlägt fehl

```powershell
# Node Version prüfen (min. v20)
node --version

# Cache löschen
npm cache clean --force

# Neu versuchen
npm install
```

### Problem: "Migration failed"

```powershell
# Datenbank zurücksetzen
docker-compose down -v
docker-compose up -d

# Warten, dann erneut:
cd backend
npm run migration:run
```

### Problem: Frontend zeigt "Cannot read properties of undefined"

- Backend läuft nicht → Backend starten
- API-URL falsch → Vite Config prüfen
- CORS-Error → Backend .env CORS_ORIGINS prüfen

---

## 📚 Wichtige Dateien

| Datei | Zweck |
|-------|-------|
| `docker-compose.yml` | Docker Services Konfiguration |
| `backend/.env` | Backend Umgebungsvariablen |
| `backend/src/main.ts` | Backend Entry Point |
| `frontend/vite.config.ts` | Frontend Build & Dev-Server Config |
| `frontend/src/main.tsx` | Frontend Entry Point |

---

## 🎯 Nächste Entwicklungsschritte

Nach erfolgreichem Setup:

1. **Backend erweitern:**
   - Auth-Module vervollständigen (`backend/src/auth/`)
   - Validierungen hinzufügen (DTOs)
   - Seed-Daten erstellen (`backend/src/database/seeds/`)

2. **Frontend erweitern:**
   - API-Integration (`frontend/src/api/`)
   - State Management (Zustand Stores)
   - Formular-Validierung (Zod Schemas)

3. **Testing:**
   - Unit Tests schreiben
   - E2E Tests mit Playwright

4. **Features:**
   - Attachment-Upload (MinIO Integration)
   - PWA-Manifest konfigurieren
   - Offline-Support

---

## 📞 Entwickler-Kontakt

Bei Fragen zum Code:
- Dokumentation: `docs/ARCHITECTURE.md`
- API Docs: http://localhost:3000/api/docs
- GitHub Issues: (Repository-Link)

---

**Happy Coding! 🚀**
