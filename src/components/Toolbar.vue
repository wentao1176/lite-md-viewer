<template>
  <div class="toolbar">
    <div class="toolbar-left">
      <svg class="logo" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8M8 17h5" />
      </svg>
      <span class="app-title">lite-md-viewer</span>
    </div>
    <div class="toolbar-center">
      <button class="toolbar-btn" @click="$emit('open-file')" title="打开文件 (Ctrl+O)">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        打开
      </button>
      <button class="toolbar-btn" @click="$emit('save-file')" title="保存 (Ctrl+S)">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <path d="M17 21v-8H7v8M7 3v5h8" />
        </svg>
        保存
      </button>
      <span class="toolbar-divider"></span>
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
        :title="theme === 'dark' ? '切换到浅色主题' : '切换到暗色主题'"
      >
        <svg v-if="theme === 'dark'" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
        <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </button>

      <!-- 导出 PDF（显眼按钮 + 背景选择） -->
      <div class="pdf-export-wrap">
        <button
          class="toolbar-btn pdf-btn"
          @click.stop="pdfMenuOpen = !pdfMenuOpen"
          title="导出 PDF"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M8 13h8M8 17h8M8 21h8" />
          </svg>
          导出 PDF
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </button>
        <div v-if="pdfMenuOpen" class="pdf-menu" @click.stop>
          <div class="pdf-menu-title">选择 PDF 背景</div>
          <button
            class="pdf-menu-item"
            :class="{ selected: pdfBg === 'white' }"
            @click="emit('select-pdf-bg', 'white')"
          >
            <span class="pdf-swatch white"></span>纯白背景
            <svg v-if="pdfBg === 'white'" class="pdf-selected-mark" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--accent-color)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </button>
          <button
            class="pdf-menu-item"
            :class="{ selected: pdfBg === 'cream' }"
            @click="emit('select-pdf-bg', 'cream')"
          >
            <span class="pdf-swatch cream"></span>米白背景
            <svg v-if="pdfBg === 'cream'" class="pdf-selected-mark" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--accent-color)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </button>
          <div class="pdf-menu-divider"></div>
          <button class="pdf-menu-item" @click="emit('toggle-page-numbers')">
            <span class="pdf-check" :class="{ checked: pdfPageNumbers }">
              <svg v-if="pdfPageNumbers" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </span>
            显示页码
          </button>
          <div class="pdf-menu-divider"></div>
          <button class="pdf-menu-confirm" @click="emit('export-pdf')">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            确认导出 PDF
          </button>
        </div>
      </div>
      <slot name="right" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

defineProps<{
  filePath: string
  theme: 'light' | 'dark'
  showToc: boolean
  previewFullscreen: boolean
  fontFamily: string
  pdfPageNumbers: boolean
  pdfBg: 'white' | 'cream'
}>()

const emit = defineEmits<{
  'toggle-theme': []
  'toggle-toc': []
  'open-file': []
  'save-file': []
  'toggle-fullscreen': []
  'font-change': [value: string]
  'export-pdf': []
  'select-pdf-bg': [bg: 'white' | 'cream']
  'toggle-page-numbers': []
}>()

// 常用预览字体（正文）
const FONT_OPTIONS = [
  { label: '默认字体', value: '' },
  { label: '微软雅黑', value: "'Microsoft YaHei', 'PingFang SC', 'Helvetica Neue', sans-serif" },
  { label: '宋体', value: "'SimSun', 'Songti SC', 'Noto Serif SC', serif" },
  { label: '楷体', value: "'KaiTi', 'STKaiti', 'Noto Serif SC', serif" },
  { label: '黑体', value: "'SimHei', 'Heiti SC', 'Noto Sans SC', sans-serif" }
]

// PDF 背景选择菜单（仅打开/关闭；具体导出由"确认导出 PDF"触发）
const pdfMenuOpen = ref(false)
function closeMenu() {
  pdfMenuOpen.value = false
}
onMounted(() => document.addEventListener('click', closeMenu))
onUnmounted(() => document.removeEventListener('click', closeMenu))
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

.app-title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: var(--text-primary);
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
