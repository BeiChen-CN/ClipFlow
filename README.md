<p align="center">
  <img src="./public/clipflow-icon.png" width="96" height="96" alt="ClipFlow icon" />
</p>

<h1 align="center">ClipFlow</h1>

<p align="center">
  面向 Windows 桌面的现代剪切板管理器, 让复制过的文本, 图片, 文件, 链接和富文本内容更容易找回与复用。
</p>

<p align="center">
  <img alt="GitHub stars" src="https://img.shields.io/github/stars/BeiChen-CN/ClipFlow?style=flat-square&label=Stars" />
  <img alt="GitHub forks" src="https://img.shields.io/github/forks/BeiChen-CN/ClipFlow?style=flat-square&label=Forks" />
  <img alt="GitHub issues" src="https://img.shields.io/github/issues/BeiChen-CN/ClipFlow?style=flat-square&label=Issues" />
  <img alt="GitHub release downloads" src="https://img.shields.io/github/downloads/BeiChen-CN/ClipFlow/total?style=flat-square&label=Release%20Downloads" />
  <img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-0f766e?style=flat-square" />
</p>


## 简介

ClipFlow 会在本地记录剪切板历史, 帮你快速搜索, 筛选, 收藏, 编辑和恢复复制过的内容。它适合资料整理, 写作, 办公和开发场景, 重点放在轻量窗口, 快速呼出, 本地存储和清晰的 Material 3 Expressive 风格界面。

## 功能清单

### 剪切板记录

- 自动记录剪切板内容, 支持文本, 链接, 代码, 图片, 文件和富文本。
- 显示来源应用信息, 并支持收藏和编辑已复制的文本内容。
- 保存图片尺寸, 文件路径, 文件数量和富文本 HTML 等结构化信息。

### 搜索与筛选

- 支持关键词搜索和匹配高亮。
- 支持按类型筛选: 全部, 文本, 收藏, 图片, 文件, 以及可选的链接, 代码, 富文本, 最近使用, 回收站。
- 支持链接高亮和跳转, 以及搜索框位置切换: 顶部, 底部, 隐藏。

### 历史与回收站

- 删除内容先进入回收站, 可恢复或彻底删除。
- 回收站保留时长默认 7 天, 支持 1 到 30 天配置。
- 历史记录上限可配置, 0 表示无限条; 历史保留时长默认 30 天, 0 表示永久保留。

### 窗口与桌面行为

- 支持全局快捷键和可自定义快捷键, 覆盖呼出, 粘贴, 复制, 删除和导航。
- 支持窗口位置策略, 面板置顶, 边缘自动隐藏和系统托盘入口。
- 支持开机自启动, Material 3 Expressive 风格, 主题模式和自定义颜色。
- 使用 Framer Motion 提供面板, 条目和路由过渡动效, 浏览器预览模式内置演示数据。

## 项目结构

```text
.
|-- public/              # 静态资源和应用图标
|-- src/                 # React 渲染层
|   |-- components/      # 剪切板面板, 设置页和 UI 组件
|   |-- domain/          # 类型, 搜索, 快捷键, 主题, 音效和动效逻辑
|   |-- styles/          # 全局样式和 MD3 Expressive 风格 token
|   |-- App.tsx          # 前端应用入口和路由切换
|   `-- tauriClient.ts   # Tauri 命令桥接
|-- src-tauri/           # Tauri 和 Rust 后端
|   |-- src/             # 命令, 存储, 粘贴, 系统托盘, 剪切板监听等逻辑
|   |-- icons/           # 桌面应用图标
|   `-- tauri.conf.json  # Tauri 应用配置
|-- package.json         # 前端脚本和依赖
|-- vite.config.ts       # Vite 和 Vitest 配置
|-- Cargo.lock           # Rust 依赖锁定
|-- LICENSE              # Apache-2.0 许可证
`-- README.md            # 项目说明
```

## 构建

### 环境要求

- Windows 10/11
- Node.js 18 或更高版本
- pnpm
- Rust stable
- Tauri 2 所需的 Windows 构建环境, 包含 Microsoft C++ Build Tools 和 WebView2 Runtime

### 安装依赖

```bash
pnpm install
```

### 浏览器预览

```bash
pnpm dev
```

默认地址:

```text
http://localhost:1420/
```

### 启动桌面开发模式

```bash
pnpm tauri:dev
```

### 构建前端产物

```bash
pnpm build
```

### 构建桌面安装包

```bash
pnpm tauri:build
```

桌面构建产物会输出到 Tauri 默认的 `src-tauri/target/` 目录。

### 常用脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动 Vite 浏览器预览 |
| `pnpm preview` | 预览前端构建产物 |
| `pnpm build` | 执行 TypeScript 检查并构建前端 |
| `pnpm test` | 运行全部测试 |
| `pnpm test:watch` | 以监听模式运行测试 |
| `pnpm tauri:dev` | 启动 Tauri 桌面开发模式 |
| `pnpm tauri:build` | 构建桌面安装包 |

## 许可证

本项目基于 Apache License 2.0 开源, 详见 [LICENSE](./LICENSE)。

## Star History

<p align="center">
  <a href="https://star-history.com/#BeiChen-CN/ClipFlow&Date">
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=BeiChen-CN/ClipFlow&type=Date" />
  </a>
</p>
