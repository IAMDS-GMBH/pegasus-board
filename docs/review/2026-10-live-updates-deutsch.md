# Feldänderungen live und deutsche Feldverwaltung — Umsetzung und Nachweis

| | |
|---|---|
| **Story** | PEGA-90: Als Nutzer möchte ich Änderungen sofort sehen und die Oberfläche auf Deutsch haben, damit die Arbeit im Team flüssig läuft. Inhalt: Feldwerte ohne Neuladen aktualisieren; deutsche Beschriftung der Feldverwaltung und der Feldtypen |
| **Bezug** | [Custom Fields](2026-10-custom-fields.md) Abschnitt 4 und 6 (Positionen „Deutsche Oberfläche“ und „Realtime bei Feldwert-Änderung“); [Serverseitiger Filter](2026-10-filter-serverseitig.md) Abschnitt 5; Feinkonzept v3.10, Kap. 4 (deutsche Oberfläche, Board bleibt aktuell); [Register der Fork-Eingriffe](../fork-eingriffe.md) |
| **Stand** | 2026-10-22, Fork `IAMDS-GMBH/pegasus-board`, Branch `th_PEGA-90` auf Basis `main` @ `91d7207f` |
| **Autor** | IAMDS |

Pfadangaben beziehen sich auf die Repo-Wurzel.

---

## 0. Ergebnis auf einer Seite

| Abnahmekriterium | Befund |
|---|---|
| Eine Feldänderung durch einen anderen Nutzer erscheint ohne Neuladen | **Erfüllt.** Zwei getrennte Browser-Sitzungen. Sitzung A ändert eine PLZ über die API, Sitzung B zeigt den neuen Wert auf der Board-Karte nach **rund 180 ms**, ohne Neuladen der Seite. Ebenso live in B: eine neu angelegte Karte mit Feldwerten, ein neues Feld mit Standardwert (erscheint auf allen Karten) und eine Wertänderung in der geöffneten Kartenansicht (Abschnitt 3.2). |
| Die Feldverwaltung ist vollständig auf Deutsch | **Erfüllt.** Übrig waren fünf englische Stellen: Typname „Dropdown“, „True“/„False“ im Board-Filter, Monats- und Wochentagsnamen im Kalender, englische Fehlermeldungen der API in Toasts und ein englisches Label der Kalendernavigation. Alle fünf sind jetzt deutsch (Abschnitt 2.3). Ein Test schlägt fehl, sobald ein Text der Feldverwaltung in `de-DE` wieder dem englischen gleicht. |

**Vorab geprüft:**
- **PR #13 (PEGA-92, WWK-Branding):** berührt weder Custom Fields noch WebSocket noch die Feld-Schlüssel in i18n. Deshalb setzt diese Story direkt auf `main` auf. Überschneidung siehe Abschnitt 6.
- **Upstream Kaneo** (`upstream/main` @ `2847dbd8`): veröffentlicht für Custom Fields keine Ereignisse und hat keine neueren deutschen Texte dafür.

---

## 1. Verhalten

**Live-Aktualisierung.** Offene Ansichten anderer Nutzer folgen jeder Feldänderung ohne Neuladen. Das gilt für Board, Liste, Backlog, Kalender, Gantt und die Kartenansicht. Die Mobile-App lädt bei jeder Projekt-Nachricht ohnehin nach und folgt damit ebenfalls. Im Einzelnen:
- **Feldwert gesetzt oder geleert** (Web, Mobile, MCP, Hub per API-Key): Kartenvorschau, Kartenansicht und die Werteliste des Filters laden die Werte neu.
- **Feld angelegt, bearbeitet, umsortiert oder gelöscht:** Felddefinitionen, alle Werte und das Board laden neu. Damit erscheinen auch ein neues Feld, Standardwerte auf bestehenden Karten, die Einstellung „Auf Karte anzeigen“ und umbenannte Optionen.
- **Karte mit Feldwerten angelegt:** die neue Karte zeigt ihre Felder sofort.
- **Aktiver Feldfilter (PEGA-89):** Ändert sich ein Wert, lädt das Board die Treffer neu. Eine Karte, die nicht mehr passt, verschwindet; eine, die jetzt passt, erscheint.

Wer die Änderung selbst macht, aktualisiert wie bisher über die eigene Mutation. Die WebSocket-Nachricht überspringt das auslösende Fenster.

**Deutsche Feldverwaltung:**

| Typ | Name |
|---|---|
| Text | Text |
| Zahl | Zahl |
| Datum | Datum |
| Kontrollkästchen | Kontrollkästchen |
| Auswahl (vorher „Dropdown“) | Auswahl |
| Mehrfachauswahl (vorher „Dropdown, Mehrfachauswahl“) | Mehrfachauswahl |
| Link | Link |

Die Mobile-App nutzt dieselben Namen; dort stand vorher „Checkbox“ und „Dropdown“.
- Werte von Kontrollkästchen heißen im Filter „Aktiviert“/„Deaktiviert“.
- Der Kalender zeigt Monat, Wochentage und Tagesbeschriftungen für Screenreader in der UI-Sprache. Das gilt für alle Datumsauswahlen der App.
- Fehlermeldungen der Feldverwaltung erscheinen deutsch, z. B. „Aufgaben nutzen noch eine Option, die du entfernt hast. Wähle bei diesen Aufgaben zuerst eine andere Option.“

---

## 2. Umsetzung

### 2.1 API und WebSocket

| Datei | Änderung |
|---|---|
| `custom-field/controllers/set-custom-field-value.ts` | nach dem Speichern `publishEvent("task.updated", { taskId, projectId, customFieldsChanged: true })`; abgelehnte Werte senden nichts |
| `custom-field/controllers/{create,update,delete,reorder}-custom-field.ts` | nach erfolgreichem Schreiben `publishEvent("project.updated", { projectId, customFieldsChanged: true })`; beim Bearbeiten und Umsortieren erst nach dem Commit der Transaktion |
| `task/controllers/create-task.ts` | `task.created` trägt `customFieldsChanged: true`, wenn Feldwerte gespeichert wurden |
| `ws/index.ts`, `ws/broadcast-adapter.ts`, `ws/redis-broadcast-adapter.ts` | Hinweis `customFieldsChanged` in `PROJECT_UPDATED` und den Karten-Nachrichten, bleibt beim 100-ms-Bündeln erhalten (wie `linksChanged`), Valibot-Schema des Redis-Adapters ergänzt. Redis bleibt optional. |

**Warum ein Hinweis statt eines neuen Ereignistyps:** `task.updated` und `project.updated` verarbeitet nur die WebSocket-Schicht; Aktivität, Benachrichtigungen und Webhooks bleiben unberührt. Ohne Hinweis müsste jedes Karten-Update bei allen Clients die Feldwerte des ganzen Projekts neu laden, und das bremst große Boards. Die Nachricht trägt wie bisher nur IDs. Werte holt jeder Client über die API, also unter seinem eigenen Zeilenfilter (PEGA-6).

### 2.2 Web

| Datei | Änderung |
|---|---|
| `hooks/invalidate-custom-field-caches.ts` (neu) | invalidiert bei Karten-Nachrichten `["custom-field-values", taskId]`, `["custom-field-values", projectId]` und `["custom-field-filter-values", projectId]`, bei aktivem Feld-Serverfilter zusätzlich `["tasks", projectId]`; bei `PROJECT_UPDATED` `["custom-fields", projectId]`, alle `["custom-field-values"]` und die Filterwerte |
| `hooks/use-project-websocket.ts` | ruft den Helfer nur für Nachrichten mit `customFieldsChanged` auf |

### 2.3 Deutsche Texte

| Stelle | Vorher | Jetzt |
|---|---|---|
| `i18n/de-DE.json` `settings.customFields.types` | „Dropdown“, „Dropdown, Mehrfachauswahl“ | „Auswahl“, „Mehrfachauswahl“; Mobile entsprechend |
| `task-filters/use-filter-subjects.tsx` | fest „True“/„False“ | `settings:customFields.checked`/`unchecked` |
| `common/date-picker/month-grid.tsx` + `day-picker-text.ts` (neu) | `DayPicker` ohne Sprache: „October 2026“, „Su Mo …“, „Go to the Next Month“, „Navigation bar“ | Monat, Wochentage, Tagesbeschriftung über `Intl` (`formatDate`), Navigation über i18n; keine zusätzlichen date-fns-Sprachpakete im Bundle |
| API-Fehler in Toasts | englischer Text der API | Codes per `ApiError` (`custom-field/field-error.ts`), Übersetzung in `custom-field-error-key.ts`, Texte in `settings.customFields.errors.*`. Unbekannte Fehler zeigen den übersetzten Standardtext („Benutzerdefiniertes Feld konnte nicht gespeichert werden.“). |

**Fehlercodes** (`message` bleibt englisch für API-, MCP- und Hub-Nutzer):

| Code | Wann |
|---|---|
| `CUSTOM_FIELD_NAME_REQUIRED` | leerer Name |
| `CUSTOM_FIELD_DEFAULT_REQUIRED` | Pflichtfeld ohne Standardwert |
| `CUSTOM_FIELD_INVALID_DEFAULT` | Standardwert passt nicht zum Typ |
| `CUSTOM_FIELD_TOO_FEW_OPTIONS` | Auswahl ohne Option, Mehrfachauswahl mit weniger als zwei |
| `CUSTOM_FIELD_TYPE_LOCKED` | Typwechsel außer Auswahl ↔ Mehrfachauswahl |
| `CUSTOM_FIELD_OPTIONS_NOT_ALLOWED` | Optionen an einem Feld ohne Optionen |
| `CUSTOM_FIELD_OPTION_IN_USE` | Option entfernt, die Karten noch nutzen |
| `CUSTOM_FIELD_TASKS_HAVE_MULTIPLE_OPTIONS` | Wechsel zu Auswahl, während Karten mehrere Optionen haben |

Ein `NOT_FOUND` (Feld wurde inzwischen gelöscht) erscheint als „Dieses Feld gibt es nicht mehr. Vielleicht hat es jemand gelöscht.“ Neue Schlüssel stehen in en-US und de-DE. Die übrigen Locales haben den englischen Fallback (`pnpm i18n:check:fix`), und `i18n/schema.json` ist von Hand ergänzt.

**Bewusst unverändert:** „Text“, „Link“ und „Name“ sind auch deutsch. „Enter“ ist die Tastenbezeichnung im Hinweis „Enter zum Speichern“.

---

## 3. Nachweis

### 3.1 Automatisierte Tests (Test zuerst, jeweils rot gesehen)

| Test | Inhalt | Rot vorher | Grün |
|---|---|---|---|
| `tests/api/ws/broadcast.test.ts` | Hinweis bleibt an `PROJECT_UPDATED` und `TASK_UPDATED` beim Bündeln erhalten | Hinweis fehlte in der Nachricht | 2 Tests |
| `tests/api/ws/redis-link-refresh.test.ts` | Redis-Adapter behält den Hinweis | Valibot verwarf das Feld | 1 Test |
| `tests/api-integration/custom-field-live-updates.test.ts` | genau ein Ereignis je gespeicherter Wertänderung (gesetzt, geleert; abgelehnter Wert sendet nichts), je Felddefinitions-Änderung (anlegen, bearbeiten, umsortieren, löschen), keines bei abgelehnten Änderungen; `task.created` nur mit Hinweis, wenn Werte gespeichert wurden | `expected [] …` | 4 Tests |
| `tests/api-integration/custom-field-error-codes.test.ts` | Code je Fehlerfall über HTTP, englische Meldung unverändert | `"code": "BAD_REQUEST"` | 13 Tests |
| `apps/web/src/hooks/use-project-websocket-cache.test.tsx` („custom field live updates“) | Invalidierung bei Wertänderung, Definitionsänderung, Neuladen eines feldgefilterten Boards; keine Feld-Invalidierung bei gewöhnlichen Karten-Updates | keine Invalidierung der Feld-Caches | 4 Tests |
| `custom-field-error-key.test.ts`, `custom-field-dialog.test.tsx`, `custom-field-list.test.tsx` | Code → deutscher Text; unbekannter Fehler → übersetzter Standardtext | Toast zeigte den englischen API-Text | 13 + 2 + 1 Tests |
| `task-filters/use-filter-subjects.test.tsx` | Kontrollkästchen-Werte übersetzt | `"label": "True"` | 1 Test |
| `common/date-picker/month-grid.test.tsx` | „März 2030“, „Mo“/„Montag“, „Donnerstag, 14. März 2030“, „Vorheriger/Nächster Monat“, „Monatsnavigation“ | „October 2026“, „Navigation bar“ | 1 Test |
| `lib/i18n/custom-field-translations.test.ts` | deutsche Typnamen (Web und Mobile); kein englischer Text in `settings.customFields`, `settings.projectCustomFields`, `tasks.customFields`; ein Text je Fehlercode | „Dropdown“, fehlende `errors` | 5 Tests |

Der bisherige Test „keeps the dialog open and shows the API error“ prüfte, dass der englische API-Text im Toast erscheint. Er ist bewusst auf das neue Verhalten umgeschrieben.

**Gesamtläufe:**

| Lauf | Ergebnis |
|---|---|
| Web-Unit-Tests | 318 Dateien, 1.665 Tests grün |
| API-Unit-Tests | 168 Dateien, 1.253 Tests grün |
| API-Integrationstests (gesamt) | 158 Dateien, 1.773 Tests grün, 3 übersprungen |
| `pnpm --filter @kaneo/api typecheck`, `pnpm --filter @kaneo/web typecheck` | grün |
| `vp check` auf allen geänderten Dateien | grün |
| `pnpm i18n:check` | grün (alle Locales synchron) |
| `pnpm openapi:check:fix` | ohne Änderung; Routen und Schemas sind unverändert |

### 3.2 Browser (Entwicklungsstand, deutsche Oberfläche)

Playwright mit zwei getrennten Browser-Kontexten (zwei Fenster-IDs) gegen `pnpm dev`, Nutzer `admin@seed.test`, `locale: de-DE`, Wegwerf-Projekte, die danach gelöscht wurden.

| Schritt in Sitzung A | Sichtbar in Sitzung B ohne Neuladen |
|---|---|
| PLZ 80331 → 10115 | Karte zeigt 10115 nach 178–180 ms |
| neue Karte „Lead Schmidt“ mit PLZ 20095 | Karte mit PLZ erscheint |
| neues Feld „Quelle“, Standard „Messe“, auf Karte | alle Karten zeigen „Quelle Messe“ |
| Paket Plus → Basis bei geöffneter Kartenansicht | Kartenansicht zeigt „Basis“ |

Bei keinem Schritt wurde die Seite neu geladen (0 Navigationen gezählt).

Screenshots:
- `docs/images/live-update-board.png`: Board in B nach Wertänderung, neuer Karte und neuem Feld
- `docs/images/live-update-task.png`: Kartenansicht in B nach der Paket-Änderung
- `docs/images/fields-de-list.png`: Feldliste („Auswahl · Basis, Plus“, „Kontrollkästchen · Standardmäßig deaktiviert“, „Mehrfachauswahl“)
- `docs/images/fields-de-dialog.png`: Dialog „Neues Feld“ mit den deutschen Typnamen
- `docs/images/fields-de-date.png`: Standardwert für ein Datumsfeld, Kalender „Oktober 2026“, „So Mo Di …“
- `docs/images/fields-de-option-in-use.png`: Fehlermeldung beim Entfernen einer genutzten Option
- `docs/images/fields-de-filter.png`: Board-Filter auf ein Kontrollkästchen mit „Aktiviert“/„Deaktiviert“

---

## 4. Lokal prüfen

1. `pnpm dev`, zwei Browserfenster (oder ein normales und ein privates) mit demselben oder zwei Nutzern auf demselben Board.
2. In Fenster 1 einen Feldwert in der Kartenansicht ändern; Fenster 2 zeigt ihn auf der Karte, ohne Neuladen.
3. In Fenster 1 in den Projekteinstellungen unter „Benutzerdefinierte Felder“ ein Feld mit „Auf Karte anzeigen“ und Standardwert anlegen; Fenster 2 zeigt es auf allen Karten.
4. Hub: `PUT /api/custom-field/value` mit dem API-Key des Systemkontos; offene Boards folgen ebenso.
5. Oberfläche auf Deutsch (Profil → Sprache); Feld „Paket“ bearbeiten, eine genutzte Option entfernen, „Speichern“ → deutsche Meldung.

---

## 5. Grenzen und Folgearbeiten

- **Fehler beim Setzen von Werten und beim Anlegen einer Karte** (`set-custom-field-value.ts`, `task/validate-task-fields.ts`, z. B. „This custom field is required“) haben noch keine Codes und erscheinen in der Kartenansicht englisch. Das ist nach Absprache nicht Teil dieser Story; dasselbe Muster (`fieldError` + Schlüssel) lässt sich übertragen.
- **Die Einstellungsseite „Benutzerdefinierte Felder“** hat keine WebSocket-Verbindung. Bearbeiten zwei Administratoren gleichzeitig die Felder, sieht der eine die Änderung des anderen erst beim nächsten Öffnen der Seite. Boards und Kartenansichten sind davon nicht betroffen.
- **Die Texteingabe im Datumsmenü** („Datum festlegen…“, `parse-date-query.ts`) versteht nur englische Ausdrücke wie „next monday“. Das ist Upstream-Verhalten.
- **Spaltennamen** wie „To Do“ und „In Progress“ sind Projektdaten (Standardspalten beim Anlegen), keine Oberflächentexte.

---

## 6. Konfliktpotenzial

- **PR #13 (PEGA-92):** gemeinsam sind `docs/fork-eingriffe.md` (je eine Zeile und ein Abschnitt), `i18n/schema.json` und die Locale-Dateien. Die Locale-Dateien betreffen verschiedene Schlüssel, höchstens benachbarte Zeilen kollidieren; `pnpm i18n:check` nach dem Merge zeigt Lücken. Wer zuletzt merged, löst auf.
- **Upstream-Sync:** siehe [Register, Abschnitt PEGA-90](../fork-eingriffe.md#pega-90--feldänderungen-live-und-deutsche-feldverwaltung).
