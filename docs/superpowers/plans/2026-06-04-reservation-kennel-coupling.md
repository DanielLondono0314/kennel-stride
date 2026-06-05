# Acople Reserva ⇆ Perrera — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que al hacer check-in de una reserva aprobada el staff elija (o cree) una perrera libre, ocupándola por la estadía y ligándola a la reserva de forma atómica, y que el check-out la libere.

**Architecture:** Enfoque A del spec. Un único cambio de esquema (`facility_units.assigned_reservation_id`) + dos RPCs transaccionales `SECURITY DEFINER` (`check_in_reservation`, `check_out_reservation`) que concentran toda la lógica crítica en Postgres. El `CheckInModal` existente gana un selector de perrera con creación inline; `useReservations.checkIn/checkOut` pasan a llamar los RPCs.

**Tech Stack:** Supabase/Postgres (plpgsql, RLS, RPC), React + TypeScript, vitest + @testing-library/react, sonner (toasts).

**Spec:** `docs/superpowers/specs/2026-06-04-reservation-kennel-coupling-design.md`

---

## File Structure

- **Create** `supabase/migrations/20260604000000_reservation_kennel_coupling.sql` — columna nueva + dos RPCs + grants.
- **Create** `tests/sql/reservation_kennel_coupling.md` — aserciones SQL manuales (no hay harness de Postgres; mismo patrón que `tests/sql/reservations.md`).
- **Modify** `src/types/index.ts:410-416` — `CheckInData` gana `unitId`.
- **Modify** `src/hooks/useReservations.ts:206-207` — `checkIn`/`checkOut` llaman los RPCs.
- **Create** `tests/hooks/useReservations.test.ts` — verifica que los RPCs se llaman con los args correctos.
- **Modify** `src/components/checkin/CheckInModal.tsx` — selector de perrera + crear inline; bloquea "Confirmar" sin perrera.
- **Create** `tests/components/CheckInModal.test.tsx` — "Confirmar" deshabilitado sin perrera.
- **Modify** `src/pages/Dashboard.tsx:133-147` — pasa `unitId` a `checkIn`.

> **Nota de TDD para SQL:** el repo no tiene harness de Postgres (vitest corre en jsdom). Para los RPCs, el "test" es el documento de aserciones en `tests/sql/` que se ejecuta manualmente con `supabase db reset` + psql. Lo escribimos ANTES de la migración (Task 1) para fijar el contrato; la verificación es manual.

---

## Task 1: Migración — columna + RPCs de check-in/check-out

**Files:**
- Create: `tests/sql/reservation_kennel_coupling.md`
- Create: `supabase/migrations/20260604000000_reservation_kennel_coupling.sql`

- [ ] **Step 1: Escribir el documento de aserciones SQL (el "test" del contrato)**

Crear `tests/sql/reservation_kennel_coupling.md`:

```markdown
# Verificación SQL — Acople Reserva ⇆ Perrera (check_in / check_out)

> No hay harness de Postgres en el repo (vitest corre en jsdom). Estas son las
> aserciones a ejecutar contra una BD local (`supabase db reset`) o en CI con
> pgTAP.

Migración: `supabase/migrations/20260604000000_reservation_kennel_coupling.sql`
Funciones: `public.check_in_reservation(uuid,uuid,text)`, `public.check_out_reservation(uuid)`

## Fixtures
- Org `O1`; usuario `U1` miembro de `O1` (`request.jwt.claim.sub = U1`).
- Cliente `C1`, perro `D1` en `O1`. Perrera `K1` (`facility_units`, status `available`, org `O1`).
- Reserva `R1` de `D1`/`C1` en `O1`, status `scheduled`, start/end definidos.
- Org ajena `O2` con reserva `R2` (`scheduled`) y perrera `K2`.

## Aserciones — check_in_reservation

1. **Happy path:** `SELECT check_in_reservation(R1, K1, 'sin novedad');`
   → `K1.status='occupied'`, `K1.assigned_dog_id=D1`, `K1.assignment_start/end` = `R1.start_date/end_date`,
     `K1.assigned_reservation_id=R1`; `R1.status='checked_in'`, `R1.check_in_time` no nulo,
     `R1.location_id=K1`; existe 1 `notices` con `entity_id=R1`.
2. **Perrera ya ocupada:** repetir con `K1` ya `occupied` (o pasarla a otra reserva)
   → `RAISE EXCEPTION 'Esa perrera no está disponible, elige otra'`. Sin cambios.
3. **Reserva no aprobada:** con `R1.status='requested'`, `check_in_reservation(R1, K1, '')`
   → `RAISE EXCEPTION 'Reserva inválida, fuera de tu organización o no está aprobada'`.
4. **Tenancy reserva ajena:** con `sub=U1`, `check_in_reservation(R2, K1, '')`
   → misma excepción de reserva inválida (no es de O1).
5. **Tenancy perrera ajena:** `check_in_reservation(R1, K2, '')`
   → `RAISE EXCEPTION 'Esa perrera no está disponible, elige otra'` (K2 no es de O1).

## Aserciones — check_out_reservation

6. **Happy path:** tras (1), `SELECT check_out_reservation(R1);`
   → `K1.status='available'` y todos los campos `assigned_*`/`assignment_*` en NULL;
     `R1.status='completed'`, `R1.check_out_time` no nulo; existe `notices` de salida.
7. **Idempotente / perrera ya liberada:** liberar `K1` manualmente, luego `check_out_reservation(R1)`
   → no falla; `R1.status='completed'`.
8. **Estado inválido:** `check_out_reservation(R1)` con `R1.status='requested'`
   → `RAISE EXCEPTION 'Reserva inválida, fuera de tu organización o no está en curso'`.
9. **Tenancy:** `check_out_reservation(R2)` con `sub=U1` → misma excepción de reserva inválida.

## Concurrencia (manual, dos sesiones psql)
10. Dos `check_in_reservation(_, K1, _)` simultáneos sobre `K1` disponible:
    el `FOR UPDATE` serializa; uno ocupa, el otro recibe la excepción de "no disponible".
```

- [ ] **Step 2: Commit del documento de aserciones**

```bash
git add tests/sql/reservation_kennel_coupling.md
git commit -m "test(sql): aserciones de check_in/check_out_reservation (perrera ⇆ reserva)"
```

- [ ] **Step 3: Escribir la migración (columna + RPCs)**

Crear `supabase/migrations/20260604000000_reservation_kennel_coupling.sql`:

```sql
-- ============================================================
-- Acople Reserva ⇆ Perrera (Enfoque A)
-- 1) facility_units.assigned_reservation_id liga perrera ⇆ reserva.
-- 2) check_in_reservation(): ocupa perrera disponible + liga reserva, atómico.
-- 3) check_out_reservation(): libera la perrera ligada + completa la reserva.
-- ============================================================

-- 1. Columna de enlace (FK a reservations; al borrar reserva, se desliga).
ALTER TABLE public.facility_units
  ADD COLUMN IF NOT EXISTS assigned_reservation_id uuid
  REFERENCES public.reservations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_facility_units_assigned_reservation
  ON public.facility_units(assigned_reservation_id);

-- 2. CHECK-IN transaccional.
CREATE OR REPLACE FUNCTION public.check_in_reservation(
  p_reservation_id uuid,
  p_unit_id        uuid,
  p_notes          text DEFAULT ''
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org      uuid;
  v_dog_id   uuid;
  v_dog_name text;
  v_start    timestamptz;
  v_end      timestamptz;
BEGIN
  -- a. Reserva válida, de una org del usuario, aprobada (scheduled).
  SELECT r.organization_id, r.dog_id, r.start_date, r.end_date
    INTO v_org, v_dog_id, v_start, v_end
  FROM public.reservations r
  WHERE r.id = p_reservation_id
    AND r.organization_id IN (SELECT public.get_user_org_ids())
    AND r.status = 'scheduled';
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Reserva inválida, fuera de tu organización o no está aprobada';
  END IF;

  SELECT d.name INTO v_dog_name FROM public.dogs d WHERE d.id = v_dog_id;

  -- b. Perrera de la misma org y disponible AHORA. FOR UPDATE serializa
  --    check-ins concurrentes sobre la misma perrera (anti doble-booking).
  PERFORM 1 FROM public.facility_units u
   WHERE u.id = p_unit_id
     AND u.organization_id = v_org
     AND u.status = 'available'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa perrera no está disponible, elige otra';
  END IF;

  -- c. Ocupar la perrera por la estadía completa.
  UPDATE public.facility_units
     SET status = 'occupied',
         assigned_dog_id = v_dog_id::text,
         assigned_dog_name = v_dog_name,
         assignment_start = v_start,
         assignment_end = v_end,
         assigned_reservation_id = p_reservation_id,
         updated_at = now()
   WHERE id = p_unit_id;

  -- d. Avanzar la reserva y ligar la ubicación.
  UPDATE public.reservations
     SET status = 'checked_in',
         check_in_time = now(),
         location_id = p_unit_id,
         notes = CASE WHEN COALESCE(p_notes, '') <> ''
                      THEN COALESCE(notes, '') || E'\n[Check-in]: ' || p_notes
                      ELSE notes END,
         updated_at = now()
   WHERE id = p_reservation_id;

  -- e. Notice de entrada (consistente con create_reservation).
  INSERT INTO public.notices
    (title, message, severity, entity_type, entity_id, auto_generated, organization_id)
  VALUES
    ('Check-in registrado',
     COALESCE(v_dog_name, 'El perro') || ' ingresó al centro.',
     'info', 'reservation', p_reservation_id::text, true, v_org);
END $$;

GRANT EXECUTE ON FUNCTION public.check_in_reservation(uuid,uuid,text) TO authenticated;

-- 3. CHECK-OUT transaccional (idempotente en la liberación de perrera).
CREATE OR REPLACE FUNCTION public.check_out_reservation(
  p_reservation_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT r.organization_id INTO v_org
  FROM public.reservations r
  WHERE r.id = p_reservation_id
    AND r.organization_id IN (SELECT public.get_user_org_ids())
    AND r.status IN ('checked_in', 'in_progress', 'ready');
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Reserva inválida, fuera de tu organización o no está en curso';
  END IF;

  -- Liberar SOLO la perrera ligada a esta reserva. Si ya fue liberada
  -- manualmente, el UPDATE no afecta filas y no falla (idempotente).
  UPDATE public.facility_units
     SET status = 'available',
         assigned_dog_id = NULL,
         assigned_dog_name = NULL,
         assignment_start = NULL,
         assignment_end = NULL,
         assigned_reservation_id = NULL,
         updated_at = now()
   WHERE assigned_reservation_id = p_reservation_id;

  UPDATE public.reservations
     SET status = 'completed',
         check_out_time = now(),
         updated_at = now()
   WHERE id = p_reservation_id;

  INSERT INTO public.notices
    (title, message, severity, entity_type, entity_id, auto_generated, organization_id)
  VALUES
    ('Check-out registrado',
     'La estadía se completó y la perrera quedó libre.',
     'info', 'reservation', p_reservation_id::text, true, v_org);
END $$;

GRANT EXECUTE ON FUNCTION public.check_out_reservation(uuid) TO authenticated;
```

- [ ] **Step 4: Verificar que la migración aplica limpio**

Run: `supabase db reset` (BD local)
Expected: aplica sin error; `\d public.facility_units` muestra la columna `assigned_reservation_id`; `\df public.check_in_reservation` y `\df public.check_out_reservation` existen.

> Si no hay Supabase local disponible, validar al menos la sintaxis: `psql -f supabase/migrations/20260604000000_reservation_kennel_coupling.sql` contra una BD de prueba, o revisar con `pg_format`/lint. Documentar en el commit que la verificación funcional es manual vía `tests/sql/reservation_kennel_coupling.md`.

- [ ] **Step 5: Ejecutar (manualmente) las aserciones del documento SQL**

Run: cargar fixtures de `tests/sql/reservation_kennel_coupling.md` y ejecutar las aserciones 1–10.
Expected: todas pasan (happy paths cambian estado como se describe; los casos de error lanzan las excepciones exactas).

- [ ] **Step 6: Commit de la migración**

```bash
git add supabase/migrations/20260604000000_reservation_kennel_coupling.sql
git commit -m "feat(db): RPCs check_in/check_out_reservation + facility_units.assigned_reservation_id"
```

---

## Task 2: Tipos + hook useReservations → RPCs

**Files:**
- Modify: `src/types/index.ts:410-416`
- Modify: `src/hooks/useReservations.ts:206-207`
- Test: `tests/hooks/useReservations.test.ts`

- [ ] **Step 1: Escribir el test del hook (falla primero)**

Crear `tests/hooks/useReservations.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const rpcMock = vi.fn();

// Canal realtime no-op para que el efecto de suscripción no rompa el render.
const channelStub = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    channel: vi.fn(() => channelStub),
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: () => ({ organization: { id: "org-123" } }),
}));

describe("useReservations check-in / check-out", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("checkIn llama al RPC check_in_reservation con reserva, perrera y notas", async () => {
    rpcMock.mockResolvedValue({ error: null });
    const { useReservations } = await import("@/hooks/useReservations");
    const { result } = renderHook(() => useReservations());

    await result.current.checkIn("res-1", "unit-9", "ok");

    expect(rpcMock).toHaveBeenCalledWith("check_in_reservation", {
      p_reservation_id: "res-1",
      p_unit_id: "unit-9",
      p_notes: "ok",
    });
  });

  it("checkIn envía p_notes vacío cuando no se pasan notas", async () => {
    rpcMock.mockResolvedValue({ error: null });
    const { useReservations } = await import("@/hooks/useReservations");
    const { result } = renderHook(() => useReservations());

    await result.current.checkIn("res-1", "unit-9");

    expect(rpcMock).toHaveBeenCalledWith("check_in_reservation", {
      p_reservation_id: "res-1",
      p_unit_id: "unit-9",
      p_notes: "",
    });
  });

  it("checkOut llama al RPC check_out_reservation con la reserva", async () => {
    rpcMock.mockResolvedValue({ error: null });
    const { useReservations } = await import("@/hooks/useReservations");
    const { result } = renderHook(() => useReservations());

    await result.current.checkOut("res-1");

    expect(rpcMock).toHaveBeenCalledWith("check_out_reservation", {
      p_reservation_id: "res-1",
    });
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/hooks/useReservations.test.ts`
Expected: FAIL — `checkIn` actual no acepta `unitId` y llama a `.from('reservations').update(...)`, no a `rpc`. El `expect(rpcMock).toHaveBeenCalledWith(...)` no se cumple.

- [ ] **Step 3: Actualizar el tipo CheckInData**

En `src/types/index.ts`, modificar la interfaz (líneas 410-416):

```ts
export interface CheckInData {
  reservationId: string;
  unitId: string;
  notes?: string;
  overrideAlerts: string[];
  overrideReason?: string;
  overrideBy?: string;
}
```

- [ ] **Step 4: Reescribir checkIn/checkOut en el hook**

En `src/hooks/useReservations.ts`, reemplazar las dos líneas actuales (206-207):

```ts
  const checkIn  = (id: string) => updateStatus(id, ReservationStatus.CHECKED_IN, { check_in_time: new Date().toISOString() });
  const checkOut = (id: string) => updateStatus(id, ReservationStatus.COMPLETED, { check_out_time: new Date().toISOString() });
```

por:

```ts
  // Check-in transaccional: ocupa la perrera y liga la reserva en un solo RPC.
  const checkIn = async (id: string, unitId: string, notes?: string) => {
    const { error } = await supabase.rpc("check_in_reservation" as any, {
      p_reservation_id: id,
      p_unit_id: unitId,
      p_notes: notes ?? "",
    });
    if (!error) fetch();
    return { error };
  };

  // Check-out transaccional: libera la perrera ligada y completa la reserva.
  const checkOut = async (id: string) => {
    const { error } = await supabase.rpc("check_out_reservation" as any, {
      p_reservation_id: id,
    });
    if (!error) fetch();
    return { error };
  };
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npx vitest run tests/hooks/useReservations.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/hooks/useReservations.ts tests/hooks/useReservations.test.ts
git commit -m "feat(reservas): checkIn/checkOut usan RPCs transaccionales + unitId en CheckInData"
```

---

## Task 3: CheckInModal — selector de perrera + creación inline

**Files:**
- Modify: `src/components/checkin/CheckInModal.tsx`
- Test: `tests/components/CheckInModal.test.tsx`

- [ ] **Step 1: Escribir el test del modal (falla primero)**

Crear `tests/components/CheckInModal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CheckInModal } from "@/components/checkin/CheckInModal";

// Sin perreras disponibles → el selector queda vacío y Confirmar deshabilitado.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

vi.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: () => ({ organization: { id: "org-123" } }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));

// Validación sin alertas bloqueantes para aislar la regla de la perrera.
vi.mock("@/lib/validations", () => ({
  validateCheckIn: () => ({ isValid: true, canOverride: false, alerts: [] }),
}));

const reservation: any = {
  id: "res-1",
  startDate: new Date("2026-06-10T09:00:00Z"),
  endDate: new Date("2026-06-10T17:00:00Z"),
  status: "scheduled",
  dog: { name: "Max", breed: "Labrador" },
  customer: { firstName: "María", lastName: "G", phone: "555" },
  service: { name: "Guardería" },
};

describe("CheckInModal — regla de perrera", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deshabilita 'Confirmar Check-in' cuando no hay perrera elegida", async () => {
    render(
      <CheckInModal
        reservation={reservation}
        open={true}
        onOpenChange={() => {}}
        onConfirm={() => {}}
      />
    );
    const confirm = await screen.findByRole("button", { name: /confirmar check-in/i });
    expect(confirm).toBeDisabled();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/components/CheckInModal.test.tsx`
Expected: FAIL — hoy "Confirmar Check-in" se habilita por validación (`canProceed`) sin requerir perrera; el botón NO está deshabilitado.

- [ ] **Step 3: Añadir estado + carga de perreras + creación inline al modal**

En `src/components/checkin/CheckInModal.tsx`:

3a. Añadir imports (junto a los existentes):

```tsx
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
```

> `useState`, `useMemo`, `Label`, `Button`, `Textarea` ya están importados. `useEffect` se añade al import de React existente si no está.

3b. Tipos locales y estado (dentro del componente, junto a los `useState` actuales):

```tsx
  const { organization } = useOrganization();

  type FreeUnit = { id: string; name: string };
  type Zone = { id: string; name: string };

  const [units, setUnits] = useState<FreeUnit[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [unitId, setUnitId] = useState("");
  const [creatingUnit, setCreatingUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");
  const [newUnitZoneId, setNewUnitZoneId] = useState("");
```

3c. Cargar perreras disponibles + zonas al abrir, y resetear:

```tsx
  useEffect(() => {
    if (!open || !organization) return;
    setUnitId("");
    setCreatingUnit(false);
    setNewUnitName("");
    Promise.all([
      supabase
        .from("facility_units")
        .select("id, name")
        .eq("organization_id", organization.id)
        .eq("status", "available")
        .order("name"),
      supabase
        .from("facility_zones")
        .select("id, name")
        .eq("organization_id", organization.id)
        .order("name"),
    ]).then(([unitsRes, zonesRes]) => {
      setUnits(unitsRes.data ?? []);
      setZones(zonesRes.data ?? []);
      setNewUnitZoneId(zonesRes.data?.[0]?.id ?? "");
    });
  }, [open, organization?.id]);

  const handleCreateUnit = async () => {
    if (!organization || !newUnitName.trim() || !newUnitZoneId) return;
    const { data, error } = await supabase
      .from("facility_units")
      .insert({
        organization_id: organization.id,
        zone_id: newUnitZoneId,
        name: newUnitName.trim(),
        unit_type: "kennel",
        status: "available",
      })
      .select("id, name")
      .single();
    if (error || !data) return;
    setUnits((prev) => [...prev, data]);
    setUnitId(data.id);
    setCreatingUnit(false);
    setNewUnitName("");
  };
```

- [ ] **Step 4: Añadir la UI del selector y bloquear Confirmar sin perrera**

4a. Reemplazar el bloque "Ubicación" de solo lectura (el `<div>` que renderiza `location?.name || "Sin asignar"`, dentro del grid de "Service Info") por un selector de perrera. Insertar esta sección justo después del grid de "Service Info" (antes del `<Separator />` de validaciones):

```tsx
          {/* Perrera (obligatoria para check-in) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Perrera *
            </Label>

            {!creatingUnit ? (
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger>
                  <SelectValue placeholder={
                    units.length ? "Elegir perrera libre…" : "No hay perreras libres"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-2 rounded-lg border p-3">
                <Input
                  placeholder="Nombre de la perrera (ej. A-4)"
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                />
                <Select value={newUnitZoneId} onValueChange={setNewUnitZoneId}>
                  <SelectTrigger><SelectValue placeholder="Zona" /></SelectTrigger>
                  <SelectContent>
                    {zones.map((z) => (
                      <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={handleCreateUnit}
                    disabled={!newUnitName.trim() || !newUnitZoneId}>
                    Crear y usar
                  </Button>
                  <Button type="button" size="sm" variant="ghost"
                    onClick={() => setCreatingUnit(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {!creatingUnit && (
              <Button type="button" variant="ghost" size="sm"
                className="h-auto p-0 text-xs text-primary"
                onClick={() => setCreatingUnit(true)}>
                <Plus className="h-3 w-3 mr-1" /> Crear perrera nueva…
              </Button>
            )}
          </div>
```

4b. Bloquear Confirmar sin perrera. Cambiar la línea de `canProceed`:

```tsx
  const canProceed = validation?.isValid || (validation?.canOverride && allBlockingOverridden && overrideReason.length > 0);
```

por:

```tsx
  const validationOk = validation?.isValid || (validation?.canOverride && allBlockingOverridden && overrideReason.length > 0);
  const canProceed = validationOk && !!unitId && !creatingUnit;
```

4c. Pasar `unitId` en `onConfirm`. En `handleConfirm`, añadir `unitId` al objeto:

```tsx
    onConfirm({
      reservationId: reservation.id,
      unitId,
      notes: notes || undefined,
      overrideAlerts: Array.from(selectedOverrides),
      overrideReason: overrideReason || undefined,
      overrideBy: user?.id,
    });
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npx vitest run tests/components/CheckInModal.test.tsx`
Expected: PASS — sin perreras y sin selección, "Confirmar Check-in" está deshabilitado.

- [ ] **Step 6: Verificar tipos y lint**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx eslint src/components/checkin/CheckInModal.tsx`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/components/checkin/CheckInModal.tsx tests/components/CheckInModal.test.tsx
git commit -m "feat(check-in): selector de perrera obligatorio con creación inline"
```

---

## Task 4: Wiring en Dashboard

**Files:**
- Modify: `src/pages/Dashboard.tsx:133-147`

- [ ] **Step 1: Pasar unitId y notas al check-in**

En `src/pages/Dashboard.tsx`, dentro de `handleCheckInConfirm`, reemplazar:

```tsx
    const { error } = await checkIn(data.reservationId);
```

por:

```tsx
    const { error } = await checkIn(data.reservationId, data.unitId, data.notes);
```

> `handleCheckOutConfirm` no cambia: ya llama `checkOut(data.reservationId)`, que ahora usa el RPC.

- [ ] **Step 2: Manejar el error de "perrera no disponible" con mensaje del RPC**

En `handleCheckInConfirm`, cambiar el bloque de error para mostrar el mensaje real del RPC (carrera de perreras), conservando el cierre del modal:

```tsx
    if (error) {
      toast.error("No se pudo registrar el check-in", {
        description: error.message || "Inténtalo de nuevo.",
      });
    } else {
```

- [ ] **Step 3: Verificar tipos, lint y toda la suite**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run lint && npm run test`
Expected: sin errores de tipos/lint; vitest verde (incluye `test-suite.ts` + nuevos `tests/hooks/useReservations.test.ts` y `tests/components/CheckInModal.test.tsx`).

> Nota: `vitest.config.ts` incluye `tests/**/*.test.ts` pero el nuevo test del modal es `.tsx`. Si `npm run test` no lo recoge, ampliar el glob `include` a `["tests/test-suite.ts", "tests/**/*.test.ts", "tests/**/*.test.tsx"]` en `vitest.config.ts` y volver a correr.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Dashboard.tsx vitest.config.ts
git commit -m "feat(dashboard): check-in pasa perrera al RPC y muestra error real de disponibilidad"
```

---

## Task 5: Verificación de extremo a extremo (manual)

**Files:** ninguno (verificación en app real).

- [ ] **Step 1: Build de producción**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 2: Recorrido manual del flujo completo**

Run: `npm run dev` y, autenticado como staff/admin:
1. Crear cliente → crear su perro.
2. Crear reserva (servicio + fechas) → queda en "Solicitudes" como `requested`.
3. Aprobar la reserva → `scheduled`.
4. Check-in: el modal exige elegir perrera; "Confirmar" deshabilitado hasta elegir; probar "Crear perrera nueva…" y que se autoseleccione.
5. Confirmar → reserva `checked_in`; en Facility la perrera aparece `occupied` con el perro y fechas de la estadía.
6. Check-out → reserva `completed`; la perrera vuelve a `available`.
Expected: cada paso se comporta como arriba; sin errores en consola.

- [ ] **Step 3: Caso de carrera (opcional)**

Abrir dos pestañas, intentar check-in de dos reservas a la misma perrera casi simultáneamente.
Expected: una entra; la otra recibe el toast "Esa perrera no está disponible, elige otra".

---

## Self-Review (cobertura del spec)

- Sección 1 (columna `assigned_reservation_id`) → Task 1, Step 3.
- Sección 2 (RPCs check-in/out, validación tenancy, atomicidad, idempotencia, notices) → Task 1, Steps 3+5; aserciones en `tests/sql/reservation_kennel_coupling.md`.
- Sección 3 (selector de perrera, crear inline mínimo nombre+zona, Confirmar bloqueado, error de carrera, hook→RPCs) → Tasks 2, 3, 4.
- Sección 4 (casos borde: doble check-in, sin perreras, check-out idempotente, reserva no aprobada) → aserciones SQL (Task 1) + Tasks 3/4 + verificación Task 5.
- Pruebas (RPCs, hook, UI, concurrencia) → Tasks 1–4 + Task 5.
- Fuera de alcance respetado: no se toca disponibilidad futura, capacidad compartida, packages, ni se deprecia `KennelAssignmentModal`.
```
