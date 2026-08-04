package com.xwt.litemdviewer

import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.xwt.litemdviewer.ui.theme.LiteMdViewerTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {

    private var markdownContent by mutableStateOf(DEFAULT_MARKDOWN)
    private var currentFileName by mutableStateOf("欢迎使用")

    private val openDocLauncher =
        registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
            if (uri != null) loadUri(uri)
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            LiteMdViewerTheme {
                MainScreen(
                    fileName = currentFileName,
                    onOpenFile = { openDocLauncher.launch(arrayOf("text/markdown", "text/x-markdown", "text/plain", "application/octet-stream")) },
                    onExportPdf = { exportPdf() },
                    onLoadExample = {
                        markdownContent = DEFAULT_MARKDOWN
                        currentFileName = "示例文档"
                    },
                    markdown = markdownContent
                )
            }
        }
        handleIntent(intent)
    }

    // singleTask 模式下，后续打开的文档走这里
    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: android.content.Intent?) {
        val uri = intent?.data ?: return
        loadUri(uri)
    }

    private fun loadUri(uri: Uri) {
        try {
            currentFileName = queryDisplayName(uri) ?: "文档"
            lifecycleScope.launch {
                val text = withContext(Dispatchers.IO) {
                    contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }
                }
                markdownContent = text ?: ""
                if (text == null) toast("读取文件失败")
            }
        } catch (e: Exception) {
            toast("打开失败: ${e.message}")
        }
    }

    private fun queryDisplayName(uri: Uri): String? {
        return try {
            contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (idx >= 0 && cursor.moveToFirst()) cursor.getString(idx) else null
            }
        } catch (e: Exception) {
            uri.lastPathSegment
        }
    }

    private fun exportPdf() {
        val html = MarkdownRenderer.renderToHtml(this, markdownContent, isDarkMode())
        PdfExporter.export(this, currentFileName, html)
        toast("正在生成 PDF...")
    }

    private fun isDarkMode(): Boolean {
        val mode = resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK
        return mode == android.content.res.Configuration.UI_MODE_NIGHT_YES
    }

    private fun toast(msg: String) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
    }

    companion object {
        const val DEFAULT_MARKDOWN = """# 欢迎使用 lite-md-viewer

轻量、高级、开箱即用的 **Markdown 预览器**。

## 功能

- GFM 表格、删除线、任务列表
- 代码语法高亮（C/Rust/Python 等 26 种语言）
- LaTeX 数学公式（KaTeX）
- 导出 PDF

### 代码示例

```rust
fn main() {
    let nums: Vec<i32> = (1..=10).collect();
    let sum: i32 = nums.iter().sum();
    println!("Sum: {}", sum);
}
```

### 表格

| 功能 | 状态 |
|------|------|
| 打开 .md 文件 | 支持 |
| 导出 PDF | 支持 |
| 代码高亮 | 支持 |

### 数学公式

行内公式：$E = mc^2$

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

> 提示：点击右上角按钮可打开手机上的 .md 文件，或导出 PDF。
"""
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    fileName: String,
    markdown: String,
    onOpenFile: () -> Unit,
    onExportPdf: () -> Unit,
    onLoadExample: () -> Unit
) {
    val dark = isSystemInDarkTheme()
    val markdownRenderer = remember { MarkdownRenderer }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(fileName, fontWeight = FontWeight.SemiBold) }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // 工具栏
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Button(onClick = onOpenFile, modifier = Modifier.weight(1f)) {
                    Text("打开 .md")
                }
                Spacer(Modifier.width(8.dp))
                OutlinedButton(onClick = onExportPdf, modifier = Modifier.weight(1f)) {
                    Text("导出 PDF")
                }
                Spacer(Modifier.width(8.dp))
                OutlinedButton(onClick = onLoadExample, modifier = Modifier.weight(1f)) {
                    Text("示例")
                }
            }
            HorizontalDivider()

            // 渲染区：AndroidView 桥接 Markwon TextView
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.background)
            ) {
                AndroidView(
                    factory = { ctx ->
                        TextView(ctx).apply {
                            textSize = 16f
                            setPadding(32, 24, 32, 48)
                        }
                    },
                    update = { tv ->
                        val markwon = markdownRenderer.get(tv.context, dark)
                        markwon.setMarkdown(tv, markdown)
                        tv.setTextColor(
                            ContextCompat.getColor(
                                tv.context,
                                if (dark) android.R.color.white else android.R.color.black
                            )
                        )
                        tv.setBackgroundColor(
                            if (dark) 0xFF2A2724.toInt() else 0xFFFAF7F2.toInt()
                        )
                    }
                )
            }
        }
    }
}
