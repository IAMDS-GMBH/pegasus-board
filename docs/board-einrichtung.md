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

- **Rollen (PEGA-142):** Was ein Mitglied bei Leads sieht und tun darf, kommt aus dem Pegasus-Hub, nicht aus der Kaneo-Rolle. Im Board gibt es deshalb nur zwei Rollen:
  - **Administrator** für Plattform-Admins, Key-Account-Admins und das Systemkonto „Pegasus-Hub“. Die Rolle regelt das Board-Eigene: Labels, Spalten, Felder, Workspace-Einstellungen. Das Systemkonto braucht sie, weil die Übertragung `workspace:manage_settings` verlangt.
  - **Pegasus** für alle übrigen, mit Lesen von Projekten, Aufgaben, Labels und Workspace. Mehr ist nicht nötig: Anlegen, Bearbeiten, Verschieben, Zuweisen, Löschen, Export und Statistik entscheidet der Hub je Person.

  Das Projekt „Bewerber-Pool“ darf nicht öffentlich geschaltet werden.
- **Sichtbereich und Rechte aus dem Hub (PEGA-141, PEGA-142):**
  - Mit der ersten Übertragung von Nutzern übernimmt der Hub den Workspace. Ab dann gelten sein Sichtbereich und seine Rechte für **jedes** Mitglied, gleich welcher Rolle. Kein Board-Admin kann das abschalten.
  - Ausgenommen sind nur der Owner, Instanz-Admins und das Systemkonto, dessen Login-E-Mail in `PEGASUS_HUB_USER_EMAIL` steht.
  - Ein Mitglied, das der Hub nicht überträgt, sieht und darf nichts. Fehlt ein Recht, antwortet die API mit 403 `MISSING_PERMISSION`, und die Oberfläche blendet die Aktion aus.
  - „Nur zugewiesene“ im Rolleneditor schränkt zusätzlich ein. Den früheren Schalter „Sicht aus dem Hub“ gibt es nicht mehr.
  - Details: [Rechte-Review](review/2026-11-rechte-aus-dem-hub.md), [Sichtbereich-Review](review/2026-11-sichtbereich-einheiten.md).
- **Reihenfolge bei der Umstellung:**
  1. `PEGASUS_HUB_USER_EMAIL` im Root-`.env` setzen (Helm: `kaneo.extraEnv`) und die API neu starten.
  2. Den Hub Karten-Einheiten und dann Nutzer mit Rechten übertragen lassen.
  3. Mitglieder auf die Rolle „Pegasus“ umstellen.
- **Workspace und Mitglieder** legt ein Admin über die Oberfläche oder per Einladung an.
- **Webhooks zum Hub** gehören zur Einrichtung des Hubs.

## 6. Neuen Key Account anbinden

Jeder Key Account ist ein eigener Workspace. Ein API-Schlüssel gehört in Kaneo zu einem **Nutzer**, nicht zu einem Workspace. Das Systemkonto „Pegasus-Hub“ hat deshalb genau einen Schlüssel und ist in jedem Key-Account-Workspace Administrator.

| Wo | Was |
|---|---|
| Hub, Umgebung (einmal) | `KANEO_API_URL`, `KANEO_API_KEY` (Schlüssel des Systemkontos), `KANEO_WEBHOOK_SECRET` (eines für alle Projekte) |
| Hub, Datenbank (je Key Account) | Projekt-ID im Board; die Workspace-ID liest der Hub über `GET /api/project/{id}`. Spalten, Felder und Labels findet er zur Laufzeit am Namen. |
| Board, Umgebung (einmal) | `PEGASUS_HUB_USER_EMAIL` (Login-E-Mail des Systemkontos) |

Keine Projekt- oder Workspace-ID gehört in die Umgebung des Hubs (heute `KANEO_PROJECT_ID`): Jeder weitere Key Account wäre sonst ein neues Deployment.

**Ablauf je Key Account:**

1. Workspace in der Oberfläche anlegen und das Systemkonto als Administrator hinzufügen.
2. Das Board mit dem Schlüssel des Systemkontos einrichten: `node scripts/board-setup/setup-board.mjs --workspace <ID>` (Abschnitt 2). Die Projekt-ID steht in der Ausgabe bzw. mit `--ids-out` in der JSON-Datei.
3. Im Hub-Admin am Key Account die Projekt-ID hinterlegen.
4. Der Hub registriert seinen Webhook am Projekt (`createGenericWebhookIntegration`, `/api/generic-webhook-integration/project/{projectId}`), wie heute für das eine Projekt. Eingehende Webhooks ordnet er über die Projekt-ID dem Key Account zu.
5. Der Hub überträgt Karten-Einheiten, dann Nutzer mit Rechten. Die erste Übertragung schaltet die Durchsetzung im Workspace ein.
6. Mitglieder auf die Rolle „Pegasus“ umstellen.

### Ausblick: Automatisierung über den Hub

Nur beschrieben, nicht gebaut:

- **Schritte 2 bis 5** kann der Hub selbst ausführen, sobald im Hub-Admin ein Key Account mit Workspace-ID angelegt wird:
  - die Board-Einrichtung aus `board.json` (dieselbe Logik wie das Skript, im Hub statt per Kommandozeile),
  - die Projekt-ID am Key Account speichern,
  - den Webhook registrieren,
  - den ersten Stand übertragen.

  Alles läuft über die öffentliche API mit dem Schlüssel des Systemkontos; das Board braucht dafür nichts Neues.
- **Schritt 1** (Workspace anlegen) könnte der Hub ebenfalls übernehmen, hat aber zwei Grenzen:
  - Wer einen Workspace anlegt, wird dessen Owner und kann ihn löschen.
  - Mit `DISABLE_WORKSPACE_CREATION=true` dürfen nur Instanz-Admins Workspaces anlegen; das Systemkonto bräuchte dann Instanz-Admin-Rechte im ganzen Board.

  Empfehlung: Schritt 1 bleibt manuell bei einem Plattform-Admin.
