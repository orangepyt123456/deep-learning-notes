# -*- coding: utf-8 -*-
"""给每个章节插入 Mermaid 思维导图，并在明确的时间线小节补时间线图。

可重复运行：已有 <!-- chapter-mindmap --> / <!-- chapter-timeline --> 的文件会跳过对应插入。
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"

SKIP_H2 = {"目录", "本章导图", "参考文献", "延伸阅读", "相关阅读", "贡献与反馈"}


def sanitize(text: str, limit: int = 42) -> str:
    text = re.sub(r"\{#.*?\}", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = text.replace("`", "").replace("*", "").replace("_", " ")
    text = re.sub(r"[()\[\]{}<>\"'#]", " ", text)
    text = text.replace(":", "：").replace(";", "；")
    text = re.sub(r"\s+", " ", text).strip(" -—|")
    if len(text) > limit:
        text = text[: limit - 1] + "…"
    return text


def headings(md: str):
    found = []
    fence = None
    for line in md.splitlines():
        m = re.match(r"^\s{0,3}(`{3,}|~{3,})", line)
        if fence:
            if m and m.group(1)[0] == fence[0] and len(m.group(1)) >= len(fence):
                fence = None
            continue
        if m:
            fence = m.group(1)
            continue
        hm = re.match(r"^(#{1,3})\s+(.+?)\s*$", line)
        if hm:
            found.append((len(hm.group(1)), hm.group(2).strip()))
    return found


def mindmap_block(md: str) -> str | None:
    hs = headings(md)
    title = next((sanitize(t, 18) for level, t in hs if level == 1), "本章")
    if not title:
        title = "本章"
    lines = ["mindmap", f"  root(({title}))"]
    h2_count = 0
    h3_count = 0
    current_h2 = False
    for level, text in hs:
        label = sanitize(text)
        if not label or label in SKIP_H2:
            if level == 2:
                current_h2 = False
            continue
        if level == 2:
            if h2_count >= 12:
                current_h2 = False
                continue
            h2_count += 1
            h3_count = 0
            current_h2 = True
            lines.append(f"    {label}")
        elif level == 3 and current_h2 and h3_count < 4:
            h3_count += 1
            lines.append(f"      {label}")
    if h2_count == 0:
        return None
    body = "\n".join(lines)
    return (
        "<!-- chapter-mindmap -->\n"
        "## 本章导图\n\n"
        "先看这张图，再往下读。它只保留本章的标题骨架，节点名对应后文的小节。\n\n"
        "```arbor-tree\n"
        f"{body}\n"
        "```\n"
    )


def insert_mindmap(md: str) -> str:
    if "<!-- chapter-mindmap -->" in md:
        return md
    block = mindmap_block(md)
    if not block:
        return md
    lines = md.splitlines()
    h1 = next((i for i, line in enumerate(lines) if re.match(r"^#\s+", line)), None)
    if h1 is None:
        return block + "\n" + md
    i = h1 + 1
    while i < len(lines):
        stripped = lines[i].strip()
        if stripped == "" or stripped.startswith(">") or stripped == "---":
            i += 1
            continue
        break
    lines.insert(i, "")
    lines.insert(i + 1, block.rstrip("\n"))
    lines.insert(i + 2, "")
    return "\n".join(lines) + ("\n" if md.endswith("\n") else "")


TIMELINES = {
    "docs/architectures/cnn.md": (
        "## 3. 经典架构演进",
        """<!-- chapter-timeline -->
```arbor-timeline
timeline
    title CNN 架构演进
    1998 : LeNet-5 确立卷积-池化-全连接
    2012 : AlexNet 把深度卷积带上 ImageNet
    2014 : VGG 的小卷积核与 GoogLeNet 的多尺度
    2015 : ResNet 用残差连接把网络做深
    2017 : DenseNet 密集复用特征
    2018 : SENet 做通道注意力
    2019 : EfficientNet 同时缩放深度、宽度和分辨率
    2022 : ConvNeXt 用 Transformer 的经验改造 CNN
```
""",
    ),
    "docs/architectures/object-detection.md": (
        "### 2.4 经典演进",
        """<!-- chapter-timeline -->
```arbor-timeline
timeline
    title 两阶段检测的经典演进
    2014 : R-CNN 用候选框加 CNN
    2015 : Fast R-CNN 整图提特征
         : Faster R-CNN 用 RPN 自己提候选框
    2017 : FPN 融合多尺度
         : Mask R-CNN 把检测和实例分割接到一起
    2018 : Cascade R-CNN 逐级提高 IoU
```
""",
    ),
    "docs/architectures/recommendation.md": (
        "### 3.1 演进路线",
        """<!-- chapter-timeline -->
```arbor-timeline
timeline
    title 深度 CTR 模型演进
    2010 : LR 与 FM 记住特征组合
    2016 : Wide and Deep 同时要记忆和泛化
    2017 : DeepFM 把 FM 和深度网络接到一起
    2018 : DIN 按候选物品关注用户历史
    2019 : DIEN 把兴趣随时间的变化建模进来
    之后 : SIM 与多目标、多塔结构
```
""",
    ),
    "docs/architectures/video-generation.md": (
        "## 5 代表模型 {#5}",
        """<!-- chapter-timeline -->
```arbor-timeline
timeline
    title 视频生成代表模型
    2024 : Sora 演示引起广泛关注
         : Movie Gen
         : Veo 2
    2025 : Wan 2.1 开源
         : Sora 2
         : Kling、CogVideoX、HunyuanVideo
    2026 : 更长时长、原生音频和可控镜头
```
""",
    ),
    "docs/llm-mllm/tokenizer-embedding.md": (
        "## 5. 词向量演进",
        """<!-- chapter-timeline -->
```arbor-timeline
timeline
    title 词向量演进
    2013 : Word2Vec 用上下文预测得到静态词向量
    2014 : GloVe 结合全局共现
    2018 : ELMo 让同一个词随上下文变化
         : BERT 把上下文表示变成预训练默认范式
    之后 : 大模型只保留一层可学习嵌入，语义主要在后面的层里
```
""",
    ),
    "docs/llm-mllm/post-training-survey.md": (
        "### 2.1 历史演化",
        """<!-- chapter-timeline -->
```arbor-timeline
timeline
    title 后训练主线
    2018 : 预训练后做任务微调
    2022 : RLHF 用人类偏好改行为
    2023 : DPO 直接优化成对偏好
    2024 : 推理模型把强化学习用到长思维链
    2025 : DeepSeek-R1 把这条路线公开到可复现
```
""",
    ),
    "docs/llm-mllm/inference.md": (
        "### 3.3 Flash Attention 版本演进",
        """<!-- chapter-timeline -->
```arbor-timeline
timeline
    title Flash Attention
    2022 : v1 用分块和在线 softmax 避免写出整张注意力矩阵
    2023 : v2 调整并行，减少非矩阵乘法开销
    2024 : v3 针对 Hopper 做异步和 FP8
```
""",
    ),
    "docs/embodied-ai/vla.md": (
        "## 2 演进时间线 {#2}",
        """<!-- chapter-timeline -->
```arbor-timeline
timeline
    title VLA 演进
    2022 : SayCan 与 RT-1
    2023 : PaLM-E、RT-2、RT-X
    2024 : OpenVLA、Octo、π0、RDT-1B
    2025 : Helix、GR00T N1、Gemini Robotics、π0.5
    2025-2026 : π星0.6、π0.7 与大规模真实操作数据
```
""",
    ),
    "docs/embodied-ai/world-model.md": (
        "### 2.2 DreamerV1 → V2 → V3 演进",
        """<!-- chapter-timeline -->
```arbor-timeline
timeline
    title Dreamer 系列
    2020 : DreamerV1 在隐空间里做强化学习
    2022 : DreamerV2 改用离散隐变量
    2023 : DreamerV3 用一套超参覆盖多种环境
```
""",
    ),
}


def insert_timeline(rel: str, md: str) -> str:
    if "<!-- chapter-timeline -->" in md:
        return md
    spec = TIMELINES.get(rel)
    if not spec:
        return md
    anchor, block = spec
    if anchor not in md:
        raise SystemExit(f"找不到时间线锚点: {rel} :: {anchor}")
    return md.replace(anchor, anchor + "\n\n" + block.rstrip() + "\n", 1)


def main():
    changed = 0
    for path in sorted(DOCS.rglob("*.md")):
        rel = path.relative_to(ROOT).as_posix()
        original = path.read_text(encoding="utf-8")
        updated = insert_mindmap(original)
        updated = insert_timeline(rel, updated)
        if updated != original:
            path.write_text(updated, encoding="utf-8", newline="\n")
            changed += 1
    print(f"updated {changed} markdown files")


if __name__ == "__main__":
    main()
