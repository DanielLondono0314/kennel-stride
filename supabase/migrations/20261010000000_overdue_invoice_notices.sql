-- Aviso de facturas vencidas, ahora programado todos los días.
--
-- check_overdue_invoices_all_orgs() existía desde 20260529070000 pero el
-- cron nunca quedó programado en producción (pg_cron se activó después). Antes
-- de activarlo se corrige:
--   · avisaba de la MISMA factura cada día mientras siguiera vencida; ahora
--     avisa una sola vez por factura,
--   · "vencida" se mide con la fecha local del centro (el servidor está en UTC),
--   · el monto sale en formato de pesos ($ 150.000) y no "$150000.00",
--   · ignora facturas sin organización (datos viejos): su aviso no lo vería nadie,
--   · devuelve cuántos avisos creó.

DROP FUNCTION IF EXISTS public.check_overdue_invoices_all_orgs();

CREATE FUNCTION public.check_overdue_invoices_all_orgs()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inv     record;
  v_count integer := 0;
BEGIN
  -- Pendientes con fecha límite pasada → vencidas.
  UPDATE public.invoices i
     SET status = 'overdue', updated_at = now()
   WHERE i.status = 'pending'
     AND i.organization_id IS NOT NULL
     AND i.due_date < public.org_today(i.organization_id);

  FOR inv IN
    SELECT i.id, i.organization_id, i.customer_id, i.invoice_number, i.total, i.due_date,
           NULLIF(btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), '') AS customer_name,
           public.org_today(i.organization_id) - i.due_date AS days_overdue
      FROM public.invoices i
      LEFT JOIN public.customers c ON c.id = i.customer_id
     WHERE i.status = 'overdue'
       -- Una factura sin organización (datos viejos) no tiene a quién avisarle.
       AND i.organization_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.notices n
          WHERE n.organization_id = i.organization_id
            AND n.entity_type = 'invoice'
            AND n.entity_id = i.id::text
            AND n.auto_generated
       )
  LOOP
    INSERT INTO public.notices (
      organization_id, title, message, severity, entity_type, entity_id, auto_generated, suggested_actions
    ) VALUES (
      inv.organization_id,
      'Factura vencida',
      'Factura ' || coalesce(inv.invoice_number, 's/n')
        || coalesce(' de ' || inv.customer_name, '')
        || ' por $ ' || replace(to_char(coalesce(inv.total, 0), 'FM999,999,999,990'), ',', '.')
        || ' venció el ' || to_char(inv.due_date, 'DD/MM/YYYY')
        || CASE WHEN inv.days_overdue > 0 THEN ' (hace ' || inv.days_overdue || CASE WHEN inv.days_overdue = 1 THEN ' día)' ELSE ' días)' END ELSE '' END
        || '.',
      CASE WHEN inv.days_overdue > 15 THEN 'critical' ELSE 'warning' END,
      'invoice',
      inv.id::text,
      true,
      jsonb_build_array(
        jsonb_build_object('label', 'Ver facturas', 'action', 'navigate', 'params', jsonb_build_object('path', '/invoices'))
      ) || CASE WHEN inv.customer_id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(
        jsonb_build_object('label', 'Contactar cliente', 'action', 'contact', 'params', jsonb_build_object('customerId', inv.customer_id::text))
      ) END
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END $$;

-- Solo el servidor (cron / service role) lo corre.
REVOKE EXECUTE ON FUNCTION public.check_overdue_invoices_all_orgs() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_overdue_invoices_all_orgs() TO service_role;

-- 12:05 UTC = 7:05 a. m. en Bogotá (después del aviso de planes).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('check_overdue_invoices_daily')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check_overdue_invoices_daily');
    PERFORM cron.schedule(
      'check_overdue_invoices_daily', '5 12 * * *',
      $cron$ SELECT public.check_overdue_invoices_all_orgs(); $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron no está instalado: programa check_overdue_invoices_all_orgs() a mano.';
  END IF;
END $$;
