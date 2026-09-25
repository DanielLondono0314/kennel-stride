-- =============================================================================
-- Seguimiento de peso trazable + Panel de perros.
--
-- 1. dog_weight_logs gana condición corporal (BCS 1-9) y trazabilidad real:
--    created_by lo sella el servidor (no se puede falsificar desde el cliente)
--    y no se puede reescribir después.
-- 2. dogs.weight se mantiene sincronizado con la pesada más reciente, así la
--    ficha, el listado y la hoja de pesos nunca se contradicen.
-- 3. Cualquier miembro del personal puede REGISTRAR pesos (se pesa en el
--    piso, no solo en clínica); borrar/corregir sigue restringido a quien
--    escribe clínica, para que el historial no se pueda maquillar.
-- 4. organizations.dog_dashboard_config: umbrales de alerta de peso y qué
--    secciones/campos muestra el Panel de perros. Lo decide cada centro.
-- =============================================================================

-- ── 1. dog_weight_logs ───────────────────────────────────────────────────────
ALTER TABLE public.dog_weight_logs
  ADD COLUMN IF NOT EXISTS body_condition_score smallint;

ALTER TABLE public.dog_weight_logs
  DROP CONSTRAINT IF EXISTS dog_weight_logs_bcs_range,
  ADD CONSTRAINT dog_weight_logs_bcs_range
    CHECK (body_condition_score IS NULL OR body_condition_score BETWEEN 1 AND 9);

ALTER TABLE public.dog_weight_logs
  DROP CONSTRAINT IF EXISTS dog_weight_logs_weight_range,
  ADD CONSTRAINT dog_weight_logs_weight_range CHECK (weight > 0 AND weight < 200);

ALTER TABLE public.dog_weight_logs
  ALTER COLUMN created_by SET DEFAULT auth.uid();

CREATE OR REPLACE FUNCTION public.stamp_dog_weight_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Quién pesó: siempre el usuario autenticado (NULL solo desde service role / seeds).
    IF auth.uid() IS NOT NULL THEN
      NEW.created_by := auth.uid();
    END IF;
    NEW.created_at := now();

    -- El perro debe pertenecer a la misma organización del registro.
    IF NOT EXISTS (
      SELECT 1 FROM public.dogs d
      WHERE d.id = NEW.dog_id AND d.organization_id = NEW.organization_id
    ) THEN
      RAISE EXCEPTION 'El perro no pertenece a esta organización';
    END IF;
  ELSE
    -- La autoría y el momento de captura son inmutables.
    NEW.created_by      := OLD.created_by;
    NEW.created_at      := OLD.created_at;
    NEW.dog_id          := OLD.dog_id;
    NEW.organization_id := OLD.organization_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS stamp_dog_weight_log ON public.dog_weight_logs;
CREATE TRIGGER stamp_dog_weight_log
  BEFORE INSERT OR UPDATE ON public.dog_weight_logs
  FOR EACH ROW EXECUTE FUNCTION public.stamp_dog_weight_log();

-- ── 2. Sincronizar dogs.weight con la última pesada ──────────────────────────
-- SECURITY DEFINER: un worker vet puede registrar pesos (clinical writer) pero
-- no necesariamente editar la ficha del perro.
CREATE OR REPLACE FUNCTION public.sync_dog_weight_from_logs()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dog_id uuid := COALESCE(NEW.dog_id, OLD.dog_id);
  v_weight numeric;
BEGIN
  SELECT l.weight INTO v_weight
  FROM public.dog_weight_logs l
  WHERE l.dog_id = v_dog_id
  ORDER BY l.recorded_at DESC, l.created_at DESC
  LIMIT 1;

  -- Si se borró la única pesada, dogs.weight conserva el último valor conocido.
  IF v_weight IS NOT NULL THEN
    UPDATE public.dogs
    SET weight = v_weight, updated_at = now()
    WHERE id = v_dog_id AND weight IS DISTINCT FROM v_weight;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS sync_dog_weight_from_logs ON public.dog_weight_logs;
CREATE TRIGGER sync_dog_weight_from_logs
  AFTER INSERT OR UPDATE OF weight, recorded_at OR DELETE ON public.dog_weight_logs
  FOR EACH ROW EXECUTE FUNCTION public.sync_dog_weight_from_logs();

CREATE INDEX IF NOT EXISTS idx_dog_weight_logs_org_date
  ON public.dog_weight_logs(organization_id, recorded_at);

-- ── 3. RLS: registrar = todo el personal; corregir/borrar = clínica ────────
DROP POLICY IF EXISTS "dog_weight_logs write"  ON public.dog_weight_logs;
DROP POLICY IF EXISTS "dog_weight_logs insert" ON public.dog_weight_logs;
DROP POLICY IF EXISTS "dog_weight_logs update" ON public.dog_weight_logs;
DROP POLICY IF EXISTS "dog_weight_logs delete" ON public.dog_weight_logs;

-- get_active_org_ids(): cualquier rol (admin/manager/front_desk/worker) de
-- una org con suscripción vigente. La pertenencia del perro a la org la
-- valida el trigger stamp_dog_weight_log.
CREATE POLICY "dog_weight_logs insert" ON public.dog_weight_logs FOR INSERT TO authenticated
WITH CHECK (organization_id IN (SELECT public.get_active_org_ids()));

CREATE POLICY "dog_weight_logs update" ON public.dog_weight_logs FOR UPDATE TO authenticated
USING (organization_id IN (SELECT public.get_clinical_writer_org_ids()))
WITH CHECK (organization_id IN (SELECT public.get_clinical_writer_org_ids()));

CREATE POLICY "dog_weight_logs delete" ON public.dog_weight_logs FOR DELETE TO authenticated
USING (organization_id IN (SELECT public.get_clinical_writer_org_ids()));

-- ── 4. Configuración del Panel de perros por organización ────────────────────
-- Forma (validada en el cliente, ver src/lib/dogDashboardConfig.ts):
--   { weight: { checkIntervalDays, alertPct, windowDays },
--     sections: { <sección>: bool }, cardFields: { <campo>: bool } }
-- La escritura queda cubierta por la policy existente "Admins can update org".
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS dog_dashboard_config jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_dog_dashboard_config_object,
  ADD CONSTRAINT organizations_dog_dashboard_config_object
    CHECK (jsonb_typeof(dog_dashboard_config) = 'object');
