-- ============================================================================
-- Auditoría 2026-09-26 — endurecimiento de seguridad
--
--  1. organizations: columnas de facturación/suscripción solo las cambia el
--     servidor (webhook / platform admin). Se retira el INSERT directo.
--  2. EXECUTE de funciones: anon solo puede llamar get_invitation_by_token;
--     los jobs *_all_orgs y helpers internos dejan de ser invocables por
--     clientes. (REVOKE ... FROM PUBLIC no bastaba: Supabase concede EXECUTE
--     explícito a anon/authenticated por default privileges.)
--  3. get_inactive_customer_ids / get_onboarding_status: sin acceso cross-org.
--  4. RPCs de operación: ahora exigen rol + suscripción vigente (antes solo
--     membresía, lo que dejaba a un worker facturar/descontar créditos y a una
--     org vencida seguir operando vía API).
--  5. reservations: un worker solo puede avanzar el estado de SUS reservas.
--  6. Referencias entre tablas validadas contra la misma organización.
--  7. route_stops: escritura solo de schedulers; campos de notificación y
--     referencias inmutables para clientes (evita SMS a clientes de otra org).
--  8. campaigns: estados sending/sent y estadísticas solo del servidor.
--  9. packages: todo cambio de remaining_credits queda en package_credit_log.
-- 10. Storage: fotos acotadas a la organización del usuario.
-- 11. business_profile (legacy): escritura solo admins.
--
-- Idempotente: CREATE OR REPLACE / DROP ... IF EXISTS.
-- ============================================================================


-- ── 1. organizations ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_org_billing_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- service_role (webhook de facturación, cron) y platform admins pasan.
  IF auth.uid() IS NULL OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.subscription_status := 'trialing';
    NEW.trial_ends_at       := now() + interval '14 days';
    NEW.ls_customer_id      := NULL;
    NEW.ls_subscription_id  := NULL;
  ELSIF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.trial_ends_at      IS DISTINCT FROM OLD.trial_ends_at
     OR NEW.ls_customer_id     IS DISTINCT FROM OLD.ls_customer_id
     OR NEW.ls_subscription_id IS DISTINCT FROM OLD.ls_subscription_id
     OR NEW.owner_id           IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'La suscripción solo puede cambiarse desde facturación';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_org_billing_columns ON public.organizations;
CREATE TRIGGER guard_org_billing_columns
  BEFORE INSERT OR UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.guard_org_billing_columns();

-- Las orgs se crean solo vía create_organization() (SECURITY DEFINER, valida
-- slug y aplica rate-limit). El INSERT directo lo saltaba todo.
DROP POLICY IF EXISTS "Authenticated can create org" ON public.organizations;

-- create_organization: se reservan también las rutas raíz añadidas después
-- (platform-admin) para que una org no quede inaccesible.
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
    'platform-admin', 'platform', 'kennelops', 'kennelstride', 'status'
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

  RETURN json_build_object('slug', p_slug);
END;
$$;

-- Pasar una org a 'trialing' desde el panel no servía si el trial ya había
-- vencido (trial_ends_at quedaba en el pasado): ahora se extiende 14 días.
CREATE OR REPLACE FUNCTION public.platform_admin_set_subscription_status(
  p_org_id uuid, p_status text, p_reason text
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before text;
BEGIN
  IF public.get_platform_admin_role() IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF p_status NOT IN ('active', 'trialing', 'cancelled') THEN
    RAISE EXCEPTION 'Estado de suscripción inválido: %', p_status;
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Se requiere un motivo';
  END IF;

  SELECT subscription_status INTO v_before FROM public.organizations WHERE id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organización no encontrada';
  END IF;

  UPDATE public.organizations
    SET subscription_status = p_status,
        trial_ends_at = CASE
          WHEN p_status = 'trialing' AND trial_ends_at <= now() THEN now() + interval '14 days'
          ELSE trial_ends_at END,
        updated_at = now()
  WHERE id = p_org_id;

  INSERT INTO public.platform_admin_audit_log (admin_user_id, action, target_org_id, metadata)
  VALUES (auth.uid(), 'set_subscription_status', p_org_id, jsonb_build_object(
    'before', v_before, 'after', p_status, 'reason', p_reason
  ));

  RETURN json_build_object('before', v_before, 'after', p_status);
END $$;


-- ── 2. Privilegios EXECUTE ──────────────────────────────────────────────────
-- Base: ninguna función es invocable por anon/PUBLIC; authenticated y
-- service_role conservan acceso (cada RPC valida auth.uid() por dentro).
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT  EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

-- Única función pública: la pantalla /join la consulta antes del login.
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon;

-- Jobs e internos: solo service_role / pg_cron.
REVOKE EXECUTE ON FUNCTION public.check_expiring_packages_all_orgs()     FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.check_overdue_invoices_all_orgs()      FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_welfare_checks_all_orgs()     FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_default_welfare_check_items(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.check_expiring_packages()              FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.check_overdue_invoices()               FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_customer_balance(uuid)       FROM authenticated;


-- ── 3. Funciones de lectura sin guardia ─────────────────────────────────────
-- Antes aceptaba `auth.uid() IS NULL`, condición que también cumple anon.
-- Ahora solo el service_role (send-campaign) puede consultar sin membresía.
CREATE OR REPLACE FUNCTION public.get_inactive_customer_ids(
  p_organization_id uuid,
  p_days int DEFAULT 30
)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.customers c
  WHERE c.organization_id = p_organization_id
    AND (
      p_organization_id IN (SELECT public.get_user_org_ids())
      OR auth.role() = 'service_role'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.reservations r
      WHERE r.customer_id = c.id
        AND r.organization_id = p_organization_id
        AND r.status IN ('completed', 'checked_in', 'in_progress')
        AND r.start_date >= (CURRENT_DATE - (p_days || ' days')::interval)
    );
$$;

CREATE OR REPLACE FUNCTION public.get_onboarding_status(p_org_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_customers    boolean;
  v_has_zones        boolean;
  v_has_staff        boolean;
  v_has_schedule     boolean;
  v_has_reservations boolean;
BEGIN
  IF p_org_id IS NULL OR p_org_id NOT IN (SELECT public.get_user_org_ids()) THEN
    RAISE EXCEPTION 'Organización inválida o fuera de tu cuenta';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.customers WHERE organization_id = p_org_id)
    INTO v_has_customers;
  SELECT EXISTS(SELECT 1 FROM public.facility_zones WHERE organization_id = p_org_id)
    INTO v_has_zones;
  SELECT (COUNT(*) > 1) FROM public.organization_members WHERE organization_id = p_org_id
    INTO v_has_staff;
  SELECT (opening_time IS NOT NULL AND closing_time IS NOT NULL)
  FROM public.organizations WHERE id = p_org_id
    INTO v_has_schedule;
  SELECT EXISTS(SELECT 1 FROM public.reservations WHERE organization_id = p_org_id)
    INTO v_has_reservations;

  RETURN json_build_object(
    'has_customers',    v_has_customers,
    'has_zones',        v_has_zones,
    'has_staff',        v_has_staff,
    'has_schedule',     v_has_schedule,
    'has_reservations', v_has_reservations
  );
END;
$$;


-- ── 4. RPCs de operación: rol + suscripción vigente ─────────────────────────
-- get_scheduler_org_ids()      = admin/manager/front_desk + suscripción vigente
-- get_finance_writer_org_ids() = mismo conjunto de roles (finanzas)
-- Son los mismos criterios que ya aplica la RLS de reservations/invoices.

CREATE OR REPLACE FUNCTION public.create_reservation(
  p_customer_id  uuid,
  p_dog_id       uuid,
  p_service_type text,
  p_service_name text,
  p_start        timestamptz,
  p_end          timestamptz,
  p_total_price  numeric,
  p_notes        text DEFAULT '',
  p_staff_id     uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org    uuid;
  v_res_id uuid;
BEGIN
  SELECT organization_id INTO v_org
  FROM public.customers
  WHERE id = p_customer_id
    AND organization_id IN (SELECT public.get_scheduler_org_ids());
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Cliente inválido, fuera de tu organización o sin permiso para crear reservas';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.dogs
    WHERE id = p_dog_id AND organization_id = v_org AND customer_id = p_customer_id
  ) THEN
    RAISE EXCEPTION 'Perro inválido o no pertenece a este cliente';
  END IF;

  IF p_staff_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.staff_members WHERE id = p_staff_id AND organization_id = v_org
  ) THEN
    RAISE EXCEPTION 'El miembro del equipo no pertenece a esta organización';
  END IF;

  IF p_end <= p_start THEN
    RAISE EXCEPTION 'La fecha de fin debe ser posterior al inicio';
  END IF;

  IF p_total_price IS NULL OR p_total_price < 0 THEN
    RAISE EXCEPTION 'El precio no puede ser negativo';
  END IF;

  -- Serializa por perro: sin esto dos solicitudes simultáneas pasaban ambas el
  -- chequeo de solapamiento (doble reserva).
  PERFORM pg_advisory_xact_lock(hashtextextended('reservation-dog:' || p_dog_id::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.dog_id = p_dog_id
      AND r.status NOT IN ('cancelled','completed','rejected')
      AND tstzrange(r.start_date, r.end_date, '[)') && tstzrange(p_start, p_end, '[)')
  ) THEN
    RAISE EXCEPTION 'El perro ya tiene una reserva que se solapa en ese horario';
  END IF;

  INSERT INTO public.reservations
    (customer_id, dog_id, service_type, service_name, start_date, end_date,
     total_price, notes, status, organization_id, staff_id)
  VALUES
    (p_customer_id, p_dog_id, p_service_type, p_service_name, p_start, p_end,
     p_total_price, COALESCE(p_notes, ''), 'requested', v_org, p_staff_id)
  RETURNING id INTO v_res_id;

  INSERT INTO public.notices
    (title, message, severity, entity_type, entity_id, auto_generated, organization_id)
  SELECT
    'Nueva solicitud de reserva',
    c.first_name || ' ' || c.last_name || ' ha solicitado ' || p_service_name || ' para ' || d.name || '.',
    'info', 'reservation', v_res_id::text, true, v_org
  FROM public.customers c, public.dogs d
  WHERE c.id = p_customer_id AND d.id = p_dog_id;

  RETURN v_res_id;
END $$;

CREATE OR REPLACE FUNCTION public.update_reservation(
  p_reservation_id uuid,
  p_service_type   text,
  p_service_name   text,
  p_start          timestamptz,
  p_end            timestamptz,
  p_total_price    numeric,
  p_notes          text DEFAULT '',
  p_status         text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org      uuid;
  v_dog_id   uuid;
  v_status   text;
BEGIN
  SELECT organization_id, dog_id, status INTO v_org, v_dog_id, v_status
  FROM public.reservations
  WHERE id = p_reservation_id
    AND organization_id IN (SELECT public.get_scheduler_org_ids())
  FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Reserva inválida o no tienes permiso para editarla';
  END IF;

  IF p_end <= p_start THEN
    RAISE EXCEPTION 'La fecha de fin debe ser posterior al inicio';
  END IF;

  IF p_total_price IS NULL OR p_total_price < 0 THEN
    RAISE EXCEPTION 'El precio no puede ser negativo';
  END IF;

  IF p_status IS NOT NULL THEN
    -- checked_in / in_progress ocupan perrera: solo vía check_in_reservation.
    -- (Pasar a completed/cancelled libera la perrera por trigger.)
    IF p_status NOT IN ('requested','scheduled','cancelled','rejected','completed')
       AND p_status IS DISTINCT FROM v_status THEN
      RAISE EXCEPTION 'Estado no permitido desde la edición: %', p_status;
    END IF;
    v_status := p_status;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('reservation-dog:' || v_dog_id::text, 0));

  IF v_status NOT IN ('cancelled','completed','rejected') AND EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.dog_id = v_dog_id
      AND r.id <> p_reservation_id
      AND r.status NOT IN ('cancelled','completed','rejected')
      AND tstzrange(r.start_date, r.end_date, '[)') && tstzrange(p_start, p_end, '[)')
  ) THEN
    RAISE EXCEPTION 'El perro ya tiene otra reserva que se solapa en ese horario';
  END IF;

  UPDATE public.reservations
  SET service_type = p_service_type,
      service_name = p_service_name,
      start_date   = p_start,
      end_date     = p_end,
      total_price  = p_total_price,
      notes        = COALESCE(p_notes, ''),
      status       = v_status,
      updated_at   = now()
  WHERE id = p_reservation_id;
END $$;

CREATE OR REPLACE FUNCTION public.check_in_reservation(
  p_reservation_id uuid,
  p_unit_id        uuid,
  p_notes          text DEFAULT ''
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org      uuid;
  v_dog_id   uuid;
  v_dog_name text;
  v_start    timestamptz;
  v_end      timestamptz;
BEGIN
  SELECT r.organization_id, r.dog_id, r.start_date, r.end_date
    INTO v_org, v_dog_id, v_start, v_end
  FROM public.reservations r
  WHERE r.id = p_reservation_id
    AND r.organization_id IN (SELECT public.get_scheduler_org_ids())
    AND r.status = 'scheduled'
  FOR UPDATE;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Reserva inválida, fuera de tu organización o no está aprobada';
  END IF;

  SELECT d.name INTO v_dog_name FROM public.dogs d WHERE d.id = v_dog_id;

  PERFORM 1 FROM public.facility_units u
   WHERE u.id = p_unit_id
     AND u.organization_id = v_org
     AND u.status = 'available'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa perrera no está disponible, elige otra';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.facility_units u
    WHERE u.organization_id = v_org AND u.assigned_dog_id = v_dog_id::text
  ) THEN
    RAISE EXCEPTION 'Este perro ya ocupa otra perrera. Libérala primero.';
  END IF;

  UPDATE public.facility_units
     SET status = 'occupied',
         assigned_dog_id = v_dog_id::text,
         assigned_dog_name = v_dog_name,
         assignment_start = v_start,
         assignment_end = v_end,
         assigned_reservation_id = p_reservation_id,
         updated_at = now()
   WHERE id = p_unit_id;

  UPDATE public.reservations
     SET status = 'checked_in',
         check_in_time = now(),
         location_id = p_unit_id,
         notes = CASE WHEN COALESCE(p_notes, '') <> ''
                      THEN COALESCE(notes, '') || E'\n[Check-in]: ' || p_notes
                      ELSE notes END,
         updated_at = now()
   WHERE id = p_reservation_id;

  INSERT INTO public.notices
    (title, message, severity, entity_type, entity_id, auto_generated, organization_id)
  VALUES
    ('Check-in registrado',
     COALESCE(v_dog_name, 'El perro') || ' ingresó al centro.',
     'info', 'reservation', p_reservation_id::text, true, v_org);
END $$;

CREATE OR REPLACE FUNCTION public.check_out_reservation(
  p_reservation_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT r.organization_id INTO v_org
  FROM public.reservations r
  WHERE r.id = p_reservation_id
    AND r.organization_id IN (SELECT public.get_scheduler_org_ids())
    AND r.status IN ('checked_in', 'in_progress', 'ready')
  FOR UPDATE;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Reserva inválida, fuera de tu organización o no está en curso';
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

  UPDATE public.reservations
     SET status = 'completed',
         check_out_time = now(),
         updated_at = now()
   WHERE id = p_reservation_id;

  INSERT INTO public.notices
    (title, message, severity, entity_type, entity_id, auto_generated, organization_id)
  VALUES
    ('Check-out registrado',
     'La estadía se completó y la perrera quedó libre.',
     'info', 'reservation', p_reservation_id::text, true, v_org);
END $$;

CREATE OR REPLACE FUNCTION public.deduct_package_credit(p_package_id uuid, p_reason text DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before int; v_after int; v_org uuid; v_found boolean;
BEGIN
  -- El log lo escribe este RPC; el trigger de auditoría no debe duplicarlo.
  PERFORM set_config('app.credit_change_logged', 'on', true);

  UPDATE public.packages
    SET remaining_credits = remaining_credits - 1,
        status = CASE WHEN remaining_credits - 1 = 0 THEN 'depleted' ELSE status END,
        updated_at = now()
  WHERE id = p_package_id
    AND organization_id IN (SELECT public.get_finance_writer_org_ids())
    AND remaining_credits > 0
    AND expires_at >= CURRENT_DATE
  RETURNING (remaining_credits + 1), remaining_credits, organization_id
  INTO v_before, v_after, v_org;
  v_found := FOUND;  -- capturar antes: PERFORM reescribe FOUND

  PERFORM set_config('app.credit_change_logged', 'off', true);

  IF NOT v_found THEN
    RAISE EXCEPTION 'Sin créditos disponibles, paquete vencido o sin permiso';
  END IF;

  INSERT INTO public.package_credit_log
    (package_id, organization_id, user_id, action, credits_before, credits_after, reason)
  VALUES (p_package_id, v_org, auth.uid(), 'deduct', v_before, v_after, p_reason);

  RETURN v_after;
END $$;

CREATE OR REPLACE FUNCTION public.complete_checkout(
  p_reservation_id uuid,
  p_payment_method text,
  p_package_id     uuid DEFAULT NULL,
  p_notes          text DEFAULT ''
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_res        record;
  v_invoice_id uuid;
  v_now        timestamptz := now();
BEGIN
  SELECT r.id, r.organization_id, r.customer_id, r.service_name, r.total_price
    INTO v_res
  FROM public.reservations r
  WHERE r.id = p_reservation_id
    AND r.organization_id IN (SELECT public.get_finance_writer_org_ids())
    AND r.status IN ('checked_in', 'in_progress', 'ready')
  FOR UPDATE;

  IF v_res.id IS NULL THEN
    RAISE EXCEPTION 'Reserva inválida, fuera de tu organización, no está en curso o no tienes permiso para cobrar';
  END IF;

  IF p_payment_method = 'package' THEN
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

  RETURN json_build_object('invoice_id', v_invoice_id);
END $$;

CREATE OR REPLACE FUNCTION public.seed_demo_data(p_org_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  INSERT INTO public.packages
    (customer_id, name, service_type, total_credits, remaining_credits,
     status, expires_at, price, organization_id)
  VALUES
    (v_customer, 'Bono Demo x5', 'daycare', 5, 5, 'active',
     (now() + interval '90 days')::date, 150, p_org_id);

  RETURN json_build_object('customer_id', v_customer);
END $$;

CREATE OR REPLACE FUNCTION public.remove_demo_data(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_org_id IS NULL OR p_org_id NOT IN (SELECT public.get_scheduler_org_ids()) THEN
    RAISE EXCEPTION 'Organización inválida o sin permiso';
  END IF;

  -- Liberar primero perreras ocupadas por reservas demo (el borrado en cascada
  -- de la reserva dejaba la perrera 'occupied' con un perro inexistente).
  UPDATE public.facility_units u
     SET status = 'available', assigned_dog_id = NULL, assigned_dog_name = NULL,
         assignment_start = NULL, assignment_end = NULL,
         assigned_reservation_id = NULL, updated_at = now()
   WHERE u.organization_id = p_org_id
     AND u.assigned_dog_id IN (
       SELECT d.id::text FROM public.dogs d
       JOIN public.customers c ON c.id = d.customer_id
       WHERE c.organization_id = p_org_id AND c.email = 'demo@kennelops.example'
     );

  DELETE FROM public.customers
  WHERE organization_id = p_org_id AND email = 'demo@kennelops.example';

  DELETE FROM public.facility_units
  WHERE organization_id = p_org_id
    AND name LIKE 'Demo K-%'
    AND assigned_reservation_id IS NULL
    AND assigned_dog_id IS NULL;

  DELETE FROM public.facility_zones z
  WHERE z.organization_id = p_org_id
    AND z.name = 'Zona Demo'
    AND NOT EXISTS (SELECT 1 FROM public.facility_units u WHERE u.zone_id = z.id);
END $$;


-- ── 5. reservations: límites para el personal no-scheduler ─────────────────
-- La RLS deja al worker asignado (staff_id) hacer UPDATE de su reserva para
-- avanzar el estado desde su app. Sin este trigger podía cambiar también
-- precio, fechas, cliente o reasignarla.
CREATE OR REPLACE FUNCTION public.guard_reservation_worker_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR OLD.organization_id IN (SELECT public.get_scheduler_org_ids()) THEN
    RETURN NEW;
  END IF;

  IF NEW.customer_id       IS DISTINCT FROM OLD.customer_id
  OR NEW.dog_id            IS DISTINCT FROM OLD.dog_id
  OR NEW.staff_id          IS DISTINCT FROM OLD.staff_id
  OR NEW.organization_id   IS DISTINCT FROM OLD.organization_id
  OR NEW.service_type      IS DISTINCT FROM OLD.service_type
  OR NEW.service_name      IS DISTINCT FROM OLD.service_name
  OR NEW.start_date        IS DISTINCT FROM OLD.start_date
  OR NEW.end_date          IS DISTINCT FROM OLD.end_date
  OR NEW.total_price       IS DISTINCT FROM OLD.total_price
  OR NEW.location_id       IS DISTINCT FROM OLD.location_id
  OR NEW.pickup_requested  IS DISTINCT FROM OLD.pickup_requested
  OR NEW.dropoff_requested IS DISTINCT FROM OLD.dropoff_requested THEN
    RAISE EXCEPTION 'Solo puedes actualizar el estado de tus reservas';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status NOT IN ('in_progress', 'ready', 'completed') THEN
    RAISE EXCEPTION 'Estado no permitido: %', NEW.status;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_reservation_worker_update ON public.reservations;
CREATE TRIGGER guard_reservation_worker_update
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.guard_reservation_worker_update();


-- ── 6. Referencias validadas contra la misma organización ──────────────────
-- La RLS solo valida organization_id de la fila; un UUID de otra org en una
-- FK (dog_id, customer_id, staff_id…) pasaba. Uso:
--   enforce_same_org_refs('columna', 'tabla_referida', ...)
CREATE OR REPLACE FUNCTION public.enforce_same_org_refs()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  i      int := 0;
  v_col  text;
  v_tbl  text;
  v_val  text;
  v_org  uuid;
  v_new  jsonb := to_jsonb(NEW);
  v_prev jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) END;
BEGIN
  WHILE i < TG_NARGS LOOP
    v_col := TG_ARGV[i];
    v_tbl := TG_ARGV[i + 1];
    i := i + 2;

    v_val := v_new ->> v_col;
    CONTINUE WHEN v_val IS NULL;
    -- En UPDATE solo se revalida si cambió la referencia o la org de la fila.
    CONTINUE WHEN TG_OP = 'UPDATE'
      AND v_val IS NOT DISTINCT FROM (v_prev ->> v_col)
      AND (v_new ->> 'organization_id') IS NOT DISTINCT FROM (v_prev ->> 'organization_id');

    v_org := NULL;
    EXECUTE format('SELECT organization_id FROM public.%I WHERE id = $1::uuid', v_tbl)
      INTO v_org USING v_val;

    IF v_org IS DISTINCT FROM (v_new ->> 'organization_id')::uuid THEN
      RAISE EXCEPTION 'Referencia inválida: % no pertenece a esta organización', v_col
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

DO $$
DECLARE
  spec record;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('dogs',                 $a$'customer_id','customers','preferred_unit_id','facility_units'$a$),
      ('reservations',         $a$'customer_id','customers','dog_id','dogs','staff_id','staff_members','location_id','facility_units'$a$),
      ('report_cards',         $a$'dog_id','dogs','trainer_id','staff_members'$a$),
      ('tasks',                $a$'dog_id','dogs','assignee_staff_id','staff_members','zone_id','facility_zones'$a$),
      ('invoices',             $a$'customer_id','customers','reservation_id','reservations'$a$),
      ('invoice_items',        $a$'invoice_id','invoices'$a$),
      ('packages',             $a$'customer_id','customers'$a$),
      ('facility_units',       $a$'zone_id','facility_zones','assigned_reservation_id','reservations'$a$),
      ('medical_history',      $a$'dog_id','dogs'$a$),
      ('vaccination_schedule', $a$'dog_id','dogs'$a$),
      ('deworming_records',    $a$'dog_id','dogs'$a$),
      ('medical_conditions',   $a$'dog_id','dogs'$a$),
      ('dog_temperament',      $a$'dog_id','dogs'$a$),
      ('dog_allergies',        $a$'dog_id','dogs'$a$),
      ('dog_medications',      $a$'dog_id','dogs'$a$)
    ) AS t(tbl, args)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS enforce_same_org_refs ON public.%I', spec.tbl);
    EXECUTE format(
      'CREATE TRIGGER enforce_same_org_refs BEFORE INSERT OR UPDATE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.enforce_same_org_refs(%s)',
      spec.tbl, spec.args);
  END LOOP;
END $$;


-- ── 7. route_stops ──────────────────────────────────────────────────────────
-- El chofer opera sus paradas solo vía RPC (mark_route_stop_departed /
-- complete_route_stop). La escritura directa queda para schedulers, y aun
-- así las referencias y los campos de notificación son inmutables: antes se
-- podía cambiar customer_id o resetear notification_sent_at y la Edge
-- Function (service role) mandaba SMS a cualquier cliente, repetidamente.
DROP POLICY IF EXISTS "route_stops write" ON public.route_stops;
CREATE POLICY "route_stops write" ON public.route_stops FOR ALL TO authenticated
USING (
  task_id IN (
    SELECT t.id FROM public.tasks t
    WHERE t.organization_id IN (SELECT public.get_scheduler_org_ids())
  )
)
WITH CHECK (
  task_id IN (
    SELECT t.id FROM public.tasks t
    WHERE t.organization_id IN (SELECT public.get_scheduler_org_ids())
  )
);

CREATE OR REPLACE FUNCTION public.guard_route_stop()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_task_org uuid;
  v_res      record;
BEGIN
  -- service_role (Edge Function notify-route-stop) escribe ETA/notificación.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.task_id              := OLD.task_id;
    NEW.reservation_id       := OLD.reservation_id;
    NEW.customer_id          := OLD.customer_id;
    NEW.dog_id               := OLD.dog_id;
    NEW.notification_channel := OLD.notification_channel;
    NEW.notification_sent_at := OLD.notification_sent_at;
    NEW.notification_error   := OLD.notification_error;
    NEW.eta_minutes          := OLD.eta_minutes;
    NEW.eta_calculated_at    := OLD.eta_calculated_at;
    RETURN NEW;
  END IF;

  SELECT organization_id INTO v_task_org FROM public.tasks WHERE id = NEW.task_id;
  SELECT customer_id, dog_id, organization_id INTO v_res
  FROM public.reservations WHERE id = NEW.reservation_id;

  IF v_res.organization_id IS NULL OR v_res.organization_id IS DISTINCT FROM v_task_org THEN
    RAISE EXCEPTION 'La reserva no pertenece a la organización de la ruta';
  END IF;

  -- Cliente y perro siempre salen de la reserva, nunca del cliente HTTP.
  NEW.customer_id          := v_res.customer_id;
  NEW.dog_id               := v_res.dog_id;
  NEW.notification_sent_at := NULL;
  NEW.notification_channel := NULL;
  NEW.notification_error   := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_route_stop ON public.route_stops;
CREATE TRIGGER guard_route_stop
  BEFORE INSERT OR UPDATE ON public.route_stops
  FOR EACH ROW EXECUTE FUNCTION public.guard_route_stop();

-- Reintento: si la notificación falló (GPS, Twilio), el chofer puede volver a
-- tocar "Salí hacia aquí" — antes la parada ya estaba en 'en_route' y el RPC
-- lo rechazaba, dejando la notificación imposible de reenviar.
CREATE OR REPLACE FUNCTION public.mark_route_stop_departed(p_stop_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_id uuid;
BEGIN
  SELECT task_id INTO v_task_id FROM public.route_stops WHERE id = p_stop_id;
  IF v_task_id IS NULL THEN
    RAISE EXCEPTION 'Parada no encontrada';
  END IF;

  IF v_task_id NOT IN (
    SELECT t.id FROM public.tasks t
    WHERE t.organization_id IN (SELECT public.get_scheduler_org_ids())
       OR (t.assignee_staff_id IN (SELECT public.get_my_staff_ids())
           AND t.organization_id IN (SELECT public.get_active_org_ids()))
  ) THEN
    RAISE EXCEPTION 'No autorizado para esta parada';
  END IF;

  UPDATE public.route_stops
  SET status = 'en_route', departed_at = COALESCE(departed_at, now())
  WHERE id = p_stop_id AND status IN ('pending', 'en_route');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La parada ya no está pendiente (estado actual no permite salida)';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_route_stop(p_stop_id uuid, p_skip_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_id    uuid;
  v_new_status text := CASE WHEN p_skip_reason IS NULL THEN 'completed' ELSE 'skipped' END;
BEGIN
  SELECT task_id INTO v_task_id FROM public.route_stops WHERE id = p_stop_id;
  IF v_task_id IS NULL THEN
    RAISE EXCEPTION 'Parada no encontrada';
  END IF;

  IF v_task_id NOT IN (
    SELECT t.id FROM public.tasks t
    WHERE t.organization_id IN (SELECT public.get_scheduler_org_ids())
       OR (t.assignee_staff_id IN (SELECT public.get_my_staff_ids())
           AND t.organization_id IN (SELECT public.get_active_org_ids()))
  ) THEN
    RAISE EXCEPTION 'No autorizado para esta parada';
  END IF;

  UPDATE public.route_stops
  SET status = v_new_status, completed_at = now(), skipped_reason = p_skip_reason
  WHERE id = p_stop_id
    AND status NOT IN ('completed', 'skipped');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esta parada ya estaba cerrada';
  END IF;

  UPDATE public.tasks
  SET status = 'done', completed_at = now()
  WHERE id = v_task_id
    AND NOT EXISTS (
      SELECT 1 FROM public.route_stops
      WHERE task_id = v_task_id AND status IN ('pending','en_route','notified','arrived')
    );
END;
$$;

-- create_daily_route: el chofer debe ser del equipo de la org (el trigger de
-- tasks también lo valida; aquí se da un mensaje claro).
CREATE OR REPLACE FUNCTION public.create_daily_route(
  p_organization_id   uuid,
  p_route_type        text,
  p_assignee_staff_id uuid,
  p_reservation_ids   uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_id uuid;
  v_res     RECORD;
  v_seq     integer := 0;
BEGIN
  IF p_organization_id NOT IN (SELECT public.get_scheduler_org_ids()) THEN
    RAISE EXCEPTION 'No autorizado para crear rutas en esta organización';
  END IF;

  IF p_route_type NOT IN ('route_pickup','route_dropoff') THEN
    RAISE EXCEPTION 'route_type inválido: %', p_route_type;
  END IF;

  IF p_reservation_ids IS NULL OR array_length(p_reservation_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'La ruta necesita al menos una parada';
  END IF;

  IF p_assignee_staff_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE id = p_assignee_staff_id AND organization_id = p_organization_id AND is_active
  ) THEN
    RAISE EXCEPTION 'El chofer no pertenece a esta organización o está inactivo';
  END IF;

  INSERT INTO public.tasks (organization_id, type, title, priority, status, assignee_staff_id, due_at)
  VALUES (
    p_organization_id, p_route_type,
    CASE WHEN p_route_type = 'route_pickup' THEN 'Ruta de recogida — ' ELSE 'Ruta de entrega — ' END
      || to_char(now(), 'DD/MM/YYYY'),
    'high', 'pending', p_assignee_staff_id, now()
  )
  RETURNING id INTO v_task_id;

  FOR v_res IN
    SELECT r.id AS reservation_id, r.customer_id, r.dog_id,
           c.address AS address_snapshot, c.address_lat AS lat, c.address_lng AS lng
    FROM public.reservations r
    JOIN public.customers c ON c.id = r.customer_id
    WHERE r.id = ANY(p_reservation_ids)
      AND r.organization_id = p_organization_id
      AND r.status NOT IN ('cancelled', 'rejected')
    ORDER BY array_position(p_reservation_ids, r.id)
  LOOP
    IF v_res.lat IS NULL OR v_res.lng IS NULL THEN
      RAISE EXCEPTION 'El cliente de la reserva % no tiene dirección geocodificada', v_res.reservation_id;
    END IF;

    v_seq := v_seq + 1;
    INSERT INTO public.route_stops (
      task_id, reservation_id, customer_id, dog_id, sequence,
      address_snapshot, lat, lng
    ) VALUES (
      v_task_id, v_res.reservation_id, v_res.customer_id, v_res.dog_id, v_seq,
      v_res.address_snapshot, v_res.lat, v_res.lng
    );
  END LOOP;

  IF v_seq = 0 THEN
    RAISE EXCEPTION 'Ninguna de las reservas indicadas está activa en esta organización';
  END IF;

  RETURN v_task_id;
END;
$$;


-- ── 8. campaigns ────────────────────────────────────────────────────────────
-- El cliente puede crear/editar borradores, programar y cancelar. 'sending'
-- y 'sent' (y las estadísticas) solo los escribe send-campaign con service
-- role. Antes bastaba con devolver una campaña 'sent' a 'draft' para
-- reenviarla a toda la base de clientes.
CREATE OR REPLACE FUNCTION public.guard_campaign_send_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('sending', 'sent') THEN
      NEW.status := 'draft';
    END IF;
    NEW.sent_at := NULL;
    NEW.stats_sent := 0; NEW.stats_delivered := 0;
    NEW.stats_opened := 0; NEW.stats_clicked := 0;
    RETURN NEW;
  END IF;

  IF OLD.status IN ('sending', 'sent') THEN
    RAISE EXCEPTION 'Una campaña enviada (o en envío) no se puede modificar';
  END IF;
  IF NEW.status IN ('sending', 'sent') THEN
    RAISE EXCEPTION 'El envío de campañas solo lo hace el servidor';
  END IF;

  NEW.sent_at         := OLD.sent_at;
  NEW.stats_sent      := OLD.stats_sent;
  NEW.stats_delivered := OLD.stats_delivered;
  NEW.stats_opened    := OLD.stats_opened;
  NEW.stats_clicked   := OLD.stats_clicked;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_campaign_send_state ON public.campaigns;
CREATE TRIGGER guard_campaign_send_state
  BEFORE INSERT OR UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.guard_campaign_send_state();

-- Baja de comunicaciones de marketing (Ley 1581 / CAN-SPAM). send-campaign
-- excluye a estos clientes.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS marketing_opt_out boolean NOT NULL DEFAULT false;


-- ── 9. packages: auditoría de créditos ─────────────────────────────────────
-- El CHECK original solo admitía deduct/add/adjustment, así que el ajuste de
-- créditos desde /platform-admin ('platform_admin_adjust') fallaba siempre.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.package_credit_log'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%action%'
  LOOP
    EXECUTE format('ALTER TABLE public.package_credit_log DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.package_credit_log
  ADD CONSTRAINT package_credit_log_action_check
  CHECK (action IN ('deduct', 'add', 'adjustment', 'platform_admin_adjust', 'manual_update'));

-- Cualquier cambio de remaining_credits que no venga de un RPC que ya lo
-- registra (edición directa por roles financieros) queda en el log.
CREATE OR REPLACE FUNCTION public.log_manual_credit_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.remaining_credits IS DISTINCT FROM OLD.remaining_credits
     AND COALESCE(current_setting('app.credit_change_logged', true), 'off') <> 'on' THEN
    INSERT INTO public.package_credit_log
      (package_id, organization_id, user_id, action, credits_before, credits_after, reason)
    VALUES (NEW.id, NEW.organization_id, auth.uid(), 'manual_update',
            OLD.remaining_credits, NEW.remaining_credits, 'Edición directa del paquete');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS log_manual_credit_change ON public.packages;
CREATE TRIGGER log_manual_credit_change
  AFTER UPDATE OF remaining_credits ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.log_manual_credit_change();

CREATE OR REPLACE FUNCTION public.platform_admin_adjust_package_credits(
  p_package_id uuid, p_delta int, p_reason text
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_before int;
  v_after  int;
  v_total  int;
  v_org    uuid;
BEGIN
  IF public.get_platform_admin_role() IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Se requiere un motivo';
  END IF;

  SELECT remaining_credits, total_credits, organization_id
    INTO v_before, v_total, v_org
  FROM public.packages WHERE id = p_package_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paquete no encontrado';
  END IF;

  v_after := greatest(0, least(v_total, v_before + p_delta));

  PERFORM set_config('app.credit_change_logged', 'on', true);
  UPDATE public.packages
    SET remaining_credits = v_after,
        status = CASE WHEN v_after = 0 THEN 'depleted'
                       WHEN status = 'depleted' AND v_after > 0 THEN 'active'
                       ELSE status END,
        updated_at = now()
  WHERE id = p_package_id;
  PERFORM set_config('app.credit_change_logged', 'off', true);

  INSERT INTO public.package_credit_log
    (package_id, organization_id, user_id, action, credits_before, credits_after, reason)
  VALUES (p_package_id, v_org, auth.uid(), 'platform_admin_adjust', v_before, v_after, p_reason);

  INSERT INTO public.platform_admin_audit_log (admin_user_id, action, target_org_id, metadata)
  VALUES (auth.uid(), 'adjust_package_credits', v_org, jsonb_build_object(
    'package_id', p_package_id, 'delta', p_delta,
    'before', v_before, 'after', v_after, 'reason', p_reason
  ));

  RETURN json_build_object('before', v_before, 'after', v_after);
END $$;


-- ── 10. Storage ─────────────────────────────────────────────────────────────
-- Antes: cualquier usuario autenticado (de cualquier org, o recién
-- registrado) podía listar, sobrescribir y borrar las fotos de TODOS los
-- centros. Los buckets siguen siendo públicos para lectura por URL; lo que se
-- acota es listar/escribir/borrar.
--   dog-photos:         ruta <dog_id>/photo.<ext>  → el perro debe ser de mi org
--   report-card-photos: ruta <org_id>/<uuid>.<ext> → la org debe ser mía
--                       (archivos legacy en la raíz: solo su autor los borra)
DROP POLICY IF EXISTS "Authenticated users can upload dog photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read dog photos"                    ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update dog photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete dog photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload report photos"    ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view report photos"      ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete report photos"    ON storage.objects;
DROP POLICY IF EXISTS "dog-photos org read"   ON storage.objects;
DROP POLICY IF EXISTS "dog-photos org insert" ON storage.objects;
DROP POLICY IF EXISTS "dog-photos org update" ON storage.objects;
DROP POLICY IF EXISTS "dog-photos org delete" ON storage.objects;
DROP POLICY IF EXISTS "report-card-photos org read"   ON storage.objects;
DROP POLICY IF EXISTS "report-card-photos org insert" ON storage.objects;
DROP POLICY IF EXISTS "report-card-photos org delete" ON storage.objects;

CREATE OR REPLACE FUNCTION public.storage_dog_folder_in_my_orgs(p_name text, p_active boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- p_active: escribir exige suscripción vigente; leer/listar, solo membresía.
  SELECT EXISTS (
    SELECT 1 FROM public.dogs d
    WHERE d.id::text = (storage.foldername(p_name))[1]
      AND (
        (p_active AND d.organization_id IN (SELECT public.get_active_org_ids()))
        OR (NOT p_active AND d.organization_id IN (SELECT public.get_user_org_ids()))
      )
  );
$$;

-- Alta de perro: DogModal sube la foto ANTES de insertar el perro (el id se
-- genera en el cliente), así que también se admite una carpeta con forma de
-- UUID que aún no pertenece a ningún perro. Nunca la carpeta de un perro de
-- otra organización.
CREATE OR REPLACE FUNCTION public.storage_dog_folder_insertable(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.storage_dog_folder_in_my_orgs(p_name, true)
      OR (
        (storage.foldername(p_name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND NOT EXISTS (SELECT 1 FROM public.dogs d WHERE d.id::text = (storage.foldername(p_name))[1])
        AND EXISTS (SELECT 1 FROM public.get_active_org_ids())
      );
$$;

CREATE OR REPLACE FUNCTION public.storage_org_folder_in_my_orgs(p_name text, p_active boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN p_active THEN (storage.foldername(p_name))[1] IN (SELECT o::text FROM public.get_active_org_ids() o)
    ELSE (storage.foldername(p_name))[1] IN (SELECT o::text FROM public.get_user_org_ids() o)
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.storage_dog_folder_in_my_orgs(text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.storage_dog_folder_insertable(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.storage_dog_folder_insertable(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.storage_org_folder_in_my_orgs(text, boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.storage_dog_folder_in_my_orgs(text, boolean) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.storage_org_folder_in_my_orgs(text, boolean) TO authenticated;

-- upload(..., { upsert: true }) se ejecuta como INSERT ... ON CONFLICT DO
-- UPDATE ... RETURNING, que también evalúa SELECT y UPDATE: por eso ambas
-- admiten la carpeta "aún sin perro" del alta.
CREATE POLICY "dog-photos org read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dog-photos'
         AND (public.storage_dog_folder_in_my_orgs(name, false)
              OR public.storage_dog_folder_insertable(name)));
CREATE POLICY "dog-photos org insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dog-photos' AND public.storage_dog_folder_insertable(name));
CREATE POLICY "dog-photos org update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'dog-photos' AND public.storage_dog_folder_insertable(name))
  WITH CHECK (bucket_id = 'dog-photos' AND public.storage_dog_folder_insertable(name));
CREATE POLICY "dog-photos org delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dog-photos' AND public.storage_dog_folder_in_my_orgs(name, true));

CREATE POLICY "report-card-photos org read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'report-card-photos'
         AND (public.storage_org_folder_in_my_orgs(name, false) OR owner = auth.uid()));
CREATE POLICY "report-card-photos org insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'report-card-photos' AND public.storage_org_folder_in_my_orgs(name, true));
CREATE POLICY "report-card-photos org delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'report-card-photos'
         AND (public.storage_org_folder_in_my_orgs(name, true) OR owner = auth.uid()));

-- Mismo límite que dog-photos (antes aceptaba cualquier tipo y tamaño).
UPDATE storage.buckets
   SET file_size_limit = 5242880,
       allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
 WHERE id = 'report-card-photos';


-- ── 11. business_profile (legacy, sin uso en el frontend) ──────────────────
DROP POLICY IF EXISTS "Org members can access business profile" ON public.business_profile;
DROP POLICY IF EXISTS "business_profile read"  ON public.business_profile;
DROP POLICY IF EXISTS "business_profile write" ON public.business_profile;
CREATE POLICY "business_profile read" ON public.business_profile FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()));
CREATE POLICY "business_profile write" ON public.business_profile FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_admin_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_admin_org_ids()));


-- Las funciones creadas arriba nacen con los default privileges ya corregidos;
-- se reafirma el acceso de authenticated a las nuevas RPC/helpers.
GRANT EXECUTE ON FUNCTION public.create_organization(text, text) TO authenticated;
