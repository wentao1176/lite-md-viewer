// Vite rewrites URLs inside CSS imported with ?inline to hashed asset paths.
// Match the stable KaTeX filename stem and replace the entire src declaration,
// including woff/ttf fallbacks, with one self-contained woff2 source.
export function embedKatexFonts(css: string, fonts: ReadonlyArray<readonly [string, string]>): string {
  const sources = new Map(fonts)
  return css.replace(/src\s*:\s*((?:url\([^)]*\)|format\([^)]*\)|[\s,])+)/g, (declaration, urls: string) => {
    const stem = urls.match(/KaTeX_[A-Za-z0-9]+-(?:BoldItalic|Regular|Bold|Italic)/)?.[0]
    const uri = stem ? sources.get(`${stem}.woff2`) : undefined
    return uri ? `src:url("${uri}") format("woff2")` : declaration
  })
}
