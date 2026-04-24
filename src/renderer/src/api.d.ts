declare global {
    interface Window {
        api: {
            openFile: (custom_name: string, extensions: string[]) => Promise<string | null>
            launchGame: (path: string) => Promise<string>
            downloadGame: (url: string, destDir: string, filename: string, gameId: string) => Promise<boolean>
            getlocalpath: (key: string) => Promise<string>
            openFolder: () => Promise<string | null>
            getStoreValue: (key: string, value?: any) => Promise<any>
            setStoreValue: (key: string, value: any) => Promise<void>
            deleteFolder: (path: string) => Promise<boolean>
            parseAup: (path: string) => Promise<{ games: any[]; tempDir: string }>
            moveFolder: (archivePath: string, destDir: string) => Promise<void>
            saveFile: (name: string, extensions: string[]) => Promise<string | null>
            exportGame: (gamesToExport: any[], saveDir: string) => Promise<boolean>
            checkIsChinaIP: () => Promise<boolean>
            openExternal: (url: string) => Promise<void>
            submitGameApplication: (payload: {
                name: string
                link: string
                desc?: string
                submitTime: string
                imageBase64?: string
                imageMd5?: string
            }) => Promise<void>
            onDownloadProgress: (callback: (data: { id: string; percent: number }) => void) => void
            onZipProgress: (callback: (percent: number) => void) => void
            getBgmFiles: (bgmPath: string) => Promise<string[]>
            isFolderExisted: (folder_path: string) => Promise<boolean>
            isParentFolder: (childPath: string, targetParentPath: string) => Promise<boolean>
            renameFolder: (oldPath: string, newName: string) => Promise<void>
            getGithubConfigPublic: () => Promise<{ owner: string; repo: string; branch: string; configPath: string }>
            incrementRemoteHighscore: (
                gameId: string,
                snapshot?: { baseSha?: string; baseConfig?: any }
            ) => Promise<{ ok: boolean; score?: number; sha?: string; error?: string }>
        }
    }
}

export { }
