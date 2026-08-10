# StatO auf ZimaOS installieren

StatO läuft auf ZimaOS als eigene Docker-Compose-App. Die importierbare Vorlage
liegt in [deploy/zimaos/compose.yaml](../deploy/zimaos/compose.yaml). Sie
verwendet ausschließlich veröffentlichte, versionsgebundene Container-Images;
auf dem ZimaOS-Gerät werden weder Quellcode noch Node.js oder ein lokaler Build
benötigt.

## Voraussetzungen

- ZimaOS mit Zugriff auf das App Center
- eine feste LAN-IP oder ein lokaler DNS-Name für das ZimaOS-Gerät
- ein freier TCP-Port, standardmäßig `8088`
- für Internetzugriff: ein Reverse Proxy mit HTTPS und eine Domain

Die Release-Images unterstützen `amd64` und `arm64`. Verwende nur eine
veröffentlichte StatO-Version wie `1.6.0`, nie einen beweglichen Tag wie
`latest`.

## Installation über die ZimaOS-Oberfläche

1. Lade [compose.yaml](../deploy/zimaos/compose.yaml) herunter oder kopiere
   seinen Inhalt.
2. Öffne in ZimaOS das **App Center** und wähle **Install a customized app**.
3. Wähle **Import** und füge die Compose-Datei ein.
4. Am bequemsten erzeugst du mit dem
   [Konfigurationsgenerator](./env-generator/index.html) und dem Ausgabeformat
   **Docker-Compose-Importdatei** eine vollständige `deploy.yaml`. Die beiden Secrets
   entstehen dabei ausschließlich lokal im Browser. Importiere diese Datei
   direkt in ZimaOS; zusätzliche Variablenfelder sind nicht nötig.

   Alternativ kannst du [compose.yaml](../deploy/zimaos/compose.yaml) zusammen
   mit den sieben Werten aus
   [stato.env.example](../deploy/zimaos/stato.env.example) verwenden:

   | Variable | Beispiel | Zweck |
   | --- | --- | --- |
   | `STATO_VERSION` | `1.6.0` | unveränderliche StatO-Release-Version |
   | `WEBUI_PORT` | `8088` | Port, über den die StatO-Oberfläche erreichbar ist |
   | `STATO_URL` | `http://192.168.1.50:8088` | exakte Adresse, die im Browser verwendet wird |
   | `STATO_HTTPS` | `false` | nur bei einer HTTPS-Adresse auf `true` setzen |
   | `POSTGRES_PASSWORD` | langes, einzigartiges Passwort | Datenbankzugang |
   | `JWT_SECRET` | mindestens 48 zufällige Zeichen | Signatur der Login-Sitzungen |
   | `SUPERADMIN_EMAIL` | `admin@organisation.de` | E-Mail für die einmalige Ersteinrichtung |

   `STATO_URL` muss den gleichen Host, Port und das gleiche Protokoll enthalten
   wie die Adresse im Browser. Die Compose-Vorlage verwendet diesen einen Wert
   intern sowohl für `APP_ORIGIN` als auch für `CORS_ORIGINS`.

5. Prüfe den Port und starte die Installation. ZimaOS legt die persistenten
   Docker-Volumes für PostgreSQL, Uploads und Backups an.
6. Warte, bis die Dienste den Status „running/healthy“ zeigen, und öffne
   `http://<ZIMAOS-IP>:<WEBUI_PORT>`.
7. Beim ersten Aufruf legst du das Passwort für `SUPERADMIN_EMAIL` fest. Es
   wird nur als Hash in PostgreSQL gespeichert.

Das Frontend ist der einzige veröffentlichte Dienst. Alle Container verwenden
das von ZimaOS für die App angelegte, nicht veröffentlichte Docker-Netzwerk;
`/api` und `/uploads` werden intern über das Frontend weitergeleitet.

Falls ZimaOS nach einem Import beim Frontend nur **created** statt **running**
zeigt, lade eine aktuelle Generator-Datei herunter und stelle die App damit
erneut bereit. Die ZimaOS-Vorlage wartet beim Frontend bewusst nicht auf den
Health-Status des Backends; dadurch wird der Web-Port auch während des
Backend-Starts geöffnet.

## Dieselbe Datei mit Docker Compose oder Portainer verwenden

Die vom Generator erzeugte `deploy.yaml` ist eine normale Compose-Datei. Die
zusätzlichen `x-casaos`-Metadaten werden von Docker Compose und Portainer
ignoriert. Neben ZimaOS kann sie daher unverändert als Portainer-Stack
importiert oder auf einem Docker-Host gestartet werden:

```bash
docker compose -f deploy.yaml up -d
```

Die drei persistenten Volumes werden dabei automatisch angelegt. Anschließend
ist StatO unter `http://<SERVER-IP>:8088` erreichbar.

## HTTPS und Domain

Für eine produktive oder von außen erreichbare Instanz gehört StatO hinter
einen Reverse Proxy mit HTTPS. Danach ändere diese zwei Werte und starte die
App neu:

```env
STATO_URL=https://stato.example.org
STATO_HTTPS=true
```

Die HTTPS-Adresse muss exakt sein; keine zusätzlichen Pfade und kein
abweichender Port. Der Reverse Proxy leitet anschließend an
`http://<ZIMAOS-IP>:8088` weiter. Öffne nicht zusätzlich den Backend-Port und
veröffentliche auch PostgreSQL niemals nach außen.

## E-Mail und Benutzerverwaltung

Die kompakte Vorlage funktioniert im lokalen Netzwerk ohne Mailserver. Sie
setzt intern diese beiden sicheren Offline-Modi:

```env
PASSWORD_RESET_MODE=admin_temp_password
USER_PROVISIONING_MODE=local
```

Für Einladungen per E-Mail, Passwort-Reset per E-Mail oder E-Mail-2FA müssen
in der ZimaOS-App-Konfiguration beim Backend die benötigten `SMTP_*`-Variablen
ergänzt und `USER_PROVISIONING_MODE=email` sowie `PASSWORD_RESET_MODE=email`
gesetzt werden. Diese selten benötigten Optionen stehen absichtlich nicht im
Quickstart-Formular.

## Backups

Der Stack enthält einen ruhenden `backup`-Dienst sowie drei persistente
Volumes: Datenbank, Uploads und Backup-Ausgaben. Vor Updates sollte ein Backup
ausgeführt und aus ZimaOS heraus gesichert werden. Der Befehl lautet über SSH:

```bash
docker compose -f compose.yaml exec backup /usr/local/bin/stato-container-backup
```

Wenn ZimaOS die Compose-Datei verwaltet, den Befehl im zugehörigen
App-Kontext ausführen. Das Backup enthält PostgreSQL und die Upload-Dateien.

## Aktualisieren

1. Zuerst ein Backup erstellen.
2. In der ZimaOS-App-Konfiguration nur `STATO_VERSION` auf die gewünschte
   Release-Version ändern, z. B. von `1.3.5` auf `1.3.6`.
3. App neu bereitstellen bzw. neu starten und warten, bis Backend und Frontend
   wieder gesund sind.
4. StatO öffnen und kurz prüfen, ob Anmeldung und aktuelle Daten vorhanden
   sind.

Die Versionsnummer von Backend, On-Prem-Frontend und Backup bleibt dadurch
immer gleich. Das verhindert inkompatible Mischstände zwischen UI und API.
