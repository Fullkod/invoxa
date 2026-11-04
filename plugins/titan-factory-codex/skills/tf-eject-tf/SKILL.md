---
name: tf-eject-tf
description: "Detach Titan project guidance or remove an owned portable toolkit while retaining user files and project knowledge."
---

# Eject Tf

Determine whether the user means shared installation or one project. Preview exact changes with ../../scripts/titan.py.

`detach-project --project <path>` removes only the bounded Titan block in AGENTS.md. Other instructions and all .titan memory/plans/QA/application files remain. An empty AGENTS.md may remain.

`eject-toolkit --target <dedicated-directory>` removes only manifest-owned files with unchanged hashes. Modified and foreign files remain. The CLI backs up removed files and refuses traversal or linked targets. It does not recursively delete the directory.

For host-managed plugins use the uninstall interface. Removing source is not uninstalling a cached plugin. Preserve Claude installations. Existing authorization for the concrete scope remains valid; clarify only ambiguous scope.
