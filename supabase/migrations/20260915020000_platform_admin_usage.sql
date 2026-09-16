-- ============================================================================
-- Panel interno de plataforma (`/platform-admin`) · Fase 3 — uso y consumo.
--
-- Actividad de usuarios (DAU/MAU) se deriva en el frontend de
-- auth.users.last_sign_in_at, ya disponible desde la Edge Function
-- platform-admin-users (Fase 2) — cero instrumentación nueva.
--
-- Lo que sí necesita RPC nuevo (RLS de negocio bloquea a un platform admin,
-- que no es miembro de ningún org):
--   1. Consumo de créditos por organización en una ventana de tiempo
--      (agregado de package_credit_log, ya existente).
--   2. Conteos de reservas/campañas por organización, para aproximar
--      "peso" de infraestructura — se agregan como columnas nuevas de
--      platform_admin_list_organizations en vez de un RPC aparte.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.platform_admin_list_organizations()
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN (
    SELECT coalesce(json_agg(row_to_json(o)), '[]'::json)
    FROM (
      SELECT
        org.id,
        org.slug,
        org.name,
        org.subscription_status,
        org.trial_ends_at,
        org.created_at,
        (SELECT count(*) FROM public.staff_members sm WHERE sm.organization_id = org.id AND sm.is_active) AS active_staff_count,
        (SELECT count(*) FROM public.dogs d WHERE d.organization_id = org.id) AS dogs_count,
        (SELECT count(*) FROM public.customers c WHERE c.organization_id = org.id) AS customers_count,
        (SELECT count(*) FROM public.reservations r WHERE r.organization_id = org.id) AS reservations_count,
        (SELECT count(*) FROM public.campaigns ca WHERE ca.organization_id = org.id) AS campaigns_count,
        (SELECT max(r.created_at) FROM public.reservations r WHERE r.organization_id = org.id) AS last_reservation_at
      FROM public.organizations org
      ORDER BY org.created_at DESC
    ) o
  );
END $$;

CREATE OR REPLACE FUNCTION public.platform_admin_credit_consumption(p_days int DEFAULT 30)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN (
    SELECT coalesce(json_agg(row_to_json(x) ORDER BY x.credits_consumed DESC), '[]'::json)
    FROM (
      SELECT
        org.id AS organization_id,
        org.name,
        org.slug,
        coalesce(sum(CASE WHEN log.action = 'deduct' THEN log.credits_before - log.credits_after ELSE 0 END), 0) AS credits_consumed,
        count(*) FILTER (WHERE log.action = 'deduct') AS deductions_count
      FROM public.organizations org
      JOIN public.package_credit_log log
        ON log.organization_id = org.id
       AND log.created_at > now() - (p_days || ' days')::interval
      GROUP BY org.id, org.name, org.slug
      HAVING coalesce(sum(CASE WHEN log.action = 'deduct' THEN log.credits_before - log.credits_after ELSE 0 END), 0) > 0
    ) x
  );
END $$;

GRANT EXECUTE ON FUNCTION public.platform_admin_credit_consumption(int) TO authenticated;
