import { describe, expect, it } from 'vitest'
import MarkdownIt from 'markdown-it'
import { rewriteMarkdownResources } from './markdown-assets'

describe('rewriteMarkdownResources', () => {
  it('rewrites image and link destinations without changing surrounding source', async () => {
    const source = 'Before **![an *alt*](old.png "A title")** and [notes](docs/readme.md#part "Notes").\r\n'
    const seen: string[] = []
    const result = await rewriteMarkdownResources(source, async (url, kind) => {
      await Promise.resolve()
      seen.push(`${kind}:${url}`)
      return kind === 'image' ? 'images/1.png' : '../docs/readme.md#part'
    })

    expect(result.content).toBe('Before **![an *alt*](images/1.png "A title")** and [notes](../docs/readme.md#part "Notes").\r\n')
    expect(seen).toEqual(['image:old.png', 'link:docs/readme.md#part'])
  })

  it('preserves email autolinks while rebasing ordinary links containing @', async () => {
    const source = '<user@example.com>\n\n[download](report@x.png)\n\n<https://example.com/user@example.com>\n\n<mailto:other@example.com>'
    const seen: string[] = []
    const result = await rewriteMarkdownResources(source, async (url, kind) => {
      seen.push(`${kind}:${url}`)
      return url.includes(':') ? url : `../${encodeURIComponent(url)}`
    })

    expect(result.content).toBe('<user@example.com>\n\n[download](../report%40x.png)\n\n<https://example.com/user@example.com>\n\n<mailto:other@example.com>')
    expect(seen).toEqual([
      'link:report@x.png', 'link:https://example.com/user@example.com', 'link:mailto:other@example.com'
    ])
    const html = new MarkdownIt().render(result.content)
    expect(html).toContain('<a href="mailto:user@example.com">user@example.com</a>')
    expect(html).toContain('href="../report%40x.png"')
  })

  it('decodes Markdown escapes and entities while preserving percent escapes for the callback', async () => {
    const source = String.raw`![escaped](old/photo\(v2\).png "title")
![space](<old path/a&amp;b.png> 'title')
![hash](a%23b.png) ![fragment](a.svg#part) ![unicode](%E4%B8%AD%20%E6%96%87.png)`
    const seen: string[] = []
    const result = await rewriteMarkdownResources(source, async url => {
      seen.push(url)
      return url
    })

    expect(seen).toEqual([
      'old/photo(v2).png', 'old path/a&b.png', 'a%23b.png', 'a.svg#part', '%E4%B8%AD%20%E6%96%87.png'
    ])
    expect(result.content).toBe(source)
  })

  it('keeps replacement URLs with spaces, punctuation, and existing escapes valid', async () => {
    const source = '![plain](old.png "keep")\n![angle](<other path.png>)\n[doc](old.md)'
    const result = await rewriteMarkdownResources(source, async (url, kind) => {
      if (kind === 'link') return '../my notes/100%25.md#part'
      return url === 'old.png' ? 'images/new photo(2)&copy;.png' : 'images/encoded%20name.png'
    })

    expect(result.content).toBe('![plain](images/new%20photo%282%29&amp;copy;.png "keep")\n![angle](<images/encoded%20name.png>)\n[doc](../my%20notes/100%25.md#part)')
    const html = new MarkdownIt().render(result.content)
    expect(html).toContain('src="images/new%20photo%282%29&amp;copy;.png"')
    expect(html).toContain('src="images/encoded%20name.png"')
    expect(html).toContain('href="../my%20notes/100%25.md#part"')
  })

  it('rewrites shared, collapsed, and shortcut image reference definitions once', async () => {
    const source = String.raw`![first][Shared   Pic]
[download][shared pic]
![collapsed][] ![shortcut] ![unresolved]

[SHARED PIC]: <old folder/photo.png> "Title"
[collapsed]: old.png
[shortcut]: other.png
[manual]: docs/manual.md
[shared pic]: ignored.png
`
    const seen: string[] = []
    const result = await rewriteMarkdownResources(source, async (url, kind) => {
      seen.push(`${kind}:${url}`)
      return kind === 'image' ? `images/${seen.length}.png` : `../${url}`
    })

    expect(result.content).toBe(String.raw`![first][Shared   Pic]
[download][shared pic]
![collapsed][] ![shortcut] ![unresolved]

[SHARED PIC]: <images/1.png> "Title"
[collapsed]: images/2.png
[shortcut]: images/3.png
[manual]: ../docs/manual.md
[shared pic]: ../ignored.png
`)
    expect(seen).toEqual([
      'image:old folder/photo.png', 'image:old.png', 'image:other.png', 'link:docs/manual.md', 'link:ignored.png'
    ])
  })

  it('matches escaped and multiline reference labels inside block quotes', async () => {
    const source = String.raw`> ![Multi
>   line][] and ![alt \[bracket\]]
>
> [multi line]:
>   <old path.png>
>   "Title"
>
> [alt \[bracket\]]: other.png
`
    const result = await rewriteMarkdownResources(source, async (url, kind) => {
      expect(kind).toBe('image')
      return url === 'old path.png' ? 'images/1.png' : 'images/2.png'
    })

    expect(result.content).toBe(String.raw`> ![Multi
>   line][] and ![alt \[bracket\]]
>
> [multi line]:
>   <images/1.png>
>   "Title"
>
> [alt \[bracket\]]: images/2.png
`)
  })

  it('leaves code examples, image alt text, and unrelated Markdown untouched', async () => {
    const source = String.raw`# Examples

\!\[escaped](text.png)

` + '`![inline](inline.png) <img src="inline-html.png">`' + String.raw`

~~~md
![fenced](fenced.png)
[reference]: fenced-ref.png
<img src="fenced-html.png">
~~~

    ![indented](indented.png)
    <img src="indented-html.png">

[![alt [nested](keep.md) <img src="alt.png">](actual.png "title")](docs.md)
`
    const seen: string[] = []
    const result = await rewriteMarkdownResources(source, async (url, kind) => {
      seen.push(`${kind}:${url}`)
      return kind === 'image' ? 'images/1.png' : '../docs.md'
    })

    expect(seen).toEqual(['image:actual.png', 'link:docs.md'])
    expect(result.content).toBe(source.replace('](actual.png "title")', '](images/1.png "title")').replace('](docs.md)', '](../docs.md)'))
  })

  it('distinguishes real image alt text from unresolved image-like text containing resources', async () => {
    const source = `![literal [notes](docs.md) <img src="text.png">][missing]

![empty [not](keep.md)]()

![actual [not](also-keep.md) <img src="keep.png">][real]

[real]: real.png`
    const seen: string[] = []
    const result = await rewriteMarkdownResources(source, async (url, kind) => {
      seen.push(`${kind}:${url}`)
      return kind === 'link' ? '../docs.md' : `images/${seen.length}.png`
    })

    expect(seen).toEqual(['link:docs.md', 'image:text.png', 'image:real.png'])
    expect(result.content).toBe(`![literal [notes](../docs.md) <img src="images/2.png">][missing]

![empty [not](keep.md)]()

![actual [not](also-keep.md) <img src="keep.png">][real]

[real]: images/3.png`)
  })

  it.each([
    ['dollar inline', '$D[f](x)$'],
    ['double dollars in prose', 'Value $$D[f](x)$$ with a suffix.'],
    ['dollar block', '$$\nD[f](x)\n![not-an-image](math.png)\n$$ (1)'],
    ['dollar block with comments and blank lines', '$$\nD[f](x) % $$ [comment](comment.md)\n\n[not-a-reference]: math.png\n\nG[g](y)\n$$'],
    ['native inline', String.raw`Value \(D[f](x)\).`],
    ['native display', String.raw`\[D[f](x)\]`],
    ['native display in prose', String.raw`Value \[D[f](x)\] with a suffix.`],
    ['native multiline with a commented closing delimiter', String.raw`Value \(D[f](x) % \) [comment](comment.md)
G[g](y)\).`],
    ['native block with a commented closing delimiter', String.raw`\[
D[f](x) % \] [comment](comment.md)
G[g](y)
\] % a comment`],
    ['nested equation environment', String.raw`\begin{equation}
D[f](x) + \begin{pmatrix}G[g](y)\end{pmatrix}
\end{equation}`],
    ['nested matching environments', String.raw`\begin{align*}
% \end{align*} [comment](comment.md)
\begin{align*}D[f](x)\end{align*}
G[g](y)
\end{align*}`],
    ['quoted environment', String.raw`> \begin{gather*}
> D[f](x) \\
> G[g](y)
> \end{gather*}`],
    ['native block in a list', String.raw`- \[
  D[f](x)
  \]`],
    ['math fence', '```math\nD[f](x)\n![not-an-image](math.png)\n```'],
    ['heading formula', '# Formula $D[f](x)$'],
    ['Setext heading formula', 'Formula $D[f](x)$\n---'],
    ['HTML-looking inline formula', '$D[f](x) + <img src="math.png"> + <script>$'],
    ['CRLF block', '$$\r\nD[f](x)\r\n$$']
  ])('preserves opaque %s while rebasing links outside it', async (_name, formula) => {
    const source = `${formula}\n\n[outside](notes.md)`
    const seen: string[] = []
    const result = await rewriteMarkdownResources(source, async (url, kind) => {
      seen.push(`${kind}:${url}`)
      return `../${url}`
    })

    expect(seen).toEqual(['link:notes.md'])
    expect(result.content).toBe(`${formula}\n\n[outside](../notes.md)`)
    expect(result.mapPosition(source.indexOf('notes.md'))).toBe(source.indexOf('notes.md'))
  })

  it.each([
    ['escaped dollars', String.raw`\$[ordinary](currency.md)\$`],
    ['prices', '$5.00 [ordinary](currency.md) and $10.00'],
    ['a digit before the dollar', '1$D[ordinary](currency.md)$'],
    ['spaces inside dollar delimiters', '$ [ordinary](currency.md) $'],
    ['escaped native delimiters', String.raw`\\(D[ordinary](currency.md)\\)`],
    ['an unfinished native formula', String.raw`Value \(D[ordinary](currency.md)`],
    ['a non-mathematical environment', String.raw`\begin{document}
[ordinary](currency.md)
\end{document}`],
    ['an unfinished environment', String.raw`\begin{align*}
[ordinary](currency.md)`],
    ['an environment with trailing prose', String.raw`\begin{align}D[ordinary](currency.md)\end{align} trailing prose`],
    ['an unfinished block before code', String.raw`\[
[ordinary](currency.md)

` + '```md\n\\]\n![code](code.png)\n```'],
    ['an unfinished list formula', String.raw`- \[D[ordinary](currency.md)

outside \] suffix`]
  ])('still rewrites ordinary links near %s', async (_name, example) => {
    const source = `${example}\n\n[outside](notes.md)`
    const seen: string[] = []
    const result = await rewriteMarkdownResources(source, async (url, kind) => {
      seen.push(`${kind}:${url}`)
      return `../${url}`
    })

    expect(seen).toEqual(['link:currency.md', 'link:notes.md'])
    expect(result.content).toBe(`${example.replace('[ordinary](currency.md)', '[ordinary](../currency.md)')}\n\n[outside](../notes.md)`)
  })

  it('keeps math scoped to its table cell and rewrites ordinary links in other cells', async () => {
    const source = '| $D[f](x)$ | [outside](notes.md) |\n| --- | --- |\n| $x [ordinary](currency.md) | [other](other.md)$ |'
    const seen: string[] = []
    const result = await rewriteMarkdownResources(source, async (url, kind) => {
      seen.push(`${kind}:${url}`)
      return `../${url}`
    })

    expect(seen).toEqual(['link:notes.md', 'link:currency.md', 'link:other.md'])
    expect(result.content).toBe('| $D[f](x)$ | [outside](../notes.md) |\n| --- | --- |\n| $x [ordinary](../currency.md) | [other](../other.md)$ |')
  })

  it('excludes image uses and reference definitions inside math from reference resolution', async () => {
    const source = '$$\n![not-an-image][shared]\n[local]: math.png\n$$\n\n[shared]: docs/shared.md\n\n![unresolved][local]\n\n[outside](notes.md)'
    const seen: string[] = []
    const result = await rewriteMarkdownResources(source, async (url, kind) => {
      seen.push(`${kind}:${url}`)
      return `../${url}`
    })

    expect(seen).toEqual(['link:docs/shared.md', 'link:notes.md'])
    expect(result.content).toBe('$$\n![not-an-image][shared]\n[local]: math.png\n$$\n\n[shared]: ../docs/shared.md\n\n![unresolved][local]\n\n[outside](../notes.md)')
  })

  it('retains math protection while parsing linked images with nested alt formatting', async () => {
    const source = '$D[f](x)$\n\n[![alt [nested](keep.md)](actual.png)](docs.md)'
    const seen: string[] = []
    const result = await rewriteMarkdownResources(source, async (url, kind) => {
      seen.push(`${kind}:${url}`)
      return kind === 'image' ? 'images/1.png' : '../docs.md'
    })

    expect(seen).toEqual(['image:actual.png', 'link:docs.md'])
    expect(result.content).toBe('$D[f](x)$\n\n[![alt [nested](keep.md)](images/1.png)](../docs.md)')
  })

  it('does not interpret math-looking text inside a supported file image destination', async () => {
    const source = '![file](<file:///D:/pictures/$D[f](x)$.png>)'
    const seen: string[] = []
    const result = await rewriteMarkdownResources(source, async (url, kind) => {
      seen.push(`${kind}:${url}`)
      return 'images/1.png'
    })

    expect(seen).toEqual(['image:file:///D:/pictures/$D[f](x)$.png'])
    expect(result.content).toBe('![file](<images/1.png>)')
  })

  it('rewrites HTML image resources and normal links while preserving attribute layout and quotes', async () => {
    const source = `<picture class="photo">
  <source media='(min-width: 800px)' srcset="small.png 1x, large%20photo.png 2x">
  <IMG  alt='keep > text' SRC = 'old&amp;name.png' data-src="lazy.png" srcset='fallback.png 640w, high.png 1280w'>
</picture>

Text <img src=plain.png alt="keep"> <a href='docs/a.md#intro'>notes</a>.
`
    const seen: string[] = []
    const result = await rewriteMarkdownResources(source, async (url, kind) => {
      seen.push(`${kind}:${url}`)
      return kind === 'image' ? `images/${seen.length}.png` : '../docs/a.md#intro'
    })

    expect(result.content).toBe(`<picture class="photo">
  <source media='(min-width: 800px)' srcset="images/1.png 1x, images/2.png 2x">
  <IMG  alt='keep > text' SRC = 'images/3.png' data-src="lazy.png" srcset='images/4.png 640w, images/5.png 1280w'>
</picture>

Text <img src=images/6.png alt="keep"> <a href='../docs/a.md#intro'>notes</a>.
`)
    expect(seen).toEqual([
      'image:small.png', 'image:large%20photo.png', 'image:old&name.png',
      'image:fallback.png', 'image:high.png', 'image:plain.png', 'link:docs/a.md#intro'
    ])
  })

  it('keeps srcset data URLs intact and encodes replacements safely for HTML attributes', async () => {
    const source = `<img src='old.png' srcset="data:image/png;base64,AAAA 1x, retina.png 2x">`
    const seen: string[] = []
    const result = await rewriteMarkdownResources(source, async url => {
      seen.push(url)
      if (url.startsWith('data:')) return url
      return url === 'old.png' ? "images/a'b&copy;.png" : 'images/new photo.png'
    })

    expect(result.content).toBe(`<img src='images/a&#39;b&amp;copy;.png' srcset="data:image/png;base64,AAAA 1x, images/new%20photo.png 2x">`)
    expect(seen).toEqual(['old.png', 'data:image/png;base64,AAAA', 'retina.png'])
  })

  it('does not treat HTML comments, scripts, styles, or pre/code examples as resources', async () => {
    const source = `<!-- <img src="comment.png"> -->

<script>const example = '<img src="script.png">';</script>
<style>.example { content: '<img src="style.png">'; }</style>
<pre><code><img src="pre.png"> ![not](pre-md.png)</code></pre>

Text <code>![code](code.png) <img src="code-html.png"></code> and <script>"![inline](script-md.png) <img src='script-html.png'>";</script>.

![real](real.png)
`
    const seen: string[] = []
    const result = await rewriteMarkdownResources(source, async url => {
      seen.push(url)
      return 'images/1.png'
    })

    expect(seen).toEqual(['real.png'])
    expect(result.content).toBe(source.replace('](real.png)', '](images/1.png)'))
  })

  it('continues after script strings containing incomplete tags or comment markers', async () => {
    const source = `<script>const openingTag = '<img src="'; const comment = '<!--';</script>

![real](real.png)
`
    const seen: string[] = []
    const result = await rewriteMarkdownResources(source, async url => {
      seen.push(url)
      return 'images/1.png'
    })

    expect(seen).toEqual(['real.png'])
    expect(result.content).toBe(source.replace('](real.png)', '](images/1.png)'))
  })

  it('handles entity-encoded srcset separators without splitting data URLs', async () => {
    const source = `<source srcset="small.png&#32;1x&#44;&#32;large.png&#32;2x">
<img srcset='data:image/png;base64&#44;AAAA 1x&#44;&#32;retina.png 2x'>`
    const seen: string[] = []
    const result = await rewriteMarkdownResources(source, async url => {
      seen.push(url)
      return url.startsWith('data:') ? url : `images/${seen.length}.png`
    })

    expect(result.content).toBe(`<source srcset="images/1.png&#32;1x&#44;&#32;images/2.png&#32;2x">
<img srcset='data:image/png;base64&#44;AAAA 1x&#44;&#32;images/4.png 2x'>`)
    expect(seen).toEqual(['small.png', 'large.png', 'data:image/png;base64,AAAA', 'retina.png'])
  })

  it('maps UTF-16 selection positions through multiple edits and clamps positions inside shorter URLs', async () => {
    const source = '🙂 ![a](long-original-name.png) and [doc](a.md) tail'
    const expected = '🙂 ![a](1.png) and [doc](../docs/a.md) tail'
    const result = await rewriteMarkdownResources(source, async (_url, kind) => kind === 'image' ? '1.png' : '../docs/a.md')
    const oldStart = source.indexOf('long-original-name.png')
    const newStart = expected.indexOf('1.png')

    expect(result.content).toBe(expected)
    expect(result.mapPosition(0)).toBe(0)
    expect(result.mapPosition(2)).toBe(2)
    expect(result.mapPosition(oldStart)).toBe(newStart)
    expect(result.mapPosition(oldStart + 2)).toBe(newStart + 2)
    expect(result.mapPosition(oldStart + 12)).toBe(newStart + 5)
    expect(result.mapPosition(oldStart + 22)).toBe(newStart + 5)
    expect(result.mapPosition(source.indexOf(' and '))).toBe(expected.indexOf(' and '))
    expect(result.mapPosition(source.indexOf(') tail'))).toBe(expected.indexOf(') tail'))
    expect(result.mapPosition(source.length)).toBe(expected.length)
  })

  it('keeps positions unchanged for identity rewrites', async () => {
    const source = '🙂 ![a](<old path/a.png> "title")\r\n'
    const result = await rewriteMarkdownResources(source, async url => url)

    expect(result.content).toBe(source)
    for (let position = 0; position <= source.length; position++) {
      expect(result.mapPosition(position)).toBe(position)
    }
  })

  it('propagates an asynchronous rewrite failure', async () => {
    await expect(rewriteMarkdownResources('![missing](missing.png)', async () => {
      await Promise.resolve()
      throw new Error('Missing image')
    })).rejects.toThrow('Missing image')
  })
})
