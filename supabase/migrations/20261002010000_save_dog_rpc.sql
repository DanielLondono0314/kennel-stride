-- ============================================================================
-- save_dog: guarda un perro con sus alergias y medicación en UNA transacción
-- (QA E-20). Antes el front hacía 3–5 escrituras separadas (dogs, borrar e
-- insertar dog_allergies, borrar e insertar dog_medications); si una fallaba
-- el perro quedaba a medias — p. ej. con las alergias borradas y sin volver a
-- insertar.
--
-- SECURITY INVOKER: corre con los permisos del usuario, así que las mismas
-- políticas RLS de dogs / dog_allergies / dog_medications deciden quién puede
-- guardar. No abre ningún acceso nuevo.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_dog(
  p_dog         jsonb,
  p_allergies   jsonb DEFAULT '[]'::jsonb,
  p_medications jsonb DEFAULT '[]'::jsonb,
  p_create      boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id  uuid := COALESCE(NULLIF(p_dog->>'id', '')::uuid, gen_random_uuid());
  v_org uuid;
BEGIN
  IF p_create THEN
    v_org := (p_dog->>'organization_id')::uuid;
    INSERT INTO public.dogs (
      id, organization_id, customer_id, name, breed, birth_date, weight, color, gender,
      is_neutered, is_aggressive, has_allergies, on_medication, microchip_number,
      preferred_unit_id, notes, behavior_notes, medical_notes, photo_url,
      aggression_details, feeding
    ) VALUES (
      v_id, v_org, (p_dog->>'customer_id')::uuid, p_dog->>'name', p_dog->>'breed',
      NULLIF(p_dog->>'birth_date', '')::date, NULLIF(p_dog->>'weight', '')::numeric,
      NULLIF(p_dog->>'color', ''), p_dog->>'gender',
      COALESCE((p_dog->>'is_neutered')::boolean, false),
      COALESCE((p_dog->>'is_aggressive')::boolean, false),
      COALESCE((p_dog->>'has_allergies')::boolean, false),
      COALESCE((p_dog->>'on_medication')::boolean, false),
      NULLIF(p_dog->>'microchip_number', ''),
      NULLIF(p_dog->>'preferred_unit_id', '')::uuid,
      COALESCE(p_dog->>'notes', ''), COALESCE(p_dog->>'behavior_notes', ''),
      COALESCE(p_dog->>'medical_notes', ''), NULLIF(p_dog->>'photo_url', ''),
      NULLIF(p_dog->'aggression_details', 'null'::jsonb),
      NULLIF(p_dog->'feeding', 'null'::jsonb)
    )
    RETURNING organization_id INTO v_org;

    IF v_org IS NULL THEN
      RAISE EXCEPTION 'El perro debe pertenecer a una organización';
    END IF;
  ELSE
    UPDATE public.dogs SET
      customer_id        = (p_dog->>'customer_id')::uuid,
      name               = p_dog->>'name',
      breed              = p_dog->>'breed',
      birth_date         = NULLIF(p_dog->>'birth_date', '')::date,
      weight             = NULLIF(p_dog->>'weight', '')::numeric,
      color              = NULLIF(p_dog->>'color', ''),
      gender             = p_dog->>'gender',
      is_neutered        = COALESCE((p_dog->>'is_neutered')::boolean, false),
      is_aggressive      = COALESCE((p_dog->>'is_aggressive')::boolean, false),
      has_allergies      = COALESCE((p_dog->>'has_allergies')::boolean, false),
      on_medication      = COALESCE((p_dog->>'on_medication')::boolean, false),
      microchip_number   = NULLIF(p_dog->>'microchip_number', ''),
      preferred_unit_id  = NULLIF(p_dog->>'preferred_unit_id', '')::uuid,
      notes              = COALESCE(p_dog->>'notes', ''),
      behavior_notes     = COALESCE(p_dog->>'behavior_notes', ''),
      medical_notes      = COALESCE(p_dog->>'medical_notes', ''),
      photo_url          = NULLIF(p_dog->>'photo_url', ''),
      aggression_details = NULLIF(p_dog->'aggression_details', 'null'::jsonb),
      feeding            = NULLIF(p_dog->'feeding', 'null'::jsonb),
      updated_at         = now()
    WHERE id = v_id
    RETURNING organization_id INTO v_org;

    IF v_org IS NULL THEN
      RAISE EXCEPTION 'Perro no encontrado o sin permiso para editarlo';
    END IF;
  END IF;

  DELETE FROM public.dog_allergies WHERE dog_id = v_id;
  INSERT INTO public.dog_allergies (dog_id, organization_id, allergen, type, reaction, severity)
  SELECT v_id, v_org, a->>'allergen', a->>'type', NULLIF(a->>'reaction', ''), NULLIF(a->>'severity', '')
  FROM jsonb_array_elements(COALESCE(p_allergies, '[]'::jsonb)) a;

  DELETE FROM public.dog_medications WHERE dog_id = v_id;
  INSERT INTO public.dog_medications (dog_id, organization_id, name, dose, frequency, duration_days, start_date, route, with_food)
  SELECT v_id, v_org, m->>'name', NULLIF(m->>'dose', ''), NULLIF(m->>'frequency', ''),
         NULLIF(m->>'duration_days', '')::int, NULLIF(m->>'start_date', '')::date,
         NULLIF(m->>'route', ''), COALESCE((m->>'with_food')::boolean, false)
  FROM jsonb_array_elements(COALESCE(p_medications, '[]'::jsonb)) m;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_dog(jsonb, jsonb, jsonb, boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.save_dog(jsonb, jsonb, jsonb, boolean) TO authenticated;
