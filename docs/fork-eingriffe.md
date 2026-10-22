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
| WWK, PEGA-92 | Theming, Markenname, Build-Artefakte (Titel, Manifest, Icons), E-Mails, Mobile-App | Web, API, E-Mail, Mobile, i18n | `apps/web/src/brand/{brands,brand-index-html}.test.ts`, `packages/email/src/components/app-name.test.ts`, `tests/api/utils/get-invitation-email-subject.test.ts` |
| PEGA-87 | Custom-Field-Typ `url` (Link) | API, Web, Mobile, CLI, MCP, i18n | `tests/api-integration/custom-field-url.test.ts`, `tests/api/custom-field/url-value.test.ts`, `apps/web/src/components/custom-fields/custom-field-url.test.ts`, `card-field-list.test.tsx` |
| PEGA-88 | Felder auf der Kartenvorschau (`custom_field_definition.show_on_card`) | Datenmodell, API, Web, i18n | `tests/api-integration/custom-field.test.ts` („stores whether a field shows on the card…“), `tests/api/custom-field/resolve-field-update.test.ts`, `apps/web/src/components/custom-fields/{card-fields,card-field-rows}.test.ts(x)`, `kanban-board/task-card.test.tsx`, `project/display/custom-field-toggles.test.tsx` |
| PEGA-89 | Serverseitiger Board-Filter nach Feldwerten und Labels | API, Web, MCP, Tests, Dev-Seed | `tests/api-integration/task-list-filters.test.ts` (1.000 Karten, < 2 s), `tests/api/task/task-filter-params.test.ts`, `tests/e2e/filter-performance.spec.ts`, Web: `server-filters.test.ts`, `board-server-filters.test.ts`, `use-get-tasks.test.tsx`, `task-matches-filters.test.ts`, `use-task-filters-with-labels-support.test.tsx`, `filtered-drag.test.tsx`, MCP: `register.test.ts` |

---

## 2. Eingriffe im Einzelnen

### PEGA-6 — Rolle „nur zugewiesene Karten“

**Zweck:** Führungskräfte sehen nur Bewerber, die ihnen zugewiesen sind ([Review](review/2026-10-zeilenfilter-fuehrungskraft.md)).

**Dateien:**
- Migration `apps/api/drizzle/0064_workspace_role_assigned_only.sql` (idempotent, `ADD COLUMN IF NOT EXISTS`), Spalte in `apps/api/src/database/schema.ts` (`workspaceRoleTable.assignedOnly`), `apps/api/src/utils/migrate-renumbered-fork-migration.ts`
- Scope-Helfer `apps/api/src/utils/assigned-only-scope.ts`
- Durchsetzung: `utils/workspace-access-middleware.ts` (Assignee aus dem Lookup), `task/index.ts` + `task/controllers/get-tasks.ts` (`restrictToUserId`), `export-tasks.ts`, `get-task-by-ticket-id.ts`, `task/description-pages.ts`, `search/*`, `activity/*`, `integration-sync/index.ts` und `calendar-feed/index.ts` (`denyAssignedOnly`)
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

**Zweck:** Die Plattform zeigt durchgängig das WWK-Erscheinungsbild, auch am Smartphone und in E-Mails (PEGA-92, [Review](review/2026-10-branding-wwk.md)). Details: [theming-wwk.md](theming-wwk.md).

**Dateien:**
- Web: `apps/web/src/brand/*` (`brands.ts` reine Daten, `index.ts` liest `VITE_BRAND`, `brand-index-html.ts`, `apply.ts`), `apps/web/brand-html-plugin.ts`, `vite.config.ts`, `tsconfig.node.json`, `apps/web/public/brands/wwk/*`, `index.css` (Grautöne nur in `.theme-wwk:not(.dark)`), `store/user-preferences.ts` (Standard hell), `apps/web/package.json` (`@fontsource/ubuntu`)
- Web-Komponenten mit `brand`: `components/common/logo.tsx`, `page-title.tsx`, `auth/auth-page.tsx`, `onboarding/onboarding-shell.tsx`, `auth/auth-legal-footer.tsx`, `public-project/kaneo-branding.tsx`, `ui/error-display.tsx`, `activity/comment-card.tsx`, `import/{import-source-definitions,trello-authorize-url}.ts`, `import/source-logos/kaneo-logo.tsx`, `import/connect-forms/kaneo-connect-form.tsx`, `shared/modals/create-workspace-modal.tsx` (`uppercase`)
- i18n: `{{appName}}` statt „Kaneo“ in `common`, `auth`, `settings`, `invitations`, `mobile`, alle 21 Sprachen; Webhook-Platzhalter `https://example.com/webhook`; neuer Schlüssel `mobile.signIn.taglineOwnServer` (in `schema.json` von Hand)
- E-Mail und API: `packages/email/src/components/app-name.ts` (`APP_NAME`, Standard „WWK Board“; `withAppName()` ersetzt „Kaneo“ in der Template-Kopie beim Rendern), `email-shell.tsx`, `footer-links.ts`, `security-reasons.ts`, Templates `magic-link`, `otp`, `password-reset`, `notification`, `workspace-invitation`; `vitest.config.ts` (Upstream-Tests mit `APP_NAME=Kaneo`); `apps/web/public/email/mark-wwk.png`; `apps/api/src/auth.ts` (Betreffzeilen), `utils/get-invitation-email-subject.ts`, `notification-preferences/delivery.ts`, `plugins/{slack,discord,telegram,mattermost}/events.ts`; Import-Meldungen ohne Produktnamen (`import/*`, `verify-repository-owner.ts`)
- Mobile: `app.json` (Name, Farben, Foto-Text), `assets/images/*`, `src/components/brand.tsx` (WWK-Logo), `src/lib/brand.ts` (Name, kein Kaneo-Cloud-Angebot), `src/app/sign-in.tsx`, `src/lib/i18n/index.ts` (`appName`), `plugins/with-permission-locales.js`
- Doku und Skripte: `.env.sample`, `ENVIRONMENT_SETUP.md`, `scripts/i18n/brand-app-name.mjs`, `package.json` (`i18n:brand`)

**Beim Sync beachten:**
- i18n: Upstream-Dateien übernehmen, dann `pnpm i18n:brand` (`scripts/i18n/brand-app-name.mjs`, idempotent). Neue Upstream-Texte mit „Kaneo“ in den genannten Namensräumen bekommen so `{{appName}}`. Danach `settings.workspaceImport.sources.kaneo.description` prüfen (von Hand umformuliert).
- `brand-index-html.test.ts` schlägt fehl, wenn Upstream `index.html` so ändert, dass wieder „Kaneo“ im Kopf steht.
- Neue E-Mail-Templates brauchen `withAppName()` auf ihrer Kopie.
- Neue hart codierte Nennungen findet `grep -rn '"Kaneo\|kaneo\.app' apps/web/src apps/mobile/src`.

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

---

## 3. Ablauf eines Upstream-Syncs

1. Branch `chore/sync-upstream-<jahr>-<monat>` von `main`, `git fetch upstream`, `git merge --no-ff upstream/main` (Fork bleibt First Parent).
2. Konflikte nach Abschnitt 2 auflösen. `pnpm-lock.yaml` per `pnpm install`, `apps/docs/openapi.json` per `pnpm openapi:check:fix` neu erzeugen, nicht von Hand mergen.
3. Fork-Migration umnummerieren (Abschnitt PEGA-6) und gegen eine Datenbank auf altem Fork-Stand prüfen (`pnpm --filter @kaneo/api db:migrate`).
4. `pnpm i18n:check` (Fork-Schlüssel in allen Locales), `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:integration`. Bleibt die lokale Testdatenbank auf einem alten Migrationsstand hängen (Fehler „relation … does not exist“), `kaneo_test` verwerfen; die Tests legen sie neu an.
5. Neue Upstream-Lesepfade gegen den Zeilenfilter prüfen und Lücken in `task-view-assigned-only.test.ts` absichern.
6. Merge-Commit „Merge upstream usekaneo/kaneo main (vX.Y.Z+N) into pegasus-board“ mit Konfliktbericht, Nacharbeit als eigener Commit; dieses Register aktualisieren.

---

## 4. Bekannte offene Lücken des Zeilenfilters

Vor dem Sync 2026-10-19 vorhanden, nicht durch den Sync entstanden; für eine eigene Story vorgesehen. Stand und Maßnahmen: [Zeilenfilter-Review, Abschnitt 4 und Nachtrag](review/2026-10-zeilenfilter-fuehrungskraft.md#nachtrag-upstream-sync-2026-10-19).
