# Security-Prioritaeten 1-6

Stand: 2026-05-02

Diese Datei haelt den Umsetzungsstand der nachgelagerten Security-Prioritaeten fest. Sie ergaenzt den bestehenden Hardening-Plan fuer Container, Deployment und Auth.

## Statusuebersicht

| Prioritaet | Status | Umsetzung |
| --- | --- | --- |
| 1. Backup/Restore plus Restore-Test | Umgesetzt | Docker-basierte PowerShell-Backup/Restore-Skripte, Superadmin-Hinweis, Runbook, Retention-Option und Restore-Testprotokoll ergaenzt. |
| 2. Produktives Logging und SMTP-/Reset-Verhalten | Umgesetzt | Invite-/Reset-Links werden bei fehlendem SMTP im Strict-Security-Mode nicht mehr geloggt, sondern als Fehler behandelt. |
| 3. DTO-/Validation-Ausbau | Teilweise umgesetzt | Systemdaten-Import/Purge haben DTO-Validierung; globaler Exception-Filter normalisiert Fehlerantworten und redigiert 500er in Strict Mode. |
| 4. Dependency-Findings | Teilweise umgesetzt | Nicht-brechende Audit-Fixes angewendet, `jspdf` aktualisiert, direkte `xlsx`-Nutzung entfernt. Rest erfordert Major-Upgrades oder Paketentscheidung. |
| 5. Multi-Device Sessions | Umgesetzt | Neue Refresh-Session-Tabelle, Migration, Backend-Endpunkte und Profil-UI fuer aktive Sitzungen. |
| 6. TOM-/DSGVO-/ISO-Nachweise | Umgesetzt als Arbeitsdokument | Nachweis- und Massnahmenmatrix erstellt; organisatorische Freigaben muessen im Betrieb ergaenzt werden. |

## Details

### 1. Backup/Restore

Neue Dateien:

- `scripts/onprem-backup.ps1`
- `scripts/onprem-restore.ps1`
- `docs/security/BACKUP_RESTORE_RUNBOOK_2026-05-02.md`

Der Backup-Pfad exportiert Postgres als Custom-Dump und archiviert den Upload-Volume-Inhalt ueber Docker-Container. Der Restore-Pfad verlangt den expliziten Text `RESTORE STATO BACKUP`, ersetzt Datenbank und Uploads und startet die App-Container neu. Die Skripte verwenden `docker compose`, temporaere Volume-Container und `docker cp`, sodass sie auch mit einem erreichbaren Docker-Context auf einem externen Host genutzt werden koennen.

Die Superadmin-Datenverwaltung zeigt den Betriebsbackup-Pfad inklusive Backup-, Restore- und Scheduler-Kommando als Kopiervorlage. Die Ausfuehrung bleibt bewusst Host-/Betriebsebene.

### 2. Logging und SMTP

`EmailService` loggt Invite- und Passwort-Reset-Links nur noch ausserhalb von Strict-Security-Mode, wenn kein SMTP-Transport konfiguriert ist. In Produktion/Staging oder bei `STRICT_SECURITY_MODE=true` schlaegt der Versand ohne SMTP-Konfiguration fehl.

### 3. DTO/Validation und Fehlerform

Ergaenzt wurde `ConfirmSystemDataOperationDto` fuer destruktive Systemdaten-Operationen. Der globale `HttpExceptionFilter` sorgt fuer konsistente Fehlerantworten; interne Fehlermeldungen werden im Strict-Security-Mode bei 500er-Fehlern nicht an Clients ausgegeben.

Naechste sinnvolle DTO-Ausbaustufe: wichtigste Schreib-Endpunkte in `activities`, `projects`, `staff` und `taxonomy` durchgehen und verbleibende reine Body-Typen in DTOs ueberfuehren.

### 4. Dependencies

Umgesetzt:

- `npm audit fix --workspaces` fuer kompatible Updates.
- `jspdf` auf `^4.2.1` aktualisiert, kritisches Finding entfernt.
- Direkte `xlsx`-Abhaengigkeiten aus Backend und Frontend entfernt.
- Backend-Systemdaten-Workbook nutzt jetzt einen internen JSZip-basierten XLSX-Writer.
- Direkte Backend-`multer`-Version auf `^2.1.1` aktualisiert; die verbleibende Nest-transitive Multer-Kante bleibt bis zum Nest-Major bestehen.

Restliste und Entscheidung: `docs/security/DEPENDENCY_FINDINGS_2026-05-02.md`.

### 5. Multi-Device Sessions

Neue Tabelle: `auth_refresh_sessions`.

Umsetzung:

- Refresh Sessions werden pro Geraet/Browser gespeichert, nicht mehr als einzelne User-Spalten-Session.
- Bestehende gueltige Legacy-Refresh-Sessions werden in der Migration uebernommen.
- Refresh rotiert weiterhin Token und CSRF-Token.
- Logout widerruft die aktuelle Refresh Session idempotent.
- Passwortaenderung und Reset widerrufen alle Refresh Sessions des Users.
- Profilseite zeigt aktive Sessions mit User-Agent, IP, letzter Nutzung und Ablaufdatum.
- Einzelne Sessions koennen im Profil widerrufen werden.

### 6. TOM/DSGVO/ISO

Nachweisdokument: `docs/security/TOM_DSGVO_ISO_EVIDENCE_2026-05-02.md`.

Das Dokument ordnet technische Massnahmen den Nachweisartefakten zu. Es ersetzt keine organisatorische Freigabe, liefert aber die technische Evidenz fuer Betrieb, Audit und interne Dokumentation.

## Validierung

Durchgefuehrt:

- `npm run -w backend build`
- `npm run -w frontend type-check`
- `npm run -w frontend build`
- `npm audit --workspaces --json`

Aktueller Audit-Stand nach Umsetzung: 0 critical, 17 high, 20 moderate, 4 low. Die verbleibenden Highs sind in der Dependency-Doku klassifiziert.