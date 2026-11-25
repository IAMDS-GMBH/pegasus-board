# Fork-Eingriffe — Register für den Upstream-Abgleich

Dieses Register listet jede Änderung, mit der `IAMDS-GMBH/pegasus-board` vom Original [`usekaneo/kaneo`](https://github.com/usekaneo/kaneo) abweicht. Es ist die Checkliste für jeden Upstream-Sync: Was muss nach dem Merge noch da sein, woran erkennt man es, und welcher Test fällt, wenn es verloren geht?

Pfadangaben beziehen sich auf die Repo-Wurzel. Fork-Stellen im Code sind mit „Pegasus fork“ oder „Fork (PEGA-…)“ kommentiert, wo der Grund nicht offensichtlich ist.

| | |
|---|---|
| **Letzter Sync** | 2026-10-19, Upstream `main` @ `cfe528c1` (v2.46.2+141), Merge `cee0714f`, Nacharbeit `eb829b17` |
| **Vorheriger Sync** | 2026-10-05, Upstream @ `cc8e5812` (v2.32.0+44), Merge `eab0abad` |

---

## 1. Übersicht

| Story | Eingriff | Art | Absichernde Tests |
|---|---|---|---|
| PEGA-6 | Rolle „nur zugewiesene Karten“ (`workspace_role.assigned_only`) | Datenmodell, API-Scope, Rollen-Editor, i18n | `tests/api-integration/task-view-assigned-only.test.ts`, `workspace-role-assigned-only.test.ts`, `tests/api/utils/assigned-only-scope.test.ts`, `apps/web/.../settings/workspace/roles.test.tsx` |
| PEGA-5 | Custom-Field-Werte je Projekt unter dem Zeilenfilter | API-Scope | `task-view-assigned-only.test.ts` („custom field values“) |
| PEGA-29 | Stabile Event-ID in generischen Webhooks | API | `tests/api/events/publish-event.test.ts`, `tests/api/plugins/generic-webhook/events.test.ts`, `tests/api/scheduler/reminder-event-id.test.ts` |
| WWK | Theming und Markenname | Web, i18n | `apps/web/src/brand/index.test.ts` |
| PEGA-87 | Custom-Field-Typ `url` (Link) | API, Web, Mobile, CLI, MCP, i18n | `tests/api-integration/custom-field-url.test.ts`, `tests/api/custom-field/url-value.test.ts`, `apps/web/src/components/custom-fields/custom-field-url.test.ts`, `card-field-list.test.tsx` |
| PEGA-88 | Felder auf der Kartenvorschau (`custom_field_definition.show_on_card`) | Datenmodell, API, Web, i18n | `tests/api-integration/custom-field.test.ts` („stores whether a field shows on the card…“), `tests/api/custom-field/resolve-field-update.test.ts`, `apps/web/src/components/custom-fields/{card-fields,card-field-rows}.test.ts(x)`, `kanban-board/task-card.test.tsx`, `project/display/custom-field-toggles.test.tsx` |
| PEGA-89 | Serverseitiger Board-Filter nach Feldwerten und Labels | API, Web, MCP, Tests, Dev-Seed | `tests/api-integration/task-list-filters.test.ts` (1.000 Karten, < 2 s), `tests/api/task/task-filter-params.test.ts`, `tests/e2e/filter-performance.spec.ts`, Web: `server-filters.test.ts`, `board-server-filters.test.ts`, `use-get-tasks.test.tsx`, `task-matches-filters.test.ts`, `use-task-filters-with-labels-support.test.tsx`, `filtered-drag.test.tsx`, MCP: `register.test.ts` |
| PEGA-90 | Feldänderungen live (`customFieldsChanged`), Fehlercodes der Feldverwaltung, deutsche Feldverwaltung | API, WebSocket, Web, i18n | `tests/api-integration/custom-field-live-updates.test.ts`, `custom-field-error-codes.test.ts`, `tests/api/ws/broadcast.test.ts`, `redis-link-refresh.test.ts`, Web: `use-project-websocket-cache.test.tsx` („custom field live updates“), `custom-field-error-key.test.ts`, `custom-field-dialog.test.tsx`, `custom-field-list.test.tsx`, `use-filter-subjects.test.tsx`, `month-grid.test.tsx`, `lib/i18n/custom-field-translations.test.ts` |
| PEGA-84 | Board „Bewerber-Pool“ per Skript einrichten (Spalten, Labels, Standardfelder) | Konfiguration (Skript), keine Anwendungsdatei | `scripts/board-setup/*.test.mjs` (`node --test`), Probelauf gegen die Testumgebung |
| PEGA-86 | Custom-Field-Typen `email` und `phone` (Mail und Anruf mit einem Tipp), Typwechsel Text ↔ E-Mail ↔ Telefon | API, Web, Mobile, CLI, MCP, i18n, Board-Skript | `tests/api-integration/custom-field-contact.test.ts`, `tests/api/custom-field/{email-value,phone-value,stored-value,plan-text-value-changes,resolve-field-update}.test.ts`, Web: `custom-field-{email,phone,href,row,chip}.test.ts(x)`, `card-field-{rows,list}.test.tsx`, `kanban-board/task-card.test.tsx`, `field-dialog/{field-form,custom-field-dialog}.test.ts(x)`, `custom-field-error-key.test.ts`, `lib/i18n/custom-field-translations.test.ts`, `scripts/board-setup/plan-fields.test.mjs` |
| PEGA-141 | Sichtbereich nach Einheiten aus dem Hub (Tabellen `pegasus_*`, Push-API; Rollenschalter `hub_scoped` seit PEGA-142 entfallen); ein gemeinsames Sicht-Prädikat für „Sicht aus dem Hub“ und „Nur zugewiesene“, schließt die Lücken des PEGA-6-Reviews | Datenmodell, API, API-Scope, Benachrichtigungen, Web, i18n | `tests/api-integration/{task-view-hub-scope,notification-hub-scope,pegasus-visibility-api}.test.ts`, `tests/api/task-scope/compose-task-scope.test.ts`, weiterhin `task-view-assigned-only.test.ts`, `workspace-role-assigned-only.test.ts`; Web `roles.test.tsx`, `packages/permissions/src/index.test.ts` |
| PEGA-142 | Rechte je Nutzer aus dem Hub (`pegasus_user_scope.permissions`, `pegasus_workspace`): ab dem ersten Push gelten Sicht und Lead-Rechte des Hubs für jedes Mitglied; ersetzen auf Karten-Routen die Kaneo-Rolle; Capabilities fürs Web | Datenmodell, API, Web, i18n, Doku | `tests/api-integration/hub-permissions.test.ts`, `pegasus-visibility-api.test.ts`, `task-view-hub-scope.test.ts`, `tests/api/task-scope/compose-task-scope.test.ts`, `packages/permissions/src/hub-permissions.test.ts`; Web `bulk-bar`, `filtered-drag`, `list-view`, `column-header`, `task-card-context-menu-content`, `task-status-popover`, `task-move-popover`, `task-labels-popover`, `task-activity`, `comment-card`, `export-tasks-row`, `project-progress`, `task-shortcuts`, `use-task-action-shortcuts`, `use-workspace-permission`, `roles` |
| PEGA-143 | Bearbeiter: Karte „An Einheit zurückgeben“ (`PUT /task/return/{id}`, Recht `LEAD_RETURN_OR_REPORT`, Capability `returnTasks`); Mitgliedschaft aus dem Hub-Stand ohne Einladung | API, Auth-Hooks, Web, i18n, Doku | `tests/api-integration/{hub-return-task,hub-membership}.test.ts`, `hub-permissions.test.ts` (Capabilities), `packages/permissions/src/hub-permissions.test.ts`; Web `task-return-button.test.tsx` |
| PEGA-170 | Spalten nach Fachkonzept (14 Stufen in 4 Phasen); Spalte mit Phase und Sperre (`column.phase`, `column.is_locked`); Phasenüberschriften im Board; gesperrte Spalten (403 `COLUMN_LOCKED`) außer für Owner, Instanz-Admins und Systemkonto | Datenmodell, API, Web, i18n, Board-Skript, Doku | `tests/api-integration/{column-lock,column-phase-lock}.test.ts`, `scripts/board-setup/plan-columns.test.mjs`; Web `group-columns-by-phase`, `is-locked-move`, `filtered-drag`, `list-view`, `column-header`, `column-list`, `option-menu`, `status-menu-options`, `task-card-context-menu-content` |
| PEGA-80 | Benachrichtigungseinstellungen im Hub (`PEGASUS_NOTIFICATION_SETTINGS_URL`, `notificationSettingsUrl` in `GET /config`, eigene Seite leitet weiter); Integrationen in Hub-Workspaces nur für Owner, Instanz-Admins und das Systemkonto (403 `HUB_GOVERNED`, Capability `manageIntegrations`) | API, Web, i18n, Doku | `tests/api-integration/{hub-integration-guard,config,notification-delivery-events}.test.ts`, `hub-permissions.test.ts` (Capabilities), `tests/api/utils/notification-settings-url.test.ts`, `packages/permissions/src/hub-permissions.test.ts`; Web `build-settings-nav`, `settings-nav-group`, `account/notifications`, `projects/$projectId/integrations`, `use-workspace-permission` |
| PEGA-66 | Frist je Lead sichtbar (Board-Teil): überfällige Karte und Zeile rot (Fälligkeit `< jetzt`, Spalte nicht final, nicht archiviert; minutengenau statt Kalendertag), Filter „Überfällig“ mit Einstieg `?filter=overdue`, Startseiten-Block „Überfällig (n)“ über `GET /task/overdue` (`listOverdueTasks`, Sichtbereich wie Liste und Suche); Hub-Vertrag `updateTaskDueDate` und Posteingang je Art per Test belegt | API, Web, i18n, Doku | `tests/api-integration/{overdue-tasks,hub-due-date,notification-inbox-types}.test.ts`; Web `is-task-overdue`, `use-is-task-overdue`, `due-date-chip`, `kanban-board/task-card`, `list-view/task-row`, `task-matches-filters`, `use-task-filters-with-labels-support`, `use-overdue-filter-from-search`, `home/overdue-block`, `home/overdue-since` |

---

## 2. Eingriffe im Einzelnen

### PEGA-6 — Rolle „nur zugewiesene Karten“

**Zweck:** Führungskräfte sehen nur Bewerber, die ihnen zugewiesen sind ([Review](review/2026-10-zeilenfilter-fuehrungskraft.md)).

**Dateien:**
- Migration `apps/api/drizzle/0064_workspace_role_assigned_only.sql` (idempotent, `ADD COLUMN IF NOT EXISTS`), Spalte in `apps/api/src/database/schema.ts` (`workspaceRoleTable.assignedOnly`), `apps/api/src/utils/migrate-renumbered-fork-migration.ts`
- Scope-Logik und Durchsetzung seit PEGA-141 gemeinsam mit der Hub-Sicht in `apps/api/src/task-scope/` (siehe [PEGA-141](#pega-141--sichtbereich-aus-dem-hub)); `utils/assigned-only-scope.ts`, `restrictToUserId` und `denyAssignedOnly` gibt es nicht mehr
- Better-Auth-Feld `assignedOnly` in `apps/api/src/auth.ts`, `auth-openapi.ts`, `apps/web/src/lib/auth-client.ts`; Rollen-Editor `apps/web/src/routes/.../settings/workspace/roles.tsx`; `packages/permissions`
- i18n-Schlüssel `view_assigned_only` in allen `i18n/*.json` und `i18n/schema.json`

**Beim Sync beachten:**
- Fork-Migration immer **hinter** die letzte Upstream-Migration nummerieren (zuletzt 0055 → 0060 → 0064; PEGA-88: 0065), Journal und Snapshot von Upstream übernehmen, Snapshot per `pnpm --filter @kaneo/api db:generate` neu erzeugen, SQL durch die idempotente Fassung ersetzen. Prüfen, dass der `when`-Wert älterer Fork-Zeilen kleiner ist als der neuer Upstream-Migrationen; sonst überspringt Drizzle sie (Fall 0055, gelöst durch `forgetRenumberedForkMigration`).
- **Jeden neuen oder geänderten Upstream-Lesepfad für Karten** auf den Zeilenfilter prüfen. Upstream ergänzt bei neuen Abfragen inzwischen `projectAccessCondition(...)`; genau dort fehlt meist auch der Assignee-Filter.
- Upstream erlaubt mehrere Rollen je Mitglied (`utils/split-roles.ts`, kommagetrennt). Der Scope greift, sobald **eine** Rolle eingeschränkt ist (außer `owner`).

### PEGA-5 — Custom-Field-Werte unter dem Zeilenfilter

**Dateien:** `apps/api/src/custom-field/index.ts` (zwei Einzeiler), `controllers/get-custom-field-values-by-project.ts`, `controllers/get-custom-field-filter-values.ts`.

**Beim Sync beachten:** Upstream ändert `custom-field/index.ts` häufig; die Tests in `task-view-assigned-only.test.ts` schlagen fehl, wenn der Parameter verloren geht.

### PEGA-29 — Stabile Event-ID in Webhooks

**Dateien:** `apps/api/src/events/index.ts`, `plugins/generic-webhook/{client,events}.ts`, `plugins/{registry,types}.ts`, `plugins/sync/{create-task-issue,reconcile}.ts`, `scheduler/project-webhook-reminders.ts`, `scheduler/reminder-event-id.ts`, Doku `apps/docs/core/integrations/outgoing-webhooks.mdx`.

**Beim Sync beachten:** beim Sync 2026-10-19 keine Überschneidung mit Upstream.

### WWK — Theming

**Dateien:** `apps/web/src/brand/*`, `apps/web/public/brands/wwk/*`, `components/common/logo.tsx`, `components/page-title.tsx`, `index.css`, `main.tsx` (`applyBrand()`), `store/user-preferences.ts` (Standard hell), `apps/web/package.json` (`@fontsource/ubuntu`), `i18n/en-US.json` (`{{appName}}` in `auth.signUp.instanceAdminTitle` und `auth.onboarding.pageTitle`). Details: [theming-wwk.md](theming-wwk.md).

**Beim Sync beachten:** `en-US.json` von Upstream übernehmen und die zwei `{{appName}}`-Titel wieder einsetzen. Neue Upstream-Texte mit „Kaneo“ bleiben unverändert.

### PEGA-87 — Custom-Field-Typ `url` (Link)

**Zweck:** Verweise wie ein LinkedIn-Profil als klickbaren Link am Lead speichern ([Review](review/2026-10-custom-field-link.md)). Upstream hat keinen Link-Typ (geprüft 2026-10-19: Enum, PRs, Issues).

**Regel:** Ein Wert wird getrimmt, ohne Schema mit `https://` ergänzt, muss als `http`/`https`-URL parsen, darf keine Zugangsdaten und keine Leerzeichen enthalten, braucht einen Host mit Punkt (oder `localhost`) und höchstens 2048 Zeichen. Gespeichert wird die normalisierte Form (`url.href`). Keine Migration: `custom_field_definition.type` ist `text`.

**Dateien:**
- API: `apps/api/src/custom-field/url-value.ts` (neu), `custom-field/schema.ts` (Enum), `assert-valid-definition.ts`, `controllers/create-custom-field.ts`, `controllers/set-custom-field-value.ts`, `resolve-field-update.ts`, `task/validate-task-fields.ts` (gemeinsamer Typ `CustomFieldValueType`), `task/controllers/create-task.ts`; `apps/docs/openapi.json`
- Web: `apps/web/src/components/custom-fields/custom-field-url.ts`, `custom-field-link.tsx`, `custom-field-open-link.tsx` (neu); `card-field-chip.tsx`, `card-field-overflow-row.tsx`, `custom-field-row.tsx`, `custom-field-chip.tsx`, `custom-field-popover.tsx`, `text-field-editor.tsx`, `custom-field-icon.ts`, `format-custom-field-value.ts`; `project/custom-fields/types.ts`, `field-kinds.ts`, `describe-custom-field.ts`, `field-dialog/{field-form.ts,field-default-input.tsx,field-type-picker.tsx}`
- Mobile: `apps/mobile/src/features/project/{use-field-types.ts,field-form.ts,custom-field-default-input.tsx}`, `features/task/sections.tsx`, `app/(app)/task/new.tsx`
- CLI/MCP: `packages/cli/src/fields/field-types.ts`, `commands/field/create.ts`, `apps/docs/cli/reference.mdx`; `packages/mcp/src/tools/register.ts` (Beschreibungen)
- i18n: `settings.customFields.types.url`, `settings.customFields.issues.invalidUrl`, `tasks.customFields.{invalidUrl,openLink}`, `mobile.projectSettings.url`, `mobile.taskDetail.fields.openLink` (en-US, de-DE übersetzt, übrige Locales mit englischem Fallback), `i18n/schema.json` von Hand ergänzt

**Beim Sync beachten:**
- Die Regel existiert zweimal (API `url-value.ts`, Web `custom-field-url.ts`) und muss gleich bleiben, sonst weicht der optimistische Wert im Editor vom gespeicherten ab.
- Neue Upstream-Stellen, die über Feldtypen verzweigen, um `url` ergänzen. TypeScript meldet fehlende Fälle nur bei `Record<CustomFieldType, …>` (`custom-field-icon.ts`, `field-kinds.ts`, CLI `FIELD_TYPE_LABELS`) und beim Mobile-`switch` in `field-form.ts`.
- `i18n/schema.json` ist upstream nicht mit `en-US.json` synchron; `pnpm i18n:schema` erzeugt einen großen Fremd-Diff. Neue Schlüssel deshalb von Hand eintragen.
- **Option:** Der Typ ist generisch. Ein PR an `usekaneo/kaneo` würde diesen Eingriff überflüssig machen (nur nach Abstimmung).

### PEGA-88 — Felder auf der Kartenvorschau

**Zweck:** Führungskräfte sehen die wichtigsten Angaben direkt auf der Board-Karte, am Smartphone wie am Desktop ([Review](review/2026-10-custom-fields-karte.md)). Upstream zeigt Feldwerte als höchstens zwei Chips, die Auswahl ist nur eine Browser-Einstellung je Nutzer, Überlauf und Tooltips öffnen nur per Hover.

**Regel:** Der Administrator schaltet je Feld „Auf Karte anzeigen“ ein (Standard aus, auch für bestehende Felder). Nur diese Felder erscheinen auf Board-Karte, Listen- und Backlog-Zeile. Die bestehende Nutzer-Einstellung „Auf Karten anzeigen“ (`hiddenCardFieldIds`) blendet davon einzelne Felder für sich aus und listet nur noch freigeschaltete Felder. Auf der Board-Karte stehen die Werte als Zeilen „Bezeichnung Wert“ unter dem Titel, alle freigeschalteten Felder, ohne Hover; leere Werte und nicht angehakte Kontrollkästchen entfallen.

**Dateien:**
- Migration `apps/api/drizzle/0065_custom_field_show_on_card.sql` (idempotent, `ADD COLUMN IF NOT EXISTS`), Spalte `customFieldDefinitionTable.showOnCard` in `apps/api/src/database/schema.ts`
- API: `custom-field/schema.ts` (`showOnCard` in Anlegen/Bearbeiten), `response.ts` (`showOnCard`, `fieldShowOnCard`), `resolve-field-update.ts`, `controllers/{create-custom-field,update-custom-field,get-custom-field-values-by-project,get-custom-field-values-by-task}.ts`, `index.ts`; `apps/docs/openapi.json`
- Web: `components/custom-fields/card-field-rows.tsx` (neu), `card-fields.ts` (Filter), `kanban-board/task-card/task-card-content.tsx`, `project/custom-fields/{types.ts,custom-field-row.tsx,field-dialog/field-form.ts,field-dialog/field-settings-box.tsx,field-dialog/custom-field-dialog.tsx}`, `project/display/custom-field-toggles.tsx`, `fetchers/custom-field/create-custom-field.ts`, `hooks/queries/custom-field/use-get-custom-field-values-by-project.ts`
- i18n: `settings.customFields.{showOnCard,showOnCardDescription,onCard}` (en-US, de-DE übersetzt, übrige Locales mit englischem Fallback), `i18n/schema.json` von Hand ergänzt

**Beim Sync beachten:**
- Migration wie bei PEGA-6 hinter die letzte Upstream-Migration nummerieren.
- Neue Upstream-Abfragen, die `customFieldValueSchema` liefern, brauchen `fieldShowOnCard`; die Antwortvalidierung bzw. TypeScript meldet das.
- Ändert Upstream die Kartenanzeige der Felder (`task-card-content.tsx`, `card-fields.ts`), muss der Filter auf `fieldShowOnCard` erhalten bleiben; `card-fields.test.ts` schlägt sonst fehl.

### PEGA-89 — Serverseitiger Board-Filter nach Feldwerten und Labels

**Zweck:** Der Innendienst filtert das Board nach Feldwerten (Paket, Kampagne, Prüfergebnis …), auch wenn tausende Karten im Pool liegen. Bisher lud die Web-App das ganze Board (Seiten à 100 Karten) und filterte im Browser; jetzt wendet `GET /task/tasks/{projectId}` die Parameter `labels` und `customFields` vor der Paginierung an, kombinierbar mit `status` ([Review](review/2026-10-filter-serverseitig.md)). Upstream kennt keinen Label- oder Feldfilter in der Task-Liste (geprüft 2026-10-21).

**Regel:** `labels` = JSON-Array von Label-**Namen** (beliebiger Treffer; Labels sind Kopien je Karte, IDs taugen nicht), `customFields` = JSON-Objekt Feld-ID → Werte (UND über Felder, ODER innerhalb eines Feldes; `multiselect` trifft jede gewählte Option). Unbekannte Feld-ID → leeres Ergebnis (wie der Client), kein 400. Keine Migration: `EXPLAIN ANALYZE` bei 1.000 Karten liegt bei unter 1 ms über den vorhandenen Index `custom_field_value_fieldId_idx`; ein Index `(field_id, value)` wird erst bei Bedarf ergänzt. Die Web-App schickt nur **nicht negierte** Label- und Feldfilter an den Server; Spalte, Negation, Fälligkeit und Suche bleiben clientseitig, der Client-Matcher prüft auch die Serverzeilen nach. Mit aktivem Serverfilter hält der Cache `["tasks", projectId]` nur die Treffer: Drag-and-drop hängt eine Karte ans Ende der Zielspalte (ohne `expectedTasks`), Umsortieren in der Spalte ist dann aus; die Gesamtzahl in der Toolbar wird ausgeblendet.

**Dateien:**
- API: `apps/api/src/task/task-filter-params.ts` (neu), `task/schema.ts` (`listTasksQuery`), `task/controllers/get-tasks.ts` (`labels`, `customFields`, `customFieldConditions`); `apps/docs/openapi.json`
- Web: `apps/web/src/lib/task-filters/server-filters.ts`, `lib/board-server-filters.ts` (neu); `fetchers/task/get-tasks.ts`, `hooks/queries/task/use-get-tasks.ts` (`serverFilters`), `routes/.../board.tsx`, `components/project/toolbar/{use-project-task-view.ts,task-count.tsx}`, `components/kanban-board/index.tsx` (`serverFiltered`); Matcher-Korrektur `hooks/use-task-filters-with-labels-support.ts` (projektweite Werte statt Karten-Cache), `lib/task-filters/task-matches-filters.ts` (Multiselect), `components/custom-fields/card-fields.ts` (`valuesByTask` exportiert), `hooks/queries/custom-field/use-get-custom-field-values-by-project.ts` (`enabled`); gelöscht: `hooks/{queries,mutations}/custom-field/use-get-all-custom-field-values-by-project.ts`
- MCP: `packages/mcp/src/tools/register.ts` (`list_tasks`: `labels`, `customFields`)
- Dev-Seed: `apps/api/scripts/seed-cards.ts`, `scripts/seed-cards/{generate-cards,insert-cards}.ts`, Skript `db:seed:cards`; `scripts/seed-dev.ts` (Import `insert-project` repariert)

**Beim Sync beachten:**
- `get-tasks.ts`, `task/schema.ts`, `use-get-tasks.ts` und `kanban-board/index.tsx` ändert Upstream häufig; die Fork-Stellen sind mit `Pegasus fork (PEGA-89)` kommentiert und klein. `task-list-filters.test.ts` schlägt fehl, wenn der Filter oder der Zeilenfilter darin verloren geht.
- Der Query-Key `["tasks", projectId]` bleibt unverändert, weil `use-project-websocket.ts` und das Drag-and-drop ihn direkt patchen. Die Serverfilter liegen in einer Registry je QueryClient (`board-server-filters.ts`), damit auch andere Beobachter des Keys (Task-Crumb, Relationen) mit denselben Filtern laden.
- Upstream-Fehler, die hier mitbehoben sind und beim Sync nicht zurückkommen dürfen: der Feldfilter las Werte aus dem Karten-Cache `["custom-field-values", taskId]` (nur geöffnete Karten) und verglich Multiselect-Werte als ganzen JSON-String.
- Bekommt Upstream eigene Filterparameter in `listTasksQuery`, die Fork-Parameter darauf abbilden statt beide zu behalten.

### PEGA-90 — Feldänderungen live und deutsche Feldverwaltung

**Zweck:** Ändert ein anderer Nutzer (oder der Hub per API-Key) einen Feldwert oder die Felddefinitionen, sehen offene Boards und Kartenansichten das ohne Neuladen; die Feldverwaltung ist vollständig deutsch, auch die Fehlermeldungen der API ([Review](review/2026-10-live-updates-deutsch.md)). Upstream veröffentlicht für Custom Fields keine Ereignisse und liefert Fehlertexte nur englisch (geprüft 2026-10-22, `upstream/main` @ `2847dbd8`).

**Regel:** Feldwert setzen/leeren → `task.updated` mit `customFieldsChanged: true`; Feld anlegen, bearbeiten, umsortieren, löschen → `project.updated` mit `customFieldsChanged: true`; Karte mit Feldwerten anlegen → `task.created` mit demselben Hinweis. Der Hinweis läuft wie `linksChanged` durch `broadcastToProject` (bleibt beim Bündeln erhalten) und den Redis-Adapter. Nur Nachrichten **mit** Hinweis invalidieren in der Web-App die Feld-Caches (`["custom-fields", p]`, `["custom-field-values", …]`, `["custom-field-filter-values", p]`); gewöhnliche Karten-Updates laden keine Feldwerte nach. Bei aktivem Serverfilter auf Feldern (PEGA-89) lädt das Board zusätzlich `["tasks", p]` neu. Die WebSocket-Nachricht trägt weiter nur IDs, keine Werte.
Fehler der Feldverwaltung tragen stabile Codes (`ApiError`, englische `message` unverändert): `CUSTOM_FIELD_NAME_REQUIRED`, `_DEFAULT_REQUIRED`, `_INVALID_DEFAULT`, `_TOO_FEW_OPTIONS`, `_TYPE_LOCKED`, `_OPTIONS_NOT_ALLOWED`, `_OPTION_IN_USE`, `_TASKS_HAVE_MULTIPLE_OPTIONS`. Die Web-App übersetzt diese Codes und `NOT_FOUND`; alles andere zeigt den übersetzten Standardtext des Dialogs, nie den englischen API-Text.

**Dateien:**
- API: `apps/api/src/custom-field/field-error.ts` (neu), `assert-valid-definition.ts`, `resolve-field-update.ts`, `plan-choice-value-changes.ts`, `controllers/{create,update,delete,reorder}-custom-field.ts`, `controllers/set-custom-field-value.ts`, `task/controllers/create-task.ts`; `ws/index.ts`, `ws/broadcast-adapter.ts`, `ws/redis-broadcast-adapter.ts`
- Web: `hooks/invalidate-custom-field-caches.ts` (neu), `hooks/use-project-websocket.ts`; `components/project/custom-fields/custom-field-error-key.ts` (neu), `custom-field-list.tsx`, `field-dialog/custom-field-dialog.tsx`; `components/project/task-filters/use-filter-subjects.tsx` („Aktiviert“/„Deaktiviert“ statt „True“/„False“); `components/common/date-picker/day-picker-text.ts` (neu), `month-grid.tsx` (Monats- und Wochentagsnamen per `Intl` in der UI-Sprache, gilt für alle Datumsauswahlen)
- i18n: `settings.customFields.errors.*`, `tasks.calendar.monthNavigation` (en-US, de-DE; übrige Locales englischer Fallback), de-DE `settings.customFields.types.{dropdown,multiselect}` = „Auswahl“/„Mehrfachauswahl“, `mobile.projectSettings.{checkbox,dropdown}` = „Kontrollkästchen“/„Auswahl“; `i18n/schema.json` von Hand ergänzt

**Beim Sync beachten:**
- Veröffentlicht Upstream selbst Ereignisse für Custom Fields, die Fork-Aufrufe entfernen statt doppelt zu senden; `custom-field-live-updates.test.ts` erwartet genau ein Ereignis je Änderung.
- `ws/index.ts`, `broadcast-adapter.ts`, `redis-broadcast-adapter.ts` und `use-project-websocket.ts` ändert Upstream häufig. Der Hinweis muss an allen vier Stellen erhalten bleiben (Valibot im Redis-Adapter verwirft unbekannte Felder); `broadcast.test.ts` und `redis-link-refresh.test.ts` melden den Verlust.
- Neue Upstream-Fehler in `custom-field/*` bekommen nur dann einen deutschen Text, wenn sie über `fieldError()` einen Code tragen und der Code in `custom-field-error-key.ts` und `settings.customFields.errors` steht.
- `en-US.json`/`de-DE.json`: Upstream-Änderungen an `settings.customFields.types` gegen die deutschen Typnamen prüfen; `custom-field-translations.test.ts` schlägt fehl, wenn ein Text der Feldverwaltung englisch bleibt.

### PEGA-84 — Board per Skript einrichten

**Zweck:** Das Board „Bewerber-Pool“ ist auf jeder Umgebung gleich und lässt sich reproduzierbar aufbauen: die Prozessspalten (seit PEGA-170 vierzehn in vier Phasen), Workspace-Labels für Quelle, Paket und Prüfung sowie die Grundfelder ([Review](review/2026-10-board-einrichtung.md), [Betriebshandbuch](board-einrichtung.md)). Das ist Konfiguration über die REST-API; der Code der Anwendung ändert sich nicht. Den Vertriebsweg bildet seit PEGA-142 der Workspace des Key Accounts ab, nicht ein Feld oder Label.

**Dateien:** `scripts/board-setup/` (neu; Vorgabe `board.json`, Einstieg `setup-board.mjs`, Planer und Tests), Kommando `board:setup` in `package.json`

**Beim Sync beachten:**
- `scripts/board-setup/to-slug.mjs` kopiert `apps/api/src/column/to-slug.ts`, und `DEFAULT_COLUMN_SLUGS` in `plan-columns.mjs` spiegelt `DEFAULT_PROJECT_COLUMNS` in `apps/api/src/project/controllers/insert-project.ts`. Ändert Upstream eines davon, die Kopie nachziehen.
- Nach jedem Sync einen Probelauf (`--dry-run`) gegen die Testumgebung ausführen. Er muss „keine Änderungen“ ergeben. Geänderte Pfade oder Felder der API für Projekte, Spalten, Labels oder Custom Fields fallen dort auf.

### PEGA-86 — Custom-Field-Typen `email` und `phone`

**Zweck:** Telefonnummer und E-Mail-Adresse an der Karte als Links, die mit einem Tipp den Anruf oder die Mail starten, vor allem am Smartphone ([Review](review/2026-10-custom-field-kontakt.md)). Upstream hat keine solchen Typen (geprüft 2026-10-28: Enum in `upstream/main` @ `49d72079`).

**Regeln:**
- `email`: getrimmt; genau ein `@`, Domain mit Punkt, höchstens 254 Zeichen, keine Leerzeichen und keines der Zeichen `? # & , ; : < > " ( ) [ ] \`. So kann ein gespeicherter Wert keine weiteren Empfänger oder Kopfzeilen in den `mailto:`-Link schmuggeln. Link `mailto:<wert>`.
- `phone`: getrimmt, innere Leerzeichen zusammengefasst, sonst wie eingegeben gespeichert. Erlaubt sind Ziffern, Leerzeichen, `+` am Anfang und `( ) / . -`, 5 bis 15 Ziffern (ohne führendes `00` und ohne `(0)` nach der Ländervorwahl). Link `tel:` mit `+` und Ziffern; aus `+49 (0) 170 123-4567` wird `tel:+491701234567`.
- Die Prüfung ist streng, auch beim Anlegen einer Karte über die API (Hub-Import): ungültige Werte geben 400.
- Text, E-Mail und Telefon lassen sich ineinander umwandeln. Der Wechsel zu E-Mail oder Telefon schreibt alle Kartenwerte in die gespeicherte Form um. Er scheitert mit `CUSTOM_FIELD_TASKS_HAVE_INVALID_VALUES`, solange ein Wert nicht passt. Der Wechsel zurück zu Text ist immer möglich.
- Keine Migration: `custom_field_definition.type` ist `text`.

**Dateien:**
- API: `apps/api/src/custom-field/{email-value,phone-value,stored-value,text-types,plan-text-value-changes}.ts` (neu; `toStoredCustomFieldValue` ist aus `url-value.ts` nach `stored-value.ts` gewandert), `schema.ts` (Enum, OpenAPI), `field-error.ts` (Code), `resolve-field-update.ts` (Typwechsel, Standardwert), `assert-valid-definition.ts`, `controllers/{set-custom-field-value,update-custom-field,create-custom-field}.ts`, `task/validate-task-fields.ts`, `task/controllers/create-task.ts`, `database/schema.ts` (Kommentar); `apps/docs/openapi.json`
- Web: `apps/web/src/components/custom-fields/{custom-field-email,custom-field-phone,custom-field-href,text-field-inputs}.ts` (neu); `custom-field-link.tsx` (nimmt jetzt den Typ, nur `url` öffnet einen neuen Tab), `custom-field-open-link.tsx` (Symbol je Typ), `card-field-{rows,chip,overflow-row}.tsx`, `custom-field-{row,chip,popover,icon}.tsx/ts`, `text-field-editor.tsx`; `project/custom-fields/{types,field-kinds,describe-custom-field,custom-field-error-key}.ts`, `field-dialog/{custom-field-dialog,field-type-picker,field-default-input}.tsx`, `field-dialog/field-form.ts`
- Mobile: `apps/mobile/src/features/project/{field-form,use-field-types,field-keyboard}.ts` (`field-keyboard.ts` neu), `custom-field-default-input.tsx`, `features/task/sections.tsx`, `app/(app)/task/new.tsx`. Typunterstützung und passende Tastatur; Links zeigt die App für diese Typen nicht.
- CLI/MCP: `packages/cli/src/fields/field-types.ts` (Aliasse `mail`, `e-mail`, `tel`, `telephone`), `commands/field/create.ts`, `apps/docs/cli/reference.mdx`; `packages/mcp/src/tools/register.ts`
- Board-Skript: `scripts/board-setup/board.json` (Telefon `phone`, E-Mail `email`), `plan-fields.mjs` (Typwechsel innerhalb Text/E-Mail/Telefon), `docs/board-einrichtung.md`
- i18n: `settings.customFields.types.{email,phone}`, `settings.customFields.typeSwitchText`, `settings.customFields.issues.{invalidEmail,invalidPhone}`, `settings.customFields.errors.tasksHaveInvalidValues`, geänderter Text `settings.customFields.errors.typeLocked`, `tasks.customFields.{invalidEmail,invalidPhone,sendEmail,callNumber}`, `mobile.projectSettings.{email,phone}` (en-US, de-DE übersetzt, übrige Locales mit englischem Fallback), `i18n/schema.json` von Hand ergänzt

**Beim Sync beachten:**
- Die Regeln existieren zweimal (API `email-value.ts`/`phone-value.ts`, Web `custom-field-email.ts`/`custom-field-phone.ts`) und müssen gleich bleiben. Mobile prüft nur grob, die API entscheidet.
- Upstream-Stellen, die über Feldtypen verzweigen, brauchen `email` und `phone`. Für Links gibt es jetzt einen Einstieg: `isLinkFieldType` und `customFieldHref` in `custom-field-href.ts`. Neue `field.type === "url"`-Abfragen aus Upstream dorthin umleiten.
- Ändert Upstream `resolveType` in `resolve-field-update.ts` oder die Wertumschreibung in `update-custom-field.ts`, die Gruppe Text/E-Mail/Telefon (`text-types.ts`, `plan-text-value-changes.ts`) erhalten.

### PEGA-141 — Sichtbereich aus dem Hub

**Zweck:** Jeder Nutzer sieht genau die Leads seiner Einheiten und der Einheiten darunter ([Review](review/2026-11-sichtbereich-einheiten.md)). Der Pegasus-Hub kennt Hierarchie und Zuordnungen und überträgt je Nutzer (E-Mail) Modus und flache Einheitenmenge sowie je Karte die Einheit; der Fork speichert und filtert nur. Kaneo-Teams werden nicht benutzt.

**Regel:** Seit PEGA-142 gilt der Sichtbereich für jedes Mitglied eines vom Hub verwalteten Workspaces (siehe [PEGA-142](#pega-142--rechte-je-nutzer-aus-dem-hub)), nicht mehr je Rolle. `all` sieht alles, `units` nur Karten mit Einheit in der Menge (ohne Einheit: unsichtbar), `assigned` nur zugewiesene, ohne Stand nichts. „Nur zugewiesene“ schränkt zusätzlich ein (beides muss zulassen). Verdeckt = 404.

**Dateien:**
- Migration `apps/api/drizzle/0066_pegasus_visibility.sql` (idempotent; die Spalte `workspace_role.hub_scoped` entfernt 0067 wieder), `database/schema.ts` (`pegasusUserScopeTable`, `pegasusUserScopeUnitTable`, `pegasusTaskUnitTable`), `database/index.ts`
- Neu: `apps/api/src/task-scope/` (`composeTaskScope`, `loadTaskScopes`, `resolveTaskScope`, `taskVisibleCondition`/`tasksVisibleCondition`, `assertTasksVisible`, `assertAssetTaskVisible`, `denyTaskScoped`), `apps/api/src/pegasus-visibility/` (Push-API, eingehängt in `index.ts` unter `/pegasus-visibility`); gelöscht: `utils/assigned-only-scope.ts`
- Durchsetzung (Einzeiler bzw. ein Parameter `scope`): `utils/workspace-access-middleware.ts` (Lookup liefert Karten-ID), `task/index.ts`, `task/controllers/{get-tasks,get-task,export-tasks,get-task-by-ticket-id,reorder-tasks}.ts`, `task/{description-pages,get-subtask-counts}.ts`, `search/{index.ts,controllers/global-search.ts}`, `activity/{index.ts,controllers/get-workspace-activities.ts}`, `custom-field/{index.ts,controllers/get-custom-field-values-by-project.ts,controllers/get-custom-field-filter-values.ts}`, `project/{index.ts,controllers/get-projects.ts}`, `label/{index.ts,controllers/{get-labels-by-workspace-id,create-label,assign-label-to-task}.ts}`, `task-relation/{index.ts,controllers/{get,create,delete}-task-relation.ts}`, `notification/resource-access.ts` + `notification/controllers/{get-notifications,set-notification-read,delete-notification,clear-notifications,mark-all-notifications-as-read}.ts`, `notification-preferences/{delivery,resolve-email-task}.ts`, `utils/authorize-asset-access.ts`, `calendar-feed/index.ts`, `integration-sync/index.ts`
- Rollenfeld `hubScoped` und i18n `…task.view_hub_scoped`: mit PEGA-142 wieder entfernt; `apps/docs/openapi.json`

**Beim Sync beachten:**
- **Neue Upstream-Lesepfade für Karten gegen `taskVisibleCondition` prüfen.** Wo Upstream `projectAccessCondition(...)` ergänzt, gehört meist auch `taskVisibleCondition(scope)` (ein Workspace, `resolveTaskScope(c)`) bzw. `tasksVisibleCondition(await loadTaskScopes(userId))` (mehrere Workspaces) dazu. Lücken in `task-view-hub-scope.test.ts` absichern.
- `notificationResourceAccess` hat den **Pflicht**-Parameter `taskScopes`; neue Upstream-Aufrufer meldet TypeScript.
- Migration wie bei PEGA-6 hinter die letzte Upstream-Migration nummerieren (zuletzt 0066).
- Die Pfade unter `/pegasus-visibility` und ihre Operation-IDs sind ein Vertrag mit dem Hub (`kaneo:spec:pull`); nicht umbenennen.

### PEGA-142 — Rechte je Nutzer aus dem Hub

**Zweck:** Der Pegasus-Hub ist Rechteinhaber (SPEC Rollen & Rechte §5, §6). Er überträgt je Nutzer die effektiven Rechte zusammen mit dem Sichtbereich; das Board speichert sie je Workspace und setzt sie für jedes Mitglied durch ([Review](review/2026-11-rechte-aus-dem-hub.md)). Kaneo-Rollen regeln nur noch Board-Eigenes (Labels, Spalten, Felder, Workspace-Einstellungen).

**Regel:**
- Ein Workspace gilt als vom Hub verwaltet, sobald `PUT …/users` einmal lief (Zeile in `pegasus_workspace`).
- Dort ist jedes Mitglied Hub-gesteuert, außer `owner`, Instanz-Admins und dem Konto mit der Nutzer-ID aus `PEGASUS_HUB_USER_ID`.
- Nur diese drei dürfen die Push-API eines verwalteten Workspaces nutzen (sonst 403 `HUB_GOVERNED`), damit ein Hub-gesteuerter Admin seinen eigenen Stand nicht umschreibt.
- Für Hub-gesteuerte Mitglieder ersetzt ein Hub-Recht auf Karten-Routen die Kaneo-Rollenprüfung (Tabelle im Review). Ein API-Key-Scope schränkt weiter ein.
- Fehlt das Recht: 403 `MISSING_PERMISSION` mit `missingPermissions: ["LEAD_…"]`. Ohne Eintrag im Stand: nichts sehen, nichts dürfen.
- Workspaces ohne Push verhalten sich wie Kaneo.

**Dateien:**
- Migration `apps/api/drizzle/0067_pegasus_permissions.sql` (idempotent: `pegasus_workspace`, `pegasus_user_scope.permissions`, Workspaces mit Ständen aus PEGA-141 als verwaltet eintragen, `DROP COLUMN IF EXISTS workspace_role.hub_scoped`), `database/schema.ts`, `database/index.ts`
- Neu:
  - `packages/permissions/src/hub-permissions.ts` (`HUB_PERMISSIONS`, `capabilityHubPermission`), neue Capabilities `moveTasks`, `labelTasks`, `exportTasks`, `viewReports` in `capabilities.ts`
  - `apps/api/src/utils/require-hub-permission.ts` (`requireLeadPermission`, `requireHubPermission`, `requireHubPermissionWhen`, `hubAllows`, `hasLeadPermission`), `apps/api/src/utils/read-json-body.ts`
  - `apps/api/src/task-scope/is-hub-system-account.ts`
  - `apps/api/src/utils/deny-hub-governed.ts` (bis PEGA-80 unter `pegasus-visibility/`)
- `task-scope/`:
  - `loadMemberAccess` (Sicht und Rechte), `resolveMemberAccess`
  - `TaskScope` mit UND-Semantik (`assignedOnly`, `unitIds | null`), `composeTaskScope` mit `managed`
- Push-API `pegasus-visibility/{index,schema,controllers/*}.ts`: Pflichtfeld `permissions`, Marker `pegasus_workspace`, `denyHubGoverned` an allen vier Routen
- Gates (Einzeiler `requireLeadPermission(...)` statt `requireWorkspacePermission(...)`):
  - `task/index.ts`, `task/controllers/require-task-permission.ts` (Bulk, Assignee, neu `requireTaskStatusPermission`, `requireReorderPermission`, `requireCreateAssigneePermission`, `requireImportAssigneePermission`)
  - `comment/index.ts`, `activity/index.ts`, `custom-field/index.ts`, `label/index.ts` (attach/detach; `createLabel` mit `taskId` über `requireHubPermissionWhen`), `task-relation/index.ts`, `time-entry/index.ts`, `external-link/index.ts`
  - Issue-Import `{github,gitea,gitlab}-integration/index.ts` (`LEAD_CREATE` und `LEAD_EDIT`), `integration-sync/index.ts` (Resume, `LEAD_EDIT`)
  - Statistik `project/{index.ts,response.ts,controllers/get-projects.ts}` (`statistics` optional, fehlt ohne `REPORTING_VIEW`)
  - Capabilities `workspace/{index.ts,controllers/get-my-capabilities.ts}`
  - `utils/require-workspace-permission.ts` exportiert `assertApiKeyScope`, `apiKeyAllows`
- Rollenfeld `hubScoped` entfernt: `auth.ts`, `auth-openapi.ts`, `packages/permissions` (`roleRestrictions`), Web `lib/auth-client.ts`, `hooks/{mutations,queries}/workspace/use-*-workspace-role(s).ts`, `routes/.../settings/workspace/roles.tsx` (statt Schalter Hinweis `settings.workspaceRoles.hubManagedHint`)
- Web-Gates über Capabilities:
  - `use-workspace-permission.ts` (`canMoveTasks`, `canLabelTasks`, `canExportTasks`, `canViewReports`)
  - `kanban-board/{index,column/column-header,task-card-context-menu/task-card-context-menu-content}.tsx`, `list-view/{index,list-column-section}.tsx`, `bulk-selection/{bulk-bar.tsx,use-bulk-actions.ts}`; „Alle archivieren“ über die Status-Route (`useUpdateTaskStatus`)
  - `shared/modals/create-task-modal.tsx` (Assignee- und Label-Auswahl `hidden` ohne `canAssignTasks` bzw. `canLabelTasks`)
  - `task/{task-status-popover,subtask-status-popover,task-move-popover,task-labels-popover,task-activity,task-shortcuts}.tsx`, `activity/comment-card.tsx`, `project/task-view-keys/use-task-action-shortcuts.ts`, `project/tasks-import-export/export-tasks-row.tsx`, `project-progress.tsx`
  - Statistik optional: `nav-projects.tsx`, `home/home-projects.tsx`, `routes/.../$workspaceId/projects.tsx` mit neuem `project-statistics-cells.tsx`; Mobile `features/home/home-tab.tsx`
- i18n `settings.workspaceRoles.hubManagedHint` (en-US, de-DE; übrige Locales englisch), `view_hub_scoped` entfernt, `i18n/schema.json` von Hand; `.env.sample`; `apps/docs/openapi.json`

**Beim Sync beachten:**
- **Pfade und Operation-IDs der Push-API sind Vertrag mit dem Hub** (`replacePegasusUserScopes`, `getPegasusUserScopes`, `setPegasusTaskUnit`, `setPegasusTaskUnits`, `kaneo:spec:pull`). Ebenso die Rechte-Schlüssel (UPPER_SNAKE, unverändert vom Hub). Nicht umbenennen.
- **Neue Upstream-Schreibrouten auf Karten** (alles mit `requireWorkspacePermission({ task: [...] })` oder `{ label: ["update"] }` an einer Karte): auf `requireLeadPermission(<Kaneo-Map>, "<Hub-Recht>")` umstellen und eine Zeile in `ACTIONS` von `hub-permissions.test.ts` ergänzen. Sonst entscheidet für Hub-gesteuerte Mitglieder wieder die Kaneo-Rolle.
- **Felder im Body, die eine zweite Karten-Aktion auslösen** (Bearbeiter beim Anlegen, `taskId` beim Label-Anlegen): `requireHubPermissionWhen(...)` ergänzen und in `hub-permissions-side-routes.test.ts` absichern.
- Neue In-Handler-Prüfungen `hasWorkspacePermission(c, { task: [...] })` auf `hasLeadPermission` umstellen.
- Neue Upstream-Capabilities für Karten-Aktionen in `capabilityHubPermission` eintragen.
- Migration hinter die letzte Upstream-Migration nummerieren (zuletzt 0069, PEGA-170; 0068 ist die Fork-Migration aus PR #20).

### PEGA-143 — Bearbeiter: zurückgeben und Mitgliedschaft aus dem Hub

**Zweck:** Bearbeiter (Selbstständige ohne LDAP-Konto, Basisrolle PROCESSOR im Hub) bekommen einzelne Karten zugewiesen, sehen nur diese (Modus `assigned`) und geben sie an ihre Einheit zurück. Ihr Konto legt der Hub in Keycloak an; ins Board kommen sie ohne Einladung.

**Regel:**
- `PUT /task/return/{id}` (`returnTask`, ohne Body) entfernt die Zuweisung, nur durch den aktuellen Bearbeiter der Karte (sonst 403 `NOT_TASK_ASSIGNEE`). Hub-gesteuerte Mitglieder brauchen `LEAD_RETURN_OR_REPORT` (sonst 403 `MISSING_PERMISSION`), alle anderen `task:update`: Wer die Karte hält, gibt sie zurück, ohne jemand anderem etwas zuzuweisen, deshalb nicht `task:assign`. Unbekannte oder verdeckte Karte: 404.
- Die Rückgabe ist eine gewöhnliche Entzuweisung mit dem Bearbeiter als Akteur (`updateTaskAssignee` mit `onlyIfAssignedTo`, Prüfung unter der Zeilensperre): Aktivität `unassigned`, Ereignis und Webhook `task.unassigned`, Live-Update. Der Hub liest eine Entzuweisung durch den Bearbeiter selbst als „zurückgegeben“.
- Mitgliedschaft: Wer im Stand eines Workspaces steht (`pegasus_user_scope.email`) und ein Konto mit **bestätigter** E-Mail hat, wird Mitglied mit der lesenden Workspace-Rolle `pegasus` („Pegasus“, `HUB_MEMBER_ROLE` in `add-hub-members.ts`), ohne Einladung. Hat der Workspace die Rolle nicht, wird niemand aufgenommen (Warnung im Log), statt auf `member` auszuweichen, das Projekte und Labels anlegen darf. Abgleich in Kleinbuchstaben. Zeitpunkte: beim Push (`replace-user-scopes.ts`, in derselben Transaktion) und bei Anlage des Kontos bzw. jeder Anmeldung (Better-Auth `databaseHooks.user.create.after` und `session.create.after` in `auth.ts`). Bestehende Mitglieder und ihre Rolle bleiben unverändert; entfernt wird niemand (wer nicht im Stand steht, sieht und darf ohnehin nichts). Ein Mitglied, das ein Admin entfernt, aber der Hub weiter überträgt, ist nach dem nächsten Push wieder da.
- Bestätigt sind Konten aus Keycloak: Der Provider `custom` (genericOAuth) übernimmt `email_verified` aus ID-Token bzw. Userinfo. Selbst registrierte Konten sind unbestätigt und bekommen keine Mitgliedschaft.

**Dateien:**
- API: `task/controllers/return-task.ts` (neu), `task/controllers/update-task-assignee.ts` (`onlyIfAssignedTo`), `task/index.ts` (Route); `pegasus-visibility/{add-hub-members,join-hub-workspaces}.ts` (neu), `pegasus-visibility/controllers/replace-user-scopes.ts` (Workspace-Sperre zuerst, dann `addHubMembers`), `pegasus-visibility/index.ts` (Beschreibung), `auth.ts` (zwei Hooks); `packages/permissions/src/{capabilities,hub-permissions}.ts` (`returnTasks` → `LEAD_RETURN_OR_REPORT`); `apps/docs/openapi.json`
- Web: `components/task/task-return-button.tsx` (neu), `fetchers/task/return-task.ts` (neu), `hooks/mutations/task/use-return-task.ts` (neu), `hooks/use-workspace-permission.ts` (`canReturnTasks`), `task/properties/{properties-rail,property-chips}.tsx` (`onReturned`), `task/task-details-sheet.tsx` (schließt), `routes/.../task/$taskId_.tsx` (zurück zum Board)
- i18n `tasks.return.{action,success,error}` (en-US, de-DE „An Einheit zurückgeben“; übrige Locales englisch), `i18n/schema.json` von Hand

**Beim Sync beachten:**
- Pfad und Operation-ID `returnTask` sind Vertrag mit dem Hub.
- Ändert Upstream `update-task-assignee.ts` oder `publishTaskMutation`, muss die Rückgabe weiter `task.unassigned` mit dem Bearbeiter als `userId` senden; `hub-return-task.test.ts` prüft das.
- Ändert Upstream die `databaseHooks` in `auth.ts`, die beiden Aufrufe von `joinHubWorkspaces` erhalten; `hub-membership.test.ts` schlägt sonst fehl.
- `workspace_member` hat keinen Unique-Index auf `(workspace_id, user_id)`; doppelte Mitgliedschaften verhindert die Workspace-Sperre (`admin/lock-workspace.ts`). Neue Upstream-Pfade, die Mitglieder anlegen, sollten sie ebenfalls nehmen.

### PEGA-170 — Spalten und Phasen nach Fachkonzept

**Zweck:** Der Stand eines Bewerbers ist an der Spalte ablesbar ([Review](review/2026-11-spalten-phasen.md), [Betriebshandbuch](board-einrichtung.md)). Grundlage ist das Fachkonzept von Alexander Sitzmann vom 23.11.2026; es ersetzt den Spaltensatz aus 18052 und weicht bewusst von Feinkonzept Kap. 7 ab. Gegenstück im Hub: Branch `PEGA-170` (`bewerber-pool.template.ts`).

**Regel:**
- Jede Spalte hat `phase` (Text oder `null`) und `isLocked` (Standard `false`). `POST /column/{projectId}` und `PUT /column/{id}` nehmen beide optional an (leerer Text = keine Phase), `GET /column/{projectId}`, jede Spaltenantwort und die Board-Spalten (`GET /task/tasks/{projectId}`) geben beide zurück. Bestehende Spalten bleiben ohne Phase und ungesperrt; das Board-Skript setzt sie.
- Board und Liste fassen benachbarte Spalten derselben Phase unter einer Überschrift zusammen. Phase und Sperre ändert, wer Spalten bearbeiten darf (`project:update`), in den Spalteneinstellungen.
- Gesperrt: Kein Mitglied verschiebt eine Karte in eine gesperrte Spalte hinein oder aus ihr heraus (403 `COLUMN_LOCKED`, Meldung nennt die Spalte). Geprüft auf `PUT /task/status/{id}`, `PUT /task/{id}`, `POST /task/reorder` (nur Spaltenwechsel), Bulk `updateStatus`, `PUT /task/move/{id}` (Quelle oder Ziel), `POST /task/{projectId}`, `POST /task/import/{projectId}` und `POST /task/duplicate/{id}`, jeweils nach der bestehenden Rechteprüfung. Archivieren und „Geplant“ (virtuelle Status) sind kein Verschieben.
- Ausgenommen sind Workspace-Owner, Instanz-Admins und das Systemkonto aus `PEGASUS_HUB_USER_ID`, in **jedem** Workspace (eigene Prüfung `isColumnLockExempt`, nicht `resolveMemberAccess`, das Mitglieder nicht Hub-verwalteter Workspaces ebenfalls als ungeregelt meldet). Webhooks bleiben unverändert: ein Spaltenwechsel durch das Systemkonto geht wie bisher als `task.status_changed` hinaus.
- Die Oberfläche spart nur den Fehlversuch: Karte in gesperrter Spalte nicht greifbar, gesperrte Spalte kein Ablageziel, Statusauswahl und Kontextmenü bieten sie nicht an, kein „+“ in gesperrten Spalten, Schloss am Spaltenkopf. Ausnahme im Web: Owner und Instanz-Admins (`useCanMoveLockedColumns`).
- Board-Skript: `board.json` mit 14 Spalten, `phase`, `isLocked`, `fixedName` (Eingang, Rückgabe an Pegasus) und `retiredColumns`. `planColumns` benennt nur `fixedName`-Spalten zurück, setzt Phase und Sperre nur bei Spalten ohne Phase und entfernt entfallene Spalten, solange sie leer sind.

**Dateien:**
- Migration `apps/api/drizzle/0069_column_phase_lock.sql` (idempotent), `meta/0069_snapshot.json`, `_journal.json`; `apps/api/src/database/schema.ts` (`columnTable.phase`, `isLocked`)
- API Spalten: `column/{schema,response,index}.ts`, `column/controllers/{create,update}-column.ts`
- API Board: `task/response.ts` (`boardColumnSchema`), `task/controllers/get-tasks.ts` (Mapping)
- API Sperre: `column-lock/{assert-columns-unlocked,column-change,is-column-lock-exempt}.ts` (neu), `task/controllers/require-column-unlocked.ts` (neu), `task/controllers/move-task.ts` (`resolveDestinationStatus` exportiert), `task/index.ts` (Middleware in acht Routen, 403-Beschreibungen); `apps/docs/openapi.json`
- Web: `types/project/index.ts` (`phase`/`isLocked` optional für alte Caches), `hooks/use-can-move-locked-columns.ts` (neu), `kanban-board/{group-columns-by-phase,is-locked-move,phase-group}.ts(x)` (neu), `kanban-board/index.tsx`, `kanban-board/column/{column-header,column-lock-hint}.tsx`, `list-view/{index,list-column-section}.tsx`, `common/option-menu/{option-menu,option-menu-item}.ts(x)` (`disabled`), `task/menus/status-menu-options.ts`, `task/{task-status-popover,subtask-status-popover,task-move-popover}.tsx`, `task-card-context-menu/task-card-context-menu-content.tsx`, `project/columns/{column-list,column-row,add-column-row,column-list-header,column-phase-input}.tsx`, `fetchers/column/{create,update}-column.ts`, `hooks/mutations/column/use-{create,update}-column.ts`
- i18n `settings.columnEditor.{phaseHeader,phasePlaceholder,phaseAria,lockedHeader,markLockedAria,newColumnPhaseAria,newColumnLockedAria}`, `tasks.kanban.lockedHint` (en-US, de-DE; übrige Locales englisch), `i18n/schema.json` von Hand
- Board-Skript `scripts/board-setup/{board.json,plan-columns.mjs,setup-board.mjs}`; Doku `docs/board-einrichtung.md`

**Beim Sync beachten:**
- `phase`, `isLocked` und `COLUMN_LOCKED` sind Vertrag mit dem Hub, ebenso die Namen „Eingang“ und „Rückgabe an Pegasus“.
- Migration hinter die letzte Upstream-Migration nummerieren; Upstream ist bereits bei 0073 (Stand 15.11.2026), der Fork bei 0069.
- Neue Upstream-Routen, die `task.status` oder `task.columnId` setzen, brauchen eine Middleware aus `require-column-unlocked.ts`; `column-lock.test.ts` um den Pfad ergänzen. Integrationen (GitHub, GitLab, Gitea, Sync, Workflow-Regeln) verschieben über eigene Pfade ohne Sperre; im Bewerber-Pool sind sie nicht verbunden.
- Ändert Upstream `boardColumnSchema`, das Mapping in `get-tasks.ts`, die Spaltenzeile der Einstellungen, `option-menu.tsx` oder `statusMenuOptions`, die Fork-Felder bzw. `disabled` erhalten.
- Konfliktpotenzial mittel: `task/index.ts` (Middleware-Ketten) und `kanban-board/index.tsx` (Spaltenschleife jetzt in `PhaseGroup`) sind upstream oft geändert.

**Folgearbeit:**
- Bulk-Leiste: Statuswechsel bietet gesperrte Spalten weiter an; die API lehnt ab, die Leiste zeigt den Fehler.
- Mobile-App: kennt Phase und Sperre nicht; Verschieben aus gesperrten Spalten scheitert mit der Meldung der API.
- Listenansicht: Zeilen in gesperrten Spalten bleiben greifbar, der Ablageversuch wird verworfen.

### PEGA-66 — Frist je Lead sichtbar (Board-Teil)

**Zweck:** Der Hub führt die 48-Stunden-Frist eines Leads in „Unbearbeitet“. Er setzt beim Eintritt die Fälligkeit der Karte (`task.dueDate` = Eintritt + 48 h), mailt Beginn, Erinnerung und Fristende und entfernt die Fälligkeit, wenn die Karte die Spalte verlässt. Das Board zeigt die Frist nur an; eine eigene Fristlogik hat es nicht ([Review](review/2026-11-fristen.md)).

**Regel:**
- Überfällig heißt: `dueDate` liegt vor jetzt, die Spalte ist nicht `isFinal`, die Karte ist nicht archiviert. Maßgeblich ist der Zeitpunkt, nicht der Kalendertag wie bei Upstream (`getRelativeDueDate`, „Meine Aufgaben“, Mobile). Eine von Hand auf „heute“ (lokal 00:00) datierte Karte ist deshalb den ganzen Tag rot, der Chip-Text bleibt „Heute“. Eine Regel für Karte, Liste, Chip und Filter: `apps/web/src/lib/is-task-overdue.ts`; in der API dieselben Bedingungen in SQL.
- Kanban-Karte und Listen-/Backlog-Zeile sind als Ganzes markiert (linker roter Rand, Tönung, für Screenreader „Überfällig“). Eine gemeinsame Minutenuhr (`lib/minute-clock.ts`, läuft nur, solange eine Karte mit laufender Fälligkeit sichtbar ist) färbt eine offene Karte rot, sobald die Frist abläuft; über `useSyncExternalStore` rendert nur die Karte neu, deren Zustand kippt.
- Filter „Überfällig“ (`overdue`) unter „Fälligkeit“, mit Negation, im Board und in der Liste; bleibt wie alle Board-Filter je Projekt im `localStorage` (nicht in der URL). `?filter=overdue` auf der Board-Route setzt ihn einmalig und verschwindet aus der Adresse. Er läuft im Client, die API ist unverändert (wie die übrigen Fälligkeitsfilter seit PEGA-89).
- `GET /task/overdue?workspaceId=…&countOnly=…` (`listOverdueTasks`): überfällige Karten aller aktiven Projekte des Workspace, über `projectAccessCondition` und `taskVisibleCondition(resolveTaskScope)` wie Liste und Suche; ungesteuerte Mitglieder sehen alle. Älteste zuerst, höchstens 100 plus `total`. Rechte wie `/task/assigned` (`project:read`, `task:read`).
- Startseite: Block „Überfällig (n)“ über „Diese Woche“, nur bei `total > 0`, die zehn ältesten Karten (Titel, Spalte, Assignee, „seit … überfällig“), Klick öffnet die Karte; „Alle anzeigen“ je Projekt mit überfälligen Karten führt aufs Board mit `?filter=overdue`. Sichtbar für jedes Mitglied mit überfälligen Karten in seinem Sichtbereich, ein Bearbeiter (`assigned`) sieht also nur seine eigenen.
- Vertrag mit dem Hub (unverändert, per Test belegt): `PUT /task/due-date/{id}` (`updateTaskDueDate`) setzt mit `{ "dueDate": "<ISO>" }` und entfernt mit `{}`; die Route hat keine Spaltensperre, und das Systemkonto ist über `isHubSystemAccount` ungesteuert, braucht also nur `task:update` seiner Kaneo-Rolle und den Scope seines API-Schlüssels. `GET /task/{id}` liefert `dueDate`.
- Posteingang: keine Änderung. Zuweisung, neue Karte mit Assignee, Kommentar, Erwähnung und Statuswechsel erreichen den Posteingang des Assignees (Test). Alte Abwahlen in `user_notification_preference` (`taskAssignmentEnabled`, `taskCommentEnabled`, `taskStatusChangeEnabled`, `dueDateReminderEnabled`) würden den Posteingang weiter leeren, seit PEGA-80 kann sie aber niemand mehr ändern. **Entscheidung:** bewusst nicht behandelt, weil es noch keine Produktivnutzer gibt und nur Testnutzer Abwahlen gespeichert haben können. Kommen vor dem Livegang echte Abwahlen hinzu, die vier Spalten per Fork-Migration auf `true` setzen.

**Dateien:**
- API: `task/controllers/get-overdue-tasks.ts`, `task/overdue-tasks-schema.ts` (neu), Route in `task/index.ts`; `apps/docs/openapi.json`
- Web: `lib/is-task-overdue.ts`, `lib/minute-clock.ts`, `hooks/use-is-task-overdue.ts`, `hooks/use-overdue-filter-from-search.ts`, `fetchers/task/get-overdue-tasks.ts`, `hooks/queries/task/use-get-overdue-tasks.ts`, `components/home/{overdue-block,overdue-task-row,overdue-since}.ts(x)` (neu); geändert `components/task-chips/due-date-chip.tsx`, `components/kanban-board/task-card/task-card-content.tsx`, `components/list-view/task-row-body.tsx`, `lib/task-filters/{task-matches-filters,due-date-options}.ts`, `hooks/use-task-filters.ts` (`DUE_DATE_FILTER_VALUES.overdue`), `hooks/use-task-filters-with-labels-support.ts` (`isFinalStatus`), `lib/invalidate-my-work.ts`, `hooks/use-user-websocket.ts`, Routen `workspace/$workspaceId/index.tsx` und `project/$projectId/board.tsx`, `index.css` (Tokens `--due-overdue-bg`, `--due-overdue-card`)
- i18n `tasks.due.overdue`, `tasks.backlog.filters.overdue`, `workspace.home.overdue.*` (en-US, de-DE; übrige Locales englisch), `i18n/schema.json` von Hand (`tasks.due` fehlt dort schon bei Upstream)

**Beim Sync beachten:**
- `DueDateChip` muss `useIsTaskOverdue` behalten; baut Upstream den Chip um, die Minutenregel übernehmen (`due-date-chip.test.tsx`).
- `task-card-content.tsx`: `data-overdue`, Klassen und `isCompleted` am Chip (`task-card.test.tsx`, „marks an overdue card…“). `task-row-body.tsx`: Overlay, setzt einen `relative`-Elternknoten voraus (`task-row.test.tsx`, „overdue rows“).
- Neue Upstream-Lesepfade über Karten mehrerer Projekte (wie `/task/assigned`) brauchen `taskVisibleCondition`; `/task/overdue` hat es (`overdue-tasks.test.ts`).
- Ändert Upstream den Fälligkeitsfilter oder `TaskFilterContext`, den Zweig `overdue` und `isFinalStatus` erhalten.
- Wird `updateTaskDueDate` um eine Spaltensperre oder ein weiteres Recht erweitert, muss das Systemkonto ausgenommen bleiben (`hub-due-date.test.ts`).

**Folgearbeit:**
- Mobile-App: Filter „Nur überfällig“ zählt weiter nach Kalendertag; Karten sind dort nicht rot markiert.
- Der native Eintrag `task_overdue` kommt bei einer Hub-Frist erst 24 Stunden nach Fristende, weil der Scheduler Fälligkeiten als ganzen Tag liest; `due_date_reminder` (Vorlauf 1.440 Minuten) kommt genau zum Fristende.

### PEGA-80 — Benachrichtigungseinstellungen im Hub, Integrationen nur ohne Hub-Steuerung

**Zweck:** Der Pegasus Hub verschickt die Karten-Benachrichtigungen (zugewiesen, erwähnt, fällig) per Mail und verwaltet die Einstellungen jedes Nutzers in seiner Admin-App (`<ADMIN_URL>/notifications`, Keycloak-SSO). Das Board hat kein SMTP; seine eigene Seite „Benachrichtigungen“ ist überflüssig. Außerdem trägt der Hub in jedes Projekt eines von ihm verwalteten Workspaces einen Generic Webhook ein, den kein gewöhnliches Mitglied ändern oder löschen darf.

**Regel:**
- `PEGASUS_NOTIFICATION_SETTINGS_URL` (optional, absolute http(s)-URL, sonst ignoriert) erscheint als `notificationSettingsUrl` in `GET /config` (öffentlich, `null` ohne Variable). Mit URL zeigt das Kontomenü „Benachrichtigungen“ als externen Link (neuer Tab, Glocke, Hinweis „wird in einem neuen Tab geöffnet“ für Screenreader); ohne URL fehlt der Eintrag. Die Route `/dashboard/settings/account/notifications` rendert nichts mehr: mit URL `window.location.replace(url)`, sonst Weiterleitung auf `/dashboard/settings/account/information`. Mails aus `notification-preferences/delivery.ts` verlinken die Hub-URL als `settingsUrl`, wenn sie gesetzt ist. Der Posteingang (Glocke, Inbox) bleibt unverändert.
- In einem Workspace, den der Hub verwaltet (Zeile in `pegasus_workspace`), verlangen alle Verwaltungsrouten der Integrationen zusätzlich zu `workspace:manage_settings` ein Mitglied, das der Hub nicht steuert: Owner, Instanz-Admin oder `PEGASUS_HUB_USER_ID` (`resolveMemberAccess(c).permissions === null`). Sonst 403 `HUB_GOVERNED` (`utils/deny-hub-governed.ts`, gemeinsam mit der Push-API aus PEGA-142, Meldung jetzt allgemein).
  - Betroffen: Anlegen, Ändern, Löschen, Repository-Listen und Prüfen aller acht Integrationen (Generic Webhook, Slack, Discord, Mattermost, Telegram, GitHub, Gitea, GitLab) sowie Vorschau und Speichern der Sync-Regeln (`integration-sync`).
  - Lesen: `GET` des Generic Webhooks und der vier Chat-Integrationen ebenfalls gesperrt, denn nur die Integrationsseite liest sie. `GET` von GitHub/Gitea/GitLab bleibt offen, weil Kartenkopf (Kopieraktionen) und Automationen sie für alle Mitglieder brauchen; Webhook-Secret und Token liefern Gitea und GitLab aber nur noch an nicht gesteuerte Mitglieder mit `manage_settings`.
  - Unverändert: Issue-Import, Prüfung und Fortsetzen pausierter Sync-Links (Karten-Aktionen, `requireLeadPermission`), `getGitHubAppInfo`.
  - Workspaces ohne Hub-Push verhalten sich wie Kaneo.
- Capability `manageIntegrations` (`workspace:manage_settings`), in `hubUngovernedCapabilities`: `GET /workspace/{id}/capabilities` liefert sie für jedes Hub-gesteuerte Mitglied als `false`. Das Web zeigt den Projektbereich „Integrationen“ nur mit `canManageIntegrations`; die Route leitet ohne sie auf „Allgemein“ des Projekts um und rendert nichts, solange Workspace, Mitglied oder Capabilities laden.
- Vertrag mit dem Hub: Das Systemkonto legt den Webhook per `POST /generic-webhook-integration/project/{projectId}` an und ersetzt ihn mit demselben Aufruf (Upsert), liest ihn per `GET` und ändert ihn per `PATCH`. Pfade und Operation-IDs unverändert.

**Dateien:**
- API: `utils/deny-hub-governed.ts` (verschoben aus `pegasus-visibility/`, plus `isHubGoverned`), `utils/notification-settings-url.ts` (neu), `utils/get-settings.ts`, `config/response.ts`, `notification-preferences/delivery.ts` (eine Zeile), `{generic-webhook,slack,discord,mattermost,telegram,github,gitea,gitlab}-integration/index.ts` (`manageAccess`, Chat-/Webhook-`GET`, GitHub-`verifyRoute`, Gitea/GitLab-Secrets), `integration-sync/index.ts` (`manageRules`), `workspace/controllers/get-my-capabilities.ts`, `pegasus-visibility/index.ts` (Import); `apps/docs/openapi.json`; `.env.sample`
- Paket: `packages/permissions/src/{capabilities,hub-permissions,index}.ts`
- Web: `components/settings/nav/{types,build-settings-nav,use-settings-nav,settings-nav-group}.ts(x)`, `hooks/use-workspace-permission.ts` (`canManageIntegrations`), `routes/.../settings/account/notifications.tsx`, `routes/.../settings/projects/$projectId/integrations.tsx`, `components/project/integrations/project-integrations-page.tsx` (neu, bisheriger Seiteninhalt)
- i18n `settings.opensInNewTab` (en-US, de-DE; übrige Locales englisch), `i18n/schema.json` von Hand
- `components/settings/notifications/**` und die API `notification-preferences` bleiben unverändert, nur erreicht sie niemand mehr.

**Beim Sync beachten:**
- Neue Upstream-Routen, die Integrationen anlegen, ändern oder löschen, brauchen `denyHubGoverned` hinter `requireWorkspacePermission({ workspace: ["manage_settings"] })`; neue lesende Integrationsrouten brauchen eine Entscheidung (nur Integrationsseite → sperren; von Board-Funktionen genutzt → offen, ohne Secrets). `hub-integration-guard.test.ts` deckt Webhook, Slack, Gitea und Sync-Regeln ab.
- `routes/.../settings/account/notifications.tsx` muss weiterleiten. Baut Upstream die Seite um, den Fork-Stand übernehmen; `notifications.test.tsx` schlägt sonst fehl.
- `delivery.ts` behält den Vorrang von `getNotificationSettingsUrl()` für `settingsUrl` (`notification-delivery-events.test.ts`).
- Neue Upstream-Abschnitte in `PROJECT_SECTIONS` oder Konto-Links prüfen; `build-settings-nav` nimmt `notificationSettingsUrl` und `canManageIntegrations` als Pflichtfelder.
- Neue Upstream-Felder in `GET /config` brauchen das Fork-Feld weiter in `configSchema` und `get-settings.ts`.

---

## 3. Ablauf eines Upstream-Syncs

1. Branch `chore/sync-upstream-<jahr>-<monat>` von `main`, `git fetch upstream`, `git merge --no-ff upstream/main` (Fork bleibt First Parent).
2. Konflikte nach Abschnitt 2 auflösen. `pnpm-lock.yaml` per `pnpm install`, `apps/docs/openapi.json` per `pnpm openapi:check:fix` neu erzeugen, nicht von Hand mergen.
3. Fork-Migration umnummerieren (Abschnitt PEGA-6) und gegen eine Datenbank auf altem Fork-Stand prüfen (`pnpm --filter @kaneo/api db:migrate`).
4. `pnpm i18n:check` (Fork-Schlüssel in allen Locales), `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:integration`. Bleibt die lokale Testdatenbank auf einem alten Migrationsstand hängen (Fehler „relation … does not exist“), `kaneo_test` verwerfen; die Tests legen sie neu an.
5. Neue Upstream-Lesepfade gegen `taskVisibleCondition` prüfen und Lücken in `task-view-hub-scope.test.ts` bzw. `task-view-assigned-only.test.ts` absichern.
6. Neue Upstream-Schreibpfade auf Karten gegen `requireLeadPermission` prüfen und in `hub-permissions.test.ts` absichern (PEGA-142); setzen sie den Status, auch gegen die Spaltensperre (`require-column-unlocked.ts`, `column-lock.test.ts`, PEGA-170).
   Neue Integrationsrouten gegen `denyHubGoverned` prüfen und in `hub-integration-guard.test.ts` absichern (PEGA-80).
7. Merge-Commit „Merge upstream usekaneo/kaneo main (vX.Y.Z+N) into pegasus-board“ mit Konfliktbericht, Nacharbeit als eigener Commit; dieses Register aktualisieren.

---

## 4. Bekannte offene Lücken des Zeilenfilters

Die Lücken aus dem [Zeilenfilter-Review](review/2026-10-zeilenfilter-fuehrungskraft.md#nachtrag-upstream-sync-2026-10-19) (#8, #9, #11, #12, #14, #18, #24) sind mit PEGA-141 geschlossen. Der Export-Schutz (#17) gilt seit PEGA-142 über `LEAD_EXPORT`. Offen bzw. akzeptiert: WebSocket-Broadcasts mit IDs (#13), Detail-Sheet ohne „nicht gefunden“ (#21), Spalte löschen verrät verdeckte Karten per 409 (#25), Duplizieren übernimmt Verknüpfungen zu verdeckten Elternkarten (#26). Stand: [Sichtbereich-Review, Abschnitt 3](review/2026-11-sichtbereich-einheiten.md#3-umgehungsmöglichkeiten-tabelle-aus-pega-6-abschnitt-4-und-nachtrag-fortgeschrieben).
