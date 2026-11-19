import { MALINO_CLOUD } from './config.js';

let client;
let cloudError;

export function cloudConfigured() {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(MALINO_CLOUD.supabaseUrl.trim())
    && MALINO_CLOUD.supabasePublishableKey.trim().length >= 20;
}

export async function cloud() {
  if (!cloudConfigured()) return null;
  if (client) return client;
  if (cloudError) throw cloudError;
  try {
    // Feste Version, damit Updates kontrolliert erfolgen können.
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.57.0');
    client = createClient(MALINO_CLOUD.supabaseUrl.trim(), MALINO_CLOUD.supabasePublishableKey.trim(), {
      auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true}
    });
    return client;
  } catch (error) { cloudError = error; throw error; }
}

export async function signedIn() {
  const sb = await cloud();
  if (!sb) return null;
  const {data: {user}, error} = await sb.auth.getUser();
  if (error) return null;
  return user;
}

export async function sendLogin(email) {
  const sb = await cloud();
  if (!sb) throw new Error('Supabase ist noch nicht eingerichtet.');
  const {error} = await sb.auth.signInWithOtp({
    email,
    options: {emailRedirectTo: location.origin + location.pathname}
  });
  if (error) throw error;
}
export async function signOut() {
  const sb = await cloud();
  if (sb) { const {error} = await sb.auth.signOut(); if (error) throw error; }
}

export async function generateCloud(subject, mode) {
  const sb = await cloud();
  const {data, error} = await sb.functions.invoke('malino-ai', {body: {action: 'generate', subject, mode}});
  if (error) {
    const remote = await error.context?.json?.().catch(() => null);
    throw new Error(remote?.error || (error.context?.status === 401 ? 'Bitte erneut im Elternbereich anmelden.' : error.message) || 'KI-Fehler.');
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function transcribeCloud(blob) {
  const sb = await cloud();
  const body = new FormData();
  const extension = blob.type.startsWith('audio/mp4') ? 'm4a' : blob.type.startsWith('audio/ogg') ? 'ogg' : blob.type.startsWith('audio/wav') ? 'wav' : 'webm';
  body.append('audio',blob,`wunsch.${extension}`);
  const {data, error} = await sb.functions.invoke('malino-ai', {body});
  if (error) {
    const remote = await error.context?.json?.().catch(() => null);
    throw new Error(remote?.error || error.message || 'Spracherkennung fehlgeschlagen.');
  }
  if (data?.error) throw new Error(data.error);
  return data.text;
}

export async function fetchSettings(userId) {
  const sb = await cloud();
  const {data, error} = await sb.from('malino_settings').select('*').eq('owner_id', userId).maybeSingle();
  if (error) throw error;
  if (data) return data;
  const {data: inserted, error: createError} = await sb.from('malino_settings')
    .upsert({owner_id: userId}, {onConflict: 'owner_id'}).select().single();
  if (createError) throw createError;
  return inserted;
}

export async function updateSettings(userId, patch) {
  const sb = await cloud();
  const {data, error} = await sb.from('malino_settings').update(patch).eq('owner_id', userId).select().single();
  if (error) throw error;
  return data;
}

export async function getDailyUse(userId) {
  const sb = await cloud();
  const today = new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const {data, error} = await sb.from('malino_usage').select('used').eq('owner_id', userId).eq('day', today).maybeSingle();
  if (error) throw error;
  return data?.used || 0;
}

export async function uploadArtwork({id, title, mode, pngBlob, userId}) {
  const sb = await cloud();
  const path = `${userId}/${id}.png`;
  const {error: uploadError} = await sb.storage.from('malino-artworks').upload(path, pngBlob, {contentType:'image/png', upsert:false});
  if (uploadError) throw uploadError;
  const {error: dbError} = await sb.from('malino_artworks').insert({id, owner_id:userId, title, mode, storage_path:path});
  if (dbError) {
    await sb.storage.from('malino-artworks').remove([path]);
    throw dbError;
  }
  return path;
}

export async function fetchCloudGallery(userId) {
  const sb = await cloud();
  const {data, error} = await sb.from('malino_artworks').select('id,title,mode,created_at,storage_path').eq('owner_id', userId).order('created_at', {ascending:false}).limit(100);
  if (error) throw error;
  return await Promise.all((data || []).map(async art => {
    const {data: signed, error: signError} = await sb.storage.from('malino-artworks').createSignedUrl(art.storage_path, 3600);
    return {...art, imageDataUrl: signError ? '' : signed.signedUrl, cloud:true};
  }));
}
export async function deleteCloudArtwork(artwork) {
  const sb = await cloud();
  const {error} = await sb.from('malino_artworks').delete().eq('id', artwork.id);
  if (error) throw error;
  if (artwork.storage_path) await sb.storage.from('malino-artworks').remove([artwork.storage_path]);
}
export async function logCloudPrint({id, userId, title, mode, artworkId}) {
  const sb = await cloud();
  const {error} = await sb.from('malino_print_events').insert({id, owner_id:userId, title, mode, artwork_id:artworkId || null});
  if (error) throw error;
}
export async function fetchCloudPrints(userId) {
  const sb = await cloud();
  const {data, error} = await sb.from('malino_print_events').select('id,title,mode,requested_at').eq('owner_id',userId).order('requested_at', {ascending:false}).limit(100);
  if (error) throw error;
  return data || [];
}
