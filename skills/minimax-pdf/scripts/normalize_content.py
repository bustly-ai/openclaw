#!/usr/bin/env python3
"""
normalize_content.py — Normalize high-level report JSON into render_body blocks.

Accepted inputs:
  1. Canonical top-level block array
  2. Sectioned report objects with `abstract` + `sections`
  3. Common near-miss keys such as `content` -> `text` and `header` -> `headers`
"""

import argparse
import json
import os
import sys


SUPPORTED_TYPES = {
    "h1", "h2", "h3",
    "body", "bullet", "numbered", "callout", "table",
    "image", "figure", "code", "math", "chart", "flowchart",
    "bibliography", "divider", "caption", "pagebreak", "spacer",
}

TYPE_ALIASES = {
    "paragraph": "body",
    "text": "body",
    "list_item": "bullet",
    "ordered_item": "numbered",
}


def _normalize_block(item) -> dict | None:
    if isinstance(item, str):
        return {"type": "body", "text": item}
    if not isinstance(item, dict):
        return None

    block = dict(item)
    raw_type = str(block.get("type", "body")).strip().lower()
    raw_type = TYPE_ALIASES.get(raw_type, raw_type)

    if raw_type == "heading":
        try:
            level = max(1, min(3, int(block.get("level", 1))))
        except Exception:
            level = 1
        raw_type = f"h{level}"

    if raw_type not in SUPPORTED_TYPES:
        raw_type = "body"
    block["type"] = raw_type

    if raw_type == "table":
        headers = block.get("headers", block.get("header", block.get("columns")))
        rows = block.get("rows", block.get("data"))
        if headers is not None:
            block["headers"] = headers
        if rows is not None:
            block["rows"] = rows
        return block

    if raw_type == "bibliography":
        if "items" not in block and isinstance(block.get("rows"), list):
            block["items"] = block["rows"]
        return block

    if "text" not in block:
        for key in ("content", "value", "summary", "abstract", "title"):
            value = block.get(key)
            if isinstance(value, str):
                block["text"] = value
                break

    return block


def _normalize_sequence(items) -> list:
    blocks = []
    if not isinstance(items, list):
        return blocks

    for item in items:
        if isinstance(item, dict) and "type" not in item and (
            "sections" in item or "blocks" in item
        ):
            blocks.extend(_normalize_document(item))
            continue

        block = _normalize_block(item)
        if block:
            blocks.append(block)
    return blocks


def _normalize_section(section) -> list:
    if isinstance(section, str):
        return [{"type": "h1", "text": section}]
    if not isinstance(section, dict):
        return []

    blocks = []
    title = section.get("title", section.get("heading"))
    if isinstance(title, str) and title.strip():
        blocks.append({"type": "h1", "text": title})

    if isinstance(section.get("sections"), list):
        for child in section["sections"]:
            blocks.extend(_normalize_section(child))

    if isinstance(section.get("blocks"), list):
        blocks.extend(_normalize_sequence(section["blocks"]))
    elif "type" in section:
        block = _normalize_block(section)
        if block:
            blocks.append(block)

    return blocks


def _normalize_document(doc) -> list:
    if isinstance(doc, list):
        return _normalize_sequence(doc)
    if isinstance(doc, str):
        return [{"type": "body", "text": doc}]
    if not isinstance(doc, dict):
        return []

    blocks = []
    abstract = doc.get("abstract", doc.get("summary"))
    if isinstance(abstract, str) and abstract.strip():
        blocks.append({"type": "body", "text": abstract})

    sections = doc.get("sections")
    if isinstance(sections, list):
        for section in sections:
            blocks.extend(_normalize_section(section))
        return blocks

    if isinstance(doc.get("blocks"), list):
        blocks.extend(_normalize_sequence(doc["blocks"]))
        return blocks

    block = _normalize_block(doc)
    return [block] if block else []


def main():
    parser = argparse.ArgumentParser(
        description="Normalize report JSON into minimax-pdf body blocks"
    )
    parser.add_argument("--input", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(json.dumps({
            "status": "error",
            "error": f"File not found: {args.input}",
        }), file=sys.stderr)
        sys.exit(1)

    try:
        with open(args.input, encoding="utf-8") as f:
            content = json.load(f)
        normalized = _normalize_document(content)
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(normalized, f, ensure_ascii=False, indent=2)
    except Exception as exc:
        print(json.dumps({
            "status": "error",
            "error": str(exc),
        }), file=sys.stderr)
        sys.exit(3)

    print(json.dumps({
        "status": "ok",
        "out": args.out,
        "blocks": len(normalized),
    }))


if __name__ == "__main__":
    main()
