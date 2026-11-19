// Einfacher lokaler Entwicklungsserver für die statische Tablet-Webapp.
// KI und Sprachverarbeitung laufen AUSSCHLIESSLICH über Supabase Edge Functions.
import {createServer} from 'node:http';
import {stat,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const PUBLIC=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const HOST='127.0.0.1';
const PORT=Number(process.env.PORT||8787);
const MIME={
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.json':'application/json; charset=utf-8',
  '.webmanifest':'application/manifest+json',
  '.ico':'image/x-icon'
};
const server=createServer(async(req,res)=>{
  if(req.method!=='GET' && req.method!=='HEAD') {res.writeHead(405);res.end();return;}
  try{
    const pathname=new URL(req.url||'/',`http://${HOST}:${PORT}`).pathname;
    const relative=decodeURIComponent(pathname==='/'?'index.html':pathname.slice(1));
    const target=path.resolve(PUBLIC,relative);
    if(!target.startsWith(PUBLIC+path.sep)) {res.writeHead(403);res.end();return;}
    const info=await stat(target);
    if(!info.isFile())throw new Error('Kein Dokument');
    const data=await readFile(target);
    res.writeHead(200,{'Content-Type':MIME[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404);res.end('Nicht gefunden');}
});
server.listen(PORT,HOST,()=>console.log(`MALINO MagicPad 0.6: http://${HOST}:${PORT}`));
