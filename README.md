# ClipFlow

ClipFlow 是一款面向 Windows 桌面的剪切板管理器, 用来保存, 搜索和复用复制过的内容。它适合资料整理, 写作, 办公和开发场景, 让文本, 图片, 文件, 链接与富文本内容更容易找回。

> 当前项目仍在开发中, 功能和界面可能继续调整。

## 功能特性

- 自动记录剪切板内容, 支持文本, 链接, 代码, 图片, 文件和富文本条目。
- 显示复制来源应用, 包含来源应用名称和图标信息。
- 支持关键词搜索, 类型筛选, 搜索高亮和收藏常用条目。
- 支持编辑已复制的文本内容, 复制或粘贴选中条目。
- 删除内容会先进入回收站, 可恢复或彻底删除。
- 支持全局快捷键, 自定义快捷键, 开机自启动和系统托盘入口。
- 支持面板固定在最上层, 窗口位置策略, 搜索框位置和边缘吸附自动隐藏。
- 使用 Material 3 Expressive 风格界面, 支持主题模式, 预设颜色和自定义颜色。
- 浏览器预览模式内置演示数据, 可不启动桌面运行时直接查看界面。

## 技术栈

- 桌面框架: Tauri 2
- 前端: React 18, TypeScript, Vite
- 动效: Framer Motion
- 图标: lucide-react
- 后端: Rust
- 存储: SQLite, rusqlite
- 剪切板: arboard
- 快捷键: tauri-plugin-global-shortcut
- 测试: Vitest, Testing Library

## 环境要求

- Windows 10/11
- Node.js 18 或更高版本
- pnpm
- Rust stable
- Tauri 2 所需的 Windows 构建环境, 包含 Microsoft C++ Build Tools 和 WebView2 Runtime

## 本地开发

安装依赖:

```bash
pnpm install
```

启动浏览器预览:

```bash
pnpm dev
```

默认地址:

```text
http://localhost:1420/
```

启动 Tauri 桌面应用:

```bash
pnpm tauri:dev
```

## 构建

构建前端产物:

```bash
pnpm build
```

构建桌面安装包:

```bash
pnpm tauri:build
```

构建产物会输出到 Tauri 默认的 `src-tauri/target/` 目录。

## 测试

运行全部测试:

```bash
pnpm test
```

监听模式:

```bash
pnpm test:watch
```

## 项目结构

```text
.
|-- src/                 # React 渲染层
|   |-- components/      # 剪切板面板, 设置页和 UI 组件
|   |-- domain/          # 类型, 搜索, 快捷键, 主题和动效逻辑
|   |-- styles/          # 全局样式和 MD3 Expressive 风格 token
|   |-- App.tsx          # 前端应用入口和路由切换
|   `-- tauriClient.ts   # Tauri 命令桥接
|-- src-tauri/           # Tauri 和 Rust 后端
|   |-- src/             # 命令, 存储, 系统托盘, 剪切板监听等逻辑
|   `-- tauri.conf.json  # Tauri 应用配置
|-- public/              # 静态资源
|-- package.json         # 前端脚本和依赖
`-- vite.config.ts       # Vite 和 Vitest 配置
```

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动 Vite 浏览器预览 |
| `pnpm tauri:dev` | 启动 Tauri 桌面开发模式 |
| `pnpm build` | TypeScript 检查并构建前端 |
| `pnpm tauri:build` | 构建桌面应用 |
| `pnpm test` | 运行测试 |

## 开源地址

https://github.com/BeiChen-CN/ClipFlow

## 许可证

本项目基于 Apache License 2.0 开源, 详见 [LICENSE](LICENSE)。
