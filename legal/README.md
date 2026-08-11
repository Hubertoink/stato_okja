# Rechtstexte anpassen

Diese Dateien gehören zur jeweiligen StatO-Instanz und sind vor dem Produktiveinsatz rechtlich zu prüfen und anzupassen.

## Import über die StatO-Oberfläche (empfohlen für ZimaOS)

Ein Superadmin kann unter **Benutzermenü → Rechtstexte** eine oder mehrere Markdown-Dateien für **Impressum**, **Datenschutz** und **Nutzungsbedingungen** hochladen. Nur ausgewählte Dateien werden ersetzt. Nach dem Import werden sie in der StatO-Datenbank gespeichert und bei Updates der Container nicht überschrieben. Wird die Datei mit den Nutzungsbedingungen importiert, erzeugt StatO automatisch eine neue Version; alle bestehenden Nutzer:innen müssen dieser Version erneut zustimmen. Die aktuellen Texte lassen sich dort auch wieder als Markdown-Dateien herunterladen.

Der Cookie-Hinweis ist kein viertes importierbares Rechtsdokument. Er beschreibt ausschließlich die technische Browser-Speicherung von StatO.

## Dateien im Deployment

1. Bearbeiten Sie `imprint.de.md`, `privacy.de.md` und `terms.de.md` in einfachem Markdown.
2. Für eine weitere Oberflächensprache legen Sie je Dokument eine Datei mit der Sprachkennung in Klammern an, zum Beispiel `imprint (en).md`, `privacy (en).md` und `terms (en).md`. StatO liefert diese Fassung aus, wenn die Sprache ausgewählt ist; fehlt eine Datei, wird automatisch die im Manifest hinterlegte Standarddatei verwendet. Die alternative Schreibweise `imprint.en.md` wird ebenfalls erkannt.
3. Ändern Sie bei jeder inhaltlichen Änderung der Nutzungsbedingungen `termsVersion` in `manifest.json`.
4. Starten Sie das Backend neu oder aktualisieren Sie die Dateien in einem eingebundenen `LEGAL_CONTENT_DIR`. Die Inhalte werden bei jedem Abruf neu gelesen.

Unterstützt werden Überschriften (`#`, `##`), Absätze, Aufzählungen mit `-` und Hinweisblöcke mit `>`; HTML wird absichtlich nicht gerendert.

Bei Docker-Compose kann ein alternatives Verzeichnis schreibgeschützt in den Container eingebunden werden. Siehe `LEGAL_CONTENT_DIR` und `LEGAL_CONTENT_DIR_HOST` in den Beispiel-Konfigurationen.
