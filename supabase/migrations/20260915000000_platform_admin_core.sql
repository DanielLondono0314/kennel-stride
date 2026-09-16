-- ============================================================================
-- Panel interno de plataforma (`/platform-admin`) · Fase 1
--
-- Eje de acceso NUEVO y separado de `organization_members` / `app_role`:
-- un platform admin es alguien del equipo de KennelStride, no un miembro de
-- ningún kennel. Por eso `platform_admins` es una tabla propia sin relación
-- con `organizations`.
--
-- Decisión de diseño: en vez de añadir `OR public.is_platform_admin()` a las
-- policies RLS existentes de las tablas de negocio (customers, dogs,
-- reservations, ...) —lo que ampliaría la superficie de cada una de esas
-- policies ya endurecidas en 20260530010000_role_based_rls.sql y sus
-- parches posteriores (fix_membership_recursion, force_clean_anon_policies,
-- fix_invitation_and_idor)— todo acceso cross-tenant de este panel pasa por
-- RPCs `SECURITY DEFINER` dedicados (`platform_admin_*`). Así el único
-- código nuevo que puede leer/escribir a través de todos los tenants vive en
-- un puñado de funciones auditables, y el resto del RLS existente no se
-- toca.
-- ============================================================================

-- ── 1. platform_admins ───────────────────────────────────────────────────
-- Sin policies para `authenticated`: es intencional (deny-all). El único
-- acceso de lectura/escritura es a través de las funciones SECURITY DEFINER
-- de abajo, que corren como el owner de la función y bypasean RLS.
CREATE TABLE IF NOT EXISTS public.platform_admins (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('owner', 'support_readonly')),
  is_active  boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- ── 2. Helpers ────────────────────────────────────────────────────────────
-- Se definen antes de la tabla de audit log porque su policy de SELECT
-- (más abajo) depende de is_platform_admin().
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth.uid() AND is_active
  );
$$;

CREATE OR REPLACE FUNCTION public.get_platform_admin_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.platform_admins
  WHERE user_id = auth.uid() AND is_active
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin()        TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_admin_role()  TO authenticated;

-- ── 3. platform_admin_audit_log ──────────────────────────────────────────
-- Lectura para cualquier platform admin activo; escritura SOLO desde los
-- RPCs de abajo (no hay policy de INSERT para `authenticated`).
CREATE TABLE IF NOT EXISTS public.platform_admin_audit_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action         text NOT NULL,
  target_org_id  uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata       jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_platform_admin_audit_log_created ON public.platform_admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_admin_audit_log_org     ON public.platform_admin_audit_log(target_org_id);

DROP POLICY IF EXISTS "Platform admins can read audit log" ON public.platform_admin_audit_log;
CREATE POLICY "Platform admins can read audit log"
  ON public.platform_admin_audit_log FOR SELECT TO authenticated
  USING (public.is_platform_admin());

-- ── 4. RPCs de lectura cross-tenant (Fase 1: solo lectura) ───────────────
CREATE OR REPLACE FUNCTION public.platform_admin_overview_stats()
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN json_build_object(
    'total_organizations',     (SELECT count(*) FROM public.organizations),
    'active_organizations',    (SELECT count(*) FROM public.organizations WHERE subscription_status = 'active'),
    'trialing_organizations',  (SELECT count(*) FROM public.organizations WHERE subscription_status = 'trialing' AND trial_ends_at > now()),
    'cancelled_organizations', (SELECT count(*) FROM public.organizations WHERE subscription_status NOT IN ('active', 'trialing')),
    'new_organizations_30d',   (SELECT count(*) FROM public.organizations WHERE created_at > now() - interval '30 days'),
    'total_dogs',               (SELECT count(*) FROM public.dogs),
    'total_customers',          (SELECT count(*) FROM public.customers),
    'total_staff',               (SELECT count(*) FROM public.staff_members WHERE is_active)
  );
END $$;

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
        (SELECT max(r.created_at) FROM public.reservations r WHERE r.organization_id = org.id) AS last_reservation_at
      FROM public.organizations org
      ORDER BY org.created_at DESC
    ) o
  );
END $$;

CREATE OR REPLACE FUNCTION public.platform_admin_org_detail(p_org_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result json;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  INSERT INTO public.platform_admin_audit_log (admin_user_id, action, target_org_id)
  VALUES (auth.uid(), 'view_org_detail', p_org_id);

  SELECT json_build_object(
    'organization', (
      SELECT row_to_json(o) FROM (
        SELECT id, slug, name, subscription_status, trial_ends_at, created_at,
               ls_customer_id, ls_subscription_id
        FROM public.organizations WHERE id = p_org_id
      ) o
    ),
    'staff', (
      SELECT coalesce(json_agg(row_to_json(s)), '[]'::json) FROM (
        SELECT id, first_name, last_name, role, is_active, email
        FROM public.staff_members WHERE organization_id = p_org_id
        ORDER BY created_at
      ) s
    ),
    'packages', (
      SELECT coalesce(json_agg(row_to_json(p)), '[]'::json) FROM (
        SELECT id, name, status, remaining_credits, total_credits, expires_at, created_at
        FROM public.packages WHERE organization_id = p_org_id
        ORDER BY created_at DESC LIMIT 20
      ) p
    ),
    'counts', json_build_object(
      'dogs',      (SELECT count(*) FROM public.dogs WHERE organization_id = p_org_id),
      'customers', (SELECT count(*) FROM public.customers WHERE organization_id = p_org_id),
      'staff',     (SELECT count(*) FROM public.staff_members WHERE organization_id = p_org_id)
    )
  ) INTO v_result;

  RETURN v_result;
END $$;

GRANT EXECUTE ON FUNCTION public.platform_admin_overview_stats()        TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_list_organizations()    TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_admin_org_detail(uuid)        TO authenticated;

-- ── 5. Bootstrap del primer platform admin ───────────────────────────────
-- Idempotente: si el usuario existe en este entorno (prod/staging/local con
-- seed) y todavía no está en platform_admins, se agrega como 'owner'. En
-- entornos donde el usuario no exista (p. ej. CI sin ese seed) no hace nada.
DO $$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'dearloups@gmail.com' LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.platform_admins (user_id, role, created_by)
    VALUES (v_user_id, 'owner', v_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END $$;
