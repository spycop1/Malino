// IndexedDB: Kunstwerke und Druckanfragen bleiben auch im Demomodus erhalten.
const DB_NAME = 'malino-magicpad-v05';
let dbPromise;
function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('artworks', {keyPath:'id'});
      db.createObjectStore('prints', {keyPath:'id'});
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}
async function act(store, action, value) {
  const db = await openDb();
  return new Promise((resolve,reject) => {
    const tx = db.transaction(store, action === 'getAll' ? 'readonly':'readwrite');
    const request = action === 'getAll' ? tx.objectStore(store).getAll() : tx.objectStore(store)[action](value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export const localArt = {
  put: art => act('artworks','put',art),
  list: async () => (await act('artworks','getAll')).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)),
  remove: id => act('artworks','delete',id)
};
export const localPrints = {
  put: print => act('prints','put',print),
  list: async () => (await act('prints','getAll')).sort((a,b)=>new Date(b.requested_at)-new Date(a.requested_at))
};
