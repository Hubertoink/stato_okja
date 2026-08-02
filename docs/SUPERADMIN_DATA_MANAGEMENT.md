# Superadmin Datenverwaltung

Dieser Bereich ist für AV-/DSGVO-nahe Betriebsfälle gedacht und steht ausschließlich dem `superadmin` zur Verfügung.

Pfad im Frontend:

- Benutzer-Menü → `Datenverwaltung`

## Export

Der Export erzeugt ein einzelnes ZIP-Archiv mit:

- Tabellen werden als JSON und CSV direkt in das ZIP gestreamt; für große Installationen wird keine zusätzliche Excel-Arbeitsmappe erzeugt, damit die Daten nicht erneut vollständig im RAM liegen.
- `manifest.json` mit Zeitstempel und Summen
- `database/<tabelle>.json` für jede verwaltete TypeORM-Tabelle
- `database/<tabelle>.csv` für jede verwaltete TypeORM-Tabelle
- `uploads/...` mit allen lokal vorhandenen Upload-Dateien

Kurzlebige Authentifizierungs-Sitzungen (`auth_refresh_sessions`) werden aus
Sicherheitsgründen nicht exportiert. Benutzerkonten und Passwort-Hashes bleiben
Bestandteil des vollständigen Backups.

Der Export ist read-only und verändert keine Daten.

Das Manifest enthält zusätzlich ein Exportformat und eine Schema-Version, damit spätere Restores die ZIP vorab validieren können.

## Import / Restore

Der Import erwartet ein zuvor erzeugtes Systemdaten-ZIP und arbeitet bewusst nicht als Merge, sondern als Voll-Restore.

Ablauf:

- ZIP im Bereich `Datenverwaltung` auswählen
- Server prüft `manifest.json` und alle `database/*.json`-Dateien vorab
- aktuelles Passwort eingeben
- Bestätigungstext `BACKUP IMPORTIEREN` eingeben
- Restore im Browser bestätigen

Beim Restore werden:

- alle aktuell vorhandenen verwalteten Tabellen geleert
- alle Tabellen aus dem Backup in FK-sicherer Reihenfolge neu eingespielt
- lokale Upload-Dateien vollständig aus `uploads/...` wiederhergestellt

Der ausführende Superadmin bleibt beim Restore erhalten. Dadurch bleiben die
laufende Sitzung und die Login-Fähigkeit auch dann stabil, wenn Benutzer aus dem
Backup ersetzt werden. Ein im Backup enthaltenes Konto mit derselben ID oder
E-Mail wird für diesen einen Superadmin nicht darübergeschrieben.

Der Import ist damit ein vollständiger Replace-All-Restore. Bestehende Daten werden nicht zusammengeführt.

## Gesamtlöschung

Die Gesamtlöschung entfernt global:

- Organisationen
- Benutzer außer `superadmin`
- Aktivitäten, Projekte, Vorlagen, Taxonomien, Audit-Daten
- lokale Upload-Dateien

Erhalten bleiben:

- alle Superadmin-Konten
- deren Login-Fähigkeit
- deren aktive Sitzungen

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
