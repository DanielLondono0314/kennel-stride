-- =============================================================================
-- Chequeo de bienestar (ronda de salud AM/PM) — tarea automática por perro.
-- Ver plan: fuga/accidente/mordida/pelea/lesión, cubre TODOS los perros
-- presentes en las instalaciones (facility_units.assigned_dog_id no nulo),
-- generada dos veces al día por cron, ítems configurables por org en Ajustes.
-- =============================================================================

-- ── 0. tasks.type: agregar 'welfare_check' al CHECK existente ──────────────
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_type_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_type_check
  CHECK (type IN ('cleaning','feeding','walk','vet_check','grooming','other','welfare_check'));

-- ── 1. welfare_check_items — ítems configurables por org ────────────────────
CREATE TABLE IF NOT EXISTS public.welfare_check_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key               text NOT NULL,
  label             text NOT NULL,
  sort_order        integer NOT NULL DEFAULT 0,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);

ALTER TABLE public.welfare_check_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "welfare_check_items read"  ON public.welfare_check_items;
DROP POLICY IF EXISTS "welfare_check_items write" ON public.welfare_check_items;

CREATE POLICY "welfare_check_items read" ON public.welfare_check_items FOR SELECT TO authenticated
USING (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "welfare_check_items write" ON public.welfare_check_items FOR ALL TO authenticated
USING    (organization_id IN (SELECT public.get_clinical_writer_org_ids()))
WITH CHECK (organization_id IN (SELECT public.get_clinical_writer_org_ids()));

-- ── 2. welfare_check_entries — una fila por perro por ronda ─────────────────
CREATE TABLE IF NOT EXISTS public.welfare_check_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  dog_id      uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  present     boolean NOT NULL DEFAULT true,
  flags       jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS welfare_check_entries_task_id_idx ON public.welfare_check_entries(task_id);
CREATE INDEX IF NOT EXISTS welfare_check_entries_dog_id_idx  ON public.welfare_check_entries(dog_id);

ALTER TABLE public.welfare_check_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "welfare_check_entries read"  ON public.welfare_check_entries;
DROP POLICY IF EXISTS "welfare_check_entries write" ON public.welfare_check_entries;

-- Lectura/escritura: por el organization_id de la tarea dueña de la entrada.
-- Lectura: cualquier miembro de la org. Escritura: asignado a la tarea (worker)
-- o scheduler — igual criterio que "tasks update" para no bloquear al worker
-- que está cerrando su propia ronda.
CREATE POLICY "welfare_check_entries read" ON public.welfare_check_entries FOR SELECT TO authenticated
USING (
  task_id IN (
    SELECT t.id FROM public.tasks t
    WHERE t.organization_id IN (SELECT public.get_user_org_ids())
  )
);

CREATE POLICY "welfare_check_entries write" ON public.welfare_check_entries FOR ALL TO authenticated
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

-- ── 3. Semilla de los 5 ítems por defecto ────────────────────────────────────
-- Función reutilizable: siembra los ítems por defecto para UNA org, sin duplicar
-- si ya existen (ON CONFLICT DO NOTHING por la UNIQUE(organization_id, key)).
CREATE OR REPLACE FUNCTION public.seed_default_welfare_check_items(p_org_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.welfare_check_items (organization_id, key, label, sort_order)
  VALUES
    (p_org_id, 'fuga',      'Fuga',      1),
    (p_org_id, 'accidente', 'Accidente', 2),
    (p_org_id, 'mordida',   'Mordida',   3),
    (p_org_id, 'pelea',     'Pelea',     4),
    (p_org_id, 'lesion',    'Lesión',    5)
  ON CONFLICT (organization_id, key) DO NOTHING;
$$;

-- Backfill: todas las orgs existentes.
DO $$
DECLARE
  org RECORD;
BEGIN
  FOR org IN SELECT id FROM public.organizations LOOP
    PERFORM public.seed_default_welfare_check_items(org.id);
  END LOOP;
END;
$$;

-- Orgs nuevas: trigger AFTER INSERT en organizations (desacoplado de
-- create_organization() para no tocar esa función ya endurecida — cualquier
-- camino de creación de org, incluido el RPC, dispara esto igual).
CREATE OR REPLACE FUNCTION public.trg_seed_default_welfare_check_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_default_welfare_check_items(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_welfare_check_items_on_org_insert ON public.organizations;
CREATE TRIGGER seed_welfare_check_items_on_org_insert
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.trg_seed_default_welfare_check_items();

-- ── 4. Generación automática (cron, dos veces al día) ────────────────────────
-- Mismo patrón que check_expiring_packages_all_orgs(): SECURITY DEFINER, cubre
-- TODAS las orgs (auth.uid() es NULL bajo pg_cron/service_role).
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
  v_dog_count integer;
  v_assignee_id uuid;
BEGIN
  v_shift := CASE WHEN extract(hour FROM now()) < 12 THEN 'mañana' ELSE 'noche' END;

  FOR org IN
    SELECT DISTINCT organization_id AS id
    FROM public.welfare_check_items
    WHERE is_active = true
  LOOP
    -- Solo generar si hay al menos un perro presente en las instalaciones
    -- (facility_units.assigned_dog_id no nulo) para esa org.
    SELECT count(*) INTO v_dog_count
    FROM public.facility_units fu
    JOIN public.facility_zones fz ON fz.id = fu.zone_id
    WHERE fz.organization_id = org.id
      AND fu.assigned_dog_id IS NOT NULL;

    IF v_dog_count = 0 THEN
      CONTINUE;
    END IF;

    -- Asignar automáticamente: preferir un worker activo con specialty='welfare',
    -- balanceando por quién tiene menos tareas abiertas ahora mismo. Sin esto la
    -- tarea quedaría sin asignado y NINGÚN trabajador la vería en "Mi día" (ese
    -- feed solo lista tareas con assignee_staff_id = el propio staff), y el
    -- panel admin de Tareas no tiene edición de asignado tras crearla.
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
    SELECT v_task_id, fu.assigned_dog_id::uuid
    FROM public.facility_units fu
    JOIN public.facility_zones fz ON fz.id = fu.zone_id
    WHERE fz.organization_id = org.id
      AND fu.assigned_dog_id IS NOT NULL;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_welfare_checks_all_orgs() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.generate_welfare_checks_all_orgs() TO service_role;
REVOKE EXECUTE ON FUNCTION public.seed_default_welfare_check_items(uuid) FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION public.seed_default_welfare_check_items(uuid) TO service_role;

-- Programar dos veces al día (UTC): 07:00 y 19:00. Igual guardia que el resto
-- de crons de este proyecto — si pg_cron no está instalado, no truena, solo
-- avisa (hay que habilitar la extensión desde el dashboard de Supabase).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('generate_welfare_checks_am')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate_welfare_checks_am');
    PERFORM cron.unschedule('generate_welfare_checks_pm')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate_welfare_checks_pm');

    PERFORM cron.schedule(
      'generate_welfare_checks_am', '0 7 * * *',
      $cron$ SELECT public.generate_welfare_checks_all_orgs(); $cron$
    );
    PERFORM cron.schedule(
      'generate_welfare_checks_pm', '0 19 * * *',
      $cron$ SELECT public.generate_welfare_checks_all_orgs(); $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron not installed — skipping schedule for generate_welfare_checks_all_orgs(). Enable pg_cron in the Supabase dashboard and re-run the cron.schedule calls in this migration.';
  END IF;
END;
$$;
