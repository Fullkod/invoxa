---
name: tf-autoresearch
description: "Improve a skill through bounded reproducible evaluations and isolated candidate edits when optimization is requested."
---

# Autoresearch

Define the target, realistic cases and measurable criteria. Separate development from held-out evaluation. Compare baseline/candidate on identical cases and repeat noisy cases when useful. Binary checks suit objective requirements; do not force subjective quality into unreliable binary scores.

Evaluate candidate copies in a new experiment directory or isolated worktree. Keep installed source unchanged. Record cases, known versions, results, judge limitations and one hypothesis per iteration. Do not leak expected answers into prompts. Promote only after held-out verification within scope.

Use a finite agreed limit; default to at most five candidate iterations if none was requested. If monetary metering is unavailable say so and enforce call/iteration/time bounds rather than a fictitious dollar cap. Stop at the bound, success, repeated invalid evaluation, missing configuration or interruption.

Discard only checked isolated artifacts. Never reset user Git history or working files. Do not silently rewrite installed skills, commit or merge. Return evidence and a reviewable diff. Independent evaluators are optional and require authorized delegation.
