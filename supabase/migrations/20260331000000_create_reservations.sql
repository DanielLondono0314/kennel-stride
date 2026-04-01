-- Reservations table — core operations table for KennelOps
CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  location_id uuid REFERENCES public.facility_units(id) ON DELETE SET NULL,

  -- Service info (inlined to avoid a separate services table)
  service_type text NOT NULL DEFAULT 'daycare',
  service_name text NOT NULL DEFAULT 'Guardería',

  -- Status lifecycle: requested → scheduled → checked_in → in_progress → ready → picked_up → completed | cancelled
  status text NOT NULL DEFAULT 'requested',

  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  check_in_time timestamptz,
  check_out_time timestamptz,

  total_price numeric NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  rejection_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon full access reservations"
  ON public.reservations FOR ALL TO public
  USING (true) WITH CHECK (true);

-- Index for common queries
CREATE INDEX reservations_customer_id_idx ON public.reservations(customer_id);
CREATE INDEX reservations_dog_id_idx ON public.reservations(dog_id);
CREATE INDEX reservations_status_idx ON public.reservations(status);
CREATE INDEX reservations_start_date_idx ON public.reservations(start_date);
