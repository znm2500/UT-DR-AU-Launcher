# AU Launcher

AU Launcher 是一个用于浏览、搜索和下载 Undertale AU 同人游戏的静态网页启动器。纯 HTML/CSS/JS 实现，无需构建工具，开箱即用。

## 功能特性

- **游戏列表浏览**：卡片式网格布局，横向 16:9 封面展示
- **实时搜索**：按游戏名 / 作者 / 引擎关键词过滤
- **多维度排序**：全部、最热、最新、名称 A-Z
- **双语界面**：根据时区自动切换中文 / 英文（中文时区优先显示中文）
- **双下载源**：中文用户优先走 GitCode 镜像，英文用户优先走 GitHub Releases
- **封面降级**：优先加载本地图片，失败时自动回退到 jsDelivr CDN 和 GitHub Raw
- **公告栏**：通过 `config.json` 可配置中英双语公告

## 界面风格

- 纯黑背景 + 5px 白色直角边框
- `fzxs` 像素手写字体
- 交互元素（按钮 / 标签页）Hover 时边框与文字变为黄色（#FFFF00），0.18s 过渡
- 引擎标签与热度标签无边框显示

## 项目结构

```
UT-DR-AU-Launcher/
├── index.html      # 主页面（包含内嵌 CSS 与 JS）
├── favicon.ico     # 站点图标
├── fzxs.ttf        # fzxs 自定义字体
├── logo.png        # 头部 Logo
└── config.json     # 游戏配置（本地可选，运行时优先加载远程 data 分支）
```

## 本地运行

这是一个纯静态页面，直接用浏览器打开 `index.html` 即可，或使用任意静态服务器：

```bash
# 方式一：Python 3
python -m http.server 8080

# 方式二：Node.js
npx serve .
```

然后访问 http://localhost:8080

## 数据来源

游戏数据、封面图片和版本信息托管在资源仓库的 `data` 分支：

| 项 | 仓库 | 分支 |
| --- | --- | --- |
| 游戏配置 `config.json`、封面 `.webp` | `znm2500/AU-Launcher-Repo` | `data` |
| 游戏安装包 `.7z` Releases | `znm2500/AU-Launcher-Repo` | GitHub Releases |
| 国内镜像 Releases | `znm1145/AU-Launcher-Repo` | GitCode Releases |

### config.json 结构

```json
{
  "newest_version": "0.1.0",
  "announcement": {
    "zh": "公告内容（中文）",
    "en": "Announcement text (EN)"
  },
  "games": [
    {
      "id": "game-id",
      "name": { "zh": "游戏名", "en": "Game Name" },
      "author": { "zh": "作者", "en": "Author" },
      "engine": "GameMaker",
      "hot_score": 999,
      "publish_time": "2026-01-01T00:00:00Z",
      "download_url": "",
      "img": ""
    }
  ]
}
```

字段说明：

- `id`：游戏唯一标识，用于拼接封面 URL 和下载文件名
- `name` / `author`：支持 `{zh, en}` 对象或纯字符串
- `engine`：引擎名，如 GameMaker / Unity / Godot 等
- `hot_score`：热度数值，用于「最热」排序
- `publish_time`：ISO 8601 发布时间，用于「最新」排序
- `download_url`：可选，自定义下载地址，不填则自动拼接 Releases URL
- `img`：可选，自定义封面 URL，不填则自动从 data 分支加载 `{id}.webp`

## 语言检测规则

1. 首先检查用户时区，匹配 `Asia/Shanghai|Hong_Kong|Taipei|Macau|Singapore|Chongqing|Urumqi|Harbin` 视为中文环境
2. 否则匹配 `America/`、`Europe/`、`Australia/`、`Pacific/Auckland` 视为英文环境
3. 时区检测失败时回退到 `navigator.language`
4. 最终兜底为英文

## 下载源优先级

| 用户语言 | 优先源 | 备用源 |
| --- | --- | --- |
| 中文 | GitCode Releases | GitHub Releases |
| 英文 | GitHub Releases | GitCode Releases |

若游戏在 `config.json` 中指定了 `download_url`，则始终优先使用自定义地址。

## 许可证

本项目代码部分遵循 MIT 协议。游戏资源、封面等版权归各自作者所有。

---

> * 保持你的决心
