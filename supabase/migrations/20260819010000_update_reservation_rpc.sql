-- Las reservas aprobadas/rechazadas no se podían ajustar (cambio de fecha,
-- servicio, precio o notas por parte del cliente, o reabrir una cancelada).
-- update_reservation() replica las validaciones de create_reservation()
-- pero excluyendo la propia reserva del chequeo de solapamiento.
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
  -- 1. La reserva debe existir y el usuario debe poder programar en esa org
  --    (mismo criterio que la política RLS "reservations update": admin,
  --    manager o front_desk — no cualquier miembro).
  SELECT organization_id, dog_id, status INTO v_org, v_dog_id, v_status
  FROM public.reservations
  WHERE id = p_reservation_id
    AND organization_id IN (SELECT public.get_scheduler_org_ids());
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Reserva inválida o no tienes permiso para editarla';
  END IF;

  -- 2. Validación de fechas.
  IF p_end <= p_start THEN
    RAISE EXCEPTION 'La fecha de fin debe ser posterior al inicio';
  END IF;

  IF p_status IS NOT NULL THEN
    v_status := p_status;
  END IF;

  -- 3. Anti doble-booking, excluyendo la propia reserva.
  IF v_status NOT IN ('cancelled','completed','rejected') AND EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.dog_id = v_dog_id
      AND r.id <> p_reservation_id
      AND r.status NOT IN ('cancelled','completed','rejected')
      AND tstzrange(r.start_date, r.end_date, '[)') && tstzrange(p_start, p_end, '[)')
  ) THEN
    RAISE EXCEPTION 'El perro ya tiene otra reserva que se solapa en ese horario';
  END IF;

  -- 4. Actualizar.
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

GRANT EXECUTE ON FUNCTION public.update_reservation(uuid,text,text,timestamptz,timestamptz,numeric,text,text) TO authenticated;
