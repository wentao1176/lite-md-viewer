interface ImageReadResult {
  success: boolean
  dataUrl?: string
  error?: string
}

function fileUrl(path: string): URL | null {
  const normalized = path.replace(/\\/g, '/')
  if (/^file:/i.test(normalized)) return new URL(normalized)
  if (!/^(?:[a-z]:\/|\/)/i.test(normalized)) return null
  if (normalized.startsWith('//')) {
    const [host, ...parts] = normalized.slice(2).split('/')
    return new URL(`file://${host}/${parts.map(encodeURIComponent).join('/')}`)
  }
  const encoded = normalized.split('/').map((part, index) => index === 0 && /^[a-z]:$/i.test(part) ? part : encodeURIComponent(part)).join('/')
  return new URL(`file://${encoded.startsWith('/') ? '' : '/'}${encoded}`)
}

function imageSource(src: string, documentPath: string): string | null {
  const normalized = src.replace(/\\/g, '/')
  let url: URL
  if (/^(?:[a-z]:\/|\/\/)/i.test(normalized)) {
    url = fileUrl(normalized)!
  } else {
    const base = fileUrl(documentPath)
    if (!base && normalized.startsWith('/')) return decodeURIComponent(fileUrl(normalized)!.pathname)
    if (!base && !/^[a-z][a-z\d+.-]*:/i.test(normalized)) return null
    url = new URL(normalized, base || undefined)
  }
  if (url.protocol !== 'file:') return url.href
  const path = decodeURIComponent(url.pathname).replace(/^\/([a-z]:\/)/i, '$1')
  return url.hostname ? `//${url.hostname}${path}` : path
}

function imageKey(image: HTMLImageElement): string {
  return JSON.stringify([
    image.getAttribute('data-wtmd-image-source') ?? image.getAttribute('src') ?? '',
    image.getAttribute('srcset') || '',
    Array.from(image.closest('picture')?.querySelectorAll('source') || [], source => [source.getAttribute('srcset'), source.getAttribute('media')])
  ])
}

export function captureRenderedImageSources(root: ParentNode | null): Map<string, string> {
  const sources = new Map<string, string>()
  root?.querySelectorAll('img').forEach(image => {
    if (image.currentSrc && image.complete && image.naturalWidth) sources.set(imageKey(image), image.currentSrc)
  })
  return sources
}

function responsiveSource(image: HTMLImageElement): string {
  const source = Array.from(image.closest('picture')?.querySelectorAll('source') || []).find(source => {
    const media = source.getAttribute('media')
    return !media || !window.matchMedia || window.matchMedia(media).matches
  })
  const srcset = source?.getAttribute('srcset') || image.getAttribute('srcset') || ''
  return srcset.trim().match(/^(data:[^\s]+|[^\s,]+)/)?.[1].replace(/,$/, '') || ''
}

export async function resolveDocumentImages(
  html: string,
  documentPath: string,
  readImage: (source: string) => Promise<ImageReadResult>,
  options: { cache?: Map<string, string>; forExport?: boolean; currentSources?: ReadonlyMap<string, string> } = {}
): Promise<string> {
  const container = document.createElement('div')
  container.innerHTML = html
  const cache = options.cache || new Map<string, string>()
  for (const image of container.querySelectorAll('img')) {
    const originalSrc = image.getAttribute('src') || ''
    const src = options.currentSources?.get(imageKey(image)) || originalSrc || responsiveSource(image)
    if (options.forExport) {
      image.setAttribute('loading', 'eager')
      image.removeAttribute('srcset')
      image.closest('picture')?.querySelectorAll('source').forEach(source => source.removeAttribute('srcset'))
      image.removeAttribute('data-wtmd-image-source')
    }
    try {
      if (!src) {
        if (options.forExport) throw new Error('图片没有可用的来源')
        continue
      }
      if (/^data:/i.test(src)) { image.setAttribute('src', src); continue }
      const source = imageSource(src, documentPath)
      if (!source) {
        if (options.forExport) throw new Error('请先保存 Markdown 文件，以确定相对图片路径')
        continue
      }
      if (!options.forExport && /^(?:https?:|blob:)/i.test(source)) continue
      let dataUrl = cache.get(source)
      if (!dataUrl) {
        if (/^blob:/i.test(source)) {
          const response = await fetch(source)
          const blob = await response.blob()
          dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result))
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(blob)
          })
        } else {
          const result = await readImage(source)
          if (!result.success || !result.dataUrl) throw new Error(result.error || '无法读取图片')
          dataUrl = result.dataUrl
        }
        cache.set(source, dataUrl)
      }
      if (!options.forExport) image.setAttribute('data-wtmd-image-source', originalSrc)
      image.setAttribute('src', dataUrl)
    } catch (error) {
      if (options.forExport) {
        const label = image.alt || src.slice(0, 120)
        throw new Error(`图片加载失败（${label}）：${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }
  return container.innerHTML
}
