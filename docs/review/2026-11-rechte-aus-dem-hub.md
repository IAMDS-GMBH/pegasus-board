# Rechte je Nutzer aus dem Hub — Board-Teil, Umsetzung und Nachweis

| | |
|---|---|
| **Story** | PEGA-142: Der Pegasus-Hub ist Rechteinhaber. Er überträgt je Nutzer die effektiven Rechte zusammen mit dem Sichtbereich; das Board speichert sie und setzt sie für **jedes** Mitglied durch, ohne Schalter je Rolle. Hier: der **Board-Teil** |
| **Bezug** | SPEC Rollen & Rechte §5, §6, §12; Hub-Teil: `pegasus-hub` Branch `th_PEGA-142`, `docs/BOARD.md` „Sichtbereich und Rechte“, `docs/review/2026-11-rollen-rechte.md`; Vorgänger [Sichtbereich nach Einheiten (PEGA-141)](2026-11-sichtbereich-einheiten.md); [Register der Fork-Eingriffe](../fork-eingriffe.md#pega-142--rechte-je-nutzer-aus-dem-hub) |
| **Stand** | 2026-11-05, Fork `IAMDS-GMBH/pegasus-board`, Branch `th_PEGA-142` auf Basis `th_PEGA-141` @ `814785b4` |
| **Autor** | IAMDS |

Pfadangaben beziehen sich auf die Repo-Wurzel.

---

## 0. Ergebnis auf einer Seite

| Abnahmekriterium | Befund im Board |
|---|---|
| Der Hub überträgt je Nutzer `permissions`; das Board speichert sie je Workspace, auch unbekannte Schlüssel, und gibt sie bei `GET …/users` zurück | **Erfüllt.** Pflichtfeld im PUT, dedupliziert und sortiert gespeichert (`pegasus_user_scope.permissions`), unbekannte Schlüssel bleiben erhalten. |
| Durchsetzung für jedes Mitglied, ohne Schalter je Rolle, nicht abschaltbar durch einen Board-Admin | **Erfüllt.** Ab dem ersten Push gilt der Stand für alle Mitglieder außer Owner, Instanz-Admins und dem Systemkonto. Auch die Rolle `admin` oder eine vom Board-Admin neu angelegte Vollrechte-Rolle hebt nichts auf (Test). |
| Fehlt ein Recht: 403 `MISSING_PERMISSION` mit dem Schlüssel; Lesen weiter 404 außerhalb des Sichtbereichs | **Erfüllt** für alle Zeilen der Tabelle in Abschnitt 1 (je Zeile verweigert ohne und erlaubt mit genau diesem Recht). |
| Ein Nutzer ohne Eintrag sieht und darf nichts | **Erfüllt.** Auch mit „Nur zugewiesene“ sieht er keine zugewiesenen Karten. |
| Web blendet aus, was fehlt; keine eigene Rechtelogik im Frontend | **Erfüllt.** Der Server bildet die Hub-Rechte in `GET /workspace/{id}/capabilities` ab; die Web-App fragt nur Capabilities. |

**Entscheidung 1: Aktivierung je Workspace beim ersten Push.** Die Aufgabe verlangte „immer an, für jedes Mitglied“. Ohne Bedingung sähe in jedem Workspace, in den der Hub nie überträgt, kein Mitglied etwas, auch in einer frischen Kaneo-Installation und in rund 50 Upstream-Testdateien (Fixture-Rolle `member`). Deshalb übernimmt der Hub einen Workspace mit seinem ersten `PUT …/users`, auch mit leerer Liste. Ab dann gilt die Durchsetzung dort ohne Ausnahme und lässt sich im Board nicht abschalten. Workspaces ohne Push verhalten sich wie Kaneo.

**Entscheidung 2: Systemkonto über `PEGASUS_HUB_USER_EMAIL`.** Das Board kann das Systemkonto sonst nicht von einem Key-Account-Admin unterscheiden: beide sind Administratoren mit API-Key. Nur der Betreiber setzt die Variable, ein Board-Admin kann so niemanden ausnehmen.

---

## 1. Verhalten

| Thema | Verhalten |
|---|---|
| Wen es betrifft | Jedes Mitglied eines vom Hub verwalteten Workspaces (Zeile in `pegasus_workspace`), gleich welcher Rolle. Nicht betroffen: `owner`, Instanz-Admins, das Konto mit der Login-E-Mail aus `PEGASUS_HUB_USER_EMAIL` (Groß-/Kleinschreibung egal). |
| Sichtbereich | wie PEGA-141 (`all`, `units`, `assigned`, ohne Stand nichts). „Nur zugewiesene“ (Rolle) schränkt **zusätzlich** ein: sichtbar nur, wenn Hub **und** Rolle zulassen (bisher reichte eine). |
| Rechte | Ein Recht, das im Stand fehlt, ist verweigert. Der Hub setzt `LEAD_READ` für jeden Nutzer im Stand; das Board prüft es nicht gesondert, Lesen folgt dem Sichtbereich. |
| Kaneo-Rolle | Für Hub-gesteuerte Mitglieder ersetzt das Hub-Recht auf Karten-Routen die Rollenprüfung (kein doppeltes Gate): Die Rolle kann weder erweitern (Admin ohne `LEAD_DELETE` → 403) noch blockieren (Viewer mit `LEAD_EDIT` → 200). Board-Eigenes (Labels anlegen/ändern, Spalten, Felder, Einstellungen, Push-API) bleibt bei der Rolle. |
| API-Key | Ein Key-Scope schränkt weiter ein (403 `API_KEY_SCOPE`), auch bei Hub-gesteuerten Mitgliedern. |
| Aktualität | Jede Anfrage liest den gespeicherten Stand; ein neuer Stand wirkt ab der nächsten Anfrage. Die Web-App lädt Capabilities spätestens nach 5 Minuten oder beim Neuladen neu. |

**Abbildung Kaneo-Aktion → Recht** (fehlt es: 403 `MISSING_PERMISSION`, `missingPermissions: ["<Recht>"]`):

| Aktion (operationId) | Recht |
|---|---|
| Lesen, Liste, Suche, Einzelkarte, Beschreibung, Aktivitäten, Anhänge, Benachrichtigungen | Sichtbereich wie bisher (404 außerhalb) |
| `exportTasks` | `LEAD_EXPORT` (bisher für alle Mitglieder offen; für Kaneo-Mitglieder bleibt es so) |
| `createTask`, `duplicateTask`, `importTasks`, `stageTaskAssetUpload`, `finalizeStagedTaskAsset` | `LEAD_CREATE` |
| `updateTask`, `updateTaskTitle`, `updateTaskPriority`, `updateTaskDueDate`, `updateTaskDescription`, `createTaskImageUpload`, `finalizeTaskImageUpload`, `setCustomFieldValue`, `attachLabelToTask`, `detachLabelFromTask`, `createTaskComment`, `updateTaskComment`, `deleteTaskComment`, `createActivity`, `createComment`, `updateComment`, `deleteComment`, `createTaskRelation`, `deleteTaskRelation`, `createTimeEntry`, `updateTimeEntry`, `createExternalLink`, `deleteExternalLink` | `LEAD_EDIT` |
| `updateTaskStatus`, `moveTask`, `reorderTasks` mit Spaltenwechsel, `updateTask` mit neuem Status | `LEAD_MOVE_STAGE` (bei `updateTask` zusätzlich zu `LEAD_EDIT`) |
| `reorderTasks` innerhalb einer Spalte | `LEAD_EDIT` |
| `updateTaskAssignee`, `updateTask` mit neuem Bearbeiter | `LEAD_ASSIGN_PROCESSOR` |
| `deleteTask` | `LEAD_DELETE` |
| `bulkUpdateTasks` | `delete` → `LEAD_DELETE`, `updateAssignee` → `LEAD_ASSIGN_PROCESSOR`, `updateStatus` → `LEAD_MOVE_STAGE`, sonst `LEAD_EDIT` |
| Duplikat einer Unteraufgabe (verknüpft die Kopie mit der Elternkarte) | zusätzlich `LEAD_EDIT` (bisher `task:update` der Rolle) |
| Projektstatistik (`listProjects` → `statistics`) | `REPORTING_VIEW`; ohne das Recht kommen Nullen, die Projektliste selbst bleibt |

Über die Tabelle der Aufgabe hinaus gesetzt, damit keine Karten-Schreibroute an der Kaneo-Rolle hängen bleibt: Umsortieren in einer Spalte, `updateTask` mit Status- oder Bearbeiterwechsel, Bild-Uploads, die Kommentar-Routen unter `/activity`, Relationen, Zeiteinträge, externe Links, Staged Upload beim Anlegen, Duplikat einer Unteraufgabe.

`LEAD_ARCHIVE`, `LEAD_REASSIGN_UNIT`, `LEAD_RETURN_OR_REPORT`, `LEAD_HANDOVER_BSI`, `COMM_*` und `ADMIN_*` werden gespeichert, aber nicht geprüft (kommen mit den Prozess-Stories). Archivieren in Kaneo ist ein Statuswechsel und braucht heute `LEAD_MOVE_STAGE`.

### Push-API für den Hub

Pfade und Operation-IDs unverändert (Vertrag). Neu ist nur das Feld `permissions`:

| Route | Verhalten |
|---|---|
| `PUT /api/pegasus-visibility/workspace/{workspaceId}/users` | Body `{ users: [{ email, mode, unitIds, permissions }] }`. `permissions` ist **Pflicht** (je Schlüssel 1–100 Zeichen, höchstens 200), sonst 400 und der alte Stand bleibt; so kann ein älterer Hub keinen Workspace übernehmen, in dem dann alle nur lesen dürften. Der erste erfolgreiche Aufruf trägt den Workspace in `pegasus_workspace` ein. |
| `GET /api/pegasus-visibility/workspace/{workspaceId}/users` | gibt `permissions` je Nutzer mit aus (Diagnose). |

### Web-App

`GET /workspace/{id}/capabilities` hat vier neue Capabilities. Für Hub-gesteuerte Mitglieder entscheidet bei den Karten-Capabilities das Hub-Recht (und ein API-Key-Scope):

| Capability | Hub-Recht | Kaneo (sonst) | Web blendet aus |
|---|---|---|---|
| `createTasks` | `LEAD_CREATE` | `task:create` | „Neue Karte“ in Spalte, Liste, Startseite, Duplizieren |
| `updateTasks` | `LEAD_EDIT` | `task:update` | Titel, Beschreibung, Priorität, Fälligkeit, Felder, Kommentieren, eigene Kommentare bearbeiten/löschen |
| `labelTasks` (neu) | `LEAD_EDIT` | `label:update` | Labels an der Karte (Popover, Bulk, Kurzbefehl) |
| `moveTasks` (neu) | `LEAD_MOVE_STAGE` | `task:update` | Ziehen auf Board und Liste, Status-Auswahl, Archivieren, „Geplant“, in anderes Projekt verschieben, Bulk-Status |
| `assignTasks` | `LEAD_ASSIGN_PROCESSOR` | `task:assign` | Assignee-Auswahl |
| `deleteTasks` | `LEAD_DELETE` | `task:delete` | Löschen |
| `exportTasks` (neu) | `LEAD_EXPORT` | `task:read` | Export in den Projekteinstellungen |
| `viewReports` (neu) | `REPORTING_VIEW` | `project:read` | Fortschritt am Projekt in der Seitenleiste |

Der Rolleneditor hat den Schalter „Sicht aus dem Hub“ nicht mehr. Unter „Aufgaben“ steht stattdessen ein Hinweis: In Hub-verwalteten Workspaces kommen Sicht und Lead-Rechte aus dem Hub.

---

## 2. Umsetzung

| Datei | Aufgabe |
|---|---|
| `apps/api/drizzle/0067_pegasus_permissions.sql`, `database/schema.ts`, `database/index.ts` | Tabelle `pegasus_workspace` (PK/FK Workspace cascade), Spalte `pegasus_user_scope.permissions text[] not null default '{}'`, `workspace_role.hub_scoped` entfernt. Idempotent (`IF [NOT] EXISTS`, Constraint im `CREATE TABLE`). |
| `packages/permissions/src/hub-permissions.ts` (**neu**), `capabilities.ts`, `index.ts` | Die 19 Schlüssel, die Zuordnung Capability → Hub-Recht, vier neue Capabilities; `view_hub_scoped` aus `roleRestrictions` entfernt. |
| `apps/api/src/task-scope/` | `loadMemberAccess` liefert je Workspace Sicht **und** Rechte (`permissions: null` = nicht Hub-gesteuert); `loadTaskScopes` bleibt für Lesepfade über mehrere Workspaces. `resolveMemberAccess(c)` merkt beides je Request. `TaskScope` jetzt `{ userId, assignedOnly, unitIds \| null }` mit UND-Semantik. Neu `is-hub-system-account.ts`. |
| `apps/api/src/utils/require-hub-permission.ts` (**neu**) | `requireLeadPermission(kaneo, hub)` (Middleware: Hub-Recht für Hub-gesteuerte Mitglieder, sonst wie bisher `requireWorkspacePermission`), `requireHubPermission`, `hubAllows`, `hasLeadPermission`. |
| Einzeiler in Upstream-Dateien | `task/index.ts`, `task/controllers/require-task-permission.ts` (Bulk, Assignee, neu `requireTaskStatusPermission`, `requireReorderPermission`), `comment`, `activity`, `custom-field`, `label`, `task-relation`, `time-entry`, `external-link` (`index.ts`), `project/{index.ts,controllers/get-projects.ts}`, `workspace/{index.ts,controllers/get-my-capabilities.ts}`, `utils/require-workspace-permission.ts` (exportiert `assertApiKeyScope`, `apiKeyAllows`). |
| `apps/api/src/pegasus-visibility/` | Pflichtfeld `permissions`, Marker `pegasus_workspace`, OpenAPI-Beschreibungen. |
| `auth.ts`, `auth-openapi.ts`, Web `lib/auth-client.ts`, `use-*-workspace-role(s).ts`, `settings/workspace/roles.tsx` | Rollenfeld `hubScoped` entfernt; Hinweis im Rolleneditor. |
| Web-Komponenten (Liste im [Register](../fork-eingriffe.md#pega-142--rechte-je-nutzer-aus-dem-hub)) | Ausblenden über `canMoveTasks`, `canLabelTasks`, `canExportTasks`, `canViewReports` und die vorhandenen `canCreateTasks`, `canUpdateTasks`, `canAssignTasks`, `canDeleteTasks`. |
| `i18n/*.json`, `i18n/schema.json` | `settings.workspaceRoles.hubManagedHint` (de-DE, en-US; übrige Locales englisch); `…task.view_hub_scoped` entfernt. |
| `.env.sample`, `docs/board-einrichtung.md` | `PEGASUS_HUB_USER_EMAIL`; Rollen, Reihenfolge, neuer Abschnitt „Neuen Key Account anbinden“ mit Ausblick auf die Automatisierung über den Hub. |

**Kosten:**
- Ein nicht Hub-gesteuertes Mitglied zahlt wie bisher eine Abfrage für die Rollen. Neu kommt eine indizierte Abfrage auf `pegasus_workspace` dazu.
- Ein Hub-gesteuertes Mitglied zahlt zusätzlich die Abfragen für den eigenen Stand. Middlewares und Handler teilen sich das Ergebnis über den Context.
- Umsortieren und `updateTask` lesen vor der Prüfung die alten Status der betroffenen Karten (Abfrage über den Primärschlüssel).

---

## 3. Umgehungsmöglichkeiten und offene Punkte

| # | Fläche | Status |
|---|---|---|
| 1 | Karten-Schreibrouten mit eigener Kaneo-Rollenprüfung | **gedeckt**: alle Routen mit `task:create/update/delete/assign` oder `label:update` an einer Karte laufen über `requireLeadPermission` (Abschnitt 1) |
| 2 | Rolle des Mitglieds erweitern oder einschränken | **gedeckt**: wirkt auf Hub-gesteuerte Mitglieder nur bei Board-Eigenem |
| 3 | Board-Admin nimmt jemanden aus | **gedeckt**: nur `owner`, Instanz-Admins und `PEGASUS_HUB_USER_EMAIL` sind ausgenommen. Eine Owner-Übertragung oder Instanz-Admin-Rolle bleibt ein bewusster Eingriff eines Owners bzw. Instanz-Admins. |
| 4 | Export-Schutz je Rolle (PEGA-6 #17) | **gedeckt** über `LEAD_EXPORT` |
| 5 | `createTask`/`importTasks` mit `userId` setzen einen Bearbeiter ohne `LEAD_ASSIGN_PROCESSOR` | **offen**, niedrig. Upstream prüft beim Anlegen ebenfalls kein `task:assign`; der Hub legt Leads ohnehin über das Systemkonto an. |
| 6 | Integrationen (GitHub, GitLab, Gitea), Kalender-Feed, Integrations-Abgleich | unverändert bei der Kaneo-Rolle bzw. für eingeschränkte Sicht 403 (PEGA-141). Pegasus nutzt keine dieser Integrationen. |
| 7 | Mobile App | **offen**: Die API setzt die Rechte durch (403). Die Mobile App blendet noch nicht aus; sie hat einen eigenen HTTP-Client und fragt keine Capabilities. |
| 8 | Live-Aktualisierung der Rechte im offenen Browser | **akzeptiert**: Ein neuer Stand wirkt sofort in der API. Die Web-App blendet erst nach dem Neuladen der Capabilities (höchstens 5 Minuten) um, bis dahin antwortet eine verbotene Aktion mit 403 und einer Fehlermeldung. |
| 9 | Rechte ohne Board-Aktion (`LEAD_ARCHIVE` …) | gespeichert, nicht geprüft (Prozess-Stories) |
| 10 | Im Board angelegte Karte hat keine Einheit und ist für Mitglieder im Modus `units` unsichtbar, auch für den Ersteller (erscheint kurz, nach dem Neuladen weg; im lokalen Test gesehen) | **offen, Hub**: Der Hub setzt beim `card.created`-Webhook die direkte Einheit des Erstellers (Aufgabe an den Hub-Teil). Voraussetzung: `KANEO_WEBHOOK_URL` im Hub. |

---

## 4. Nachweis

Test-first je Verhalten (rot → grün → refactor). Rot gesehen (Auszug):

- Vertrag: Antwort ohne `permissions` (`expected [ …(2) ] to deeply equal [ …(2) ]`), Push eines alten Hubs angenommen (`expected 200 to be 400`).
- `composeTaskScope`: 7 von 9 rot (`expected null to deeply equal { userId: 'user-1', …(2) }`, alte Form `assigned`).
- Wer gesteuert wird: Mitglied außerhalb des Stands sah alle 8 Karten (`expected [ 'L1', 'L2', 'L3', 'L4', 'L5', …(3) ] to deeply equal []`), Bearbeiten ohne `LEAD_EDIT` ging durch (`expected 200 to be 403`).
- Aktionstabelle: 41 von 64 rot. Verweigern lief bis zur Kaneo-Rolle durch; „erlaubt mit nur diesem Recht“ scheiterte an der Kaneo-Rolle (`missingPermissions: ["task:create"]`, `["task:assign"]`, `["task:delete"]`, `["label:update"]`).
- `updateTask` mit Statuswechsel ohne `LEAD_MOVE_STAGE`: `expected 200 to be 403`, Prüfung kurz ausgehängt.
- Duplikat einer Unteraufgabe ohne `LEAD_EDIT`: `expected 200 to be 403` (Kaneo-Rolle mit `task:update` schlug durch).
- Statistik ohne `REPORTING_VIEW`: `expected { totalTasks: 2, …(2) } to match object { totalTasks: +0, …(1) }`.
- Systemkonto (Helfer kurz ausgeschaltet): `expected [] to deeply equal [ 'L1', … ]`.
- Capabilities: Kaneo-Rolle entschied statt Hub-Recht.
- Rechte-Paket: `capabilityHubPermission` fehlte; `roleRestrictions` enthielt noch `view_hub_scoped`.
- Web: kein `canMoveTasks` (`is not a function`); Ziehen, Status-Auswahl, Kontextmenü, Bulk-Leiste, Verschieben-Popover, Label-Popover, Kommentar-Eingabe und -Bearbeiten, Export, Fortschritt, Kurzbefehle zeigten trotz fehlender Capability die Aktion; Rolleneditor ohne Hinweis und mit `hubScoped` im Speicheraufruf.

Tests:

- `tests/api-integration/hub-permissions.test.ts` (**neu**, 82) auf dem Testbaum aus SPEC §12:
  - Workspace ohne Push wie Kaneo; Mitglied außerhalb des Stands sieht und darf nichts.
  - Aktionstabelle je Zeile (32 Aktionen) verweigert ohne und erlaubt mit genau diesem Recht.
  - `updateTask` mit Status- bzw. Bearbeiterwechsel; Duplikat einer Unteraufgabe; Statistik mit und ohne `REPORTING_VIEW`.
  - Owner, Instanz-Admin und Systemkonto (auch ohne Stand) unbeschränkt; Admin-Konto, das die Variable nicht nennt, gesteuert.
  - Rolle `admin` erweitert nicht, Rolle `viewer` blockiert nicht; API-Key-Scope schränkt weiter ein.
  - Capabilities im gesteuerten und im nicht verwalteten Workspace.
- `tests/api-integration/pegasus-visibility-api.test.ts` (18, +2): Rechte speichern und lesen inklusive unbekannter Schlüssel; Push ohne `permissions` → 400, alter Stand bleibt.
- `tests/api-integration/task-view-hub-scope.test.ts` (28): weiter alle Lesepfade auf dem Testbaum.
- `tests/api/task-scope/compose-task-scope.test.ts` (9): Regel für verwaltete und nicht verwaltete Workspaces, alle Modi, UND mit „Nur zugewiesene“.
- `packages/permissions/src/hub-permissions.test.ts` (**neu**, 2), `index.test.ts` (angepasst).
- Web:
  - **neu:** `bulk-bar.test.tsx`, `task-activity.test.tsx`, `task-labels-popover.test.tsx`, `export-tasks-row.test.tsx`, `project-progress.test.tsx`
  - **ergänzt:** `use-workspace-permission.test.tsx`, `filtered-drag.test.tsx`, `list-view/index.test.tsx`, `column-header.test.tsx`, `task-card-context-menu-content.test.tsx`, `task-status-popover.test.tsx`, `task-move-popover.test.tsx`, `comment-card.test.tsx`, `task-shortcuts.test.tsx`, `use-task-action-shortcuts.test.tsx`, `roles.test.tsx`

**Offen geänderte bestehende Tests:**
- `pegasus-visibility-api.test.ts`: Alle Push-Bodies tragen `permissions: []`, weil das Feld Pflicht ist. Die Hilfsfunktion `storedScopes` und der Lesetest vergleichen `permissions` mit.
- `helpers/hub-scope-fixture.ts`:
  - Ohne `hubScoped`.
  - Die Default-Stände tragen einen vollen Lead-Rechtesatz.
  - Neu `pushPermissions`.
  - Jeder Push meldet sich als Owner an, weil Tests die Sitzung dazwischen wechseln.
  - Der Projektzähler steht hinter den vorgegebenen Kartennummern, damit per API angelegte Karten nicht auf Nummer 1 stoßen.
- `task-view-hub-scope.test.ts`, geänderte Anforderungen:
  - Innendienst (Rolle `member`, kein Stand) sieht jetzt nichts.
  - „restricts a member who holds the hub role next to member“ wird zu „…whatever their role, even a workspace admin“.
  - „admits a task when either restriction does“ wird zu „…only when both restrictions do“ (vorher L1, L2, L4; jetzt L1).
- `compose-task-scope.test.ts` neu geschrieben (Parameter `managed` statt `hubScoped`, neue Form von `TaskScope`).
- `workspace-role-hub-scoped.test.ts` entfernt: Den Rollenschalter gibt es nicht mehr.
- Web:
  - `use-task-action-shortcuts.test.tsx`: „respects edit and assign permissions“ drückt `p` (Priorität) statt `s`, weil der Status ein eigenes Recht hat.
  - `task-shortcuts.test.tsx`: „…blocks edits without update permission“ schaltet auch `canMoveTasks` aus (ohne `task:update` hat eine Kaneo-Rolle beides nicht).
  - `roles.test.tsx`: Die zwei Schalter-Tests wurden durch „kein Hub-Schalter, Hinweis sichtbar“ und „Speichern ohne Hub-Feld“ ersetzt; `hubScoped` aus Fixtures und Erwartungen entfernt.
  - Harness-Mocks für `useWorkspacePermission` in `filtered-drag`, `list-view/index`, `column-header`, `task-move-popover`, `comment-card` ergänzt.

Gelaufen: siehe Abschnitt 6.

---

## 5. Konfiguration im Board

Siehe [Board-Einrichtung, Abschnitte 5 und 6](../board-einrichtung.md#5-nicht-teil-des-skripts).

- **Rollen:** Administrator für Plattform-Admins, Key-Account-Admins und das Systemkonto. Eine Rolle „Pegasus“ mit Leserechten für alle übrigen.
- **Reihenfolge:**
  1. `PEGASUS_HUB_USER_EMAIL` setzen.
  2. Den Hub Karten-Einheiten und dann Nutzer mit Rechten übertragen lassen. Der erste Push schaltet die Durchsetzung ein.
  3. Mitglieder auf „Pegasus“ umstellen.

Bestehende Rollen mit dem früheren Schalter „Sicht aus dem Hub“ brauchen keine Nacharbeit: Migration 0067 entfernt die Spalte.

**Für den Hub:** `KANEO_REF=<Commit> pnpm hub kaneo:spec:pull && pnpm hub kaneo:client:gen` (der Commit muss gepusht sein). Was der Hub ändern muss, geht als eigene Aufgabe an den Hub-Teil (Client neu erzeugen, Einheiten vor Nutzern übertragen, `MISSING_PERMISSION` melden, Projekt je Key Account, Einheit für im Board angelegte Karten).

---

## 6. Gelaufen

Am 2026-11-05 auf `th_PEGA-142`, alle grün:

- `pnpm test:integration` (API, PostgreSQL `kaneo_test`): 163 Dateien, 1 921 Tests bestanden, 3 übersprungen (vorhandene `skip` in `integration-sync-providers.test.ts`). Die Upstream-Tests laufen unverändert grün; darin liegt der Nachweis, dass Workspaces ohne Push wie Kaneo bleiben.
- API-Unit: 172 Dateien, 1 297 Tests. Web: 327 Dateien, 1 739 Tests. Rechte-Paket: 14 Tests.
- `pnpm --filter @kaneo/api typecheck`, `pnpm --filter @kaneo/web typecheck`.
- `pnpm lint` (`vp check`): 4 061 Dateien formatiert, keine Lint-Fehler.
- `pnpm i18n:check`, `pnpm openapi:check` (`apps/docs/openapi.json` aktuell).
- `pnpm --filter @kaneo/api db:generate` (Snapshot und Journal 0067), SQL danach durch die idempotente Fassung ersetzt. Die drei Anweisungen liefen auf der migrierten Testdatenbank zweimal erneut ohne Fehler; danach existieren `pegasus_user_scope.permissions` und `pegasus_workspace`, und `workspace_role.hub_scoped` ist entfernt.
- **Nicht gelaufen:**
  - keine Browser-Sitzung; das Ausblenden ist per Komponententests belegt, die Durchsetzung liegt vollständig in der API.
  - kein Test der Mobile App (Abschnitt 3, #7).
  - kein Lasttest für ein Hub-gesteuertes Mitglied auf 1 000 Karten.
