import {readFile, access, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const get=async f=>readFile(path.join(base,f),'utf8');
function assert(ok,message){if(!ok)throw new Error('Projektprüfung: '+message);}

const html=await get('public/index.html');
const workflow=await get('.github/workflows/pages.yml');
const config=await get('public/config.js');
const cloud=await get('public/cloud.js');
const sql=(await readdir(path.join(base,'supabase/migrations'))).filter(f=>f.endsWith('.sql'));
const fun=await get('supabase/functions/malino-ai/index.ts');
assert(html.includes('./app.js')&&html.includes('./manifest.webmanifest'),'Relativer GitHub-Pages-Pfad fehlt');
assert(workflow.includes('actions/deploy-pages@')&&workflow.includes('path: public'),'Pages-Deployment fehlt');
assert(workflow.includes('MALINO_SUPABASE_URL')&&workflow.includes('MALINO_SUPABASE_PUBLISHABLE_KEY'),'Repository-Variablen fehlen im Workflow');
assert(!/\b(sb_secret_[A-Za-z0-9_-]{8,}|sk-(?:proj-)?[A-Za-z0-9_-]{10,})\b/.test(config),'Secret in Browser-Konfiguration!');
assert(!/SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|SUPABASE_SECRET_KEYS/.test(config),'Secret-Variable in öffentlicher Konfiguration');
assert(cloud.includes('signInAnonymously')&&cloud.includes('accessGranted')&&cloud.includes('functions.invoke'),'Anonymer Zugang, Freischaltung oder KI-Aufruf fehlen');
assert(html.includes('id="activationCode"') && !html.includes('id="parentEmail"'), 'Universalcode-Oberfläche fehlt oder alter E-Mail-Login ist noch vorhanden');
assert(sql.length>0,'Supabase SQL-Migration fehlt');
assert(fun.includes('malino_reserve_generation')&&fun.includes('MALINO_ACCESS_CODE')&&fun.includes('malino_access_grants')&&fun.includes('malino_reserve_voice'),'Serverseitige Codeprüfung oder Kostenlimits fehlen');
const accessSql=await get('supabase/migrations/20261119020000_universal_access.sql');
assert(accessSql.includes('malino_global_budget')&&accessSql.includes('malino_access_grants')&&accessSql.includes('malino_reserve_voice'),'Universalcode-Schema und globales Budget fehlen');
await access(path.join(base,'public','.nojekyll'));
for (const p of ['public/app.js','public/cloud.js','public/local-store.js','public/sw.js','public/config.js']) {
  const s=await get(p);
  assert(!s.includes('sk-proj-')&&!s.includes('sb_secret_'),'Ein geheimer Schlüsselkandidat wurde in '+p+' entdeckt');
}
console.log('MALINO 0.7: GitHub Pages, Universalcode, private Galerie und serverseitige Kostenlimits OK.');
