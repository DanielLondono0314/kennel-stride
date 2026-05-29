-- ============================================================
-- Missing RPC functions never captured in migrations
-- ============================================================

-- ── 1. create_organization ───────────────────────────────────
-- Called from OnboardingPage to create a new org and add the
-- current user as admin in a single atomic transaction.
-- Returns json { slug } so the frontend can redirect immediately.
CREATE OR REPLACE FUNCTION public.create_organization(p_name text, p_slug text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_org_id  uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
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

-- ── 2. get_my_first_org_slug ──────────────────────────────────
-- Called from LoginPage after sign-in to redirect to the user's org.
-- Returns the slug of the first org the current user belongs to, or NULL.
CREATE OR REPLACE FUNCTION public.get_my_first_org_slug()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.slug
  FROM public.organizations o
  JOIN public.organization_members om ON om.organization_id = o.id
  WHERE om.user_id = auth.uid()
  ORDER BY om.created_at ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_first_org_slug() TO authenticated;

-- ── 3. check_expiring_packages (multi-tenant update) ─────────
-- Replaces the single-tenant version from the early migration.
-- Now scoped to the caller's organizations and inserts organization_id
-- into notices so org-scoped RLS policies accept the insert.
CREATE OR REPLACE FUNCTION public.check_expiring_packages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pkg RECORD;
BEGIN
  FOR pkg IN
    SELECT p.*, c.first_name, c.last_name
    FROM public.packages p
    JOIN public.customers c ON c.id = p.customer_id
    WHERE p.status = 'active'
      AND p.expires_at <= (CURRENT_DATE + interval '7 days')
      AND p.expires_at >= CURRENT_DATE
      AND p.organization_id IN (SELECT public.get_user_org_ids())
      AND NOT EXISTS (
        SELECT 1 FROM public.notices n
        WHERE n.entity_type = 'package'
          AND n.entity_id = p.id::text
          AND n.created_at > now() - interval '1 day'
      )
  LOOP
    INSERT INTO public.notices (
      organization_id, title, message, severity,
      entity_type, entity_id, auto_generated, suggested_actions
    )
    VALUES (
      pkg.organization_id,
      'Paquete Por Vencer',
      pkg.first_name || ' ' || pkg.last_name || ': paquete "' || pkg.name ||
        '" vence el ' || to_char(pkg.expires_at, 'DD/MM/YYYY') ||
        ' con ' || pkg.remaining_credits || ' créditos restantes.',
      CASE WHEN pkg.expires_at <= CURRENT_DATE + interval '2 days' THEN 'critical' ELSE 'warning' END,
      'package',
      pkg.id::text,
      true,
      json_build_array(
        json_build_object('label', 'Ver Paquete', 'action', 'navigate',
          'params', json_build_object('path', '/packages')),
        json_build_object('label', 'Contactar Cliente', 'action', 'contact',
          'params', json_build_object('customerId', pkg.customer_id::text))
      )::jsonb
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_expiring_packages() TO authenticated;

-- ── 4. check_overdue_invoices (multi-tenant update) ──────────
-- Replaces the single-tenant version. Scoped to caller's orgs
-- and inserts organization_id into notices.
CREATE OR REPLACE FUNCTION public.check_overdue_invoices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
BEGIN
  -- Mark pending invoices as overdue within the caller's orgs
  UPDATE public.invoices
  SET status = 'overdue', updated_at = now()
  WHERE status = 'pending'
    AND due_date < CURRENT_DATE
    AND organization_id IN (SELECT public.get_user_org_ids());

  FOR inv IN
    SELECT i.*, c.first_name, c.last_name
    FROM public.invoices i
    JOIN public.customers c ON c.id = i.customer_id
    WHERE i.status = 'overdue'
      AND i.organization_id IN (SELECT public.get_user_org_ids())
      AND NOT EXISTS (
        SELECT 1 FROM public.notices n
        WHERE n.entity_type = 'invoice'
          AND n.entity_id = i.id::text
          AND n.created_at > now() - interval '1 day'
      )
  LOOP
    INSERT INTO public.notices (
      organization_id, title, message, severity,
      entity_type, entity_id, auto_generated, suggested_actions
    )
    VALUES (
      inv.organization_id,
      'Factura Vencida',
      'Factura ' || inv.invoice_number || ' de ' || inv.first_name || ' ' ||
        inv.last_name || ' por $' || inv.total || ' está vencida.',
      'critical',
      'invoice',
      inv.id::text,
      true,
      json_build_array(
        json_build_object('label', 'Ver Factura', 'action', 'navigate',
          'params', json_build_object('path', '/invoices')),
        json_build_object('label', 'Enviar Recordatorio', 'action', 'sendReminder',
          'params', json_build_object('customerId', inv.customer_id::text))
      )::jsonb
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_overdue_invoices() TO authenticated;
