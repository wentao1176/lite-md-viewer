export function findSourceElement(root: ParentNode, line: number): HTMLElement | null {
  let best: HTMLElement | null = null
  let bestLine = 0
  for (const element of root.querySelectorAll<HTMLElement>('[data-line]')) {
    const sourceLine = Number(element.getAttribute('data-line'))
    if (sourceLine > 0 && sourceLine <= line && sourceLine >= bestLine) {
      best = element
      bestLine = sourceLine
    }
  }
  return best
}
