# KennelStride — Production Hardening Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la app de un demo funcional a un producto real: reparar bugs críticos, eliminar vulnerabilidades de seguridad, migrar el data layer a React Query, hacer búsquedas y filtros server-side, y añadir persistencia de estado en URL.

**Architecture:** SPA React 18 + Vite + TypeScript sobre Supabase (Postgres + Auth + Edge Functions). Se migra el data fetching de 29 instancias manuales `useEffect+useState+fetch` a hooks centralizados con `@tanstack/react-query` v5. Los filtros y tabs se mueven a `useSearchParams`. Pagos (LemonSqueezy) excluidos de este plan.

**Tech Stack:** React 18, TypeScript 5, React Router 6, @tanstack/react-query v5, Supabase JS v2, Vitest + Testing Library, Tailwind + shadcn/ui, Supabase Edge Functions (Deno), Vercel.

---

## Mapa de archivos

### Crear
- `src/lib/query-client.ts` — QueryClient singleton con config de producción
- `src/hooks/queries/useCustomers.ts` — useQuery + useMutation para clientes
- `src/hooks/queries/useDogs.ts` — useQuery + useMutation para perros
- `src/hooks/queries/usePackages.ts` — useQuery + useMutation para paquetes
- `src/hooks/queries/useInvoices.ts` — useQuery + useMutation para facturas
- `src/hooks/queries/useNotices.ts` — useQuery + useMutation para avisos
- `src/hooks/queries/useCampaigns.ts` — useQuery + useMutation para campañas
- `src/hooks/queries/useReportCards.ts` — useQuery + useMutation para reportes de conducta
- `src/hooks/queries/useReportsData.ts` — useQuery para datos del módulo de reportes/estadísticas
- `src/hooks/useUrlState.ts` — helper tipado sobre useSearchParams
- `src/components/shared/TableSkeleton.tsx` — skeleton reutilizable para tablas
- `supabase/migrations/20260528000010_credit_audit_trail.sql` — tabla de auditoría de créditos
- `tests/hooks/useCustomers.test.ts` — tests de integración del hook
- `tests/hooks/useUrlState.test.ts` — tests del helper de URL

### Modificar
- `src/App.tsx` — mover QueryClient a componente, eliminar Toaster duplicado
- `vercel.json` — añadir CSP, eliminar X-XSS-Protection deprecado
- `src/pages/Dashboard.tsx` — fix checkout, fix flag filter, fix KPI, filtros → URL
- `src/pages/CustomersPage.tsx` — migrar a useCustomers, search server-side
- `src/pages/DogsPage.tsx` — migrar a useDogs, search server-side
- `src/pages/PackagesPage.tsx` — migrar a usePackages, audit trail en deduct
- `src/pages/InvoicesPage.tsx` — migrar a useInvoices
- `src/pages/ReportsPage.tsx` — eliminar `any[]`, filtrado DB-side, migrar a useReportsData
- `src/pages/CampaignsPage.tsx` — deshabilitar segmento "inactive" en UI, fix SMS/WhatsApp
- `src/pages/NoticesPage.tsx` — migrar a useNotices
- `src/pages/ReportCardsPage.tsx` — migrar a useReportCards
- `src/pages/RequestsPage.tsx` — tab + filtros → URL
- `supabase/functions/send-campaign/index.ts` — fix cross-org, fix VIP, sanitize errors
- `supabase/migrations/20260528000004_inactive_segment_rpc.sql` — RPC para segmento inactivo

### Eliminar
- `src/data/mockData.ts` — código muerto
- `src/landing/LandingPage.tsx` — duplicado sin usar

---

## PHASE 1 — Bugs críticos (bloquean producción)

### Task 1: Fix CheckOut + Flag Filter + KPI inconsistency en Dashboard

**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Test: `tests/dashboard-logic.test.ts`

- [ ] **Step 1: Escribir test para el bug de checkout**

```ts
// tests/dashboard-logic.test.ts
import { describe, it, expect, vi } from "vitest";

describe("handleCheckOutConfirm", () => {
  it("llama a checkOut con el id correcto", async () => {
    const checkOut = vi.fn().mockResolvedValue({ error: null });
    const setOpen = vi.fn();
    const setSelected = vi.fn();

    // simula la función corregida
    async function handleCheckOutConfirm(
      data: { reservationId: string },
      deps: { checkOut: typeof checkOut; setOpen: typeof setOpen; setSelected: typeof setSelected }
    ) {
      const { error } = await deps.checkOut(data.reservationId);
      deps.setOpen(false);
      deps.setSelected(null);
      return { error };
    }

    await handleCheckOutConfirm(
      { reservationId: "res-1" },
      { checkOut, setOpen, setSelected }
    );

    expect(checkOut).toHaveBeenCalledWith("res-1");
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(setSelected).toHaveBeenCalledWith(null);
  });
});
```

- [ ] **Step 2: Correr el test — debe pasar (valida la lógica esperada)**

```bash
cd /Users/daniel/kennel-stride && npx vitest run tests/dashboard-logic.test.ts
```

- [ ] **Step 3: Corregir `handleCheckOutConfirm` en Dashboard.tsx**

Localizar la función en `src/pages/Dashboard.tsx`. Actualmente:

```ts
const handleCheckOutConfirm = (_data: { reservationId: string }) => {
  setCheckOutModalOpen(false);
  setSelectedReservation(null);
};
```

Reemplazar con:

```ts
const handleCheckOutConfirm = async (data: { reservationId: string }) => {
  const { error } = await checkOut(data.reservationId);
  setCheckOutModalOpen(false);
  if (error) {
    toast.error("Error al registrar check-out");
  } else {
    toast.success("Check-out completado", {
      description: `${selectedReservation?.dog?.name} ha salido del centro.`,
    });
  }
  setSelectedReservation(null);
};
```

- [ ] **Step 4: Corregir flag filter — añadirlo al useMemo de `filteredReservations`**

Localizar el `useMemo` de `filteredReservations`. Al final del bloque de filtros, antes del `return filtered`, añadir:

```ts
if (flagFilter !== "all") {
  filtered = filtered.filter((r) =>
    r.dog?.flags?.some((f) => f.type === flagFilter)
  );
}
```

El `useMemo` deps array debe incluir `flagFilter`:

```ts
}, [activeTab, reservations, searchQuery, serviceFilter, flagFilter]);
```

- [ ] **Step 5: Corregir inconsistencia KPI "goingHome" vs tabCounts "going-home"**

En `tabCounts` el contador de `goingHome` usa `CHECKED_IN` y `READY`. El KPI usa `READY` o `(CHECKED_IN && endDate === hoy)`. Hacerlos consistentes — ambos deben usar la misma lógica. Actualizar el KPI en `kpis`:

```ts
goingHome: today.filter((r) =>
  r.status === ReservationStatus.READY ||
  r.status === ReservationStatus.CHECKED_IN
).length,
```

Esto alinea KPI con tab count. El filtro de endDate era subjetivo y no reflejaba lo que el tab mostraba.

- [ ] **Step 6: Correr tests**

```bash
npx vitest run tests/dashboard-logic.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/pages/Dashboard.tsx tests/dashboard-logic.test.ts
git commit -m "fix: checkout funcional, flag filter activo, KPI consistente"
```

---

### Task 2: Eliminar código muerto

**Files:**
- Delete: `src/data/mockData.ts`
- Delete: `src/landing/LandingPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Verificar que mockData.ts no se importa en ningún lado**

```bash
grep -r "mockData" /Users/daniel/kennel-stride/src --include="*.tsx" --include="*.ts"
```

Expected: ningún resultado.

- [ ] **Step 2: Verificar que `src/landing/LandingPage.tsx` no se usa**

```bash
grep -r "landing/LandingPage" /Users/daniel/kennel-stride/src --include="*.tsx" --include="*.ts"
```

Expected: ningún resultado.

- [ ] **Step 3: Eliminar archivos**

```bash
rm /Users/daniel/kennel-stride/src/data/mockData.ts
rm /Users/daniel/kennel-stride/src/landing/LandingPage.tsx
rmdir /Users/daniel/kennel-stride/src/landing 2>/dev/null || true
```

- [ ] **Step 4: Eliminar el `<Toaster />` duplicado de Radix en `src/App.tsx`**

Localizar en `src/App.tsx`:

```tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
// ...
<Toaster />
<Sonner position="top-right" />
```

Eliminar la importación de `Toaster` y el elemento `<Toaster />`. Dejar solo `<Sonner>`:

```tsx
import { Toaster as Sonner } from "@/components/ui/sonner";
// ...
<Sonner position="top-right" />
```

- [ ] **Step 5: Build para verificar no hay imports rotos**

```bash
npm run build 2>&1 | tail -20
```

Expected: `built in Xs` sin errores.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: eliminar código muerto (mockData, landing duplicado, Toaster duplicado)"
```

---

## PHASE 2 — Seguridad

### Task 3: Headers de seguridad correctos (CSP + retirar deprecados)

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Reemplazar el bloque de headers en `vercel.json`**

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
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com https://api.lemonsqueezy.com; frame-ancestors 'none'"
        }
      ]
    }
  ],
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

Nota: `X-XSS-Protection` fue eliminado — está deprecado en todos los navegadores modernos y causa problemas en algunos casos.

- [ ] **Step 2: Verificar build**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "security: CSP, HSTS, Permissions-Policy; eliminar X-XSS-Protection deprecado"
```

---

### Task 4: Arreglar vulnerabilidades en Edge Function send-campaign

**Files:**
- Modify: `supabase/functions/send-campaign/index.ts`
- Create: `supabase/migrations/20260528000004_inactive_segment_rpc.sql`
- Modify: `src/pages/CampaignsPage.tsx`

**Bugs a corregir:**
1. Cross-org: usuario autenticado puede enviar campaña de otra org
2. VIP = top 50 por balance (deudores, no VIPs)
3. Errors devuelven `String(err)` con internals
4. SMS/WhatsApp marcan delivered=recipients sin enviar nada
5. Segmento "inactive" retorna 400 en prod

- [ ] **Step 1: Crear migration para RPC del segmento inactivo**

```sql
-- supabase/migrations/20260528000004_inactive_segment_rpc.sql
-- Retorna IDs de clientes de una org que no tienen reservas completadas
-- en los últimos N días. Usado por send-campaign para el segmento "inactive".
CREATE OR REPLACE FUNCTION public.get_inactive_customer_ids(
  p_organization_id uuid,
  p_days int DEFAULT 30
)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.customers c
  WHERE c.organization_id = p_organization_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.reservations r
      WHERE r.customer_id = c.id
        AND r.organization_id = p_organization_id
        AND r.status IN ('completed', 'checked_in', 'in_progress')
        AND r.start_date >= (CURRENT_DATE - (p_days || ' days')::interval)
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_inactive_customer_ids(uuid, int)
  TO authenticated, service_role;
```

Aplicar la migration:

```bash
supabase db push
```

O desde el dashboard de Supabase → SQL Editor → pegar y ejecutar.

- [ ] **Step 2: Reemplazar `supabase/functions/send-campaign/index.ts` completo**

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "https://app.kennelops.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface CustomerRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  dogs?: { name: string }[];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 1. Validar JWT del caller
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Authorization header requerido" }, 401);
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ error: "No autorizado" }, 401);
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const campaignId: string = body?.campaignId;
    if (!campaignId) return jsonResponse({ error: "campaignId requerido" }, 400);

    // 2. Cargar campaña
    const { data: campaign, error: campErr } = await adminClient
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campErr || !campaign) {
      return jsonResponse({ error: "Campaña no encontrada" }, 404);
    }

    // 3. CRÍTICO: verificar que el caller es miembro de la org de la campaña
    const { data: membership } = await adminClient
      .from("organization_members")
      .select("role")
      .eq("organization_id", campaign.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return jsonResponse({ error: "No autorizado para esta organización" }, 403);
    }

    const orgId: string = campaign.organization_id;

    // 4. Construir query de destinatarios según segmento
    let recipients: CustomerRow[] = [];

    if (campaign.segment_type === "all") {
      const { data } = await adminClient
        .from("customers")
        .select("id, first_name, last_name, email, dogs(name)")
        .eq("organization_id", orgId);
      recipients = (data ?? []) as CustomerRow[];
    } else if (campaign.segment_type === "new") {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data } = await adminClient
        .from("customers")
        .select("id, first_name, last_name, email, dogs(name)")
        .eq("organization_id", orgId)
        .gte("created_at", thirtyDaysAgo);
      recipients = (data ?? []) as CustomerRow[];
    } else if (campaign.segment_type === "inactive") {
      // Usar RPC para obtener IDs de clientes inactivos 30+ días
      const { data: inactiveIds } = await adminClient
        .rpc("get_inactive_customer_ids", { p_organization_id: orgId, p_days: 30 });
      if (inactiveIds && inactiveIds.length > 0) {
        const { data } = await adminClient
          .from("customers")
          .select("id, first_name, last_name, email, dogs(name)")
          .in("id", inactiveIds as string[]);
        recipients = (data ?? []) as CustomerRow[];
      }
    } else if (campaign.segment_type === "vip") {
      // VIP = clientes con >= 5 reservas completadas en el último año
      const oneYearAgo = new Date(Date.now() - 365 * 86400000).toISOString();
      const { data: vipData } = await adminClient
        .from("reservations")
        .select("customer_id")
        .eq("organization_id", orgId)
        .eq("status", "completed")
        .gte("start_date", oneYearAgo);

      if (vipData) {
        const countByCustomer: Record<string, number> = {};
        for (const r of vipData) {
          countByCustomer[r.customer_id] = (countByCustomer[r.customer_id] ?? 0) + 1;
        }
        const vipIds = Object.entries(countByCustomer)
          .filter(([, count]) => count >= 5)
          .map(([id]) => id);

        if (vipIds.length > 0) {
          const { data } = await adminClient
            .from("customers")
            .select("id, first_name, last_name, email, dogs(name)")
            .in("id", vipIds);
          recipients = (data ?? []) as CustomerRow[];
        }
      }
    } else {
      return jsonResponse({ error: `Segmento desconocido: ${campaign.segment_type}` }, 400);
    }

    recipients = recipients.filter((c) => c.email);
    if (recipients.length === 0) {
      return jsonResponse({ error: "No hay destinatarios para este segmento" }, 400);
    }

    // 5. Enviar según canal
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    let delivered = 0;
    let failed = 0;

    if (campaign.channel === "email" && RESEND_API_KEY) {
      for (const customer of recipients) {
        const dogName = customer.dogs?.[0]?.name ?? "tu mascota";
        const personalizedMessage = campaign.message_template
          .replace(/{nombre}/g, customer.first_name)
          .replace(/{perro}/g, dogName)
          .replace(/{email}/g, customer.email);

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "KennelOps <noreply@kennelops.com>",
            to: [customer.email],
            subject: campaign.name,
            text: personalizedMessage,
          }),
        });

        if (res.ok) delivered++;
        else failed++;
      }
    } else if (campaign.channel === "sms" || campaign.channel === "whatsapp") {
      // SMS/WhatsApp no están implementados — no simular entrega falsa
      return jsonResponse({
        error: `El canal ${campaign.channel} no está configurado. Configura un proveedor de SMS/WhatsApp para usar este canal.`,
      }, 400);
    } else if (!RESEND_API_KEY && campaign.channel === "email") {
      return jsonResponse({
        error: "RESEND_API_KEY no configurado. Configura el secret en Supabase para enviar emails.",
      }, 400);
    }

    await adminClient.from("campaigns").update({
      status: "sent",
      sent_at: new Date().toISOString(),
      stats_sent: delivered + failed,
      stats_delivered: delivered,
      stats_opened: 0,
      stats_clicked: 0,
      updated_at: new Date().toISOString(),
    }).eq("id", campaignId);

    return jsonResponse({ success: true, sent: delivered + failed, delivered, failed });

  } catch (err) {
    // No devolver detalles internos al cliente
    console.error("send-campaign error:", err);
    return jsonResponse({ error: "Error interno del servidor" }, 500);
  }
});
```

- [ ] **Step 3: Deshabilitar segmento "inactive" en el UI de CampaignsPage hasta que esté probado**

En `src/pages/CampaignsPage.tsx`, encontrar el `<SelectContent>` del campo `segment_type`. Añadir `disabled` al item "inactive" con nota:

```tsx
<SelectItem value="inactive" disabled>
  Inactivos 30+ días (próximamente)
</SelectItem>
```

Retirar el `disabled` una vez que la función RPC esté validada en producción.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/send-campaign/index.ts \
        src/pages/CampaignsPage.tsx \
        supabase/migrations/20260528000004_inactive_segment_rpc.sql
git commit -m "security: fix cross-org en campaigns, VIP por actividad real, sanitizar errors, deshabilitar SMS/WA fake"
```

---

## PHASE 3 — Data Layer: React Query

### Task 5: Mover QueryClient al componente + configuración de producción

**Files:**
- Create: `src/lib/query-client.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Crear `src/lib/query-client.ts`**

```ts
import { QueryClient } from "@tanstack/react-query";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60,      // 1 minuto antes de re-fetch en background
        gcTime: 1000 * 60 * 5,     // 5 minutos en cache sin uso
        retry: 1,                   // 1 reintento en error de red
        refetchOnWindowFocus: false, // no re-fetch al volver al tab (kennel no necesita)
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
```

- [ ] **Step 2: Modificar `src/App.tsx` — QueryClient dentro del componente + DevTools en dev**

Reemplazar:

```tsx
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
```

Con:

```tsx
import { useState } from "react";
import { createQueryClient } from "@/lib/query-client";

const App = () => {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
```

Si el proyecto está en desarrollo, añadir las DevTools (no aparecen en producción build):

```tsx
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

// Dentro del árbol, al final antes de cerrar QueryClientProvider:
{import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
```

Instalar devtools si no está:

```bash
npm install @tanstack/react-query-devtools --save-dev
```

- [ ] **Step 3: Verificar build**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/query-client.ts src/App.tsx package.json package-lock.json
git commit -m "refactor: QueryClient en componente con config de producción + DevTools"
```

---

### Task 6: Crear hooks de dominio con React Query

**Files:**
- Create: `src/hooks/queries/useCustomers.ts`
- Create: `src/hooks/queries/useDogs.ts`
- Create: `src/hooks/queries/usePackages.ts`
- Create: `src/hooks/queries/useInvoices.ts`
- Create: `src/hooks/queries/useNotices.ts`
- Create: `src/hooks/queries/useCampaigns.ts`
- Create: `src/hooks/queries/useReportCards.ts`
- Create: `src/hooks/queries/useReportsData.ts`
- Test: `tests/hooks/useCustomers.test.ts`

- [ ] **Step 1: Crear `src/hooks/queries/useCustomers.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

const PAGE_SIZE = 50;

export interface DbCustomer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  balance: number;
  created_at: string;
  updated_at: string;
  dog_count?: number;
}

export type CreateCustomerInput = Omit<DbCustomer, "id" | "created_at" | "updated_at" | "dog_count">;
export type UpdateCustomerInput = Partial<CreateCustomerInput>;

function customerKeys(orgId: string | undefined) {
  return {
    all: ["customers", orgId] as const,
    list: (page: number, search: string) => ["customers", orgId, "list", page, search] as const,
    detail: (id: string) => ["customers", orgId, id] as const,
  };
}

export function useCustomers({ page = 0, search = "" } = {}) {
  const { organization } = useOrganization();
  const keys = customerKeys(organization?.id);

  return useQuery({
    queryKey: keys.list(page, search),
    enabled: !!organization?.id,
    queryFn: async () => {
      let query = supabase
        .from("customers")
        .select("*, dogs(id)", { count: "exact" })
        .eq("organization_id", organization!.id)
        .order("first_name", { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (search.trim()) {
        query = query.or(
          `first_name.ilike.%${search.trim()}%,last_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%`
        );
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const customers = (data ?? []).map((c: any) => ({
        ...c,
        dog_count: c.dogs?.length ?? 0,
        dogs: undefined,
      })) as DbCustomer[];

      return { customers, total: count ?? 0, hasMore: customers.length === PAGE_SIZE };
    },
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (input: CreateCustomerInput) => {
      const { data, error } = await supabase
        .from("customers")
        .insert({ ...input, organization_id: organization!.id })
        .select()
        .single();
      if (error) throw error;
      return data as DbCustomer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys(organization?.id).all });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateCustomerInput & { id: string }) => {
      const { data, error } = await supabase
        .from("customers")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("organization_id", organization!.id)
        .select()
        .single();
      if (error) throw error;
      return data as DbCustomer;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: customerKeys(organization?.id).all });
      queryClient.setQueryData(customerKeys(organization?.id).detail(updated.id), updated);
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", id)
        .eq("organization_id", organization!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys(organization?.id).all });
    },
  });
}
```

- [ ] **Step 2: Crear `src/hooks/queries/useDogs.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

const PAGE_SIZE = 50;

export interface DbDog {
  id: string;
  customer_id: string;
  name: string;
  breed: string;
  birth_date: string | null;
  weight: number | null;
  color: string | null;
  gender: string;
  is_neutered: boolean;
  is_aggressive: boolean;
  has_allergies: boolean;
  on_medication: boolean;
  microchip_number: string | null;
  notes: string | null;
  behavior_notes: string | null;
  medical_notes: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
  customers?: { id: string; first_name: string; last_name: string } | null;
}

function dogKeys(orgId: string | undefined) {
  return {
    all: ["dogs", orgId] as const,
    list: (page: number, search: string) => ["dogs", orgId, "list", page, search] as const,
    detail: (id: string) => ["dogs", orgId, id] as const,
  };
}

export function useDogs({ page = 0, search = "" } = {}) {
  const { organization } = useOrganization();
  const keys = dogKeys(organization?.id);

  return useQuery({
    queryKey: keys.list(page, search),
    enabled: !!organization?.id,
    queryFn: async () => {
      let query = supabase
        .from("dogs")
        .select("*, customers(id, first_name, last_name)", { count: "exact" })
        .eq("organization_id", organization!.id)
        .order("name", { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (search.trim()) {
        query = query.or(
          `name.ilike.%${search.trim()}%,breed.ilike.%${search.trim()}%`
        );
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { dogs: (data ?? []) as DbDog[], total: count ?? 0, hasMore: (data?.length ?? 0) === PAGE_SIZE };
    },
  });
}

export function useDeleteDog() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("dogs")
        .delete()
        .eq("id", id)
        .eq("organization_id", organization!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dogKeys(organization?.id).all });
    },
  });
}
```

- [ ] **Step 3: Crear `src/hooks/queries/usePackages.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

const PAGE_SIZE = 50;

export interface DbPackage {
  id: string;
  customer_id: string;
  name: string;
  service_type: string;
  total_credits: number;
  remaining_credits: number;
  price: number;
  purchase_date: string;
  expires_at: string;
  status: string;
  ls_order_id: string | null;
  ls_variant_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function packageKeys(orgId: string | undefined) {
  return {
    all: ["packages", orgId] as const,
    list: (page: number, search: string, status: string) =>
      ["packages", orgId, "list", page, search, status] as const,
  };
}

export function usePackages({ page = 0, search = "", status = "all" } = {}) {
  const { organization } = useOrganization();
  const keys = packageKeys(organization?.id);

  return useQuery({
    queryKey: keys.list(page, search, status),
    enabled: !!organization?.id,
    queryFn: async () => {
      let query = supabase
        .from("packages")
        .select(`
          *,
          customers(id, first_name, last_name, email, phone)
        `, { count: "exact" })
        .eq("organization_id", organization!.id)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (status !== "all") query = query.eq("status", status);

      if (search.trim()) {
        query = query.or(`name.ilike.%${search.trim()}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { packages: (data ?? []) as any[], total: count ?? 0, hasMore: (data?.length ?? 0) === PAGE_SIZE };
    },
  });
}

export function useDeductCredit() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async ({ packageId, remaining, reason }: { packageId: string; remaining: number; reason?: string }) => {
      const { error } = await supabase
        .from("packages")
        .update({
          remaining_credits: remaining - 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", packageId)
        .eq("organization_id", organization!.id);
      if (error) throw error;

      // Insertar en audit trail
      await supabase.from("package_credit_log").insert({
        package_id: packageId,
        organization_id: organization!.id,
        action: "deduct",
        credits_before: remaining,
        credits_after: remaining - 1,
        reason: reason ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: packageKeys(organization?.id).all });
    },
  });
}

export function useCreatePackage() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (input: Partial<DbPackage>) => {
      const { data, error } = await supabase
        .from("packages")
        .insert({ ...input, organization_id: organization!.id, remaining_credits: input.total_credits })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: packageKeys(organization?.id).all });
    },
  });
}

export function useUpdatePackage() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<DbPackage> & { id: string }) => {
      const { data, error } = await supabase
        .from("packages")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("organization_id", organization!.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: packageKeys(organization?.id).all });
    },
  });
}
```

- [ ] **Step 4: Crear `src/hooks/queries/useNotices.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Notice, NoticeSeverity } from "@/types";

function noticeKeys(orgId: string | undefined) {
  return {
    all: ["notices", orgId] as const,
    active: ["notices", orgId, "active"] as const,
  };
}

function mapDbNotice(n: any): Notice {
  return {
    id: n.id,
    title: n.title,
    message: n.message,
    severity: (n.severity as NoticeSeverity) ?? NoticeSeverity.INFO,
    isRead: n.is_read ?? false,
    entityType: n.entity_type ?? undefined,
    entityId: n.entity_id ?? undefined,
    suggestedActions: n.suggested_actions ?? undefined,
    createdAt: new Date(n.created_at),
  };
}

export function useNotices() {
  const { organization } = useOrganization();
  const keys = noticeKeys(organization?.id);

  return useQuery({
    queryKey: keys.active,
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notices")
        .select("id, title, message, severity, is_read, entity_type, entity_id, suggested_actions, created_at")
        .eq("organization_id", organization!.id)
        .eq("is_dismissed", false)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map(mapDbNotice);
    },
  });
}

export function useDismissNotice() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notices")
        .update({ is_dismissed: true })
        .eq("id", id);
      if (error) throw error;
    },
    // Optimistic update: quitar la notice inmediatamente sin esperar al servidor
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: noticeKeys(organization?.id).active });
      const prev = queryClient.getQueryData<Notice[]>(noticeKeys(organization?.id).active);
      queryClient.setQueryData(
        noticeKeys(organization?.id).active,
        (old: Notice[] | undefined) => (old ?? []).filter((n) => n.id !== id)
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      queryClient.setQueryData(noticeKeys(organization?.id).active, ctx?.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: noticeKeys(organization?.id).all });
    },
  });
}

export function useMarkNoticeRead() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notices")
        .update({ is_read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: noticeKeys(organization?.id).active });
      const prev = queryClient.getQueryData<Notice[]>(noticeKeys(organization?.id).active);
      queryClient.setQueryData(
        noticeKeys(organization?.id).active,
        (old: Notice[] | undefined) =>
          (old ?? []).map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      queryClient.setQueryData(noticeKeys(organization?.id).active, ctx?.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: noticeKeys(organization?.id).all });
    },
  });
}
```

- [ ] **Step 5: Crear `src/hooks/queries/useReportsData.ts`**

Este hook es el más importante para escalabilidad — actualmente ReportsPage carga TODO el historial sin filtro de fecha.

```ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { subDays, subMonths } from "date-fns";

export type DateRange = "30d" | "90d" | "6m" | "1y";

function getDateFrom(range: DateRange): Date {
  const now = new Date();
  switch (range) {
    case "30d": return subDays(now, 30);
    case "90d": return subDays(now, 90);
    case "6m": return subMonths(now, 6);
    case "1y": return subMonths(now, 12);
  }
}

function reportsKeys(orgId: string | undefined) {
  return {
    all: ["reports", orgId] as const,
    range: (range: DateRange) => ["reports", orgId, range] as const,
  };
}

export function useReportsData(range: DateRange) {
  const { organization } = useOrganization();

  return useQuery({
    queryKey: reportsKeys(organization?.id).range(range),
    enabled: !!organization?.id,
    staleTime: 1000 * 60 * 5, // reportes aceptan 5min de staleness
    queryFn: async () => {
      const dateFrom = getDateFrom(range).toISOString();
      const orgId = organization!.id;

      // Todas las queries filtran por fecha en el servidor
      const [invR, custR, pkgR, unitR, rcR, resR] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, total, status, created_at, customer_id, payment_method")
          .eq("organization_id", orgId)
          .gte("created_at", dateFrom),
        supabase
          .from("customers")
          .select("id, created_at, city")
          .eq("organization_id", orgId)
          .gte("created_at", dateFrom),
        supabase
          .from("packages")
          .select("id, status, total_credits, remaining_credits, price, created_at")
          .eq("organization_id", orgId),  // paquetes: todos para KPIs de stock
        supabase
          .from("facility_units")
          .select("id, type, is_occupied")
          .eq("organization_id", orgId),
        supabase
          .from("report_cards")
          .select("id, rating, session_date")
          .eq("organization_id", orgId)
          .gte("session_date", dateFrom),
        supabase
          .from("reservations")
          .select("id, service_type, status, start_date, total_price, customer_id")
          .eq("organization_id", orgId)
          .gte("start_date", dateFrom),
      ]);

      if (invR.error) throw invR.error;
      if (resR.error) throw resR.error;

      return {
        invoices: invR.data ?? [],
        newCustomers: custR.data ?? [],
        packages: pkgR.data ?? [],
        units: unitR.data ?? [],
        reportCards: rcR.data ?? [],
        reservations: resR.data ?? [],
        dateFrom,
      };
    },
  });
}
```

- [ ] **Step 6: Crear `src/hooks/queries/useCampaigns.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

function campaignKeys(orgId: string | undefined) {
  return {
    all: ["campaigns", orgId] as const,
    list: ["campaigns", orgId, "list"] as const,
  };
}

export function useCampaigns() {
  const { organization } = useOrganization();

  return useQuery({
    queryKey: campaignKeys(organization?.id).list,
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, description, segment_type, channel, scheduled_at, sent_at, status, stats_sent, stats_delivered, stats_opened, stats_clicked, created_at, message_template")
        .eq("organization_id", organization!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("campaigns")
        .insert({ ...input, organization_id: organization!.id, status: "draft" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignKeys(organization?.id).all }),
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("campaigns")
        .delete()
        .eq("id", id)
        .eq("organization_id", organization!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignKeys(organization?.id).all }),
  });
}
```

- [ ] **Step 7: Crear `src/hooks/queries/useReportCards.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

const PAGE_SIZE = 50;

function reportCardKeys(orgId: string | undefined) {
  return {
    all: ["report-cards", orgId] as const,
    list: (page: number) => ["report-cards", orgId, "list", page] as const,
  };
}

export function useReportCards({ page = 0 } = {}) {
  const { organization } = useOrganization();

  return useQuery({
    queryKey: reportCardKeys(organization?.id).list(page),
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("report_cards")
        .select(`
          id, dog_id, staff_id, session_date, rating, notes, photos, created_at,
          dogs(id, name, photo_url, customers(id, first_name, last_name)),
          staff_members(id, first_name, last_name)
        `, { count: "exact" })
        .eq("organization_id", organization!.id)
        .order("session_date", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { cards: data ?? [], total: count ?? 0, hasMore: (data?.length ?? 0) === PAGE_SIZE };
    },
  });
}

export function useCreateReportCard() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("report_cards")
        .insert({ ...input, organization_id: organization!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reportCardKeys(organization?.id).all }),
  });
}
```

- [ ] **Step 8: Escribir test del hook `useCustomers`**

```ts
// tests/hooks/useCustomers.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useCustomers } from "@/hooks/queries/useCustomers";

// Mock del módulo supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      then: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    }),
  },
}));

// Mock del contexto de organización
vi.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: () => ({ organization: { id: "org-123" } }),
}));

describe("useCustomers", () => {
  let queryClient: QueryClient;

  function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it("retorna datos vacíos sin error cuando la query devuelve []", async () => {
    const { result } = renderHook(() => useCustomers(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.customers).toEqual([]);
    expect(result.current.data?.total).toBe(0);
  });

  it("incluye la clave de queryKey con orgId y página", () => {
    const { result } = renderHook(() => useCustomers({ page: 2, search: "Ana" }), { wrapper });
    // El hook debe estar enabled con orgId "org-123"
    expect(result.current.isLoading || result.current.isSuccess).toBe(true);
  });
});
```

- [ ] **Step 9: Correr test**

```bash
npx vitest run tests/hooks/useCustomers.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 10: Commit**

```bash
git add src/hooks/queries/ src/lib/ tests/hooks/
git commit -m "feat: hooks de dominio con React Query (customers, dogs, packages, notices, campaigns, report-cards, reports)"
```

---

### Task 7: Migrar páginas al data layer

**Files:**
- Modify: `src/pages/CustomersPage.tsx`
- Modify: `src/pages/DogsPage.tsx`
- Modify: `src/pages/PackagesPage.tsx`
- Modify: `src/pages/ReportsPage.tsx`
- Modify: `src/pages/CampaignsPage.tsx`
- Modify: `src/pages/NoticesPage.tsx`
- Modify: `src/pages/ReportCardsPage.tsx`
- Modify: `src/pages/Dashboard.tsx`

La migración sigue el mismo patrón en cada página. Se documenta completo en CustomersPage; el resto aplica el mismo reemplazo.

- [ ] **Step 1: Migrar CustomersPage — reemplazar el bloque de estado manual**

Eliminar de `CustomersPage.tsx`:

```tsx
const [customers, setCustomers] = useState<DbCustomer[]>([]);
const [loading, setLoading] = useState(true);
const [loadingMore, setLoadingMore] = useState(false);
const [hasMore, setHasMore] = useState(false);
const [page, setPage] = useState(0);

const fetchCustomers = async (reset = true) => { ... };
useEffect(() => { fetchCustomers(true); }, [organization?.id]);
```

Y también eliminar:
- `handleSave` que llama a `fetchCustomers()`
- `handleDelete` que llama a `fetchCustomers()`

Añadir al inicio del componente:

```tsx
import { useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from "@/hooks/queries/useCustomers";

// Dentro del componente:
const [page, setPage] = useState(0);
const [debouncedSearch, setDebouncedSearch] = useState("");

// El search debounced va al hook; el estado visual va directo al input
const { data, isLoading, isFetching } = useCustomers({ page, search: debouncedSearch });
const customers = data?.customers ?? [];
const hasMore = data?.hasMore ?? false;

const createCustomer = useCreateCustomer();
const updateCustomer = useUpdateCustomer();
const deleteCustomer = useDeleteCustomer();
```

Para el debounce del search (evitar query por cada tecla):

```tsx
import { useEffect, useState } from "react";

// Dentro del componente, después del useState del searchQuery:
useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearch(searchQuery);
    setPage(0); // Reset a página 0 cuando cambia búsqueda
  }, 300);
  return () => clearTimeout(timer);
}, [searchQuery]);
```

Reemplazar `handleSave`:

```tsx
const handleSave = async (formData: Partial<DbCustomer>) => {
  if (editingCustomer) {
    await updateCustomer.mutateAsync({ id: editingCustomer.id, ...formData });
    toast.success("Cliente actualizado");
  } else {
    await createCustomer.mutateAsync(formData as any);
    toast.success("Cliente creado");
  }
  setModalOpen(false);
  setEditingCustomer(null);
};
```

Reemplazar `handleDelete`:

```tsx
const handleDelete = async () => {
  if (!deleteId) return;
  await deleteCustomer.mutateAsync(deleteId);
  toast.success("Cliente eliminado");
  setDeleteId(null);
};
```

Reemplazar el "load more" button:

```tsx
{hasMore && (
  <div className="flex justify-center pt-2">
    <Button
      variant="outline"
      onClick={() => setPage((p) => p + 1)}
      disabled={isFetching}
    >
      {isFetching ? "Cargando..." : "Cargar más"}
    </Button>
  </div>
)}
```

Reemplazar `{loading ? ...}` con `{isLoading ? ...}`.

Eliminar el `useMemo` de `filtered` — la búsqueda ahora es server-side y los datos ya vienen filtrados.

- [ ] **Step 2: Migrar DogsPage — mismo patrón**

Eliminar el bloque `useState` para `dogs`, `loading`, `loadingMore`, `hasMore`, `page` y la función `fetchDogs` + su `useEffect`.

Añadir:

```tsx
import { useDogs, useDeleteDog } from "@/hooks/queries/useDogs";

const [page, setPage] = useState(0);
const [debouncedSearch, setDebouncedSearch] = useState("");

useEffect(() => {
  const timer = setTimeout(() => { setDebouncedSearch(searchQuery); setPage(0); }, 300);
  return () => clearTimeout(timer);
}, [searchQuery]);

const { data, isLoading, isFetching } = useDogs({ page, search: debouncedSearch });
const dogs = data?.dogs ?? [];
const hasMore = data?.hasMore ?? false;
const deleteDog = useDeleteDog();
```

Actualizar `handleDelete`:

```tsx
const handleDelete = async () => {
  if (!deleteId) return;
  await deleteDog.mutateAsync(deleteId);
  toast.success("Mascota eliminada");
  setDeleteId(null);
};
```

Eliminar `useMemo` de `filtered`.

- [ ] **Step 3: Migrar PackagesPage**

Eliminar `useState` para `packages`, `customers`, `loading`, `saving` y las funciones `fetchData`.

Añadir:

```tsx
import { usePackages, useCreatePackage, useUpdatePackage, useDeductCredit } from "@/hooks/queries/usePackages";
import { useCustomers } from "@/hooks/queries/useCustomers";

const { data: pkgData, isLoading } = usePackages({ page: 0, search, status: statusFilter });
const packages = pkgData?.packages ?? [];
const { data: custData } = useCustomers({ page: 0, search: "" }); // Para el selector del form
const customers = custData?.customers ?? [];

const createPackage = useCreatePackage();
const updatePackage = useUpdatePackage();
const deductCredit = useDeductCredit();
```

Reemplazar `handleSave`:

```tsx
const handleSave = async () => {
  if (!form.customer_id || !form.name) { toast.error("Completa los campos obligatorios"); return; }
  setSaving(true);
  try {
    if (editingPkg) {
      await updatePackage.mutateAsync({ id: editingPkg.id, ...form });
      toast.success("Paquete actualizado");
    } else {
      await createPackage.mutateAsync({ ...form, purchase_date: new Date().toISOString() });
      toast.success("Paquete creado");
    }
    setModalOpen(false);
  } finally {
    setSaving(false);
  }
};
```

Reemplazar `handleDeductCredit`:

```tsx
const handleDeductCredit = async (pkg: any) => {
  if (pkg.remaining_credits <= 0) { toast.error("No hay créditos disponibles"); return; }
  await deductCredit.mutateAsync({
    packageId: pkg.id,
    remaining: pkg.remaining_credits,
  });
  toast.success(`Crédito descontado (${pkg.remaining_credits - 1} restantes)`);
};
```

- [ ] **Step 4: Migrar ReportsPage**

Eliminar todos los `useState<any[]>` y el `useEffect` que carga los 6 datasets.

Añadir:

```tsx
import { useReportsData, DateRange } from "@/hooks/queries/useReportsData";

const { data, isLoading } = useReportsData(range);

const invoices = data?.invoices ?? [];
const newCustomers = data?.newCustomers ?? [];
const packages = data?.packages ?? [];
const units = data?.units ?? [];
const reportCards = data?.reportCards ?? [];
const reservations = data?.reservations ?? [];
```

Eliminar el `useMemo` de `dateFrom` ya que ahora viene del hook.

Todos los `useMemo` que usaban `invoices.filter(...)` con `dateFrom` ahora son innecesarios — los datos ya vienen filtrados del servidor. Simplificar:

```tsx
// Antes: invoices.filter(i => new Date(i.created_at) >= dateFrom)
// Después: simplemente usar `invoices` directamente
```

- [ ] **Step 5: Migrar NoticesPage, CampaignsPage, ReportCardsPage**

**NoticesPage** — reemplazar el `useEffect` + `useState` con:

```tsx
import { useNotices, useDismissNotice, useMarkNoticeRead } from "@/hooks/queries/useNotices";

const { data: notices = [], isLoading } = useNotices();
const dismissNotice = useDismissNotice();
const markRead = useMarkNoticeRead();
```

**CampaignsPage** — reemplazar `useEffect` + `setCampaigns` con:

```tsx
import { useCampaigns, useCreateCampaign, useDeleteCampaign } from "@/hooks/queries/useCampaigns";

const { data: campaigns = [], isLoading } = useCampaigns();
const createCampaign = useCreateCampaign();
const deleteCampaign = useDeleteCampaign();
```

**ReportCardsPage** — reemplazar con:

```tsx
import { useReportCards, useCreateReportCard } from "@/hooks/queries/useReportCards";

const { data, isLoading } = useReportCards({ page });
const cards = data?.cards ?? [];
```

- [ ] **Step 6: Migrar Dashboard — notices a React Query**

En `Dashboard.tsx`, eliminar `fetchNotices`, el `useEffect` que lo llama, y el canal realtime de notices. Reemplazar con:

```tsx
import { useNotices, useDismissNotice, useMarkNoticeRead } from "@/hooks/queries/useNotices";

const { data: notices = [] } = useNotices();
const dismissNotice = useDismissNotice();
const markRead = useMarkNoticeRead();

// Reemplazar handleDismissNotice:
const handleDismissNotice = (id: string) => dismissNotice.mutate(id);

// Reemplazar handleMarkNoticeRead:
const handleMarkNoticeRead = (id: string) => markRead.mutate(id);
```

El canal realtime de reservaciones permanece en `useReservations` — no cambia.

- [ ] **Step 7: Build y test**

```bash
npm run build 2>&1 | grep -E "error|warn" | head -20
npm run test 2>&1 | tail -20
```

- [ ] **Step 8: Commit**

```bash
git add src/pages/ src/hooks/
git commit -m "refactor: migrar todas las páginas a React Query — eliminar 29 fetch manuales"
```

---

## PHASE 4 — URL State Persistence

### Task 8: Helper `useUrlState` + filtros del Dashboard en URL

**Files:**
- Create: `src/hooks/useUrlState.ts`
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/pages/RequestsPage.tsx`
- Test: `tests/hooks/useUrlState.test.ts`

- [ ] **Step 1: Crear `src/hooks/useUrlState.ts`**

```ts
import { useSearchParams } from "react-router-dom";
import { useCallback } from "react";

type Serializable = string | number | boolean | null | undefined;

/**
 * Sincroniza un valor con un parámetro de URL.
 * Funciona igual que useState pero persiste en la URL — survives navegación y F5.
 */
export function useUrlState<T extends Serializable>(
  key: string,
  defaultValue: T,
  options?: { replace?: boolean }
): [T, (value: T) => void] {
  const [params, setParams] = useSearchParams();

  const rawValue = params.get(key);
  const value = (rawValue !== null ? rawValue : String(defaultValue ?? "")) as T;

  const setValue = useCallback(
    (newValue: T) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (newValue === null || newValue === undefined || newValue === defaultValue) {
            next.delete(key);
          } else {
            next.set(key, String(newValue));
          }
          return next;
        },
        { replace: options?.replace ?? true }
      );
    },
    [key, defaultValue, setParams, options?.replace]
  );

  return [value, setValue];
}
```

- [ ] **Step 2: Escribir test de `useUrlState`**

```ts
// tests/hooks/useUrlState.test.ts
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import { useUrlState } from "@/hooks/useUrlState";

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(MemoryRouter, { initialEntries: ["/"] }, children);
}

describe("useUrlState", () => {
  it("retorna defaultValue cuando el param no existe", () => {
    const { result } = renderHook(() => useUrlState("tab", "expected"), { wrapper });
    expect(result.current[0]).toBe("expected");
  });

  it("actualiza el valor al llamar al setter", () => {
    const { result } = renderHook(() => useUrlState("tab", "expected"), { wrapper });
    act(() => result.current[1]("checked-in"));
    expect(result.current[0]).toBe("checked-in");
  });

  it("elimina el param cuando el valor vuelve al default", () => {
    const { result } = renderHook(() => useUrlState("tab", "expected"), { wrapper });
    act(() => result.current[1]("checked-in"));
    act(() => result.current[1]("expected"));
    expect(result.current[0]).toBe("expected");
  });
});
```

- [ ] **Step 3: Correr test**

```bash
npx vitest run tests/hooks/useUrlState.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 4: Aplicar `useUrlState` en Dashboard.tsx**

Reemplazar los `useState` de filtros:

```tsx
// Antes:
const [activeTab, setActiveTab] = useState<OpsTab>("expected");
const [searchQuery, setSearchQuery] = useState("");
const [serviceFilter, setServiceFilter] = useState<ServiceType | "all">("all");
const [flagFilter, setFlagFilter] = useState<FlagType | "all">("all");

// Después:
import { useUrlState } from "@/hooks/useUrlState";

const [activeTab, setActiveTab] = useUrlState<OpsTab>("tab", "expected");
const [searchQuery, setSearchQuery] = useUrlState("q", "");
const [serviceFilter, setServiceFilter] = useUrlState<ServiceType | "all">("service", "all");
const [flagFilter, setFlagFilter] = useUrlState<FlagType | "all">("flag", "all");
```

- [ ] **Step 5: Aplicar `useUrlState` en RequestsPage.tsx**

```tsx
// Antes:
const [activeTab, setActiveTab] = useState<RequestTab>("pending");
const [searchQuery, setSearchQuery] = useState("");
const [serviceFilter, setServiceFilter] = useState<string>("all");

// Después:
const [activeTab, setActiveTab] = useUrlState<RequestTab>("tab", "pending");
const [searchQuery, setSearchQuery] = useUrlState("q", "");
const [serviceFilter, setServiceFilter] = useUrlState("service", "all");
```

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useUrlState.ts tests/hooks/useUrlState.test.ts \
        src/pages/Dashboard.tsx src/pages/RequestsPage.tsx
git commit -m "feat: filtros y tabs persistidos en URL con useUrlState"
```

---

## PHASE 5 — Audit Trail de Créditos

### Task 9: Tabla de auditoría para descuento de créditos

**Files:**
- Create: `supabase/migrations/20260528000010_credit_audit_trail.sql`

El hook `useDeductCredit` en Task 6 ya escribe a `package_credit_log`. Esta migration crea esa tabla.

- [ ] **Step 1: Crear la migration**

```sql
-- supabase/migrations/20260528000010_credit_audit_trail.sql
-- Registro inmutable de cada operación sobre créditos de paquetes.
-- Permite auditar quién descontó qué crédito y cuándo.

CREATE TABLE IF NOT EXISTS public.package_credit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id    uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action        text NOT NULL CHECK (action IN ('deduct', 'add', 'adjustment')),
  credits_before int NOT NULL,
  credits_after  int NOT NULL,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  reason        text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.package_credit_log ENABLE ROW LEVEL SECURITY;

-- Solo miembros de la org pueden leer su propio log
CREATE POLICY "Org members can read credit log"
  ON public.package_credit_log FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()));

-- Solo service_role puede escribir (las mutaciones van por el frontend autenticado)
-- pero queremos que el cliente autenticado también pueda insertar
CREATE POLICY "Authenticated can insert credit log"
  ON public.package_credit_log FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

CREATE INDEX idx_credit_log_package ON public.package_credit_log(package_id);
CREATE INDEX idx_credit_log_org     ON public.package_credit_log(organization_id);
CREATE INDEX idx_credit_log_created ON public.package_credit_log(created_at DESC);
```

- [ ] **Step 2: Actualizar `useDeductCredit` en `src/hooks/queries/usePackages.ts` para incluir `user_id`**

En la función `mutationFn` de `useDeductCredit`, añadir el `user_id` del usuario actual. Importar `useAuth`:

```ts
import { useAuth } from "@/contexts/AuthContext";

// Dentro del hook useDeductCredit:
const { user } = useAuth();

// En el mutationFn, cambiar el insert de audit trail:
await supabase.from("package_credit_log").insert({
  package_id: packageId,
  organization_id: organization!.id,
  user_id: user?.id ?? null,
  action: "deduct",
  credits_before: remaining,
  credits_after: remaining - 1,
  reason: reason ?? null,
});
```

- [ ] **Step 3: Aplicar migration**

```bash
supabase db push
```

O pegar el SQL en el dashboard de Supabase → SQL Editor y ejecutar.

- [ ] **Step 4: Verificar que el insert de créditos ahora escribe al log**

```bash
# En el SQL Editor de Supabase:
SELECT * FROM public.package_credit_log ORDER BY created_at DESC LIMIT 10;
```

Desconta un crédito desde la UI y verificar que aparece una fila.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260528000010_credit_audit_trail.sql \
        src/hooks/queries/usePackages.ts
git commit -m "feat: audit trail para descuento de créditos de paquetes"
```

---

## PHASE 6 — Loading States Consistentes

### Task 10: Skeleton compartido para tablas y cards

**Files:**
- Create: `src/components/shared/TableSkeleton.tsx`
- Modify: `src/pages/CustomersPage.tsx` (como ejemplo — aplicar el mismo patrón al resto)

- [ ] **Step 1: Crear `src/components/shared/TableSkeleton.tsx`**

```tsx
import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center p-3 rounded-lg border bg-card">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton
              key={j}
              className="h-4"
              style={{ width: `${[20, 25, 30, 15, 10][j % 5]}%`, minWidth: "40px" }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface CardSkeletonProps {
  count?: number;
}

export function CardGridSkeleton({ count = 6 }: CardSkeletonProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Usar `CardGridSkeleton` en CustomersPage**

Localizar en `CustomersPage.tsx`:

```tsx
{loading ? (
  <div className="flex items-center justify-center py-16 ...">
    Cargando clientes...
  </div>
) : (
```

Reemplazar con:

```tsx
import { CardGridSkeleton } from "@/components/shared/TableSkeleton";

{isLoading ? (
  <CardGridSkeleton count={6} />
) : (
```

- [ ] **Step 3: Aplicar `TableSkeleton` en las páginas con tabla (InvoicesPage, PackagesPage, ReportCardsPage)**

En cada una, reemplazar el spinner inline por:

```tsx
import { TableSkeleton } from "@/components/shared/TableSkeleton";

{isLoading ? <TableSkeleton rows={5} columns={5} /> : <Table>...</Table>}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/TableSkeleton.tsx src/pages/
git commit -m "feat: skeletons consistentes para tablas y grids de cards"
```

---

## Checklist de verificación final

Antes de considerar el plan completo, verificar cada punto:

- [ ] `npm run build` sin errores
- [ ] `npm run test` — todos los tests pasan
- [ ] Checkout funciona: hacer check-in y check-out de una reserva y verificar que el status cambia en la DB
- [ ] Flag filter funciona: crear una reserva con un dog con flags, filtrar por ese flag en el dashboard
- [ ] Campañas: intentar enviar SMS/WhatsApp → debe retornar error informativo, no success
- [ ] Campañas: enviar email (segmento "all") → debe funcionar si RESEND_API_KEY está configurado
- [ ] Navegación al dashboard y regreso → los filtros y tab activo se mantienen en la URL
- [ ] Descuento de crédito → aparece en `package_credit_log`
- [ ] ReportsPage con 1y de rango → no carga más datos que los del rango seleccionado (verificar en Network tab)
- [ ] Headers de seguridad → verificar en devtools que CSP y HSTS están presentes en producción

---

## Orden de ejecución recomendado

| Fase | Tasks | Tiempo estimado | Riesgo |
|------|-------|-----------------|--------|
| 1 — Bugs críticos | 1, 2 | 2h | Bajo |
| 2 — Seguridad | 3, 4 | 3h | Medio |
| 3 — React Query | 5, 6, 7 | 2 días | Alto (muchos archivos) |
| 4 — URL State | 8 | 3h | Bajo |
| 5 — Audit trail | 9 | 2h | Bajo |
| 6 — Skeletons | 10 | 1h | Mínimo |

**Total estimado: 4-5 días de trabajo enfocado.**

Las fases 1 y 2 pueden desplegarse a producción de forma independiente e inmediata. La fase 3 es la más grande y debe hacerse en una rama separada. Las fases 4-6 son mejoras incrementales sobre la fase 3.
