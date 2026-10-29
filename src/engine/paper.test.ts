// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { formatPaperLayout } from './paper'
import { MarkdownRenderer } from './renderer'

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html').body

describe('academic document structure', () => {
  it('keeps abstract, keywords and references separate from the numbered body', async () => {
    const renderer = new MarkdownRenderer({ enableHighlight: false })
    const html = await renderer.render('# 资源配置研究\n\n## 摘 要\n\n摘要正文。\n\n**关键词：** 优化；调度\n\n## 1 问题重述\n\n研究正文。\n\n## 参考文献\n\n1. 文献条目')
    const body = parse(formatPaperLayout(html))
    expect(body.querySelector('.paper-title')?.textContent).toBe('资源配置研究')
    expect(body.querySelector('.paper-abstract')?.textContent).toContain('关键词：')
    expect(body.querySelector('.paper-abstract')?.textContent).not.toContain('研究正文。')
    expect(body.querySelector('.paper-keywords')?.textContent).toBe('关键词： 优化；调度')
    expect(body.querySelector('.paper-references li')?.textContent).toBe('文献条目')
    expect(body.querySelector('[id="1-问题重述"]')?.getAttribute('data-line')).toBeTruthy()
  })

  it('uses authored figure captions without changing image loading metadata', () => {
    const html = '<p data-line="12"><img src="data:image/png;base64,eA==" data-wtmd-image-source="plots/result.png" alt="图 1　模型结果" loading="eager"></p>'
    const body = parse(formatPaperLayout(html))
    expect(body.querySelector('figure[data-line="12"] figcaption')?.textContent).toBe('图 1　模型结果')
    expect(body.querySelector('figure img')?.getAttribute('data-wtmd-image-source')).toBe('plots/result.png')
    expect(body.querySelector('figure img')?.getAttribute('loading')).toBe('eager')
  })

  it('prefers an explicit figure caption and puts table captions above the table', () => {
    const body = parse(formatPaperLayout('<p><img src="result.png" alt="result"></p><p data-line="9">图 2：<em>敏感性分析</em></p><p data-line="11">表 1　符号说明</p><table><tbody><tr><td>x</td></tr></tbody></table>'))
    expect(body.querySelectorAll('figcaption')).toHaveLength(1)
    expect(body.querySelector('figcaption em')?.textContent).toBe('敏感性分析')
    expect(body.querySelector('table')?.firstElementChild?.tagName).toBe('CAPTION')
    expect(body.querySelector('caption[data-line="11"]')?.textContent).toBe('表 1　符号说明')
  })

  it('does not mistake prose, inline images or PDF math for captioned figures', () => {
    const body = parse(formatPaperLayout('<p>表1显示了模型结果。</p><table><tr><td>1</td></tr></table><p>见<img src="a.png" alt="示意图">所示。</p><div class="katex-block"><img class="katex-pdf-img" src="math.png"></div><p><img src="b.png" alt="plain filename"></p>'))
    expect(body.querySelector('caption')).toBeNull()
    expect(body.querySelector('figcaption')).toBeNull()
    expect(body.querySelector('p img[src="a.png"]')).not.toBeNull()
    expect(body.querySelector('.katex-block > .katex-pdf-img')).not.toBeNull()
  })

  it('keeps explanatory paragraphs after images instead of swallowing them as captions', () => {
    const body = parse(formatPaperLayout('<p><img src="chart.svg" alt="图 1　模拟结果"></p><p data-line="5">图 1 展示了模拟结果。图中两条曲线代表不同指标。</p><p><img src="plot.svg" alt="plot"></p><p>图 2 展示了第二组结果。</p>'))
    expect(body.querySelector('figcaption')?.textContent).toBe('图 1　模拟结果')
    expect(body.querySelector('p[data-line="5"]')?.textContent).toContain('两条曲线')
    expect(body.querySelectorAll('figcaption')).toHaveLength(1)
    expect(body.lastElementChild?.textContent).toBe('图 2 展示了第二组结果。')
  })

  it('preserves math, links and source anchors when applying the layout twice', async () => {
    const renderer = new MarkdownRenderer({ enableHighlight: false })
    const html = await renderer.render('# 标题\n\n## Abstract\n\nAbstract text.\n\n## 1 Model\n\n$$\\frac{1}{2}$$\n\n[原文](https://example.com)\n\n![图 1 结果](result.png)')
    const once = formatPaperLayout(html)
    const twice = formatPaperLayout(once)
    expect(twice).toBe(once)
    const body = parse(twice)
    expect(body.querySelector('.katex .frac-line')).not.toBeNull()
    expect(body.querySelector('a')?.getAttribute('href')).toBe('https://example.com')
    expect(body.querySelectorAll('figure')).toHaveLength(1)
    expect(body.querySelectorAll('[data-line]').length).toBeGreaterThanOrEqual(5)
  })

  it('does not style a body H1 as the paper title after an abstract-only heading is wrapped', () => {
    const once = formatPaperLayout('<h1>摘要</h1><p>摘要</p><h1>1 问题重述</h1><p>正文</p>')
    expect(formatPaperLayout(once)).toBe(once)
    expect(parse(once).querySelector('.paper-title')).toBeNull()
  })

  it('keeps English figure discussion in the body', () => {
    const body = parse(formatPaperLayout('<p><img src="chart.svg" alt="chart"></p><p>Figure 1 shows the baseline.</p>'))
    expect(body.querySelector('figcaption')).toBeNull()
    expect(body.querySelector('figure + p')?.textContent).toBe('Figure 1 shows the baseline.')
  })

  it('leaves measured SVG label DOM unchanged, including image and keyword paragraphs', () => {
    const svg = '<svg><foreignObject width="40" height="24"><p><img src="icon.png" width="24" height="24"></p><p>Keywords: solver</p><p>表 1　参数</p><table><tbody><tr><td>x</td></tr></tbody></table></foreignObject></svg>'
    const original = parse(svg).querySelector('svg')!.outerHTML
    const body = parse(formatPaperLayout(svg + '<p><img src="plot.png" alt="图 1　结果"></p>'))
    expect(body.querySelector('svg')!.outerHTML).toBe(original)
    expect(body.querySelectorAll('figure')).toHaveLength(1)
  })
})
