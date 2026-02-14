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
import { publicIpv4 } from 'public-ip';


if (process.platform === 'linux' && fs.existsSync(sevenBin.path7za)) {
  try {
    fs.chmodSync(sevenBin.path7za, 0o755); // 赋予可执行权限
  } catch (err) {
    console.error('无法自动修正 7zip 权限:', err);
  }
}
const getSize = promisify(fastFolderSize);
const store = new Store({

  clearInvalidConfig: true,
})
function getdownloadpath(): string {
  return app.getPath('downloads');
}
async function downloadFile(url: string, destPath: string, gameId: string, webContents: any): Promise<void> {
  const writer = fs.createWriteStream(destPath);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    timeout: 15000
  });

  const totalLength = parseInt(response.headers['content-length'] || '0', 10);
  let downloadedLength = 0;

  response.data.on('data', (chunk: Buffer) => {
    downloadedLength += chunk.length;
    if (totalLength > 0) {
      const percent = Math.floor((downloadedLength / totalLength) * 100);
      // 关键：向渲染进程发送进度
      webContents.send('download-progress', { id: gameId, percent });
    }
  });

  response.data.pipe(writer);
  return new Promise<void>((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}
async function extract7z(archivePath, outputDir) {
  const stream = Seven.extractFull(archivePath, outputDir, {
    $bin: sevenBin.path7za

  });
  return new Promise<void>((resolve, reject) => {
    stream.on('end', () => resolve());
    stream.on('error', (err) => reject(err));
  });
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
      webSecurity: false,
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
    try {
      // 尝试获取公网 IP，设置超时防止卡死
      // publicIpv4 库本身没有简单的超时参数，所以我们依靠 try-catch
      // 如果断网，publicIpv4 会抛出错误
      const publicIP = await publicIpv4();

      // 2. 查询离线库
      const searcher = Searcher.newWithFileOnly(Searcher.defaultDbFile)
      const info = await searcher.search(publicIP);

      if (!info || !info.region) return false;

      console.log(info.region, publicIP);
      const parts = info.region.split('|');
      if (parts[0] !== '中国') return false;

      const specialRegions = ['香港', '澳门', '台湾'];
      if (specialRegions.includes(parts[2])) {
        return false;
      }
      return true;
    } catch (error) {
      // 关键修复：如果断网或查询失败，打印日志但不抛出错误给前端
      // 默认返回 false，视为非大陆 IP 或离线状态
      console.warn('Network offline or IP check failed, defaulting to global config:', error);
      return false;
    }
  });
  ipcMain.handle('open-external-url', async (_, url) => {
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
      let filePath = result.filePath;
      const primaryExt = `.${extensions[0]}`;
      if (!filePath.toLowerCase().endsWith(primaryExt.toLowerCase())) {
        filePath += primaryExt;
      }

      return filePath;
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
  ipcMain.handle('download-and-extract', async (event, downloadUrl, destDir, filename, gameId) => {
    const savePath = path.join(app.getPath("temp"), filename);
    try {
      // 这里的 event.sender 即为 webContents
      await downloadFile(downloadUrl, savePath, gameId, event.sender);
      await extract7z(savePath, destDir);
      // ... 之后执行原有逻辑（删除临时文件等）
      return true;
    } catch (error) {
      throw error;
    }
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
  ipcMain.handle('get-aup-config', async (event, archivePath) => {
    // 生成临时目录
    const tempDir = path.join(app.getPath('temp'), `au_export_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    return new Promise((resolve, reject) => {
      const myStream = Seven.extractFull(archivePath, tempDir, {
        $bin: sevenBin.path7za,
        recursive: true,
        $progress: true
      });
      myStream.on('progress', (progressData) => {
        event.sender.send('zip-progress', progressData.percent as number);
      });
      myStream.on('end', async () => {
        const configPath = path.join(tempDir, 'config.json');
        const jsonRaw = fs.readFileSync(configPath, 'utf8');
        const games = JSON.parse(jsonRaw);

        // 3. 显式返回结果给渲染进程
        resolve({ games, tempDir });
      });
      myStream.on('error', async (err) => {
        reject(err);
      });
    });

  });
  ipcMain.handle('move-folder', async (_, archivePath, destDir) => {
    fs.copy(archivePath, destDir, { overwrite: true });
  })
  ipcMain.handle('export-game', async (event, gamesToExport, saveDir) => {
    const tempDir = path.join(app.getPath('temp'), `au_export_${Date.now()}_${Math.random()}`);

    // 定义权重import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron';
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
import { publicIpv4 } from 'public-ip';


if (process.platform === 'linux' && fs.existsSync(sevenBin.path7za)) {
  try {
    fs.chmodSync(sevenBin.path7za, 0o755); // 赋予可执行权限
  } catch (err) {
    console.error('无法自动修正 7zip 权限:', err);
  }
}
const getSize = promisify(fastFolderSize);
const store = new Store({

  clearInvalidConfig: true,
})
function getdownloadpath(): string {
  return app.getPath('downloads');
}
async function downloadFile(url: string, destPath: string, gameId: string, webContents: any): Promise<void> {
  const writer = fs.createWriteStream(destPath);
  const response = await axios({
    url,

    const COPY_WEIGHT = 0.3;
    const ZIP_WEIGHT = 0.7;

    try {
      await fs.ensureDir(tempDir);
      await fs.writeJson(path.join(tempDir, 'config.json'), gamesToExport);

      // --- 1. 复制阶段 ---
      let completedCopies = 0;
      const totalGames = gamesToExport.length;

      const copyPromises = gamesToExport.map(async (metadata) => {
        const gameRoot = path.join(metadata.execution_path, '..');
        const gameDestDir = path.join(tempDir, metadata.id);
        await fs.ensureDir(gameDestDir);

        const fileSize: any = await getSize(gameRoot);

        if (fileSize < 2147483648) {
          await fs.copy(gameRoot, gameDestDir);
        } else {
          const destExePath = path.join(gameDestDir, path.basename(metadata.execution_path));
          await fs.copyFile(metadata.execution_path, destExePath);
        }

        // 每次完成一个游戏，更新进度
        completedCopies++;
        const copyProgress = (completedCopies / totalGames) * 100;
        // 发送加权后的进度：0% -> 30%
        event.sender.send('zip-progress', Math.round(copyProgress * COPY_WEIGHT));
      });

      await Promise.all(copyPromises);

      // --- 2. 压缩阶段 ---
      return new Promise((resolve, reject) => {
        const myStream = Seven.add(saveDir, path.join(tempDir, '*'), {
          $bin: sevenBin.path7za,
          recursive: true,
          $progress: true
        });

        myStream.on('progress', (progressData) => {
          // 压缩进度从 0-100 映射到 30%-100%
          // 计算公式：基础进度(30) + (当前压缩百分比 * 0.7)
          const totalProgress = (COPY_WEIGHT * 100) + (progressData.percent * ZIP_WEIGHT);

          event.sender.send('zip-progress', Math.round(totalProgress));
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
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found:' + filePath);
    }
    return new Promise((resolve, _reject) => {
      // 统一处理带空格的路径
      const command = process.platform === 'win32'
        ? `"${filePath}"`
        : `wine "${filePath}"`;

      exec(command, (error, _stdout, stderr) => {
        if (error) {
          // 核心：这里的错误会被传递到渲染层的 catch 中
          console.error(`启动报错: ${error.message}`);

        }

        // 如果 stderr 有内容，有时是 Wine 的调试信息而非真正的崩溃
        if (stderr) {
          console.warn(`Wine 警告信息: ${stderr}`);
        }

        resolve('成功启动');
      });
    })
  });
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
