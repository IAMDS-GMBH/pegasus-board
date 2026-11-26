# Board „Bewerber-Pool“ einrichten

Betriebshandbuch, Abschnitt Board-Konfiguration. Das Skript `scripts/board-setup/setup-board.mjs` richtet das Board in einem bestehenden Workspace ein: Projekt, Spalten, Labels und Standardfelder. Die Vorgabe steht in `scripts/board-setup/board.json`. Hintergrund und Nachweis: [Review PEGA-84](review/2026-10-board-einrichtung.md).

Das Skript ändert nur, was von der Vorgabe abweicht. Es kann daher auf jeder Umgebung beliebig oft laufen, auch nach Änderungen an der Vorgabe.

## 1. Voraussetzungen

- **Workspace des Key Accounts vorhanden.** Jeder Key Account (= Vertriebsweg) hat seinen eigenen Workspace ([Abschnitt 6](#6-neuen-key-account-anbinden)). Den Workspace über die Oberfläche anlegen. Seine ID steht in der Adresse: `/dashboard/workspace/<ID>/…`.
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

**Spalten** in dieser Reihenfolge (PEGA-170). Grundlage ist das Fachkonzept von Alexander Sitzmann vom 23.11.2026, beschlossen im Stakeholder-Sync am 24.11.2026, mit dem Nachtrag vom 26.11.2026 (vier technische Stufen vor der Qualifizierung, „Unbearbeitet“ heißt jetzt „Qualifizierung“). Es ersetzt den Spaltensatz aus 18052 und weicht bewusst von Feinkonzept Kap. 7 ab ([Review PEGA-170](review/2026-11-spalten-phasen.md)). Die Nummer dient nur der Übersicht; im Board stehen die Namen ohne Nummer.

| Phase | # | Spalte | Slug | Gesperrt | Eingeschränkt | Erledigt |
|---|---|---|---|---|---|---|
| Eingang und Datenprüfung | 01 | Eingang | `eingang` | ja | ja | |
| | 02 | Plausibilitätsprüfung | `plausibilitätsprüfung` | ja | ja | |
| | 03 | Automatische Anreicherung | `automatische-anreicherung` | ja | ja | |
| | 04 | Manuelle Anreicherung | `manuelle-anreicherung` | | ja | |
| | 05 | Pegasus-Pool | `pegasus-pool` | | ja | |
| Kontaktaufnahme und Qualifizierung | 06 | Qualifizierung | `unbearbeitet` (bestehende Boards), `qualifizierung` (neue) | | | |
| | 07 | Nicht erreicht | `nicht-erreicht` | | | |
| | 08 | Mehrfach nicht erreicht | `mehrfach-nicht-erreicht` | | | |
| | 09 | Falsche Nummer | `falsche-nummer` | | | |
| | 10 | In Kontakt | `in-kontakt` | | | |
| Termine und Bewerbungsprozess | 11 | Terminiert | `terminiert` | | | |
| | 12 | Vorstellungsgespräch | `vorstellungsgespräch` | | | |
| | 13 | Vertragsangebot liegt vor | `vertragsangebot-liegt-vor` | | | |
| Wiedervorlage, Rückgabe und Abschluss | 14 | Wiedervorlage | `wiedervorlage` | | | |
| | 15 | Rückgabe an Pegasus | `rückgabe-an-pegasus` | | | |
| | 16 | Absage | `absage` | | | ja |
| | 17 | Einstellung | `einstellung` | | | ja |

- Der Slug steht an jeder Karte als Status. Der Hub verwendet ihn oder die Spalten-ID. Ein Umbenennen ändert den Slug nicht.
- **„Unbearbeitet“ heißt jetzt „Qualifizierung“** und steht in der Phase „Kontaktaufnahme und Qualifizierung“. Auf bestehenden Boards benennt das Skript die Spalte um (`"formerName": "Unbearbeitet"` in `board.json`); der Slug `unbearbeitet` und die Karten bleiben. Ein neues Board bekommt den Slug `qualifizierung`.
- Der Hub legt jede neue Karte in „Eingang“ an und findet Spalten wie das Skript am Slug, am Namen oder am früheren Namen.
- **Phase:** Das Board zeigt benachbarte Spalten derselben Phase unter einer gemeinsamen Überschrift, in der Listenansicht als Zwischenüberschrift.
- **Gesperrt:** Eingang, Plausibilitätsprüfung und Automatische Anreicherung steuert die Technik. Karten lassen sich dort nicht von Hand hinein- oder herausschieben; Felder, Titel, Beschreibung, Kommentare, Labels, Zuweisung und Anhänge bleiben bearbeitbar (Abschnitt „Phasen, Sperre und Einschränkung ändern“). Der Pegasus-Pool ist seit dem Nachtrag nicht mehr gesperrt: Dort gibt Pegasus Karten frei.
- **Eingeschränkt:** Die ganze Phase „Eingang und Datenprüfung“ sehen nur Pegasus und der Key-Account-Admin. Führungskräfte und alle Ebenen darunter sehen weder die Spalten noch ihre Karten (siehe unten).
- Eine Spalte mit „Erledigt“ beendet die Fälligkeitserinnerungen für ihre Karten.
- Die Übergabe an BSI ist ein technischer Vorgang ohne Spalte. Abgeschlossene Leads verwaltet das Board über Archivierung und Filter (18072).
- Kaneos Standardspalten (To Do, In Progress, In Review, Done) entfernt das Skript, solange sie leer sind. Ebenso die entfallenen Spalten aus 18052 (`retiredColumns` in `board.json`: Telefonqualifizierung, Zugeordnet, Kontaktiert, Termin vereinbart, Einstellungsbereit / Übergabe BSI, Ablage). Hält eine davon noch Karten, meldet das Skript sie mit `!` und lässt sie stehen; der Lauf läuft weiter. Karten zieht es nicht um.

**Labels** gelten im ganzen Workspace. Sie tragen ein Gruppenpräfix, damit sie im Filter eindeutig sind:

| Gruppe | Labels | Farbe |
|---|---|---|
| Quelle | Quelle: Meta · Quelle: LinkedIn · Quelle: Formular · Quelle: Import | Sage (teal) |
| Paket | Paket 1 · Paket 2 · Paket 3 | Terracotta (orange) |
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

**Vertriebsweg:** Es gibt dafür weder ein Feld noch ein Label. Der Vertriebsweg ist der Workspace des Key Accounts; die Einheit einer Karte kommt vom Hub (`lead.unit_id`, übertragen über `/pegasus-visibility`). Seit PEGA-142 legt das Skript beides nicht mehr an, und der Hub schreibt es nicht.

## 4. Regeln des Abgleichs

**Was das Skript tut:**
- **Spalten** findet es am Slug, ersatzweise am Namen, dann am früheren Namen (`formerName`). Fehlende Spalten legt es mit Phase, Sperre und Einschränkung an.
  - **Die Vorgabe gewinnt** (Nachtrag PEGA-170, wie der Hub): Bei jedem Lauf setzt es Name, Symbol, „Erledigt“, Phase, Sperre und Einschränkung jeder Spalte der Vorgabe auf die Werte aus `board.json`, ebenso die Reihenfolge. Was jemand in den Spalteneinstellungen ändert, bleibt nur bis zum nächsten Lauf.
  - Spalten außerhalb der Vorgabe bleiben unverändert.
- **Labels** findet es am Namen. Die Farbe stellt es wieder her.
- **Felder** findet es am Namen. Wieder hergestellt werden „Pflichtfeld aus“, „Auf Karte“, fehlende Auswahlwerte und die Reihenfolge.

**Was das Skript nie tut:**
- Es löscht kein Label und kein Feld.
- Es entfernt keinen Auswahlwert. Zusätzliche Werte meldet es nur.
- Es löscht keine Spalte, die weder zu Kaneos Standardspalten noch zu den entfallenen Spalten (`retiredColumns`) gehört, und keine Spalte mit Karten. Zusätzliche Spalten rücken ans Ende des Boards.
- Es ändert keinen Feldtyp, außer zwischen Auswahl und Mehrfachauswahl sowie zwischen Text, E-Mail und Telefon. Weicht der Typ anders ab, bricht der Lauf mit einer Meldung ab, bevor etwas geschrieben wird. Ein Wechsel von Text zu E-Mail oder Telefon scheitert, solange eine Karte einen Wert hat, der nicht passt. Die API nennt dann `CUSTOM_FIELD_TASKS_HAVE_INVALID_VALUES`; die Werte müssen erst korrigiert oder geleert werden.
- Ein archiviertes Projekt `BEW` stellt es nicht wieder her. Der Lauf bricht ab.

**Vorgabe ändern:** `board.json` anpassen, im Review-Prozess freigeben und das Skript auf allen Umgebungen erneut ausführen. Weitere Felder aus Feinkonzept Baustein 3 (Prüfergebnis, Termin, Rückgabegrund und so weiter) werden so ergänzt, sobald sie fachlich abgestimmt sind.

### Altbestand: Feld und Labels „Vertriebsweg“ entfernen

Workspaces, die vor PEGA-142 eingerichtet wurden, haben noch das Feld „Vertriebsweg“ und die Labels „Vertriebsweg: WWK“, „Vertriebsweg: 1zu1“ und „Vertriebsweg: Clarus“. Das Skript legt sie nicht mehr an, löscht sie aber auch nicht (siehe oben). Ein Lauf meldet das Feld als Hinweis (`!`, Feld außerhalb der Vorgabe); die Labels meldet er nicht. Von Hand entfernen, je Workspace:

1. **Zuerst prüfen**, ob die Werte noch gebraucht werden. Löschen entfernt Feld und Label von allen Karten und lässt sich nicht rückgängig machen. Wo Karten nur über „Vertriebsweg“ einem Key Account zugeordnet sind, zuerst die Einheit im Hub setzen bzw. die Karten in den Workspace des Key Accounts bringen. Kaneo verschiebt Karten nicht zwischen Workspaces.
2. **Feld:** Projekt „Bewerber-Pool“ → Projekteinstellungen → Benutzerdefinierte Felder → „Vertriebsweg“ → Löschen.
3. **Labels:** Einstellungen → Workspace → Labels, die drei Labels „Vertriebsweg: …“ löschen.
4. Das Skript erneut mit `--dry-run` ausführen. Es muss „Keine Änderungen.“ melden, ohne Hinweis auf „Vertriebsweg“.

Entwicklung und Test: Die Schritte 2 und 3 genügen, wenn dort nur Testkarten liegen. Eine Löschung per Skript gibt es bewusst nicht, weil das Skript nie Daten löscht.

### Phasen, Sperre und Einschränkung ändern

Phase, Sperre und Einschränkung sind Eigenschaften der Spalte. Sie lassen sich ohne Code ändern: Projekteinstellungen → „Bewerber-Pool“ → Workflow, je Spalte die Felder „Phase“, „Gesperrt“ und „Intern“ (Schalter „Nur für Pegasus und Key-Account-Admin sichtbar“). Der nächste Lauf des Skripts oder der Board-Einrichtung im Hub setzt die Spalten der Vorgabe wieder zurück.

- **Wer darf:** wer heute Spalten bearbeiten darf, also Workspace-Owner und Administratoren (`project:update`). Alle anderen sehen beides nur.
- **Phase:** Freitext; die Eingabe schlägt die schon vorhandenen Phasen des Projekts vor. Leer heißt keine Phase. Wer Spalten umsortiert, sieht dieselbe Phase gegebenenfalls zweimal, weil das Board nur benachbarte Spalten zusammenfasst.
- **Gesperrt (technisch gesteuert):** Kein Mitglied kann eine Karte in diese Spalte hinein oder aus ihr heraus verschieben, auch nicht beim Anlegen, Importieren, Duplizieren oder Verschieben in ein anderes Projekt. Die API antwortet mit 403 `COLUMN_LOCKED` und nennt die Spalte. Umsortieren innerhalb der Spalte, Archivieren und Löschen sind kein Verschieben und folgen ihren eigenen Rechten. Im Board ist die Karte nicht greifbar, die Spalte kein Ablageziel, und die Statusauswahl bietet sie nicht an; ein Schloss am Spaltenkopf zeigt „Technisch gesteuert“.
- **Ausgenommen** sind dieselben Konten wie bei den Rechten aus dem Hub: Workspace-Owner, Instanz-Admins und das Systemkonto aus `PEGASUS_HUB_USER_ID`. Aus dem Pegasus-Pool, der seit dem Nachtrag nicht mehr gesperrt ist, gibt Pegasus Karten selbst frei. Anders als die Rechte aus dem Hub gilt die Sperre in jedem Workspace, nicht nur in Workspaces, die der Hub verwaltet; auch ein Workspace-Administrator ist nicht ausgenommen.
- **Sperre und Einschränkung** sind zwei verschiedene Dinge: Die Sperre verhindert das Verschieben von Hand, die Einschränkung das Sehen. Eingang, Plausibilitätsprüfung und Automatische Anreicherung tragen beides, Manuelle Anreicherung und Pegasus-Pool nur die Einschränkung.

**Eingeschränkt (Nur für Pegasus und Key-Account-Admin sichtbar):** Wer die Spalte sehen darf, entscheidet der Hub. Er schickt das Recht `LEAD_READ_INTAKE` mit den übrigen Rechten im Sichtbereich-Snapshot (`PUT /pegasus-visibility/workspace/{workspaceId}/users`, Feld `permissions`); Pegasus und der Key-Account-Admin haben es, Führungskräfte und die Ebenen darunter nicht.

- **Wer alles sieht:** Mitglieder mit `LEAD_READ_INTAKE`, Workspace-Owner, Instanz-Admins und das Systemkonto aus `PEGASUS_HUB_USER_ID` (auch mit dessen API-Key). In einem Workspace, den der Hub nicht verwaltet, gilt die Einschränkung nicht.
- **Was alle anderen nicht sehen:** die Spalten selbst (Board, Liste, Spaltenliste, Statusauswahl) und ihre Karten überall: Board und Liste samt Zählern, Suche, Projektstatistik, „Meine Aufgaben“ und ihr Zähler, Unteraufgaben-Zähler, Verknüpfungen, Exporte, Feldwerte, Anhänge. Eine Karte in einer eingeschränkten Spalte antwortet per ID oder Link mit 404, wie eine Karte außerhalb des Sichtbereichs. Im Verlauf einer freigegebenen Karte und in Benachrichtigungen fehlen Statuswechsel, die eine eingeschränkte Spalte nennen (etwa „Pegasus-Pool → Qualifizierung“). Ein öffentliches Board zeigt eingeschränkte Spalten nie.
- **Was alle anderen nicht können:** eine Karte in eine eingeschränkte Spalte legen, weder beim Anlegen, Importieren, Statuswechsel, Umsortieren, Sammeländern noch beim Verschieben in ein anderes Projekt. Die API antwortet wie bei einem unbekannten Status mit 400 `Invalid status`, damit die Spalte unsichtbar bleibt.
- **Kalender-Feed und Integrations-Sync** stehen Mitgliedern mit eingeschränkter Sicht nicht zur Verfügung (403), also auch Führungskräften ohne `LEAD_READ_INTAKE`, die alle Einheiten sehen. Beide lassen sich nicht auf den Sichtbereich zuschneiden.

## 5. Nicht Teil des Skripts

- **Rollen (PEGA-142):** Was ein Mitglied bei Leads sieht und tun darf, kommt aus dem Pegasus-Hub, nicht aus der Kaneo-Rolle. Im Board gibt es deshalb nur zwei Rollen:
  - **Administrator** für Plattform-Admins, Key-Account-Admins und das Systemkonto „Pegasus-Hub“. Die Rolle regelt das Board-Eigene: Labels, Spalten (mit Phase und Sperre), Felder, Workspace-Einstellungen. Das Systemkonto braucht sie, weil die Übertragung `workspace:manage_settings` verlangt.
  - **Pegasus** für alle übrigen, mit Lesen von Projekten, Aufgaben, Labels und Workspace. Mehr ist nicht nötig: Anlegen, Bearbeiten, Verschieben, Zuweisen, Löschen, Export und Statistik entscheidet der Hub je Person.

  Das Projekt „Bewerber-Pool“ darf nicht öffentlich geschaltet werden.
- **Sichtbereich und Rechte aus dem Hub (PEGA-141, PEGA-142):**
  - Mit der ersten Übertragung von Nutzern übernimmt der Hub den Workspace. Ab dann gelten sein Sichtbereich und seine Rechte für **jedes** Mitglied, gleich welcher Rolle. Kein Board-Admin kann das abschalten.
  - Ausgenommen sind nur der Owner, Instanz-Admins und das Systemkonto, dessen Nutzer-ID in `PEGASUS_HUB_USER_ID` steht. Nur sie dürfen danach die Push-API nutzen; ein Hub-gesteuerter Administrator bekommt 403 `HUB_GOVERNED`.
  - Ein Mitglied, das der Hub nicht überträgt, sieht und darf nichts. Fehlt ein Recht, antwortet die API mit 403 `MISSING_PERMISSION`, und die Oberfläche blendet die Aktion aus.
  - „Nur zugewiesene“ im Rolleneditor schränkt zusätzlich ein. Den früheren Schalter „Sicht aus dem Hub“ gibt es nicht mehr.
  - Details: [Rechte-Review](review/2026-11-rechte-aus-dem-hub.md), [Sichtbereich-Review](review/2026-11-sichtbereich-einheiten.md).
- **Reihenfolge bei der Umstellung:**
  1. `PEGASUS_HUB_USER_ID` im Root-`.env` setzen (Helm: `kaneo.extraEnv`) und die API neu starten. Die ID liefert `SELECT id FROM "user" WHERE email = '<Login-E-Mail des Systemkontos>';`. Ohne die Variable ist das Systemkonto nach dem ersten Push selbst Hub-gesteuert und kann nicht erneut übertragen.
  2. Den Hub Karten-Einheiten und dann Nutzer mit Rechten übertragen lassen.
  3. Mitglieder auf die Rolle „Pegasus“ umstellen.
- **Workspace und Mitglieder:** Den Workspace legt ein Admin über die Oberfläche an. Mitglieder braucht niemand einzuladen (PEGA-143): Wer im Stand des Hubs steht und sich mit bestätigter E-Mail anmeldet (Keycloak), wird beim nächsten Push bzw. bei der Anmeldung Mitglied mit der Rolle „Pegasus“ (gespeichert als `pegasus`). Die Rolle muss im Workspace angelegt sein (siehe oben); fehlt sie, nimmt das Board niemanden auf und schreibt eine Warnung ins Log, statt auf eine Rolle mit mehr Rechten auszuweichen. Bestehende Mitglieder und ihre Rolle ändert der Hub nicht. Einladungen bleiben für Konten ohne Eintrag im Stand.
- **Bearbeiter (PEGA-143):** sieht nur Karten, die ihm zugewiesen sind (Modus `assigned`), und gibt sie mit „An Einheit zurückgeben“ an die Einheit zurück (Recht `LEAD_RETURN_OR_REPORT`). Zuweisen dürfen nur Mitglieder mit `LEAD_ASSIGN_PROCESSOR`.
- **Webhooks zum Hub** gehören zur Einrichtung des Hubs.

## 6. Neuen Key Account anbinden

Jeder Key Account ist ein eigener Workspace. Ein API-Schlüssel gehört in Kaneo zu einem **Nutzer**, nicht zu einem Workspace. Das Systemkonto „Pegasus-Hub“ hat deshalb genau einen Schlüssel und ist in jedem Key-Account-Workspace Administrator.

| Wo | Was |
|---|---|
| Hub, Umgebung (einmal) | `KANEO_API_URL`, `KANEO_API_KEY` (Schlüssel des Systemkontos), `KANEO_WEBHOOK_SECRET` (eines für alle Projekte) |
| Hub, Datenbank (je Key Account) | Projekt-ID im Board; die Workspace-ID liest der Hub über `GET /api/project/{id}`. Spalten, Felder und Labels findet er zur Laufzeit am Namen. |
| Board, Umgebung (einmal) | `PEGASUS_HUB_USER_ID` (Nutzer-ID des Systemkontos) |

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
