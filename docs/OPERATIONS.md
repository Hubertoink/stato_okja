# StatO – Betriebsblatt

Konkrete Befehle für [Konfigurationsänderungen, lokale Tests und Release-Updates](CONFIGURATION_AND_UPDATES.md).

## Verantwortlichkeit und Infrastruktur

Vor Übergabe eine zuständige Person für Server, Updates, Backupkontrolle und
Benutzerverwaltung benennen. Supportkontakt: support@okja-stato.de.

Linux-VM mit Docker Engine und Docker Compose; Release-Images für amd64/arm64.
Als Planungsstart für einen kleinen Piloten: 2 vCPU, 4 GB RAM und 20 GB freier
Speicher, zuzüglich Uploads und Backups. Das sind ungemessene Planungswerte,
keine zugesicherte Kapazität. Speicher und Laufzeiten im Pilotbetrieb beobachten.
Ein dauerhaft laufender Server ist für Teams zweckmäßiger als ein Arbeitsplatz-PC.

Für Installation und Updates werden GitHub/GHCR sowie die Registries für
PostgreSQL und optional Caddy benötigt. SMTP ist optional. Nur den Webzugang
freigeben; Datenbank und Backend bleiben intern. Öffentliches HTTPS übernimmt
ein vorgeschalteter Proxy; internes HTTPS ist über das Caddy-Profil möglich.

## Automatische Sicherungen

Neue On-Prem-Releases sichern beim Start des Backup-Dienstes und danach alle
86400 Sekunden Datenbank, Uploads, `config/` und die Image-Version. Das Intervall
ist über `BACKUP_INTERVAL_SECONDS` einstellbar; `0` deaktiviert es. Änderungen
werden nach Neuerstellung des Backup-Containers aktiv. Bei Mittwald den
vorhandenen Cronjob weiterverwenden oder explizit das Intervall setzen.

`BACKUP_COPY_DIR` bezeichnet ein zweites Ziel auf dem Docker-Host. Standard ist
`./backup-export`; für Schutz vor Hostverlust muss die IT dort einen absoluten
Pfad auf getrenntem Speicher eintragen. Backups enthalten Secrets und sind
entsprechend vor fremdem Zugriff zu schützen. Exportierte Dateien gehören dem
Besitzer des Zielordners und behalten ihre privaten Zugriffsrechte. Der
On-Prem-Backupdienst erhält dafür gezielt `DAC_OVERRIDE` und `CHOWN`, damit er
unter Linux auch die private Konfiguration eines anderen Host-Benutzers lesen
kann; die Konfiguration bleibt schreibgeschützt gemountet.
Externe Kopien werden absichtlich
nicht automatisch gelöscht; deren Aufbewahrung am Ziel konfigurieren.

Das interne Backup-Volume bewahrt standardmäßig 14 Tage auf. Erst nach
vollständiger Sicherung und erfolgreicher Kopie wird `last-success.txt` erneuert.
Fehler stehen in den Backup-Containerlogs; das Intervall ist kein Ersatz für
Fehlerüberwachung. Datenbank und Uploads werden nacheinander gesichert; für
eine exakt zusammengehörige Momentaufnahme Schreibzugriffe vorher unterbrechen.

Im Installationsverzeichnis:

```sh
sh onprem-runtime.sh status
sh onprem-runtime.sh backup
```

```powershell
.\onprem-runtime.ps1 status
.\onprem-runtime.ps1 backup
```

NAS/Portainer: `docker compose -f deploy.yaml exec -T backup /usr/local/bin/stato-container-backup`.
Die generierte `deploy.yaml` separat sichern; dort ist kein Host-Konfigurationsordner gemountet.

## Wiederherstellung

Zunächst einen isolierten Wiederherstellungstest durchführen. Die folgenden
Befehle ersetzen Datenbank und Uploads der gewählten Release-Installation.
Vorher die aktuellen Daten sichern und das gewünschte Backup eindeutig auswählen.

1. Passende StatO-Version aus der gesicherten `VERSION` bereitstellen.
2. Bei Serververlust `config.tar.gz` geschützt in `config/` wiederherstellen;
   Hostpfade, Domain und Secrets prüfen. Compose-Datei aus dem passenden Release
   verwenden. Der Restore-Befehl überschreibt Konfiguration bewusst nicht.
3. Stack einmal mit diesem Release initialisieren. Dann Restore ausführen:

```sh
sh onprem-runtime.sh restore /sicherungen/stato-container-DATUM 'RESTORE STATO BACKUP'
```

```powershell
.\onprem-runtime.ps1 restore -BackupDirectory 'D:\Sicherungen\stato-container-DATUM' -ConfirmText 'RESTORE STATO BACKUP'
```

Der Helfer prüft die Sicherung, stoppt Schreibzugriffe, stellt Datenbank und
Uploads wieder her und prüft den Start einschließlich API über das Frontend.
Bei Fehlern bleibt die Anwendung gegebenenfalls gestoppt; erst Ursache beheben.
Anschließend Anmeldung, Organisationen und einen Dateiabruf prüfen und protokollieren.

Die Helfer unterstützen relative Prüfsummenpfade und die bisherigen absoluten
`/backups/stato-container-...`-Pfade der Container-Backups. Bei alten Backups
ohne Konfigurationsarchiv den zugehörigen `runtime-DATUM`-Ordner beziehungsweise
die separat gesicherte Konfiguration verwenden.

## Updates

Release-Notizen lesen und denselben Installer mit `STATO_INSTALL_DIR` auf das
bestehende Installationsverzeichnis ausführen. Ohne diesen Wert hängt das
Standardziel vom aktuellen Arbeitsverzeichnis ab.

Vor dem Wechsel sichern die Installer die Daten mit der bisherigen
Konfiguration und legen einen `backups/runtime-DATUM`-Ordner mit der alten
Konfiguration, Compose-Datei und Version an. Erst danach werden Release-Dateien
ersetzt. Erfolg wird erst nach Healthchecks und API-Probe vermerkt.

Ein fehlgeschlagenes Update kann bereits Migrationen ausgeführt haben.
Deshalb erfolgt kein automatisches Downgrade. Für einen Rückweg alten Runtime-
Stand und zugehöriges Datenbackup gemeinsam wiederherstellen. Ein reiner Wechsel
des Image-Tags ist kein vollständiger Rollback.

## Übergabecheck

- HTTPS-Adresse erreichbar; Ersteinrichtung abgeschlossen.
- Erste Organisation und Teamzugang funktionieren.
- Mailversand bei Bedarf eingerichtet und mit einer Einladung getestet.
- Rechtstexte geprüft und importiert.
- Erfolgreiches Backup auf getrenntem Speicher; Restore-Test protokolliert.
- Updatezuständigkeit, Fehlerkontrolle und Supportkontakt dokumentiert.
