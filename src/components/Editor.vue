<template>
  <div ref="editorContainer" class="editor-container" :aria-busy="readOnly || undefined"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { Compartment, EditorState, Transaction } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { history, historyKeymap, isolateHistory, undo, redo, defaultKeymap } from '@codemirror/commands'
import type { ImageInsertionSuccess, ImageSelection } from '../shared/image-insertion'

const props = defineProps<{
  content: string
  theme: 'light' | 'dark'
  readOnly?: boolean
  documentId?: number
}>()

const emit = defineEmits<{
  'update:content': [value: string]
  'cursor-line': [line: number]
  'paste-images': [files: File[], selection: ImageSelection]
}>()

const editorContainer = ref<HTMLElement>()
let editorView: EditorView | null = null
let lastCursorLine = -1
let applyingContent = false
const editing = new Compartment()

function createEditorState(content: string, cursor = 0) {
  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged && !applyingContent) {
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
    history(),
    editing.of([EditorState.readOnly.of(!!props.readOnly), EditorView.editable.of(!props.readOnly)]),
    keymap.of(defaultKeymap),
    keymap.of(historyKeymap),
    updateListener,
    EditorView.domEventHandlers({
      paste(event, view) {
        let files = Array.from(event.clipboardData?.files || []).filter(file => file.type.startsWith('image/'))
        if (!files.length) {
          files = Array.from(event.clipboardData?.items || [])
            .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
            .map(item => item.getAsFile())
            .filter((file): file is File => file !== null)
        }
        if (!files.length) return false
        event.preventDefault()
        if (!props.readOnly) {
          const { from, to } = view.state.selection.main
          emit('paste-images', files, { from, to })
        }
        return true
      }
    }),
    EditorView.lineWrapping,
    EditorState.tabSize.of(2)
  ]

  return EditorState.create({
    doc: content,
    selection: { anchor: Math.min(cursor, content.length) },
    extensions
  })
}

function createEditor() {
  if (!editorContainer.value) return
  editorView = new EditorView({
    state: createEditorState(props.content),
    parent: editorContainer.value
  })
}

function updateTheme() {
  // 主题颜色全部由 CSS 变量驱动，切换 .theme-dark 类后自动生效，无需重建编辑器
}

watch([() => props.content, () => props.documentId], ([newContent, documentId], [, previousId]) => {
  if (editorView && (documentId !== previousId || newContent !== editorView.state.doc.toString())) {
    // 文件切换和外部同步建立新的基线，不产生编辑事件或可撤销的整篇替换。
    lastCursorLine = -1
    editorView.setState(createEditorState(newContent))
  }
})

watch(() => props.readOnly, (readOnly) => {
  editorView?.dispatch({
    effects: editing.reconfigure([EditorState.readOnly.of(!!readOnly), EditorView.editable.of(!readOnly)])
  })
}, { flush: 'sync' })

watch(() => props.theme, () => {
  nextTick(() => updateTheme())
})

onMounted(createEditor)

onUnmounted(() => {
  editorView?.destroy()
  editorView = null
})

function applyImageInsertion(result: ImageInsertionSuccess) {
  if (!editorView) return
  applyingContent = true
  try {
    if (editorView.state.doc.toString() !== result.baseContent) {
      // 资源搬迁后的路径是新的基线；撤销图片时不能恢复已失效的旧路径。
      lastCursorLine = -1
      editorView.setState(createEditorState(result.baseContent, result.change.from))
    }
    editorView.dispatch({
      changes: result.change,
      selection: { anchor: result.cursor },
      annotations: [Transaction.userEvent.of('input.paste'), isolateHistory.of('full')],
      effects: EditorView.scrollIntoView(result.cursor, { y: 'nearest' })
    })
  } finally {
    applyingContent = false
  }
}

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
  getSelection: (): ImageSelection => {
    const selection = editorView?.state.selection.main
    return selection ? { from: selection.from, to: selection.to } : { from: props.content.length, to: props.content.length }
  },
  applyImageInsertion,
  focus: () => editorView?.focus(),
  scrollToLine,
  undo: () => {
    if (editorView && !props.readOnly) undo(editorView)
  },
  redo: () => {
    if (editorView && !props.readOnly) redo(editorView)
  }
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
  /* 中文楷体 + 英文 Times New Roman（衬线配对，数字标准体不会 0 像 o） */
  font-family: 'Times New Roman', 'Georgia', 'KaiTi', 'STKaiti', '楷体', serif;
  font-size: 14px;
  line-height: 1.8;
  background: var(--bg-primary);
  color: var(--text-primary);
}

/* CodeMirror 内部 .cm-content 自带 monospace 默认（运行时注入样式，需 !important 强制覆盖） */
.editor-container :deep(.cm-content) {
  font-family: 'Times New Roman', 'Georgia', 'KaiTi', 'STKaiti', '楷体', serif !important;
}

.editor-container :deep(.cm-gutters) {
  font-family: 'Times New Roman', 'Georgia', 'KaiTi', 'STKaiti', '楷体', serif !important;
}

.editor-container :deep(.cm-scroller) {
  overflow: auto;
}

.editor-container :deep(.cm-gutters) {
  border-right: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-tertiary);
}

.editor-container :deep(.cm-lineNumbers .cm-gutterElement) {
  font-size: 12px;
  line-height: 1.7;
  padding-left: 10px;
  padding-right: 14px;
  opacity: 0.85;
  transition: opacity 0.2s ease;
}

.editor-container :deep(.cm-lineNumbers .cm-gutterElement:hover) {
  opacity: 1;
  color: var(--accent-color);
}

.editor-container :deep(.cm-activeLineGutter) {
  background: var(--bg-secondary);
  opacity: 1;
  color: var(--accent-color) !important;
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
