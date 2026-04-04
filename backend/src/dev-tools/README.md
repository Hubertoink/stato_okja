# Dev Tools – Testdaten

Dieses Modul stellt Dev-Only Werkzeuge für StatO bereit. Aktuell enthält es die Generierung realistischer Testdaten für die offene Kinder- und Jugendarbeit.

## Zweck

Die Testdaten-Funktion ist dafür gedacht, in der `dev`-Umgebung schnell große, realistische Datenmengen für diese Bereiche zu erzeugen:

- Projekte
- Aktivitäten
- Dashboard
- Kalender
- Statistik
- Export

Die Daten werden organisationsbezogen erzeugt und sind so aufgebaut, dass typische OKJA-Szenarien abgebildet werden, zum Beispiel:

- Offener Treff
- Gruppenangebote
- Geschlossene Gruppen
- Veranstaltungen
- Aufsuchende Arbeit

## Voraussetzungen

Die Tools sind absichtlich in Produktion gesperrt.

Damit die Funktion im Backend-Container aktiv ist, dürfen `NODE_ENV` und `APP_ENV` **nicht** auf `production` stehen.

Zusätzlich ist das Frontend-Menü für Dev Tools nur sichtbar, wenn das Vite-Feature-Flag `VITE_ENABLE_DEV_TOOLS=true` beim Frontend-Build gesetzt wurde.

Empfohlene Container-Variablen:

```yaml
environment:
  NODE_ENV: development
  APP_ENV: development
  DB_MIGRATIONS_RUN: true
```

Wichtig:

- Wenn `NODE_ENV=production` gesetzt ist, bleibt die Funktion deaktiviert.
- `APP_ENV=development` allein reicht dann nicht aus.
- Wenn der Container mit `NODE_ENV=development` läuft, sollten Migrationen explizit über `DB_MIGRATIONS_RUN=true` aktiviert oder vorab manuell ausgeführt werden, damit das Schema aktuell ist.
- Für `main` oder Produktions-Builds sollte `VITE_ENABLE_DEV_TOOLS=false` bleiben, auch wenn ein `superadmin` eingeloggt ist.
- Für gezielte Freischaltung in einer Build-Umgebung gilt: Backend nur mit nicht-produktivem `NODE_ENV`/`APP_ENV`, Frontend zusätzlich mit `VITE_ENABLE_DEV_TOOLS=true`.

## Nutzung in der Oberfläche

Die Funktion ist im Frontend im Benutzer-Menü des `superadmin` unter `Dev Tools` erreichbar.

Voraussetzungen:

- Login als `superadmin`
- `VITE_ENABLE_DEV_TOOLS=true` im Frontend-Build
- Es muss oben ein konkreter Org-Scope ausgewählt sein

Danach:

1. Preset auswählen
2. Optional vorhandene generierte Testdaten der Organisation löschen lassen
3. `Testdaten erzeugen` klicken

## Presets

- `Klein`: 8 Projekte, 250 Aktivitäten, 4 Monate
- `Realistisch`: 20 Projekte, 1200 Aktivitäten, 12 Monate
- `Groß`: 50 Projekte, 8000 Aktivitäten, 24 Monate

## Verhalten der Generierung

Die Generierung arbeitet auf der aktuell gewählten Organisation und ergänzt bei Bedarf automatisch fehlende Stammdaten:

- Kategorien
- Tags
- Orte
- Kohorten
- Test-Team

Erzeugte Datensätze werden intern markiert, damit sie gezielt wieder entfernt werden können.

## Aufräumen

Über `Erzeugte Testdaten löschen` werden nur automatisch generierte Testdaten der aktuell gewählten Organisation gelöscht.

Normale Bestandsdaten bleiben unberührt.

## Technische Einstiegspunkte

- Controller: `backend/src/dev-tools/dev-tools.controller.ts`
- Service: `backend/src/dev-tools/dev-tools.service.ts`
- Frontend UI: `frontend/src/pages/SettingsTestData.tsx`
- Frontend Hook: `frontend/src/lib/devTools.ts`