# Board „Bewerber-Pool“ einrichten

Betriebshandbuch, Abschnitt Board-Konfiguration. Das Skript `scripts/board-setup/setup-board.mjs` richtet das Board in einem bestehenden Workspace ein: Projekt, Spalten, Labels und Standardfelder. Die Vorgabe steht in `scripts/board-setup/board.json`. Hintergrund und Nachweis: [Review PEGA-84](review/2026-10-board-einrichtung.md).

Das Skript ändert nur, was von der Vorgabe abweicht. Es kann daher auf jeder Umgebung beliebig oft laufen, auch nach Änderungen an der Vorgabe.

## 1. Voraussetzungen

- **Workspace vorhanden.** Workspace „Pegasus“ über die Oberfläche anlegen. Seine ID steht in der Adresse: `/dashboard/workspace/<ID>/…`.
- **Nutzer mit der Rolle Owner oder Admin in diesem Workspace.** Das Skript braucht die Rechte `project:create`, `project:update`, `label:create` und `label:update`.
- **API-Schlüssel dieses Nutzers.** Anlegen unter Einstellungen → Konto → API-Schlüssel. Der Schlüssel wirkt mit den Rechten des Nutzers und gehört nicht ins Repository.
- **Node.js ab Version 20.** Weitere Abhängigkeiten gibt es nicht. `pnpm install` ist nicht nötig, eine Kopie des Ordners `scripts/board-setup/` reicht.

## 2. Aufruf

```sh
export KANEO_API_URL=https://board.example.de   # mit oder ohne /api
export KANEO_API_KEY=…                          # nicht in die Shell-History schreiben
node scripts/board-setup/setup-board.mjs --workspace <Workspace-ID> --dry-run
node scripts/board-setup/setup-board.mjs --workspace <Workspace-ID> --ids-out board-ids.json
```

Im Repository geht auch `pnpm board:setup --workspace …`.

| Option | Bedeutung |
|---|---|
| `--workspace` | ID des Workspace, alternativ `KANEO_WORKSPACE_ID` |
| `--dry-run` | zeigt nur an, was sich ändern würde; schreibt nichts |
| `--spec` | andere Vorgabe-Datei, Standard `scripts/board-setup/board.json` |
| `--ids-out` | schreibt Projekt-ID sowie die IDs der Spalten (mit Slug), Labels und Felder als JSON; daraus konfiguriert der Hub seinen Kaneo-Adapter |

**Empfohlene Reihenfolge je Umgebung:**
1. Zuerst `--dry-run` ausführen und die Ausgabe prüfen.
2. Dann die Einrichtung ohne `--dry-run` ausführen.
3. Ein zweiter Lauf muss „Keine Änderungen.“ melden.

**Ausgabe:**
- `+` legt an, `~` ändert, `-` entfernt, `↕` ordnet neu.
- `!` ist ein Hinweis, der nichts verändert.
- Bei einem Konflikt bricht das Skript ab, bevor es etwas schreibt, und meldet sich mit dem Rückgabewert 1.

## 3. Was eingerichtet wird

**Projekt:** „Bewerber-Pool“, Kürzel `BEW`, die Karten heißen also `BEW-1`, `BEW-2` und so weiter. Das Skript erkennt das Projekt am Kürzel.

**Spalten**, in dieser Reihenfolge (Feinkonzept Kap. 5 und 7):

| # | Spalte | Slug | Erledigt |
|---|---|---|---|
| 1 | Eingang | `eingang` | |
| 2 | Pegasus-Pool | `pegasus-pool` | |
| 3 | Telefonqualifizierung | `telefonqualifizierung` | |
| 4 | Zugeordnet | `zugeordnet` | |
| 5 | Kontaktiert | `kontaktiert` | |
| 6 | Termin vereinbart | `termin-vereinbart` | |
| 7 | Wiedervorlage | `wiedervorlage` | |
| 8 | Einstellungsbereit / Übergabe BSI | `einstellungsbereit-übergabe-bsi` | ja |
| 9 | Rückgabe an Pegasus | `rückgabe-an-pegasus` | |
| 10 | Ablage | `ablage` | ja |

- Der Slug steht an jeder Karte als Status. Der Hub verwendet ihn oder die Spalten-ID.
- Eine Spalte mit „Erledigt“ beendet die Fälligkeitserinnerungen für ihre Karten.
- Kaneos Standardspalten (To Do, In Progress, In Review, Done) entfernt das Skript, solange sie leer sind.

**Labels** gelten im ganzen Workspace. Sie tragen ein Gruppenpräfix, damit sie im Filter eindeutig sind:

| Gruppe | Labels | Farbe |
|---|---|---|
| Quelle | Quelle: Meta · Quelle: LinkedIn · Quelle: Formular · Quelle: Import | Sage (teal) |
| Paket | Paket 1 · Paket 2 · Paket 3 | Terracotta (orange) |
| Vertriebsweg | Vertriebsweg: WWK · Vertriebsweg: 1zu1 · Vertriebsweg: Clarus | Lavender (purple) |
| Kampagne | Kampagne: ohne Kampagne | Slate (dark-gray) |
| Prüfung und Rückgabe | Dublette? · unvollständig (Amber) · verwertbar (Forest) · Rückläufer (Rose) · keine Zuordnung (Crimson) | je Label |

Die Labels „Kampagne: ‹Name›“ legt der Hub beim Anlegen einer Kampagne selbst an (Feinkonzept Baustein 2b). Sie stehen nicht in der Vorgabe. „Kampagne: ohne Kampagne“ markiert Leads aus einer unbekannten Quelle.

**Standardfelder** sind alle optional. Pflichtangaben prüft der Hub beim Eingang. Telefon und E-Mail prüft Kaneo selbst (PEGA-86): Eine Karte mit einer ungültigen Telefonnummer oder E-Mail-Adresse lehnt die API mit 400 ab, auch beim Anlegen durch den Hub. An der Karte sind beide Felder Links, die den Anruf oder die Mail mit einem Tipp starten.

| Feld | Typ | Auswahlwerte | Auf Karte |
|---|---|---|---|
| Telefon | Telefon (`phone`) | | |
| E-Mail | E-Mail (`email`) | | |
| PLZ | Text (führende Null bleibt erhalten) | | |
| Ort | Text | | ja |
| Geburtsjahr | Zahl | | |
| Aktuelle Tätigkeit | Text | | ja |
| Quelle | Auswahl | Meta, LinkedIn, Formular, Import | |
| Kampagne | Text (Name aus dem Hub) | | ja |
| Paket | Auswahl | Paket 1, Paket 2, Paket 3 | ja |
| Vertriebsweg | Auswahl | WWK, 1zu1, Clarus | |

## 4. Regeln des Abgleichs

**Was das Skript tut:**
- **Spalten** findet es am Slug, ersatzweise am Namen. Wurde eine Spalte in der Oberfläche umbenannt, setzt das Skript den Namen aus der Vorgabe zurück. Symbol, „Erledigt“ und Reihenfolge stellt es ebenfalls wieder her.
- **Labels** findet es am Namen. Die Farbe stellt es wieder her.
- **Felder** findet es am Namen. Wieder hergestellt werden „Pflichtfeld aus“, „Auf Karte“, fehlende Auswahlwerte und die Reihenfolge.

**Was das Skript nie tut:**
- Es löscht kein Label und kein Feld.
- Es entfernt keinen Auswahlwert. Zusätzliche Werte meldet es nur.
- Es löscht keine Spalte, die nicht zu Kaneos Standardspalten gehört, und keine Spalte mit Karten. Zusätzliche Spalten rücken ans Ende des Boards.
- Es ändert keinen Feldtyp, außer zwischen Auswahl und Mehrfachauswahl sowie zwischen Text, E-Mail und Telefon. Weicht der Typ anders ab, bricht der Lauf mit einer Meldung ab, bevor etwas geschrieben wird. Ein Wechsel von Text zu E-Mail oder Telefon scheitert, solange eine Karte einen Wert hat, der nicht passt. Die API nennt dann `CUSTOM_FIELD_TASKS_HAVE_INVALID_VALUES`; die Werte müssen erst korrigiert oder geleert werden.
- Ein archiviertes Projekt `BEW` stellt es nicht wieder her. Der Lauf bricht ab.

**Vorgabe ändern:** `board.json` anpassen, im Review-Prozess freigeben und das Skript auf allen Umgebungen erneut ausführen. Weitere Felder aus Feinkonzept Baustein 3 (Prüfergebnis, Termin, Rückgabegrund und so weiter) werden so ergänzt, sobald sie fachlich abgestimmt sind.

## 5. Nicht Teil des Skripts

- **Rollen** (Administrator, Innendienst, Führungskraft, Marketing Manager) richtet ein Workspace-Admin von Hand ein, wie in [Zeilenfilter, Abschnitt 1](review/2026-10-zeilenfilter-fuehrungskraft.md#1-rolle-führungskraft-anlegen-konfiguration) beschrieben. Das Projekt „Bewerber-Pool“ darf nicht öffentlich geschaltet werden.
- **Workspace und Mitglieder** legt ein Admin über die Oberfläche oder per Einladung an.
- **Webhooks zum Hub** gehören zur Einrichtung des Hubs.
