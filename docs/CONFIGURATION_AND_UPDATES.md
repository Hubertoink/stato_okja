# Konfiguration ändern, Dev testen und Updates übernehmen

Nach der [Schnellinstallation](DOCKER_ONPREM_SETUP.md) hängt der nächste Befehl davon ab, wie deine Instanz gestartet wurde. Notiere den Installationsordner und arbeite für bestehende Instanzen immer mit demselben Ordner.

## Was möchte ich machen?

| Vorhaben | Nächster Schritt |
| --- | --- |
| SMTP, Adresse oder Backup-Intervall einer Release-Installation ändern | `config/stato.env` bearbeiten und Container mit `up -d --wait` neu erstellen lassen. |
| Eine lokale Docker-Testinstanz mit eigenen Änderungen testen | Aktuellen `dev`-Quellcode verwenden und `start-dev-test.ps1 -Build` ausführen. |
| Dev-Tools lokal einschalten | Drei Variablen setzen und das Frontend über den Teststarter neu bauen; siehe unten. |
| Die veröffentlichten Dev-Images testen | GitHub-Workflow abwarten, dann Teststarter ohne `-Build` ausführen. |
| Eine produktive Release-Installation aktualisieren | Release-Installer erneut mit dem bestehenden Zielordner ausführen. |
| Eigene Codeänderungen veröffentlichen | Commit nach `dev` pushen und den Image-Workflow prüfen; die Testinstanz danach gesondert aktualisieren. |

## Variablen einer Release-Installation ändern

Diese Befehle gelten für eine Installation mit dem Release-Installer, mit `compose.yaml` und `config/stato.env`. Für die vom Teststarter generierte Konfiguration gilt der nächste Abschnitt.

1. In den bestehenden Installationsordner wechseln und `config/stato.env` bearbeiten, unter Windows etwa mit `notepad .\config\stato.env`.
2. Nur die benötigten Werte ändern und speichern. Die Datei enthält Zugangsdaten und gehört nicht in Git.
3. Konfiguration prüfen und anwenden:

```sh
docker compose --env-file config/stato.env -f compose.yaml config --quiet
docker compose --env-file config/stato.env -f compose.yaml up -d --wait
docker compose --env-file config/stato.env -f compose.yaml ps
```

`up` erstellt Dienste mit geänderter Compose-Konfiguration neu; `restart` startet lediglich die bisherigen Container mit ihren bisherigen Umgebungswerten. Nach einer SMTP-Änderung eine Einladung testen; nach einer Adressänderung die neue Adresse und den Passwort-Reset prüfen.

Nur Variablen, die in `compose.yaml` an einen Dienst weitergegeben oder dort ausgewertet werden, wirken sich aus. Ein beliebiger zusätzlicher Eintrag in `stato.env` reicht nicht. Bei einem importierten Stack die Werte stattdessen in dessen `deploy.yaml` beziehungsweise der Plattform ändern und denselben Stack aktualisieren.

`POSTGRES_PASSWORD` ist ein Initialisierungswert: Eine Änderung der Datei ändert nicht das Passwort einer bereits vorhandenen Datenbank. Passwortwechsel müssen mit der Datenbank und den Zugangsdaten des Backends abgestimmt werden.

### Frontend-Variablen benötigen einen Build

`VITE_*`-Werte werden beim Frontend-Build eingebaut. Eine Änderung in `stato.env`, ein Containerneustart oder das Herunterladen desselben fertigen Images verändert sie nicht. Bei einem eigenen Build müssen die gewünschten Variablen ausdrücklich als Build-Argumente weitergegeben werden.

Der lokale Teststarter unterstützt aktuell `VITE_ENABLE_DEV_TOOLS` aus `stato.env`; andere `VITE_*`-Einträge werden nicht automatisch übernommen. Er setzt die lokale API-Adresse auf `/api`.

## Lokale Docker-Testinstanz unter Windows

Voraussetzungen: Docker Desktop mit Linux-Containern, Git und PowerShell 7. Die folgenden Befehle laufen im StatO-Quellcodeordner, in dem `scripts/start-dev-test.ps1` liegt. Eine lokale Node.js-Installation ist für den Docker-Build nicht nötig.

```powershell
git switch dev
git pull --ff-only origin dev
pwsh -NoProfile -File .\scripts\start-dev-test.ps1 -Build
```

Der Starter erstellt beim ersten Lauf die Konfiguration unter `$env:USERPROFILE\stato-dev-test\config\stato.env`. Die Standardadresse ist `http://localhost:8091`. Bei weiteren Läufen bleiben Konfiguration und Daten erhalten. Auch der Starter selbst muss aus einem aktuellen Checkout stammen; `-Build` aktualisiert keinen Quellcode.

### Dev-Tools einschalten

Die bestehende Testkonfiguration öffnen:

```powershell
notepad "$env:USERPROFILE\stato-dev-test\config\stato.env"
```

Die vorhandenen Einträge so setzen, ohne doppelte Zeilen anzulegen:

```dotenv
NODE_ENV=development
APP_ENV=development
VITE_ENABLE_DEV_TOOLS=true
```

Speichern und im aktuellen Quellcodeordner erneut ausführen:

```powershell
pwsh -NoProfile -File .\scripts\start-dev-test.ps1 -Build
```

Danach die Browserseite neu laden und als **Superadmin** anmelden. Das Frontend-Flag macht den Menüpunkt sichtbar; die Backend-Entwicklungsmodi ermöglichen die Testdaten-Funktionen. Für organisationsbezogene Testdaten zuerst eine Organisation auswählen. Diese Einstellungen gelten für die lokale Testinstanz; produktive Instanzen bleiben im Produktionsmodus.

### Weitere Variablen oder lokalen Code ändern

Nach Änderungen an der Test-`stato.env` den Starter im bisherigen Modus erneut ausführen, bei eigenen Builds also mit `-Build`. Er erzeugt `compose.yaml` neu. Ein direktes `docker compose up` reicht hier nicht: Die generierte Datei enthält bereits aufgelöste Werte aus dem letzten Starterlauf.

`-Build` baut den aktuellen lokalen Quellcode samt Build-Argumenten. Für eine andere Testinstanz bei jedem Aufruf denselben `-Directory`-Wert verwenden. `-Port` gilt nur beim Anlegen; bei bestehenden Instanzen Port und Adressen in `stato.env` ändern.

### Veröffentlichten Dev-Stand herunterladen

Nach erfolgreichem GitHub-Workflow **Build and publish Docker images**:

```powershell
pwsh -NoProfile -File .\scripts\start-dev-test.ps1
```

Ohne `-Build` lädt der Starter die Images `stato-backend:dev`, `stato-frontend:onprem-dev` und `stato-backup:dev`. Das Frontend-Image `onprem-dev` enthält **keine Dev-Tools**, auch wenn deine lokale `stato.env` das Flag auf `true` setzt. Für eigene Frontend-Flags den Build-Modus verwenden. Ein späterer Aufruf ohne `-Build` wechselt wieder zu den veröffentlichten Images.

Mehr zu Ersteinrichtung, Backup und Stoppen: [Dev unter Windows testen](TEST_DEV_WINDOWS.md).

## Code pushen und den Stand testen

1. Änderungen prüfen und passende Tests ausführen.
2. Im `dev`-Checkout nur die beabsichtigten Dateien stagen, committen und pushen:

```sh
git status --short
git add PFAD_ZUR_GEAENDERTEN_DATEI
git commit -m "Beschreibung der Änderung"
git push origin dev
```

3. Unter [GitHub Actions](https://github.com/Hubertoink/stato_okja/actions/workflows/docker-images.yml) den Lauf für diesen Commit prüfen. Erst ein erfolgreicher Image-Build stellt den neuen Stand zum Herunterladen bereit.
4. Die lokale Testinstanz mit einem der beiden oben beschriebenen Starter-Aufrufe aktualisieren. Für einen lokalen Build genügt der aktuelle Checkout; er muss nicht auf den Image-Workflow warten.

Ein Push aktualisiert weder laufende Docker-Container noch eine bereits geöffnete Browserseite. Ein `dev`-Push ist auch kein stabiler Release für den Einzeilen-Installer. Stabile Versionen werden nach dem [Release-Prozess](RELEASE.md) veröffentlicht.

## Eine bestehende Release-Installation aktualisieren

Release-Notizen lesen und den **tatsächlichen bestehenden Installationsordner** einsetzen. Die folgenden Pfade sind Beispiele, keine Aufforderung zu einer zweiten Installation.

Windows PowerShell:

```powershell
$env:STATO_INSTALL_DIR = 'C:\StatO'
irm https://github.com/Hubertoink/stato_okja/releases/latest/download/install-onprem.ps1 | iex
```

Linux/macOS:

```sh
curl -fsSL https://github.com/Hubertoink/stato_okja/releases/latest/download/install-onprem.sh | STATO_INSTALL_DIR=/opt/stato sh
```

Der Installer sichert den bisherigen verwalteten Stack, übernimmt die bestehende Konfiguration und prüft die gestarteten Dienste. Anschließend Anmeldung, Aktivitäten und einen Dateiabruf prüfen. Bei Fehlern die Meldung und Logs prüfen; Datenbankmigrationen können bereits gelaufen sein. Ein Rückweg benötigt alten Runtime-Stand und zugehöriges Datenbackup zusammen.

Für Legacy-Installationen mit `.env.onprem` oder importierte Stacks gelten deren bisherige Update-Wege. Details: [Betriebsblatt](OPERATIONS.md) und [On-Prem-Anleitung](DOCKER_ONPREM_SETUP.md).
