# MALINO MagicPad 0.6 – GitHub + Supabase einrichten

**Anleitung für Windows, ohne Programmiererfahrung.** Diese Anleitung richtet eine private Testversion mit echter KI ein. Für einen öffentlichen kommerziellen Kinderbetrieb ist eine zusätzliche Sicherheits- und Datenschutzprüfung erforderlich.

## Die Architektur – was wo gespeichert wird

```text
iPad / Android-Tablet / PC
         │
         ├── GitHub Pages: öffentliche Webapp (HTML, CSS, JavaScript)
         │
         └── Supabase: Eltern-Login + Bildgalerie + sichere KI-Funktion
                                      │
                                      └── OpenAI API (Schlüssel nur auf dem Server)
```

GitHub Pages darf **niemals** einen OpenAI-API-Schlüssel oder Supabase-Secret-Key enthalten. Nur die **Projekt-URL** und der **Publishable-Key** sind öffentlich und dürfen in die GitHub-Repository-Variablen.

---

## SCHRITT 1 – Neues Supabase-Projekt anlegen

1. Öffne https://supabase.com/dashboard/projects und melde dich an.
2. Klicke auf **New project / Neues Projekt**.
3. Projektname: `MALINO-MagicPad`.
4. Organisation auswählen und ein eigenes, starkes Datenbankpasswort vergeben (nicht in GitHub speichern).
5. Eine EU-Region auswählen, wenn möglich die geografisch passende Region.
6. Projekt anlegen und warten, bis die Datenbank bereit ist.

**Wichtig:** Ein **neues Projekt** verwenden. MALINO darf nicht in die bereits vorhandene andere Datenbank installiert werden.

### Diese beiden Werte brauchst du später

Im Projekt unter **Settings → API Keys** (oder über den **Connect**-Dialog):

- **Project URL**, zum Beispiel `https://abcdefghijk.supabase.co`
- **Publishable key**: beginnt mit `sb_publishable_...`

Den **Secret Key (`sb_secret_...`) nicht kopieren** und vor allem **nicht in GitHub** speichern.

### Prüfung

Das neue Projekt ist sichtbar. Notiere Projekt-URL und Publishable-Key **nur für Schritt 5**.

---

## SCHRITT 2 – Datenbank für MALINO anlegen

1. Öffne dein **neues MALINO-Projekt** in Supabase.
2. Menü **SQL Editor** öffnen → **New query / Neue Abfrage**.
3. In diesem Download die Datei `supabase/migrations/20261119000000_malino_schema.sql` öffnen.
4. **Den gesamten Inhalt** kopieren, in den SQL Editor einfügen und **Run** drücken. Nur einmal ausführen.

Das erstellt:

- `malino_settings` (Elterneinstellungen)
- `malino_usage` (serverseitiger Tageszähler)
- `malino_artworks` (Bildkatalog)
- `malino_print_events` (Druckdialog-Historie)
- Storage-Bucket `malino-artworks` (**privat**)
- Sicherheitsrichtlinien / RLS und serverseitige Funktionen für das KI-Tageskontingent.

### Prüfung

Im **Table Editor** sollten die vier Tabellen sichtbar sein. Unter **Storage** sollte der private Bucket `malino-artworks` existieren. Bei den Tabellen muss **Row Level Security (RLS)** aktiviert sein.

---

## SCHRITT 3 – OpenAI-KI in Supabase anschließen

### 3.1 OpenAI API-Schlüssel erstellen

1. Öffne https://platform.openai.com/api-keys.
2. Erzeuge einen API-Schlüssel für MALINO und lege ein kleines Ausgabenlimit im OpenAI-API-Dashboard fest.
3. **ChatGPT Plus umfasst kein API-Guthaben**: Die Bild- und Sprachaufrufe werden separat nach Nutzung abgerechnet.

Den Schlüssel **niemals in GitHub, in einen Screenshot oder an andere Personen weitergeben**.

### 3.2 Die Supabase Edge Function bereitstellen (ohne CLI)

1. Supabase-Projekt → **Edge Functions** öffnen.
2. **Deploy new function** / **Create a function** → **Via Editor** auswählen (Bezeichnung kann leicht abweichen).
3. Funktionsname **exakt `malino-ai`** eingeben.
4. Den vollständigen Inhalt der Datei `supabase/functions/malino-ai/index.ts` in den Funktionseditor kopieren.
5. Funktion veröffentlichen. Die Funktion muss für Benutzer-JWTs **`verify_jwt = true`** verwenden (Standardeinstellung/bei Konfiguration prüfen).

**Alternative für Entwickler:** Supabase CLI mit lokalem Projekt verwenden. Vor Aufrufen einer neuen CLI-Version die Befehle mit `supabase --help` bzw. `supabase functions deploy --help` überprüfen; die CLI v3 hat das Verhalten für lokale/entfernte Deployments geändert.

### 3.3 Geheimnisse ausschließlich in Supabase hinterlegen

Im Supabase-Dashboard unter **Edge Functions → Secrets** / **Project Settings → Edge Functions Secrets**:

| Name | Wert |
|---|---|
| `OPENAI_API_KEY` | Dein privater OpenAI-API-Schlüssel |
| `MALINO_ALLOWED_EMAILS` | Deine Eltern-E-Mail-Adresse, z. B. `name@beispiel.de` |
| `IMAGE_MODEL` | `gpt-image-2` (optional) |
| `IMAGE_QUALITY` | `medium` (optional) |
| `TRANSCRIBE_MODEL` | `gpt-4o-mini-transcribe` (optional) |

Mehrere Eltern-E-Mail-Adressen bei `MALINO_ALLOWED_EMAILS` durch Kommas trennen. **Nur freigegebene Adressen dürfen kostenpflichtige KI-Aufrufe ausführen.**

Supabase stellt der Funktion normalerweise interne Admin-Zugangsdaten bereit. Sollten diese in deinem Projekt fehlen, kannst du als **serverseitiges** Secret zusätzlich `MALINO_SUPABASE_SECRET_KEY` mit einem Supabase-Secret-Key hinterlegen. **Dieser Key darf niemals nach GitHub.**

### Prüfung

Unter **Edge Functions** gibt es `malino-ai` im Zustand **Deployed / Aktiv**. Die Secrets sind gesetzt, aber ihre Werte sind im Browser nicht sichtbar. Eine direkte Anfrage ohne Anmeldung muss mit 401/403 abgewiesen werden – **nicht** mit einem KI-Bild antworten.

---

## SCHRITT 4 – GitHub-Repository erstellen

Ich habe in deiner verbundenen GitHub-Umgebung den Benutzernamen **`spycop1`** gefunden. Das MALINO-Repository **`spycop1/Malino`** ist bereits angelegt.

### Einfach mit GitHub Desktop

1. Öffne https://desktop.github.com/ und installiere GitHub Desktop (falls noch nicht installiert).
2. Die ZIP-Datei `MALINO-MagicPad-v0.6.zip` vollständig entpacken.
3. GitHub Desktop → **File → Add local repository** → den entpackten Ordner `malino-magicpad-v0.6` auswählen.
4. Das bereits angelegte Repository **`spycop1/Malino`** verwenden.
5. Den ersten Commit erstellen und per **Push origin** ins bestehende Repository hochladen.
6. GitHub Pages ist für das öffentliche Repository **`spycop1/Malino`** vorgesehen. Keine geheimen API-Schlüssel hochladen.

Alternativ die entpackten Dateien einschließlich `.github/` mit Git in den Branch `main` des vorhandenen Repositories hochladen. **Nicht die ZIP-Datei als einziges Repository-Objekt hochladen.**

### Prüfung

Unter `https://github.com/spycop1/Malino` sind die Ordner `public/`, `supabase/` und `.github/workflows/` sichtbar.

---

## SCHRITT 5 – GitHub mit Supabase verbinden (nur 2 ÖFFENTLICHE Variablen)

Dein neues GitHub-Repository öffnen → **Settings → Secrets and variables → Actions → Variables**.

Dort **zwei Repository variables** hinzufügen (nicht unter *Secrets*; beides sind öffentliche Werte):

| Variable | Inhalt |
|---|---|
| `MALINO_SUPABASE_URL` | deine **Project URL**, z. B. `https://abcdefghijk.supabase.co` |
| `MALINO_SUPABASE_PUBLISHABLE_KEY` | dein **Publishable key**, beginnt mit `sb_publishable_...` |

Anschließend **Actions** → Workflow **„MALINO MagicPad veröffentlichen“** → **Run workflow** (Branch `main`).

Der Workflow erstellt `public/config.js` in der **GitHub-Actions-Ausgabe automatisch**. Du brauchst `public/config.js` **nicht** von Hand zu bearbeiten.

**Wichtig:** In *GitHub Actions Secrets* gehört **kein OpenAI-Schlüssel**, und in *Repository Variables* gehört **nur** der Publishable-Key, niemals ein `sb_secret_...`-Key.

### Prüfung

Unter **Actions** muss der Workflow **grün / erfolgreich** sein. Die Datei `public/config.js` im GitHub-Repository bleibt eine harmlose Platzhalterdatei; nur das veröffentlichte Pages-Artefakt enthält die beiden öffentlichen Werte.

---

## SCHRITT 6 – GitHub Pages aktivieren

1. Repository → **Settings → Pages**.
2. **Build and deployment → Source → GitHub Actions** auswählen.
3. Falls noch nicht ausgeführt, unter **Actions** den Workflow manuell starten oder einen neuen Commit auf `main` pushen.
4. Warten, bis die Veröffentlichung erfolgreich ist.

Für den Repository-Namen `Malino` und den gefundenen GitHub-Nutzer lautet die **voraussichtliche** Webadresse:

`https://spycop1.github.io/Malino/`

Diese URL gilt **erst nach erfolgreicher Veröffentlichung**, nicht vorher.

### Prüfung

Die Webseite zeigt das MALINO-Logo, die 5 Kreativmodi, Demo-Maltafel, Galerie und Elternbereich. Der Status sollte mit hinterlegten Variablen **„Cloud konfiguriert“** anzeigen. Erst nach Anmeldung sind die KI-Funktionen nutzbar.

---

## SCHRITT 7 – E-Mail-Anmeldung mit Supabase verbinden

1. Supabase → **Authentication → URL Configuration**.
2. **Site URL** auf die tatsächliche GitHub-Pages-Webadresse setzen, **mit abschließendem `/`**.
3. Dieselbe URL unter **Redirect URLs** ergänzen.
4. Für lokale Tests zusätzlich `http://127.0.0.1:8787/` als Redirect URL eintragen.
5. Unter **Authentication → Providers → Email** prüfen, ob E-Mail-Anmeldung erlaubt ist.
6. Öffne die GitHub-Pages-App → **⚙ Eltern → Eltern-PIN festlegen → Eltern-E-Mail eintragen → Anmeldelink senden**.
7. Den Link **auf dem gleichen Browser/Tablet öffnen**, mit dem du dich anmelden möchtest.

Bei einem Testprojekt gelten Versandlimits des eingebauten Supabase-E-Mail-Dienstes. Für mehr Nutzer wird ein eigener SMTP-Dienst sinnvoll bzw. erforderlich. Für einen kontrollierten Test kannst du nach Anlage deines Elternkontos öffentliche Registrierungen im Auth-Bereich einschränken, um unerwünschte Neuanmeldungen zu vermeiden.

### Prüfung

Im Elternbereich erscheint **„Angemeldet: deine Adresse“**. Dann sollte `MALINO_ALLOWED_EMAILS` mit dieser Adresse übereinstimmen und die App den aktuellen KI-Tageszähler laden können.

---

## SCHRITT 8 – Vollständigen Funktionstest durchführen

| Test | Erwartetes Ergebnis |
|---|---|
| Fantasie-Drucker → „Ein Affe auf einem Baum“ | KI erstellt ein Schwarz-Weiß-Ausmalbild |
| Farben → Grün wählen → Fläche antippen | Nur die gewählte Fläche wird bunt, soweit Konturen geschlossen sind |
| Mikrofon antippen → Wunsch sprechen | Der Wunsch erscheint auf Deutsch und startet die Bildgenerierung |
| „In Galerie“ | Bild wird lokal gespeichert und bei Anmeldung privat synchronisiert |
| Galerie → Bild öffnen | Das gespeicherte Bild lässt sich wieder anzeigen |
| Eltern → tägliches Limit ändern | Neues Limit wird gespeichert und serverseitig beachtet |
| „A4 drucken“ | Druckdialog wird geöffnet (tatsächlich gedruckt wird erst nach Bestätigung) |
| App zum Startbildschirm hinzufügen | MALINO erscheint wie eine Tablet-App |

Wenn du „KI nicht bereit“ oder „Eltern-Anmeldung erforderlich“ siehst, zuerst Schritte 5 bis 7 prüfen. Wenn 401/403 erscheint, überprüfe Login, Funktions-JWT und `MALINO_ALLOWED_EMAILS`.

---

## SCHRITT 9 – MALINO auf dem Tablet installieren

### iPad

1. MALINO-Webadresse in **Safari** öffnen.
2. Teilen-Symbol → **Zum Home-Bildschirm**.
3. MALINO antippen; die PWA kann wie eine App geöffnet werden.

### Android-Tablet

1. MALINO in **Chrome** öffnen.
2. Browsermenü → **App installieren** oder **Zum Startbildschirm hinzufügen**.
3. Berechtigungen fürs Mikrofon bei der ersten Sprachaufnahme bestätigen.

**Hinweis:** WLAN/Internet ist für neue KI-Bilder erforderlich. Ausmalen mit einem bereits geladenen oder lokal gespeicherten Bild kann auch ohne KI möglich sein.

---

## Häufige Probleme

**Der GitHub-Workflow ist rot:** Prüfe, ob beide Repository-Variablen exakt geschrieben sind. Ein ungültiger Publishable-Key wird absichtlich abgewiesen. Unter GitHub Settings → Pages muss GitHub Actions als Quelle eingerichtet sein.

**Die App zeigt nur den Demomodus:** Die beiden Repository-Variablen sind noch nicht gesetzt oder der Pages-Workflow wurde danach nicht erneut ausgeführt.

**Keine E-Mail kommt an:** Spam-Ordner prüfen, Supabase Auth-E-Mail-Konfiguration und Versandlimits prüfen. Falls mehrere Versuche erfolgt sind, etwas Abstand lassen.

**„Nicht freigeschaltet“ beim KI-Bild:** E-Mail-Adresse im Supabase Edge Secret `MALINO_ALLOWED_EMAILS` korrigieren (Groß-/Kleinschreibung ist egal).

**Auf dem Tablet funktioniert das Mikrofon nicht:** GitHub-Pages-URL muss mit HTTPS geladen werden, Mikrofonberechtigung muss erlaubt sein, und der Browser muss `MediaRecorder` unterstützen.

**Bilder werden nicht in der Cloud gespeichert:** Supabase Storage Bucket, RLS-Policies, angemeldetes Elternkonto und mögliche Dateigrößenlimits überprüfen. Lokale Galerie funktioniert unabhängig davon.

**Ein Rätsel oder Arbeitsblatt enthält einen Fehler:** Die KI kann sich bei Buchstaben, Zahlen und Lösungswegen irren. Vor Verwendung mit Kindern überprüfen. Für eine spätere Produktversion sollten diese Seiten strukturiert und deterministisch gerendert werden.

---

## Wichtige Sicherheitsgrenzen

- Die Eltern-PIN ist nur eine **lokale UI-Sperre**, kein vollwertiges Account-Sicherheitsmerkmal.
- Die Kunstwerke sind bei Cloud-Nutzung über Row Level Security an das jeweilige Elternkonto gebunden.
- Druckhistorie zeigt **Druckdialog-Aufrufe**, keine erfolgreichen Papierausdrucke.
- Die Funktion besitzt eine Eltern-E-Mail-Freigabeliste und ein serverseitiges KI-Tageslimit. Das ist ein Schutz für einen privaten MVP, **kein vollständiger Schutz für eine öffentlich vermarktete Kinder-App**.
- Vor Veröffentlichung für fremde Familien sind Datenschutz-/Kinderschutzkonzept, Aufbewahrung/Löschung, Einwilligungen, Sicherheitstests, Moderation und Kostenkontrolle separat zu prüfen.

---

## Offizielle Referenzen

- Supabase Dashboard: https://supabase.com/dashboard/projects
- Supabase Auth Redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Supabase API Keys: https://supabase.com/docs/guides/getting-started/api-keys
- GitHub Pages einrichten: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- GitHub Desktop: https://desktop.github.com/
- OpenAI API-Schlüssel: https://platform.openai.com/api-keys
