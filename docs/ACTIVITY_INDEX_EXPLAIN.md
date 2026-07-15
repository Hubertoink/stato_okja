# Aktivitaetsindizes pruefen

Die Migration `20260714200000-activity-query-indexes` erstellt drei Indizes fuer die
haeufigsten Aktivitaets- und Statistikabfragen:

- `orgId, date, startTime` fuer die paginierte Aktivitaetsliste;
- `orgId, executionStatus, date` fuer Standardstatistiken;
- `orgId, projectId, date` fuer projektbezogene Auswertungen.

Nach dem Deployment die Datenbankstatistiken aktualisieren und die folgenden
Abfragen mit echten, repräsentativen Werten ausfuehren. `EXPLAIN ANALYZE` selbst
aendert keine Daten.

```sql
ANALYZE "activities";

EXPLAIN (ANALYZE, BUFFERS)
SELECT "id", "date", "startTime"
FROM "activities"
WHERE "orgId" = '<ORG_UUID>'
  AND "date" BETWEEN DATE '<VON>' AND DATE '<BIS>'
ORDER BY "date" DESC, "startTime" DESC
LIMIT 50;

EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*)
FROM "activities"
WHERE "orgId" = '<ORG_UUID>'
  AND "executionStatus" = 'completed'
  AND "date" BETWEEN DATE '<VON>' AND DATE '<BIS>';

EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*)
FROM "activities"
WHERE "orgId" = '<ORG_UUID>'
  AND "projectId" = '<PROJEKT_UUID>'
  AND "date" BETWEEN DATE '<VON>' AND DATE '<BIS>';
```

Bei der aktuellen Datenmenge von rund 1.200 Aktivitaeten darf PostgreSQL bewusst
einen `Seq Scan` waehlen; das ist bei kleinen Tabellen oft schneller. Mit
wachsender Datenmenge sollten die Plaene die neuen Indizes als `Index Scan` oder
`Bitmap Index Scan` zeigen. Fuer die Bewertung sind insbesondere `Execution Time`,
`shared hit/read blocks` und die Anzahl der gelesenen Zeilen relevant.
