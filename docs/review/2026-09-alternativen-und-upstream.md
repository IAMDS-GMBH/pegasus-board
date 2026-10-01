# Alternativen prüfen oder auf den Upstream warten? — Bewertung zur Rückfrage aus dem Code-Review

| | |
|---|---|
| **Anlass** | Rückfrage zum Code-Review-Bericht: „Lieber nach was anderem schauen, oder ist das auch noch nachträglich per Patch vom Upstream möglich?“ |
| **Bezug** | [Code-Review Kaneo-Codebasis](2026-09-kaneo-code-review.md), Feinkonzept v3.10 (Kap. 8, 11, 15, 20, 23) |
| **Stand** | 2026-09-24, Online-Recherche (GitHub-API, Projektseiten, Preisseiten), Kaneo-Fork auf v2.26.0 |
| **Autor** | IAMDS |

---

## 0. Kurzantwort

**Beides greift nicht. Bei Kaneo bleiben, den Zeilenfilter selbst bauen, ihn upstream-fähig schneiden und ein Upstream-Issue beobachten.**

- **Nachträglich vom Upstream patchen:** Für die wichtigste Lücke, die Sicht „nur zugewiesene Karten“, gibt es im Upstream **kein Issue, keinen PR und keine Roadmap**. Für 2FA, CSV-Import und OIDC-Gruppen-Claims ebenfalls nicht. Warten hat also keinen Zeitpunkt, auf den man warten könnte. Der Pilot braucht den Zeilenfilter aber vom ersten Tag (Datenschutz-Maßnahme in Kap. 14: „Führungskräfte sehen nur zugewiesene Leads“).
- **Eine Ausnahme:** Am 23.09.2026 hat ein Kernteam-Mitglied selbst das Issue **#1764 „restrict workspace members to selected projects“** eröffnet. Kommt das, wird ein Modell „ein Projekt je Führungskraft“ ohne Fork-Eingriff möglich. Das ist ein echter Plan B für Baustein 4, aber ohne Termin und mit eigenen Nachteilen (Abschnitt 3).
- **Alternativen:** Die Nachprüfung der Top-Kandidaten aus Anhang A mit Stand 24.09.2026 ändert das Bild nicht. Kein Werkzeug erfüllt „modern, designbar, permissive Lizenz, Custom Fields, Zuweisungssicht“ gleichzeitig. Die zwei, die der Zuweisungssicht am nächsten kommen, sind **Planka Pro** (kostenpflichtig, keine OSI-Lizenz) und **Kanera** (neu, Source-available, kein OIDC). Ein Wechsel tauscht die eine bekannte Lücke gegen mehrere neue.

**Kosten im Vergleich:** Zeilenfilter im Fork einmalig 4–6 PT plus Fork-Pflege 1,5–3 PT je Quartal; Planka Pro rund 8.600–9.500 € je Jahr Lizenz bei 100 Nutzern und der Hub bleibt trotzdem zu bauen; Eigenbau auf PocketBase oder Supabase 25–40 PT allein für den Board-Teil; Warten auf Upstream: kein Datum. Vollständige Schätzung je Alternative in Abschnitt 5.

---

## 1. Was konkret fehlt

Aus dem Code-Review, nach Größe des Eingriffs sortiert:

| # | Lücke | Wo im Konzept | Fork-Aufwand | Alternative ohne Fork |
|---|---|---|---|---|
| L1 | Sicht „nur zugewiesene Karten“ für Führungskräfte, inkl. Export, Suche, WebSocket, MCP | Baustein 4 | 4–6 PT | keine heute; Plan B nach #1764 (Abschnitt 3) |
| L2 | Export-Schutz per Rolle | Baustein 4 | in L1 enthalten | Ingress-Regel auf `/api/task/export/*` (Notlösung) |
| L3 | Custom Fields: `url`-Typ, Inline-Anzeige auf der Karte, Ereignis bei Feldänderung, serverseitiger Filter | Baustein 3 | 1,5–3 PT | Upstream liefert Multiselect (#1735, offen), Rest nicht in Sicht |
| L4 | 2FA/TOTP | Kap. 14 | 1–2 PT | SSO-Pflicht (`DISABLE_LOGIN_FORM` + `DISABLE_REGISTRATION` + `CUSTOM_OAUTH_AUTO_LOGIN`) |
| L5 | OIDC-Gruppen-Claim → Rolle, Auto-Beitritt | Baustein 12 | 1–1,5 PT | Einladungen manuell pflegen |
| L6 | CSV-Import mit Mapping | Baustein 1 | — | im Hub, 0,5–1 PT |
| L7 | Webhook ohne Retry, ohne Feld-Ereignis | Baustein 2 | Feld-Ereignis in L3 | Abgleich-Poll im Hub, 0,5–1 PT |

L4 bis L7 sind ohne Fork lösbar. Die Frage „Upstream oder Alternative“ entscheidet sich an **L1**.

---

## 2. Option „nachträglich vom Upstream patchen“

### 2.1 Was im Upstream tatsächlich läuft (GitHub, 24.09.2026)

| Thema | Upstream-Stand | Beleg | Löst unsere Lücke? |
|---|---|---|---|
| Sicht „nur zugewiesene Karten“ | **Kein Issue, kein PR.** Suche nach `assigned`, `only see`, `row level`, `restrict` liefert nichts zu Zeilenfiltern. | GitHub-Suche `repo:usekaneo/kaneo` | Nein |
| Projekt-Zugriff je Mitglied | **#1764** „restrict workspace members to selected projects“, offen, eröffnet **23.09.2026 von Tin Sever (Kernteam, 235 Commits)**. Vorgänger **#1683** (31.08.) wurde am 01.09. von einem externen Contributor ohne Code geschlossen und trägt trotzdem das Label `status:done`; #1764 nennt das ausdrücklich als Fehler. | Issue #1764, #1683 (Timeline: kein PR, Schließung durch `krudo-taco`, 1 Commit im Repo) | Indirekt: ermöglicht „Projekt je Führungskraft“ (Abschnitt 3), nicht den Zeilenfilter in einem Board |
| Granulare Rechte je Ressource | **#253** (2025): Maintainer Andrej hat 05/2026 Rechte **je Ressourcentyp** geliefert (PR #1253, heutiges Rollenmodell) und geschlossen; Nutzer widersprechen 09/2026, dass damit kein Zugriff „nur auf bestimmte Projekte“ möglich ist. **#523** (Client-Rolle): als `viewer`-Rolle erledigt, lesend auf alles. | Kommentare #253, #523 | Nein. Haltung des Kernteams: „Simplicity“, Trennung über Workspaces |
| Teams | **#1680**, offen, 30.08.: Teams als Gruppierung, ausdrücklich **ohne Rechte oder Sichtbarkeit** | Issue #1680 | Nein |
| „My tasks“-Ansicht | **PR #1699**, offen, 06.09.: eigener Endpunkt `GET /user/tasks` mit Assignee-Filter serverseitig | PR #1699 | Nein, aber wiederverwendbares Muster für den eigenen Filter |
| Custom Fields | **PR #1735** Multiselect, offen, 17.09.; Modul seit v2.24.0 in Bewegung | PR #1735 | Teilweise (L3) |
| 2FA/TOTP/Passkeys | **0 Treffer** in Issues und PRs | GitHub-Suche | Nein |
| OIDC-Gruppen/Rollen-Mapping | Kein Issue. Einzig **#1421** (E-Mail des OIDC-Providers als verifiziert vertrauen), offen | GitHub-Suche | Nein |
| CSV-Import | **#650** „Importing / Exporting data“ 11/2025 als erledigt geschlossen, Ergebnis war der JSON-Import; **#1643** Roundtrip-Fehler behoben | Issues #650, #1643 | Nein, Richtung ist JSON |
| Roadmap | Keine veröffentlichte Roadmap; README ohne Roadmap-Abschnitt; interne Tracking-IDs (`ROA-…`) in Bot-Kommentaren | README, Issue-Kommentare | — |
| Offene Enhancements nach Reaktionen | Top 5: User-Management-Menü (15), „My ToDos“ (13), verschachtelte Subtasks (12), GitLab (12), Zeiterfassung (10). Nichts zu Sichtbarkeit oder Rechten | Issue-Suche `label:enhancement`, sortiert nach Reaktionen | — |

### 2.2 Bewertung

1. **Für L1 gibt es nichts, auf das man warten kann.** Kein Issue, kein PR, keine Roadmap, und die dokumentierte Haltung des Kernteams (Trennung über Workspaces, Rollen je Ressourcentyp) spricht gegen einen Zeilenfilter im Kern. Das einzige Kernteam-Signal in dieser Richtung ist #1764, und das betrifft Projekt-, nicht Karten-Ebene.
2. **„Nachträglich patchen“ ist ohnehin das Fork-Modell des Konzepts.** Der Zeilenfilter wird als eigenständiges Modul gebaut (eigene Permission `task:view-assigned-only`, eine Middleware, eine Zeile je Leseroute). Liefert der Upstream später etwas Vergleichbares, wird das eigene Modul entfernt. Das ist der im Code-Review beschriebene Weg mit 1,5–3 PT Pflege je Quartal.
3. **Upstream-Beitrag statt Fork-Sonderweg.** Der Zeilenfilter passt in das bestehende Rechtemodell (Permission-Statement plus Middleware, wie `requireWorkspacePermission`). Ein sauber getesteter PR an usekaneo/kaneo hat eine realistische, aber nicht sichere Chance. Wird er angenommen, entfällt der größte Teil der Fork-Pflege. Empfehlung: in Stufe 0 so bauen, dass er upstream-fähig ist, und den PR anbieten. Auf die Annahme darf der Pilot nicht warten.
4. **L4 bis L7 nicht auf den Upstream schieben.** 2FA über SSO-Pflicht, Gruppen-Claim über Einladungen, CSV und Reconciliation im Hub sind heute lösbar und billiger als jede Wartezeit.

---

## 3. Plan B ohne Fork-Eingriff: „Projekt je Führungskraft“ nach #1764

Wenn #1764 vor dem Start von Stufe 1 landet, kann Baustein 4 ohne Zeilenfilter umgesetzt werden:

- **Modell:** Ein Projekt „Pegasus-Pool“ für den Innendienst und **ein Projekt je Führungskraft** (rund 90). Mitglieder werden per #1764 auf „ausgewählte Projekte“ beschränkt. Der Hub verschiebt die Karte bei Zuordnung in das Projekt der Führungskraft und bei Rückgabe zurück in den Pool. Kartenverschiebung zwischen Projekten existiert bereits (`apps/api/src/task/controllers/update-task.ts:48`, Status wird gegen die Spalten des Zielprojekts geprüft).
- **Was dafür spricht:** Kein Kern-Eingriff in Kaneo; die Führungskraft sieht genau ein Board mit ihren Karten; Innendienst sieht alle Projekte; Labels sind workspace-weit und bleiben geteilt.
- **Was dagegen spricht:**
  - Custom-Field-Definitionen sind **je Projekt** (`schema.ts:1203-1228`): 90 Projekte × Standardfelder, per API anzulegen und bei Änderung synchron zu halten (Hub-Aufgabe, 1–2 PT, plus laufende Konsistenz).
  - Der Generic Webhook ist **einer je Projekt** (`schema.ts:897`): 90 Webhook-Konfigurationen, die der Hub anlegen und überwachen muss.
  - Spalten sind je Projekt: 90 identische Spaltensätze, per API anzulegen; Spaltenumbenennung wird zur Massenoperation.
  - Innendienst verliert die Board-Gesamtsicht über alle Führungskräfte in einem Board; Suche und Backlog bleiben workspace-weit.
  - Export-Schutz (L2) bleibt offen, weil Export je Projekt ohne Rollenprüfung ist; eine Führungskraft könnte ihr eigenes Projekt exportieren, was fachlich vertretbar sein kann.
  - Abhängig davon, **wie** #1764 umgesetzt wird (Server-seitig auf allen Leserouten, inkl. Suche, WebSocket, MCP) — dieselbe Prüfliste wie beim Zeilenfilter, nur im Upstream.
- **Einordnung:** Fachlich gleichwertig zur Sicht „nur zugewiesene Karten“, technisch mit mehr Konfigurationsmasse im Hub und weniger Code im Fork. Ohne Termin für #1764 kann Stufe 1 darauf nicht gebaut werden. Empfehlung: **beobachten**, im Stufen-Review 0 entscheiden. Liegt #1764 bis dahin in einem Release, beide Wege in Stufe 0 mit je einem halben Tag durchspielen.

Das Konzept hatte „ein Workspace je Führungskraft“ geprüft und verworfen (Kap. 11, Baustein 4). Die Projekt-Variante ist deutlich leichter als die Workspace-Variante, weil Labels, Nutzer, Rollen und Suche geteilt bleiben und Karten verschoben werden können.

---

## 4. Option „nach etwas anderem schauen“: Alternativen mit Stand 24.09.2026

Nachgeprüft wurden die Kandidaten aus Anhang A des Konzepts, die dort als realistische Wege 1–6 geführt sind, plus zwei Neuzugänge. Kriterien wie im Konzept: modern/designbar, mobil, permissive Lizenz, Custom Fields, Rollen mit „nur eigene Leads“.

| Werkzeug | Lizenz | Aktivität (GitHub, 24.09.2026) | Custom Fields | „Nur zugewiesene“ | OIDC | Designbar | Befund |
|---|---|---|---|---|---|---|---|
| **Kaneo** (usekaneo/kaneo) | MIT | 9.163 ★, v2.26.0 vom 21.09., Push 22.09. | ja (seit v2.24.0), Multiselect in Arbeit | **nein**, kein Issue; #1764 Projekt-Ebene offen | ja, generisch, ohne Gruppen | Tokens ja, White-Label per Fork | Basis bleibt; Lücke L1 klar und lokal |
| **It's a Plan** (croffasia/itsaplan) | AGPL-3.0 | 814 ★ (Konzept: 433), erstellt 07/2026, Push 23.09., 32 offene Issues | ja, je Projekt | **nein** (README: RBAC, keine Sichtbarkeitsbeschränkung) | ja, generisch; Authentik-PR #401 offen; Gruppen-Mapping nicht belegt (Konzeptangabe „Gruppen-Mapping“ nicht mehr auffindbar) | shadcn/Tailwind | README: „Expect breaking changes before the first stable release“; Einzelentwickler; AGPL. Unreifer als Kaneo, gleiche Lücke |
| **Kan** (kanbn/kan) | AGPL-3.0 | 5.688 ★, Push 22.09., 140 offene Issues | **nein** | nein (nur Board-Sichtbarkeit) | ja | kein Theme-System | Zwei Lücken statt einer, AGPL |
| **Planka Pro** (plankanban/planka) | Community: „Fair Use License 1.1“, **nicht OSI**; Pro-Dateien proprietär | 12.577 ★, Push 17.09. | Pro: **nur Freitext** (Issue #1381 Dropdown offen) | **Pro: Guest/Worker sehen wahlweise nur zugewiesene Karten** | Pro: OIDC | Pro: Logo, Farben, Login-Seite; Layout nicht | Einziges fertiges Werkzeug mit Zuweisungssicht. Preis **7,20–7,90 € je Nutzer/Monat** selbst gehostet, bei 100 Nutzern **8.640–9.480 € je Jahr**; Sails.js/React; Konzeptlücken (PLZ, Rückgabe, Wiedervorlage, BSI) bleiben im Hub |
| **Kanera** (kanera.app, neu) | **Elastic License 2.0**, Source-available | keine GitHub-Zahlen erhoben | ja: Text, Zahl, Checkbox, Datum, URL, Select, User, Multi-Value, board- oder workspace-weit | Board-/Workspace-Rechte, Gäste; keine Zuweisungssicht belegt | **nein** („No SAML, OIDC, or SCIM for user accounts yet“) | unklar | Self-Host ohne Seat-Gebühr, aber kein OIDC, junges Produkt, keine permissive Lizenz |
| **Twenty** (twentyhq/twenty) | AGPL + Enterprise-Dateien | 57.399 ★, Push 24.09. | ja, Custom Objects | **nur Organization-Plan** („Row-level permissions: Unlimited“; Pro: „No“) | Organization-Plan | Logo/Name | **19 $ je Nutzer/Monat** → ~22.800 $ je Jahr bei 100 Nutzern; CRM statt Board; AGPL für Design-Fork |
| **Plane** (makeplane/plane) | AGPL-3.0 | 59.814 ★, Push 23.09., 1.087 offene Issues | Pro | Pro/Business | Pro (self-hosted) | Tailwind, kein White-Label | Preise für Self-Host nicht öffentlich; Community zu beschnitten (wie im Konzept) |
| **Harly** (Vytral/harly) | MIT | **2 ★**, erstellt 05/2026, Push 23.09. | nur Bewerbungsfragen | ja: `jobAccess all/assigned` + Region-Scopes | ja, OIDC/SAML/SCIM, MFA, Passkeys | Next.js/Tailwind | Fachlich exaktestes Datenmodell (ATS mit Regionen), aber „public beta … for small teams“, ein Maintainer, E-Mail nur via Resend; kein Produkt, auf das man ein Pilotprojekt setzt |
| **Wekan** (wekan/wekan) | MIT | 21.094 ★, Push 23.09., 164 offene Issues | 7 Typen | ja, ab Werk | ja | nur CSS | Meteor/MongoDB, Redesign oberflächlich; im Konzept aus Stack-Gründen verworfen, Befund unverändert |
| **Worklenz** | AGPL + EE | 3.181 ★, Push 03.09. | ja | Member = nur zugewiesene | Business | Business | SSO und API hinter Bezahlplan; unverändert |
| **Atomic CRM / PocketBase (Eigenbau)** | MIT | Atomic CRM 1.271 ★, Push 23.09. | per Code / RLS | per RLS | via Supabase/Keycloak bzw. PocketBase OIDC | voll | Rückfalloption des Konzepts; Board, Kommentare, Historie, Erinnerungen sind Eigenbau (deutlich mehr als 4–6 PT) |

**Ergebnis:** Kein Werkzeug schließt L1 ohne Fork oder ohne Lizenzkosten und Lizenzwechsel.

- Wer L1 fertig kaufen will, landet bei **Planka Pro**: rund 9.000 € je Jahr, keine OSI-Lizenz, Custom Fields nur Freitext (das Konzept braucht Auswahl- und Datumsfelder für Paket, Prüfergebnis, Termin), Design nur Farben und Logo, älterer Stack. Der Hub mit Paketweg, PLZ-Zuordnung, Rückgabe, AG-VIP und BSI bleibt in vollem Umfang zu bauen.
- Wer bei permissiver Lizenz und modernem Stack bleibt, hat bei **jedem** Kandidaten (Kaneo, Kan, It's a Plan, Kanera) dieselbe Lücke L1 und bei den meisten zusätzlich fehlendes OIDC oder fehlende Custom Fields.
- **Harly** zeigt, dass das gewünschte Datenmodell existiert, aber nicht in produktreifer Form.

Ein Wechsel würde also die Stufe-0-Erkenntnisse (Custom Fields vorhanden, deutsche Oberfläche, Helm, signierte Webhooks, 1.200 Tests, aktive Security-Pflege) aufgeben, ohne L1 zu lösen.

---

## 5. Aufwandsschätzung je Alternative (Board-Teil Stufe 1)

### 5.1 Messlatte

Der Pegasus-Hub (Eingang, Pool-Prüfung, Paketweg, PLZ-Zuordnung, Mails an Bewerber, AG-VIP-CSV, Löschkonzept, Admin) ist bei **jeder** Alternative gleich zu bauen: **18–24 PT** laut Konzept Kap. 20. Unterschiede entstehen nur im **Board-Teil** und im **Adapter**. Der Board-Teil muss für Stufe 1 zwölf Anforderungen erfüllen (aus Kap. 11, Bausteine 2, 3, 4, 6, 7, 8, 11, 12, 13):

| Kürzel | Anforderung an das Board |
|---|---|
| B1 | Kanban mit Spalten, Karten, Drag-and-drop, Kommentaren, Aktivitätsprotokoll, Datei-Anhängen |
| B2 | Custom Fields: Text, Zahl, Datum, Auswahl, Checkbox, Link; Filter; Anzeige auf der Karte |
| B3 | Konfigurierbare Rollen **und** Sicht „nur zugewiesene Karten“ inkl. Export-Schutz |
| B4 | Fälligkeiten mit Erinnerung vorab und überfällig, in-App und E-Mail |
| B5 | Benachrichtigungen bei Zuweisung und Erwähnung |
| B6 | OIDC-Anmeldung gegen das WWK-Konto |
| B7 | REST-API mit API-Key und signierte Webhooks für den Hub-Adapter |
| B8 | Deutsche Oberfläche |
| B9 | WWK-Design (Farben, Logo, Name) auf einer gestaltbaren Oberfläche |
| B10 | Mobil nutzbar (responsiv, installierbar) |
| B11 | Helm/Kubernetes-Deployment, PostgreSQL oder gleichwertig, Backups |
| B12 | Testbasis und Sicherheitsniveau (Tests, Security-Prozess des Projekts) |

**Referenz Kaneo-Fork:** B2 Ergänzungen 1,5–3 PT, B3 Zeilenfilter 4–6 PT, B9 Theme 1 PT, Konfiguration Workspace/Projekt/Spalten/Rollen/OIDC/Webhook ~1 PT → **7,5–11 PT**; Adapter im Hub 2–3 PT (im Hub-Block enthalten). Alle anderen Anforderungen sind erfüllt. Pflege 1,5–3 PT je Quartal.

Legende der Matrix: **✓** vorhanden, Konfiguration · **~** teilweise, kleiner Eingriff · **✗** fehlt, bauen · **€** nur im Bezahlplan · **—** nicht anwendbar.

### 5.2 Matrix: Was jede Alternative mitbringt

| Alternative | B1 Board | B2 Felder | B3 Rollen + Zuweisung | B4 Erinnerung | B5 Benachr. | B6 OIDC | B7 API + Webhook | B8 Deutsch | B9 Design | B10 Mobil | B11 Helm | B12 Tests/Sec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Kaneo-Fork** | ✓ | ~ | ✗ Zuweisung | ✓ | ✓ | ✓ | ✓ (ohne Retry) | ✓ | ~ Tokens | ✓ PWA ohne SW | ✓ | ✓ 1.200 Tests, 9 GHSA behoben |
| It's a Plan | ✓ | ✓ | ✗ Zuweisung | ✓ | ✓ | ✓ | ✓ mit Retry | ✗ (9 Sprachen, kein Deutsch) | ✓ shadcn | ~ | ✓ | ~ pre-1.0 |
| Kan | ✓ | ✗ | ✗ Zuweisung | ~ | ✓ | ✓ | ~ (Integrationen „coming soon“) | ? | ✗ kein Theme-System | ~ | ~ Docker | ~ |
| Planka Pro | ✓ | ~ nur Freitext | **✓** Guest/Worker „nur zugewiesene“ | ✓ | ✓ | € Pro | ✓ REST (Swagger), Webhooks | ✓ | € Logo/Farben/Login, kein Layout | ✓ App (Pro) | ~ Community-Charts | ~ |
| Kanera | ✓ | ✓ reich | ~ Board-Rechte, Gäste | ? | ✓ | **✗** | ✓ + MCP | ? | ? | ? | ~ Docker Compose | ? junges Produkt |
| Twenty | ✓ Custom Objects | ✓ | € Row-Level nur Organization | ✓ Workflows | ✓ | € | ✓ REST/GraphQL/Webhooks | ✓ | ✗ Logo/Name, Fork AGPL | ~ | ~ | ✓ Firma |
| Plane | ✓ | € Pro | € Pro | ✓ | ✓ | € Pro | ✓ | ✓ | ✗ | ~ App | ✓ | ✓ Firma |
| Wekan | ✓ | ✓ 7 Typen | **✓** ab Werk | ✓ | ✓ | ✓ | ✓ ohne Retry | ✓ | ✗ nur CSS | ~ | ✓ | ~ 49 CVEs 2026, täglicher Takt |
| Worklenz | ✓ | ✓ | ✓ Member = zugewiesene | ✓ | ✓ | € Business | ✗ keine öffentliche API | ? | € | ~ | ~ | ~ |
| Huly | ✓ | ~ | ✗ | ✓ | ✓ | ✓ | ✗ nur SDK | ✓ | ✗ | ✓ | ✗ 14 Dienste | ~ |
| Frappe HR (+ERPNext) | ✓ Bewerber-Kanban im Admin-UI | ✓ Customize Form | ~ User Permissions, „nur zugewiesen“ per Skript | ✓ | ✓ | ✓ | ✓ mit Signatur, Retry | ✓ | ✗ nur Einfärbung | ~ Admin-UI mobil | ✓ offiziell | ✓ Firma |
| Odoo CE Recruitment | ✓ | ~ Dev-Mode | ✓ Record Rule „Interviewer“ | ✓ | ✓ | ~ OCA-Modul | ~ JSON-RPC, Webhooks via Automation | ✓ | ✗ OWL-Kern | ~ | ~ | ✓ Firma |
| Horilla HRMS | ✓ Pipeline | ✓ dynamic_fields | ~ Stage-Manager | ✓ | ✓ | **✗** nur LDAP | ~ DRF, Webhooks unbelegt | ? | ~ Tailwind | ~ HTMX | ~ | ~ |
| Harly (ATS) | ✓ Pipeline | ✗ nur Bewerbungsfragen | **✓** jobAccess all/assigned, Region-Scopes | ~ | ✓ | ✓ OIDC/SAML/SCIM | ✓ | ? | ✓ | ~ | ~ | ✗ Beta, 1 Maintainer, 2 ★ |
| PocketBase-Eigenbau | ✗ | ~ 13 Feldtypen als Collections, UI bauen | ~ API-Rules deklarativ, UI bauen | ✗ | ✗ | ✓ | ~ REST ja, Webhooks per JS-Hook | ✗ | ✓ frei | ✗ bauen | ~ Single Binary, SQLite | ✗ eigene Tests |
| Supabase-Eigenbau | ✗ | ~ Tabellen + UI | ~ RLS, UI bauen | ✗ | ✗ | ~ Keycloak/SAML | ~ PostgREST ja, Webhooks per Trigger/Edge Function | ✗ | ✓ frei | ✗ | ✗ ~10 Container | ✗ |
| Atomic CRM (Supabase, MIT) | ~ Deal-Kanban vorhanden | ~ per Code | ~ RLS | ✗ | ~ | ~ Keycloak | ~ PostgREST | ~ react-admin-i18n | ✓ shadcn | ✓ PWA | ✗ Supabase-Stack | ~ |
| refine app-crm-minimal | ~ Skelett | ✗ | ~ Access-Control-Provider | ✗ | ✗ | ✗ | ✗ Backend wählen | ~ | ✓ Ant Design | ~ | ✗ | ✗ |
| Hasura + Keycloak | ✗ | ~ | ~ JWT-Claims | ✗ | ✗ | ✓ Keycloak | ~ GraphQL, Event-Trigger | ✗ | ✓ | ✗ | ~ | ✗ |
| Appwrite | ✗ | ✓ | ? | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | ✗ | ~ MariaDB | ✗ |
| Payload CMS | ✗ | ✓ reich | ✓ Access-Query | ✗ | ✗ | € Enterprise | ✓ REST/GraphQL | ~ | ✓ | ✗ | ~ | ~ |
| Grist | ✗ Card-Widget, kein Kanban | ✓ | ✓ Access Rules | ✗ | ✗ | ~ Activation Key | ✓ | ✓ | ✗ | ~ | ~ SQLite | ~ |
| LeadTable (Kauf) | ✓ | ✓ je Kampagne | ✗ keine Zuweisung an Personen | ✗ | ✓ Mail-Automation | ✗ | ✓ API | ✓ | ~ White-Label | ✓ | — SaaS | — |

### 5.3 Schätzung je Alternative

Alle Werte in Personentagen für den **Board-Teil plus Adapter-Delta** in Stufe 1; der Hub (18–24 PT) kommt bei jedem hinzu. „Pflege“ ist der geschätzte Aufwand je Quartal für Upstream-Nachzug oder Eigenpflege des Board-Teils. Lizenz je Jahr bei 100 Nutzern.

| Alternative | Was zu bauen bzw. einzurichten ist | Board-Teil PT | Adapter-Delta | Lizenz/Jahr | Pflege/Quartal | Gesamt Stufe 1 (mit Hub 18–24) |
|---|---|---|---|---|---|---|
| **Kaneo-Fork** (Referenz) | B2 Ergänzungen 1,5–3 · B3 Zeilenfilter 4–6 · B9 Theme 1 · Konfiguration 1 | **7,5–11** | 0 | 0 € | 1,5–3 | **25,5–35** |
| **It's a Plan** (Fork, AGPL) | B3 Zeilenfilter 4–6 · B8 deutsche Übersetzung neu 2–3 · B9 Theme 1 · Konfiguration 1 · Einarbeitung neuer Stack 1–2 | 9–13 | +1 (anderes API-Modell) | 0 €, aber AGPL: Quelltext für Nutzer bereitzustellen, Design-Fork offenlegen | 3–5 (pre-1.0, „breaking changes“ angekündigt, Einzelentwickler) | 28–38 |
| **Kan** (Fork, AGPL) | B2 Custom Fields komplett 4–6 · B3 Zeilenfilter 4–6 · B7 Webhooks prüfen/bauen 1–2 · B8 Deutsch 1–2 · B9 Theme ohne Token-System 2–3 · Konfiguration 1 | 13–20 | +1 | 0 €, AGPL | 2–4 | 32–45 |
| **Planka Pro** (Kauf, kein Fork bei Pro-Dateien) | B2 Auswahl-/Datumsfelder fehlen → Validierung und Auswahlwerte im Hub statt im Board 1–2 · B3 Konfiguration Worker/Guest 0,5 · B9 Logo/Farben 0,5 · Konfiguration 1 · B11 Helm aus Community-Chart 1 | 4–5 | +2–3 (Planka-REST/Webhooks, andere Semantik) | **8.640–9.480 €** | 0,5–1 (nur Updates) | 24–32 **+ Lizenz** |
| **Kanera** (Source-available) | **B6 OIDC fehlt** → SSO-Entscheidung der WWK nicht erfüllbar; sonst Felder ✓, Board ✓; B3 Zuweisungssicht nicht belegt → ggf. nicht lösbar (kein Fork erlaubt unter ELv2 für Weitergabe, intern anpassbar) | 3–5 wenn ohne SSO akzeptiert, sonst **nicht geeignet** | +2–3 | 0 € Self-Host | 0,5–1 | 23–32, **SSO-Blocker** |
| **Twenty** (AGPL + Enterprise) | B3 Row-Level nur mit Organization-Lizenz · Lead-Objekt und Pipeline modellieren 1–2 · Rollen 1 · B9 Design nur Logo, Layout-Fork AGPL 3–5 · Konfiguration 1 | 6–9 | +2–3 (GraphQL/REST, Workflows) | **~22.800 $** (19 $/Nutzer/Monat) | 1–2 | 26–36 **+ Lizenz** |
| **Plane** (AGPL) | B2, B3, B6 nur Pro; Self-Host-Preis nicht öffentlich · Konfiguration 1–2 · Design ✗ | 3–5 + Lizenz | +2 | unbekannt, Anfrage nötig | 1–2 | 23–31 **+ Lizenz** |
| **Wekan** (MIT) | Alles vorhanden; B9 CSS-Reskin oberflächlich 2–3 · Konfiguration 1 · MongoDB in Betrieb aufnehmen 1–2 | 4–6 | +2–3 (REST ohne OpenAPI, Webhooks ohne Retry) | 0 € | 3–4 (täglicher Release-Takt, 49 CVEs 2026) | 24–33, **Stack-/Sicherheitsrisiko** |
| **Worklenz** (AGPL + EE) | B6 und B9 nur Business; **B7 keine öffentliche API** → Hub-Adapter nicht möglich | **nicht geeignet** | — | Business-Plan | — | — |
| **Huly** (EPL-2.0) | B3 ✗, B7 nur SDK → Adapter 4–6 · B11 14 Dienste (CockroachDB, Elastic, MinIO, Redpanda) 5–8 · Design ✗ | 15–22 | in Board-Teil | 0 € | 4–6 | 33–46, **Betriebslast** |
| **Frappe HR + ERPNext** (GPLv3) | Setup ERPNext/HRMS + Helm 3–5 · Job-Applicant-Pipeline, Felder, User Permissions, „nur zugewiesen“-Skript 2–3 · Einarbeitung Frappe 3–5 · B9 nur Einfärbung 0,5 | 8,5–13,5 | +2–3 (DocType-API, Webhooks mit Retry) | 0 € | 2–3 (wöchentliche Releases, ERP-Update-Last) | 29–41; Ausschlussgründe Kap. 8 bleiben (Admin-UI, ERP-Ballast) |
| **Odoo CE Recruitment** (LGPL) | Setup 2–3 · Record Rules 1 · Felder im Dev-Mode 1–2 · OIDC OCA-Modul 1 · Einarbeitung 2–3 · Design ✗ | 7–10 | +2–3 (JSON-RPC) | 0 € | 2–3 | 27–37; Oberfläche nicht für Führungskräfte |
| **Horilla HRMS** (LGPL-2.1) | **B6 OIDC fehlt** → django-allauth nachrüsten 2–3 · B7 Webhooks unbelegt → bauen 2–3 · B9 Theme 1–2 · Konfiguration 1 · Einarbeitung Django/HTMX 1–2 | 7–11 | +2–3 | 0 € | 2–3 | 27–38 |
| **Harly** (MIT, Beta) | B2 Custom Fields bauen 4–6 · E-Mail nur Resend → SMTP 1–2 · Beta-Härtung, fehlende Tests 3–5 · B8 Deutsch 1–2 · Konfiguration 1 | 10–16 | +2–3 | 0 € | 3–5 (1 Maintainer, Beta) | 30–43, **Reiferisiko** |
| **PocketBase-Eigenbau** (MIT) | B1 Board, Karte, Kommentare, Historie, Anhänge 8–12 · B2 Collections + Formulare + Filter 2–3 · B3 API-Rules + UI 1–2 · B4 Erinnerungen per Cron-Hook + Mail 2–3 · B5 Benachrichtigungen in-App + Mail 2–3 · B6 0,5 · B7 Webhooks mit Signatur und Retry per JS-Hook 1,5–2 · B8 i18n von null 1–2 · B9 1–2 · B10 responsiv 1–2 · B11 Single Binary + Volume-Backup 1 · B12 Tests 3–4 | **25–37** | 0 (Adapter gegen eigene API) | 0 € | 2–3 Eigenpflege | 43–61; SQLite Single-Node, Solo-Maintainer |
| **Supabase-Eigenbau** (Apache) | wie PocketBase, aber RLS statt API-Rules 2–3 · OIDC via Keycloak/SAML 1–2 · Erinnerungen via pg_cron/Edge Functions 3–4 · B11 ~10 Container in Helm 2–3 | **28–40** | 0 | 0 € | 3–4 | 46–64; Betriebslast |
| **Atomic CRM als Basis** (MIT, Supabase) | Deal-Kanban → Lead-Pipeline umbauen 3–5 · Felder per Code 2–3 · B3 RLS 1–2 · B4/B5 Erinnerungen, Benachrichtigungen 3–4 · B6 Keycloak 1–2 · B8 Deutsch 1–2 · B9 1 · B7 Webhooks via Trigger 1,5–2 · B11 Supabase-Stack 2–3 · B12 2–3 | **18–27** | 0 | 0 € | 3–4 | 36–51 |
| **refine app-crm-minimal** (MIT) | Skelett ohne Backend; Backend wählen (PocketBase/Supabase) + alles aus dem Eigenbau minus Kanban-Grundgerüst | 22–33 | 0 | 0 € | 3–4 | 40–57 |
| **Hasura + Keycloak / Appwrite / Payload / Grist** | Backend-Baukästen: Board-UI, Detail, Kommentare, Erinnerungen, Benachrichtigungen komplett bauen; Payload SSO nur Enterprise; Grist kein echtes Kanban | 25–40 | 0 | 0 € (Payload SSO €) | 3–4 | 43–64 |
| **LeadTable** (Kauf, Konzept Kap. 21) | B3 keine Zuweisung an Personen, kein Routing, keine Wiedervorlage, kein SSO → Hub übernimmt 15–25 PT Mehrarbeit gegenüber Kaneo-Weg | 0 Board, +12–20 im Hub | +2 | 2.550–55.500 € über 3 Jahre je Modell | 0 | 42–60 gesamt laut Kap. 21, **SSO nicht lösbar** |

### 5.4 Lesart

- **Eigenbau ist immer teurer.** PocketBase, Supabase, Hasura, Appwrite, Payload und Grist liefern Backend-Bausteine, aber kein Board. Das Board mit Karten, Kommentaren, Historie, Anhängen, Erinnerungen, Benachrichtigungen, Deutsch und Mobilansicht kostet 25–40 PT gegenüber 7,5–11 PT beim Kaneo-Fork. Atomic CRM als Starter spart etwa ein Drittel davon, bleibt aber bei 18–27 PT. Die Konzept-Einschätzung „PocketBase als Rückfalloption“ hält, aber der Rückfall kostet **das Dreifache** des Fork-Eingriffs und verlängert Stufe 1 um ein bis zwei Sprints.
- **Fertige Werkzeuge mit Zuweisungssicht** (Planka Pro, Wekan, Twenty Organization, Worklenz) sind im Board-Teil billiger als Kaneo, holen sich die Kosten aber über Lizenz (Planka ~9.000 €/Jahr, Twenty ~22.800 $/Jahr), fehlende API (Worklenz), Stack- und Sicherheitsrisiko (Wekan) oder eingeschränktes Design zurück. Planka Pro ist der einzige, der bei Gesamtaufwand mit Kaneo gleichzieht; dafür sind Custom Fields nur Freitext, die Lizenz ist nicht OSI, und der Fork-Weg für das WWK-Design ist bei Pro-Dateien versperrt.
- **Moderne MIT/AGPL-Boards** (It's a Plan, Kan) haben dieselbe Lücke L1 wie Kaneo und zusätzlich fehlendes Deutsch oder fehlende Felder. Sie kosten 9–20 PT statt 7,5–11 PT und bringen AGPL-Pflichten und geringere Reife mit.
- **HR-/ATS-Systeme** (Frappe HR, Odoo, Horilla, Harly) liegen bei 7–16 PT Board-Teil, also im Bereich von Kaneo, scheitern aber an den im Konzept genannten Gründen (Admin-Oberfläche, ERP-Ballast, fehlendes OIDC bei Horilla, Beta-Status bei Harly).
- **Der Hub dominiert die Gesamtsumme.** Bei 18–24 PT Hub und 7,5–11 PT Board liegt der Kaneo-Weg bei 25,5–35 PT Entwicklung für Stufe 1. Kein Kandidat unterbietet das ohne Lizenz oder ohne Verzicht auf SSO, Felder oder Design.

## 6. Empfehlung

1. **Bei Kaneo bleiben.** Die Nachprüfung der Alternativen ergibt keinen Kandidaten, der L1 mit permissiver Lizenz und modernem Stack löst. Planka Pro löst L1 gegen Lizenzkosten und mit schwächeren Custom Fields. Ein Eigenbau auf PocketBase oder Supabase kostet mit 25–40 PT das Drei- bis Vierfache des Fork-Eingriffs (Abschnitt 5).
2. **Zeilenfilter in Stufe 0 als eigenständiges Modul bauen**, upstream-fähig (Permission-Statement, Middleware, Tests im Stil von `tests/api-integration/workspace-rbac.test.ts`). Aufwand 4–6 PT wie im Code-Review.
3. **PR an usekaneo/kaneo anbieten**, ohne den Pilot davon abhängig zu machen. Wird er angenommen, sinkt die Fork-Pflege.
4. **#1764 beobachten.** Landet „Projekt-Zugriff je Mitglied“ vor dem Stufen-Review 0 in einem Release, beide Wege (Zeilenfilter vs. Projekt je Führungskraft) je einen halben Tag durchspielen und dann entscheiden. Sonst Zeilenfilter.
5. **L4–L7 sofort ohne Fork lösen:** SSO-Pflicht statt 2FA-Plugin, Einladungen statt Gruppen-Claim, CSV und Abgleich-Poll im Hub.
6. **Konzept v3.11:** Anhang A mit den Zahlen aus Abschnitt 4 aktualisieren (It's a Plan 814 ★ und OIDC ohne Gruppen-Mapping; Planka-Lizenz „Fair Use“, nicht MIT; Kanera als neuer Eintrag; Harly 2 ★), Kap. 15 um „Upstream liefert keinen Zeilenfilter, #1764 als Chance“ ergänzen.

---

## 7. Quellen (abgerufen 2026-09-24)

- Kaneo Issues: [#1764](https://github.com/usekaneo/kaneo/issues/1764) (Projekt-Zugriff, offen, Tin Sever), [#1683](https://github.com/usekaneo/kaneo/issues/1683) (geschlossen ohne PR), [#253](https://github.com/usekaneo/kaneo/issues/253) (granulare Rechte, Maintainer-Antwort 05/2026), [#523](https://github.com/usekaneo/kaneo/issues/523) (Client-Rolle → viewer), [#1680](https://github.com/usekaneo/kaneo/issues/1680) (Teams ohne Rechte), [#650](https://github.com/usekaneo/kaneo/issues/650) (Import/Export → JSON), [#1421](https://github.com/usekaneo/kaneo/issues/1421) (OIDC E-Mail-Trust); PRs [#1699](https://github.com/usekaneo/kaneo/pull/1699) (My tasks), [#1735](https://github.com/usekaneo/kaneo/pull/1735) (Multiselect Custom Fields). GitHub-Suchen nach 2FA/TOTP/Passkey (0 Treffer) und Gruppen-Claim (0 Treffer).
- Kaneo README (kein Roadmap-Abschnitt): https://github.com/usekaneo/kaneo
- It's a Plan: https://github.com/croffasia/itsaplan (README: Reifegrad, Auth-Methoden, AGPL), PR #401 Authentik
- Kan: https://github.com/kanbn/kan (README: Features, AGPL)
- Planka: https://planka.app/pricing, https://planka.app/pro, Community-Lizenz https://github.com/plankanban/planka/blob/master/LICENSE.md, Issue #1381 (Dropdown-Felder)
- Kanera: https://www.kanera.app/vs/planka (Lizenz ELv2, Felder, kein OIDC)
- Twenty: https://twenty.com/pricing (Row-level nur Organization, 19 $/Nutzer/Monat)
- Plane: https://plane.so/pricing, https://github.com/makeplane/plane
- Harly: https://github.com/Vytral/harly (README: public beta, MIT, RBAC mit jobAccess)
- Wekan, Worklenz, Atomic CRM, PocketBase (61.141 ★, v0.40.4 vom 12.09.2026, MIT), Supabase (110.718 ★, Apache-2.0): GitHub-Repository-Metadaten via API
- PLANKA API/Webhooks: https://docs.planka.cloud/docs/category/api-reference/ (Swagger, Community und Pro)
- Kaneo-Code (Fork v2.26.0): `apps/api/src/task/controllers/update-task.ts:48` (Projektwechsel einer Karte), `apps/api/src/database/schema.ts:897, 1203-1228` (Webhook je Projekt, Custom Fields je Projekt)
