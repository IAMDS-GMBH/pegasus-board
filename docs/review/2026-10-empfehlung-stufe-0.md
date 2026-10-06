# Empfehlung zum Stufen-Review 0 — Umsetzungsweg B oder Rückfalloption

| | |
|---|---|
| **Story** | Als Auftraggeber möchte ich am Ende der Vorprüfung eine begründete Empfehlung, damit im Stufen-Review 0 über Umsetzungsweg B oder die Rückfalloption entschieden werden kann |
| **Bezug** | Feinkonzept v3.10, Kap. 8 (Weg 2), Kap. 9 (Absicherung), Kap. 11, 14, 20, 22; Berichte zu US 1.2–1.5 (Abschnitt 7) |
| **Stand** | 2026-10-06; Fork auf Kaneo v2.32.0 (+44), Upstream v2.33.0, PocketBase v0.40.4 |
| **Autor** | IAMDS |

---

## 0. Empfehlung auf einer Seite

**Frage:** Board als Kaneo-Fork (Weg B) oder eigenes Board auf PocketBase (Rückfall, Kap. 8)? Der Rückfall greift laut Kap. 9, wenn sich die Fork-Eingriffe nicht sauber umsetzen lassen. **Das ist nicht eingetreten:** Custom Fields bringt Kaneo selbst mit, die Sicht „nur zugewiesene Karten“ läuft als eigenes Modul. **Empfehlung: Weg B bestätigen.**

| # | Kriterium | Weg B: Kaneo-Fork (Befund · Aufwand) | Rückfall: eigenes Board auf PocketBase (Befund · Aufwand) | Vorteil |
|---|---|---|---|---|
| 1 | Sicht „nur zugewiesene Karten“ (Baustein 4, Datenschutz Kap. 14) | Prototyp läuft, 28 automatisierte Tests, Restlücken bewertet. Neue Upstream-Routen müssen nachgezogen werden (erster Abgleich: drei). **3,75–5,25 PT + Routen-Wächter 0,5–1 PT** | Zugriffsregeln deklarativ, standardmäßig gesperrt. **im Board-Aufwand** | PocketBase (Bauart) |
| 2 | Custom Fields (Baustein 3) | In Kaneo vorhanden (6 Feldtypen), Durchstich belegt. Zu ergänzen: Link-Typ, Werte auf der Karte, Server-Filter, Live-Aktualisierung, Deutsch, CSV-Export. **3,5–5 PT** (Konzept 4–6) | Feldverwaltung, Eingabe, Filter, Kartenanzeige selbst bauen. **im Board-Aufwand** | Kaneo |
| 3 | Bereits vorhanden: Board-Anforderungen der Stufe 1 und Ergebnisse der Vorprüfung | 9 von 12 Board-Anforderungen ab Werk erfüllt, die übrigen drei sind die Zeilen 1, 2 und 4. Zeilenfilter, Theme und Deploy aus Stufe 0 laufen weiter. Webhook-Wiederholung und CSV-Import im Hub ergänzen. **+1–2 PT im Hub** | Nur Backend-Bausteine (Anmeldung, Datenbank, Dateien, Live-Updates); Board, Erinnerungen, Benachrichtigungen, Deutsch, mobile Oberfläche und Tests sind Eigenbau. Stufe-0-Ergebnisse kaum übertragbar. **Board 25–37 PT** | Kaneo |
| 4 | WWK-Design | Theme umgesetzt (Anmeldung, Board, hell und dunkel), Grenzen dokumentiert. **0,5–1 PT Rest** | frei gestaltbar, jedes Element neu | gleich (Konzept: Theme statt Redesign) |
| 5 | Aufwand und Termin Stufe 1 (Entwicklung) | **≈ 37–51 PT**, rund 3 Sprints (Konzept 34–46 PT, 2–3 Sprints) | **≈ 54–76 PT**, 4–5 Sprints; zuvor Vorprüfung wie Stufe 0 (4–6 PT, 2–3 Wochen) | Kaneo: 17–24 PT weniger (mit Vorprüfung 21–30), Pilot 6–10 Wochen früher |
| 6 | Laufende Pflege und Sicherheit | Nachzug 1,5–3 PT je Quartal plus 0,5–1 PT je Hotfix; erster Abgleich 0,5 PT. Lücken schließt auch der Upstream (9 Sicherheitsmeldungen, alle behoben) | Eigenpflege 2–3 PT je Quartal; PocketBase vor Version 1.0, ohne zugesagte Abwärtskompatibilität; Lücken im Eigenbau findet nur der eigene Test | Kaneo, solange Pflege unter 1,5 PT je Monat |
| 7 | Abhängigkeit und Betrieb | Kleines Kernteam (zuletzt 90 % der Commits von einer Person); PostgreSQL 16, Helm, läuft auf einem Kubernetes-Testcluster; Fork allein lauffähig | Ein Maintainer; SQLite auf einem Knoten statt PostgreSQL 16, eigenes Sicherungs- und Betriebsmodell | Kaneo |
| 8 | Lizenz, Daten, Austauschbarkeit, Übernahme durch Pegasus | MIT, keine Lizenzkosten, Daten bei Pegasus, Board per Adapter austauschbar; Nachzug braucht Einarbeitung | ebenso; kleinere Codebasis, ganz in Eigenpflege | gleich |

**Beschlussvorschlag**

1. Umsetzungsweg B wird bestätigt. Stufe 1 wird auf Basis des Kaneo-Forks mit rund 37–51 PT Entwicklung beauftragt.
2. Die Rückfalloption wird nicht gezogen; sie bleibt über die Board-Schnittstelle offen.
3. Die folgenden Bedingungen werden Teil der Beauftragung.

**Bedingungen**

- Restlücken des Zeilenfilters vor dem Pilot mit echten Daten schließen; bewusst offene Restpunkte gibt der Datenschutz frei.
- Routen-Wächter in der CI: Jede API-Route ist als gefiltert, gesperrt oder kartenfrei eingestuft, sonst scheitert der Build.
- Upstream monatlich per Release nachziehen; Wartungskontingent 1 PT je Monat plus Hotfix-Klausel.
- Anmeldung nur per SSO (WWK-Konto); sonst +1–2 PT für einen zweiten Faktor, in beiden Optionen.
- Adapter-Durchstich als erstes Aufgabenpaket der Stufe 1; Feinkonzept v3.11 übernimmt die Korrekturen aus Abschnitt 6.

**Rückfall neu prüfen, wenn** die Fork-Pflege im Quartalsmittel 1,5 PT je Monat übersteigt (Kostengleichstand über drei Jahre), ein Datenabfluss im Zeilenfilter sich im Fork nicht schließen lässt oder Kaneo die MIT-Lizenz aufgibt bzw. drei Monate ohne Release bleibt. Dann wird auch das Backend neu gewählt.

**Offen, nicht entscheidend:** Adapter-Durchstich Hub ↔ Board (Story angelegt, nicht eingeplant): in beiden Optionen nötig, Kaneos Schnittstelle und Webhooks am Code geprüft. Upstream-Issue #1764 (Projekt je Führungskraft): offen, der Zeilenfilter bleibt.

---

Die Abschnitte 1–7 sind Herleitung und Beleg, nicht Teil der Beschlussvorlage.

## 1. Stand der Vorprüfung und was bereits vorhanden ist

### 1.1 Ergebnisse der Vorprüfung

| Leistung Stufe 0 (Kap. 20) | Story und Ergebnis | Stand | Bei Rückfall auf PocketBase |
|---|---|---|---|
| Kaneo aufsetzen | PEGA-2: lokale Entwicklungsumgebung; dazu Deploy auf den IAMDS-Kubernetes-Testcluster über `pegasus-pipelines` (AIS-2) | erledigt | Pipeline übertragbar, Board-Deployment neu |
| Code-Review mit Bericht | PEGA-3: [Code-Review](2026-09-kaneo-code-review.md), Rückfrage [Alternativen und Upstream](2026-09-alternativen-und-upstream.md) | erledigt | entfällt; PocketBase ist nur am Schreibtisch bewertet |
| Theme „WWK“ | PEGA-4: [WWK-Theme](../theming-wwk.md), Token-Set als Standard im Fork | erledigt | Farben, Schrift und Logo übertragbar, Umsetzung neu |
| Durchstich Custom Fields | PEGA-5: [Custom Fields](2026-10-custom-fields.md); Funktion kommt aus dem Upstream, ein Fork-Fix für den Zeilenfilter | erledigt | entfällt; Standardfeldsatz übertragbar |
| Prototyp Zeilenfilter Führungskraft | PEGA-6: [Zeilenfilter](2026-10-zeilenfilter-fuehrungskraft.md), Permission `task:view_assigned_only` als eigenes Modul | erledigt | entfällt; Testfälle als Prüfliste übertragbar |
| Hub-Gerüst | PEGA-13: Repository `pegasus-hub` (NestJS, PostgreSQL 16, Health-Endpunkte, Helm, Deploy) | erledigt | übertragbar, boardneutral |
| Hub-Stub mit Kaneo-Adapter (Karte anlegen, Webhook empfangen) | Story angelegt, nicht in einen Sprint übernommen | **offen** | in beiden Fällen zu bauen |
| Erster Upstream-Abgleich | v2.29.2 (+8) → v2.32.0 (+44), Abschnitt 3 | erledigt | entfällt |

Die erledigten Ergebnisse sind im Restaufwand von Weg B (Abschnitt 2) nicht mehr enthalten; sie werden in Stufe 1 direkt weiterverwendet. Beim Rückfall bleiben nur Hub-Gerüst, Pipeline und die Markenwerte nutzbar. Weil der Eigenbau nicht vorgeprüft ist, käme eine Vorprüfung im Umfang der Stufe 0 hinzu (Kap. 20: 4–6 PT Entwicklung, Timebox 2–3 Wochen).

Zum offenen Adapter-Durchstich: Die Schnittstelle (Karten anlegen, verschieben, zuweisen, kommentieren, Labels, Custom Fields) und die signierten Webhooks sind am Code geprüft ([Code-Review](2026-09-kaneo-code-review.md) Abschnitt 1.3 und 7 Nr. 9). Für den Durchstich ist eine Kaneo-Eigenheit zu klären: Webhook-Ziele in privaten Netzen werden abgelehnt; der Hub braucht einen öffentlich auflösbaren Namen mit TLS oder die globale Freigabe `KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS` (Code-Review Abschnitt 3.5).

### 1.2 Was Kaneo ab Werk mitbringt

Die zwölf Board-Anforderungen der Stufe 1 stammen aus der [Alternativen-Bewertung](2026-09-alternativen-und-upstream.md) Abschnitt 5.1; der Stand ist nach Stufe 0 aktualisiert.

| Board-Anforderung Stufe 1 | Kaneo-Fork | Eigenbau auf PocketBase |
|---|---|---|
| B1 Kanban, Karten, Kommentare, Historie, Anhänge | vorhanden | Eigenbau |
| B2 Custom Fields mit Filter und Kartenanzeige | vorhanden; Ergänzungen 3,5–5 PT | Datenmodell vorhanden, Oberfläche Eigenbau |
| B3 Rollen und Sicht „nur zugewiesene Karten“ | Rollen vorhanden, Zeilenfilter als Prototyp; Rest 3,75–5,25 PT | Zugriffsregeln vorhanden, Rollenverwaltung Eigenbau |
| B4 Fälligkeiten mit Erinnerung vorab und bei Überfälligkeit | vorhanden | Eigenbau |
| B5 Benachrichtigungen bei Zuweisung und Erwähnung | vorhanden (in der App, E-Mail, ntfy, Gotify, Webhook) | Eigenbau |
| B6 Anmeldung per OIDC | vorhanden | vorhanden |
| B7 REST-API mit API-Key, signierte Webhooks | vorhanden; Webhooks ohne Wiederholung | REST vorhanden, Webhooks Eigenbau |
| B8 Deutsche Oberfläche | vorhanden | Eigenbau |
| B9 WWK-Design | Theme umgesetzt; Rest 0,5–1 PT | frei, Eigenbau |
| B10 Mobil nutzbar | responsiv, PWA-Manifest | Eigenbau |
| B11 Kubernetes, PostgreSQL, Sicherung | Helm-Chart, PostgreSQL 16, Testcluster läuft | Einzelprogramm mit SQLite, eigener Betriebsweg |
| B12 Tests und Sicherheitsprozess | rund 1.200 Upstream-Tests, Sicherheitsmeldungen werden behoben | Eigenbau |

Ab Werk erfüllt Kaneo neun der zwölf Anforderungen; die übrigen drei (B2, B3, B9) hat die Vorprüfung geklärt. PocketBase liefert Anmeldung, Datenbank mit Zugriffsregeln und Live-Updates, Datei- und Benutzerverwaltung sowie eine Admin-Oberfläche für Entwickler; sechs Anforderungen wären komplett neu zu bauen (B1, B4, B5, B8, B10, B12), das Design entstünde mit dem Board.

Über Stufe 1 hinaus ist in Kaneo bereits vorhanden:

- ein Fälligkeits-Ereignis an den Projekt-Webhook (`dueDateReminder`, Vorlaufzeit einstellbar), das die Eskalation der Stufe 2 auslösen kann, ohne eigenen Zeitplan im Hub (Code-Review Abschnitt 7 Nr. 8);
- weitere Ansichten (Backlog, Kalender, Gantt), globale Suche, Rolleneditor, Einladungen und API-Keys;
- eine MCP-Schnittstelle für KI-Werkzeuge, für die KI-Pakete nutzbar, aber nicht eingeplant;
- laufender Zuwachs aus dem Upstream: Die Mehrfachauswahl für Custom Fields kam während der Vorprüfung hinzu (PR #1735), das Bearbeiten von Felddefinitionen ist in Arbeit (PR #1803). Im Eigenbau wäre beides Eigenleistung.

### 1.3 Was Kaneo mitbringt, Pegasus aber nicht braucht

Integrationen (GitHub, GitLab, Gitea, Slack, Discord, Mattermost, Telegram), Zeiterfassung, öffentliche Projekte, Kalender-Feed, MCP und der Abrechnungscode der Cloud-Version. Sie lassen sich nicht per Schalter entfernen, bleiben aber ungenutzt, solange niemand sie einrichtet, und sind über Rollen und den Zeilenfilter abgesichert. Sie vergrößern jedoch die Fläche, die der Zeilenfilter abdecken und jeder Upstream-Abgleich prüfen muss: Zwei der drei Umgehungen im ersten Abgleich kamen aus MCP und Integrations-Sync. Dieser Aufwand steckt im Zeilenfilter-Rest, im Routen-Wächter und in der Pflege (Abschnitte 2 bis 4).

## 2. Aufwandsherleitung Stufe 1

Entwicklung IAMDS in PT; Projektsteuerung nicht enthalten.

| Position | Konzept (Kap. 20) | Weg B | Rückfall PocketBase | Quelle |
|---|---|---|---|---|
| Custom Fields | 4–6 | 3–4,5 | im Board | Custom Fields Abschnitt 6 |
| CSV-Export inkl. Feldwerte | – | 0,5 | 0,5 | Custom Fields Abschnitt 6 (Export-Anteil) |
| Zeilenfilter inkl. Rückgabe und Ablage | 1,5–2 | 3,75–5,25 | im Board | Zeilenfilter Abschnitt 6, korrigiert; Abschnitt 4 |
| Routen-Wächter (neu) | – | 0,5–1 | – | Abschnitt 4 |
| Theme | 1 | 0,5–1 | im Board | WWK-Theme, „Grenzen“ |
| Eigenes Board auf PocketBase | – | – | 25–37 | Alternativen Abschnitt 5.3 |
| Hub laut Konzept | 18–24 | 18–24 | 18–24 | Kap. 20 |
| Hub: CSV-Massenimport | – | 0,5–1 | 0,5–1 | Code-Review Abschnitt 7 Nr. 2 |
| Hub: Abgleich gegen verlorene Webhooks | – | 0,5–1 | – | Code-Review Abschnitt 7 Nr. 9 |
| Bereitstellung 3,5–5 · Sicherheitsgrundlagen 1 · Doku 2–3 · Feinschliff 3–4 | 9,5–13 | 9,5–13 | 9,5–13 | Kap. 20 |
| **Summe** | **34–46** | **36,75–51,25** | **53,5–75,5** | |
| Sprints rechnerisch (15–17 PT je Sprint) | 2,0–3,1 | 2,2–3,4 | 3,1–5,0 | Kap. 22 |
| Vorprüfung vor Stufe 1 | Stufe 0 | erledigt | 4–6 | Kap. 20, Stufe 0; Abschnitt 1.1 |
| **Summe einschließlich Vorprüfung** | | **36,75–51,25** | **57,5–81,5** | |
| Nur ohne SSO: zweiter Faktor | – | +1–2 | +1–2 | Code-Review Abschnitt 7 Nr. 4 |

- Auf Seite 1 sind die Summen gerundet (≈ 37–51 und ≈ 54–76 PT); der Abstand beträgt 17–24 PT, mit Vorprüfung 21–30 PT.
- Termin: Der Eigenbau braucht rechnerisch 1,0–1,6 Sprints mehr (vier bis sechseinhalb Wochen), die Vorprüfung weitere zwei bis drei Wochen; der Pilot startet mit Weg B also sechs bis zehn Wochen früher.
- Der Kaneo-spezifische Anteil beträgt 8,25–12,75 PT (Custom Fields, Zeilenfilter, Routen-Wächter, Theme, Webhook-Abgleich). Selbst doppelt so viel (16,5–25,5 PT) erreicht erst die Untergrenze des Eigenbau-Boards (25–37 PT).
- Der PocketBase-Wert ist eine Schätzung ohne Prototyp. Beide Fork-Positionen sind nach ihrem Prototyp gewachsen; der Eigenbau-Wert ist deshalb eher eine Untergrenze.
- Wird der Rückfall später doch ausgelöst, ist das Backend neu zu wählen: PocketBase weicht mit SQLite vom PostgreSQL-Betriebsmodell ab; infrage kommen auch Supabase oder der Technikstack des Hubs (NestJS, PostgreSQL).

**Korrekturen gegenüber den Einzelberichten**

- Zeilenfilter Abschnitt 6: Die Tabelle enthält nur offene Positionen (4,25–5,75 PT); der Abzug „davon ~1,5 erbracht“ zählte den Prototyp doppelt. Abzüglich #10 (mit PEGA-5 geschlossen) bleiben 3,75–5,25 PT. Abschnitt 4 dort: Summe 3,75–4,25 statt 3,25–3,75 PT. Im Bericht korrigiert.
- Code-Review Abschnitt 7.1: Obergrenze Stufe 1 = 50 statt 48 PT. Im Bericht korrigiert.
- Alternativen Abschnitt 5.3: „Gesamt Stufe 1“ umfasst nur Board und Hub (Kaneo 25,5–35, PocketBase 43–61 PT), nicht Bereitstellung, Sicherheit, Doku und Feinschliff. Hier durchgehend der volle Umfang der Stufe 1.
- Custom Fields Abschnitt 6: „CSV-Export/-Import 1 PT“ ist hier aufgeteilt in Export im Fork (0,5 PT) und Import im Hub (0,5–1 PT, wie im Code-Review).
- Theme: bereits in `main`; Rest laut „Grenzen“ (Seitentitel, PWA-Name und Icons im Build, „Kaneo“ in Texten, Mobilprüfung) 0,5–1 statt 1 PT.

## 3. Laufende Pflege

**Erster Upstream-Abgleich (05.10.2026)**

| Kennzahl | Wert |
|---|---|
| Zeitraum Upstream | 28.09.–05.10.2026, eine Woche |
| Umfang | 301 Commits (205 von Menschen), 5 Releases (v2.29.3 bis v2.32.0) |
| Aufwand | rund 0,5 PT einschließlich aller Nachzüge |
| Nachzüge im Fork | drei neue Upstream-Lesewege am Zeilenfilter vorbei (`8f56b4d2` Ticket-ID-Abfrage, `64871ff2` Workspace-Aktivitäten, `82e0390d` Label-Sync), geschlossen in `e11fe8a5`; Kollision der Migrationsnummer, behoben in `9594a65a` |
| Konfliktflächen | `task/index.ts` 21 Upstream-Commits, `auth.ts` 10, `schema.ts` 10; die zentrale Fork-Stelle `workspace-access-middleware.ts` 0 |
| Fork-Anteil | 74 Dateien, +2.144 Zeilen gegenüber Upstream (Code ohne Doku, Lockfile und Migrations-Snapshots) |
| Upstream-Takt | 13 Releases zwischen 21.09. und 05.10.2026; rund 90 % der Commits im Abgleichszeitraum von einer Person; keine neue Sicherheitsmeldung seit 22.09. |

Der Abgleich stützt die Spanne des Code-Reviews (1,5–3 PT je Quartal, zuzüglich 0,5–1 PT je Sicherheits-Hotfix). Monatlich statt quartalsweise nachzuziehen hält die Zahl neuer Routen je Abgleich klein; das Kontingent von 1 PT je Monat entspricht dem oberen Rand.

**Drei-Jahres-Vergleich (Stufe 1 plus zwölf Quartale Pflege)**

| | Stufe 1, beim Eigenbau mit Vorprüfung | Pflege je Quartal | Summe drei Jahre |
|---|---|---|---|
| Weg B | 36,75–51,25 | 1,5–3 plus 0–1 Hotfix | ≈ 55–99 |
| PocketBase | 57,5–81,5 | 2–3 | ≈ 82–118 |

Gleichstand erreicht Weg B erst bei einer Pflege von 1,2–1,8 PT je Monat; daraus der Auslöser „über 1,5 PT je Monat im Quartalsmittel“. Nicht eingerechnet sind Funktionen, die der Upstream nachliefert (etwa das Bearbeiten von Felddefinitionen, PR #1803, Abschnitt 1.2); das spricht zusätzlich für Weg B.

## 4. Zeilenfilter: Restlücken und Routen-Wächter

Stand nach PEGA-5, Nummern wie im [Zeilenfilter-Bericht](2026-10-zeilenfilter-fuehrungskraft.md) Abschnitt 4.

| Maßnahme in Stufe 1 | PT |
|---|---|
| #8 Labels je Workspace · #9 Task-Relationen · #11 Projektstatistik · #12 Benachrichtigungen · #14 Anhänge · #15 Kalender-Feed sperren · #7 MCP-Smoke-Test | 2,5–3 |
| #17 Export-Schutz je Rolle | 0,5 |
| #21 Detailansicht „nicht gefunden“ im Board | 0,25 |
| Rückgabe: Pflichtfeld beim Spaltenwechsel erzwingen (nur falls fachlich gewünscht) | 0–1 |
| Tests und Doku | 0,5 |
| **Summe Fork** | **3,75–5,25** |

- Vor dem Pilot mit echten Daten zwingend: #12 (Kartentitel in Benachrichtigungen) und #14 (Anhänge fremder Karten).
- Bewusst akzeptiert, vom Datenschutz freizugeben: #13 Karten-IDs im WebSocket, #16 öffentliches Projekt (per Konfiguration ausgeschlossen), #18 Unteraufgaben-Zähler, #19 Unterschied 400/404, #20 Bulk-Sonderfall, #22 Import (per Rolle ausgeschlossen).
- Heute gedeckt: 40 Routen über den gemeinsamen Karten-Lookup und 8 Listen-Endpunkte mit eigener Bedingung; Integrations-Sync für eingeschränkte Rollen gesperrt. Tests: 24 Integrations- und 4 Unit-Tests.

**Routen-Wächter (0,5–1 PT).** Ein Test liest die vollständige Routentabelle der API (Hono `app.routes`, einschließlich `/ws` und MCP, die in `apps/docs/openapi.json` fehlen) und verlangt für jede Route eine Einstufung: über den Karten-Lookup gefiltert · eigene Filterbedingung · ohne Kartendaten · für eingeschränkte Rollen gesperrt. Eine neue, nicht eingestufte Route lässt den Build scheitern. Neue Upstream-Lesewege fallen damit beim Abgleich automatisch auf statt durch Durchsicht.

## 5. Nicht weiter verfolgt

- **Projekt je Führungskraft** nach Upstream-Issue #1764: weiter offen (Priorität hoch, kein PR). Brächte rund 90 Projekte mit eigenen Feldern, Spalten und Webhooks ([Alternativen](2026-09-alternativen-und-upstream.md) Abschnitt 3). Beobachten.
- **Planka Pro:** einziges fertiges Board mit Zuweisungssicht; rund 8.600–9.500 € Lizenz je Jahr, Custom Fields nur als Freitext, keine OSI-Lizenz (Alternativen Abschnitt 4).
- **Fork einfrieren:** spart Pflege, aber Sicherheitskorrekturen müssten einzeln zurückportiert werden; bei 13 Releases in zwei Wochen wächst der Abstand schnell.
- **Zeilenfilter als PostgreSQL Row-Level Security:** deklarativ wie bei PocketBase, greift aber in jeden Datenbankzugriff von Kaneo ein. Nicht geschätzt; erst beim Auslöser „Datenabfluss“ prüfen.
- **Zeilenfilter in den Upstream einbringen:** Der Upstream nimmt seit 04.10.2026 nur PRs zu vorab freigegebenen Issues an (`796d66f1`). Als Chance verfolgen, nicht einplanen.

## 6. Korrekturen für Feinkonzept v3.11

| Stelle | Aussage v3.10 | Befund | Beleg |
|---|---|---|---|
| Kap. 8, 11 (Baustein 3), 20, 21, Anhang A | Kaneo ohne Custom Fields | vorhanden seit v2.24.0 vom 11.09.2026, also nach dem Recherchestand 03.09.; Baustein 3 wird Ergänzung (3,5–5 PT) | Custom Fields Abschnitt 0 und 6 |
| Kap. 11 (Baustein 4), 20 | Zeilenfilter 1,5–2 PT; Export-Verbot per Rolle ist Konfiguration | 3,75–5,25 PT in Stufe 1 plus Routen-Wächter; Export-Schutz braucht Code | Abschnitt 4; Code-Review Abschnitt 2 |
| Kap. 10, Baustein 1 | CSV-Import mit Feld-Mapping in Kaneo | nur JSON; Massenimport im Hub (0,5–1 PT) | Code-Review Abschnitt 7 Nr. 2 |
| Kap. 14 | Zwei-Faktor über Kaneo/Better Auth | nicht aktiviert; SSO-Pflicht oder 1–2 PT | Code-Review Abschnitt 7 Nr. 4 |
| Baustein 12 | Rollen aus OIDC-Gruppen | kein Gruppen-Mapping; Rollen über Einladungen | Code-Review Abschnitt 7 Nr. 5 |
| Baustein 2 | Kaneo-Webhooks als Ereignisquelle | ohne Wiederholung und ohne Ereignis bei Feldänderung; Abgleich im Hub (0,5–1 PT) | Code-Review Abschnitt 7 Nr. 9 |
| Kap. 20, 22 | Stufe 1: 34–46 PT, 2–3 Sprints | ≈ 37–51 PT, rund 3 Sprints | Abschnitt 2 |
| Kap. 15 | Upstream-Risiko | ergänzen: neue Upstream-Routen können den Zeilenfilter umgehen; Gegenmaßnahme Routen-Wächter und monatlicher Nachzug | Abschnitt 3 |

## 7. Quellen

- Berichte zu US 1.2–1.5: [Code-Review](2026-09-kaneo-code-review.md) und [Alternativen und Upstream](2026-09-alternativen-und-upstream.md) (PEGA-3), [WWK-Theme](../theming-wwk.md) (PEGA-4), [Custom Fields](2026-10-custom-fields.md) (PEGA-5), [Zeilenfilter](2026-10-zeilenfilter-fuehrungskraft.md) (PEGA-6).
- Fork-Commits: `eab0abad` und `ec3856f3` (Upstream-Abgleich), `e11fe8a5` (Filter-Nachzüge), `9594a65a` (Migrationsnummer), `68932d3b` (Feldwerte je Projekt, PEGA-5).
- Upstream-Commits: `8f56b4d2`, `64871ff2`, `82e0390d` (neue Lesewege), `796d66f1` (Regel für PRs).
- GitHub, abgerufen am 06.10.2026: usekaneo/kaneo (MIT, v2.33.0 vom 05.10.2026, Issue #1764 und PR #1803 offen, Security Advisories), pocketbase/pocketbase (MIT, v0.40.4 vom 12.09.2026, README-Hinweis zur Abwärtskompatibilität vor v1.0, ein Hauptmaintainer mit 2.482 Commits), IAMDS-GMBH/pegasus-hub (Gerüst PEGA-13), IAMDS-GMBH/pegasus-pipelines (Deploy des Boards).
