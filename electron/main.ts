import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFile, writeFile } from 'fs/promises'
import { autoUpdater } from 'electron-updater'

// ESM 环境没有 __dirname，需要手动计算
const __dirname = dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    title: 'lite-md-viewer',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#2a2724'
  })

  // 开发模式加载 Vite 开发服务器，生产模式加载打包后的文件
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  buildMenu()
}

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '打开文件...',
          accelerator: 'CmdOrCtrl+O',
          click: () => openFileViaDialog()
        },
        {
          label: '打开文件夹...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => openFolderViaDialog()
        },
        { type: 'separator' },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:save')
        },
        {
          label: '导出 HTML...',
          click: () => mainWindow?.webContents.send('menu:export-html')
        },
        {
          label: '导出 PDF...',
          click: () => mainWindow?.webContents.send('menu:export-pdf')
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '切换主题',
          accelerator: 'CmdOrCtrl+T',
          click: () => mainWindow?.webContents.send('menu:toggle-theme')
        },
        {
          label: '切换自动目录',
          click: () => mainWindow?.webContents.send('menu:toggle-toc')
        },
        { type: 'separator' },
        { role: 'reload', label: '刷新' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { role: 'resetZoom', label: '重置缩放' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 lite-md-viewer',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: '关于',
              message: 'lite-md-viewer',
              detail: `版本: ${app.getVersion()}\n轻量、高级、开箱即用的 Markdown 预览器\nMIT License © xwt`
            })
          }
        },
        {
          label: 'GitHub 仓库',
          click: () => shell.openExternal('https://github.com/xwt/lite-md-viewer')
        }
      ]
    }
  ]

  // macOS 特殊处理
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about', label: '关于' },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    })
  }

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

async function openFileViaDialog() {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown 文件', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })

  if (!result.canceled && result.filePaths.length > 0) {
    await loadFile(result.filePaths[0])
  }
}

async function openFolderViaDialog() {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory']
  })

  if (!result.canceled && result.filePaths.length > 0) {
    mainWindow?.webContents.send('folder:opened', result.filePaths[0])
  }
}

async function loadFile(filePath: string) {
  try {
    const content = await readFile(filePath, 'utf-8')
    mainWindow?.webContents.send('file:loaded', { path: filePath, content })
  } catch (err: any) {
    dialog.showErrorBox('打开失败', `无法读取文件:\n${err.message}`)
  }
}

// IPC handlers
ipcMain.handle('file:open', async () => {
  await openFileViaDialog()
})

ipcMain.handle('file:read', async (_event, filePath: string) => {
  try {
    const content = await readFile(filePath, 'utf-8')
    return { success: true, content }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('file:save', async (_event, filePath: string, content: string) => {
  try {
    await writeFile(filePath, content, 'utf-8')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('file:save-as', async (_event, content: string) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    filters: [
      { name: 'Markdown 文件', extensions: ['md'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })
  if (!result.canceled && result.filePath) {
    try {
      await writeFile(result.filePath, content, 'utf-8')
      return { success: true, path: result.filePath }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
  return { success: false, error: '已取消' }
})

ipcMain.handle('dialog:open-file', async () => {
  await openFileViaDialog()
})

// 导出 HTML：直接写文件
ipcMain.handle('export:html', async (_event, html: string) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: '导出 HTML',
    defaultPath: 'document.html',
    filters: [{ name: 'HTML 文件', extensions: ['html'] }]
  })
  if (result.canceled || !result.filePath) {
    return { success: false, error: '已取消' }
  }
  try {
    await writeFile(result.filePath, html, 'utf-8')
    return { success: true, path: result.filePath }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// 导出 PDF：用独立隐藏窗口加载 HTML 后 printToPDF（避免主窗口深色背景产生黑边）
ipcMain.handle('export:pdf', async (_event, html: string) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: '导出 PDF',
    defaultPath: 'document.pdf',
    filters: [{ name: 'PDF 文件', extensions: ['pdf'] }]
  })
  if (result.canceled || !result.filePath) {
    return { success: false, error: '已取消' }
  }

  // A4 尺寸 @ 96dpi：210mm ≈ 794px，297mm ≈ 1123px
  const printWin = new BrowserWindow({
    show: false,
    width: 794,
    height: 1123,
    backgroundColor: '#ffffff',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  try {
    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
    await printWin.loadURL(dataUrl)
    await new Promise<void>((resolve) => setTimeout(resolve, 300))

    const pdfData = await printWin.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      // 边距为 0：页面背景（米白）由 CSS @page + html 背景铺满整页，避免白边与背景色不协调
      margins: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0
      },
      preferCSSPageSize: false
    })

    await writeFile(result.filePath, pdfData)
    return { success: true, path: result.filePath }
  } catch (err: any) {
    return { success: false, error: err.message }
  } finally {
    printWin.destroy()
  }
})

ipcMain.handle('app:get-version', () => app.getVersion())

// 文件拖拽到窗口
ipcMain.on('file:dropped', async (_event, filePath: string) => {
  if (filePath.endsWith('.md') || filePath.endsWith('.markdown') || filePath.endsWith('.mdown')) {
    await loadFile(filePath)
  }
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  // 自动更新：仅在打包后的正式版本生效（开发模式跳过）
  setupAutoUpdater()
})

// 自动更新：从 GitHub Releases 拉取新版本，下载完成后提示重启安装
function setupAutoUpdater() {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] checking for updates...')
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] update available:', info.version)
  })

  autoUpdater.on('update-not-available', (info) => {
    console.log('[updater] no update:', info.version)
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err.message)
  })

  autoUpdater.on('update-downloaded', async (info) => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow
    const result = win
      ? await dialog.showMessageBox(win, {
          type: 'info',
          title: '发现新版本',
          message: `lite-md-viewer ${info.version} 已下载完成`,
          detail: '重启应用即可完成更新，是否现在重启？',
          buttons: ['立即重启', '稍后再说'],
          defaultId: 0,
          cancelId: 1
        })
      : { response: 1 }

    if (result.response === 0) {
      autoUpdater.quitAndInstall()
    }
  })

  // 延迟几秒检查，避免拖慢冷启动
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {
      // 检查失败静默处理（如无网络、仓库不存在等）
    })
  }, 5000)
}

// Windows: 通过文件关联打开 .md 文件
app.on('open-file', async (_event, filePath) => {
  if (app.isReady()) {
    await loadFile(filePath)
  } else {
    app.once('ready', () => loadFile(filePath))
  }
})

// 非 macOS 平台关闭所有窗口时退出
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
