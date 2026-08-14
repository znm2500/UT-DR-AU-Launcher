import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { audioDir, downloadDir, tempDir, appDataDir, join } from '@tauri-apps/api/path'
import { open, save } from '@tauri-apps/plugin-dialog'
import { Store } from '@tauri-apps/plugin-store'

const storePromise = Store.load('settings.kola')
const legacyStorePromise = (async () => {
    const appDataPath = await appDataDir()
    const legacyConfigPath = await join(appDataPath, '..', 'au-launcher', 'config.json')
    return Store.load(legacyConfigPath)
})()
let unlistenDownload: UnlistenFn | null = null
let unlistenZip: UnlistenFn | null = null

const api = {
    async openFile(custom_name: string, extensions: string[]): Promise<string | null> {
        const picked = await open({
            multiple: false,
            directory: false,
            filters: [{ name: custom_name, extensions }]
        })
        return typeof picked === 'string' ? picked : null
    },

    async launchGame(path: string): Promise<string> {
        return invoke<string>('launch_game', { filePath: path })
    },

    async downloadGame(url: string, destDir: string, filename: string, gameId: string): Promise<boolean> {
        return invoke<boolean>('download_and_extract', {
            downloadUrl: url,
            destDir,
            filename,
            gameId
        })
    },

    async getlocalpath(key: string): Promise<string> {
        if (key === 'downloads') {
            return downloadDir()
        }
        if (key === 'music') {
            return audioDir()
        }
        if (key === 'temp') {
            return tempDir()
        }
        return invoke<string>('get_local_path', { key })
    },

    async openFolder(): Promise<string | null> {
        const picked = await open({
            directory: true,
            multiple: false
        })
        return typeof picked === 'string' ? picked : null
    },

    async getStoreValue(key: string, value?: any): Promise<any> {
        const store = await storePromise
        const found = await store.get(key)
        if (found !== undefined) {
            return found
        }

        // 兼容 Electron 旧版配置，避免迁移后丢失历史数据。
        const legacyStore = await legacyStorePromise
        const legacyFound = await legacyStore.get(key)
        if (legacyFound !== undefined) {
            await store.set(key, legacyFound)
            await store.save()
            return legacyFound
        }

        return value
    },

    async setStoreValue(key: string, value: any): Promise<void> {
        const store = await storePromise
        await store.set(key, value)
        await store.save()
    },

    async deleteFolder(path: string): Promise<boolean> {
        return invoke<boolean>('remove_directory', { dirPath: path })
    },

    async parseAup(path: string): Promise<{ games: any[]; tempDir: string }> {
        return invoke<{ games: any[]; tempDir: string }>('parse_aup', { archivePath: path })
    },

    async moveFolder(archivePath: string, destDir: string): Promise<void> {
        await invoke('move_folder', { archivePath, destDir })
    },

    async findExecutable(rootDir: string): Promise<string> {
        return invoke<string>('find_executable', { rootDir })
    },

    async saveFile(name: string, extensions: string[]): Promise<string | null> {
        const selected = await save({
            filters: [{ name, extensions }]
        })
        return selected
    },

    async exportGame(gamesToExport: any[], saveDir: string): Promise<boolean> {
        return invoke<boolean>('export_game', { gamesToExport, saveDir })
    },

    async checkIsChinaIP(): Promise<boolean> {
        return invoke<boolean>('check_local_ip_region')
    },

    async openExternal(url: string): Promise<void> {
        await invoke('open_external_url', { url })
    },

    async submitGameApplication(payload: {
        name: string
        link: string
        desc?: string
        submitTime: string
        imageBase64?: string
        imageMd5?: string
    }): Promise<void> {
        await invoke('submit_game_application', { payload })
    },

    onDownloadProgress(callback: (data: { id: string; percent: number }) => void): void {
        Promise.resolve().then(async () => {
            if (unlistenDownload) {
                unlistenDownload()
            }
            unlistenDownload = await listen<{ id: string; percent: number }>('download-progress', (event) => {
                callback(event.payload)
            })
        })
    },

    onZipProgress(callback: (percent: number) => void): void {
        Promise.resolve().then(async () => {
            if (unlistenZip) {
                unlistenZip()
            }
            unlistenZip = await listen<number>('zip-progress', (event) => {
                callback(event.payload)
            })
        })
    },

    async getBgmFiles(bgmPath: string): Promise<string[]> {
        return invoke<string[]>('read_bgm_files', { bgmPath })
    },

    async isFolderExisted(folder_path: string): Promise<boolean> {
        return invoke<boolean>('folder_is_existed', { folderPath: folder_path })
    },

    async isParentFolder(childPath: string, targetParentPath: string): Promise<boolean> {
        return invoke<boolean>('is_parent_dir', { childPath, targetParentPath })
    },

    async renameFolder(oldPath: string, newName: string): Promise<void> {
        await invoke('rename_directory', { oldPath, newName })
    },

    async getGithubConfigPublic(): Promise<{
        owner: string
        repo: string
        branch: string
        configPath: string
        githubDataOwner: string
        githubDataRepo: string
        githubDataBranch: string
    }> {
        return invoke<{
            owner: string
            repo: string
            branch: string
            configPath: string
            githubDataOwner: string
            githubDataRepo: string
            githubDataBranch: string
        }>('get_github_config_public')
    },

    async getGitcodeFileContent(pathInRepo: string): Promise<{ content: string; sha: string }> {
        return invoke<{ content: string; sha: string }>('get_gitcode_file_content', { pathInRepo })
    },

    async incrementRemoteHighscore(
        gameId: string,
        snapshot?: { baseSha?: string; baseConfig?: any }
    ): Promise<{ ok: boolean; score?: number; sha?: string; error?: string }> {
        return invoke<{ ok: boolean; score?: number; sha?: string; error?: string }>('increment_remote_highscore', {
            gameId,
            snapshot
        })
    }
}

export default api
