# Benachrichtigungen im Hub, Integrationen nur ohne Hub-Steuerung — Umsetzung und Nachweis

| | |
|---|---|
| **Story** | PEGA-80 (Nachtrag): Der Pegasus Hub verschickt die Karten-Benachrichtigungen und verwaltet die Einstellungen jedes Nutzers. Die eigene Einstellungsseite des Boards entfällt. Integrationen eines Projekts, vor allem der Generic Webhook des Hubs, ändern nur Owner, Instanz-Admins und das Systemkonto. |
| **Bezug** | Hub: Admin-App `<ADMIN_URL>/notifications` (Keycloak-SSO, für jeden angemeldeten Nutzer), `MAIL_SETTINGS_URL`; Vorgänger [Rechte aus dem Hub (PEGA-142)](2026-11-rechte-aus-dem-hub.md); [Register der Fork-Eingriffe](../fork-eingriffe.md#pega-80--benachrichtigungseinstellungen-im-hub-integrationen-nur-ohne-hub-steuerung) |
| **Stand** | 2026-11-17, Fork `IAMDS-GMBH/pegasus-board`, Branch `th_PEGA-80` auf Basis `main` @ `16793b37` |
| **Autor** | IAMDS |

Pfadangaben beziehen sich auf die Repo-Wurzel.

---

## 0. Ergebnis auf einer Seite

| Abnahmekriterium | Befund im Board |
|---|---|
| Optionale API-Variable `PEGASUS_NOTIFICATION_SETTINGS_URL`, öffentlich in `GET /config` als `notificationSettingsUrl: string \| null` | **Erfüllt.** Nur absolute http(s)-URLs zählen; alles andere (leer, relativ, `javascript:`) ergibt `null`. `.env.sample` und `apps/docs/openapi.json` nachgezogen. |
| Kontomenü „Benachrichtigungen“ zeigt mit URL extern auf den Hub (neuer Tab, Glocke, Beschriftung bleiben), ohne URL fehlt der Eintrag | **Erfüllt.** Zusätzlich ein Icon „extern“ und für Screenreader „(wird in einem neuen Tab geöffnet)“. |
| `/dashboard/settings/account/notifications` rendert `NotificationSettings` nicht mehr; Weiterleitung auf die URL bzw. auf „Profil“ | **Erfüllt.** `window.location.replace(url)` (die alte Seite bleibt nicht im Verlauf), sonst `Navigate` auf `/dashboard/settings/account/information`. Während die Konfiguration lädt, rendert die Route nichts. `components/settings/notifications/**` und die API `notification-preferences` unverändert. |
| Mails verlinken die Hub-Einstellungen | **Erfüllt.** `delivery.ts` nimmt die URL als `settingsUrl`, wenn gesetzt. Ohne SMTP gehen ohnehin keine Mails aus dem Board. |
| Posteingang bleibt | **Erfüllt.** Glocke, `nav-main` und Inbox unverändert. |
| In Hub-Workspaces alle Verwaltungsrouten der Integrationen nur für Owner, Instanz-Admins und `PEGASUS_HUB_USER_ID`, sonst 403 `HUB_GOVERNED`; `manage_settings` bleibt davor | **Erfüllt** für alle acht Integrationen und die Sync-Regeln (Abschnitt 1). Workspaces ohne Hub-Push verhalten sich wie Kaneo (Test). |
| Capability `manageIntegrations`, im Web `canManageIntegrations`; Projektbereich „Integrationen“ nur damit, Route leitet sonst auf „Allgemein“ um und zeigt beim Laden nichts | **Erfüllt.** |
| Vertrag mit dem Hub: Systemkonto (API-Schlüssel) legt den Generic Webhook jedes Projekts an, liest und ersetzt ihn; Pfade und Operation-IDs unverändert | **Erfüllt** (Test mit API-Schlüssel). Siehe Befund 1 zu „PUT“. |

**Befund 1: Es gibt kein `PUT` am Generic Webhook.** Die Aufgabe nennt „GET/POST/PUT“. Upstream bietet `GET`, `POST` (legt an oder ersetzt die bestehende Konfiguration, Upsert), `PATCH` (ändert einzelne Felder) und `DELETE` unter `/generic-webhook-integration/project/{projectId}`. Der Hub ersetzt seinen Webhook also per erneutem `POST`. Der Test prüft `POST`, `GET`, erneutes `POST` und `PATCH` mit dem Schlüssel des Systemkontos. Nutzt der Hub irgendwo `PUT`, bekommt er schon heute 404; das wäre im Hub zu korrigieren, nicht im Board.

**Entscheidung 1: Welche Lesezugriffe gesperrt sind.** `GET` des Generic Webhooks und der vier Chat-Integrationen liest nur die Integrationsseite; sie sind für Hub-gesteuerte Mitglieder gesperrt (maskierte Ziel-URL des Hubs bleibt verborgen). `GET` von GitHub/Gitea/GitLab bleibt offen, weil Kartenkopf (Branch-Name kopieren) und Automationen es für alle Mitglieder brauchen. Webhook-Secret und Zugangstoken liefern Gitea und GitLab aber nur noch an Mitglieder mit `manage_settings`, die der Hub nicht steuert („Webhook-Konfiguration der Code-Hosts“).

**Entscheidung 2: Karten-Aktionen bleiben.** Issue-Import sowie Prüfen und Fortsetzen pausierter Sync-Links handeln auf Karten und sind über `requireLeadPermission` geregelt; sie bleiben, wie sie sind. Gesperrt sind bei den Sync-Regeln nur Vorschau und Speichern. Die Bedienelemente dafür liegen auf der Integrationsseite, die ein Hub-gesteuertes Mitglied nicht mehr erreicht.

**Entscheidung 3: Eine Sperre für Push-API und Integrationen.** `denyHubGoverned` liegt jetzt in `apps/api/src/utils/deny-hub-governed.ts` (vorher `pegasus-visibility/`), mit allgemeiner Meldung „Only the Pegasus Hub's system account, owners and instance admins can do this in a workspace the Hub manages“. Der Code bleibt `HUB_GOVERNED`.

---

## 1. Verhalten

| Route (Operation-ID) | Hub-gesteuerter Admin | Owner, Instanz-Admin, Systemkonto | Workspace ohne Hub |
|---|---|---|---|
| Generic Webhook `GET`/`POST`/`PATCH`/`DELETE` | 403 `HUB_GOVERNED` | erlaubt | wie Kaneo (`GET` für Mitglieder, Rest mit `manage_settings`) |
| Slack, Discord, Mattermost, Telegram: `GET`, anlegen, ändern, löschen | 403 `HUB_GOVERNED` | erlaubt | wie Kaneo |
| GitHub, Gitea, GitLab: anlegen, ändern, löschen, Repositories listen, Zugang prüfen | 403 `HUB_GOVERNED` | erlaubt | wie Kaneo |
| GitHub, Gitea, GitLab: `GET /project/{id}` | 200, ohne Secret/Token | 200, mit Secret/Token (bei `manage_settings`) | wie Kaneo |
| Sync-Regeln: Vorschau, Speichern | 403 `HUB_GOVERNED` | erlaubt | wie Kaneo |
| Sync-Regeln lesen, Link prüfen/fortsetzen, Issue-Import | unverändert | unverändert | wie Kaneo |
| `GET /workspace/{id}/capabilities` → `manageIntegrations` | `false` | wie `manageSettings` | wie `manageSettings` |

---

## 2. Umsetzung

- API: `utils/notification-settings-url.ts` (neu), `utils/get-settings.ts`, `config/response.ts`, `notification-preferences/delivery.ts`; `utils/deny-hub-governed.ts` (verschoben, plus `isHubGoverned`); acht `*-integration/index.ts` und `integration-sync/index.ts`; `workspace/controllers/get-my-capabilities.ts`.
- Paket: `packages/permissions` — `manageIntegrations` in `capabilities.ts`, `hubUngovernedCapabilities` in `hub-permissions.ts`.
- Web: Settings-Navigation (`types`, `build-settings-nav`, `use-settings-nav`, `settings-nav-group`), `use-workspace-permission` (`canManageIntegrations`), Routen `account/notifications.tsx` und `projects/$projectId/integrations.tsx`, Seiteninhalt nach `components/project/integrations/project-integrations-page.tsx` verschoben (startet seine Abfragen erst nach der Prüfung).
- i18n: `settings.opensInNewTab` (en-US, de-DE; übrige Locales englisch über `pnpm i18n:check:fix`), `i18n/schema.json` von Hand.
- Doku: `.env.sample`, `apps/docs/openapi.json` (nur Beschreibungen und die zwei neuen Felder), `docs/fork-eingriffe.md`, `docs/board-einrichtung.md`.

---

## 3. Vor dem ersten Deploy

`PEGASUS_NOTIFICATION_SETTINGS_URL` am Container der Board-API in `pegasus-pipelines` je Stage auf `<ADMIN_URL>/notifications` setzen (derselbe Wert wie `MAIL_SETTINGS_URL` des Hubs). Ohne die Variable fehlt „Benachrichtigungen“ im Kontomenü, und die alte Adresse leitet auf „Profil“ um.

---

## 4. Gelaufen

Testgetrieben: je Verhalten zuerst der fehlschlagende Test (rot aus dem erwarteten Grund), dann der Code.

| Verhalten | Rot | Grün |
|---|---|---|
| `getNotificationSettingsUrl` (`tests/api/utils/notification-settings-url.test.ts`) | Modul fehlt | 9/9 |
| `GET /config` liefert `notificationSettingsUrl` (`config.test.ts`) | Eigenschaft fehlt | 9/9 |
| Mail-`settingsUrl` zeigt auf den Hub (`notification-delivery-events.test.ts`) | `http://localhost:5173/dashboard/settings/account/notifications` statt Hub-URL | 5/5 |
| Sperre der Integrationen (`hub-integration-guard.test.ts`) | 200/400/404/500 statt 403; Webhook vom gesteuerten Admin gelöscht; Gitea-Secret geliefert | 15/15 |
| `hubUngovernedCapabilities`, `manageIntegrations` (`packages/permissions`) | `undefined` | 16/16 im Paket |
| Capability für gesteuerten Admin (`hub-permissions.test.ts`) | `manageIntegrations: true` | 86/86 |
| `canManageIntegrations` (`use-workspace-permission.test.tsx`) | „is not a function“ | 8/8 |
| Navigation: externer Link, Integrationen nur mit Capability (`build-settings-nav`, `settings-nav-group`) | Eintrag intern bzw. vorhanden; Name ohne Leerzeichen „…notificationssettings:opensInNewTab“ (im Code behoben) | 37/37 im Ordner |
| Route Benachrichtigungen leitet weiter (`account/notifications.test.tsx`) | alte Seite gerendert | 3/3 |
| Route Integrationen geschützt (`projects/$projectId/integrations.test.tsx`) | Seite für alle gerendert | 5/5 |

Gesamtläufe am 2026-11-17:

- `pnpm lint`: 4.085 Dateien formatiert, keine Lint-Fehler.
- `pnpm typecheck`: grün.
- `pnpm openapi:check`: aktuell (nach `openapi:check:fix`; nur Beschreibungen und `notificationSettingsUrl`, `manageIntegrations`).
- `pnpm i18n:check`: alle Locales synchron.
- `pnpm test`: alle Pakete grün (u. a. API-Unit 1.306, Web 1.769 Tests).
- `pnpm test:integration`: 1.976 bestanden, 3 übersprungen, 1 Fehlschlag in `admin-user-removal.test.ts` durch Zeitüberschreitung beim Verbindungsaufbau zu PostgreSQL (`timeout exceeded when trying to connect`). Die Datei allein erneut: 6/6 grün. Kein Bezug zu dieser Änderung.

Nicht gelaufen: Browser-Nachweis (Playwright) gegen `pnpm dev`.
