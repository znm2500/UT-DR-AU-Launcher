import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      openFile: () => Promise<string>,
      launchGame: (path: string) => Promise<void>,
      downloadGame: (url: string, destDir: string, filename: string) => Promise<void>,
      getdownloadpath: () => string,
      openFolder: () => Promise<string>
      getStoreValue: (key: string, value?: any) => Promise<any>,
      setStoreValue: (key: string, value: any) => Promise<void>
    }
  }
}