-- ============================================================================
-- Servicio de ruta · Fase 3 — RLS de route_stops.
-- Mirror exacto de welfare_check_entries (20260824000000_welfare_checks.sql):
-- lectura para cualquier miembro de la org dueña de la task; escritura para
-- scheduler (admin/manager/front_desk) o el chofer asignado a esa task.
-- Reusa get_scheduler_org_ids()/get_my_staff_ids() de
-- 20260531000003_worker_rls.sql — no hace falta ninguna función helper nueva.
-- ============================================================================

DROP POLICY IF EXISTS "route_stops read"  ON public.route_stops;
DROP POLICY IF EXISTS "route_stops write" ON public.route_stops;

CREATE POLICY "route_stops read" ON public.route_stops FOR SELECT TO authenticated
USING (
  task_id IN (
    SELECT t.id FROM public.tasks t
    WHERE t.organization_id IN (SELECT public.get_user_org_ids())
  )
);

CREATE POLICY "route_stops write" ON public.route_stops FOR ALL TO authenticated
USING (
  task_id IN (
    SELECT t.id FROM public.tasks t
    WHERE t.organization_id IN (SELECT public.get_scheduler_org_ids())
       OR t.assignee_staff_id IN (SELECT public.get_my_staff_ids())
  )
)
WITH CHECK (
  task_id IN (
    SELECT t.id FROM public.tasks t
    WHERE t.organization_id IN (SELECT public.get_scheduler_org_ids())
       OR t.assignee_staff_id IN (SELECT public.get_my_staff_ids())
  )
);
