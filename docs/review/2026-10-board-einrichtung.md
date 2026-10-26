# Board „Bewerber-Pool“ per Skript einrichten — Umsetzung und Nachweis

| | |
|---|---|
| **Story** | PEGA-84: Als Innendienst möchte ich ein Board, das dem Prozess entspricht, damit der Stand eines Bewerbers an der Spalte ablesbar ist. Inhalt: ein Board für alle Kampagnen, Spalten nach dem Prozess aus Kapitel 5; Labels für Kampagne, Quelle und Paket; reine Konfiguration, kein Code. Nachtrag 23.10.2026: ein System für mehrere Vertriebswege (WWK, 1zu1, später Clarus); der Vertriebsweg wird Merkmal an Karte und Nutzer; ob ein gemeinsamer Workspace oder je Vertriebsweg einer, klärt IAMDS. |
| **Mit erledigt** | Story „Standardfelder“ (Grundfelder): Telefon, E-Mail, PLZ und Ort, Geburtsjahr, aktuelle Tätigkeit, Quelle, Kampagne, Paket mit Feldtypen und Pflichtangaben. Der Nachtrag dieser Story (Telefon und E-Mail als anklickbare Links) braucht Code und läuft als eigene Story (Abschnitt 5). |
| **Bezug** | Feinkonzept v3.10, Kap. 5 (Prozess), Kap. 7 (ein Board, Kampagnen als Merkmal), Kap. 11 Baustein 2, 2b und 3; [Custom Fields](2026-10-custom-fields.md) §2.5; [Zeilenfilter](2026-10-zeilenfilter-fuehrungskraft.md) §1 und §6; [Betriebshandbuch: Board einrichten](../board-einrichtung.md); [Register der Fork-Eingriffe](../fork-eingriffe.md) |
| **Stand** | 2026-10-26, Fork `IAMDS-GMBH/pegasus-board`, Branch `th_PEGA-84` auf Basis `main` @ `931068ed` |
| **Autor** | IAMDS |

Pfadangaben beziehen sich auf die Repo-Wurzel.

---

## 0. Ergebnis auf einer Seite

| Abnahmekriterium | Befund |
|---|---|
| Die Spalten bilden den Prozess vollständig ab. | **Erfüllt.** Zehn Spalten in Prozessreihenfolge, gegliedert in drei Bereiche: Pool (Eingang, Pegasus-Pool, Telefonqualifizierung), Führungskraft (Zugeordnet, Kontaktiert, Termin vereinbart, Wiedervorlage) und Abschluss (Einstellungsbereit / Übergabe BSI, Rückgabe an Pegasus, Ablage). „Einstellungsbereit / Übergabe BSI“ und „Ablage“ sind Erledigt-Spalten. Das entspricht Kap. 5: Die Karte gilt dort als erledigt, und Erinnerungen enden. Kaneos Standardspalten sind entfernt (Abschnitt 1, Bild `board-setup-columns.png`). |
| Labels für Kampagne, Quelle und Paket sind angelegt und filterbar. | **Erfüllt.** Angelegt sind 16 Workspace-Labels mit Gruppenpräfix: Quelle (4), Paket (3), Vertriebsweg (3), „Kampagne: ohne Kampagne“ und die Prüf- und Rückgabe-Labels des Hubs (5). Kampagnen-Labels legt laut Baustein 2b der Hub je Kampagne an. Der Board-Filter „Labels enthält Paket 1“ zeigt im Browser 2 von 3 Karten, „Quelle ist Meta“ 1 von 3 (Abschnitt 3.2). |
| Der Aufbau ist dokumentiert und reproduzierbar. | **Erfüllt.** Die Vorgabe steht in `scripts/board-setup/board.json` und wird von `scripts/board-setup/setup-board.mjs` über die REST-API mit API-Schlüssel eingerichtet. Ein Probelauf zeigt die Änderungen vorab. Ein zweiter Lauf meldet „Keine Änderungen.“. Abweichungen nach Änderungen in der Oberfläche (umbenannte Spalte, geänderte Labelfarbe, entfernter Auswahlwert) stellt ein erneuter Lauf wieder her. Anleitung: [Betriebshandbuch](../board-einrichtung.md). |
| *Standardfelder:* Alle Standardfelder sind angelegt und an der Karte pflegbar. | **Erfüllt für die Grundfelder** der Story, ergänzt um „Vertriebsweg“ aus dem PEGA-84-Nachtrag. Alle zehn Felder erscheinen in der Kartenansicht unter „Felder“ und sind dort bearbeitbar (Bild `board-setup-task.png`). Die übrigen Felder aus Baustein 3 und 7 sind fachlich noch offen (Abschnitt 5). |
| *Standardfelder:* Die Feldtypen passen zum Inhalt (Datum, Auswahl, Zahl, Text). | **Erfüllt.** Quelle, Paket und Vertriebsweg sind Auswahlfelder, Geburtsjahr ist eine Zahl, alle anderen sind Text. PLZ ist bewusst Text, weil eine Zahl führende Nullen verliert (z. B. `01067` Dresden). Kein Grundfeld ist ein Datum; Datumsfelder (Termin, Einwilligung am …) kommen mit den offenen Feldern. Telefon und E-Mail werden mit der Folgestory zu eigenen Typen (Abschnitt 5). |

**Entscheidung zum Nachtrag (Vertriebsweg):** Es bleibt ein gemeinsamer Workspace mit einem Board. Der Vertriebsweg steht als Auswahlfeld und als Label an jeder Karte.

Gründe:
- Pegasus sieht alle Vertriebswege in einer Sicht.
- Karten bleiben zwischen Führungskräften verschiebbar. Kaneo verschiebt Karten nur innerhalb eines Workspace.
- Labels, Felder, Webhooks und die Hub-Konfiguration existieren nur einmal.

Getrennte Workspaces würden zwar isolieren, nehmen dem Innendienst aber die Gesamtsicht. Mit Clarus kämen außerdem eine dritte Konfiguration und ein dritter Adapter dazu. Das ist dieselbe Abwägung wie in Feinkonzept Baustein 4, „Geprüfte Alternative“.

Was sichtbar ist, entscheidet heute die Rolle über den Zeilenfilter „nur zugewiesene Karten“. Eine Sicht „nur mein Vertriebsweg“ und der Vertriebsweg am Nutzer sind Folgearbeit (Abschnitt 5).

---

## 1. Verhalten

Das Skript arbeitet in drei Schritten:
1. **Lesen:** Es liest den Ist-Stand aus der API (Projekte des Workspace, Spalten, Workspace-Labels, Felder).
2. **Planen:** Es vergleicht den Ist-Stand mit der Vorgabe und plant nur die Abweichungen. Konflikte, etwa ein Feldtyp, den die API nicht ändern kann, oder ein archiviertes Projekt, stoppen den Lauf, bevor etwas geschrieben wird.
3. **Anwenden:** Es schreibt die geplanten Änderungen. Bei `--dry-run` gibt es den Plan nur aus.

| Gegenstand | Erkannt an | Wird angeglichen | Wird nie gemacht |
|---|---|---|---|
| Projekt | Kürzel `BEW` (ohne Groß-/Kleinschreibung) | Anlage, falls fehlend | Umbenennen, Wiederherstellen aus dem Archiv |
| Spalten | Slug, ersatzweise Name | Anlage, Name, Symbol, Erledigt, Reihenfolge; leere Kaneo-Standardspalten werden entfernt | andere Spalten oder Spalten mit Karten löschen |
| Labels | Name (nur Workspace-Labels, keine Kartenkopien) | Anlage, Farbe | Löschen |
| Felder | Name | Anlage, Pflichtfeld aus, Auf Karte, fehlende Auswahlwerte, Reihenfolge | Löschen, Auswahlwerte entfernen, Typ ändern (außer Auswahl ↔ Mehrfachauswahl) |

**Warum der Slug als Schlüssel dient:** Er ist stabil. Kaneo bildet ihn beim Anlegen aus dem Namen und behält ihn beim Umbenennen. Karten speichern ihn als Status. Wer eine Spalte in der Oberfläche umbenennt, bekommt beim nächsten Lauf den Namen aus der Vorgabe zurück; Karten und Hub-Konfiguration bleiben gültig.

**Warum kein Feld Pflicht ist:** Kaneo verlangt für ein Pflichtfeld einen Standardwert (`apps/api/src/custom-field/assert-valid-definition.ts:71`). Ein Standardwert für Telefon oder E-Mail ergibt keinen Sinn. Pflichtangaben prüft daher der Hub beim Eingang je Kampagne, wie in [Custom Fields](2026-10-custom-fields.md) §2.5 festgelegt. Damit ist der Inhaltspunkt „Pflichtangaben festlegen“ der Standardfelder-Story beantwortet: im Board keine, im Hub je Kampagne.

**Auf der Karte** zeigt das Board vier Felder: Ort, aktuelle Tätigkeit, Kampagne, Paket. Das ist die Auswahl aus Baustein 2 ohne Position und Score, die noch offen sind. Quelle und Vertriebsweg erscheinen auf der Karte als Label.

---

## 2. Umsetzung

Neu ist nur der Ordner `scripts/board-setup/`; an der Anwendung ändert sich nichts. Das Skript braucht nur Node.js ab Version 20 (`fetch`, `node:util` `parseArgs`) und hat keine Paket-Abhängigkeiten. So läuft es auch auf einem Betriebsrechner ohne `pnpm install`.

| Datei | Aufgabe |
|---|---|
| `board.json` | Vorgabe: Projekt, Spalten, Labels, Felder |
| `setup-board.mjs` | Einstieg: Argumente, Ablauf, Ausgabe, `--ids-out` |
| `kaneo-client.mjs` | HTTP mit `Authorization: Bearer`; Basis-URL mit oder ohne `/api`; Fehlermeldung der API im Text; wiederholt bei 429 nach `Retry-After` (Limit 100 Anfragen je Minute und Schlüssel) |
| `plan-project.mjs`, `plan-columns.mjs`, `plan-labels.mjs`, `plan-fields.mjs`, `plan-order.mjs` | reine Funktionen: Vorgabe und Ist-Stand ergeben die Liste der Änderungen |
| `apply-action.mjs` | eine Änderung an die API senden; 409 beim Löschen einer Standardspalte mit Karten wird zum Hinweis |
| `describe-action.mjs` | eine Ausgabezeile je Änderung |
| `to-slug.mjs` | Kopie von `apps/api/src/column/to-slug.ts` |
| `*.test.mjs` | Tests mit `node:test` |

Verwendete Endpunkte:
- `GET`/`POST /api/project`
- `GET`/`POST /api/column/{projectId}`, `PUT`/`DELETE /api/column/{id}`, `PUT /api/column/reorder/{projectId}`
- `GET /api/label/workspace/{workspaceId}`, `POST /api/label`, `PUT /api/label/{id}`
- `GET /api/custom-field/project/{projectId}`, `POST /api/custom-field`, `PUT /api/custom-field/{id}`, `PUT /api/custom-field/reorder/{projectId}`

Weil das Skript über die API geht und nicht direkt in die Datenbank schreibt, gelten dieselben Prüfungen und Rechte wie in der Oberfläche. Offene Boards sehen neue Felder live (PEGA-90).

`package.json` (Wurzel) bekommt das Kommando `board:setup`.

---

## 3. Nachweis

### 3.1 Automatisierte Tests

`node --test "scripts/board-setup/*.test.mjs"`: **31 Tests, alle grün.** Sie decken ab:
- **Neues Projekt:** Alle zehn Spalten werden angelegt, die vier Standardspalten entfernt.
- **Umbenannte Spalte:** Sie wird am Slug erkannt und zurückbenannt.
- **Symbol und Erledigt-Flag:** Abweichungen werden korrigiert.
- **Fremde Spalte:** Sie bleibt stehen und wird gemeldet.
- **Board wie Vorgabe:** Es entstehen keine Änderungen.
- **Labels:**
  - Kartenkopien zählen nicht als Workspace-Label.
  - Eine abweichende Farbe wird korrigiert.
  - Ein Label, das gerade gelöscht wird, wird gemeldet und nicht neu angelegt.
- **Felder:**
  - Anlage fehlender Felder.
  - Ein aktuelles Feld bleibt unverändert.
  - Fehlende Auswahlwerte werden ergänzt, zusätzliche bleiben.
  - Pflichtfeld wird ausgeschaltet, „Auf Karte“ angeglichen.
  - Ein unveränderbarer Typ bricht den Lauf ab.
  - Auswahl ↔ Mehrfachauswahl ist erlaubt.
  - Ein fremdes Feld wird gemeldet.
- **Reihenfolge:** Gewünschte Einträge stehen vorn, Lücken in den Positionen werden geschlossen.
- **Projekt:**
  - Erkennung am Kürzel ohne Groß-/Kleinschreibung.
  - Ein archiviertes Projekt bricht ab.
  - Ein abweichender Name wird gemeldet.
- **Senden:**
  - 409 beim Löschen wird zum Hinweis, andere Fehler brechen ab.
  - Felder werden optional im richtigen Projekt angelegt.
  - Label-Updates senden den Namen mit.
- **HTTP:** Basis-URL, Schlüssel im Header, Fehlermeldung mit Status, Wiederholung bei 429, klare Meldung, wenn statt der API die Web-App (HTML) antwortet.

`pnpm exec vp check scripts/board-setup`: keine Format- oder Lint-Fehler.

### 3.2 Gegen die Entwicklungsumgebung

Die Läufe gingen gegen die lokale API (`pnpm dev`) mit dem API-Schlüssel des Seed-Admins, in einem frischen Workspace „PEGA-84 Test“:

1. **Probelauf:** listet 1 Projekt, 10 Spalten, 16 Labels und 10 Felder zur Anlage. Er schreibt nichts.
2. **Erster Lauf:** 43 Änderungen. Das sind 1 Projekt, 10 Spalten, 4 entfernte Standardspalten, 2 Neuordnungen, 16 Labels und 10 Felder. Die IDs gehen nach `--ids-out`.
3. **Zweiter Lauf:** „Keine Änderungen.“
4. **Abweichungen über die API erzeugt:**
   - Spalte „Eingang“ umbenannt in „Neu eingegangen“.
   - Farbe von „Paket 1“ auf rot gesetzt.
   - Bei „Paket“ den Wert „Paket 3“ durch „Sonderpaket“ ersetzt und „Auf Karte“ ausgeschaltet.

   Der nächste Lauf meldet drei Änderungen und stellt alles wieder her. „Sonderpaket“ bleibt als Hinweis stehen. Der Lauf danach meldet wieder „Keine Änderungen.“
5. **Browser** (Playwright, deutsche Oberfläche): drei Beispielkarten mit Feldwerten und Labels.
   - Filter **Labels enthält „Paket 1“**: zeigt Anna Berger und Lea Schmid, Jonas Keller (Paket 2) ist ausgeblendet.
   - Filter **Quelle ist „Meta“**: zeigt nur Anna Berger.

Bilder:
- `docs/images/board-setup-board.png`: Board mit den ersten Spalten, Karten mit Feldern auf der Karte und Labels
- `docs/images/board-setup-columns.png`: Projekteinstellungen → Workflow, alle zehn Spalten mit Symbol und Erledigt-Schalter
- `docs/images/board-setup-fields.png`: Projekteinstellungen → Benutzerdefinierte Felder, die zehn Felder mit Typ und „Auf Karte“
- `docs/images/board-setup-task.png`: Kartenansicht mit allen Feldern und den Labels Paket, Quelle, Vertriebsweg
- `docs/images/board-setup-filter-label.png`: Board-Filter „Labels enthält Paket 1“
- `docs/images/board-setup-filter-field.png`: Board-Filter „Quelle ist Meta“

---

## 4. Lokal prüfen

1. Datenbank starten, dann `pnpm dev`.
2. Als `admin@seed.test` / `admin123` anmelden.
3. Einen neuen Workspace anlegen und seine ID aus der Adresse übernehmen.
4. Unter Einstellungen → Konto → API-Schlüssel einen Schlüssel anlegen.
5. Das Skript zuerst als Probelauf, dann richtig, dann ein zweites Mal ausführen:
   ```sh
   KANEO_API_KEY=… pnpm board:setup --workspace <ID> --dry-run
   KANEO_API_KEY=… pnpm board:setup --workspace <ID> --ids-out /tmp/board-ids.json
   KANEO_API_KEY=… pnpm board:setup --workspace <ID>   # meldet „Keine Änderungen.“
   ```
6. Projekt „Bewerber-Pool“ öffnen und die Spalten prüfen.
7. Eine Karte anlegen, Felder ausfüllen, Labels setzen und den Filter ausprobieren.
8. Eine Spalte umbenennen und das Skript erneut ausführen: Der Name kommt zurück.

---

## 5. Grenzen und Folgearbeiten

- **Telefon und E-Mail als Links (eigene Story, Code):** Der Typ `url` (PEGA-87) erlaubt nur `http`/`https` (`apps/api/src/custom-field/url-value.ts:26`). Für einen Anruf oder eine Mail mit einem Klick braucht es neue Feldtypen `phone` und `email`. Dazu gehören:
  - Prüfung und Normalisierung, für Telefon E.164
  - Darstellung als `tel:`/`mailto:` in Kartenansicht und Kartenvorschau
  - der Felddialog, i18n und OpenAPI

  Bis dahin sind beide Felder Text. Damit die bestehenden Felder nicht gelöscht und neu angelegt werden müssen, sollte die Story auch den Typwechsel **Text → `phone`/`email`** in `PUT /api/custom-field/{id}` erlauben und dabei die vorhandenen Werte prüfen. Danach genügt es, den Typ in `board.json` zu ändern, in `plan-fields.mjs` den Übergang zuzulassen und das Skript erneut laufen zu lassen.
- **Weitere Felder aus Baustein 3 und 7:** Prüfergebnis, Score, Position, Arbeitgeber, Vermittlerstatus, Wechselmotiv, Verfügbarkeit, Einwilligung, Bestand in AG-VIP, Telefonqualifizierung, Termin, Einstellungsbereit, Rückgabegrund, Absagegrund und Formularantworten sind bewusst nicht angelegt. Typen und Auswahllisten sind noch abzustimmen (Feinkonzept Kap. 19). Ergänzt werden sie später in `board.json`, ohne Code.
- **Vertriebsweg am Nutzer und Sicht je Vertriebsweg:** Kaneo kennt keine Nutzer-Merkmale außer der Rolle. Ein Zeilenfilter „nur Karten meines Vertriebswegs“, etwa als Erweiterung des Zeilenfilters aus PEGA-6, ist ein eigener Fork-Eingriff. Bis dahin sieht eine Führungskraft ohnehin nur ihre zugewiesenen Karten.
- **Rollen** richtet weiter ein Admin von Hand ein (Zeilenfilter §1). Das Skript legt keine Rollen an.
- **Projektname:** Ein abweichender Name des Projekts `BEW` wird nur gemeldet. `PUT /api/project/{id}` verlangt alle Projektfelder einschließlich Sichtbarkeit, und das Skript soll die Sichtbarkeit nie anfassen.
- **Labelnamen sind Schlüssel:** Benennt jemand ein Label in der Oberfläche um, legt das Skript das Label mit dem Vorgabenamen neu an. Das umbenannte Label bleibt bestehen. Der Hub und der Filter arbeiten mit dem Namen.

---

## 6. Konfliktpotenzial

Gering. Neu ist nur `scripts/board-setup/`; dazu kommt eine Zeile in `package.json`. Abhängig ist das Skript von:
- den Pfaden und Feldern der API für Projekte, Spalten, Labels und Custom Fields,
- der Slug-Bildung in `apps/api/src/column/to-slug.ts`, von der `to-slug.mjs` eine Kopie ist,
- den Standardspalten in `apps/api/src/project/controllers/insert-project.ts`, gespiegelt in `DEFAULT_COLUMN_SLUGS` in `plan-columns.mjs`.

Ändert Upstream eines davon, zeigt der Probelauf gegen eine Testumgebung das sofort.
