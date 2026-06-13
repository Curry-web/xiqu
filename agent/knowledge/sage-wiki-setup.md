# sage-wiki 构建与验证手册

本文档记录 xiqu 项目使用 `xoai/sage-wiki` 构建戏曲知识库的第一阶段步骤。

## 1. 目标

先把戏曲资料整理成一个可搜索、可问答、可追溯来源的知识库，再让 `agent/` 在此基础上封装 Web API。

固定目录：

```text
wiki/xiqu-knowledge
```

该目录既是 sage-wiki 项目目录，也是后续 agent 的知识来源目录。

## 2. 不复制 sage-wiki 源码

`sage-wiki` 作为外部 CLI / MCP 工具使用：

- 不把 `xoai/sage-wiki` 源码复制进本仓库
- 不在 xiqu 仓库内维护 fork
- 本仓库只保存戏曲资料、配置、构建脚本和生成结果
- agent 后续通过 CLI、MCP、或生成后的 wiki 文件接入

## 3. 安装

CLI 安装：

```bash
go install github.com/xoai/sage-wiki/cmd/sage-wiki@latest
```

确认命令可用：

```bash
sage-wiki --help
```

如果需要 Web UI，需要按官方说明从源码用 `-tags webui` 构建；纯 CLI、MCP、检索和问答不依赖 Web UI。

## 4. 初始化知识库

推荐使用脚本自动完成：

```bash
bash agent/scripts/build_sage_wiki.sh

# 如果本机尚未安装 sage-wiki，也可以允许脚本自动 go install
SAGE_WIKI_AUTO_INSTALL=1 bash agent/scripts/build_sage_wiki.sh
```

手工初始化方式：

```bash
cd wiki/xiqu-knowledge
sage-wiki init
```

初始化后检查并调整：

```text
wiki/xiqu-knowledge/config.yaml
```

核心约定：

```yaml
sources:
  - path: raw
    type: auto
    watch: true
output: wiki
```

模型 API key 使用环境变量，不写入仓库。

## 5. 导入第一批戏曲资料

把资料放入：

```text
wiki/xiqu-knowledge/raw/
```

第一批建议：

- 京剧基础介绍
- 昆曲基础介绍
- 越剧基础介绍
- 黄梅戏基础介绍
- 戏曲行当介绍
- 戏曲唱腔基础
- 经典剧目示例
- 戏曲入门学习建议

先少量导入，确认效果后再扩大资料范围。

## 6. 编译与验证

```bash
cd wiki/xiqu-knowledge
sage-wiki doctor
sage-wiki compile
sage-wiki status
sage-wiki search "京剧 昆曲 区别"
sage-wiki query "京剧四大名旦是谁？"
```

如需持续监听资料变化：

```bash
sage-wiki compile --watch
```

## 7. 后续 agent 接入方向

短期：

```text
web 前端
  ↓
agent API
  ↓
sage-wiki search/query 或生成后的 wiki 文件
  ↓
大模型回答 + sources
```

中长期：

- agent 统一封装 `/api/agent/ask` 和 `/api/agent/search`
- 不让浏览器直接拿模型 key 或直接操作知识库目录
- 将 `sage-wiki` 生成的引用路径整理为前端可展示的 sources
- 根据真实命令输出适配 knowledge adapter


> 当前默认 `embed.provider: auto`，不强制配置 embedding 模型。如果没有可用 embedding provider，sage-wiki 会退化为 BM25/关键词检索，先保证知识库构建和问答流程跑通。

## NVIDIA NIM 配置

当前知识库固定使用 NVIDIA NIM。以后切换 NVIDIA 模型只需要改 `.env`：

```yaml
api:
  provider: openai-compatible
  base_url: ${NVIDIA_BASE_URL}
  api_key: ${NVIDIA_API_KEY}

models:
  summarize: ${NVIDIA_MODEL}
  extract: ${NVIDIA_MODEL}
  write: ${NVIDIA_MODEL}
  lint: ${NVIDIA_MODEL}
  query: ${NVIDIA_MODEL}

embed:
  provider: auto
```

运行前先设置本地环境变量：

```bash
cp agent/config/sage-wiki.env.example .env
# 然后编辑 .env，填入 NVIDIA_API_KEY / NVIDIA_MODEL / NVIDIA_BASE_URL
```

不要把真实 key 写入仓库。

> 默认示例模型是 `deepseek-ai/deepseek-v4-pro`。后续切换 NVIDIA 模型时优先改 `.env` 的 `NVIDIA_MODEL`，不需要改 `config.yaml`。

## 原始资料自动同步

构建脚本会在每次运行前，把仓库里的原始资料目录同步到 sage-wiki 的 raw 目录：

```text
2026大创项目（戏曲智能体）
  -> wiki/xiqu-knowledge/raw/2026大创项目（戏曲智能体）
```

默认来源可通过 `.env` 调整：

```env
SAGE_WIKI_SOURCE_DIR=2026大创项目（戏曲智能体）
```

同步时会过滤 `.DS_Store`。


> 首次构建资料较多时，如果看到 `database is locked (SQLITE_BUSY)`，表示 SQLite 本地数据库并发写入冲突。当前配置已将 `compiler.max_parallel` 设为 `1`，优先保证稳定；后续资料稳定后可以再尝试调高。

> 注意：NVIDIA NIM 当前不支持 `sage-wiki` 的 OpenAI Batch upload。`wiki/xiqu-knowledge/config.yaml` 已固定 `compiler.mode: standard`，不要改成 `auto` 或 `batch`，否则大量资料编译时可能出现 `openai batch: upload returned 404`。

> 构建脚本已增加单实例锁：`wiki/xiqu-knowledge/.sage-build.lock`。不要同时运行多个 `build_sage_wiki.sh` 或多个 `sage-wiki compile`，否则 SQLite 数据库会出现 `SQLITE_BUSY`。如果确认没有进程在跑但锁目录还在，可以手动删除该锁目录后重试。

### 分批构建资料

构建脚本支持通过 `.env` 或临时环境变量控制同步批次：

```env
# 默认：只同步文档类，适合第一阶段稳定构建
SAGE_WIKI_BATCH=docs
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

### NVIDIA 请求超时

如果日志出现 `context deadline exceeded`，说明模型接口在默认 120 秒内没有返回。当前本地安装的 `sage-wiki` 已支持用 `.env` 调整超时：

```env
SAGE_WIKI_HTTP_TIMEOUT_SECONDS=300
SAGE_WIKI_EMBED_TIMEOUT_SECONDS=300
```

其中 `SAGE_WIKI_HTTP_TIMEOUT_SECONDS` 影响 LLM 总结/抽取/写作请求，`SAGE_WIKI_EMBED_TIMEOUT_SECONDS` 影响 embedding 请求。
