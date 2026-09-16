-- ============================================================================
-- Panel interno de plataforma (`/platform-admin`) · Fase 2 — consolas de
-- escritura.
--
-- Ambas RPCs son 'owner'-only (get_platform_admin_role() = 'owner'):
-- support_readonly puede ver todo (Fase 1) pero no puede mutar nada. Cada
-- escritura queda en platform_admin_audit_log con el motivo dado por quien
-- la ejecuta.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.platform_admin_adjust_package_credits(
  p_package_id uuid, p_delta int, p_reason text
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_before int;
  v_after  int;
  v_total  int;
  v_org    uuid;
BEGIN
  IF public.get_platform_admin_role() IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Se requiere un motivo';
  END IF;

  SELECT remaining_credits, total_credits, organization_id
    INTO v_before, v_total, v_org
  FROM public.packages WHERE id = p_package_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paquete no encontrado';
  END IF;

  v_after := greatest(0, least(v_total, v_before + p_delta));

  UPDATE public.packages
    SET remaining_credits = v_after,
        status = CASE WHEN v_after = 0 THEN 'depleted'
                       WHEN status = 'depleted' AND v_after > 0 THEN 'active'
                       ELSE status END,
        updated_at = now()
  WHERE id = p_package_id;

  INSERT INTO public.package_credit_log
    (package_id, organization_id, user_id, action, credits_before, credits_after, reason)
  VALUES (p_package_id, v_org, auth.uid(), 'platform_admin_adjust', v_before, v_after, p_reason);

  INSERT INTO public.platform_admin_audit_log (admin_user_id, action, target_org_id, metadata)
  VALUES (auth.uid(), 'adjust_package_credits', v_org, jsonb_build_object(
    'package_id', p_package_id, 'delta', p_delta,
    'before', v_before, 'after', v_after, 'reason', p_reason
  ));

  RETURN json_build_object('before', v_before, 'after', v_after);
END $$;

CREATE OR REPLACE FUNCTION public.platform_admin_set_subscription_status(
  p_org_id uuid, p_status text, p_reason text
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before text;
BEGIN
  IF public.get_platform_admin_role() IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF p_status NOT IN ('active', 'trialing', 'cancelled') THEN
    RAISE EXCEPTION 'Estado de suscripción inválido: %', p_status;
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Se requiere un motivo';
  END IF;

  SELECT subscription_status INTO v_before FROM public.organizations WHERE id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organización no encontrada';
  END IF;

  UPDATE public.organizations
    SET subscription_status = p_status, updated_at = now()
  WHERE id = p_org_id;

  INSERT INTO public.platform_admin_audit_log (admin_user_id, action, target_org_id, metadata)
  VALUES (auth.uid(), 'set_subscription_status', p_org_id, jsonb_build_object(
    'before', v_before, 'after', p_status, 'reason', p_reason
  ));

  RETURN json_build_object('before', v_before, 'after', p_status);
END $$;

GRANT EXECUTE ON FUNCTION public.platform_admin_adjust_package_credits(uuid, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_set_subscription_status(uuid, text, text) TO authenticated;
