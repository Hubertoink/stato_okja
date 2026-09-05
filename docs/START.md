# StatO starten

Wähle den Einstieg danach, wer Installation, Updates und Sicherungen übernimmt.

Eine kompakte Browserseite liegt in `docs/start/` und wird mit dem Frontend
unter `/start/` ausgeliefert. Der Ordner kann auch zusammen mit `env-generator/`
als statischer Inhalt auf der Projektwebsite bereitgestellt werden.

| Dein Umfeld | Einstieg | Zuständigkeit |
| --- | --- | --- |
| Einrichtung ohne eigene IT | Betreuten Zugang anfragen | Betreiber stellt Adresse und Zugang bereit und übernimmt den Betrieb |
| Kommune oder Träger mit IT | Auf eigenem Server installieren | Eigene IT betreibt den Docker-Stack |
| Vorhandenes NAS oder Portainer | Compose-Datei importieren | NAS-/Server-Verantwortliche betreuen den Stack |

## Betreuten Zugang anfragen

Schreibe an [support@okja-stato.de](mailto:support@okja-stato.de?subject=Betreuter%20StatO-Zugang).
Nenne Träger, Anzahl der Einrichtungen und eine Ansprechperson. Verfügbarkeit,
Kosten und Betriebszuständigkeit werden vor einer Bereitstellung vereinbart.
Dieser Kontakt ist eine Anfrage; er legt noch keine Instanz und kein Konto an.

Nach Bereitstellung erhältst du die Adresse und Zugangsinformationen. Die
Einrichtungen benötigen einen Browser. Updates und Backups übernimmt der
vereinbarte Betreiber. Mittwald ist eine vorhandene technische Grundlage für
diesen Betrieb, kein automatisch gebuchtes Hosting-Angebot.

## Auf eigenem Server installieren

Voraussetzung: laufende Docker Engine und aktuelles Docker-Compose-Plugin.
Für dauerhaften Betrieb empfehlen wir einen Linux-Server oder eine VM.
Git und Node.js sind auf dem Zielserver nicht erforderlich.

Linux/macOS:

```sh
curl -fsSL https://github.com/Hubertoink/stato_okja/releases/latest/download/install-onprem.sh | sh
```

Windows PowerShell:

```powershell
irm https://github.com/Hubertoink/stato_okja/releases/latest/download/install-onprem.ps1 | iex
```

1. Öffne die vom Installer angezeigte Adresse.
2. Entnimm `INITIAL_SETUP_TOKEN` aus `stato/config/stato.env` und gib diesen
   Einrichtungscode im Browser ein. Teile ihn nur mit der zuständigen Person.
3. Lege deine Admin-E-Mail-Adresse und ein Passwort fest.
4. Lege Organisation und erstes Teammitglied an. Der Standard funktioniert ohne SMTP.
5. Vor dem produktiven Einsatz HTTPS, Rechtstexte und Sicherungsziel einrichten.

Der Code funktioniert nur, solange noch kein Superadmin existiert. Eine
aktualisierte, bereits eingerichtete Instanz verlangt keine erneute Ersteinrichtung.

## NAS oder Portainer verwenden

Öffne den [Konfigurationsgenerator](https://stato-okja.de/env-generator/), wähle
„Docker-Compose-Importdatei“, trage Adresse und Port ein und lade `deploy.yaml`
herunter. Importiere sie als eigene App beziehungsweise Stack. Die Datei enthält
Zugangsdaten und den Einrichtungscode; bewahre sie geschützt auf.

Verwende die Generator-Dateien aus demselben Release wie die Container. Das
Release-Bundle enthält dazu den Ordner `env-generator`. Ändere bei Updates nur
die Version und notwendige neue Einstellungen; erzeuge bestehende Secrets nicht neu.

## Nach der Installation

Die mitgelieferte `OPERATIONS.md` erklärt Sicherungen, Wiederherstellung und
Updates. Die ausführliche technische Anleitung im Repository heißt
`docs/DOCKER_ONPREM_SETUP.md`; ältere Source-Installationen sind dort separat
als Legacy gekennzeichnet.
