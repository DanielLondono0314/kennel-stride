-- PR-12: datos de ejemplo para reducir el time-to-value de una org nueva.
-- seed_demo_data(): siembra cliente + 2 perros + zona/perreras + reservas +
-- bono, todo reconocible y borrable con remove_demo_data() (el cliente demo
-- cascadea a perros/reservas/paquetes vía FK ON DELETE CASCADE).

CREATE OR REPLACE FUNCTION public.seed_demo_data(p_org_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_customer uuid;
  v_dog_max  uuid;
  v_dog_luna uuid;
  v_zone     uuid;
BEGIN
  IF p_org_id IS NULL OR p_org_id NOT IN (SELECT public.get_user_org_ids()) THEN
    RAISE EXCEPTION 'Organización inválida o fuera de tu cuenta';
  END IF;

  -- Idempotencia: un solo set de datos demo por org.
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

  -- Zona demo SOLO si la org aún no configuró instalaciones.
  IF NOT EXISTS (SELECT 1 FROM public.facility_zones WHERE organization_id = p_org_id) THEN
    INSERT INTO public.facility_zones (name, organization_id)
    VALUES ('Zona Demo', p_org_id)
    RETURNING id INTO v_zone;

    INSERT INTO public.facility_units (zone_id, name, status, organization_id)
    VALUES (v_zone, 'Demo K-01', 'available', p_org_id),
           (v_zone, 'Demo K-02', 'available', p_org_id);
  END IF;

  -- Una reserva aprobada para HOY (lista para check-in) y una solicitud nueva.
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

GRANT EXECUTE ON FUNCTION public.seed_demo_data(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_demo_data(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_org_id IS NULL OR p_org_id NOT IN (SELECT public.get_user_org_ids()) THEN
    RAISE EXCEPTION 'Organización inválida o fuera de tu cuenta';
  END IF;

  -- El cliente demo cascadea a perros, reservas, paquetes y alergias.
  DELETE FROM public.customers
  WHERE organization_id = p_org_id AND email = 'demo@kennelops.example';

  -- La zona demo solo cae si sus perreras no quedaron ligadas a nada real.
  DELETE FROM public.facility_units
  WHERE organization_id = p_org_id
    AND name LIKE 'Demo K-%'
    AND assigned_reservation_id IS NULL;

  DELETE FROM public.facility_zones z
  WHERE z.organization_id = p_org_id
    AND z.name = 'Zona Demo'
    AND NOT EXISTS (SELECT 1 FROM public.facility_units u WHERE u.zone_id = z.id);
END $$;

GRANT EXECUTE ON FUNCTION public.remove_demo_data(uuid) TO authenticated;
