import type MarkdownIt from 'markdown-it'
import type { RuleBlock } from 'markdown-it/lib/parser_block.mjs'
import katex from 'katex'
import texmath from 'markdown-it-texmath'

const MATH_ENVIRONMENT = /^\\begin\{((?:equation|align|alignat|gather)\*?|aligned|alignedat|gathered|split|cases|rcases|(?:p|b|B|v|V)?matrix|smallmatrix|array)\}/
const FAILED_BLOCKS = Symbol('failed-math-blocks')

function isEscaped(source: string, position: number): boolean {
  let slashes = 0
  while (position > 0 && source[--position] === '\\') slashes++
  return slashes % 2 === 1
}

function beforeComment(source: string): string {
  let position = source.indexOf('%')
  while (position >= 0) {
    if (!isEscaped(source, position)) return source.slice(0, position)
    position = source.indexOf('%', position + 1)
  }
  return source
}

function findUnescaped(source: string, delimiter: string, start = 0): number {
  let position = source.indexOf(delimiter, start)
  while (position >= 0 && isEscaped(source, position)) position = source.indexOf(delimiter, position + delimiter.length)
  return position
}

function findMathClosing(source: string, delimiter: string, start: number, limit: number): number {
  for (let line = start; line < limit;) {
    const newline = source.indexOf('\n', line)
    const end = newline < 0 ? limit : Math.min(newline, limit)
    const position = findUnescaped(beforeComment(source.slice(line, end)), delimiter)
    if (position >= 0) return line + position
    line = end + 1
  }
  return -1
}

const mathDelimitedBlock: RuleBlock = (state, startLine, endLine, silent) => {
  if (state.sCount[startLine] - state.blkIndent >= 4) return false
  const start = state.bMarks[startLine] + state.tShift[startLine]
  const opening = state.src.startsWith('$$', start) ? '$$'
    : state.src.startsWith('\\[', start) ? '\\[' : ''
  if (!opening) return false
  const closing = opening === '$$' ? '$$' : '\\]'
  const failures: Set<string> = state.env[FAILED_BLOCKS] ||= new Set<string>()
  const cacheKey = (line: number) => `${opening}:${line}:${endLine}:${state.blkIndent}`
  if (failures.has(cacheKey(startLine))) return false
  const candidateLines = [startLine]
  const lines: string[] = []

  for (let line = startLine; line < endLine; line++) {
    if (!state.isEmpty(line) && state.sCount[line] < state.blkIndent) break
    let content = state.getLines(line, line + 1, state.blkIndent, false)
    if (line > startLine && /^\s*(?:`{3,}|~{3,})/.test(content)) break
    if (line === startLine) content = content.trimStart().slice(opening.length)
    const visible = beforeComment(content)
    const end = findUnescaped(visible, closing)
    if (end >= 0) {
      const suffix = content.slice(end + closing.length)
      const number = /^\s*(?:\(([^)\n]+)\))?\s*$/.exec(beforeComment(suffix))
      if (!number) return false
      if (silent) return true
      lines.push(content.slice(0, end))
      const token = state.push(number[1] ? 'math_block_eqno' : 'math_block', 'math', 0)
      token.block = true
      token.content = lines.join('\n').trim()
      token.info = number[1] || ''
      token.map = [startLine, line + 1]
      state.line = line + 1
      return true
    }
    if (line > startLine && visible.trimStart().startsWith(opening)) candidateLines.push(line)
    lines.push(content)
  }
  for (const line of candidateLines) failures.add(cacheKey(line))
  return false
}

// Parse environments as Markdown blocks rather than replacing raw source text,
// so code spans, code fences, blockquotes and list indentation remain intact.
const mathEnvironment: RuleBlock = (state, startLine, endLine, silent) => {
  if (state.sCount[startLine] - state.blkIndent >= 4) return false
  const start = state.bMarks[startLine] + state.tShift[startLine]
  const opening = MATH_ENVIRONMENT.exec(state.src.slice(start, state.eMarks[startLine]))
  if (!opening) return false

  const environment = opening[1]
  const failures: Set<string> = state.env[FAILED_BLOCKS] ||= new Set<string>()
  const cacheKey = (line: number) => `${environment}:${line}:${endLine}:${state.blkIndent}`
  if (failures.has(cacheKey(startLine))) return false
  const commands = /\\(begin|end)\{([^{}]+)\}/g
  const lines: string[] = []
  const unmatched: number[] = []

  for (let line = startLine; line < endLine; line++) {
    if (!state.isEmpty(line) && state.sCount[line] < state.blkIndent) break
    const content = state.getLines(line, line + 1, state.blkIndent, false)
    if (line > startLine && /^\s*(?:`{3,}|~{3,})/.test(content)) break
    lines.push(content)
    commands.lastIndex = 0
    const visible = beforeComment(content)
    let command: RegExpExecArray | null
    while ((command = commands.exec(visible))) {
      if (isEscaped(content, command.index)) continue
      if (command[2] !== environment) continue
      if (command[1] === 'begin') unmatched.push(line)
      else unmatched.pop()
      if (unmatched.length !== 0) continue
      // A block must finish on its closing line; do not discard trailing prose.
      if (beforeComment(content.slice(commands.lastIndex)).trim()) return false
      if (silent) return true
      const token = state.push('math_block', 'math', 0)
      token.block = true
      token.content = lines.join('\n').trim()
      token.map = [startLine, line + 1]
      state.line = line + 1
      return true
    }
  }
  // Remember every still-unmatched opener, so malformed large documents do
  // not rescan the rest of the file for each paragraph-termination check.
  for (const line of unmatched) failures.add(cacheKey(line))
  return false
}

export function renderMath(md: MarkdownIt, source: string, displayMode: boolean, line?: number, equationNumber?: string): string {
  let formula: string
  try {
    formula = katex.renderToString(source, {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
      trust: false
    })
  } catch {
    formula = `<span class="katex-error">${md.utils.escapeHtml(source)}</span>`
  }
  const location = line ? ` data-line="${line}"` : ''
  const number = equationNumber ? `<span class="katex-equation-number">(${md.utils.escapeHtml(equationNumber)})</span>` : ''
  return displayMode
    ? `<div class="katex-block"${location}>${formula}${number}</div>\n`
    : `<span class="katex-inline">${formula}</span>`
}

export function setupMath(md: MarkdownIt): void {
  md.use(texmath, {
    engine: katex,
    delimiters: 'dollars',
    katexOptions: { throwOnError: false, strict: 'ignore', trust: false }
  })
  // texmath's block regexes scan the whole source and discard text after a
  // closing delimiter. Our rules respect Markdown containers and retain text.
  md.block.ruler.disable(['math_block', 'math_block_eqno'])
  md.block.ruler.before('fence', 'math_delimited_block', mathDelimitedBlock, {
    alt: ['paragraph', 'reference', 'blockquote', 'list']
  })
  md.block.ruler.before('fence', 'math_environment', mathEnvironment, {
    alt: ['paragraph', 'reference', 'blockquote', 'list']
  })

  // Native LaTeX delimiters must run before Markdown's backslash escaping.
  const failedInline = new WeakMap<object, Map<string, number>>()
  md.inline.ruler.before('escape', 'math_brackets', (state, silent) => {
    const opening = state.src.slice(state.pos, state.pos + 2)
    if (opening !== '\\[' && opening !== '\\(') return false
    const closing = opening === '\\[' ? '\\]' : '\\)'
    const cacheKey = `${closing}:${state.posMax}`
    const failures = failedInline.get(state) || new Map<string, number>()
    if ((failures.get(cacheKey) ?? Infinity) <= state.pos) return false
    const end = findMathClosing(state.src, closing, state.pos + 2, state.posMax)
    if (end < 0 || end + 2 > state.posMax) {
      failures.set(cacheKey, state.pos)
      failedInline.set(state, failures)
      return false
    }
    if (!silent) {
      const token = state.push(opening === '\\[' ? 'math_inline_double' : 'math_inline', 'math', 0)
      token.content = state.src.slice(state.pos + 2, end)
    }
    state.pos = end + 2
    return true
  })

  md.renderer.rules.math_inline = (tokens, idx) => renderMath(md, tokens[idx].content, false)
  // Inline display tokens stay valid inside a paragraph, while using KaTeX's
  // display layout. The shared wrapper also lets PDF export find the formula.
  md.renderer.rules.math_inline_double = (tokens, idx) => {
    const html = renderMath(md, tokens[idx].content, true)
    return html.replace('<div class="katex-block">', '<span class="katex-block katex-display-inline">').replace('</div>\n', '</span>')
  }
  for (const type of ['math_block', 'math_block_eqno']) {
    md.renderer.rules[type] = (tokens, idx) => {
      const token = tokens[idx]
      return renderMath(md, token.content, true, token.map ? token.map[0] + 1 : undefined,
        type === 'math_block_eqno' ? token.info : undefined)
    }
  }
}
