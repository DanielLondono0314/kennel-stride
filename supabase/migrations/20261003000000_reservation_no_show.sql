-- ============================================================================
-- Estado "No se presentó" (no_show) para reservas (QA E-29).
--
-- Antes "No se presentó" cancelaba la reserva con ese motivo, y en reportes
-- contaba como cancelación. Ahora es un estado propio. reservations.status no
-- tiene CHECK, así que solo hay que tratar no_show como un estado cerrado —
-- igual que cancelled — donde se valida que no haya reservas superpuestas o
-- se arman rutas: una reserva a la que el perro no llegó no debe bloquear esas
-- fechas ni aparecer en la ruta del día.
--
-- Cuerpos tomados tal cual de producción (pg_get_functiondef) con esas listas
-- ampliadas; misma firma, así que se conservan los GRANT existentes.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_daily_route(p_organization_id uuid, p_route_type text, p_assignee_staff_id uuid, p_reservation_ids uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      AND r.status NOT IN ('cancelled', 'rejected', 'no_show')
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_reservation(p_customer_id uuid, p_dog_id uuid, p_service_type text, p_service_name text, p_start timestamp with time zone, p_end timestamp with time zone, p_total_price numeric, p_notes text DEFAULT ''::text, p_staff_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      AND r.status NOT IN ('cancelled','completed','rejected','no_show')
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
END $function$
;

CREATE OR REPLACE FUNCTION public.update_reservation(p_reservation_id uuid, p_service_type text, p_service_name text, p_start timestamp with time zone, p_end timestamp with time zone, p_total_price numeric, p_notes text DEFAULT ''::text, p_status text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    IF p_status NOT IN ('requested','scheduled','cancelled','rejected','completed','no_show')
       AND p_status IS DISTINCT FROM v_status THEN
      RAISE EXCEPTION 'Estado no permitido desde la edición: %', p_status;
    END IF;
    v_status := p_status;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('reservation-dog:' || v_dog_id::text, 0));

  IF v_status NOT IN ('cancelled','completed','rejected','no_show') AND EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.dog_id = v_dog_id
      AND r.id <> p_reservation_id
      AND r.status NOT IN ('cancelled','completed','rejected','no_show')
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
END $function$
;
