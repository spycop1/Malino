# MALINO 0.7: Universalcode ohne E-Mail-Anmeldung

Status: **Vorbereitet auf Feature-Branch `feature/universal-code-access`**. Die
laufende Version auf `main` bleibt bis zur vollständigen Umstellung unangetastet.

## Wie es funktioniert

1. Ein Besucher öffnet MALINO und gibt den von dir erhaltenen gemeinsamen Zugangscode ein.
2. Supabase erstellt im Hintergrund eine **anonyme, persistente Auth-Sitzung** auf diesem Gerät.
3. `malino-ai` prüft den Code **nur serverseitig** aus dem Edge Secret `MALINO_ACCESS_CODE`.
4. Ist er korrekt, wird die Geräte-/Benutzer-ID in `malino_access_grants` freigeschaltet.
5. Für Bild- und Spracherzeugung wird diese Freigabe auf dem Server überprüft.
6. Jede Galerie ist per Auth-ID + RLS getrennt, der Storage-Bucket bleibt privat.

**Weder der Code noch ein Server- oder OpenAI-Key dürfen in GitHub/Pages stehen.**

## Vor einer Aktivierung in Supabase

1. Im Dashboard **Authentication → Providers → Anonymous Sign-Ins** einschalten.
   Direkter Projektlink: https://supabase.com/dashboard/project/gnygfwjapdzkkahonpob/auth/providers
2. Unter **Edge Functions → Secrets** ein Secret namens `MALINO_ACCESS_CODE`
   mit einem langen, zufälligen und dauerhaft gemeinsam zu verwendenden Code
   (mindestens 20 Zeichen) hinterlegen. Der Wert darf **nicht** in GitHub stehen.
3. Sicherstellen, dass `OPENAI_API_KEY` hinterlegt ist. `MALINO_ALLOWED_EMAILS` ist
   in Version 0.7 nicht mehr die Zugriffsschranke.
4. Dann die SQL-Migration
   `supabase/migrations/20261119020000_universal_access.sql` anwenden.
5. Erst **danach** die Edge Function aus diesem Branch mit `verify_jwt=true`
   veröffentlichen und `main` auf MALINO 0.7 umstellen.

WICHTIG: Nie die Migration einzeln auf die laufende 0.6-Version anwenden:
Ab diesem Zeitpunkt verlangt die KI die neuen `malino_access_grants`.

## Kostenschutz

- Anfangs fünf generierte Bilder pro freigeschaltetem Gerät und Tag.
- Gemeinsames, serverseitig geprüftes **Gesamtlimit von 50 Bildern pro Tag**,
  unabhängig von der Anzahl registrierter Geräte.
- Maximal zehn Sprachaufnahmen pro Gerät und Tag, insgesamt 100 pro Projekt und Tag.
- Der Betreiber kann die gemeinsamen Limits über `malino_global_config` anpassen.
- **Zusätzlich** OpenAI-API-Ausgabenlimits und/oder Alerts verwenden.

## Sicherheit und Grenzen

- Ein gemeinsamer Code kann weitergegeben werden. Dadurch lässt sich **nicht**
  zuverlässig nachweisen, wer MALINO benutzt.
- Die Gerätefreigabe bleibt nach Änderung des Geheimcodes erhalten, bis der
  zugehörige Datensatz in `malino_access_grants` widerrufen wird.
- Browserdaten löschen, Inkognito verwenden oder Gerät wechseln führt bei
  anonymen Konten zum Verlust des bisherigen Galerie-Zugangs.
- Bereits vorhandene Galerien aus E-Mail-Konten werden nicht automatisch migriert.
- Anonyme Konten haben Postgres-Rolle `authenticated`, daher sind RLS-Policies
  weiterhin erforderlich.
- Der Eltern-PIN-Bereich bleibt erhalten, ersetzt aber keine echte
  Zugriffssicherheit gegenüber einem technisch versierten Gerätebenutzer.
- Die Version ist nicht für einen öffentlichen Kinderbetrieb freigegeben, bevor
  Datenschutz, Missbrauchsschutz und Live-Tests abgeschlossen sind.

## Geplanter Funktionstest vor Veröffentlichung

1. Ohne Code darf `malino-ai` weder Bild noch Transkription ausführen.
2. Falscher Code gibt 403 zurück.
3. Richtiger Code aktivierte ein Gerät; danach gelingen autorisierte Anfragen.
4. Anonymes Gerät A darf keine Galerie von Gerät B sehen oder bearbeiten.
5. Das Gesamtbudget begrenzt wiederholte Geräteaktivierungen.
6. Nach Browser-Neustart bleibt die Sitzung erhalten, wenn der Browser die
   Sitzungsdaten nicht gelöscht hat.
