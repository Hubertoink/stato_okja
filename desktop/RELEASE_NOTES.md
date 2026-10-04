StatO Desktop für Windows verbindet sich mit einer bestehenden StatO-Installation und öffnet die Weboberfläche in einem eigenen App-Fenster.

### Neu in 1.12.1

- „Server wechseln“ verwendet jetzt ein Modal im App-Design und übernimmt die Farben des aktiven Themes, einschließlich Dark Mode.
- Abbrechen, Escape und Schließen erhalten die laufende Sitzung und setzen den Fokus zurück auf „Server wechseln“.
- Automatisierte Electron-Tests prüfen Theme-Übernahme, Tastaturbedienung und den Sitzungslebenszyklus.

### Installation

1. `StatO-Setup-1.12.1-x64.exe` herunterladen und installieren (Windows 10/11, x64).
2. StatO starten und die vollständige Serveradresse eingeben, zum Beispiel `https://stato.traeger.de`.
3. Verbinden und mit dem vorhandenen StatO-Konto anmelden.

Node.js und Docker werden auf dem Client nicht benötigt. Der StatO-Server muss erreichbar sein; interne Installationen benötigen gegebenenfalls LAN oder VPN.

### Funktionen

- Serverprüfung und automatische Verbindung mit der zuletzt gespeicherten Adresse.
- Serverwechsel und erneutes Laden über die Desktop-Fußzeile.
- Optionales Speichern von Passwörtern, verschlüsselt für das aktuelle Windows-Konto.
- Datei-Downloads über den Windows-Speichern-Dialog sowie Vorschau- und Druckfenster.

### Status der Vorschau

Der Installer ist noch nicht digital signiert; Windows kann beim Start eine SmartScreen-Warnung anzeigen. Neue Client-Versionen werden manuell über einen Installer installiert. Die Weboberfläche wird weiterhin vom Server aktualisiert. Für produktive Verbindungen HTTPS verwenden.

`SHA256SUMS` enthält die SHA-256-Prüfsumme des Installers. Zum Vergleichen unter PowerShell: `Get-FileHash .\StatO-Setup-1.12.1-x64.exe -Algorithm SHA256`.

Weitere Hinweise: [Desktop-Dokumentation](https://github.com/Hubertoink/stato_okja/blob/desktop-v1.12.1/desktop/README.md).
