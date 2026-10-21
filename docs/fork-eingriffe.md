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
