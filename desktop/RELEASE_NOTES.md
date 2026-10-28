StatO Desktop für Windows verbindet sich mit einer bestehenden StatO-Installation und öffnet die Weboberfläche in einem eigenen Electron-App-Fenster.

### Neu in __VERSION__

- Die Desktop-Titelleiste liegt jetzt außerhalb des Webinhalts. Scrollleisten und Dialoge beginnen vollständig darunter; neben dem Schließen-Knopf bleibt kein Scrollbereich.
- Die Titelleiste bleibt bei oberer Navigation und Seitenleiste sichtbar und übernimmt die Theme-Farben.
- Die untere Serverleiste schließt ohne zusätzliche Rahmenlinie direkt an den Webinhalt an, auch bei Windows-Skalierung.
- Kein Server-Update erforderlich.

### Installation und einmaliger Umstieg

1. `StatO-Setup-__VERSION__-x64.exe` herunterladen und installieren (Windows x64).
2. StatO starten und die vollständige Serveradresse eingeben, zum Beispiel `https://stato.traeger.de`.
3. Verbinden und mit dem vorhandenen StatO-Konto anmelden.

**Desktop 1.16.0 und ältere Versionen benötigen diesen Installer einmalig manuell.** Danach können künftige Desktop-Updates innerhalb der App heruntergeladen und installiert werden.

Node.js und Docker werden auf dem Client nicht benötigt. Backend und Datenbank werden nicht lokal installiert. Der StatO-Server muss erreichbar sein; interne Installationen benötigen gegebenenfalls LAN oder VPN.

### Hinweise zum Installer

Der Installer ist noch nicht digital signiert; Windows kann beim Start eine SmartScreen-Warnung anzeigen. Die Weboberfläche und ihre Neuerungen werden weiterhin vom verbundenen Server bereitgestellt.

`SHA256SUMS` enthält die Prüfsummen des Installers und der Update-Dateien. Zum Vergleichen unter PowerShell:

```powershell
Get-FileHash .\StatO-Setup-__VERSION__-x64.exe -Algorithm SHA256
```

`latest.yml` und `.exe.blockmap` sind für den Updater bestimmt und müssen nicht manuell geöffnet werden.

Weitere Hinweise: [Desktop-Dokumentation](https://github.com/Hubertoink/stato_okja/blob/desktop-v__VERSION__/desktop/README.md).
