# StatO-Sicherheitsarchitektur in WordPress einbetten

Die öffentliche StatO-Route `/security-architecture` ist ausschließlich für die
Einbettung auf `https://stato-okja.de` und `https://www.stato-okja.de`
freigegeben. Alle anderen StatO-Seiten bleiben gegen iframe-Einbettung gesperrt.

Nach der Veröffentlichung des Frontend-Images ist die interaktive Ansicht unter
folgender Adresse erreichbar:

```text
https://app.stato-okja.de/security-architecture?deployment=mittwald
```

Der Query-Parameter legt die beim Laden ausgewählte Ansicht fest:

- `deployment=mittwald`: aktueller Betrieb im Mittwald-Container-Stack
- `deployment=onprem`: Betrieb in der Infrastruktur der Organisation

In beiden Varianten bleibt der Umschalter im Diagramm sichtbar.

## WordPress

Im WordPress-Editor einen Block **Individuelles HTML** anlegen und diesen Code
einfügen:

```html
<iframe
  src="https://app.stato-okja.de/security-architecture?deployment=mittwald"
  title="StatO Sicherheitsarchitektur für Mittwald und On-Premises"
  loading="lazy"
  sandbox="allow-scripts allow-same-origin"
  referrerpolicy="strict-origin-when-cross-origin"
  style="display:block;width:100%;height:780px;border:0;border-radius:18px;overflow:hidden"
></iframe>
```

Soll die On-Premises-Ansicht zuerst erscheinen, im `src` nur
`deployment=mittwald` durch `deployment=onprem` ersetzen.

Für schmale Seitenlayouts kann die Höhe auf `820px` bis `900px` erhöht werden.
Die Grafik selbst passt sich automatisch an die verfügbare Breite an.

## Technische Prüfung nach einem Deployment

```powershell
$response = Invoke-WebRequest -Uri "https://app.stato-okja.de/security-architecture?deployment=mittwald" -UseBasicParsing
$response.StatusCode
$response.Headers['Content-Security-Policy']
$response.Headers['X-Frame-Options']
```

Erwartet werden Status `200`, eine CSP mit `frame-ancestors` für
`stato-okja.de` und kein `X-Frame-Options: DENY` auf dieser einen Route.
