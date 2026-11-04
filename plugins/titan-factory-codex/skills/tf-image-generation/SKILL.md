---
name: tf-image-generation
description: "Generate or edit raster images with the host image tool or an explicitly selected OpenRouter image model."
---

# Image Generation

Prefer the host image capability and follow its skill instructions. Inspect local references before editing. Preserve requested subject, style, dimensions and brand. Return actual generated artifacts. Do not switch providers or incur an external API call when the native tool fulfills the request.
If the user selects OpenRouter, use [generate_image.py](scripts/generate_image.py) with --prompt-file, --model and --output. It reads OPENROUTER_API_KEY from the environment, accepts --image and refuses overwrite. Select a currently supported image model; no preview ID is baked in. Run --help.
The helper validates image data, matching extension and timeout without printing credentials/provider bodies. No automatic retries. A prepared prompt is not a generated image. Inspect legibility and composition; if unavailable state the blocker. Preserve code-native SVG/CSS/canvas when that is the requested medium.
