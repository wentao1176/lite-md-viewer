# lite-md-viewer

> 轻量、高级、开箱即用的跨平台 Markdown 预览器 — 免费 & 开源 (MIT)

[![GitHub release](https://img.shields.io/github/v/release/wentao1176/lite-md-viewer)](https://github.com/wentao1176/lite-md-viewer/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-brightgreen)]()
[![Electron](https://img.shields.io/badge/Electron-33-blue)]()

---

## 特性

- **实时预览** — 源码/预览双栏实时渲染，所见即所得
- **明暗主题** — 浅色 / 暗色 / 暖色三套主题，一键切换
- **代码高亮** — Shiki 引擎，与 VSCode 一致的语法高亮质量（30+ 语言）
- **LaTeX 公式** — KaTeX 数学公式，支持常见分隔符、公式代码块、矩阵、分段函数和多行对齐
- **字体选择** — 20 项中文、英文和等宽字体，记住选择并应用到预览及 HTML/PDF 导出
- **黑白作业风格** — 白纸黑字、无彩色代码高亮，图片和图表转灰度，预览与导出均可选择
- **Mermaid 图表** — 流程图、时序图、甘特图、类图等
- **自动目录** — 提取文档标题，侧边栏导航
- **一键复制** — 所有代码块悬停显示复制按钮
- **图片放大** — 点击图片弹出全屏预览
- **完全离线** — 零数据收集、零遥测，隐私友好
- **自动更新** — 发布新版本后自动检测并提示更新

## 数学公式与字体

行内公式使用 `$E = mc^2$` 或 `\(\frac{a}{b} + \sqrt{x}\)`。显示公式使用 `$$...$$` 或 `\[...\]`，可以换行书写：

```latex
\[
  \int_0^1 x^2\,dx = \frac{1}{3}
\]
```

也可以直接书写 `equation`、`align`、`align*`、`gather`、`gather*` 等数学环境，或者用 `math`、`latex`、`tex` 标记公式代码块：

````markdown
```math
f(x) = \begin{cases}
  x^2 & x \ge 0 \\
  -x & x < 0
\end{cases}
```

\begin{align*}
  (a+b)^2 &= a^2 + 2ab + b^2 \\
  A &= \begin{pmatrix}1 & 2 \\ 3 & 4\end{pmatrix}
\end{align*}
````

数学命令的支持范围见 [KaTeX 官方列表](https://katex.org/docs/supported.html)。错误公式保留原文提示，不影响其余 Markdown。行内代码和 `text` 等普通代码块中的公式示例保持源码；包含 `\documentclass` 或 `\begin{document}` 的完整 LaTeX 文档代码也保持源码展示。

工具栏字体菜单按系统默认、中文、英文和等宽字体分组，包含宋体、楷体、黑体、仿宋、微软雅黑、苹方、思源黑体/宋体、Times New Roman、Georgia、Cambria、Palatino、Arial、Segoe UI、Helvetica、Consolas、Cascadia Code、JetBrains Mono 和 Fira Code。使用本机字体，无需联网；未安装的字体会使用后备字体。选中的字体随预览及导出保存，代码和数学公式保留各自的专用字体。

## 图片与作业打印

工具栏的 **黑白作业** 按钮会切换并记住预览风格：白纸黑字、代码取消彩色高亮，图片和图表保留内容并以灰度显示。导出面板也可单独选择 **黑白作业**，自动使用白色纸张背景。

导出会内嵌本地相对路径、绝对路径、`file:`、网络及有效的 `blob:` 图片，并等待所有图片加载、解码及字体就绪后再打印，避免长文档和后面页面的懒加载图片缺失。相对图片路径以 Markdown 文件所在目录为基准；未保存的文档请先保存再导出。若图片确实无法读取或请求超时，会明确指出图片并停止导出，避免无提示地产生缺图 PDF。

## 自动更新

软件启动后会自动检查 [GitHub Releases](https://github.com/wentao1176/lite-md-viewer/releases) 是否有新版本：

- 有新版本时**后台静默下载**
- 下载完成后弹窗提示「立即重启」或「稍后再说」
- 更新包托管在 GitHub Releases，无需任何额外服务器

> 开发者：打 `git tag v1.0.1 && git push origin v1.0.1` 即自动构建并发布到 Releases

### 发布新版本（三步）

1. **本地准备**：改代码 → 升 `package.json` 的 version → 本地打包确认无误（`npm run electron:build:win`）
2. **推送触发 CI**：
   ```bash
   git add -A && git commit -m "feat: xxx"
   git push origin main
   git tag v1.0.5 && git push origin v1.0.5
   ```
3. **网页发布**：CI 会自动构建安装包并上传到 draft release（等约 5-10 分钟）→ 打开
   `https://github.com/wentao1176/lite-md-viewer/releases` → 点最新 draft 的 **Publish release**

> ⚠️ 注意：CI 构建的 release 默认是 **draft**，必须手动点 Publish 用户才能收到更新。资产会自动包含 Setup exe + latest.yml + blockmap（Windows）和 deb + AppImage（Linux）。

## 安装

### Windows

从 [Releases](https://github.com/wentao1176/lite-md-viewer/releases) 下载 `lite-md-viewer-Setup-x.x.x.exe`，双击安装即可。

### Linux

```bash
# Debian / Ubuntu
sudo dpkg -i lite-md-viewer_x.x.x_amd64.deb

# Fedora / RHEL
sudo rpm -i lite-md-viewer-x.x.x.x86_64.rpm

# AppImage (通用)
chmod +x lite-md-viewer-x.x.x.AppImage
./lite-md-viewer-x.x.x.AppImage
```

## 开发

```bash
# 克隆仓库
git clone https://github.com/wentao1176/lite-md-viewer.git
cd lite-md-viewer

# 安装依赖
npm install

# 启动开发模式
npm run dev

# 构建安装包
npm run electron:build:win    # Windows
npm run electron:build:linux  # Linux
```

## 技术栈

- **桌面框架**：Electron 33
- **前端**：Vue 3 + Vite + TypeScript
- **编辑器**：CodeMirror 6
- **Markdown 解析**：markdown-it
- **代码高亮**：Shiki
- **数学公式**：KaTeX
- **图表**：Mermaid
- **打包**：electron-builder + NSIS

## 安卓版（android/）

手机端预览器，Kotlin + Jetpack Compose + Markwon：

- 打开并渲染 .md 文件（SAF 文件选择器 + 系统"打开方式"关联）
- GFM 表格 / 代码高亮 / LaTeX 公式
- 导出 PDF（系统打印服务）
- 深色/浅色主题跟随系统

**构建方式**：用 Android Studio 打开 `android/` 目录，等待 Gradle 同步完成后运行即可（需要 Android SDK）。

| 文件 | 说明 |
|------|------|
| `android/app/src/main/java/.../MainActivity.kt` | 主界面（打开/渲染/导出） |
| `android/app/src/main/java/.../MarkdownRenderer.kt` | Markwon 渲染封装 + HTML 导出 |
| `android/app/src/main/java/.../PdfExporter.kt` | PDF 导出（WebView + PrintManager） |

## 项目结构

```
lite-md-viewer/
├── electron/          # Electron 主进程
├── src/               # Vue 3 渲染进程
│   ├── engine/        #   渲染引擎封装
│   ├── components/    #   UI 组件
│   └── App.vue        #   主布局
├── .github/workflows/ # CI/CD
└── build/             # 构建资源
```

## License

MIT © [xwt](https://github.com/wentao1176)
