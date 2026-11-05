# Traspaso de la BD de Invoxa a la organización Pro de CommerceCraft

Date: 2026-11-05
Fuente: conversación con Roberto.

- **Decisión:** el proyecto Supabase de Invoxa se traspasa a la organización de CommerceCraft (plan Pro),
  en vez de una org propia de Fullkod pagada por ellos. Roberto pertenece a CommerceCraft.
- **Condiciones para no quedarse colgado:** Roberto con su cuenta personal como **Owner** en la org de
  CommerceCraft (no solo la cuenta compartida); no borrar la org de origen (sirve para devolver el
  proyecto); comprobar que la org de destino NO está gestionada por Vercel Marketplace (traspaso sin vuelta);
  backups propios fuera de Supabase (dump de BD incluido `auth` + descarga de Storage).
- **Riesgo aceptado:** los miembros de la org de CommerceCraft pueden ver datos de Informage.
- **Org de origen (comprobado por API 2026-11-05):** «CreativeCode Claudia» (`qwscokwdvotboqlbgnjb`), plan
  Free, región `us-west-2`. Owner: Claudia (claudiarr1993@gmail.com); Roberto (robert.cabrer92@gmail.com) solo
  **Developer** ⇒ no puede transferir hasta que Claudia lo haga Owner (o lo haga ella siendo miembro del destino).
- **Red de seguridad:** para devolver el proyecto basta ser Owner de la org donde esté y miembro de otra; mejor
  una org Free propia de Roberto que depender de la de Claudia.
- **Quién traspasa:** la cuenta de Claudia, Owner en origen y en CommerceCraft (comprobado por Roberto en el
  dashboard; el token de `.env.local` solo ve la org «Fullkod Claudia»). Destino Pro, no gestionado por Vercel,
  sin integración GitHub en el proyecto.
- **Backup:** `npm run backup:supabase` (`scripts/backup-supabase.mjs`) → `C:\Local-Disc-D\Backups\invoxa\<fecha>\`
  (fuera del repo): roles/schema/data.sql + Storage + `counts.json`. Primera copia 2026-11-05T19-20-25,
  verificada (7 usuarios auth, 123 tasks, 11 objetos Storage).
- **Hecho (2026-11-05):** proyecto `prabpfidllznbtthmkxz` traspasado a la org de CommerceCraft
  (`bpymfsvjhtldyfyqohwv`, Pro), misma región y misma URL/keys. Verificado tras el traspaso: los 18 conteos
  coinciden con `counts.json` de la copia, Auth health 200, RPC `ping` 200, web 200, Edge Functions (12) activas
  con sus secrets, `supabase migration list` al día (último `20261104000006`).
- **Org de origen «Fullkod Claudia»:** NO borrarla; es una de las salidas si hay que devolver el proyecto.
- **Pendientes de este tema (decidido con Roberto 2026-11-05: para más adelante):**
  - Cuenta personal de Roberto como Owner en la org de CommerceCraft: **no hace falta por ahora**, se hará luego.
  - Subir la copia a un almacenamiento propio y repetir `npm run backup:supabase` periódicamente: luego.
  - Workflow `keep-supabase-alive.yml`: sobra con Pro, pero **se mantiene** de momento.
