<template>
  <div class="export-overlay" @click.self="$emit('close')">
    <div class="export-dialog">
      <div class="dialog-title">导出文档</div>

      <!-- 输出形式 -->
      <div class="dialog-section">
        <div class="section-label">输出形式</div>
        <div class="option-row">
          <button
            class="option-btn"
            :class="{ selected: format === 'pdf' }"
            @click="format = 'pdf'"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M8 13h8M8 17h8M8 21h8" />
            </svg>
            PDF 文档
          </button>
          <button
            class="option-btn"
            :class="{ selected: format === 'html' }"
            @click="format = 'html'"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            HTML 文件
          </button>
        </div>
      </div>

      <!-- 背景（仅 PDF） -->
      <div v-if="format === 'pdf'" class="dialog-section">
        <div class="section-label">背景颜色</div>
        <div class="option-row">
          <button
            class="option-btn"
            :class="{ selected: bg === 'cream' }"
            @click="bg = 'cream'"
          >
            米白
          </button>
          <button
            class="option-btn"
            :class="{ selected: bg === 'white' }"
            @click="bg = 'white'"
          >
            纯白
          </button>
        </div>
        <div class="section-hint">纯白时板块、强调色使用主题蓝</div>
      </div>

      <!-- 页码（仅 PDF） -->
      <div v-if="format === 'pdf'" class="dialog-section">
        <label class="switch-row">
          <span>显示页码</span>
          <button
            class="switch"
            :class="{ on: pageNumbers }"
            @click="pageNumbers = !pageNumbers"
          >
            <span class="switch-knob"></span>
          </button>
        </label>
      </div>

      <div class="dialog-actions">
        <button class="dialog-btn cancel" @click="$emit('close')">取消</button>
        <button class="dialog-btn confirm" @click="doExport">开始导出</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  close: []
  confirm: [opts: { format: 'pdf' | 'html'; bg: 'white' | 'cream'; pageNumbers: boolean }]
}>()

const format = ref<'pdf' | 'html'>('pdf')
const bg = ref<'white' | 'cream'>('cream')
const pageNumbers = ref(false)

function doExport() {
  emit('confirm', { format: format.value, bg: bg.value, pageNumbers: pageNumbers.value })
}
</script>

<style scoped>
.export-overlay {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  -webkit-app-region: no-drag;
}

.export-dialog {
  width: 380px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  box-shadow: var(--shadow-hover);
  padding: 20px;
  animation: dialog-in 0.2s ease;
}

@keyframes dialog-in {
  from { opacity: 0; transform: scale(0.96) translateY(-8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.dialog-section {
  margin-bottom: 16px;
}

.section-label {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 8px;
}

.option-row {
  display: flex;
  gap: 10px;
}

.option-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.option-btn:hover {
  border-color: var(--accent-color);
  color: var(--text-primary);
}

.option-btn.selected {
  border-color: var(--accent-color);
  background: var(--accent-soft);
  color: var(--accent-color);
  font-weight: 600;
}

.section-hint {
  margin-top: 6px;
  font-size: 11.5px;
  color: var(--text-tertiary);
}

.switch-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
}

.switch {
  position: relative;
  width: 40px;
  height: 22px;
  border: none;
  border-radius: 11px;
  background: var(--bg-tertiary);
  cursor: pointer;
  transition: background 0.2s ease;
}

.switch.on {
  background: var(--accent-color);
}

.switch-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: left 0.2s ease;
}

.switch.on .switch-knob {
  left: 20px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.dialog-btn {
  padding: 9px 18px;
  border: 1px solid var(--border-color);
  border-radius: 9px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dialog-btn.cancel {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.dialog-btn.cancel:hover {
  background: var(--bg-tertiary);
}

.dialog-btn.confirm {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: var(--bg-primary);
  font-weight: 600;
}

.dialog-btn.confirm:hover {
  background: var(--accent-hover);
}
</style>
