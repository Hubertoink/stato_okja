# StatO-Release-Prozess

Ein StatO-Release ist ein unveraenderlicher Git-Tag `v<Version>` auf `main`.
Die Version in `VERSION`, im Root-Package sowie in Backend und Frontend muss
identisch sein; `npm run version:check` prueft dies.

## Release erstellen

1. Release-Stand nach `main` mergen und den erfolgreichen Workflow
   **Tests und PostgreSQL-Migrationen** abwarten.
2. Die Version in allen Versionsdateien erhoehen und nochmals nach `main`
   mergen.
3. Auf dem entsprechenden Main-Commit den Tag erstellen und pushen:

   ```bash
   git tag -a v1.0.0 -m "StatO 1.0.0"
   git push origin v1.0.0
   ```

4. Den Workflow **Build and publish Docker images** abwarten und die GitHub
   Release-Notizen mit den wichtigsten Aenderungen, Upgrade-Hinweisen und der
   getesteten Version veroeffentlichen.

Der Workflow akzeptiert Release-Tags nur, wenn sie exakt `v` plus dem Inhalt
von `VERSION` entsprechen und ihr Commit in `main` enthalten ist. Vor dem
Image-Build laufen Versionscheck, Backend-/Frontend-Tests, beide Builds und ein
frischer PostgreSQL-Migrationslauf.

## Image-Tags

Ein stabiler Release `v1.0.0` veroeffentlicht diese Images:

- `ghcr.io/hubertoink/stato-backend:1.0.0`
- `ghcr.io/hubertoink/stato-frontend:1.0.0`
- `ghcr.io/hubertoink/stato-backup:1.0.0`

Zusätzlich werden `1.0`, `1` und `latest` auf diesen stabilen Release gesetzt.
Vorabversionen wie `v1.1.0-rc.1` erhalten kein `latest`. Der Branch `dev`
liefert weiterhin den Tag `dev`; dieser ist nicht für Produktivinstallationen
gedacht.

Die Release-Images enthalten beim Frontend den On-Prem-Proxy-Modus, damit
`/api` innerhalb des Compose-Netzwerks an das Backend weitergereicht wird.
Installations- und Update-Beispiele stehen in
[DOCKER_ONPREM_SETUP.md](DOCKER_ONPREM_SETUP.md).

## Einmalige Repository-Einstellungen

Vor dem ersten öffentlichen Release in GitHub sicherstellen:

- Die drei GHCR-Packages sind für die vorgesehenen Nutzer lesbar (für eine
  einfache On-Prem-Installation üblicherweise öffentlich).
- `main` ist geschützt; direkte Pushes sind deaktiviert und mindestens der
  Statuscheck **Tests und PostgreSQL-Migrationen** ist erforderlich.
- Der `GITHUB_TOKEN` darf Packages schreiben; die Workflow-Berechtigungen sind
  bereits im Repository festgelegt.

Ein Rollback verwendet wieder eine zuvor veröffentlichte Image-Version. Da
Datenbankmigrationen nicht automatisch rückgängig gemacht werden, ist vor jedem
Upgrade ein geprüftes Datenbank- und Upload-Backup Pflicht.
