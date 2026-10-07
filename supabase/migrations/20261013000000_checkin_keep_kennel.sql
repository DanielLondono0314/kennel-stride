-- Check-in de un perro que YA está en una perrera.
--
-- Colina ubicó a sus perros en perreras antes de tener reservas (42 perreras
-- con perro y sin reserva). Al hacer el check-in de la reserva nueva, el RPC
-- rechazaba al perro ("ya ocupa otra perrera, libérala primero") y el modal
-- solo ofrecía perreras libres: había que liberar y volver a elegir.
--
-- Ahora:
--   · si se elige la perrera donde el perro ya está, se vincula a la reserva
--     (sigue ocupada, ahora con su reserva y fechas);
--   · si se elige otra perrera libre, el perro se mueve: su perrera anterior
--     queda libre (nunca queda en dos perreras);
--   · p_unit_id NULL = "la perrera donde ya está";
--   · solo se bloquea si el perro tiene OTRA estadía activa (check-in hecho).

CREATE OR REPLACE FUNCTION public.check_in_reservation(p_reservation_id uuid, p_unit_id uuid, p_notes text DEFAULT ''::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org      uuid;
  v_dog_id   uuid;
  v_dog_name text;
  v_start    timestamptz;
  v_end      timestamptz;
  v_current  public.facility_units;
  v_unit     uuid := p_unit_id;
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

  -- Perrera donde el perro ya está (si está en alguna).
  SELECT * INTO v_current
    FROM public.facility_units u
   WHERE u.organization_id = v_org AND u.assigned_dog_id = v_dog_id::text
   ORDER BY (u.id = p_unit_id) DESC, u.updated_at DESC
   LIMIT 1
   FOR UPDATE;

  -- Si esa perrera pertenece a otra estadía en curso, el perro ya está
  -- registrado: hay que hacer el check-out de esa reserva primero.
  IF v_current.id IS NOT NULL AND v_current.assigned_reservation_id IS NOT NULL
     AND v_current.assigned_reservation_id <> p_reservation_id
     AND EXISTS (
       SELECT 1 FROM public.reservations r2
        WHERE r2.id = v_current.assigned_reservation_id
          AND r2.status IN ('checked_in', 'in_progress', 'ready')
     ) THEN
    RAISE EXCEPTION 'Este perro ya tiene otra estadía en curso en la perrera %. Haz el check-out de esa reserva primero.', v_current.name;
  END IF;

  IF v_unit IS NULL THEN
    v_unit := v_current.id;
    IF v_unit IS NULL THEN
      RAISE EXCEPTION 'Elige una perrera para el check-in';
    END IF;
  END IF;

  IF v_current.id IS DISTINCT FROM v_unit THEN
    -- Perrera nueva: debe estar libre.
    PERFORM 1 FROM public.facility_units u
     WHERE u.id = v_unit AND u.organization_id = v_org AND u.status = 'available'
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Esa perrera no está disponible, elige otra';
    END IF;
  END IF;

  -- El perro sale de cualquier otra perrera en la que figure (se mueve).
  UPDATE public.facility_units
     SET status = 'available', assigned_dog_id = NULL, assigned_dog_name = NULL,
         assignment_start = NULL, assignment_end = NULL, assigned_reservation_id = NULL,
         updated_at = now()
   WHERE organization_id = v_org AND assigned_dog_id = v_dog_id::text AND id <> v_unit;

  UPDATE public.facility_units
     SET status = 'occupied',
         assigned_dog_id = v_dog_id::text,
         assigned_dog_name = v_dog_name,
         assignment_start = v_start,
         assignment_end = v_end,
         assigned_reservation_id = p_reservation_id,
         updated_at = now()
   WHERE id = v_unit;

  UPDATE public.reservations
     SET status = 'checked_in',
         check_in_time = now(),
         location_id = v_unit,
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
