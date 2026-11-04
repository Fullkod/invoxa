---
name: tf-n8n-expression-syntax
description: "Write or debug n8n expressions, item references and data mappings."
---

# N8N Expression Syntax

Read [GUIDE.md](GUIDE.md), [examples](EXAMPLES.md) and [common mistakes](COMMON_MISTAKES.md) as needed. Inspect representative output first. Webhook data commonly lives in $json.body; use observed shape rather than assumptions.
Handle missing properties, empty items, multi-item references and paired-item semantics. Use expressions only in supported fields. Validate with realistic payloads without triggering unrelated downstream effects.
