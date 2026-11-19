/**
 * Erzeugt ausschließlich die öffentlich zulässigen Supabase-Konfigurationsdaten.
 * Wird durch GitHub Actions mit Repository-VARIABLEN aufgerufen (keine Secrets!).
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(directory, 'public', 'config.js');
const url = (process.env.MALINO_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const key = (process.env.MALINO_SUPABASE_PUBLISHABLE_KEY || '').trim();

function validate(url, key) {
  if (!url && !key) return 'demo';
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) throw new Error('Die Supabase-Projekt-URL ist ungültig. Erwarte https://PROJECT_REF.supabase.co');
  if (!/^(sb_publishable_[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_.-]{30,})$/.test(key)) {
    throw new Error('Es wird ausschließlich ein öffentlicher Supabase Publishable-Key oder Legacy-ANON-Key akzeptiert. Keine Secret-/Service-Role-Keys!');
  }
  return 'cloud';
}

try {
  const mode = validate(url,key);
  const content = `// Diese Datei enthält nur öffentliche Supabase-Einstellungen.\n// NIEMALS OpenAI- oder Supabase-Secret-/Service-Role-Keys eintragen!\nexport const MALINO_CLOUD = Object.freeze({\n  supabaseUrl: ${JSON.stringify(url)},\n  supabasePublishableKey: ${JSON.stringify(key)}\n});\n`;
  await writeFile(target, content, 'utf8');
  console.log(mode === 'cloud' ? 'MALINO: Öffentliche Supabase-Konfiguration erstellt.' : 'MALINO: Keine Cloud-Variablen vorhanden. Veröffentlichung erfolgt im Demomodus.');
} catch (error) {
  console.error('Konfiguration fehlgeschlagen:', error.message);
  process.exitCode = 1;
}
