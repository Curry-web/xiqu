# Agent API 冒烟测试

启动服务：

```bash
cd agent
node api/server.mjs
```

健康检查：

```bash
curl http://127.0.0.1:8787/api/agent/health
```

问答接口：

```bash
curl -X POST http://127.0.0.1:8787/api/agent/ask \
  -H 'Content-Type: application/json' \
  -d '{"question":"京剧和昆曲有什么区别？"}'
```

快速本地冒烟可关闭 agent LLM 综合回答，只验证 API、检索和 sources 闭环：

```bash
AGENT_USE_LLM=0 bash agent/scripts/smoke_agent.sh
```

正式问答链路应验证：

```text
原始问题 -> LLM 生成检索计划 -> sage-wiki search -> agent 读取资料并综合回答 -> answer + sources
```

如果第一轮检索无结果，应进入 LLM 重新规划检索；如果两轮仍无结果，才允许模型用自身能力兜底回答，并明确标记知识库未命中。
