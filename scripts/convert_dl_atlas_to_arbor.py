# -*- coding: utf-8 -*-
"""将 docs/javascripts/ai-atlas-data.js 转为 ARBOR arbor-atlas/data/*.json。"""
from __future__ import annotations

import json
import re
import urllib.parse
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JS_DATA = ROOT / "docs" / "javascripts" / "ai-atlas-data.js"
ARBOR = ROOT / "arbor-atlas" / "data"
CHECKED_AT = date.today().isoformat()

TYPE_MAP = {"笔记": "方法", "补入": "模型"}

DOMAIN_BLURBS_EN = {
    "learning": "From perceptrons and SVMs to deep representation learning, regularization, contrastive learning and generalization.",
    "architectures": "CNN, RNN, Transformer, GNN, ViT, MoE and Mamba lineages.",
    "training": "Optimizers, mixed precision, distributed training, scaling laws and inference efficiency.",
    "generative": "GAN, VAE, diffusion, flow matching and latent generative modeling.",
    "language": "Pre-training, alignment, RAG, open LLMs and test-time compute.",
    "vision": "Detection, segmentation, CLIP, multimodal and vision foundation models.",
    "agents": "ReAct, tool use, coding agents and evaluation benchmarks.",
    "embodied": "RL, VLA, world models and robotics foundation models.",
}


def load_dl_atlas() -> dict:
    text = JS_DATA.read_text(encoding="utf-8")
    text = text.strip()
    if text.startswith("window.DL_ATLAS"):
        text = text.split("=", 1)[1].strip().rstrip(";")
    return json.loads(text)


def short_title(title: str) -> str:
    t = title.strip()
    if len(t) <= 28:
        return t
    return t[:25] + "…"


def paper_type(source: str) -> str:
    return TYPE_MAP.get(source, "方法")


def scores_for_year(year: int) -> dict:
    if year >= 2020:
        return {"representativeness": 4, "method": 4, "evidence": 3}
    if year >= 2012:
        return {"representativeness": 3, "method": 3, "evidence": 3}
    return {"representativeness": 3, "method": 3, "evidence": 3}


def scholar_url(title: str, authors: str) -> str:
    q = urllib.parse.quote(f"{title} {authors}")
    return f"https://scholar.google.com/scholar?q={q}"


def make_node(p: dict, blurb_zh: str, blurb_en: str) -> dict:
    title = p["title"]
    authors = p["authors"]
    year = int(p["year"])
    dom = p["cat"]
    zh = f"《{title}》是计算机与人工智能核心文献图谱中的代表工作之一，归入本图谱的策展性浏览框架。"
    en = f"{title} is included as a curated anchor work in this Computer Science and AI literature atlas."
    caveat_zh = "本条目为教学与导航用途的精选收录，不等同于系统性综述结论或独立复现验证。"
    caveat_en = "This entry is a curated teaching/navigation inclusion, not a systematic-review verdict or independent replication."
    return {
        "id": p["id"],
        "short": short_title(title),
        "title": title,
        "authors": authors,
        "year": year,
        "domain": dom,
        "secondaryDomains": [],
        "type": paper_type(p.get("source", "补入")),
        "summary": zh,
        "summaryEn": en,
        "retained": "论文方法与问题设定的可追溯记录。",
        "retainedEn": "A traceable record of the problem setting and method.",
        "caveat": caveat_zh,
        "caveatEn": caveat_en,
        "source": {
            "origin": "research",
            "reference": f"{authors}, {year}",
            "checkedAt": CHECKED_AT,
            "publicationType": "conference",
            "sources": [{"title": title, "url": scholar_url(title, authors)}],
        },
        "url": scholar_url(title, authors),
        "scores": scores_for_year(year),
        "scoreReason": "编辑评分用于图谱导航优先级，不代表引用量或证据强度。",
        "scoreReasonEn": "Editorial score guides atlas navigation; not citations or evidence strength.",
        "keywords": [title.split()[0][:24], dom, "deep learning", "人工智能"],
    }


def main() -> None:
    data = load_dl_atlas()
    blurbs = data.get("blurbs") or {}
    nodes = [
        make_node(p, blurbs.get(p["cat"], ""), DOMAIN_BLURBS_EN.get(p["cat"], ""))
        for p in data["papers"]
    ]
    counts = Counter(n["domain"] for n in nodes)
    years = [n["year"] for n in nodes]
    min_y, max_y = min(years), max(years)

    review = {
        "checkedAt": CHECKED_AT,
        "scope": {
            "surveyNodes": 0,
            "researchAdditions": len(nodes),
            "totalNodes": len(nodes),
            "baselineNodes": 0,
            "newNodes": len(nodes),
            "baselineSurveyNodes": 0,
            "domains": len(data["categories"]),
            "coverage": f"{min_y}–{max_y}",
            "exhaustive": False,
            "domainCounts": dict(counts),
            "relationships": 0,
            "baselineRelationships": 0,
        },
        "findings": [
            {
                "domain": c["id"],
                "zh": blurbs.get(c["id"], c["name"]),
                "en": DOMAIN_BLURBS_EN.get(c["id"], c["en"]),
            }
            for c in data["categories"]
        ],
        "detailedFindings": [],
        "reviewBatches": [{"checkedAt": CHECKED_AT, "label": "CS/AI core literature import"}],
        "sources": [
            {
                "title": "深度学习笔记 · 核心文献图谱",
                "url": "https://orangepyt123456.github.io/deep-learning-notes/preview/arbor/",
            }
        ],
    }

    ARBOR.mkdir(parents=True, exist_ok=True)
    (ARBOR / "nodes.json").write_text(json.dumps(nodes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ARBOR / "relationships.json").write_text("[]\n", encoding="utf-8")
    (ARBOR / "research-review.json").write_text(json.dumps(review, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(nodes)} nodes to {ARBOR}")


if __name__ == "__main__":
    main()