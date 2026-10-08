-- Reserva el slug 'centros': /centros es la pantalla "Mis centros" (elegir
-- entre los centros a los que pertenece el usuario). Se reserva también
-- 'tailsup' (marca). Misma función que en 20260929000000_legal_consents.sql,
-- solo cambia la lista de slugs reservados.

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
