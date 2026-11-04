---
name: tf-skill-creator
description: "Create or update reusable Titan Codex skills with scoped triggers, progressive references and validated helpers."
---

# Skill Creator

Prefer the host native skill-creator when available. Otherwise create tf-<capability>/SKILL.md with YAML name and description and concise instructions. Use a precise description that does not catch unrelated work.

Keep substantial recipes in linked references. Preserve useful assets/scripts and resolve paths relative to the skill. Use actual tools; do not declare Claude models, fork context, magical substitution or implicit permissions. Respect chosen stack and existing authorization.

Scripts need --help, structured arguments, error handling and meaningful isolated checks. Run ../../scripts/validate.py after edits; record local extensions in docs/catalog.md and the manifest without pretending they are upstream skills. When available also run the native quick validator.

A skill teaches a workflow; it does not install tools, connect accounts, schedule background work or grant permissions. Test representative outcomes before claiming runtime readiness.

See [format reference](references/SKILL_SPECIFICATION.md) for the adapted schema boundary.
