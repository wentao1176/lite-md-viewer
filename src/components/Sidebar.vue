<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
      目录
    </div>
    <div class="sidebar-content">
      <ul class="toc-list">
        <li
          v-for="(item, index) in tocItems"
          :key="index"
          :class="['toc-item', `toc-level-${item.level}`]"
          :style="{ paddingLeft: `${16 + (item.level - 1) * 16}px` }"
          @click="$emit('navigate', item.id)"
        >
          {{ item.text }}
        </li>
      </ul>
      <div v-if="tocItems.length === 0" class="toc-empty">
        暂无目录
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  tocItems: Array<{ level: number; text: string; id: string }>
}>()

defineEmits<{
  navigate: [id: string]
}>()
</script>

<style scoped>
.sidebar {
  width: 232px;
  min-width: 180px;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  box-shadow: 1px 0 10px rgba(80, 70, 60, 0.06);
  overflow: hidden;
  flex-shrink: 0;
}

.theme-dark .sidebar {
  box-shadow: 1px 0 10px rgba(0, 0, 0, 0.35);
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 18px;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  user-select: none;
}

.sidebar-header svg {
  color: var(--accent-color);
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.toc-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.toc-item {
  margin: 2px 8px;
  padding: 5px 12px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-radius: 8px;
}

.toc-item:hover {
  color: var(--text-primary);
  background: var(--accent-soft);
}

.toc-level-1 { font-weight: 600; font-size: 13.5px; color: var(--text-primary); }
.toc-level-2 { font-size: 13px; }
.toc-level-3 { font-size: 12.5px; color: var(--text-tertiary); }
.toc-level-4,
.toc-level-5,
.toc-level-6 { font-size: 12px; color: var(--text-tertiary); }

.toc-empty {
  padding: 24px 16px;
  font-size: 13px;
  color: var(--text-tertiary);
  text-align: center;
}
</style>
