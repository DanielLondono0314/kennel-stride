# Rediseño del formulario de perro (DogModal) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliar el `DogModal` para capturar datos estructurados de agresividad, alimentación, alergias y medicación, persistiéndolos en `dogs` (2 columnas JSONB) y en dos tablas nuevas org-scoped (`dog_allergies`, `dog_medications`).

**Architecture:** Modelo híbrido del spec: 1-a-1 (agresividad, alimentación) como JSONB en `dogs`; 1-a-muchos (alergias, medicación) como tablas nuevas con RLS org-scoped reusando `get_user_org_ids()`. El `DogModal` gana 4 sub-componentes controlados (`FeedingFields`, `AggressionFields`, `AllergyList`, `MedicationList`); las tablas hijas se cargan por `dog_id` al editar y se sincronizan (delete-all + insert) desde `DogsPage.handleSave`.

**Tech Stack:** Supabase/Postgres (DDL, RLS), React + TypeScript, zod, vitest + @testing-library/react (jsdom), shadcn/ui (Select, Switch, Input, Textarea, AlertDialog), sonner.

**Spec:** `docs/superpowers/specs/2026-06-05-dog-form-design.md`

---

## File Structure

- **Create** `tests/sql/dog_clinical_intake.md` — aserciones SQL manuales (no hay harness de Postgres).
- **Create** `supabase/migrations/20260606000000_dog_clinical_intake.sql` — 2 columnas JSONB en `dogs` + tablas `dog_allergies`/`dog_medications` + RLS + grants.
- **Create** `src/types/dogClinical.ts` — tipos de formulario + factorías de fila vacía.
- **Modify** `src/lib/schemas.ts` — schemas zod `feedingSchema`/`aggressionDetailsSchema`/`allergyRowSchema`/`medicationRowSchema` + tipos inferidos.
- **Create** `src/components/dogs/FeedingFields.tsx` — sección de alimentación (fija).
- **Create** `src/components/dogs/AggressionFields.tsx` — sub-form de agresividad.
- **Create** `src/components/dogs/AllergyList.tsx` — lista repetible de alergias.
- **Create** `src/components/dogs/MedicationList.tsx` — lista repetible de medicación.
- **Modify** `src/components/dogs/DogModal.tsx` — estado nuevo, carga de hijas al editar, confirm al apagar toggle, validación, payload extendido.
- **Modify** `src/pages/DogsPage.tsx` — `handleSave` persiste JSONB + sincroniza hijas; `DbDog` local += campos.
- **Modify** `src/hooks/queries/useDogs.ts` — `DbDog` exportado += `aggression_details`/`feeding`.
- **Create** `tests/components/FeedingFields.test.tsx`, `tests/components/AllergyList.test.tsx`, `tests/lib/dogClinicalSchema.test.ts`, `tests/components/DogModal.dogform.test.tsx`.

> **Nota TDD para SQL:** el repo no tiene harness de Postgres (vitest corre en jsdom). El "test" de la migración es el documento de aserciones en `tests/sql/`; la verificación es manual. Se escribe ANTES de la migración para fijar el contrato.

> **Nota de tipos:** las tablas `dog_allergies`/`dog_medications` no estarán en `src/integrations/supabase/types.ts` (regenerar requiere Supabase local/Docker). Se accede con cast `supabase.from("dog_allergies" as any)`, mismo patrón que las RPCs del acople (`supabase.rpc("check_in_reservation" as any, …)`).

---

## Task 1: Migración — columnas JSONB + tablas hijas + RLS

**Files:**
- Create: `tests/sql/dog_clinical_intake.md`
- Create: `supabase/migrations/20260606000000_dog_clinical_intake.sql`

- [ ] **Step 1: Escribir el documento de aserciones SQL**

Crear `tests/sql/dog_clinical_intake.md`:

```markdown
# Verificación SQL — Intake clínico del perro (alergias / medicación / JSONB)

> No hay harness de Postgres en el repo (vitest corre en jsdom). Estas son las
> aserciones a ejecutar contra una BD local (`supabase db reset`).

Migración: `supabase/migrations/20260606000000_dog_clinical_intake.sql`

## Fixtures
- Org `O1`; usuario `U1` miembro de `O1` (`request.jwt.claim.sub = U1`).
- Org ajena `O2`; perro `D2` en `O2`.
- Cliente `C1`, perro `D1` en `O1`.

## Aserciones — esquema
1. `\d public.dogs` muestra columnas `aggression_details jsonb` y `feeding jsonb`.
2. `\d public.dog_allergies` y `\d public.dog_medications` existen con sus columnas/CHECKs.
3. `dog_medications.end_date` es columna generada: insertar fila con
   `start_date='2026-06-01'`, `duration_days=10` → `end_date = '2026-06-11'`.
   Insertar con `start_date=NULL` → `end_date IS NULL`.
4. CHECKs rechazan valores fuera de dominio:
   `INSERT ... dog_allergies(type) VALUES ('otro')` → error;
   `INSERT ... dog_medications(route) VALUES ('rectal')` → error.

## Aserciones — RLS (como U1)
5. Insertar alergia para `D1` con `organization_id=O1` → OK.
6. `SELECT` de `dog_allergies` solo devuelve filas de O1 (no las de O2).
7. Insertar alergia con `organization_id=O2` → bloqueado por WITH CHECK.
8. Mismo set de pruebas para `dog_medications`.

## Aserciones — cascada
9. `DELETE FROM dogs WHERE id=D1` → borra en cascada sus filas en
   `dog_allergies` y `dog_medications` (0 filas restantes para `dog_id=D1`).
```

- [ ] **Step 2: Commit del documento de aserciones**

```bash
git add tests/sql/dog_clinical_intake.md
git commit -m "test(sql): aserciones del intake clínico del perro (alergias/medicación/JSONB)"
```

- [ ] **Step 3: Escribir la migración**

Crear `supabase/migrations/20260606000000_dog_clinical_intake.sql`:

```sql
-- ============================================================
-- Intake clínico del perro (formulario ampliado)
-- 1) dogs += aggression_details / feeding (JSONB, 1-a-1).
-- 2) dog_allergies / dog_medications (1-a-muchos, org-scoped, intake).
-- ============================================================

-- 1. Columnas JSONB en dogs (la forma la valida la app con zod).
ALTER TABLE public.dogs
  ADD COLUMN IF NOT EXISTS aggression_details jsonb,
  ADD COLUMN IF NOT EXISTS feeding jsonb;

-- 2. Alergias (varias por perro).
CREATE TABLE IF NOT EXISTS public.dog_allergies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id          uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  allergen        text NOT NULL,
  type            text NOT NULL CHECK (type IN ('comida','ambiental','medicamento')),
  reaction        text,
  severity        text CHECK (severity IN ('baja','media','alta')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dog_allergies_dog ON public.dog_allergies(dog_id);

-- 3. Medicación (varias por perro; end_date derivada para task-gen futura).
CREATE TABLE IF NOT EXISTS public.dog_medications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id          uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  dose            text,
  frequency       text,
  duration_days   integer CHECK (duration_days IS NULL OR duration_days > 0),
  start_date      date,
  route           text CHECK (route IN ('oral','topica','inyectable')),
  with_food       boolean NOT NULL DEFAULT false,
  end_date        date GENERATED ALWAYS AS (
                    CASE WHEN start_date IS NOT NULL AND duration_days IS NOT NULL
                         THEN start_date + duration_days
                         ELSE NULL END
                  ) STORED,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dog_medications_dog ON public.dog_medications(dog_id);

-- 4. RLS org-scoped (intake; reusa el helper SECURITY DEFINER existente).
ALTER TABLE public.dog_allergies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dog_medications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dog_allergies_org_access ON public.dog_allergies;
CREATE POLICY dog_allergies_org_access ON public.dog_allergies
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

DROP POLICY IF EXISTS dog_medications_org_access ON public.dog_medications;
CREATE POLICY dog_medications_org_access ON public.dog_medications
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dog_allergies   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dog_medications TO authenticated;
```

- [ ] **Step 4: Verificar que la migración aplica limpio (si hay Supabase local)**

Run: `supabase db reset`
Expected: aplica sin error; `\d public.dog_allergies`, `\d public.dog_medications` y las 2 columnas en `dogs` existen.

> Si no hay Supabase local (sin Docker/Colima), validar al menos la sintaxis revisando el archivo y documentar en el commit que la verificación funcional es manual vía `tests/sql/dog_clinical_intake.md`. La aplicación a prod es `supabase db push` (paso de despliegue, fuera de este plan).

- [ ] **Step 5: Commit de la migración**

```bash
git add supabase/migrations/20260606000000_dog_clinical_intake.sql
git commit -m "feat(db): dogs.aggression_details/feeding + tablas dog_allergies/dog_medications (RLS org-scoped)"
```

---

## Task 2: Tipos de formulario + schemas zod

**Files:**
- Create: `src/types/dogClinical.ts`
- Modify: `src/lib/schemas.ts`
- Test: `tests/lib/dogClinicalSchema.test.ts`

- [ ] **Step 1: Crear los tipos de formulario y factorías**

Crear `src/types/dogClinical.ts`:

```ts
// Tipos del FORMULARIO (permiten "" para campos sin elegir). En guardado se
// normalizan a las formas JSONB / fila de la BD.
export type Severity = "baja" | "media" | "alta";
export type FoodType = "seco" | "humedo" | "crudo" | "mixto";
export type PortionUnit = "g" | "taza" | "scoop";
export type AllergyType = "comida" | "ambiental" | "medicamento";
export type MedRoute = "oral" | "topica" | "inyectable";

export interface AggressionForm {
  severity: Severity | "";
  handling: string;
  requires_muzzle: boolean;
  handle_alone: boolean;
  no_other_dogs: boolean;
}

export interface FeedingForm {
  food_type: FoodType | "";
  brand: string;
  meals_per_day: number | "";
  portion_amount: number | "";
  portion_unit: PortionUnit | "";
  instructions: string;
}

export interface AllergyRow {
  allergen: string;
  type: AllergyType | "";
  reaction: string;
  severity: Severity | "";
}

export interface MedicationRow {
  name: string;
  dose: string;
  frequency: string;
  duration_days: number | "";
  start_date: string;
  route: MedRoute | "";
  with_food: boolean;
}

export const emptyAggression = (): AggressionForm => ({
  severity: "",
  handling: "",
  requires_muzzle: false,
  handle_alone: false,
  no_other_dogs: false,
});

export const emptyFeeding = (): FeedingForm => ({
  food_type: "",
  brand: "",
  meals_per_day: "",
  portion_amount: "",
  portion_unit: "",
  instructions: "",
});

export const emptyAllergy = (): AllergyRow => ({
  allergen: "",
  type: "",
  reaction: "",
  severity: "",
});

export const emptyMedication = (): MedicationRow => ({
  name: "",
  dose: "",
  frequency: "",
  duration_days: "",
  start_date: "",
  route: "",
  with_food: false,
});
```

- [ ] **Step 2: Escribir el test de los schemas (falla primero)**

Crear `tests/lib/dogClinicalSchema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  feedingSchema,
  aggressionDetailsSchema,
  allergyRowSchema,
  medicationRowSchema,
} from "@/lib/schemas";

describe("feedingSchema", () => {
  it("rechaza alimentación sin tipo ni nº de comidas", () => {
    expect(feedingSchema.safeParse({ food_type: "", meals_per_day: "" }).success).toBe(false);
  });
  it("acepta el mínimo: tipo + nº de comidas ≥1", () => {
    const r = feedingSchema.safeParse({ food_type: "seco", meals_per_day: 2 });
    expect(r.success).toBe(true);
  });
  it("rechaza meals_per_day < 1", () => {
    expect(feedingSchema.safeParse({ food_type: "seco", meals_per_day: 0 }).success).toBe(false);
  });
});

describe("aggressionDetailsSchema", () => {
  it("exige severidad y manejo", () => {
    expect(aggressionDetailsSchema.safeParse({ severity: "", handling: "" }).success).toBe(false);
    expect(
      aggressionDetailsSchema.safeParse({ severity: "alta", handling: "con cuidado" }).success
    ).toBe(true);
  });
});

describe("allergyRowSchema", () => {
  it("exige alérgeno y tipo", () => {
    expect(allergyRowSchema.safeParse({ allergen: "", type: "" }).success).toBe(false);
    expect(allergyRowSchema.safeParse({ allergen: "pollo", type: "comida" }).success).toBe(true);
  });
});

describe("medicationRowSchema", () => {
  it("exige al menos el nombre", () => {
    expect(medicationRowSchema.safeParse({ name: "" }).success).toBe(false);
    expect(medicationRowSchema.safeParse({ name: "Apoquel" }).success).toBe(true);
  });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `npx vitest run tests/lib/dogClinicalSchema.test.ts`
Expected: FAIL — los schemas aún no existen (import error / undefined).

- [ ] **Step 4: Añadir los schemas a `src/lib/schemas.ts`**

Añadir al final de `src/lib/schemas.ts` (antes de los `export type`):

```ts
export const feedingSchema = z.object({
  food_type: z.enum(["seco", "humedo", "crudo", "mixto"], {
    errorMap: () => ({ message: "Elige el tipo de comida" }),
  }),
  brand: z.string().trim().max(80).optional().or(z.literal("")),
  meals_per_day: z.coerce.number().int().min(1, "Indica cuántas comidas al día").max(12),
  portion_amount: z.coerce.number().positive().max(10000).optional().nullable(),
  portion_unit: z.enum(["g", "taza", "scoop"]).optional().nullable(),
  instructions: z.string().trim().max(500).optional().or(z.literal("")),
});

export const aggressionDetailsSchema = z.object({
  severity: z.enum(["baja", "media", "alta"], {
    errorMap: () => ({ message: "Elige la severidad" }),
  }),
  handling: z.string().trim().min(1, "Describe el manejo").max(500),
  requires_muzzle: z.boolean().default(false),
  handle_alone: z.boolean().default(false),
  no_other_dogs: z.boolean().default(false),
});

export const allergyRowSchema = z.object({
  allergen: z.string().trim().min(1, "Indica el alérgeno").max(80),
  type: z.enum(["comida", "ambiental", "medicamento"], {
    errorMap: () => ({ message: "Elige el tipo de alergia" }),
  }),
  reaction: z.string().trim().max(200).optional().or(z.literal("")),
  severity: z.enum(["baja", "media", "alta"]).optional().nullable(),
});

export const medicationRowSchema = z.object({
  name: z.string().trim().min(1, "Indica el medicamento").max(120),
  dose: z.string().trim().max(80).optional().or(z.literal("")),
  frequency: z.string().trim().max(80).optional().or(z.literal("")),
  duration_days: z.coerce.number().int().positive().max(3650).optional().nullable(),
  start_date: z.string().optional().or(z.literal("")),
  route: z.enum(["oral", "topica", "inyectable"]).optional().nullable(),
  with_food: z.boolean().default(false),
});

export type FeedingInput = z.infer<typeof feedingSchema>;
export type AggressionDetailsInput = z.infer<typeof aggressionDetailsSchema>;
export type AllergyRowInput = z.infer<typeof allergyRowSchema>;
export type MedicationRowInput = z.infer<typeof medicationRowSchema>;
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npx vitest run tests/lib/dogClinicalSchema.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/dogClinical.ts src/lib/schemas.ts tests/lib/dogClinicalSchema.test.ts
git commit -m "feat(dogs): tipos de formulario clínico + schemas zod (alimentación/agresividad/alergias/medicación)"
```

---

## Task 3: Componente `FeedingFields`

**Files:**
- Create: `src/components/dogs/FeedingFields.tsx`
- Test: `tests/components/FeedingFields.test.tsx`

- [ ] **Step 1: Escribir el test (falla primero)**

Crear `tests/components/FeedingFields.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FeedingFields } from "@/components/dogs/FeedingFields";
import { emptyFeeding } from "@/types/dogClinical";

describe("FeedingFields", () => {
  it("renderiza el campo de nº de comidas y propaga cambios", () => {
    const onChange = vi.fn();
    render(<FeedingFields value={emptyFeeding()} onChange={onChange} />);
    const meals = screen.getByLabelText(/comidas al día/i);
    fireEvent.change(meals, { target: { value: "3" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ meals_per_day: 3 }));
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/components/FeedingFields.test.tsx`
Expected: FAIL — el componente no existe.

- [ ] **Step 3: Crear el componente**

Crear `src/components/dogs/FeedingFields.tsx`:

```tsx
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UtensilsCrossed } from "lucide-react";
import type { FeedingForm, FoodType, PortionUnit } from "@/types/dogClinical";

interface Props {
  value: FeedingForm;
  onChange: (v: FeedingForm) => void;
  foodAllergyWarning?: string[];
}

export function FeedingFields({ value, onChange, foodAllergyWarning = [] }: Props) {
  const set = (patch: Partial<FeedingForm>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <Label className="flex items-center gap-2 text-sm font-semibold">
        <UtensilsCrossed className="h-4 w-4" /> Alimentación *
      </Label>

      {foodAllergyWarning.length > 0 && (
        <p className="text-xs text-destructive">
          ⚠️ Alergias alimentarias: {foodAllergyWarning.join(", ")}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="feeding-type" className="text-xs">Tipo de comida *</Label>
          <Select value={value.food_type} onValueChange={(v) => set({ food_type: v as FoodType })}>
            <SelectTrigger id="feeding-type"><SelectValue placeholder="Elegir…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="seco">Seco</SelectItem>
              <SelectItem value="humedo">Húmedo</SelectItem>
              <SelectItem value="crudo">Crudo</SelectItem>
              <SelectItem value="mixto">Mixto</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="feeding-brand" className="text-xs">Marca / producto</Label>
          <Input id="feeding-brand" value={value.brand}
            onChange={(e) => set({ brand: e.target.value })} placeholder="Marca…" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="feeding-meals" className="text-xs">Comidas al día *</Label>
          <Input id="feeding-meals" type="number" min={1} value={value.meals_per_day}
            onChange={(e) => set({ meals_per_day: e.target.value === "" ? "" : Number(e.target.value) })}
            placeholder="2" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="feeding-portion" className="text-xs">Porción</Label>
          <Input id="feeding-portion" type="number" min={0} value={value.portion_amount}
            onChange={(e) => set({ portion_amount: e.target.value === "" ? "" : Number(e.target.value) })}
            placeholder="150" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="feeding-unit" className="text-xs">Unidad</Label>
          <Select value={value.portion_unit} onValueChange={(v) => set({ portion_unit: v as PortionUnit })}>
            <SelectTrigger id="feeding-unit"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="g">g</SelectItem>
              <SelectItem value="taza">taza</SelectItem>
              <SelectItem value="scoop">scoop</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="feeding-instructions" className="text-xs">Instrucciones especiales</Label>
        <Textarea id="feeding-instructions" rows={2} value={value.instructions}
          onChange={(e) => set({ instructions: e.target.value })}
          placeholder="Ej. remojar el pienso, separar de otros perros…" />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/components/FeedingFields.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/dogs/FeedingFields.tsx tests/components/FeedingFields.test.tsx
git commit -m "feat(dogs): componente FeedingFields (alimentación obligatoria)"
```

---

## Task 4: Componente `AggressionFields`

**Files:**
- Create: `src/components/dogs/AggressionFields.tsx`

- [ ] **Step 1: Crear el componente**

Crear `src/components/dogs/AggressionFields.tsx`:

```tsx
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AggressionForm, Severity } from "@/types/dogClinical";

interface Props {
  value: AggressionForm;
  onChange: (v: AggressionForm) => void;
}

export function AggressionFields({ value, onChange }: Props) {
  const set = (patch: Partial<AggressionForm>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="aggr-severity" className="text-xs">Severidad *</Label>
          <Select value={value.severity} onValueChange={(v) => set({ severity: v as Severity })}>
            <SelectTrigger id="aggr-severity"><SelectValue placeholder="Elegir…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="baja">Baja</SelectItem>
              <SelectItem value="media">Media</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="aggr-handling" className="text-xs">Manejo *</Label>
        <Textarea id="aggr-handling" rows={2} value={value.handling}
          onChange={(e) => set({ handling: e.target.value })}
          placeholder="Cómo manejarlo de forma segura…" />
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center gap-3">
          <Switch checked={value.requires_muzzle} onCheckedChange={(c) => set({ requires_muzzle: c })} />
          <Label className="text-sm font-normal">Requiere bozal</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={value.handle_alone} onCheckedChange={(c) => set({ handle_alone: c })} />
          <Label className="text-sm font-normal">Manejar a solas</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={value.no_other_dogs} onCheckedChange={(c) => set({ no_other_dogs: c })} />
          <Label className="text-sm font-normal">No con otros perros</Label>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/dogs/AggressionFields.tsx
git commit -m "feat(dogs): componente AggressionFields (severidad + manejo + flags)"
```

---

## Task 5: Componente `AllergyList`

**Files:**
- Create: `src/components/dogs/AllergyList.tsx`
- Test: `tests/components/AllergyList.test.tsx`

- [ ] **Step 1: Escribir el test (falla primero)**

Crear `tests/components/AllergyList.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AllergyList } from "@/components/dogs/AllergyList";
import { emptyAllergy } from "@/types/dogClinical";

describe("AllergyList", () => {
  it("añade una fila al pulsar 'Añadir alergia'", () => {
    const onChange = vi.fn();
    render(<AllergyList value={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /añadir alergia/i }));
    expect(onChange).toHaveBeenCalledWith([emptyAllergy()]);
  });

  it("quita la fila indicada", () => {
    const onChange = vi.fn();
    const rows = [{ ...emptyAllergy(), allergen: "pollo" }, { ...emptyAllergy(), allergen: "polvo" }];
    render(<AllergyList value={rows} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole("button", { name: /quitar alergia/i })[0]);
    expect(onChange).toHaveBeenCalledWith([rows[1]]);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/components/AllergyList.test.tsx`
Expected: FAIL — el componente no existe.

- [ ] **Step 3: Crear el componente**

Crear `src/components/dogs/AllergyList.tsx`:

```tsx
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { emptyAllergy, type AllergyRow, type AllergyType, type Severity } from "@/types/dogClinical";

interface Props {
  value: AllergyRow[];
  onChange: (rows: AllergyRow[]) => void;
}

export function AllergyList({ value, onChange }: Props) {
  const update = (i: number, patch: Partial<AllergyRow>) =>
    onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, emptyAllergy()]);

  return (
    <div className="space-y-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
      {value.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Alérgeno *</Label>
            <Input value={row.allergen} onChange={(e) => update(i, { allergen: e.target.value })}
              placeholder="Ej. pollo" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo *</Label>
            <Select value={row.type} onValueChange={(v) => update(i, { type: v as AllergyType })}>
              <SelectTrigger><SelectValue placeholder="Elegir…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="comida">Comida</SelectItem>
                <SelectItem value="ambiental">Ambiental</SelectItem>
                <SelectItem value="medicamento">Medicamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Quitar alergia"
            onClick={() => remove(i)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
          <div className="space-y-1.5">
            <Label className="text-xs">Reacción</Label>
            <Input value={row.reaction} onChange={(e) => update(i, { reaction: e.target.value })}
              placeholder="Ej. picor, vómito" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Severidad</Label>
            <Select value={row.severity} onValueChange={(v) => update(i, { severity: v as Severity })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baja">Baja</SelectItem>
                <SelectItem value="media">Media</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" className="h-auto p-0 text-xs text-primary" onClick={add}>
        <Plus className="h-3 w-3 mr-1" /> Añadir alergia
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/components/AllergyList.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/dogs/AllergyList.tsx tests/components/AllergyList.test.tsx
git commit -m "feat(dogs): componente AllergyList (lista repetible de alergias)"
```

---

## Task 6: Componente `MedicationList`

**Files:**
- Create: `src/components/dogs/MedicationList.tsx`

- [ ] **Step 1: Crear el componente**

Crear `src/components/dogs/MedicationList.tsx`:

```tsx
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { emptyMedication, type MedicationRow, type MedRoute } from "@/types/dogClinical";

interface Props {
  value: MedicationRow[];
  onChange: (rows: MedicationRow[]) => void;
}

export function MedicationList({ value, onChange }: Props) {
  const update = (i: number, patch: Partial<MedicationRow>) =>
    onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, emptyMedication()]);

  return (
    <div className="space-y-4 rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
      {value.map((row, i) => (
        <div key={i} className="space-y-2 border-b border-border/60 pb-3 last:border-0 last:pb-0">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">Medicamento *</Label>
              <Input value={row.name} onChange={(e) => update(i, { name: e.target.value })}
                placeholder="Ej. Apoquel" />
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Quitar medicamento"
              onClick={() => remove(i)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Dosis</Label>
              <Input value={row.dose} onChange={(e) => update(i, { dose: e.target.value })} placeholder="Ej. 5mg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Frecuencia</Label>
              <Input value={row.frequency} onChange={(e) => update(i, { frequency: e.target.value })}
                placeholder="Ej. 2/día" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Duración (días)</Label>
              <Input type="number" min={1} value={row.duration_days}
                onChange={(e) => update(i, { duration_days: e.target.value === "" ? "" : Number(e.target.value) })}
                placeholder="10" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Inicio</Label>
              <Input type="date" value={row.start_date}
                onChange={(e) => update(i, { start_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vía</Label>
              <Select value={row.route} onValueChange={(v) => update(i, { route: v as MedRoute })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="oral">Oral</SelectItem>
                  <SelectItem value="topica">Tópica</SelectItem>
                  <SelectItem value="inyectable">Inyectable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch checked={row.with_food} onCheckedChange={(c) => update(i, { with_food: c })} />
              <Label className="text-sm font-normal">Con comida</Label>
            </div>
          </div>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" className="h-auto p-0 text-xs text-primary" onClick={add}>
        <Plus className="h-3 w-3 mr-1" /> Añadir medicamento
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/dogs/MedicationList.tsx
git commit -m "feat(dogs): componente MedicationList (lista repetible de medicación)"
```

---

## Task 7: Integrar en `DogModal` (estado, carga, confirm, validación, payload)

**Files:**
- Modify: `src/components/dogs/DogModal.tsx`
- Test: `tests/components/DogModal.dogform.test.tsx`

- [ ] **Step 1: Escribir el test de integración (falla primero)**

Crear `tests/components/DogModal.dogform.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DogModal } from "@/components/dogs/DogModal";

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

describe("DogModal — formulario clínico", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra la sección de Alimentación (obligatoria) al abrir", async () => {
    render(<DogModal open onOpenChange={() => {}} onSave={() => {}} />);
    expect(await screen.findByText(/Alimentación \*/i)).toBeInTheDocument();
  });

  it("revela el sub-form de agresividad al encender el toggle", async () => {
    render(<DogModal open onOpenChange={() => {}} onSave={() => {}} />);
    const toggle = await screen.findByRole("switch", { name: /perro agresivo/i });
    fireEvent.click(toggle);
    expect(await screen.findByLabelText(/Manejo \*/i)).toBeInTheDocument();
  });
});
```

> Nota: el toggle "Perro agresivo" debe quedar asociado a su `Label` para ser
> alcanzable por `getByRole("switch", { name: … })`. En el Step 3 se añade
> `id`/`aria-label` al `Switch` de cada toggle.

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/components/DogModal.dogform.test.tsx`
Expected: FAIL — no existe la sección "Alimentación *" ni el sub-form al togglear.

- [ ] **Step 3: Reescribir el cuerpo clínico del `DogModal`**

3a. Ajustar imports (cabecera del archivo). Añadir junto a los imports existentes:

```tsx
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FeedingFields } from "@/components/dogs/FeedingFields";
import { AggressionFields } from "@/components/dogs/AggressionFields";
import { AllergyList } from "@/components/dogs/AllergyList";
import { MedicationList } from "@/components/dogs/MedicationList";
import {
  emptyAggression, emptyFeeding,
  type AggressionForm, type FeedingForm, type AllergyRow, type MedicationRow,
} from "@/types/dogClinical";
import {
  feedingSchema, aggressionDetailsSchema, allergyRowSchema, medicationRowSchema,
} from "@/lib/schemas";
```

3b. Añadir estado clínico (junto a los `useState` existentes, tras `medicalNotes`):

```tsx
  const [aggression, setAggression] = useState<AggressionForm>(emptyAggression());
  const [feeding, setFeeding] = useState<FeedingForm>(emptyFeeding());
  const [allergies, setAllergies] = useState<AllergyRow[]>([]);
  const [medications, setMedications] = useState<MedicationRow[]>([]);
  // Toggle pendiente de confirmación de descarte: 'aggressive'|'allergies'|'medication'|null
  const [pendingClear, setPendingClear] = useState<null | "aggressive" | "allergies" | "medication">(null);
```

3c. En el `useEffect` de reset (el que depende de `[dog, preselectedCustomerId, open]`),
inicializar el estado clínico. En la rama `if (dog)` añadir:

```tsx
      setAggression(
        (dog.aggression_details as AggressionForm | null) ?? emptyAggression()
      );
      setFeeding((dog.feeding as FeedingForm | null) ?? emptyFeeding());
```

y en la rama `else` añadir:

```tsx
      setAggression(emptyAggression());
      setFeeding(emptyFeeding());
      setAllergies([]);
      setMedications([]);
```

3d. Cargar las filas hijas al abrir en modo edición. Añadir un `useEffect` nuevo
después del `useEffect` que carga `customers`:

```tsx
  useEffect(() => {
    if (!open || !dog?.id) {
      if (!dog) { setAllergies([]); setMedications([]); }
      return;
    }
    (async () => {
      const [aRes, mRes] = await Promise.all([
        supabase.from("dog_allergies" as any).select("*").eq("dog_id", dog.id),
        supabase.from("dog_medications" as any).select("*").eq("dog_id", dog.id),
      ]);
      setAllergies(((aRes.data as any[]) ?? []).map((r) => ({
        allergen: r.allergen ?? "", type: r.type ?? "",
        reaction: r.reaction ?? "", severity: r.severity ?? "",
      })));
      setMedications(((mRes.data as any[]) ?? []).map((r) => ({
        name: r.name ?? "", dose: r.dose ?? "", frequency: r.frequency ?? "",
        duration_days: r.duration_days ?? "", start_date: r.start_date ?? "",
        route: r.route ?? "", with_food: !!r.with_food,
      })));
    })();
  }, [open, dog?.id]);
```

3e. Helper para apagar un toggle con confirmación de descarte. Añadir antes de
`handleSubmit`:

```tsx
  const hasAggressionData = (a: AggressionForm) =>
    a.severity !== "" || a.handling.trim() !== "" ||
    a.requires_muzzle || a.handle_alone || a.no_other_dogs;

  // Intercepta el cambio del toggle: si se apaga con datos, pide confirmación.
  const toggleAggressive = (next: boolean) => {
    if (!next && hasAggressionData(aggression)) { setPendingClear("aggressive"); return; }
    setIsAggressive(next);
  };
  const toggleAllergies = (next: boolean) => {
    if (!next && allergies.length > 0) { setPendingClear("allergies"); return; }
    setHasAllergies(next);
  };
  const toggleMedication = (next: boolean) => {
    if (!next && medications.length > 0) { setPendingClear("medication"); return; }
    setOnMedication(next);
  };
  const confirmClear = () => {
    if (pendingClear === "aggressive") { setAggression(emptyAggression()); setIsAggressive(false); }
    if (pendingClear === "allergies") { setAllergies([]); setHasAllergies(false); }
    if (pendingClear === "medication") { setMedications([]); setOnMedication(false); }
    setPendingClear(null);
  };
```

3f. Cross-link alergia-comida (para pasar a `FeedingFields`). Antes del `return`:

```tsx
  const foodAllergyWarning = allergies
    .filter((a) => a.type === "comida" && a.allergen.trim() !== "")
    .map((a) => a.allergen.trim());
```

3g. Validación clínica en `handleSubmit`. Tras el `dogSchema.safeParse(...)` actual
(después de su bloque `if (!parsed.success)`), añadir:

```tsx
    // Alimentación obligatoria.
    const feedingParsed = feedingSchema.safeParse(feeding);
    if (!feedingParsed.success) {
      toast.error("Completa la alimentación", {
        description: feedingParsed.error.issues[0]?.message,
      });
      return;
    }
    // Sub-forms requeridos cuando su toggle está activo.
    if (isAggressive) {
      const r = aggressionDetailsSchema.safeParse(aggression);
      if (!r.success) { toast.error("Completa los datos de agresividad", { description: r.error.issues[0]?.message }); return; }
    }
    if (hasAllergies) {
      if (allergies.length === 0) { toast.error("Añade al menos una alergia o apaga el interruptor"); return; }
      const bad = allergies.find((a) => !allergyRowSchema.safeParse(a).success);
      if (bad) { toast.error("Revisa las alergias", { description: "Cada alergia necesita alérgeno y tipo." }); return; }
    }
    if (onMedication) {
      if (medications.length === 0) { toast.error("Añade al menos un medicamento o apaga el interruptor"); return; }
      const bad = medications.find((m) => !medicationRowSchema.safeParse(m).success);
      if (bad) { toast.error("Revisa la medicación", { description: "Cada medicamento necesita un nombre." }); return; }
    }
```

3h. Extender el objeto pasado a `onSave` (dentro del `await onSave({ ... })`).
Añadir estas propiedades al objeto existente:

```tsx
        aggression_details: isAggressive ? aggression : null,
        feeding,
        allergies: hasAllergies ? allergies : [],
        medications: onMedication ? medications : [],
```

3i. Reemplazar el bloque JSX "Alertas de comportamiento/salud" (los 3 `Switch`
sueltos) para que cada toggle use su handler y despliegue su sub-form. Sustituir
ese `<div className="space-y-3"> … </div>` por:

```tsx
          <div className="space-y-4">
            <Label className="text-sm font-semibold">Alertas de comportamiento/salud</Label>

            {/* Agresivo */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <Switch id="toggle-aggressive" aria-label="Perro agresivo"
                  checked={isAggressive} onCheckedChange={toggleAggressive} />
                <Label htmlFor="toggle-aggressive"
                  className="flex items-center gap-1.5 text-sm font-normal cursor-pointer text-destructive">
                  <AlertTriangle className="h-4 w-4" /> Perro agresivo
                </Label>
              </div>
              {isAggressive && <AggressionFields value={aggression} onChange={setAggression} />}
            </div>

            {/* Alergias */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <Switch id="toggle-allergies" aria-label="Tiene alergias"
                  checked={hasAllergies} onCheckedChange={toggleAllergies} />
                <Label htmlFor="toggle-allergies"
                  className="flex items-center gap-1.5 text-sm font-normal cursor-pointer text-yellow-600">
                  <Leaf className="h-4 w-4" /> Tiene alergias
                </Label>
              </div>
              {hasAllergies && <AllergyList value={allergies} onChange={setAllergies} />}
            </div>

            {/* Medicación */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <Switch id="toggle-medication" aria-label="En medicación"
                  checked={onMedication} onCheckedChange={toggleMedication} />
                <Label htmlFor="toggle-medication"
                  className="flex items-center gap-1.5 text-sm font-normal cursor-pointer text-blue-600">
                  <Pill className="h-4 w-4" /> En medicación
                </Label>
              </div>
              {onMedication && <MedicationList value={medications} onChange={setMedications} />}
            </div>
          </div>

          {/* Alimentación (obligatoria, siempre visible) */}
          <FeedingFields value={feeding} onChange={setFeeding} foodAllergyWarning={foodAllergyWarning} />
```

3j. Añadir el `AlertDialog` de confirmación de descarte. Justo antes del
`</Dialog>` de cierre (después de `</DialogContent>`), insertar:

```tsx
      <AlertDialog open={pendingClear !== null} onOpenChange={(o) => !o && setPendingClear(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar los datos?</AlertDialogTitle>
            <AlertDialogDescription>
              Apagar este interruptor borrará los datos que cargaste en esta sección.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Conservar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClear}>Descartar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
```

3k. Eliminar las 3 textareas libres antiguas (`notes`/`behavior_notes`/`medical_notes`)?
**No.** Conservarlas según el spec (notas generales). Dejar ese bloque tal cual.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/components/DogModal.dogform.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Verificar tipos y lint del archivo**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx eslint src/components/dogs/DogModal.tsx`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/components/dogs/DogModal.tsx tests/components/DogModal.dogform.test.tsx
git commit -m "feat(dogs): DogModal con sub-forms clínicos, alimentación obligatoria y confirm de descarte"
```

---

## Task 8: Persistencia en `DogsPage` + tipos `DbDog`

**Files:**
- Modify: `src/pages/DogsPage.tsx`
- Modify: `src/hooks/queries/useDogs.ts`

- [ ] **Step 1: Extender `DbDog` (hook exportado)**

En `src/hooks/queries/useDogs.ts`, dentro de `interface DbDog`, añadir tras
`photo_url`:

```ts
  aggression_details: unknown | null;
  feeding: unknown | null;
```

- [ ] **Step 2: Extender `DbDog` local de `DogsPage`**

En `src/pages/DogsPage.tsx`, dentro de su `interface DbDog` local, añadir tras
`photo_url`:

```ts
  aggression_details: unknown | null;
  feeding: unknown | null;
```

- [ ] **Step 3: Persistir JSONB + sincronizar tablas hijas en `handleSave`**

En `src/pages/DogsPage.tsx`, en `handleSave`, añadir `aggression_details` y
`feeding` al `payload` (tras `photo_url`):

```ts
      aggression_details: data.aggression_details ?? null,
      feeding: data.feeding ?? null,
```

Y reemplazar el bloque de guardado + manejo de resultado (desde `let error;`
hasta el cierre del `else` del toast) por:

```ts
    let error;
    if (data.id && editingDog) {
      ({ error } = await supabase.from("dogs").update(payload).eq("id", data.id));
    } else {
      ({ error } = await supabase.from("dogs").insert({ ...payload, id: data.id, organization_id: organization!.id }));
    }

    if (error) {
      toast.error("No se pudo guardar el perro", { description: "Revisa tu conexión e inténtalo de nuevo." });
      return;
    }

    // Sincronizar alergias y medicación (delete-all + insert; listas cortas de intake).
    const orgId = organization!.id;
    const allergyRows = (data.allergies ?? []).map((a: any) => ({
      dog_id: data.id, organization_id: orgId,
      allergen: a.allergen, type: a.type,
      reaction: a.reaction || null, severity: a.severity || null,
    }));
    const medRows = (data.medications ?? []).map((m: any) => ({
      dog_id: data.id, organization_id: orgId,
      name: m.name, dose: m.dose || null, frequency: m.frequency || null,
      duration_days: m.duration_days === "" ? null : m.duration_days,
      start_date: m.start_date || null, route: m.route || null,
      with_food: !!m.with_food,
    }));

    await supabase.from("dog_allergies" as any).delete().eq("dog_id", data.id);
    if (allergyRows.length) await supabase.from("dog_allergies" as any).insert(allergyRows);
    await supabase.from("dog_medications" as any).delete().eq("dog_id", data.id);
    if (medRows.length) await supabase.from("dog_medications" as any).insert(medRows);

    toast.success(editingDog ? "Perro actualizado" : "Perro registrado");
    setModalOpen(false);
```

> El insert de `dogs` ya ocurre antes, así que `data.id` existe como FK válida
> para las filas hijas. El `delete` previo hace el sync idempotente (cubre filas
> retiradas y toggles apagados, cuya lista llega vacía).

- [ ] **Step 4: Verificar tipos, lint y toda la suite**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run lint && npm run test`
Expected: sin errores de tipos/lint; vitest verde (incluye los nuevos tests).

- [ ] **Step 5: Commit**

```bash
git add src/pages/DogsPage.tsx src/hooks/queries/useDogs.ts
git commit -m "feat(dogs): persistir JSONB clínico + sincronizar dog_allergies/dog_medications"
```

---

## Task 9: Verificación de extremo a extremo

**Files:** ninguno (verificación).

- [ ] **Step 1: Build de producción**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 2: Suite completa + tipos + lint**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run lint && npm run test`
Expected: 0 errores de tipos; lint sin errores nuevos; todos los tests verdes.

- [ ] **Step 3: Recorrido manual (si hay dev server + Supabase local)**

Run: `npm run dev`, autenticado como admin/front_desk:
1. Nuevo perro → la sección Alimentación es obligatoria; "Crear perro" falla con toast si falta tipo/nº comidas.
2. Encender "Perro agresivo" → aparece sub-form; severidad+manejo requeridos.
3. Encender "Tiene alergias" → añadir 2 filas; una de tipo "comida" muestra el ⚠️ junto a Alimentación.
4. Encender "En medicación" → añadir 1 fila con nombre.
5. Apagar un toggle con datos → AlertDialog "¿Descartar?"; "Conservar" cancela, "Descartar" limpia.
6. Guardar → verificar en BD: `dogs.feeding`/`aggression_details` poblados; filas en `dog_allergies`/`dog_medications`.
7. Editar el mismo perro → el modal precarga alimentación, agresividad y las filas hijas.
Expected: cada paso se comporta como arriba; 0 errores de consola.

---

## Self-Review (cobertura del spec)

- `dogs += aggression_details/feeding` → Task 1.
- Tablas `dog_allergies`/`dog_medications` + RLS org-scoped + `end_date` generada → Task 1.
- Tipos de formulario + schemas zod (alimentación obligatoria, sub-forms requeridos) → Task 2.
- Sub-componentes aislados (`FeedingFields`/`AggressionFields`/`AllergyList`/`MedicationList`) → Tasks 3–6.
- Toggles que despliegan sub-form; alimentación siempre visible; listas repetibles; cross-link alergia-comida ⚠️ → Task 7 (+ Task 3 para el aviso).
- Apagar toggle con datos → confirmación → Task 7 (AlertDialog + handlers).
- Validación (toggle ON ⇒ requerido; alimentación mínima) → Task 7.
- Persistencia upsert `dogs` (JSONB) + sync filas hijas (delete-all+insert) → Task 8.
- Conservar 3 booleanos + 3 notas libres → Task 7 (Step 3k: no se eliminan).
- Testing (schema, componentes, integración, SQL manual) → Tasks 1,2,3,5,7,9.
- Fuera de alcance respetado: no task-gen, no tablas vet-gated, no atomicidad por RPC.
