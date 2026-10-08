-- ============================================================================
-- Multi-sede (plan Premium)
--
-- Una SEDE es un centro normal (sus propios clientes, perros, catálogo,
-- inventario y personal) que cuelga de una SEDE PRINCIPAL vía parent_org_id.
-- Reglas de negocio:
--   · Solo el plan Premium con pago ACTIVO puede abrir sedes (no en el trial).
--   · Premium incluye hasta plan_catalog.max_locations centros (principal +
--     sedes); ajustable sin tocar código.
--   · Solo el dueño de la sede principal crea sedes.
--   · Las sedes heredan la suscripción de la principal. Si la principal deja de
--     pagar o baja de Premium, sus sedes quedan 'suspended' (datos intactos) y
--     vuelven solas al reactivar.
--   · Una cuenta solo puede tener UN centro independiente: los demás son sedes.
--     Antes cualquiera podía abrir hasta 10 centros, cada uno con su trial.
-- ============================================================================


-- ── 1. Vínculo sede → principal ────────────────────────────────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS parent_org_id uuid
  REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_parent_not_self;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_parent_not_self CHECK (parent_org_id IS NULL OR parent_org_id <> id);

CREATE INDEX IF NOT EXISTS organizations_parent_org_id_idx
  ON public.organizations (parent_org_id) WHERE parent_org_id IS NOT NULL;


-- ── 2. Cupo de sedes por plan ──────────────────────────────────────────────
ALTER TABLE public.plan_catalog
  ADD COLUMN IF NOT EXISTS max_locations integer NOT NULL DEFAULT 1 CHECK (max_locations >= 1);
UPDATE public.plan_catalog SET max_locations = 5 WHERE tier = 'premium';

INSERT INTO public.plan_features (tier, feature) VALUES ('premium', 'locations')
ON CONFLICT DO NOTHING;


-- ── 3. Guards: parent_org_id inmutable + bypass de la sincronización ───────
-- La sincronización de sedes (sección 4) escribe columnas de facturación con
-- el auth.uid() del usuario que dispara el cambio, así que los guards la dejan
-- pasar con un flag de transacción que solo ponen funciones SECURITY DEFINER
-- sin EXECUTE para clientes (PostgREST no expone set_config).
CREATE OR REPLACE FUNCTION public.guard_org_billing_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- service_role (webhook de facturación, cron), platform admins y la
  -- sincronización de sedes pasan.
  IF auth.uid() IS NULL OR public.is_platform_admin()
     OR current_setting('tailsup.sede_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.subscription_status := 'trialing';
    NEW.trial_ends_at       := now() + interval '14 days';
    NEW.ls_customer_id      := NULL;
    NEW.ls_subscription_id  := NULL;
    NEW.parent_org_id       := NULL;  -- las sedes solo nacen por create_sede
  ELSIF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.trial_ends_at      IS DISTINCT FROM OLD.trial_ends_at
     OR NEW.ls_customer_id     IS DISTINCT FROM OLD.ls_customer_id
     OR NEW.ls_subscription_id IS DISTINCT FROM OLD.ls_subscription_id
     OR NEW.owner_id           IS DISTINCT FROM OLD.owner_id
     OR NEW.parent_org_id      IS DISTINCT FROM OLD.parent_org_id THEN
    -- parent_org_id incluido: colgar un centro de la principal de otro le daría
    -- Premium gratis.
    RAISE EXCEPTION 'La suscripción solo puede cambiarse desde facturación';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_org_plan_tier()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_platform_admin()
     OR current_setting('tailsup.sede_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.plan_tier := 'premium';  -- trial completo; el cliente no elige tier al crear
  ELSIF NEW.plan_tier IS DISTINCT FROM OLD.plan_tier THEN
    RAISE EXCEPTION 'El plan solo puede cambiarse desde facturación';
  END IF;
  RETURN NEW;
END $$;


-- ── 4. Las sedes heredan la suscripción de la principal ────────────────────
CREATE OR REPLACE FUNCTION public.sync_sedes_billing(p_parent_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p record;
  v_status text;
BEGIN
  SELECT plan_tier, subscription_status, trial_ends_at INTO p
  FROM public.organizations WHERE id = p_parent_id AND parent_org_id IS NULL;
  IF NOT FOUND THEN RETURN; END IF;

  -- Multi-sede es de Premium: si la principal baja de plan, las sedes se
  -- suspenden (no se borra nada) hasta que vuelva a Premium.
  v_status := CASE WHEN p.plan_tier = 'premium' THEN p.subscription_status ELSE 'suspended' END;

  PERFORM set_config('tailsup.sede_sync', 'on', true);
  UPDATE public.organizations
     SET plan_tier = p.plan_tier,
         subscription_status = v_status,
         trial_ends_at = p.trial_ends_at
   WHERE parent_org_id = p_parent_id
     AND (plan_tier, subscription_status, trial_ends_at)
         IS DISTINCT FROM (p.plan_tier, v_status, p.trial_ends_at);
  PERFORM set_config('tailsup.sede_sync', 'off', true);
END $$;

REVOKE EXECUTE ON FUNCTION public.sync_sedes_billing(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_sync_sedes_billing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.parent_org_id IS NULL
     AND (NEW.plan_tier, NEW.subscription_status, NEW.trial_ends_at)
         IS DISTINCT FROM (OLD.plan_tier, OLD.subscription_status, OLD.trial_ends_at) THEN
    PERFORM public.sync_sedes_billing(NEW.id);
  END IF;
  RETURN NULL;
END $$;

REVOKE EXECUTE ON FUNCTION public.trg_sync_sedes_billing() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_sedes_billing ON public.organizations;
CREATE TRIGGER sync_sedes_billing
  AFTER UPDATE OF plan_tier, subscription_status, trial_ends_at ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_sedes_billing();


-- ── 5. Validación común para crear centros y sedes ─────────────────────────
-- Antes vivía dentro de create_organization; se comparte para que la lista de
-- slugs reservados no se duplique. Devuelve el nombre normalizado.
CREATE OR REPLACE FUNCTION public.assert_new_org_allowed(p_name text, p_slug text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_name    text := btrim(p_name);
  v_recent  integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_name IS NULL OR length(v_name) < 2 OR length(v_name) > 80 THEN
    RAISE EXCEPTION 'El nombre del centro debe tener entre 2 y 80 caracteres';
  END IF;

  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' THEN
    RAISE EXCEPTION 'URL inválido: usa 3–40 caracteres, solo minúsculas, números y guiones (sin guion al inicio o final)';
  END IF;

  IF p_slug IN (
    'login', 'register', 'forgot-password', 'reset-password', 'join',
    'terminos', 'privacidad', 'onboarding', 'billing', 'worker',
    'admin', 'api', 'app', 'www', 'auth', 'dashboard', 'settings',
    'support', 'help', 'docs', 'blog', 'pricing', 'precios', 'assets', 'static',
    'platform-admin', 'platform', 'kennelops', 'kennelstride', 'status',
    'cookies', 'transmision-datos', 'autorizacion-clientes', 'legal',
    'centros', 'tailsup'
  ) THEN
    RAISE EXCEPTION 'Ese URL está reservado, elige otro';
  END IF;

  SELECT count(*) INTO v_recent
  FROM public.organizations
  WHERE owner_id = v_user_id AND created_at > now() - interval '24 hours';
  IF v_recent >= 3 THEN
    RAISE EXCEPTION 'Has creado demasiados centros en las últimas 24 horas. Inténtalo mañana.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'Ese URL ya está en uso, elige otro';
  END IF;

  RETURN v_name;
END $$;

REVOKE EXECUTE ON FUNCTION public.assert_new_org_allowed(text, text) FROM PUBLIC, anon, authenticated;


-- ── 6. create_organization: un solo centro independiente por cuenta ────────
CREATE OR REPLACE FUNCTION public.create_organization(
  p_name text, p_slug text, p_dpa_version text DEFAULT NULL,
  p_terms_version text DEFAULT NULL, p_privacy_version text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_org_id  uuid;
  v_name    text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_dpa_version IS NULL OR btrim(p_dpa_version) = '' THEN
    RAISE EXCEPTION 'Debes aceptar el Contrato de Transmisión de Datos Personales para crear el centro';
  END IF;

  v_name := public.assert_new_org_allowed(p_name, p_slug);

  IF EXISTS (SELECT 1 FROM public.organizations WHERE owner_id = v_user_id) THEN
    RAISE EXCEPTION 'Ya tienes un centro. Las sedes adicionales se crean desde Configuración → Sedes (plan Premium)';
  END IF;

  INSERT INTO public.organizations (name, slug, owner_id, subscription_status, trial_ends_at)
  VALUES (v_name, p_slug, v_user_id, 'trialing', now() + interval '14 days')
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'admin');

  PERFORM public.record_legal_acceptance(v_user_id, 'data_processing', left(btrim(p_dpa_version), 40), v_org_id);
  -- Quien entró con Google no pasó por el formulario de registro: se registra
  -- aquí su aceptación de Términos y Política si aún no la tenía.
  IF nullif(btrim(p_terms_version), '') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.legal_acceptances WHERE user_id = v_user_id AND document = 'terms') THEN
    PERFORM public.record_legal_acceptance(v_user_id, 'terms', left(btrim(p_terms_version), 40), v_org_id);
  END IF;
  IF nullif(btrim(p_privacy_version), '') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.legal_acceptances WHERE user_id = v_user_id AND document = 'privacy') THEN
    PERFORM public.record_legal_acceptance(v_user_id, 'privacy', left(btrim(p_privacy_version), 40), v_org_id);
  END IF;

  RETURN json_build_object('slug', p_slug);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_organization(text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization(text, text, text, text, text) TO authenticated;


-- ── 7. Cupo de sedes (para la UI y para create_sede) ───────────────────────
-- Acepta la principal o cualquiera de sus sedes. Solo para miembros del centro.
CREATE OR REPLACE FUNCTION public.get_sede_quota(p_org_id uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_parent  uuid;
  pr        record;
  v_used    integer;
  v_max     integer;
  v_reason  text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT parent_org_id INTO v_parent FROM public.organizations WHERE id = p_org_id;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.organization_members WHERE organization_id = p_org_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Centro no encontrado';
  END IF;

  SELECT id, slug, name, owner_id, plan_tier, subscription_status INTO pr
  FROM public.organizations WHERE id = coalesce(v_parent, p_org_id);

  SELECT count(*) INTO v_used
  FROM public.organizations WHERE id = pr.id OR parent_org_id = pr.id;

  SELECT max_locations INTO v_max FROM public.plan_catalog WHERE tier = pr.plan_tier;
  v_max := coalesce(v_max, 1);

  v_reason := CASE
    WHEN pr.owner_id IS DISTINCT FROM v_user_id THEN 'Solo el dueño de la sede principal puede crear sedes'
    WHEN pr.plan_tier <> 'premium' OR pr.subscription_status <> 'active'
      THEN 'Las sedes están disponibles con el plan Premium activo'
    WHEN v_used >= v_max THEN format('Tu plan permite hasta %s sedes', v_max)
  END;

  RETURN json_build_object(
    'principal_id',   pr.id,
    'principal_slug', pr.slug,
    'principal_name', pr.name,
    'is_sede',        v_parent IS NOT NULL,
    'is_owner',       pr.owner_id = v_user_id,
    'used',           v_used,
    'max',            v_max,
    'can_create',     v_reason IS NULL,
    'reason',         v_reason
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.get_sede_quota(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sede_quota(uuid) TO authenticated;


-- ── 8. create_sede ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_sede(
  p_parent_org_id uuid, p_name text, p_slug text, p_dpa_version text DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_quota   json;
  v_name    text;
  pr        record;
  v_org_id  uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_dpa_version IS NULL OR btrim(p_dpa_version) = '' THEN
    RAISE EXCEPTION 'Debes aceptar el Contrato de Transmisión de Datos Personales para crear el centro';
  END IF;

  -- Siempre contra la principal: no se crean sedes de una sede.
  v_quota := public.get_sede_quota(p_parent_org_id);
  IF NOT (v_quota->>'can_create')::boolean THEN
    RAISE EXCEPTION '%', v_quota->>'reason';
  END IF;

  v_name := public.assert_new_org_allowed(p_name, p_slug);

  SELECT id, plan_tier, subscription_status, trial_ends_at, timezone INTO pr
  FROM public.organizations WHERE id = (v_quota->>'principal_id')::uuid;

  PERFORM set_config('tailsup.sede_sync', 'on', true);
  INSERT INTO public.organizations
    (name, slug, owner_id, parent_org_id, plan_tier, subscription_status, trial_ends_at, timezone)
  VALUES
    (v_name, p_slug, v_user_id, pr.id, pr.plan_tier, pr.subscription_status, pr.trial_ends_at, pr.timezone)
  RETURNING id INTO v_org_id;
  PERFORM set_config('tailsup.sede_sync', 'off', true);

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'admin');

  PERFORM public.record_legal_acceptance(v_user_id, 'data_processing', left(btrim(p_dpa_version), 40), v_org_id);

  RETURN json_build_object('slug', p_slug);
END $$;

REVOKE EXECUTE ON FUNCTION public.create_sede(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_sede(uuid, text, text, text) TO authenticated;
