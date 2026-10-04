# StatO Desktop für Windows – Vorschau

Dieser zusätzliche Electron-Client öffnet die **bestehende StatO-Weboberfläche**
eines konfigurierten Servers. Frontend, Backend und Datenbank werden nicht kopiert
oder lokal gestartet. Für den Client brauchen Nutzende weder Node.js noch Docker.
Die erste Distribution ist ein Windows-x64-Installer für das aktuelle Benutzerkonto.

Download: [StatO Desktop 1.12.0 – Windows-Vorschau](https://github.com/Hubertoink/stato_okja/releases/tag/desktop-v1.12.0).

## Benutzung

1. `StatO-Setup-<version>-x64.exe` installieren und StatO starten.
2. Die vollständige Adresse eingeben, beispielsweise `https://stato.traeger.de`,
   `https://stato.intern:8443` oder für eine lokale Testinstanz `http://192.168.1.50:8080`.
3. **Verbindung prüfen** liest `/api/health`. **Verbinden** prüft erneut, speichert
   die Adresse und öffnet die vorhandene Anmeldung. Der Server muss die
   StatO-Oberfläche unter `/` und seine API unter `/api` bereitstellen.
4. Die App verbindet sich beim nächsten Start automatisch mit der gespeicherten
   Adresse und zeigt dabei nur einen kurzen Ladebildschirm. Die Serverauswahl
   erscheint erst, wenn die Verbindung fehlschlägt.
5. Serveradresse, das **Neu laden**-Icon und **Server wechseln** bleiben in einer
   schmalen lokalen Fußzeile unter der Oberfläche verfügbar.
   Vorher offene Änderungen speichern. Ein Wechsel beendet die lokale Sitzung;
   bei jeder neuen Verbindung ist eine neue Anmeldung erforderlich.
6. Nach einer erfolgreichen Anmeldung fragt die Fußzeile, ob das Passwort auf diesem
   Gerät gespeichert werden soll (**Speichern** / **Nicht jetzt**). Gespeicherte
   Zugangsdaten werden beim nächsten Öffnen der Anmeldung eingetragen; angemeldet
   wird weiterhin erst per Klick auf **Anmelden**. Ändert sich das Passwort, bietet
   die Fußzeile eine Aktualisierung an. **Gespeichertes Passwort entfernen** löscht
   die Zugangsdaten des aktuellen Servers wieder.

Interne Server brauchen LAN-/VPN-Zugang. Eine IP-Adresse ist möglich, für HTTPS
muss das Zertifikat aber diese IP-Adresse abdecken und auf dem Gerät vertrauenswürdig
sein. Die App umgeht keine Zertifikatsfehler. HTTP wird für bestehende Test-/On-Prem-
Installationen unterstützt und in der Serverauswahl als unverschlüsselt angezeigt;
für produktive Anmeldung und Daten HTTPS einrichten.

Die Adresse wird in `connection.json` im Electron-Benutzerverzeichnis gespeichert
(Windows normalerweise `%APPDATA%/stato-desktop/`). Dort stehen weder Passwörter
noch Tokens. Gespeicherte Passwörter liegen getrennt pro Server in `credentials.json`,
verschlüsselt über Electron `safeStorage` (unter Windows DPAPI, gebunden an das
Windows-Benutzerkonto). Ohne Betriebssystem-Verschlüsselung bietet die App das
Speichern nicht an. Auf gemeinsam genutzten Windows-Konten keine Passwörter speichern.
Browserdaten und Cookies liegen pro Verbindung in einer separaten
Sitzung im Arbeitsspeicher und werden beim Wechsel verworfen. Dies widerruft keine
serverseitigen Refresh-Sitzungen; dafür weiterhin StatOs reguläre Abmeldung verwenden.

Downloads verwenden den nativen Speichern-Dialog. StatOs Vorschau- und Druckfenster
für Dateien/QR-Codes bleiben innerhalb derselben Serversitzung. Externe Web- und
E-Mail-Links öffnen nach einer Rückfrage die Standardanwendung.

## Entwicklung und Build

Die Desktop-Abhängigkeiten sind absichtlich unabhängig von den beiden bisherigen
npm-Workspaces. `npm install` im Repository lädt keine Desktop-Werkzeuge und die
Docker-Builds enthalten keinen Desktop-Code.

```powershell
# Aus dem Repository-Hauptverzeichnis
npm run desktop:install
npm run desktop:dev
npm run desktop:test
npm run desktop:build
```

Der Build erzeugt `desktop/dist/StatO-Setup-<version>-x64.exe` sowie einen entpackten
Client in `desktop/dist/win-unpacked/`. Alternativ nur den entpackten Client bauen:
`npm run build:unpacked --prefix desktop`. Die Icons in `assets/` stammen aus den
bestehenden StatO-Assets. Bei einer Branding-Änderung diese Kopien aktualisieren.

Zum lokalen Entwickeln mit Vite braucht `/api/health` ein laufendes Backend hinter
dem vorhandenen Vite-Proxy. Im Client beispielsweise `http://localhost:5173` wählen.

Die Vorschau ist **nicht digital signiert**. Für eine reguläre Veröffentlichung
die Windows-Code-Signierung mit electron-builder einrichten. Noch gibt es keinen
automatischen Client-Updater: neue Installer werden manuell verteilt und installiert.
Die Weboberfläche aktualisiert sich weiterhin über den Server. Backend-Daten und
Migrationen bleiben vollständig Teil des bisherigen Server-Release-Verfahrens.

Versionsnummer in `VERSION`, den bisherigen Paketen und `desktop/package.json`
zusammen erhöhen; danach `npm install --package-lock-only --prefix desktop`.
`npm run version:check` prüft auch den Desktop-Client.

## GitHub-Release veröffentlichen

Der Workflow `.github/workflows/desktop.yml` prüft und baut die App auf Windows.
Bei Änderungen auf `main`/`dev`, Pull Requests und manuellen Läufen stellt er den
Installer samt `SHA256SUMS` als Workflow-Artefakt bereit.

Für eine verteilbare Desktop-Vorschau `desktop/RELEASE_NOTES.md` und die Download-Links
an die neue Version anpassen, die Änderungen auf `main` pushen und danach einen
eigenen Desktop-Tag erstellen. Für Version 1.12.0:

```powershell
git tag -a desktop-v1.12.0 -m "StatO Desktop 1.12.0 Windows preview"
git push origin desktop-v1.12.0
```

Der Tag muss zur Version in `VERSION` passen und auf einem Commit aus `main` liegen.
Nach erfolgreichen Tests und Build veröffentlicht der Workflow automatisch einen
GitHub-Prerelease mit `StatO-Setup-<version>-x64.exe` und `SHA256SUMS`. Das bestehende
stabile Server-Release bleibt dadurch weiterhin als neuestes Release erreichbar.
Die eigene Tag-Familie `desktop-v*` löst keine Docker-Release-Veröffentlichung aus.
Server-Tags `v*` erzeugen im Desktop-Workflow nur das Build-Artefakt.

## Architektur und Prüfung

- `src/main.cjs`: Fenster, lokale IPC-Aufrufe, Verbindung und Sitzungslebenszyklus.
- `src/preload.cjs`: kleine, feste API ausschließlich für die lokale Serverauswahl.
- `src/shell/`: lokale Serverauswahl und dauerhaft erreichbare Desktop-Fußzeile.
- `src/server.cjs` / `src/config.cjs`: URL-/Statusprüfung und lokale Konfiguration.
- `src/credentials.cjs`: verschlüsselte Passwortablage pro Server.
- `src/login-autofill.cjs`: Ausfüllen und Erkennen der Anmeldung in einer isolierten
  JavaScript-Welt der Serverseite (wie ein Browser-Erweiterungs-Skript).
- `test/`: automatisierte URL-, Netzwerk-, Konfigurations- und Electron-Smoke-Tests.

Die Serveroberfläche bekommt **keinen Preload**, keine Node-Integration und keine
Desktop-IPC-API. Das Passwort-Hilfsskript läuft in einer eigenen isolierten Welt,
auf die Skripte der Seite keinen Zugriff haben. Es erkennt das Anmeldeformular über
`autocomplete="username"`/`type="email"` und `autocomplete="current-password"`.
Eine Anmeldung gilt als erfolgreich, wenn danach eine SPA-Navigation erfolgt und weder
Passwort- noch 2FA-Feld mehr vorhanden sind.
Kontextisolation, Sandbox und Web-Sicherheit bleiben eingeschaltet.
Nur die lokale Hauptseite darf Desktop-IPC aufrufen. Navigation in lokalen Dateien
oder anderen Protokollen wird blockiert; Popups bleiben auf Server/Blob/Blank-Seiten
beschränkt. Kamera, Mikrofon, Standort und andere Geräteberechtigungen sind deaktiviert.

Der Electron-Smoke-Test läuft mit zwei lokalen Testservern und einem temporären
Benutzerverzeichnis; er verwendet keine produktiven Zugangsdaten. Er prüft unter
anderem Serverwechsel, Sitzungsisolation, Fehlerbehandlung, Download, Vorschau,
IPC-Grenzen und einen Neustart mit gespeicherter Adresse. Für eigene Entwicklung
gibt es ausschließlich im ungepackten Client `--stato-user-data=<absoluter Pfad>`
und `--stato-hidden` für einen unsichtbaren Testlauf.

Vor einer produktiven Freigabe zusätzlich die echten Serverabläufe mit einem
Testkonto prüfen: Passwortanmeldung, E-Mail-2FA, Sitzungserneuerung, Uploads,
Excel/PDF-Exporte und die vorhandenen Einladungs-/Passwortlinks. Diese Links öffnen
zunächst weiterhin im Browser; ein Desktop-Deep-Link-Protokoll ist nicht Teil der Vorschau.

Die Health-Prüfung erkennt das aktuelle StatO-Antwortformat, ist aber kein
Identitätsnachweis für einen Server. Serververtrauen entsteht über die korrekt
konfigurierte Adresse und TLS. Eine separate API-Kompatibilitätsmatrix wird erst
benötigt, wenn künftig ein Frontend lokal mitgeliefert wird.
