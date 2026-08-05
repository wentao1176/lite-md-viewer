<template>
  <div class="notification-bell">
    <button class="bell-btn" @click="toggle" :title="'通知（' + bellHint + '）'">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      <span v-if="hasUnread" class="bell-dot"></span>
    </button>

    <div v-if="open" class="notification-panel">
      <div class="panel-header">
        <span>通知</span>
        <button class="panel-close" @click="open = false">✕</button>
      </div>

      <div class="panel-body">
        <!-- 更新通知卡片 -->
        <div class="notice-card">
          <div class="notice-title">🔄 软件更新</div>

          <div v-if="updater.status === 'checking'" class="notice-body">
            <div class="checking-row">
              <span class="spinner"></span>
              <span>正在检查更新...</span>
            </div>
          </div>

          <div v-else-if="updater.status === 'available'" class="notice-body">
            <div class="update-avail">发现新版本 <b>v{{ updater.version }}</b></div>
            <div class="download-hint">正在后台下载...</div>
          </div>

          <div v-else-if="updater.status === 'downloading'" class="notice-body">
            <div class="update-avail">正在下载 v{{ updater.version }}</div>
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: updater.percent + '%' }"></div>
            </div>
            <div class="progress-meta">
              <span>{{ updater.percent.toFixed(1) }}%</span>
              <span>{{ formatMB(updater.transferred) }} / {{ formatMB(updater.total) }}</span>
              <span>{{ formatSpeed(updater.bytesPerSecond) }}</span>
            </div>
          </div>

          <div v-else-if="updater.status === 'downloaded'" class="notice-body">
            <div class="update-avail">✅ 更新已就绪 (v{{ updater.version }})</div>
            <button class="action-btn primary" @click="$emit('install-update')">立即重启更新</button>
            <div class="later-hint">重启应用即可完成更新</div>
          </div>

          <div v-else-if="updater.status === 'error'" class="notice-body">
            <div class="error-text">⚠️ 检查更新失败</div>
            <div class="error-detail">{{ updater.message }}</div>
            <button class="action-btn" @click="$emit('check-update')">重试</button>
          </div>

          <div v-else class="notice-body">
            <div class="uptodate-row">
              <span>✓ 已是最新版本</span>
              <span class="ver">{{ appVersion }}</span>
            </div>
            <button class="action-btn" @click="$emit('check-update')">检查更新</button>
          </div>
        </div>

        <!-- 官方公告 -->
        <div class="notice-card official">
          <div class="notice-title">📢 官方通知</div>
          <div class="notice-body">
            <div class="official-text">欢迎使用 lite-md-viewer！新功能与更新会在此通知。</div>
            <a class="official-link" href="javascript:;" @click="openRepo">前往项目主页 →</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

export interface UpdaterState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'
  version: string
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
  message: string
}

const props = defineProps<{
  updater: UpdaterState
  appVersion: string
}>()

defineEmits<{
  'check-update': []
  'install-update': []
}>()

const open = ref(false)

// 有更新进展时红点亮起（下载中/可更新/出错/已就绪）
const hasUnread = computed(() => {
  return ['available', 'downloading', 'downloaded', 'error'].includes(props.updater.status)
})

const bellHint = computed(() => {
  switch (props.updater.status) {
    case 'downloading': return `下载中 ${props.updater.percent.toFixed(0)}%`
    case 'downloaded': return '更新已就绪'
    case 'available': return '发现新版本'
    case 'error': return '更新出错'
    default: return '通知'
  }
})

// 有新事件时自动展开面板（首次发现新版/下载完成/出错）
watch(() => props.updater.status, (s, old) => {
  if (s === 'downloaded' || (s === 'available' && old !== 'downloading')) {
    open.value = true
  }
})

function toggle() {
  open.value = !open.value
}

function openRepo() {
  // 通过菜单功能打开仓库
  if (window.electronAPI) {
    // 直接发送给主进程打开外链（复用菜单逻辑）
    ;(window as any).openRepo?.()
  }
}

function formatMB(bytes: number): string {
  if (!bytes) return '0 MB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

function formatSpeed(bps: number): string {
  if (!bps) return ''
  return (bps / 1024 / 1024).toFixed(1) + ' MB/s'
}
</script>

<style scoped>
.notification-bell {
  position: relative;
  -webkit-app-region: no-drag;
}

.bell-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.bell-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent-color);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: var(--shadow-soft);
}

.bell-dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e05d4f;
  border: 2px solid var(--toolbar-bg);
  animation: dot-pulse 1.5s ease infinite;
}

@keyframes dot-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.25); }
}

.notification-panel {
  position: absolute;
  top: 40px;
  right: 0;
  width: 320px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  box-shadow: var(--shadow-hover);
  overflow: hidden;
  z-index: 1000;
  animation: panel-in 0.2s ease;
}

@keyframes panel-in {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.panel-close {
  border: none;
  background: none;
  color: var(--text-tertiary);
  cursor: pointer;
  font-size: 13px;
  padding: 2px 6px;
  border-radius: 6px;
}

.panel-close:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.panel-body {
  max-height: 380px;
  overflow-y: auto;
  padding: 8px;
}

.notice-card {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  margin-bottom: 8px;
  overflow: hidden;
  background: var(--bg-secondary);
}

.notice-card.official {
  background: var(--bg-primary);
}

.notice-title {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}

.notice-body {
  padding: 12px;
  font-size: 13px;
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.checking-row {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border-color);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.update-avail {
  font-size: 13.5px;
  font-weight: 500;
}

.download-hint {
  color: var(--text-tertiary);
  font-size: 12px;
}

.progress-track {
  height: 6px;
  background: var(--bg-tertiary);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-color), var(--accent-hover));
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11.5px;
  color: var(--text-tertiary);
}

.uptodate-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ver {
  font-size: 12px;
  color: var(--text-tertiary);
}

.action-btn {
  padding: 7px 14px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  align-self: flex-start;
}

.action-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent-color);
}

.action-btn.primary {
  background: var(--accent-color);
  color: var(--bg-primary);
  border-color: var(--accent-color);
  font-weight: 600;
  align-self: stretch;
  text-align: center;
}

.action-btn.primary:hover {
  background: var(--accent-hover);
}

.error-text {
  color: #c96a5b;
  font-weight: 500;
}

.error-detail {
  font-size: 11.5px;
  color: var(--text-tertiary);
  word-break: break-all;
}

.later-hint {
  font-size: 11.5px;
  color: var(--text-tertiary);
}

.official-text {
  color: var(--text-secondary);
  line-height: 1.6;
}

.official-link {
  color: var(--accent-color);
  font-size: 12.5px;
  cursor: pointer;
  text-decoration: none;
}

.official-link:hover {
  text-decoration: underline;
}
</style>
