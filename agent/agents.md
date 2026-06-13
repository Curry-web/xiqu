# xiqu 问答智能体构建说明

本文档用于约定 `agent/` 目录下的问答智能体建设方案。当前目标是基于 `xoai/sage-wiki` 在 `wiki/xiqu-knowledge` 构建戏曲知识库，再由 agent 封装 Web 可调用的 Q&A API，供 `web/` 前端访问。

## 1. 建设目标

在 xiqu 项目中增加一个独立的问答智能体层，用于回答戏曲相关问题，例如：

- 戏曲基础知识问答
- 剧种、剧目、唱腔、行当介绍
- 戏曲学习与练功建议
- 戏曲资料检索与总结
- 后续可扩展到票务、演出、用户学习记录等场景

最终调用链路：

```text
web 前端
  ↓ HTTP
agent API
  ↓ 检索 / 读取
wiki/xiqu-knowledge（sage-wiki 知识库）
  ↓ 上下文
大模型
  ↓
结构化 Q&A 响应
```

## 2. sage-wiki 定位

本项目使用 GitHub 项目 `xoai/sage-wiki` 作为知识库构建工具。

`sage-wiki` 的定位不是直接作为 xiqu 的公网 Web 后端，而是作为：

- 戏曲资料导入和解析工具
- Wiki 化知识库生成工具
- 本地知识检索和问答工具
- MCP / CLI 形式的知识库能力提供方

agent 层不应把模型 key、知识库文件系统写权限或本地服务直接暴露给浏览器，而应由 agent 自己封装稳定的 Web API。

## 3. 知识库目录约定

`sage-wiki` 的项目目录固定为：

```text
wiki/xiqu-knowledge
```

建议结构：

```text
wiki/xiqu-knowledge/
├── README.md
├── config.yaml
├── raw/       # 原始戏曲资料
├── wiki/      # sage-wiki compile 后生成的 wiki
├── outputs/   # 可选：问答沉淀结果
└── notes/     # 人工记录、资料清单、验收记录
```

`raw/` 是输入，`wiki/` 是输出。后续维护时优先补充和修正 `raw/`，再重新编译。

## 4. 推荐架构

### 4.1 短期 MVP 架构

适合本地验证和快速 Demo：

```text
web/
  Vue H5 页面

agent/
  接收前端问题
  调用 sage-wiki search/query 或读取生成后的 wiki 文件
  调用大模型生成回答
  返回 answer + sources

wiki/xiqu-knowledge/
  sage-wiki 项目目录
  raw/ 原始资料
  wiki/ 生成内容
```

优点：

- 启动快
- 可以快速验证戏曲资料的检索质量
- 不需要马上自研知识库系统
- 知识库资产保留在本仓库明确目录下

限制：

- 需要本地安装 `sage-wiki` 命令
- 编译和问答依赖已配置的模型供应商
- 线上多用户、权限、日志、限流需要由 agent 层补齐

### 4.2 中长期正式架构

适合后续上线和稳定维护：

```text
web/
  前端聊天入口

agent/
  Q&A API
  Prompt 编排
  模型调用
  引用来源整理
  会话管理
  权限校验

wiki/xiqu-knowledge/
  sage-wiki 生成的 wiki Markdown 内容
  或同步后的索引 / 向量库 / 数据库
```

核心思路：

- 使用 `sage-wiki` 负责知识库生产
- 将生成后的 wiki 内容作为 agent 的知识来源
- agent 自己负责检索适配、问答、API、安全和部署

## 5. agent 目录职责

```text
agent/
├── agents.md       # 当前文档，记录智能体建设方案和约定
├── api/            # Web 可调用接口，例如 /api/agent/ask
├── config/         # sage-wiki 目录、模型、agent 端口等配置示例
├── core/           # 问答智能体主流程
├── knowledge/      # 知识库访问层，封装 sage-wiki CLI/MCP 或 wiki 文件读取
├── memory/         # 会话记忆、用户上下文，可选
├── prompts/        # 系统提示词、检索提示词、回答提示词
├── scripts/        # 构建/验证脚本
└── tests/          # 接口和核心链路测试
```

## 6. API 设计草案

前端只调用 agent 自己的接口，不直接调用 `sage-wiki`。

### 6.1 问答接口

```http
POST /api/agent/ask
```

请求：

```json
{
  "question": "京剧和昆曲有什么区别？",
  "sessionId": "optional-session-id",
  "history": [
    {
      "role": "user",
      "content": "我想了解戏曲"
    },
    {
      "role": "assistant",
      "content": "可以先从剧种和代表剧目开始。"
    }
  ]
}
```

响应：

```json
{
  "answer": "京剧和昆曲都属于中国戏曲，但在历史、唱腔、表演节奏和代表剧目上有所不同……",
  "sources": [
    {
      "title": "京剧概述",
      "path": "wiki/xiqu-knowledge/wiki/concepts/京剧.md"
    },
    {
      "title": "昆曲概述",
      "path": "wiki/xiqu-knowledge/wiki/concepts/昆曲.md"
    }
  ],
  "relatedQuestions": [
    "京剧有哪些经典剧目？",
    "昆曲为什么被称为百戏之祖？"
  ]
}
```

### 6.2 原始资料访问接口

```http
GET /api/agent/source?path=raw%2F...
```

说明：该接口只允许访问 `wiki/xiqu-knowledge` 内的资料文件，用于前端点击 `sources[].sourceUrls[]` 打开原始资料。图片/PDF 会尽量 inline 打开，docx/xlsx/pptx 等 Office 文件通常由浏览器下载。

### 6.2 健康检查接口

```http
GET /api/agent/health
```

响应：

```json
{
  "status": "ok",
  "knowledgeProvider": "sage-wiki",
  "knowledgeDir": "wiki/xiqu-knowledge"
}
```

## 7. Q&A 主流程

当前推荐采用 **LLM-planned RAG with self-answer fallback**。核心原则：`sage-wiki` 负责知识库生产和检索，agent 负责检索规划、资料组织、最终回答和 sources 输出；不要把 `sage-wiki query` 的成品答案直接透传给前端。

```text
1. 前端提交原始 question
2. agent 校验问题、会话和权限
3. agent 调用 LLM 生成第一轮检索计划 retrieval plan
   - 输入：原始 question
   - 输出：2-5 个适合 sage-wiki/BM25 的检索 query
   - 示例："京剧和昆曲有什么区别？" -> ["京剧 昆曲 区别", "京剧 昆曲 唱腔 表演 特点", "京剧 概述", "昆曲 概述"]
4. agent 调用 knowledge 层按计划执行 sage-wiki search
5. agent 合并、去重、重排检索结果，并读取命中的 wiki/summaries、wiki/concepts 或 source/page 内容
6. 如果第一轮没有命中，agent 把失败 query 和失败原因交给 LLM，重新生成第二轮检索计划
7. agent 再次执行 sage-wiki search，继续合并、去重、重排
8. 如果检索到足够资料：
   - agent 将 question + 检索资料 context + sources 拼入回答 prompt
   - agent 调用大模型综合回答
   - 回答必须基于资料，并用【资料1】等方式标注依据
9. 如果两轮仍没有可用资料：
   - agent 可以用模型自身能力回答
   - 必须明确提示“当前知识库未命中相关资料，以下回答基于模型通用知识，仅供参考”
10. agent 整理 answer、sources、relatedQuestions、meta 返回前端
```

### 7.1 模块职责

```text
agent/api/server.mjs
  HTTP 入口：/api/agent/health、/api/agent/search、/api/agent/ask

agent/core/qaAgent.mjs
  问答编排：调用检索规划、执行检索、合并资料、生成回答、整理响应

agent/core/llmClient.mjs
  大模型调用：检索规划、检索重规划、基于资料综合回答、无资料兜底回答

agent/knowledge/sageWikiCli.mjs
  知识库访问：封装 sage-wiki search/status，解析结果，读取命中的 wiki 文件内容

agent/knowledge/retrievalPlanner.mjs
  检索规划：优先 LLM 生成 query；LLM 不可用时才使用极简规则兜底
```

### 7.2 正确与错误边界

正确链路：

```text
question -> LLM 规划检索 -> sage-wiki search -> agent 组织 context -> LLM 综合回答 -> answer + sources
```

不推荐链路：

```text
question -> 手写固定改写 -> sage-wiki search -> 返回检索摘要
question -> sage-wiki query -> 直接透传答案
```

原因：

- 手写固定改写只能覆盖少数问题，容易把用户意图压扁成关键词。
- `sage-wiki query` 可能输出内部日志，例如 `Filed to: wiki/under_review/...`，不适合作为前端用户答案直接返回。
- agent 应该掌握回答格式、引用格式、兜底策略和前端响应结构。

### 7.3 响应 meta 建议

`/api/agent/ask` 建议返回检索与回答过程摘要，便于调试：

```json
{
  "meta": {
    "provider": "sage-wiki",
    "retrievalMode": "llm-planned-bm25",
    "answerMode": "agent-llm-synthesis",
    "retrievalRounds": [
      {
        "round": 1,
        "queries": ["京剧 昆曲 区别", "京剧 昆曲 唱腔 表演 特点"],
        "resultCount": 6
      }
    ],
    "knowledgeHit": true
  }
}
```

当知识库没有命中时：

```json
{
  "meta": {
    "retrievalMode": "llm-planned-bm25",
    "answerMode": "llm-self-answer-fallback",
    "knowledgeHit": false
  }
}
```


### 7.4 Web 前端对接真实响应示例

以下是 2026-06-13 本地验证通过的一次真实请求和响应，可作为后续 `web/` 问答页开发的字段渲染样例。

请求：

```bash
curl -s -X POST http://127.0.0.1:8787/api/agent/ask -H 'Content-Type: application/json' -d '{"question":"京剧和昆曲有什么区别？"}'
```

响应要点：

- `answer`：前端主回答区域，Markdown 风格文本，可直接按段落、加粗、列表和换行渲染。
- `sources`：引用来源列表，建议折叠展示；优先展示 `title`，有 `path` 时可作为知识页路径；有 `sourceUrls` 时可渲染为“查看原始资料”链接。
- `sourcePaths` / `sourceUrls`：`sourcePaths` 是知识库内原始资料路径，`sourceUrls` 是 agent 暴露的安全访问地址，例如 `/api/agent/source?path=...`，前端点击后可打开图片/PDF，Office 文档通常会下载。
- `relatedQuestions`：回答末尾的追问建议，可渲染为快捷提问按钮。
- `meta.retrievalRounds`：调试用，建议开发环境展示，生产环境默认隐藏。
- `meta.answerMode=agent-llm-synthesis` 且 `meta.knowledgeHit=true`：说明这是“知识库命中 + agent 综合回答”的理想路径。

```json
{
  "answer": "京剧和昆曲都是中国戏曲的瑰宝，但它们在历史起源、音乐唱腔和表演风格上有着显著的区别。为您总结了以下几个核心不同点：\n\n**1. 历史地位与起源**\n* **昆曲**：发源于元末明初的江苏昆山，是中国现存最古老的戏曲剧种，享有“百戏之祖”和“百戏之师”的崇高地位，对京剧等后世剧种的形成产生了深远影响【资料3】。\n* **京剧**：形成时间晚于昆曲，被誉为中国“国粹”，是后世发展起来且影响力极大的代表性剧种【资料2】【资料3】。\n\n**2. 音乐与唱腔体制**\n* **昆曲**：采用“曲牌体”，伴奏以曲笛为主。唱腔讲究平仄音韵，婉转细腻、柔润如水，因此被称为“水磨调”【资料3】。\n* **京剧**：采用“板腔体”，在音乐结构和节奏变化上与昆曲的曲牌体有本质不同【资料3】。\n\n**3. 表演风格（以水袖为例）**\n* **昆曲**：表演遵循“无动不舞，无声不歌”的原则。在水袖运用上，讲究细腻、连绵不断，水袖的起伏与婉转的唱腔高度契合【资料3】【资料4】。\n* **京剧**：表演高度规范化、程式化。水袖动作讲究“圆”与“寸劲”，节奏感极强，与锣鼓经的配合非常严密【资料4】。\n\n**4. 行当划分**\n* **昆曲**：角色划分极为精细，在生、旦、净、末、丑五大类之下，又细分出二十余种“家门”（如巾生、闺门旦等），以精准匹配人物性格与身份【资料3】。\n* **京剧**：同样分为生、旦、净等行当（如经典的旦角和净角/花脸），但整体视觉与表演风格更偏向于大气、鲜明【资料2】【资料3】。\n\n简单来说，昆曲更像是一首婉转细腻的古典诗词，而京剧则是一出节奏鲜明、大气磅礴的历史大戏。\n\n💡 **相关追问建议**：\n1. 昆曲的“水磨调”具体是怎么演唱的？\n2. 京剧里的“净角”（花脸）有哪些经典代表人物？\n3. 戏曲里的“水袖”一共有多少种基本动作？",
  "sources": [
    {
      "title": "昆曲",
      "path": "",
      "score": 0.0159,
      "snippet": "昆曲\n昆曲（Kun Opera），原名“昆山腔”（简称“昆腔”），是中国古老的戏曲声腔、剧种�...",
      "tags": ["article", "tier:0"]
    },
    {
      "title": "京剧",
      "path": "",
      "score": 0.0156,
      "snippet": "京剧\n京剧（Beijing Opera），又称平剧、京戏，中国国粹之一，是中国影响最大的戏曲剧种，...",
      "tags": ["article", "tier:0"]
    },
    {
      "title": "wiki/concepts/kunqu-opera.md",
      "path": "wiki/concepts/kunqu-opera.md",
      "score": 0.0143,
      "snippet": "---\nconcept: kunqu-opera\naliases: [\"Kunqu Opera\", \"昆剧\", \"昆曲\", \"Kunqu\", \"kunqu\", \"kunju\"]\nsources: [\"周正平设...",
      "tags": ["concept", "Kunqu Opera", "昆剧", "昆曲", "Kunqu", "kunqu", "kunju"]
    },
    {
      "title": "wiki/concepts/shuixiu.md",
      "path": "wiki/concepts/shuixiu.md",
      "score": 0.0161,
      "snippet": "---\nconcept: shuixiu\naliases: [\"water sleeves\", \"水袖\"]\nsources: [\"越剧梁祝.jpg\", \"raw/2026大创项目（戏曲�...",
      "tags": ["concept", "water sleeves", "水袖"]
    }
  ],
  "relatedQuestions": [
    "京剧有哪些经典剧目？",
    "昆曲为什么被称为百戏之祖？",
    "初学者应该先了解京剧还是昆曲？"
  ],
  "meta": {
    "provider": "sage-wiki",
    "retrievalMode": "llm-planned-bm25",
    "answerMode": "agent-llm-synthesis",
    "retrievalRounds": [
      {
        "round": 1,
        "plannerMode": "llm-plan",
        "plannerError": "",
        "queries": [
          "京剧 昆曲 区别",
          "京剧 昆曲 特点 唱腔",
          "京剧 昆曲 表演 历史",
          "京剧 昆曲 代表剧目 概述"
        ],
        "resultCount": 13,
        "searches": [
          { "query": "京剧 昆曲 区别", "ok": true, "resultCount": 10, "error": "" },
          { "query": "京剧 昆曲 特点 唱腔", "ok": true, "resultCount": 10, "error": "" },
          { "query": "京剧 昆曲 表演 历史", "ok": true, "resultCount": 10, "error": "" },
          { "query": "京剧 昆曲 代表剧目 概述", "ok": true, "resultCount": 10, "error": "" }
        ]
      }
    ],
    "knowledgeHit": true,
    "llmError": ""
  }
}
```

前端渲染建议：

```text
answer -> 聊天气泡/回答正文，支持 Markdown
sources -> “参考资料”抽屉或折叠列表
relatedQuestions -> 快捷追问 chips
meta -> 开发调试面板，生产默认隐藏
```

## 8. Prompt 基本约定

智能体应遵守以下回答原则：

- 使用中文回答
- 面向移动端用户，回答简洁、自然、容易理解
- 优先基于知识库内容回答
- 不确定时明确说明，不编造戏曲资料
- 涉及具体来源时返回引用页面
- 和戏曲无关的问题，可以礼貌引导回戏曲知识、平台功能或学习建议

系统提示词方向：

```text
你是 xiqu 项目的戏曲问答智能体。你的任务是基于知识库资料，回答用户关于戏曲、剧种、剧目、唱腔、行当、练功和平台功能的问题。回答应准确、简洁、有出处。若知识库不足以支持回答，请说明不确定，并建议用户换个问法或补充资料。
```

## 9. sage-wiki 构建方式

推荐使用脚本：

```bash
bash agent/scripts/build_sage_wiki.sh
```

脚本会在 `wiki/xiqu-knowledge` 下完成初始化、配置检查、编译、状态检查、搜索和问答冒烟验证。

手工命令：

```bash
cd wiki/xiqu-knowledge
sage-wiki init
sage-wiki doctor
sage-wiki compile
sage-wiki status
sage-wiki search "京剧和昆曲有什么区别？"
sage-wiki query "京剧四大名旦是谁？"
```

## 10. 开发顺序建议

### 阶段一：验证 sage-wiki 知识库

1. 安装 `sage-wiki`
2. 在 `wiki/xiqu-knowledge` 初始化项目
3. 导入少量高质量戏曲资料到 `raw/`
4. 运行 `agent/scripts/build_sage_wiki.sh`
5. 观察生成的 wiki 页面质量
6. 验证 search 和 query 是否满足问答需求

### 阶段二：构建 agent API MVP

1. 在 `agent/config/` 增加 sage-wiki、模型和 agent 端口配置
2. 在 `agent/knowledge/` 封装 sage-wiki CLI/MCP 或 wiki 文件读取
3. 在 `agent/core/` 实现 LLM 检索规划：第一轮 query plan、第二轮 replan
4. 在 `agent/core/` 实现问答主流程：检索、合并、去重、重排、读取 context、生成回答
5. 在 `agent/prompts/` 增加系统提示词、检索规划提示词、回答综合提示词
6. 在 `agent/api/` 暴露 `/api/agent/ask` 和 `/api/agent/search`
7. 返回 `answer`、`sources`、`relatedQuestions`、`meta.retrievalRounds`

### 阶段三：接入 Web 前端

1. 新增前端问答页面或组件
2. 调用 `/api/agent/ask`
3. 展示回答内容
4. 展示引用来源
5. 增加 loading、错误态、多轮会话

### 阶段四：正式化

1. 评估 CLI、MCP、文件读取三种接入方式
2. 明确线上构建和发布流程
3. 增加服务端检索缓存或索引
4. 增加用户权限、日志、限流和监控
5. 处理模型 key、知识库写权限和部署安全

## 11. 风险和注意事项

### 11.1 构建风险

`sage-wiki compile` 依赖模型供应商和 API key。资料量变大后，编译成本和耗时需要先通过 `sage-wiki compile --estimate` 评估。

### 11.2 安全风险

模型 API key 不应暴露给浏览器。前端只访问 agent，由 agent 在服务端保存和使用敏感配置。

### 11.3 知识质量风险

问答质量取决于导入资料质量和 wiki 生成质量。需要优先准备权威、结构清晰、可验证的戏曲资料。

## 12. 当前推荐决策

当前阶段建议采用：

```text
短期：sage-wiki 在 wiki/xiqu-knowledge 构建知识库；agent 用 LLM 规划检索 query，调用 sage-wiki search 获取资料，再由 agent 综合回答
长期：sage-wiki 负责知识库生产；agent 负责检索规划、检索适配、回答生成、sources、会话、权限、日志和部署
```

落地优先级：

1. 先实现 `LLM plan -> sage-wiki search -> agent synthesize` 主链路。
2. 再实现第一轮无结果后的 `LLM replan -> sage-wiki search`。
3. 最后实现两轮无结果后的 `LLM self-answer fallback`，并在答案和 `meta.knowledgeHit=false` 中明确标记。
