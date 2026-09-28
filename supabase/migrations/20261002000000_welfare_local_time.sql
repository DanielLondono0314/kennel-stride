-- ============================================================================
-- Rondas de bienestar en la hora LOCAL de cada organización (QA E-02) y zona
-- horaria por defecto de Colombia (QA E-03).
--
-- Antes: el cron corría a las 07:00 y 19:00 UTC (02:00 y 14:00 en Bogotá) y
-- guardaba due_at = now(), así que las rondas "mañana/noche" aparecían de
-- madrugada y a media tarde. Las que nadie completaba se acumulaban para
-- siempre (Colina tenía 61 pendientes desde el 25 de agosto).
--
-- Ahora:
--  * El cron corre cada hora; cada org genera su ronda cuando SU reloj marca
--    las 07:00 (mañana) o las 19:00 (noche), con due_at a esa hora local.
--  * Idempotente: no crea dos rondas para el mismo turno aunque el cron se
--    repita o se ejecute a mano.
--  * Rondas vencidas hace más de 12 horas sin hacer se cierran como 'skipped'
--    con una nota: quedan en el historial, pero dejan de ensuciar el tablero.
--  * La zona horaria por defecto pasa a America/Bogota (antes Ciudad de México,
--    UTC−6, que desfasa todo una hora en Colombia).
-- ============================================================================

ALTER TABLE public.organizations ALTER COLUMN timezone SET DEFAULT 'America/Bogota';

CREATE OR REPLACE FUNCTION public.generate_welfare_checks_all_orgs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org RECORD;
  v_tz text;
  v_local timestamp;
  v_hour int;
  v_shift text;
  v_due timestamptz;
  v_task_id uuid;
  v_dog_count integer;
  v_assignee_id uuid;
BEGIN
  -- 1) Cerrar rondas que ya nadie va a hacer.
  UPDATE public.tasks
     SET status = 'skipped',
         notes = trim(both E'\n' FROM COALESCE(notes, '') || E'\n' ||
                 'Cerrada automáticamente: la ronda no se realizó a tiempo.'),
         updated_at = now()
   WHERE type = 'welfare_check'
     AND status IN ('pending', 'in_progress')
     AND due_at < now() - interval '12 hours';

  -- 2) Generar la ronda del turno que empieza ahora en cada org.
  FOR org IN
    SELECT DISTINCT wi.organization_id AS id, o.timezone
    FROM public.welfare_check_items wi
    JOIN public.organizations o ON o.id = wi.organization_id
    WHERE wi.is_active = true
  LOOP
    BEGIN
      v_tz := COALESCE(NULLIF(org.timezone, ''), 'America/Bogota');
      BEGIN
        v_local := now() AT TIME ZONE v_tz;
      EXCEPTION WHEN invalid_parameter_value THEN
        v_tz := 'America/Bogota';
        v_local := now() AT TIME ZONE v_tz;
      END;
      v_hour := extract(hour FROM v_local);

      IF v_hour = 7 THEN
        v_shift := 'mañana';
      ELSIF v_hour = 19 THEN
        v_shift := 'noche';
      ELSE
        CONTINUE;
      END IF;

      v_due := (date_trunc('hour', v_local)) AT TIME ZONE v_tz;

      IF EXISTS (
        SELECT 1 FROM public.tasks
        WHERE organization_id = org.id AND type = 'welfare_check' AND due_at = v_due
      ) THEN
        CONTINUE;
      END IF;

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
      VALUES (org.id, 'welfare_check', 'Ronda de bienestar — ' || v_shift, 'high', 'pending', v_assignee_id, v_due)
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

-- Un solo job cada hora (en el minuto 0) en vez de dos fijos en UTC.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobname) FROM cron.job
     WHERE jobname IN ('generate_welfare_checks_am', 'generate_welfare_checks_pm', 'generate_welfare_checks_hourly');
    PERFORM cron.schedule(
      'generate_welfare_checks_hourly', '0 * * * *',
      $cron$ SELECT public.generate_welfare_checks_all_orgs(); $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron no está instalado: no se programó generate_welfare_checks_all_orgs().';
  END IF;
END;
$$;
