import * as fs from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { insertDocumentImages } from './document-images'

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof fs>()
  return { ...actual, unlink: vi.fn(actual.unlink), link: vi.fn(actual.link) }
})

let root: string
beforeEach(async () => { root = await fs.mkdtemp(join(tmpdir(), 'wtmd-insert-test-')) })
afterEach(async () => {
  vi.mocked(fs.unlink).mockRestore()
  vi.mocked(fs.link).mockRestore()
  if (dirname(resolve(root)) !== resolve(tmpdir()) || !basename(root).startsWith('wtmd-insert-test-')) throw new Error('Unsafe test cleanup')
  await fs.rm(root, { recursive: true, force: true })
})
const png = { data: new Uint8Array([1, 2, 3, 4]), extension: 'png' }
const insert = (documentPath: string, content: string, extra = {}) => insertDocumentImages({ documentPath, content, selection: { from: content.length, to: content.length }, images: [png], ...extra })

describe('numbered document image bundles', () => {
  it('moves a saved document into its own folder and saves the inserted image reference', async () => {
    const source = join(root, '论文.md')
    await fs.writeFile(source, '# 标题\n')
    const result = await insert(source, '# 标题\n\n未保存的段落。')
    expect(result.path).toBe(join(root, '论文', '论文.md'))
    expect(result.imagePaths).toEqual(['images/1.png'])
    expect(result.content).toBe('# 标题\n\n未保存的段落。\n\n![图片 1](images/1.png)\n\n')
    expect(await fs.readFile(result.path, 'utf8')).toBe(result.content)
    expect(await fs.readFile(join(root, '论文', 'images', '1.png'))).toEqual(Buffer.from(png.data))
    await expect(fs.access(source)).rejects.toThrow()
  })

  it('copies existing local images, preserves code examples and rebases other relative links', async () => {
    await fs.mkdir(join(root, 'plots'))
    await fs.writeFile(join(root, 'plots', 'old one.png'), 'original-image')
    const content = '![旧图](plots/old%20one.png "标题")\n\n[data](data.csv)\n\n`![示例](plots/old.png)`'
    const source = join(root, 'paper.md')
    await fs.writeFile(source, content)
    const result = await insert(source, content)
    expect(result.baseContent).toBe('![旧图](images/1.png "标题")\n\n[data](../data.csv)\n\n`![示例](plots/old.png)`')
    expect(result.imagePaths).toEqual(['images/2.png'])
    expect(await fs.readFile(join(root, 'paper', 'images', '1.png'), 'utf8')).toBe('original-image')
    expect(await fs.readFile(join(root, 'plots', 'old one.png'), 'utf8')).toBe('original-image')
  })

  it('reuses the organized document folder and continues numbering across extensions and gaps', async () => {
    const folder = join(root, 'paper')
    await fs.mkdir(join(folder, 'images'), { recursive: true })
    const source = join(folder, 'paper.md')
    await fs.writeFile(source, '![old](images/7.jpg)')
    await fs.writeFile(join(folder, 'images', '7.jpg'), 'seven')
    await fs.writeFile(join(folder, 'images', '2.png'), 'two')
    const result = await insert(source, '![old](images/7.jpg)', { images: [png, { ...png, extension: 'webp' }] })
    expect(result.path).toBe(source)
    expect(result.imagePaths).toEqual(['images/8.png', 'images/9.webp'])
    expect(result.baseContent).toBe('![old](images/7.jpg)')
    expect(await fs.readFile(join(folder, 'images', '7.jpg'), 'utf8')).toBe('seven')
  })

  it('does not overwrite a colliding folder and reuses its suffixed bundle on later inserts', async () => {
    await fs.mkdir(join(root, 'paper'))
    await fs.writeFile(join(root, 'paper', 'paper.md'), 'unrelated document')
    const source = join(root, 'paper.md')
    await fs.writeFile(source, 'new document')
    const first = await insert(source, 'new document')
    expect(first.path).toBe(join(root, 'paper (2)', 'paper.md'))
    const second = await insert(first.path, first.content)
    expect(second.path).toBe(first.path)
    expect(second.imagePaths).toEqual(['images/2.png'])
    expect(await fs.readFile(join(root, 'paper', 'paper.md'), 'utf8')).toBe('unrelated document')
  })

  it('leaves the original usable when an existing local image cannot be read', async () => {
    const content = '![missing](missing.png)'
    const source = join(root, 'paper.md')
    await fs.writeFile(source, content)
    await expect(insert(source, content)).rejects.toThrow(/missing.png/)
    expect(await fs.readFile(source, 'utf8')).toBe(content)
    expect(await fs.readdir(root)).toEqual(['paper.md'])
  })

  it('rolls back the new bundle when the old Markdown cannot be moved', async () => {
    const source = join(root, 'paper.md')
    await fs.writeFile(source, 'saved document')
    const actual = await vi.importActual<typeof fs>('node:fs/promises')
    vi.mocked(fs.unlink).mockImplementation(async path => {
      if (String(path) === source) throw new Error('document is locked')
      return actual.unlink(path)
    })
    await expect(insert(source, 'edited document')).rejects.toThrow('document is locked')
    expect(await fs.readFile(source, 'utf8')).toBe('saved document')
    expect(await fs.readdir(root)).toEqual(['paper.md'])
  })

  it('creates a bundle for a newly named unsaved document without an intermediate Markdown file', async () => {
    const result = await insert(join(root, 'new.md'), '未保存的内容', { allowNew: true })
    expect(result.path).toBe(join(root, 'new', 'new.md'))
    expect(await fs.readFile(result.path, 'utf8')).toContain('未保存的内容')
    await expect(fs.access(join(root, 'new.md'))).rejects.toThrow()
  })

  it('rejects empty or unsupported images without touching the original document', async () => {
    const source = join(root, 'paper.md')
    await fs.writeFile(source, 'saved')
    await expect(insert(source, 'edited', { images: [{ ...png, extension: '../exe' }] })).rejects.toThrow()
    await expect(insert(source, 'edited', { images: [{ data: new Uint8Array(), extension: 'png' }] })).rejects.toThrow()
    expect(await fs.readFile(source, 'utf8')).toBe('saved')
    expect(await fs.readdir(root)).toEqual(['paper.md'])
  })

  it('distinguishes percent-encoded filenames from SVG fragments and imports file URLs', async () => {
    await fs.writeFile(join(root, 'a#b.png'), 'encoded-name')
    await fs.writeFile(join(root, 'vector.svg'), '<svg/>')
    await fs.writeFile(join(root, 'absolute.jpg'), 'absolute-image')
    const content = `![one](a%23b.png)\n\n![two](vector.svg#node)\n\n![three](${pathToFileURL(join(root, 'absolute.jpg')).href})`
    const source = join(root, 'paths.md')
    await fs.writeFile(source, content)
    const result = await insert(source, content)
    expect(result.baseContent).toBe('![one](images/1.png)\n\n![two](images/2.svg#node)\n\n![three](images/3.jpg)')
    expect(result.imagePaths).toEqual(['images/4.png'])
    expect(await fs.readFile(join(root, 'paths', 'images', '1.png'), 'utf8')).toBe('encoded-name')
  })

  it('does not replace a regular file named images in an existing document folder', async () => {
    const folder = join(root, 'paper')
    await fs.mkdir(folder)
    await fs.writeFile(join(folder, 'paper.md'), 'original')
    await fs.writeFile(join(folder, 'images'), 'unrelated')
    await expect(insert(join(folder, 'paper.md'), 'edited')).rejects.toThrow('images 必须是普通文件夹')
    expect(await fs.readFile(join(folder, 'paper.md'), 'utf8')).toBe('original')
    expect(await fs.readFile(join(folder, 'images'), 'utf8')).toBe('unrelated')
  })

  it('keeps self-links pointing to the relocated Markdown instead of its deleted old path', async () => {
    const source = join(root, 'self.md')
    const content = '[返回](self.md#摘要)'
    await fs.writeFile(source, content)
    const result = await insert(source, content)
    expect(result.baseContent).toBe('[返回](self.md#摘要)')
  })

  it('preserves query-only links to the current Markdown', async () => {
    const source = join(root, 'self.md')
    const content = '[self](?view=raw#intro)'
    await fs.writeFile(source, content)
    expect((await insert(source, content)).baseContent).toBe(content)
  })

  it('works on destinations without hard-link support, such as removable FAT volumes', async () => {
    const source = join(root, 'paper.md')
    await fs.writeFile(source, 'source')
    vi.mocked(fs.link).mockRejectedValue(new Error('Hard links are not supported'))
    const result = await insert(source, 'edited')
    expect(await fs.readFile(result.path, 'utf8')).toContain('edited')
    expect(await fs.readFile(join(root, 'paper', 'images', '1.png'))).toEqual(Buffer.from(png.data))
    await expect(fs.access(source)).rejects.toThrow()
  })

  it.each(['paper', 'paper (2)'])('saves a new document directly into an existing matching folder %s', async name => {
    const folder = join(root, name)
    await fs.mkdir(folder)
    const source = join(folder, 'paper.md')
    const result = await insert(source, 'new content', { allowNew: true })
    expect(result.path).toBe(source)
    expect(await fs.readFile(source, 'utf8')).toContain('new content')
    expect(await fs.readdir(join(folder, 'images'))).toEqual(['1.png'])
  })
})
