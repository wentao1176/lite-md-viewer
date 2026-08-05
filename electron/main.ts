import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFile, writeFile } from 'fs/promises'
import { autoUpdater } from 'electron-updater'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// ESM 环境没有 __dirname，需要手动计算
const __dirname = dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    title: 'WTMD',
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
          label: '关于 WTMD',
          click: async () => {
            const result = await dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: '关于',
              message: 'WTMD',
              detail: `版本: ${app.getVersion()}\n轻量、高级、开箱即用的 Markdown 预览器\nMIT License © xwt\n\n项目主页:\nhttps://github.com/wentao1176/lite-md-viewer`,
              buttons: ['确定', '打开项目主页'],
              defaultId: 0,
              cancelId: 0
            })
            if (result.response === 1) {
              shell.openExternal('https://github.com/wentao1176/lite-md-viewer')
            }
          }
        },
        {
          label: 'GitHub 仓库',
          click: () => shell.openExternal('https://github.com/wentao1176/lite-md-viewer')
        },
        {
          label: '检查更新',
          click: () => {
            if (app.isPackaged) {
              autoUpdater.checkForUpdates().catch(() => {
                dialog.showMessageBox(mainWindow!, {
                  type: 'info',
                  title: '检查更新',
                  message: '当前已是最新版本',
                  detail: `WTMD ${app.getVersion()}`
                })
              })
            } else {
              dialog.showMessageBox(mainWindow!, {
                type: 'info',
                title: '检查更新',
                message: '开发模式不检查更新'
              })
            }
          }
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
ipcMain.handle('export:pdf', async (_event, html: string, opts: { pageNumbers?: boolean } = {}) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: '导出 PDF',
    defaultPath: 'document.pdf',
    filters: [{ name: 'PDF 文件', extensions: ['pdf'] }]
  })
  if (result.canceled || !result.filePath) {
    return { success: false, error: '已取消' }
  }
  return await exportPdfToPath(result.filePath, html, opts)
})

async function exportPdfToPath(filePath: string, html: string, opts: { pageNumbers?: boolean }) {

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

    await writeFile(filePath, pdfData)
    // 可选：添加页码（每页底部居中"第 X 页 / 共 Y 页"）
    if (opts.pageNumbers) {
      await addPageNumbersToPdf(filePath)
    }
    return { success: true, path: filePath }
  } catch (err: any) {
    return { success: false, error: err.message }
  } finally {
    printWin.destroy()
  }
}

// 给 PDF 每页底部居中追加页码（pdf-lib 后处理）
async function addPageNumbersToPdf(filePath: string) {
  const bytes = await readFile(filePath)
  const pdf = await PDFDocument.load(bytes)
  const pages = pdf.getPages()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const total = pages.length
  for (let i = 0; i < total; i++) {
    const page = pages[i]
    const { width, height } = page.getSize()
    // 用纯数字页码（WinAnsi 字体不支持中文）
    const label = `${i + 1} / ${total}`
    const textWidth = font.widthOfTextAtSize(label, 9)
    page.drawText(label, {
      x: (width - textWidth) / 2,
      y: 22,
      size: 9,
      font,
      color: rgb(0.55, 0.53, 0.5)
    })
  }
  const withNumbers = await pdf.save()
  await writeFile(filePath, withNumbers)
}

ipcMain.handle('app:get-version', () => app.getVersion())

// 文件拖拽到窗口
ipcMain.on('file:dropped', async (_event, filePath: string) => {
  if (filePath.endsWith('.md') || filePath.endsWith('.markdown') || filePath.endsWith('.mdown')) {
    await loadFile(filePath)
  }
})

// 从启动参数中提取 Markdown 文件路径（Windows 文件关联 / 命令行打开）
function findMdFileArg(argv: string[]): string | null {
  const exts = ['.md', '.markdown', '.mdown', '.mkd']
  for (const arg of argv) {
    if (!arg || arg === '.' || arg.startsWith('-')) continue
    const lower = arg.toLowerCase()
    if (exts.some((ext) => lower.endsWith(ext))) {
      return arg
    }
  }
  return null
}

// 打开文件并聚焦窗口（供单实例复用）
function openFileInWindow(filePath: string) {
  loadFile(filePath)
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
}

// 单实例锁：双击 .md 文件时若程序已运行，复用现有窗口打开新文件，而不是启动多个实例
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  // 第二个实例启动（程序已在运行时，双击 .md / 命令行再次调用）
  app.on('second-instance', (_event, argv) => {
    const filePath = findMdFileArg(argv)
    if (filePath) {
      openFileInWindow(filePath)
    } else if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
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

    // 启动参数中带文件（首次通过文件关联 / 命令行打开）
    const startupFile = findMdFileArg(process.argv)
    if (startupFile) {
      setTimeout(() => openFileInWindow(startupFile), 600)
    }
  })
}

// 自动更新：状态实时推送到渲染进程（铃铛通知 + 下载进度）
function setupAutoUpdater() {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  // 向渲染进程推送更新状态
  const push = (type: string, data?: any) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:event', { type, ...data })
    }
  }

  // 检查失败的退避重试计划（分钟）：启动失败后 10/30/60 分钟各重试一次
  const retryDelays = [10, 30, 60]

  const scheduleRetry = () => {
    if (retryAttempt >= retryDelays.length) return
    const delayMin = retryDelays[retryAttempt++]
    console.log(`[updater] 检查失败，${delayMin} 分钟后重试`)
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.error('[updater] retry failed:', err.message)
        scheduleRetry()
      })
    }, delayMin * 60 * 1000)
  }

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] checking for updates...')
    push('checking')
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] update available:', info.version)
    push('available', { version: info.version })
  })

  autoUpdater.on('update-not-available', (info) => {
    console.log('[updater] no update:', info.version)
    push('not-available', { version: info.version })
  })

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent * 10) / 10
    const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1)
    console.log(`[updater] downloading ${percent}% (${mb(progress.transferred)}MB / ${mb(progress.total)}MB)`)
    push('progress', {
      percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond
    })
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err.message)
    push('error', { message: err.message })
    scheduleRetry()
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[updater] downloaded:', info.version)
    push('downloaded', { version: info.version })
  })

  // 延迟几秒检查，避免拖慢冷启动；失败时进入退避重试
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[updater] initial check failed:', err.message)
      scheduleRetry()
    })
  }, 5000)

  // 后台定时复查：每 4 小时检查一次，保证长期开机的用户也能收到更新
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[updater] scheduled check failed:', err.message)
      scheduleRetry()
    })
  }, 4 * 60 * 60 * 1000)
}

// 渲染进程请求：手动检查更新 / 立即重启安装
ipcMain.handle('updater:check', async () => {
  if (!app.isPackaged) {
    return { success: false, error: '开发模式' }
  }
  retryAttemptReset()
  try {
    await autoUpdater.checkForUpdates()
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

let retryAttempt = 0
function retryAttemptReset() {
  retryAttempt = 0
}

ipcMain.handle('updater:install', async () => {
  autoUpdater.quitAndInstall()
  return { success: true }
})

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
