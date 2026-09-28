# KennelOps (kennel-stride)

Software de operación para centros caninos: reservas y check-in, perreras, clientes y perros, clínica, report cards por servicio, tareas del personal, rutas, contratos, facturación y paquetes. Multi-organización (cada centro ve solo sus datos por RLS).

## Stack

| Parte | Tecnología |
| --- | --- |
| Frontend | React + Vite + TypeScript, Tailwind, shadcn/ui, React Query |
| Backend | Supabase (Postgres + RLS, RPC, Auth, Edge Functions, Storage, pg_cron) |
| Hosting | Vercel (despliega solo al hacer push a `main`) |
| Supabase de producción | proyecto `jqnpqmkwcaxqrevfqmue` |

## Desarrollo local

```sh
npm install
cp .env.example .env        # completar con las claves del proyecto
npm run dev                 # http://localhost:8080
```

Base local con Supabase CLI: `supabase start` (aplica `supabase/migrations/`).

| Comando | Qué hace |
| --- | --- |
| `npm run typecheck` | TypeScript sin emitir |
| `npm run lint` | ESLint |
| `npm test` | Vitest (`tests/`) |
| `npm run build` | Build de producción (lo mismo que corre Vercel) |

## Despliegue

El orden importa cuando un cambio del frontend depende de la base:

1. **Migraciones** (`supabase/migrations/`): `supabase db push --linked` (primero `--dry-run`).
2. **Edge Functions** que cambiaron: `supabase functions deploy <nombre> --project-ref jqnpqmkwcaxqrevfqmue`. Vercel no las despliega.
3. **Frontend**: push a `main` → Vercel despliega solo.

GitHub Actions (`.github/workflows/`) corre typecheck, lint + tests + build y el guard de RLS con tests de base (`supabase/tests/database/`) en cada push. No despliegan nada.

Los secretos de las Edge Functions (Resend, Twilio, Mapbox, LemonSqueezy…) se configuran en Supabase → Project Settings → Edge Functions → Secrets; la lista está en `.env.example`.
