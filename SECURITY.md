# Sicherheitsrichtlinie für StatO

## Sicherheitslücken melden

Bitte veröffentliche vermutete Sicherheitslücken nicht als öffentliches GitHub-Issue. Sende stattdessen eine E-Mail an [support@okja-stato.de](mailto:support@okja-stato.de) mit dem Betreff `Sicherheitsmeldung StatO`.

Hilfreich sind eine verständliche Beschreibung, betroffene Version oder Commit, Schritte zur Reproduktion sowie eine Einschätzung möglicher Auswirkungen. Bitte keine echten Zugangsdaten oder personenbezogenen Daten mitsenden.

## Umgang mit Meldungen

Wir bestätigen den Eingang zeitnah, bewerten die Meldung und stimmen einen sicheren Umgang mit Details und Veröffentlichung ab. Sicherheitskorrekturen werden vorrangig für den aktuellen `main`-Stand bereitgestellt.

## Sicherheitsrelevante Grundlagen

StatO nutzt rollenbasierte Zugriffskontrollen, organisationsbezogene Datenbereiche, JWT-gestützte Anmeldung und Audit-Informationen. Konkrete Betriebsanforderungen und Hardening-Hinweise stehen in den [Sicherheitsdokumenten](docs/security/).
