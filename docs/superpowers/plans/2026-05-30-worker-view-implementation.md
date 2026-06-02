# Worker View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated, mobile-first "Worker" view for field staff (trainers, groomers, cleaning, welfare, vets) that shows only their assigned work ("Mi día"), lets them execute and report it per specialty, and hardens RLS so a worker cannot see finances, settings, or other people's work.

**Architecture:** Separate *role* (permission level) from *specialty* (trade). The `app_role` enum becomes `('admin','manager','front_desk','worker')`; the legacy `trainer` role migrates to `role='worker'` + `specialty='trainer'`. A new lightweight `public.tasks` table holds non-reservation work. A unified "Mi día" feed merges the worker's assigned reservations + tasks. Role-based RLS uses the existing `SECURITY DEFINER` `get_*_org_ids()` helper pattern, plus two new helpers that resolve the caller's `staff_member` and validate specialty. The frontend reuses `ProtectedRoute`/`OrgGuard`/`useOrgNavigate` and adds a `WorkerRoute` guard plus a `/:orgSlug/worker` route tree with its own shell.

**Tech Stack:** React 18 + Vite + TypeScript, react-router-dom v6, @tanstack/react-query, shadcn/ui + Tailwind, Supabase/Postgres (RLS), Zod.

---

## Resolved open questions (decisions for this plan)

These resolve the spec's "Preguntas abiertas". Each task below assumes these answers.

1. **Where does `specialty` live? → On `staff_members` only.**
   Rationale: `organization_members.role` is the permission level (already queried by `OrganizationContext`); `staff_members` is the operational HR record that reservations (`staff_id`), report cards (`trainer_id`) and the new `tasks.assignee_staff_id` already reference. Specialty is an *operational* attribute of the staff record, so it belongs next to `role` on `staff_members`. We do **not** duplicate it on `organization_members` (DRY — one source of truth, avoids drift).

2. **One specialty per staff or many? → One (single `specialty` column).**
   Rationale: YAGNI, per the spec default. A single nullable `specialty` column on `staff_members`. If multi-specialty is ever needed, a future `staff_specialties` join table can be added without breaking this column.

3. **How is the authenticated user mapped to their `staff_member`? → Via `staff_members.profile_id = auth.uid()`.**
   Rationale: This FK already exists (`staff_members.profile_id → profiles.id`, and `profiles.id = auth.users.id`). `accept_invitation` already back-fills `profile_id` (`supabase/migrations/20260529030000_fix_invitation_and_idor.sql:59`), and `NewReservationModal.tsx:137` already queries staff by `profile_id = user.id`. We add a `SECURITY DEFINER` helper `get_my_staff_ids()` that returns the caller's `staff_members.id`(s) for use in RLS, plus a `useMyStaffMember()` hook for the client.

4. **`Anon full access reservations` RLS hole → DEPEND ON the separate fix, do not re-solve here.**
   A dedicated branch `fix/reservations-anon-rls` is already in progress to drop the `CREATE POLICY "Anon full access reservations" ... FOR ALL TO public USING (true)` left by `supabase/migrations/20260331000000_create_reservations.sql:31` and re-created by `supabase/migrations/20260402204454_*.sql:24`. **Phase 1's reservations RLS task is BLOCKED ON that fix landing first** (a worker must not depend on anon access, and our authenticated worker policies are meaningless while a `TO public USING(true)` policy coexists, because Postgres RLS is permissive-OR across policies). The migration in Task 1.6 includes a defensive `DROP POLICY IF EXISTS "Anon full access reservations"` so it is also self-correcting if applied after that branch, but the blocker is called out explicitly in the Phase 1 risk section.

---

## Grounding: existing patterns this plan reuses

- **RLS helper pattern** (`supabase/migrations/20260530010000_role_based_rls.sql`): `SECURITY DEFINER`, `STABLE`, `SET search_path = public`, returns `SETOF uuid`, e.g. `get_user_org_ids()` / `get_active_org_ids()` / `get_finance_writer_org_ids()` / `get_admin_org_ids()`. Two-policy pattern per table: a `<table> read` (SELECT, all members) + a `<table> write` (FOR ALL, gated). Policies named `"Org members full access <table>"` were the older single-policy form (`20260402000001_multi_tenant.sql`). New tables follow the **two-policy** form.
- **Enum** (`supabase/migrations/20260227115812_*.sql:3`): `CREATE TYPE public.app_role AS ENUM ('admin', 'front_desk', 'trainer', 'manager')`. Referenced by `organization_members.role`, `staff_members.role` (default `'trainer'`), `user_roles.role`, `invitations.role`, and `has_role()`.
- **Routing/guards**: `src/App.tsx` mounts `<Route path="/:orgSlug" element={<OrgGuard/>}>` → `<AppLayout/>` → admin pages. `OrgGuard` (`src/components/auth/OrgGuard.tsx`) wraps `OrganizationProvider` and gates on session/org/subscription. `OrganizationContext` (`src/contexts/OrganizationContext.tsx`) exposes `currentUserRole: OrgRole`. `useOrgNavigate()` (`src/hooks/useOrgNavigate.ts`) prepends `/:orgSlug`.
- **Data layer**: react-query hooks in `src/hooks/queries/*.ts` follow a `xKeys(orgId)` factory + `useX()` query (`enabled: !!organization?.id`, filter `.eq("organization_id", organization!.id)`) + `useCreateX()` mutation that injects `organization_id` and invalidates. See `src/hooks/queries/useReportCards.ts`.
- **SQL test pattern**: hand-run assertions in `tests/sql/*.md` (`auth_tenancy.md`, `reservations.md`, `rls_roles.md`) — fixtures + numbered assertions run against a local `supabase db reset` DB by impersonating users via `SET request.jwt.claim.sub`. No pg harness in repo.
- **Generated types**: `src/integrations/supabase/types.ts` is regenerated from the DB. The `app_role` literal union appears at lines ~1579 and ~1710.

### Tables the report forms write to (confirmed columns)

- `report_cards` (`20260301141126_*.sql`): `dog_id`, `dog_name`, `trainer_id → staff_members`, `energy_level`, `socialization`, `obedience`, `appetite`, `overall_score`, `highlights`, `areas_to_improve`, `notes`, `photos text[]`, `service_type`, `session_date`, `is_sent`, `sent_at`, `organization_id`.
- `medical_history` / `vaccination_schedule` / `deworming_records` / `medical_conditions` (`20260309121942_*.sql`): **NOTE quirk** — these use `dog_id text` (not a uuid FK to `dogs`) and carry `dog_name text`. The vet report form must pass `dog_id` as text and include `dog_name`. All four already have `organization_id` (added in `20260402000001_multi_tenant.sql`).

---

## File structure (created / modified across all phases)

**Migrations (created):**
- `supabase/migrations/20260531000001_worker_role_specialty.sql` — enum change + specialty column + data migration (Phase 1).
- `supabase/migrations/20260531000002_tasks_table.sql` — `public.tasks` table + indexes (Phase 1).
- `supabase/migrations/20260531000003_worker_rls.sql` — helpers + RLS hardening for `tasks`, `reservations`, clinical tables, `report_cards` (Phase 1).

**Frontend (created):**
- `src/hooks/useMyStaffMember.ts` — resolves caller's staff record by `profile_id` (Phase 2).
- `src/components/auth/WorkerRoute.tsx` — role guard (Phase 2).
- `src/components/worker/WorkerLayout.tsx` — mobile shell + bottom nav (Phase 2).
- `src/components/worker/WorkerBottomNav.tsx` — Mi día · Avisos · Perfil (Phase 2).
- `src/pages/worker/MyDayPage.tsx` — unified feed (Phase 2).
- `src/pages/worker/WorkerTaskDetailPage.tsx` — task/reservation detail + actions (Phase 2/4).
- `src/pages/worker/WorkerNoticesPage.tsx` (Phase 2).
- `src/pages/worker/WorkerProfilePage.tsx` (Phase 2).
- `src/hooks/queries/useMyDay.ts` — merged reservations+tasks feed (Phase 2).
- `src/hooks/queries/useTasks.ts` — tasks CRUD (Phase 3).
- `src/components/tasks/TaskFormModal.tsx` — admin create/assign task (Phase 3).
- `src/pages/TasksPage.tsx` — admin task board (Phase 3).
- `src/components/worker/reports/ReportRouter.tsx` — picks form by specialty (Phase 4).
- `src/components/worker/reports/TrainerReportForm.tsx` (Phase 4).
- `src/components/worker/reports/VetReportForm.tsx` (Phase 4).
- `src/components/worker/reports/CleaningReportForm.tsx` (Phase 4).
- `src/components/worker/reports/WelfareReportForm.tsx` (Phase 4).
- `src/components/worker/reports/GroomerReportForm.tsx` (Phase 4).
- `src/lib/worker.ts` — shared constants: `Specialty`, `SPECIALTY_LABELS`, `TASK_TYPE_BY_SPECIALTY`, status maps (Phase 1/2).

**Frontend (modified):**
- `src/contexts/OrganizationContext.tsx` — `OrgRole` union → add `worker`, drop `trainer` (Phase 2).
- `src/hooks/usePermission.ts` — add scheduler-related permission entry (Phase 3).
- `src/lib/schemas.ts` — `staffRoleSchema` enum update + `specialtySchema` (Phase 2).
- `src/types/index.ts` — `TRAINER` enum reference (Phase 2).
- `src/components/settings/StaffManagementTab.tsx` — role dropdown values + specialty field (Phase 2).
- `src/components/settings/InviteMembersTab.tsx` — role options (Phase 2).
- `src/pages/StaffPage.tsx` — stat label `trainer` → `worker` (Phase 2).
- `src/App.tsx` — mount `/:orgSlug/worker` tree + login redirect-by-role (Phase 2).
- `src/components/report-cards/ReportCardModal.tsx` — staff query filter by specialty (Phase 4, optional).
- `src/integrations/supabase/types.ts` — regenerated after each migration.

**Tests (created):**
- `tests/sql/worker_rls.md` — hand-run RLS assertions for worker isolation (Phase 1).
- `tests/sql/tasks.md` — tasks RLS + scheduler-only insert (Phase 3).

---

# Phase 1 — Data model: role/specialty migration + `tasks` table + RLS

**Goal:** Land the schema and security foundation. After this phase the DB has the new enum, `staff_members.specialty`, the `tasks` table, and worker-scoped RLS — verifiable purely via SQL, with no frontend changes shipped yet. Independently shippable: the admin app keeps working because `worker` behaves like the old `trainer` for operational tables and existing rows are migrated.

**Migrations involved:** three new files (enum+specialty, tasks, RLS) in the order below. **Ordering is load-bearing** and the enum migration is the single riskiest step (see Risk).

> **BLOCKER:** Task 1.6 (reservations RLS) depends on branch `fix/reservations-anon-rls` having landed (drops the `Anon full access reservations` policy). Do not merge Phase 1 to a deploy branch until that fix is in the migration history ahead of `20260531000003_worker_rls.sql`. The migration is defensively self-correcting (it re-drops the anon policy) but coordinate the merge order.

### Task 1.1: Enum migration — add `worker`, migrate `trainer` data, drop `trainer`

**Files:**
- Create: `supabase/migrations/20260531000001_worker_role_specialty.sql`

Postgres cannot `ALTER TYPE ... DROP VALUE`. To rename `trainer`→`worker` while keeping the other values and adding nothing new, the safe approach is **rename in place** (`ALTER TYPE ... RENAME VALUE 'trainer' TO 'worker'`), which preserves all existing column data automatically and needs no table rewrite. Then add `specialty` and back-fill specialty from the old role.

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================================
-- Worker View · Fase 1a — separar ROL (permiso) de ESPECIALIDAD (oficio).
--
-- app_role pasa de ('admin','front_desk','trainer','manager')
--          a       ('admin','front_desk','worker','manager').
-- Estrategia: RENAME VALUE 'trainer' -> 'worker' (preserva TODOS los datos
-- existentes sin reescritura de tablas; no se puede DROP VALUE en un enum).
-- El orden lógico admin/manager/front_desk/worker del spec es cosmético; el
-- enum mantiene su orden físico — la app no depende del orden del enum.
--
-- specialty: columna nueva en staff_members (una sola por staff, YAGNI).
-- Back-fill: quien era 'trainer' queda role='worker' + specialty='trainer'.
--
-- Idempotente: guards con bloques DO/IF para poder re-correr.
-- ============================================================================

-- 1. Renombrar el valor del enum (no-op si ya está renombrado).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'trainer'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'worker'
  ) THEN
    ALTER TYPE public.app_role RENAME VALUE 'trainer' TO 'worker';
  END IF;
END $$;

-- 2. Nueva columna specialty (texto libre con CHECK extensible; NO enum, para
--    poder ampliar especialidades sin migraciones de enum).
ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS specialty text;

-- CHECK extensible (lista inicial del spec). Se hace DROP+ADD por idempotencia.
ALTER TABLE public.staff_members
  DROP CONSTRAINT IF EXISTS staff_members_specialty_check;
ALTER TABLE public.staff_members
  ADD CONSTRAINT staff_members_specialty_check
  CHECK (specialty IS NULL OR specialty IN
    ('trainer','groomer','cleaning','welfare','vet'));

-- 3. Back-fill: los staff que quedaron como 'worker' por el rename y que aún no
--    tienen especialidad → specialty='trainer' (eran entrenadores).
UPDATE public.staff_members
  SET specialty = 'trainer'
  WHERE role = 'worker' AND specialty IS NULL;

-- 4. Cambiar el DEFAULT del rol de staff (antes 'trainer').
ALTER TABLE public.staff_members ALTER COLUMN role SET DEFAULT 'worker';
```

- [ ] **Step 2: Apply locally and verify the rename + back-fill**

Run: `supabase db reset` (applies all migrations from scratch on the local DB).
Then in `psql` / Supabase SQL editor:
```sql
SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
 WHERE t.typname='app_role' ORDER BY e.enumsortorder;
-- Expected: admin, front_desk, worker, manager  (no 'trainer')
SELECT role, specialty, count(*) FROM public.staff_members GROUP BY 1,2;
-- Expected: any former trainers now (worker, trainer); no rows with role='trainer'.
```
Expected: no `trainer` enum label; former trainers carry `specialty='trainer'`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260531000001_worker_role_specialty.sql
git commit -m "feat(worker): migra app_role trainer→worker y añade staff_members.specialty"
```

### Task 1.2: Create the `tasks` table

**Files:**
- Create: `supabase/migrations/20260531000002_tasks_table.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================================
-- Worker View · Fase 1b — tabla `tasks` (trabajo ligero que NO es reserva:
-- aseo de zona, rondas de alimentación, paseos, chequeo veterinario).
-- RLS se añade en 20260531000003_worker_rls.sql (este archivo solo crea la
-- tabla + índices y la habilita para RLS).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type              text NOT NULL CHECK (type IN ('cleaning','feeding','walk','vet_check','grooming','other')),
  title             text NOT NULL,
  dog_id            uuid REFERENCES public.dogs(id) ON DELETE SET NULL,
  zone_id           uuid REFERENCES public.facility_zones(id) ON DELETE SET NULL,
  assignee_staff_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  due_at            timestamptz,
  priority          text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','skipped')),
  notes             text,
  report_data       jsonb,            -- estructura de reporte por especialidad (welfare/cleaning/groomer)
  photos            text[],           -- urls de fotos del reporte
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at      timestamptz,
  completed_by      uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_tasks_org        ON public.tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee   ON public.tasks(assignee_staff_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due        ON public.tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_status     ON public.tasks(status);

-- Trigger updated_at (reusa el patrón existente si hay una función genérica;
-- si no existe public.set_updated_at, créala aquí de forma idempotente).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS tasks_set_updated_at ON public.tasks;
CREATE TRIGGER tasks_set_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

- [ ] **Step 2: Apply and verify**

Run: `supabase db reset`
```sql
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name='tasks' ORDER BY ordinal_position;
```
Expected: all columns present, `tasks` exists with RLS enabled.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260531000002_tasks_table.sql
git commit -m "feat(worker): crea tabla public.tasks (trabajo ligero no-reserva)"
```

### Task 1.3: RLS helpers — `get_my_staff_ids()` and `get_scheduler_org_ids()` and specialty validators

**Files:**
- Create (start of): `supabase/migrations/20260531000003_worker_rls.sql`

- [ ] **Step 1: Write the helper section**

```sql
-- ============================================================================
-- Worker View · Fase 1c — RLS por rol/especialidad/asignación.
-- Sigue el patrón existente (SECURITY DEFINER, STABLE, search_path=public,
-- SETOF uuid) de 20260530010000_role_based_rls.sql.
-- ============================================================================

-- staff_members.id del usuario autenticado (vía profile_id = auth.uid()).
CREATE OR REPLACE FUNCTION public.get_my_staff_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.staff_members WHERE profile_id = auth.uid();
$$;

-- Orgs donde el usuario puede PROGRAMAR/ASIGNAR (admin/manager/front_desk) y la
-- suscripción está vigente. Reusa la lógica de get_finance_writer_org_ids (mismos
-- roles) pero con nombre semántico propio para tareas/reservas.
CREATE OR REPLACE FUNCTION public.get_scheduler_org_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT om.organization_id
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.user_id = auth.uid()
    AND om.role IN ('admin','manager','front_desk')
    AND (o.subscription_status = 'active'
         OR (o.subscription_status = 'trialing' AND o.trial_ends_at > now()));
$$;

-- Orgs donde el usuario puede escribir CLÍNICA: admin/manager (cualquiera) o
-- worker con specialty='vet'. Cierra el hueco actual (cualquier miembro escribía
-- clínica).
CREATE OR REPLACE FUNCTION public.get_clinical_writer_org_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT om.organization_id
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.user_id = auth.uid()
    AND (o.subscription_status = 'active'
         OR (o.subscription_status = 'trialing' AND o.trial_ends_at > now()))
    AND (
      om.role IN ('admin','manager')
      OR EXISTS (
        SELECT 1 FROM public.staff_members sm
        WHERE sm.profile_id = auth.uid()
          AND sm.organization_id = om.organization_id
          AND sm.specialty = 'vet'
      )
    );
$$;

-- Orgs donde el usuario puede escribir REPORT CARDS: admin/manager o
-- worker con specialty='trainer'.
CREATE OR REPLACE FUNCTION public.get_reportcard_writer_org_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT om.organization_id
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.user_id = auth.uid()
    AND (o.subscription_status = 'active'
         OR (o.subscription_status = 'trialing' AND o.trial_ends_at > now()))
    AND (
      om.role IN ('admin','manager')
      OR EXISTS (
        SELECT 1 FROM public.staff_members sm
        WHERE sm.profile_id = auth.uid()
          AND sm.organization_id = om.organization_id
          AND sm.specialty = 'trainer'
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_my_staff_ids()              TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_scheduler_org_ids()         TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_clinical_writer_org_ids()   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reportcard_writer_org_ids() TO authenticated;
```

- [ ] **Step 2: (do not apply yet — continue in Tasks 1.4–1.6, single migration file)**

### Task 1.4: `tasks` RLS — worker sees only assigned; scheduler creates/assigns

**Files:**
- Modify (append to): `supabase/migrations/20260531000003_worker_rls.sql`

- [ ] **Step 1: Append the `tasks` policies**

```sql
-- ── tasks ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tasks read"   ON public.tasks;
DROP POLICY IF EXISTS "tasks insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks update" ON public.tasks;
DROP POLICY IF EXISTS "tasks delete" ON public.tasks;

-- SELECT: scheduler roles ven todo el tablero de su org; el worker ve SOLO las
-- tareas asignadas a él.
CREATE POLICY "tasks read" ON public.tasks FOR SELECT TO authenticated
USING (
  organization_id IN (SELECT public.get_scheduler_org_ids())
  OR assignee_staff_id IN (SELECT public.get_my_staff_ids())
);

-- INSERT/asignación: solo scheduler roles, en su org.
CREATE POLICY "tasks insert" ON public.tasks FOR INSERT TO authenticated
WITH CHECK (organization_id IN (SELECT public.get_scheduler_org_ids()));

-- UPDATE: scheduler edita cualquier tarea de su org; el worker actualiza SOLO
-- sus tareas (estado/reporte) y no puede reasignarlas a otro (el WITH CHECK
-- exige que siga asignada a él o que sea scheduler).
CREATE POLICY "tasks update" ON public.tasks FOR UPDATE TO authenticated
USING (
  organization_id IN (SELECT public.get_scheduler_org_ids())
  OR assignee_staff_id IN (SELECT public.get_my_staff_ids())
)
WITH CHECK (
  organization_id IN (SELECT public.get_scheduler_org_ids())
  OR assignee_staff_id IN (SELECT public.get_my_staff_ids())
);

-- DELETE: solo scheduler.
CREATE POLICY "tasks delete" ON public.tasks FOR DELETE TO authenticated
USING (organization_id IN (SELECT public.get_scheduler_org_ids()));
```

### Task 1.5: Clinical + report_cards RLS hardening

**Files:**
- Modify (append to): `supabase/migrations/20260531000003_worker_rls.sql`

- [ ] **Step 1: Append clinical + report_cards policies**

```sql
-- ── Clínica: SELECT a cualquier miembro; WRITE solo vet/admin/manager. ─────────
DO $$
DECLARE
  t text;
  clinical_tables text[] := ARRAY[
    'medical_history','vaccination_schedule','deworming_records','medical_conditions'
  ];
BEGIN
  FOREACH t IN ARRAY clinical_tables LOOP
    -- Limpia políticas previas (la de 20260530010000: '<t> read' / '<t> write').
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' read',  t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' write', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated '
      'USING (organization_id IN (SELECT public.get_user_org_ids()))',
      t || ' read', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
      'USING (organization_id IN (SELECT public.get_clinical_writer_org_ids())) '
      'WITH CHECK (organization_id IN (SELECT public.get_clinical_writer_org_ids()))',
      t || ' write', t);
  END LOOP;
END $$;

-- ── report_cards: SELECT miembros; WRITE solo trainer/admin/manager. ──────────
DROP POLICY IF EXISTS "Org members full access report_cards" ON public.report_cards;
DROP POLICY IF EXISTS "report_cards read"  ON public.report_cards;
DROP POLICY IF EXISTS "report_cards write" ON public.report_cards;

CREATE POLICY "report_cards read" ON public.report_cards FOR SELECT TO authenticated
USING (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "report_cards write" ON public.report_cards FOR ALL TO authenticated
USING    (organization_id IN (SELECT public.get_reportcard_writer_org_ids()))
WITH CHECK (organization_id IN (SELECT public.get_reportcard_writer_org_ids()));
```

### Task 1.6: `reservations` RLS — worker updates only own assignments (DEPENDS ON anon-fix)

**Files:**
- Modify (append to): `supabase/migrations/20260531000003_worker_rls.sql`

- [ ] **Step 1: Append reservations policies (with defensive anon drop)**

```sql
-- ── reservations: cierra el hueco anónimo (depende de fix/reservations-anon-rls;
--    drop defensivo idempotente) y restringe al worker a SUS asignaciones. ──────
DROP POLICY IF EXISTS "Anon full access reservations"        ON public.reservations;
DROP POLICY IF EXISTS "Org members full access reservations" ON public.reservations;
DROP POLICY IF EXISTS "reservations read"   ON public.reservations;
DROP POLICY IF EXISTS "reservations write"  ON public.reservations;
DROP POLICY IF EXISTS "reservations insert" ON public.reservations;
DROP POLICY IF EXISTS "reservations update" ON public.reservations;

-- SELECT: scheduler ve toda la org; worker ve SOLO reservas donde es staff_id.
CREATE POLICY "reservations read" ON public.reservations FOR SELECT TO authenticated
USING (
  organization_id IN (SELECT public.get_scheduler_org_ids())
  OR staff_id IN (SELECT public.get_my_staff_ids())
);

-- INSERT / reasignación: solo scheduler. (La app crea reservas vía RPC
-- create_reservation, SECURITY DEFINER, que bypasea RLS — sigue funcionando.)
CREATE POLICY "reservations insert" ON public.reservations FOR INSERT TO authenticated
WITH CHECK (organization_id IN (SELECT public.get_scheduler_org_ids()));

-- UPDATE: scheduler edita todo; worker actualiza SOLO sus reservas (estado), sin
-- poder reasignar (WITH CHECK exige seguir siendo el staff_id o ser scheduler).
CREATE POLICY "reservations update" ON public.reservations FOR UPDATE TO authenticated
USING (
  organization_id IN (SELECT public.get_scheduler_org_ids())
  OR staff_id IN (SELECT public.get_my_staff_ids())
)
WITH CHECK (
  organization_id IN (SELECT public.get_scheduler_org_ids())
  OR staff_id IN (SELECT public.get_my_staff_ids())
);

-- DELETE: solo scheduler.
DROP POLICY IF EXISTS "reservations delete" ON public.reservations;
CREATE POLICY "reservations delete" ON public.reservations FOR DELETE TO authenticated
USING (organization_id IN (SELECT public.get_scheduler_org_ids()));
```

- [ ] **Step 2: Apply the full RLS migration**

Run: `supabase db reset`
Expected: no errors; all three migrations apply cleanly.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260531000003_worker_rls.sql
git commit -m "feat(worker): RLS por rol/especialidad/asignación (tasks, reservations, clínica, report_cards)"
```

### Task 1.7: Hand-run SQL verification (`tests/sql/worker_rls.md`)

**Files:**
- Create: `tests/sql/worker_rls.md`

- [ ] **Step 1: Write the assertion doc** (follows the `tests/sql/rls_roles.md` format)

```markdown
# Verificación SQL — Worker View (RLS por rol/especialidad/asignación)

> Sin harness pg. Ejecutar contra BD local tras `supabase db reset`, impersonando
> usuarios con `SET request.jwt.claim.sub`. Migraciones:
> 20260531000001_worker_role_specialty.sql, _000002_tasks_table.sql, _000003_worker_rls.sql.
> DEPENDE de fix/reservations-anon-rls (la política anónima debe estar eliminada).

## Fixtures
- Org A activa. Staff con profile_id (usuarios auth):
  - U_admin (organization_members.role=admin)
  - U_fd    (role=front_desk)  -- scheduler
  - U_vet   (role=worker, staff_members.specialty=vet)
  - U_train (role=worker, staff_members.specialty=trainer)
  - U_clean (role=worker, staff_members.specialty=cleaning)
- Tareas: T1 assignee=U_clean, T2 assignee=U_train. Reservas: R1 staff_id=U_train.

## Aserciones — tasks
1. worker ve solo lo suyo. sub=U_clean: SELECT count(*) FROM tasks → ve T1, NO T2.
2. scheduler ve todo. sub=U_fd: SELECT count(*) FROM tasks → ve T1 y T2.
3. worker NO inserta tareas. sub=U_clean: INSERT INTO tasks(...) org A → bloqueado.
4. scheduler SÍ inserta/asigna. sub=U_fd: INSERT INTO tasks(... assignee=U_clean) → OK.
5. worker actualiza su tarea (estado). sub=U_clean: UPDATE tasks SET status='done' WHERE id=T1 → 1 fila.
6. worker NO actualiza tarea de otro. sub=U_clean: UPDATE tasks SET status='done' WHERE id=T2 → 0 filas.
7. worker NO se reasigna ajena. sub=U_clean: UPDATE tasks SET assignee_staff_id=<U_clean staff> WHERE id=T2 → 0 filas (no la ve).

## Aserciones — reservations
8. worker ve solo sus reservas. sub=U_train: ve R1. sub=U_clean: NO ve R1.
9. worker actualiza estado de su reserva. sub=U_train: UPDATE reservations SET status='in_progress' WHERE id=R1 → 1 fila.
10. worker NO crea/reasigna reserva. sub=U_train: INSERT INTO reservations(...) → bloqueado;
    UPDATE reservations SET staff_id=<otro> WHERE id=R1 → 0 filas (WITH CHECK falla).
11. NINGÚN acceso anónimo. sub=anon (sin jwt): SELECT * FROM reservations → 0 filas / bloqueado.

## Aserciones — clínica
12. vet escribe clínica. sub=U_vet: INSERT INTO medical_history(dog_id,dog_name,...) org A → OK.
13. trainer NO escribe clínica. sub=U_train: INSERT INTO vaccination_schedule(...) org A → bloqueado.
14. todos LEEN clínica. sub=U_clean: SELECT count(*) FROM medical_conditions org A → ve filas.

## Aserciones — report_cards
15. trainer escribe report card. sub=U_train: INSERT INTO report_cards(...) → OK.
16. cleaning NO escribe report card. sub=U_clean: INSERT INTO report_cards(...) → bloqueado.
17. admin/manager escriben ambas (clínica y report cards) sin importar especialidad.
```

- [ ] **Step 2: Run the assertions manually against the local DB** and record PASS/FAIL inline. Fix any policy that fails before proceeding.

- [ ] **Step 3: Regenerate types and typecheck**

Run: `supabase gen types typescript --local > src/integrations/supabase/types.ts`
Run: `npm run build` (or `npx tsc --noEmit`)
Expected: `tasks` appears in generated types; `app_role` union is now `"admin" | "front_desk" | "worker" | "manager"`. Build will FAIL on `OrgRole`/`trainer` references — those are fixed in Phase 2 (this confirms the breakage surface). Note the failures and move to Phase 2; do not patch types here.

- [ ] **Step 4: Commit**

```bash
git add tests/sql/worker_rls.md src/integrations/supabase/types.ts
git commit -m "test(worker): aserciones SQL de RLS + regenera types.ts"
```

**Phase 1 ordering & risk:**
- **Order is mandatory:** `_000001` (enum/specialty) → `_000002` (tasks) → `_000003` (RLS, which references `staff_members.specialty` and `tasks`).
- **Riskiest step: the enum migration (Task 1.1).** It mutates a live enum that has existing data in `organization_members.role`, `staff_members.role`, `user_roles.role`, `invitations.role`. `ALTER TYPE ... RENAME VALUE` is chosen specifically because it preserves all existing rows with zero table rewrite and is transactional. **Mitigation:** the rename is guarded by an idempotent `DO` block; back-fill is conditional (`WHERE specialty IS NULL`); test on a `supabase db reset` clone before pushing; take a DB snapshot/backup before `supabase db push` to prod; confirm no code literally compares against `'trainer'` at the DB level (none does — role gating is via the helper functions, which only reference admin/manager/front_desk).

---

# Phase 2 — Routing + guard + worker shell ("Mi día" showing reservations)

**Goal:** A logged-in `worker` is redirected to `/:orgSlug/worker`, sees a mobile-first shell (bottom nav: Mi día · Avisos · Perfil), and "Mi día" lists their assigned reservations grouped by status. Admin roles are blocked from `/worker` and workers are blocked from admin routes. Independently shippable: tasks-feed integration and report forms come later; this phase wires the navigation and the reservations half of the feed.

**Migrations involved:** none.

### Task 2.1: Update the `OrgRole` union and shared specialty constants

**Files:**
- Modify: `src/contexts/OrganizationContext.tsx:24`
- Create: `src/lib/worker.ts`

- [ ] **Step 1: Update `OrgRole`**

In `src/contexts/OrganizationContext.tsx` change:
```ts
export type OrgRole = "admin" | "manager" | "front_desk" | "trainer";
```
to:
```ts
export type OrgRole = "admin" | "manager" | "front_desk" | "worker";
```

- [ ] **Step 2: Create `src/lib/worker.ts`**

```ts
export type Specialty = "trainer" | "groomer" | "cleaning" | "welfare" | "vet";

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  trainer: "Entrenador",
  groomer: "Grooming",
  cleaning: "Aseo",
  welfare: "Bienestar animal",
  vet: "Veterinario",
};

export type TaskType = "cleaning" | "feeding" | "walk" | "vet_check" | "grooming" | "other";

export const TASK_TYPE_BY_SPECIALTY: Record<Specialty, TaskType[]> = {
  trainer: ["other"],
  groomer: ["grooming"],
  cleaning: ["cleaning"],
  welfare: ["feeding", "walk"],
  vet: ["vet_check"],
};

export type WorkStatus = "pending" | "in_progress" | "done" | "skipped";

export const STATUS_LABELS: Record<"pending" | "in_progress" | "done", string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  done: "Hecho",
};

/** Maps a reservation status to the worker feed bucket. */
export function reservationBucket(status: string): "pending" | "in_progress" | "done" {
  if (["completed", "picked_up", "ready"].includes(status)) return "done";
  if (["in_progress", "checked_in"].includes(status)) return "in_progress";
  return "pending";
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: remaining errors only in `usePermission.ts` (uses `OrgRole`, fine), `schemas.ts`, settings tabs, `StaffPage.tsx`, `types/index.ts` — fixed in 2.2.

- [ ] **Step 4: Commit**

```bash
git add src/contexts/OrganizationContext.tsx src/lib/worker.ts
git commit -m "feat(worker): OrgRole worker + constantes de especialidad/estado"
```

### Task 2.2: Fix remaining `trainer` references in role-typed code

**Files:**
- Modify: `src/lib/schemas.ts:24`
- Modify: `src/types/index.ts:11`
- Modify: `src/components/settings/StaffManagementTab.tsx:44,75,96` (+ add specialty field)
- Modify: `src/components/settings/InviteMembersTab.tsx:147`
- Modify: `src/pages/StaffPage.tsx:11,17,28,72`

- [ ] **Step 1: `src/lib/schemas.ts` — role enum + specialty schema**

Replace:
```ts
export const staffRoleSchema = z.enum(["admin", "front_desk", "trainer", "manager"]);
```
with:
```ts
export const staffRoleSchema = z.enum(["admin", "front_desk", "worker", "manager"]);
export const specialtySchema = z.enum(["trainer", "groomer", "cleaning", "welfare", "vet"]);
```

- [ ] **Step 2: `src/types/index.ts`** — change the `TRAINER = 'trainer'` enum member to `WORKER = 'worker'` (and update any single reference; `trainerId` on report-card-related types stays — it refers to the `report_cards.trainer_id` DB column which is unchanged).

- [ ] **Step 3: `StaffManagementTab.tsx`** — change `type AppRole = "admin" | "front_desk" | "trainer" | "manager"` to `... | "worker" | ...`; default `useState<AppRole>("worker")`; reset to `"worker"`. Add a `specialty` select (options from `SPECIALTY_LABELS` in `@/lib/worker`) bound to a new `specialty` state, included in the insert/update payload to `staff_members`. Show the specialty select only when role is `worker`.

```tsx
// near other state
const [specialty, setSpecialty] = useState<Specialty | "">("");
// in the form, when role === "worker":
<Select value={specialty} onValueChange={(v) => setSpecialty(v as Specialty)}>
  <SelectTrigger><SelectValue placeholder="Especialidad" /></SelectTrigger>
  <SelectContent>
    {Object.entries(SPECIALTY_LABELS).map(([v, label]) => (
      <SelectItem key={v} value={v}>{label}</SelectItem>
    ))}
  </SelectContent>
</Select>
// include specialty: role === "worker" ? (specialty || null) : null  in the payload
```
Import `Specialty, SPECIALTY_LABELS` from `@/lib/worker`.

- [ ] **Step 4: `InviteMembersTab.tsx:147`** — replace `<SelectItem value="trainer">Entrenador</SelectItem>` with `<SelectItem value="worker">Trabajador</SelectItem>`.

- [ ] **Step 5: `StaffPage.tsx`** — rename stat `trainers` → `workers` (field, label, and the filter `s.role === "trainer"` → `s.role === "worker"`); update the displayed label to "Trabajadores".

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no `trainer` role literals remain in role-typed code).

- [ ] **Step 7: Commit**

```bash
git add src/lib/schemas.ts src/types/index.ts src/components/settings/StaffManagementTab.tsx src/components/settings/InviteMembersTab.tsx src/pages/StaffPage.tsx
git commit -m "feat(worker): UI de roles usa 'worker' + selector de especialidad en staff"
```

### Task 2.3: `useMyStaffMember` hook

**Files:**
- Create: `src/hooks/useMyStaffMember.ts`

- [ ] **Step 1: Write the hook**

```ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import type { Specialty } from "@/lib/worker";

export interface MyStaffMember {
  id: string;
  first_name: string;
  last_name: string;
  specialty: Specialty | null;
  role: string;
}

export function useMyStaffMember() {
  const { user } = useAuth();
  const { organization } = useOrganization();

  return useQuery({
    queryKey: ["my-staff", organization?.id, user?.id],
    enabled: !!organization?.id && !!user?.id,
    queryFn: async (): Promise<MyStaffMember | null> => {
      const { data, error } = await supabase
        .from("staff_members")
        .select("id, first_name, last_name, specialty, role")
        .eq("organization_id", organization!.id)
        .eq("profile_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as MyStaffMember) ?? null;
    },
  });
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → PASS
```bash
git add src/hooks/useMyStaffMember.ts
git commit -m "feat(worker): hook useMyStaffMember (mapea auth user → staff_members)"
```

### Task 2.4: `WorkerRoute` guard

**Files:**
- Create: `src/components/auth/WorkerRoute.tsx`

- [ ] **Step 1: Write the guard** (mirrors `OrgGuard` structure; must run *inside* an `OrganizationProvider`, so it is mounted under the existing org tree — see Task 2.6)

```tsx
import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";

/** Allows only role=worker. Other roles → admin dashboard. */
export function WorkerRoute() {
  const { loading, currentUserRole, organization } = useOrganization();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (currentUserRole && currentUserRole !== "worker") {
    return <Navigate to={`/${organization?.slug}/dashboard`} replace />;
  }
  return <Outlet />;
}

/** Blocks role=worker from admin routes → /worker. */
export function AdminOnlyRoute() {
  const { loading, currentUserRole, organization } = useOrganization();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (currentUserRole === "worker") {
    return <Navigate to={`/${organization?.slug}/worker`} replace />;
  }
  return <Outlet />;
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
git add src/components/auth/WorkerRoute.tsx
git commit -m "feat(worker): guards WorkerRoute y AdminOnlyRoute"
```

### Task 2.5: Worker shell — layout + bottom nav + placeholder pages

**Files:**
- Create: `src/components/worker/WorkerLayout.tsx`
- Create: `src/components/worker/WorkerBottomNav.tsx`
- Create: `src/pages/worker/WorkerNoticesPage.tsx`
- Create: `src/pages/worker/WorkerProfilePage.tsx`

- [ ] **Step 1: `WorkerBottomNav.tsx`**

```tsx
import { NavLink } from "react-router-dom";
import { CalendarDays, Bell, User } from "lucide-react";
import { useOrgBasePath } from "@/hooks/useOrgNavigate";

export function WorkerBottomNav() {
  const base = useOrgBasePath();
  const items = [
    { to: `${base}/worker`, label: "Mi día", icon: CalendarDays, end: true },
    { to: `${base}/worker/notices`, label: "Avisos", icon: Bell, end: false },
    { to: `${base}/worker/profile`, label: "Perfil", icon: User, end: false },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t bg-background">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 py-2 text-xs ${isActive ? "text-primary" : "text-muted-foreground"}`
          }>
          <Icon className="h-5 w-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: `WorkerLayout.tsx`**

```tsx
import { Outlet } from "react-router-dom";
import { WorkerBottomNav } from "./WorkerBottomNav";

export function WorkerLayout() {
  return (
    <div className="min-h-screen bg-background pb-16">
      <main className="mx-auto max-w-md px-4 pt-4">
        <Outlet />
      </main>
      <WorkerBottomNav />
    </div>
  );
}
```

- [ ] **Step 3: `WorkerProfilePage.tsx`** (data + specialty + sign-out)

```tsx
import { useMyStaffMember } from "@/hooks/useMyStaffMember";
import { SPECIALTY_LABELS } from "@/lib/worker";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export default function WorkerProfilePage() {
  const { data: staff } = useMyStaffMember();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Perfil</h1>
      {staff && (
        <div className="rounded-lg border p-4">
          <p className="font-medium">{staff.first_name} {staff.last_name}</p>
          <p className="text-sm text-muted-foreground">
            {staff.specialty ? SPECIALTY_LABELS[staff.specialty] : "Sin especialidad"}
          </p>
        </div>
      )}
      <Button variant="outline" className="w-full" onClick={() => supabase.auth.signOut()}>
        Cerrar sesión
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: `WorkerNoticesPage.tsx`** (reuses notices data; minimal list)

```tsx
import { useNotices } from "@/hooks/queries/useNotices";

export default function WorkerNoticesPage() {
  const { data } = useNotices();
  const notices = (data as { notices?: Array<{ id: string; title: string; body?: string }> } | undefined)?.notices ?? [];
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Avisos</h1>
      {notices.length === 0 && <p className="text-sm text-muted-foreground">Sin avisos.</p>}
      {notices.map((n) => (
        <div key={n.id} className="rounded-lg border p-3">
          <p className="font-medium">{n.title}</p>
          {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
        </div>
      ))}
    </div>
  );
}
```
> Note: confirm `useNotices` return shape in `src/hooks/queries/useNotices.ts`; adapt the destructure to match its actual signature.

- [ ] **Step 5: Typecheck + commit**

```bash
git add src/components/worker/ src/pages/worker/WorkerNoticesPage.tsx src/pages/worker/WorkerProfilePage.tsx
git commit -m "feat(worker): shell (layout + bottom nav) + páginas Avisos/Perfil"
```

### Task 2.6: "Mi día" feed (reservations only for now) + `useMyDay` hook

**Files:**
- Create: `src/hooks/queries/useMyDay.ts`
- Create: `src/pages/worker/MyDayPage.tsx`

- [ ] **Step 1: `useMyDay.ts`** (reservations half; tasks added in Phase 3)

```ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useMyStaffMember } from "@/hooks/useMyStaffMember";
import { reservationBucket } from "@/lib/worker";

export interface FeedItem {
  kind: "reservation" | "task";
  id: string;
  title: string;
  dogName: string | null;
  dogId: string | null;
  time: string | null;            // ISO
  bucket: "pending" | "in_progress" | "done";
  status: string;
  flags: { aggressive: boolean; allergies: boolean; medication: boolean };
}

export function useMyDay() {
  const { organization } = useOrganization();
  const { data: staff } = useMyStaffMember();

  return useQuery({
    queryKey: ["my-day", organization?.id, staff?.id],
    enabled: !!organization?.id && !!staff?.id,
    queryFn: async (): Promise<FeedItem[]> => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date();   end.setHours(23, 59, 59, 999);

      const { data: res, error } = await supabase
        .from("reservations")
        .select("id, service_name, status, start_date, dog_id, dogs(name, is_aggressive, has_allergies, on_medication)")
        .eq("organization_id", organization!.id)
        .eq("staff_id", staff!.id)
        .gte("start_date", start.toISOString())
        .lte("start_date", end.toISOString())
        .order("start_date", { ascending: true });
      if (error) throw error;

      return (res ?? []).map((r: any): FeedItem => ({
        kind: "reservation",
        id: r.id,
        title: r.service_name,
        dogName: r.dogs?.name ?? null,
        dogId: r.dog_id,
        time: r.start_date,
        bucket: reservationBucket(r.status),
        status: r.status,
        flags: {
          aggressive: !!r.dogs?.is_aggressive,
          allergies: !!r.dogs?.has_allergies,
          medication: !!r.dogs?.on_medication,
        },
      }));
    },
  });
}
```

- [ ] **Step 2: `MyDayPage.tsx`** (groups by bucket, alert flags, links to detail)

```tsx
import { useMyDay, type FeedItem } from "@/hooks/queries/useMyDay";
import { STATUS_LABELS } from "@/lib/worker";
import { useOrgNavigate } from "@/hooks/useOrgNavigate";
import { AlertTriangle, Pill, Leaf } from "lucide-react";

const BUCKETS = ["pending", "in_progress", "done"] as const;

export default function MyDayPage() {
  const { data = [], isLoading } = useMyDay();
  const navigate = useOrgNavigate();
  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Mi día</h1>
      {BUCKETS.map((b) => {
        const items = data.filter((i) => i.bucket === b);
        if (items.length === 0) return null;
        return (
          <section key={b} className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">{STATUS_LABELS[b]}</h2>
            {items.map((item: FeedItem) => (
              <button key={`${item.kind}-${item.id}`}
                onClick={() => navigate(`/worker/${item.kind}/${item.id}`)}
                className="flex w-full items-center justify-between rounded-lg border p-3 text-left">
                <div>
                  <p className="font-medium">{item.dogName ?? item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.title}{item.time ? ` · ${new Date(item.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  {item.flags.aggressive && <AlertTriangle className="h-4 w-4 text-destructive" />}
                  {item.flags.allergies && <Leaf className="h-4 w-4 text-amber-600" />}
                  {item.flags.medication && <Pill className="h-4 w-4 text-blue-600" />}
                </div>
              </button>
            ))}
          </section>
        );
      })}
      {data.length === 0 && <p className="text-sm text-muted-foreground">No tienes trabajo asignado hoy.</p>}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
git add src/hooks/queries/useMyDay.ts src/pages/worker/MyDayPage.tsx
git commit -m "feat(worker): Mi día (reservas asignadas, agrupadas por estado)"
```

### Task 2.7: Wire routes + role-based redirect

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add lazy imports and the worker route tree, and wrap admin layout in `AdminOnlyRoute`**

In `src/App.tsx` add imports:
```tsx
import { WorkerRoute, AdminOnlyRoute } from "@/components/auth/WorkerRoute";
import { WorkerLayout } from "@/components/worker/WorkerLayout";
const MyDayPage             = lazy(() => import("./pages/worker/MyDayPage"));
const WorkerTaskDetailPage  = lazy(() => import("./pages/worker/WorkerTaskDetailPage")); // created in Phase 4; placeholder OK in P2
const WorkerNoticesPage     = lazy(() => import("./pages/worker/WorkerNoticesPage"));
const WorkerProfilePage     = lazy(() => import("./pages/worker/WorkerProfilePage"));
```
Change the org subtree so the admin layout sits behind `AdminOnlyRoute` and add a sibling `/worker` tree behind `WorkerRoute` (both inside the same `<Route path="/:orgSlug" element={<OrgGuard/>}>`, so `OrganizationProvider`/`currentUserRole` is available):
```tsx
<Route path="/:orgSlug" element={<OrgGuard />}>
  {/* Worker view */}
  <Route path="worker" element={<WorkerRoute />}>
    <Route element={<WorkerLayout />}>
      <Route index element={<MyDayPage />} />
      <Route path="reservation/:id" element={<WorkerTaskDetailPage />} />
      <Route path="task/:id" element={<WorkerTaskDetailPage />} />
      <Route path="notices" element={<WorkerNoticesPage />} />
      <Route path="profile" element={<WorkerProfilePage />} />
    </Route>
  </Route>

  {/* Admin view (blocked for workers) */}
  <Route element={<AdminOnlyRoute />}>
    <Route element={<AppLayout />}>
      {/* ...existing admin routes unchanged... */}
    </Route>
  </Route>
</Route>
```
For Phase 2, create a minimal `src/pages/worker/WorkerTaskDetailPage.tsx` placeholder (renders the dog name + a "próximamente" message) so the route resolves; it is fleshed out in Phase 4.

- [ ] **Step 2: Role-based redirect on entry**

The cleanest hook point is the org index route. Replace the admin `index` redirect so workers land on `/worker`. Add a tiny redirector component (in `src/components/auth/RoleHome.tsx`):
```tsx
import { Navigate } from "react-router-dom";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Loader2 } from "lucide-react";
export function RoleHome() {
  const { loading, currentUserRole } = useOrganization();
  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  return <Navigate to={currentUserRole === "worker" ? "worker" : "dashboard"} replace />;
}
```
Mount it as the index of `/:orgSlug` (above both subtrees):
```tsx
<Route index element={<RoleHome />} />
```
and remove the now-redundant `<Route index element={<Navigate to="dashboard" replace />} />` inside `AppLayout`.

- [ ] **Step 3: Verify in the running app**

Run: `npm run dev`. Log in as a `worker` (set a test staff member's `organization_members.role='worker'` and `staff_members.profile_id` to that user) → landing on `/:orgSlug` redirects to `/:orgSlug/worker`, shows Mi día with their reservations, bottom nav works, and navigating to `/:orgSlug/dashboard` bounces back to `/worker`. Log in as `admin` → lands on `/dashboard`, and `/worker` bounces to `/dashboard`.

- [ ] **Step 4: Typecheck + build + commit**

Run: `npm run build` → PASS
```bash
git add src/App.tsx src/components/auth/RoleHome.tsx src/pages/worker/WorkerTaskDetailPage.tsx
git commit -m "feat(worker): rutas /worker + guards + redirección por rol al entrar"
```

---

# Phase 3 — Non-reservation tasks: admin creation/assignment + tasks in the feed

**Goal:** `front_desk`/`manager`/`admin` can create and assign `tasks` from the admin app; those tasks appear in the worker's "Mi día" merged with reservations. Independently shippable: report forms (Phase 4) still pending, but workers can already see and open tasks.

**Migrations involved:** none (table + RLS already exist from Phase 1).

### Task 3.1: `useTasks` data hooks

**Files:**
- Create: `src/hooks/queries/useTasks.ts`

- [ ] **Step 1: Write the hook** (mirrors `useReportCards.ts` conventions)

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

function taskKeys(orgId: string | undefined) {
  return {
    all: ["tasks", orgId] as const,
    list: () => ["tasks", orgId, "list"] as const,
  };
}

export function useTasks() {
  const { organization } = useOrganization();
  return useQuery({
    queryKey: taskKeys(organization?.id).list(),
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, dogs(id, name), facility_zones(id, name), staff_members:assignee_staff_id(id, first_name, last_name)")
        .eq("organization_id", organization!.id)
        .order("due_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({ ...input, organization_id: organization!.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys(organization?.id).all }),
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { data, error } = await supabase
        .from("tasks").update(patch as any).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys(organization?.id).all });
      queryClient.invalidateQueries({ queryKey: ["my-day"] });
    },
  });
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
git add src/hooks/queries/useTasks.ts
git commit -m "feat(tasks): hooks useTasks/useCreateTask/useUpdateTask"
```

### Task 3.2: Admin task board page + create/assign modal

**Files:**
- Create: `src/pages/TasksPage.tsx`
- Create: `src/components/tasks/TaskFormModal.tsx`
- Modify: `src/App.tsx` (add `tasks` admin route)
- Modify: `src/hooks/usePermission.ts` (add `manage_tasks` permission)

- [ ] **Step 1: `usePermission.ts` — add `manage_tasks`**

Add `"manage_tasks"` to the `Permission` union and to `PERMISSIONS`:
```ts
manage_tasks: ["admin", "manager", "front_desk"],
```

- [ ] **Step 2: `TaskFormModal.tsx`** — form with `type` (select from task types), `title`, optional `dog_id` (dog picker), optional `zone_id`, `assignee_staff_id` (staff picker, filtered to `role='worker'`), `due_at`, `priority`. On submit calls `useCreateTask`. Use shadcn `Dialog`, `Select`, `Input`. Validate with a Zod schema (`type`, `title` required).

```tsx
// key fields — full component follows StaffManagementTab modal structure
const TASK_TYPES = ["cleaning","feeding","walk","vet_check","grooming","other"] as const;
// assignee options: query staff_members where role='worker' (reuse a small inline query)
// onSubmit: createTask.mutate({ type, title, dog_id, zone_id, assignee_staff_id, due_at, priority })
```

- [ ] **Step 3: `TasksPage.tsx`** — board grouped by status (Pendiente/En curso/Hecho), each card shows title, dog/zone, assignee, due time, priority badge. "Nueva tarea" button (gated by `usePermission("manage_tasks")`) opens `TaskFormModal`. Uses `useTasks`.

- [ ] **Step 4: `App.tsx`** — add lazy import and route under the admin `AppLayout`:
```tsx
const TasksPage = lazy(() => import("./pages/TasksPage"));
// inside AppLayout routes:
<Route path="tasks" element={<TasksPage />} />
```
Add a sidebar nav entry for "Tareas" in `src/components/navigation/` (follow the existing nav-item pattern; gate visibility on `usePermission("manage_tasks")`).

- [ ] **Step 5: Verify in app** — as `front_desk`, create a task assigned to a worker; confirm it appears on the board.

- [ ] **Step 6: Typecheck + build + commit**

```bash
git add src/pages/TasksPage.tsx src/components/tasks/TaskFormModal.tsx src/App.tsx src/hooks/usePermission.ts src/components/navigation/
git commit -m "feat(tasks): tablero admin + modal de creación/asignación de tareas"
```

### Task 3.3: Merge tasks into "Mi día"

**Files:**
- Modify: `src/hooks/queries/useMyDay.ts`

- [ ] **Step 1: Add the tasks query and merge** into the existing `queryFn` (after the reservations fetch), mapping `tasks.status` directly to the bucket (`pending`/`in_progress`/`done`; treat `skipped` as `done`), and resolving flags from the joined dog:

```ts
const { data: tasks, error: tErr } = await supabase
  .from("tasks")
  .select("id, title, type, status, due_at, dog_id, dogs(name, is_aggressive, has_allergies, on_medication)")
  .eq("organization_id", organization!.id)
  .eq("assignee_staff_id", staff!.id)
  .gte("due_at", start.toISOString())
  .lte("due_at", end.toISOString());
if (tErr) throw tErr;

const taskItems: FeedItem[] = (tasks ?? []).map((t: any) => ({
  kind: "task",
  id: t.id,
  title: t.title,
  dogName: t.dogs?.name ?? null,
  dogId: t.dog_id,
  time: t.due_at,
  bucket: t.status === "in_progress" ? "in_progress" : t.status === "pending" ? "pending" : "done",
  status: t.status,
  flags: {
    aggressive: !!t.dogs?.is_aggressive,
    allergies: !!t.dogs?.has_allergies,
    medication: !!t.dogs?.on_medication,
  },
}));

// merge + sort by time (nulls last)
return [...reservationItems, ...taskItems].sort((a, b) =>
  (a.time ?? "9").localeCompare(b.time ?? "9"));
```
(Rename the reservations result variable to `reservationItems` accordingly.)

- [ ] **Step 2: Verify in app** — worker sees both their reservation(s) and assigned task(s) in Mi día, correctly bucketed.

- [ ] **Step 3: SQL test doc for tasks**

Create `tests/sql/tasks.md` covering: scheduler-only insert, worker sees only assigned, worker cannot reassign, cross-org isolation (reuse fixtures style from `worker_rls.md`; assertions 1–7 of `worker_rls.md` already cover most — this doc focuses on cross-org and the `manage_tasks` insert path). Run the assertions.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/queries/useMyDay.ts tests/sql/tasks.md
git commit -m "feat(worker): fusiona tareas asignadas en Mi día + aserciones SQL tasks"
```

---

# Phase 4 — Per-specialty report forms

**Goal:** Closing a task/reservation opens the report form matching the worker's `specialty`; submitting writes to the correct destination table and closes the item with `status=done`, `completed_at`, `completed_by`. Independently shippable: completes the feature loop.

**Migrations involved:** none.

### Task 4.1: Detail page with primary action + report router

**Files:**
- Modify: `src/pages/worker/WorkerTaskDetailPage.tsx` (replace Phase 2 placeholder)
- Create: `src/components/worker/reports/ReportRouter.tsx`

- [ ] **Step 1: `WorkerTaskDetailPage.tsx`** — read `:id` and whether the route is `task` or `reservation` (via `useParams` + matching path or a route param). Load the item (reuse a small query against `tasks` or `reservations` filtered by id + assignment). Show dog info + alert flags. Primary button cycles: `pending` → "Iniciar" (sets `in_progress`), `in_progress` → "Completar y reportar" (opens `ReportRouter` in a sheet/dialog). Status writes use `useUpdateTask` (tasks) or a small reservation-update mutation (reservations: set `status`).

```tsx
// pseudo-structure
const { id } = useParams();
const isTask = useMatch(":orgSlug/worker/task/:id") != null; // or pass via route
// load item, render dog flags, then:
// <Button onClick={advance}>{status === "pending" ? "Iniciar" : "Completar y reportar"}</Button>
// when reporting: <ReportRouter specialty={staff.specialty} item={item} onDone={...} />
```

- [ ] **Step 2: `ReportRouter.tsx`** — picks the form by `specialty`:

```tsx
import type { Specialty } from "@/lib/worker";
import { TrainerReportForm } from "./TrainerReportForm";
import { VetReportForm } from "./VetReportForm";
import { CleaningReportForm } from "./CleaningReportForm";
import { WelfareReportForm } from "./WelfareReportForm";
import { GroomerReportForm } from "./GroomerReportForm";

export interface ReportTarget {
  kind: "task" | "reservation";
  id: string;
  dogId: string | null;
  dogName: string | null;
}

export function ReportRouter({ specialty, target, onDone }:
  { specialty: Specialty | null; target: ReportTarget; onDone: () => void }) {
  switch (specialty) {
    case "trainer":  return <TrainerReportForm target={target} onDone={onDone} />;
    case "vet":      return <VetReportForm target={target} onDone={onDone} />;
    case "cleaning": return <CleaningReportForm target={target} onDone={onDone} />;
    case "welfare":  return <WelfareReportForm target={target} onDone={onDone} />;
    case "groomer":  return <GroomerReportForm target={target} onDone={onDone} />;
    default:         return <CleaningReportForm target={target} onDone={onDone} />; // fallback: generic checklist
  }
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
git add src/pages/worker/WorkerTaskDetailPage.tsx src/components/worker/reports/ReportRouter.tsx
git commit -m "feat(worker): detalle de trabajo + router de reporte por especialidad"
```

### Task 4.2: Trainer report form → `report_cards`

**Files:**
- Create: `src/components/worker/reports/TrainerReportForm.tsx`

- [ ] **Step 1: Write the form** — fields: `energy_level`, `socialization`, `obedience`, `appetite` (1–5 sliders), `highlights`, `areas_to_improve`, `notes`, `photos` (optional). On submit: `useCreateReportCard()` (existing, `src/hooks/queries/useReportCards.ts`) with `dog_id: target.dogId`, `dog_name: target.dogName`, `trainer_id: myStaff.id`, `session_date: today`, `service_type`, and the scores; then close the item (`status='done'`, `completed_at=now()`, `completed_by=myStaff.id`) via update mutation; call `onDone`.

```tsx
// uses useCreateReportCard() and useUpdateTask()/reservation update
// overall_score can be computed avg of the four scores
```

- [ ] **Step 2: Verify** — as a `trainer`-specialty worker, complete a reservation → report card row created (visible in admin Report Cards), item marked done. Confirm RLS allows the write (Phase 1 `get_reportcard_writer_org_ids`).

- [ ] **Step 3: Commit**

```bash
git add src/components/worker/reports/TrainerReportForm.tsx
git commit -m "feat(worker): formulario de reporte trainer → report_cards"
```

### Task 4.3: Vet report form → clinical tables

**Files:**
- Create: `src/components/worker/reports/VetReportForm.tsx`

- [ ] **Step 1: Write the form** — a small tabbed/segmented form to pick record kind: **nota clínica** (`medical_history`), **vacuna** (`vaccination_schedule`), **desparasitación** (`deworming_records`), or **condición** (`medical_conditions`). **IMPORTANT quirk:** these tables use `dog_id text` (not uuid) and require `dog_name text`. Pass `dog_id: target.dogId` (as string) and `dog_name: target.dogName`. Insert via `supabase.from(<table>).insert({ ..., organization_id })`. Then close the item. Minimal required fields per table:
  - `medical_history`: `record_type`, `reason`, `diagnosis`, `treatment` (all optional except defaults), `record_date`.
  - `vaccination_schedule`: `vaccine_name` (required), `vaccine_type`, `date_administered`, `next_dose_date`.
  - `deworming_records`: `product_name` (required), `product_type`, `date_administered`.
  - `medical_conditions`: `condition_name` (required), `condition_type`, `severity`, `status`.

- [ ] **Step 2: Verify** — as a `vet`-specialty worker, submit each record kind; rows appear in the dog's clinical tabs (admin). Confirm a non-vet worker is blocked at RLS (already asserted in Phase 1).

- [ ] **Step 3: Commit**

```bash
git add src/components/worker/reports/VetReportForm.tsx
git commit -m "feat(worker): formulario de reporte vet → tablas clínicas"
```

### Task 4.4: Cleaning, welfare, groomer forms → `tasks` (status + notes + report_data + photos)

**Files:**
- Create: `src/components/worker/reports/CleaningReportForm.tsx`
- Create: `src/components/worker/reports/WelfareReportForm.tsx`
- Create: `src/components/worker/reports/GroomerReportForm.tsx`

- [ ] **Step 1: `CleaningReportForm.tsx`** — a checklist (e.g. piso, comederos, agua, desinfección) stored as `report_data` jsonb + optional `notes` + optional `photos`. On submit: `useUpdateTask({ id, patch: { status:'done', notes, report_data, photos, completed_at, completed_by } })`; `onDone`.

- [ ] **Step 2: `WelfareReportForm.tsx`** — structured feeding/walk log: `time`, `amount`/`duration`, `notes` → into `report_data` jsonb; same close path.

- [ ] **Step 3: `GroomerReportForm.tsx`** — grooming notes + before/after photos (`photos`) + `notes` → `report_data`/`notes`; same close path.

- [ ] **Step 4: Verify** — for each specialty, complete a task and confirm `status='done'`, `completed_at`/`completed_by` set, `report_data`/`photos` persisted, and the item leaves the "pending/in_progress" buckets in Mi día.

- [ ] **Step 5: Build + commit**

Run: `npm run build` → PASS
```bash
git add src/components/worker/reports/CleaningReportForm.tsx src/components/worker/reports/WelfareReportForm.tsx src/components/worker/reports/GroomerReportForm.tsx
git commit -m "feat(worker): formularios cleaning/welfare/groomer → tasks (report_data + fotos)"
```

### Task 4.5: (Optional) filter trainer picker by specialty in admin Report Cards

**Files:**
- Modify: `src/components/report-cards/ReportCardModal.tsx`

- [ ] **Step 1:** When loading the staff list for the `trainer_id` picker, filter to `specialty='trainer'` (or role admin/manager) so admins assign report cards to the right staff. Low priority; skip if time-boxed.

- [ ] **Step 2: Commit (if done)**

```bash
git add src/components/report-cards/ReportCardModal.tsx
git commit -m "chore(report-cards): filtra selector de entrenador por especialidad"
```

---

## Final self-review (against the spec)

- §1 roles/specialty separation → Phase 1 Task 1.1 (enum rename + specialty) + Phase 2 Task 2.2 (UI). ✓
- §2 hybrid work model (reservations + tasks) → Phase 1 Task 1.2 (`tasks`) + Phase 2/3 feed. ✓
- §2 "Mi día" merged feed → Phase 2 Task 2.6 (reservations) + Phase 3 Task 3.3 (tasks). ✓
- §3 RLS hardening (assignment + specialty + clinical + report_cards + anon dependency) → Phase 1 Tasks 1.3–1.7. ✓
- §4 per-specialty report forms → Phase 4. ✓
- §5 mobile-first UX (shell, bottom nav, detail, report, notices, profile) → Phase 2 Tasks 2.5–2.7 + Phase 4. ✓
- §6 role-based redirect + guards → Phase 2 Tasks 2.4, 2.7. ✓
- §7 specialty→task-type mapping → `TASK_TYPE_BY_SPECIALTY` in `src/lib/worker.ts` (Phase 2) + assignment UI (Phase 3). ✓
- Open questions → resolved at top of plan. ✓

**Type consistency check:** `Specialty`, `FeedItem`, `MyStaffMember`, `ReportTarget`, helper names `get_my_staff_ids`/`get_scheduler_org_ids`/`get_clinical_writer_org_ids`/`get_reportcard_writer_org_ids`, policy names (`tasks read/insert/update/delete`, `reservations read/insert/update/delete`, `<clinical> read/write`, `report_cards read/write`) are used consistently across phases.
