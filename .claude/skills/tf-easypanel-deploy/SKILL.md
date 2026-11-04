---
name: tf-easypanel-deploy
description: Deploy completo de app Next.js + Prisma SQLite en un VPS con EasyPanel via Docker.
  Cubre Dockerfile multi-stage, migraciones automáticas, SSL con dominio custom, y errores
  comunes de Prisma 7 y NextAuth v5. Usar cuando el usuario quiera deployar en EasyPanel.
---

# EasyPanel Deploy — Next.js + Prisma SQLite

## Requisitos previos

- VPS con EasyPanel instalado
- App Next.js con Prisma + SQLite
- Repo en GitHub/GitLab
- Dominio apuntando al VPS (registro A)

---

## Paso 1: Configurar next.config.ts

```ts
const nextConfig: NextConfig = {
  output: "standalone",
};
```

Obligatorio para que el build Docker funcione con `node server.js`.

---

## Paso 2: Crear Dockerfile

```dockerfile
FROM node:22-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./
COPY --from=builder /app/node_modules ./node_modules

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/app/data/vault.db"

ENTRYPOINT ["./docker-entrypoint.sh"]
```

**Clave:** copiar `node_modules` completo (no cherry-pick) para evitar dependencias transitivas faltantes de Prisma CLI.

---

## Paso 3: Crear docker-entrypoint.sh

```sh
#!/bin/sh
set -e

node_modules/.bin/prisma migrate deploy

exec node server.js
```

---

## Paso 4: Crear .dockerignore

```
.git
.next
node_modules
npm-debug.log
.env
.env.local
prisma/*.db
prisma/*.db-journal
```

---

## Paso 5: Verificar prisma/schema.prisma

En Prisma 7, el datasource NO lleva `url`. La URL va en `prisma.config.ts`:

```prisma
datasource db {
  provider = "sqlite"
}
```

```ts
// prisma.config.ts
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env["DATABASE_URL"] },
});
```

---

## Paso 6: Push a Git

```bash
git add Dockerfile docker-entrypoint.sh .dockerignore next.config.ts
git commit -m "feat: add Docker support for EasyPanel deploy"
git push
```

---

## Paso 7: Configurar en EasyPanel

1. **New Project** → nombre del proyecto
2. **Add Service** → **App**
3. Source: **GitHub** → selecciona repo
4. Branch: `main`
5. Build path: `/`
6. Build method: **Dockerfile**
7. Name: `Dockerfile` | Path: `/Dockerfile`
8. **Domains** → agrega tu dominio → activa HTTPS (SSL automático)
9. **Volumes** → agrega `/app/data` (persistencia SQLite)
10. **Deploy**

---

## Paso 8: Variables de entorno en EasyPanel

```
DATABASE_URL=file:/app/data/vault.db
AUTH_SECRET=<openssl rand -base64 32>
AUTH_TRUST_HOST=true
ENCRYPTION_KEY=<32 chars>
NODE_ENV=production
```

`AUTH_TRUST_HOST=true` es **obligatorio** con NextAuth v5 detrás de reverse proxy.

---

## Paso 9: Seed inicial (primera vez)

En EasyPanel, abre la **Console/Terminal** del servicio (sh):

```sh
node_modules/.bin/tsx prisma/seed.ts
```

---

## Errores comunes y fixes

| Error | Causa | Fix |
|-------|-------|-----|
| `url is no longer supported in schema files` | Prisma 7 cambió la config | Quitar `url` del datasource en schema.prisma, ponerlo en prisma.config.ts |
| `node_modules/.bin/prisma: not found` | Symlinks no se copian entre stages Docker | Copiar `node_modules` completo desde builder |
| `Cannot find module 'valibot'` | Dependencias transitivas de Prisma CLI faltantes | Copiar `node_modules` completo (no cherry-pick) |
| `UntrustedHost` en NextAuth | Reverse proxy no configurado | Agregar `AUTH_TRUST_HOST=true` a env vars |
| `CredentialsSignin` tras login | BD vacía, seed no ejecutado | Correr `node_modules/.bin/tsx prisma/seed.ts` en consola del contenedor |
| `nginx: command not found` / conflicto puerto 80 | EasyPanel usa Traefik en 80/443 | No instalar Nginx separado, usar EasyPanel para el dominio |

---

## Notas

- EasyPanel usa **Traefik** internamente — gestiona 80/443 y SSL automáticamente
- El volumen `/app/data` persiste el SQLite entre deploys y reinicios
- Para redeploy: push a Git → **Redeploy** en EasyPanel
- Si el VPS ya tiene otros servicios en 80/443 (n8n, etc.), EasyPanel los gestiona todos sin conflicto
