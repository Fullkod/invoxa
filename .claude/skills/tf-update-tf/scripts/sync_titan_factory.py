#!/usr/bin/env python3
"""Sync the Claude Code Titan Factory toolbox into this repository.

Upstream ships unprefixed skills that store memory in .claude/memory. This repo
prefixes every skill/agent with ``tf-`` (same names as Titan Factory Codex) and
shares memory/plans with Codex under .titan/. This script copies upstream content
and re-applies those adaptations so updates stay reproducible.

Preview by default. Pass --apply to write. Never touches .titan/, CLAUDE.md,
AGENTS.md, .mcp.json, .codex/, .agents/ or plugins/.

Usage:
  python .claude/skills/tf-update-tf/scripts/sync_titan_factory.py --source <titan-factory repo>
  python .claude/skills/tf-update-tf/scripts/sync_titan_factory.py --source <titan-factory repo> --apply
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
CLAUDE = REPO / ".claude"
MANIFEST = CLAUDE / "titan-factory-source.json"

# Skills adapted by hand for this repo. Upstream changes are reported, never overwritten.
PROTECTED_SKILLS = {"memory-manager", "primer", "eject-tf", "update-tf"}
TEXT_SUFFIXES = {".md", ".ts", ".py", ".sh", ".json", ".txt"}


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def find_claude_dir(source: Path) -> Path:
    for candidate in (source / "titan-factory" / ".claude", source / ".claude", source):
        if (candidate / "skills").is_dir() and (candidate / "agents").is_dir():
            return candidate
    sys.exit(f"No Titan Factory .claude directory found under {source}")


def git_commit(path: Path) -> str | None:
    try:
        out = subprocess.run(["git", "-C", str(path), "rev-parse", "HEAD"],
                             capture_output=True, text=True, check=True)
        return out.stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def adapt_text(text: str, skills: list[str], agents: list[str], is_entry: bool) -> str:
    if is_entry:
        text = re.sub(r'\A(---\s*\nname:\s*)"?([a-z0-9-]+)"?',
                      lambda m: m.group(1) + (m.group(2) if m.group(2).startswith("tf-") else "tf-" + m.group(2)),
                      text, count=1)
    text = text.replace(".claude/memory", ".titan/memory")
    text = text.replace(".claude/PRPs/prp-base.md", ".claude/skills/tf-prp/references/prp-base.md")
    text = text.replace(".claude/PRPs/", ".titan/plans/")
    for s in skills:
        text = text.replace(f".claude/skills/{s}/", f".claude/skills/tf-{s}/")
        text = re.sub(r"`(/?)" + re.escape(s) + r"([` ])",
                      lambda m, s=s: "`" + m.group(1) + "tf-" + s + m.group(2), text)
    for s in (s for s in skills if "-" in s):
        text = re.sub(r"(?<![\w/.\-@`])" + re.escape(s) + r"(?![\w\-])", "tf-" + s, text)
    for s in (s for s in skills if "-" not in s):
        text = re.sub(r"(?i)(skill\s+)" + s + r"\b", lambda m, s=s: m.group(1) + "tf-" + s, text)
    for a in agents:
        text = text.replace(f"`{a}`", f"`tf-{a}`")
    return text


def plan_files(src: Path) -> dict[Path, tuple[Path, bool]]:
    """Map target path -> (source file, is_entrypoint)."""
    plan: dict[Path, tuple[Path, bool]] = {}
    for skill_dir in sorted(p for p in (src / "skills").iterdir() if p.is_dir()):
        for f in skill_dir.rglob("*"):
            if f.is_file():
                rel = f.relative_to(skill_dir)
                plan[CLAUDE / "skills" / f"tf-{skill_dir.name}" / rel] = (f, rel.as_posix() == "SKILL.md")
    readme = src / "skills" / "SKILLS_README.md"
    if readme.exists():
        plan[CLAUDE / "skills" / "SKILLS_README.md"] = (readme, False)
    for f in sorted((src / "agents").glob("*.md")):
        plan[CLAUDE / "agents" / f"tf-{f.name}"] = (f, True)
    for f in (src / "design-systems").rglob("*"):
        if f.is_file():
            plan[CLAUDE / "design-systems" / f.relative_to(src / "design-systems")] = (f, False)
    prp = src / "PRPs" / "prp-base.md"
    if prp.exists():
        plan[CLAUDE / "skills" / "tf-prp" / "references" / "prp-base.md"] = (prp, False)
    return plan


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", required=True, type=Path, help="Titan Factory (Claude Code) repository path")
    parser.add_argument("--apply", action="store_true", help="write changes (default: preview only)")
    args = parser.parse_args()

    src = find_claude_dir(args.source.resolve())
    skills = sorted(p.name for p in (src / "skills").iterdir() if p.is_dir())
    agents = sorted(f.stem for f in (src / "agents").glob("*.md"))
    previous = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    prev_upstream: dict[str, str] = previous.get("upstream_hashes", {})

    upstream_hashes: dict[str, str] = {}
    created, updated, protected_changed = [], [], []
    for target, (source_file, is_entry) in plan_files(src).items():
        raw = source_file.read_bytes()
        key = source_file.relative_to(src).as_posix()
        upstream_hashes[key] = sha(raw)
        rel_target = target.relative_to(REPO).as_posix()
        skill_name = target.relative_to(CLAUDE).parts[1][3:] if target.relative_to(CLAUDE).parts[0] == "skills" and len(target.relative_to(CLAUDE).parts) > 2 else None
        if skill_name in PROTECTED_SKILLS and target.exists():
            if prev_upstream.get(key) not in (None, sha(raw)):
                protected_changed.append(rel_target)
            continue
        data = raw
        if source_file.suffix in TEXT_SUFFIXES:
            data = adapt_text(raw.decode("utf-8"), skills, agents, is_entry).encode("utf-8")
        if target.exists() and target.read_bytes() == data:
            continue
        (updated if target.exists() else created).append(rel_target)
        if args.apply:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)

    local_only = sorted(p.name for p in (CLAUDE / "skills").iterdir()
                        if p.is_dir() and p.name.removeprefix("tf-") not in skills)

    mode = "APPLIED" if args.apply else "PREVIEW (pass --apply to write)"
    print(f"Titan Factory sync - {mode}\nSource: {src}")
    for label, items in (("Created", created), ("Updated", updated),
                         ("Protected skills with upstream changes (merge by hand)", protected_changed),
                         ("Project-only skills (left untouched)", local_only)):
        print(f"\n{label}: {len(items)}")
        for item in items:
            print(f"  - {item}")

    if args.apply:
        MANIFEST.write_text(json.dumps({
            "schema": 1,
            "source": "Titan Factory for Claude Code (adapted: tf- prefix, shared .titan memory)",
            "source_commit": git_commit(src) or previous.get("source_commit"),
            "synced_at": dt.date.today().isoformat(),
            "protected_skills": sorted(f"tf-{s}" for s in PROTECTED_SKILLS),
            "upstream_hashes": upstream_hashes,
        }, indent=2) + "\n", encoding="utf-8")
        print(f"\nManifest written: {MANIFEST.relative_to(REPO).as_posix()}")


if __name__ == "__main__":
    main()
