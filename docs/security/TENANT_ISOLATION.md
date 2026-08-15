# Mandantentrennung und Organisationsmitgliedschaften

StatO behandelt jede Organisation als getrennten Datenmandanten. Die
Organisationshierarchie ist eine Verwaltungsstruktur und verleiht **keinen**
automatischen Zugriff auf Daten von Eltern-, Kind- oder Geschwisterorganisationen.

## Verbindliche Regeln

1. Jede Datenabfrage, Detailansicht, Änderung und Löschung verwendet genau die
   `effectiveOrgId` der Anfrage. Abfragen über Unterorganisationen sind für
   fachliche Daten verboten.
2. Der Header `X-Org-Scope` ist für normale Konten nur gültig, wenn eine aktive
   `organization_memberships`-Zeile für genau diese Organisation existiert.
   Fehlende, leere oder fremde Scopes werden mit `403` abgewiesen; es gibt kein
   stilles Zurückfallen auf eine andere Organisation.
3. Ein Konto ist global durch seine E-Mail-Adresse eindeutig. Der Zugriff und
   die Rolle je Organisation stehen ausschließlich in
   `organization_memberships` (`userId`, `orgId`, `role`, `status`).
4. Ein Organisationswechsel im UI ändert nur den aktiven Kontext. Er verändert
   weder Daten noch die Mitgliedschaften.
5. Eine Zuweisung zu einer weiteren Organisation legt eine zusätzliche
   Mitgliedschaft an. Ein Entzug deaktiviert nur diese Mitgliedschaft und löscht
   nicht automatisch das Konto. Das verhindert Passwort- oder E-Mail-Dubletten.
6. Request-Bodies dürfen für normale Konten keine Organisation bestimmen. Der
   Server ersetzt oder verwirft `orgId` anhand des verifizierten Scopes.
7. Superadmins dürfen Organisationen bewusst auswählen; ohne ausgewählten Scope
   ist der Mandantenkontext `null` und niemals eine organisationsübergreifende
   Zusammenfassung.

## Umsetzungshinweise

- Neue organisationsgebundene Controller erhalten `JwtAuthGuard`,
  `OrgScopeGuard` und – wenn nötig – danach `RolesGuard`.
- Neue Services verwenden `resolveOrgScope()` für Listen und
  `assertExactOrgScopedEntityAccess()` für Detail- und Mutationspfade.
- Tests müssen mindestens beweisen, dass ein Scope ohne Mitgliedschaft `403`
  liefert und dass Daten einer Kindorganisation im Elternkontext nicht sichtbar
  oder veränderbar sind.
- Strukturelle Organisationsverwaltung und bewusst konfigurierte Stammdaten-
  Vererbung sind getrennt von fachlichen Daten wie Aktivitäten, Projekten,
  Umfragen, Logbuch und Statistik zu behandeln.
