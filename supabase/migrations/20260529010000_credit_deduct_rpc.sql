-- ============================================================
-- STREAM A — Integridad de créditos (C1, C5, parte de H5)
-- Descuento atómico de créditos vía RPC SECURITY DEFINER +
-- blindaje del log de auditoría (solo escribible por el RPC).
-- ============================================================

-- ── 1. Tabla de auditoría de créditos (idempotente) ──────────
-- El log solo debe escribirse desde el RPC `deduct_package_credit`.
-- Los clientes pueden LEER su propio log (scoped por organización)
-- pero NO insertar/actualizar/borrar directamente.
CREATE TABLE IF NOT EXISTS public.package_credit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id      uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action          text NOT NULL,
  credits_before  integer NOT NULL,
  credits_after   integer NOT NULL,
  reason          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_log_package ON public.package_credit_log(package_id);
CREATE INDEX IF NOT EXISTS idx_credit_log_org     ON public.package_credit_log(organization_id);

ALTER TABLE public.package_credit_log ENABLE ROW LEVEL SECURITY;

-- Lectura org-scoped para miembros (para mostrar historial en la UI).
DROP POLICY IF EXISTS "Org members can read credit log" ON public.package_credit_log;
CREATE POLICY "Org members can read credit log"
  ON public.package_credit_log FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()));

-- ── 2. RPC transaccional de descuento ────────────────────────
-- UPDATE ... WHERE remaining_credits > 0 RETURNING (piso atómico en 0,
-- previene lost-update y créditos negativos) + INSERT del log en la
-- misma transacción. SECURITY DEFINER para escribir el log blindado.
CREATE OR REPLACE FUNCTION public.deduct_package_credit(p_package_id uuid, p_reason text DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before int; v_after int; v_org uuid;
BEGIN
  UPDATE public.packages
    SET remaining_credits = remaining_credits - 1,
        status = CASE WHEN remaining_credits - 1 = 0 THEN 'depleted' ELSE status END,
        updated_at = now()
  WHERE id = p_package_id
    AND organization_id IN (SELECT public.get_user_org_ids())
    AND remaining_credits > 0
  RETURNING (remaining_credits + 1), remaining_credits, organization_id
  INTO v_before, v_after, v_org;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sin créditos disponibles o paquete inválido';
  END IF;

  INSERT INTO public.package_credit_log
    (package_id, organization_id, user_id, action, credits_before, credits_after, reason)
  VALUES (p_package_id, v_org, auth.uid(), 'deduct', v_before, v_after, p_reason);

  RETURN v_after;
END $$;

GRANT EXECUTE ON FUNCTION public.deduct_package_credit(uuid, text) TO authenticated;

-- ── 3. C5: el log deja de ser escribible directamente por el cliente ──
-- Si una versión anterior creó una política de insert, eliminarla.
DROP POLICY IF EXISTS "Authenticated can insert credit log" ON public.package_credit_log;
-- Revocar INSERT a roles de cliente: el log solo se escribe vía el RPC
-- (SECURITY DEFINER corre como owner de la función, no como el cliente).
REVOKE INSERT ON public.package_credit_log FROM authenticated, anon;
