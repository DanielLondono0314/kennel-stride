-- ============================================================
-- STREAM B — Reservas: creación transaccional sin doble-booking (H2, H5)
-- create_reservation(): valida pertenencia, rechaza solapamiento para el
-- mismo perro y crea reserva + notice en una sola transacción.
-- ============================================================

-- Índice para acelerar el chequeo de solapamiento por perro.
CREATE INDEX IF NOT EXISTS idx_reservations_dog_dates
  ON public.reservations (dog_id, start_date, end_date);

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
  -- 1. El cliente debe existir y pertenecer a una org del usuario actual.
  SELECT organization_id INTO v_org
  FROM public.customers
  WHERE id = p_customer_id
    AND organization_id IN (SELECT public.get_user_org_ids());
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Cliente inválido o fuera de tu organización';
  END IF;

  -- 2. El perro debe pertenecer a la misma organización.
  IF NOT EXISTS (
    SELECT 1 FROM public.dogs
    WHERE id = p_dog_id AND organization_id = v_org
  ) THEN
    RAISE EXCEPTION 'Perro inválido o fuera de tu organización';
  END IF;

  -- 3. Validación de fechas.
  IF p_end <= p_start THEN
    RAISE EXCEPTION 'La fecha de fin debe ser posterior al inicio';
  END IF;

  -- 4. Anti doble-booking: ninguna reserva activa del mismo perro puede
  --    solaparse con [p_start, p_end). El rango half-open '[)' evita falsos
  --    positivos cuando una termina justo cuando otra empieza.
  IF EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.dog_id = p_dog_id
      AND r.status NOT IN ('cancelled','completed','rejected')
      AND tstzrange(r.start_date, r.end_date, '[)') && tstzrange(p_start, p_end, '[)')
  ) THEN
    RAISE EXCEPTION 'El perro ya tiene una reserva que se solapa en ese horario';
  END IF;

  -- 5. Crear la reserva.
  INSERT INTO public.reservations
    (customer_id, dog_id, service_type, service_name, start_date, end_date,
     total_price, notes, status, organization_id, staff_id)
  VALUES
    (p_customer_id, p_dog_id, p_service_type, p_service_name, p_start, p_end,
     p_total_price, COALESCE(p_notes, ''), 'requested', v_org, p_staff_id)
  RETURNING id INTO v_res_id;

  -- 6. Notice de solicitud, en la MISMA transacción (si falla, no queda reserva huérfana).
  --    Mensaje enriquecido con nombres de cliente y perro (paridad con la UI previa).
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

GRANT EXECUTE ON FUNCTION public.create_reservation(uuid,uuid,text,text,timestamptz,timestamptz,numeric,text,uuid) TO authenticated;
