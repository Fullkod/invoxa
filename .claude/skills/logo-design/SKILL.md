---
name: logo-design
description: "Professional logo and brand-mark design, from brief to production files. Guides discovery and the design brief, concept generation, choosing a mark type (wordmark, monogram, letterform, pictorial, abstract, emblem, mascot, combination), building clean geometric SVG logos, optical refinement, colour and typography, testing (16 px, one-colour, reversed, shelf test), client presentation, delivery variants and brand guidelines. Includes a searchable library of 1,400+ real-world SVG logos classified by type, technique, geometry and industry, plus scripts that audit SVGs and generate test sheets, presentation boards and export variants. Use this skill whenever the user wants a logo, logotype, wordmark, monogram, brand mark, symbol, app icon or favicon designed, redesigned, refreshed, critiqued or compared; asks for logo ideas or concepts; needs a design brief, logo guidelines, lockups or an identity system; or mentions branding a new company, product, app or project — even if they don't say the word \"logo\"."
---

# logo-design (bridge for Claude Code)

This project vendors the `logo-design` skill once, for every agent, under
`.agents/skills/logo-design/` (tracked in `skills-lock.json` and updated with
`npx skills update --project --yes`). Claude Code only discovers `.claude/skills/`,
so this file is a thin bridge — do not copy the skill contents here.

Before doing the task:

1. Read `.agents/skills/logo-design/SKILL.md` in full and follow it as the skill instructions.
2. Resolve every relative path it mentions (`references/`, `assets/`, `scripts/`,
   `templates/`) against `.agents/skills/logo-design/`, not against this directory.
