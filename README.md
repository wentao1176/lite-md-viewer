# lite-md-viewer

> 轻量、高级、开箱即用的跨平台 Markdown 预览器 — 免费 & 开源 (MIT)

[![GitHub release](https://img.shields.io/github/v/release/xwt/lite-md-viewer)](https://github.com/xwt/lite-md-viewer/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-brightgreen)]()
[![Electron](https://img.shields.io/badge/Electron-33-blue)]()

---

## 特性

- **实时预览** — 源码/预览双栏实时渲染，所见即所得
- **明暗主题** — 浅色 / 暗色 / 暖色三套主题，一键切换
- **代码高亮** — Shiki 引擎，与 VSCode 一致的语法高亮质量（30+ 语言）
- **LaTeX 公式** — KaTeX 数学公式，块级 + 行内
- **Mermaid 图表** — 流程图、时序图、甘特图、类图等
- **自动目录** — 提取文档标题，侧边栏导航
- **一键复制** — 所有代码块悬停显示复制按钮
- **图片放大** — 点击图片弹出全屏预览
- **完全离线** — 零数据收集、零遥测，隐私友好

## 安装

### Windows

从 [Releases](https://github.com/xwt/lite-md-viewer/releases) 下载 `lite-md-viewer-Setup-x.x.x.exe`，双击安装即可。

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
git clone https://github.com/xwt/lite-md-viewer.git
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

MIT © [xwt](https://github.com/xwt)
