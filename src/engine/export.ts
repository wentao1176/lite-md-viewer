// 导出引擎：将渲染后的 Markdown HTML 组装为独立可打印/可分发的完整 HTML
import katexCss from 'katex/dist/katex.min.css?inline'

// KaTeX 字体：全部内联为 base64 data URI，保证导出 PDF 中公式字体正确渲染
// （?inline 让 Vite 返回 data: URL）
import kfAms from 'katex/dist/fonts/KaTeX_AMS-Regular.woff2?inline'
import kfCalB from 'katex/dist/fonts/KaTeX_Caligraphic-Bold.woff2?inline'
import kfCalR from 'katex/dist/fonts/KaTeX_Caligraphic-Regular.woff2?inline'
import kfFraB from 'katex/dist/fonts/KaTeX_Fraktur-Bold.woff2?inline'
import kfFraR from 'katex/dist/fonts/KaTeX_Fraktur-Regular.woff2?inline'
import kfMainB from 'katex/dist/fonts/KaTeX_Main-Bold.woff2?inline'
import kfMainBI from 'katex/dist/fonts/KaTeX_Main-BoldItalic.woff2?inline'
import kfMainI from 'katex/dist/fonts/KaTeX_Main-Italic.woff2?inline'
import kfMainR from 'katex/dist/fonts/KaTeX_Main-Regular.woff2?inline'
import kfMathBI from 'katex/dist/fonts/KaTeX_Math-BoldItalic.woff2?inline'
import kfMathI from 'katex/dist/fonts/KaTeX_Math-Italic.woff2?inline'
import kfSansB from 'katex/dist/fonts/KaTeX_SansSerif-Bold.woff2?inline'
import kfSansI from 'katex/dist/fonts/KaTeX_SansSerif-Italic.woff2?inline'
import kfSansR from 'katex/dist/fonts/KaTeX_SansSerif-Regular.woff2?inline'
import kfScrpR from 'katex/dist/fonts/KaTeX_Script-Regular.woff2?inline'
import kfSize1 from 'katex/dist/fonts/KaTeX_Size1-Regular.woff2?inline'
import kfSize2 from 'katex/dist/fonts/KaTeX_Size2-Regular.woff2?inline'
import kfSize3 from 'katex/dist/fonts/KaTeX_Size3-Regular.woff2?inline'
import kfSize4 from 'katex/dist/fonts/KaTeX_Size4-Regular.woff2?inline'
import kfTypeR from 'katex/dist/fonts/KaTeX_Typewriter-Regular.woff2?inline'

const KATEX_FONTS: Array<[string, string]> = [
  ['KaTeX_AMS-Regular.woff2', kfAms],
  ['KaTeX_Caligraphic-Bold.woff2', kfCalB],
  ['KaTeX_Caligraphic-Regular.woff2', kfCalR],
  ['KaTeX_Fraktur-Bold.woff2', kfFraB],
  ['KaTeX_Fraktur-Regular.woff2', kfFraR],
  ['KaTeX_Main-Bold.woff2', kfMainB],
  ['KaTeX_Main-BoldItalic.woff2', kfMainBI],
  ['KaTeX_Main-Italic.woff2', kfMainI],
  ['KaTeX_Main-Regular.woff2', kfMainR],
  ['KaTeX_Math-BoldItalic.woff2', kfMathBI],
  ['KaTeX_Math-Italic.woff2', kfMathI],
  ['KaTeX_SansSerif-Bold.woff2', kfSansB],
  ['KaTeX_SansSerif-Italic.woff2', kfSansI],
  ['KaTeX_SansSerif-Regular.woff2', kfSansR],
  ['KaTeX_Script-Regular.woff2', kfScrpR],
  ['KaTeX_Size1-Regular.woff2', kfSize1],
  ['KaTeX_Size2-Regular.woff2', kfSize2],
  ['KaTeX_Size3-Regular.woff2', kfSize3],
  ['KaTeX_Size4-Regular.woff2', kfSize4],
  ['KaTeX_Typewriter-Regular.woff2', kfTypeR]
]

// 把 katex.min.css 里的相对字体路径替换为内联 data URI
function inlineKatexFonts(css: string): string {
  let out = css
  for (const [file, uri] of KATEX_FONTS) {
    out = out.split(`fonts/${file}`).join(uri)
  }
  return out
}

export type ExportTheme = 'light' | 'dark'

// 与 App.vue 全局 CSS 变量保持一致的导出主题
const THEME_CSS: Record<ExportTheme, string> = {
  light: `
    --bg-primary: #faf7f2;
    --bg-secondary: #f3eee7;
    --bg-tertiary: #ebe4db;
    --text-primary: #3d3a34;
    --text-secondary: #6f6a61;
    --text-tertiary: #a39c90;
    --border-color: #e5ded4;
    --accent-color: #8a7b6f;
    --accent-hover: #6f6257;
    --accent-soft: #efe9e2;
    --code-bg: #f5f1ea;`,
  dark: `
    --bg-primary: #2a2724;
    --bg-secondary: #322e2a;
    --bg-tertiary: #3a3530;
    --text-primary: #ddd6cd;
    --text-secondary: #a89f93;
    --text-tertiary: #7a7268;
    --border-color: #46403a;
    --accent-color: #c0b2a4;
    --accent-hover: #d4c9bd;
    --accent-soft: #3a3530;
    --code-bg: #37332e;`
}

const MARKDOWN_CSS = `
  /* html 背景会延伸到整页边缘（canvas background），body 跟随 */
  html, body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
    -webkit-font-smoothing: antialiased;
    line-height: 1.8;
  }

  /* 无打印边距，让页面背景铺满整页 */
  @page {
    margin: 0;
  }

  .markdown-body {
    max-width: none;
    margin: 0 auto;
    padding: 40px 48px;
    font-size: 15px;
    line-height: 1.8;
    color: var(--text-primary);
  }

  .markdown-body h1, .markdown-body h2, .markdown-body h3,
  .markdown-body h4, .markdown-body h5, .markdown-body h6 {
    margin-top: 1.6em;
    margin-bottom: 0.6em;
    font-weight: 600;
    line-height: 1.4;
    color: var(--text-primary);
  }
  .markdown-body h1 { font-size: 1.9em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.35em; }
  .markdown-body h2 { font-size: 1.45em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
  .markdown-body h3 { font-size: 1.22em; }
  .markdown-body h4 { font-size: 1.1em; }

  .markdown-body p { margin: 0.9em 0; }

  .markdown-body a {
    color: var(--accent-color);
    text-decoration: none;
  }

  .markdown-body blockquote {
    margin: 1.2em 0;
    padding: 0.8em 1.2em;
    border-left: 3px solid var(--accent-color);
    background: var(--accent-soft);
    border-radius: 0 12px 12px 0;
    color: var(--text-secondary);
  }

  .markdown-body code:not(pre code) {
    padding: 2px 7px;
    font-size: 0.88em;
    background: var(--accent-soft);
    border-radius: 6px;
    font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  }

  .markdown-body table {
    width: 100%;
    margin: 1.2em 0;
    border-collapse: separate;
    border-spacing: 0;
    border: 1px solid var(--border-color);
    border-radius: 12px;
    overflow: hidden;
  }
  .markdown-body th, .markdown-body td {
    padding: 11px 18px;
    border: 1px solid var(--border-color);
    text-align: left;
  }
  .markdown-body th { background: var(--bg-secondary); font-weight: 600; }
  .markdown-body tr:nth-child(even) { background: var(--bg-secondary); }

  .markdown-body hr {
    margin: 2.2em 0;
    border: none;
    border-top: 1px solid var(--border-color);
  }

  .markdown-body ul, .markdown-body ol { padding-left: 1.6em; margin: 0.6em 0; }
  .markdown-body li { margin: 0.35em 0; }

  .markdown-body input[type="checkbox"] { margin-right: 0.5em; }

  .markdown-body .code-block-wrapper {
    margin: 1.2em 0;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--border-color);
    background: var(--code-bg);
    page-break-inside: avoid;
  }
  .markdown-body .code-block-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 7px 14px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    font-size: 12px;
  }
  .markdown-body .code-lang {
    color: var(--text-secondary);
    font-weight: 500;
    text-transform: uppercase;
    font-size: 10.5px;
    letter-spacing: 0.5px;
  }
  .markdown-body .copy-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    border: 1px solid var(--border-color);
    border-radius: 7px;
    background: var(--bg-primary);
    color: var(--text-secondary);
    font-size: 11px;
    cursor: pointer;
  }
  .markdown-body .copy-btn svg { flex-shrink: 0; }
  .markdown-body .code-block-body { display: flex; }
  .markdown-body .line-numbers {
    display: flex;
    flex-direction: column;
    padding: 13px 10px 13px 14px;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border-color);
    color: var(--text-tertiary);
    font-size: 12.5px;
    line-height: 1.7;
    text-align: right;
    min-width: 44px;
    user-select: none;
    font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  }
  .markdown-body pre {
    flex: 1;
    margin: 0;
    padding: 13px 18px;
    overflow-x: auto;
    font-size: 13px;
    line-height: 1.7;
    background: var(--code-bg) !important;
  }
  .markdown-body pre code {
    background: none !important;
    padding: 0 !important;
    font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  }

  .markdown-body .katex-block {
    margin: 1.4em 0;
    text-align: center;
    overflow-x: auto;
    padding: 4px 0;
    page-break-inside: avoid;
  }
  .markdown-body .katex-inline { display: inline; }

  /* PDF 公式图片（高清 PNG） */
  .markdown-body .katex-pdf-img {
    max-width: 100%;
    vertical-align: middle;
  }
  .markdown-body .katex-pdf-inline-img {
    max-width: 100%;
    vertical-align: -0.32em;
    height: 1.25em;
  }

  .markdown-body .mermaid-container {
    margin: 1.2em 0;
    padding: 20px;
    background: var(--bg-secondary);
    border-radius: 12px;
    border: 1px solid var(--border-color);
    text-align: center;
    overflow-x: auto;
    page-break-inside: avoid;
  }
  .markdown-body .mermaid-container svg { max-width: 100%; }

  .markdown-body img.md-image {
    max-width: 100%;
    border-radius: 12px;
  }

  @media print {
    .markdown-body {
      max-width: none;
      padding: 36px 44px;
      font-size: 14px;
      line-height: 1.7;
    }

    .markdown-body pre {
      padding: 12px 16px;
      font-size: 12.5px;
    }

    .markdown-body .line-numbers {
      padding: 12px 8px 12px 12px;
      min-width: 36px;
    }

    .markdown-body table {
      font-size: 13.5px;
    }
  }
`

export function buildExportHtml(
  markdownHtml: string,
  theme: ExportTheme,
  title?: string,
  options: { mermaidDark?: boolean; bg?: 'white' | 'cream'; fontFamily?: string } = {}
): string {
  const docTitle = title || 'lite-md-viewer 导出文档'
  const mermaidFix = options.mermaidDark
    ? `
  /* 深色渲染的 Mermaid 图表反色为浅色 */
  .mermaid-container {
    background: #faf7f2 !important;
  }
  .mermaid-container svg {
    filter: invert(0.92) hue-rotate(180deg);
  }`
    : ``

  // 背景模式：纯白 / 米白
  const bgFix =
    options.bg === 'white'
      ? `
  /* 纯白背景：覆盖米白变量 */
  :root {
    --bg-primary: #ffffff;
    --bg-secondary: #ffffff;
    --bg-tertiary: #f7f5f2;
    --code-bg: #faf8f5;
    --border-color: #ece7e0;
  }`
      : ``

  // 跟随预览选择的字体
  const fontFix = options.fontFamily
    ? `
  html, body, .markdown-body {
    font-family: ${options.fontFamily};
  }`
    : ``

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${docTitle}</title>
<style>
:root {
  ${THEME_CSS[theme]}
  --radius-md: 12px;
}
${bgFix}
${MARKDOWN_CSS}
${mermaidFix}
${fontFix}
${inlineKatexFonts(katexCss)}
</style>
</head>
<body>
<div class="markdown-body">
${markdownHtml}
</div>
</body>
</html>`
}
