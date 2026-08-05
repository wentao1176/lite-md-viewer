/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ElectronAPI {
  openFile: () => Promise<void>
  readFile: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>
  saveFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>
  saveFileAs: (content: string) => Promise<{ success: boolean; path?: string; error?: string }>
  exportHtml: (html: string) => Promise<{ success: boolean; path?: string; error?: string }>
  exportPdf: (html: string, opts?: { pageNumbers?: boolean }) => Promise<{ success: boolean; path?: string; error?: string }>
  getAppVersion: () => Promise<string>
  onFileLoaded: (callback: (data: { path: string; content: string }) => void) => void
  onMenuSave: (callback: () => void) => void
  onMenuExportHtml: (callback: () => void) => void
  onMenuExportPdf: (callback: () => void) => void
  onMenuToggleTheme: (callback: () => void) => void
  onMenuToggleToc: (callback: () => void) => void
  onFolderOpened: (callback: (folderPath: string) => void) => void
  onUpdaterEvent: (callback: (event: any) => void) => void
  checkForUpdates: () => Promise<{ success: boolean; error?: string }>
  installUpdate: () => Promise<void>
  removeAllListeners: (channel: string) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
