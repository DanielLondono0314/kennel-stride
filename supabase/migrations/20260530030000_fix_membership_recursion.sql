-- ============================================================================
-- HOTFIX: recursión infinita en RLS de organization_members.
--
-- La política "Admins can manage memberships" (de 20260403000001_security_hardening)
-- es FOR ALL y su USING hace `EXISTS (SELECT 1 FROM organization_members ...)`.
-- Como FOR ALL aplica también al SELECT, al consultar organization_members la
-- política se evalúa sobre su propio subselect → Postgres lanza
-- "infinite recursion detected in policy for relation organization_members"
-- → PostgREST responde 500 (p.ej. al cargar la organización por slug en
-- OrganizationContext). Latente desde esa migración; se manifestó al aplicarla
-- al remoto vía `supabase db push`.
--
-- Fix: evaluar el rol admin con una función SECURITY DEFINER (bypassa RLS, igual
-- que get_user_org_ids), eliminando la auto-referencia recursiva.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid()
      AND organization_id = p_org
      AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;

DROP POLICY IF EXISTS "Admins can manage memberships" ON public.organization_members;
CREATE POLICY "Admins can manage memberships"
  ON public.organization_members FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));
