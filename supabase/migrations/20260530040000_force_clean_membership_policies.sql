-- ============================================================================
-- HOTFIX (robusto): fuerza un set de políticas NO recursivo en organization_members.
--
-- El 500 "infinite recursion detected in policy for relation organization_members"
-- persistía en producción incluso tras la migración previa. Causa probable: además
-- de la política de las migraciones, el proyecto remoto puede tener políticas
-- creadas fuera de migración (p.ej. por Lovable) bajo OTRO nombre, también
-- recursivas. Esta migración elimina TODAS las políticas de organization_members
-- (sin depender del nombre) y recrea solo las dos canónicas, ambas no recursivas
-- (vía funciones SECURITY DEFINER que bypassean RLS).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND organization_id = p_org AND role = 'admin'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;

-- Eliminar TODAS las políticas existentes de organization_members (cualquier nombre).
DO $$
DECLARE pol text;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy WHERE polrelid = 'public.organization_members'::regclass
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.organization_members', pol);
  END LOOP;
END $$;

-- Recrear solo las dos políticas canónicas (no recursivas).
CREATE POLICY "Members can view memberships"
  ON public.organization_members FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Admins can manage memberships"
  ON public.organization_members FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));
