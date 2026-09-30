-- Planes de los perros · fase 3: los planes se conectan con el resto del sistema.
--
--   1. dog_plans.sold_on: fecha de venta, para contar el ingreso del plan en
--      Reportes el día que se vendió (no el día que se registró en el sistema).
--   2. Check-out con plan: complete_checkout acepta p_payment_method = 'plan'.
--      No factura (el cobro fue la venta del plan) y, si el plan es por
--      cantidad, descuenta las unidades de esa estadía en la misma transacción:
--      per_day = días desde el check-in hasta hoy (incluidos), per_visit = 1.
--   3. Avisos diarios de planes por vencer, vencidos y agotados (pg_cron).
--   4. Contratos: se pueden llenar a partir de un plan (contracts.dog_plan_id),
--      en lugar de un paquete de créditos.

-- ── 1. Fecha de venta ───────────────────────────────────────────────────────
ALTER TABLE public.dog_plans ADD COLUMN IF NOT EXISTS sold_on date;
UPDATE public.dog_plans SET sold_on = LEAST(start_date, created_at::date) WHERE sold_on IS NULL;
ALTER TABLE public.dog_plans
  ALTER COLUMN sold_on SET DEFAULT CURRENT_DATE,
  ALTER COLUMN sold_on SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dog_plans_org_sold ON public.dog_plans (organization_id, sold_on);

-- Una reserva descuenta de un plan una sola vez.
CREATE UNIQUE INDEX IF NOT EXISTS dog_plan_usage_reservation_uniq
  ON public.dog_plan_usage (plan_id, reservation_id) WHERE reservation_id IS NOT NULL;

-- Fecha de hoy en la zona horaria del centro (el servidor corre en UTC).
CREATE OR REPLACE FUNCTION public.org_today(p_org uuid)
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (now() AT TIME ZONE COALESCE(
    (SELECT NULLIF(o.timezone, '') FROM public.organizations o WHERE o.id = p_org),
    'America/Bogota'))::date
$$;
REVOKE EXECUTE ON FUNCTION public.org_today(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.org_today(uuid) TO authenticated, service_role;

-- ── 2. Check-out con plan ───────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.complete_checkout(uuid, text, uuid, text);

CREATE OR REPLACE FUNCTION public.complete_checkout(
  p_reservation_id uuid,
  p_payment_method text,
  p_package_id     uuid DEFAULT NULL,
  p_notes          text DEFAULT '',
  p_plan_id        uuid DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_res        record;
  v_plan       public.dog_plans;
  v_invoice_id uuid;
  v_units      integer;
  v_now        timestamptz := now();
  v_today      date;
  v_tz         text;
BEGIN
  SELECT r.id, r.organization_id, r.customer_id, r.dog_id, r.service_name, r.total_price,
         r.start_date, r.check_in_time
    INTO v_res
  FROM public.reservations r
  WHERE r.id = p_reservation_id
    AND r.organization_id IN (SELECT public.get_finance_writer_org_ids())
    AND r.status IN ('checked_in', 'in_progress', 'ready')
  FOR UPDATE;

  IF v_res.id IS NULL THEN
    RAISE EXCEPTION 'Reserva inválida, fuera de tu organización, no está en curso o no tienes permiso para cobrar';
  END IF;

  IF p_payment_method = 'plan' THEN
    IF p_plan_id IS NULL THEN
      RAISE EXCEPTION 'Falta el plan con el que se cubre el servicio';
    END IF;
    SELECT * INTO v_plan FROM public.dog_plans
     WHERE id = p_plan_id AND organization_id = v_res.organization_id
     FOR UPDATE;
    IF v_plan.id IS NULL OR v_plan.dog_id IS DISTINCT FROM v_res.dog_id THEN
      RAISE EXCEPTION 'El plan no es de este perro';
    END IF;
    IF v_plan.status <> 'active' THEN
      RAISE EXCEPTION 'El plan no está vigente';
    END IF;

    SELECT COALESCE(NULLIF(o.timezone, ''), 'America/Bogota') INTO v_tz
      FROM public.organizations o WHERE o.id = v_res.organization_id;
    v_today := (v_now AT TIME ZONE v_tz)::date;

    IF v_plan.start_date > v_today THEN
      RAISE EXCEPTION 'El plan empieza el %: todavía no cubre servicios', to_char(v_plan.start_date, 'DD/MM/YYYY');
    END IF;
    IF v_plan.end_date IS NOT NULL AND v_plan.end_date < (v_res.start_date AT TIME ZONE v_tz)::date THEN
      RAISE EXCEPTION 'El plan venció el % , antes de esta reserva', to_char(v_plan.end_date, 'DD/MM/YYYY');
    END IF;

    IF v_plan.billing = 'quantity' THEN
      v_units := CASE
        WHEN v_plan.consumption = 'per_day' THEN
          GREATEST(1, v_today - (COALESCE(v_res.check_in_time, v_res.start_date) AT TIME ZONE v_tz)::date + 1)
        ELSE 1
      END;
      IF v_plan.quantity_used + v_units > v_plan.quantity_total THEN
        RAISE EXCEPTION 'Al plan solo le quedan % % y esta estadía usa %. Cobra con otro método o renueva el plan.',
          v_plan.quantity_total - v_plan.quantity_used, COALESCE(v_plan.unit_label, 'unidades'), v_units;
      END IF;

      INSERT INTO public.dog_plan_usage (plan_id, organization_id, used_on, quantity, note, reservation_id, created_by)
      VALUES (v_plan.id, v_plan.organization_id, v_today, v_units,
              'Check-out · ' || COALESCE(v_res.service_name, 'Servicio'), v_res.id, auth.uid());

      UPDATE public.dog_plans SET quantity_used = quantity_used + v_units WHERE id = v_plan.id;
    END IF;

  ELSIF p_payment_method = 'package' THEN
    IF p_package_id IS NULL THEN
      RAISE EXCEPTION 'Falta el paquete para cobrar con créditos';
    END IF;
    PERFORM 1 FROM public.packages p
     WHERE p.id = p_package_id
       AND p.organization_id = v_res.organization_id
       AND p.customer_id = v_res.customer_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'El paquete no pertenece a este cliente';
    END IF;
    PERFORM public.deduct_package_credit(p_package_id, 'check-out');

  ELSIF p_payment_method IN ('cash', 'card') THEN
    INSERT INTO public.invoices
      (customer_id, reservation_id, status, subtotal, discount, tax, total,
       payment_method, paid_at, due_date, notes, organization_id)
    VALUES
      (v_res.customer_id, v_res.id, 'paid', v_res.total_price, 0, 0, v_res.total_price,
       p_payment_method, v_now, v_now, NULLIF(btrim(p_notes), ''), v_res.organization_id)
    RETURNING id INTO v_invoice_id;

    INSERT INTO public.invoice_items
      (invoice_id, description, quantity, unit_price, total, organization_id)
    VALUES
      (v_invoice_id, COALESCE(v_res.service_name, 'Servicio'), 1,
       v_res.total_price, v_res.total_price, v_res.organization_id);

  ELSIF p_payment_method = 'invoice' THEN
    INSERT INTO public.invoices
      (customer_id, reservation_id, status, subtotal, discount, tax, total,
       due_date, notes, organization_id)
    VALUES
      (v_res.customer_id, v_res.id, 'pending', v_res.total_price, 0, 0, v_res.total_price,
       v_now + interval '30 days', NULLIF(btrim(p_notes), ''), v_res.organization_id)
    RETURNING id INTO v_invoice_id;

    INSERT INTO public.invoice_items
      (invoice_id, description, quantity, unit_price, total, organization_id)
    VALUES
      (v_invoice_id, COALESCE(v_res.service_name, 'Servicio'), 1,
       v_res.total_price, v_res.total_price, v_res.organization_id);

  ELSE
    RAISE EXCEPTION 'Método de pago inválido: %', p_payment_method;
  END IF;

  UPDATE public.facility_units
     SET status = 'available',
         assigned_dog_id = NULL,
         assigned_dog_name = NULL,
         assignment_start = NULL,
         assignment_end = NULL,
         assigned_reservation_id = NULL,
         updated_at = now()
   WHERE assigned_reservation_id = p_reservation_id;

  -- Las notas del check-out se AÑADEN (antes reemplazaban las del check-in).
  UPDATE public.reservations
     SET status = 'completed',
         check_out_time = v_now,
         notes = CASE WHEN btrim(COALESCE(p_notes, '')) <> ''
                      THEN COALESCE(NULLIF(notes, '') || E'\n', '') || '[Check-out]: ' || p_notes
                      ELSE notes END,
         updated_at = v_now
   WHERE id = p_reservation_id;

  RETURN json_build_object('invoice_id', v_invoice_id, 'plan_id', v_plan.id, 'plan_units', v_units);
END $$;

REVOKE EXECUTE ON FUNCTION public.complete_checkout(uuid, text, uuid, text, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.complete_checkout(uuid, text, uuid, text, uuid) TO authenticated, service_role;

-- ── 3. Avisos de planes ─────────────────────────────────────────────────────
-- Un aviso por plan y situación: "por vencer" (≤ 7 días o ≤ 2 unidades),
-- "agotado" y "vencido" (solo si venció hace ≤ 7 días, para no avisar de
-- planes viejos la primera vez que corre). El aviso apunta al perro; se
-- identifica el plan por su id en suggested_actions para no repetirlo.
CREATE OR REPLACE FUNCTION public.check_expiring_dog_plans_all_orgs()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r        record;
  v_left   integer;
  v_units  integer;
  v_title  text;
  v_msg    text;
  v_sev    text;
  v_count  integer := 0;
BEGIN
  FOR r IN
    SELECT p.*, d.name AS dog_name,
           NULLIF(btrim(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')), '') AS owner_name,
           public.org_today(p.organization_id) AS today
      FROM public.dog_plans p
      JOIN public.dogs d ON d.id = p.dog_id
      LEFT JOIN public.customers c ON c.id = p.customer_id
     WHERE p.status = 'active'
  LOOP
    CONTINUE WHEN r.start_date > r.today;
    v_left  := CASE WHEN r.end_date IS NULL THEN NULL ELSE r.end_date - r.today END;
    v_units := CASE WHEN r.billing = 'quantity' THEN r.quantity_total - r.quantity_used END;
    v_title := NULL;

    IF v_left IS NOT NULL AND v_left < 0 THEN
      CONTINUE WHEN v_left < -7;
      v_title := 'Plan vencido';
      v_sev   := 'critical';
      v_msg   := 'el plan «' || r.service_label || '» venció el ' || to_char(r.end_date, 'DD/MM/YYYY');
    ELSIF v_units IS NOT NULL AND v_units <= 0 THEN
      v_title := 'Plan agotado';
      v_sev   := 'critical';
      v_msg   := 'el plan «' || r.service_label || '» ya usó las ' || r.quantity_total || ' ' || COALESCE(r.unit_label, 'unidades');
    ELSIF (v_left IS NOT NULL AND v_left <= 7) OR (v_units IS NOT NULL AND v_units <= 2) THEN
      v_title := 'Plan por vencer';
      v_sev   := CASE WHEN (v_left IS NOT NULL AND v_left <= 2) OR v_units <= 1 THEN 'critical' ELSE 'warning' END;
      v_msg   := CASE
        WHEN v_left IS NOT NULL AND v_left <= 7 THEN
          'el plan «' || r.service_label || '» ' || CASE WHEN v_left = 0 THEN 'vence hoy' ELSE 'vence el ' || to_char(r.end_date, 'DD/MM/YYYY') END
        ELSE 'al plan «' || r.service_label || '» le quedan ' || v_units || ' ' || COALESCE(r.unit_label, 'unidades')
      END;
    END IF;

    CONTINUE WHEN v_title IS NULL;
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.notices n
       WHERE n.organization_id = r.organization_id
         AND n.entity_type = 'dog'
         AND n.entity_id = r.dog_id::text
         AND n.title = v_title
         AND n.suggested_actions @> jsonb_build_array(jsonb_build_object('params', jsonb_build_object('planId', r.id::text)))
    );

    INSERT INTO public.notices (organization_id, title, message, severity, entity_type, entity_id, auto_generated, suggested_actions)
    VALUES (
      r.organization_id,
      v_title,
      r.dog_name || COALESCE(' (' || r.owner_name || ')', '') || ': ' || v_msg || '.',
      v_sev,
      'dog',
      r.dog_id::text,
      true,
      jsonb_build_array(
        jsonb_build_object('label', 'Ver plan', 'action', 'navigate',
          'params', jsonb_build_object('path', '/dogs/' || r.dog_id || '?tab=plan', 'planId', r.id::text))
      ) || CASE WHEN r.customer_id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(
        jsonb_build_object('label', 'Contactar cliente', 'action', 'contact',
          'params', jsonb_build_object('customerId', r.customer_id::text))
      ) END
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

REVOKE EXECUTE ON FUNCTION public.check_expiring_dog_plans_all_orgs() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_expiring_dog_plans_all_orgs() TO service_role;

-- 12:00 UTC = 7:00 a. m. en Bogotá.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('check_expiring_dog_plans_daily')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check_expiring_dog_plans_daily');
    PERFORM cron.schedule(
      'check_expiring_dog_plans_daily', '0 12 * * *',
      $cron$ SELECT public.check_expiring_dog_plans_all_orgs(); $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron no está instalado: programa check_expiring_dog_plans_all_orgs() a mano.';
  END IF;
END $$;

-- ── 4. Contratos a partir de un plan ────────────────────────────────────────
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS dog_plan_id uuid REFERENCES public.dog_plans(id) ON DELETE SET NULL;

GRANT INSERT (dog_plan_id) ON public.contracts TO authenticated;

DROP TRIGGER IF EXISTS enforce_same_org_refs ON public.contracts;
CREATE TRIGGER enforce_same_org_refs BEFORE INSERT OR UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_same_org_refs(
    'customer_id','customers','reservation_id','reservations',
    'package_id','packages','template_id','contract_templates',
    'dog_plan_id','dog_plans');

CREATE OR REPLACE FUNCTION public.create_contract(p_contract jsonb, p_dog_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_id  uuid;
  v_org uuid := (p_contract ->> 'organization_id')::uuid;
BEGIN
  INSERT INTO public.contracts (organization_id, template_id, customer_id, reservation_id,
    package_id, dog_plan_id, title, service_type, body, include_signatures, field_values,
    start_date, end_date, total_value)
  VALUES (
    v_org,
    nullif(p_contract ->> 'template_id', '')::uuid,
    (p_contract ->> 'customer_id')::uuid,
    nullif(p_contract ->> 'reservation_id', '')::uuid,
    nullif(p_contract ->> 'package_id', '')::uuid,
    nullif(p_contract ->> 'dog_plan_id', '')::uuid,
    p_contract ->> 'title',
    nullif(p_contract ->> 'service_type', ''),
    p_contract ->> 'body',
    coalesce((p_contract ->> 'include_signatures')::boolean, true),
    coalesce(p_contract -> 'field_values', '{}'::jsonb),
    nullif(p_contract ->> 'start_date', '')::date,
    nullif(p_contract ->> 'end_date', '')::date,
    nullif(p_contract ->> 'total_value', '')::numeric
  )
  RETURNING id INTO v_id;

  INSERT INTO public.contract_dogs (contract_id, dog_id, organization_id)
  SELECT v_id, d, v_org FROM unnest(coalesce(p_dog_ids, '{}')) AS d;

  RETURN v_id;
END $$;

-- ── 5. Datos de ejemplo: un plan en lugar del bono de créditos ──────────────
CREATE OR REPLACE FUNCTION public.seed_demo_data(p_org_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer uuid;
  v_dog_max  uuid;
  v_dog_luna uuid;
  v_zone     uuid;
BEGIN
  IF p_org_id IS NULL OR p_org_id NOT IN (SELECT public.get_scheduler_org_ids()) THEN
    RAISE EXCEPTION 'Organización inválida o sin permiso';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.customers
    WHERE organization_id = p_org_id AND email = 'demo@kennelops.example'
  ) THEN
    RAISE EXCEPTION 'Esta organización ya tiene datos de ejemplo';
  END IF;

  INSERT INTO public.customers
    (first_name, last_name, email, phone, notes, organization_id)
  VALUES
    ('Cliente', 'de Ejemplo', 'demo@kennelops.example', '555-0100',
     'Datos de ejemplo — puedes borrarlos desde el checklist del dashboard.', p_org_id)
  RETURNING id INTO v_customer;

  INSERT INTO public.dogs
    (customer_id, name, breed, gender, birth_date, weight, color, is_neutered,
     notes, feeding, organization_id)
  VALUES
    (v_customer, 'Max', 'Golden Retriever', 'male',
     (now() - interval '3 years')::date, 28, 'Dorado', true,
     'Perro de ejemplo', '{"food_type":"seco","brand":"","meals_per_day":2,"portion_amount":150,"portion_unit":"g","instructions":""}'::jsonb,
     p_org_id)
  RETURNING id INTO v_dog_max;

  INSERT INTO public.dogs
    (customer_id, name, breed, gender, birth_date, weight, color, is_neutered,
     has_allergies, notes, feeding, organization_id)
  VALUES
    (v_customer, 'Luna', 'Border Collie', 'female',
     (now() - interval '18 months')::date, 17, 'Negro y blanco', false,
     true, 'Perra de ejemplo',
     '{"food_type":"mixto","brand":"","meals_per_day":3,"portion_amount":120,"portion_unit":"g","instructions":"Separar de otros perros al comer"}'::jsonb,
     p_org_id)
  RETURNING id INTO v_dog_luna;

  INSERT INTO public.dog_allergies (dog_id, organization_id, allergen, type, reaction, severity)
  VALUES (v_dog_luna, p_org_id, 'Pollo', 'comida', 'Picazón en la piel', 'media');

  IF NOT EXISTS (SELECT 1 FROM public.facility_zones WHERE organization_id = p_org_id) THEN
    INSERT INTO public.facility_zones (name, organization_id)
    VALUES ('Zona Demo', p_org_id)
    RETURNING id INTO v_zone;

    INSERT INTO public.facility_units (zone_id, name, status, organization_id)
    VALUES (v_zone, 'Demo K-01', 'available', p_org_id),
           (v_zone, 'Demo K-02', 'available', p_org_id);
  END IF;

  INSERT INTO public.reservations
    (customer_id, dog_id, service_type, service_name, start_date, end_date,
     total_price, status, notes, organization_id)
  VALUES
    (v_customer, v_dog_max, 'daycare', 'Guardería',
     now() + interval '1 hour', now() + interval '8 hours',
     35, 'scheduled', 'Reserva de ejemplo — prueba el check-in', p_org_id),
    (v_customer, v_dog_luna, 'training_session', 'Sesión de Entrenamiento',
     now() + interval '1 day', now() + interval '1 day 2 hours',
     50, 'requested', 'Solicitud de ejemplo — apruébala desde Solicitudes', p_org_id);

  INSERT INTO public.dog_plans
    (organization_id, dog_id, customer_id, service_type, service_label, category, billing,
     start_date, end_date, quantity_total, unit_label, consumption, price, includes, conditions)
  VALUES
    (p_org_id, v_dog_max, v_customer, 'daycare', 'Guardería · 5 días', 'daycare', 'quantity',
     CURRENT_DATE, CURRENT_DATE + 89, 5, 'días', 'per_day', 150,
     ARRAY['Snacks', 'Reporte por WhatsApp'], 'Plan de ejemplo: se descuenta un día en cada check-out.');

  RETURN json_build_object('customer_id', v_customer);
END $function$;
