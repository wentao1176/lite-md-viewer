// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { MarkdownRenderer } from './renderer'

const renderer = new MarkdownRenderer({ enableHighlight: false, sanitize: true })

describe('Markdown mathematical notation', () => {
  it.each(['file:///D:/pictures/photo.png', 'D:/pictures/photo.png'])('keeps local image URI %s available for embedding', async src => {
    const html = await renderer.render(`![local](${src})`)
    const container = document.createElement('div')
    container.innerHTML = html
    expect(container.querySelector('img')?.getAttribute('src')).toBe(src)
  })

  it('continues rejecting script URLs while supporting local images', async () => {
    const html = await renderer.render('<img src="javascript:alert(1)"><a href="javascript:alert(1)">link</a>')
    expect(html).not.toContain('javascript:')
  })
  it.each([
    ['dollar inline', '$E = mc^2$', '.katex-inline'],
    ['LaTeX inline', String.raw`\(\frac{a}{b} + \sqrt{x}\)`, '.katex-inline'],
    ['dollar display', String.raw`$$\int_0^1 x^2\,dx$$`, '.katex-block'],
    ['LaTeX display', String.raw`\[\sum_{i=1}^n i = \frac{n(n+1)}{2}\]`, '.katex-block'],
    ['inline display', String.raw`结果为 \[x^2 + y^2 = z^2\]。`, '.katex-display'],
    ['double dollar in prose', '结果为 $$x^2 + y^2 = z^2$$。', '.katex-display'],
    ['math fence', '```math\n\\frac{1}{2}\n```', '.katex-block'],
    ['latex fence', '```latex\n\\sqrt{2}\n```', '.katex-block'],
    ['tex fence', '```tex\n\\alpha + \\beta\n```', '.katex-block'],
    ['wrapped latex fence', '```latex\n\\[\\sqrt{2}\\]\n```', '.katex-block'],
    ['wrapped math fence', '```math\n$$\\frac{1}{2}$$\n```', '.katex-block'],
    ['starred align', String.raw`\begin{align*}
a &= b + c \\
d &= e + f
\end{align*}`, '.katex-block'],
    ['equation with nested matrix', String.raw`\begin{equation}
A = \begin{pmatrix}1 & 2 \\ 3 & 4\end{pmatrix}
\end{equation}`, '.katex-block'],
    ['starred gather', String.raw`\begin{gather*}
x = 1 \\
y = 2
\end{gather*}`, '.katex-block'],
    ['cases', String.raw`$$f(x) = \begin{cases}x^2 & x \ge 0 \\ -x & x < 0\end{cases}$$`, '.katex-block'],
    ['matrix environment', String.raw`\begin{Bmatrix}a & b \\ c & d\end{Bmatrix}`, '.katex-block']
  ])('renders %s as a formula', async (_name, markdown, selector) => {
    const container = document.createElement('div')
    container.innerHTML = await renderer.render(markdown)
    expect(container.querySelector(selector)).not.toBeNull()
    expect(container.querySelector('.katex-html')).not.toBeNull()
    expect(container.querySelector('.katex-error')).toBeNull()
    expect(container.querySelector('pre')).toBeNull()
  })

  it('renders all delimiter styles together in one document', async () => {
    const html = await renderer.render(String.raw`$a$ and \(b\)

$$c$$

\[d\]`)
    const container = document.createElement('div')
    container.innerHTML = html
    expect(container.querySelectorAll('.katex')).toHaveLength(4)
  })

  it('keeps literal examples inside inline and ordinary fenced code', async () => {
    const html = await renderer.render('`$a$` and `\\(b\\)`\n\n```text\n\\[c\\]\n\\begin{align}x &= y\\end{align}\n```')
    expect(html).not.toContain('katex')
    expect(html).toContain('<code>$a$</code>')
    expect(html).toContain('\\begin{align}')
  })

  it('keeps escaped delimiters and prices as text', async () => {
    const html = await renderer.render(String.raw`\$5 and \$10; $5.00 and $10.00; \\(x\\)`)
    expect(html).not.toContain('katex')
    expect(html).toContain('$5.00 and $10.00')
  })

  it('preserves malformed formulas without breaking surrounding Markdown', async () => {
    const html = await renderer.render(String.raw`before $\frac{1}{$ after

# Still a heading`)
    expect(html).toContain('katex-error')
    expect(html).toContain('before')
    expect(html).toContain('Still a heading')
  })

  it('keeps unclosed and non-mathematical environments as text', async () => {
    const html = await renderer.render(String.raw`\begin{align*}
x &= y

\begin{document}ordinary text\end{document}`)
    expect(html).not.toContain('katex')
    expect(html).toContain('ordinary text')
  })

  it('allows math rendering to be disabled', async () => {
    const plain = new MarkdownRenderer({ enableKatex: false, enableHighlight: false })
    const html = await plain.render('$x$\n\n```math\n\\frac{1}{2}\n```')
    expect(html).not.toContain('katex')
    expect(html).toContain('\\frac{1}{2}')
  })

  it('retains source location for display formulas', async () => {
    const html = await renderer.render('# Title\n\n\\[x^2\\]')
    const container = document.createElement('div')
    container.innerHTML = html
    expect(container.querySelector('.katex-block')?.getAttribute('data-line')).toBe('3')
  })

  it.each([String.raw`\[x\] trailing text`, '$$x$$ trailing text'])('keeps text after a line-start display formula: %s', async (markdown) => {
    const html = await renderer.render(markdown)
    expect(html).toContain('trailing text')
    expect(html).toContain('katex-display')
  })

  it('ignores closing markers in LaTeX comments', async () => {
    const html = await renderer.render(String.raw`\begin{align*}
% \end{align*}
x &= y
\end{align*}`)
    expect(html).toContain('katex-html')
    expect(html).not.toContain('katex-error')
  })

  it.each([
    String.raw`> \begin{align*}
> x &= y \\
> a &= b
> \end{align*}`,
    String.raw`- A formula:

  \[
  \begin{pmatrix}a & b \\ c & d\end{pmatrix}
  \]`
  ])('renders mathematical blocks inside Markdown containers', async (markdown) => {
    const html = await renderer.render(markdown)
    expect(html).toContain('katex-html')
    expect(html).not.toContain('katex-error')
  })

  it('keeps a full LaTeX document as source code', async () => {
    const html = await renderer.render('```latex\n\\documentclass{article}\n\\begin{document}Text\\end{document}\n```')
    expect(html).not.toContain('katex')
    expect(html).toContain('<pre>')
  })

  it('preserves equation numbers', async () => {
    const html = await renderer.render('$$x = y$$ (1)')
    const container = document.createElement('div')
    container.innerHTML = html
    expect(container.querySelector('.katex-equation-number')?.textContent).toBe('(1)')
  })

  it('does not consume ordinary fenced code while searching for an unclosed formula', async () => {
    const html = await renderer.render('\\[x\n\n```text\nclosing \\]\n```\n\nlast paragraph')
    expect(html).toContain('<pre>')
    expect(html).toContain('closing \\]')
    expect(html).toContain('last paragraph')
    expect(html).not.toContain('katex')
  })

  it('does not pull text from outside a list into an unclosed formula', async () => {
    const html = await renderer.render('- \\[x\n\noutside \\] suffix')
    const container = document.createElement('div')
    container.innerHTML = html
    expect(container.querySelector('li')?.textContent).not.toContain('outside')
    expect(container.querySelector('ul + p')?.textContent).toContain('outside')
    expect(html).toContain('suffix')
  })

  it('renders multiline native inline delimiters', async () => {
    const html = await renderer.render(String.raw`\(a +
b\)`)
    expect(html).toContain('katex-inline')
    expect(html).not.toContain('katex-error')
  })

  it.each([
    String.raw`\begin{align*}
x &= y
\end{align*} % a LaTeX comment`,
    String.raw`\[
x = y
\] % a LaTeX comment`
  ])('accepts comments after a mathematical block', async (markdown) => {
    const html = await renderer.render(markdown)
    expect(html).toContain('<div class="katex-block"')
    expect(html).toContain('katex-html')
    expect(html).not.toContain('katex-error')
  })

  it('handles a large document with many unfinished environments', async () => {
    const plain = new MarkdownRenderer({ enableHighlight: false })
    const html = await plain.render('\\begin{align*}\nx &= y\n'.repeat(5000) + '\n# Last heading')
    expect(html).not.toContain('katex')
    expect(html).toContain('Last heading')
  })

  it('ignores closing brackets inside comments in multiline inline math', async () => {
    const html = await renderer.render(String.raw`Value \(a % \) is a comment
b + c\) and the rest`)
    expect(html).toContain('katex-inline')
    expect(html).not.toContain('katex-error')
    expect(html).toContain('<mi>b</mi>')
    expect(html).toContain('and the rest')
  })
})
