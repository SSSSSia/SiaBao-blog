#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Curated-concept suggestion tool for the Knowledge Constellation.

Scans the cached GitHub trending repos' topics and surfaces high-frequency
topics that are NOT yet covered by ``explore_curated.json`` — candidate gaps in
the curated backbone. This is a manual-review aid: it NEVER writes the curated
file, only prints suggestions (and optionally dumps ``_suggestions.json``) for a
human to vet before merging.

Run (from server/):
    .venv/Scripts/python.exe scripts/suggest_curated.py
    .venv/Scripts/python.exe scripts/suggest_curated.py --top 30 --write
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

# 让脚本在未安装为包的情况下也能 import app.*
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

DATA_DIR = ROOT / "data"
CURATED_FILE = ROOT / "app" / "data" / "explore_curated.json"
GITHUB_CACHE_FILE = DATA_DIR / "explore_github_cache.json"
OUT_FILE = DATA_DIR / "_suggestions.json"

# 噪声 topic：过于宽泛、无策展价值，统一过滤。
NOISE_TOPICS = {
    "awesome", "list", "hacktoberfest", "good-first-issue", "documentation",
    "tutorial", "learning", "resources", "blog", "website", "template",
    "starter", "boilerplate", "example", "demo", "test", "utility", "misc",
    "other", "general", "tool", "tools", "library", "libraries",
}


def _load_curated_topics() -> set[str]:
    if not CURATED_FILE.exists():
        return set()
    with open(CURATED_FILE, encoding="utf-8-sig") as f:
        data = json.load(f)
    covered: set[str] = set()
    for c in data.get("concepts", []):
        for t in c.get("github_topics", []) or []:
            covered.add(t.lower())
        for t in c.get("tags", []) or []:
            covered.add(t.lower())
    return covered


def _load_repo_topics() -> Counter:
    if not GITHUB_CACHE_FILE.exists():
        print(f"[skip] GitHub cache not found: {GITHUB_CACHE_FILE}", file=sys.stderr)
        print("       先访问一次 /api/explore/github?force=true 生成缓存。", file=sys.stderr)
        return Counter()
    with open(GITHUB_CACHE_FILE, encoding="utf-8-sig") as f:
        data = json.load(f)
    counter: Counter = Counter()
    for r in data.get("repos", []):
        for t in r.get("topics", []) or []:
            tl = t.lower().strip()
            if tl and tl not in NOISE_TOPICS:
                counter[tl] += 1
    return counter


def main() -> int:
    parser = argparse.ArgumentParser(description="Suggest curated-concept gaps from GitHub trending topics.")
    parser.add_argument("--top", type=int, default=25, help="输出前 N 个候选（默认 25）")
    parser.add_argument("--write", action="store_true", help="把结果写入 data/_suggestions.json")
    args = parser.parse_args()

    covered = _load_curated_topics()
    counter = _load_repo_topics()
    if not counter:
        return 1

    candidates = [
        {"topic": t, "count": c}
        for t, c in counter.most_common()
        if t not in covered
    ][: args.top]

    print(f"\n=== 策展概念候选（共 {len(counter)} 个 topic，已过滤已覆盖/噪声）===\n")
    for item in candidates:
        print(f"  {item['topic']:<24} 出现 {item['count']} 次")
    print(f"\n共 {len(candidates)} 个候选。人工 review 后再合并进 {CURATED_FILE.name}。\n")

    if args.write:
        with open(OUT_FILE, "w", encoding="utf-8") as f:
            json.dump(
                {"_comment": "自动生成的策展候选，仅供人工 review，勿直接合并。", "candidates": candidates},
                f, ensure_ascii=False, indent=2,
            )
        print(f"已写入: {OUT_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
