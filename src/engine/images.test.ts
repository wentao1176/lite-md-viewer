// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { captureRenderedImageSources, resolveDocumentImages } from './images'

describe('document image sources', () => {
  const dataUrl = 'data:image/png;base64,aW1hZ2U='

  it.each([
    ['assets/my%20image.png', 'D:/notes/assets/my image.png'],
    ['../图片/photo.png', 'D:/图片/photo.png'],
    ['file:///D:/pictures/my%20image.png', 'D:/pictures/my image.png'],
    ['D:\\pictures\\photo.png', 'D:/pictures/photo.png'],
    ['/pictures/photo.png', 'D:/pictures/photo.png'],
    ['\\\\server\\share\\photo.png', '//server/share/photo.png']
  ])('embeds local image %s without depending on the temporary print directory', async (src, expectedPath) => {
    const loaded: string[] = []
    const output = await resolveDocumentImages(`<img src="${src}" loading="lazy">`, 'D:/notes/homework.md', async (path) => {
      loaded.push(path)
      return { success: true, dataUrl }
    }, { forExport: true })
    const container = document.createElement('div')
    container.innerHTML = output
    expect(loaded).toEqual([expectedPath])
    expect(container.querySelector('img')?.getAttribute('src')).toBe(dataUrl)
    expect(container.querySelector('img')?.getAttribute('loading')).toBe('eager')
  })

  it('embeds remote export images and removes srcset alternatives', async () => {
    const loaded: string[] = []
    const output = await resolveDocumentImages('<picture><source srcset="missing.png 2x"><img src="https://example.com/photo.png" srcset="other.png 2x"></picture>', '', async (src) => {
      loaded.push(src)
      return { success: true, dataUrl }
    }, { forExport: true })
    expect(loaded).toEqual(['https://example.com/photo.png'])
    expect(output).toContain(dataUrl)
    expect(output).not.toContain('srcset')
  })

  it('keeps remote preview sources and reuses local preview cache for export', async () => {
    const cache = new Map<string, string>()
    let reads = 0
    const reader = async () => { reads++; return { success: true, dataUrl } }
    const html = '<img src="assets/a.png"><img src="https://example.com/b.png">'
    const preview = await resolveDocumentImages(html, 'D:/notes/a.md', reader, { cache })
    expect(reads).toBe(1)
    expect(preview).toContain('https://example.com/b.png')
    await resolveDocumentImages('<img src="assets/a.png">', 'D:/notes/a.md', reader, { cache, forExport: true })
    expect(reads).toBe(1)
  })

  it('reports missing export images instead of silently producing an incomplete PDF', async () => {
    await expect(resolveDocumentImages('<img alt="实验结果" src="missing.png">', 'D:/notes/a.md', async () => ({ success: false, error: 'not found' }), { forExport: true }))
      .rejects.toThrow('实验结果')
  })

  it('preserves missing-image preview markup so editing can continue', async () => {
    const output = await resolveDocumentImages('<img src="missing.png">', 'D:/notes/a.md', async () => ({ success: false }), {})
    expect(output).toContain('src="missing.png"')
  })

  it('embeds absolute POSIX paths even before a document is saved', async () => {
    const loaded: string[] = []
    const output = await resolveDocumentImages('<img src="/home/user/photo.png">', '', async src => {
      loaded.push(src)
      return { success: true, dataUrl }
    }, { forExport: true })
    expect(loaded).toEqual(['/home/user/photo.png'])
    expect(output).toContain(dataUrl)
  })

  it.each([
    '<img srcset="https://example.com/one.png 1x, https://example.com/two.png 2x">',
    '<picture><source srcset="https://example.com/one.png 1x"><img></picture>'
  ])('retains responsive images without a fallback src', async html => {
    const loaded: string[] = []
    const output = await resolveDocumentImages(html, '', async src => {
      loaded.push(src)
      return { success: true, dataUrl }
    }, { forExport: true })
    expect(loaded).toEqual(['https://example.com/one.png'])
    expect(output).toContain(`src="${dataUrl}"`)
  })

  it('uses the responsive candidate actually displayed in the preview', async () => {
    const html = '<img src="https://example.com/one.png" srcset="https://example.com/two.png 2x">'
    const preview = document.createElement('div')
    preview.innerHTML = html
    Object.defineProperty(preview.querySelector('img'), 'currentSrc', { value: 'https://example.com/two.png' })
    Object.defineProperty(preview.querySelector('img'), 'complete', { value: true })
    Object.defineProperty(preview.querySelector('img'), 'naturalWidth', { value: 100 })
    const currentSources = captureRenderedImageSources(preview)
    const loaded: string[] = []
    await resolveDocumentImages(html, '', async src => {
      loaded.push(src)
      return { success: true, dataUrl }
    }, { forExport: true, currentSources })
    expect(loaded).toEqual(['https://example.com/two.png'])
  })
})
