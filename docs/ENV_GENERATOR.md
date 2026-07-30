# StatO `.env.onprem` Generator

Der Generator liegt unter [`docs/env-generator/`](./env-generator/) und erzeugt eine vollständige `.env.onprem` für den StatO-On-Prem-Stack. Er ist eine statische Browser-Anwendung ohne Backend, Cookies, Tracking oder Netzwerkanfragen.

## Sicherheitsmodell

- `POSTGRES_PASSWORD` und `JWT_SECRET` werden mit `crypto.getRandomValues()` direkt im Browser erzeugt.
- Die Werte werden weder versendet noch in `localStorage` gespeichert.
- Die heruntergeladene Datei enthält Zugangsdaten. Sie darf nicht committed, per E-Mail unverschlüsselt verschickt oder öffentlich geteilt werden.
- `JWT_SECRET` muss nach dem ersten produktiven Start erhalten bleiben. Ein Wechsel meldet bestehende Sitzungen ab.

## Lokal testen

Die Dateien sind bewusst ohne Build-Schritt nutzbar. Für einen lokalen Test kann beispielsweise ein statischer Webserver im Projektverzeichnis verwendet werden:

```powershell
npx serve docs/env-generator
```

Die Konsistenz zur aktuellen On-Prem-Vorlage wird mit folgendem Test geprüft:

```powershell
npm run test:env-generator
```

Der Test stellt sicher, dass jede nicht auskommentierte Variable aus [`.env.onprem.example`](../.env.onprem.example) auch erzeugt wird. Bei Änderungen an der Vorlage muss deshalb der Generator mit aktualisiert werden.

## Bereitstellung

Der Ordner `docs/env-generator/` muss als statischer Inhalt unter folgender URL bereitgestellt werden:

```text
https://stato-okja.de/env-generator/
```

Dabei müssen `index.html`, `styles.css`, `env-generator.js` und `template.js` gemeinsam in diesem Verzeichnis liegen. Die App benötigt keine Server-Konfiguration und darf nicht durch ein WordPress-Plugin minifiziert oder in andere Seiten-Skripte eingebettet werden.

Für die erste Veröffentlichung bietet sich ein Upload der vier Dateien in das entsprechende Webroot-Verzeichnis an. Danach kann derselbe Ordner über den bestehenden Deployment-Workflow automatisiert veröffentlicht werden.

## WordPress / Neve einbinden

Auf der Dokumentationsseite im Neve-Block **Individuelles HTML** einfügen:

```html
<iframe
  src="https://stato-okja.de/env-generator/"
  title="StatO .env.onprem Generator"
  loading="lazy"
  style="width:100%; min-height:1500px; border:0; border-radius:12px;"
></iframe>
```

Die Mindesthöhe kann nach einem visuellen Test angepasst werden. Da Quelle und WordPress-Seite dieselbe Domain verwenden, sind keine zusätzlichen Cookie-, CORS- oder Datenschutzfreigaben erforderlich.

## Bedienung

1. Betriebsart und öffentliche Adresse festlegen.
2. Optional E-Mail-Versand, SMTP und Zwei-Faktor-Authentifizierung aktivieren.
3. Secrets nur bei Bedarf mit **Neu erzeugen** ersetzen.
4. Datei herunterladen und als `.env.onprem` im StatO-Installationsverzeichnis ablegen.
5. Die On-Prem-Installation wie in [DOCKER_ONPREM_SETUP.md](./DOCKER_ONPREM_SETUP.md) fortsetzen.
