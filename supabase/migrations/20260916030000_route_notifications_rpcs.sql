-- ============================================================================
-- Servicio de ruta · Fase 4 — RPCs SECURITY DEFINER.
--
-- Estas funciones SOLO leen/escriben en Postgres. El cálculo real de ETA
-- (Mapbox) y el envío de SMS/WhatsApp (Twilio) viven en la Edge Function
-- notify-route-stop — pg_net no está habilitado en este proyecto, así que
-- Postgres no hace las llamadas HTTP salientes; el frontend invoca la Edge
-- Function explícitamente después de mark_route_stop_departed(), igual que ya
-- hace con send-report-card/send-campaign.
-- ============================================================================

-- ── 1. create_daily_route — armado manual de la ruta del día ────────────────
-- Manual, no cron: a diferencia de las rondas de bienestar (criterio estable
-- "hay perros presentes"), una ruta depende de qué reservas de hoy pidieron
-- transporte, el orden geográfico elegido por front-desk y qué chofer está
-- disponible — mejor que un humano la arme y ajuste antes de que salga.
CREATE OR REPLACE FUNCTION public.create_daily_route(
  p_organization_id   uuid,
  p_route_type        text,   -- 'route_pickup' | 'route_dropoff'
  p_assignee_staff_id uuid,
  p_reservation_ids   uuid[]  -- orden ya elegido por front-desk en la UI
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

  INSERT INTO public.tasks (organization_id, type, title, priority, status, assignee_staff_id, due_at)
  VALUES (
    p_organization_id, p_route_type,
    CASE WHEN p_route_type = 'route_pickup' THEN 'Ruta de recogida — ' ELSE 'Ruta de entrega — ' END
      || to_char(now(), 'DD/MM/YYYY'),
    'high', 'pending', p_assignee_staff_id, now()
  )
  RETURNING id INTO v_task_id;

  -- Recorre las reservas en el orden pasado por la UI (array_position),
  -- validando que pertenezcan a la misma organización.
  FOR v_res IN
    SELECT r.id AS reservation_id, r.customer_id, r.dog_id,
           c.address AS address_snapshot, c.address_lat AS lat, c.address_lng AS lng
    FROM public.reservations r
    JOIN public.customers c ON c.id = r.customer_id
    WHERE r.id = ANY(p_reservation_ids)
      AND r.organization_id = p_organization_id
    ORDER BY array_position(p_reservation_ids, r.id)
  LOOP
    -- Sin coordenadas geocodificadas no hay forma de calcular ETA; se aborta
    -- toda la ruta (sin paradas "mudas") en vez de crearla a medias.
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
    RAISE EXCEPTION 'Ninguna de las reservas indicadas pertenece a esta organización';
  END IF;

  RETURN v_task_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_daily_route(uuid, text, uuid, uuid[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_daily_route(uuid, text, uuid, uuid[]) TO authenticated;

-- ── 2. mark_route_stop_departed — el chofer marca "salí hacia aquí" ─────────
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
       OR t.assignee_staff_id IN (SELECT public.get_my_staff_ids())
  ) THEN
    RAISE EXCEPTION 'No autorizado para esta parada';
  END IF;

  -- Guarda WHERE status='pending': idempotente ante doble-tap, no reescribe
  -- departed_at si ya se marcó la salida.
  UPDATE public.route_stops
  SET status = 'en_route', departed_at = now()
  WHERE id = p_stop_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La parada ya no está pendiente (estado actual no permite salida)';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_route_stop_departed(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.mark_route_stop_departed(uuid) TO authenticated;

-- ── 3. complete_route_stop — marca parada completada u omitida ──────────────
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
       OR t.assignee_staff_id IN (SELECT public.get_my_staff_ids())
  ) THEN
    RAISE EXCEPTION 'No autorizado para esta parada';
  END IF;

  UPDATE public.route_stops
  SET status = v_new_status, completed_at = now(), skipped_reason = p_skip_reason
  WHERE id = p_stop_id;

  -- Si ya no quedan paradas activas en la tarea, cerrarla (mismo espíritu que
  -- el worker cerrando su propia ronda de bienestar).
  UPDATE public.tasks
  SET status = 'done', completed_at = now()
  WHERE id = v_task_id
    AND NOT EXISTS (
      SELECT 1 FROM public.route_stops
      WHERE task_id = v_task_id AND status IN ('pending','en_route','notified','arrived')
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_route_stop(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.complete_route_stop(uuid, text) TO authenticated;
