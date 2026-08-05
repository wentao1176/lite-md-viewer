<template>
  <div class="toolbar">
    <div class="toolbar-center">
      <button class="toolbar-btn icon-btn" @click="$emit('open-file')" title="打开文件 (Ctrl+O)">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      </button>
      <button class="toolbar-btn icon-btn" @click="$emit('save-file')" title="保存 (Ctrl+S)">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <path d="M17 21v-8H7v8M7 3v5h8" />
        </svg>
      </button>
      <span class="toolbar-divider"></span>
      <button class="toolbar-btn icon-btn" @click="$emit('undo')" title="撤销 (Ctrl+Z)">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
        </svg>
      </button>
      <button class="toolbar-btn icon-btn" @click="$emit('redo')" title="重做 (Ctrl+Y)">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 7v6h-6" />
          <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
        </svg>
      </button>
      <span class="toolbar-divider"></span>
      <div class="zoom-control" title="预览缩放（Ctrl+滚轮）">
        <button class="toolbar-btn icon-btn" @click="$emit('zoom-out')" title="缩小">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
        <button class="zoom-value" @click="$emit('zoom-reset')" :title="previewZoom === 100 ? '100%' : '重置为 100%'">{{ previewZoom }}%</button>
        <button class="toolbar-btn icon-btn" @click="$emit('zoom-in')" title="放大">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
      </div>
      <select class="font-select" :value="fontFamily" @change="$emit('font-change', ($event.target as HTMLSelectElement).value)" title="预览字体">
        <option v-for="f in FONT_OPTIONS" :key="f.value" :value="f.value">{{ f.label }}</option>
      </select>
    </div>
    <div class="toolbar-right">
      <button
        class="toolbar-btn icon-btn"
        :class="{ active: previewFullscreen }"
        @click="$emit('toggle-fullscreen')"
        :title="previewFullscreen ? '退出全屏 (Esc)' : '预览全屏'"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path v-if="!previewFullscreen" d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          <path v-else d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
        </svg>
      </button>
      <button
        class="toolbar-btn icon-btn"
        :class="{ active: showToc }"
        @click="$emit('toggle-toc')"
        title="切换目录"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      </button>
      <button
        class="toolbar-btn icon-btn"
        @click="$emit('toggle-theme')"
        :title="theme === 'dark' ? '切换到米白主题' : theme === 'white' ? '切换到暗色主题' : '切换到纯白主题'"
      >
        <svg v-if="theme === 'dark'" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <svg v-else-if="theme === 'white'" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5" fill="currentColor" />
          <circle cx="12" cy="12" r="9" />
        </svg>
        <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      </button>

      <!-- 导出（打开导出对话框：输出形式/背景/页码） -->
      <button
        class="toolbar-btn pdf-btn"
        @click="$emit('open-export')"
        title="导出文档"
      >
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8M8 17h8M8 21h8" />
        </svg>
        导出
      </button>
      <slot name="right" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  filePath: string
  theme: 'light' | 'dark' | 'white'
  showToc: boolean
  previewFullscreen: boolean
  fontFamily: string
  previewZoom: number
}>()

const emit = defineEmits<{
  'toggle-theme': []
  'toggle-toc': []
  'open-file': []
  'save-file': []
  'undo': []
  'redo': []
  'toggle-fullscreen': []
  'font-change': [value: string]
  'open-export': []
  'zoom-in': []
  'zoom-out': []
  'zoom-reset': []
}>()

// 常用预览字体（正文）：英文字体优先 + 中文字体配对，保证英文显示美观
const FONT_OPTIONS = [
  { label: '默认字体', value: '' },
  { label: '微软雅黑', value: "'Times New Roman', 'Georgia', 'Segoe UI', 'Inter', 'Roboto', 'Microsoft YaHei', 'PingFang SC', sans-serif" },
  { label: '宋体', value: "'Times New Roman', 'Georgia', 'SimSun', 'Songti SC', serif" },
  { label: '楷体', value: "'Times New Roman', 'Georgia', 'KaiTi', 'STKaiti', 'Noto Serif SC', serif" },
  { label: '黑体', value: "'Times New Roman', 'Georgia', 'Segoe UI', 'Helvetica Neue', 'Arial', 'SimHei', 'Heiti SC', sans-serif" }
]
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 16px;
  background: var(--toolbar-bg);
  border-bottom: 1px solid var(--toolbar-border);
  box-shadow: 0 1px 8px rgba(80, 70, 60, 0.06);
  user-select: none;
  -webkit-app-region: drag;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}

.toolbar-left,
.toolbar-center,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.logo {
  color: var(--accent-color);
  flex-shrink: 0;
}

.toolbar-left .logo {
  display: block;
  color: var(--text-secondary);
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(80, 70, 60, 0.04);
}

.toolbar-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent-color);
  transform: translateY(-1px);
  box-shadow: var(--shadow-soft);
}

.toolbar-btn:active {
  transform: translateY(0);
  box-shadow: none;
}

.toolbar-btn.active {
  background: var(--accent-color);
  color: var(--bg-primary);
  border-color: var(--accent-color);
}

.icon-btn {
  padding: 6px 10px;
}

.icon-btn svg {
  display: block;
}

.toolbar-divider {
  width: 1px;
  height: 22px;
  background: var(--toolbar-border);
  margin: 0 10px;
}

/* 字体选择 */
.font-select {
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  outline: none;
  -webkit-app-region: no-drag;
  max-width: 130px;
}

.font-select:hover {
  border-color: var(--accent-color);
}

/* 预览缩放控件 */
.zoom-control {
  display: flex;
  align-items: center;
  gap: 2px;
}

.zoom-control .icon-btn {
  padding: 5px 7px;
}

.zoom-value {
  min-width: 52px;
  padding: 4px 6px;
  border: 1px solid var(--border-color);
  border-radius: 7px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.zoom-value:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

/* 导出 PDF 按钮 + 背景菜单 */
.pdf-export-wrap {
  position: relative;
  margin-left: 6px;
  -webkit-app-region: no-drag;
}

.pdf-btn {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: var(--bg-primary);
  font-weight: 600;
  padding: 6px 14px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.pdf-btn:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
  color: var(--bg-primary);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.pdf-menu {
  position: absolute;
  top: 40px;
  right: 0;
  width: 168px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  box-shadow: var(--shadow-hover);
  padding: 6px;
  z-index: 200;
  animation: pdf-menu-in 0.18s ease;
}

@keyframes pdf-menu-in {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}

.pdf-menu-title {
  padding: 6px 10px 8px;
  font-size: 11.5px;
  color: var(--text-tertiary);
}

.pdf-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 7px;
  background: none;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}

.pdf-menu-item:hover {
  background: var(--bg-tertiary);
}

.pdf-menu-item.selected {
  background: var(--accent-soft);
}

.pdf-selected-mark {
  margin-left: auto;
}

.pdf-menu-confirm {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 9px 10px;
  border: none;
  border-radius: 8px;
  background: var(--accent-color);
  color: var(--bg-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}

.pdf-menu-confirm:hover {
  background: var(--accent-hover);
}

.pdf-swatch {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  flex-shrink: 0;
}

.pdf-swatch.white {
  background: #ffffff;
}

.pdf-swatch.cream {
  background: #faf7f2;
}

.pdf-menu-divider {
  height: 1px;
  background: var(--border-color);
  margin: 5px 8px;
}

.pdf-check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  border: 1.5px solid var(--text-tertiary);
  border-radius: 4px;
  flex-shrink: 0;
  color: var(--bg-primary);
}

.pdf-check.checked {
  background: var(--accent-color);
  border-color: var(--accent-color);
}
</style>
