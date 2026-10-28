export interface FontOption {
  label: string
  value: string
}

export interface FontGroup {
  label: string
  options: readonly FontOption[]
}

// 使用本机字体与跨平台后备字体，不依赖在线字体服务。
// 原有选项的 CSS 值保持不变，兼容 wtmd-font-v2 中已保存的选择。
export const FONT_GROUPS: readonly FontGroup[] = [
  {
    label: '系统默认',
    options: [
      { label: '默认字体', value: '' }
    ]
  },
  {
    label: '中文字体',
    options: [
      { label: '微软雅黑', value: "'Times New Roman', 'Georgia', 'Segoe UI', 'Inter', 'Roboto', 'Microsoft YaHei', 'PingFang SC', sans-serif" },
      { label: '宋体', value: "'Times New Roman', 'Georgia', 'SimSun', 'Songti SC', serif" },
      { label: '楷体', value: "'Times New Roman', 'Georgia', 'KaiTi', 'STKaiti', 'Noto Serif SC', serif" },
      { label: '黑体', value: "'Times New Roman', 'Georgia', 'Segoe UI', 'Helvetica Neue', 'Arial', 'SimHei', 'Heiti SC', sans-serif" },
      { label: '苹方', value: "'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Noto Sans SC', sans-serif" },
      { label: '思源黑体 / Noto Sans', value: "'Source Han Sans SC', 'Source Han Sans CN', 'Noto Sans CJK SC', 'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', sans-serif" },
      { label: '思源宋体 / Noto Serif', value: "'Source Han Serif SC', 'Source Han Serif CN', 'Noto Serif CJK SC', 'Noto Serif SC', 'Songti SC', 'SimSun', serif" },
      { label: '仿宋', value: "'FangSong', 'STFangsong', 'Songti SC', 'SimSun', serif" }
    ]
  },
  {
    label: '英文字体',
    options: [
      { label: 'Times New Roman', value: "'Times New Roman', 'Liberation Serif', 'Georgia', 'Noto Serif CJK SC', 'Songti SC', 'SimSun', serif" },
      { label: 'Georgia', value: "'Georgia', 'Times New Roman', 'Noto Serif CJK SC', 'Songti SC', 'SimSun', serif" },
      { label: 'Cambria', value: "'Cambria', 'Georgia', 'Times New Roman', 'Noto Serif CJK SC', 'Songti SC', 'SimSun', serif" },
      { label: 'Palatino', value: "'Palatino Linotype', 'Palatino', 'Book Antiqua', 'Georgia', 'Noto Serif CJK SC', 'Songti SC', 'SimSun', serif" },
      { label: 'Arial', value: "'Arial', 'Liberation Sans', 'Helvetica Neue', 'Noto Sans CJK SC', 'Microsoft YaHei', 'PingFang SC', sans-serif" },
      { label: 'Segoe UI', value: "'Segoe UI', 'Helvetica Neue', 'Arial', 'Noto Sans CJK SC', 'Microsoft YaHei', 'PingFang SC', sans-serif" },
      { label: 'Helvetica', value: "'Helvetica Neue', 'Helvetica', 'Arial', 'Noto Sans CJK SC', 'PingFang SC', 'Microsoft YaHei', sans-serif" }
    ]
  },
  {
    label: '等宽字体',
    options: [
      { label: 'Consolas', value: "'Consolas', 'Cascadia Code', 'Liberation Mono', 'Menlo', 'Monaco', 'Noto Sans Mono CJK SC', monospace" },
      { label: 'Cascadia Code', value: "'Cascadia Code', 'Cascadia Mono', 'Consolas', 'Liberation Mono', 'Menlo', 'Noto Sans Mono CJK SC', monospace" },
      { label: 'JetBrains Mono', value: "'JetBrains Mono', 'Cascadia Code', 'Consolas', 'Liberation Mono', 'Menlo', 'Noto Sans Mono CJK SC', monospace" },
      { label: 'Fira Code', value: "'Fira Code', 'Cascadia Code', 'Consolas', 'Liberation Mono', 'Menlo', 'Noto Sans Mono CJK SC', monospace" }
    ]
  }
]

export const FONT_OPTIONS = FONT_GROUPS.flatMap(group => group.options)

export function normalizeFontFamily(value: unknown): string {
  return typeof value === 'string' && FONT_OPTIONS.some(option => option.value === value)
    ? value
    : ''
}
