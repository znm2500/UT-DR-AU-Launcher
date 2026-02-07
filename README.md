# UT/DR AU Launcher

A modern, feature-rich game launcher designed for *UNDERTALE* and *Deltarune* Alternate Universe (AU) games. Built with Electron, Vue 3, and Vite, it provides a unified interface to manage, play, and share your favorite AU games.

## Core Features

### Game Library Management
- **Automatic Game Discovery**: Automatically fetches the latest list of AU games from a remote repository upon launch.
- **Unified Game View**: Integrates online downloadable games and locally installed games into a single list, clearly marking the status of each game (Installed, Downloadable, Downloading, Error).
- **Instant Search**: Quickly find games across your entire library (both local and remote).
- **One-Click Download & Install**: For online games, simply click the "Download" button to automatically handle downloading and extraction. The game will immediately appear in your local library, ready to play.
- **Launch Games**: Start your installed games directly from the launcher with a "Play" button.
- **Delete Games**: Easily remove games from the list and optionally delete the game files from your hard drive.

### Game Import and Export
- **Import Local Games**: Conveniently import games that are already on your computer (as `.exe` files) into the launcher. Supports custom game names and cover images.
- **Innovative `.aup` Format**:
    - **Batch Export**: Package multiple local games into a single `.aup` (Another Universe Package) file. This file contains all game files and metadata, making it perfect for sharing your game collection with friends.
    - **Easy Import**: From an `.aup` file, you can see all the games it contains and freely choose which ones you want to import. The launcher will automatically configure them into your library.

### Personalization
- **Customize Game Info**: For local games, you can edit their names and cover images at any time.
- **Fix Game Paths**: If game files are moved, you can easily re-specify the path to the game's executable to fix an "Error" status.
- **Custom Download Directory**: Specify the location where you want all your game files to be stored in the settings.
- **Custom Launcher Background**: Choose your favorite image as the launcher's background to create your own personalized interface.
- **Multi-language Support**: The launcher interface supports multiple languages (currently includes Chinese and English).

### User Experience
- **Retro-Themed UI**: Inspired by *UNDERTALE*, the design features a pixel-art font and iconic symbols for an immersive experience.
- **Sound Feedback**: Key actions (like confirm, cancel, and select) are accompanied by nostalgic sound effects.
- **Clear Visual Guidance**: All functions and interactions are presented through simple modals and clear visual elements, making it easy to get started.

---

## Tech Stack

- **Frameworks**: Electron, Vue.js 3
- **Build Tool**: Vite
- **Key Dependencies**:
  - `axios`: For network requests and game downloads.
  - `node-7z` / `adm-zip`: For handling `.7z` and `.zip` archives.
  - `electron-store`: For persistent storage of user settings and game library data.
  - `fs-extra`: For enhanced file system operations.

---
---

# UT/DR AU 启动器

一个为《UNDERTALE》和《Deltarune》的同人游戏（AUs - Alternate Universes）设计的现代化、功能丰富的游戏启动器。它使用 Electron、Vue 3 和 Vite 构建，提供了一个统一的界面来管理、游玩和分享你喜爱的 AU 游戏。

## 核心功能

### 游戏库管理
- **自动游戏发现**: 启动时会自动从远程仓库获取最新的 AU 游戏列表。
- **统一游戏视图**: 将在线可下载的游戏和本地已安装的游戏整合在一个列表中，并清晰地标示出每款游戏的状态（已就绪、未下载、下载中、错误）。
- **即时搜索**: 快速在你的整个游戏库（包括本地和远程）中查找游戏。
- **一键下载与安装**: 对于在线游戏，点击“下载”按钮即可自动完成下载和解压缩，游戏会立刻出现在你的本地库中并准备好游玩。
- **启动游戏**: 直接从启动器中点击“游玩”来启动已安装的游戏。
- **删除游戏**: 轻松地从列表中移除游戏，并可以选择将游戏文件从硬盘上一并删除。

### 游戏导入与导出
- **导入本地游戏**: 你可以方便地将已经存在于电脑上的游戏（`.exe` 文件）导入到启动器中。支持自定义游戏名称和封面图片。
- **创新的 `.aup` 格式**:
    - **批量导出**: 将你的多款本地游戏打包成一个单独的 `.aup` (Another Universe Package) 文件。这个文件包含了所有游戏文件和元数据，非常适合与朋友分享你的游戏合集。
    - **轻松导入**: 从一个 `.aup` 文件中，你可以看到其中包含的所有游戏，并自由选择你想要导入的游戏。启动器会自动将它们配置到你的游戏库中。

### 个性化设置
- **自定义游戏信息**: 对于本地游戏，你可以随时编辑它们的名称和封面图片。
- **修复游戏路径**: 如果游戏文件被移动，你可以轻松地重新指定游戏的可执行文件路径来修复“错误”状态。
- **自定义下载目录**: 在设置中指定你希望存放所有游戏文件的位置。
- **更换启动器背景**: 选择一张你喜欢的图片作为启动器的背景，打造属于你自己的界面。
- **多语言支持**: 启动器界面支持多种语言（当前内置中文和英文）。

### 用户体验
- **复古主题界面**: 设计灵感来源于《UNDERTALE》，使用像素字体和标志性的图标，提供沉浸式体验。
- **音效反馈**: 关键操作（如确认、取消、选择）都配有怀旧的音效。
- **清晰的视觉指引**: 所有的功能和交互都通过简洁的模态框和清晰的视觉元素来呈现，易于上手。

---

## 技术栈

- **框架**: Electron, Vue.js 3
- **构建工具**: Vite
- **主要依赖**:
  - `axios`: 用于网络请求和游戏下载。
  - `node-7z` / `adm-zip`: 用于处理 `.7z` 和 `.zip` 压缩文件。
  - `electron-store`: 用于持久化存储用户设置和游戏库数据。
  - `fs-extra`: 提供增强的文件系统操作能力。
