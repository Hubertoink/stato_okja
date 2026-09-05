# Dev auf einem Windows-PC testen

Für Änderungen nach dem ersten Start: [Variablen ändern, Dev-Tools aktivieren und Updates übernehmen](CONFIGURATION_AND_UPDATES.md).

Docker Desktop mit Linux-Containern starten. Die folgenden Befehle verwenden
PowerShell 7 (`pwsh`). Für den lokalen Container-Build ist keine lokale
Node.js-Installation erforderlich.

## Start aus dem dev-Quellcode

Im Repository:

```powershell
git switch dev
git pull --ff-only origin dev
pwsh -NoProfile -File .\scripts\start-dev-test.ps1 -Build
```

Der erste Build kann einige Minuten dauern. Danach läuft die Testinstanz auf
<http://localhost:8091>. Die Daten bleiben unter eigenen, eindeutig benannten
Docker-Volumes erhalten. Konfiguration, Helfer und Backup-Kopien liegen unter
`$env:USERPROFILE\stato-dev-test`. Der Testzugang ist nur auf diesem PC erreichbar.

Alternativ nach erfolgreichem GitHub-Image-Build ohne `-Build` starten, um die
Images `dev` und `onprem-dev` zu verwenden. Dies ist unabhängig vom stabilen
Release-Installer, der weiterhin den letzten veröffentlichten Release lädt.

Das fertige `onprem-dev`-Frontend wird ohne Dev-Tools gebaut. Ein lokales
`VITE_ENABLE_DEV_TOOLS=true` ändert dieses Image nicht. Für eigene Frontend-Flags
immer den aktuellen Quellcode und `-Build` verwenden. Ein späterer Aufruf ohne
`-Build` wechselt wieder zu den veröffentlichten Images.

## Was du prüfen solltest

1. `notepad "$env:USERPROFILE\stato-dev-test\config\stato.env"` öffnen.
   Den Wert hinter `INITIAL_SETUP_TOKEN=` kopieren.
   Für Dev Tools zusätzlich im Backend `NODE_ENV=development` und `APP_ENV=development`
   setzen sowie `VITE_ENABLE_DEV_TOOLS=true` eintragen. Danach den Launcher mit
   `-Build` erneut ausführen; das Frontend-Flag wird beim Build eingebettet.
2. <http://localhost:8091> öffnen. Code, eigene Admin-Adresse und neues Passwort
   eingeben. Du wirst zur Organisationsverwaltung weitergeleitet.
3. Eine Testorganisation und ein Teammitglied anlegen. Ohne SMTP vergibst du
   ein temporäres Passwort. Den Zugang anschließend in einem privaten
   Browserfenster testen.
4. <http://localhost:8091/start/> und <http://localhost:8091/env-generator/>
   öffnen. Im Generator eine Compose-Importdatei erzeugen und prüfen, ob der
   Einrichtungscode enthalten ist. Generator-Dateien nicht über die bestehende
   Testkonfiguration kopieren.
5. Eine Aktivität und einen Datei-Upload anlegen, Sicherung ausführen:

```powershell
pwsh -NoProfile -File "$env:USERPROFILE\stato-dev-test\onprem-runtime.ps1" backup
pwsh -NoProfile -File "$env:USERPROFILE\stato-dev-test\onprem-runtime.ps1" status
explorer "$env:USERPROFILE\stato-dev-test\backup-export"
```

6. Den Startbefehl mit `-Build` erneut ausführen. Anmeldung und Daten müssen
   erhalten bleiben. Das prüft einen erneuten Container-Build; der eigentliche
   Release-Installer wird durch die Installer-Tests separat geprüft.

## Stoppen und fortsetzen

```powershell
docker compose -f "$env:USERPROFILE\stato-dev-test\compose.yaml" stop
docker compose -f "$env:USERPROFILE\stato-dev-test\compose.yaml" up -d --wait
```

Die Daten bleiben erhalten. Für eine zweite, frische Ersteinrichtung:

```powershell
pwsh -NoProfile -File .\scripts\start-dev-test.ps1 -Build -Directory "$env:USERPROFILE\stato-dev-test-2" -Port 8092
```

Bei einem belegten Port vor dem ersten Start `-Port 8092` wählen. Bei einer
bestehenden Testinstanz stammen Port und Adresse aus `config/stato.env`; der
Parameter überschreibt diese gespeicherte Konfiguration nicht.

Es wird kein HTTPS eingerichtet. HTTP auf localhost genügt für diesen Test;
produktive Nutzung folgt dem Betriebsblatt.
