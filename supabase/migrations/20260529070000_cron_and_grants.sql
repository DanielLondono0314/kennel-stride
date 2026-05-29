-- =============================================================================
-- Stream G — Operational hardening (M1, M3, M6)
-- 20260529070000_cron_and_grants.sql
--
-- Goal (M1): the "check_*" notice-generation jobs must NOT be triggerable by
-- end-user clients. They were granted to `authenticated` and were fired from
-- NoticesPage on every "Verificar Alertas" click, letting any logged-in user
-- drive arbitrary org-scoped scans on demand.
--
-- Fix:
--   1. REVOKE EXECUTE on the existing org-scoped functions from authenticated /
--      anon / PUBLIC. They keep working under SECURITY DEFINER for the owner,
--      but the client RPC surface no longer exposes them.
--   2. Provide service-role/pg_cron counterparts that scan ALL organizations.
--      The org-scoped originals filter by `get_user_org_ids()`, which keys off
--      `auth.uid()`; under service_role (pg_cron) `auth.uid()` is NULL, so those
--      bodies would process zero orgs. The *_all_orgs() variants below remove
--      that per-caller filter so the scheduled job covers every tenant.
--   3. Schedule the *_all_orgs() variants with pg_cron when the extension is
--      available; otherwise leave documented commands to run manually.
--
-- Idempotent: REVOKE/GRANT and CREATE OR REPLACE are safe to re-run; the
-- pg_cron block unschedules any prior job of the same name before re-scheduling.
-- =============================================================================

-- ── 1. Revoke client EXECUTE on the on-demand "check_*" functions ───────────
-- (Defined in 20260302125025 and re-defined multi-tenant in 20260528000002,
--  where they were granted to `authenticated`.)
REVOKE EXECUTE ON FUNCTION public.check_expiring_packages() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_overdue_invoices()  FROM authenticated, anon, PUBLIC;

-- ── 2. Service-role / pg_cron variants that cover ALL organizations ─────────
-- Same bodies as the org-scoped versions, minus the `get_user_org_ids()` filter.

CREATE OR REPLACE FUNCTION public.check_expiring_packages_all_orgs()
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

CREATE OR REPLACE FUNCTION public.check_overdue_invoices_all_orgs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
BEGIN
  -- Mark pending invoices as overdue across every organization
  UPDATE public.invoices
  SET status = 'overdue', updated_at = now()
  WHERE status = 'pending'
    AND due_date < CURRENT_DATE;

  FOR inv IN
    SELECT i.*, c.first_name, c.last_name
    FROM public.invoices i
    JOIN public.customers c ON c.id = i.customer_id
    WHERE i.status = 'overdue'
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

-- These are infrastructure jobs: only the service role (and pg_cron, which runs
-- as a superuser/postgres) may execute them. No grant to authenticated/anon.
REVOKE EXECUTE ON FUNCTION public.check_expiring_packages_all_orgs() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_overdue_invoices_all_orgs()  FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_expiring_packages_all_orgs() TO service_role;
GRANT  EXECUTE ON FUNCTION public.check_overdue_invoices_all_orgs()  TO service_role;

-- ── 3. Schedule with pg_cron when available ─────────────────────────────────
-- On Supabase, enable the extension once (it lives in the `cron` schema):
--     create extension if not exists pg_cron with schema extensions;
-- The block below schedules both jobs daily and is safe to re-run: it removes
-- any existing job of the same name first. If pg_cron is not installed, it does
-- nothing (the functions can still be invoked manually as service_role, e.g.
-- via a Supabase scheduled Edge Function calling supabase.rpc(...)).
--
-- Schedule (UTC):
--   * 07:00 daily — check_expiring_packages_all_orgs()
--   * 07:05 daily — check_overdue_invoices_all_orgs()
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('check_expiring_packages_daily')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check_expiring_packages_daily');
    PERFORM cron.unschedule('check_overdue_invoices_daily')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check_overdue_invoices_daily');

    PERFORM cron.schedule(
      'check_expiring_packages_daily', '0 7 * * *',
      $cron$ SELECT public.check_expiring_packages_all_orgs(); $cron$
    );
    PERFORM cron.schedule(
      'check_overdue_invoices_daily', '5 7 * * *',
      $cron$ SELECT public.check_overdue_invoices_all_orgs(); $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron not installed — skipping schedule. Enable it and re-run the cron.schedule calls in this migration (see comments above).';
  END IF;
END;
$$;
