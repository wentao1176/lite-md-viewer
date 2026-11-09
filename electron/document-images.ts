import type { ImageInsertionSuccess, ImageSelection } from '../src/shared/image-insertion'
import * as fs from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { rewriteMarkdownResources } from './markdown-assets'

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif']
const MAX_IMAGE_BYTES = 64 * 1024 * 1024

export function imageExtension(mimeType: string, name: string): string {
  const mime: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/bmp': 'bmp', 'image/svg+xml': 'svg', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico', 'image/avif': 'avif' }
  return mime[mimeType.toLowerCase()] || extname(name).slice(1).toLowerCase()
}

export interface DocumentImageInput {
  documentPath: string
  content: string
  selection: ImageSelection
  images: Array<{ data: Uint8Array; extension: string }>
  allowNew?: boolean
}

export async function insertDocumentImages(input: DocumentImageInput): Promise<ImageInsertionSuccess> {
  const source = resolve(input.documentPath)
  if (!isAbsolute(input.documentPath)) throw new Error('请先保存 Markdown 文档')
  const { from, to } = input.selection
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from || to > input.content.length) throw new Error('插入位置无效，请重试')
  if (!input.images.length) throw new Error('没有可插入的图片')
  const validate = (data: Uint8Array, extension: string) => {
    if (!IMAGE_EXTENSIONS.includes(extension)) throw new Error(`不支持的图片格式：${extension}`)
    if (!data.length || data.length > MAX_IMAGE_BYTES) throw new Error('图片为空或超过 64 MB')
  }
  for (const image of input.images) validate(image.data, image.extension)
  const before = await readIfPresent(source)
  if (!before && !input.allowNew) throw new Error('Markdown 文件不存在，请重新保存文档')
  if (before && input.allowNew) throw new Error('该文件已存在，请为新文档选择其他名称')

  const sourceDir = dirname(source)
  const name = basename(source)
  const stem = basename(source, extname(source))
  const parentName = basename(sourceDir)
  const normalize = (text: string) => process.platform === 'win32' ? text.toLowerCase() : text
  const parent = normalize(parentName), documentStem = normalize(stem)
  const bundled = parent === documentStem || (parent.startsWith(`${documentStem} (`) && /^\(\d+\)$/.test(parent.slice(documentStem.length + 1)))
  let folder = sourceDir
  let createdFolder = false
  if (!bundled) {
    for (let index = 1; ; index++) {
      folder = join(sourceDir, index === 1 ? stem : `${stem} (${index})`)
      try { await fs.mkdir(folder); createdFolder = true; break } catch (error: any) { if (error.code !== 'EEXIST') throw error }
    }
  }
  const imageDir = join(folder, 'images')
  const target = join(folder, name)
  const owned = new Set<string>()
  let createdImages = false
  let committed = false
  try {
    try {
      const stat = await fs.lstat(imageDir)
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('images 必须是普通文件夹')
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error
      await fs.mkdir(imageDir)
      createdImages = true
    }
    const entries = await fs.readdir(imageDir)
    let nextIndex = entries.reduce((max, entry) => Math.max(max, Number(entry.match(/^(\d+)\.[^.]+$/)?.[1]) || 0), 0) + 1
    const assets: Array<{ path: string; data: Uint8Array }> = []
    const existing = new Map<string, string>()
    const add = (data: Uint8Array, extension: string) => {
      validate(data, extension)
      const url = `images/${nextIndex++}.${extension}`
      assets.push({ path: join(folder, url), data })
      return url
    }
    const rewritten = await rewriteMarkdownResources(input.content, async (url, kind) => {
      if (!url || url.startsWith('#') || (kind === 'link' && url.startsWith('?')) || /^(?:https?:|\/\/|mailto:|tel:)/i.test(url)) return url
      if (/^data:/i.test(url)) {
        if (kind !== 'image') return url
        const hit = url.match(/^data:(image\/[\w.+-]+)(;base64)?,([\s\S]*)$/i)
        if (!hit) return url
        if (!existing.has(url)) existing.set(url, add(hit[2] ? Buffer.from(hit[3], 'base64') : Buffer.from(decodeURIComponent(hit[3])), imageExtension(hit[1], '')))
        return existing.get(url)!
      }
      if (/^(?!file:)[a-z][a-z\d+.-]*:/i.test(url) && !/^[a-z]:[\\/]/i.test(url)) return url
      let filePath: string, suffix: string
      if (/^file:/i.test(url)) {
        const parsed = new URL(url)
        filePath = fileURLToPath(parsed)
        suffix = parsed.search + parsed.hash
      } else {
        const split = url.search(/[?#]/)
        const pathPart = split < 0 ? url : url.slice(0, split)
        suffix = split < 0 ? '' : url.slice(split)
        let decoded: string
        try { decoded = decodeURIComponent(pathPart) } catch { decoded = pathPart }
        filePath = resolve(sourceDir, decoded.replace(/\\/g, '/'))
      }
      if (kind === 'link') {
        if (normalize(filePath) === normalize(source)) return toUrl(relative(folder, target)) + suffix
        return folder === sourceDir || /^file:/i.test(url) || isAbsolute(url) ? url : toUrl(relative(folder, filePath)) + suffix
      }
      const inImages = inside(imageDir, filePath) && /^\d+\.[^.]+$/.test(basename(filePath))
      if (inImages) { await fs.access(filePath); return toUrl(relative(folder, filePath)) + suffix }
      const key = normalize(filePath)
      if (!existing.has(key)) {
        let data: Buffer
        try { data = await fs.readFile(filePath) } catch { throw new Error(`无法读取文档中的图片：${url}`) }
        const extension = extname(filePath).slice(1).toLowerCase() || sniffExtension(data)
        existing.set(key, add(data, extension))
      }
      return existing.get(key)! + suffix
    })
    const imagePaths = input.images.map(image => add(image.data, image.extension))
    const start = rewritten.mapPosition(from), end = rewritten.mapPosition(to)
    const prefix = rewritten.content.slice(0, start), suffix = rewritten.content.slice(end)
    const leading = !prefix || prefix.endsWith('\n\n') ? '' : prefix.endsWith('\n') ? '\n' : '\n\n'
    const trailing = suffix.startsWith('\n\n') ? '' : suffix.startsWith('\n') ? '\n' : '\n\n'
    const references = imagePaths.map(path => `![图片 ${basename(path, extname(path))}](${path})`).join('\n\n')
    const change = { from: start, to: end, insert: leading + references + trailing }
    const content = prefix + change.insert + suffix
    for (const asset of assets) await writeOwned(asset.path, asset.data, owned)
    const temporary = join(folder, `.wtmd-insert-${randomUUID()}.tmp`)
    await writeOwned(temporary, Buffer.from(content), owned)
    const current = await readIfPresent(source)
    if ((before && !current?.equals(before)) || (!before && current)) throw new Error('文档已被其他程序修改，请重新打开后插入图片')
    if (target === source && before) {
      await fs.rename(temporary, target)
      owned.delete(temporary)
    } else {
      // Exclusive creation works on FAT/removable volumes too; the source stays
      // intact until the complete new Markdown has been flushed to disk.
      await writeOwned(target, Buffer.from(content), owned)
      if (target !== source) {
        const latest = await readIfPresent(source)
        if ((before && !latest?.equals(before)) || (!before && latest)) throw new Error('文档已被其他程序修改，请重新打开后插入图片')
        if (before) await fs.unlink(source)
      }
    }
    committed = true
    owned.delete(target)
    for (const asset of assets) owned.delete(asset.path)
    return { success: true, path: target, content, baseContent: rewritten.content, change, cursor: start + change.insert.length, imagePaths }
  } finally {
    for (const file of owned) {
      if (inside(folder, file)) await fs.unlink(file).catch(() => {})
    }
    if (!committed) {
      if (createdImages) await fs.rmdir(imageDir).catch(() => {})
      if (createdFolder) await fs.rmdir(folder).catch(() => {})
    }
  }
}

async function readIfPresent(path: string): Promise<Buffer | undefined> {
  try { return await fs.readFile(path) } catch (error: any) { if (error.code === 'ENOENT') return undefined; throw error }
}

function inside(folder: string, path: string): boolean {
  const child = relative(resolve(folder), resolve(path))
  return !!child && child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child)
}

function toUrl(path: string): string { return path.split(sep).map(part => encodeURIComponent(part)).join('/') }

async function writeOwned(path: string, data: Uint8Array, owned: Set<string>) {
  const file = await fs.open(path, 'wx')
  owned.add(path)
  try { await file.writeFile(data); await file.sync() } finally { await file.close() }
}

function sniffExtension(data: Uint8Array): string {
  const text = Buffer.from(data).subarray(0, 300).toString('utf8').trimStart()
  if (data[0] === 137 && data[1] === 80) return 'png'
  if (data[0] === 255 && data[1] === 216) return 'jpg'
  if (text.startsWith('GIF8')) return 'gif'
  if (text.startsWith('RIFF')) return 'webp'
  if (/^(?:<\?xml[\s\S]*?)?<svg[\s>]/i.test(text)) return 'svg'
  throw new Error('无法识别已有图片的格式')
}
