<template>
  <div class="app-wrapper" :class="[`theme-${theme}`, { 'toc-visible': showToc }]">
    <Toolbar
      :file-path="currentFilePath"
      :theme="theme"
      :show-toc="showToc"
      @toggle-theme="toggleTheme"
      @toggle-toc="toggleToc"
      @open-file="handleOpenFile"
      @save-file="handleSaveFile"
    />
    <!-- 右上角铃铛通知中心 -->
    <div class="bell-slot">
      <NotificationBell
        :updater="updaterState"
        :app-version="appVersion"
        @check-update="manualCheckUpdate"
        @install-update="installUpdateNow"
      />
    </div>
    <div class="main-area">
      <Sidebar
        v-if="showToc"
        :toc-items="tocItems"
        @navigate="handleTocNavigate"
      />
      <div class="editor-pane" :style="{ flex: editorRatio }">
        <div class="pane-header">
          <span>Markdown 源码</span>
          <span class="pane-hint" v-if="currentFilePath">{{ currentFilePath }}</span>
        </div>
        <Editor
          ref="editorRef"
          :content="sourceContent"
          :theme="theme"
          @update:content="handleContentChange"
          @cursor-line="handleCursorLine"
        />
      </div>
      <div class="divider" @mousedown="startResize"></div>
      <div class="preview-pane" :style="{ flex: previewRatio }">
        <div class="pane-header">
          <span>实时预览</span>
        </div>
        <Preview
          :html="renderedHtml"
          :theme="theme"
          @element-click="handlePreviewClick"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import Toolbar from './components/Toolbar.vue'
import Editor from './components/Editor.vue'
import Preview from './components/Preview.vue'
import Sidebar from './components/Sidebar.vue'
import { getRenderer, type MarkdownRenderer } from './engine/renderer'
import { buildExportHtml } from './engine/export'
import NotificationBell, { type UpdaterState } from './components/NotificationBell.vue'

const theme = ref<'light' | 'dark'>(loadTheme())
const showToc = ref(true)
const sourceContent = ref(DEFAULT_CONTENT)
const renderedHtml = ref('')
const currentFilePath = ref('')
const tocItems = ref<Array<{ level: number; text: string; id: string }>>([])

const editorRatio = ref(1)
const previewRatio = ref(1)
let renderer: MarkdownRenderer

// 更新通知状态（铃铛面板）
const appVersion = ref('')
const updaterState = ref<UpdaterState>({
  status: 'idle',
  version: '',
  percent: 0,
  transferred: 0,
  total: 0,
  bytesPerSecond: 0,
  message: ''
})
// Editor 组件通过 defineExpose 暴露 scrollToLine（预览 → 源码定位用）
const editorRef = ref<{ scrollToLine: (line: number) => void } | null>(null)

const DEFAULT_CONTENT = `# 欢迎使用 lite-md-viewer

轻量、高级、开箱即用的 **Markdown 预览器**。

---

## 功能展示

### 代码高亮

\`\`\`typescript
interface User {
  name: string
  age: number
}

function greet(user: User): string {
  return \`Hello, \${user.name}!\`
}
\`\`\`

\`\`\`rust
fn main() {
    println!("Hello, Rust!");

    let numbers: Vec<i32> = (1..=10).collect();
    let sum: i32 = numbers.iter().sum();
    println!("Sum: {}", sum);
}
\`\`\`

### 表格

| 功能 | 状态 | 优先级 |
|------|------|--------|
| 代码高亮 | 已完成 | P0 |
| LaTeX 公式 | 已完成 | P1 |
| Mermaid 图表 | 已完成 | P1 |
| 文件目录树 | 规划中 | P2 |

### 数学公式 (KaTeX)

行内公式：$E = mc^2$

块级公式：

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

### Mermaid 图表

\`\`\`mermaid
graph TD
    A[开始] --> B{判断条件}
    B -->|是| C[执行操作]
    B -->|否| D[跳过]
    C --> E[结束]
    D --> E
\`\`\`

---

## 快速上手

1. **打开文件**：菜单栏 → 文件 → 打开，或直接拖拽 \`.md\` 文件到窗口
2. **编辑预览**：左侧编辑 Markdown 源码，右侧实时预览
3. **切换主题**：\`Ctrl+T\` 或点击工具栏主题按钮
4. **导出文档**：菜单栏 → 文件 → 导出 HTML/PDF

---

> 提示：试试拖拽一个 \`.md\` 文件进来吧！
`

function loadTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem('lite-md-theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* ignore */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function saveTheme(t: 'light' | 'dark') {
  try {
    localStorage.setItem('lite-md-theme', t)
  } catch { /* ignore */ }
}

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  saveTheme(theme.value)
  updateRenderer()
  renderContent()
}

function toggleToc() {
  showToc.value = !showToc.value
}

async function handleOpenFile() {
  if (window.electronAPI) {
    await window.electronAPI.openFile()
  } else {
    // 浏览器 fallback
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.md,.markdown,.mdown,.mkd'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (file) {
        const text = await file.text()
        sourceContent.value = text
        currentFilePath.value = file.name
        renderContent()
      }
    }
    input.click()
  }
}

async function handleSaveFile() {
  if (window.electronAPI) {
    const result = await window.electronAPI.saveFileAs(sourceContent.value)
    if (result.success && result.path) {
      currentFilePath.value = result.path
    }
  } else {
    // 浏览器 fallback
    const blob = new Blob([sourceContent.value], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = currentFilePath.value || 'document.md'
    a.click()
    URL.revokeObjectURL(url)
  }
}

// 导出 HTML / PDF（核心实现）
async function exportDocument(kind: 'html' | 'pdf') {
  if (!window.electronAPI) {
    alert('导出功能仅在桌面版可用')
    return
  }

  try {
    // PDF 强制浅色主题渲染（纸张阅读自然，避免深色代码块/图表产生黑块）
    const wasDark = theme.value === 'dark'
    if (kind === 'pdf' && wasDark) {
      renderer.setTheme('light')
    }

    // 等待渲染完成
    const html = await renderer.render(sourceContent.value)

    if (kind === 'pdf' && wasDark) {
      renderer.setTheme('dark')
    }

    const docTitle = currentFilePath.value
      ? currentFilePath.value.split(/[\\/]/).pop()!.replace(/\.(md|markdown|mdown|mkd)$/i, '')
      : 'document'
    const exportTheme = kind === 'pdf' ? 'light' : theme.value
    const exportHtml = buildExportHtml(html, exportTheme, docTitle, {
      // 界面为深色时，Mermaid 图表是深色渲染的，需要在浅色 PDF 中反色
      mermaidDark: wasDark
    })

    const result = kind === 'html'
      ? await window.electronAPI.exportHtml(exportHtml)
      : await window.electronAPI.exportPdf(exportHtml)

    if (result.success) {
      // 导出成功后轻提示
      showToast(`已导出：${result.path}`)
    } else if (result.error !== '已取消') {
      showToast(`导出失败：${result.error}`, true)
    }
  } catch (err: any) {
    showToast(`导出出错：${err.message}`, true)
  }
}

// 轻量 toast 提示
function showToast(message: string, isError = false) {
  let toast = document.querySelector('.app-toast') as HTMLElement | null
  if (!toast) {
    toast = document.createElement('div')
    toast.className = 'app-toast'
    document.body.appendChild(toast)
  }
  toast.textContent = message
  toast.classList.toggle('app-toast-error', isError)
  toast.classList.add('app-toast-visible')
  setTimeout(() => toast?.classList.remove('app-toast-visible'), 3000)
}

function handleContentChange(newContent: string) {
  sourceContent.value = newContent
  debouncedRender()
}

let renderTimer: ReturnType<typeof setTimeout> | null = null
function debouncedRender() {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(() => renderContent(), 100)
}

async function renderContent() {
  try {
    const html = await renderer.render(sourceContent.value)
    renderedHtml.value = html
    tocItems.value = renderer.extractToc(sourceContent.value)
  } catch (err) {
    console.error('Render error:', err)
    renderedHtml.value = '<p class="render-error">渲染失败，请检查 Markdown 语法</p>'
  }
}

function updateRenderer() {
  renderer.setTheme(theme.value)
}

function startResize(e: MouseEvent) {
  const startX = e.clientX
  const editorStartWidth = (e.target as HTMLElement).previousElementSibling!.getBoundingClientRect().width
  const previewStartWidth = (e.target as HTMLElement).nextElementSibling!.getBoundingClientRect().width

  function onMove(ev: MouseEvent) {
    const dx = ev.clientX - startX
    const total = editorStartWidth + previewStartWidth
    const newEditor = Math.max(300, editorStartWidth + dx)
    const newPreview = Math.max(300, total - newEditor)
    editorRatio.value = newEditor / newPreview
    previewRatio.value = 1
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function handleTocNavigate(id: string) {
  // 在预览区滚动到对应标题
  const previewEl = document.querySelector('.preview-pane')
  const target = previewEl?.querySelector(`#${CSS.escape(id)}`)
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

// 更新事件处理（铃铛通知）
function handleUpdaterEvent(event: any) {
  switch (event.type) {
    case 'checking':
      updaterState.value.status = 'checking'
      break
    case 'available':
      updaterState.value = {
        status: 'available',
        version: event.version,
        percent: 0,
        transferred: 0,
        total: 0,
        bytesPerSecond: 0,
        message: ''
      }
      break
    case 'not-available':
      updaterState.value = { ...updaterState.value, status: 'idle', version: event.version }
      break
    case 'progress':
      updaterState.value = {
        status: 'downloading',
        version: updaterState.value.version,
        percent: event.percent,
        transferred: event.transferred,
        total: event.total,
        bytesPerSecond: event.bytesPerSecond,
        message: ''
      }
      break
    case 'downloaded':
      updaterState.value = {
        ...updaterState.value,
        status: 'downloaded',
        version: event.version,
        percent: 100
      }
      break
    case 'error':
      updaterState.value = {
        status: 'error',
        version: updaterState.value.version,
        percent: 0,
        transferred: 0,
        total: 0,
        bytesPerSecond: 0,
        message: event.message
      }
      break
  }
}

async function manualCheckUpdate() {
  updaterState.value.status = 'checking'
  if (!window.electronAPI) return
  const result = await window.electronAPI.checkForUpdates()
  if (!result.success && result.error === '开发模式') {
    showToast('开发模式不检查更新', true)
  }
}

async function installUpdateNow() {
  if (window.electronAPI) {
    await window.electronAPI.installUpdate()
  }
}

// 源码 → 预览：光标所在行对应预览元素高亮并滚动
function handleCursorLine(line: number) {
  const previewContainer = document.querySelector('.preview-pane .preview-container')
  if (!previewContainer) return
  const targets = previewContainer.querySelectorAll('[data-line]')
  let best: Element | null = null
  for (const t of targets) {
    const l = Number(t.getAttribute('data-line'))
    if (l <= line) best = t
    else break
  }
  if (best) {
    // 移除上一个高亮
    previewContainer.querySelectorAll('.source-sync-highlight').forEach((el) => {
      el.classList.remove('source-sync-highlight')
    })
    best.classList.add('source-sync-highlight')
    ;(best as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

// 预览 → 源码：点击预览元素，编辑器滚动到对应行
function handlePreviewClick(target: HTMLElement) {
  const line = Number(target.getAttribute('data-line'))
  if (line > 0) {
    editorRef.value?.scrollToLine(line)
  }
}

onMounted(async () => {
  renderer = getRenderer({
    enableHighlight: true,
    enableKatex: true,
    enableMermaid: true,
    enableToc: true,
    enableCopyButton: true,
    enableLinkBlank: true,
    enableLineNumbers: true,
    sanitize: true
  })
  renderer.setTheme(theme.value)

  // 监听 Electron IPC
  if (window.electronAPI) {
    window.electronAPI.onFileLoaded((data) => {
      sourceContent.value = data.content
      currentFilePath.value = data.path
      renderContent()
    })
    window.electronAPI.onMenuSave(() => handleSaveFile())
    window.electronAPI.onMenuExportHtml(() => exportDocument('html'))
    window.electronAPI.onMenuExportPdf(() => exportDocument('pdf'))
    window.electronAPI.onMenuToggleTheme(() => toggleTheme())
    window.electronAPI.onMenuToggleToc(() => toggleToc())

    // 更新事件 → 铃铛通知
    window.electronAPI.onUpdaterEvent((event: any) => {
      handleUpdaterEvent(event)
    })

    // 当前版本号
    window.electronAPI.getAppVersion().then((v) => {
      appVersion.value = v
    })
  }

  // 监听拖拽（浏览器环境）
  document.addEventListener('dragover', (e) => e.preventDefault())
  document.addEventListener('drop', async (e) => {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (file && (file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.name.endsWith('.mdown'))) {
      const text = await file.text()
      sourceContent.value = text
      currentFilePath.value = file.name
      renderContent()
    }
  })

  // 初始渲染
  await renderContent()

  // 延迟初始化 Mermaid
  nextTick(() => {
    initMermaid()
  })
})

onUnmounted(() => {
  if (renderTimer) clearTimeout(renderTimer)
})

function initMermaid() {
  // 使用动态 import 加载 Mermaid
  import('mermaid').then((mermaid) => {
    mermaid.default.initialize({
      startOnLoad: false,
      theme: theme.value === 'dark' ? 'dark' : 'neutral',
      securityLevel: 'strict'
    })

    // 渲染所有未处理的 Mermaid 图表
    const renderAll = async () => {
      await nextTick()
      const mermaidEls = document.querySelectorAll('.mermaid:not([data-processed])')
      for (const el of mermaidEls) {
        const id = (el as HTMLElement).dataset.mermaidId || `mermaid-${Math.random().toString(36).slice(2)}`
        try {
          const { svg } = await mermaid.default.render(id, el.textContent || '')
          const container = el.parentElement
          if (container) {
            container.innerHTML = svg
          }
          ;(el as HTMLElement).dataset.processed = 'true'
        } catch (err) {
          console.error('[mermaid] 图表渲染失败:', err)
          const container = el.parentElement
          if (container) {
            container.innerHTML =
              `<div class="mermaid-error">⚠️ 图表渲染失败，请检查 Mermaid 语法` +
              `<div class="mermaid-error-code">${escapeHtmlText(el.textContent || '')}</div></div>`
          }
        }
      }
    }

    // 监听渲染完成后处理 Mermaid 图表（immediate: 启动时已有内容也立即处理）
    watch(renderedHtml, renderAll, { immediate: true })
  }).catch((err) => {
    console.error('[mermaid] 加载失败:', err)
  })
}

// 简单 HTML 转义（Mermaid 错误信息展示用）
function escapeHtmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
</script>

<style>
/* CSS 变量 —— 柔和暖色系 */
:root {
  --bg-primary: #faf7f2;
  --bg-secondary: #f3eee7;
  --bg-tertiary: #ebe4db;
  --text-primary: #3d3a34;
  --text-secondary: #6f6a61;
  --text-tertiary: #a39c90;
  --border-color: #e5ded4;
  --accent-color: #8a7b6f;
  --accent-hover: #6f6257;
  --accent-soft: #efe9e2;
  --code-bg: #f5f1ea;
  --toolbar-bg: #faf7f2;
  --toolbar-border: #e5ded4;
  --divider-color: #e5ded4;
  --scrollbar-thumb: #d6cfc4;
  --scrollbar-track: transparent;
  --shadow-soft: 0 4px 20px rgba(80, 70, 60, 0.08);
  --shadow-hover: 0 6px 24px rgba(80, 70, 60, 0.14);
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
}

.theme-dark {
  --bg-primary: #2a2724;
  --bg-secondary: #322e2a;
  --bg-tertiary: #3a3530;
  --text-primary: #ddd6cd;
  --text-secondary: #a89f93;
  --text-tertiary: #7a7268;
  --border-color: #46403a;
  --accent-color: #c0b2a4;
  --accent-hover: #d4c9bd;
  --accent-soft: #3a3530;
  --code-bg: #37332e;
  --toolbar-bg: #2a2724;
  --toolbar-border: #46403a;
  --divider-color: #46403a;
  --scrollbar-thumb: #5a534b;
  --scrollbar-track: transparent;
  --shadow-soft: 0 4px 20px rgba(0, 0, 0, 0.25);
  --shadow-hover: 0 6px 24px rgba(0, 0, 0, 0.35);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', Roboto, 'Helvetica Neue', Arial, sans-serif;
  overflow: hidden;
  background: var(--bg-primary);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

/* 柔和滚动条 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 4px;
  min-height: 40px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--accent-color);
}

.app-wrapper {
  display: flex;
  flex-direction: column;
  height: 100vh;
  color: var(--text-primary);
  background: var(--bg-primary);
  transition: background-color 0.3s ease, color 0.3s ease;
  position: relative;
}

/* 铃铛通知容器（右上角，工具栏内） */
.bell-slot {
  position: absolute;
  top: 8px;
  right: 118px;
  z-index: 100;
}

.main-area {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.editor-pane,
.preview-pane {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 300px;
  overflow: hidden;
  background: var(--bg-primary);
}

.pane-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 18px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--text-secondary);
  user-select: none;
  position: relative;
  flex-shrink: 0;
}

/* 面板头部左侧的 accent 小竖条，强化板块辨识 */
.pane-header::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--accent-color);
  border-radius: 0 3px 3px 0;
  opacity: 0.7;
}

.pane-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  max-width: 50%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.divider {
  width: 8px;
  background: var(--bg-secondary);
  cursor: col-resize;
  flex-shrink: 0;
  position: relative;
  transition: background 0.2s ease;
  border-left: 1px solid var(--border-color);
  border-right: 1px solid var(--border-color);
}

/* 分隔条中间的细线，hover 时变为强调色 */
.divider::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  transform: translateX(-50%);
  width: 2px;
  background: var(--border-color);
  transition: background 0.2s ease;
}

.divider:hover {
  background: var(--bg-tertiary);
}

.divider:hover::before {
  background: var(--accent-color);
}

.render-error {
  color: #c96a5b;
  padding: 16px;
}

/* 导出结果 toast */
.app-toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translate(-50%, 20px);
  padding: 10px 20px;
  border-radius: 10px;
  background: var(--text-primary);
  color: var(--bg-primary);
  font-size: 13px;
  box-shadow: var(--shadow-hover);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease, transform 0.25s ease;
  z-index: 9999;
  max-width: 80vw;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-toast-visible {
  opacity: 1;
  transform: translate(-50%, 0);
}

.app-toast-error {
  background: #c96a5b;
  color: #fff;
}
</style>
