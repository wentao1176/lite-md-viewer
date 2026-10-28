import { describe, expect, it } from 'vitest'
import { normalizeFontFamily } from './fonts'

describe('normalizeFontFamily', () => {
  it.each([
    "'Times New Roman', 'Georgia', 'Segoe UI', 'Inter', 'Roboto', 'Microsoft YaHei', 'PingFang SC', sans-serif",
    "'Times New Roman', 'Georgia', 'SimSun', 'Songti SC', serif",
    "'Times New Roman', 'Georgia', 'KaiTi', 'STKaiti', 'Noto Serif SC', serif",
    "'Times New Roman', 'Georgia', 'Segoe UI', 'Helvetica Neue', 'Arial', 'SimHei', 'Heiti SC', sans-serif"
  ])('retains the existing saved font choice %s', (savedValue) => {
    expect(normalizeFontFamily(savedValue)).toBe(savedValue)
  })

  it.each([null, undefined, 42, {}, 'Removed Font', 'serif; color: red'])('uses the default for an unsupported saved value %s', (savedValue) => {
    expect(normalizeFontFamily(savedValue)).toBe('')
  })
})
