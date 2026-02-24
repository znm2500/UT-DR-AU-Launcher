import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'



// Custom APIs for renderer
const api: any = {};


console.log('--- Preload 脚本正在加载 ---');
// Expose a safe API to get game data (uses cache via electron-store)

api.openFile = (custom_name, extensions) => ipcRenderer.invoke('open-file', custom_name, extensions);
api.launchGame = (path: string) => ipcRenderer.invoke('launch-game', path);
api.getlocalpath = (key: string) => ipcRenderer.invoke('get-local-path', key);
api.openFolder = () => ipcRenderer.invoke('open-folder');
api.deleteFolder = (path) => ipcRenderer.invoke('remove-directory', path);
api.parseAup = (path) => ipcRenderer.invoke('get-aup-config', path);
api.moveFolder = (archivePath, destDir) => ipcRenderer.invoke('move-folder', archivePath, destDir);
api.saveFile = (name, extensions) => ipcRenderer.invoke('save-file', name, extensions);
api.getStoreValue = (key, value) => ipcRenderer.invoke('get-store-value', key, value);
api.setStoreValue = (key, value) => ipcRenderer.invoke('set-store-value', key, value);
api.exportGame = (gamesToExport, saveDir) => ipcRenderer.invoke('export-game', gamesToExport, saveDir);
api.checkIsChinaIP = () => ipcRenderer.invoke('check-local-ip-region');
api.openExternal = (url: string) => ipcRenderer.invoke('open-external-url', url);
api.getBgmFiles = (bgmPath: string) => ipcRenderer.invoke('read-bgm-files', bgmPath);
api.onDownloadProgress = (callback: (data: { id: string, percent: number }) => void) => {
  // 移除之前的监听器防止重复
  ipcRenderer.removeAllListeners('download-progress');
  ipcRenderer.on('download-progress', (_event, value) => callback(value));
};
api.onZipProgress = (callback: (percent: number) => void) => {
  // 移除之前的监听器防止重复
  ipcRenderer.removeAllListeners('zip-progress');
  ipcRenderer.on('zip-progress', (_event, value) => callback(value));
};
api.downloadGame = (url: string, destDir: string, filename: string, gameId: string) =>
  ipcRenderer.invoke('download-and-extract', url, destDir, filename, gameId);
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