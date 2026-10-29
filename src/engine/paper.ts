/** Add presentation structure without rewriting the user's Markdown. */
export function formatPaperLayout(html: string): string {
  const root = document.createElement('div')
  root.innerHTML = html
  const headingPattern = /^H[1-6]$/
  const headingName = (element: Element) => element.textContent?.replace(/\s+/g, '').toLowerCase()
  const sectionNames = new Map([
    ['摘要', 'paper-abstract'], ['abstract', 'paper-abstract'],
    ['参考文献', 'paper-references'], ['references', 'paper-references']
  ])
  const firstHeading = Array.from(root.children).find(element =>
    headingPattern.test(element.tagName) || element.matches('.paper-abstract, .paper-references'))
  if (firstHeading?.tagName === 'H1' && !sectionNames.has(headingName(firstHeading) || '')) {
    firstHeading.classList.add('paper-title')
  }

  // Preserve headings, source lines and anchors inside semantic sections.
  for (const heading of Array.from(root.children)) {
    const className = sectionNames.get(headingName(heading) || '')
    if (!headingPattern.test(heading.tagName) || !className) continue
    const section = document.createElement('section')
    section.className = className
    heading.before(section)
    let node: ChildNode | null = heading
    const rank = Number(heading.tagName[1])
    while (node) {
      if (node !== heading && node instanceof Element && headingPattern.test(node.tagName) && Number(node.tagName[1]) <= rank) break
      const next: ChildNode | null = node.nextSibling
      section.append(node)
      node = next
    }
  }

  for (const paragraph of root.querySelectorAll('p')) {
    if (paragraph.closest('svg')) continue
    if (/^(?:关键词|关键字|key\s*words)\s*[:：]/i.test(paragraph.textContent?.trim() || '')) {
      paragraph.classList.add('paper-keywords')
    }
  }

  const isCaption = (element: Element | null, kind: 'figure' | 'table') => {
    if (element?.tagName !== 'P' || (element.textContent?.length || 0) > 100) return false
    const text = element.textContent?.trim() || ''
    if (/[。！？]|[.!?]\s*$/.test(text)) return false
    return (kind === 'figure'
      ? /^(?:图\s*\d+(?:[.．-]\d+)*|(?:figure|fig\.?)\s*\d+(?:\.\d+)*)(?:[\s:：、．]+)\S/i
      : /^(?:表\s*\d+(?:[.．-]\d+)*|table\s*\d+(?:\.\d+)*)(?:[\s:：、．]+)\S/i).test(text)
  }
  for (const paragraph of Array.from(root.querySelectorAll('p'))) {
    if (paragraph.closest('svg, figure, .katex-block') || paragraph.textContent?.trim()) continue
    const images = paragraph.querySelectorAll('img:not(.katex-pdf-img)')
    if (images.length !== 1 || paragraph.children.length !== 1) continue
    const figure = document.createElement('figure')
    for (const attribute of paragraph.attributes) figure.setAttribute(attribute.name, attribute.value)
    figure.classList.add('paper-figure')
    const next = paragraph.nextElementSibling
    let caption: HTMLElement | null = null
    if (isCaption(next, 'figure')) {
      caption = document.createElement('figcaption')
      for (const attribute of next!.attributes) caption.setAttribute(attribute.name, attribute.value)
      caption.innerHTML = next!.innerHTML
      next!.remove()
    } else {
      const candidate = document.createElement('p')
      candidate.textContent = images[0].getAttribute('alt') || ''
      if (isCaption(candidate, 'figure')) {
        caption = document.createElement('figcaption')
        caption.textContent = candidate.textContent
      }
    }
    figure.append(...paragraph.childNodes)
    if (caption) figure.append(caption)
    paragraph.replaceWith(figure)
  }
  for (const table of root.querySelectorAll('table')) {
    if (table.closest('svg') || table.caption) continue
    const candidate = isCaption(table.previousElementSibling, 'table') ? table.previousElementSibling : table.nextElementSibling
    if (!isCaption(candidate, 'table')) continue
    const caption = table.createCaption()
    for (const attribute of candidate!.attributes) caption.setAttribute(attribute.name, attribute.value)
    caption.innerHTML = candidate!.innerHTML
    candidate!.remove()
  }
  return root.innerHTML
}
