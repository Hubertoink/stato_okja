# Quality Gates

## Backend-Lint

`npm run lint:check --workspace=backend` ist ein rein lesender Check und darf keine Dateien ändern.
Das aktuelle Budget beträgt **0 Warnungen**; ESLint meldet die tatsächliche Anzahl und schlägt fehl,
sobald eine Warnung entsteht. `npm run lint:fix --workspace=backend` ist ausschließlich der explizite,
lokale Reparaturschritt. Seed-CLI-Ausgaben und bewusst untypisierte Test-Doubles sind gezielt von den
jeweils unpassenden Regeln ausgenommen; der Produktivcode bleibt davon erfasst.

## TypeScript-Striktheit

Die globale Backend-Konfiguration bleibt während der Migration kompatibel. Der separate Check
`npm run type-check:strict --workspace=backend` prüft den Auth-Scope und die DTO-Grenzen bereits
mit allen Strict-Optionen. Weitere fachliche Module werden erst nach eigener Fehlerbereinigung in
`backend/tsconfig.quality.json` aufgenommen; damit bleibt die Verschärfung nachvollziehbar und
kein Big-Bang.
