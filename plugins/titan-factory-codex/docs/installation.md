# Installation and maintenance

## Plugin activation

The complete repository is the plugin root. Use the host's supported local-plugin/marketplace workflow. For Codex's native plugin-creator skill, retain `.codex-plugin/plugin.json`, validate the source and let its installer manage the personal marketplace. Do not hand-edit installed cache directories. After activation, verify `tf-primer` and a domain skill in the host selector, preferably in a fresh task. Creating source files or copying a portable package is not proof of automatic skill discovery.

Official references checked during adaptation:

- [Skill loading and plugin distribution](https://learn.chatgpt.com/docs/build-skills)
- [Project instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Native custom agents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [Plugins](https://learn.chatgpt.com/docs/plugins)

## Portable copy

From the source root, `python scripts/titan.py install-toolkit --target '<dedicated directory>/titan-factory-codex'` previews a complete, relocatable copy. Add `--apply` for an authorized installation. The target must be separate from the source, match the plugin folder name, and must not be an application root. Register the copied plugin through the host if automatic discovery is desired. Do not install only the skill folders because shared resources are part of the package.

Run the same command from a reviewed new release to update. The manifest records SHA-256 hashes. Modified owned files and collisions produce conflicts and abort the update; removed source files are retained and reported. Backups of overwritten files live under `.titan-toolkit-backups/<run>/`. No automatic upstream Git pull, cache overwrite or deletion mirror is used.

The manifest and backups are local lifecycle metadata. Do not edit the ownership manifest to force an update. Compare conflicting versions and integrate deliberately. Backups are recovery material, not an automatic transaction rollback after a disk/power failure.

## Initialize a project

`python scripts/titan.py init-project --project '<existing app>' --agents` previews:

- A bounded Titan block appended to existing `AGENTS.md` without replacing other instructions.
- Missing `.titan/` project configuration, memory index and folders.
- Seven native TOML profiles in `.codex/agents/`, preserving existing files.

Add `--apply` when initialization is authorized. Existing memory and configuration are kept. Native profile loading depends on the Codex version; roles remain reusable as bounded instructions in hosts without native profile discovery. The profiles inherit model and permissions instead of prescribing Claude models or escalating privileges. No subagent is launched by initialization.

## New app and removal

`scaffold-app --target '<new or empty app>'` previews the optional starter. `--apply` copies it, without installing dependencies, provisioning Supabase or deploying. Inspect its README for scope.

`detach-project --project '<app>'` removes only the Titan instruction block. Memory, plans, optional agent files and other content remain; remove an explicitly selected agent profile separately if desired.

`eject-toolkit --target '<owned installation>'` removes only unchanged manifest-owned files, backs them up, and keeps modified/foreign files and the containing directory. Use the host uninstall mechanism for a host-managed plugin. This does not remove any original Claude setup.
