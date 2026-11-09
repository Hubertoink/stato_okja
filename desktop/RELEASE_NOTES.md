StatO Desktop für Windows verbindet sich mit einer bestehenden StatO-Installation und öffnet die Weboberfläche in einem eigenen Electron-App-Fenster.

### Neu in __VERSION__

- Gemeinsamer Versionsstand 1.24.0 mit dem StatO-Server.
- Mit Server 1.24.0: Aktivitäten zeigen Team-Mitglieder mit Kronen-Icon und Mitwirkende mit Handschlag-Icon als umrandete Badges.
- Mit Server 1.24.0: Die Kalender-Tagesauswahl zeigt Kategorien, Tags, Team-Mitglieder und Mitwirkende direkt in der Tabelle.
- Für diese Oberflächenänderungen den verbundenen StatO-Server auf 1.24.0 aktualisieren. Der Desktop-Client enthält keine zusätzlichen funktionalen Änderungen gegenüber 1.23.2.

### Installation und einmaliger Umstieg

1. `StatO-Setup-__VERSION__-x64.exe` herunterladen und installieren (Windows x64).
2. StatO starten und die vollständige Serveradresse eingeben, zum Beispiel `https://stato.traeger.de`.
3. Verbinden und mit dem vorhandenen StatO-Konto anmelden.

**Falls die Update-Suche im Dienstnetz bisher fehlschlägt, diesen Installer einmal manuell installieren.** Erst danach steht der korrigierte Netzwerkzugriff zur Verfügung.

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
