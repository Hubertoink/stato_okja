# StatO On-Prem Runtime

Diese Dateien sind die kanonische Laufzeitdefinition für ein veröffentlichtes
StatO-On-Prem-Release. Sie enthalten bewusst keine `build`-Abschnitte: Ein
Produktivserver zieht ausschliesslich versionierte GHCR-Images.

Die echte Konfiguration liegt in der installierten Instanz unter
`config/stato.env`. Die optionale `compose.build.yaml` ist nur für einen
bewussten Build aus einem Source-Checkout oder für Air-Gap-Umgebungen gedacht.

Die Root-Dateien `docker-compose.onprem.yml` und `.env.onprem.example` bleiben
vorübergehend als Kompatibilitätspfad für bestehende Installationen erhalten.
