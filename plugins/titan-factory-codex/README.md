# Titan Factory Codex

Caja de herramientas reutilizable para Codex, adaptada de Titan Factory. Incluye **29 skills, 7 agentes, 5 sistemas de diseño, referencias técnicas y una base de aplicación opcional**.

El stack preferido del propietario es **Next.js + Supabase + Vercel**. **EasyPanel** se conserva para desplegar en VPS, tanto con Supabase como con aplicaciones que ya usan Prisma/SQLite. Las preferencias sirven para proyectos nuevos; no sustituyen el stack de aplicaciones existentes.

## Uso

Consulta el [catálogo completo](docs/catalog.md). Ejemplos de solicitudes:

- «Usa tf-primer para entender este proyecto».
- «Planifica esta funcionalidad con tf-prp y después implementa lo autorizado».
- «Usa tf-add-login con Supabase».
- «Despliega en Vercel con el agente tf-vercel-deployer».
- «Quiero preparar el despliegue en EasyPanel manteniendo Supabase».
- «Diseña este workflow n8n sin activarlo todavía».

El selector del host puede mostrar nombres con el namespace del plugin. En Codex CLI/IDE también se mencionan como `$tf-primer`. Los nombres evitan colisiones con skills como `skill-creator` o `imagegen` que ya existan.

## Instalación y alcance

La raíz es un **proyecto fuente y plugin local**, con `.codex-plugin/plugin.json`. Crearlo no lo instala ni lo activa automáticamente en otros proyectos. No hay cuentas conectadas, marketplace publicado ni credenciales incluidas.

Para activación global, instala el plugin desde este origen con el flujo de plugins compatible con tu versión de Codex. El agente puede utilizar la skill nativa `plugin-creator` para registrar el origen en el marketplace personal y verificar descubrimiento. No copies únicamente `skills/`: sus recursos compartidos requieren conservar la estructura del paquete. Consulta [instalación y mantenimiento](docs/installation.md).

El CLI portátil **no necesita paquetes Python externos** y funciona con Python 3.11+ en PowerShell, Bash y otros shells. Desde esta carpeta:

```powershell
python scripts/titan.py --help
python scripts/titan.py init-project --project 'C:\Projects\mi-app' --agents
```

Sin `--apply` muestra cambios y no escribe. Añadir `--apply` aplica el alcance autorizado. `init-project` conserva archivos existentes, añade un bloque acotado a `AGENTS.md`, crea memoria/planes si faltan y opcionalmente copia los 7 perfiles de agentes nativos. No conecta servicios ni instala el plugin.

## Estructura

```text
.codex-plugin/plugin.json   Manifiesto del plugin
skills/tf-*/               29 skills y sus recursos
agents/                    7 perfiles TOML y recetas complementarias
design-systems/            5 sistemas de diseño y sus imágenes
templates/                 PRP y starter Next.js/Supabase
scripts/                   CLI seguro y validación
tests/                     Pruebas de los mecanismos de adaptación
docs/                      Catálogo, hallazgos, conexiones y estado de validación
```

La memoria y los planes de cada aplicación viven en **su propio `.titan/`**, fuera del plugin compartido. Son archivos versionables; su sincronización depende de Git, y no equivalen a memoria universal de todas las conversaciones.

## Qué se corrigió

- Entradas específicas de Codex sin modelos Claude, `context: fork` ni herramientas ficticias.
- Memoria desacoplada de `.claude/settings.json` y de la instalación compartida.
- Actualización con hashes de propiedad, conflictos explícitos y copias de respaldo.
- Retirada puntual de archivos propios; preservación de ediciones, memoria y código.
- QA con Playwright Test o las herramientas reales del host.
- Tasknic con servidor e identidad configurables; sin asumir permisos de administrador.
- Imágenes con herramienta nativa o modelo OpenRouter explícito, sin preview obsoleto fijo.
- EasyPanel con una ruta específica Next.js/Supabase y otra Prisma/SQLite.
- Optimización de skills acotada, con evaluación comparable y candidatos aislados.
- `lint` y `typecheck` reales en el starter; no se anuncia como aplicación terminada.

Lee [la matriz de adaptación](docs/adaptation.md), [las conexiones opcionales](docs/integrations.md) y [el estado de validación](docs/validation.md). Las recetas de servicios externos se conservan como referencias que deben contrastarse con las versiones del proyecto; pasar la validación del paquete no certifica pagos, autenticación ni despliegues en producción.
