-- ============================================================================
-- Mover un perro de una perrera a otra en una sola transacción, desde la app
-- del trabajador (quien gestiona perreras no tiene acceso al panel).
--
-- - Atómico: el perro no puede quedar en dos perreras ni en ninguna si algo
--   falla a mitad de camino.
-- - Conserva el vínculo con la reserva (assigned_reservation_id), así el
--   check-out libera la perrera nueva, y actualiza reservations.location_id
--   para que el detalle de la reserva muestre la perrera correcta.
-- - Permiso: 'manage_facility' (Gestionar perreras) o quien agenda
--   (scheduler). SECURITY DEFINER porque un trabajador no puede editar
--   reservas ajenas; el chequeo de permiso se hace aquí explícitamente.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.move_dog_kennel(p_from_unit uuid, p_to_unit uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from public.facility_units;
  v_to   public.facility_units;
BEGIN
  IF p_from_unit = p_to_unit THEN
    RAISE EXCEPTION 'Elige una perrera distinta';
  END IF;

  SELECT * INTO v_from FROM public.facility_units WHERE id = p_from_unit FOR UPDATE;
  SELECT * INTO v_to   FROM public.facility_units WHERE id = p_to_unit   FOR UPDATE;

  IF v_from.id IS NULL OR v_to.id IS NULL OR v_from.organization_id IS DISTINCT FROM v_to.organization_id THEN
    RAISE EXCEPTION 'Perrera no encontrada';
  END IF;

  IF NOT (
    public.has_org_permission(v_from.organization_id, 'manage_facility')
    OR v_from.organization_id IN (SELECT public.get_scheduler_org_ids())
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para gestionar perreras';
  END IF;

  IF v_from.assigned_dog_id IS NULL THEN
    RAISE EXCEPTION 'La perrera de origen no tiene perro';
  END IF;
  IF v_to.status <> 'available' OR v_to.assigned_dog_id IS NOT NULL THEN
    RAISE EXCEPTION 'La perrera de destino no está disponible';
  END IF;

  UPDATE public.facility_units SET
    status = 'occupied',
    assigned_dog_id = v_from.assigned_dog_id,
    assigned_dog_name = v_from.assigned_dog_name,
    assignment_start = v_from.assignment_start,
    assignment_end = v_from.assignment_end,
    assigned_reservation_id = v_from.assigned_reservation_id,
    updated_at = now()
  WHERE id = v_to.id;

  UPDATE public.facility_units SET
    status = 'available',
    assigned_dog_id = NULL,
    assigned_dog_name = NULL,
    assignment_start = NULL,
    assignment_end = NULL,
    assigned_reservation_id = NULL,
    updated_at = now()
  WHERE id = v_from.id;

  IF v_from.assigned_reservation_id IS NOT NULL THEN
    UPDATE public.reservations
       SET location_id = v_to.id, updated_at = now()
     WHERE id = v_from.assigned_reservation_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.move_dog_kennel(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.move_dog_kennel(uuid, uuid) TO authenticated;
