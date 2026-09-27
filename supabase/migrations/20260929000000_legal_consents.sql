-- ============================================================================
-- Cumplimiento Ley 1581 de 2012: prueba de aceptación de documentos legales y
-- de la autorización de los clientes finales de cada guardería.
--
-- 1. legal_acceptances: registro inmutable (quién, qué documento, qué versión,
--    cuándo, IP y navegador cuando están disponibles).
-- 2. Registro: el trigger sobre auth.users guarda la aceptación enviada en los
--    metadatos del signUp (funciona aunque la sesión no exista todavía porque
--    falta confirmar el correo).
-- 3. create_organization exige aceptar el Contrato de Transmisión de Datos.
-- 4. accept_invitation exige aceptar Términos y Política si el usuario no los
--    había aceptado antes.
-- 5. customers: data_consent_at / data_consent_by. Un INSERT directo desde la
--    app (rol authenticated) sin autorización se rechaza. Las funciones
--    SECURITY DEFINER (datos demo) no pasan por esta regla.
-- ============================================================================

-- ── 1. Registro de aceptaciones ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  document        text NOT NULL CHECK (document IN ('terms','privacy','data_processing','cookies')),
  version         text NOT NULL CHECK (length(version) BETWEEN 1 AND 40),
  accepted_at     timestamptz NOT NULL DEFAULT now(),
  ip              text,
  user_agent      text
);

CREATE INDEX IF NOT EXISTS legal_acceptances_user_idx ON public.legal_acceptances (user_id, document);
CREATE INDEX IF NOT EXISTS legal_acceptances_org_idx  ON public.legal_acceptances (organization_id);

ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;
-- Solo lectura desde la app: las filas se crean por funciones SECURITY DEFINER
-- y nunca se modifican ni borran (prueba de la autorización).
GRANT SELECT ON public.legal_acceptances TO authenticated;
GRANT ALL ON public.legal_acceptances TO service_role;

DROP POLICY IF EXISTS "legal_acceptances read" ON public.legal_acceptances;
CREATE POLICY "legal_acceptances read" ON public.legal_acceptances FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR organization_id IN (SELECT public.get_admin_org_ids()));

CREATE OR REPLACE FUNCTION public.guard_legal_acceptances_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Permitir el ON DELETE CASCADE / SET NULL de usuario u organización.
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id) THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.organization_id IS NULL AND OLD.organization_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = OLD.organization_id)
     AND (NEW.user_id, NEW.document, NEW.version, NEW.accepted_at)
         IS NOT DISTINCT FROM (OLD.user_id, OLD.document, OLD.version, OLD.accepted_at) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Las aceptaciones legales no se pueden modificar ni eliminar';
END;
$$;

DROP TRIGGER IF EXISTS legal_acceptances_immutable ON public.legal_acceptances;
CREATE TRIGGER legal_acceptances_immutable
  BEFORE UPDATE OR DELETE ON public.legal_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.guard_legal_acceptances_immutable();

-- IP y navegador del request HTTP actual (PostgREST), si existen.
CREATE OR REPLACE FUNCTION public.request_client_info(OUT ip text, OUT user_agent text)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  h json;
BEGIN
  BEGIN
    h := nullif(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN others THEN
    h := NULL;
  END;
  ip := COALESCE(h->>'cf-connecting-ip', split_part(h->>'x-forwarded-for', ',', 1), h->>'x-real-ip');
  ip := nullif(btrim(ip), '');
  user_agent := left(h->>'user-agent', 500);
END;
$$;

-- Uso interno (no expuesto a la API).
CREATE OR REPLACE FUNCTION public.record_legal_acceptance(
  p_user uuid, p_document text, p_version text, p_org uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ip text;
  v_ua text;
BEGIN
  SELECT ip, user_agent INTO v_ip, v_ua FROM public.request_client_info();
  INSERT INTO public.legal_acceptances (user_id, organization_id, document, version, ip, user_agent)
  VALUES (p_user, p_org, p_document, p_version, v_ip, v_ua);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_legal_acceptance(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;

-- ── 2. Aceptación en el registro (metadatos del signUp) ─────────────────────
CREATE OR REPLACE FUNCTION public.record_signup_legal_acceptance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_terms   text := nullif(NEW.raw_user_meta_data->>'accepted_terms_version', '');
  v_privacy text := nullif(NEW.raw_user_meta_data->>'accepted_privacy_version', '');
BEGIN
  IF v_terms IS NOT NULL THEN
    INSERT INTO public.legal_acceptances (user_id, document, version, user_agent)
    VALUES (NEW.id, 'terms', left(v_terms, 40), left(NEW.raw_user_meta_data->>'accepted_user_agent', 500));
  END IF;
  IF v_privacy IS NOT NULL THEN
    INSERT INTO public.legal_acceptances (user_id, document, version, user_agent)
    VALUES (NEW.id, 'privacy', left(v_privacy, 40), left(NEW.raw_user_meta_data->>'accepted_user_agent', 500));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_legal_acceptance ON auth.users;
CREATE TRIGGER on_auth_user_legal_acceptance
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.record_signup_legal_acceptance();

-- ── 3. create_organization: exige aceptar el Contrato de Transmisión ───────
-- Se reemplaza la firma (text,text) para que ninguna llamada antigua cree una
-- organización sin aceptación. Se reservan también las rutas legales nuevas.
DROP FUNCTION IF EXISTS public.create_organization(text, text);

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
  v_recent  integer;
  v_total   integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_dpa_version IS NULL OR btrim(p_dpa_version) = '' THEN
    RAISE EXCEPTION 'Debes aceptar el Contrato de Transmisión de Datos Personales para crear el centro';
  END IF;

  p_name := btrim(p_name);
  IF p_name IS NULL OR length(p_name) < 2 OR length(p_name) > 80 THEN
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
    'cookies', 'transmision-datos', 'autorizacion-clientes', 'legal'
  ) THEN
    RAISE EXCEPTION 'Ese URL está reservado, elige otro';
  END IF;

  SELECT count(*) INTO v_recent
  FROM public.organizations
  WHERE owner_id = v_user_id AND created_at > now() - interval '24 hours';
  IF v_recent >= 3 THEN
    RAISE EXCEPTION 'Has creado demasiados centros en las últimas 24 horas. Inténtalo mañana.';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.organizations
  WHERE owner_id = v_user_id;
  IF v_total >= 10 THEN
    RAISE EXCEPTION 'Has alcanzado el máximo de centros por cuenta';
  END IF;

  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'Ese URL ya está en uso, elige otro';
  END IF;

  INSERT INTO public.organizations (name, slug, owner_id, subscription_status, trial_ends_at)
  VALUES (p_name, p_slug, v_user_id, 'trialing', now() + interval '14 days')
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

-- ── 4. accept_invitation: exige Términos + Política si no los tenía ────────
DROP FUNCTION IF EXISTS public.accept_invitation(text);

CREATE OR REPLACE FUNCTION public.accept_invitation(
  p_token text, p_terms_version text DEFAULT NULL, p_privacy_version text DEFAULT NULL
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invite public.organization_invitations;
  v_user_id uuid;
  v_user_email text;
  v_slug text;
  v_profile public.profiles;
  v_staff_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_invite FROM public.organization_invitations
  WHERE token = p_token AND accepted_at IS NULL AND expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or expired invitation'; END IF;

  -- C1: la invitación solo puede aceptarla el correo destinatario.
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  IF lower(v_invite.email) <> lower(v_user_email) THEN
    RAISE EXCEPTION 'Esta invitación es para otro correo electrónico';
  END IF;

  -- Ley 1581: prueba de autorización. Quien ya aceptó (p. ej. al registrarse)
  -- no tiene que volver a hacerlo.
  IF nullif(btrim(p_terms_version), '') IS NOT NULL AND nullif(btrim(p_privacy_version), '') IS NOT NULL THEN
    PERFORM public.record_legal_acceptance(v_user_id, 'terms', left(btrim(p_terms_version), 40), v_invite.organization_id);
    PERFORM public.record_legal_acceptance(v_user_id, 'privacy', left(btrim(p_privacy_version), 40), v_invite.organization_id);
  ELSIF NOT EXISTS (SELECT 1 FROM public.legal_acceptances WHERE user_id = v_user_id AND document = 'terms')
     OR NOT EXISTS (SELECT 1 FROM public.legal_acceptances WHERE user_id = v_user_id AND document = 'privacy') THEN
    RAISE EXCEPTION 'Debes aceptar los Términos y la Política de Tratamiento de Datos para unirte';
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role_id)
  VALUES (v_invite.organization_id, v_user_id, v_invite.role_id)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

  UPDATE public.staff_members
  SET profile_id = v_user_id,
      role_id = v_invite.role_id,
      is_active = true,
      updated_at = now()
  WHERE organization_id = v_invite.organization_id
    AND lower(email) = lower(v_invite.email)
    AND profile_id IS NULL
  RETURNING id INTO v_staff_id;

  IF v_staff_id IS NULL THEN
    INSERT INTO public.staff_members (
      organization_id, profile_id, first_name, last_name, email, phone, role_id, is_active
    )
    VALUES (
      v_invite.organization_id,
      v_user_id,
      COALESCE(NULLIF(v_profile.first_name, ''), split_part(v_invite.email, '@', 1)),
      COALESCE(v_profile.last_name, ''),
      v_invite.email,
      COALESCE(v_profile.phone, ''),
      v_invite.role_id,
      true
    )
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.organization_invitations SET accepted_at = now() WHERE id = v_invite.id;

  SELECT slug INTO v_slug FROM public.organizations WHERE id = v_invite.organization_id;
  RETURN json_build_object('slug', v_slug, 'role', v_invite.role);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.accept_invitation(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text, text, text) TO authenticated;

-- ── 5. Autorización de los clientes finales ────────────────────────────────
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS data_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS data_consent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.guard_customer_data_consent()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Solo aplica a escrituras directas desde la app (rol authenticated). Las
  -- funciones SECURITY DEFINER (p. ej. datos demo) corren como owner.
  IF current_user = 'authenticated' THEN
    IF TG_OP = 'INSERT' AND NEW.data_consent_at IS NULL THEN
      RAISE EXCEPTION 'Debes confirmar que el cliente autorizó el tratamiento de sus datos personales';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.data_consent_at IS NOT NULL AND NEW.data_consent_at IS NULL THEN
      RAISE EXCEPTION 'No se puede borrar el registro de autorización del cliente';
    END IF;
    IF TG_OP = 'INSERT' OR NEW.data_consent_at IS DISTINCT FROM OLD.data_consent_at THEN
      -- La fecha la fija el servidor, no el navegador.
      NEW.data_consent_at := now();
      NEW.data_consent_by := auth.uid();
    ELSE
      NEW.data_consent_by := OLD.data_consent_by;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customers_data_consent ON public.customers;
CREATE TRIGGER customers_data_consent
  BEFORE INSERT OR UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.guard_customer_data_consent();
