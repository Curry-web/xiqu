# sage-wiki 接入冒烟测试清单

在正式开发 agent API 前，先完成以下人工冒烟测试。

## 测试 1：命令可用

```bash
sage-wiki --help
```

通过标准：能看到命令帮助。

## 测试 2：知识库配置检查

```bash
cd wiki/xiqu-knowledge
sage-wiki doctor
```

通过标准：配置、模型供应商、密钥和目录检查通过，或错误信息明确可修复。

## 测试 3：编译

```bash
cd wiki/xiqu-knowledge
sage-wiki compile
```

通过标准：编译完成，并在 `wiki/xiqu-knowledge/wiki/` 生成结构化内容。

## 测试 4：戏曲知识检索

```bash
cd wiki/xiqu-knowledge
sage-wiki search "京剧 昆曲 区别"
```

通过标准：返回京剧、昆曲相关页面或片段。注意：未配置 embedding 时，中文自然问句可能因为 BM25 分词不足而无结果，冒烟测试优先使用空格分隔关键词。

## 测试 5：戏曲问答

```bash
cd wiki/xiqu-knowledge
sage-wiki query "京剧四大名旦是谁？"
```

通过标准：回答与知识库内容相关，并能体现来源或引用线索。
