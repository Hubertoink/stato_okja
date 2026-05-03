# Backup- und Restore-Runbook

Stand: 2026-05-02

Dieses Runbook beschreibt die technischen Backup- und Restore-Pfade fuer StatO-On-Prem-Installationen. Es ergaenzt den Superadmin-Systemdatenexport um ein Betriebsbackup fuer Postgres und Uploads.

Die Skripte laufen ueber Docker Compose und Docker-Container. Sie muessen auf einer Maschine ausgefuehrt werden, deren Docker CLI Zugriff auf den passenden Compose-Stack hat. Das kann der lokale On-Prem-Host oder ein konfigurierter Docker-Context fuer einen externen/off-premise Docker-Host sein.

Fuer Mittwald ist zusaetzlich ein eigener `backup`-Container vorgesehen. Dieser Container braucht keinen Docker-Socket, sondern nur Netzwerkzugriff auf `postgres`, das Upload-Volume read-only und ein Backup-Volume unter `/backups`.

## Backup-Ziele

- Datenbank: Postgres-Custom-Dump mit `pg_dump --format=custom`.
- Dateien: vollstaendiges Archiv des Backend-Upload-Volumes.
- Nachweis: `manifest.json` je Backup-Verzeichnis mit Zeitstempel, Format und enthaltenen Dateien.

## Backup Erstellen

Aus dem Repository-Root:

```powershell
.\scripts\onprem-backup-easy.ps1 -OpenFolder
```

Das ist der einfachste lokale Weg: Der `backup`-Container erzeugt das technische Backup im Docker-Volume und das Skript kopiert das neueste Backup anschliessend automatisch in einen normalen Host-Ordner unter `backups\stato-container-<timestamp>`.

Alternativ bleibt das direkte Host-Skript verfuegbar:

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

## Backup-Container

Die Compose-Dateien enthalten einen Service `backup`. Dieser Service basiert auf `backup/Dockerfile`, bringt das Kommando `/usr/local/bin/stato-container-backup` mit und bleibt ohne oeffentlichen Port im Stack laufen. Der Mittwald-Cronjob kann diesen Service direkt auswaehlen.

Der Container nutzt:

- `PGHOST=postgres`, `PGPORT=5432`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` fuer den Postgres-Dump.
- `/mnt/uploads` als read-only Mount des Backend-Upload-Volumes.
- `/backups` als Ziel fuer technische Betriebsbackups.
- `BACKUP_RETENTION_DAYS=14` als Standard-Aufbewahrung im Backup-Volume.

Manueller Test aus einem Docker-Host mit Compose-Zugriff:

```powershell
docker compose -f docker-compose.prod.yml exec backup /usr/local/bin/stato-container-backup
```

Mittwald Cronjob:

- Typ: `Container`
- Verknuepfter Container: `backup`
- Auszufuehrender Befehl: `/usr/local/bin/stato-container-backup`
- Cron-Syntax: `0 3 * * *`
- Zeitzone: `Europe/Berlin`
- Timeout: mindestens 3600 Sekunden, falls ein Feld dafuer vorhanden ist.

Das Kommando erzeugt unter `/backups/stato-container-<timestamp>/`:

- `postgres.dump`
- `uploads.tar.gz`
- `SHA256SUMS`
- `manifest.json`

Wichtig: `/backups` liegt im Volume `backup-data`. Dieses Volume muss ueber Mittwald-Projektbackups, Volume-Backups oder einen separaten Export abgesichert werden. Der Container sorgt fuer konsistente DB-/Upload-Artefakte; die externe Aufbewahrung des Backup-Volumes bleibt Teil des Betriebs.

## Mittwald Konkret

Zuerst klaeren, wie die Datenbank bei Mittwald laeuft:

- **Compose-Postgres im Stato-Stack:** Der Service `postgres` laeuft als Docker-Container im selben Compose-Projekt. In diesem Fall koennen die Skripte Datenbank und Uploads sichern.
- **Mittwald Managed PostgreSQL:** Die Datenbank ist kein Container im Stato-Compose-Stack. In diesem Fall DB-Backups ueber Mittwald/Managed-DB-Backup oder `pg_dump` gegen den Managed-DB-Host einrichten; die hier beschriebenen Docker-Skripte sind dann nur fuer den Compose-Stack mit Container-Postgres passend.

Fuer die Compose-Postgres-Variante ist auf Mittwald der `backup`-Container der bevorzugte Weg. Im mStudio einen Container-Cronjob auf `backup` mit dem Befehl `/usr/local/bin/stato-container-backup` anlegen.

Alternativ kann weiterhin von einer Admin-Maschine mit Docker-Context gearbeitet werden:

1. Auf einer Admin-Maschine oder Shell arbeiten, auf der `docker` und `docker compose` den Mittwald-Stack erreichen. Das kann eine Mittwald-Shell oder ein lokaler Rechner mit passendem Docker-Context sein.
2. Repository oder mindestens `scripts/`, Compose-Datei und ENV-Datei bereitstellen.
3. Compose-Datei und ENV-Datei passend zur Umgebung waehlen, z. B. `docker-compose.prod.yml` und `.env.production`. Wenn die Variablen bereits in der Shell oder im Docker-Context gesetzt sind, kann `-EnvFile ""` verwendet werden.
4. Den echten Upload-Volume-Namen ermitteln:

```powershell
docker volume ls --format "{{.Name}}" | Select-String backend-uploads
```

5. Backup ausfuehren:

```powershell
.\scripts\onprem-backup.ps1 -ComposeFile docker-compose.prod.yml -EnvFile .env.production -UploadsVolume <mittwald_backend_uploads_volume> -OutputDir .\backups -RetentionDays 14
```

6. Backup-Verzeichnis verschluesselt extern sichern, z. B. in einen separaten Storage, S3-kompatiblen Speicher oder ein kommunales Backup-Ziel.
7. Restore nur in Wartungsfenstern testen:

```powershell
.\scripts\onprem-restore.ps1 -ComposeFile docker-compose.prod.yml -EnvFile .env.production -UploadsVolume <mittwald_backend_uploads_volume> -BackupDir .\backups\stato-onprem-YYYYMMDD-HHMMSS -ConfirmText "RESTORE STATO BACKUP"
```

Wenn auf Linux/SSH gearbeitet wird, kann das gleiche Skript mit PowerShell 7 ausgefuehrt werden:

```bash
pwsh ./scripts/onprem-backup.ps1 -ComposeFile docker-compose.prod.yml -EnvFile .env.production -UploadsVolume <mittwald_backend_uploads_volume> -OutputDir ./backups -RetentionDays 14
```

## Restore Testen

Ein Restore ist destruktiv und ersetzt Datenbankinhalte sowie Upload-Dateien. Daher ist ein expliziter Bestaetigungstext erforderlich:

Einfacher Weg mit automatischer Auswahl des neuesten lokalen Backups:

```powershell
.\scripts\onprem-restore-easy.ps1
```

Nur Vorschau des ausgewaehlten lokalen Backups:

```powershell
.\scripts\onprem-restore-easy.ps1 -Preview
```

Erweiterter Weg mit explizitem Zielpfad:

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

Automatisierte Backups sollten auf Host-/Betriebsebene oder ueber den dedizierten `backup`-Container eingerichtet werden, nicht aus der Webanwendung heraus.

Beispiel fuer Mittwald Container-Cronjob:

```sh
/usr/local/bin/stato-container-backup
```

Beispiel-Kommando fuer Windows Aufgabenplanung:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\onprem-daily-ops.ps1
```

Das Daily-Ops-Skript prueft den Health-Endpunkt vor und nach dem Backup und schreibt zusaetzlich ein JSON-Protokoll unter `backups\logs\`.

Fertige Windows-Aufgabenplaner-Vorlage und Schrittfolge:

- `scripts/onprem-daily-backup-task.xml`
- `docs/ONPREM_WINDOWS_TASK_SCHEDULER.md`

Fuer Mittwald mit Compose-Postgres entsprechend anpassen:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\onprem-backup.ps1 -ComposeFile docker-compose.prod.yml -EnvFile .env.production -UploadsVolume <mittwald_backend_uploads_volume> -OutputDir .\backups -RetentionDays 14
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