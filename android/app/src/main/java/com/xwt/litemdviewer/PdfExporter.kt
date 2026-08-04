package com.xwt.litemdviewer

import android.app.Activity
import android.print.PrintAttributes
import android.print.PrintManager
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * PDF 导出：WebView 加载渲染后的 HTML，通过系统打印服务另存为 PDF
 */
object PdfExporter {

    fun export(activity: Activity, title: String, html: String) {
        val webView = WebView(activity).apply {
            settings.javaScriptEnabled = false
            setBackgroundColor(0xFFFFFFFF.toInt()) // 白底打印
        }

        // 挂载到窗口（隐藏位置，不干扰界面）
        val layoutParams = android.view.ViewGroup.LayoutParams(
            android.view.ViewGroup.LayoutParams.MATCH_PARENT,
            1 // 高度 1px，几乎不可见
        )
        activity.addContentView(webView, layoutParams)

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String?) {
                try {
                    val printManager = activity.getSystemService(Activity.PRINT_SERVICE) as PrintManager
                    val attributes = PrintAttributes.Builder()
                        .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                        .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                        .build()
                    printManager.print(title, view.createPrintDocumentAdapter(title), attributes)
                } finally {
                    // 打印任务提交后延迟卸载 WebView，避免残留
                    view.postDelayed({
                        val parent = view.parent
                        if (parent is android.view.ViewGroup) parent.removeView(view)
                        view.destroy()
                    }, 3000)
                }
            }
        }

        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
    }
}
