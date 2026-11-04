---
name: tf-update-tf
description: "Actualizar Titan Factory (Claude Code) a la ultima version. Activar cuando el usuario dice: actualiza el template, hay nueva version, update Titan Factory, quiero la ultima version, o cuando se detecta que el template esta desactualizado."
allowed-tools: Read, Bash
---

# Update Titan Factory (Claude Code)

Actualiza el toolbox de Claude Code (`.claude/skills/`, `.claude/agents/`,
`.claude/design-systems/`) desde el repo fuente de Titan Factory, re-aplicando las
adaptaciones de este proyecto:

- Prefijo `tf-` en skills y agentes (mismos nombres que Titan Factory Codex).
- Memoria y planes compartidos con Codex en `.titan/memory/` y `.titan/plans/`.

Titan Factory **Codex** (`plugins/titan-factory-codex/`) se actualiza por separado con sus
propios scripts (`plugins/titan-factory-codex/scripts/titan.py`). Este skill no lo toca.

## Proceso

### Paso 1: Ubicar el repo fuente

Pedir al usuario la ruta local del repo `titan-factory` (Claude Code) si no la dio. Puede
estar en cualquier lugar de la maquina de cada programador; no asumir rutas ni alias.
Ver la version sincronizada actual en `.claude/titan-factory-source.json` (`source_commit`).

### Paso 2: Actualizar el repo fuente (solo con permiso)

```bash
git -C "<TF_REPO_PATH>" pull --ff-only
```

Si falla (cambios locales, divergencia, sin red) informar y no forzar.

### Paso 3: Previsualizar

```bash
python .claude/skills/tf-update-tf/scripts/sync_titan_factory.py --source "<TF_REPO_PATH>"
```

El script lista archivos a crear/actualizar, skills protegidos con cambios upstream y
skills propios del proyecto. Mostrar el resumen al usuario.

### Paso 4: Aplicar

```bash
python .claude/skills/tf-update-tf/scripts/sync_titan_factory.py --source "<TF_REPO_PATH>" --apply
```

Reglas que el script garantiza:

1. Skills/agentes: solo agrega o actualiza. NUNCA borra skills que no existan upstream.
2. Skills protegidos (`tf-memory-manager`, `tf-primer`, `tf-eject-tf`, `tf-update-tf`) estan
   adaptados a mano: no se sobrescriben. Si upstream cambio, el script lo reporta; revisa
   el diff upstream y fusiona a mano de forma quirurgica, conservando `.titan/memory/`.
3. NUNCA toca `.titan/`, `CLAUDE.md`, `AGENTS.md`, `.mcp.json`, `.claude/settings.json`,
   `.codex/`, `.agents/`, `plugins/` ni `src/`.
4. Actualiza `.claude/titan-factory-source.json` con el commit fuente y hashes upstream.

### Paso 5: Verificar y reportar

- `git diff --stat .claude/` y revisar que no aparezcan rutas `.claude/memory` ni skills sin
  prefijo: `grep -rn "\.claude/memory\|\.claude/PRPs" .claude/` debe salir vacio.
- Si el `CLAUDE.md` upstream trae una regla nueva relevante, ofrecer agregarla al
  `CLAUDE.md` de este proyecto (que esta adaptado a Invoxa) — nunca reemplazarlo.
- No commitear salvo que el usuario lo pida.
