# Backup- und Restore-Runbook

Stand: 2026-05-02

Dieses Runbook beschreibt die technischen Backup- und Restore-Pfade fuer StatO-On-Prem-Installationen. Es ergaenzt den Superadmin-Systemdatenexport um ein containerbasiertes Betriebsbackup fuer Postgres und Uploads.

Die Skripte laufen ueber Docker Compose und Docker-Container. Sie muessen auf einer Maschine ausgefuehrt werden, deren Docker CLI Zugriff auf den passenden Compose-Stack hat. Das kann der lokale On-Prem-Host oder ein konfigurierter Docker-Context fuer einen externen/off-premise Docker-Host sein.

## Backup-Ziele

- Datenbank: Postgres-Custom-Dump mit `pg_dump --format=custom`.
- Dateien: vollstaendiges Archiv des Backend-Upload-Volumes.
- Nachweis: `manifest.json` je Backup-Verzeichnis mit Zeitstempel, Format und enthaltenen Dateien.

## Backup Erstellen

Aus dem Repository-Root:

```powershell
.\scripts\onprem-backup.ps1 -ComposeFile docker-compose.onprem.yml -EnvFile .env.onprem -RetentionDays 14
```

Das Script erzeugt unter `backups/stato-onprem-<timestamp>/`:

- `postgres.dump`
- `uploads.tar.gz`
- `manifest.json`

Die Backup-Verzeichnisse duerfen nicht im Repository committet werden. Sie gehoeren verschluesselt und getrennt vom Produktivsystem abgelegt. Mit `-RetentionDays 14` werden lokale Backup-Verzeichnisse mit dem Muster `stato-onprem-*` entfernt, wenn sie aelter als 14 Tage sind.

## Docker-/Off-Prem-Ausfuehrung

Die Skripte greifen nicht direkt auf interne Backend-Dateipfade zu. Sie verwenden:

- `docker compose exec postgres` fuer `pg_dump` und `pg_restore`.
- `docker cp` fuer den Transfer der Postgres-Dumps.
- temporaere Alpine-Container mit dem Upload-Volume fuer `uploads.tar.gz`.
- `docker cp` fuer Upload-Archiv-Transfer in beide Richtungen.

Dadurch funktioniert der Ablauf auch mit einem Docker-Context auf einem anderen Host, solange `docker compose` denselben Stack und dessen Volumes erreicht. Der Zielpfad `backups/` liegt aus Sicht der Maschine, auf der das Skript ausgefuehrt wird.

## Restore Testen

Ein Restore ist destruktiv und ersetzt Datenbankinhalte sowie Upload-Dateien. Daher ist ein expliziter Bestaetigungstext erforderlich:

```powershell
.\scripts\onprem-restore.ps1 -BackupDir .\backups\stato-onprem-YYYYMMDD-HHMMSS -ConfirmText "RESTORE STATO BACKUP"
```

Das Restore-Script:

- startet Postgres,
- stoppt Backend und Frontend,
- spielt `postgres.dump` per `pg_restore --clean --if-exists` ein,
- ersetzt den Upload-Volume-Inhalt aus `uploads.tar.gz`,
- startet Backend und Frontend wieder.

## Automatisiertes Backup

Automatisierte Backups sollten auf Host-/Betriebsebene eingerichtet werden, nicht aus der Webanwendung heraus. Beispiel-Kommando fuer Windows Aufgabenplanung:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\onprem-backup.ps1 -ComposeFile docker-compose.onprem.yml -EnvFile .env.onprem -RetentionDays 14
```

Empfehlung fuer den Task:

- taeglich ausserhalb der Hauptnutzungszeit ausfuehren,
- Arbeitsverzeichnis auf das Repository-/Deployment-Verzeichnis setzen,
- Ausfuehrung mit einem technischen Admin-Konto, das Docker nutzen darf,
- Rueckgabecode und Ausgabe protokollieren,
- Backup-Verzeichnis regelmaessig verschluesselt offsite kopieren.

Im Superadmin-Bereich `Datenverwaltung` sind die Betriebsbackup-Kommandos als Orientierung und Kopiervorlage hinterlegt. Die Webanwendung fuehrt die Docker-Kommandos bewusst nicht selbst aus, damit keine Docker- oder Host-Rechte an das Backend gebunden werden.

## Restore-Pruefprotokoll

Nach jedem Restore-Test ist mindestens festzuhalten:

| Feld | Wert |
| --- | --- |
| Backup-Zeitpunkt |  |
| Restore-Test-Zeitpunkt |  |
| Zielumgebung |  |
| Ausfuehrende Person |  |
| Ergebnis `docker compose ps` |  |
| Ergebnis `/api/health` |  |
| Login mit Superadmin erfolgreich |  |
| Aktivitaeten/Projekte sichtbar |  |
| Upload-Dateien stichprobenartig sichtbar |  |
| Abweichungen |  |

## Aufbewahrung

- Täglich: mindestens 7 Generationen.
- Wöchentlich: mindestens 4 Generationen.
- Monatlich: nach kommunaler/vertraglicher Vorgabe.
- Offsite-Kopie: empfohlen, verschluesselt, Zugriff auf Administratoren begrenzen.

## Datenschutz und Zugriff

Backups enthalten personenbezogene Daten und Upload-Dateien. Sie sind wie produktive Daten zu behandeln:

- Speicherung verschluesselt.
- Zugriff nur fuer benannte Administratoren.
- Restore nur auf freigegebenen Zielsystemen.
- Keine Weitergabe ueber unverschluesselte Kanaele.
- Loeschfristen gemaess TOM/AV-Vertrag dokumentieren.

## Zusaetzlicher Superadmin-Systemdatenexport

Der Bereich `Datenverwaltung` im Frontend bleibt fuer fachliche Exporte und kontrollierte Voll-Restores verfuegbar. Der Container-Backup-Pfad ist der technische Betriebsbackup-Pfad fuer Disaster Recovery.