// MALINO 0.7 Cloud-KI: Gäste werden per serverseitigem Universalcode freigeschaltet.
// OpenAI-Schlüssel niemals an GitHub Pages ausliefern.
import { createClient } from 'npm:@supabase/supabase-js@2.57.0';

const baseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};
const modes = new Set(['fantasy', 'games', 'story', 'learning', 'gifts']);
const defaults = { imageModel: 'gpt-image-2', quality: 'medium', transcribeModel: 'gpt-4o-mini-transcribe' };
const promptPrefix = 'Kinderfreundliches A4-Ausmalmotiv für Kinder von 3 bis 10 Jahren. Portrait-Hochformat, durchgehend weißer Hintergrund, dicke durchgezogene schwarze Linien, große einfach ausmalbare Flächen, wenig Details, keine Farbe, keine Schatten, keine Graustufen, keine unangemessenen Inhalte.';

async function matchesActivationCode(entered, secret) {
  if(!secret || secret.length < 20 || entered.length < 12 || entered.length > 100) return false;
  const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
  const a=await digest(entered);
  const b=await digest(secret);
  let mismatch=0;
  for(let i=0;i<a.length;i++)mismatch|=a[i]^b[i];
  return mismatch===0;
}
function respond(status, body) { return new Response(JSON.stringify(body), {status,headers:baseHeaders}); }
function ageNote(group) {
  return group === '3-4' ? 'Extrem einfache Formen und besonders große Malflächen.'
    : group === '7-10' ? 'Etwas detailreichere, aber weiterhin klar abgegrenzte Malflächen.'
    : 'Einfaches Bild mit klaren Formen, geeignet für Vorschulkinder.';
}
function makePrompt(mode, subject, group) {
  const byMode = {
    fantasy: `Erstelle genau diese Fantasie-Szene als einzelne klassische Ausmalzeichnung: ${subject}. Bitte keine Schrift.`,
    games: `Erstelle eine EINZIGE, lösbare deutschsprachige Rätselseite zum Thema: ${subject}. Bei Labyrinthen muss mindestens ein gültiger Weg zum Ziel existieren. Suchbilder müssen klare zählbare Motive enthalten. Falls exakte Lösungen nicht zuverlässig darstellbar sind, vereinfache das Spiel deutlich.`,
    story: `Erstelle EINE DIN-A4-Hochformatseite mit einer vierteiligen Bildergeschichte: ${subject}. Vier deutlich voneinander getrennte Panels mit einer klaren zeitlichen Handlung. Pro Panel ein sehr kurzer, einfacher deutscher Satz.`,
    learning: `Erstelle EINE deutschsprachige Übungsseite zum Thema: ${subject}. Korrekte Buchstaben- oder Zahlenformen, sehr große Übungsfelder. Beschrifte nur auf Deutsch und nur mit sehr kurzen Wörtern.`,
    gifts: `Erstelle eine liebevolle schwarz-weiße Grußkarte zum Ausmalen: ${subject}. Wenig Text, nur in deutscher Sprache, mit genügend Platz für eine eigene Nachricht.`
  };
  return `${promptPrefix}\n${ageNote(group)}\n${byMode[mode]}`;
}
function upstreamError(status) {
  if (status === 401) return 'Der OpenAI-Schlüssel ist ungültig.';
  if (status === 429) return 'Der KI-Dienst ist ausgelastet. Versuche es später erneut.';
  return 'Die KI konnte deinen Wunsch gerade nicht verarbeiten.';
}
async function openai(path, key, body) {
  const response = await fetch(`https://api.openai.com/v1/${path}`,{
    method:'POST',
    headers:{Authorization:`Bearer ${key}`, ...(body instanceof FormData ? {} : {'Content-Type':'application/json'})},
    body: body instanceof FormData ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(125000)
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(upstreamError(response.status));
  return json;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null,{headers:baseHeaders});
  if (req.method !== 'POST') return respond(405,{error:'Nur POST unterstützt.'});
  let reserved = false;
  let reservedVoice = false;
  let userId = '';
  let admin;
  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!/^Bearer\s+\S+$/i.test(authHeader)) return respond(401,{error:'Bitte im Elternkonto anmelden.'});
    const token = authHeader.replace(/^Bearer\s+/i,'');
    const url = Deno.env.get('SUPABASE_URL');
    const adminKey = Deno.env.get('MALINO_SUPABASE_SECRET_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!url || !adminKey) return respond(503,{error:'Supabase-Backend ist noch nicht vollständig eingerichtet.'});
    admin = createClient(url, adminKey, {auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:userError} = await admin.auth.getUser(token);
    if(userError || !user) return respond(401,{error:'Deine Gerätesitzung ist ungültig. Bitte MALINO erneut freischalten.'});
    userId=user.id;

    // Nur nach gültiger Auth-Sitzung und serverseitigem Geheimnis aktivieren.
    if ((req.headers.get('content-type') || '').includes('application/json')) {
      const payload=await req.clone().json().catch(()=>null);
      if(payload?.action === 'activate'){
        const entered=typeof payload.code==='string'?payload.code.trim():'';
        const code=Deno.env.get('MALINO_ACCESS_CODE') || '';
        if(!code || code.length < 20) return respond(503,{error:'Der Zugangscode wurde serverseitig noch nicht eingerichtet.'});
        if(!await matchesActivationCode(entered,code))
          return respond(403,{error:'Zugangscode ungültig. Bitte prüfe die Schreibweise.'});
        const {error:activationError}=await admin.from('malino_access_grants')
          .upsert({owner_id:userId,activated_at:new Date().toISOString(),revoked_at:null},{onConflict:'owner_id'});
        if(activationError)throw new Error('Gerätefreigabe konnte nicht gespeichert werden.');
        return respond(200,{activated:true});
      }
    }

    const {data:grant,error:grantError}=await admin.from('malino_access_grants')
      .select('owner_id').eq('owner_id',userId).is('revoked_at',null).maybeSingle();
    if(grantError)throw new Error('Gerätefreigabe konnte nicht geprüft werden.');
    if(!grant)return respond(403,{error:'MALINO muss zunächst mit einem gültigen Zugangscode freigeschaltet werden.'});
    const aiKey = Deno.env.get('OPENAI_API_KEY');
    if(!aiKey)return respond(503,{error:'Die KI wurde noch nicht serverseitig eingerichtet.'});
    userId = user.id;
    const {data:settings,error:settingsError} = await admin.from('malino_settings')
      .select('daily_limit,age_group,voice_enabled').eq('owner_id',userId).maybeSingle();
    if (settingsError) throw new Error('Elterneinstellungen konnten nicht geladen werden.');
    if ((req.headers.get('content-type') || '').includes('multipart/form-data')) {
      if (settings?.voice_enabled === false) return respond(403,{error:'Die Sprachsteuerung ist im Elternbereich deaktiviert.'});
      const body = await req.formData();
      const audio = body.get('audio');
      if (!(audio instanceof File) || audio.size < 200 || audio.size > 8_000_000 ||
        !['audio/webm','audio/mp4','audio/ogg','audio/wav','audio/x-wav','audio/mpeg','audio/aac'].includes(audio.type.split(';')[0])) {
        return respond(400,{error:'Bitte eine gültige kurze Sprachaufnahme machen.'});
      }
      const form = new FormData();
      const mime = audio.type.split(';')[0];
      const extension = mime==='audio/mp4' ? 'm4a' : mime==='audio/ogg' ? 'ogg' : mime==='audio/wav'||mime==='audio/x-wav' ? 'wav' : mime==='audio/mpeg' ? 'mp3' : mime==='audio/aac' ? 'aac' : 'webm';
      form.append('file',audio,`wunsch.${extension}`);
      form.append('language','de');
      form.append('model',Deno.env.get('TRANSCRIBE_MODEL') || defaults.transcribeModel);
      const voiceReserve=await admin.rpc('malino_reserve_voice',{p_user_id:userId});
      if(voiceReserve.error)throw new Error('Sprachkontingent konnte nicht geprüft werden.');
      if(!voiceReserve.data)return respond(429,{error:'Das heutige Sprachkontingent ist aufgebraucht.'});
      reservedVoice=true;
      const result = await openai('audio/transcriptions',aiKey,form);
      reservedVoice=false;
      return respond(200,{text:String(result.text || '').slice(0,400)});
    }
    const body = await req.json();
    if (body?.action !== 'generate' || typeof body?.subject !== 'string' || !modes.has(body?.mode))
      return respond(400,{error:'Ungültiger MALINO-Wunsch.'});
    const subject = body.subject.trim().replace(/\s+/g,' ');
    if (subject.length < 4 || subject.length > 400) return respond(400,{error:'Der Wunsch muss 4–400 Zeichen lang sein.'});
    const checked = await openai('moderations',aiKey,{model:'omni-moderation-latest',input:subject});
    if (checked.results?.[0]?.flagged) return respond(400,{error:'Bitte wähle eine andere, kinderfreundliche Idee.'});
    const reserve = await admin.rpc('malino_reserve_generation',{p_user_id:userId});
    if (reserve.error) throw new Error('Das Tageslimit konnte nicht geprüft werden.');
    if (!reserve.data) return respond(429,{error:'Dein tägliches Bilderkontingent ist verbraucht. Morgen kannst du wieder neue Bilder erstellen.'});
    reserved = true;
    const image = await openai('images/generations',aiKey,{
      model:Deno.env.get('IMAGE_MODEL') || defaults.imageModel,
      prompt:makePrompt(body.mode,subject,settings?.age_group || '4-6'),
      size:'1024x1536',quality:Deno.env.get('IMAGE_QUALITY') || defaults.quality,n:1
    });
    const png = image.data?.[0]?.b64_json;
    if (!png) throw new Error('Es wurde kein Bild von der KI zurückgegeben.');
    // Zusätzliche multimodale Prüfung der generierten Grafik.
    const checkedImage = await openai('moderations',aiKey,{
      model:'omni-moderation-latest',
      input:[{type:'image_url',image_url:{url:`data:image/png;base64,${png}`}}]
    });
    if (checkedImage.results?.[0]?.flagged) throw new Error('Das Ergebnis wurde zur Sicherheit zurückgehalten. Bitte versuche ein anderes Motiv.');
    reserved = false;
    return respond(200,{image:`data:image/png;base64,${png}`,title:subject.slice(0,72),mode:body.mode});
  } catch (e) {
    if (reserved && userId && admin) await admin.rpc('malino_refund_generation',{p_user_id:userId}).catch(()=>null);
    if (reservedVoice && userId && admin) await admin.rpc('malino_refund_voice',{p_user_id:userId}).catch(()=>null);
    console.error('MALINO AI: ', e instanceof Error ? e.message : String(e));
    return respond(502,{error:e instanceof Error ? e.message : 'KI-Anfrage fehlgeschlagen.'});
  }
});
