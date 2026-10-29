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
      // KaTeX positions tags absolutely. Rasterizing a shrink-to-fit wrapper
      // puts them on top of the formula; keep the number as selectable text.
      const raster = formula.cloneNode(true) as HTMLElement
      const tag = raster.querySelector('.tag')
      tag?.remove()
      const { dataUrl, width } = await renderImage(raster.outerHTML)
      const image = document.createElement('img')
      image.className = 'katex-pdf-img'
      image.src = dataUrl
      image.alt = formula.querySelector('annotation')?.textContent || '数学公式'
      image.style.width = `${Math.round(width)}px`
      if (tag) {
        const label = document.createElement('span')
        label.className = 'katex-equation-number katex'
        // Keep automatic CSS counters, math-styled tags and aligned rows.
        label.append(...tag.childNodes)
        formula.replaceWith(image, label)
      } else {
        formula.replaceWith(image)
      }
    } catch {
      // Leave the original KaTeX markup available if rasterization fails.
    }
  }
  return container.innerHTML
}
