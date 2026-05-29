# Plan Maestro de Remediación — KennelStride

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development o superpowers:executing-plans. Cada *stream* (A–G) es un plan auto-contenido que produce software funcional y testeable por sí mismo. Los pasos usan checkbox (`- [ ]`).

**Goal:** Cerrar las vulnerabilidades de seguridad, los bugs de integridad de datos/dinero, las fallas de integración y la causa-raíz arquitectónica (lógica de negocio en el cliente) detectadas en la auditoría del 2026-05-29.

**Architecture:** Mover las operaciones de negocio críticas (descuento de créditos, creación de reservas, balance) de read-modify-write en el cliente a **RPCs transaccionales `SECURITY DEFINER`**; endurecer **RLS** para que sea consciente de rol y suscripción; hacer las integraciones (Resend, LemonSqueezy) idempotentes y resilientes; y blindar la auditoría e invitaciones.

**Tech Stack:** Vite + React 18 + TS, @tanstack/react-query v5, Supabase JS v2, Supabase Postgres + RLS + Edge Functions (Deno), Vitest + Testing Library, LemonSqueezy, Resend, Vercel.

---

## Fases

- **Fase 1 (paralela, ahora):** Streams **A, B, C, E, F, G** — independientes, cada uno dueño de archivos distintos.
- **Fase 2 (tras integrar Fase 1):** Stream **D** — refactor de RLS por rol + enforcement de suscripción. Es fundacional y depende de que A/B/E ya hayan introducido los RPCs de escritura, por eso va al final.

## Matriz de propiedad de archivos (CRÍTICA para merge sin conflictos)

| Stream | Archivos que puede escribir (exclusivo) | Migración nueva |
|---|---|---|
| **A** Créditos | `src/hooks/queries/usePackages.ts`, `src/components/checkin/CheckOutModal.tsx`, `tests/hooks/usePackages.test.ts` | `20260529010000_credit_deduct_rpc.sql` |
| **B** Reservas | `src/components/reservations/NewReservationModal.tsx`, `src/hooks/useReservations.ts`, `tests/hooks/useReservations.test.ts` | `20260529020000_reservation_booking.sql` |
| **C** Auth/tenancy | (solo SQL) `tests/sql/auth_tenancy.md` | `20260529030000_fix_invitation_and_idor.sql` |
| **E** Integraciones | `supabase/functions/send-campaign/index.ts`, `supabase/functions/handle-ls-webhook/index.ts`, `src/pages/BillingPage.tsx` | `20260529050000_webhook_idempotency.sql` |
| **F** Balance | `src/lib/validations.ts`, `tests/lib/balance.test.ts` | `20260529060000_customer_balance_trigger.sql` |
| **G** Hardening op | `src/pages/NoticesPage.tsx`, `vercel.json`, `.env.example` | `20260529070000_cron_and_grants.sql` |
| **D** (Fase 2) RLS+suscripción | (solo SQL) `tests/sql/rls_roles.md` | `20260530010000_role_based_rls.sql` |

## Contrato compartido (TODOS los agentes lo cumplen)

1. **Trabaja solo en tu worktree/branch.** No hagas merge a `main`. Deja el branch listo para revisión.
2. **Edita SOLO los archivos de tu fila** en la matriz + tu migración nueva. Si crees que necesitas tocar otro archivo, **DETENTE** y repórtalo en tu mensaje final en vez de hacerlo.
3. **NO edites `src/integrations/supabase/types.ts`** (es generado y requiere pull de la BD viva). Para RPCs nuevos llama con `supabase.rpc("nombre" as any, {...})` o un wrapper tipado local en tu propio archivo.
4. **Migraciones:** usa exactamente el nombre de archivo asignado en la matriz para evitar colisiones de timestamp.
5. **TDD:** primero el test que falla, luego la implementación. Para TS usa Vitest. Para lógica SQL pura (Streams C, D) no hay harness de pg en este repo — documenta las aserciones SQL de verificación en el `.md` indicado y deja la migración idempotente (`CREATE OR REPLACE`, `DROP POLICY IF EXISTS`).
6. **Antes de commitear:** `npm run lint` y `npx vitest run`. Si tocaste algo que afecta el build, `npm run build`.
7. **Commits pequeños** y descriptivos en tu branch.
8. **Reporta al final:** qué cambiaste, archivos tocados, resultado de tests, y cualquier preocupación cross-stream.

---

## STREAM A — Integridad de créditos (C1, C5, parte de H5)

**Problema:** `useDeductCredit` (`usePackages.ts:64`) y `CheckOutModal.tsx:133` hacen read-modify-write en cliente → lost update, créditos negativos, log de auditoría desacoplado y falsificable.

**Files:** ver matriz, fila A.

- [ ] **A1. Migración `20260529010000_credit_deduct_rpc.sql`** — RPC transaccional + blindar el log:

```sql
CREATE OR REPLACE FUNCTION public.deduct_package_credit(p_package_id uuid, p_reason text DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before int; v_after int; v_org uuid;
BEGIN
  UPDATE public.packages
    SET remaining_credits = remaining_credits - 1,
        status = CASE WHEN remaining_credits - 1 = 0 THEN 'depleted' ELSE status END,
        updated_at = now()
  WHERE id = p_package_id
    AND organization_id IN (SELECT public.get_user_org_ids())
    AND remaining_credits > 0
  RETURNING (remaining_credits + 1), remaining_credits, organization_id
  INTO v_before, v_after, v_org;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sin créditos disponibles o paquete inválido';
  END IF;

  INSERT INTO public.package_credit_log
    (package_id, organization_id, user_id, action, credits_before, credits_after, reason)
  VALUES (p_package_id, v_org, auth.uid(), 'deduct', v_before, v_after, p_reason);

  RETURN v_after;
END $$;

GRANT EXECUTE ON FUNCTION public.deduct_package_credit(uuid, text) TO authenticated;

-- C5: el log deja de ser escribible directamente por el cliente
DROP POLICY IF EXISTS "Authenticated can insert credit log" ON public.package_credit_log;
REVOKE INSERT ON public.package_credit_log FROM authenticated, anon;
```

- [ ] **A2.** Reescribir `useDeductCredit` para llamar al RPC y eliminar el insert manual del log:

```ts
mutationFn: async ({ packageId, reason }: { packageId: string; reason?: string }) => {
  const { error } = await supabase.rpc("deduct_package_credit" as any, {
    p_package_id: packageId, p_reason: reason ?? null,
  });
  if (error) throw error;
},
```
(Actualiza también la firma: ya no recibe `remaining`.)

- [ ] **A3.** En `CheckOutModal.tsx`, el bloque `paymentMethod === "package"` debe llamar al mismo RPC en vez del `update` manual de `remaining_credits`. Mostrar toast de error si el RPC falla (p.ej. créditos agotados por carrera).
- [ ] **A4. Tests:** `useDeductCredit` llama a `rpc("deduct_package_credit", ...)` y NO a `.from("packages").update`; propaga error en la ruta de fallo.
- [ ] **A5.** Lint + tests + commit.

**Aceptación:** ningún path de UI escribe `remaining_credits` directamente; descuento atómico con piso en 0; log escrito solo por el RPC.

---

## STREAM B — Reservas: doble-booking + atomicidad (H2, parte de H5)

**Problema:** no existe verificación de solapamiento ni capacidad; `NewReservationModal.tsx:142` inserta sin chequear; reserva + notice no son atómicos.

**Files:** ver matriz, fila B.

- [ ] **B1. Migración `20260529020000_reservation_booking.sql`** — RPC de creación con chequeo de solapamiento (mismo perro) y notice en una transacción:

```sql
CREATE OR REPLACE FUNCTION public.create_reservation(
  p_customer_id uuid, p_dog_id uuid, p_service_type text, p_service_name text,
  p_start timestamptz, p_end timestamptz, p_total_price numeric,
  p_notes text DEFAULT '', p_staff_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_res_id uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.customers
   WHERE id = p_customer_id AND organization_id IN (SELECT public.get_user_org_ids());
  IF v_org IS NULL THEN RAISE EXCEPTION 'Cliente inválido'; END IF;
  IF p_end <= p_start THEN RAISE EXCEPTION 'La fecha de fin debe ser posterior al inicio'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.dog_id = p_dog_id
      AND r.status NOT IN ('cancelled','completed','rejected')
      AND tstzrange(r.start_date, r.end_date, '[)') && tstzrange(p_start, p_end, '[)')
  ) THEN
    RAISE EXCEPTION 'El perro ya tiene una reserva que se solapa en ese horario';
  END IF;

  INSERT INTO public.reservations
    (customer_id, dog_id, service_type, service_name, start_date, end_date,
     total_price, notes, status, organization_id, staff_id)
  VALUES (p_customer_id, p_dog_id, p_service_type, p_service_name, p_start, p_end,
     p_total_price, p_notes, 'requested', v_org, p_staff_id)
  RETURNING id INTO v_res_id;

  INSERT INTO public.notices (title, message, severity, entity_type, entity_id, auto_generated, organization_id)
  VALUES ('Nueva solicitud de reserva',
    'Solicitud de ' || p_service_name, 'info', 'reservation', v_res_id::text, true, v_org);

  RETURN v_res_id;
END $$;

GRANT EXECUTE ON FUNCTION public.create_reservation(uuid,uuid,text,text,timestamptz,timestamptz,numeric,text,uuid) TO authenticated;
```

- [ ] **B2.** `NewReservationModal.handleSave` → llamar `supabase.rpc("create_reservation", {...})`; eliminar el insert directo + el insert de notice; manejar el error de solapamiento con toast.
- [ ] **B3. Tests:** mock que verifica llamada al RPC; ruta de error de solapamiento.
- [ ] **B4.** Lint + tests + commit.

**Aceptación:** crear dos reservas solapadas para el mismo perro falla; reserva+notice atómicos.

---

## STREAM C — Seguridad auth/tenancy (C2, M2)

**Problema:** `accept_invitation` no valida que el email del invite coincida con el del usuario (escalada a admin de otra org). `get_inactive_customer_ids` no verifica pertenencia a `p_organization_id` (IDOR).

**Files:** ver matriz, fila C.

- [ ] **C1. Migración `20260529030000_fix_invitation_and_idor.sql`** — re-crear `accept_invitation` (preservando el linking de staff de `20260505000946`) añadiendo el chequeo de email justo después del `IF NOT FOUND`:

```sql
IF lower(v_invite.email) <> lower((SELECT email FROM auth.users WHERE id = v_user_id)) THEN
  RAISE EXCEPTION 'Esta invitación es para otro correo electrónico';
END IF;
```

- [ ] **C2.** En la misma migración, re-crear `get_inactive_customer_ids` con guard de pertenencia en el `WHERE`:

```sql
WHERE c.organization_id = p_organization_id
  AND p_organization_id IN (SELECT public.get_user_org_ids())
  AND NOT EXISTS ( ... )  -- resto igual
```
(Mantener `GRANT ... TO authenticated, service_role`; `service_role` no pasa por `get_user_org_ids`, así que para la edge function añadir un branch: si `auth.uid()` es NULL — service_role — omitir el guard. Implementación: usar `(p_organization_id IN (SELECT public.get_user_org_ids()) OR auth.uid() IS NULL)`.)

- [ ] **C3.** Documentar en `tests/sql/auth_tenancy.md` las aserciones: (a) aceptar invite con email distinto → excepción; (b) llamar `get_inactive_customer_ids` con org ajena como usuario normal → 0 filas.
- [ ] **C4.** Commit.

**Aceptación:** invitación solo aceptable por el email destinatario; RPC de inactivos no filtra datos cross-tenant a usuarios.

---

## STREAM E — Integraciones: Resend + LemonSqueezy (H1, H4, M4)

**Problema:** `send-campaign` sin idempotencia (doble envío) y secuencial (timeout en listas grandes); webhook ignora errores de `.update()` y no enlaza la suscripción porque el checkout nunca setea `custom_data.org_id`; `BillingPage` es placeholder.

**Files:** ver matriz, fila E.

- [ ] **E1.** `send-campaign`: tras cargar la campaña, si `campaign.status === 'sent'` → responder 409 "ya enviada". Antes del envío, marcar `status='sending'` con update condicional (`.eq("status", campaign.status)`) como lock optimista; si no actualiza fila, abortar.
- [ ] **E2.** Enviar en lotes con concurrencia limitada (pool de ~5) en vez de secuencial; contar 429 de Resend como `failed` y registrar. Añadir header `List-Unsubscribe` (mailto) en cada email para cumplimiento.
- [ ] **E3.** `handle-ls-webhook`: chequear el `error` de cada `.update()` y loguear; en `subscription_created` loguear claramente si `custom_data.org_id` viene vacío. Crear tabla de idempotencia:

```sql
-- 20260529050000_webhook_idempotency.sql
CREATE TABLE IF NOT EXISTS public.processed_webhooks (
  event_id text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.processed_webhooks ENABLE ROW LEVEL SECURITY;
-- sin políticas: solo service_role (edge function) accede
```
y en el handler: insertar `event_id` (de `payload.meta` o un hash del body) con `ON CONFLICT DO NOTHING`; si ya existía, responder 200 sin reprocesar.

- [ ] **E4.** `BillingPage`: construir URLs reales de checkout LemonSqueezy inyectando `custom_data` con el `org_id` del `OrganizationContext`, p.ej. `?checkout[custom][org_id]=<orgId>`. Tomar la URL base de plan desde una env var documentada (`VITE_LS_CHECKOUT_URL_*`) y, si no está configurada, mostrar un estado "billing no configurado" en vez del link placeholder.
- [ ] **E5.** Verificación: documentar prueba manual (curl al webhook con firma válida y `event_id` repetido → segundo request no reprocesa). Lint donde aplique. Commit.

**Aceptación:** reenviar una campaña no duplica emails; webhook idempotente y con errores logueados; checkout transporta `org_id`.

---

## STREAM F — Balance / cuentas por cobrar (H3)

**Problema:** `customers.balance` es columna estática nunca actualizada; `validations.ts:201` bloquea operaciones según un valor irreal.

**Files:** ver matriz, fila F. **Mantén la columna `customers.balance`** (no cambies el shape, para no tocar `types.ts`).

- [ ] **F1. Migración `20260529060000_customer_balance_trigger.sql`** — función + triggers que recalculan `balance` del cliente como `-(suma de totales de facturas impagas)` (negativo = debe) ante INSERT/UPDATE/DELETE en `invoices`:

```sql
CREATE OR REPLACE FUNCTION public.recompute_customer_balance(p_customer_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.customers c
  SET balance = COALESCE((
    SELECT -SUM(i.total) FROM public.invoices i
    WHERE i.customer_id = p_customer_id AND i.status IN ('pending','overdue')
  ), 0)
  WHERE c.id = p_customer_id;
$$;

CREATE OR REPLACE FUNCTION public.trg_invoice_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN PERFORM public.recompute_customer_balance(OLD.customer_id); RETURN OLD; END IF;
  PERFORM public.recompute_customer_balance(NEW.customer_id);
  IF (TG_OP = 'UPDATE' AND OLD.customer_id <> NEW.customer_id) THEN
    PERFORM public.recompute_customer_balance(OLD.customer_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS invoice_balance_trg ON public.invoices;
CREATE TRIGGER invoice_balance_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.trg_invoice_balance();

-- backfill inicial
UPDATE public.customers c SET balance = COALESCE((
  SELECT -SUM(i.total) FROM public.invoices i
  WHERE i.customer_id = c.id AND i.status IN ('pending','overdue')), 0);
```

- [ ] **F2.** Revisar `validations.ts`: confirmar que los umbrales (`BALANCE_BLOCK_THRESHOLD`, etc.) son coherentes con la convención negativo=debe. Ajustar comentarios/constantes si hace falta. Añadir test `tests/lib/balance.test.ts` que cubra la regla de bloqueo con balances representativos.
- [ ] **F3.** Lint + tests + commit.

**Aceptación:** crear factura pendiente baja el balance; pagarla lo restaura; el bloqueo por deuda usa datos reales.

---

## STREAM G — Hardening operacional (M1, M3, M6)

**Files:** ver matriz, fila G.

- [ ] **G1. Migración `20260529070000_cron_and_grants.sql`** — quitar el `EXECUTE` cliente de los "crons" y dejarlos para service_role/pg_cron:

```sql
REVOKE EXECUTE ON FUNCTION public.check_expiring_packages() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.check_overdue_invoices() FROM authenticated;
-- Si la extensión pg_cron está disponible, programar versiones service-role
-- (documentar; en Supabase: select cron.schedule(...)). Si no, dejar comentado.
```

- [ ] **G2.** `NoticesPage.handleRefresh`: eliminar las dos llamadas `supabase.rpc("check_*")`; dejar solo `invalidateQueries`. (Los avisos se generan vía cron/proceso server-side.)
- [ ] **G3.** `vercel.json`: endurecer CSP — quitar `'unsafe-eval'` del `script-src` (Vite en prod no lo necesita) y, si el build lo permite, también `'unsafe-inline'`. Verificar con `npm run build` + carga local. Documentar cualquier residual necesario.
- [ ] **G4.** `.env.example`: unificar branding (KennelStride) y alinear `ALLOWED_ORIGIN` con el dominio real de producción; añadir nota sobre `VITE_LS_CHECKOUT_URL_*` (coordinado con Stream E, solo documentación en este archivo).
- [ ] **G5.** Build + commit.

**Aceptación:** los crons no son disparables por el cliente; CSP sin `unsafe-eval`; config coherente.

---

## STREAM D — RLS por rol + enforcement de suscripción (C3, C4) · **Fase 2**

**Problema (causa-raíz):** todas las políticas son `FOR ALL TO authenticated USING (membership)`; los roles solo viven en la UI; la suscripción no se valida en BD. Cualquier miembro puede escribir lo que sea vía API.

**Files:** ver matriz, fila D. Ejecutar **después** de integrar Fase 1 (A/B/E introducen los RPCs que canalizan las escrituras sensibles).

- [ ] **D1. Migración `20260530010000_role_based_rls.sql`** — helper de membresía activa por suscripción:

```sql
CREATE OR REPLACE FUNCTION public.get_active_org_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT om.organization_id
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.user_id = auth.uid()
    AND (o.subscription_status = 'active'
         OR (o.subscription_status = 'trialing' AND o.trial_ends_at > now()));
$$;
```

- [ ] **D2.** Para tablas financieras sensibles (`packages`, `invoices`, `invoice_items`), separar políticas: `SELECT` para cualquier miembro de org activa; `INSERT/UPDATE/DELETE` solo para `admin`/`manager` (`has_role`), o canalizadas por RPC. Mantener escritura de `reservations`/operativas para staff. Reemplazar `get_user_org_ids()` por `get_active_org_ids()` en las políticas de escritura para cortar el uso tras vencer la suscripción (dejar lectura con `get_user_org_ids()` para que puedan ver/exportar sus datos y reactivar).
- [ ] **D3.** Documentar aserciones en `tests/sql/rls_roles.md`: (a) staff no puede UPDATE `packages.price`; (b) org con trial vencido no puede INSERT; (c) admin sí.
- [ ] **D4.** Commit. Revisar que A/B/E sigan funcionando (sus RPCs son `SECURITY DEFINER`, así que bypassean RLS — OK).

**Aceptación:** roles efectivos en BD; suscripción vencida bloquea escritura a nivel servidor.

---

## Self-review (cobertura del análisis → tarea)

C1→A · C2→C · C3→D · C4→D · C5→A · H1→E · H2→B · H3→F · H4→E · H5→A/B · M1→G · M2→C · M3→G · M4→E · M5→(tests en cada stream) · M6→G. Sin huecos.
