
CREATE TABLE IF NOT EXISTS public.reservations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
    staff_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
    location_id uuid,
    service_type text NOT NULL DEFAULT 'daycare',
    service_name text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'requested',
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    check_in_time timestamp with time zone,
    check_out_time timestamp with time zone,
    total_price numeric NOT NULL DEFAULT 0,
    notes text DEFAULT '',
    rejection_reason text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon full access reservations" ON public.reservations FOR ALL TO public USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
