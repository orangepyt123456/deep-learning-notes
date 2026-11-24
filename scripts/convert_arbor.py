import pathlib
import re

root = pathlib.Path(__file__).resolve().parents[1] / "docs"
fence = re.compile(r"^(`{3,})(.*)$")
changed = 0
for path in root.rglob("*.md"):
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    out = []
    i = 0
    touched = False
    while i < len(lines):
        match = fence.match(lines[i])
        if match:
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            kind = lines[j].strip() if j < len(lines) else ""
            lang = match.group(2).strip()
            if kind in ("mindmap", "timeline") and lang in ("", "mermaid"):
                name = "arbor-tree" if kind == "mindmap" else "arbor-timeline"
                out.append(match.group(1) + name)
                touched = True
                i += 1
                continue
        out.append(lines[i])
        i += 1
    if touched:
        ending = "\n" if text.endswith("\n") else ""
        path.write_text("\n".join(out) + ending, encoding="utf-8")
        changed += 1
print("updated", changed)
