StatO Desktop für Windows verbindet sich mit einer bestehenden StatO-Installation und öffnet die Weboberfläche in einem eigenen Electron-App-Fenster.

### Neu in __VERSION__

- Aktualisierter Windows-Installer für StatO 1.18.0 mit bestehender In-App-Updatefunktion.
- Zusammen mit Server 1.18.0: Monatsauslastung in der Statistik sowie passende, sanft animierte Ladeplatzhalter für Statistik und Aktivitäten.
- Die Oberfläche wird vom verbundenen Server geladen; für diese Neuerungen muss deshalb auch der Server aktualisiert sein.

### Installation und einmaliger Umstieg

1. `StatO-Setup-__VERSION__-x64.exe` herunterladen und installieren (Windows x64).
2. StatO starten und die vollständige Serveradresse eingeben, zum Beispiel `https://stato.traeger.de`.
3. Verbinden und mit dem vorhandenen StatO-Konto anmelden.

**Desktop 1.16.0 und ältere Versionen benötigen diesen Installer einmalig manuell.** Danach können künftige Desktop-Updates innerhalb der App heruntergeladen und installiert werden.

Node.js und Docker werden auf dem Client nicht benötigt. Backend und Datenbank werden nicht lokal installiert. Der StatO-Server muss erreichbar sein; interne Installationen benötigen gegebenenfalls LAN oder VPN.

### Status der Vorschau

Der Installer ist noch nicht digital signiert; Windows kann beim Start eine SmartScreen-Warnung anzeigen. Die Weboberfläche und ihre Neuerungen werden weiterhin vom verbundenen Server bereitgestellt.

`SHA256SUMS` enthält die Prüfsummen des Installers und der Update-Dateien. Zum Vergleichen unter PowerShell:

```powershell
Get-FileHash .\StatO-Setup-__VERSION__-x64.exe -Algorithm SHA256
```

`latest.yml` und `.exe.blockmap` sind für den Updater bestimmt und müssen nicht manuell geöffnet werden.

Weitere Hinweise: [Desktop-Dokumentation](https://github.com/Hubertoink/stato_okja/blob/desktop-v__VERSION__/desktop/README.md).
