# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Die primären Nutzer sind pädagogische Mitarbeitende und Administratoren in Einrichtungen der Offenen Kinder- und Jugendarbeit (OKJA). Teams und Leitungen arbeiten gemeinsam an der Erfassung, Dokumentation und Auswertung ihrer Angebote.

## Product Purpose

StatO ist ein Statistik- und Dokumentationssystem für die OKJA. Es ermöglicht, Aktivitäten, Projekte, Veranstaltungen und aufsuchende Arbeit strukturiert zu erfassen, fachlich zu dokumentieren, gemeinsam nachzuverfolgen und für Auswertungen sowie Exporte weiterzuverwenden.

## Positioning

StatO verbindet fachliche OKJA-Dokumentation, aggregierte Statistik, gemeinsames Logbuch und Organisationsverwaltung in einer Anwendung, die sowohl im eigenen Netzwerk als auch zentral betrieben werden kann.

## Operating Context

Die Anwendung wird im Arbeitsalltag von OKJA-Teams auf Desktop- und mobilen Webgeräten genutzt. Relevante Arbeitsabläufe sind die Anlage und Bearbeitung von Aktivitäten und Projekten, Logbuch- und Übergabedokumentation, statistische Auswertung, Export sowie die Verwaltung von Rollen, Organisationen und Taxonomien.

## Capabilities and Constraints

- Aktivitäten enthalten unter anderem Datum, Dauer, Ort, Projekt, Teilnehmendenzahlen, Kategorien, Tags und Notizen.
- Projekte, Aktivitäten und Logbuch-Einträge können gemeinsam bearbeitet und nachverfolgt werden.
- Statistik- und Exportfunktionen liefern filterbare Kennzahlen, Zeitreihen, Verteilungen sowie Excel-, PDF- und Controlling-Exporte.
- Rollen, Organisationen, Zugriffe und fachliche Taxonomien werden verwaltet.
- Es werden keine personenbezogenen Daten von teilnehmenden jungen Menschen gespeichert; erfasst werden aggregierte Zählwerte und fachliche Dokumentation.
- Die Anwendung ist als responsive Web-App ausgelegt und wird per Docker im On-Prem- oder Hosted-Betrieb bereitgestellt.

## Brand Commitments

- Produktname: StatO
- Fachlicher Kontext: Statistik und Dokumentation für die Offene Kinder- und Jugendarbeit
- Bestehende Produktidentität, Inhalte und Fachbegriffe werden bei UI-Verbesserungen erhalten, sofern keine Neugestaltung beauftragt wird.

## Evidence on Hand

- `README.md` beschreibt Zweck, Funktionen, Betriebsmodelle und den lokalen Entwicklungsstack.
- Die Frontend-Routen unter `frontend/src/pages` zeigen die bestehenden Arbeitsbereiche für Aktivitäten, Projekte, Logbuch, Statistik, Einstellungen und Administration.
- `frontend/assets/Stato_Logo.png` ist das vorhandene Produktlogo.

## Product Principles

- Fachliche Dokumentation und Statistik gehören in einen gemeinsamen Arbeitsfluss.
- Gemeinsame Teamarbeit braucht nachvollziehbare Zustände, Übergaben und Berechtigungen.
- Aggregierte Daten schützen die Privatsphäre junger Menschen.
- Die Anwendung muss im Alltag auf Desktop und mobilen Webgeräten funktionieren.
- Betrieb und Datenhaltung sollen für Einrichtungen flexibel zwischen eigenem Netzwerk und Hosting wählbar sein.

## Accessibility & Inclusion

Responsive Nutzung auf Desktop und mobilen Webgeräten ist eine bestätigte Produktanforderung. Interaktionen und Inhalte müssen deshalb auch bei kleinen Viewports verständlich und bedienbar bleiben.
