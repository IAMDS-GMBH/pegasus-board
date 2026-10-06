# Zeilenfilter „nur zugewiesene Karten“ — Prototyp, Umgehungsanalyse, Restaufwand

| | |
|---|---|
| **Story** | Als Führungskraft möchte ich im Board ausschließlich die mir zugewiesenen Bewerber sehen (Stufe 0, Baustein 4) |
| **Bezug** | Feinkonzept v3.10, Kap. 11 Baustein 4 und Kap. 14 (TOM „Führungskräfte sehen nur zugewiesene Leads“); [Code-Review](2026-09-kaneo-code-review.md) Abschnitt 2 und 7.1; [Alternativen](2026-09-alternativen-und-upstream.md) Abschnitt 1 (L1) |
| **Stand** | 2026-10-01, Fork `IAMDS-GMBH/pegasus-board`, Branch `th_PEGA-6` auf Basis v2.26.0 |
| **Autor** | IAMDS |

Hinweis zur Story: Sie verweist auf „Kapitel 22“. In v3.10 ist Kapitel 22 die Projektdurchführung; die fachliche Vorgabe „Zugriff nur auf zugewiesene Datensätze“ steht in Kapitel 11 (Baustein 4) und Kapitel 14 (technische und organisatorische Maßnahmen). Gespiegelt wird gegen diese beiden Stellen (Abschnitt 5).

Pfadangaben beziehen sich auf die Repo-Wurzel.

---

## 0. Ergebnis auf einer Seite

| Abnahmekriterium | Befund |
|---|---|
| Testnutzer mit Rolle Führungskraft sieht in Board, Suche und API nur zugewiesene Karten | **Erfüllt auf API-Ebene**, nachgewiesen durch 14 Integrationstests (`tests/api-integration/task-view-assigned-only.test.ts`): Board-Liste, Einzelkarte, Kommentare, Aktivitäten, Zeiteinträge, Labels, Beschreibungsseiten, Bulk, Export und Suche liefern ausschließlich eigene Karten; fremde und unzugewiesene Karten antworten 404. Die Web-App hat keine eigene Sichtbarkeitslogik und rendert, was die API liefert; eine Browser-Sitzung wurde in dieser Stufe nicht aufgezeichnet. |
| Umgehungsmöglichkeiten dokumentiert und bewertet | **Erfüllt**, Abschnitt 4: 40 Routen über den gemeinsamen Lookup und 7 Listen-Endpunkte sind gedeckt; 13 Flächen bleiben offen und sind mit Risiko und Stufe-1-Maßnahme bewertet. |
| Restaufwand Stufe 1 inkl. Rückgabe und Ablage geschätzt | **Erfüllt**, Abschnitt 6: 4,25–5,75 PT im Fork, 0,75–1 PT im Hub (korrigiert am 2026-10-06, siehe Abschnitt 6). |

**Kernaussage:** Der Zeilenfilter lässt sich als eigenständiges Modul plus eine Permission in Kaneo einbauen, ohne Built-in-Rollen oder Seeds anzufassen; nötig ist nur eine additive Spalte `workspace_role.assigned_only` (Migration 0055, Default `false`). Der Diff umfasst eine neue Datei mit der gesamten Fachlogik und punktuelle Einzeiler in neun Upstream-Dateien (271 Zeilen hinzu, 24 geändert, inkl. Tests und 21 Locale-Dateien). Die Rückfalloption PocketBase (Konzept Kap. 8) wird nicht gebraucht.

---

## 1. Rolle „Führungskraft“ anlegen (Konfiguration)

Die Rolle ist reine Konfiguration im Workspace, kein Code. Der Rolleneditor zeigt den Schalter „Nur zugewiesene“ unter „Aufgaben“ neben den Task-Rechten (aus `roleRestrictions` im Rechte-Paket).

**Klickpfad:** Einstellungen → Workspace → Rollen → „Neue Rolle“ → Name `Führungskraft` → Schalter setzen → Speichern. Danach Mitglieder → Rolle der Führungskraft auf `Führungskraft` setzen.

**Rechteumfang für den Pilot:**

| Ressource | Aktionen | Begründung |
|---|---|---|
| Aufgaben (`task`) | `read`, `update`, **`view_assigned_only`** („Nur zugewiesene“) | Karte lesen, kommentieren, Felder pflegen, Spalte wechseln. **Kein** `create`, `delete`, `assign`: Anlegen und Zuordnen macht der Hub; ohne `assign` kann die Führungskraft eine Karte nicht an eine Kollegin weitergeben und sie damit aus der eigenen Sicht verlieren. |
| Projekte (`project`) | `read` | Board öffnen. **Kein** `share` (sonst öffentlicher Lesezugriff und Kalender-Feed möglich, Abschnitt 4). |
| Labels (`label`) | `read` | Kampagnen-Label sehen. Prüfergebnis-Labels setzt der Hub. |
| Workspace (`workspace`) | `read` | Pflicht für die Navigation. |
| Better-Auth-Defaults (`organization`, `member`, `invitation`, `team`, `ac`) | keine | Keine Verwaltungsrechte. |

Technisch entsteht eine Zeile in `workspace_role` mit `permission = {"task":["read","update"],"project":["read"],"label":["read"],"workspace":["read"]}` und `assigned_only = true`. Die Restriktion steht bewusst **nicht** im `permission`-JSON: better-auth erlaubt beim Anlegen und Ändern einer Rolle nur Rechte, die der Anlegende selbst hält, und eine Restriktion kann niemand halten, ohne selbst eingeschränkt zu sein. Als zusätzliches Rollenfeld (`additionalFields.assignedOnly` bei `create-role`, `data.assignedOnly` bei `update-role`) braucht sie nur `ac:create` bzw. `ac:update`, also Owner oder Admin. `tests/api-integration/workspace-role-assigned-only.test.ts` prüft den Weg über den Editor für Owner und Admin, dass die Führungskraft die Restriktion nicht selbst aufheben kann, und das gefilterte Board danach.

Die Semantik ist bewusst eine **Restriktion**: Die Aktion nimmt Sicht weg statt zu gewähren. Das ist im Editor-Label und in der Beschreibung („Sieht nur Aufgaben, die der Person zugewiesen sind“) ausgedrückt. Vorteil gegenüber einer positiven Permission `task:read_all`: Built-in-Rollen (`viewer`, `member`, `admin`, `owner`), die Seeds und bestehende Workspaces bleiben unverändert, keine Datenmigration bestehender Rollen, kleinere Konfliktfläche beim Upstream-Abgleich.

**Marketing Manager** (Konzept Kap. 6): als `viewer` konfigurierbar; Export bleibt für alle Mitglieder ungeschützt (Abschnitt 4, Zeile „Export-Schutz“).

---

## 2. Umsetzung im Fork

### 2.1 Bausteine

| Datei | Änderung |
|---|---|
| `packages/permissions/src/index.ts` | Export `roleRestrictions` (`task:view_assigned_only` → Feld `assignedOnly`), bewusst außerhalb von `statement`, damit better-auth die Restriktion nicht als vergebbares Recht prüft. Built-in-Rollen unverändert. |
| `apps/api/src/database/schema.ts`, `apps/api/drizzle/0055_workspace_role_assigned_only.sql`, `apps/api/src/auth.ts`, `apps/api/src/auth-openapi.ts` | Spalte `assigned_only boolean not null default false`, als better-auth-Zusatzfeld der Rolle registriert; OpenAPI beschreibt das Feld. |
| `apps/api/src/utils/assigned-only-scope.ts` (**neu**) | Gesamte Fachlogik: `resolveAssignedOnlyUserId(c)` ermittelt aus `workspace_member` ⋈ `workspace_role.assigned_only` einmal je Request, ob der Nutzer im Workspace eingeschränkt ist (memoisiert im Hono-Context); `listAssignedOnlyWorkspaceIds(c)` für workspace-übergreifende Lesezugriffe (Suche); `assertTasksVisible()` wirft 404, sobald eine berührte Karte nicht dem Nutzer zugewiesen ist (unzugewiesen = verdeckt). |
| `apps/api/src/utils/workspace-access-middleware.ts` | Der gemeinsame Lookup liefert zur Workspace-ID den Assignee der Karte mit (Task, Zeiteintrag, Aktivität, Kommentar, Label mit Karte, Bulk-IDs). Nach der Mitgliedschaftsprüfung wird die Restriktion geprüft und **geworfen**, nicht `null` zurückgegeben, damit der `?workspaceId=`-Fallback der Middleware nicht als Umweg dient. |
| `apps/api/src/task/controllers/get-tasks.ts` | Option `restrictToUserId`, serverseitig gesetzt, getrennt vom Client-Filter `assigneeId`. Count und Seite nutzen dieselbe WHERE-Klausel, Pagination stimmt nach dem Filtern. |
| `apps/api/src/task/controllers/export-tasks.ts`, `apps/api/src/task/description-pages.ts` | Gleiche Bedingung in Export, Beschreibungsseite und Beschreibungs-Suche. |
| `apps/api/src/task/index.ts` | Vier Einzeiler in den Handlern (Liste, Export, Beschreibung, Beschreibungs-Treffer). Keine Routen-Definition geändert, OpenAPI unverändert. |
| `apps/api/src/search/index.ts`, `apps/api/src/search/controllers/global-search.ts` | Bedingung „Workspace nicht eingeschränkt ODER Assignee = Nutzer“ in den drei Karten-Queries (Short-ID, Titel/Beschreibung, Aktivitäten/Kommentare). |
| `apps/api/src/utils/require-workspace-permission.ts` | Zwei bestehende Helfer exportiert, sonst unverändert. |
| `apps/web/.../settings/workspace/roles.tsx`, `apps/web/src/hooks/.../use-*-workspace-role(s).ts`, `apps/web/src/lib/auth-client.ts`, `i18n/*.json`, `i18n/schema.json` | Schalter unter „Aufgaben“, gespeichert als Rollenfeld `assignedOnly`; Label und Beschreibung (en-US, de-DE; übrige 19 Locales mit englischem Platzhalter aus `pnpm i18n:check:fix`). |

### 2.2 Verhalten

- **Reihenfolge je Request:** Ressource auflösen → Workspace-Mitgliedschaft prüfen (Nicht-Mitglied: 403 wie bisher) → Rolle laden → Restriktion prüfen → 404 „Task not found“ bzw. „No tasks found“ (Bulk).
- **404 statt 403:** Eine verdeckte Karte ist für die Führungskraft nicht unterscheidbar von einer nicht existierenden. Die Detailseite der Web-App zeigt bei 403 und 404 ohnehin dieselbe „Task not found“-Ansicht.
- **Unzugewiesene Karten** (Pool) sind für die Führungskraft unsichtbar. Das ist fachlich gewollt: Pool-Karten gehören dem Innendienst.
- **Instanz-Admins** sind nie eingeschränkt (sie umgehen auch die Mitgliedschaft), gleiche Semantik wie `hasWorkspacePermission`.
- **API-Keys:** Die Restriktion kommt aus der Mitgliedsrolle des Key-Inhabers. Key-Scopes können sie weder aufheben noch erzeugen. Das Systemkonto „Pegasus-Hub“ braucht eine unbeschränkte Rolle (Administrator) und ist damit nicht betroffen.
- **MCP** ruft die REST-API über HTTP auf und erbt den Filter ohne eigene Änderung. Die **Web-App** rendert die gefilterten Antworten; Board, Backlog, Kalender, Gantt, Suche und Karten-Auswahllisten zeigen nur eigene Karten.
- **Kosten:** eine zusätzliche indizierte Abfrage je Request, der eine Karte berührt (zwei bei API-Key-Requests, weil die Instanz-Admin-Prüfung den Nutzer nachlädt). Nicht-Karten-Routen (Projekte, Spalten, Workspace) bleiben ohne Mehrkosten. Ein Zusammenlegen mit `validateWorkspaceAccess` würde eine Abfrage sparen, berührt aber eine Upstream-Datei mit eigenem Test und wurde für den Prototyp bewusst nicht gemacht.

### 2.3 Tests

- `tests/api/utils/assigned-only-scope.test.ts` (Unit, 4 Fälle): Erkennung der Aktion, 404-Semantik für Einzel- und Bulk-Zugriff.
- `tests/api-integration/task-view-assigned-only.test.ts` (PostgreSQL, 14 Fälle): Board-Liste mit Pagination, Client-Filter kann nicht erweitern, Regression für `member` und Custom-Rolle ohne Aktion, Einzelkarte 200/404, `?workspaceId=`-Fallback, 400 für nicht existierende ID bleibt, Aktivitäten/Kommentare (lesend und schreibend)/Zeiteinträge/Labels/Beschreibung einer fremden Karte, Bulk gemischt (404, nichts geändert), Export, Suche (Treffer, Short-ID, Kommentare, zweiter unbeschränkter Workspace), Beschreibungs-Treffer, Instanz-Admin, API-Key.
- Der bestehende Upstream-Unit-Test `tests/api/utils/workspace-access-middleware.test.ts` läuft unverändert.

Gelaufen (2026-10-01): `pnpm --filter @kaneo/permissions build && test` (11 bestanden), API-Unit-Suite (103 Dateien, 752 Tests bestanden), Integrations-Suite (94 Dateien, 742 Tests bestanden), Web-Tests Rolleneditor und Permission-Hook (4 bestanden), `pnpm typecheck`, `pnpm exec vp check` auf allen geänderten Dateien, `pnpm i18n:check`, `pnpm i18n:schema`, `pnpm openapi:check` (keine Drift).

---

## 3. Was der Zeilenfilter abdeckt

**Gemeinsamer Lookup (40 Routen):** alle Routen mit `workspaceAccess.fromTask/fromTaskId/fromTasks/fromActivity/fromComment/fromTimeEntry/fromLabel` in `task` (15), `label` (6), `activity` (5), `comment` (4), `time-entry` (4), `external-link` (3), `custom-field` (2, Werte je Karte), `task-relation` (1, Liste je Karte). Dazu gehören Einzelkarte, Beschreibung, alle Karten-Mutationen (Status, Priorität, Titel, Beschreibung, Fälligkeit, Assignee, Verschieben, Duplizieren, Löschen, Bild-Upload), Bulk, Kommentare und Aktivitäten lesen/anlegen/ändern/löschen, Zeiteinträge, externe Links, Labels je Karte, Custom-Field-Werte je Karte, Relationen je Karte.

**Listen-Endpunkte mit eigener Bedingung (7):** Board-Liste `GET /api/task/tasks/{projectId}`, Export `GET /api/task/export/{projectId}`, Beschreibungsseite `GET /api/task/{id}/description`, Beschreibungs-Treffer `GET /api/task/description-matches/{projectId}`, Suche `GET /api/search` (drei Karten-Queries).

---

## 4. Umgehungsmöglichkeiten

Status: **gedeckt** = im Prototyp geschlossen und getestet · **offen** = in Stufe 1 zu schließen · **akzeptiert** = bewusst offen, kein Datenabfluss. Risiko bezieht sich auf Bewerberdaten (Konzept Kap. 14).

| # | Fläche | Endpunkt / Datei | Status | Risiko | Maßnahme Stufe 1 | PT |
|---|---|---|---|---|---|---|
| 1 | Board-Liste, Backlog, Kalender, Gantt | `GET /api/task/tasks/{projectId}` | gedeckt | — | — | — |
| 2 | Einzelkarte per ID, inkl. `?workspaceId=`-Fallback | `GET /api/task/{id}` | gedeckt | — | — | — |
| 3 | Kommentare, Aktivitäten, Zeiteinträge, externe Links, Labels je Karte, Custom-Field-Werte je Karte, Relationen je Karte, alle Karten-Mutationen, Bulk | 40 Routen über den Lookup | gedeckt | — | — | — |
| 4 | Export | `GET /api/task/export/{projectId}` | gedeckt (Zeilenfilter) | — | siehe #17 (Export-Schutz je Rolle) | — |
| 5 | Suche: Karten, Short-ID, Kommentare, Aktivitäten | `GET /api/search` | gedeckt | — | — | — |
| 6 | Beschreibungsseiten und Beschreibungs-Suche | `GET /api/task/{id}/description`, `/description-matches/{projectId}` | gedeckt | — | — | — |
| 7 | MCP-Tools | `apps/api/src/mcp/tools.ts` (HTTP auf REST-API) | gedeckt (erbt) | — | Smoke-Test mit API-Key einer Führungskraft | 0,25 |
| 8 | **Labels je Workspace** liefern alle Label-Zeilen inkl. `taskId` fremder Karten; Label-Anlage und -Zuweisung nehmen `taskId` aus dem Body ohne Lookup | `GET /api/label/workspace/{workspaceId}`, `POST /api/label`, `PUT /api/label/{id}/task`; `label/controllers/get-labels-by-workspace-id.ts`, `assign-label-to-task.ts` | offen | mittel (Label-Name und Karten-ID, keine Bewerberdaten; Schreiben auf fremde Karte möglich) | Lesen: `taskId IS NULL OR assignee = me`; Schreiben: Assignee der Ziel-Karte prüfen | 0,5 |
| 9 | **Task-Relationen**: Gegenseite liefert Titel, Status, Nummer, Assignee der verknüpften Karte; Anlegen/Löschen nutzt eigene Middleware `scopeToSourceTask`/`scopeToRelation`, prüft nur die Quellkarte | `GET/POST /api/task-relation`, `DELETE /api/task-relation/{id}`; `task-relation/index.ts:49-92`, `controllers/get-task-relations.ts` | offen | mittel (Titel fremder Karten; Pilot nutzt keine Relationen) | Gegenseite filtern, Ziel-Karte in beiden Middlewares prüfen | 0,5 |
| 10 | **Custom-Field-Werte und Filterwerte je Projekt** über alle Karten (Kampagne, Ort, Telefon …) | `GET /api/custom-field/project/{projectId}/values`, `/filter-values`; `custom-field/controllers/get-custom-field-values-by-project.ts`, `get-custom-field-filter-values.ts` | **offen** | **hoch** (Feldwerte fremder Bewerber, z. B. Telefonnummer; die Board-Ansicht lädt die Werte je Projekt) | Join auf `task` und `assignee = me` in beiden Controllern | 0,5 |
| 11 | **Projektstatistik** (Anzahl Karten, Fertigstellungsgrad, früheste Fälligkeit) | `GET /api/project`; `project/controllers/get-projects.ts` | offen | niedrig (Zähler, keine Inhalte) | WHERE auf Assignee für eingeschränkte Nutzer | 0,25 |
| 12 | **Benachrichtigungen**: @Erwähnung in Kommentar oder Beschreibung benachrichtigt jedes Mitglied mit Kartentitel; Zugriffsprädikat prüft nur Mitgliedschaft | `notification/resource-access.ts`, `activity/controllers/create-comment.ts:66-81`, `task/controllers/update-task-description.ts` | offen | mittel (Kartentitel = Bewerbername in Mail/In-App) | Prädikat `notificationResourceAccess` um Assignee-Klausel für eingeschränkte Rollen erweitern (ein Choke-Point für Anlegen, Lesen, Zustellen) | 0,5–1 |
| 13 | **WebSocket**: Projekt-Broadcasts senden Karten-IDs aller Bewegungen an jede Projektverbindung | `ws/index.ts:220-259, 396-546` | akzeptiert für Stufe 1 | niedrig (nur IDs und Ereignistyp; Nachladen scheitert mit 404) | optional: Assignee ins Ereignis, Filter je Verbindung (`ProjectConnection.userId` liegt vor) | 0,5–1 (optional) |
| 14 | **Asset-Download** per Asset-ID prüft nur Workspace | `GET /api/asset/{id}`; `utils/authorize-asset-access.ts` | offen | mittel (Anhänge und Bilder fremder Karten, Asset-ID muss bekannt sein) | `assetTable.taskId` gegen Assignee prüfen | 0,25 |
| 15 | **Kalender-Feed**: Token-URL streamt alle datierten Karten des Projekts; Anlegen braucht `project:share` | `GET /api/calendar-feed/{token}/calendar.ics`; `calendar-feed/service.ts` | akzeptiert durch Konfiguration | hoch, wenn `project:share` vergeben | Rolle Führungskraft erhält kein `project:share` (Abschnitt 1); zusätzlich Feed-Erstellung für eingeschränkte Rollen sperren | 0,25 |
| 16 | **Öffentliches Projekt** liefert Karten ohne Anmeldung | `GET /api/public-project/{id}` | akzeptiert durch Konfiguration | hoch, wenn `isPublic` | „Bewerber-Pool“ nie öffentlich; `project:share` keiner Pilot-Rolle geben; optional Umgebungsschalter im Fork | 0,25 (optional) |
| 17 | **Export-Schutz je Rolle** fehlt: jedes Mitglied darf exportieren (Konzept Baustein 4: Führungskraft „kein Export“, Marketing Manager „exportieren“) | `GET /api/task/export/{projectId}` | offen | niedrig für Führungskraft (Export ist gefiltert), relevant für Rollenmodell | Permission `task:export` oder Rollenprüfung am Endpunkt; Export-Schalter in den Projekteinstellungen daran binden | 0,5 |
| 18 | **Subtask-Zähler** zählt verdeckte Unteraufgaben mit | `task/get-subtask-counts.ts` | akzeptiert | niedrig (Zahl) | optional WHERE | 0,25 (optional) |
| 19 | **Restsignal 400 vs. 404**: nicht existierende ID ohne `?workspaceId=` → 400 „Workspace ID could not be determined“, verdeckte Karte → 404 | `workspace-access-middleware.ts` | akzeptiert | niedrig (Existenz einer ID erratbar, keine Inhalte) | optional vereinheitlichen auf 404 | 0,25 (optional) |
| 20 | **Bulk gemischt mit nicht existenter ID** gelingt, gemischt mit verdeckter Karte → 404 | `workspace-access-middleware.ts` `lookupMany` | akzeptiert | niedrig | — | — |
| 21 | **Detail-Sheet im Board** ohne Fehlerzustand bei 404 (Direktaufruf `?taskId=` fremder Karte zeigt leeres Sheet) | `apps/web/src/components/task/task-details-sheet.tsx` | offen (UX) | kein Datenabfluss | „Nicht gefunden“-Zustand wie auf der Detailseite | 0,25 |
| 22 | **Import** legt Karten an | `POST /api/task/import/{projectId}` | akzeptiert durch Konfiguration | — | Rolle hat kein `task:create` | — |

**Summe offene Pflichtmaßnahmen (#8, #9, #10, #11, #12, #14, #15, #17, #21, #7):** 3,75–4,25 PT inkl. Tests (korrigiert am 2026-10-06, vorher 3,25–3,75); davon mit hoher Dringlichkeit vor dem Pilot: #10 (Custom-Field-Werte), #12 (Benachrichtigungen), #14 (Assets).

---

## 5. Abgleich mit dem Konzept

| Vorgabe | Stelle | Befund |
|---|---|---|
| „Führungskraft sieht nur die ihr zugewiesenen Leads“ | Kap. 6, Kap. 14 TOM | Serverseitig umgesetzt für Karten und alle karten-gebundenen Daten; Listen über Feldwerte, Labels je Workspace, Relationen, Benachrichtigungen und Assets folgen in Stufe 1 (Abschnitt 4). |
| „Kartenlisten, Einzelkarte, Backlog, Suche sowie Kommentare, Aktivitäten und Anhänge serverseitig auf `assignee = aktueller Nutzer`“ | Baustein 4, Fork | Kartenlisten, Einzelkarte, Backlog, Suche, Kommentare, Aktivitäten: gedeckt. Anhänge: offen (#14). |
| „Permission `task:view-assigned-only` im Rechte-Paket mit Tests und einem gemeinsamen Filter in den Lese-Endpunkten“ | Baustein 4 | Umgesetzt als `task:view_assigned_only` (Kaneo-Schreibweise), gespeichert als Rollenfeld `assigned_only` statt im Permission-JSON (Abschnitt 1). Der „gemeinsame Filter“ ist der Lookup der Access-Middleware; die Listen-Endpunkte brauchen zusätzlich je eine WHERE-Bedingung, wie im Code-Review (Abschnitt 2.2) vorhergesagt. |
| „Rolle selbst ist Konfiguration“ | Baustein 4, Kap. 20 | Bestätigt (Abschnitt 1). |
| „Führungskraft: kein Export“, „Marketing Manager: lesend, exportieren“ | Baustein 4 | Nicht allein durch Konfiguration erreichbar (Code-Review Punkt 6); Export-Schutz je Rolle als Stufe-1-Maßnahme (#17). |
| „Webhook-Ereignisse tragen den Akteur, damit der Hub Rollenverstöße erkennen kann“ | Baustein 4 | Unverändert vorhanden; der Zeilenfilter verhindert den Verstoß bereits serverseitig. |
| „Rollenprüfung serverseitig, nicht nur in der Oberfläche“ | Kap. 14 Sicherheit | Erfüllt; die Web-App enthält keine Sichtbarkeitslogik und braucht keine. |
| Rückgabe und Ablage „jederzeit“, Karte danach „für die Führungskraft unsichtbar“ | Baustein 4 | Mit dem Filter automatisch: sobald der Hub den Assignee entfernt, verschwindet die Karte aus Liste, Suche und Detailansicht. |

---

## 6. Restaufwand Stufe 1 (Baustein 4 einschließlich Rückgabe und Ablage)

Grundlage: Code-Review 7.1 schätzt Baustein 4 insgesamt mit 4–6 PT. Im Prototyp sind rund 1,5 PT erbracht (Modul, Middleware, sieben Listen-Endpunkte, 18 Tests, dieses Dokument).

| Position | Inhalt | PT |
|---|---|---|
| Offene Flächen schließen | #8 Labels je Workspace 0,5 · #9 Relationen 0,5 · #10 Custom-Field-Werte 0,5 · #11 Projektstatistik 0,25 · #12 Benachrichtigungen 0,5–1 · #14 Assets 0,25 · #15 Kalender-Feed sperren 0,25 · #7 MCP-Smoke 0,25 | 3–3,5 |
| Export-Schutz je Rolle (#17) | Permission oder Rollenprüfung am Export-Endpunkt, UI-Schalter binden, Test | 0,5 |
| Detail-Sheet „nicht gefunden“ (#21) | Fehlerzustand im Board-Sheet | 0,25 |
| **Rückgabe** | Spalten „Rückgabe an Pegasus“ und Custom Field „Rückgabegrund“ (Auswahl + Freitext) sind Konfiguration. Hub (Webhook `taskMoved` → Assignee entfernen, Label „Rückläufer“, Karte in „Pegasus-Pool“ ziehen, Innendienst erwähnen) liegt im Hub. Im Fork nur, wenn das Pflichtfeld beim Spaltenwechsel **erzwungen** werden soll: Prüfung „Feld X gesetzt, bevor Karte in Spalte Y“ in `update-task`/`move` plus Hinweis in der UI | Fork 0,5–1 (nur bei Pflichtfeld-Erzwingung) · Hub 0,5 |
| **Ablage** | Spalte „Ablage“ + Custom Field „Absagegrund“: Konfiguration. Hub markiert erledigt, Löschkonzept greift (Kap. 14). Karte bleibt der Führungskraft sichtbar, solange sie zugewiesen ist; ob der Hub den Assignee bei Ablage entfernt, ist fachlich zu entscheiden (Konzept: „Karte erledigt, für Statistik erhalten“) | Hub 0,25–0,5 |
| Tests und Doku nachziehen | Integrationstests für jede geschlossene Fläche, Betriebshandbuch (Rolle, Rechteumfang) | 0,5 |
| **Summe Fork** | alle Positionen offen | **4,25–5,75 PT** |
| **Summe Hub** (nicht Teil von Baustein 4, zur Einordnung) | Rückgabe- und Ablage-Logik | 0,75–1 PT |

> **Korrektur vom 2026-10-06:** Die Tabelle enthält nur offene Positionen. Die ursprüngliche Angabe „davon ~1,5 erbracht → Rest 2,75–4,25 PT“ zog den Prototyp ab, der in keiner Zeile steht, und zählte ihn damit doppelt. #10 ist inzwischen mit PEGA-5 geschlossen; für Stufe 1 bleiben 3,75–5,25 PT im Fork ([Empfehlung zum Stufen-Review 0](2026-10-empfehlung-stufe-0.md), Abschnitte 2 und 4).

Optional, nicht im Rest enthalten: WebSocket-Filter je Verbindung (#13, 0,5–1), 400/404 vereinheitlichen (#19, 0,25), Subtask-Zähler (#18, 0,25), Umgebungsschalter gegen öffentliche Projekte (#16, 0,25).

Mit dem Prototyp (rund 1,5 PT in Stufe 0) ergibt sich für Baustein 4 insgesamt 5,75–7,25 PT. Das liegt über der Spanne des Code-Reviews (4–6 PT) und deutlich über den 1,5–2 PT des Konzepts (Kap. 20); der Wegfall des Custom-Field-Baus deckt die Differenz nur teilweise ([Empfehlung zum Stufen-Review 0](2026-10-empfehlung-stufe-0.md), Abschnitt 2).

---

## 7. Empfehlung

1. Prototyp als Basis für Stufe 1 übernehmen; die Fachlogik bleibt in `apps/api/src/utils/assigned-only-scope.ts`, Upstream-Dateien werden nur mit Einzeilern berührt (Fork-Regel 6.4 des Code-Reviews).
2. Vor dem Pilot mit echten Daten #10, #12 und #14 schließen; #8, #9, #11, #15, #17 im selben Sprint.
3. Rollenkonfiguration aus Abschnitt 1 ins Betriebshandbuch übernehmen; `project:share` keiner Pilot-Rolle geben; Projekt „Bewerber-Pool“ nie öffentlich.
4. Die Permission ist upstream-fähig geschnitten (Statement + Modul + Middleware-Hook); ein PR an usekaneo/kaneo kann nach Stufe 1 angeboten werden (Alternativen-Bewertung, Abschnitt 2.2 Punkt 3).
