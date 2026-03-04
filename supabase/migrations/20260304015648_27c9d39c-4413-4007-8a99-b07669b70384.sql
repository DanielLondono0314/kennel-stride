
-- Facility zones table
CREATE TABLE public.facility_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  zone_type text NOT NULL DEFAULT 'kennels',
  x numeric NOT NULL DEFAULT 50,
  y numeric NOT NULL DEFAULT 50,
  width numeric NOT NULL DEFAULT 300,
  height numeric NOT NULL DEFAULT 200,
  color text NOT NULL DEFAULT '#3b82f6',
  capacity integer NOT NULL DEFAULT 4,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facility_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read facility_zones" ON public.facility_zones FOR SELECT USING (true);
CREATE POLICY "Anon can insert facility_zones" ON public.facility_zones FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon can update facility_zones" ON public.facility_zones FOR UPDATE USING (true);
CREATE POLICY "Anon can delete facility_zones" ON public.facility_zones FOR DELETE USING (true);

-- Facility units table
CREATE TABLE public.facility_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES public.facility_zones(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit_type text NOT NULL DEFAULT 'kennel',
  position_index integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'available',
  assigned_dog_id text,
  assigned_dog_name text,
  assignment_start timestamptz,
  assignment_end timestamptz,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facility_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read facility_units" ON public.facility_units FOR SELECT USING (true);
CREATE POLICY "Anon can insert facility_units" ON public.facility_units FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon can update facility_units" ON public.facility_units FOR UPDATE USING (true);
CREATE POLICY "Anon can delete facility_units" ON public.facility_units FOR DELETE USING (true);

CREATE INDEX idx_facility_units_zone_id ON public.facility_units(zone_id);
CREATE INDEX idx_facility_units_status ON public.facility_units(status);
