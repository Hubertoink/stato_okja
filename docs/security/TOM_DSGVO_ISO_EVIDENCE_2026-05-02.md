# TOM-, DSGVO- und ISO-Nachweise

Stand: 2026-05-02

Dieses Dokument sammelt technische Evidenz fuer Betrieb, Datenschutz und Audit. Es ist ein Arbeitsnachweis fuer TOMs nach DSGVO Art. 32 sowie fuer ISO-orientierte Sicherheitskontrollen. Organisatorische Angaben wie Verantwortliche, Freigaben, AV-Vertraege und Aufbewahrungsentscheidungen muessen vom Betreiber ergaenzt werden.

## Scope

- Anwendung: StatO On-Prem / Production Docker Deployment.
- Daten: Organisationsdaten, Nutzerkonten, Aktivitaeten, Projekte, Statistikdaten, Upload-Dateien, Auditdaten.
- Komponenten: Backend, Frontend, Postgres, Docker Compose, GitHub Actions Build/Scan.

## Technische Massnahmen

| Bereich | Massnahme | Evidenz |
| --- | --- | --- |
| Zugriffskontrolle | Rollenbasierte Guards, Org-Scope, kurze Access Tokens, Refresh-Cookie mit CSRF-Schutz | `backend/src/auth`, `docs/security/SECURITY_HARDENING_PLAN_2026-05-02.md` |
| Session-Kontrolle | Multi-Device Refresh-Session-Tabelle, Session-Liste und Widerruf im Profil | `backend/src/auth/entities/refresh-session.entity.ts`, `frontend/src/pages/MyProfile.tsx` |
| Passwortschutz | Passwortpolicy, Reset-Token-Versionierung, Session-Widerruf bei Passwortaenderung | `backend/src/auth/password-policy.ts`, `backend/src/auth/auth.service.ts` |
| Fehler- und Informationsschutz | Globaler Exception-Filter redigiert interne 500er im Strict-Security-Mode | `backend/src/common/http-exception.filter.ts` |
| Mail-/Reset-Schutz | Invite-/Reset-Links werden in Strict-Security-Mode ohne SMTP nicht geloggt | `backend/src/email/email.service.ts` |
| Container-Haertung | Non-root Runtime, read-only Root FS, tmpfs, cap drop, no-new-privileges | `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.onprem.yml`, `docker-compose.prod.yml` |
| Transport/Proxy | HSTS in Nginx, HTTPS-konforme Cookie-Defaults im Strict-Security-Mode | `frontend/nginx*.conf`, `backend/src/auth/auth.controller.ts` |
| Backup/Restore | Docker-basierter Postgres-Custom-Dump, Upload-Archiv, Restore-Skript, Retention-Option, Superadmin-Hinweis und Restore-Testprotokoll | `scripts/onprem-backup.ps1`, `scripts/onprem-restore.ps1`, `frontend/src/pages/SuperAdminSystemData.tsx`, `docs/security/BACKUP_RESTORE_RUNBOOK_2026-05-02.md` |
| Datenexport/-Loeschung | Superadmin-Systemdatenexport, destruktive Operationen mit Passwort und Bestaetigungstext | `backend/src/system-data`, `frontend/src/pages/SuperAdminSystemData.tsx` |
| Dependency Management | Dependabot, Trivy Image Scan, npm-Audit-Doku, SBOM/Provenance | `.github/workflows/docker-images.yml`, `docs/security/DEPENDENCY_FINDINGS_2026-05-02.md` |
| Auditierbarkeit | Audit-Service und Audit-Dashboard fuer relevante Admin-/Datenaktionen | `backend/src/common/audit.service.ts`, `frontend/src/pages/SuperAdminAudit.tsx` |

## DSGVO Art. 32 Zuordnung

| Anforderung | Technische Umsetzung | Status |
| --- | --- | --- |
| Vertraulichkeit | Rollen/Org-Scope, JWT/Refresh-Schutz, Secrets nicht im Image, SMTP-Link-Logging verhindert | Technisch umgesetzt |
| Integritaet | DTO-Validierung fuer kritische destruktive Endpunkte, Audit-Logging, CSRF fuer Refresh | Teilweise umgesetzt, DTO-Ausbau fortsetzen |
| Verfuegbarkeit | Healthchecks, Backup/Restore-Skripte, Restore-Runbook | Technisch umgesetzt, Restore-Test regelmaessig protokollieren |
| Belastbarkeit | Container-Haertung, Rate-Limits, non-root Runtime | Technisch umgesetzt |
| Wiederherstellbarkeit | Restore-Skript und Testprotokoll | Technisch umgesetzt, organisatorisch einplanen |
| Ueberpruefung | CI Security Scan, npm Audit, dokumentierte Restfindings | Technisch umgesetzt, regelmaessig wiederholen |

## Betriebsnachweise

Diese Nachweise sollten je Umgebung gepflegt werden:

| Nachweis | Frequenz | Ablage |
| --- | --- | --- |
| Restore-Testprotokoll | mindestens quartalsweise oder vor Go-Live | Betriebsordner / Auditablage |
| `docker compose ps` und `/api/health` nach Release | je Deployment | Release-/Deployment-Protokoll |
| npm Audit und Trivy Scan | je Release, mindestens monatlich | CI-Artefakte / Security-Doku |
| Benutzer-/Rollenreview | quartalsweise | Datenschutz-/ITSM-Ablage |
| Admin- und Superadmin-Kontenreview | quartalsweise | Datenschutz-/ITSM-Ablage |
| Backup-Aufbewahrung und Loeschung | monatlich | Backup-Protokoll |

## Offene organisatorische Punkte

- Verantwortliche Stelle und technische Administratoren benennen.
- Aufbewahrungsfristen fuer Backups, Auditlogs und Uploads festlegen.
- AV-Vertrag / interne Verarbeitungsdokumentation mit Systemzweck und Datenkategorien abgleichen.
- Incident-Prozess inklusive Meldewegen und Fristen dokumentieren.
- Wiederkehrenden Restore-Test terminieren und protokollieren.
- Restliche Major-Dependency-Upgrades nach Risiko und Testabdeckung einplanen.

## Go-Live Checkliste

- `STRICT_SECURITY_MODE=true` oder `NODE_ENV=production` gesetzt.
- `JWT_SECRET`, `DB_PASSWORD`, `SMTP_PASS` als Secrets gepflegt.
- SMTP fuer produktive Invite-/Reset-Mails korrekt konfiguriert oder Passwortreset-Modus bewusst auf Admin-Temp-Passwort gesetzt.
- Backup erfolgreich erstellt und Restore-Test erfolgreich protokolliert.
- Frontend-Hosting zeigt auf internen Container-Port `8080`.
- `npm audit` ohne Critical Findings dokumentiert.
- Aktuelle Container-Images wurden gebaut, gescannt und freigegeben.