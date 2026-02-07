import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import { exec } from 'child_process';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import icon from '../../resources/icon.png?asset';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import Seven from 'node-7z';
import sevenBin from '7zip-bin';
import Store from 'electron-store';
import fastFolderSize from 'fast-folder-size';
import { promisify } from 'util';
import * as Searcher from 'ip2region-ts';
let _7zPath = sevenBin.path7za;
if (process.env.NODE_ENV !== 'development') {
  _7zPath = _7zPath.replace('app.asar', 'app.asar.unpacked');
}
const getSize = promisify(fastFolderSize);
const store = new Store({

  clearInvalidConfig: true,
})
function getdownloadpath(): string {
  return app.getPath('downloads');
}
async function downloadFile(url: string, destPath: string): Promise<void> {
  const writer = fs.createWriteStream(destPath);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  });
  response.data.pipe(writer);
  return new Promise<void>((resolve, reject) => {
    // 明确告诉 resolve 不需要参数
    writer.on('finish', () => resolve());
    writer.on('error', (err) => reject(err));
  });
}
async function extract7z(archivePath, outputDir) {
  const stream = Seven.extractFull(archivePath, outputDir, {
    $bin: _7zPath

  });
  return new Promise<void>((resolve, reject) => {
    stream.on('end', () => resolve());
    stream.on('error', (err) => reject(err));
  });
}
async function handleDownloadAndExtract(downloadUrl: string, destDir: string, filename: string) {

  const savePath = path.join(app.getPath("temp"), filename);
  try {
    await downloadFile(downloadUrl, savePath);
    await extract7z(savePath, destDir);
    fs.unlinkSync(savePath);
  } catch (error) {
    console.error('操作失败:', error);
  }
}
function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this _ occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))
  ipcMain.handle('check-local-ip-region', async () => {
    const { data } = await axios.get('https://api.ipify.org?format=json');
    const publicIP = data.ip;

    // 2. 查询离线库
    const searcher = Searcher.newWithFileOnly(Searcher.defaultDbFile)
    const info = await searcher.search(publicIP);
    if(!info.region)
      return false;
    const parts = info.region.split('|');
    if (parts[0] !== '中国') return false;
    const specialRegions = ['香港', '澳门', '台湾'];
    if (specialRegions.includes(parts[2])) {
      return false;
    }
    return true;

  });
ipcMain.handle('open-external-url',async (event, url) => {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    shell.openExternal(url);
  }
})
  ipcMain.handle('remove-directory', async (_, dirPath) => {
    fs.remove(path.join(dirPath, '..'));
  });
  ipcMain.handle('save-file', async (_, name, extensions) => {
    const result = await dialog.showSaveDialog({
      filters: [
        { name: name, extensions: extensions },
      ]
    });
    if (result.canceled) {
      return null;
    } else {
      return result.filePath;
    };

  });
  ipcMain.handle('open-file', async (_, name, extensions) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: name, extensions: extensions },
      ]
    })
    if (canceled) {
      return null
    } else {
      return filePaths[0]
    }
  });
  ipcMain.handle('open-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (canceled) {
      return null
    } else {
      return filePaths[0]
    }
  });
  ipcMain.handle('download-and-extract', async (_, downloadUrl, destDir, filename) => {
    await handleDownloadAndExtract(downloadUrl, destDir, filename);
  });
  ipcMain.handle('get-store-value', (_, key, value) => {
    console.log(store.get(key, value));
    return store.get(key, value);
  })
  ipcMain.handle('set-store-value', (_, key, value) => {
    store.set(key, value);
  })
  ipcMain.handle('get-download-path', () => {
    return getdownloadpath();
  });
  ipcMain.handle('get-aup-config', async (_, archivePath) => {
    // 生成临时目录
    const tempDir = path.join(app.getPath('temp'), `au_export_${Date.now()}_${Math.random().toString(36).slice(2)}`);

    try {
      // 1. 必须 await 这个异步解压过程
      await extract7z(archivePath, tempDir);

      // 2. 解压完成后读取文件
      const configPath = path.join(tempDir, 'config.json');
      const jsonRaw = fs.readFileSync(configPath, 'utf8');
      const games = JSON.parse(jsonRaw);

      // 3. 显式返回结果给渲染进程
      return { games, tempDir };
    } catch (error) {
      console.error('解析 AUP 失败:', error);
      throw error; // 抛出错误，渲染进程的 try-catch 就能捕获到
    }
  });
  ipcMain.handle('move-folder', async (_, archivePath, destDir) => {
    fs.move(archivePath, destDir);
  })
  ipcMain.handle('export-game', async (_, gamesToExport, saveDir) => {
    const tempDir = path.join(app.getPath('temp'), `au_export_${Date.now()}_${Math.random()}`);

    try {
      await fs.ensureDir(tempDir);
      await fs.writeJson(path.join(tempDir, 'config.json'), gamesToExport);

      // 1. 构造任务数组 (不使用 await，先创建 Promise)
      const copyPromises = gamesToExport.map(async (metadata) => {
        const gameRoot = path.join(metadata.execution_path, '..');
        const gameDestDir = path.join(tempDir, metadata.id);

        // 确保目标子目录存在
        await fs.ensureDir(gameDestDir);

        const fileSize: any = await getSize(gameRoot);

        if (fileSize < 2147483648) { // 2GB
          // 使用异步版本 fs.copy 而不是 copySync
          return fs.copy(gameRoot, gameDestDir);
        } else {
          const destExePath = path.join(gameDestDir, path.basename(metadata.execution_path));
          return fs.copyFile(metadata.execution_path, destExePath);
        }
      });

      // 2. 并行执行所有复制任务，并等待它们全部完成
      // Promise.all 会在所有任务成功时 resolve，只要有一个失败就会 reject
      await Promise.all(copyPromises);

      // 3. 执行压缩任务
      return new Promise((resolve, reject) => {
        const myStream = Seven.add(saveDir, path.join(tempDir, '*'), {
          $bin: _7zPath,
          recursive: true
        });

        myStream.on('end', async () => {
          try {
            await fs.remove(tempDir);
            resolve(true);
          } catch (cleanupErr) {
            resolve(true);
          }
        });

        myStream.on('error', async (err) => {
          await fs.remove(tempDir);
          reject(err);
        });
      });

    } catch (error) {
      if (await fs.pathExists(tempDir)) {
        await fs.remove(tempDir);
      }
      throw error;
    }
  });
  ipcMain.handle('launch-game', async (_, filePath) => {
    return new Promise((resolve, reject) => {
      // 使用引号包裹路径，防止空格导致解析失败
      if (process.platform === 'win32') {
        exec(`"${filePath}"`, (error) => {
          if (error) {
            console.error('启动失败:', error)
            reject(error.message)
          } else {
            resolve(true)
          }
        })
      }
      else {
        exec(`"wine ${filePath}"`, (error) => {
          if (error) {
            console.error('启动失败:', error)
            reject(error.message)
          } else {
            resolve(true)
          }
        })
      }
    })
  })
  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
