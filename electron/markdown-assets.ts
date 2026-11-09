import { parser } from '@lezer/markdown'
import { normalizeReference, unescapeAll } from 'markdown-it/lib/common/utils.mjs'
import { protectMarkdownMath } from './markdown-math'

type ResourceKind = 'image' | 'link'
type MarkdownNode = ReturnType<typeof parser.parse>['topNode']
interface SourceRange { from: number; to: number }
interface Resource extends SourceRange {
  kind: ResourceKind
  syntax: 'markdown' | 'html'
  quote?: string
}
interface Edit extends SourceRange { insert: string }

/**
 * Replace only parsed destinations, retaining the original Markdown source.
 * The callback receives unescaped text, with percent escapes still intact so
 * encoded filename characters remain distinguishable from URL delimiters.
 */
export async function rewriteMarkdownResources(
  content: string,
  rewrite: (url: string, kind: ResourceKind) => Promise<string>
): Promise<{ content: string; mapPosition(position: number): number }> {
  const resources: Resource[] = []
  const html: SourceRange[] = []
  const definitions: { label: string; resource: Resource }[] = []
  const imageReferences: { label: string; from: number }[] = []
  const { tree, referenceLabels } = resourceTree(content, protectMarkdownMath(content))

  tree.iterate({ enter(ref) {
    const node = ref.node
    if (node.name === 'Image' || node.name === 'Link' || node.name === 'Autolink') {
      const destination = node.getChild('URL')
      // Email autolinks omit "mailto:" in source; that URL is not a file path.
      if (node.name === 'Autolink' && destination && !content.slice(destination.from, destination.to).includes(':')) return false
      if (destination) {
        resources.push({ from: destination.from, to: destination.to, syntax: 'markdown', kind: node.name === 'Image' ? 'image' : 'link' })
      } else if (node.name === 'Image') {
        const label = imageReferenceLabel(content, node)
        if (label) imageReferences.push({ label, from: node.from })
      }
      // Nested links or HTML in an image's alt text are not rendered resources.
      // Unresolved image-like text, however, still renders its nested resources.
      if (node.name === 'Image' && isRenderedImage(content, node, referenceLabels)) return false
    } else if (node.name === 'LinkReference') {
      const destination = node.getChild('URL')
      const label = node.getChild('LinkLabel')
      if (destination && label) {
        const resource: Resource = { from: destination.from, to: destination.to, syntax: 'markdown', kind: 'link' }
        definitions.push({ label: readLabel(content, node, label.from + 1, label.to - 1), resource })
        resources.push(resource)
      }
      return false
    } else if (node.name === 'HTMLBlock' || node.name === 'HTMLTag') {
      html.push({ from: node.from, to: node.to })
      return false
    } else if (node.name === 'FencedCode' || node.name === 'CodeBlock' || node.name === 'InlineCode') {
      return false
    }
  } })

  const protectedRanges = collectHtmlResources(content, html, resources)
  const isProtected = (position: number) => protectedRanges.some(range => position >= range.from && position < range.to)
  const firstDefinitions = new Map<string, Resource>()
  for (const definition of definitions) {
    if (!isProtected(definition.resource.from) && !firstDefinitions.has(definition.label)) {
      firstDefinitions.set(definition.label, definition.resource)
    }
  }
  for (const reference of imageReferences) {
    const definition = !isProtected(reference.from) && firstDefinitions.get(reference.label)
    if (definition) definition.kind = 'image'
  }

  const edits: Edit[] = []
  resources.sort((left, right) => left.from - right.from)
  // Source order also makes asynchronous, numbered asset migration deterministic.
  for (const resource of resources) {
    if (isProtected(resource.from)) continue
    const raw = content.slice(resource.from, resource.to)
    const angleWrapped = resource.syntax === 'markdown' && raw.startsWith('<') && raw.endsWith('>')
    const url = resource.syntax === 'html'
      ? decodeHtmlEntities(raw)
      : unescapeAll(angleWrapped ? raw.slice(1, -1) : raw)
    const replacement = await rewrite(url, resource.kind)
    // Preserve spelling, escapes, whitespace and quoting for untouched URLs.
    if (replacement === url) continue
    let insert = encodeUrl(replacement)
    if (resource.syntax === 'markdown') {
      insert = insert.replace(/[()]/g, character => character === '(' ? '%28' : '%29')
      insert = insert.replace(/&/g, '&amp;')
      if (angleWrapped) insert = `<${insert}>`
    } else {
      insert = insert.replace(/&/g, '&amp;')
      if (resource.quote === "'") insert = insert.replace(/'/g, '&#39;')
      if (!resource.quote) insert = insert.replace(/[='`]/g, character => `&#${character.charCodeAt(0)};`)
    }
    edits.push({ from: resource.from, to: resource.to, insert })
  }

  let offset = 0
  const pieces: string[] = []
  for (const edit of edits) {
    pieces.push(content.slice(offset, edit.from), edit.insert)
    offset = edit.to
  }
  pieces.push(content.slice(offset))
  return {
    content: pieces.join(''),
    mapPosition(position) {
      position = Math.max(0, Math.min(position, content.length))
      let delta = 0
      for (const edit of edits) {
        if (position < edit.from) break
        if (position < edit.to) {
          // Keep a cursor's relative character offset, bounded by the new URL.
          return edit.from + delta + Math.min(position - edit.from, edit.insert.length)
        }
        delta += edit.insert.length - (edit.to - edit.from)
      }
      return position + delta
    }
  }
}

function resourceTree(content: string, parseSource: string): { tree: ReturnType<typeof parser.parse>; referenceLabels: Set<string> } {
  const tree = parser.parse(parseSource)
  const referenceLabels = new Set<string>()
  tree.iterate({ enter(ref) {
    if (ref.name === 'LinkReference') {
      const label = ref.node.getChild('LinkLabel')
      if (label) referenceLabels.add(readLabel(content, ref.node, label.from + 1, label.to - 1))
      return false
    }
  } })
  const masks: Edit[] = []
  tree.iterate({ enter(ref) {
    if (ref.name !== 'Image') return
    if (!isRenderedImage(content, ref.node, referenceLabels)) return
    const close = ref.node.getChildren('LinkMark').find(mark => content.slice(mark.from, mark.to) === ']')
    if (close) {
      const from = ref.from + 2
      const alt = parseSource.slice(from, close.from)
      if (/[\[\]]/.test(alt)) masks.push({ from, to: close.from, insert: alt.replace(/[\[\]]/g, ' ') })
    }
    return false
  } })
  if (!masks.length) return { tree, referenceLabels }
  // Lezer can deactivate an enclosing link on seeing another link in image alt
  // text. Mask those brackets for parsing only, keeping all source offsets.
  let position = 0
  const pieces: string[] = []
  for (const mask of masks) {
    pieces.push(parseSource.slice(position, mask.from), mask.insert)
    position = mask.to
  }
  pieces.push(parseSource.slice(position))
  return { tree: parser.parse(pieces.join('')), referenceLabels }
}

function imageReferenceLabel(content: string, node: MarkdownNode): string {
  const explicit = node.getChild('LinkLabel')
  if (explicit && explicit.to - explicit.from > 2) {
    return readLabel(content, node, explicit.from + 1, explicit.to - 1)
  }
  const marks = node.getChildren('LinkMark')
  // Empty inline destinations are inline images rather than shortcut references.
  if (!explicit && hasInlineDestination(content, node)) return ''
  const close = marks.find(mark => content.slice(mark.from, mark.to) === ']')
  return close ? readLabel(content, node, node.from + 2, close.from) : ''
}

function hasInlineDestination(content: string, node: MarkdownNode): boolean {
  return node.getChildren('LinkMark').some(mark => content.slice(mark.from, mark.to) === '(')
}

function isRenderedImage(content: string, node: MarkdownNode, referenceLabels: Set<string>): boolean {
  return !!node.getChild('URL') || hasInlineDestination(content, node) || referenceLabels.has(imageReferenceLabel(content, node))
}

function readLabel(content: string, node: MarkdownNode, from: number, to: number): string {
  let text = ''
  let offset = from
  const visit = (parent: MarkdownNode) => {
    for (let child = parent.firstChild; child; child = child.nextSibling) {
      if (child.from >= to) break
      if (child.to <= from) continue
      if (child.name === 'QuoteMark' || child.name === 'ListMark') {
        text += content.slice(offset, child.from)
        offset = child.to
      } else {
        visit(child)
      }
    }
  }
  visit(node)
  // Reference labels intentionally retain entity/backslash spelling, matching
  // the renderer's reference resolution rather than visible alt text.
  return normalizeReference(text + content.slice(offset, to))
}

function encodeUrl(url: string): string {
  return encodeURI(url).replace(/%25([\da-f]{2})/gi, '%$1')
}

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(?:#[xX][\da-fA-F]+|#\d+|[a-zA-Z][\da-zA-Z]+);/g, entity => unescapeAll(entity))
}

function collectHtmlResources(content: string, ranges: SourceRange[], resources: Resource[]): SourceRange[] {
  const protectedRanges: SourceRange[] = []
  const protectedTags = new Set(['script', 'style', 'pre', 'code', 'textarea', 'title', 'xmp'])
  let protectedTag: { name: string; from: number } | undefined
  for (const range of ranges) {
    let position = range.from
    while (position < range.to) {
      if (protectedTag) {
        // Script strings and code examples can contain incomplete tags/quotes.
        // Look only for the protected element's closing tag in their contents.
        const closing = new RegExp(`</${protectedTag.name}(?=[\\t\\n\\f\\r />])`, 'i')
        const match = closing.exec(content.slice(position, range.to))
        if (!match) break
        const end = htmlTagEnd(content, position + match.index + match[0].length, range.to)
        if (end < 0) break
        protectedRanges.push({ from: protectedTag.from, to: end })
        protectedTag = undefined
        position = end
        continue
      }
      const start = content.indexOf('<', position)
      if (start < 0 || start >= range.to) break
      if (content.startsWith('<!--', start) || content.startsWith('<![CDATA[', start)) {
        const ending = content.startsWith('<!--', start) ? '-->' : ']]>'
        const end = content.indexOf(ending, start + 4)
        position = end < 0 ? range.to : end + ending.length
        continue
      }
      const match = /^<(\/?)([a-zA-Z][\w:-]*)(?=[\t\n\f\r />])/.exec(content.slice(start, range.to))
      if (!match) {
        position = start + 1
        continue
      }
      const end = htmlTagEnd(content, start + match[0].length, range.to)
      if (end < 0) break
      position = end
      const name = match[2].toLowerCase()
      const closing = match[1] === '/'
      if (!closing) {
        if (protectedTags.has(name)) protectedTag = { name, from: start }
        else if (name === 'img' || name === 'source' || name === 'a') {
          collectHtmlAttributes(content, name, start + match[0].length, end - 1, resources)
        }
      }
    }
  }
  if (protectedTag) protectedRanges.push({ from: protectedTag.from, to: content.length })
  return protectedRanges
}

function htmlTagEnd(content: string, from: number, to: number): number {
  let quote = ''
  for (let position = from; position < to; position++) {
    const character = content[position]
    if (quote) {
      if (character === quote) quote = ''
    } else if (character === '"' || character === "'") quote = character
    else if (character === '>') return position + 1
  }
  return -1
}

function collectHtmlAttributes(content: string, tag: string, from: number, to: number, resources: Resource[]): void {
  const attributes = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g
  const text = content.slice(from, to)
  for (const match of text.matchAll(attributes)) {
    const name = match[1].toLowerCase()
    if (match[2] === undefined && match[3] === undefined && match[4] === undefined) continue
    const quote = match[2] !== undefined ? '"' : match[3] !== undefined ? "'" : ''
    const raw = match[2] ?? match[3] ?? match[4]
    const valueFrom = from + match.index! + match[0].indexOf('=') + 1
    const start = valueFrom + content.slice(valueFrom, to).search(/\S/) + (quote ? 1 : 0)
    if ((tag === 'img' && name === 'src') || (tag === 'a' && name === 'href')) {
      resources.push({ from: start, to: start + raw.length, syntax: 'html', kind: tag === 'img' ? 'image' : 'link', quote })
    } else if ((tag === 'img' || tag === 'source') && name === 'srcset') {
      collectSrcset(content, start, start + raw.length, quote, resources)
    }
  }
}

function collectSrcset(content: string, from: number, to: number, quote: string, resources: Resource[]): void {
  const { value, sourceOffsets } = decodeSrcset(content.slice(from, to))
  let position = 0
  while (position < value.length) {
    while (position < value.length && /[\t\n\f\r ,]/.test(value[position])) position++
    const start = position
    // Commas inside URLs are allowed (notably data URLs); only trailing commas
    // terminate a URL without descriptors, as in the HTML srcset algorithm.
    while (position < value.length && !/[\t\n\f\r ]/.test(value[position])) position++
    let end = position
    while (end > start && value[end - 1] === ',') end--
    if (end > start) resources.push({ from: from + sourceOffsets[start], to: from + sourceOffsets[end], syntax: 'html', kind: 'image', quote })
    if (end < position) continue
    let parentheses = 0
    while (position < value.length) {
      const character = value[position++]
      if (character === '(') parentheses++
      else if (character === ')') parentheses = Math.max(0, parentheses - 1)
      else if (character === ',' && !parentheses) break
    }
  }
}

function decodeSrcset(raw: string): { value: string; sourceOffsets: number[] } {
  let value = ''
  let sourcePosition = 0
  const sourceOffsets = [0]
  const appendPlain = (to: number) => {
    value += raw.slice(sourcePosition, to)
    while (sourcePosition < to) sourceOffsets.push(++sourcePosition)
  }
  for (const match of raw.matchAll(/&(?:#[xX][\da-fA-F]+|#\d+|[a-zA-Z][\da-zA-Z]+);/g)) {
    appendPlain(match.index!)
    const decoded = unescapeAll(match[0])
    value += decoded
    const end = sourcePosition + match[0].length
    for (let index = 1; index <= decoded.length; index++) {
      sourceOffsets.push(index === decoded.length ? end : sourcePosition)
    }
    sourcePosition = end
  }
  appendPlain(raw.length)
  return { value, sourceOffsets }
}
