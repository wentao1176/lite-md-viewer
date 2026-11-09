import MarkdownIt from 'markdown-it'
import { parser, Table } from '@lezer/markdown'
import { setupMath } from '../src/engine/math'

interface SourceRange { from: number; to: number }
interface MathSourceEnvironment {
  mathRanges: SourceRange[]
  sourceOffsets: number[]
  inlineState?: object
  inlineFrom: number
}

const inlineContexts = parser.configure([Table])
const mathParser = createMathSourceParser()

/** A same-length parsing view: rendered formulas cannot become Markdown URLs. */
export function protectMarkdownMath(source: string): string {
  if (!/[$\\]/.test(source)) return source
  const environment: MathSourceEnvironment = {
    mathRanges: [],
    sourceOffsets: normalizedSourceOffsets(source),
    inlineFrom: 0
  }
  // The actual block rules handle containers, comments and unfinished formulas.
  mathParser.parse(source, environment)
  const blockView = maskMathRanges(source, environment.mathRanges)
  inlineContexts.parse(blockView).iterate({ enter(node) {
    if (node.name !== 'Paragraph' && node.name !== 'TableCell' && !/^(?:ATX|Setext)Heading\d$/.test(node.name)) return
    const state = new mathParser.inline.State(blockView.slice(node.from, node.to), mathParser, environment, [])
    environment.inlineState = state
    environment.inlineFrom = node.from
    mathParser.inline.tokenize(state)
    return false
  } })
  return maskMathRanges(source, environment.mathRanges)
}

function createMathSourceParser(): MarkdownIt {
  const md = new MarkdownIt({ html: true, breaks: true, linkify: true, typographer: true })
  const originalInline = new Set(md.inline.ruler.getRules(''))
  const originalBlock = new Set(md.block.ruler.getRules(''))
  setupMath(md)
  const inlineRules = md.inline.ruler.getRules('').filter(rule => !originalInline.has(rule))
  const blockRules = md.block.ruler.getRules('').filter(rule => !originalBlock.has(rule))

  // Reuse the installed rules, including texmath's currency/escape guards.
  md.inline.ruler.disable(['math_inline', 'math_inline_double', 'math_brackets'])
  md.inline.ruler.before('escape', 'collect_math_inline', (state, silent) => {
    const from = state.pos
    for (const rule of inlineRules) {
      if (!rule(state, silent)) continue
      const environment = state.env as MathSourceEnvironment
      if (!silent && state === environment.inlineState) {
        environment.mathRanges.push({ from: environment.inlineFrom + from, to: environment.inlineFrom + state.pos })
      }
      return true
    }
    return false
  })

  md.block.ruler.disable(['math_delimited_block', 'math_environment'])
  md.block.ruler.before('fence', 'collect_math_block', (state, startLine, endLine, silent) => {
    for (const rule of blockRules) {
      if (!rule(state, startLine, endLine, silent)) continue
      if (!silent) {
        const environment = state.env as MathSourceEnvironment
        for (let line = startLine; line < state.line; line++) {
          // bMarks/tShift are adjusted by the active quote/list rules. Retain
          // those real container prefixes while hiding the formula's contents.
          const from = state.bMarks[line] + Math.max(0, state.tShift[line])
          const to = state.eMarks[line]
          if (to > from) environment.mathRanges.push({ from: environment.sourceOffsets[from], to: environment.sourceOffsets[to] })
        }
      }
      return true
    }
    return false
  }, { alt: ['paragraph', 'reference', 'blockquote', 'list'] })

  // Inline parsing is performed above against same-offset source contexts,
  // rather than stripped token contents whose positions differ in containers.
  md.core.ruler.disable(['inline', 'linkify', 'replacements', 'smartquotes', 'text_join'])
  return md
}

function normalizedSourceOffsets(source: string): number[] {
  const offsets = [0]
  for (let position = 0; position < source.length; position++) {
    if (source[position] === '\r' && source[position + 1] === '\n') position++
    offsets.push(position + 1)
  }
  return offsets
}

function maskMathRanges(source: string, ranges: SourceRange[]): string {
  if (!ranges.length) return source
  const characters = source.split('')
  for (const range of ranges) {
    let placeholder = false
    for (let position = range.from; position < range.to; position++) {
      if (/\s/.test(characters[position])) continue
      characters[position] = placeholder ? ' ' : 'x'
      placeholder = true
    }
  }
  return characters.join('')
}
