-- ============================================================
-- Corrección puntual de datos: liberar perreras que quedaron 'occupied'
-- ligadas a reservas YA completadas. Es secuela del bug de check-out doble
-- (el modal completaba la reserva y el RPC fallaba, sin liberar facility_units)
-- corregido en 20260608 / commit 4b5fb10. Una reserva 'completed' nunca debe
-- seguir reteniendo una perrera.
--
-- Idempotente: re-ejecutarla libera 0 filas. No-op en BDs nuevas (sin datos).
-- ============================================================
DO $$
DECLARE
  n integer;
BEGIN
  UPDATE public.facility_units f
     SET status = 'available',
         assigned_dog_id = NULL,
         assigned_dog_name = NULL,
         assignment_start = NULL,
         assignment_end = NULL,
         assigned_reservation_id = NULL,
         updated_at = now()
    FROM public.reservations r
   WHERE f.assigned_reservation_id = r.id
     AND r.status = 'completed';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Perreras liberadas (reservas completed): %', n;
END $$;
