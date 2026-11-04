---
name: tf-n8n-code-javascript
description: "Implement JavaScript in n8n Code nodes for transforms, batching, data access and item linkage."
---

# N8N Code Javascript

Read [GUIDE.md](GUIDE.md) and its data-access, built-in, pattern and error references. Confirm runtime version, Code node mode and input shape. Preserve expected output arrays and pairedItem linkage.
Prefer the existing language without overriding explicit choice. Do not assume browser globals, installed packages or unrestricted filesystem/network access. Test empty/single/multiple items and loop behavior.
