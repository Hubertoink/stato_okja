<p align="center">
  <img src="frontend/assets/Stato_Logo.png" width="128" alt="StatO Logo">
</p>

<h1 align="center">StatO</h1>

<p align="center">
  <strong>Statistik und Dokumentation für die Offene Kinder- und Jugendarbeit.</strong>
</p>

<p align="center">
  <a href="https://github.com/Hubertoink/stato_okja/actions/workflows/docker-images.yml"><img src="https://github.com/Hubertoink/stato_okja/actions/workflows/docker-images.yml/badge.svg?branch=main" alt="Build-Status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/Hubertoink/stato_okja" alt="MIT-Lizenz"></a>
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
</p>

<p align="center">
  <a href="#schnellstart">Schnellstart</a> ·
  <a href="docs/DOCKER_ONPREM_SETUP.md">On-Prem betreiben</a> ·
  <a href="docs/ARCHITECTURE.md">Architektur</a> ·
  <a href="CONTRIBUTING.md">Beitragen</a>
</p>

StatO hilft Teams, Leitungen und Trägern, Angebote der OKJA nachvollziehbar zu dokumentieren, auszuwerten und sicher im Team zu bearbeiten. Die Anwendung kann selbst im eigenen Netz betrieben oder zentral gehostet werden.

## Wofür StatO gedacht ist

- Angebote, Projekte, Veranstaltungen und aufsuchende Arbeit einheitlich erfassen
- Teilnehmendenzahlen, Alterskohorten, Kategorien und Tags auswerten
- Logbuch, Übergaben und Nachbesprechungen an einem Ort führen
- Rollen, Organisationen und Zugriffe sauber verwalten
- Daten als Excel-, PDF- und Controlling-Export weiterverwenden

StatO speichert keine personenbezogenen Daten von teilnehmenden jungen Menschen. Erfasst werden aggregierte Zählwerte und fachliche Dokumentation.

## Funktionen im Überblick

| Bereich | Was StatO bietet |
| --- | --- |
| Aktivitäten | Erfassung von Datum, Dauer, Ort, Projekt, Teilnehmendenzahlen, Kategorien, Tags und Notizen |
| Logbuch | Beobachtungen, Übergaben, Kommentare und Status für die gemeinsame Nachverfolgung |
| Statistik | Kennzahlen, Zeitreihen, Verteilungen und filterbare Auswertungen |
| Exporte | Rohdaten, formatierte Excel-Arbeitsmappen, PDF-Berichte und Controllingdaten |
| Organisation | Rollen, Mandanten/Organisationen, Audit-Informationen und konfigurierbare Taxonomien |
| Betrieb | Docker-Deployment, PWA-Unterstützung und On-Prem-Betrieb im eigenen Netzwerk |

## Schnellstart

### On-Prem mit Docker

Voraussetzung sind Docker und das Docker-Compose-Plugin. Der Installer lädt ein
versioniertes Release-Bundle, prüft dessen SHA-256-Summe, erzeugt individuelle Secrets und legt
die echte Konfiguration getrennt unter `config/stato.env` ab.

Linux/macOS:

```bash
curl -fsSL https://github.com/Hubertoink/stato_okja/releases/latest/download/install-onprem.sh | sh
```

Windows PowerShell:

```powershell
irm https://github.com/Hubertoink/stato_okja/releases/latest/download/install-onprem.ps1 | iex
```

Danach ist StatO standardmäßig unter `http://localhost` beziehungsweise der IP-Adresse des Servers erreichbar. Ist Port 80 bei einer neuen lokalen Installation bereits belegt, wählt der Installer automatisch einen freien Port zwischen 8080 und 8090 und zeigt die Adresse an. Die vollständige Anleitung, einschließlich SMTP, Domain und Branding, steht in der [Docker-On-Prem-Anleitung](docs/DOCKER_ONPREM_SETUP.md).

Für interne HTTPS-Installationen mit Caddy gibt es zusätzlich die Anleitung [Caddy internes TLS](docs/CADDY_INTERNAL_TLS_ONPREM.md).

Für die Installation als Custom-App auf einem ZimaOS-NAS steht eine eigene
[ZimaOS-Anleitung](docs/ZIMAOS_SETUP.md) mit importierbarer Compose-Datei zur
Verfügung.

### Lokale Entwicklung

```bash
npm install
docker compose up -d

# Terminal 1
npm run dev:backend

# Terminal 2
npm run dev:frontend
```

- Frontend: <http://localhost:5173>
- Backend-API: <http://localhost:3000>
- MinIO-Konsole: <http://localhost:9001>

Weitere Hinweise: [Erste Schritte](GETTING_STARTED.md) und [Umgebungsvariablen](docs/ENVIRONMENT_VARIABLES.md).

## Architektur und Betrieb

StatO ist als TypeScript-Monorepo aufgebaut:

- **Frontend:** React, Vite, React Query, Tailwind CSS und PWA-Unterstützung
- **Backend:** NestJS, TypeORM, JWT-basierte Anmeldung und rollenbasierte Berechtigungen
- **Datenhaltung:** PostgreSQL im Betrieb, S3-kompatibler Dateispeicher über MinIO
- **Deployment:** Docker Compose für On-Prem- und Hosted-Szenarien

Details: [Architektur](docs/ARCHITECTURE.md), [On-Prem-Betrieb](docs/DOCKER_ONPREM_SETUP.md) und [Mittwald-Deployment](DEPLOY_MITTWALD.md).

## Projektstatus und Roadmap

StatO wird aktiv weiterentwickelt. Die aktuelle Orientierung für Produkt, Betrieb und Community findet sich in der [Roadmap](docs/ROADMAP.md). Änderungen zwischen Versionen stehen im [Changelog](CHANGELOG.md).

## Mitwirken

Beiträge, Fehlerberichte und fachliches Feedback aus der OKJA sind willkommen. Bitte lies vor dem Einstieg den [Beitragsleitfaden](CONTRIBUTING.md). Sicherheitsrelevante Hinweise bitte nicht öffentlich als Issue melden, sondern nach [SECURITY.md](SECURITY.md).

## Lizenz und Kontakt

StatO steht unter der [MIT-Lizenz](LICENSE). Fragen und Rückmeldungen: [support@okja-stato.de](mailto:support@okja-stato.de).
