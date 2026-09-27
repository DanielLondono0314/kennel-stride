-- ============================================================================
-- Auditoría 2026-09-26 — integridad de perreras y cron de bienestar
--
--  1. Una perrera se libera sola cuando su reserva termina por CUALQUIER vía
--     (cancelar desde el dashboard, rechazar, completar desde la app del
--     worker, editar estado, borrar la reserva). Antes solo la liberaban los
--     RPCs de check-out y quedaban perreras "ocupadas" para siempre.
--  2. Borrar un perro libera la perrera donde estaba (assigned_dog_id es text,
--     sin FK, y quedaba apuntando a un perro inexistente).
--  3. Limpieza única de las asignaciones fantasma existentes.
--  4. generate_welfare_checks_all_orgs(): una org con datos inválidos ya no
--     aborta la ronda de TODAS las orgs; el turno se calcula en la zona
--     horaria de cada org (antes en UTC: 07:00 UTC = 2 a. m. en Colombia).
-- ============================================================================


-- ── 1. Liberar perrera al terminar la reserva ───────────────────────────────
CREATE OR REPLACE FUNCTION public.release_kennel_for_reservation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_res_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_res_id := OLD.id;
  ELSIF NEW.status IN ('cancelled', 'rejected', 'completed')
        AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_res_id := NEW.id;
  ELSE
    RETURN NEW;
  END IF;

  UPDATE public.facility_units
     SET status = 'available',
         assigned_dog_id = NULL,
         assigned_dog_name = NULL,
         assignment_start = NULL,
         assignment_end = NULL,
         assigned_reservation_id = NULL,
         updated_at = now()
   WHERE assigned_reservation_id = v_res_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS release_kennel_on_reservation_end ON public.reservations;
CREATE TRIGGER release_kennel_on_reservation_end
  AFTER UPDATE OF status ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.release_kennel_for_reservation();

-- BEFORE DELETE: la FK assigned_reservation_id es ON DELETE SET NULL y la
-- perrera quedaría 'occupied' sin reserva.
DROP TRIGGER IF EXISTS release_kennel_on_reservation_delete ON public.reservations;
CREATE TRIGGER release_kennel_on_reservation_delete
  BEFORE DELETE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.release_kennel_for_reservation();


-- ── 2. Liberar perrera al borrar el perro ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.release_kennel_for_dog()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.facility_units
     SET status = 'available',
         assigned_dog_id = NULL,
         assigned_dog_name = NULL,
         assignment_start = NULL,
         assignment_end = NULL,
         assigned_reservation_id = NULL,
         updated_at = now()
   WHERE assigned_dog_id = OLD.id::text;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS release_kennel_on_dog_delete ON public.dogs;
CREATE TRIGGER release_kennel_on_dog_delete
  BEFORE DELETE ON public.dogs
  FOR EACH ROW EXECUTE FUNCTION public.release_kennel_for_dog();


-- ── 3. Limpieza de asignaciones fantasma ────────────────────────────────────
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.facility_units f
     SET status = 'available',
         assigned_dog_id = NULL,
         assigned_dog_name = NULL,
         assignment_start = NULL,
         assignment_end = NULL,
         assigned_reservation_id = NULL,
         updated_at = now()
   WHERE f.assigned_dog_id IS NOT NULL
     AND (
       -- no es un UUID válido
       f.assigned_dog_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       -- o el perro ya no existe / es de otra org
       OR NOT EXISTS (
         SELECT 1 FROM public.dogs d
         WHERE d.id::text = f.assigned_dog_id AND d.organization_id = f.organization_id
       )
       -- o la reserva ligada ya terminó
       OR EXISTS (
         SELECT 1 FROM public.reservations r
         WHERE r.id = f.assigned_reservation_id
           AND r.status IN ('cancelled', 'rejected', 'completed')
       )
     );
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Perreras fantasma liberadas: %', n;
END $$;


-- ── 4. Cron de bienestar robusto ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_welfare_checks_all_orgs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org RECORD;
  v_task_id uuid;
  v_shift text;
  v_hour int;
  v_dog_count integer;
  v_assignee_id uuid;
BEGIN
  FOR org IN
    SELECT DISTINCT wi.organization_id AS id, o.timezone
    FROM public.welfare_check_items wi
    JOIN public.organizations o ON o.id = wi.organization_id
    WHERE wi.is_active = true
  LOOP
    -- Cada org en su propio subbloque: un error aquí se registra y se sigue
    -- con la siguiente en vez de revertir la ronda de todas.
    BEGIN
      BEGIN
        v_hour := extract(hour FROM now() AT TIME ZONE COALESCE(NULLIF(org.timezone, ''), 'America/Bogota'));
      EXCEPTION WHEN invalid_parameter_value THEN
        v_hour := extract(hour FROM now() AT TIME ZONE 'America/Bogota');
      END;
      v_shift := CASE WHEN v_hour < 12 THEN 'mañana' WHEN v_hour < 18 THEN 'tarde' ELSE 'noche' END;

      -- Solo perros realmente presentes: UUID válido y perro de esta org.
      SELECT count(*) INTO v_dog_count
      FROM public.facility_units fu
      JOIN public.dogs d ON d.id::text = fu.assigned_dog_id AND d.organization_id = org.id
      WHERE fu.organization_id = org.id;

      IF v_dog_count = 0 THEN
        CONTINUE;
      END IF;

      v_assignee_id := NULL;
      SELECT sm.id INTO v_assignee_id
      FROM public.staff_members sm
      WHERE sm.organization_id = org.id
        AND sm.role = 'worker'
        AND sm.is_active = true
      ORDER BY
        (sm.specialty = 'welfare') DESC,
        (SELECT count(*) FROM public.tasks t2
          WHERE t2.assignee_staff_id = sm.id AND t2.status IN ('pending','in_progress')) ASC,
        sm.id
      LIMIT 1;

      INSERT INTO public.tasks (organization_id, type, title, priority, status, assignee_staff_id, due_at)
      VALUES (org.id, 'welfare_check', 'Ronda de bienestar — ' || v_shift, 'high', 'pending', v_assignee_id, now())
      RETURNING id INTO v_task_id;

      INSERT INTO public.welfare_check_entries (task_id, dog_id)
      SELECT DISTINCT v_task_id, d.id
      FROM public.facility_units fu
      JOIN public.dogs d ON d.id::text = fu.assigned_dog_id AND d.organization_id = org.id
      WHERE fu.organization_id = org.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'generate_welfare_checks_all_orgs: org % falló: %', org.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_welfare_checks_all_orgs() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.generate_welfare_checks_all_orgs() TO service_role;
