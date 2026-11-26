# -*- coding: utf-8 -*-
"""从 ai-core-literature.canvas.tsx 导出 AI Atlas 数据为 JS。"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CANVAS = Path(r"C:\Users\22470\.cursor\projects\e\canvases\ai-core-literature.canvas.tsx")
OUT = ROOT / "docs" / "javascripts" / "ai-atlas-data.js"

CATS = [
    {"id": "learning", "code": "01", "name": "机器学习", "en": "LEARNING", "color": "#5c6bc0"},
    {"id": "architectures", "code": "02", "name": "网络架构", "en": "ARCHITECTURES", "color": "#7e57c2"},
    {"id": "training", "code": "03", "name": "训练与系统", "en": "TRAINING", "color": "#26a69a"},
    {"id": "generative", "code": "04", "name": "生成模型", "en": "GENERATIVE", "color": "#ef5350"},
    {"id": "language", "code": "05", "name": "语言与基础模型", "en": "LANGUAGE", "color": "#42a5f5"},
    {"id": "vision", "code": "06", "name": "视觉与多模态", "en": "VISION", "color": "#ffa726"},
    {"id": "agents", "code": "07", "name": "智能体", "en": "AGENTS", "color": "#ab47bc"},
    {"id": "embodied", "code": "08", "name": "具身智能", "en": "EMBODIED", "color": "#66bb6a"},
]

CAT_BLURBS = {
    "learning": "从感知机、SVM 与 boosting，到深度表征、正则化、对比学习与泛化理论。",
    "architectures": "CNN、RNN、Transformer、GNN、ViT、MoE 与 Mamba 等主干网络演进。",
    "training": "优化器、混合精度、分布式训练、缩放法则与推理侧效率工程。",
    "generative": "GAN、VAE、扩散、流匹配与潜空间生成式建模主线。",
    "language": "预训练、对齐、RAG、开源大模型与推理时计算。",
    "vision": "检测分割、CLIP、多模态与视觉基础模型。",
    "agents": "ReAct、工具调用、编程智能体与评测基准。",
    "embodied": "强化学习、VLA、世界模型与机器人基础模型。",
}

ROW = re.compile(
    r'\{\s*cat:\s*"([^"]+)",\s*year:\s*"(\d{4})",\s*title:\s*"([^"]+)",\s*authors:\s*"([^"]+)",\s*source:\s*"([^"]+)"\s*\}'
)


def slug(title: str, year: str, idx: int) -> str:
    base = re.sub(r"[^a-zA-Z0-9]+", "-", title.lower()).strip("-")[:48]
    return f"p-{year}-{base or 'paper'}-{idx}"


def main() -> None:
    text = CANVAS.read_text(encoding="utf-8")
    papers = []
    for i, m in enumerate(ROW.finditer(text)):
        cat, year, title, authors, source = m.groups()
        papers.append(
            {
                "id": slug(title, year, i),
                "cat": cat,
                "year": int(year),
                "title": title,
                "authors": authors,
                "source": source,
            }
        )
    payload = {"categories": CATS, "blurbs": CAT_BLURBS, "papers": papers}
    OUT.write_text(
        "window.DL_ATLAS = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    print(f"wrote {OUT} ({len(papers)} papers)")


if __name__ == "__main__":
    main()