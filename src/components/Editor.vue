<template>
  <div ref="editorContainer" class="editor-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { defaultKeymap } from '@codemirror/commands'

const props = defineProps<{
  content: string
  theme: 'light' | 'dark'
}>()

const emit = defineEmits<{
  'update:content': [value: string]
  'cursor-line': [line: number]
}>()

const editorContainer = ref<HTMLElement>()
let editorView: EditorView | null = null
let lastCursorLine = -1

function createEditor() {
  if (!editorContainer.value) return

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      const newContent = update.state.doc.toString()
      emit('update:content', newContent)
    }
    // 光标所在行变化时通知外部（用于源码→预览定位）
    if (update.selectionSet) {
      const head = update.state.selection.main.head
      const line = update.state.doc.lineAt(head).number
      if (line !== lastCursorLine) {
        lastCursorLine = line
        emit('cursor-line', line)
      }
    }
  })

  const extensions = [
    markdown({ base: markdownLanguage }),
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    keymap.of(defaultKeymap),
    updateListener,
    EditorView.lineWrapping,
    EditorState.tabSize.of(2)
  ]

  editorView = new EditorView({
    state: EditorState.create({
      doc: props.content,
      extensions
    }),
    parent: editorContainer.value
  })
}

function updateTheme() {
  // 主题颜色全部由 CSS 变量驱动，切换 .theme-dark 类后自动生效，无需重建编辑器
}

watch(() => props.content, (newContent) => {
  if (editorView && newContent !== editorView.state.doc.toString()) {
    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: newContent
      }
    })
  }
})

watch(() => props.theme, () => {
  nextTick(() => updateTheme())
})

onMounted(() => {
  nextTick(() => createEditor())
})

onUnmounted(() => {
  editorView?.destroy()
})

// 滚动编辑器到指定行（1 基），供预览→源码定位使用
function scrollToLine(line: number) {
  if (!editorView) return
  const doc = editorView.state.doc
  const targetLine = Math.min(Math.max(line, 1), doc.lines)
  const pos = doc.line(targetLine).from
  editorView.dispatch({
    effects: EditorView.scrollIntoView(pos, { y: 'center' })
  })
  // 同时把光标移到该行，保证视觉一致
  editorView.dispatch({
    selection: { anchor: pos },
    effects: EditorView.scrollIntoView(pos, { y: 'center' })
  })
}

defineExpose({
  getContent: () => editorView?.state.doc.toString() || '',
  scrollToLine
})
</script>

<style scoped>
.editor-container {
  flex: 1;
  overflow: auto;
  background: var(--bg-primary);
}

.editor-container :deep(.cm-editor) {
  height: 100%;
  font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
  font-size: 14px;
  line-height: 1.7;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.editor-container :deep(.cm-scroller) {
  overflow: auto;
}

.editor-container :deep(.cm-gutters) {
  border-right: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
}

.editor-container :deep(.cm-activeLineGutter) {
  background: var(--bg-tertiary);
}

.editor-container :deep(.cm-activeLine) {
  background: var(--bg-secondary);
}

.editor-container :deep(.cm-cursor) {
  border-left-color: var(--accent-color);
}

.editor-container :deep(.cm-selectionBackground) {
  background: var(--accent-soft) !important;
}

/* 暗色模式语法高亮（柔和暖色调） */
.theme-dark .editor-container :deep(.cm-content) {
  color: #d8d1c8;
}

.theme-dark .editor-container :deep(.cm-keyword) {
  color: #c9a87f;
}

.theme-dark .editor-container :deep(.cm-atom),
.theme-dark .editor-container :deep(.cm-number),
.theme-dark .editor-container :deep(.cm-bool) {
  color: #b8b094;
}

.theme-dark .editor-container :deep(.cm-string),
.theme-dark .editor-container :deep(.cm-string-2) {
  color: #a3b899;
}

.theme-dark .editor-container :deep(.cm-variable),
.theme-dark .editor-container :deep(.cm-variable-2),
.theme-dark .editor-container :deep(.cm-variable-3) {
  color: #c8c0b4;
}

.theme-dark .editor-container :deep(.cm-comment) {
  color: #8d857a;
  font-style: italic;
}

.theme-dark .editor-container :deep(.cm-type),
.theme-dark .editor-container :deep(.cm-class-name) {
  color: #b3a7c9;
}

.theme-dark .editor-container :deep(.cm-property),
.theme-dark .editor-container :deep(.cm-attribute) {
  color: #b3bcb0;
}

.theme-dark .editor-container :deep(.cm-heading) {
  color: #d9c39b;
  font-weight: 600;
}

.theme-dark .editor-container :deep(.cm-quote) {
  color: #a8b0a0;
  font-style: italic;
}

.theme-dark .editor-container :deep(.cm-link),
.theme-dark .editor-container :deep(.cm-url) {
  color: #a3b899;
  text-decoration: underline;
}

.theme-dark .editor-container :deep(.cm-em) {
  font-style: italic;
}

.theme-dark .editor-container :deep(.cm-strong) {
  font-weight: 700;
}

/* 浅色模式语法高亮（柔和暖色调） */
.editor-container :deep(.cm-keyword) {
  color: #a06b3f;
}

.editor-container :deep(.cm-atom),
.editor-container :deep(.cm-number),
.editor-container :deep(.cm-bool) {
  color: #8a8468;
}

.editor-container :deep(.cm-string),
.editor-container :deep(.cm-string-2) {
  color: #7d8f72;
}

.editor-container :deep(.cm-comment) {
  color: #a49c8f;
  font-style: italic;
}

.editor-container :deep(.cm-type),
.editor-container :deep(.cm-class-name) {
  color: #8577a0;
}

.editor-container :deep(.cm-heading) {
  color: #a88a55;
  font-weight: 600;
}

.editor-container :deep(.cm-link),
.editor-container :deep(.cm-url) {
  color: #7d8f72;
  text-decoration: underline;
}
</style>
