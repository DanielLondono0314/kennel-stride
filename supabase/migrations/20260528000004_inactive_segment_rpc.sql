-- supabase/migrations/20260528000004_inactive_segment_rpc.sql
-- Retorna IDs de clientes de una org que no tienen reservas completadas
-- en los últimos N días. Usado por send-campaign para el segmento "inactive".
CREATE OR REPLACE FUNCTION public.get_inactive_customer_ids(
  p_organization_id uuid,
  p_days int DEFAULT 30
)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.customers c
  WHERE c.organization_id = p_organization_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.reservations r
      WHERE r.customer_id = c.id
        AND r.organization_id = p_organization_id
        AND r.status IN ('completed', 'checked_in', 'in_progress')
        AND r.start_date >= (CURRENT_DATE - (p_days || ' days')::interval)
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_inactive_customer_ids(uuid, int)
  TO authenticated, service_role;
