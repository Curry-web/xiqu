# xiqu

`xiqu` 是一个戏曲主题移动端 Web / H5 项目，同时配套建设基于 `sage-wiki` 的戏曲知识库，为后续「戏曲智能体」问答能力提供资料检索、结构化 wiki 和引用来源。

项目当前分为两条主线：

- `web/`：移动端前端页面，使用 Vue 3 + Vite 构建。
- `wiki/xiqu-knowledge/` + `agent/`：戏曲知识库与智能体接入方案，使用 `sage-wiki` + NVIDIA NIM 构建。

## 项目概览

| 项目项 | 说明 |
| --- | --- |
| 项目名称 | xiqu |
| 项目类型 | 移动端 Web / H5 + 戏曲知识库 |
| 前端入口 | `web/` |
| 知识库入口 | `wiki/xiqu-knowledge/` |
| 原始资料目录 | `2026大创项目（戏曲智能体）/` |
| 智能体方案目录 | `agent/` |
| 前端技术栈 | Vue 3、TypeScript、Vite、Vant、Pinia、Vue Router、Tailwind CSS |
| 知识库工具 | `xoai/sage-wiki` |
| 大模型服务 | NVIDIA NIM，OpenAI-compatible endpoint |
| 默认模型 | `deepseek-ai/deepseek-v4-pro` |

## 目录结构

```text
.
├── README.md
├── .env.example                         # 本地环境变量模板，不包含真实 key
├── 2026大创项目（戏曲智能体）/              # 戏曲原始资料：docx、图片等
├── agent/
│   ├── agents.md                        # 戏曲问答智能体建设方案
│   ├── config/
│   │   └── sage-wiki.env.example         # sage-wiki / NVIDIA 配置模板
│   ├── knowledge/
│   │   └── sage-wiki-setup.md            # sage-wiki 构建与验证手册
│   ├── prompts/
│   │   └── xiqu-qa-system.md             # 问答系统提示词方向
│   ├── scripts/
│   │   └── build_sage_wiki.sh            # 一键同步资料并构建知识库
│   └── tests/
│       └── sage-wiki-smoke.md            # 知识库冒烟测试清单
├── wiki/
│   └── xiqu-knowledge/
│       ├── README.md                     # 知识库目录说明
│       ├── config.yaml                   # sage-wiki 配置，读取 .env 中的 NVIDIA_* 变量
│       ├── raw/                          # 脚本同步后的知识源输入目录
│       ├── .sage/wiki.db                 # sage-wiki 本地数据库，初始化后生成
│       └── wiki/                         # sage-wiki compile 后生成的结构化 wiki
└── web/
    ├── package.json
    ├── pnpm-lock.yaml
    ├── vite.config.ts
    └── src/
        ├── App.vue
        ├── main.ts
        ├── api/
        ├── assets/
        ├── router/
        ├── stores/
        ├── styles/
        └── views/
```

## 前端功能

### 已实现页面

- 首页：戏曲山水亭台视觉、宣纸纹理背景、阴历日期展示。
- 搜戏 / 戏单页：剧目列表与搜索入口骨架。
- 戏台页：底部中间脸谱入口对应的核心页面。
- 练功 / 票务页：练功、预约、票务模块预留。
- 我的页：用户信息、学习统计、收藏等视觉模块。
- 登录页：手机号输入、协议勾选、Mock 登录、`localStorage` 登录态。

### 路由说明

| 路径 | 路由名 | 页面 | 说明 |
| --- | --- | --- | --- |
| `/` | `home` | `HomeView.vue` | 首页 / 开台 |
| `/opera` | `opera` | `OperaView.vue` | 搜戏 / 戏单 |
| `/stage` | `stage` | `StageView.vue` | 中间脸谱入口 / 戏台 |
| `/ticket` | `ticket` | `TicketView.vue` | 练功 / 票务预留入口 |
| `/profile` | `profile` | `ProfileView.vue` | 我的 |
| `/login` | `login` | `LoginView.vue` | 手机号登录，隐藏底部导航 |

## 前端本地开发

### 环境要求

- Node.js 20+
- pnpm 10+

### 安装依赖

```bash
cd web
pnpm install
```

### 启动开发服务

```bash
cd web
pnpm dev
```

默认地址：

```text
http://127.0.0.1:5173
```

### 常用命令

| 命令 | 说明 |
| --- | --- |
| `cd web && pnpm dev` | 启动前端开发服务 |
| `cd web && pnpm typecheck` | 执行 TypeScript / Vue 类型检查 |
| `cd web && pnpm build` | 构建生产包 |
| `cd web && pnpm preview` | 本地预览生产构建产物 |

生产构建产物位于：

```text
web/dist
```

## sage-wiki 戏曲知识库

知识库目录固定为：

```text
wiki/xiqu-knowledge
```

原始资料目录固定为：

```text
2026大创项目（戏曲智能体）
```

构建脚本会在每次运行前自动同步：

```text
2026大创项目（戏曲智能体）
  -> wiki/xiqu-knowledge/raw/2026大创项目（戏曲智能体）
```

同步时会过滤 `.DS_Store`。

### 安装 sage-wiki

`sage-wiki` 是 Go CLI 工具，本项目通过 Go 安装。

先确认本机有 Go：

```bash
go version
```

安装 `sage-wiki`：

```bash
go install github.com/xoai/sage-wiki/cmd/sage-wiki@latest
```

默认会安装到：

```text
$(go env GOPATH)/bin/sage-wiki
```

在当前 macOS 环境中通常是：

```text
/Users/guolimin/go/bin/sage-wiki
```

验证命令：

```bash
sage-wiki --help
```

如果终端提示 `command not found: sage-wiki`，说明 Go 的 bin 目录还没进 `PATH`。可以临时执行：

```bash
export PATH="$(go env GOPATH)/bin:$PATH"
```

也可以写入 `~/.zshrc`：

```bash
echo 'export PATH="$(go env GOPATH)/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

本仓库的构建脚本会自动把 Go 的 bin 目录加入 `PATH`，所以通常直接执行即可：

```bash
bash agent/scripts/build_sage_wiki.sh
```

如果新机器未安装 `sage-wiki`，也可以让脚本自动安装：

```bash
SAGE_WIKI_AUTO_INSTALL=1 bash agent/scripts/build_sage_wiki.sh
```


> 当前默认 `embed.provider: auto`，不强制配置 embedding 模型。如果没有可用 embedding provider，sage-wiki 会退化为 BM25/关键词检索，先保证知识库构建和问答流程跑通。

## NVIDIA NIM 配置

先复制环境变量模板：

```bash
cp .env.example .env
```

然后编辑 `.env`，填入真实 key：

```env
SAGE_WIKI_DIR=wiki/xiqu-knowledge
SAGE_WIKI_SOURCE_DIR=2026大创项目（戏曲智能体）
SAGE_WIKI_UI_PORT=3333

NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_API_KEY=你的 NVIDIA API Key
NVIDIA_MODEL=deepseek-ai/deepseek-v4-pro
# NVIDIA_EMBED_MODEL=nvidia/nv-embed-v1  # 可选：当前默认 embed.provider=auto

NVIDIA_RATE_LIMIT=30
NVIDIA_TEMPERATURE=0.2
NVIDIA_TOP_P=0.7
# NVIDIA_EMBED_PROVIDER=openai          # 可选：当前默认 embed.provider=auto

AGENT_PORT=8787
```

注意：

- 不要提交真实 `.env`。
- 当前项目按 NVIDIA NIM 配置，不使用通用 `LLM_*` 变量。
- 如果只是在当前模型服务内切换生成/多模态模型，优先改 `.env` 的 `NVIDIA_MODEL`，不要改 `config.yaml`。当前默认不强制配置 embedding。



> 首次构建资料较多时，如果看到 `database is locked (SQLITE_BUSY)`，表示 SQLite 本地数据库并发写入冲突。当前配置已将 `compiler.max_parallel` 设为 `1`，优先保证稳定；后续资料稳定后可以再尝试调高。

> 注意：NVIDIA NIM 当前不支持 `sage-wiki` 的 OpenAI Batch upload。`wiki/xiqu-knowledge/config.yaml` 已固定 `compiler.mode: standard`，不要改成 `auto` 或 `batch`，否则大量资料编译时可能出现 `openai batch: upload returned 404`。


### 分批构建资料

构建脚本支持通过 `.env` 或临时环境变量控制同步批次：

```env
# 默认：只同步文档类，适合第一阶段稳定构建
SAGE_WIKI_BATCH=docs
```

命令行临时环境变量优先级高于 `.env`。例如只处理图片时，不需要修改 `.env`，直接运行：

```bash
SAGE_WIKI_BATCH=images bash agent/scripts/build_sage_wiki.sh
```

可选值：

| 值 | 同步内容 | 说明 |
| --- | --- | --- |
| `docs` | `.docx`、`.md`、`.txt`、`.pdf`、`.csv`、`.xlsx`、`.pptx` 等 | 默认，先构建文本知识库 |
| `images` | `.jpg`、`.jpeg`、`.png`、`.webp`、`.avif`、`.gif`、`.svg` 等 | 单独测试图片/多模态能力 |
| `docs,images` | 文档 + 图片 | 文档批次稳定后再使用 |
| `all` | 文档 + 图片 | 等同于 `docs,images`，仍然跳过视频 |

视频文件如 `.mp4`、`.mov`、`.mkv` 默认不进入 sage-wiki。视频应先转写字幕、抽帧或人工整理成 Markdown 后再进入知识库。

建议顺序：

```bash
# 1. 先只构建文档
SAGE_WIKI_BATCH=docs bash agent/scripts/build_sage_wiki.sh

# 2. 文档稳定后，再加入图片
SAGE_WIKI_BATCH=docs,images bash agent/scripts/build_sage_wiki.sh
```

## 一键构建知识库

从仓库根目录执行：

```bash
bash agent/scripts/build_sage_wiki.sh
```

脚本会依次执行：

1. 读取 `.env`。
2. 自动同步 `2026大创项目（戏曲智能体）/` 到 `wiki/xiqu-knowledge/raw/`。
3. 检查 `sage-wiki` 命令。
4. 检查或初始化 `wiki/xiqu-knowledge/.sage/wiki.db`。
5. 执行 `sage-wiki doctor` 验证 NVIDIA API 和配置。
6. 执行 `sage-wiki compile` 编译知识库。
7. 执行 `sage-wiki status` 查看状态。
8. 执行默认 `search` / `query` 冒烟测试。

可选跳过项：

```bash
SAGE_WIKI_SKIP_DOCTOR=1 bash agent/scripts/build_sage_wiki.sh
SAGE_WIKI_SKIP_COMPILE=1 bash agent/scripts/build_sage_wiki.sh
SAGE_WIKI_SKIP_SEARCH=1 bash agent/scripts/build_sage_wiki.sh
SAGE_WIKI_SKIP_QUERY=1 bash agent/scripts/build_sage_wiki.sh
```

只做同步和基础状态检查时可组合使用：

```bash
SAGE_WIKI_SKIP_DOCTOR=1 \
SAGE_WIKI_SKIP_COMPILE=1 \
SAGE_WIKI_SKIP_SEARCH=1 \
SAGE_WIKI_SKIP_QUERY=1 \
bash agent/scripts/build_sage_wiki.sh
```

## sage-wiki 手工命令

```bash
cd wiki/xiqu-knowledge

sage-wiki doctor
sage-wiki compile
sage-wiki status
sage-wiki search "京剧和昆曲有什么区别？"
sage-wiki query "京剧四大名旦是谁？"
```

如需监听资料变化：

```bash
sage-wiki compile --watch
```

## 智能体接入方向

当前 `agent/` 先沉淀方案和构建脚本，后续再实现正式 API。推荐链路：

```text
web 前端
  ↓ HTTP
agent API
  ↓ search / query / 读取生成 wiki
wiki/xiqu-knowledge（sage-wiki）
  ↓ 上下文
NVIDIA NIM 模型
  ↓
answer + sources + relatedQuestions
```

初步 API 方向：

- `POST /api/agent/ask`：用户问答。
- `GET /api/agent/health`：agent 和知识库健康检查。

详细方案见：

```text
agent/agents.md
agent/knowledge/sage-wiki-setup.md
agent/tests/sage-wiki-smoke.md
```

## 视觉素材说明

主要素材位置：

```text
web/src/assets/images
web/src/assets/nav
```

说明：

- `home-hero.jpg`：首页上半部分山水亭台视觉。
- `app-bg.jpg`：宣纸质感背景，用于页面底层铺底。
- `login-bg.jpg`、`login-avatar*.jpg`：登录页视觉素材。
- `profile-*.png`：我的页视觉素材。
- `nav-*.png`：底部导航透明图标。
- `nav-*.jpg`：底部导航原始图标素材备份。

底部导航图标建议优先使用透明 PNG，因为 JPG 不支持透明背景。

## 开发约定

- 移动端优先，页面最大宽度以 `30rem` 左右为视觉参考。
- 前端工程以 `web/` 为项目根目录管理依赖和 lockfile。
- 全局视觉样式主要集中在 `web/src/styles/main.css`。
- 底部导航由 `web/src/App.vue` 统一管理。
- 登录页通过路由 `meta.showTabbar = false` 隐藏底部导航。
- 页面标题通过路由守卫写入 `document.title`。
- 知识库原始资料优先维护 `2026大创项目（戏曲智能体）/`，不要直接手改 `wiki/xiqu-knowledge/raw/` 的同步副本。
- `wiki/xiqu-knowledge/config.yaml` 只保留变量引用，真实密钥只放 `.env`。

## 后续可扩展方向

- 接入真实手机号登录 / 短信验证码。
- 完善搜戏页：搜索、分类、剧目详情。
- 完善练功页：课程、打卡、身段训练、唱腔练习。
- 完善戏台页：推荐内容、直播、沉浸式剧场。
- 实现 `agent` 问答 API 并接入前端。
- 将 sage-wiki 生成的引用来源整理成前端可展示的 `sources`。
- 增加移动端真机适配测试。

## 许可证

本项目根目录包含 `LICENSE` 时，请以该文件为准。

> 构建脚本已增加单实例锁：`wiki/xiqu-knowledge/.sage-build.lock`。不要同时运行多个 `build_sage_wiki.sh` 或多个 `sage-wiki compile`，否则 SQLite 数据库会出现 `SQLITE_BUSY`。如果确认没有进程在跑但锁目录还在，可以手动删除该锁目录后重试。

### 查看当前处理进度

`sage-wiki` 自带进度条不一定逐个显示当前文件。脚本已默认开启：

```env
SAGE_WIKI_COMPILE_VERBOSE=-v
SAGE_WIKI_HTTP_TIMEOUT_SECONDS=300
SAGE_WIKI_EMBED_TIMEOUT_SECONDS=300
```

这样 `compile` 会输出更多日志；脚本也会在编译前打印本次 `raw/` 文件清单预览。如果需要更详细日志，可临时运行：

```bash
SAGE_WIKI_COMPILE_VERBOSE=-vv bash agent/scripts/build_sage_wiki.sh
```

如果想关闭 verbose：

```bash
SAGE_WIKI_COMPILE_VERBOSE= bash agent/scripts/build_sage_wiki.sh
```

### 编译日志阶段说明

`sage-wiki compile` 的日志通常会按阶段输出：

```text
Tier 0: Index sources
Tier 1: Index + embed sources
Pass 1: Summarize sources
```

含义如下：

- `Tier 0: Index sources`：扫描 `raw/` 下的源文件，把文件路径、内容摘要等基础信息写入 `.sage/wiki.db`。看到 `tier 0 indexing complete` 就表示这一层完成。
- `Tier 1: Index + embed sources`：做更细的索引与向量 embedding。当前默认 `embed.provider: auto`，如果没有可用 embedding provider，会显示 `indexed=0 embedded=0`，这是正常的 BM25-only 回退，不代表失败。
- `Pass 1: Summarize sources`：开始调用大模型逐个总结文档。这里才会真正消耗 NVIDIA 模型调用时间；如果进度停在 `0/13`，通常表示正在等待某个文档的 LLM 响应。

进度条里的 `Done: 0/13` 有时不会及时刷新，优先看 `level=INFO msg=... complete` 这类完成日志。

### NVIDIA 请求超时

如果日志出现 `context deadline exceeded`，说明模型接口在默认 120 秒内没有返回。当前本地安装的 `sage-wiki` 已支持用 `.env` 调整超时：

```env
SAGE_WIKI_HTTP_TIMEOUT_SECONDS=300
SAGE_WIKI_EMBED_TIMEOUT_SECONDS=300
```

其中 `SAGE_WIKI_HTTP_TIMEOUT_SECONDS` 影响 LLM 总结/抽取/写作请求，`SAGE_WIKI_EMBED_TIMEOUT_SECONDS` 影响 embedding 请求。
