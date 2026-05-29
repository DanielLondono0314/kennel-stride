-- Retorna el estado de setup inicial de una organización.
-- Permite al frontend mostrar un checklist de primeros pasos.
CREATE OR REPLACE FUNCTION public.get_onboarding_status(p_org_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_customers    boolean;
  v_has_zones        boolean;
  v_has_staff        boolean;
  v_has_schedule     boolean;
  v_has_reservations boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.customers WHERE organization_id = p_org_id LIMIT 1)
    INTO v_has_customers;

  SELECT EXISTS(SELECT 1 FROM public.facility_zones WHERE organization_id = p_org_id LIMIT 1)
    INTO v_has_zones;

  SELECT (COUNT(*) > 1) FROM public.organization_members WHERE organization_id = p_org_id
    INTO v_has_staff;

  SELECT (opening_time IS NOT NULL AND closing_time IS NOT NULL)
  FROM public.organizations WHERE id = p_org_id
    INTO v_has_schedule;

  SELECT EXISTS(SELECT 1 FROM public.reservations WHERE organization_id = p_org_id LIMIT 1)
    INTO v_has_reservations;

  RETURN json_build_object(
    'has_customers',    v_has_customers,
    'has_zones',        v_has_zones,
    'has_staff',        v_has_staff,
    'has_schedule',     v_has_schedule,
    'has_reservations', v_has_reservations
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_onboarding_status(uuid) TO authenticated;
