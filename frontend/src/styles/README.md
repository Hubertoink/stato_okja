# Globale Styles

Die globalen Styles sind in `main.tsx` in ihrer Kaskadenreihenfolge eingebunden. Die Reihenfolge ist absichtlich nicht alphabetisch: Sie entspricht der bisherigen Reihenfolge von `index.css`.

## Aktuelle Zuständigkeiten

- `foundation.css`, `themes.css`, `document.css`: Grundgerüst und Design-Tokens
- `theme-utilities.css`: theme-aware Utility-Overrides
- `shell.css`, `navigation.css`: App-Shell, Header und Navigation
- `settings-admin.css`: Settings- und Organisationsverwaltung
- `overlays-modals.css`: Modale, Scroll-Verhalten und Overlay-Regeln
- `activity-calendar.css`: Aktivitäten, Kalender und kalendernahe Oberflächen
- `dashboard-core.css`, `statistics.css`, `dashboard-logbook.css`: Dashboard, Statistik und Logbuch
- `common.css`: gemeinsam verwendete UI- und Utility-Regeln
- `theme-overrides.css`: zusätzliche Theme-Familien und Dark-Mode-Overrides

Die Aufteilung ist zunächst verhaltensneutral aus dem früheren `index.css` übernommen. In der nächsten Phase werden Duplikate, globale Tailwind-Overrides und `!important`-Regeln gezielt bereinigt. Neue seitenbezogene Regeln sollten in das passende Modul aufgenommen werden und nicht wieder in `index.css` landen.

## Regeln für neue Styles

- Dark-Mode-Regeln verwenden `:root[data-color-mode='dark']`, nicht einzelne Theme-Namen.
- `!important` ist grundsätzlich eine Ausnahme. Es ist für die zentralen Tailwind-Kompatibilitätsadapter sowie isolierte Export-Styles zulässig; jede neue Verwendung braucht eine kurze Begründung.
- Eine Regel erhält genau ein zuständiges Modul. Gemeinsame UI-Regeln gehören nach `common.css`, seitenbezogene Regeln in ihr Feature-Modul.
- Vor einem neuen Breakpoint prüfen, ob die bestehende Skala `640 / 768 / 1024 / 1101 / 1200 px` ausreicht.
