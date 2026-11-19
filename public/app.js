'use strict';
import {
  cloudConfigured, cloud, signedIn, accessGranted, activateCloud,
  generateCloud, transcribeCloud, fetchSettings, updateSettings,
  getDailyUse, uploadArtwork, fetchCloudGallery, deleteCloudArtwork,
  logCloudPrint, fetchCloudPrints
} from './cloud.js';
import {localArt, localPrints} from './local-store.js';

const WIDTH = 900;
const HEIGHT = 1273;
const $ = id => document.getElementById(id);
const canvas = $('paintCanvas');
const ctx = canvas.getContext('2d', {willReadFrequently: true});
const activationModal = $('activationModal');
const outline = $('outlineImage');

const palette = [
  {name: 'Rot', hex: '#e96767'},
  {name: 'Orange', hex: '#f3a251'},
  {name: 'Gelb', hex: '#f6cf4e'},
  {name: 'Grün', hex: '#66ad7c'},
  {name: 'Mint', hex: '#70c8b6'},
  {name: 'Hellblau', hex: '#76b8e3'},
  {name: 'Blau', hex: '#517bdb'},
  {name: 'Lila', hex: '#9f82d7'},
  {name: 'Pink', hex: '#e58eb8'},
  {name: 'Braun', hex: '#95684d'},
  {name: 'Schwarz', hex: '#333743'}
];

const modes = {
  fantasy: {
    id: 'fantasy',
    icon: '🐉',
    name: 'Fantasie-Drucker',
    short: 'Ausmalbild',
    description: 'MALINO erstellt ein individuelles Ausmalbild aus deiner Fantasie – perfekt für Tablet und A4-Druck.',
    placeholder: 'Zum Beispiel: Male mir einen Drachen, der auf einem Skateboard fährt.',
    resultMeta: 'Individuelles Ausmalbild · A4 geeignet',
    hint: 'Tippe auf geschlossene Flächen oder male frei weiter.',
    ideas: [
      'Male mir einen Drachen, der auf einem Skateboard fährt.',
      'Ein Affe sitzt auf einem Baum und hält eine Banane.',
      'Ein freundlicher Roboter angelt auf dem Mond.'
    ]
  },
  games: {
    id: 'games',
    icon: '🚀',
    name: 'Spiele-Erfinder',
    short: 'Spiel & Rätsel',
    description: 'MALINO erzeugt Labyrinthe, Suchbilder, Punkt-zu-Punkt-Bilder und kleine Rätsel – kindgerecht und zum Ausmalen.',
    placeholder: 'Zum Beispiel: Mach mir ein Weltraum-Labyrinth mit Rakete und Planet.',
    resultMeta: 'Rätsel- und Spielseite · A4 geeignet',
    hint: 'Rätselseiten kannst du zuerst lösen und danach bunt ausmalen.',
    ideas: [
      'Mach mir ein Weltraum-Labyrinth mit einer Rakete.',
      'Erstelle ein Suchbild mit Dschungeltieren.',
      'Ich möchte ein Punkt-zu-Punkt-Bild mit einem Dino.'
    ]
  },
  story: {
    id: 'story',
    icon: '🦄',
    name: 'Geschichten-Maschine',
    short: 'Geschichte',
    description: 'MALINO erstellt eine kurze deutsche Bildergeschichte mit passenden Szenen – ideal als ausmalbare Heftseite.',
    placeholder: 'Zum Beispiel: Erfinde eine Geschichte über einen Ritter und ein Einhorn.',
    resultMeta: 'Kurze Bildergeschichte · Deutsch · A4 Seite',
    hint: 'Bei Geschichten entstehen mehrere Szenen auf einer Seite.',
    ideas: [
      'Erfinde eine Geschichte über einen Ritter und ein Einhorn.',
      'Eine kleine Geschichte über einen mutigen Hund im Wald.',
      'Eine Piratengeschichte mit Schatzkarte und Papagei.'
    ]
  },
  learning: {
    id: 'learning',
    icon: '🍎',
    name: 'Lernassistent',
    short: 'Lernen',
    description: 'MALINO gestaltet einfache Arbeitsblätter zum Schreiben, Zählen, Lesen und Üben – liebevoll illustriert.',
    placeholder: 'Zum Beispiel: Ich möchte die Buchstaben lernen, heute den Buchstaben A.',
    resultMeta: 'Arbeitsblatt · Lernen & Ausmalen',
    hint: 'Arbeitsblätter lassen sich zuerst üben und danach ausmalen.',
    ideas: [
      'Ich möchte den Buchstaben A lernen mit einem Apfel.',
      'Mach ein Zählblatt mit fünf Sternen und Zahlen.',
      'Erstelle ein Arbeitsblatt zum Nachspuren von Formen.'
    ]
  },
  gifts: {
    id: 'gifts',
    icon: '🎂',
    name: 'Geschenkewerkstatt',
    short: 'Karte',
    description: 'MALINO entwirft Geburtstagskarten, Einladungen und kleine Ausmal-Geschenke mit persönlichem Bezug.',
    placeholder: 'Zum Beispiel: Mach eine Geburtstagskarte für Oma mit Blumen und Herzchen.',
    resultMeta: 'Karte oder Geschenkseite · A4 druckbar',
    hint: 'Karten kannst du ausdrucken, falten und verschenken.',
    ideas: [
      'Mach eine Geburtstagskarte für Oma mit Blumen und Ballons.',
      'Erstelle eine Einladungskarte für meinen Kindergeburtstag.',
      'Ich möchte eine Dankeskarte mit Regenbogen und Katze.'
    ]
  }
};

let currentMode = 'fantasy';
let currentColor = palette[3].hex;
let currentTool = 'fill';
let brushSize = 18;
let drawing = false;
let mask = null;
let history = [];
let historyIndex = 0;
let stage = 'idle';
let talkBack = false;
let recorder = null;
let recStream = null;
let stopTimeout = null;
let cloudUser = null;

let currentArtworkId = null;
const defaultSettings = {child_name:'Kleiner Künstler', age_group:'4-6', daily_limit:5, voice_enabled:true, print_enabled:true};
let settings = loadLocalSettings();
let pinFailures = 0;
let pinLockedUntil = 0;
function loadLocalSettings(){
  try {return {...defaultSettings,...JSON.parse(localStorage.getItem('malino-parent-settings') || '{}')};}
  catch {return {...defaultSettings};}
}
function persistLocalSettings(){localStorage.setItem('malino-parent-settings',JSON.stringify(settings));}


function error(message) {
  $('errorText').textContent = message;
  $('errorBanner').hidden = false;
  $('successBanner').hidden = true;
}
function success(message) {
  $('successText').textContent = message;
  $('successBanner').hidden = false;
  $('errorBanner').hidden = true;
}
function clearMessages() {
  $('errorBanner').hidden = true;
  $('successBanner').hidden = true;
}
function speak(text) {
  if (!talkBack || !('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'de-DE';
  utterance.rate = 0.96;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}
function setStage(next) {
  stage = next;
  const busy = next === 'generating' || next === 'transcribing';
  const recording = next === 'recording';
  $('generateBtn').disabled = next !== 'idle';
  $('micBtn').disabled = busy || !settings.voice_enabled;
  $('wishInput').disabled = next !== 'idle';
  document.querySelectorAll('.mode-card, .idea-chip').forEach(button => button.disabled = next !== 'idle');
  $('loadingOverlay').hidden = next !== 'generating';
  $('generateIcon').textContent = busy ? '◌' : '✦';
  $('generateText').textContent = next === 'generating' ? 'MALINO erstellt …' : next === 'transcribing' ? 'MALINO hört zu …' : 'Mit KI erstellen';
  $('micTitle').textContent = recording ? 'Aufnahme stoppen' : 'Sprich deinen Wunsch';
  $('micCopy').textContent = recording ? 'Aufnahme läuft · max. 14 Sek.' : 'Tippe auf das Mikrofon';
  $('micBtn').classList.toggle('recording', recording);
}

function initializeCanvas() {
  ctx.fillStyle = '#ffffff';
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  history = [ctx.getImageData(0, 0, WIDTH, HEIGHT)];
  historyIndex = 0;
  updateHistoryButtons();
}
function updateHistoryButtons() {
  $('undoBtn').disabled = historyIndex <= 0;
  $('redoBtn').disabled = historyIndex >= history.length - 1;
}
function snapshot() {
  history = history.slice(0, historyIndex + 1);
  history.push(ctx.getImageData(0, 0, WIDTH, HEIGHT));
  if (history.length > 20) history.shift();
  historyIndex = history.length - 1;
  updateHistoryButtons();
}
function historyMove(step) {
  const next = historyIndex + step;
  if (next < 0 || next >= history.length) return;
  historyIndex = next;
  ctx.putImageData(history[next], 0, 0);
  updateHistoryButtons();
}
function resetPaint() {
  initializeCanvas();
}

function loadLineMask(image) {
  const hidden = document.createElement('canvas');
  hidden.width = WIDTH;
  hidden.height = HEIGHT;
  const hctx = hidden.getContext('2d', {willReadFrequently: true});
  hctx.fillStyle = '#ffffff';
  hctx.fillRect(0, 0, WIDTH, HEIGHT);
  hctx.drawImage(image, 0, 0, WIDTH, HEIGHT);
  const pixels = hctx.getImageData(0, 0, WIDTH, HEIGHT).data;
  const base = new Uint8Array(WIDTH * HEIGHT);
  for (let i = 0; i < base.length; i++) {
    const j = i * 4;
    const brightness = pixels[j] * 0.299 + pixels[j + 1] * 0.587 + pixels[j + 2] * 0.114;
    if (brightness < 195 && pixels[j + 3] > 100) base[i] = 1;
  }
  const dilated = base.slice();
  for (let y = 1; y < HEIGHT - 1; y++) {
    for (let x = 1; x < WIDTH - 1; x++) {
      const p = y * WIDTH + x;
      if (base[p]) {
        dilated[p - 1] = 1;
        dilated[p + 1] = 1;
        dilated[p - WIDTH] = 1;
        dilated[p + WIDTH] = 1;
      }
    }
  }
  mask = dilated;
}
function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
function fillAt(x, y) {
  const sx = Math.floor(x), sy = Math.floor(y);
  if (sx < 0 || sx >= WIDTH || sy < 0 || sy >= HEIGHT) return false;
  const start = sy * WIDTH + sx;
  if (mask?.[start]) return false;
  const image = ctx.getImageData(0, 0, WIDTH, HEIGHT);
  const data = image.data;
  const rgb = hexToRgb(currentColor);
  const offset = start * 4;
  const target = [data[offset], data[offset + 1], data[offset + 2]];
  if (target.every((v, i) => Math.abs(v - rgb[i]) < 8)) return false;
  const matches = p => {
    if (mask?.[p]) return false;
    const at = p * 4;
    return Math.abs(data[at] - target[0]) < 14 && Math.abs(data[at + 1] - target[1]) < 14 && Math.abs(data[at + 2] - target[2]) < 14;
  };
  const visited = new Uint8Array(WIDTH * HEIGHT);
  const queue = new Int32Array(WIDTH * HEIGHT);
  let head = 0, tail = 1;
  queue[0] = start;
  visited[start] = 1;
  while (head < tail) {
    const p = queue[head++];
    const j = p * 4;
    data[j] = rgb[0];
    data[j + 1] = rgb[1];
    data[j + 2] = rgb[2];
    data[j + 3] = 255;
    const xx = p % WIDTH;
    if (xx > 0) { const n = p - 1; if (!visited[n]) { visited[n] = 1; if (matches(n)) queue[tail++] = n; }}
    if (xx < WIDTH - 1) { const n = p + 1; if (!visited[n]) { visited[n] = 1; if (matches(n)) queue[tail++] = n; }}
    if (p >= WIDTH) { const n = p - WIDTH; if (!visited[n]) { visited[n] = 1; if (matches(n)) queue[tail++] = n; }}
    if (p < WIDTH * (HEIGHT - 1)) { const n = p + WIDTH; if (!visited[n]) { visited[n] = 1; if (matches(n)) queue[tail++] = n; }}
  }
  ctx.putImageData(image, 0, 0);
  return true;
}
function atPointer(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * WIDTH / rect.width,
    y: (event.clientY - rect.top) * HEIGHT / rect.height
  };
}
function setImage(url, title, meta, artId=null) {
  const image = new Image();
  image.crossOrigin='anonymous';
  image.onload = () => {
    try {
      loadLineMask(image);
      outline.src = url;
      currentArtworkId = artId;
      $('artTitle').textContent = title;
      $('resultMeta').textContent = meta;
      resetPaint();
    } catch {
      error('Das Bild konnte nicht vorbereitet werden.');
    }
  };
  image.onerror = () => error('Das Bild konnte nicht geladen werden.');
  image.src = url;
}

async function requestImage(wish) {
  if (stage !== 'idle') return;
  const trimmed = wish.trim();
  if (trimmed.length < 4) return error('Bitte gib einen längeren Wunsch ein.');
  if (!cloudConfigured()) return error('Für neue KI-Bilder muss Supabase eingerichtet werden. Die Demo-Maltafel funktioniert schon.');
  if (!cloudUser) {activationModal.hidden=false;return error('Bitte zuerst den MALINO-Zugangscode eingeben.');}
  clearMessages(); setStage('generating');
  try {
    const result = await generateCloud(trimmed, currentMode);
    if (typeof result.image !== 'string' || !result.image.startsWith('data:image/')) throw new Error('Ungültiges KI-Ergebnis.');
    setImage(result.image, result.title || makeTitle(trimmed), modes[currentMode].resultMeta);
    success('Dein neues MALINO-Bild ist fertig!');
    speak('Dein neues Bild ist fertig. Viel Spaß beim Malen!');
    refreshUsage().catch(()=>{});
  } catch(e) { error(e.message || 'Die Bild-KI ist gerade nicht erreichbar.'); }
  finally {setStage('idle');}
}

function makeTitle(text) {
  const clean = text.replace(/[.!?]+$/g, '').trim();
  return clean.length > 54 ? clean.slice(0, 54) + '…' : clean;
}

async function micToggle() {
  if (stage === 'recording') {
    if (stopTimeout) clearTimeout(stopTimeout);
    if (recorder?.state === 'recording') recorder.stop();
    return;
  }
  if (stage !== 'idle') return;
  clearMessages();
  if (!settings.voice_enabled) return error('Sprachwünsche sind im Elternbereich deaktiviert.');
  if (!cloudConfigured() || !cloudUser) {activationModal.hidden=false;return error('Bitte MALINO zuerst mit dem Zugangscode aktivieren.');}
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    error('Das Mikrofon braucht einen aktuellen Browser mit HTTPS oder localhost.');
    return;
  }
  try {
    recStream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true}});
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].find(type => MediaRecorder.isTypeSupported(type));
    recorder = new MediaRecorder(recStream, mime ? {mimeType: mime} : undefined);
    const chunks = [];
    recorder.addEventListener('dataavailable', event => { if (event.data.size) chunks.push(event.data); });
    recorder.addEventListener('stop', async () => {
      if (stopTimeout) clearTimeout(stopTimeout);
      recStream?.getTracks().forEach(track => track.stop());
      recStream = null;
      const blob = new Blob(chunks, {type: recorder.mimeType || 'audio/webm'});
      if (blob.size < 200) {
        setStage('idle');
        error('Die Aufnahme war zu kurz. Bitte versuche es erneut.');
        return;
      }
      setStage('transcribing');
      try {
        const text = String(await transcribeCloud(blob) || '').trim();
        $('wishInput').value = text;
        setStage('idle');
        await requestImage(text);
      } catch (e) {
        setStage('idle');
        error(e.message || 'Die Spracherkennung ist fehlgeschlagen.');
      }
    });
    recorder.start();
    setStage('recording');
    stopTimeout = setTimeout(() => {
      if (recorder?.state === 'recording') recorder.stop();
    }, 14000);
  } catch {
    setStage('idle');
    error('Das Mikrofon konnte nicht geöffnet werden.');
  }
}

function renderPalette() {
  $('palette').innerHTML = '';
  palette.forEach(entry => {
    const button = document.createElement('button');
    button.className = 'color-dot' + (entry.hex === currentColor ? ' chosen' : '');
    button.style.background = entry.hex;
    button.title = entry.name;
    button.setAttribute('aria-label', entry.name);
    button.textContent = entry.hex === currentColor ? '✓' : '';
    button.addEventListener('click', () => {
      currentColor = entry.hex;
      renderPalette();
      updateBrushPreview();
    });
    $('palette').appendChild(button);
  });
}
function updateBrushPreview() {
  const size = currentTool === 'eraser' ? brushSize * 2.1 : brushSize;
  const preview = $('brushPreview');
  preview.style.width = `${Math.max(8, size)}px`;
  preview.style.height = `${Math.max(8, size)}px`;
  preview.style.background = currentTool === 'eraser' ? '#ffffff' : currentColor;
  preview.style.border = currentTool === 'eraser' ? '1px solid #cfd4cd' : 'none';
}

function setMode(modeId) {
  currentMode = modeId;
  const mode = modes[modeId];
  $('modeTitle').textContent = mode.name;
  $('modeDescription').textContent = mode.description;
  $('wishInput').value = mode.ideas[0];
  $('wishInput').placeholder = mode.placeholder;
  $('toolbarHint').textContent = mode.hint;
  // Der Titel des bereits sichtbaren Kunstwerks bleibt bei Moduswechsel erhalten.
  document.querySelectorAll('.mode-card').forEach(card => card.classList.toggle('selected', card.dataset.mode === modeId));
  renderIdeaStrip(mode.ideas);
}
function renderModes() {
  $('modeGrid').innerHTML = '';
  Object.values(modes).forEach(mode => {
    const button = document.createElement('button');
    button.className = 'mode-card' + (mode.id === currentMode ? ' selected' : '');
    button.dataset.mode = mode.id;
    button.innerHTML = `<span class="mode-icon">${mode.icon}</span><span class="mode-copy"><strong>${mode.name}</strong><small>${mode.short}</small></span>`;
    button.addEventListener('click', () => setMode(mode.id));
    $('modeGrid').appendChild(button);
  });
}
function renderIdeaStrip(ideas) {
  $('ideaStrip').innerHTML = '';
  ideas.forEach(text => {
    const button = document.createElement('button');
    button.className = 'idea-chip';
    button.textContent = text;
    button.addEventListener('click', () => { $('wishInput').value = text; $('wishInput').focus(); });
    $('ideaStrip').appendChild(button);
  });
}

function composedCanvas() {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = WIDTH;
  exportCanvas.height = HEIGHT;
  const ectx = exportCanvas.getContext('2d');
  ectx.fillStyle = '#ffffff';
  ectx.fillRect(0,0,WIDTH,HEIGHT);
  ectx.drawImage(canvas,0,0);
  ectx.drawImage(outline,0,0,WIDTH,HEIGHT);
  return exportCanvas;
}
function artworkName() {
  return ($('artTitle').textContent || 'malino-bild').toLowerCase()
    .replace(/[^a-z0-9äöüß]+/gi,'-').replace(/^-|-$/g,'').slice(0,75);
}
function downloadPng() {
  try {
    const link=document.createElement('a');
    link.href=composedCanvas().toDataURL('image/png');
    link.download=`${artworkName() || 'malino-bild'}.png`;
    link.click();
  }catch{error('Das Bild konnte nicht gespeichert werden.');}
}
async function canvasBlob(){
  return await new Promise((resolve,reject)=>composedCanvas().toBlob(blob=>blob?resolve(blob):reject(new Error('PNG konnte nicht erstellt werden.')),'image/png'));
}
async function saveToGallery() {
  try {
    const imageDataUrl = composedCanvas().toDataURL('image/png');
    const art={id:crypto.randomUUID(),title:($('artTitle').textContent || 'MALINO-Bild').slice(0,160),mode:currentMode,created_at:new Date().toISOString(),imageDataUrl};
    await localArt.put(art);
    currentArtworkId = art.id;
    if(cloudUser){
      try {
        const pngBlob = await canvasBlob();
        await uploadArtwork({id:art.id,title:art.title,mode:art.mode,pngBlob,userId:cloudUser.id});
        success('Das Bild wurde lokal und in deiner privaten Cloud-Galerie gespeichert!');
      } catch(e) {error(`Lokal gespeichert. Cloud-Synchronisierung fehlgeschlagen: ${e.message}`);}
    } else success('Dein Kunstwerk ist auf diesem Gerät in der Galerie gespeichert!');
  } catch(e) {error(e.message || 'Speichern fehlgeschlagen.');}
}
function printArtwork() {
  if(!settings.print_enabled) return error('Drucken ist im Elternbereich deaktiviert.');
  const entry={id:crypto.randomUUID(),title:($('artTitle').textContent || 'MALINO-Bild').slice(0,160),mode:currentMode,artwork_id:currentArtworkId,requested_at:new Date().toISOString()};
  // Wichtig: Druckdialog direkt im Klick-Handler öffnen; mobile Browser blockieren
  // sonst das Drucken nach einer asynchronen Datenbankanfrage.
  window.print();
  localPrints.put(entry).catch(err=>console.warn('Lokales Druckprotokoll:',err));
  if(cloudUser)logCloudPrint({id:entry.id,userId:cloudUser.id,title:entry.title,mode:entry.mode,artworkId:entry.artwork_id})
    .catch(err=>console.warn('Cloud-Druckprotokoll:',err));
}
async function refreshUsage(){
  if(!cloudUser){
    $('usageLabel').textContent = cloudConfigured()?'Zugangscode für KI erforderlich':'Demomodus · Ausmalen ohne Code';
    $('parentUsage').textContent = `– / ${settings.daily_limit}`;
    return;
  }
  const count=await getDailyUse(cloudUser.id);
  $('usageLabel').textContent = `${settings.child_name}: ${Math.max(0,settings.daily_limit-count)} KI-Bilder heute übrig`;
  $('parentUsage').textContent = `${count} / ${settings.daily_limit}`;
}
async function healthCheck(){
  $('statusDot').className='status-dot '+(cloudConfigured()?'active':'inactive');
  $('statusText').textContent=cloudConfigured()?'Zugangscode erforderlich':'Demo · Cloud nicht eingerichtet';
  if(!cloudConfigured()){await refreshUsage();return;}
  try{
    const user=await signedIn();
    cloudUser=user && await accessGranted(user.id) ? user : null;
    if(cloudUser){
      $('statusText').textContent='MALINO freigeschaltet';
      const row=await fetchSettings(cloudUser.id);
      settings={...settings,...row};
      persistLocalSettings();applyControls();
      activationModal.hidden=true;
    }else{
      activationModal.hidden=false;
    }
    await refreshUsage();
  }catch(e){
    cloudUser=null;
    $('statusText').textContent='Freischaltung konnte nicht geprüft werden';
    activationModal.hidden=false;
    console.warn('MALINO Freischaltung:',e);
  }
}

async function initializeCloudLogin(){
  if(!cloudConfigured()){await healthCheck();return;}
  try{
    const sb=await cloud();
    sb.auth.onAuthStateChange((event)=>{
      if(event!=='SIGNED_IN'&&event!=='SIGNED_OUT'&&event!=='TOKEN_REFRESHED')return;
      setTimeout(()=>healthCheck().catch(console.warn),0);
    });
    await healthCheck();
  }catch(e){
    error('MALINO Cloud nicht erreichbar. Bitte Verbindung prüfen.');
  }
}

canvas.addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  if (!outline.complete || !mask) return;
  canvas.setPointerCapture(event.pointerId);
  const {x, y} = atPointer(event);
  if (currentTool === 'fill') {
    if (fillAt(x, y)) snapshot();
    return;
  }
  const radius = (currentTool === 'eraser' ? brushSize * 2.1 : brushSize) / 2;
  ctx.strokeStyle = currentTool === 'eraser' ? '#ffffff' : currentColor;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = radius * 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y);
  drawing = true;
});
canvas.addEventListener('pointermove', event => {
  if (!drawing) return;
  const {x, y} = atPointer(event);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
});
function stopDrawing(event) {
  if (!drawing) return;
  drawing = false;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  snapshot();
}
canvas.addEventListener('pointerup', stopDrawing);
canvas.addEventListener('pointercancel', stopDrawing);

$('generateBtn').addEventListener('click', () => requestImage($('wishInput').value));
$('micBtn').addEventListener('click', micToggle);
$('saveBtn').addEventListener('click', saveToGallery);
$('downloadBtn').addEventListener('click',downloadPng);
$('printBtn').addEventListener('click', printArtwork);
$('undoBtn').addEventListener('click', () => historyMove(-1));
$('redoBtn').addEventListener('click', () => historyMove(1));
$('clearBtn').addEventListener('click', () => {
  if (confirm('Alle gemalten Farben entfernen?')) resetPaint();
});
$('voiceToggle').addEventListener('click', () => {
  talkBack = !talkBack;
  $('voiceToggle').textContent = 'Sprachantwort ' + (talkBack ? 'an' : 'aus');
  $('voiceToggle').classList.toggle('enabled', talkBack);
  if (talkBack) speak('Hallo! Ich bin MALINO.');
});
$('brushSize').addEventListener('input', event => {
  brushSize = Number(event.target.value);
  updateBrushPreview();
});
document.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click', () => {
  currentTool = button.dataset.tool;
  document.querySelectorAll('[data-tool]').forEach(btn => btn.classList.toggle('selected', btn === button));
  $('brushSize').disabled = currentTool === 'fill';
  updateBrushPreview();
}));
$('errorClose').addEventListener('click', clearMessages);
$('successClose').addEventListener('click', clearMessages);
const modal = $('helpModal');
$('openHelp').addEventListener('click', () => modal.hidden = false);
$('closeHelp').addEventListener('click', () => modal.hidden = true);
$('helpStart').addEventListener('click', () => modal.hidden = true);
modal.addEventListener('click', event => { if (event.target === modal) modal.hidden = true; });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') modal.hidden = true;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    historyMove(event.shiftKey ? 1 : -1);
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// ─── Galerie und Elternbereich ────────────────────────────────────────────────
const galleryModal = $('galleryModal');
const parentModal = $('parentModal');

function dateDisplay(value) {
  const time = new Date(value);
  if (!Number.isFinite(time.valueOf())) return 'Unbekannt';
  return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(time);
}
function createButton(label, onClick, isDanger=false) {
  const btn=document.createElement('button');btn.type='button';btn.textContent=label;
  if(isDanger)btn.className='danger';
  btn.addEventListener('click',onClick);
  return btn;
}

async function showGallery(){
  galleryModal.hidden=false;
  await renderGallery();
}
async function renderGallery(){
  const grid=$('galleryGrid');grid.replaceChildren();
  $('galleryStatus').textContent='Deine Kunstwerke werden geladen …';
  try {
    const local=await localArt.list();
    let remote=[];
    if(cloudUser){
      try {remote=await fetchCloudGallery(cloudUser.id);}
      catch(e){console.warn(e);$('galleryStatus').textContent='Die Cloud-Galerie ist momentan nicht erreichbar. Lokale Bilder bleiben verfügbar.';}
    }
    const merged=new Map();
    for(const art of remote)merged.set(art.id,art);
    for(const art of local)merged.set(art.id,{...merged.get(art.id),...art,cloud:!!merged.get(art.id)?.cloud});
    const items=[...merged.values()].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    if(!items.length){$('galleryStatus').textContent='Noch keine Bilder gespeichert. Male etwas aus und tippe auf „In Galerie“. ✦';return;}
    if(!$('galleryStatus').textContent.includes('nicht erreichbar')) $('galleryStatus').textContent=`${items.length} Kunstwerk${items.length===1?'':'e'} · ${cloudUser?'lokal und Cloud':'nur auf diesem Gerät'}`;
    for(const art of items){
      const card=document.createElement('article');card.className='gallery-item';
      const img=document.createElement('img');img.src=art.imageDataUrl || './demo-a4.svg';img.alt=art.title;img.loading='lazy';
      const title=document.createElement('strong');title.textContent=art.title;
      const info=document.createElement('small');info.textContent=dateDisplay(art.created_at);
      const actions=document.createElement('div');actions.className='gallery-actions';
      actions.append(createButton('Öffnen',async()=>{
        try {
          if(!art.imageDataUrl)throw new Error('Kein Bild verfügbar.');
          let src=art.imageDataUrl;
          if(art.cloud && !src.startsWith('data:')){
            const response=await fetch(src);
            if(!response.ok)throw new Error('Das Bild konnte nicht geladen werden.');
            src=URL.createObjectURL(await response.blob());
          }
          currentMode=art.mode in modes?art.mode:'fantasy';
          setMode(currentMode);
          setImage(src,art.title,modes[currentMode].resultMeta,art.id);
          galleryModal.hidden=true;
        } catch(e) {error(e.message);galleryModal.hidden=true;}
      }));
      actions.append(createButton('Löschen',async()=>{
        if(!confirm('Dieses Kunstwerk wirklich aus der Galerie löschen?'))return;
        try{
          if(art.cloud)await deleteCloudArtwork(art);
          await localArt.remove(art.id);
          renderGallery();
        }catch(e){error('Löschen nicht möglich: '+e.message);galleryModal.hidden=true;}
      },true));
      card.append(img,title,info,actions);grid.appendChild(card);
    }
  }catch(e){$('galleryStatus').textContent='Galerie konnte nicht geladen werden: '+e.message;}
}

function bytesToHex(bytes){return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function pinHash(pin,saltHex){
  const text=new TextEncoder();
  const salt=new Uint8Array(saltHex.match(/.{2}/g).map(h=>parseInt(h,16)));
  const key=await crypto.subtle.importKey('raw',text.encode(pin),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:120000},key,256);
  return bytesToHex(new Uint8Array(bits));
}
function pinRecord(){try{return JSON.parse(localStorage.getItem('malino-parent-pin') || 'null');}catch{return null;}}
async function verifyOrCreatePin(){
  const pin=$('pinInput').value.trim();
  if(!/^\d{4,6}$/.test(pin))return alert('Bitte eine PIN mit 4 bis 6 Ziffern eingeben.');
  if(Date.now()<pinLockedUntil)return alert('Zu viele Versuche. Bitte nach einer Minute wiederkommen.');
  const record=pinRecord();
  try {
    if(record){
      const hash=await pinHash(pin,record.salt);
      if(hash!==record.hash){
        pinFailures++;
        if(pinFailures>=5){pinLockedUntil=Date.now()+60000;pinFailures=0;}
        $('pinInput').value='';
        return alert('Die Eltern-PIN ist nicht richtig.');
      }
    }else{
      const salt=bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
      const hash=await pinHash(pin,salt);
      localStorage.setItem('malino-parent-pin',JSON.stringify({salt,hash}));
    }
    pinFailures=0;
    $('pinInput').value='';
    $('pinGate').hidden=true;
    $('parentContent').hidden=false;
    await populateParents();
  }catch(e){error('Eltern-PIN konnte nicht geprüft werden: '+e.message);parentModal.hidden=true;}
}
async function showParents(){
  parentModal.hidden=false;
  $('pinGate').hidden=false;$('parentContent').hidden=true;
  $('pinLabel').textContent=pinRecord()?'Eltern-PIN eingeben':'Neue Eltern-PIN festlegen (4–6 Ziffern)';
  $('pinNote').textContent=pinRecord()?'PIN für dieses Gerät eingeben.':'Beim ersten Besuch legst du eine PIN für dieses Gerät fest.';
  $('pinConfirm').textContent=pinRecord()?'Elternbereich öffnen':'PIN festlegen';
  $('pinInput').value='';
}
function renderSettings(){
  $('childNameInput').value=settings.child_name;
  $('ageGroupSelect').value=settings.age_group;
  $('dailyLimitInput').value=settings.daily_limit;
  $('voiceAllowed').checked=!!settings.voice_enabled;
  $('printAllowed').checked=!!settings.print_enabled;
}
async function populateParents(){
  renderSettings();
  $('cloudAuthStatus').textContent=cloudUser
    ? 'Dieses Gerät ist freigeschaltet. Keine E-Mail-Anmeldung erforderlich.'
    : 'Noch nicht freigeschaltet. Bitte MALINO mit dem Zugangscode aktivieren.';
  try{await refreshUsage();}catch(e){console.warn('Nutzung:',e);}
  await renderPrintHistory();
}
async function renderPrintHistory(){
  const target=$('printHistory');target.replaceChildren();
  try{
    const local=await localPrints.list();
    let remote=[];
    if(cloudUser){try{remote=await fetchCloudPrints(cloudUser.id);}catch(e){console.warn(e);}}
    const map=new Map([...remote,...local].map(p=>[p.id,p]));
    const events=[...map.values()].sort((a,b)=>new Date(b.requested_at)-new Date(a.requested_at)).slice(0,50);
    if(!events.length){target.textContent='Noch keine Druckanfragen erfasst.';return;}
    for(const print of events){
      const row=document.createElement('div');row.className='print-row';
      const span=document.createElement('span');span.textContent='🖨 '+print.title;
      const time=document.createElement('time');time.textContent=dateDisplay(print.requested_at);
      row.append(span,time);target.appendChild(row);
    }
  }catch(e){target.textContent='Die Druckhistorie konnte nicht geladen werden.';}
}

$('galleryBtn').addEventListener('click',showGallery);
$('closeGallery').addEventListener('click',()=>galleryModal.hidden=true);
galleryModal.addEventListener('click',e=>{if(e.target===galleryModal)galleryModal.hidden=true;});
$('parentBtn').addEventListener('click',showParents);
$('closeParent').addEventListener('click',()=>parentModal.hidden=true);
parentModal.addEventListener('click',e=>{if(e.target===parentModal)parentModal.hidden=true;});
$('pinConfirm').addEventListener('click',verifyOrCreatePin);
$('pinInput').addEventListener('keydown',e=>{if(e.key==='Enter')verifyOrCreatePin();});
$('activateCodeBtn').addEventListener('click',async()=>{
  const code=$('activationCode').value.trim();
  if(code.length<12){$('activationStatus').textContent='Bitte den vollständigen MALINO-Zugangscode eingeben.';return;}
  $('activateCodeBtn').disabled=true;
  $('activationStatus').textContent='Der Zugangscode wird geprüft …';
  try{
    await activateCloud(code);
    $('activationCode').value='';
    await healthCheck();
    if(!cloudUser)throw new Error('Gerätefreigabe konnte nicht geladen werden.');
    activationModal.hidden=true;
    success('MALINO ist freigeschaltet. Viel Spaß beim Malen!');
  }catch(e){
    $('activationStatus').textContent=e.message||'Code konnte nicht geprüft werden.';
  }finally{$('activateCodeBtn').disabled=false;}
});
$('activationCode').addEventListener('keydown',event=>{
  if(event.key==='Enter')$('activateCodeBtn').click();
});
$('parentSettingsForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const patch={
    child_name:$('childNameInput').value.trim().slice(0,40)||'Kleiner Künstler',
    age_group:$('ageGroupSelect').value,
    daily_limit:Number($('dailyLimitInput').value),
    voice_enabled:$('voiceAllowed').checked,
    print_enabled:$('printAllowed').checked
  };
  if(!Number.isInteger(patch.daily_limit)||patch.daily_limit<1||patch.daily_limit>30) return alert('Das KI-Tageslimit muss zwischen 1 und 30 liegen.');
  try{
    if(cloudUser)await updateSettings(cloudUser.id,patch);
    settings={...settings,...patch};persistLocalSettings();applyControls();
    await refreshUsage();
    success('Elterneinstellungen gespeichert!');parentModal.hidden=true;
  }catch(err){error('Einstellungen konnten nicht gespeichert werden: '+err.message);parentModal.hidden=true;}
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){galleryModal.hidden=true;parentModal.hidden=true;}});

function applyControls(){
  $('micBtn').disabled=!settings.voice_enabled;
  $('printBtn').disabled=!settings.print_enabled;
  $('voiceToggle').disabled=!settings.voice_enabled;
  if(!settings.voice_enabled){talkBack=false;$('voiceToggle').textContent='Sprachantwort aus';}
}

function boot() {
  renderModes();
  renderPalette();
  updateBrushPreview();
  initializeCanvas();
  setMode('fantasy');
  setImage('./demo-a4.svg', 'Affe im Baum', modes.fantasy.resultMeta);
  applyControls();
  initializeCloudLogin().catch(e=>console.warn(e));
}

boot();
