import { access, readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createPdfHtmlFile } from './pdf-html-file'

describe('createPdfHtmlFile', () => {
  it('stores multi-megabyte HTML in a loadable temporary file', async () => {
    const html = `<!doctype html><html><body>${'x'.repeat(2_000_000)}</body></html>`
    const temporaryFile = await createPdfHtmlFile(html)

    expect(pathToFileURL(temporaryFile.path).protocol).toBe('file:')
    await expect(readFile(temporaryFile.path, 'utf8')).resolves.toBe(html)

    await temporaryFile.cleanup()
  })

  it('removes the temporary HTML file after cleanup', async () => {
    const temporaryFile = await createPdfHtmlFile('<p>temporary</p>')

    await temporaryFile.cleanup()

    await expect(access(temporaryFile.path)).rejects.toThrow()
  })
})
