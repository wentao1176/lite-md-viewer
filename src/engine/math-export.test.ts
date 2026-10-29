// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { replaceDisplayMathWithImages } from './math-export'
import { MarkdownRenderer } from './renderer'

const renderer = new MarkdownRenderer({ enableHighlight: false, sanitize: true })

describe('display math PDF export', () => {
  it('replaces all display syntax with images while preserving inline math and source locations', async () => {
    const html = await renderer.render(String.raw`$a$ and \(b\); result $$c$$.

\[d\]

\begin{align*}e &= f\end{align*}`)
    const result = await replaceDisplayMathWithImages(html, async () => ({
      dataUrl: 'data:image/png;base64,Zm9ybXVsYQ==', width: 123.4
    }))
    const container = document.createElement('div')
    container.innerHTML = result
    expect(container.querySelectorAll('img.katex-pdf-img')).toHaveLength(3)
    expect(container.querySelectorAll('.katex-inline .katex-html')).toHaveLength(2)
    expect(container.querySelector('[data-line="3"] img')?.getAttribute('src')).toBe('data:image/png;base64,Zm9ybXVsYQ==')
    expect(container.querySelector('[data-line="3"] img')?.getAttribute('style')).toContain('123px')
  })

  it('keeps formula HTML if an image conversion fails, and exports the remaining formulas', async () => {
    const html = await renderer.render('$$x$$\n\n$$y$$')
    const result = await replaceDisplayMathWithImages(html, async (formulaHtml) => {
      if (formulaHtml.includes('>x<')) throw new Error('canvas failed')
      return { dataUrl: 'data:image/png;base64,eQ==', width: 80 }
    })
    const container = document.createElement('div')
    container.innerHTML = result
    expect(container.querySelectorAll('.katex-display')).toHaveLength(1)
    expect(container.querySelectorAll('img.katex-pdf-img')).toHaveLength(1)
    expect(container.querySelector('.katex-display')?.textContent).toContain('x')
  })

  it('keeps equation tags outside the rasterized formula so numbers cannot overlap it', async () => {
    const html = await renderer.render(String.raw`\[\frac{a}{b}=c\tag{3}\]`)
    let rasterized = ''
    const result = await replaceDisplayMathWithImages(html, async formulaHtml => {
      rasterized = formulaHtml
      return { dataUrl: 'data:image/png;base64,eA==', width: 120 }
    })
    const body = new DOMParser().parseFromString(result, 'text/html').body
    expect(body.querySelector('.katex-equation-number')?.textContent).toBe('(3)')
    expect(new DOMParser().parseFromString(rasterized, 'text/html').querySelector('.tag')).toBeNull()
    expect(body.querySelector('.katex-block img')).not.toBeNull()
  })

  it('preserves automatic equation counters and formatted tags as KaTeX markup', async () => {
    const html = await renderer.render(String.raw`\begin{align}a&=b\\c&=d\end{align}

\[x=y\tag{$\alpha_1$}\]`)
    const result = await replaceDisplayMathWithImages(html, async () => ({ dataUrl: 'data:image/png;base64,eA==', width: 100 }))
    const body = new DOMParser().parseFromString(result, 'text/html').body
    expect(body.querySelectorAll('.katex-equation-number.katex .eqn-num')).toHaveLength(2)
    expect(body.querySelector('.katex-equation-number.katex .msupsub')).not.toBeNull()
  })
})
