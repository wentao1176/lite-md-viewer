export interface FormulaImage {
  dataUrl: string
  width: number
}

// Match formula elements in the DOM, including wrappers with source-line attrs
// and display formulas embedded in paragraphs. Keep equation numbers intact.
export async function replaceDisplayMathWithImages(
  html: string,
  renderImage: (formulaHtml: string) => Promise<FormulaImage>
): Promise<string> {
  const container = document.createElement('div')
  container.innerHTML = html
  const formulas = container.querySelectorAll<HTMLElement>('.katex-block .katex-display')
  if (!formulas.length) return html

  for (const formula of formulas) {
    try {
      const { dataUrl, width } = await renderImage(formula.outerHTML)
      const image = document.createElement('img')
      image.className = 'katex-pdf-img'
      image.src = dataUrl
      image.alt = formula.querySelector('annotation')?.textContent || '数学公式'
      image.style.width = `${Math.round(width)}px`
      formula.replaceWith(image)
    } catch {
      // Leave the original KaTeX markup available if rasterization fails.
    }
  }
  return container.innerHTML
}
