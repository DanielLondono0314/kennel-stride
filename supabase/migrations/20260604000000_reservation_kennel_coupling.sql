-- ============================================================
-- Acople Reserva ⇆ Perrera (Enfoque A)
-- 1) facility_units.assigned_reservation_id liga perrera ⇆ reserva.
-- 2) check_in_reservation(): ocupa perrera disponible + liga reserva, atómico.
-- 3) check_out_reservation(): libera la perrera ligada + completa la reserva.
-- ============================================================

-- 1. Columna de enlace (FK a reservations; al borrar reserva, se desliga).
ALTER TABLE public.facility_units
  ADD COLUMN IF NOT EXISTS assigned_reservation_id uuid
  REFERENCES public.reservations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_facility_units_assigned_reservation
  ON public.facility_units(assigned_reservation_id);

-- 2. CHECK-IN transaccional.
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
  -- a. Reserva válida, de una org del usuario, aprobada (scheduled).
  SELECT r.organization_id, r.dog_id, r.start_date, r.end_date
    INTO v_org, v_dog_id, v_start, v_end
  FROM public.reservations r
  WHERE r.id = p_reservation_id
    AND r.organization_id IN (SELECT public.get_user_org_ids())
    AND r.status = 'scheduled'
  FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Reserva inválida, fuera de tu organización o no está aprobada';
  END IF;

  SELECT d.name INTO v_dog_name FROM public.dogs d WHERE d.id = v_dog_id;

  -- b. Perrera de la misma org y disponible AHORA. FOR UPDATE serializa
  --    check-ins concurrentes sobre la misma perrera (anti doble-booking).
  PERFORM 1 FROM public.facility_units u
   WHERE u.id = p_unit_id
     AND u.organization_id = v_org
     AND u.status = 'available'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa perrera no está disponible, elige otra';
  END IF;

  -- c. Ocupar la perrera por la estadía completa.
  UPDATE public.facility_units
     SET status = 'occupied',
         assigned_dog_id = v_dog_id::text,
         assigned_dog_name = v_dog_name,
         assignment_start = v_start,
         assignment_end = v_end,
         assigned_reservation_id = p_reservation_id,
         updated_at = now()
   WHERE id = p_unit_id;

  -- d. Avanzar la reserva y ligar la ubicación.
  UPDATE public.reservations
     SET status = 'checked_in',
         check_in_time = now(),
         location_id = p_unit_id,
         notes = CASE WHEN COALESCE(p_notes, '') <> ''
                      THEN COALESCE(notes, '') || E'\n[Check-in]: ' || p_notes
                      ELSE notes END,
         updated_at = now()
   WHERE id = p_reservation_id;

  -- e. Notice de entrada (consistente con create_reservation).
  INSERT INTO public.notices
    (title, message, severity, entity_type, entity_id, auto_generated, organization_id)
  VALUES
    ('Check-in registrado',
     COALESCE(v_dog_name, 'El perro') || ' ingresó al centro.',
     'info', 'reservation', p_reservation_id::text, true, v_org);
END $$;

GRANT EXECUTE ON FUNCTION public.check_in_reservation(uuid,uuid,text) TO authenticated;

-- 3. CHECK-OUT transaccional (idempotente en la liberación de perrera).
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
    AND r.organization_id IN (SELECT public.get_user_org_ids())
    AND r.status IN ('checked_in', 'in_progress', 'ready')
  FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Reserva inválida, fuera de tu organización o no está en curso';
  END IF;

  -- Liberar SOLO la perrera ligada a esta reserva. Si ya fue liberada
  -- manualmente, el UPDATE no afecta filas y no falla (idempotente).
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

GRANT EXECUTE ON FUNCTION public.check_out_reservation(uuid) TO authenticated;
