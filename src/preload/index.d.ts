import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      openFile: (custom_name:string,extensions:any) => Promise<string>,
      launchGame: (path: string) => Promise<void>,
      downloadGame: (url: string, destDir: string, filename: string) => Promise<void>,
      getdownloadpath: () => string,
      openFolder: () => Promise<string>
      getStoreValue: (key: string, value?: any) => Promise<any>,
      setStoreValue: (key: string, value: any) => Promise<void>,
      deleteFolder: (path: string) => Promise<void>,
      parseAup : (path:string) => Promise<any>,
      moveFolder: (archivePath: string, destDir: string) => Promise<void>,
      saveFile: (name: string, extensions: string[]) => Promise<string>,
      exportGame: (gamesToExport: any[], saveDir: string) => Promise<any>,
    }
  }
}