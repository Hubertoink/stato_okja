# Container-Security-Triage

Stand: 2026-07-26

## Anlass und Vorgehen

Die GitHub-Code-Scanning-Ansicht auf `main` enthielt 204 offene Trivy-Alerts
(3 kritisch, 67 hoch, 82 mittel, 51 niedrig). Viele davon stammen aus einem
älteren Image-Scan und nicht aus einer neuen Änderung im Anwendungscode.

Die Images wurden lokal mit aktuellen, ungecachten Basis-Images neu gebaut und
mit Trivy geprüft. Die CI zieht die Basis-Images künftig bei jedem Image-Build
explizit neu (`pull: true`), damit ein nachfolgender Scan nicht auf einem alten
Build-Cache basiert.

## Umgesetzte Bereinigung

- Backend-Build und -Runtime auf `node:22-alpine` aktualisiert.
- `archiver` auf 8 und `sharp` auf 0.35.3 aktualisiert. Der Systemdatenexport
  lädt das ESM-only-Archiver-Modul kompatibel aus dem CommonJS-Nest-Build.
- Das im Backend-Runtime-Image nicht benötigte `npm`/`npx` wird nach der
  Installation entfernt.
- Frontend-Runtime auf `nginxinc/nginx-unprivileged:1.29-alpine` aktualisiert
  und die nicht benötigte Curl-Paketsammlung entfernt.
- Im Backup-Image wird der unbenutzte `gosu`-Helper entfernt; der Container
  führt ausschließlich `pg_dump` und das StatO-Backup-Skript aus.

## Ergebnis der lokalen Image-Scans

| Image | Kritisch | Hoch | Verbleibende Ursache |
| --- | ---: | ---: | --- |
| Backend | 0 | 2 | `brace-expansion` über TypeORM 0.3.31 → glob/minimatch |
| Frontend | 0 | 7 | Noch nicht gepatchte Alpine-Pakete im aktuell verfügbaren Nginx-1.29-Basisimage |
| Backup | 0 | 0 | – |

Die verbleibenden sieben Frontend-Findings betreffen `libexpat`, `libcrypto3`,
`libssl3` und `libxml2`. Für die in Nginx 1.29 enthaltene Alpine-Linie war zum
Prüfzeitpunkt noch kein Image mit den von Trivy verlangten Paketständen
verfügbar. Es wird kein Wechsel auf Alpine Edge und keine Alert-Unterdrückung
vorgenommen.

Die zwei Backend-Findings erfordern ein abgestimmtes TypeORM-Major-Upgrade.
Eine transitive Override-Regel würde zwar den Scanner beruhigen, kann aber das
von TypeORM erwartete Glob-/Minimatch-Verhalten verändern und wird daher nicht
ohne eigene Upgrade- und Migrationstest-Arbeit eingesetzt.

## Nachverfolgung

1. Nach dem Merge nach `main` den Image-/Trivy-Workflow ausführen lassen. Erst
   dessen neue SARIF-Ergebnisse können die alten `main`-Alerts in GitHub als
   behoben markieren.
2. Nginx-Basisimage erneut aktualisieren, sobald die gepatchten Alpine-Pakete
   in einem stabilen `nginx-unprivileged`-Tag verfügbar sind.
3. TypeORM als separaten Major-Upgrade-Schritt inklusive Migrations-, Export-
   und Integrationschecks planen.

## Durchgeführte Validierung

- Backend-Unit-Tests und Produktionsbuild
- Frontend-Typecheck, UI-Tests und Produktionsbuild
- PostgreSQL-Erststart, alle Migrationen und zweiter idempotenter Start
- Runtime-Check für den ESM-Systemdatenexport sowie das Backup-Entrypoint-Skript
