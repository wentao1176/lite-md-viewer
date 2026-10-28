// Self-contained: serialized into the isolated print window with executeJavaScript.
export async function waitForPrintResources(timeoutMs = 30000): Promise<void> {
  const failures: string[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  const cleanups: Array<() => void> = []
  try {
    const images = Array.from(document.images)
    const pending = images.map(async (image, index) => {
      image.loading = 'eager'
      image.setAttribute('loading', 'eager')
      const label = image.alt || `第 ${index + 1} 张图片`
      if (!image.complete) {
        await new Promise<void>((resolve) => {
          const done = () => { cleanup(); resolve() }
          const cleanup = () => {
            image.removeEventListener('load', done)
            image.removeEventListener('error', done)
          }
          cleanups.push(cleanup)
          image.addEventListener('load', done)
          image.addEventListener('error', done)
          // A cached image may complete between the first check and registration.
          if (image.complete) done()
        })
      }
      if (!image.naturalWidth) { failures.push(label); return }
      if (typeof image.decode === 'function') {
        try { await image.decode() } catch { if (!image.naturalWidth) failures.push(label) }
      }
    })
    if (document.fonts) pending.push(document.fonts.ready.then(() => {}))
    await Promise.race([
      Promise.all(pending),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('等待导出图片或字体超时，请检查图片来源后重试')), timeoutMs)
      })
    ])
    if (failures.length) throw new Error(`以下图片无法加载，已停止导出以避免缺图：${failures.join('、')}`)
    // Hidden windows may suspend requestAnimationFrame. Force layout directly
    // after decoding instead of waiting for a frame that might never arrive.
    document.documentElement.getBoundingClientRect()
  } finally {
    if (timer) clearTimeout(timer)
    cleanups.forEach(cleanup => cleanup())
  }
}
