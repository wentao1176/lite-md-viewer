// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { buildExportHtml } from './export'
import { MarkdownRenderer } from './renderer'

afterEach(() => { document.head.innerHTML = ''; document.body.innerHTML = '' })

describe('standalone document export', () => {
  it('preserves rendered formulas and the chosen body font', async () => {
    const renderer = new MarkdownRenderer({ enableHighlight: false })
    const html = await renderer.render(String.raw`\[\frac{1}{2}\]`)
    const output = buildExportHtml(html, 'light', 'Math demo', { fontFamily: "'Cambria', serif" })
    const doc = new DOMParser().parseFromString(output, 'text/html')
    expect(doc.querySelector('.katex-block .katex-html')).not.toBeNull()
    expect(doc.querySelector('style')?.textContent).toContain("font-family: 'Cambria', serif")
  })

  it('exports a white theme with defined colors', () => {
    const html = buildExportHtml('<p>Text</p>', 'white')
    expect(html).toContain('--bg-primary: #ffffff')
    expect(html).toContain('--text-primary:')
    expect(html).not.toContain('undefined')
  })

  it('renders homework documents with black text, white paper and grayscale artwork', () => {
    const html = buildExportHtml('<p>Homework</p><pre><code>x = 1</code></pre><img src="data:image/png;base64,eA==">', 'dark', 'Homework', { documentStyle: 'homework' })
    const doc = new DOMParser().parseFromString(html, 'text/html')
    document.head.innerHTML = doc.head.innerHTML
    document.body.innerHTML = doc.body.innerHTML
    const body = document.querySelector('.homework-document')!
    expect(body).not.toBeNull()
    expect(getComputedStyle(body).backgroundColor).toBe('rgb(255, 255, 255)')
    const channels = getComputedStyle(body.querySelector('p')!).color.match(/\d+/g)!.map(Number)
    expect(channels[0]).toBe(channels[1])
    expect(channels[1]).toBe(channels[2])
    expect(channels[0]).toBeLessThanOrEqual(64)
    expect(getComputedStyle(body.querySelector('img')!).filter).toBe('grayscale(1)')
  })

  it('preserves light diagram labels on dark custom nodes while removing artwork color', () => {
    const html = buildExportHtml('<div class="mermaid-container"><svg><rect style="fill:black!important"/><foreignObject><span style="color:white">label</span></foreignObject></svg></div>', 'light', '', { documentStyle: 'homework' })
    const doc = new DOMParser().parseFromString(html, 'text/html')
    document.head.innerHTML = doc.head.innerHTML
    document.body.innerHTML = doc.body.innerHTML
    expect(getComputedStyle(document.querySelector('foreignObject span')!).color).toBe('rgb(255, 255, 255)')
    expect(getComputedStyle(document.querySelector('svg')!).filter).toBe('grayscale(1)')
  })
})
