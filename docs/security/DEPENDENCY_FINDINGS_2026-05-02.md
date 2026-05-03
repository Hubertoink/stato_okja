# Dependency-Findings

Stand: 2026-05-02

## Ausgefuehrte Befehle

```powershell
npm audit --workspaces --audit-level=high --json
npm audit fix --workspaces
npm install -w frontend jspdf@^4.2.1
npm uninstall -w backend xlsx
npm uninstall -w frontend xlsx @types/xlsx
npm install -w backend multer@2.1.1 --save
```

## Ergebnis

Nach den kompatiblen Updates und gezielten Paketwechseln meldet `npm audit --workspaces --json`:

| Severity | Anzahl |
| --- | ---: |
| Critical | 0 |
| High | 17 |
| Moderate | 20 |
| Low | 4 |
| Gesamt | 41 |

Die kritischen Findings sind beseitigt. Die verbleibenden High-Findings benoetigen entweder Major-Upgrades oder eine bewusste Paketabloesung.

## Umgesetzt

- `jspdf` wurde auf `^4.2.1` aktualisiert; das vorherige kritische `dompurify`/`jspdf`-Finding ist damit weg.
- Direkte `xlsx`-Dependencies wurden entfernt. Der Backend-Systemdatenexport erzeugt das lesbare XLSX jetzt intern ueber `jszip` und schreibt keine Nutzerwerte als Excel-Formeln.
- Direkte Backend-`multer`-Version wurde auf `2.1.1` gehoben.
- Lockfile-Updates aus `npm audit fix` aktualisieren u. a. `react-router-dom`, `vite` innerhalb v5, `nodemailer` innerhalb v7, `postcss`, `rollup`, `typeorm`, `validator`, `webpack` und mehrere transitive Parser-/Glob-Pakete.
- Backend-, Frontend-Typecheck und Frontend-Build wurden nach den Updates erfolgreich ausgefuehrt.

## Verbleibende High-Findings

| Gruppe | Ursache | Entscheidung |
| --- | --- | --- |
| Nest Runtime | `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/testing`, transitive `multer` | Fix erfordert Nest 11. Als eigener Major-Upgrade-Schritt planen und mit API-/E2E-Test absichern. |
| Nest Tooling | `@nestjs/cli`, `glob`, `picomatch`, `webpack` | Fix erfordert Nest CLI 11. Dev-/Build-Tooling, nicht direkt Runtime; mit Nest-11-Arbeit zusammenziehen. |
| Swagger/Config | `@nestjs/swagger`, `@nestjs/config`, transitive `lodash`/`js-yaml` | Fix erfordert Major-Upgrades. Swagger ist in Strict-Security-Mode nicht oeffentlich exponiert. |
| TypeScript ESLint | `@typescript-eslint/*`, `minimatch` | Fix erfordert ESLint/TypeScript-ESLint-Major. Separat mit Lintlauf pruefen. |
| PWA/Workbox | `workbox-build`, `@rollup/plugin-terser`, `serialize-javascript` | Fix erfordert PWA/Build-Tooling-Upgrade. Buildzeit-Risiko, nicht Server-Runtime. |

## Verbleibende Moderate-Findings

- `vite`/`esbuild`: Fix erfordert Vite-Major. Der produktive Container liefert statische Assets ueber Nginx aus; Vite-Devserver ist kein Produktionsdienst.
- `nodemailer`: v7 ist auf die aktuelle 7.x-Linie gehoben; npm markiert die vollstaendige Bereinigung erst mit v8-Major.
- `typeorm-sqljs`/`yargs-parser`: kein Fix verfuegbar. Wenn `typeorm-sqljs` nicht mehr benoetigt wird, sollte es in einem Folge-PR entfernt werden.
- `uuid` via TypeORM/Nest-TypeORM: vollstaendige Bereinigung erst mit Nest-TypeORM/TypeORM-Major-Kombination.

## Empfohlene Folgearbeit

1. Eigenen Branch fuer Nest 11: `@nestjs/*`, `@nestjs/swagger`, `@nestjs/typeorm`, `@nestjs/config`, `@nestjs/cli` gemeinsam aktualisieren.
2. Separaten Frontend-Build-Branch fuer Vite/PWA/Workbox-Major.
3. Pruefen, ob `typeorm-sqljs` in Runtime oder Tests noch gebraucht wird; falls nicht, entfernen.
4. Danach `npm audit --workspaces --audit-level=high`, Backend-Build, Frontend-Typecheck, Frontend-Build und relevante Backend-Tests erneut ausfuehren.