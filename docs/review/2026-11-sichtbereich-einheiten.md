# Sichtbereich nach Einheiten aus dem Hub — Board-Teil, Umsetzung und Nachweis

| | |
|---|---|
| **Story** | PEGA-141: Als Nutzer möchte ich genau die Leads meiner Einheit(en) und aller Einheiten darunter sehen – nie nach oben, zur Seite oder in einen anderen Key Account. Hier: der **Board-Teil** (Speicher, Push-API, serverseitiger Filter) |
| **Bezug** | SPEC Rollen & Rechte §0, §3.3, §12; Hub-Teil: `pegasus-hub` Branch `th_PEGA-141`, `docs/BOARD.md` „Sichtbereich“, `docs/review/2026-11-sichtbereich.md`; Vorgänger [Zeilenfilter „nur zugewiesene“ (PEGA-6)](2026-10-zeilenfilter-fuehrungskraft.md); [Register der Fork-Eingriffe](../fork-eingriffe.md#pega-141--sichtbereich-aus-dem-hub) |
| **Stand** | 2026-11-02, Fork `IAMDS-GMBH/pegasus-board`, Branch `th_PEGA-141` auf Basis `main` @ `f23256da` |
| **Autor** | IAMDS |

Pfadangaben beziehen sich auf die Repo-Wurzel.

---

## 0. Ergebnis auf einer Seite

| Abnahmekriterium | Befund im Board |
|---|---|
| Eine BD-Führungskraft sieht nur die Leads ihrer BD; eine FD-Führungskraft sieht alle BD ihrer FD | **Erfüllt.** Mit dem Stand `[U3]` (BD 405) liefern Board-Liste, Suche, Export, Einzelkarte, Beschreibung, Ticket-ID, Feldwerte und Aktivitäten genau L1 und L2; L3, L4, L5, L6, M1 antworten 404 oder fehlen. Mit `[U2, U3, U4]` (FD 300) genau L1, L2, L3, L5. |
| Ein Nutzer mit drei BD aus drei FD sieht genau diese drei BD | **Erfüllt.** `[U3, U6, U8]` → genau L1, L2, L4, L6 (Board und Suche). |
| Kein Nutzer sieht Leads eines anderen Key Accounts | **Erfüllt.** M1 (1zu1, V3) erscheint nur bei `all`. Eine Karte ohne Einheit erscheint nur bei `all`. |
| Durchsetzung serverseitig für Board, Suche, Einzelaufruf, Export, Benachrichtigungen, Anhänge | **Erfüllt** und getestet (Abschnitt 4). Benachrichtigungen: Eine @Erwähnung außerhalb des Sichtbereichs erzeugt nichts und versendet keine E-Mail; eine ältere Benachrichtigung verschwindet aus der Liste und wird nicht mehr zugestellt, sobald die Karte den Sichtbereich verlässt. Anhänge: 404. |

**Entscheidung: Der Hub berechnet, das Board filtert.** Der Fork kennt keine Hierarchie. Er speichert je Nutzer (E-Mail) den Modus und die schon flach gerechneten sichtbaren Einheiten sowie je Karte die Einheit ihres Leads, und er filtert mit **einem** SQL-Prädikat. Dieses Prädikat ersetzt den Zeilenfilter aus PEGA-6 und schließt dabei die dort offen gebliebenen Lücken (Abschnitt 3).

---

## 1. Verhalten

| Thema | Verhalten |
|---|---|
| Wen es betrifft | Mitglieder, deren Rolle (eine ihrer kommagetrennten Rollen) „Sicht aus dem Hub (Einheiten)“ trägt (`workspace_role.hub_scoped`). Nicht betroffen: Instanz-Admins, `owner`, Rollen ohne Schalter (Administrator, Systemkonto „Pegasus-Hub“), API-Key-Scopes heben die Einschränkung weder auf noch erzeugen sie sie. |
| Modus `all` | sieht alles (Plattform-Admin, Lesezugriff Management). |
| Modus `units` | sieht eine Karte genau dann, wenn ihre Einheit (`pegasus_task_unit`) in der übertragenen Menge liegt. Karte ohne Einheit: unsichtbar. |
| Modus `assigned` | sieht nur Karten, die ihm zugewiesen sind (Bearbeiter). |
| Nicht im Stand | sieht nichts (fail closed). Der Hub lässt inaktive Nutzer und Nutzer ohne gültige Zuordnung weg. |
| Zusammen mit „Nur zugewiesene“ | Trägt eine Rolle beide Schalter, ist eine Karte sichtbar, wenn **eine** der beiden Einschränkungen sie zulässt. „Nur zugewiesene“ allein verhält sich wie bisher. |
| Verdeckte Karte | antwortet 404 „Task not found“ wie eine nicht existierende; Bulk 404 „No tasks found“; Anhang 404 „Asset not found“. |
| Arbeiten im Sichtbereich | unverändert nach Rollenrechten: Die BD-Führungskraft ändert und verschiebt L1. Ein Umsortieren, das eine verdeckte Karte enthält, antwortet 404 und ändert nichts; der Snapshot-Vergleich (`expectedTasks`) zählt nur sichtbare Karten, ein Ziehen scheitert also nicht mehr an verdeckten Karten derselben Spalte (vorher 409). |
| Kalender-Feed, Integrations-Abgleich | für eingeschränkte Rollen 403 (wie bei „Nur zugewiesene“). |
| Zuordnung zum Konto | über die E-Mail, kleingeschrieben, beim Lesen gegen `user.email` verglichen. Wer sich später registriert, hat den Sichtbereich sofort. |
| Aktualität | Jede Anfrage liest den gespeicherten Stand. Ein neuer Stand wirkt ab der nächsten Anfrage; offene Boards sehen ihn beim nächsten Laden. Die Push-API sendet **kein** Live-Ereignis (der Hub überträgt alle 5 Minuten und nach jeder Änderung). |

### Push-API für den Hub

Alle Routen verlangen `workspace:manage_settings` im Workspace (Systemkonto „Pegasus-Hub“ = Administrator); alle anderen erhalten 403. Nur diese Routen lesen oder schreiben die Tabellen `pegasus_*`.

| Route | Verhalten |
|---|---|
| `PUT /api/pegasus-visibility/workspace/{workspaceId}/users` | Body `{ users: [{ email, mode, unitIds }] }`. Ersetzt den ganzen Stand des Workspaces in einer Transaktion. 400 bei doppelter E-Mail (nach Kleinschreibung), `unitIds` bei einem anderen Modus als `units`, unbekanntem Modus oder ungültiger E-Mail; dann bleibt der alte Stand. Antwort `{ users: n }`. |
| `GET /api/pegasus-visibility/workspace/{workspaceId}/users` | aktueller Stand, nach E-Mail sortiert, mit `updatedAt` (zur Prüfung). |
| `PUT /api/pegasus-visibility/task/{taskId}/unit` | Body `{ unitId: string \| null }`; `null` entfernt die Einheit. Unbekannte Karte 404. Antwort `{ taskId, unitId }`. |
| `PUT /api/pegasus-visibility/workspace/{workspaceId}/tasks` | Body `{ tasks: [{ taskId, unitId }] }`, Upsert; nicht genannte Karten behalten ihre Einheit. Eine unbekannte oder fremde Karte → 400 mit den IDs, nichts geschrieben. Antwort `{ tasks: n }`. |

Den `workspaceId` liest der Hub aus `GET /api/project/{id}`. Beide Listen sind auf 10 000 Einträge begrenzt.

---

## 2. Umsetzung

| Datei | Aufgabe |
|---|---|
| `apps/api/drizzle/0066_pegasus_visibility.sql`, `apps/api/src/database/schema.ts`, `database/index.ts` | Spalte `workspace_role.hub_scoped`; Tabellen `pegasus_user_scope` (PK Workspace + E-Mail, Check auf den Modus, FK Workspace cascade), `pegasus_user_scope_unit` (FK auf den Stand, cascade), `pegasus_task_unit` (PK/FK Karte cascade, Index auf `unit_id`). Idempotent (`IF NOT EXISTS`, Constraints im `CREATE TABLE`). |
| `apps/api/src/task-scope/` (**neu**) | `composeTaskScope` (reine Regel, beide Schalter + Stand → Sichtbereich), `loadTaskScopes(userId, workspaceIds?)` (ohne Hono-Kontext, für Benachrichtigungen), `resolveTaskScope(c)` (je Request gemerkt), `taskVisibleCondition(scope)` / `tasksVisibleCondition(scopes)` (das eine SQL-Prädikat, auch für mehrere Workspaces), `assertTasksVisible(c, ids)`, `assertAssetTaskVisible`, `denyTaskScoped`. Ersetzt `utils/assigned-only-scope.ts`. |
| `apps/api/src/pegasus-visibility/` (**neu**) | Push-API (Abschnitt 1), OpenAPI-Tag „Pegasus visibility“. |
| `apps/api/src/utils/workspace-access-middleware.ts` | Der gemeinsame Lookup liefert die Karten-ID statt des Assignees; geprüft wird mit `assertTasksVisible` nach der Mitgliedschaft (40 Routen). |
| Einzeiler bzw. ein Parameter in Upstream-Dateien | Board-Liste, Subtask-Zähler, Einzelkarte (`?view=board`), Export, Beschreibungsseiten, Ticket-ID, Suche (drei Karten-Queries), Workspace-Aktivitäten, Feldwerte und Filterwerte, Projektstatistik, Labels (Liste, Anlegen, Zuweisen), Relationen (Middlewares, Liste, Anlegen, Löschen), Umsortieren, Benachrichtigungen (`notificationResourceAccess` mit **Pflicht**-Parameter `taskScopes`, Zustellung, Spaltenzähler der E-Mail), Anhänge (`authorize-asset-access.ts`), Kalender-Feed und Integrations-Abgleich (`denyTaskScoped`). |
| `auth.ts`, `auth-openapi.ts`, `packages/permissions` (`roleRestrictions.task.view_hub_scoped`) | Rollenfeld `hubScoped` wie `assignedOnly`: über create-role / update-role, also nur Owner und Admin; eine eingeschränkte Rolle kann es nicht selbst aufheben. |
| Web: `settings/workspace/roles.tsx`, `use-*-workspace-role(s).ts`, `lib/auth-client.ts` | Schalter „Sicht aus dem Hub (Einheiten)“ unter „Aufgaben“ neben „Nur zugewiesene“; beide Einschränkungen laufen jetzt über eine Liste aus `roleRestrictions`. |
| `i18n/*.json`, `i18n/schema.json` | `settings.workspaceRoles.permissions.task.view_hub_scoped` (de-DE, en-US; übrige Locales mit englischem Platzhalter). |

**Warum der Sichtbereich in JS aufgelöst wird und nicht in reinem SQL:** Ein uneingeschränkter Nutzer (Admin, Owner, Hub) bekommt gar kein Prädikat und keine Zusatzabfrage; ein eingeschränkter zahlt eine Abfrage je Request (Rollen, Stand) und je Kartenzeile einen Index-Zugriff auf `pegasus_task_unit`. Der Board-Filter (PEGA-89, unter 2 s bei 1 000 Karten) bleibt so unberührt.

---

## 3. Umgehungsmöglichkeiten (Tabelle aus PEGA-6, Abschnitt 4 und Nachtrag, fortgeschrieben)

Status: **gedeckt** = geschlossen und getestet · **akzeptiert** = bewusst offen, kein Datenabfluss · **offen** = nicht Teil dieser Story. Alle gedeckten Punkte gelten für beide Einschränkungen (Hub-Sicht und „Nur zugewiesene“), weil beide dasselbe Prädikat nutzen.

| # | Fläche | Vorher | Jetzt |
|---|---|---|---|
| 1–6 | Board-Liste, Einzelkarte, karten-gebundene Routen (Lookup), Export, Suche, Beschreibungsseiten | gedeckt (nur Assignee) | **gedeckt** für beide Einschränkungen |
| 7 | MCP-Tools | gedeckt (erbt über HTTP) | gedeckt (erbt), kein eigener Smoke-Test |
| 8 | Labels je Workspace; `POST /label` und `PUT /label/{id}/task` ohne Prüfung der Ziel-Karte | offen | **gedeckt**: Liste blendet Labels verdeckter Karten aus; Anlegen und Zuweisen auf eine verdeckte Karte → 404 |
| 9 | Task-Relationen (Gegenseite, Anlegen/Löschen prüften nur die Quellkarte bzw. gar nicht) | offen | **gedeckt**: Gegenseite gefiltert, Quelle in beiden Middlewares geprüft, Ziel beim Anlegen und beide Enden beim Löschen → 404 |
| 10 | Custom-Field-Werte und Filterwerte je Projekt | gedeckt (PEGA-5) | **gedeckt** für beide Einschränkungen |
| 11 | Projektstatistik | offen | **gedeckt**: Zähler, Fertigstellungsgrad und früheste Fälligkeit nur über sichtbare Karten |
| 12 | Benachrichtigungen (Anlegen, Liste, Zustellung, E-Mail) | offen | **gedeckt**: `notificationResourceAccess` prüft den Sichtbereich des Empfängers; gilt für Anlegen (`persistNotification`), Liste, Gelesen/Löschen/Leeren und Zustellung (E-Mail, ntfy, Gotify, Webhook). Der Spaltenzähler in der E-Mail zählt nur sichtbare Karten. |
| 13 | WebSocket-Broadcasts an alle Projektverbindungen | akzeptiert | **akzeptiert** (unverändert): Die Nachrichten tragen nur IDs, Ereignistyp und beim Umsortieren Position und Status; das Nachladen einer verdeckten Karte antwortet 404. Ein Filter je Verbindung bleibt optional. |
| 14 | Anhänge per Asset-ID | offen | **gedeckt**: Ein Asset mit Karte (direkt oder über den Kommentar) braucht eine sichtbare Karte, sonst 404 |
| 15 | Kalender-Feed | gedeckt (`denyAssignedOnly`) | **gedeckt** (`denyTaskScoped`, 403 für beide Einschränkungen) |
| 16 | Öffentliches Projekt | akzeptiert durch Konfiguration | unverändert: „Bewerber-Pool“ nie öffentlich; öffentliche Beschreibungsbilder umgehen jede Anmeldung |
| 17 | Export-Schutz je Rolle | offen | unverändert offen (nicht Teil dieser Story); der Export ist gefiltert |
| 18 | Subtask-Zähler, `parentSubtaskCounts` | offen | **gedeckt**: Zähler nur über sichtbare Unteraufgaben, verdeckte Elternkarten fehlen |
| 19 | 400 vs. 404 | geschlossen durch Upstream | unverändert |
| 20 | Bulk mit nicht existenter ID | akzeptiert | unverändert |
| 21 | Detail-Sheet ohne „nicht gefunden“ | offen (UX) | unverändert offen (kein Datenabfluss) |
| 22 | Import | akzeptiert durch Konfiguration | unverändert |
| 23 | Mehrfachrollen | geschlossen | gilt auch für die Hub-Sicht (Test „member,fuehrungskraft“) |
| 24 | `POST /task/reorder` | offen | **gedeckt**: verdeckte Karte → 404, nichts verschoben; Snapshot-Vergleich nur über sichtbare Karten |
| 25 | **neu:** `DELETE /column/{id}` zählt alle Karten der Spalte; 409 verrät, dass verdeckte Karten existieren | — | **offen**, niedrig (keine Inhalte; braucht ein Spalten-Löschrecht, das Führungskraft und Innendienst nicht haben) |
| 26 | **neu:** `POST /task/duplicate/{id}` übernimmt die Subtask-Verknüpfungen der Quellkarte, auch zu verdeckten Elternkarten | — | **offen**, niedrig (keine Inhalte; braucht `task:create`) |

---

## 4. Nachweis

Test-first je Verhalten (rot → grün → refactor). Rot gesehen (Auszug):

- Rolle: `expected undefined to be true` (Spalte fehlte), danach grün.
- Push-API: `expected 404 to be 200` (Routen fehlten), danach 16 grün.
- `composeTaskScope`: `Cannot find module` (neues Modul), danach 10 grün.
- Durchsetzung: 23 von 27 rot, z. B. `expected [ 'L1', 'L2', 'L3', 'L4', 'L5', …(3) ] to deeply equal [ 'L1', 'L2' ]`, `L3: expected 200 to be 404`, `expected 409 to be 200` (Umsortieren), `expected 8 to be 2` (Projektstatistik); die vier grünen waren die uneingeschränkten Fälle (`all`, Innendienst, Owner) und „BD-FK ändert L1“.
- Benachrichtigungen: `expected [ { …(11) }, { …(11) } ] to deeply equal []` (Erwähnung in Kommentar und Beschreibung auf L4); Spaltenzähler `count: 8` statt 2.
- Anhänge: `expected 200 to be 404`.
- Rolleneditor: Schalter „Visibility from the Hub (units)“ nicht gefunden; Rechte-Paket: `view_hub_scoped` fehlte in `roleRestrictions`.

Tests:

- `tests/api-integration/workspace-role-hub-scoped.test.ts` (3): Owner und Admin legen an, listen und ändern `hubScoped`; die eingeschränkte Rolle hebt es nicht auf (403).
- `tests/api-integration/pegasus-visibility-api.test.ts` (16): Stand speichern und lesen, Kleinschreibung, zweiter Stand ersetzt den ersten, andere Workspaces unberührt, 400 (doppelte E-Mail, `unitIds` bei anderem Modus, unbekannter Modus, ungültige E-Mail; alter Stand bleibt), 403 für Mitglieder (lesen und schreiben), API-Key des Hubs, Karten-Einheit setzen/ändern/entfernen, 404 für unbekannte Karte, Bulk-Upsert behält nicht genannte Karten, fremde/unbekannte Karte → 400 mit IDs und nichts geschrieben, doppelte Karte → 400.
- `tests/api-integration/task-view-hub-scope.test.ts` (28) auf dem Testbaum aus SPEC §12 (`tests/api-integration/helpers/hub-scope-fixture.ts`): alle Lesepfade für fkBD; die Mengen für fkFD, drei BD aus drei FD, `all`, `assigned`, ohne Stand, Innendienst ohne Schalter; Suche über dieselbe Menge; Nutzer fällt aus dem Stand; Owner; Mehrfachrolle; beide Schalter zusammen; Kalender-Feed und Integrations-Abgleich 403; Ändern und Verschieben von L1; Umsortieren mit L4 → 404; Snapshot-Vergleich; Anhänge; Labels; Relationen; Projektstatistik; Subtask-Zähler.
- `tests/api-integration/notification-hub-scope.test.ts` (5): Erwähnung auf L4 (Kommentar und Beschreibung) erzeugt nichts und sendet keine E-Mail; Erwähnung auf L1 benachrichtigt; nach neuem Stand verschwindet die Benachrichtigung aus der Liste, „gelesen“ antwortet 404, die Zustellung sendet nichts; E-Mail innerhalb des Sichtbereichs; Spaltenzähler.
- `tests/api/task-scope/compose-task-scope.test.ts` (10): Regel für alle Modi und Schalter.
- Web `roles.test.tsx` (+2), Rechte-Paket `index.test.ts` (angepasst).
- **Bestehende Suiten unverändert grün:** `task-view-assigned-only.test.ts` (25), `workspace-role-assigned-only.test.ts` (4), `notification-access.test.ts`, `asset-visibility.test.ts`.

**Offen geänderte bestehende Tests:**
- `task-view-assigned-only.test.ts`: Der direkte Aufruf von `globalSearch` übergab `assignedOnlyWorkspaceIds`. Die Suche ermittelt den Sichtbereich jetzt selbst aus dem Nutzer, der Parameter entfällt; der Test prüft dasselbe Verhalten ohne den Hinweis und bleibt grün.
- `tests/api/utils/assigned-only-scope.test.ts` entfernt: Die geprüfte Funktion (`assertTasksVisible` über Assignees) gibt es nicht mehr; die 404-Semantik für Einzel- und Bulk-Zugriff prüfen die Integrationstests.
- `tests/api/utils/authorize-asset-access.test.ts`: mockt die neue Asset-Prüfung, weil sie die Datenbank liest (Unit-Tests laufen ohne Datenbank).
- `roles.test.tsx`: Rollen-Fixtures und erwartete Aufrufe enthalten `hubScoped: false`.

Gelaufen (2026-11-02): siehe Abschnitt 6.

---

## 5. Konfiguration im Board

Rollen Führungskraft, Innendienst und Bearbeiter bekommen „Sicht aus dem Hub (Einheiten)“ ([Board-Einrichtung](../board-einrichtung.md#5-nicht-teil-des-skripts)); für Bearbeiter sendet der Hub `assigned`. Administrator und das Systemkonto „Pegasus-Hub“ bleiben ohne Schalter. Ohne Schalter wirkt der übertragene Stand nicht; ohne Stand sieht eine Rolle mit Schalter nichts. Reihenfolge bei der Umstellung: erst die Push-API vom Hub befüllen lassen (Karten-Einheiten und Nutzer), dann die Schalter setzen.

**Für den Hub:** `KANEO_REF=<Commit> pnpm hub kaneo:spec:pull` holt `apps/docs/openapi.json` von GitHub; der Commit muss also gepusht sein. Operation-IDs: `replacePegasusUserScopes`, `getPegasusUserScopes`, `setPegasusTaskUnit`, `setPegasusTaskUnits`.

---

## 6. Gelaufen

Am 2026-11-02 auf `th_PEGA-141`, alle grün:

- `pnpm test` — alle Pakete; API-Unit 172 Dateien / 1 298 Tests, Web 322 / 1 718, Rechte-Paket 12. Die API-Unit-Suite lief zusätzlich gegen eine unerreichbare `DATABASE_URL` grün (kein Unit-Test greift über die neuen Module auf die Datenbank zu).
- `pnpm test:integration` — 163 Dateien, 1 840 Tests bestanden, 3 übersprungen (vorhandene `skip` in `integration-sync-providers.test.ts`), gegen PostgreSQL (`kaneo_test`).
- `pnpm typecheck`, `pnpm lint` (`vp check`, 4 052 Dateien formatiert, keine Lint-Fehler), `pnpm i18n:check`, `pnpm openapi:check` (`apps/docs/openapi.json` aktuell).
- `pnpm --filter @kaneo/api db:generate` (Snapshot und Journal 0066), SQL danach durch die idempotente Fassung ersetzt.
- **Nicht gelaufen:** keine Browser-Sitzung; der Schalter im Rolleneditor ist per Komponententest belegt, die Durchsetzung liegt vollständig in der API. Kein Lasttest mit 1 000 Karten für eine eingeschränkte Rolle; `task-list-filters.test.ts` (1 000 Karten, uneingeschränkt) lief grün.
