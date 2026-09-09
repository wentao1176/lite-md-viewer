import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface TemporaryPdfHtmlFile {
  path: string
  cleanup: () => Promise<void>
}

// 将待打印 HTML 落盘，避免大文档超过 Chromium data: URL 的长度限制。
export async function createPdfHtmlFile(html: string): Promise<TemporaryPdfHtmlFile> {
  const directory = await mkdtemp(join(tmpdir(), 'wtmd-pdf-'))
  const path = join(directory, 'document.html')

  try {
    await writeFile(path, html, 'utf8')
  } catch (error) {
    await rm(directory, { recursive: true, force: true })
    throw error
  }

  return {
    path,
    cleanup: () => rm(directory, { recursive: true, force: true })
  }
}
