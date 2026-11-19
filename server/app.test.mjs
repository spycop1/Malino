import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function file(name){return readFile(path.join(ROOT,name),'utf8');}
test('Alle fünf Kreativmodi in der Tablet-Webapp enthalten',async()=>{
  const source=await file('public/app.js');
  for(const mode of ['fantasy','games','story','learning','gifts'])assert.match(source,new RegExp(`\\b${mode}: \\{`));
});
test('Galerie/Elternbereich/PNG/A4 sind vorhanden',async()=>{
  const html=await file('public/index.html');
  for(const id of ['galleryBtn','parentBtn','pinInput','dailyLimitInput','printHistory','galleryGrid','printBtn','downloadBtn'])assert.ok(html.includes(`id="${id}"`));
});
test('GitHub Pages referenziert nur die öffentliche Webapp',async()=>{
  const workflow=await file('.github/workflows/pages.yml');
  assert.match(workflow,/path: public/);
  assert.doesNotMatch(workflow,/OPENAI_API_KEY/);
  const html=await file('public/index.html');
  assert.match(html,/src="\.\/app.js"/);
  assert.match(html,/href="\.\/manifest.webmanifest"/);
});
test('Supabase-RLS und serverseitige Limits sind im Schema angelegt',async()=>{
  const sql=await file('supabase/migrations/20261119000000_malino_schema.sql');
  for(const table of ['malino_settings','malino_usage','malino_artworks','malino_print_events'])assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`));
  assert.match(sql,/create or replace function public\.malino_reserve_generation/);
  assert.match(sql,/grant execute on function public\.malino_reserve_generation\(uuid\) to service_role/);
  assert.match(sql,/public,false,8388608|false,8388608/);
});
test('OpenAI-Schlüssel ist nur in Server-Funktion referenziert',async()=>{
  const cloud=await file('public/config.js');
  assert.doesNotMatch(cloud,/OPENAI_API_KEY|SERVICE_ROLE_KEY|sb_secret_/);
  const edge=await file('supabase/functions/malino-ai/index.ts');
  assert.match(edge,/Deno\.env\.get\('OPENAI_API_KEY'\)/);
  assert.match(edge,/malino_reserve_generation/);
  assert.match(edge,/admin\.auth\.getUser\(token\)/);
});
