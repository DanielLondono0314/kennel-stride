# Migración Lovable → Vercel + Supabase

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desacoplar completamente la app de Lovable Cloud y desplegarla en infraestructura propia: Supabase (DB + Auth + Edge Functions) + Vercel (frontend).

**Architecture:** Frontend estático en Vercel con auto-deploy desde GitHub. Base de datos PostgreSQL en Supabase con RLS multi-tenant. Edge Functions en Supabase Deno runtime para lógica server-side (email campaigns, webhooks de billing).

**Tech Stack:** React 18 + Vite 5 + TypeScript, Supabase JS v2, Vercel CLI, LemonSqueezy (billing), Resend (email), Supabase CLI (migraciones).

---

## ⚠️ Análisis previo: Qué queda inservible y qué mejoramos

### Lo que queda INSERVIBLE al salir de Lovable
| Elemento | Archivo | Acción |
|---|---|---|
| `@lovable.dev/cloud-auth-js` | `package.json` | Eliminar — es el bridge OAuth de Lovable. Google/Apple/Microsoft auth roto sin replacement |
| `lovable-tagger` | `package.json` + `vite.config.ts` | Eliminar — solo sirve para el editor de Lovable |
| `src/integrations/lovable/index.ts` | — | Eliminar + reemplazar con OAuth nativo de Supabase |
| El CI/CD de Lovable | — | Reemplazar con Vercel GitHub integration |
| Deploy automático desde editor Lovable | — | Se pierde — ahora se hace `git push` |

### Lo que MEJORAMOS en esta migración

1. **Bug crítico de REVOKE** (seguridad): La migración `20260403000001_security_hardening.sql` intenta revocar columnas `stripe_customer_id` y `stripe_subscription_id`, pero esas columnas ya fueron renombradas a `ls_customer_id` / `ls_subscription_id` en la migración posterior. El REVOKE nunca se aplicó a las columnas correctas → los campos de billing LS son accesibles por el rol `authenticated`.

2. **Naming no estándar en Edge Functions**: `send-campaign` usa `SUPABASE_PUBLISHABLE_KEY` (nombre inventado), pero Supabase solo auto-inyecta `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. Hay que usar `SUPABASE_ANON_KEY`.

3. **Crash silencioso en arranque**: `client.ts` inicializa el cliente Supabase a nivel de módulo sin guard. Si las env vars faltan, la app da pantalla blanca sin mensaje de error útil.

4. **Sin routing SPA en Vercel**: No existe `vercel.json`. Sin él, cualquier URL directa (bookmark, compartir enlace, F5 en ruta interna) devuelve 404.

5. **OAuth propio sin Lovable**: Reemplazamos el bridge de Lovable por `supabase.auth.signInWithOAuth` nativo, más estable y sin dependencias externas.

6. **Naming estándar de env vars**: Renombrar `VITE_SUPABASE_PUBLISHABLE_KEY` → `VITE_SUPABASE_ANON_KEY` (convención oficial de Supabase).

---

## Resumen de fases

```
Fase 1: Supabase — Crear proyecto + correr migraciones + configurar OAuth
Fase 2: Seguridad — Corregir bugs encontrados en el audit
Fase 3: Frontend — Eliminar Lovable, reemplazar OAuth, estandarizar vars
Fase 4: Vercel — Configurar deploy, routing SPA, env vars, dominio custom
```

---

## Fase 1: Supabase Setup

### Task 1: Instalar Supabase CLI y linkear proyecto

**Prerequisito:** Tener cuenta en supabase.com y haber creado un proyecto nuevo (free tier disponible).

- [ ] **Step 1: Instalar Supabase CLI**

```bash
npm install -g supabase
supabase --version
# Expected: supabase CLI 1.x.x
```

- [ ] **Step 2: Login con Supabase CLI**

```bash
supabase login
# Abre el browser para autenticarte con tu cuenta de supabase.com
```

- [ ] **Step 3: Linkear el repo al proyecto de Supabase**

Desde la raíz del repo:
```bash
supabase link --project-ref <tu-project-ref>
# El project-ref está en Settings > General del dashboard de Supabase
# Ejemplo: abcdefghijklmnop
```

- [ ] **Step 4: Verificar la conexión**

```bash
supabase status
# Expected: muestra la URL y anon key del proyecto
```

---

### Task 2: Correr todas las migraciones

- [ ] **Step 1: Verificar que hay 20 migraciones listas**

```bash
ls supabase/migrations/ | wc -l
# Expected: 20
```

- [ ] **Step 2: Aplicar las migraciones al proyecto de Supabase**

```bash
supabase db push
# Expected: "Applying migration 20260227115812..." x20
# Expected final: "Finished supabase db push."
```

Si alguna falla, revisar el mensaje de error. Las migraciones están ordenadas por timestamp y son idempotentes (usan IF NOT EXISTS).

- [ ] **Step 3: Verificar schema en el dashboard**

Abre `https://supabase.com/dashboard/project/<tu-ref>/editor` y confirma que existen las tablas: `customers`, `dogs`, `reservations`, `organizations`, `organization_members`, `packages`, `invoices`, etc.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "chore: link supabase project (no code changes)"
```

---

### Task 3: Configurar Google OAuth en Supabase

Esto reemplaza el Google OAuth que antes gestionaba Lovable.

- [ ] **Step 1: Crear OAuth App en Google Cloud Console**

1. Ve a `console.cloud.google.com`
2. Crea un nuevo proyecto o usa uno existente
3. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
4. Application type: **Web application**
5. Authorized redirect URIs: `https://<tu-project-ref>.supabase.co/auth/v1/callback`
6. Copia el **Client ID** y **Client Secret**

- [ ] **Step 2: Habilitar Google OAuth en Supabase**

En el dashboard de Supabase:
1. Authentication → Providers → Google
2. Habilita Google
3. Pega el Client ID y Client Secret del paso anterior
4. Save

- [ ] **Step 3: Configurar URL de redirección permitida en Supabase**

Authentication → URL Configuration:
- Site URL: `https://<tu-dominio-en-vercel>.vercel.app` (cambiar después a dominio custom)
- Additional Redirect URLs: `http://localhost:8080` (para desarrollo local)

---

### Task 4: Configurar secretos de Edge Functions

Los Edge Functions necesitan secretos configurados en Supabase antes de poder deployar.

- [ ] **Step 1: Configurar secretos en el dashboard de Supabase**

Ve a Project Settings → Edge Functions → Add secret para cada uno:

| Secret | Valor | Fuente |
|---|---|---|
| `RESEND_API_KEY` | `re_xxxx` | Tu cuenta en resend.com |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | `xxx` | LemonSqueezy → Settings → Webhooks |
| `ALLOWED_ORIGIN` | `https://app.kennelops.com` | Tu dominio de producción |
| `SUPABASE_ANON_KEY` | La anon key de tu proyecto | Supabase → Settings → API |

Nota: `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` son **auto-inyectados** por Supabase en cada Edge Function — no hay que configurarlos.

- [ ] **Step 2: Deploy de las Edge Functions**

```bash
supabase functions deploy send-campaign
supabase functions deploy handle-ls-webhook
# Expected: "Deployed Function send-campaign"
# Expected: "Deployed Function handle-ls-webhook"
```

---

## Fase 2: Corrección de Bugs de Seguridad

### Task 5: Fix bug crítico — REVOKE de columnas LS

**Contexto:** La migración `20260403000001_security_hardening.sql` intentó revocar acceso a columnas de billing pero usó los nombres viejos (`stripe_*`) que ya fueron renombrados a `ls_*` en la migración siguiente. El REVOKE nunca se aplicó a las columnas reales.

**Archivos:**
- Create: `supabase/migrations/20260528000001_fix_ls_column_revoke.sql`

- [ ] **Step 1: Crear la migración de fix**

```sql
-- supabase/migrations/20260528000001_fix_ls_column_revoke.sql
-- Fix: security_hardening intentó revocar stripe_* columns que ya
-- fueron renombradas a ls_* en la migración de LemonSqueezy.
-- El REVOKE correcto se aplica aquí sobre los nombres actuales.

REVOKE SELECT (ls_customer_id, ls_subscription_id)
  ON public.organizations FROM authenticated, anon;
```

- [ ] **Step 2: Aplicar la migración**

```bash
supabase db push
# Expected: "Applying migration 20260528000001_fix_ls_column_revoke.sql"
```

- [ ] **Step 3: Verificar en el dashboard**

En Supabase → Table Editor → organizations → selecciona un registro. Los campos `ls_customer_id` y `ls_subscription_id` NO deben ser visibles para el rol `authenticated`. Verifica en SQL Editor:

```sql
SET ROLE authenticated;
SELECT ls_customer_id FROM organizations LIMIT 1;
-- Expected: ERROR: permission denied for column ls_customer_id
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260528000001_fix_ls_column_revoke.sql
git commit -m "fix(security): apply REVOKE to renamed ls_* billing columns"
```

---

### Task 6: Fix `send-campaign` — usar `SUPABASE_ANON_KEY`

**Contexto:** `send-campaign/index.ts` usa `SUPABASE_PUBLISHABLE_KEY` que no es auto-inyectado por Supabase. El nombre estándar es `SUPABASE_ANON_KEY`.

**Archivos:**
- Modify: `supabase/functions/send-campaign/index.ts`

- [ ] **Step 1: Reemplazar la referencia al env var**

En `supabase/functions/send-campaign/index.ts`, línea ~42:

```typescript
// ANTES:
const userClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
  { global: { headers: { Authorization: authHeader } } }
);

// DESPUÉS:
const userClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  { global: { headers: { Authorization: authHeader } } }
);
```

- [ ] **Step 2: Redesplegar la función**

```bash
supabase functions deploy send-campaign
# Expected: "Deployed Function send-campaign"
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/send-campaign/index.ts
git commit -m "fix(security): use SUPABASE_ANON_KEY instead of custom SUPABASE_PUBLISHABLE_KEY"
```

---

## Fase 3: Limpieza del Frontend

### Task 7: Eliminar dependencias de Lovable

**Archivos:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Delete: `src/integrations/lovable/index.ts`

- [ ] **Step 1: Eliminar los paquetes de Lovable**

```bash
npm uninstall @lovable.dev/cloud-auth-js lovable-tagger
# Expected: removed 2 packages
```

- [ ] **Step 2: Eliminar el archivo de integración de Lovable**

```bash
rm src/integrations/lovable/index.ts
```

- [ ] **Step 3: Limpiar `vite.config.ts`**

```typescript
// vite.config.ts — ANTES:
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  // ...
}));

// vite.config.ts — DESPUÉS:
export default defineConfig(() => ({
  plugins: [react()],
  // ... (quitar el parámetro { mode } del callback ya que no se usa)
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/test-suite.ts", "src/**/*.test.ts"],
    css: false,
  },
}));
```

- [ ] **Step 4: Verificar que el build no rompe**

```bash
npm run build
# Expected: "✓ built in Xs" sin errores
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.ts
git rm src/integrations/lovable/index.ts
git commit -m "chore: remove Lovable-specific dependencies and integration files"
```

---

### Task 8: Estandarizar nombre de env var de Supabase

**Contexto:** El proyecto usa `VITE_SUPABASE_PUBLISHABLE_KEY` (nombre inventado por Lovable). El nombre estándar de Supabase es `VITE_SUPABASE_ANON_KEY`. Renombrarlo ahora evita confusión y es compatible con las docs oficiales de Supabase.

**Archivos:**
- Modify: `src/integrations/supabase/client.ts`
- Modify: `.env.example`

- [ ] **Step 1: Actualizar `client.ts`**

```typescript
// src/integrations/supabase/client.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY; // ← renombrado

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Faltan variables de entorno de Supabase. " +
    "Crea un archivo .env.local con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

- [ ] **Step 2: Actualizar `.env.example`**

```bash
# .env.example
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
VITE_SUPABASE_PROJECT_ID=<project-ref>

VITE_LS_CHECKOUT_STARTER=https://kennelops.lemonsqueezy.com/checkout/buy/<starter-id>
VITE_LS_CHECKOUT_GROWTH=https://kennelops.lemonsqueezy.com/checkout/buy/<growth-id>

SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-public-key>

RESEND_API_KEY=re_<your-resend-api-key>
LEMONSQUEEZY_WEBHOOK_SECRET=<your-webhook-signing-secret>
ALLOWED_ORIGIN=https://app.kennelops.com
```

- [ ] **Step 3: Crear `.env.local` con las credenciales reales (NO commitear)**

```bash
cp .env.example .env.local
# Editar .env.local con los valores reales de tu proyecto de Supabase:
# - VITE_SUPABASE_URL: Project Settings → API → Project URL
# - VITE_SUPABASE_ANON_KEY: Project Settings → API → anon public
```

- [ ] **Step 4: Verificar que el dev server arranca**

```bash
npm run dev
# Expected: "Local: http://localhost:8080" sin errores en consola
# Abre el browser → la landing page debe cargar
```

- [ ] **Step 5: Commit**

```bash
git add src/integrations/supabase/client.ts .env.example
git commit -m "fix: rename VITE_SUPABASE_PUBLISHABLE_KEY to VITE_SUPABASE_ANON_KEY, add startup guard"
```

---

### Task 9: Reemplazar Lovable OAuth con Supabase OAuth nativo

**Contexto:** `LoginPage.tsx` importa `lovable` de `src/integrations/lovable` para hacer Google OAuth a través del bridge de Lovable. Al eliminar ese paquete, Google login está roto. Reemplazamos con `supabase.auth.signInWithOAuth` que es la forma oficial.

**Archivos:**
- Modify: `src/pages/LoginPage.tsx`

- [ ] **Step 1: Reemplazar `handleGoogle` en `LoginPage.tsx`**

Busca la función `handleGoogle` (alrededor de la línea 80) y reemplázala:

```typescript
// ELIMINAR esta línea del top del archivo:
// import { lovable } from "@/integrations/lovable";

// REEMPLAZAR la función handleGoogle:
const handleGoogle = async () => {
  setGoogleLoading(true);
  const redirectTo = invite
    ? `${window.location.origin}/login?invite=${invite}`
    : `${window.location.origin}/login`;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  if (error) {
    toast.error(error.message);
    setGoogleLoading(false);
  }
  // Si no hay error, el browser redirige a Google → no hay más código aquí
};
```

- [ ] **Step 2: Verificar que no quedan referencias a `lovable` en el archivo**

```bash
grep -n "lovable" src/pages/LoginPage.tsx
# Expected: sin output (ninguna referencia)
```

- [ ] **Step 3: Verificar que `RegisterPage.tsx` no también usa lovable**

```bash
grep -rn "lovable" src/pages/
# Expected: sin output
```

Si `RegisterPage.tsx` también tiene `lovable.auth.signInWithOAuth`, aplicar el mismo reemplazo.

- [ ] **Step 4: Build limpio**

```bash
npm run build
# Expected: "✓ built in Xs" sin errores ni warnings de imports no resueltos
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/LoginPage.tsx src/pages/RegisterPage.tsx
git commit -m "feat: replace Lovable OAuth bridge with native supabase.auth.signInWithOAuth"
```

---

## Fase 4: Vercel Setup

### Task 10: Agregar configuración de routing SPA

**Contexto:** Sin este archivo, Vercel devuelve 404 para cualquier URL que no sea `/` (por ej: `/login`, `/:orgSlug/dashboard`). Esto rompe bookmarks, links compartidos y F5 en cualquier ruta interna.

**Archivos:**
- Create: `vercel.json`

- [ ] **Step 1: Crear `vercel.json` en la raíz del proyecto**

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ],
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

- [ ] **Step 2: Verificar con Vercel CLI (opcional pero recomendado)**

```bash
npm install -g vercel
vercel dev
# Abre http://localhost:3000
# Prueba navegar a /login directamente → debe cargar la app, NO un 404
```

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat(infra): add vercel.json with SPA rewrites and security headers"
```

---

### Task 11: Conectar repo a Vercel y configurar env vars

- [ ] **Step 1: Crear proyecto en Vercel**

1. Ve a `vercel.com` → New Project
2. Importa el repo de GitHub de este proyecto
3. Framework Preset: **Vite** (Vercel lo detecta automáticamente)
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Click **Deploy** (el primer deploy fallará porque faltan env vars — es esperado)

- [ ] **Step 2: Configurar variables de entorno en Vercel**

En tu proyecto de Vercel → Settings → Environment Variables, agrega:

| Variable | Valor | Entornos |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | `<anon-key>` | Production, Preview, Development |
| `VITE_SUPABASE_PROJECT_ID` | `<project-ref>` | Production, Preview, Development |
| `VITE_LS_CHECKOUT_STARTER` | URL del checkout de LemonSqueezy | Production |
| `VITE_LS_CHECKOUT_GROWTH` | URL del checkout de LemonSqueezy | Production |

Los valores de Supabase los encuentras en: Project Settings → API.

- [ ] **Step 3: Forzar un nuevo deploy**

```bash
git commit --allow-empty -m "chore: trigger redeploy with env vars"
git push
# Vercel hace deploy automáticamente al hacer push a main
```

O desde el dashboard de Vercel: Deployments → Redeploy.

- [ ] **Step 4: Verificar que la app carga**

1. Abre la URL de Vercel (ej: `https://kennel-stride.vercel.app`)
2. La landing page debe cargar ✅
3. `/login` directamente en la barra de URL debe cargar ✅ (no 404)
4. F5 en cualquier ruta interna debe mantener la app ✅

---

### Task 12: Configurar dominio custom en Vercel

- [ ] **Step 1: Agregar el dominio en Vercel**

Vercel → tu proyecto → Settings → Domains → Add `app.kennelops.com`

Vercel te dará un registro DNS para agregar en tu proveedor de dominio.

- [ ] **Step 2: Agregar el registro DNS en tu proveedor**

Agrega el registro CNAME o A que Vercel indica. Puede tomar hasta 48h en propagarse (usualmente minutos).

- [ ] **Step 3: Actualizar Site URL en Supabase**

Authentication → URL Configuration:
- Site URL: `https://app.kennelops.com`
- Additional Redirect URLs: `https://<tu-proyecto>.vercel.app` (para previews)

- [ ] **Step 4: Verificar SSL y login completo**

1. `https://app.kennelops.com` → landing ✅
2. `/login` → formulario de login ✅
3. Login con email/password → redirige a dashboard ✅
4. Login con Google → redirige a Google, vuelve a la app ✅ (requiere que el dominio esté en los Authorized Redirect URIs de Google Cloud)

- [ ] **Step 5: Agregar dominio a Google OAuth**

En Google Cloud Console → tu OAuth App → Authorized redirect URIs:
- Agregar: `https://app.kennelops.com/login` 
- (el callback real va a Supabase, pero también agregar como precaución)

- [ ] **Step 6: Commit final**

```bash
git add .
git commit -m "feat: complete migration from Lovable to Vercel + Supabase"
```

---

## Checklist de verificación final

Antes de considerar la migración completa, verificar:

- [ ] App carga en `https://app.kennelops.com` sin errores en consola
- [ ] F5 en `/login`, `/:orgSlug/dashboard` no devuelve 404
- [ ] Login con email/password funciona
- [ ] Login con Google OAuth funciona (redirige correctamente)
- [ ] Crear nueva organización (onboarding) funciona
- [ ] Las Edge Functions responden (probar desde CampaignsPage → enviar campaña)
- [ ] LemonSqueezy checkout links llevan al checkout correcto
- [ ] No hay referencias a `lovable` en el código (`grep -r "lovable" src/`)
- [ ] `npm run build` pasa sin errores ni warnings de imports
- [ ] `supabase/migrations/` tienen todos los RLS aplicados correctamente

---

## Resumen de riesgos residuales (post-migración)

| Riesgo | Severidad | Nota |
|---|---|---|
| Trial de 14 días para nuevas orgs | Medio | Nuevos usuarios van a billing después de 14 días. Verificar que LS checkout URLs estén configuradas |
| Segmento "inactive" en campaigns | Bajo | Retorna 400 intencionalmente — está pendiente de implementar |
| Rate limiting en auth | Bajo | Supabase aplica rate limiting básico por defecto. Considerar Auth Hooks para lógica custom |
| Backup de DB | Bajo | Supabase free tier hace backups diarios. Considerar upgrade para PITR en producción |
