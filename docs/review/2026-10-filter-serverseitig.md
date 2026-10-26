# Serverseitiger Board-Filter nach Feldwerten — Umsetzung, Messung, Nachweis

| | |
|---|---|
| **Story** | PEGA-89: Als Innendienst möchte ich das Board nach Feldwerten filtern, auch wenn viele Karten im Pool liegen. Filterung serverseitig statt im Browser; kombinierbar mit Label und Spalte |
| **Bezug** | [Custom Fields](2026-10-custom-fields.md) Abschnitt 4 und 6 (Position „Serverseitiger Filter nach Feldwerten“, 1–1,5 PT); Feinkonzept v3.10, Kap. 4 (Leistung: „Board mit mehreren tausend Karten flüssig; Filter unter 2 Sekunden“, „Serverseitige Filterung“), Kap. 7, Kap. 11 Baustein 3; [Register der Fork-Eingriffe](../fork-eingriffe.md) |
| **Stand** | 2026-10-21, Fork `IAMDS-GMBH/pegasus-board`, Branch `th_PEGA-89` auf Basis `main` (Upstream v2.46.2+141) |
| **Autor** | IAMDS |

Pfadangaben beziehen sich auf die Repo-Wurzel.

---

## 0. Ergebnis auf einer Seite

| Abnahmekriterium | Befund |
|---|---|
| Ein Filter über ein Custom Field liefert bei 1.000 Karten in unter zwei Sekunden ein Ergebnis | **Erfüllt.** API (Integrationstest, 1.000 Karten, Feld „Paket = P2“, 333 Treffer): erste Seite **188 ms**, alle vier Seiten **670 ms**. Browser (Playwright, dieselben 1.000 Karten, Klick auf „P2“ bis das Board nur die 333 Treffer zeigt): **1.128 ms**. Die Datenbank braucht für die Filterabfrage unter 1 ms (Abschnitt 3). |
| Filter lassen sich mit Labels kombinieren | **Erfüllt.** „Paket = P2“ und Label „Kampagne A“ liefern serverseitig die 166 geraden P2-Karten; im Browser dauert das Hinzufügen des Labels **335 ms**. Die Kombination mit der Spalte (`status`) ist ebenfalls serverseitig getestet. |
| Filterung serverseitig, damit sie bei großer Kartenzahl trägt | **Erfüllt.** `GET /task/tasks/{projectId}` wendet `labels` und `customFields` vor der Paginierung an; die Web-App schickt sie mit und lädt nur noch die Treffer (bei 333 Treffern vier statt zehn Seiten). |

**Mitbehobene Upstream-Fehler:** Der vorhandene Feldfilter des Boards las die Werte aus dem Cache der geöffneten Karte (`["custom-field-values", taskId]`). Karten, die nie geöffnet wurden, galten als „ohne Wert“ und verschwanden bei jedem Feldfilter. Außerdem verglich der Filter Multiselect-Werte als ganzen JSON-String, sodass eine einzelne Option nie traf. Beides ist korrigiert und mit Tests abgesichert (Abschnitt 2.3).

---

## 1. Verhalten

- **Innendienst** wählt in der Filterleiste ein Feld (z. B. „Paket“) und einen oder mehrere Werte, optional dazu Labels (Kampagne) und Spalten. Das Board lädt daraufhin nur die passenden Karten vom Server; die Anzahl in der Toolbar zeigt die Treffer.
- **Semantik:** Mehrere Werte eines Feldes sind ODER-verknüpft, mehrere Felder UND. Labels: beliebiger Treffer der gewählten Label-Gruppen (Name). Multiselect-Felder treffen, wenn eine gewählte Option enthalten ist.
- **Was clientseitig bleibt:** Spaltenfilter, Negation („ist nicht“), Fälligkeit, Zuständige, Priorität und die Textsuche laufen weiter im Browser auf der geladenen Menge. Negierte Label- oder Feldfilter werden nicht an den Server geschickt, weil der Server sonst Karten ausschließen würde, die der Client braucht. Der Client-Matcher prüft auch die vom Server gelieferten Karten nach; das hält Realtime-Einfügungen (WebSocket) korrekt, die den Filter nicht erfüllen.
- **Verschieben mit aktivem Serverfilter:** Der Cache hält nur die Treffer, also kann das Board beim Verschieben nicht mehr den vollständigen Spaltenstand (`expectedTasks`) zur Prüfung mitschicken. Eine Karte in eine andere Spalte ziehen hängt sie **ans Ende** der Zielspalte; Umsortieren innerhalb einer Spalte ist mit aktivem Feld- oder Labelfilter nicht möglich. Ohne Serverfilter bleibt alles wie bisher.
- **Gesamtzahl:** Solange der Server filtert, zeigt die Toolbar nur die Trefferzahl („333 Karten“), nicht „333 von 1.000“, weil die Gesamtzahl nicht geladen wird.
- **Backlog, Kalender, Gantt** laden das Board ohne Serverfilter neu, wenn sie geöffnet werden (derselbe Cache-Schlüssel); dabei kann kurz die gefilterte Menge sichtbar sein, die der dort gleich angewandte Client-Filter ohnehin zeigt.
- **API-Nutzer** (Hub, MCP, CLI) können dieselben Parameter verwenden: `labels=["Kampagne A"]`, `customFields={"<feldId>":["P2"]}` (URL-kodiert), kombiniert mit `status`. Unbekannte Feld-IDs liefern ein leeres Ergebnis, ungültiges JSON einen 400.

---

## 2. Umsetzung

### 2.1 API

| Datei | Änderung |
|---|---|
| `apps/api/src/task/task-filter-params.ts` (neu) | Zod-Parameter `labelsParam` (JSON-Array von Namen, max. 20 × 100 Zeichen) und `customFieldsParam` (JSON-Objekt Feld-ID → Werte, max. 10 Felder × 50 Werte × 500 Zeichen); Duplikate und Leerwerte werden entfernt |
| `apps/api/src/task/schema.ts` | `listTasksQuery` um `labels` und `customFields` ergänzt (gilt auch für die öffentliche Board-Route) |
| `apps/api/src/task/controllers/get-tasks.ts` | `GetTasksOptions.labels/customFields`; je Label-Filter ein `EXISTS` auf `label(task_id, name)`, je Feld ein `EXISTS` auf `custom_field_value(task_id, field_id, value)`; Multiselect zusätzlich `value::jsonb ?| array[…]` hinter einem `CASE … LIKE '[%'`, damit der Cast nur auf JSON-Arrays läuft. Die Bedingungen liegen im gemeinsamen `whereClause`, also gelten sie für Zählung, Seite und den Zeilenfilter (`restrictToUserId`) gleichermaßen |
| `apps/docs/openapi.json` | regeneriert (`pnpm openapi:check:fix`) |
| `packages/mcp/src/tools/register.ts` | `list_tasks` reicht `labels` und `customFields` durch |

**Keine Migration.** `EXPLAIN (ANALYZE, BUFFERS)` auf den 1.000 Testkarten (Feld + Label): Bitmap-Index-Scan über `custom_field_value_fieldId_idx`, Hash-Join mit den Labels, **0,63 ms** Ausführung, 561 gelesene Blöcke. Ein zusätzlicher Index `(field_id, value)` bringt bei dieser Größenordnung nichts und würde mit der Migration `0065` aus PR #11 (PEGA-88) kollidieren; er bleibt als Option für den Fall, dass ein Projekt zehntausende Werte je Feld hält (dann als Fork-Migration hinter der letzten Upstream-Nummer, `CREATE INDEX IF NOT EXISTS`).

### 2.2 Web

| Datei | Änderung |
|---|---|
| `apps/web/src/lib/task-filters/server-filters.ts` (neu) | `toServerFilters(filters, labels)`: nur nicht negierte Label- und Feldfilter; Label-IDs → Gruppennamen; `serializeServerFilters` als stabiler Vergleichsschlüssel |
| `apps/web/src/lib/board-server-filters.ts` (neu) | Registry je `QueryClient` und Projekt. Der Query-Key `["tasks", projectId]` bleibt unverändert, weil `use-project-websocket.ts` und das Drag-and-drop ihn direkt patchen; so laden auch die anderen Beobachter des Keys (Task-Crumb, Relationen) mit den Filtern des Boards |
| `apps/web/src/fetchers/task/get-tasks.ts` | vierter Parameter `filters`, als `labels`/`customFields` in die Query |
| `apps/web/src/hooks/queries/task/use-get-tasks.ts` | Option `serverFilters` (nur vom Board gesetzt): Registry beim Rendern schreiben, bei Änderung `invalidateQueries`, beim Verlassen zurücksetzen und einmal ungefiltert nachladen |
| `routes/.../board.tsx` | Filterzustand vor dem Laden lesen, `serverFilters` an `useGetTasks` und `serverFiltered` an das Board geben; Gesamtzahl nur ohne Serverfilter |
| `components/project/toolbar/use-project-task-view.ts`, `task-count.tsx` | `options` zurückgeben; `total` optional |
| `components/kanban-board/index.tsx` | `serverFiltered`: Verschieben als `appendOnly` ohne `expectedTasks`, kein Einfügemarker in der Spalte |

### 2.3 Korrektur des Client-Matchers

| Datei | Änderung |
|---|---|
| `hooks/use-task-filters-with-labels-support.ts` | Feldwerte aus der projektweiten Abfrage `GET /custom-field/project/{id}/values` (ein Request, nur aktiv wenn ein Feldfilter gesetzt ist) statt aus dem Karten-Cache; die beiden Hooks `use-get-all-custom-field-values-by-project.ts` (unter `hooks/queries` und `hooks/mutations`) sind entfernt |
| `lib/task-filters/task-matches-filters.ts` | Multiselect: gespeichertes JSON-Array parsen (`parseMultiselect`), Treffer bei einer gewählten Option; Textwerte mit Komma werden nicht zerlegt |
| `components/custom-fields/card-fields.ts` | `valuesByTask` exportiert (gemeinsame Gruppierung mit der Kartenvorschau) |
| `hooks/queries/custom-field/use-get-custom-field-values-by-project.ts` | Option `enabled` |

### 2.4 Testdaten

- `apps/api/scripts/seed-cards/generate-cards.ts`: Karte *i* ist vollständig durch ihren Index bestimmt — Titel `Karte i`, Spalte `i mod Spaltenzahl`, `Paket = P((i mod 3)+1)`, `PLZ = 86000+i`, `Quelle = ["Meta"]` (gerade) bzw. `["LinkedIn","Formular"]` (ungerade), Label „Kampagne A“ auf geraden Karten. Tests berechnen so jedes erwartete Ergebnis ohne Datenbankzugriff.
- `apps/api/scripts/seed-cards/insert-cards.ts`: Bulk-Insert in 500er-Blöcken (Karten, 3.000 Feldwerte, 500 Labels), legt fehlende Felddefinitionen nach Namen an.
- `apps/api/scripts/seed-cards.ts`, `pnpm --filter @kaneo/api db:seed:cards -- --project <id> --count 1000`: dieselben Karten in ein bestehendes Projekt der Entwicklungsdatenbank; Wiederholung entfernt zuerst die eigenen Karten (Titelmuster). Nebenbei repariert: `scripts/seed-dev.ts` importierte `DEFAULT_PROJECT_COLUMNS` aus der falschen Datei und startete nicht mehr.

---

## 3. Nachweis

### 3.1 Automatisierte Tests

| Test | Inhalt | Ergebnis |
|---|---|---|
| `tests/api-integration/task-list-filters.test.ts` | 1.000 Karten per Bulk-Insert; exakte Treffermengen für Feld (ODER innerhalb, UND über Felder), Multiselect, Feld + Label, Feld + Spalte, unbekanntes Feld/Label (0), ungültiges JSON (400), Zeilenfilter „nur zugewiesene“ innerhalb des Filters; Zeitbudget 2.000 ms | 9 Tests grün; **erste Seite 188 ms, alle Seiten 670 ms** |
| `tests/api/task/task-filter-params.test.ts` | Parsen, Grenzen, Fehlerfälle der Parameter | 13 Tests grün |
| `tests/e2e/filter-performance.spec.ts` (Playwright, Wegwerf-Stack `tests/e2e/compose.yml`) | 1.000 Karten über die API angelegt (Feld „Paket“, Label „Kampagne A“), Board geöffnet, Filter „Paket = P2“ gewählt: Request trägt `customFields=`, Board zeigt 333 Karten, `Karte 1` sichtbar, `Karte 0`/`Karte 2` nicht; dann Label „Kampagne A“ → 166 Karten; „Alle löschen“ → 1.000 | grün; **1.128 ms** (Feld), **335 ms** (Feld + Label) |
| Web-Unit-Tests | `server-filters.test.ts`, `board-server-filters.test.ts`, `use-get-tasks.test.tsx` (Registry, Nachladen bei Änderung, zweiter Beobachter, Aufräumen), `task-matches-filters.test.ts` (Multiselect), `use-task-filters-with-labels-support.test.tsx` (ungeöffnete Karten, kein Request ohne Feldfilter), `filtered-drag.test.tsx` (Anhängen ohne `expectedTasks`, kein Umsortieren in der Spalte) | 312 Dateien, 1.626 Tests grün |
| API-Unit-Tests, MCP | `register.test.ts` (Weitergabe der Parameter) | API 1.250 Tests grün, MCP 30 Tests grün |
| Statisch | `pnpm typecheck`, `pnpm lint`, `pnpm openapi:check` | grün |

### 3.2 Datenbank

```
Aggregate (actual time=0.629..0.630 rows=1)
  Nested Loop … rows=166
    Hash Join (l.task_id = v.task_id)
      Seq Scan on label l  Filter: name = 'Kampagne A'  rows=500
      Bitmap Heap Scan on custom_field_value v  Recheck: field_id = …  Filter: value = 'P2'  rows=333
        Bitmap Index Scan on custom_field_value_fieldId_idx
    Index Scan using task_pkey on task
Execution Time: 0.63 ms, Buffers: shared hit=561
```

### 3.3 Browser (Entwicklungsstand, deutsche Oberfläche)

Screenshots aus der lokalen Entwicklungsumgebung mit 1.000 Karten im Seed-Board (`db:seed:cards`); dort zeigte das Board den Filter „Paket = P2“ nach **1.486 ms** (Vite-Dev-Server ohne Build-Optimierung):

- `docs/images/filter-server-menu.png` — Filtermenü mit Feld „Paket“ und Trefferzahlen
- `docs/images/filter-server-board.png` — Board mit aktivem Filter „Paket = P2“, Toolbar zeigt die Trefferzahl

---

## 4. Lokal prüfen, auch mit dem Hub

1. Board starten: `docker compose -f compose.dev.yml up -d postgres`, `pnpm dev` (Web <http://localhost:5173>, API <http://localhost:1337>). Seed-Daten: `pnpm --filter @kaneo/api db:seed` (Nutzer `admin@seed.test` / `admin123`).
2. 1.000 Karten in ein Projekt legen: Projekt öffnen, ID aus der URL (`…/project/<id>/board`), dann `pnpm --filter @kaneo/api db:seed:cards -- --project <id> --count 1000`. Das Skript legt die Felder „Paket“, „PLZ“, „Quelle“ an, wenn sie fehlen.
3. Im Board filtern: Filter → Paket → P2. In den Entwicklerwerkzeugen (Netzwerk) tragen die Requests an `/api/task/tasks/<id>` den Parameter `customFields=…`, und es werden nur noch so viele Seiten geladen, wie Treffer da sind. Label „Kampagne A“ dazu → 166 Karten. Karte in eine andere Spalte ziehen: sie landet am Ende.
4. Hub anbinden ([pegasus-hub/docs/BOARD.md](../../../pegasus-hub/docs/BOARD.md)): `KANEO_API_URL=http://localhost:1337/api`, API-Key des Systemkontos, `KANEO_PROJECT_ID=<id>`, Webhook-Secret; Hub mit `pnpm start:dev` starten.
   - `POST /intake/test-lead` legt eine Karte mit Feldwerten in „Eingang“ an. Steht im Board gerade ein passender Filter (z. B. Paket des Testleads), erscheint die Karte nach dem nächsten Nachladen des Boards; passt sie nicht, bleibt sie ausgeblendet.
   - `POST /board/reconcile` lässt den Hub alle Seiten des Boards lesen (`limit=100`, 11 Seiten bei 1.000+ Karten). Der Hub nutzt die neuen Parameter nicht und braucht keine Änderung; die Client-Typen lassen sich bei Bedarf mit `pnpm kaneo:spec:pull && pnpm kaneo:client:gen` auffrischen.
5. API direkt: `curl -H "Authorization: Bearer <key>" "http://localhost:1337/api/task/tasks/<id>?customFields=%7B%22<feldId>%22%3A%5B%22P2%22%5D%7D&labels=%5B%22Kampagne%20A%22%5D&limit=100"` — `pagination.total` ist die Trefferzahl.

---

## 5. Grenzen und Folgearbeiten

- Negierte Filter, Fälligkeit, Zuständige, Priorität und Suche filtern weiter im Browser; sie sind im Pool selten das einschränkende Kriterium. Sollten sie es werden, lassen sie sich nach demselben Muster serverseitig ergänzen (`task-filter-params.ts`, `get-tasks.ts`, `server-filters.ts`).
- Mit aktivem Serverfilter wird in einer Spalte nicht umsortiert, und eine verschobene Karte bekommt `max(sichtbare Positionen)+1`; das kann mit der Position einer ausgeblendeten Karte zusammenfallen (Sortierschlüssel ist `position, id`, also kein Fehler, nur eine unbestimmte Reihenfolge zwischen den beiden).
- ~~Feldwert-Änderungen durch den Hub lösen weiterhin kein Realtime-Ereignis aus~~ — erledigt in PEGA-90 ([Bericht](2026-10-live-updates-deutsch.md)): eine gefilterte Ansicht lädt bei einer Feldänderung neu.
- Die Label-Filteroptionen des Boards laden alle Label-Zeilen des Workspace (eine je Karte); bei zehntausenden Karten wächst dieser Request. Das ist Upstream-Verhalten und nicht Teil dieser Story.

---

## 6. Konfliktpotenzial beim Upstream-Abgleich

- `get-tasks.ts`, `task/schema.ts`, `use-get-tasks.ts`, `kanban-board/index.tsx` und `board.tsx` ändert Upstream häufig. Alle Fork-Stellen sind klein und mit `Pegasus fork (PEGA-89)` kommentiert; `task-list-filters.test.ts` und die Web-Tests aus Abschnitt 3.1 melden, wenn beim Auflösen etwas verloren geht.
- Die beiden korrigierten Upstream-Fehler (Karten-Cache, Multiselect) dürfen beim Sync nicht zurückkommen; die Tests `use-task-filters-with-labels-support.test.tsx` („filters unopened cards …“) und `task-matches-filters.test.ts` („matches any selected option …“) sichern das.
- PR #11 (PEGA-88) berührt andere Dateien; gemeinsam sind nur `docs/fork-eingriffe.md` (Zeile und Abschnitt), `apps/docs/openapi.json` (nach dem Merge neu erzeugen) und `docs/review/2026-10-custom-fields.md` (je eine Zeile in Abschnitt 4 und 6).
- Bekommt Upstream eigene Filterparameter in der Task-Liste, die Fork-Parameter darauf abbilden statt beide zu pflegen.
