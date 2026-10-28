import { describe, expect, it } from 'vitest'
import { embedKatexFonts } from './export-fonts'

const fonts: Array<[string, string]> = [
  ['KaTeX_Main-Regular.woff2', 'data:font/woff2;base64,bWFpbg=='],
  ['KaTeX_Main-BoldItalic.woff2', 'data:font/woff2;base64,Ym9sZA==']
]

describe('standalone KaTeX font embedding', () => {
  it.each([
    'url(fonts/KaTeX_Main-Regular.woff2) format("woff2"),url(fonts/KaTeX_Main-Regular.woff) format("woff")',
    'url(/assets/KaTeX_Main-Regular-B22Nviop.woff2) format("woff2"),url(/assets/KaTeX_Main-Regular-other.ttf) format("truetype")',
    'url("/assets/KaTeX_Main-Regular-B22Nviop.woff2") format("woff2")'
  ])('embeds a font from unbundled or rewritten font URLs: %s', (sources) => {
    const result = embedKatexFonts(`@font-face{font-family:KaTeX_Main;src:${sources};font-weight:400}`, fonts)
    expect(result).toContain('src:url("data:font/woff2;base64,bWFpbg==") format("woff2")')
    expect(result).not.toContain('/assets/')
    expect(result).not.toContain('fonts/')
    expect(result).toContain('font-weight:400')
  })

  it('keeps bold-italic fonts distinct from regular fonts', () => {
    const result = embedKatexFonts('@font-face{src:url(/assets/KaTeX_Main-BoldItalic-hash.woff2)}', fonts)
    expect(result).toContain('base64,Ym9sZA==')
    expect(result).not.toContain('base64,bWFpbg==')
  })

  it('preserves already embedded sources and unrelated CSS', () => {
    const css = '@font-face{src:url(data:font/woff2;base64,bWFpbg==) format("woff2")} p{color:red}'
    expect(embedKatexFonts(css, fonts)).toBe(css)
  })

  it('removes external fallbacks when Vite has already inlined the first source', () => {
    const css = '@font-face{src:url(data:font/woff2;base64,bWFpbg==) format("woff2"),url(/assets/KaTeX_Main-Regular-hash.woff) format("woff"),url(/assets/KaTeX_Main-Regular-hash.ttf) format("truetype");font-weight:400}'
    const result = embedKatexFonts(css, fonts)
    expect(result).not.toContain('/assets/')
    expect(result).toContain('src:url("data:font/woff2;base64,bWFpbg==") format("woff2")')
    expect(result).toContain(';font-weight:400')
  })
})
