# 2026 前沿更新

> 这一页只记录 2026 年已经核对过官方介绍的模型节点，用来补上 [技术演进史](../fundamentals/tech-evolution.md) 原先停在 2025 年的部分。没有核对到官方页面的型号不写进来。

截止日期：2026 年 11 月 24 日。

## 这一年在改变什么

2025 年的主线是「让模型会想」：o1、R1 把额外计算花在回答之前。2026 年的主线是「让模型把一件事做完」：编码、操作软件、检索、写文档和表格被放进同一次任务里。上下文也从「窗口很大但很贵」变成「百万 token 可以当默认配置来定价」。

读这一年的发布，建议盯三个数，而不是只看模型名字：

- **激活参数**，不是总参数。稀疏模型每次只算一小部分。
- **上下文单价是否随长度跳涨**。有的型号在整个窗口里用同一个价格。
- **任务是单轮问答，还是跨工具的长任务**。官方现在主要拿后一种来比较。

## 已核对的发布

### GPT-5.4（2026 年 3 月）

OpenAI 的介绍页把它称为面向专业工作的前沿模型，并点名四项能力：代码、计算机操作、工具搜索、100 万 token 上下文。发布追踪把它记在 2026 年 3 月 5 日，本页采用「2026 年 3 月」，精确到日以官方页更新为准。

https://openai.com/index/introducing-gpt-5-4/

### GPT-5.5（2026 年 4 月 23 日）

官方页面写明这是面向真实工作的一档模型：写和改代码、联网研究、分析数据、做文档和表格、操作软件，并在工具之间把任务做完。它特别强调两件工程事实：

- 单 token 延迟与 GPT-5.4 的实际服务延迟相当，但能力更高；
- 完成同类 Codex 任务时使用的 token 更少。

4 月 24 日，GPT-5.5 与 GPT-5.5 Pro 进入 API。页面同时说明这是当时保障措施最强的一次发布，评估里包含网络安全和生物能力测试。

https://openai.com/index/introducing-gpt-5-5/

### DeepSeek-V4（2026 年 4 月 24 日）

DeepSeek 将 V4 Preview 开源，并把 100 万 token 上下文设为官方服务的默认长度。两个型号：

| 型号 | 总参数 | 激活参数 | 位置 |
|---|---|---|---|
| V4-Pro | 1.6T | 49B | 对标当时最强的闭源模型，官方称开放模型里的智能体编码表现领先 |
| V4-Flash | 284B | 13B | 更快、更便宜，简单智能体任务上接近 Pro |

结构上的两个关键词是 **逐 token 压缩** 和 **DSA（DeepSeek Sparse Attention）**。目的不是把注意力公式改掉，而是让长上下文的计算和显存不要随长度平方地涨上去。两个型号都有思考 / 非思考两种模式，接口兼容 OpenAI Chat Completions 和 Anthropic API。

官方还写了一条容易忽略的迁移说明：`deepseek-chat` 和 `deepseek-reasoner` 在 2026 年 7 月 24 日 15:59 UTC 之后停用，在此之前已经路由到 V4-Flash。

https://www.deepseek.com/en/news/v4-preview/

### Claude Opus 5（2026 年 7 月 24 日）

Anthropic 把 Opus 5 放在 Opus 这一档，用来支撑长时间运行的智能体，并提高编码和专业工作的表现。官方比较里有两个需要一起读的句子：

- 它接近 Claude Fable 5 的前沿能力，价格大约是其一半；
- 在 Frontier-Bench 和 GDPval-AA 这类编码与知识工作评估上达到当时最优，网络安全任务仍落后于 Claude Mythos 5。

因此 Fable 5 和 Mythos 5 在这篇官方新闻发布时已经存在。本页不单独展开它们的参数和价格，因为没有在本次核对中打开对应的产品页。

https://www.anthropic.com/news/claude-opus-5

### Gemini 4 Hydrogen（2026 年 11 月 12 日）

Google 把 Hydrogen 定义成日常智能体流程的速度型型号，同日覆盖 AI Studio、Gemini API、Gemini 应用和搜索等入口。同一篇文章把 **Gemini 4 Carbon** 和 **Gemini 4 Argon** 写成更擅长长程难题的前沿型号，所以 Gemini 4 不是只有 Hydrogen 一个点。

页面给出的两个可以核对的数字：

- 在 Artificial Analysis Intelligence Index 上，Hydrogen 默认的 high thinking 为 51，Argon 为 50；Hydrogen 调到 xhigh 为 54。
- 在整个 100 万 token 窗口内统一定价：输入 1.50 美元 / 百万 token，输出 7.50 美元 / 百万 token。

https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-hydrogen/

## 还没有写进本页的内容

2025 年 11 月到 12 月还有一批已经能打开官方页、但细节不如上面充分的型号，它们补在演进史的 2025 表里：Claude Opus 4.5、GPT-5.2。2026 年各实验室还有大量小版本和开源续作。第三方年表里出现、而本次没有打开官方页面的名字，不写入正文，避免把未核对的参数传下去。

## 和本站其他章节的关系

- 年份地图：[技术演进史（2012–2026）](../fundamentals/tech-evolution.md)
- 推理模型怎么训出来：[推理模型 o1/R1](./reasoning-models.md)
- 长上下文怎么实现：[长上下文与检索增强](./long-context-rag.md)
- 模型怎么接工具：[工具使用与 MCP](../agents/tools-and-mcp.md)
