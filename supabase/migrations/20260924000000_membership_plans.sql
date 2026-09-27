-- ============================================================================
-- Membresías por plan (Esencial / Pro / Premium)
--
-- Modelo: el PLAN es un atributo de la organización (`organizations.plan_tier`),
-- no del usuario. Los roles de `app_role` siguen siendo de permisos DENTRO del
-- negocio. Un admin de una org Esencial es "Rol A", de una Pro "Rol B" y de una
-- Premium "Rol C": mismos permisos de admin, distintos módulos.
--
-- Fuente de verdad de qué incluye cada plan: `plan_features` (+ límites en
-- `plan_catalog`). El frontend replica la matriz en src/lib/plans.ts; el test
-- supabase/tests/database/membership_plans.test.sql vigila que no diverjan en
-- lo que el backend hace cumplir.
--
-- Orgs existentes y trials nuevos arrancan en 'premium' (todo desbloqueado):
-- el trial muestra el producto completo y los clientes actuales no pierden nada.
-- El webhook de LemonSqueezy baja/sube el tier al mapear el variant comprado.
-- ============================================================================

-- ── 1. Columna plan_tier ─────────────────────────────────────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'premium'
  CHECK (plan_tier IN ('basic', 'pro', 'premium'));

-- ── 2. Catálogo de planes (precios públicos + límites + variant de LS) ───
CREATE TABLE IF NOT EXISTS public.plan_catalog (
  tier               text PRIMARY KEY CHECK (tier IN ('basic', 'pro', 'premium')),
  display_name       text NOT NULL,
  monthly_price_usd  numeric(8,2) NOT NULL,
  monthly_price_cop  integer NOT NULL,
  ls_variant_id      text UNIQUE,          -- se llena desde /platform-admin o SQL
  max_members        integer,              -- NULL = ilimitado
  max_dogs           integer,              -- NULL = ilimitado
  sort_order         integer NOT NULL
);

ALTER TABLE public.plan_catalog ENABLE ROW LEVEL SECURITY;

-- Precios y límites no son secretos (se muestran en la página de facturación).
DROP POLICY IF EXISTS "plan_catalog read" ON public.plan_catalog;
CREATE POLICY "plan_catalog read" ON public.plan_catalog
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.plan_catalog (tier, display_name, monthly_price_usd, monthly_price_cop, max_members, max_dogs, sort_order)
VALUES
  ('basic',   'Esencial', 19.00,  79000,  2,    200,  1),
  ('pro',     'Pro',      49.00,  199000, 10,   1000, 2),
  ('premium', 'Premium',  99.00,  399000, NULL, NULL, 3)
ON CONFLICT (tier) DO NOTHING;

-- ── 3. Features por plan ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plan_features (
  tier    text NOT NULL CHECK (tier IN ('basic', 'pro', 'premium')),
  feature text NOT NULL,
  PRIMARY KEY (tier, feature)
);

ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_features read" ON public.plan_features;
CREATE POLICY "plan_features read" ON public.plan_features
  FOR SELECT TO authenticated USING (true);

-- Explícito: los proyectos nuevos de Supabase ya no otorgan acceso por defecto
-- a tablas nuevas de public (el webhook lee plan_catalog como service_role).
GRANT SELECT ON public.plan_catalog, public.plan_features TO authenticated;
GRANT ALL ON public.plan_catalog, public.plan_features TO service_role;

-- Esencial: operador individual (adiestrador, paseador, groomer independiente)
INSERT INTO public.plan_features (tier, feature)
SELECT 'basic', f FROM unnest(ARRAY[
  'dashboard', 'customers', 'dogs', 'calendar', 'tasks', 'packages',
  'invoices', 'reports', 'routes', 'staff', 'settings'
]) AS f
ON CONFLICT DO NOTHING;

-- Pro: guardería / daycare con equipo (Esencial + comunicación con el cliente)
INSERT INTO public.plan_features (tier, feature)
SELECT 'pro', f FROM unnest(ARRAY[
  'dashboard', 'customers', 'dogs', 'calendar', 'tasks', 'packages',
  'invoices', 'reports', 'routes', 'staff', 'settings',
  'requests', 'notices', 'report_cards', 'route_notifications'
]) AS f
ON CONFLICT DO NOTHING;

-- Premium: hotel / resort canino (Pro + instalaciones, clínica, marketing)
INSERT INTO public.plan_features (tier, feature)
SELECT 'premium', f FROM unnest(ARRAY[
  'dashboard', 'customers', 'dogs', 'calendar', 'tasks', 'packages',
  'invoices', 'reports', 'routes', 'staff', 'settings',
  'requests', 'notices', 'report_cards', 'route_notifications',
  'facility', 'clinic', 'campaigns'
]) AS f
ON CONFLICT DO NOTHING;

-- ── 4. Helpers ───────────────────────────────────────────────────────────
-- Un platform admin (equipo KennelStride) tiene TODAS las features en TODAS las
-- orgs: es el "super admin" que puede probar cada módulo.
CREATE OR REPLACE FUNCTION public.org_has_feature(p_org_id uuid, p_feature text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_admin()
      OR EXISTS (
        SELECT 1
        FROM public.organizations o
        JOIN public.plan_features pf ON pf.tier = o.plan_tier
        WHERE o.id = p_org_id AND pf.feature = p_feature
      );
$$;

GRANT EXECUTE ON FUNCTION public.org_has_feature(uuid, text) TO authenticated;

-- ── 5. Blindaje de plan_tier ─────────────────────────────────────────────
-- Las policies de UPDATE en `organizations` dejan a cualquier admin del kennel
-- escribir cualquier columna. Sin este guard, un admin Esencial podría
-- auto-ascenderse a Premium con un UPDATE directo. Solo pueden cambiar el tier:
--   · service_role / migraciones (auth.uid() IS NULL) → webhook de LemonSqueezy
--   · un platform admin → RPC platform_admin_set_plan_tier
CREATE OR REPLACE FUNCTION public.guard_org_plan_tier()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.plan_tier := 'premium';  -- trial completo; el cliente no elige tier al crear
  ELSIF NEW.plan_tier IS DISTINCT FROM OLD.plan_tier THEN
    RAISE EXCEPTION 'El plan solo puede cambiarse desde facturación';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_org_plan_tier ON public.organizations;
CREATE TRIGGER guard_org_plan_tier
  BEFORE INSERT OR UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.guard_org_plan_tier();

-- Al bajar de plan (o si alguien intenta activarlo), las notificaciones de ruta
-- (SMS/WhatsApp, con costo por mensaje) se apagan si el plan no las incluye.
-- BEFORE UPDATE va después del guard (orden alfabético de nombre de trigger).
CREATE OR REPLACE FUNCTION public.enforce_org_route_notifications_feature()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.route_notifications_enabled AND NOT EXISTS (
    SELECT 1 FROM public.plan_features
    WHERE tier = NEW.plan_tier AND feature = 'route_notifications'
  ) THEN
    NEW.route_notifications_enabled := false;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS org_route_notifications_feature ON public.organizations;
CREATE TRIGGER org_route_notifications_feature
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_org_route_notifications_feature();

-- ── 6. Límites del plan (solo bloquean ALTAS nuevas) ─────────────────────
-- Al bajar de plan con más datos que el límite no se borra nada: simplemente no
-- se pueden crear más hasta volver a caber o subir de plan.
CREATE OR REPLACE FUNCTION public.enforce_plan_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_limit   integer;
  v_current integer;
BEGIN
  IF auth.uid() IS NULL OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'dogs' THEN
    SELECT pc.max_dogs INTO v_limit
    FROM public.organizations o JOIN public.plan_catalog pc ON pc.tier = o.plan_tier
    WHERE o.id = NEW.organization_id;
    IF v_limit IS NOT NULL THEN
      SELECT count(*) INTO v_current FROM public.dogs WHERE organization_id = NEW.organization_id;
      IF v_current >= v_limit THEN
        RAISE EXCEPTION 'plan_limit_dogs: tu plan permite hasta % perros', v_limit
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'organization_members' THEN
    SELECT pc.max_members INTO v_limit
    FROM public.organizations o JOIN public.plan_catalog pc ON pc.tier = o.plan_tier
    WHERE o.id = NEW.organization_id;
    IF v_limit IS NOT NULL THEN
      SELECT count(*) INTO v_current FROM public.organization_members WHERE organization_id = NEW.organization_id;
      IF v_current >= v_limit THEN
        RAISE EXCEPTION 'plan_limit_members: tu plan permite hasta % usuarios', v_limit
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS enforce_plan_limit_dogs ON public.dogs;
CREATE TRIGGER enforce_plan_limit_dogs
  BEFORE INSERT ON public.dogs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limit();

DROP TRIGGER IF EXISTS enforce_plan_limit_members ON public.organization_members;
CREATE TRIGGER enforce_plan_limit_members
  BEFORE INSERT ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limit();

-- ── 7. Policies RESTRICTIVE de INSERT en tablas de módulos de pago ───────
-- RESTRICTIVE se combina con AND sobre las policies existentes: no las toca ni
-- las relaja, solo agrega "y además el plan incluye el módulo". Solo INSERT:
-- lectura/edición de datos previos sigue funcionando tras un downgrade.
DROP POLICY IF EXISTS "plan gate facility_zones" ON public.facility_zones;
CREATE POLICY "plan gate facility_zones" ON public.facility_zones
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.org_has_feature(organization_id, 'facility'));

DROP POLICY IF EXISTS "plan gate facility_units" ON public.facility_units;
CREATE POLICY "plan gate facility_units" ON public.facility_units
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.org_has_feature(organization_id, 'facility'));

DROP POLICY IF EXISTS "plan gate campaigns" ON public.campaigns;
CREATE POLICY "plan gate campaigns" ON public.campaigns
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.org_has_feature(organization_id, 'campaigns'));

DROP POLICY IF EXISTS "plan gate report_cards" ON public.report_cards;
CREATE POLICY "plan gate report_cards" ON public.report_cards
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.org_has_feature(organization_id, 'report_cards'));

-- ── 8. Platform admin: cambiar el plan de una org (auditado) ─────────────
CREATE OR REPLACE FUNCTION public.platform_admin_set_plan_tier(
  p_org_id uuid, p_tier text, p_reason text
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before text;
BEGIN
  IF public.get_platform_admin_role() IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF p_tier NOT IN ('basic', 'pro', 'premium') THEN
    RAISE EXCEPTION 'Plan inválido: %', p_tier;
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Se requiere un motivo';
  END IF;

  SELECT plan_tier INTO v_before FROM public.organizations WHERE id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organización no encontrada';
  END IF;

  UPDATE public.organizations
    SET plan_tier = p_tier, updated_at = now()
  WHERE id = p_org_id;

  INSERT INTO public.platform_admin_audit_log (admin_user_id, action, target_org_id, metadata)
  VALUES (auth.uid(), 'set_plan_tier', p_org_id, jsonb_build_object(
    'before', v_before, 'after', p_tier, 'reason', p_reason
  ));

  RETURN json_build_object('before', v_before, 'after', p_tier);
END $$;

GRANT EXECUTE ON FUNCTION public.platform_admin_set_plan_tier(uuid, text, text) TO authenticated;

-- ── 9. Listado y detalle del panel incluyen el plan ──────────────────────
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
        org.plan_tier,
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
        SELECT id, slug, name, subscription_status, plan_tier, trial_ends_at, created_at,
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
