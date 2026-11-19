# MALINO MagicPad 0.6.2 — deutsche Tablet-Webapp

**5 Kreativfunktionen + Premium-UI + lokale und private Cloud-Galerie + Elternbereich + serverseitige KI-Tageslimits.**

MALINO ist ein eigenständiger, installierbarer PWA-Prototyp für Tablet, PC und Smartphone. Die öffentlichen Dateien können auf **GitHub Pages** laufen; die OpenAI-Verarbeitung geschieht ausschließlich in einer authentifizierten **Supabase Edge Function**.

## Enthaltene Funktionen

| Modul | Funktion |
| --- | --- |
| Fantasie-Drucker | KI-Ausmalbilder aus freien Wünschen |
| Spiele-Erfinder | KI-generierte Labyrinthe, Suchbilder und Rätsel |
| Geschichten-Maschine | Vier Szenen auf **einer** ausmalbaren A4-Seite |
| Lernassistent | Arbeitsblätter zu Zahlen, Buchstaben und Schreiben |
| Geschenkewerkstatt | Ausmalkarten, Einladungen und Geschenke |

Zusätzlich: Mikrofonaufnahmen mit deutscher Spracherkennung, Pinsel/Füllen/Radierer, elf Farben, Undo/Redo, PNG-Download, A4-Druck, PWA-Installation, Offline-Demomodus, Eltern-PIN, altersbezogene Bildprompts, Druckhistorie, private Galerie, Kindersprach-/Druckschalter und tägliches KI-Limit.

**Hinweis:** Die Qualität KI-generierter Texte, Rätsel und Labyrinthe muss manuell kontrolliert werden. Der Geschichten-Modus liefert gegenwärtig ein vierteiliges A4-Blatt, **noch kein vierseitiges Heft**. Die Druckhistorie zählt geöffnete Druckdialoge und nicht nachweislich erfolgreiche Papierausdrucke.

## 1. Sofort lokal ausprobieren — auch ohne Cloud

1. [Node.js](https://nodejs.org/) in einer aktuellen Version (>= 20.19) installieren.
2. Archiv entpacken.
3. Unter Windows `start-malino.bat` doppelklicken; alternativ im Projektordner `npm start`.
4. Browser: **http://127.0.0.1:8787/**.
5. Demo-Affenbild ausmalen, mit **„In Galerie“** speichern und die **Eltern-PIN** festlegen. Die lokale Galerie benutzt IndexedDB auf diesem Gerät.

Ohne Supabase sind KI-Bildgenerierung, Spracherkennung und Cloud-Synchronisierung ausdrücklich **nicht** aktiv. Für die Webapp selbst ist keine Installation von npm-Abhängigkeiten nötig.

## 2. Eigenes Supabase-Projekt anlegen

Für MALINO bitte ein **neues, separates Supabase-Projekt** verwenden. So bleiben andere bestehende Datenbanken/Projekte unberührt.

1. Auf [supabase.com](https://supabase.com/dashboard/projects) ein Projekt anlegen.
2. In der **SQL-Editor**-Ansicht den vollständigen Inhalt von `supabase/migrations/20261119000000_malino_schema.sql` ausführen. Die Migration ist für ein *leeres* MALINO-Projekt gedacht und legt `malino_settings`, `malino_usage`, `malino_artworks`, `malino_print_events`, Row-Level Security, private Storage und die serverseitigen Reservierungs-Funktionen an.
3. Unter **Authentication → URL Configuration** die spätere GitHub-Pages-Adresse als **Site URL** und **Redirect URL** eintragen, z.B. `https://DEINNAME.github.io/MALINO/`. Für lokale Logins außerdem `http://127.0.0.1:8787/` zu den Redirect URLs ergänzen.
4. Bei **Authentication → Providers → Email** die E-Mail-Anmeldung/Magic Links aktivieren und prüfen, ob tatsächlich eine Anmeldemail zugestellt wird. Externer SMTP kann bei produktivem Einsatz nötig werden.

### 2a. Edge Function bereitstellen

Lokal die **Supabase CLI v3** installieren (siehe offizielle Supabase-Dokumentation), dann:

```bash
supabase login
supabase link --project-ref DEINE_PROJEKT_ID
supabase functions deploy malino-ai --yes
```

Die Funktion liegt in `supabase/functions/malino-ai/index.ts`. `supabase/config.toml` aktiviert die JWT-Prüfung (`verify_jwt = true`). GitHub Pages enthält **keinen** geheimen Server-Schlüssel.

### 2b. Edge Secrets hinterlegen

Im Supabase-Dashboard unter **Edge Function Secrets** mindestens:

```text
OPENAI_API_KEY = dein geheimer OpenAI API-Schlüssel
MALINO_ALLOWED_EMAILS = deine-elternadresse@example.com
```

Optional:

```text
IMAGE_MODEL = gpt-image-2
IMAGE_QUALITY = medium
TRANSCRIBE_MODEL = gpt-4o-mini-transcribe
```

**MALINO_ALLOWED_EMAILS ist für den Prototyp erforderlich.** Mehrere freigeschaltete Elternadressen lassen sich per Komma trennen. Selbst wenn Unbekannte über Supabase ein E-Mail-Konto registrieren, können sie die kostenpflichtige KI-Funktion ohne Freigabe nicht benutzen.

Zum Wechsel der KI-Modelle die jeweils aktuellen OpenAI-API-Dokumentationen prüfen. Die Kosten werden über dein eigenes OpenAI-API-Konto abgerechnet.

## 3. Browser mit Supabase verbinden

In `public/config.js` diese **beiden öffentlichen** Werte eintragen:

```js
export const MALINO_CLOUD = Object.freeze({
  supabaseUrl: 'https://DEINE-PROJEKT-ID.supabase.co',
  supabasePublishableKey: 'sb_publishable_...'
});
```

**Erlaubt:** Projekt-URL und Publishable-Key (bzw. bei Altsystemen ANON-Key). **Verboten:** `OPENAI_API_KEY`, `SUPABASE_SECRET_KEYS`, `sb_secret_...` und `service_role` im `public`-Ordner, in Git oder im Browser.

Die Webapp importiert nur bei aktivierter Cloud eine fest gepinnte `supabase-js`-Version über HTTPS (`esm.sh`). Der Demomodus benötigt sie nicht.

## 4. GitHub Pages veröffentlichen

1. Ein eigenes GitHub-Repository anlegen, z.B. `Malino`.
2. Das gesamte Projekt in das Repository auf den Branch `main` übertragen. GitHub Actions findet `.github/workflows/pages.yml`.
3. Unter **Settings → Pages → Build and deployment → Source** **GitHub Actions** auswählen.
4. Nach einem erfolgreichen Workflow ist die App unter `https://spycop1.github.io/Malino/` erreichbar.
5. Genau diese URL bei Supabase Auth als Weiterleitungsadresse eintragen (Schritt 2).
6. Eltern öffnen den Elternbereich → PIN festlegen → E-Mail-Link anfordern → Login bestätigen → Limits einstellen. Die Auth-Sitzung bleibt auf dem Gerät gespeichert.

Die Action veröffentlicht **ausschließlich den `public`-Ordner**. Backend, SQL und geheime `.env`-Dateien gelangen nicht auf die öffentliche Website.

## 5. Elternbereich: Grenzen und Daten

- **Eltern-PIN:** lokal gesalzener PBKDF2-Hash. Schutz vor versehentlichem Öffnen am Gerät. **Keine starke Autorisierung gegenüber einem technisch versierten Nutzer desselben Browsers.**
- **Eltern-Login:** E-Mail-Magic-Link über Supabase Auth. Es ist kein eigenes Kinderkonto nötig.
- **Tägliches KI-Limit:** standardmäßig fünf Bilder pro Elternkonto und Tag, per Einstellungen 1–30. Die SQL-Reservierung läuft atomar auf dem Server. Zeitzone: Europa/Berlin. Fehlgeschlagene Bildanfragen werden nach Möglichkeit erstattet.
- **Sprach- und Druckschalter:** die KI-Sprachtranskription wird serverseitig blockiert, wenn Sprache deaktiviert wurde. Der Druck-Button wird ausgeblendet/deaktiviert. Ein Browser lässt sich allerdings über Betriebssystem-Tastenkürzel nicht vollständig am Drucken hindern.
- **Galerie:** lokale IndexedDB ohne Elternkonto; bei Login zusätzlich private Bilder in Supabase Storage, getrennt nach Eltern-ID.
- **Druckhistorie:** lokale und synchronisierte Einträge bei geöffnetem Druckdialog. Keine Prüfung des wirklichen Druckerfolgs.

Im Cloud-Modus sind Tabellen und Dateien mit Row Level Security nach Eltern-ID getrennt. Trotzdem ist das vorliegende Projekt **ein MVP, kein abschließend auditiertes Kinderprodukt**. Vor öffentlichem Launch sind Datenschutz, Datensparsamkeit, Löschkonzept, Einwilligungen, Moderation und Sicherheit unabhängig zu prüfen.

## 6. Tests und Einschränkungen

```bash
npm test
node --check public/app.js
node --check public/cloud.js
node --check public/local-store.js
```

Mit `npm test` werden Projektstruktur, Modulnamen, öffentliche/geschützte Konfiguration und Schema-Prüfpunkte kontrolliert.

**Getestet:** Node-Syntax, Serverstart, statische HTTP-Dateiauslieferung und Projekttests. **Nicht live getestet:** Supabase-Datenbankmigration in einem echten Cloud-Projekt, Login/E-Mail-Zustellung, OpenAI-Aufrufe, Tablet-Gesten und ein echter Papierausdruck. Diese Tests sind nach der Einrichtung erforderlich.

## Projektstruktur

```text
public/                         GitHub-Pages-Webapp, PWA und Demo
  index.html                    Premium-Oberfläche
  app.js                        Kreativmodi, Malen, Galerie, Elternbereich
  cloud.js                      Supabase Auth, Storage und Functions
  local-store.js                lokale Bilder und Druckhistorie
  config.js                     öffentliche Supabase URL und Publishable Key
  styles.css                    Tablet-Layout
  manifest.webmanifest          installierbare Webapp
  sw.js                         Offline-Demo-Cache
supabase/
  migrations/*.sql              RLS, Settings, Zähler, Bilder, Druckereignisse
  functions/malino-ai/index.ts  kostenpflichtige KI nur serverseitig
.github/workflows/pages.yml    GitHub-Pages-Deployment
server/index.mjs                optionaler lokaler Demo-HTTP-Server
```

## Nächste technische Aufgaben vor dem Marktstart

Wirklich texttreue Lernblätter und lösbare Labyrinthe sollten besser **strukturiert erzeugt und danach gerendert** werden, statt sie nur als Bild mit Text von einem Bildmodell zeichnen zu lassen. Für ein späteres Kinderprodukt außerdem Account-Trennung nach Rollen, Eltern-Reauthentifizierung, Monitoring gegen Missbrauch, Nutzungsdaten-Sparsamkeit und vollständige Browser-/Geräte-Tests ergänzen.

## Update 0.6.1: Elternanmeldung

Die App erkennt nach Rückkehr vom E-Mail-Link jetzt den Anmeldestatus,
zeigt verständliche Rückmeldungen bei verbrauchten/abgelaufenen Links und
aktualisiert die Anmeldung ohne manuelles Neuladen. Wichtig: Der Link ist
nur einmal gültig. Er muss auf demselben Gerät und im selben Browser
geöffnet werden, auf dem MALINO verwendet werden soll.

## Update 0.6.2: Einfacher Eltern-Login

Im Elternbereich gibt es nun **E-Mail + Passwort**. Bestehende per Magic Link
bestätigte Konten haben nicht automatisch ein Passwort. Klicke einmalig
**„Erstmals Passwort festlegen / Passwort vergessen“**, öffne die Supabase-
Wiederherstellungs-E-Mail, kehre zu MALINO zurück, öffne **Eltern** per Geräte-PIN
und hinterlege dein eigenes Passwort. Danach kann das Konto jederzeit direkt
per E-Mail/Passwort angemeldet werden. Das Passwort wird nie im Repository gespeichert.
