-- ============================================================================
-- Report cards adaptados al servicio (grooming, veterinaria, paseo,
-- entrenamiento, guardería/hotel, evaluación…).
--
-- service_category: categoría del servicio al momento de crear el report card
--   (la define cada servicio en Ajustes > Perfil del Negocio, o se infiere del
--   nombre). Decide qué campos se diligencian y alimenta el historial del perro.
-- details: campos propios de la categoría (valores, métricas extra y un resumen
--   legible que usan el detalle, el correo al dueño y el historial del perro).
-- Las 4 métricas clásicas pasan a ser opcionales: en una consulta veterinaria o
--   un baño "obediencia" no aplica y se guarda NULL en vez de un 3 inventado.
-- trainer_id se mantiene como columna pero ahora es "el encargado" del
--   servicio (groomer, veterinario, paseador, cuidador…), no solo entrenador.
-- ============================================================================

ALTER TABLE public.report_cards
  ADD COLUMN IF NOT EXISTS service_category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  ALTER TABLE public.report_cards ADD CONSTRAINT report_cards_service_category_check
    CHECK (service_category IN ('training','grooming','vet','walk','stay','evaluation','general'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.report_cards
  ALTER COLUMN energy_level  DROP NOT NULL,
  ALTER COLUMN socialization DROP NOT NULL,
  ALTER COLUMN obedience     DROP NOT NULL,
  ALTER COLUMN appetite      DROP NOT NULL;

-- Backfill con la misma inferencia por nombre que usa el front
-- (src/lib/reportCardServices.ts → inferCategory).
UPDATE public.report_cards
SET service_category = CASE
  WHEN service_type ~* '(vet|consulta|clinic|medic|vacun)'            THEN 'vet'
  WHEN service_type ~* '(groom|spa|bano|baño|peluq|estetic|corte)'     THEN 'grooming'
  WHEN service_type ~* '(train|entren|adiestr|obedien|clase)'          THEN 'training'
  WHEN service_type ~* '(evalua|valorac)'                              THEN 'evaluation'
  WHEN service_type ~* '(paseo|walk|caminat)'                          THEN 'walk'
  WHEN service_type ~* '(daycare|guarder|hotel|board|internado|hosped|pension|stay|jardin)' THEN 'stay'
  ELSE 'general'
END
WHERE service_category = 'general';

CREATE INDEX IF NOT EXISTS idx_report_cards_dog_date
  ON public.report_cards (dog_id, session_date DESC);

-- ── Quién puede escribir report cards ─────────────────────────────────────
-- Antes: permiso 'report_cards' o worker entrenador. Ahora el encargado puede
-- ser groomer, veterinario o personal de bienestar (paseos, guardería), así que
-- esas especialidades también pueden registrar el reporte de su servicio.
CREATE OR REPLACE FUNCTION public.get_reportcard_writer_org_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_org_ids_with_permission('report_cards')
  UNION
  SELECT om.organization_id
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.user_id = auth.uid()
    AND (o.subscription_status = 'active'
         OR (o.subscription_status = 'trialing' AND o.trial_ends_at > now()))
    AND EXISTS (
      SELECT 1 FROM public.staff_members sm
      WHERE sm.profile_id = auth.uid()
        AND sm.organization_id = om.organization_id
        AND sm.specialty IN ('trainer', 'groomer', 'vet', 'welfare')
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_reportcard_writer_org_ids() TO authenticated;
