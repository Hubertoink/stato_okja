# StatO On-Prem: internes HTTPS mit Caddy

Dieser Modus ist für einen zentralen StatO-Server im internen Netz gedacht.
Caddy stellt HTTPS bereit und leitet Anfragen intern an den StatO-Frontend-
Container weiter. Backend und PostgreSQL bleiben weiterhin nicht öffentlich.

## Zielbild

```text
Arbeitsplatz-PC → https://stato.intern.example.de → Caddy (443) → StatO
```

Voraussetzungen:

- Ein interner DNS-Name zeigt auf die LAN-IP des StatO-Servers.
- TCP-Port 443 ist in der Server-Firewall aus dem gewünschten internen Netz
  freigegeben.
- Docker und der StatO-On-Prem-Stack sind auf dem Server installiert.

`tls internal` erzeugt eine eigene Zertifikatsstelle im persistenten
`stato-onprem-caddy-data`-Volume. Damit Browser das Zertifikat akzeptieren,
muss ihr Stammzertifikat auf den Client-PCs als vertrauenswürdig importiert
werden.

## Server einrichten

### Kürzester Weg

Wenn der DNS-Name bereits auf den Server zeigt, aktiviert ein einzelner
Installer-Aufruf den internen Caddy-Modus und setzt die abhängigen Werte
automatisch:

```powershell
$env:STATO_INTERNAL_TLS_HOST='stato.intern.example.de'
irm https://github.com/Hubertoink/stato_okja/releases/latest/download/install-onprem.ps1 | iex
```

Linux/macOS:

```sh
curl -fsSL https://github.com/Hubertoink/stato_okja/releases/latest/download/install-onprem.sh | STATO_INTERNAL_TLS_HOST=stato.intern.example.de sh
```

Danach die PowerShell-Variable bei Bedarf wieder entfernen:

```powershell
Remove-Item Env:STATO_INTERNAL_TLS_HOST
```

### Manuell in der Env-Datei

In der `config/stato.env` nur diese Werte ergänzen bzw. ändern:

```dotenv
STATO_TLS_MODE=internal
STATO_PUBLIC_HOST=stato.intern.example.de
HTTPS_PORT=443
```

Der On-Prem-Installer setzt beim Start automatisch:

- `APP_ORIGIN=https://stato.intern.example.de`
- `CORS_ORIGINS=https://stato.intern.example.de`
- `AUTH_REFRESH_COOKIE_SECURE=true`
- `HTTP_BIND_ADDRESS=127.0.0.1`

Dadurch ist StatO-HTTP nicht mehr im Netzwerk erreichbar; nur Caddy veröffentlicht
HTTPS auf Port 443.

PowerShell:

```powershell
cd C:\Stato
irm https://github.com/Hubertoink/stato_okja/releases/latest/download/install-onprem.ps1 | iex
```

Linux:

```sh
cd /opt/stato
curl -fsSL https://github.com/Hubertoink/stato_okja/releases/latest/download/install-onprem.sh | sh
```

Prüfen:

```text
https://stato.intern.example.de/api/health
```

## Stammzertifikat exportieren

Das Stammzertifikat ist kein Passwort. Es darf an die vertrauenswürdigen
Arbeitsplatz-PCs verteilt werden, sollte aber nur aus der kontrollierten
Server-Installation stammen.

PowerShell auf dem StatO-Server:

```powershell
$caddy = docker compose --profile internal-tls --env-file .\config\stato.env -f .\compose.yaml ps -q caddy
docker cp "${caddy}:/data/caddy/pki/authorities/local/root.crt" .\stato-onprem-caddy-root.crt
```

Linux auf dem StatO-Server:

```sh
caddy=$(docker compose --profile internal-tls --env-file ./config/stato.env -f ./compose.yaml ps -q caddy)
docker cp "$caddy:/data/caddy/pki/authorities/local/root.crt" ./stato-onprem-caddy-root.crt
```

Beide Befehle erzeugen standardmäßig:

```text
stato-onprem-caddy-root.crt
```

Kopiere diese Datei über einen vertrauenswürdigen Weg auf die Client-PCs oder
verteile sie zentral per Gruppenrichtlinie.

## Einzelnen Windows-PC testen

Auf dem Client-PC in PowerShell ausführen (kein Administrator nötig):

```powershell
Import-Certificate -FilePath .\stato-onprem-caddy-root.crt -CertStoreLocation Cert:\CurrentUser\Root
```

Danach Browser vollständig schließen und neu öffnen. Die Anwendung muss unter
`https://stato.intern.example.de` ohne Zertifikatswarnung erreichbar sein.

Für einen Test ohne internes DNS kann in der Datei
`C:\Windows\System32\drivers\etc\hosts` auf dem jeweiligen Client folgende
Zeile ergänzt werden:

```text
<SERVER-IP> stato.test
```

Dann `STATO_PUBLIC_HOST=stato.test` verwenden. Die Hosts-Datei muss als
Administrator bearbeitet werden.

## Windows-Domäne: per Gruppenrichtlinie verteilen

Für eine Einrichtung mit Active Directory ist dies der empfohlene Weg:

1. Gruppenrichtlinienverwaltung öffnen und eine neue GPO für die StatO-Clients
   erstellen bzw. eine vorhandene Client-GPO verwenden.
2. Zu **Computerkonfiguration → Richtlinien → Windows-Einstellungen →
   Sicherheitseinstellungen → Richtlinien für öffentliche Schlüssel →
   Vertrauenswürdige Stammzertifizierungsstellen** navigieren.
3. Mit **Importieren** die Datei `stato-onprem-caddy-root.crt` auswählen.
4. Die GPO an die Organisationseinheit mit den Arbeitsplatz-PCs binden.
5. Auf einem Client `gpupdate /force` ausführen oder den PC neu starten.

Danach vertrauen alle verwalteten PCs dem internen Caddy-Zertifikat.

## Betriebshinweise

- Das Volume `stato-onprem-caddy-data` nicht löschen. Es enthält die interne
  CA; bei einem Löschen müsste das neue Stammzertifikat erneut auf allen Clients
  verteilt werden.
- Falls der manuelle Vorabtest noch läuft, ihn vor dem integrierten Modus
  beenden, weil beide Caddy-Container Port 443 belegen würden:

  ```powershell
  docker rm -f stato-caddy-test
  ```
- Nur TCP 443 aus den vorgesehenen Netzen freigeben. PostgreSQL und Backend
  bleiben intern; StatO-HTTP ist im internen TLS-Modus an `127.0.0.1` gebunden.
- Für öffentlich erreichbare Domains ist ein öffentlich vertrauenswürdiges
  Zertifikat vorzuziehen. Der hier beschriebene Modus ist absichtlich für
  interne DNS-Namen und verwaltete Client-PCs gedacht.
