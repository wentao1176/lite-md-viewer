import { app, BrowserWindow, ipcMain, dialog, Menu, shell, net } from 'electron'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { readFile, writeFile } from 'fs/promises'
import { autoUpdater } from 'electron-updater'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { createPdfHtmlFile } from './pdf-html-file'
import { waitForPrintResources } from './print-resources'
import { IMAGE_EXTENSIONS, imageExtension, insertDocumentImages } from './document-images'
import type { UpdaterEvent } from './preload'
import type { ImageInsertionRequest, ImageInsertionResult } from '../src/shared/image-insertion'

// ESM 环境没有 __dirname，需要手动计算
const __dirname = dirname(fileURLToPath(import.meta.url))

type DocumentData = { path: string; content: string }
type WindowState = {
  hasDocument: boolean
  dirty: boolean
  ready: boolean
  pendingDocument?: DocumentData
  closePending: boolean
  closeApproved: boolean
  imageInsertionActive: boolean
}

const documentWindows = new Map<BrowserWindow, WindowState>()
let lastUpdaterEvent: UpdaterEvent | undefined

function activeDocumentWindow() {
  const focused = BrowserWindow.getFocusedWindow()
  return focused && documentWindows.has(focused) ? focused : documentWindows.keys().next().value
}

function documentWindowForSender(sender: Electron.WebContents) {
  const window = BrowserWindow.fromWebContents(sender)
  const state = window && documentWindows.get(window)
  return window && state ? { window, state } : undefined
}

function focusWindow(window: BrowserWindow) {
  if (window.isMinimized()) window.restore()
  window.focus()
}

function createWindow() {
  const window = new BrowserWindow({
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

  const state: WindowState = {
    hasDocument: false,
    dirty: false,
    ready: false,
    closePending: false,
    closeApproved: false,
    imageInsertionActive: false
  }
  documentWindows.set(window, state)
  window.webContents.on('did-start-loading', () => {
    state.ready = false
  })

  // 开发模式加载 Vite 开发服务器，生产模式加载打包后的文件
  if (process.env.VITE_DEV_SERVER_URL) {
    window.loadURL(process.env.VITE_DEV_SERVER_URL)
    window.webContents.openDevTools()
  } else {
    window.loadFile(join(__dirname, '../dist/index.html'))
  }

  // 关闭窗口时：有未保存修改 → 询问保存/不保存/取消
  window.on('close', (event) => {
    if (state.closeApproved) return
    if (state.closePending || state.imageInsertionActive) {
      event.preventDefault()
      return
    }
    if (!state.dirty) return

    event.preventDefault()
    state.closePending = true
    void dialog.showMessageBox(window, {
      type: 'warning',
      buttons: ['保存', '不保存', '取消'],
      defaultId: 0,
      cancelId: 2,
      message: '有未保存的修改',
      detail: '是否先保存当前文档再关闭窗口？'
    }).then(({ response }) => {
      if (window.isDestroyed()) return
      if (response === 0) {
        window.webContents.send('app:save-before-close')
        return
      }
      state.closePending = false
      if (response === 1) {
        state.closeApproved = true
        window.close()
      }
    }).catch((error) => {
      state.closePending = false
      console.error('关闭窗口提示失败', error)
    })
  })

  window.on('closed', () => {
    documentWindows.delete(window)
  })

  return window
}

function showAppMessageBox(options: Electron.MessageBoxOptions) {
  const window = activeDocumentWindow()
  return window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options)
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
          click: () => activeDocumentWindow()?.webContents.send('menu:save')
        },
        {
          label: '导出 HTML...',
          click: () => activeDocumentWindow()?.webContents.send('menu:export-html')
        },
        {
          label: '导出 PDF...',
          click: () => activeDocumentWindow()?.webContents.send('menu:export-pdf')
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
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
          click: () => activeDocumentWindow()?.webContents.send('menu:toggle-theme')
        },
        {
          label: '切换自动目录',
          click: () => activeDocumentWindow()?.webContents.send('menu:toggle-toc')
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
            const result = await showAppMessageBox({
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
                showAppMessageBox({
                  type: 'info',
                  title: '检查更新',
                  message: '当前已是最新版本',
                  detail: `WTMD ${app.getVersion()}`
                })
              })
            } else {
              showAppMessageBox({
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

async function openFileViaDialog(window = activeDocumentWindow()) {
  if (window && documentWindows.get(window)?.imageInsertionActive) return
  const options: Electron.OpenDialogOptions = {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Markdown 文件', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  }
  const result = await (window ? dialog.showOpenDialog(window, options) : dialog.showOpenDialog(options))

  if (!result.canceled) {
    await openFilePaths(result.filePaths, window)
  }
}

async function openFolderViaDialog() {
  const window = activeDocumentWindow()
  if (!window || documentWindows.get(window)?.imageInsertionActive) return
  const result = await dialog.showOpenDialog(window, {
    properties: ['openDirectory']
  })

  if (!window.isDestroyed() && !result.canceled && result.filePaths.length > 0) {
    window.webContents.send('folder:opened', result.filePaths[0])
  }
}

function openDocument(document: DocumentData, preferredWindow?: BrowserWindow) {
  const preferredState = preferredWindow && documentWindows.get(preferredWindow)
  const reuseWelcome = preferredWindow && preferredState && !preferredState.hasDocument && !preferredState.dirty
    && !preferredState.imageInsertionActive && !preferredState.closePending
  const window = reuseWelcome ? preferredWindow : createWindow()
  const state = documentWindows.get(window)!

  state.hasDocument = true
  if (state.ready) {
    window.webContents.send('file:loaded', document)
  } else {
    state.pendingDocument = document
  }
  focusWindow(window)
}

async function openFilePaths(filePaths: string[], preferredWindow?: BrowserWindow) {
  for (const path of filePaths) {
    try {
      const content = await readFile(path, 'utf-8')
      openDocument({ path, content }, preferredWindow)
    } catch (err: any) {
      dialog.showErrorBox('打开失败', `无法读取文件:\n${path}\n${err.message}`)
    }
  }
}

// IPC handlers
ipcMain.on('file:ready', (event) => {
  const owner = documentWindowForSender(event.sender)
  if (!owner) return
  const { window, state } = owner
  state.ready = true
  if (state.pendingDocument) {
    window.webContents.send('file:loaded', state.pendingDocument)
    state.pendingDocument = undefined
  }
  if (lastUpdaterEvent) window.webContents.send('updater:event', lastUpdaterEvent)
})

ipcMain.handle('images:insert', async (event, request: ImageInsertionRequest): Promise<ImageInsertionResult> => {
  const owner = documentWindowForSender(event.sender)
  if (!owner) return { success: false, error: '文档窗口已关闭' }
  const { window, state } = owner
  if (state.imageInsertionActive) return { success: false, error: '正在插入图片，请稍候' }
  state.imageInsertionActive = true
  try {
    if (!request || typeof request.content !== 'string' || !request.selection) throw new Error('无法读取当前文档，请重试')
    let images: Array<{ data: Uint8Array; extension: string }>
    if (request.pastedImages) {
      images = request.pastedImages.map(image => ({ data: Buffer.from(image.bytes), extension: imageExtension(image.mimeType, image.name) }))
    } else {
      const picked = await dialog.showOpenDialog(window, {
        title: '插入图片',
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: '图片文件', extensions: IMAGE_EXTENSIONS }]
      })
      if (picked.canceled || !picked.filePaths.length) return { success: false, cancelled: true, error: '已取消' }
      images = []
      for (const path of picked.filePaths) {
        const data = await readFile(path)
        images.push({ data, extension: imageExtension('', path) })
      }
    }
    if (!images.length) return { success: false, cancelled: true, error: '已取消' }
    let documentPath = request.documentPath
    const allowNew = !documentPath
    if (!documentPath) {
      const location = await dialog.showSaveDialog(window, {
        title: '插入图片：保存文档位置',
        defaultPath: '未命名.md',
        filters: [{ name: 'Markdown 文件', extensions: ['md'] }]
      })
      if (location.canceled || !location.filePath) return { success: false, cancelled: true, error: '已取消' }
      documentPath = /\.(?:md|markdown|mdown|mkd)$/i.test(location.filePath) ? location.filePath : `${location.filePath}.md`
    }
    const result = await insertDocumentImages({ documentPath, content: request.content, selection: request.selection, images, allowNew })
    if (result.success) state.hasDocument = true
    return result
  } catch (error: any) {
    return { success: false, error: error.message || '图片插入失败，请重试' }
  } finally {
    state.imageInsertionActive = false
  }
})

ipcMain.handle('file:open', async (event) => {
  const owner = documentWindowForSender(event.sender)
  if (owner) await openFileViaDialog(owner.window)
})

ipcMain.handle('file:dropped', async (event, filePath: string, content?: string) => {
  const owner = documentWindowForSender(event.sender)
  if (!owner) return
  if (filePath) {
    await openFilePaths([filePath], owner.window)
  } else if (typeof content === 'string') {
    openDocument({ path: '', content }, owner.window)
  }
})

// 读取图片 → data URL（相对路径图片基于 md 文件目录解析后转 base64，预览/导出都可用）
ipcMain.handle('file:read-image', async (_event, filePath: string) => {
  try {
    if (/^https?:\/\//i.test(filePath)) {
      const response = await net.fetch(filePath, { signal: AbortSignal.timeout(30000), credentials: 'include' })
      if (!response.ok) throw new Error(`图片请求失败：HTTP ${response.status}`)
      const mime = response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream'
      const data = Buffer.from(await response.arrayBuffer())
      return { success: true, dataUrl: `data:${mime};base64,${data.toString('base64')}` }
    }
    const ext = filePath.split('.').pop()?.toLowerCase() || ''
    const mimeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      bmp: 'image/bmp',
      ico: 'image/x-icon',
      avif: 'image/avif'
    }
    const mime = mimeMap[ext] || 'application/octet-stream'
    const data = await readFile(filePath)
    const b64 = data.toString('base64')
    return { success: true, dataUrl: `data:${mime};base64,${b64}` }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// 未保存状态上报（渲染进程）
ipcMain.on('app:set-dirty', (event, dirty: boolean) => {
  const owner = documentWindowForSender(event.sender)
  if (owner) owner.state.dirty = dirty
})

ipcMain.on('app:save-complete', (event, saved: boolean) => {
  const owner = documentWindowForSender(event.sender)
  if (!owner?.state.closePending) return
  const { window, state } = owner
  state.closePending = false
  if (saved) {
    state.closeApproved = true
    window.close()
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

ipcMain.handle('file:save-as', async (event, content: string) => {
  const owner = documentWindowForSender(event.sender)
  if (!owner) return { success: false, error: '文档窗口已关闭' }
  const result = await dialog.showSaveDialog(owner.window, {
    filters: [
      { name: 'Markdown 文件', extensions: ['md'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })
  if (!result.canceled && result.filePath) {
    try {
      await writeFile(result.filePath, content, 'utf-8')
      owner.state.hasDocument = true
      return { success: true, path: result.filePath }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
  return { success: false, error: '已取消' }
})

// 导出 HTML：直接写文件
ipcMain.handle('export:html', async (event, html: string) => {
  const owner = documentWindowForSender(event.sender)
  if (!owner) return { success: false, error: '文档窗口已关闭' }
  const result = await dialog.showSaveDialog(owner.window, {
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
type PdfExportOptions = { pageNumbers?: boolean; documentStyle?: 'standard' | 'homework' }

ipcMain.handle('export:pdf', async (event, html: string, opts: PdfExportOptions = {}) => {
  const owner = documentWindowForSender(event.sender)
  if (!owner) return { success: false, error: '文档窗口已关闭' }
  const result = await dialog.showSaveDialog(owner.window, {
    title: '导出 PDF',
    defaultPath: 'document.pdf',
    filters: [{ name: 'PDF 文件', extensions: ['pdf'] }]
  })
  if (result.canceled || !result.filePath) {
    return { success: false, error: '已取消' }
  }
  return await exportPdfToPath(result.filePath, html, opts)
})

async function exportPdfToPath(filePath: string, html: string, opts: PdfExportOptions) {
  let temporaryHtmlFile: Awaited<ReturnType<typeof createPdfHtmlFile>> | null = null

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
    temporaryHtmlFile = await createPdfHtmlFile(html)
    await printWin.loadFile(temporaryHtmlFile.path)
    await printWin.webContents.executeJavaScript(`(${waitForPrintResources.toString()})()`)

    const pdfData = await printWin.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      // Use a consistent paper text width on every page, without body padding.
      margins: opts.documentStyle === 'homework' ? {
        top: 0.9,
        bottom: 0.9,
        left: 0.95,
        right: 0.95
      } : {
        top: 0.55,
        bottom: 0.8,
        left: 0.55,
        right: 0.55
      },
      preferCSSPageSize: false
    })

    await writeFile(filePath, pdfData)
    // 可选：添加页码（每页底部居中"第 X 页 / 共 Y 页"）
    if (opts.pageNumbers) {
      await addPageNumbersToPdf(filePath, opts.documentStyle)
    }
    return { success: true, path: filePath }
  } catch (err: any) {
    return { success: false, error: err.message }
  } finally {
    printWin.destroy()
    await temporaryHtmlFile?.cleanup()
  }
}

// 给 PDF 每页底部居中追加页码（pdf-lib 后处理）
async function addPageNumbersToPdf(filePath: string, documentStyle?: 'standard' | 'homework') {
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
      color: documentStyle === 'homework' ? rgb(0.4, 0.4, 0.4) : rgb(0.55, 0.53, 0.5)
    })
  }
  const withNumbers = await pdf.save()
  await writeFile(filePath, withNumbers)
}

ipcMain.handle('app:get-version', () => app.getVersion())

function markdownPaths(args: string[], workingDirectory: string) {
  return args.filter(arg => !arg.startsWith('-') && /\.(?:md|markdown|mdown|mkd)$/i.test(arg))
    .map(path => resolve(workingDirectory, path))
}

// 先解析相对路径，再把启动参数传给已经运行的实例。
const startupFiles = markdownPaths(process.argv.slice(process.defaultApp ? 2 : 1), process.cwd())
const gotTheLock = app.requestSingleInstanceLock({ files: startupFiles })

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv, cwd, data) => {
    const files = (data as { files?: string[] } | undefined)?.files ?? markdownPaths(argv.slice(1), cwd)
    const window = activeDocumentWindow()
    if (files.length) {
      void openFilePaths(files, window)
    } else {
      focusWindow(window ?? createWindow())
    }
  })

  app.on('open-file', (event, filePath) => {
    event.preventDefault()
    if (app.isReady()) {
      void openFilePaths([filePath], activeDocumentWindow())
    } else {
      startupFiles.push(filePath)
    }
  })

  app.whenReady().then(() => {
    buildMenu()
    const window = createWindow()
    void openFilePaths([...new Set(startupFiles)], window)

    app.on('activate', () => {
      if (documentWindows.size === 0) {
        createWindow()
      }
    })

    // 自动更新：仅在打包后的正式版本生效（开发模式跳过）
    setupAutoUpdater()
  })
}

// 自动更新：状态实时推送到渲染进程（铃铛通知 + 下载进度）
function setupAutoUpdater() {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  // 向渲染进程推送更新状态
  const push = (event: UpdaterEvent) => {
    lastUpdaterEvent = event
    for (const [window, state] of documentWindows) {
      if (state.ready) window.webContents.send('updater:event', event)
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
    push({ type: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] update available:', info.version)
    push({ type: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', (info) => {
    console.log('[updater] no update:', info.version)
    push({ type: 'not-available', version: info.version })
  })

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent * 10) / 10
    const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1)
    console.log(`[updater] downloading ${percent}% (${mb(progress.transferred)}MB / ${mb(progress.total)}MB)`)
    push({
      type: 'progress',
      percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond
    })
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err.message)
    push({ type: 'error', message: err.message })
    scheduleRetry()
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[updater] downloaded:', info.version)
    push({ type: 'downloaded', version: info.version })
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

// 非 macOS 平台关闭所有窗口时退出
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
