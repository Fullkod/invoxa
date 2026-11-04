---
name: tf-eject-tf
description: "DESTRUCTIVO: Quitar el toolbox Titan Factory de Claude Code de este proyecto. Activar cuando el usuario dice: quiero quitar Titan Factory, eject, remover el template, limpiar el proyecto, o distribuir el codigo sin la fabrica. SIEMPRE confirmar antes de ejecutar."
allowed-tools: Read, Write, Edit, Bash
---

# Eject Titan Factory (Claude Code)

En este repo conviven Titan Factory para Claude Code y Titan Factory Codex, y comparten
la memoria del proyecto. Este skill quita SOLO el toolbox de Claude Code. Nunca borra la
memoria, los planes, la evidencia de QA ni el codigo de la aplicacion.

## ADVERTENCIA

Antes de ejecutar CUALQUIER accion, muestra este mensaje al usuario:

```
ADVERTENCIA: OPERACION DESTRUCTIVA

Se eliminara el toolbox Titan Factory de Claude Code:
- .claude/skills/tf-*/ (skills de Titan Factory)
- .claude/agents/tf-*.md (subagentes de Titan Factory)
- .claude/design-systems/
- .claude/titan-factory-source.json
- El bloque "Titan Factory (Claude Code)" de CLAUDE.md

Se conserva:
- .titan/ (memoria, planes y QA compartidos con Codex)
- AGENTS.md, .codex/, .agents/, plugins/ (Titan Factory Codex)
- .claude/settings.json y skills/agentes propios del proyecto
- .mcp.json y todo el codigo en src/

Para confirmar, escribe exactamente: EJECT
```

**ESPERA la respuesta del usuario.** Si no escribe exactamente `EJECT`, cancela.

Si el usuario quiere quitar TAMBIEN Titan Factory Codex o la memoria `.titan/`, eso es
otra decision: pidela por separado y de forma explicita. Para Codex usar su propio flujo
(`tf-eject-tf` del plugin), que preserva el conocimiento del proyecto.

---

## Proceso (solo si el usuario confirmo)

### Paso 1: Previsualizar

Listar exactamente lo que se borrara y verificar que ninguna ruta este bajo `.titan/`,
`plugins/`, `.codex/`, `.agents/` o `src/`:

```bash
ls -d .claude/skills/tf-*/ .claude/agents/tf-*.md .claude/design-systems .claude/titan-factory-source.json
```

### Paso 2: Eliminar solo lo propio de Titan Factory

```bash
rm -rf .claude/skills/tf-*/ .claude/design-systems
rm -f .claude/agents/tf-*.md .claude/titan-factory-source.json .claude/skills/SKILLS_README.md
```

Este skill vive en `.claude/skills/tf-eject-tf/`, por eso este paso va al final del borrado.

### Paso 3: Desacoplar CLAUDE.md

Quitar del `CLAUDE.md` solo el bloque entre `<!-- titan-factory-claude:start -->` y
`<!-- titan-factory-claude:end -->`. Conservar `@AGENTS.md` y cualquier contenido propio.

### Paso 4: Reportar

Informar que se borro, que se conservo (en especial `.titan/memory/`) y que los cambios
quedan sin commitear para que el usuario los revise.
