---
name: tf-n8n-validation-expert
description: "Interpret n8n validation findings and repair configuration while distinguishing real errors and false positives."
---

# N8N Validation Expert

Read [GUIDE.md](GUIDE.md), [error catalog](ERROR_CATALOG.md) or [false positives](FALSE_POSITIVES.md). Record validator version/profile and actual error path. Investigate before dismissing a warning.
Fix the smallest cause and revalidate. Schema-valid workflows may still fail at runtime; test separately when authorized. Inspect assumptions when fixes repeatedly fail rather than weakening checks.
