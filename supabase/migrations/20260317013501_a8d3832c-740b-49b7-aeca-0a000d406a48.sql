
CREATE TABLE public.dogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name text NOT NULL,
  breed text NOT NULL,
  birth_date date,
  weight numeric,
  color text,
  gender text NOT NULL DEFAULT 'male',
  is_neutered boolean NOT NULL DEFAULT false,
  microchip_number text,
  notes text DEFAULT '',
  behavior_notes text DEFAULT '',
  medical_notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon full access dogs" ON public.dogs FOR ALL TO public USING (true) WITH CHECK (true);
