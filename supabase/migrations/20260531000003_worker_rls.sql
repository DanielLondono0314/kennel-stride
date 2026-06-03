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
  -- El worker sigue siendo el asignado Y la fila no puede salir de una org a la
  -- que pertenece (evita que reasigne organization_id a un tenant ajeno).
  OR (assignee_staff_id IN (SELECT public.get_my_staff_ids())
      AND organization_id IN (SELECT public.get_user_org_ids()))
);

-- DELETE: solo scheduler.
CREATE POLICY "tasks delete" ON public.tasks FOR DELETE TO authenticated
USING (organization_id IN (SELECT public.get_scheduler_org_ids()));

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
  -- El worker sigue siendo el staff_id Y la reserva no puede cambiar a una org
  -- a la que no pertenece (evita reasignar organization_id cross-tenant).
  OR (staff_id IN (SELECT public.get_my_staff_ids())
      AND organization_id IN (SELECT public.get_user_org_ids()))
);

-- DELETE: solo scheduler.
DROP POLICY IF EXISTS "reservations delete" ON public.reservations;
CREATE POLICY "reservations delete" ON public.reservations FOR DELETE TO authenticated
USING (organization_id IN (SELECT public.get_scheduler_org_ids()));
