import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'



// Custom APIs for renderer
const api: any = {};


console.log('--- Preload 脚本正在加载 ---');
// Expose a safe API to get game data (uses cache via electron-store)

api.openFile = (custom_name,extensions) => ipcRenderer.invoke('open-file',custom_name,extensions);
api.downloadGame= (url: string, destDir: string, filename: string) => ipcRenderer.invoke('download-and-extract', url, destDir, filename);
api.launchGame = (path: string) => ipcRenderer.invoke('launch-game', path);
api.getdownloadpath = () => ipcRenderer.invoke('get-download-path');
api.openFolder = () => ipcRenderer.invoke('open-folder');
api.deleteFolder = (path) => ipcRenderer.invoke('remove-directory', path);
api.parseAup = (path) => ipcRenderer.invoke('get-aup-config',path);
api.moveFolder = (archivePath, destDir) => ipcRenderer.invoke('move-folder', archivePath, destDir);
api.saveFile = (name, extensions) => ipcRenderer.invoke('save-file', name, extensions);
api.getStoreValue = (key, value) => ipcRenderer.invoke('get-store-value', key, value);
api.setStoreValue = (key, value) => ipcRenderer.invoke('set-store-value', key, value);
api.exportGame = (gamesToExport, saveDir) => ipcRenderer.invoke('export-game', gamesToExport, saveDir);
// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  (globalThis as any).electron = electronAPI;
  (globalThis as any).api = api;
}