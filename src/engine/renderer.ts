import MarkdownIt from 'markdown-it'
import { createHighlighter, type Highlighter } from 'shiki'
import katex from 'katex'
import texmath from 'markdown-it-texmath'
import DOMPurify from 'dompurify'

export interface RenderOptions {
  enableHighlight?: boolean
  enableKatex?: boolean
  enableMermaid?: boolean
  enableToc?: boolean
  enableCopyButton?: boolean
  enableLinkBlank?: boolean
  enableLineNumbers?: boolean
  sanitize?: boolean
}

let highlighter: Highlighter | null = null
let highlighterInitPromise: Promise<void> | null = null

async function getHighlighter(): Promise<Highlighter> {
  if (highlighter) return highlighter
  if (!highlighterInitPromise) {
    highlighterInitPromise = createHighlighter({
      themes: ['min-dark', 'min-light'],
      langs: [
        'javascript', 'typescript', 'python', 'rust', 'go', 'java',
        'c', 'cpp', 'csharp',
        'verilog', 'vhdl',
        'bash', 'powershell', 'cmd',
        'sql', 'json', 'yaml', 'xml', 'toml',
        'html', 'css',
        'markdown', 'latex',
        'asm', 'dockerfile', 'makefile'
      ]
    }).then(h => {
      highlighter = h
      return h
    })
  }
  return highlighterInitPromise.then(() => highlighter!)
}

export class MarkdownRenderer {
  private md: MarkdownIt
  private options: RenderOptions
  private currentTheme: 'light' | 'dark' = 'dark'

  constructor(options: RenderOptions = {}) {
    this.options = {
      enableHighlight: true,
      enableKatex: true,
      enableMermaid: true,
      enableToc: true,
      enableCopyButton: true,
      enableLinkBlank: true,
      enableLineNumbers: true,
      sanitize: false,
      ...options
    }

    this.md = new MarkdownIt({
      html: true,
      breaks: true,
      linkify: true,
      typographer: true,
      highlight: (code, lang) => {
        if (this.options.enableHighlight && lang) {
          return `<pre class="shiki-pending" data-lang="${lang}"><code>${this.md!.utils.escapeHtml(code)}</code></pre>`
        }
        return `<pre><code>${this.md!.utils.escapeHtml(code)}</code></pre>`
      }
    })

    this.setupPlugins()
  }

  setTheme(theme: 'light' | 'dark') {
    this.currentTheme = theme
  }

  private setupPlugins() {
    const defaultRender = this.md.renderer.rules.fence?.bind(this.md.renderer.rules) ||
      ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

    // 自定义 fence 渲染（支持 Mermaid）
    this.md.renderer.rules.fence = (tokens, idx, options, env, self) => {
      const token = tokens[idx]
      const lang = token.info.trim().split(/\s+/)[0]

      if (lang === 'mermaid' && this.options.enableMermaid) {
        const content = token.content
        const id = `mermaid-${Math.random().toString(36).slice(2, 10)}`
        const line = token.map ? token.map[0] + 1 : 0
        return `<div class="mermaid-container" data-mermaid-id="${id}" data-line="${line}"><pre class="mermaid">${this.md.utils.escapeHtml(content)}</pre></div>`
      }

      if (this.options.enableHighlight && lang) {
        const escaped = this.md.utils.escapeHtml(token.content)
        const lineCount = token.content.split('\n').length
        const line = token.map ? token.map[0] + 1 : 0
        let html = `<div class="code-block-wrapper" data-line="${line}">`
        
        // 语言标签
        html += `<div class="code-block-header">`
        html += `<span class="code-lang">${lang}</span>`
        if (this.options.enableCopyButton) {
          html += `<button class="copy-btn" data-code="${encodeURIComponent(token.content)}" title="复制代码">`
          html += `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`
          html += `<span class="copy-btn-text">复制</span></button>`
        }
        html += `</div>`

        // 代码内容
        if (this.options.enableLineNumbers) {
          const lines = escaped.split('\n')
          html += `<div class="code-block-body">`
          html += `<div class="line-numbers">`
          for (let i = 1; i < lineCount; i++) {
            html += `<span>${i}</span>`
          }
          html += `</div>`
          html += `<pre class="shiki-target" data-lang="${lang}"><code>${escaped}</code></pre>`
          html += `</div>`
        } else {
          html += `<pre class="shiki-target" data-lang="${lang}"><code>${escaped}</code></pre>`
        }
        
        html += `</div>`
        return html
      }

      return defaultRender(tokens, idx, options, env, self)
    }

    // KaTeX 数学公式
    if (this.options.enableKatex) {
      // 解析 $...$ / $$...$$ 为 math_inline / math_block token
      this.md.use(texmath, {
        engine: katex,
        delimiters: 'dollars',
        wrapper: 'span',
        blockWrapper: 'div',
        katexOptions: {
          throwOnError: false,
          errorColor: '#cc0000'
        }
      })

      // 块级公式 $$...$$
      this.md.renderer.rules.math_block = (tokens, idx) => {
        try {
          return `<div class="katex-block">${katex.renderToString(tokens[idx].content, {
            displayMode: true,
            throwOnError: false
          })}</div>`
        } catch {
          return `<div class="katex-error">数学公式渲染失败</div>`
        }
      }

      // 行内公式 $...$
      this.md.renderer.rules.math_inline = (tokens, idx) => {
        try {
          return `<span class="katex-inline">${katex.renderToString(tokens[idx].content, {
            displayMode: false,
            throwOnError: false
          })}</span>`
        } catch {
          return `<span class="katex-error">?</span>`
        }
      }
    }

    // 外链 target="_blank"
    if (this.options.enableLinkBlank) {
      const defaultLinkRender = this.md.renderer.rules.link_open?.bind(this.md.renderer.rules) ||
        ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

      this.md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
        const token = tokens[idx]
        const href = token.attrGet('href') || ''
        if (href.startsWith('http://') || href.startsWith('https://')) {
          token.attrSet('target', '_blank')
          token.attrSet('rel', 'noopener noreferrer')
        }
        return defaultLinkRender(tokens, idx, options, env, self)
      }
    }

    // 图片添加 data-zoomable
    const defaultImageRender = this.md.renderer.rules.image?.bind(this.md.renderer.rules) ||
      ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

    this.md.renderer.rules.image = (tokens, idx, options, env, self) => {
      const token = tokens[idx]
      token.attrSet('loading', 'lazy')
      token.attrSet('class', 'md-image zoomable')
      return defaultImageRender(tokens, idx, options, env, self)
    }

    // 缩进代码块（code_block）：与 fence 一致的样式 + data-line
    this.md.renderer.rules.code_block = (tokens, idx) => {
      const token = tokens[idx]
      const escaped = this.md.utils.escapeHtml(token.content)
      const lineCount = token.content.split('\n').length
      const line = token.map ? token.map[0] + 1 : 0

      let html = `<div class="code-block-wrapper" data-line="${line}">`
      html += `<div class="code-block-header">`
      html += `<span class="code-lang">text</span>`
      if (this.options.enableCopyButton) {
        html += `<button class="copy-btn" data-code="${encodeURIComponent(token.content)}" title="复制代码">`
        html += `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`
        html += `<span class="copy-btn-text">复制</span></button>`
      }
      html += `</div>`
      html += `<div class="code-block-body">`
      if (this.options.enableLineNumbers) {
        html += `<div class="line-numbers">`
        for (let i = 1; i < lineCount; i++) {
          html += `<span>${i}</span>`
        }
        html += `</div>`
      }
      html += `<pre><code>${escaped}</code></pre>`
      html += `</div></div>`
      return html
    }
  }

  async render(markdown: string): Promise<string> {
    const env: any = {}
    const tokens = this.md.parse(markdown, env)
    this.injectSourceLine(tokens)
    let html = this.md.renderer.render(tokens, this.md.options, env)

    if (this.options.sanitize) {
      html = DOMPurify.sanitize(html)
    }

    // 异步 Shiki 高亮
    if (this.options.enableHighlight && html.includes('shiki-target')) {
      try {
        const h = await getHighlighter()
        const themeName = this.currentTheme === 'dark' ? 'min-dark' : 'min-light'
        html = await this.applyShikiHighlight(html, h, themeName)
      } catch {
        // Shiki 失败则保留转义后的代码，无语法高亮
      }
    }

    return html
  }

  // 给所有块级 token 注入 data-line（源文件行号，1 基），用于源码⇄预览双向定位
  private injectSourceLine(tokens: any[]): void {
    for (const token of tokens) {
      // 跳过无行号信息或渲染时不读 attrs 的 token
      if (!token.map || token.type === 'inline' || token.type === 'html_block' || token.type === 'hr') continue
      token.attrSet('data-line', String(token.map[0] + 1))
    }
  }

  private async applyShikiHighlight(html: string, h: Highlighter, themeName: string): Promise<string> {
    const regex = /<pre class="shiki-target" data-lang="([^"]*)"><code>([\s\S]*?)<\/code><\/pre>/g
    const replacements: Array<{ original: string; replacement: string }> = []

    let match: RegExpExecArray | null
    while ((match = regex.exec(html)) !== null) {
      const lang = match[1]
      const code = this.decodeHtmlEntities(match[2])
      const original = match[0]

      try {
        let highlighted: string
        if (h.getLoadedLanguages().includes(lang as any)) {
          highlighted = h.codeToHtml(code, { lang, theme: themeName })
        } else {
          highlighted = h.codeToHtml(code, { lang: 'text', theme: themeName })
        }
        replacements.push({ original, replacement: highlighted })
      } catch {
        // 高亮失败则保持原样
      }
    }

    for (const { original, replacement } of replacements) {
      html = html.replace(original, replacement)
    }

    return html
  }

  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
  }

  extractToc(markdown: string): Array<{ level: number; text: string; id: string }> {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm
    const toc: Array<{ level: number; text: string; id: string }> = []
    let match: RegExpExecArray | null

    while ((match = headingRegex.exec(markdown)) !== null) {
      const level = match[1].length
      const text = match[2].trim()
      const id = text
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fff]+/g, '-')
        .replace(/^-+|-+$/g, '')
      toc.push({ level, text, id })
    }

    return toc
  }
}

// 单例
let rendererInstance: MarkdownRenderer | null = null

export function createRenderer(options?: RenderOptions): MarkdownRenderer {
  if (!rendererInstance) {
    rendererInstance = new MarkdownRenderer(options)
  }
  return rendererInstance
}

export function getRenderer(): MarkdownRenderer {
  if (!rendererInstance) {
    rendererInstance = new MarkdownRenderer()
  }
  return rendererInstance
}
