import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { exposeConf } from 'electron-conf/preload'

// Custom APIs for renderer
const api: any = {}

const store = exposeConf();
// Remote game index URL and cache TTL (ms)
const GAME_INDEX_URL = 'https://raw.githubusercontent.com/znm2500/UNDERTALE-AUs-Repo/main/game_index.json';
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes
console.log('--- Preload 脚本正在加载 ---');
// Expose a safe API to get game data (uses cache via electron-store)
api.getGameData=()=>{
  console.log(store.get('game_index_cache', {ts:0,data:[]}));
  return (store.get('game_index_cache', {ts:0,data:[]}) as any).data;
};
api.updateGameData = async () => {
  try {
    const cached = store.get('game_index_cache');
    if (cached && (cached as any).ts && (Date.now() - (cached as any).ts) < CACHE_TTL) {
      // return cached data
      return false;
    }

    // Try fetch remote
    try {
      // Use global fetch if available (Node >=18/Electron recent)
      const res = await fetch(GAME_INDEX_URL);
      if (!res.ok) throw new Error('Network response not ok: ' + res.status);
      const data = await res.json();
      // cache
      try { store.set('game_index_cache', { ts: Date.now(), data }); } catch (e) { console.warn('store.set failed', e); }
      return true;
    } catch (fetchErr) {
      console.warn('fetch game index failed', fetchErr);
      // fallback to cache if exists
      if (cached && (cached as any).data) return false;
      return false;
    }
  } catch (err) {
    console.error('getGameData error', err);
    return;
  }
};
api.getGameSettings = () => {
  return store.get('settings',{
            downloadPath: '',
            backgroundImage: '',
            lang: 'en'
        });
};
api.getUserGames = () => {
  return store.get('userGames', []);
};
api.setGameSettings = (settings: any) => {
  store.set('settings', settings);
};
api.setUserGames = (games: any) => {
  store.set('userGames', games);
};

api.openFile = () => ipcRenderer.invoke('open-file')

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  (globalThis as any).electron = electronAPI
  (globalThis as any).api = api
}
