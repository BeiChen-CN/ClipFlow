<p align="center">
  <img src="./public/clipflow-icon.png" width="96" height="96" alt="ClipFlow icon" />
</p>

<h1 align="center">ClipFlow</h1>

<p align="center">
  面向 Windows 的本地优先剪切板管理器, 让文本, 图片, 文件, 链接和富文本更容易搜索, 复用和恢复.
</p>

<p align="center">
  <img alt="GitHub stars" src="https://img.shields.io/github/stars/BeiChen-CN/ClipFlow?style=flat-square&label=Stars" />
  <img alt="GitHub forks" src="https://img.shields.io/github/forks/BeiChen-CN/ClipFlow?style=flat-square&label=Forks" />
  <img alt="GitHub issues" src="https://img.shields.io/github/issues/BeiChen-CN/ClipFlow?style=flat-square&label=Issues" />
  <img alt="GitHub release downloads" src="https://img.shields.io/github/downloads/BeiChen-CN/ClipFlow/total?style=flat-square&label=Release%20Downloads" />
  <img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-0f766e?style=flat-square" />
</p>

<p align="center">
  <a href="#截图">截图</a> | <a href="#功能亮点">功能亮点</a> | <a href="#安装与使用">安装与使用</a> | <a href="#开发">开发</a> | <a href="#许可证">许可证</a>
</p>

## 截图

<p align="center">
  <img src="https://free.picui.cn/free/2026/05/04/69f8a2989fae3.png" width="960" alt="ClipFlow clipboard screenshot" />
  <br />
  <sub>剪切板主面板</sub>
</p>

<p align="center">
  <img src="https://free.picui.cn/free/2026/05/04/69f8a29881fe6.png" width="960" alt="ClipFlow settings screenshot" />
  <br />
  <sub>设置页</sub>
</p>

## 功能亮点

| 能力 | 说明 |
| --- | --- |
| 本地剪切板历史 | 自动记录文本, 图片, 文件, 链接和富文本内容 |
| 高速检索 | 关键词搜索, 匹配高亮, 按类型筛选 |
| 编辑与恢复 | 支持编辑已复制文本, 删除后可恢复或彻底删除 |
| 桌面体验 | 全局快捷键, 托盘入口, 开机自启, 面板位置策略 |
| 个性化外观 | 主题模式, 自定义颜色, 动效方案 |
| 本地优先 | 数据保存在本机, 适合个人办公, 写作和开发场景 |

## 安装与使用

1. 从 Releases 下载并安装 `ClipFlow_0.1.0_x64-setup.exe`.
2. 启动后使用全局快捷键呼出主面板.
3. 在设置中调整主题, 颜色, 动效, 快捷键和行为偏好.

## 开发

### 环境要求

- Windows 10/11
- Node.js 18 或更高版本
- pnpm
- Rust stable
- Tauri 2 所需的 Windows 构建环境, 包含 Microsoft C++ Build Tools 和 WebView2 Runtime

### 常用命令

```bash
pnpm install
pnpm dev
pnpm tauri:dev
pnpm build
pnpm test
pnpm tauri:build
```

### 项目结构

```text
.
|-- public/              # 静态资源和应用图标
|-- docs/                # 发布说明和 README 截图资源
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

## 许可证

本项目基于 Apache License 2.0 开源, 详见 [LICENSE](./LICENSE).

## Star History

<p align="center">
  <a href="https://star-history.com/#BeiChen-CN/ClipFlow&Date">
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=BeiChen-CN/ClipFlow&type=Date" />
  </a>
</p>
