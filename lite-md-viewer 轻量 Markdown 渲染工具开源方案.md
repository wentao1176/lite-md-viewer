# lite-md-viewer 轻量、高级、开箱即用的 Markdown 桌面渲染工具开源方案

## 一、项目背景与核心痛点

市面上已有 Typora、Mark Text、Obsidian、VSCode 预览等诸多 Markdown 工具，但仍存在明显缺口：

1. **Typora 已收费**：曾经最受欢迎的 Markdown 编辑器转为付费模式（$14.99），大量用户寻找免费开源替代品；
2. **现有的太重**：Obsidian 安装包 200MB+ 且捆绑 Electron + 大量插件，对仅需"打开 .md 文件看渲染效果"的用户过于臃肿；VSCode 虽免费但作为代码编辑器启动慢、不专注；
3. **Mark Text 维护停滞**：最接近理想形态的开源替代品，但近年更新缓慢、Bug 累积、部分平台兼容性差；
4. **轻量预览工具功能残缺**：Notepad3 / QuickLook 等仅支持纯文本查看，无渲染、无代码高亮、无目录导航；
5. **缺少"即装即用"的跨平台方案**：大多数工具要么仅 Windows、要么仅 macOS，Linux 用户长期被忽视。

### 竞品速览对比

| 维度 | Typora | Mark Text | Obsidian | VSCode 预览 | **lite-md-viewer** |
|------|--------|-----------|----------|-------------|---------------------|
| 价格 | **$14.99 付费** | 免费 | 免费 | 免费 | **免费 & 开源 (MIT)** |
| 安装包大小 | ~85MB | ~180MB | ~250MB | ~90MB（仅编辑器） | **< 80MB** |
| 内存占用 | ~150MB | ~300MB | ~500MB+ | ~200MB | **< 100MB（目标）** |
| 启动速度 | 快 | 中等 | 慢（插件多） | 慢 | **< 2 秒（目标）** |
| WYSIWYG 编辑 | ✅ | ✅ | ⚠️ 源码/阅读双模式 | ❌ 仅预览 | **✅ 双栏实时预览** |
| Mermaid 图表 | ✅ | ✅ | 需插件 | 需插件 | **✅ 内置** |
| KaTeX 公式 | ✅ | ✅ | 需插件 | 需插件 | **✅ 内置** |
| CLI 命令行 | ❌ | ❌ | ❌ | ❌ | **✅ 重点功能** |
| Linux 原生支持 | ⚠️ 仅 .tar.gz | ✅ AppImage | ✅ AppImage | ✅ snap | **✅ deb/rpm/AppImage** |
| 多标签页 | ✅ | ✅ | ✅ | ✅ | **✅（v1.1）** |
| 文件目录树 | ✅ | ✅ | ✅ | ✅ | **✅（v1.2）** |

## 二、项目定位

- **项目名称**：`lite-md-viewer`
- **一句话介绍**：免费、开源、极速的跨平台 Markdown 预览器——安装即用、离线运行，提供 GUI 桌面版 + CLI 命令行双模式，专为技术写作者和日常文档阅读场景打造。
- **核心定位**：轻量（安装包 < 80MB，内存 < 100MB）、启动快（< 2s）、开箱即用，面向 Typora 免费替代品赛道。
- **目标用户**：学生（实验报告 / 笔记）、技术写作者、程序员（README / 技术文档）、Linux 用户、任何需要快速预览 .md 文件的人。
- **交付产物**：
  - Windows：`.exe` 安装包（NSIS / WiX），支持开始菜单快捷方式 + 文件关联
  - Linux：`.deb` / `.rpm` / `.AppImage`，支持双击安装 + 包管理器

## 三、技术架构

### 3.1 整体分层

```text
lite-md-viewer
├── electron/                     # Electron 主进程
│   ├── main.ts                   #   主进程入口（窗口管理、文件关联、菜单）
│   ├── preload.ts                #   预加载脚本（安全暴露 IPC API）
│   ├── ipc/                      #   IPC 通信层
│   │   ├── file.ts               #     文件读写（打开、保存、拖拽）
│   │   ├── export.ts             #     导出 PDF / HTML
│   │   └── system.ts             #     系统集成（主题、通知、自动更新）
│   └── updater.ts                #   自动更新（electron-updater）
│
├── src/                          # 渲染进程（前端，复用 Web 生态）
│   ├── renderer/                 #   渲染引擎封装
│   │   ├── engine.ts             #     markdown-it 核心封装
│   │   ├── plugins/              #     内置插件
│   │   │   ├── highlight.ts      #       代码高亮（Shiki）
│   │   │   ├── katex.ts          #       LaTeX 公式
│   │   │   ├── mermaid.ts        #       Mermaid 图表
│   │   │   ├── toc.ts            #       自动目录
│   │   │   └── copy-btn.ts       #       代码复制按钮
│   │   └── sanitizer.ts          #     XSS 过滤器
│   ├── ui/                       #   UI 组件
│   │   ├── App.vue               #     主布局（工具栏 + 编辑区 + 预览区）
│   │   ├── Editor.vue            #     源码编辑区（CodeMirror 6）
│   │   ├── Preview.vue           #     渲染预览区
│   │   ├── Sidebar.vue           #     侧边栏（目录树 / 文件树）
│   │   ├── Toolbar.vue           #     顶部工具栏
│   │   └── Settings.vue          #     设置面板
│   ├── themes/                   #   主题系统
│   │   ├── light.css             #     浅色主题
│   │   ├── dark.css              #     暗色主题
│   │   └── sepia.css             #     护眼暖色主题
│   └── index.html                #   入口 HTML
│
├── cli/                          # CLI 命令行工具（独立二进制）
│   ├── main.ts                   #   入口（commander.js）
│   ├── commands/
│   │   ├── render.ts             #     md → HTML / PDF
│   │   ├── serve.ts              #     本地预览服务器 + 热重载
│   │   └── watch.ts              #     监听文件变化自动渲染
│   └── README.md
│
├── build/                        # 构建与打包配置
│   ├── electron-builder.yml      #   electron-builder 配置（Windows + Linux）
│   ├── nsis-installer.nsh        #   NSIS 自定义安装脚本
│   └── icons/                    #   应用图标（.ico / .png / .icns）
│
├── .github/
│   └── workflows/
│       ├── ci.yml                #   构建 + lint + 测试
│       ├── release.yml           #   自动构建安装包 → GitHub Releases
│       └── pr-check.yml          #   PR 门禁检查
│
├── README.md                     # 中英双语
├── CONTRIBUTING.md               # 贡献指南
├── LICENSE                       # MIT
└── CHANGELOG.md                  # 自动生成
```

### 3.2 技术选型

| 层面 | 选型 | 理由 |
|------|------|------|
| **桌面框架** | Electron 28+ | 生态成熟、跨平台、前端技术栈完全复用 |
| **前端框架** | Vue 3 + Vite | 轻量、响应式、社区活跃 |
| **编辑器** | CodeMirror 6 | 比 Monaco 轻 10x，Markdown 支持好，扩展性强 |
| **Markdown 解析** | markdown-it | 成熟稳定、插件丰富、CommonMark 100% 兼容 |
| **代码高亮** | Shiki | 与 VSCode 一致的高亮质量，TextMate 语法 |
| **数学公式** | KaTeX | 比 MathJax 快 40x，体积仅 ~280KB |
| **图表** | Mermaid（dynamic import） | 仅使用时加载，不增加启动负担 |
| **打包 Windows** | electron-builder + NSIS | 生成标准 .exe 安装包，支持自定义安装路径、文件关联 |
| **打包 Linux** | electron-builder → deb/rpm/AppImage | 支持主流发行版包管理器 + 通用 AppImage |
| **自动更新** | electron-updater | 检测 GitHub Releases 新版本，增量更新 |
| **测试** | Vitest + Playwright (E2E) | 单元 + 端到端全场景覆盖 |
| **CLI 构建** | tsup → 独立 Node.js 二进制 (pkg/nexe) | CLI 可脱离 GUI 独立使用，体积 < 50MB |

### 3.3 性能目标

| 指标 | 目标值 |
|------|--------|
| 安装包大小 (Windows) | < 80MB |
| 安装包大小 (Linux AppImage) | < 85MB |
| 内存占用（打开一个 100KB .md） | < 100MB |
| 冷启动时间 | < 2 秒 |
| 渲染 100KB .md 文件 | < 300ms |
| 热启动时间（已运行实例） | < 500ms |
| 空闲 CPU 占用 | < 1% |

## 四、核心功能矩阵

### 4.1 GUI 桌面版

#### v1.0 · MVP（4 周）

| 功能 | 说明 |
|------|------|
| 🔤 源码/预览双栏 | 左侧编辑、右侧实时渲染，拖拽调整分栏比例 |
| 🎨 代码高亮 | Shiki 引擎，覆盖 20+ 编程语言（C/C++/Rust/Python/TS/Go/Java/Verilog/ASM 等） |
| 📋 代码块复制 | 鼠标悬停显示「复制」按钮，一键复制全部代码 |
| 🌓 明暗主题 | 浅色 / 暗色 / 暖色（sepia）三套主题，快捷键一键切换 |
| 📂 文件打开 | 菜单栏打开、拖拽 .md 文件到窗口、双击 .md 文件（系统文件关联） |
| 🔗 外链安全 | `target="_blank"` + `rel="noopener noreferrer"` 自动处理 |
| 🖼️ 图片预览 | 本地相对路径图片自动加载，点击放大预览 |
| 💾 自动保存 | 编辑内容自动保存草稿（localStorage），防止意外丢失 |

#### v1.1（3 周）

| 功能 | 说明 |
|------|------|
| 📑 多标签页 | 同时打开多个 .md 文件，标签页切换 |
| 📖 自动 TOC 目录 | 侧边栏显示文档结构树，点击跳转，滚动自动高亮当前位置 |
| 📐 LaTeX 数学公式 | 基于 KaTeX，支持块级 + 行内公式 |
| 📊 Mermaid 图表 | 流程图、时序图、甘特图、类图等，按需加载 |
| 🛡️ XSS 过滤 | 可选开启 HTML 标签白名单过滤 |
| 🔄 自动更新 | 检测 GitHub Releases 新版本，通知用户一键下载安装 |

#### v1.2（3 周）

| 功能 | 说明 |
|------|------|
| 📁 文件目录树 | 打开文件夹，左侧显示目录树，快速切换文件 |
| 📤 导出 PDF | 一键导出当前文档为 PDF（保留样式 + 代码高亮） |
| 📤 导出 HTML | 导出为独立 HTML 文件（内嵌 CSS/JS，可离线分发） |
| 📝 源代码模式 | 仅显示 Markdown 源码（纯文本编辑模式） |
| ⚙️ 设置面板 | 字体大小、行间距、默认主题、自动保存间隔等可配置 |

#### v2.0+（远期规划）

| 功能 | 说明 |
|------|------|
| ✏️ 所见即所得 (WYSIWYG) | 类似 Typora 的即时渲染编辑模式 |
| 🔌 插件系统 | 社区插件支持（自定义渲染规则、工具栏按钮、主题等） |
| 🌐 Web 组件版 | 内核剥离为独立 npm 包，支持 Web 嵌入 |
| 🍎 macOS 支持 | .dmg 安装包 + Mac App Store |

### 4.2 CLI 命令行版

独立于 GUI 的命令行工具，可通过 npm 全局安装或下载独立二进制：

```bash
# 安装
npm install -g lite-md-viewer
# 或下载独立可执行文件（Windows .exe / Linux 二进制）

# 将 .md 渲染为带主题的 HTML 文件
lite-md render README.md -o index.html --theme dark

# 导出 PDF
lite-md render README.md -o output.pdf --format pdf

# 启动本地预览服务器（http://localhost:3000），支持热重载
lite-md serve ./docs --port 3000

# 监听文件变化自动重新渲染
lite-md watch README.md -o index.html
```

## 五、用户安装体验设计

### 5.1 Windows 用户

```
┌─────────────────────────────────────────┐
│  📥 下载 lite-md-viewer-Setup-1.0.0.exe │  ← GitHub Releases 下载
│  🖱️ 双击运行安装程序                      │
│  📍 选择安装路径（默认 %LocalAppData%）    │
│  ✅ 勾选「关联 .md 文件」                  │
│  ✅ 勾选「创建桌面快捷方式」               │
│  🚀 安装完成 → 双击任意 .md 文件即可使用   │
└─────────────────────────────────────────┘
```

- 安装包由 NSIS 生成，支持静默安装 (`/S`) 供企业批量部署
- 文件关联通过写入 Windows 注册表实现，卸载时自动清理
- 后续可通过 `electron-updater` 自动检测更新

### 5.2 Linux 用户

```bash
# 方式一：.deb（Debian/Ubuntu 系）
sudo dpkg -i lite-md-viewer_1.0.0_amd64.deb
# 自动注册 .desktop 入口 + 文件关联

# 方式二：.rpm（Fedora/RHEL 系）
sudo rpm -i lite-md-viewer-1.0.0.x86_64.rpm

# 方式三：AppImage（通用，免安装）
chmod +x lite-md-viewer-1.0.0.AppImage
./lite-md-viewer-1.0.0.AppImage
# 可选：集成到系统菜单（AppImageLauncher）
```

### 5.3 GitHub Releases 发布流程（自动化）

```
开发者 git tag v1.0.0 && git push --tags
        │
        ▼
┌──────────────────────┐
│  GitHub Actions      │
│  release.yml 触发    │
│                      │
│  1. 拉取代码         │
│  2. pnpm install     │
│  3. pnpm build       │
│  4. electron-builder │
│     ├── Windows .exe │
│     ├── Linux .deb   │
│     ├── Linux .rpm   │
│     └── Linux .AppImage │
│  5. 上传到 Release   │
│  6. 生成 CHANGELOG   │
└──────────────────────┘
        │
        ▼
   用户看到 Release 页面
   ├── lite-md-viewer-Setup-1.0.0.exe     (Windows)
   ├── lite-md-viewer_1.0.0_amd64.deb     (Debian/Ubuntu)
   ├── lite-md-viewer-1.0.0.x86_64.rpm    (Fedora)
   └── lite-md-viewer-1.0.0.AppImage      (通用 Linux)
```

## 六、迭代规划

### Phase 1 · v1.0（4 周，MVP 可发布）

| 周次 | 任务 |
|------|------|
| W1 | 项目脚手架：Electron + Vue 3 + Vite + pnpm monorepo 搭建；markdown-it 渲染核心集成；双栏布局 |
| W2 | Shiki 代码高亮 + 明暗主题 + 代码块复制按钮；菜单栏（打开文件/拖拽打开） |
| W3 | 文件关联注册（Win 注册表 / Linux .desktop）；NSIS 安装包脚本；自动保存草稿 |
| W4 | electron-builder 打包配置 + GitHub Actions release 流水线；E2E 测试 + README 文档；发布 v1.0.0 |

### Phase 2 · v1.1（3 周）

| 周次 | 任务 |
|------|------|
| W5 | 多标签页 + KaTeX 数学公式 + Mermaid 图表（dynamic import） |
| W6 | TOC 自动目录 + 侧边栏导航；XSS 过滤集成；暖色主题 |
| W7 | electron-updater 自动更新集成；bug 修复 + 发布 v1.1.0 |

### Phase 3 · v1.2（3 周）

| 周次 | 任务 |
|------|------|
| W8 | 文件目录树 + 文件夹打开；导出 PDF / HTML |
| W9 | CLI 工具开发（render / serve / watch）；独立二进制打包 |
| W10 | 设置面板；优化性能；发布 v1.2.0 |

### Phase 4 · v2.0（远期）

- WYSIWYG 所见即所得编辑模式
- 插件系统开放
- macOS 适配（.dmg + Mac App Store）
- Web 组件版（npm 包）

## 七、开源运营策略

### 7.1 GitHub 最佳实践

- **LICENSE**：MIT（最大化采用率）
- **README**：中英双语，顶部放应用截图 / GIF 动图 + 下载按钮 + 各平台安装命令
- **CONTRIBUTING.md**：本地开发步骤 + 架构说明
- **CHANGELOG.md**：通过 conventional commits + 自动生成
- **Issue Templates**：Bug Report / Feature Request
- **GitHub Actions Badges**：CI / release / downloads

### 7.2 冷启动推广

1. **Product Hunt / 小众软件 / V2EX**：发布 Show 帖
2. **Typora 替代品合集**：在 GitHub 上整理 "Typora Alternatives" 列表，收录自己的项目
3. **掘金 / 知乎**：写「我做了个免费的 Typora 替代品」技术文章
4. **Reddit**：r/linux / r/Markdown / r/opensource 社区推广
5. **视频 Demo**：录制 60 秒功能展示 GIF，放入 README 顶部

### 7.3 用户信任建设

- 安装包通过 VirusTotal 扫描，结果公开在 README
- 提供 SHA256 checksum，方便用户验证完整性
- 明确隐私声明：**完全离线、零数据收集、零遥测**

## 八、关键避坑要点

1. **不要从零实现 Markdown 解析器**：markdown-it 经过 10 年验证，复用成熟方案，把精力放在体验打磨上；
2. **控制安装包大小**：Electron 默认打包 ~150MB，需手动裁剪（移除无用 Chromium 组件、压缩 asar），目标 < 80MB；
3. **Linux 生态细分**：同时提供 deb/rpm/AppImage 三种格式，覆盖 Ubuntu/Fedora/Arch 等主流发行版；
4. **文件关联处理**：Windows 注册表操作需在安装/卸载时正确清理，避免遗留垃圾项；
5. **自动更新策略**：仅在 GitHub Releases 托管更新文件，不引入第三方更新服务，保持隐私友好；
6. **CLI 与 GUI 独立**：CLI 作为独立工具可脱离 Electron 运行，方便 CI/CD 和服务器场景使用；
7. **安全第一**：preload 脚本严格使用 contextBridge，不暴露 Node.js API 到渲染进程；外链默认添加安全 rel 属性。

## 九、项目联动价值

该项目可直接服务于自身技术需求——后续撰写实验报告、技术文档时可直接使用自己的工具。同时作为开源项目积累 GitHub 影响力，形成"自用驱动开发，开源积累品牌"的良性循环。

---

> 方案版本：v3.0 · 桌面应用路线 | 更新日期：2025-07 | 作者：xwt
