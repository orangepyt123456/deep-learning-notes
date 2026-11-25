import pathlib
import re

root = pathlib.Path(__file__).resolve().parents[1] / "docs"
mindmap = re.compile(
    r"\n*<!-- chapter-mindmap -->\n## 本章导图\n\n先看这张图，再往下读。它只保留本章的标题骨架，节点名对应后文的小节。\n\n```arbor-tree\n.*?\n```\n*",
    re.S,
)
timeline = re.compile(r"\n*<!-- chapter-timeline -->\n```arbor-timeline\n.*?\n```\n*", re.S)
fence = re.compile(r"\n*```arbor-(?:tree|timeline)\n.*?\n```\n*", re.S)
changed = 0
for path in root.rglob("*.md"):
    text = path.read_text(encoding="utf-8")
    updated = fence.sub("\n\n", timeline.sub("\n\n", mindmap.sub("\n\n", text)))
    updated = re.sub(r"\n{3,}", "\n\n", updated)
    if not updated.endswith("\n"):
        updated += "\n"
    if updated != text:
        path.write_text(updated, encoding="utf-8", newline="\n")
        changed += 1
print("stripped", changed)
