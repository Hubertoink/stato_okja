# Rechtstexte anpassen

Diese Dateien gehören zur jeweiligen StatO-Instanz und sind vor dem Produktiveinsatz rechtlich zu prüfen und anzupassen.

1. Bearbeiten Sie `imprint.de.md`, `privacy.de.md` und `terms.de.md` in einfachem Markdown.
2. Ändern Sie bei jeder inhaltlichen Änderung der Nutzungsbedingungen `termsVersion` in `manifest.json`.
3. Starten Sie das Backend neu oder aktualisieren Sie die Dateien in einem eingebundenen `LEGAL_CONTENT_DIR`. Die Inhalte werden bei jedem Abruf neu gelesen.

Unterstützt werden Überschriften (`#`, `##`), Absätze, Aufzählungen mit `-` und Hinweisblöcke mit `>`; HTML wird absichtlich nicht gerendert.

Bei Docker-Compose kann ein alternatives Verzeichnis schreibgeschützt in den Container eingebunden werden. Siehe `LEGAL_CONTENT_DIR` und `LEGAL_CONTENT_DIR_HOST` in den Beispiel-Konfigurationen.
