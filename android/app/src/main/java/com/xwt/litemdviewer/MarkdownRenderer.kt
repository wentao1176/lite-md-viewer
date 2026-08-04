package com.xwt.litemdviewer

import android.content.Context
import io.noties.markwon.Markwon
import io.noties.markwon.ext.gfm.GfmPlugin
import io.noties.markwon.image.ImagesPlugin
import io.noties.markwon.katex.KaTeXPlugin
import io.noties.markwon.syntax.highlight.Prism4jThemeDarkula
import io.noties.markwon.syntax.highlight.Prism4jThemeGithub
import io.noties.markwon.syntax.highlight.SyntaxHighlightPlugin

/**
 * Markdown 渲染器：基于 Markwon（GFM + 代码高亮 + LaTeX 公式 + 图片）
 */
object MarkdownRenderer {

    @Volatile
    private var markwonCache: Markwon? = null
    @Volatile
    private var cachedDark: Boolean? = null

    fun get(context: Context, dark: Boolean): Markwon {
        val cached = markwonCache
        if (cached != null && cachedDark == dark) return cached

        val markwon = Markwon.builder(context)
            .usePlugin(GfmPlugin.create())                                    // 表格/删除线/任务列表
            .usePlugin(ImagesPlugin.create(context))                          // 图片
            .usePlugin(SyntaxHighlightPlugin.create(
                if (dark) Prism4jThemeDarkula() else Prism4jThemeGithub()
            ))                                                               // 代码高亮
            .usePlugin(KaTeXPlugin.create())                                  // LaTeX 公式
            .build()

        markwonCache = markwon
        cachedDark = dark
        return markwon
    }

    /** 渲染为完整 HTML 文档（用于导出 PDF），带主题内联样式 */
    fun renderToHtml(context: Context, markdown: String, dark: Boolean): String {
        val css = if (dark) DARK_CSS else LIGHT_CSS
        val body = get(context, dark).toHtml(markdown)
        return buildString {
            append("<!DOCTYPE html><html><head><meta charset=\"UTF-8\">")
            append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">")
            append("<style>$css</style></head><body><article class=\"markdown-body\">")
            append(body)
            append("</article></body></html>")
        }
    }

    private const val LIGHT_CSS = """
        body { margin:0; padding:0; background:#faf7f2; color:#3d3a34; font-family:sans-serif; }
        .markdown-body { max-width:820px; margin:0 auto; padding:24px 20px; line-height:1.8; font-size:16px; }
        h1,h2,h3,h4,h5,h6 { margin:1.2em 0 .5em; font-weight:600; line-height:1.4; }
        h1 { font-size:1.8em; border-bottom:1px solid #e5ded4; padding-bottom:.3em; }
        h2 { font-size:1.4em; border-bottom:1px solid #e5ded4; padding-bottom:.25em; }
        p { margin:.8em 0; }
        a { color:#8a7b6f; text-decoration:none; }
        blockquote { margin:1em 0; padding:.6em 1em; border-left:3px solid #8a7b6f; background:#efe9e2; border-radius:0 12px 12px 0; color:#6f6a61; }
        code { background:#f5f1ea; padding:2px 6px; border-radius:6px; font-family:monospace; font-size:.9em; }
        pre { background:#f5f1ea; padding:14px 16px; border-radius:12px; overflow-x:auto; line-height:1.6; white-space:pre-wrap; word-break:break-word; }
        pre code { background:none; padding:0; }
        table { width:100%; border-collapse:collapse; margin:1em 0; }
        th,td { border:1px solid #e5ded4; padding:8px 14px; text-align:left; }
        th { background:#f3eee7; }
        tr:nth-child(even) { background:#f7f3ec; }
        hr { border:none; border-top:1px solid #e5ded4; margin:1.6em 0; }
        ul,ol { padding-left:1.5em; }
        img { max-width:100%; border-radius:12px; }
        blockquote > * { margin:.3em 0; }
    """

    private const val DARK_CSS = """
        body { margin:0; padding:0; background:#2a2724; color:#ddd6cd; font-family:sans-serif; }
        .markdown-body { max-width:820px; margin:0 auto; padding:24px 20px; line-height:1.8; font-size:16px; }
        h1,h2,h3,h4,h5,h6 { margin:1.2em 0 .5em; font-weight:600; line-height:1.4; }
        h1 { font-size:1.8em; border-bottom:1px solid #46403a; padding-bottom:.3em; }
        h2 { font-size:1.4em; border-bottom:1px solid #46403a; padding-bottom:.25em; }
        p { margin:.8em 0; }
        a { color:#c0b2a4; text-decoration:none; }
        blockquote { margin:1em 0; padding:.6em 1em; border-left:3px solid #c0b2a4; background:#3a3530; border-radius:0 12px 12px 0; color:#a89f93; }
        code { background:#37332e; padding:2px 6px; border-radius:6px; font-family:monospace; font-size:.9em; }
        pre { background:#37332e; padding:14px 16px; border-radius:12px; overflow-x:auto; line-height:1.6; white-space:pre-wrap; word-break:break-word; }
        pre code { background:none; padding:0; }
        table { width:100%; border-collapse:collapse; margin:1em 0; }
        th,td { border:1px solid #46403a; padding:8px 14px; text-align:left; }
        th { background:#322e2a; }
        tr:nth-child(even) { background:#2e2a26; }
        hr { border:none; border-top:1px solid #46403a; margin:1.6em 0; }
        ul,ol { padding-left:1.5em; }
        img { max-width:100%; border-radius:12px; }
        blockquote > * { margin:.3em 0; }
    """
}
