# Superadmin Datenverwaltung

Dieser Bereich ist für AV-/DSGVO-nahe Betriebsfälle gedacht und steht ausschließlich dem `superadmin` zur Verfügung.

Pfad im Frontend:

- Benutzer-Menü → `Datenverwaltung`

## Export

Der Export erzeugt ein einzelnes ZIP-Archiv mit:

- `readable/stato-system-data-readable.xlsx` als bereinigte Arbeitsmappe mit mehreren Reitern ohne technische IDs
- `manifest.json` mit Zeitstempel und Summen
- `database/<tabelle>.json` für jede verwaltete TypeORM-Tabelle
- `database/<tabelle>.csv` für jede verwaltete TypeORM-Tabelle
- `uploads/...` mit allen lokal vorhandenen Upload-Dateien

Der Export ist read-only und verändert keine Daten.

## Gesamtlöschung

Die Gesamtlöschung entfernt global:

- Organisationen
- Benutzer außer `superadmin`
- Aktivitäten, Projekte, Vorlagen, Taxonomien, Audit-Daten
- lokale Upload-Dateien

Erhalten bleiben:

- alle Superadmin-Konten
- deren Login-Fähigkeit

Nach der Löschung werden verbliebene Superadmins automatisch von gelöschten Organisationen entkoppelt (`orgId = null`).

## Sicherheitsmechanismen

Die Löschung ist nur möglich mit:

- aktuellem Passwort des ausführenden Superadmins
- exakt eingegebenem Bestätigungstext `ALLE DATEN LOESCHEN`
- zusätzlicher Browser-Bestätigung im Frontend

Zusätzlich wird die Aktion im Audit-Log als eigener Systemeintrag neu protokolliert.

## Technische Einstiegspunkte

- Backend Controller: `backend/src/system-data/system-data.controller.ts`
- Backend Service: `backend/src/system-data/system-data.service.ts`
- Frontend Hooks: `frontend/src/lib/systemData.ts`
- Frontend Seite: `frontend/src/pages/SuperAdminSystemData.tsx`