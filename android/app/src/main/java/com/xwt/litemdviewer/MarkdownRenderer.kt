package com.xwt.litemdviewer

import android.content.Context
import android.util.Base64
import io.noties.markwon.Markwon
import io.noties.markwon.ext.latex.JLatexMathPlugin
import io.noties.markwon.ext.strikethrough.StrikethroughPlugin
import io.noties.markwon.ext.tables.TablePlugin
import io.noties.markwon.ext.tasklist.TaskListPlugin
import io.noties.markwon.image.ImagesPlugin
import org.commonmark.ext.gfm.strikethrough.StrikethroughExtension
import org.commonmark.ext.gfm.tables.TablesExtension
import org.commonmark.parser.Parser
import org.commonmark.renderer.html.HtmlRenderer
import java.io.File

/**
 * Markdown 渲染器：
 * - 预览：Markwon（表格/删除线/任务列表/图片/代码高亮/LaTeX）
 * - 导出：commonmark-java 转为 HTML（纯 JVM，不依赖视图）
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
            .usePlugin(StrikethroughPlugin.create())                          // 删除线
            .usePlugin(TablePlugin.create(context))                               // 表格
            .usePlugin(TaskListPlugin.create(context))                        // 任务列表
            .usePlugin(ImagesPlugin.create())                                 // 图片（默认支持 data:/file:/http: scheme）
            .usePlugin(JLatexMathPlugin.create(1.0f))                         // LaTeX 公式
            .build()

        markwonCache = markwon
        cachedDark = dark
        return markwon
    }

    /** 渲染为完整 HTML 文档（用于导出 PDF），带主题内联样式 */
    fun renderToHtml(markdown: String, dark: Boolean): String {        val extensions = listOf(
            TablesExtension.create(),
            StrikethroughExtension.create()
        )
        val parser = Parser.builder().extensions(extensions).build()
        val renderer = HtmlRenderer.builder().extensions(extensions).build()
        val document = parser.parse(markdown)
        val body = renderer.render(document)

        val css = if (dark) DARK_CSS else LIGHT_CSS
        return buildString {
            append("<!DOCTYPE html><html><head><meta charset=\"UTF-8\">")
            append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">")
            append("<style>$css</style></head><body><article class=\"markdown-body\">")
            append(body)
            append("</article></body></html>")
        }
    }

    /** 相对路径图片 → data URI（基于 md 文件所在目录解析；预览与导出共用） */
    fun resolveRelativeImages(markdown: String, mdDir: String?): String {
        if (mdDir.isNullOrBlank()) return markdown
        val regex = Regex("""!\[([^\]]*)\]\(([^)]+)\)""")
        return regex.replace(markdown) { m ->
            val alt = m.groupValues[1]
            val src = m.groupValues[2].trim()
            if (src.startsWith("http://") || src.startsWith("https://") ||
                src.startsWith("data:") || src.startsWith("file://") && !File(src.removePrefix("file://")).isAbsolute
            ) {
                m.value
            } else {
                val file = File(mdDir, src.removePrefix("file://"))
                if (file.isFile) {
                    try {
                        val bytes = file.readBytes()
                        val mime = when (file.extension.lowercase()) {
                            "png" -> "image/png"
                            "jpg", "jpeg" -> "image/jpeg"
                            "gif" -> "image/gif"
                            "webp" -> "image/webp"
                            "bmp" -> "image/bmp"
                            else -> null // svg 等 BitmapFactory 不支持的保持原样
                        }
                        if (mime != null) {
                            val b64 = Base64.encodeToString(bytes, Base64.DEFAULT)
                            "![$alt](data:$mime;base64,$b64)"
                        } else {
                            m.value
                        }
                    } catch (e: Exception) {
                        m.value
                    }
                } else {
                    m.value
                }
            }
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
        input[type=checkbox] { width:16px; height:16px; }
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
        input[type=checkbox] { width:16px; height:16px; }
    """
}
