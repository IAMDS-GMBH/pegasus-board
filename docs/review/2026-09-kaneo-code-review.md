# Code-Review Kaneo-Codebasis — Belastbarkeit von Umsetzungsweg B

| | |
|---|---|
| **Gegenstand** | Kaneo (usekaneo/kaneo), Fork `IAMDS-GMBH/pegasus-board`, Stand **v2.26.0**, HEAD `9796527b` (2026-09-21), 0 eigene Commits |
| **Bezug** | Technisches Feinkonzept Bewerber-Lead-Plattform Pegasus, v3.10 (Stand 06.09.2026) |
| **Ticket** | Code Review: Architektur, Codequalität, Testabdeckung, Abhängigkeiten, Lizenz, Upstream-Dynamik, Fork-Pflegeaufwand, Gegenprüfung der Risiken |
| **Stand der Erhebung** | 2026-09-23, read-only auf dem Arbeitsstand des Repos; Upstream-Zahlen über die GitHub-API |
| **Autor** | IAMDS |

Hinweis zum Ticket: Dort heißt es „Risiken aus Kapitel 23 gegenprüfen“. Im Konzept v3.10 ist **Kapitel 15** das Risikokapitel; **Kapitel 23** ist Anhang A (Tool-Research) mit der Kaneo-Zeile. Dieser Bericht prüft beide gegen (Abschnitte 7 und 8).

Alle Pfadangaben beziehen sich auf die Repo-Wurzel; `datei:zeile` verweist auf den geprüften Stand.

---

## 0. Ergebnis auf einer Seite

**Empfehlung: Kaneo ist als Fork-Basis tauglich. Umsetzungsweg B wird bestätigt.** Die Codebasis ist modern, streng typisiert, gut getestet, durchgehend MIT-lizenziert und ohne Anbieterbindung. Die Fork-Eingriffe des Konzepts sind technisch möglich und bleiben lokal. Die Bestätigung gilt unter fünf Bedingungen (Abschnitt 9).

**Das Konzept enthält jedoch sechs sachlich falsche oder veraltete Aussagen über Kaneo.** Sie verschieben Aufwand in beide Richtungen und müssen vor der Beauftragung von Stufe 0/1 korrigiert werden:

| Konzeptaussage | Befund | Wirkung |
|---|---|---|
| Kaneo hat keine Custom Fields (Kap. 8, 11/Baustein 3, 20, 23) | **Vorhanden seit v2.24.0 (10.09.2026, PR #1542)**, Datenmodell, API, Feldverwaltung, Kartenansicht, Board-Filter | Baustein 3: 4–6 PT → 1,5–3 PT |
| Kaneo bietet CSV-Import mit Feld-Mapping (Baustein 1, Kap. 10) | **Falsch.** Import/Export nur JSON, kein Mapping; Import ignoriert Labels und Custom Fields (Export enthält Labels) | Massenimport in den Hub: +0,5–1 PT |
| Rollen verhindern Export durch Führungskräfte (Baustein 4) | **Falsch.** Lese- und Export-Endpunkte prüfen nur Workspace-Mitgliedschaft, keine Rollen-Permission | Baustein 4: 1,5–2 PT → 4–6 PT |
| Zwei-Faktor (TOTP) in Kaneo/Better Auth verfügbar (Kap. 14) | **Nicht konfiguriert**, kein twoFactor-Plugin | Fork-Eingriff 1–2 PT oder SSO-Pflicht |
| Rollen aus OIDC-Gruppen-Claim (Baustein 12) | Generischer OIDC-Provider ja, **Gruppen-Mapping nein** | Rollen manuell oder Fork-Eingriff |
| Kaneo-Webhooks reichen als Ereignisquelle (Baustein 2) | Signiert und mit Akteur, aber **ohne Retry** und **ohne Ereignis bei Feldänderung** | Hub braucht Abgleich-Poll: +0,5–1 PT |

**Netto-Aufwand Stufe 1: etwa unverändert** (Umschichtung von Baustein 3 nach Baustein 4 und Hub). Die Upstream-Zahlen des Konzepts (rund 60 % der Commits von drei Personen, hoher Release-Takt) stimmen. Neu bewertet werden muss die **Sicherheitsdynamik**: neun Advisories in sieben Wochen, davon acht am 21./22.09.2026, alle in v2.26.0 behoben, mit Breaking Changes für Betreiber. Die Wartungsvereinbarung muss außerplanmäßige Hotfixes vorsehen.

**Fork-Pflegeaufwand:** 1,5–3 PT je Quartal für den planmäßigen Abgleich, zusätzlich 0,5–1 PT je Security-Hotfix.

---

## 1. Architektur

### 1.1 Aufbau

Kaneo ist ein pnpm/Turbo-Monorepo mit klarer Trennung:

| Paket | Rolle | Umfang |
|---|---|---|
| `apps/api` | Hono-API, Better Auth, Drizzle/PostgreSQL, Events, WebSockets, Plugins, MCP-Server | 367 Dateien, 41.920 Zeilen TypeScript |
| `apps/web` | React 19, Vite, TanStack Router/Query, Tailwind 4 | 658 Dateien (584 ohne Tests), 71.798 Zeilen |
| `packages/permissions` | Rechte-Vokabular und eingebaute Rollen | 224 Zeilen |
| `packages/libs` | Typisierter Hono-RPC-Client | 68 Zeilen |
| `packages/mcp` | Stdio-MCP-Paket (npm) | 3.005 Zeilen |
| `packages/email` | React-Email-Vorlagen, SMTP | 1.241 Zeilen |
| `apps/site`, `apps/docs` | Marketing (Next 16), Doku (Mintlify) | für Pegasus irrelevant |
| `charts/kaneo` | Helm-Chart 2.26.0 | Deployment, HPA, Ingress, Gateway API |

Die Konzeptaussage „kleine Codebasis“ (Kap. 8) ist zu relativieren: rund 115.000 Zeilen Anwendungscode plus 23.000 Zeilen Tests.

### 1.2 API-Muster

- Einstieg `apps/api/src/index.ts` (1.049 Zeilen): Hono-App mit `OpenAPIHono`-Unterapp unter `/api`; öffentliche Routen vor der globalen Auth-Middleware (Health, Instance-Status, Public Project, GitHub/Gitea-Webhooks, Assets mit eigener Prüfung, Auth-Passthrough), danach `authenticateApiRequest` für alles außer MCP/Billing-Webhook (`index.ts:679-706`).
- Routen werden mit `createRoute` + Zod definiert und über `apiRouter()` gemountet (`apps/api/src/openapi.ts:25-39`). Jedes Feature folgt dem Muster `index.ts` (Routen), `controllers/*.ts` (DB-Logik), `schema.ts` (Request), `response.ts` (Response). Die OpenAPI-Datei `apps/docs/openapi.json` ist Artefakt und CI-geprüft.
- Wichtige Eigenheit: Route-Middleware läuft **vor** den Validatoren; Middleware muss den Rohrequest lesen (`openapi.ts:23-24`). Das betrifft jeden Fork-Eingriff, der Rechte prüft.
- Datenbank: 44 Tabellen in `apps/api/src/database/schema.ts` (1.263 Zeilen), 31 Relations in `relations.ts`, 51 SQL-Migrationen in `apps/api/drizzle/` mit Journal. Migrationen laufen beim API-Start (`index.ts:889-924`), zusätzlich TypeScript-Migratoren vor und nach `migrate()` (`utils/migrate-*.ts`, `migrations/column-migration.ts`, zusammen ~1.000 Zeilen, ohne Tests).
- Events: prozessinterner `EventEmitter` (`apps/api/src/events/index.ts:18-48`), Fire-and-forget, keine Persistenz, kein instanzübergreifender Fan-out. Redis dient **nur** dem WebSocket-Broadcast (`ws/index.ts:107-135`, Adapterwahl über `isRedisConfigured()`), nicht dem Event-Bus.
- WebSockets: `/ws/user` und `/ws/:projectId`; Broadcast an ein Projekt debounced 100 ms mit Deduplizierung (`ws/index.ts:207-255`); Nachrichten tragen nur IDs (Cache-Invalidierung). Mitgliedschaft wird beim Verbindungsaufbau geprüft, nicht laufend.
- Plugins/Integrationen: `plugins/registry.ts` mit github, gitea, generic-webhook, discord, slack, mattermost, telegram; MCP doppelt vorhanden (Stdio-Paket und In-API-Server mit OAuth, 36 Tools, beide über die REST-API).

### 1.3 Bewertung

Positiv: konsequente Schichtung, dünne Handler, ein Datenmodell, keine parallelen Request-Layer, typisierter Client aus `AppType`. Für den Hub-Adapter ist die REST-API vollständig (Karten anlegen, verschieben, zuweisen, kommentieren, Labels, Custom Fields).

Kritisch für den Fork: vier Dateien sind Sammelpunkte mit hohem Änderungsdruck (`index.ts` 1.049, `task/index.ts` 1.018, `database/schema.ts` 1.263, `auth-openapi.ts` 1.175 Zeilen). Eigene Eingriffe sollten diese Dateien nur minimal berühren (Abschnitt 6).

Cloud-Anteile im Kern: Billing (Creem), Trials, Seat-Reconciliation sind über `isCloud()` (`utils/is-cloud.ts`, `KANEO_CLOUD === "true"`) abgeschaltet; Turnstile-CAPTCHA hängt an `TURNSTILE_SECRET_KEY` (`utils/verify-turnstile.ts:21-22`) und ist auch im Self-Host nutzbar. Alle liegen im gemeinsamen Code (z. B. `requireEntitlement` in 13 Task-Routen, `task/index.ts:153-539`). Für Self-Hosting neutral, für Merges zusätzliche Konfliktfläche.

---

## 2. Autorisierung und Rechtemodell

Dieser Abschnitt ist die Grundlage für Baustein 4 („nur zugewiesene Karten“) und wird deshalb ausführlich belegt.

### 2.1 Was existiert

- **Zugriff wird ausschließlich auf Workspace-Ebene geprüft.** `validateWorkspaceAccess` lässt Instanz-Admins durch und verlangt sonst eine `workspace_member`-Zeile (`apps/api/src/utils/validate-workspace-access.ts:39-58`). Die Middleware `workspaceAccess.*` ermittelt die Workspace-ID aus Query, Body, Param oder per Lookup der Ressource; für Tasks per Join Task→Projekt (`utils/workspace-access-middleware.ts:156-169`).
- **Keine Projekt-Mitgliedschaft.** `projectTable` (`schema.ts:312-341`) hat keine Member- oder ACL-Beziehung; einziger Projekt-Schalter ist `isPublic` (anonymer Lesezugriff), geschützt durch die neue Permission `project:share` (`project/index.ts:265`).
- **Rollen sind Konfiguration.** Vokabular in `packages/permissions/src/index.ts:9-15`: `project` create/read/update/delete/share, `task` create/read/update/delete/assign, `label` CRUD, `workspace` read/update/delete/manage_settings. Eingebaute Rollen viewer/member/admin/owner (`:19-49`). Statements werden bevorzugt aus der Tabelle `workspace_role` gelesen, Fallback auf die eingebauten Rollen (`utils/require-workspace-permission.ts:53-71, 87-132`). Dynamische Rollen mit Maximum 25 je Workspace (`auth.ts:311-315`); die drei Seeds zählen mit. Damit sind Administrator, Innendienst, Führungskraft, Marketing Manager anlegbar — **das Konzept ist hier richtig.**

### 2.2 Was fehlt

**Lese-Endpunkte prüfen keine Rollen-Permission.** `requireWorkspacePermission` wird bei Schreibrouten konsequent gesetzt; Leserouten haben nur die Mitgliedschafts-Middleware. Einzige Ausnahme sind die Custom-Field-Routen.

| Endpunkt | Datei:Zeile | Prüfung |
|---|---|---|
| `GET /task/tasks/{projectId}` (Liste inkl. Backlog) | `task/index.ts:99` | nur `workspaceAccess.fromProject` |
| `GET /task/{id}` | `task/index.ts:178` | nur `workspaceAccess.fromTask` |
| `GET /task/export/{projectId}` | `task/index.ts:260` | nur Mitgliedschaft — **Export für jede Rolle** |
| `GET /task/{id}/description` | `task/index.ts:563` | nur Mitgliedschaft |
| `GET /activity/{taskId}`, `GET /comment/{taskId}` | `activity/index.ts:32`, `comment/index.ts:34` | nur Mitgliedschaft |
| `GET /label/task/{taskId}`, `GET /label/{id}` | `label/index.ts:38, 100` | nur Mitgliedschaft |
| `GET /search` | `search/index.ts:20` | Mitgliedschaft, Controller filtert nach Workspaces |
| `GET /project`, `GET /project/{id}` | `project/index.ts:41, 85` | nur Mitgliedschaft |
| Custom-Field-Lesen | `custom-field/index.ts:43, 67, 91, 116` | **einzig** mit `project:read` / `task:read` |

Folgen für das Konzept:

1. Die Sicht „nur zugewiesene Karten“ ist, wie in Baustein 4 erkannt, ein echter Fork-Eingriff. Er ist aber **breiter** als „ein gemeinsamer Filter in den Lese-Endpunkten“: Er muss Liste, Einzelkarte, Beschreibung, Export, Suche, Aktivitäten, Kommentare, Labels, Time-Entries, Task-Relations, Custom-Field-Werte, die WebSocket-Broadcasts (Task-IDs gehen an alle Projektverbindungen, `ws/index.ts:207-255`), Benachrichtigungen und die 36 MCP-Tools (rufen die REST-API auf) abdecken. Der Handler liest die Karte nur nach ID (`task/index.ts:682-685`, `getTask(id)`).
2. „Führungskraft: kein Export“ und „Marketing Manager: lesend“ sind **nicht** allein durch Rollenkonfiguration erreichbar: Lesen ist für alle Mitglieder frei, Export ungeschützt. Ein Marketing Manager als `viewer` funktioniert (Schreibrouten prüfen Rechte); der Export-Schutz ist Teil des Fork-Eingriffs.
3. Die Konzeptaussage „Einzelaufruf per Karten-ID prüft nicht auf das Projekt“ ist zu präzisieren: Die Workspace-Zugehörigkeit wird per Join geprüft; es gibt keine Projekt- und keine Rollenprüfung. Die Kernaussage bleibt richtig.

Weitere Befunde:

- Der Lookup fällt bei fehlgeschlagener Ressourcen-Auflösung auf `?workspaceId=` des Aufrufers zurück (`workspace-access-middleware.ts:110-119`); für Tasks harmlos (404), für Legacy-Labels prüfwürdig (`:189-193`).
- API-Keys sind pro Nutzer, nicht pro Workspace (`schema.ts:1012-1051`); akzeptiert werden `x-api-key` und `Authorization: Bearer <key>` (`utils/authenticate-api-request.ts:64-110`; die Doku beschreibt nur die Bearer-Form); ihre optionale Permission-Einschränkung greift nur bei Routen mit Rechteprüfung. Das Rate-Limit des Key-Plugins wird auf `/api/*` nicht durchgesetzt (`utils/authenticate-api-request.ts:64-110`, `utils/verify-api-key.ts:38-70`). Für das Systemkonto „Pegasus-Hub“ genügt ein Key mit vollen Rechten; für Mandantentrennung ist ein Workspace pro Betreiber ohnehin vorgesehen.
- Echte Zeilenfilter gibt es heute nur für Kommentar-Bearbeitung (Autor) und Benachrichtigungen (Empfänger).
- Vorhandene Hebel ohne Fork: Better-Auth-Teams sind aktiv (max. 10 je Workspace, `auth.ts:316-318`), werden aber nirgends zur Rechteprüfung genutzt; `DISABLE_WORKSPACE_CREATION` beschränkt das Anlegen von Workspaces auf Instanz-Admins (`auth.ts:80, 359-362`), passend zum Modell „ein Workspace Pegasus“.
- Anonymer Lesezugriff: `GET /public-project/{id}` liefert Karten öffentlicher Projekte ohne Anmeldung, paginiert (`index.ts:254-293`). Das Projekt „Bewerber-Pool“ darf nie `isPublic` sein; `project:share` entsprechend keiner Rolle geben.

### 2.3 Aufwandsfolge

Baustein 4 im Konzept: 1,5–2 PT. Realistisch mit Tests über alle genannten Oberflächen: **4–6 PT.** Das Einsparpotenzial aus Baustein 3 (Abschnitt 7) deckt diese Differenz.

---

## 3. Qualität

### 3.1 Typisierung, Lint, Konventionen

| Kennzahl | Wert | Beleg |
|---|---|---|
| TypeScript | 7.0.2, `strict` + `noUncheckedIndexedAccess` in API und Packages | `packages/typescript-config/base.json:13,16` |
| Web | `strict`, `noUnusedLocals`, `noUnusedParameters`; ohne `noUncheckedIndexedAccess` | `apps/web/tsconfig.app.json:20-24` |
| Handgeschriebenes `any` | 0 in API, Web, Packages, Tests (48 `as any` nur in generiertem `routeTree.gen.ts`) | grep |
| `@ts-ignore`/`@ts-expect-error` | 0 | grep |
| `biome-ignore` | 1 (API), 13 (Web, davon 8 a11y) | grep |
| TODO/FIXME | 2 | `components/team/members-table.tsx:276`, `invite-team-member-modal.tsx:80` |
| Lint/Format | Biome 2.5.7, `recommended` + 10 Style-Regeln als Fehler; Husky + Commitlint (Conventional Commits) | `biome.json:43-52` |

Bewertung: für ein Open-Source-Projekt dieser Größe ungewöhnlich sauber. Conventional Commits tragen die Release-Automatik (Kap. „Releases“ in `AGENTS.md`).

### 3.2 Tests

| Bereich | Dateien | Testfälle | Zeilen | Art |
|---|---|---|---|---|
| `tests/api` | 73 | 428 | 8.490 | Unit (Vitest, node) |
| `tests/api-integration` | 65 | 384 | 14.281 | PostgreSQL-gestützt, seriell; DB-Name muss auf `_test` enden |
| `tests/storage-integration` | 1 | 5 | 193 | MinIO, **nicht in CI** |
| `apps/web/src/**/*.test.ts(x)` | 74 | 268 | 7.911 | Vitest + jsdom |
| `packages/*` | 22 | 119 | 2.318 | Unit |
| **Summe** | **235** | **~1.200** | **~23.000** | |

- Coverage ist deaktiviert und ohne Schwellen (`apps/api/vitest.config.ts:7-12`); CI misst keine Abdeckung.
- Kein Browser-E2E für die App; Playwright/axe laufen nur im optionalen PR-Screenshot-Bot (`scripts/ui-review-bot/`).
- Gut abgedeckt: task, project, label, comment, custom-field, notification, scheduler, search, ws, plugins github/gitea/generic-webhook, mcp, RBAC (`tests/api-integration/workspace-rbac.test.ts`, 1.116 Zeilen), CORS, Health, OpenAPI.
- Ohne Tests: `workflow-rule`, discord-/telegram-/slack-integration, `workspace` (nur indirekt), `instance`, die Startup-Migratoren (~1.000 Zeilen).

Bewertung: Die für Pegasus relevanten Pfade (Rechte, Tasks, Custom Fields, Webhooks, Scheduler) sind integrationsgetestet. Die fehlende Coverage-Messung ist eine Lücke, kein Ausschlussgrund; für den Fork empfiehlt sich, die eigene Zeilenfilter-Logik mit Integrationstests im Stil von `workspace-rbac.test.ts` abzusichern.

### 3.3 CI und Release

`.github/workflows/ci.yml` (19 Workflows insgesamt): Biome, i18n-Check, OpenAPI-Drift-Check, Typecheck, Unit inkl. Security-Skripten, Build, Integration gegen `postgres:16`, Docker-Smoke-Build; Actions SHA-gepinnt; Nightly-Images; Release manuell per Dispatch mit semantic-release; Helm lint/template über sechs Szenarien; Dependabot wöchentlich (gruppiert) mit Auto-Merge für Patch/Minor.

### 3.4 Migrationen und Datenhaltung

51 SQL-Migrationen, 44 Snapshots: sieben Migrationen sind handgeschrieben (u. a. `0014_private_assets`, `0016_add_task_relation`, `0043_backfill_time_entry_durations`), vier sind Datenreparaturen (`0046_repair_task_number_counters`, `0047_repair_legacy_auth_ownership`). Migrationen laufen automatisch beim Start. Für den Fork bedeutet das: eigene Migrationen müssen sich in Journal und Reihenfolge einfügen; beim Upstream-Abgleich ist die Migrationsreihenfolge der wichtigste Prüfpunkt.

### 3.5 Sicherheit im Self-Hosting

| Befund | Beleg | Bewertung für Pegasus |
|---|---|---|
| Better-Auth-Rate-Limiting (Login, Sign-up, Einladungen) nur bei `isCloud()`; Self-Host ohne Limiter. Ausnahmen: MCP-OAuth-Endpunkte haben feste Limits (429), Turnstile-CAPTCHA per `TURNSTILE_SECRET_KEY` aktivierbar | `auth.ts:545-557`, `mcp/oauth-store.ts:8-10`, `utils/verify-turnstile.ts:21-22` | Login-Endpunkt per Ingress/WAF begrenzen, CAPTCHA einschalten oder Limiter im Fork aktivieren (klein) |
| Kein CSP, kein HSTS; nginx setzt nur nosniff, X-Frame-Options, Referrer-Policy | `apps/web/nginx.kaneo.conf:5-8` | im Ingress ergänzen (Baustein 13) |
| `/api/health` statisch, ohne DB-Check | `index.ts:223-225` | Readiness erkennt DB-Ausfall nicht; Monitoring auf DB ergänzen |
| Keine zentrale Env-Validierung; 139 `process.env`-Zugriffe, 71 Keys, 5 undokumentiert | grep, `apps/docs/.../environment-variables.mdx` | Startfehler bei Fehlkonfiguration; Betriebshandbuch muss Env-Liste pflegen |
| Uploads nur S3-kompatibel, presigned, 10 MB Default für alle Dateitypen; **keine MIME-Allowlist** (die Bildliste steuert nur Inline-Anzeige vs. Anhang-Karte), Nicht-Bilder werden mit `Content-Disposition: attachment` ausgeliefert | `storage/s3.ts:20-33, 274-286`, `task/index.ts:957-959`, `index.ts:152` | passt zu MinIO; Größenlimit über `S3_MAX_IMAGE_UPLOAD_BYTES`; Virenscan/Typfilter ggf. am Ingress oder Bucket |
| Kein Body-Limit im API-Prozess (nur Avatar, MCP-OAuth); das gebündelte Image begrenzt über nginx auf 25 MB | `user/index.ts:24`, `mcp/request-bounds.ts:8`, `apps/web/nginx.kaneo.conf:9` | bei getrenntem API-Deployment Ingress-Limit setzen |
| SSRF-Schutz: Webhook-Ziele in privaten Netzen (localhost, RFC1918) werden beim Speichern und Senden abgelehnt; Freischaltung nur global über `KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS` | `utils/assert-public-destination.ts:83-84`, `plugins/generic-webhook/config.ts:7`, `apps/docs/core/installation/environment-variables.mdx:130` | **Relevant für den Hub:** Kaneo → Hub braucht einen öffentlich auflösbaren Hostnamen mit TLS oder die globale Freischaltung (öffnet SSRF wieder). Im Konzept unter Baustein 2 und 13 aufnehmen |
| Generic-Webhook: HMAC-SHA256 ohne Timestamp, Secret im Klartext in `integration.config` | `plugins/generic-webhook/client.ts:22-26`, `schema.ts:872-898` | Hub muss Replay über Ereignis-ID abfangen; Secret-Rotation dokumentieren |
| Gitea-Signatur-Fallback nicht constant-time | `plugins/gitea/utils/verify-signature.ts:27` | irrelevant (Gitea ungenutzt), Beispiel für Upstream-Qualitätsstreuung |
| `AUTH_SECRET` ≥ 32 Zeichen Pflicht, Prozess beendet sich sonst | `auth.ts:103-110`, `utils/auth-secret.ts` | gut, Helm validiert dasselbe |
| WebSocket: Origin-Prüfung, 64-Byte-Cap | `ws/security.ts`, `index.ts:176` | gut |

Neun Security-Advisories seit August 2026 (Abschnitt 5) zeigen, dass diese Klasse von Lücken im Upstream aktiv gefunden und geschlossen wird. Für Pegasus ist wichtig, dass v2.26.0 die Basis ist und die Sicherheitsprüfung vor Go-Live (Kap. 14) die Self-Host-Defaults oben mit einschließt.

### 3.6 Web-App

TanStack Router (49 Routen, Code-Splitting), TanStack Query (49 Query-, 89 Mutation-Hooks), Zustand, shadcn-Stil auf `@base-ui/react` (43 Komponenten; nur 2 auf Radix, ~20 Radix-Pakete ungenutzt in `package.json`), Tailwind 4 CSS-first. PWA-Manifest vorhanden (`public/site.webmanifest`), **kein Service Worker**. 409 responsive Utility-Klassen, `use-mobile.ts`. i18n mit 21 Sprachen; **de-DE vollständig** (2.077/2.077 Keys).

---

## 4. Abhängigkeiten und Lizenz

### 4.1 Lizenzlage

- Root `LICENSE`: MIT, Copyright 2024 Andrej Acevski. `packages/*` mit `license: "MIT"`. Root, api, web, site, email ohne `license`-Feld (alle `private`). Kein GPL/AGPL-Code, keine `ee/`- oder Enterprise-Ordner, keine Lizenzschlüssel, kein Phone-Home (`instance/controllers/get-instance-status.ts` liest nur die eigene DB).
- Kosmetisch: `apps/docs/LICENSE` ist das Mintlify-Template (Copyright Mintlify), `packages/planka-import/LICENSE` nennt „Kaneo MCP contributors“. Beide Pakete sind für Pegasus irrelevant.
- **Klärungsbedarf:** `creem` 1.6.0 (Cloud-Billing-SDK) hat weder `license`-Feld noch LICENSE-Datei und wird statisch importiert (`apps/api/src/billing/creem-client.ts:1`), also auch in Self-Host-Builds installiert. Empfehlung: im Fork als Build-Ausschluss prüfen oder Lizenz beim Anbieter erfragen; funktional ist Billing ohne `KANEO_CLOUD` inaktiv.
- Stichprobe von ~25 Kernpaketen: MIT bzw. Apache-2.0 (drizzle-orm), MPL-2.0-oder-Apache (dompurify), BSD-3 (highlight.js), MIT-0 (nodemailer). Transitive Abhängigkeiten wurden nicht vollständig geprüft (z. B. lightningcss unter Tailwind 4, MPL-2.0). Für den Betrieb bei Pegasus ohne Weitergabe des Codes ist keine der genannten Lizenzen problematisch.

### 4.2 Kernabhängigkeiten (Stand `pnpm-lock.yaml`)

| Bereich | Paket | Version |
|---|---|---|
| API | hono / @hono/zod-openapi / @hono/node-server | ^4.13.0 / ^1.6.1 / ^2.1.0 |
| API | drizzle-orm / drizzle-kit / pg | ^0.45.2 / ^0.31.10 / ^8.22.0 |
| API | better-auth (+ api-key, drizzle-adapter) | ^1.6.26 (Override pinnt **1.6.25**) |
| API | zod / valibot | ^4.4.3 / ^1.4.2 |
| API | ioredis, @aws-sdk/client-s3, @modelcontextprotocol/sdk, croner, @sentry/node | ^6.0.0, ^3.1104, ^1.30, ^10, ^10.70 |
| Web | react / react-dom | ^19.2.8 |
| Web | @tanstack/react-router / react-query | ^1.170 / ^5.101 |
| Web | tailwindcss / vite / vitest | ^4.3.3 / ^8.2.0 / ^4.1.10 |
| Web | @tiptap/* (~18), @base-ui/react, @radix-ui/* (~18, größtenteils ungenutzt) | ^3.29 / ^1.7 |
| Laufzeit | Node **≥ 24.0.0** (Docker/CI: 24.19.0), pnpm 10.32.1 | `package.json:37-39`, `Dockerfile.kaneo:1` |

Hinweise:

- `AGENTS.md:70` nennt noch „Node.js 20.19 oder neuer“; das Repo verlangt Node 24. Zielumgebung und Betriebshandbuch bei Pegasus entsprechend.
- Die better-auth-Inkonsistenz (Manifest ^1.6.26 vs. Override 1.6.25) ist ein Upstream-Wartungsartefakt; ~30 Security-Overrides in `pnpm-workspace.yaml` zeigen aktive Pflege, sind aber beim Merge regelmäßig Konfliktquelle.
- Dependabot wöchentlich gruppiert, kein Renovate.

### 4.3 Anbieterbindung und Telemetrie

- Speicher: S3-API generisch (`S3_ENDPOINT`, `forcePathStyle`), MinIO geeignet (`storage/s3.ts:127-161`). E-Mail: SMTP via nodemailer. DB: PostgreSQL 16. Redis optional (Standalone/Sentinel/Cluster, In-Memory-Fallback, `redis/index.ts:10-121`).
- Sentry opt-in per DSN (`apps/api/src/instrument.ts:28-47`, `apps/web/src/instrument.ts:6-40`; Web mit Session Replay, wenn aktiviert). Plausible nur auf `demo.kaneo.app`/`cloud.kaneo.app` (`apps/web/index.html:36-51`). Kein PostHog/GA.
- Hardcodierte Fallbacks auf kaneo.app: OpenAPI-Server-URL (`index.ts:550`), Trial-Mails (`scheduler/trial-reminders.ts:50`), Gast-E-Mail-Domain (`auth.ts`, abschaltbar mit `DISABLE_GUEST_ACCESS`). Für Pegasus: `KANEO_API_URL`/`KANEO_CLIENT_URL` setzen, Gastzugang abschalten.

Fazit: Die Konzeptaussage „keine proprietäre Abhängigkeit, MIT, Code-Eigentum bei Pegasus“ (Kap. 4) hält, mit der Fußnote `creem`.

---

## 5. Upstream-Risiko

### 5.1 Kennzahlen (git, Stand HEAD 2026-09-21; GitHub-API 2026-09-23)

| Kennzahl | Wert |
|---|---|
| Commits gesamt / Autoren | 2.997 / 126 (erster Commit 2024-12-30) |
| Commits letzte 12 Monate | 2.245 |
| Commits letzte 3 Monate (seit 2026-06-23) | **865** inkl. Merges, 654 ohne Merges, **550** menschlich ohne Bots |
| Top-3-Autoren, 3 Monate | Andrej 166, justin 99, Tin 62 = 327/550 = **59 %** |
| Commits je Monat 2026 | 06: 76, 07: 116, 08: **409**, 09: 76 (bis 21.09.) |
| Releases | 112 Versionen im CHANGELOG; 24 Release-Commits im August, 6 im September (v2.23.1 06.09., v2.23.2 07.09., v2.24.0 11.09., v2.25.0 17.09., v2.26.0 21.09.) |
| GitHub | 9.163 ★, 807 Forks, 61 offene Issues, 36 offene PRs, `main` = v2.26.0 + 2 Commits |
| Security Advisories | **9 GHSA**: 1 Critical (AUTH_SECRET-Default → Cookie-Fälschung), 6 High (Autorisierung/Workspace-Isolation, Cross-Tenant-IDOR GitHub, Bulk-Task ohne Rollenprüfung, zwei SSRF-Bypässe, Gitea-Secrets), 2 Medium; 8 davon veröffentlicht 21./22.09.2026, alle in v2.26.0 behoben |

Die Konzeptzahlen „über 700 Commits in drei Monaten, drei Personen rund 60 %“ (Kap. 8, 15) sind **bestätigt**; „über 700“ gilt bei Zählung inklusive Merges und Bot-Commits (865), menschliche Commits sind 550. Anhang-A-Zeile: 9,0k ★ → 9.163; „v2.22 21.08.“ → inzwischen v2.26.0; „~100 Contributor“ → 126 Autoren.

### 5.2 Bewertung

- **Bus-Faktor ist real.** Ein Autor trägt 30 % der Commits; drei Personen 59 %. Das Risiko „Weiterentwicklung nicht garantiert“ aus Kap. 15 bleibt bestehen.
- **Hoher, volatiler Takt.** 409 Commits im August gegen 76 im Juni; ein Release pro Woche im September. Wer `main` folgt, folgt einer Baustelle; wer Tags folgt, bekommt geschlossene Pakete mit Changelog.
- **Breaking Changes sind konkret, nicht hypothetisch.** v2.26.0 (Security-Release) ändert Betriebsannahmen: `AUTH_SECRET` ≥ 32 Zeichen Pflicht, `TRUSTED_PROXIES` nur Loopback, neue Permission `project:share`, `SMTP_IGNORE_TLS` entfernt, Helm braucht `kaneo.env.clientUrl` und `existingSecret`, API und Web gemeinsam upgraden (paginierte Task-Listen), WebSocket-Clients brauchen `Origin`, Compose öffnet Postgres nicht mehr, Migration löscht verwaiste API-Keys. Jede dieser Änderungen hätte eine laufende Pegasus-Installation getroffen.
- **Security-Reaktion ist koordiniert.** Acht Advisories an zwei Tagen mit einem Sammel-Release, Changelog und Upgrade-Hinweisen sprechen für einen funktionierenden Prozess. Zugleich zeigt die Dichte (neun in sieben Wochen), dass die Autorisierungsschicht erst jetzt systematisch gehärtet wird. Weitere Funde sind wahrscheinlich; die Wartungsvereinbarung muss **außerplanmäßige Hotfixes** vorsehen.
- **Cloud-Fokus des Upstreams.** Billing, Trials, Seat-Reconciliation, Turnstile und der Peekareq-Review-Bot (Changelog September) sind Upstream-Aufwand ohne Nutzen für Pegasus, erzeugen aber Merge-Fläche in `task/index.ts`, `project/index.ts`, `auth.ts`, `scheduler/`.

Gegenmaßnahmen des Konzepts (eigenständiger Fork, selektiver Nachzug, austauschbares Board, Rückfall PocketBase) sind angemessen. Ergänzungen in Abschnitt 8.

---

## 6. Fork-Pflegeaufwand

### 6.1 Churn der letzten drei Monate

| Bereich | Dateiänderungen |
|---|---|
| `apps/web` | 885 |
| `apps/api` | 777 |
| `tests/` | 199 |
| `apps/docs` | 94 |
| `.github/workflows` | 91 |
| `charts/kaneo` | 74 |
| `database/schema.ts` | 17 Änderungen, 19 neue Migrationen |
| `i18n/*.json` | 30–37 je Sprache |

Heißeste Einzeldateien: `package.json` (61), `CHANGELOG.md` (48), `Chart.yaml` (44), `pnpm-lock.yaml` (41), `i18n/en-US.json` (37).

### 6.2 Konfliktfläche der geplanten Fork-Eingriffe

| Eingriff (Konzept) | Berührte Upstream-Hotspots | Konfliktrisiko |
|---|---|---|
| Zeilenfilter „nur zugewiesene Karten“ + Export-Schutz | `task/index.ts`, `activity/index.ts`, `comment/index.ts`, `label/index.ts`, `search/`, `ws/index.ts`, `packages/permissions` | **mittel bis hoch**, wenn als Edits in den Routen; **niedrig**, wenn als eigene Middleware + ein Permission-String, in jeder Route eine Zeile |
| Custom Fields ergänzen (`url`-Typ, Inline-Anzeige ausgewählter Felder auf der Karte, Ereignis bei Feldänderung, serverseitiger Filter) | `custom-field/*`, `task-card.tsx`, `plugins/generic-webhook/config.ts` | **niedrig bis mittel**, Modul ist neu (September) und wird upstream weiter bewegt |
| Theme „WWK“ (Tokens, Logo, Titel) | `apps/web/src/index.css`, `index.html`, `public/` | **niedrig** |
| Optional: 2FA (Better Auth twoFactor), Gruppen-Claim-Mapping | `auth.ts` (727 Zeilen, 4 Advisories im September) | **mittel** |

### 6.3 Schätzung quartalsweiser Abgleich

Annahmen: Upstream liefert 150–250 menschliche Commits je Quartal in ruhigen Phasen, bis 400 in Schüben; Nachzug erfolgt **per Release-Tag**, nicht per `main`; die Fork-Eingriffe liegen in eigenen Modulen und berühren Hotspots nur punktuell.

| Tätigkeit je Abgleich | PT |
|---|---|
| Merge des Tags, Konflikte in Routen/Schema/i18n/Lockfile auflösen | 0,5–1 |
| Migrationsreihenfolge und -journal prüfen, Startup-Migratoren testen, Dump-Restore auf Test | 0,25–0,5 |
| Breaking-Env-/Helm-/Permission-Änderungen ins Betriebshandbuch, Chart-Werte nachziehen | 0,25–0,5 |
| Integrationstests (Upstream + eigene Zeilenfilter-Tests), Smoke-Test Hub-Adapter (Webhook-Payload, API-Client) | 0,25–0,5 |
| Review, Freigabe auf Test, Produktivsetzung | 0,25–0,5 |
| **Summe planmäßig** | **1,5–3 PT je Quartal** |
| Außerplanmäßiger Security-Hotfix (Cherry-Pick oder Patch-Tag) | 0,5–1 PT je Fall |

Die Konzeptannahme „Upstream quartalsweise geprüft und selektiv übernommen, Sicherheitsfixes sofort“ (Baustein 13) ist damit mit Zahlen unterlegt. Empfehlung für die Wartungsvereinbarung: Kontingent 1 PT/Monat als Basis plus Hotfix-Klausel.

### 6.4 Regeln, die den Aufwand niedrig halten

1. Eigene Änderungen als **eigenständige Module** (neue Ordner, neue Tabellen, neue Permission), nicht als Edits in `task/index.ts` oder `schema.ts`-Blöcken des Upstreams.
2. Cloud-only-Code **nicht entfernen**, sondern über `KANEO_CLOUD` unbenutzt lassen; Entfernen erzeugt bei jedem Merge Konflikte.
3. Upstream-Tags nachziehen; `main` nur zur Vorschau.
4. Eigene Integrationstests im Stil von `tests/api-integration/workspace-rbac.test.ts` für jede eigene Regel, damit Upstream-Änderungen an der Rechteprüfung sofort auffallen.
5. `apps/docs/openapi.json` nach jedem Merge mit `pnpm openapi:check:fix` regenerieren; die CI des Forks behält den Drift-Check.

---

## 7. Gegenprüfung der Konzeptaussagen zu Kaneo

| # | Aussage im Konzept (Stelle) | Befund | Beleg | Wirkung |
|---|---|---|---|---|
| 1 | Kaneo hat keine Custom Fields; sie werden im Fork komplett gebaut (Kap. 8, Baustein 3, Kap. 20, Anhang A) | **Veraltet.** Custom Fields seit v2.24.0 (PR #1542, gemergt 10.09.2026): Definitionen je Projekt mit Typen text, number, date, dropdown, boolean; required, defaultValue, options, position; Werte je Task; Feldverwaltung, Anzeige in der Kartenansicht, Filterwerte-Endpoint, Filter im Board; Validierung beim Anlegen | `apps/api/src/custom-field/*` (8 Controller), `schema.ts:1203-1263`, `drizzle/0045_*.sql`, `custom-field/schema.ts:18`, `task/validate-task-fields.ts`, `apps/web/src/components/project/custom-field-editor.tsx`, `board-toolbar.tsx`, `use-task-filters.ts` | Baustein 3 schrumpft auf Ergänzungen: `url`-Typ; Inline-Anzeige einzelner Werte (Kampagne, Ort, Paket) auf der Kanban-Karte, heute zeigt sie nur ein Zähler-Badge mit Hover-Liste (`task-card.tsx:130-146, 296-330`); Ereignis/Webhook bei Feldänderung (heute keins); serverseitiger Filter nach Custom Fields (Standardfilter status, priority, assigneeId, dueBefore/dueAfter sind serverseitig, `get-tasks.ts:103-115`, Custom Fields nur clientseitig; Konzept Kap. 4 fordert serverseitige Filterung). **4–6 PT → 1,5–3 PT** |
| 2 | CSV-Import mit Feld-Mapping vorhanden (Baustein 1, Kap. 10 „CSV-Import (Kaneo)“) | **Falsch.** Import und Export sind JSON, kein CSV, kein Feld-Mapping. Import-Felder title, description, status, priority, startDate, dueDate, userId; Labels und Custom Fields werden beim Import ignoriert, Array unbegrenzt. Der Export enthält Labels (Name, Farbe), aber keine Custom-Field-Werte; ein Roundtrip verliert Labels. Vorbild für einen API-basierten Massenimport mit Labels, Zuweisung und Kommentaren ist `packages/planka-import` | `task/schema.ts:87-99`, `task/controllers/import-tasks.ts`, `task/controllers/export-tasks.ts:45-89`, `apps/web/src/components/project/tasks-import-export.tsx:121,161`, `apps/docs/core/migrations/from-planka.mdx` | Massenimport (Initialbefüllung, Kap. 17) in den Hub als CSV-Endpunkt über die Board-Schnittstelle: **+0,5–1 PT** |
| 3 | Kommentare, **Anhänge**, Aktivitätsprotokoll je Karte (Kap. 4, Baustein 2) | **Richtig.** Beliebige Dateien per Drag-and-drop oder Einfügen in Beschreibung und Kommentar; Bilder inline, andere Typen (PDF, CSV, ZIP …) als Anhang-Karte; Asset-`kind` image/attachment; Download mit `Content-Disposition: attachment`; kein Typfilter, Größenlimit 10 MB. **Kein eigener Anhänge-Bereich** an der Karte, Anhänge hängen am Text | `task/index.ts:957-959`, `storage/s3.ts:274-286`, `index.ts:152`, `apps/web/src/components/task/extensions/attachment-card.tsx`, `apps/docs/core/installation/object-storage-and-image-uploads.mdx:38-39` | Kein Mehraufwand. Für das Löschkonzept beachten: Anhänge werden über den Asset-Cleanup entfernt (`storage/cleanup-assets.ts`), der Hub muss beim Anonymisieren die Karte inkl. Text leeren |
| 4 | Zwei-Faktor (TOTP) über Kaneo/Better Auth verpflichtend (Kap. 14) | **Nicht vorhanden.** Kein twoFactor-Plugin; `verify-otp` ist E-Mail-OTP-Login | `auth.ts:256-536` (Plugin-Liste), grep `twoFactor`/`totp` | Better Auth bringt das Plugin mit, Aktivierung inkl. UI ~1–2 PT, oder SSO als Pflicht. Dokumentiertes SSO-only-Rezept: `DISABLE_LOGIN_FORM` + `DISABLE_REGISTRATION` + `CUSTOM_OAUTH_AUTO_LOGIN`; Achtung: OIDC-Konten verknüpfen sich nur mit lokalen Konten mit verifizierter E-Mail (`error=account_not_linked`), relevant für Pilotnutzer aus Stufe 0 |
| 5 | Rollen-Zuweisung aus OIDC-Gruppen-Claim (Baustein 12) | **Teilweise.** Generischer OIDC-Provider mit Discovery, PKCE, Auto-Login und Logout-URL vorhanden; die Profilabbildung übernimmt nur Name und E-Mail; **kein Gruppen-zu-Rolle-Mapping**, kein automatischer Workspace-Beitritt (neue SSO-Nutzer brauchen eine Einladung; die Rolle kommt aus der Einladung). Die Kaneo-Doku zu Custom OAuth nennt weder Gruppen noch Rollen | `auth.ts:499-517, 558-586`, `utils/custom-oauth-profile.ts`, `apps/docs/core/social-providers/custom-oauth.mdx` | Rollen und Mitgliedschaft manuell über Einladungen pflegen (bei ~100 Nutzern und PLZ-Liste als Quelle vertretbar) oder Fork-Eingriff ~1–1,5 PT: Gruppen-Claim im `after`-Hook lesen, Workspace-Beitritt und Rolle setzen |
| 6 | Rollen konfigurierbar, „Führungskraft: kein Export“, „Marketing Manager: lesend“ als reine Konfiguration (Baustein 4) | **Teilweise falsch.** Rollen ja; Lese- und Export-Endpunkte prüfen keine Permission | Abschnitt 2, `task/index.ts:260` | Export-Schutz und Lesefilter sind Teil des Fork-Eingriffs. **Baustein 4: 1,5–2 PT → 4–6 PT** |
| 7 | „Kaneo prüft den Einzelaufruf per Karten-ID nicht auf das Projekt“ (Baustein 4) | **Präzisieren.** Workspace-Zugehörigkeit per Join geprüft; keine Projekt-/Rollenprüfung | `workspace-access-middleware.ts:156-169` | Kernaussage bleibt |
| 8 | Fälligkeits-Erinnerungen: Scheduler mit Leader-Lock, vorab und überfällig, in-App und E-Mail, Doppelversand-Schutz (Baustein 6) | **Im Ergebnis richtig, Mechanik anders.** Lease existiert, wird nur von seat-reconciliation genutzt; Reminder laufen auf jeder Instanz und deduplizieren über `task_reminder_sent`; Zustellung über `createNotification` → `deliverNotification` (E-Mail/ntfy/Gotify/Webhook nach Präferenz); Vorlaufzeit je Nutzer. Zusätzlich sendet ein zweiter Job `task.due_date_reminder` an den Projekt-Webhook mit eigener Vorlaufzeit, also direkt an den Hub | `scheduler/leader-lock.ts`, `seat-reconciliation.ts:40`, `due-date-reminders.ts:109-135`, `scheduler/project-webhook-reminders.ts:44`, `notification/controllers/create-notification.ts:71-75` | Konzeptannahme „Kaneo erinnert von selbst“ hält; Formulierung anpassen. Der Projekt-Webhook-Reminder kann die Stufe-2-Eskalation („zwei Werktage ohne Reaktion“) ohne eigenen Hub-Cron auslösen |
| 9 | Webhooks nach außen mit Signatur; Ereignisse Karte erstellt/verschoben/Assignee/Kommentar; Akteur im Payload (Baustein 2, 4) | **Richtig mit Lücken.** `X-Kaneo-Signature` HMAC-SHA256; 12 Events: taskCreated, taskMoved, taskStatusChanged, taskPriorityChanged, taskTitleChanged, taskDescriptionChanged, taskAssigneeChanged, taskUnassigned, taskCommentCreated, taskDueDateChanged, taskDeleted, dueDateReminder; Payload mit `actor`; **ein** Webhook je Projekt; **kein Retry/Backoff**, ein Versuch, dann Health-Zähler; **kein Ereignis bei Custom-Field-Änderung**; kein Timestamp in der Signatur (die Kaneo-Doku bestätigt das ausdrücklich). Hinweis: Die Doku-Seite „Outgoing webhooks“ listet nur 6 Ereignisse, Code und Einstellungs-UI haben 12, darunter Moved, Assignee, Unassigned, Due Date, Deleted, Reminder | `plugins/generic-webhook/client.ts:22-26`, `config.ts:10-23`, `events.ts:151-201, 216-238`, `schema.ts:897`, `utils/outbound-request.ts`, `apps/docs/core/integrations/outgoing-webhooks.mdx:26-34, 109`, `apps/web/src/components/project/generic-webhook-integration-settings.tsx` | Hub braucht neben Idempotenz einen **Abgleich-Poll** gegen die Kaneo-API (verlorene Webhooks, Feldänderungen): **+0,5–1 PT**; Fork ergänzt Feld-Ereignis (in Baustein 3 enthalten) |
| 10 | Kaneo-Oberfläche auf Deutsch (Kap. 4) | **Richtig.** de-DE vollständig | `i18n/de-DE.json` 2.077/2.077 Keys | — |
| 11 | Theme „WWK“ als Token-Set ohne Layout-Änderung (Kap. 20) | **Machbar.** Tailwind-4-Tokens in `:root`/`.dark`; aber kein White-Label: Titel, Favicon, App-Name hardcodiert, `/config` ohne Branding | `apps/web/src/index.css:49-194`, `apps/web/index.html:6,26-30`, `config/response.ts:5-19` | 1 PT hält; Logo/Titel als kleine Edits |
| 12 | PWA, Push-Benachrichtigungen in Stufe 2, 2–3 PT (Kap. 4, 20) | **Knapp.** Manifest ja, kein Service Worker, kein Web-Push-Backend | `apps/web/public/site.webmanifest`, grep serviceWorker | 2–3 PT nur für Basis-Push; Abo-Verwaltung und iOS-Eigenheiten eher 3–5 PT |
| 13 | Kleine Codebasis, modernster Stack (Kap. 8) | **Stack ja, klein nein.** ~115k Zeilen App-Code | Abschnitt 1 | Einarbeitung des Pegasus-Entwicklers (Kap. 22) einplanen |
| 14 | Helm im Repo, Kubernetes-Betrieb (Baustein 13) | **Richtig, mit Lücke.** Chart 2.26.0 mit Validierungen und Probes; **keine Redis-Werte** trotz `maxReplicas: 10`; `podSecurityContext` leer | `charts/kaneo/values.yaml:14,70,143-154`, `templates/validations.yaml` | Pilot mit einer Replica; ab zwei Replicas Redis über `extraEnv` |
| 15 | Node.js 20.19 (AGENTS.md, Kap. „Safety and tooling“) | **Veraltet.** Repo verlangt Node ≥ 24 | `package.json:37-39`, `Dockerfile.kaneo:1` | Zielumgebung Pegasus |
| 16 | Anhang A, Kaneo-Zeile: Custom Fields nein, 9,0k ★, v2.22 21.08., Kernteam 3, ~100 Contributor | Custom Fields **ja**; 9.163 ★; v2.26.0 21.09.; Kernteam 3 bestätigt; 126 Autoren | Abschnitt 5 | Zeile aktualisieren |

Bestätigt ohne Einschränkung: Workspace-Rollen frei konfigurierbar (bis 25), Datei-Anhänge beliebigen Typs in Beschreibung und Kommentar, OIDC vorhanden, REST-API mit OpenAPI, signierte Webhooks, Helm-Chart, Redis optional, Deutsch, S3-kompatibler Speicher, SMTP, MIT, keine Telemetrie im Self-Host.

### 7.1 Aufwandsdelta gegen Kapitel 20 (Stufe 1)

| Position | Konzept | Neu | Begründung |
|---|---|---|---|
| Fork: Custom Fields vollständig | 4–6 | 1,5–3 | Modul vorhanden; nur url-Typ, Inline-Anzeige auf der Karte (heute Zähler-Badge mit Hover), Feld-Ereignis, serverseitiger Filter, Tests |
| Fork: Zeilenfilter Führungskraft mit Rückgabe | 1,5–2 | 4–6 | Lese-/Export-/Such-/WS-/MCP-Oberflächen ohne Rechteprüfung (Abschnitt 2) |
| Fork: Theme | 1 | 1 | unverändert |
| Hub: Massenimport CSV (statt Kaneo-CSV) | 0 | 0,5–1 | kein CSV in Kaneo |
| Hub: Abgleich-Poll Kaneo-Ereignisse | 0 | 0,5–1 | Webhooks ohne Retry, ohne Feld-Ereignis |
| Sicherheitsgrundlagen (2FA) | 1 (Konfiguration) | 1–2 | twoFactor-Plugin aktivieren und UI, oder SSO-Pflicht ohne Mehraufwand |
| **Summe Stufe 1 (Entwicklung)** | **34–46** | **~35–48** | Netto etwa gleich; Verschiebung von Board-Feldern zu Rechten und Hub |

Stufe 2: Push-Benachrichtigungen 2–3 → 3–5 PT. Stufe 0 bleibt bei 4–6 PT, sollte aber den Prototyp auf den **Zeilenfilter** statt auf Custom Fields konzentrieren.

---

## 8. Gegenprüfung Risiken (Kapitel 15) und Anhang A (Kapitel 23)

| Risiko (Kap. 15) | Befund | Anpassung |
|---|---|---|
| Kaneo als Open-Source-Basis: kleines Kernteam, hoher Release-Takt | **Bestätigt** mit Zahlen: 59 % Top-3, 24 Release-Commits im August, v2.26.0 mit Breaking Changes | Gegenmaßnahmen bleiben; ergänzen: Nachzug per Tag, Hotfix-Klausel in der Wartung (Abschnitt 6.3) |
| Fork-Eingriffe passen nicht zur Kaneo-Architektur | **Entschärft.** Custom Fields sind da; Zeilenfilter ist als Middleware + Permission sauber umsetzbar (Vorbild `requireWorkspacePermission`); Rückfall PocketBase bleibt | Stufe 0 prüft Zeilenfilter, nicht Custom Fields |
| Externe Schnittstellen verzögern sich | unverändert | — |
| **Neu: Sicherheitsdynamik des Upstreams** | 9 Advisories in 7 Wochen, alle behoben; weitere wahrscheinlich | Wartungsvereinbarung mit Hotfix-Klausel; Sicherheitsprüfung vor Go-Live schließt Self-Host-Defaults ein (Rate-Limit, CSP/HSTS, Body-Limit) |
| **Neu: Cloud-Code im Kern** | Billing/Trials/Turnstile via `KANEO_CLOUD` inaktiv, aber Merge-Fläche | nicht entfernen, nur abschalten; `creem`-Lizenz klären |
| **Neu: Self-Host-Defaults** | Login-Rate-Limiting aus, kein CSP/HSTS, Health ohne DB, kein Body-Limit im API-Prozess, SSRF-Schutz blockiert interne Webhook-Ziele | Ingress-Härtung in Baustein 13 (0,5 PT) |
| **Neu: Skalierung** | Redis nötig ab zwei Replicas, Helm ohne Redis-Werte | Pilot Single-Replica; Stufe 3 Redis |
| Lead-Volumen höher als angenommen | Serverseitige Filterung nach Custom Fields fehlt heute (clientseitig) | im Fork-Eingriff Baustein 3 vorsehen, sonst Board bei mehreren tausend Karten langsam |

Anhang A (Kap. 23), Zeile Kaneo: „Custom Fields: nein“ → **ja (seit v2.24.0)**; „Zuweisungssicht: nein“ bestätigt; „keine Projekt-Ebene“ bestätigt (nur `isPublic`); Sterne 9.163; Version v2.26.0 vom 21.09.2026; 126 Autoren. Die Einordnung „Fork-Basis MIT“ bleibt richtig.

---

## 9. Empfehlung zur Fork-Tauglichkeit

**Kaneo ist als Fork-Basis für die Bewerber-Lead-Plattform geeignet. Umsetzungsweg B wird bestätigt.**

Begründung in einem Satz: Die Codebasis ist typsicher, integrationsgetestet, MIT-lizenziert, ohne Anbieterbindung und liefert Custom Fields, Rollen, OIDC, signierte Webhooks, Erinnerungen und Helm bereits mit; der einzige echte Kern-Eingriff (Zeilenfilter) ist als Middleware plus Permission lokal umsetzbar, und der Upstream reagiert auf Sicherheitsmeldungen koordiniert.

Bedingungen:

1. **Stufe 0 fokussiert den Zeilenfilter** (Baustein 4) als Prototyp über Liste, Einzelkarte, Export, Suche, WebSocket und MCP, mit Integrationstest; Custom Fields werden nur auf Lücken geprüft.
2. **Konzept v3.11** korrigiert die 16 Punkte aus Abschnitt 7, insbesondere Custom Fields, CSV-Import, 2FA, Gruppen-Claim, Export-Schutz; Kapitel 20 übernimmt das Aufwandsdelta aus 7.1.
3. **Upstream-Nachzug per Release-Tag** quartalsweise (1,5–3 PT) mit **Hotfix-Klausel** (0,5–1 PT je Fall) in der Wartungsvereinbarung; eigene Änderungen als eigenständige Module.
4. **Betriebshärtung** im Pilot: Node 24, `KANEO_CLOUD` aus, Gastzugang aus, Rate-Limit und CSP/HSTS am Ingress, Single-Replica, Sicherheitsprüfung vor Produktivsetzung schließt die Self-Host-Defaults ein.
5. **Rückfalloption PocketBase** bleibt formal bestehen, wird aber nach Stufe 0 voraussichtlich nicht gebraucht.

Zur Rückfrage „Alternativen oder auf den Upstream warten?“ siehe die separate Bewertung [2026-09-alternativen-und-upstream.md](2026-09-alternativen-und-upstream.md): Der Upstream hat keinen Zeilenfilter in Arbeit, #1764 (Projekt-Zugriff je Mitglied) ist als Plan B zu beobachten, und keine Alternative schließt die Lücke ohne Fork oder Lizenzkosten.

---

## 10. Anhang

### 10.1 Methodik

Read-only-Prüfung des Arbeitsstands (Branch `th_PEGA-2`, identisch mit `origin/main`, HEAD `9796527b`); keine Codeänderung, kein Fetch des Upstream-Remotes. Codestellen wurden durch Lesen der Dateien verifiziert. Upstream-Kennzahlen über die öffentliche GitHub-API (Repository, Releases, Security Advisories, Compare `v2.26.0...main`, Issue-/PR-Suche) am 2026-09-23. Zwei nicht committete Änderungen im Arbeitsverzeichnis (`packages/email/package.json`: devDependency `@react-email/ui`; `pnpm-lock.yaml`) sind nicht Gegenstand dieses Berichts.

### 10.2 Reproduzierbare Kennzahlen

```bash
git rev-list --count HEAD                                   # 2997
git shortlog -sn --no-merges HEAD | wc -l                   # 126 Autoren
git rev-list --count --since=2026-06-23 HEAD                # 865
git rev-list --count --no-merges --since=2026-06-23 HEAD    # 654
git shortlog -sn --no-merges --since=2026-06-23 HEAD        # Top-3: 166 / 99 / 62 (Namen zusammengefasst)
git log --since=2026-06-23 --no-merges --name-only --format='' | awk -F/ '{print $1"/"$2}' | sort | uniq -c | sort -rn
grep -cE '^#+ \[?v?[0-9]' CHANGELOG.md                      # 112 Versionen
find tests/api -name '*.test.ts' | wc -l                    # 73
find tests/api-integration -name '*.test.ts' | wc -l        # 65
find apps/web/src -name '*.test.ts' -o -name '*.test.tsx' | wc -l   # 74
ls apps/api/drizzle/*.sql | wc -l                           # 51
ls apps/api/drizzle/meta/*snapshot* | wc -l                 # 44
find apps/api/src -name '*.ts' | xargs cat | wc -l          # 41920
grep -c '":' i18n/de-DE.json i18n/en-US.json                # 2077 / 2077
```

### 10.3 Abgleich mit der Kaneo-Dokumentation

Alle Aussagen wurden gegen `apps/docs` (Quelle von kaneo.app/docs, Stand v2.26.0) und die Live-Navigation geprüft. Wo Doku und Code abweichen, gilt der Code; die Doku ist an diesen Stellen veraltet: Custom Fields („kein Kaneo-Äquivalent“, `core/migrations/from-planka.mdx:107`), Webhook-Ereignisse (6 statt 12, `core/integrations/outgoing-webhooks.mdx:26-33`), MCP-Tools (34 statt 36, `core/integrations/mcp.mdx:128-135`), weitergeleitete Benachrichtigungstypen (`core/functional/account-notifications.mdx:103-111`), zufälliger `AUTH_SECRET`-Fallback (`core/installation/migration.mdx:150`, seit v2.26.0 Pflicht), Node 20 für die Planka-CLI (`from-planka.mdx:21`). Die Doku bestätigt ausdrücklich: Redis nur für mehrere Instanzen nötig (`environment-variables.mdx:186`), keine Zeitangabe in der Webhook-Signatur (`outgoing-webhooks.mdx:109`), beliebige Dateitypen als Anhang (`object-storage-and-image-uploads.mdx:38-39`), API-Key als `Authorization: Bearer` (`api-reference/authentication.mdx:70-74`). Eine Doku-Seite zu Rollen, Custom Fields, Helm oder 2FA existiert nicht.

### 10.4 Begriffe

Begriffe (Workspace, Projekt, Karte, Rolle, Hub, Board-Schnittstelle, Baustein, Stufe) folgen dem Glossar des Feinkonzepts (Kap. 24). „Zeilenfilter“ bezeichnet die serverseitige Einschränkung aller Lesezugriffe auf Karten mit `assignee = aktueller Nutzer` für eine Rolle.
