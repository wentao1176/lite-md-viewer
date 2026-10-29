// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { findSourceElement } from './source-lines'

describe('source line navigation after paper layout', () => {
  it('uses the nearest source line even when a caption precedes its table in source', () => {
    const root = document.createElement('div')
    root.innerHTML = '<h2 data-line="1">说明</h2><table data-line="5"><caption data-line="3">表 1 符号</caption><tbody><tr data-line="7"><td>x</td></tr></tbody></table>'
    expect(findSourceElement(root, 3)?.tagName).toBe('CAPTION')
    expect(findSourceElement(root, 5)?.tagName).toBe('TABLE')
    expect(findSourceElement(root, 8)?.tagName).toBe('TR')
  })

  it('prefers nested content at the same line and ignores invalid locations', () => {
    const root = document.createElement('div')
    root.innerHTML = '<figure data-line="4"><img data-line="4"></figure><p data-line="not-a-number"></p>'
    expect(findSourceElement(root, 4)?.tagName).toBe('IMG')
    expect(findSourceElement(root, 2)).toBeNull()
  })
})
