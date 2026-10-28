// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { waitForPrintResources } from './print-resources'

afterEach(() => { document.body.innerHTML = '' })

describe('print resource readiness', () => {
  it('waits for a below-the-fold lazy image to load before allowing print', async () => {
    document.body.innerHTML = '<img alt="最后一页" src="late.png" loading="lazy">'
    const image = document.images[0]
    let finished = false
    const ready = waitForPrintResources(1000).then(() => { finished = true })
    await new Promise(resolve => setTimeout(resolve, 15))
    expect(finished).toBe(false)
    expect(image.getAttribute('loading')).toBe('eager')
    Object.defineProperty(image, 'complete', { value: true })
    Object.defineProperty(image, 'naturalWidth', { value: 80 })
    image.dispatchEvent(new Event('load'))
    await ready
    expect(finished).toBe(true)
  })

  it('reports a broken image instead of printing a silently incomplete document', async () => {
    document.body.innerHTML = '<img alt="实验照片" src="bad.png">'
    const result = expect(waitForPrintResources(1000)).rejects.toThrow('实验照片')
    document.images[0].dispatchEvent(new Event('error'))
    await result
  })

  it('bounds the wait for an image that never responds', async () => {
    document.body.innerHTML = '<img src="stalled.png">'
    await expect(waitForPrintResources(20)).rejects.toThrow('超时')
  })
})
