<template>
  <div class="preview-container" ref="previewEl" @click="handleClick">
    <div class="markdown-body" v-html="html"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = defineProps<{
  html: string
  theme: 'light' | 'dark'
}>()

const emit = defineEmits<{
  'element-click': [target: HTMLElement]
}>()

const previewEl = ref<HTMLElement>()

function handleClick(e: MouseEvent) {
  const target = e.target as HTMLElement

  // 源码定位：点击预览任意内容，发出最近的 data-line 元素
  if (!target.closest('.copy-btn') && !target.closest('.image-overlay') && !target.closest('a')) {
    const lineEl = target.closest('[data-line]')
    if (lineEl) {
      emit('element-click', lineEl as HTMLElement)
    }
  }

  // 复制按钮
  if (target.classList.contains('copy-btn') || target.closest('.copy-btn')) {
    const btn = target.classList.contains('copy-btn') ? target : target.closest('.copy-btn')!
    const code = decodeURIComponent((btn as HTMLElement).dataset.code || '')
    const textEl = btn.querySelector('.copy-btn-text') as HTMLElement | null
    const setText = (t: string) => { if (textEl) textEl.textContent = t }
    navigator.clipboard.writeText(code).then(() => {
      setText('已复制')
      setTimeout(() => setText('复制'), 1500)
    }).catch(() => {
      setText('失败')
      setTimeout(() => setText('复制'), 1500)
    })
  }

  // 图片放大
  if (target.classList.contains('zoomable') && target.tagName === 'IMG') {
    const img = target as HTMLImageElement
    showImageOverlay(img.src, img.alt)
  }
}

function showImageOverlay(src: string, alt: string) {
  const overlay = document.createElement('div')
  overlay.className = 'image-overlay'
  overlay.innerHTML = `
    <div class="image-overlay-bg"></div>
    <img src="${src}" alt="${alt}" class="image-overlay-img" />
    <button class="image-overlay-close">✕</button>
  `
  overlay.querySelector('.image-overlay-bg')!.addEventListener('click', () => overlay.remove())
  overlay.querySelector('.image-overlay-close')!.addEventListener('click', () => overlay.remove())
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') overlay.remove()
  })
  document.body.appendChild(overlay)
}

watch(() => props.html, async () => {
  await nextTick()
  // 滚动到顶部
  if (previewEl.value) {
    previewEl.value.scrollTop = 0
  }
})
</script>

<style scoped>
.preview-container {
  flex: 1;
  overflow: auto;
  padding: 28px 36px;
}

/* Markdown 内容样式 */
.markdown-body {
  max-width: 860px;
  margin: 0 auto;
  font-size: 15px;
  line-height: 1.8;
  color: var(--text-primary);
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  margin-top: 1.6em;
  margin-bottom: 0.6em;
  font-weight: 600;
  line-height: 1.4;
  color: var(--text-primary);
  scroll-margin-top: 20px;
}

.markdown-body :deep(h1) { font-size: 1.9em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.35em; }
.markdown-body :deep(h2) { font-size: 1.45em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
.markdown-body :deep(h3) { font-size: 1.22em; }
.markdown-body :deep(h4) { font-size: 1.1em; }

.markdown-body :deep(p) {
  margin: 0.9em 0;
}

.markdown-body :deep(a) {
  color: var(--accent-color);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s ease;
}

.markdown-body :deep(a:hover) {
  border-bottom-color: var(--accent-color);
  text-decoration: none;
}

.markdown-body :deep(blockquote) {
  margin: 1.2em 0;
  padding: 0.8em 1.2em;
  border-left: 3px solid var(--accent-color);
  background: var(--accent-soft);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  color: var(--text-secondary);
}

.markdown-body :deep(code):not(pre code) {
  padding: 2px 7px;
  font-size: 0.88em;
  background: var(--accent-soft);
  border-radius: 6px;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
}

.markdown-body :deep(table) {
  width: 100%;
  margin: 1.2em 0;
  border-collapse: separate;
  border-spacing: 0;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-soft);
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 11px 18px;
  border: 1px solid var(--border-color);
  text-align: left;
}

.markdown-body :deep(th) {
  background: var(--bg-secondary);
  font-weight: 600;
}

.markdown-body :deep(tr:nth-child(even)) {
  background: var(--bg-secondary);
}

.markdown-body :deep(tr:hover) {
  background: var(--accent-soft);
  transition: background 0.15s ease;
}

.markdown-body :deep(hr) {
  margin: 2.2em 0;
  border: none;
  border-top: 1px solid var(--border-color);
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 1.6em;
  margin: 0.6em 0;
}

.markdown-body :deep(li) {
  margin: 0.35em 0;
}

.markdown-body :deep(input[type="checkbox"]) {
  margin-right: 0.5em;
  accent-color: var(--accent-color);
}

/* 代码块包装 */
.markdown-body :deep(.code-block-wrapper) {
  margin: 1.2em 0;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-soft);
  background: var(--code-bg);
}

.markdown-body :deep(.code-block-header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 14px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  font-size: 12px;
}

.markdown-body :deep(.code-lang) {
  color: var(--text-secondary);
  font-weight: 500;
  text-transform: uppercase;
  font-size: 10.5px;
  letter-spacing: 0.5px;
}

.markdown-body :deep(.copy-btn) {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border: 1px solid var(--border-color);
  border-radius: 7px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.markdown-body :deep(.copy-btn svg) {
  flex-shrink: 0;
}

.markdown-body :deep(.copy-btn:hover) {
  background: var(--accent-color);
  color: var(--bg-primary);
  border-color: var(--accent-color);
  transform: translateY(-1px);
  box-shadow: var(--shadow-soft);
}

.markdown-body :deep(.code-block-body) {
  display: flex;
}

.markdown-body :deep(.line-numbers) {
  display: flex;
  flex-direction: column;
  padding: 13px 10px 13px 14px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  color: var(--text-tertiary);
  font-size: 13px;
  line-height: 1.7;
  user-select: none;
  text-align: right;
  min-width: 44px;
}

.markdown-body :deep(.line-numbers span) {
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 12.5px;
}

.markdown-body :deep(.shiki-target),
.markdown-body :deep(.shiki-pending),
.markdown-body :deep(pre:not(.mermaid)) {
  flex: 1;
  margin: 0;
  padding: 13px 18px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.7;
  background: var(--code-bg) !important;
}

.markdown-body :deep(.shiki),
.markdown-body :deep(pre.shiki) {
  padding: 13px 18px !important;
  border-radius: 0 !important;
}

.markdown-body :deep(pre code) {
  background: none !important;
  padding: 0 !important;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
}

/* KaTeX */
.markdown-body :deep(.katex-block) {
  margin: 1.2em 0;
  text-align: center;
  overflow-x: auto;
  padding: 8px 0;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.markdown-body :deep(.katex-inline) {
  display: inline;
}

.markdown-body :deep(.katex-error) {
  color: #c96a5b;
  padding: 4px;
  background: rgba(201, 106, 91, 0.08);
  border-radius: 6px;
}

/* Mermaid */
.markdown-body :deep(.mermaid-container) {
  margin: 1.2em 0;
  padding: 20px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  text-align: center;
  overflow-x: auto;
  box-shadow: var(--shadow-soft);
}

.markdown-body :deep(.mermaid-container svg) {
  max-width: 100%;
}

/* 图片 */
.markdown-body :deep(img.md-image) {
  max-width: 100%;
  border-radius: var(--radius-md);
  cursor: zoom-in;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: var(--shadow-soft);
}

.markdown-body :deep(img.md-image:hover) {
  transform: scale(1.01);
  box-shadow: var(--shadow-hover);
}
</style>

<!-- 图片遮罩层（全局） -->
<style>
.image-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 源码→预览定位的柔和高亮 */
.source-sync-highlight {
  border-radius: 8px;
  animation: source-sync-flash 1.4s ease-out;
}

@keyframes source-sync-flash {
  0% {
    box-shadow: 0 0 0 3px var(--accent-color);
    background: var(--accent-soft);
  }
  100% {
    box-shadow: 0 0 0 0 transparent;
    background: transparent;
  }
}

.image-overlay-bg {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  cursor: zoom-out;
}

.image-overlay-img {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  z-index: 1;
}

.image-overlay-close {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  z-index: 2;
  transition: background 0.15s;
}

.image-overlay-close:hover {
  background: rgba(255, 255, 255, 0.25);
}
</style>
