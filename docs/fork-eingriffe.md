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

**Zweck:** Das Board „Bewerber-Pool“ ist auf jeder Umgebung gleich und lässt sich reproduzierbar aufbauen: zehn Prozessspalten, Workspace-Labels für Quelle, Paket und Prüfung sowie die Grundfelder ([Review](review/2026-10-board-einrichtung.md), [Betriebshandbuch](board-einrichtung.md)). Das ist Konfiguration über die REST-API; der Code der Anwendung ändert sich nicht. Den Vertriebsweg bildet seit PEGA-142 der Workspace des Key Accounts ab, nicht ein Feld oder Label.

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
- Dort ist jedes Mitglied Hub-gesteuert, außer `owner`, Instanz-Admins und dem Konto aus `PEGASUS_HUB_USER_EMAIL`.
- Für Hub-gesteuerte Mitglieder ersetzt ein Hub-Recht auf Karten-Routen die Kaneo-Rollenprüfung (Tabelle im Review). Ein API-Key-Scope schränkt weiter ein.
- Fehlt das Recht: 403 `MISSING_PERMISSION` mit `missingPermissions: ["LEAD_…"]`. Ohne Eintrag im Stand: nichts sehen, nichts dürfen.
- Workspaces ohne Push verhalten sich wie Kaneo.

**Dateien:**
- Migration `apps/api/drizzle/0067_pegasus_permissions.sql` (idempotent: `pegasus_workspace`, `pegasus_user_scope.permissions`, `DROP COLUMN IF EXISTS workspace_role.hub_scoped`), `database/schema.ts`, `database/index.ts`
- Neu:
  - `packages/permissions/src/hub-permissions.ts` (`HUB_PERMISSIONS`, `capabilityHubPermission`), neue Capabilities `moveTasks`, `labelTasks`, `exportTasks`, `viewReports` in `capabilities.ts`
  - `apps/api/src/utils/require-hub-permission.ts` (`requireLeadPermission`, `requireHubPermission`, `hubAllows`, `hasLeadPermission`)
  - `apps/api/src/task-scope/is-hub-system-account.ts`
- `task-scope/`:
  - `loadMemberAccess` (Sicht und Rechte), `resolveMemberAccess`
  - `TaskScope` mit UND-Semantik (`assignedOnly`, `unitIds | null`), `composeTaskScope` mit `managed`
- Push-API `pegasus-visibility/{schema,controllers/*}.ts`: Pflichtfeld `permissions`, Marker `pegasus_workspace`
- Gates (Einzeiler `requireLeadPermission(...)` statt `requireWorkspacePermission(...)`):
  - `task/index.ts`, `task/controllers/require-task-permission.ts` (Bulk, Assignee, neu `requireTaskStatusPermission`, `requireReorderPermission`)
  - `comment/index.ts`, `activity/index.ts`, `custom-field/index.ts`, `label/index.ts` (attach/detach), `task-relation/index.ts`, `time-entry/index.ts`, `external-link/index.ts`
  - Statistik `project/{index.ts,controllers/get-projects.ts}`
  - Capabilities `workspace/{index.ts,controllers/get-my-capabilities.ts}`
  - `utils/require-workspace-permission.ts` exportiert `assertApiKeyScope`, `apiKeyAllows`
- Rollenfeld `hubScoped` entfernt: `auth.ts`, `auth-openapi.ts`, `packages/permissions` (`roleRestrictions`), Web `lib/auth-client.ts`, `hooks/{mutations,queries}/workspace/use-*-workspace-role(s).ts`, `routes/.../settings/workspace/roles.tsx` (statt Schalter Hinweis `settings.workspaceRoles.hubManagedHint`)
- Web-Gates über Capabilities:
  - `use-workspace-permission.ts` (`canMoveTasks`, `canLabelTasks`, `canExportTasks`, `canViewReports`)
  - `kanban-board/{index,column/column-header,task-card-context-menu/task-card-context-menu-content}.tsx`, `list-view/{index,list-column-section}.tsx`, `bulk-selection/{bulk-bar.tsx,use-bulk-actions.ts}`
  - `task/{task-status-popover,subtask-status-popover,task-move-popover,task-labels-popover,task-activity,task-shortcuts}.tsx`, `activity/comment-card.tsx`, `project/task-view-keys/use-task-action-shortcuts.ts`, `project/tasks-import-export/export-tasks-row.tsx`, `project-progress.tsx`
- i18n `settings.workspaceRoles.hubManagedHint` (en-US, de-DE; übrige Locales englisch), `view_hub_scoped` entfernt, `i18n/schema.json` von Hand; `.env.sample`; `apps/docs/openapi.json`

**Beim Sync beachten:**
- **Pfade und Operation-IDs der Push-API sind Vertrag mit dem Hub** (`replacePegasusUserScopes`, `getPegasusUserScopes`, `setPegasusTaskUnit`, `setPegasusTaskUnits`, `kaneo:spec:pull`). Ebenso die Rechte-Schlüssel (UPPER_SNAKE, unverändert vom Hub). Nicht umbenennen.
- **Neue Upstream-Schreibrouten auf Karten** (alles mit `requireWorkspacePermission({ task: [...] })` oder `{ label: ["update"] }` an einer Karte): auf `requireLeadPermission(<Kaneo-Map>, "<Hub-Recht>")` umstellen und eine Zeile in `ACTIONS` von `hub-permissions.test.ts` ergänzen. Sonst entscheidet für Hub-gesteuerte Mitglieder wieder die Kaneo-Rolle.
- Neue In-Handler-Prüfungen `hasWorkspacePermission(c, { task: [...] })` auf `hasLeadPermission` umstellen.
- Neue Upstream-Capabilities für Karten-Aktionen in `capabilityHubPermission` eintragen.
- Migration hinter die letzte Upstream-Migration nummerieren (zuletzt 0067).

---

## 3. Ablauf eines Upstream-Syncs

1. Branch `chore/sync-upstream-<jahr>-<monat>` von `main`, `git fetch upstream`, `git merge --no-ff upstream/main` (Fork bleibt First Parent).
2. Konflikte nach Abschnitt 2 auflösen. `pnpm-lock.yaml` per `pnpm install`, `apps/docs/openapi.json` per `pnpm openapi:check:fix` neu erzeugen, nicht von Hand mergen.
3. Fork-Migration umnummerieren (Abschnitt PEGA-6) und gegen eine Datenbank auf altem Fork-Stand prüfen (`pnpm --filter @kaneo/api db:migrate`).
4. `pnpm i18n:check` (Fork-Schlüssel in allen Locales), `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:integration`. Bleibt die lokale Testdatenbank auf einem alten Migrationsstand hängen (Fehler „relation … does not exist“), `kaneo_test` verwerfen; die Tests legen sie neu an.
5. Neue Upstream-Lesepfade gegen `taskVisibleCondition` prüfen und Lücken in `task-view-hub-scope.test.ts` bzw. `task-view-assigned-only.test.ts` absichern.
6. Neue Upstream-Schreibpfade auf Karten gegen `requireLeadPermission` prüfen und in `hub-permissions.test.ts` absichern (PEGA-142).
7. Merge-Commit „Merge upstream usekaneo/kaneo main (vX.Y.Z+N) into pegasus-board“ mit Konfliktbericht, Nacharbeit als eigener Commit; dieses Register aktualisieren.

---

## 4. Bekannte offene Lücken des Zeilenfilters

Die Lücken aus dem [Zeilenfilter-Review](review/2026-10-zeilenfilter-fuehrungskraft.md#nachtrag-upstream-sync-2026-10-19) (#8, #9, #11, #12, #14, #18, #24) sind mit PEGA-141 geschlossen. Der Export-Schutz (#17) gilt seit PEGA-142 über `LEAD_EXPORT`. Offen bzw. akzeptiert: WebSocket-Broadcasts mit IDs (#13), Detail-Sheet ohne „nicht gefunden“ (#21), Spalte löschen verrät verdeckte Karten per 409 (#25), Duplizieren übernimmt Verknüpfungen zu verdeckten Elternkarten (#26). Stand: [Sichtbereich-Review, Abschnitt 3](review/2026-11-sichtbereich-einheiten.md#3-umgehungsmöglichkeiten-tabelle-aus-pega-6-abschnitt-4-und-nachtrag-fortgeschrieben).
