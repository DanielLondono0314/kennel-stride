-- Nada marcaba un paquete como 'expired' ni impedía descontar créditos de uno
-- vencido: deduct_package_credit() solo miraba remaining_credits > 0, así que
-- un paquete con fecha de vencimiento pasada seguía siendo usable en checkout.
-- Ahora el RPC también exige expires_at >= hoy.
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
    AND expires_at >= CURRENT_DATE
  RETURNING (remaining_credits + 1), remaining_credits, organization_id
  INTO v_before, v_after, v_org;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sin créditos disponibles, paquete vencido o inválido';
  END IF;

  INSERT INTO public.package_credit_log
    (package_id, organization_id, user_id, action, credits_before, credits_after, reason)
  VALUES (p_package_id, v_org, auth.uid(), 'deduct', v_before, v_after, p_reason);

  RETURN v_after;
END $$;
