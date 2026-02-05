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
let JSON_AUP;
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
    $bin: sevenBin.path7za

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
// Some APIs can only be used after this event occurs.
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


  ipcMain.handle('remove-directory', async (event, dirPath) => {
    try {

      await fs.remove(path.join(dirPath, '..'));

    } catch (err) {
      console.error('删除目录失败:', err);
    }
  });
  ipcMain.handle('save-file', async (event, name, extensions) => {
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
  ipcMain.handle('open-file', async (event, name, extensions) => {
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
  ipcMain.handle('download-and-extract', async (event, downloadUrl, destDir, filename) => {
    await handleDownloadAndExtract(downloadUrl, destDir, filename);
  });
  ipcMain.handle('get-store-value', (event, key, value) => {
    console.log(store.get(key, value));
    return store.get(key, value);
  })

  ipcMain.handle('set-store-value', (event, key, value) => {
    store.set(key, value);
  })
  ipcMain.handle('get-download-path', () => {
    return getdownloadpath();
  });
  ipcMain.handle('get-aup-config', async (event, archivePath) => {
    const destDir = path.join(app.getPath('temp'), "temp_aup_import");
    extract7z(archivePath, destDir).then(() => {
      JSON_AUP = JSON.parse(fs.readFileSync(`${destDir}/config.json`, 'utf8'));
      return JSON_AUP;

    })
  })
  ipcMain.handle('extract-aup', async (event, archivePath, destDir, targetIDs) => {
    extract7z(archivePath, destDir).then(() => {
      // 获取目标文件列表
      const targetFiles = targetIDs.map(id => `${id}.aup`);
      // 创建一个包含目标文件列表的数组
      const targetFileList = targetFiles.map(fileName => `${destDir}/${fileName}`);
      // 删除目标文件
      Promise.all(targetFileList.map(filePath => fs.unlink))
    })
  })
  ipcMain.handle('export-game', async (event, gamesToExport, saveDir) => {
    // 1. 准备路径
    const tempDir = path.join(app.getPath('temp'), `au_export_${Date.now()}_${Math.random()}`);
    try {
      await fs.ensureDir(tempDir);
      await fs.writeJson(path.join(tempDir, 'config.json'), gamesToExport);
      for (const metadata of gamesToExport) {
        const gameRoot = path.join(metadata.execution_path, '..');
        const gameDestDir = path.join(tempDir, metadata.id);
        await fs.copy(gameRoot, gameDestDir);
      }


      return new Promise((resolve, reject) => {
        const myStream = Seven.add(saveDir, path.join(tempDir,'*'), {
          $bin: sevenBin.path7za,
          recursive: true
        });

        myStream.on('end', async () => {
          // 压缩完成后清理临时目录
          try {
            await fs.remove(tempDir);
            resolve(true);
          } catch (cleanupErr) {
            console.error("Cleanup failed but export succeeded", cleanupErr);
            resolve(true); // 即使清理失败也算导出成功
          }
        });

        myStream.on('error', async (err: any) => {
          await fs.remove(tempDir); // 出错也要清理
          reject(err);
        });
      });

    } catch (error) {
      // 确保清理
      if (await fs.pathExists(tempDir)) {
        await fs.remove(tempDir);
      }
      throw error;
    }
  });
  ipcMain.handle('launch-game', async (event, filePath) => {
    return new Promise((resolve, reject) => {
      // 使用引号包裹路径，防止空格导致解析失败
      exec(`"${filePath}"`, (error) => {
        if (error) {
          console.error('启动失败:', error)
          reject(error.message)
        } else {
          resolve(true)
        }
      })
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
