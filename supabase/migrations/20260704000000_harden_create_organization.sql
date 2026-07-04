-- PR-18: endurecer create_organization.
-- 1. Valida formato del slug en el servidor (antes solo lo validaba el cliente).
-- 2. Rechaza slugs reservados que chocan con rutas raíz de la app (/:orgSlug).
-- 3. Rate-limit: máx. 3 orgs nuevas por usuario en 24 h y 10 en total.
-- Los mensajes van en español porque el frontend los muestra tal cual.

CREATE OR REPLACE FUNCTION public.create_organization(p_name text, p_slug text)
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

  -- Nombre: obligatorio, 2–80 caracteres tras recortar espacios.
  p_name := btrim(p_name);
  IF p_name IS NULL OR length(p_name) < 2 OR length(p_name) > 80 THEN
    RAISE EXCEPTION 'El nombre del centro debe tener entre 2 y 80 caracteres';
  END IF;

  -- Slug: minúsculas/números/guiones, 3–40, sin guion inicial ni final.
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' THEN
    RAISE EXCEPTION 'URL inválido: usa 3–40 caracteres, solo minúsculas, números y guiones (sin guion al inicio o final)';
  END IF;

  -- Reservados: rutas raíz de la app y nombres sensibles.
  IF p_slug IN (
    'login', 'register', 'forgot-password', 'reset-password', 'join',
    'terminos', 'privacidad', 'onboarding', 'billing', 'worker',
    'admin', 'api', 'app', 'www', 'auth', 'dashboard', 'settings',
    'support', 'help', 'docs', 'blog', 'pricing', 'precios', 'assets', 'static'
  ) THEN
    RAISE EXCEPTION 'Ese URL está reservado, elige otro';
  END IF;

  -- Rate-limit por usuario (SECURITY DEFINER ve todas las filas).
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

  INSERT INTO public.organizations (name, slug, owner_id, subscription_status, trial_ends_at)
  VALUES (p_name, p_slug, v_user_id, 'trialing', now() + interval '14 days')
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'admin');

  RETURN json_build_object('slug', p_slug);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_organization(text, text) TO authenticated;
