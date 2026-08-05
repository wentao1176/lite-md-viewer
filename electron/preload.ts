import { contextBridge, ipcRenderer } from 'electron'

export interface ExportResult {
  success: boolean
  path?: string
  error?: string
}

// 更新事件（主进程 → 渲染进程）
export type UpdaterEvent =
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'not-available'; version: string }
  | { type: 'progress'; percent: number; transferred: number; total: number; bytesPerSecond: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }

export interface ElectronAPI {
  openFile: () => Promise<void>
  readFile: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>
  saveFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>
  saveFileAs: (content: string) => Promise<{ success: boolean; path?: string; error?: string }>
  exportHtml: (html: string) => Promise<ExportResult>
  exportPdf: (html: string) => Promise<ExportResult>
  getAppVersion: () => Promise<string>
  onFileLoaded: (callback: (data: { path: string; content: string }) => void) => void
  onMenuSave: (callback: () => void) => void
  onMenuExportHtml: (callback: () => void) => void
  onMenuExportPdf: (callback: () => void) => void
  onMenuToggleTheme: (callback: () => void) => void
  onMenuToggleToc: (callback: () => void) => void
  onFolderOpened: (callback: (folderPath: string) => void) => void
  onUpdaterEvent: (callback: (event: UpdaterEvent) => void) => void
  checkForUpdates: () => Promise<{ success: boolean; error?: string }>
  installUpdate: () => Promise<void>
  removeAllListeners: (channel: string) => void
}

const api: ElectronAPI = {
  openFile: () => ipcRenderer.invoke('file:open'),
  readFile: (path: string) => ipcRenderer.invoke('file:read', path),
  saveFile: (path: string, content: string) => ipcRenderer.invoke('file:save', path, content),
  saveFileAs: (content: string) => ipcRenderer.invoke('file:save-as', content),
  exportHtml: (html: string) => ipcRenderer.invoke('export:html', html),
  exportPdf: (html: string) => ipcRenderer.invoke('export:pdf', html),
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),

  onFileLoaded: (callback) => {
    ipcRenderer.on('file:loaded', (_event, data) => callback(data))
  },
  onMenuSave: (callback) => {
    ipcRenderer.on('menu:save', () => callback())
  },
  onMenuExportHtml: (callback) => {
    ipcRenderer.on('menu:export-html', () => callback())
  },
  onMenuExportPdf: (callback) => {
    ipcRenderer.on('menu:export-pdf', () => callback())
  },
  onMenuToggleTheme: (callback) => {
    ipcRenderer.on('menu:toggle-theme', () => callback())
  },
  onMenuToggleToc: (callback) => {
    ipcRenderer.on('menu:toggle-toc', () => callback())
  },
  onFolderOpened: (callback) => {
    ipcRenderer.on('folder:opened', (_event, folderPath) => callback(folderPath))
  },
  onUpdaterEvent: (callback) => {
    ipcRenderer.on('updater:event', (_event, data) => callback(data))
  },
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
