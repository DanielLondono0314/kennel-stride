-- ============================================================================
-- Servicio de ruta (transporte puerta a puerta) · Fase 2 — esquema.
--
-- Notificación por hitos: el chofer marca "salí hacia aquí" en cada parada y
-- se le avisa al padre por SMS/WhatsApp (Twilio) con un ETA calculado en ese
-- momento (Mapbox Directions). Sin tracking en vivo ni mapa público — ver plan.
--
-- Reusa el patrón de tarea padre + fila hija por perro ya probado en
-- 20260824000000_welfare_checks.sql: una `task` (type='route_pickup'|
-- 'route_dropoff') por ruta del día/chofer, y una `route_stops` por parada.
-- ============================================================================

-- ── 1. customers: geocodificación cacheada + preferencias de notificación ───
-- Lat/lng vive en customers (no en la parada) porque es la fuente de verdad
-- reusable entre rutas distintas del mismo cliente; solo se recalcula cuando
-- cambia la dirección (ver Edge Function geocode-customer-address).
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS address_lat numeric(9,6),
  ADD COLUMN IF NOT EXISTS address_lng numeric(9,6),
  ADD COLUMN IF NOT EXISTS address_geocoded_at timestamptz,
  ADD COLUMN IF NOT EXISTS notification_channel_override text,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT false;

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_notification_channel_override_check;
ALTER TABLE public.customers ADD CONSTRAINT customers_notification_channel_override_check
  CHECK (notification_channel_override IS NULL OR notification_channel_override IN ('sms','whatsapp'));

-- ── 2. organizations: config de canal de notificación de ruta ───────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS route_notifications_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS route_notification_channel text NOT NULL DEFAULT 'sms';

ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_route_notification_channel_check;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_route_notification_channel_check
  CHECK (route_notification_channel IN ('sms','whatsapp'));

-- ── 3. reservations: qué reservas piden transporte (a nivel reserva, no ─────
-- cliente, porque puede variar día a día).
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS pickup_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dropoff_requested boolean NOT NULL DEFAULT false;

-- ── 4. tasks.type: agregar 'route_pickup'/'route_dropoff' al CHECK existente ─
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_type_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_type_check
  CHECK (type IN ('cleaning','feeding','walk','vet_check','grooming','other','welfare_check',
                   'route_pickup','route_dropoff'));

-- ── 5. route_stops — una fila por parada (perro/reserva) de una ruta ────────
CREATE TABLE IF NOT EXISTS public.route_stops (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id               uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  reservation_id        uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  customer_id           uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  dog_id                uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  sequence              integer NOT NULL,
  -- Dirección y coordenadas congeladas al crear la ruta: si el cliente edita
  -- su dirección después, la parada activa no debe moverse bajo el chofer.
  address_snapshot      text NOT NULL,
  lat                   numeric(9,6),
  lng                   numeric(9,6),
  status                text NOT NULL DEFAULT 'pending',
  eta_minutes           integer,
  eta_calculated_at     timestamptz,
  departed_at           timestamptz,
  completed_at          timestamptz,
  skipped_reason        text,
  notification_channel  text,
  -- Idempotencia: NULL = notificación aún no enviada. La Edge Function usa un
  -- UPDATE ... WHERE notification_sent_at IS NULL como lock optimista.
  notification_sent_at  timestamptz,
  notification_error    text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, sequence),
  UNIQUE (task_id, reservation_id)
);

ALTER TABLE public.route_stops DROP CONSTRAINT IF EXISTS route_stops_status_check;
ALTER TABLE public.route_stops ADD CONSTRAINT route_stops_status_check
  CHECK (status IN ('pending','en_route','notified','arrived','completed','skipped'));

ALTER TABLE public.route_stops DROP CONSTRAINT IF EXISTS route_stops_notification_channel_check;
ALTER TABLE public.route_stops ADD CONSTRAINT route_stops_notification_channel_check
  CHECK (notification_channel IS NULL OR notification_channel IN ('sms','whatsapp'));

ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_route_stops_task        ON public.route_stops(task_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_reservation ON public.route_stops(reservation_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_status      ON public.route_stops(status);

DROP TRIGGER IF EXISTS route_stops_set_updated_at ON public.route_stops;
CREATE TRIGGER route_stops_set_updated_at BEFORE UPDATE ON public.route_stops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
