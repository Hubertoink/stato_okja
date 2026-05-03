# Windows Aufgabenplanung fuer StatO On-Prem

Diese Anleitung richtet taegliche Health- und Backup-Laeufe unter Windows ueber die Aufgabenplanung ein.

## Empfohlener Standard

Das taegliche Betriebskommando ist:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\onprem-daily-ops.ps1
```

Das Skript:

- prueft `http://localhost/api/health` vor und nach dem Backup,
- fuehrt das einfache On-Prem-Backup aus,
- exportiert das Backup in `backups\stato-container-<timestamp>`,
- schreibt ein JSON-Protokoll nach `backups\logs\stato-daily-ops-<timestamp>.json`.

## Variante A: XML-Vorlage importieren

Vorlage: `scripts/onprem-daily-backup-task.xml`

1. Platzhalter in eine lokale Datei ersetzen:

```powershell
$root = (Resolve-Path .).Path
$user = "$env:USERDOMAIN\$env:USERNAME"
(Get-Content .\scripts\onprem-daily-backup-task.xml) `
  -replace '__STATO_ROOT__', $root `
  -replace '__TASK_USER__', $user | Set-Content .\scripts\onprem-daily-backup-task.local.xml -Encoding Unicode
```

2. Aufgabe importieren:

```powershell
schtasks /Create /TN "StatO OnPrem Daily Backup" /XML .\scripts\onprem-daily-backup-task.local.xml /F
```

3. Optional sofort testen:

```powershell
schtasks /Run /TN "StatO OnPrem Daily Backup"
```

## Variante B: Manuell in der GUI anlegen

1. Windows Aufgabenplanung oeffnen.
2. `Aufgabe erstellen...` waehlen.
3. Name: `StatO OnPrem Daily Backup`.
4. `Mit hoechsten Privilegien ausfuehren` aktivieren.
5. Trigger: taeglich, z. B. `03:00`.
6. Aktion: `Programm starten`.
7. Programm/Skript: `powershell.exe`
8. Argumente:

```text
-NoProfile -ExecutionPolicy Bypass -File "C:\Pfad\zu\stato_okja\scripts\onprem-daily-ops.ps1"
```

9. Starten in:

```text
C:\Pfad\zu\stato_okja
```

## Nach jedem Lauf pruefen

- Liegt ein neues Verzeichnis unter `backups\stato-container-*`?
- Liegt ein neues JSON-Protokoll unter `backups\logs\`?
- Ist `PreHealthOk` und `PostHealthOk` im JSON jeweils `true`?
- Wurde das Backup anschliessend offsite oder ueber Volume-/Projektbackup weiter gesichert?

## Restore-Komfortweg

Fuer einen Restore des neuesten lokalen Backups gibt es zusaetzlich:

```powershell
.\scripts\onprem-restore-easy.ps1
```

Nur Vorschau des ausgewaehlten Backups:

```powershell
.\scripts\onprem-restore-easy.ps1 -Preview
```