-- Recordatorios de planes al dueño: qué planes ya se le avisaron y por qué.
--
-- Un plan necesita recordatorio cuando está por vencer, vencido o agotado y
-- todavía no se le avisó al dueño por ESE motivo (reminded_state). Así cada
-- dueño recibe un aviso por situación y no uno por día.
--
-- Hoy el envío es por WhatsApp desde el teléfono del centro (enlace con el
-- mensaje listo); cuando haya un proveedor configurado (Twilio + plantilla
-- aprobada por Meta) el envío automático usará estas mismas columnas.

ALTER TABLE public.dog_plans
  ADD COLUMN IF NOT EXISTS reminded_at    timestamptz,
  ADD COLUMN IF NOT EXISTS reminded_state text,
  ADD COLUMN IF NOT EXISTS reminded_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.dog_plans DROP CONSTRAINT IF EXISTS dog_plans_reminded_state;
ALTER TABLE public.dog_plans ADD CONSTRAINT dog_plans_reminded_state
  CHECK (reminded_state IS NULL OR reminded_state IN ('expiring', 'expired', 'depleted'));

-- Marca el recordatorio como enviado (o descartado) para la situación actual.
CREATE OR REPLACE FUNCTION public.mark_plan_reminded(p_plan_id uuid, p_state text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF p_state NOT IN ('expiring', 'expired', 'depleted') THEN
    RAISE EXCEPTION 'Estado de recordatorio inválido: %', p_state;
  END IF;
  -- SECURITY INVOKER: la RLS de dog_plans decide quién puede marcarlo.
  UPDATE public.dog_plans
     SET reminded_at = now(), reminded_state = p_state, reminded_by = auth.uid()
   WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan no encontrado o sin permiso';
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.mark_plan_reminded(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.mark_plan_reminded(uuid, text) TO authenticated;
