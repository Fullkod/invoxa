---
name: tf-update-tf
description: "Update Titan Codex from a reviewed local release while preserving local edits, project memory and custom skills."
---

# Update Tf

Identify installation type and version. Do not copy upstream Claude files over this adaptation; upstream changes require a reviewed Codex release.

For portable installations made with ../../scripts/titan.py, run install-toolkit --target <dedicated-directory> from the new release. Preview first. Ownership hashes distinguish unchanged files from local edits. Conflicts abort application; removed upstream files remain as reported orphans. With --apply changed owned files are backed up.

For host-managed plugins use the plugin update mechanism or available plugin-creator skill. Do not edit caches or marketplace JSON manually. Source changes and installed-cache refresh are separate. Verify discovery in a fresh session before calling an update active.

Memory, plans, credentials, AGENTS.md and application code live outside the shared installation. Reconcile conflicts using a diff; never reset Git or erase the destination. Report version, changes, preserved edits and activation state.
