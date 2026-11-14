#!/usr/bin/env python3
"""Bundle topics/*.md into notes-data.js and stamp sw.js with a content hash.

Run:  python3 build.py
Add a topic: drop a new .md file in topics/ (see README.md), run this, push.
"""
import hashlib
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
TOPICS = ROOT / "topics"
CALLOUTS = {"samajh", "verify", "flag", "tip"}
REQUIRED = ("title", "slug", "tags", "summary", "added")


def parse(path: pathlib.Path) -> dict:
    txt = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", txt, re.S)
    if not m:
        sys.exit(f"{path.name}: missing front matter")
    meta = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
    for k in REQUIRED:
        if k not in meta:
            sys.exit(f"{path.name}: front matter missing '{k}'")
    body = m.group(2).strip() + "\n"
    if body.count(":::") % 2:
        sys.exit(f"{path.name}: unbalanced ::: blocks")
    if body.count("```") % 2:
        sys.exit(f"{path.name}: unbalanced ``` fence")
    for c in re.findall(r"\[!(\w+)\]", body):
        if c not in CALLOUTS:
            sys.exit(f"{path.name}: unknown callout [!{c}]")
    # table sanity: every row in a table block has the same number of cells
    block = []
    for line in body.split("\n") + [""]:
        if line.lstrip().startswith("|"):
            block.append(line)
        else:
            if block:
                counts = {len(r.strip().strip("|").split("|")) for r in block}
                if len(counts) > 1:
                    sys.exit(f"{path.name}: table with uneven columns near: {block[0][:60]}")
            block = []
    return {
        "slug": meta["slug"],
        "title": meta["title"],
        "tags": [t.strip() for t in meta["tags"].split(",") if t.strip()],
        "summary": meta["summary"],
        "added": meta["added"],
        "order": int(meta.get("order", "999")),
        "body": body,
    }


def main() -> None:
    notes = [parse(p) for p in sorted(TOPICS.glob("*.md"))]
    if not notes:
        sys.exit("no topics found in topics/")
    slugs = [n["slug"] for n in notes]
    if len(set(slugs)) != len(slugs):
        sys.exit("duplicate slug found")
    notes.sort(key=lambda n: (n["order"], n["added"], n["slug"]))
    data = json.dumps(notes, ensure_ascii=False, indent=1)
    h = hashlib.sha1()
    for f in ("app.js", "style.css", "index.html"):
        h.update((ROOT / f).read_bytes())
    h.update(data.encode("utf-8"))
    ver = h.hexdigest()[:10]
    (ROOT / "notes-data.js").write_text(
        f'window.NOTES = {data};\nwindow.NOTES_VERSION = "{ver}";\n', encoding="utf-8"
    )
    sw = (ROOT / "sw.template.js").read_text(encoding="utf-8").replace("__VER__", ver)
    (ROOT / "sw.js").write_text(sw, encoding="utf-8")
    print(f"built {len(notes)} topics, version {ver}")
    for n in notes:
        print(f"  {n['order']:>3}  {n['slug']:<28} {len(n['body'].split()):>5} words")


if __name__ == "__main__":
    main()
