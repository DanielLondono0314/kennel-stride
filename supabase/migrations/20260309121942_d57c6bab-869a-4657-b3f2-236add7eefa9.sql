
-- Medical history: general consultation/visit records with vitals
CREATE TABLE public.medical_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id text NOT NULL,
  dog_name text NOT NULL,
  record_date date NOT NULL DEFAULT CURRENT_DATE,
  record_type text NOT NULL DEFAULT 'consultation',
  veterinarian text DEFAULT '',
  reason text DEFAULT '',
  diagnosis text DEFAULT '',
  treatment text DEFAULT '',
  prescription text DEFAULT '',
  weight numeric,
  temperature numeric,
  heart_rate integer,
  respiratory_rate integer,
  blood_pressure text,
  body_condition_score integer,
  notes text DEFAULT '',
  next_appointment date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Vaccination schedule
CREATE TABLE public.vaccination_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id text NOT NULL,
  dog_name text NOT NULL,
  vaccine_name text NOT NULL,
  vaccine_type text NOT NULL DEFAULT 'core',
  date_administered date NOT NULL DEFAULT CURRENT_DATE,
  next_dose_date date,
  batch_number text DEFAULT '',
  veterinarian text DEFAULT '',
  status text NOT NULL DEFAULT 'administered',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Deworming records
CREATE TABLE public.deworming_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id text NOT NULL,
  dog_name text NOT NULL,
  product_name text NOT NULL,
  product_type text NOT NULL DEFAULT 'internal',
  date_administered date NOT NULL DEFAULT CURRENT_DATE,
  next_dose_date date,
  weight_at_time numeric,
  veterinarian text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Medical conditions (diseases, chronic conditions)
CREATE TABLE public.medical_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id text NOT NULL,
  dog_name text NOT NULL,
  condition_name text NOT NULL,
  condition_type text NOT NULL DEFAULT 'disease',
  diagnosed_date date DEFAULT CURRENT_DATE,
  resolved_date date,
  status text NOT NULL DEFAULT 'active',
  severity text NOT NULL DEFAULT 'moderate',
  treatment text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Dog temperament profiles
CREATE TABLE public.dog_temperament (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id text NOT NULL UNIQUE,
  dog_name text NOT NULL,
  energy_level integer NOT NULL DEFAULT 3,
  sociability_dogs integer NOT NULL DEFAULT 3,
  sociability_people integer NOT NULL DEFAULT 3,
  anxiety_level integer NOT NULL DEFAULT 2,
  aggression_level integer NOT NULL DEFAULT 1,
  trainability integer NOT NULL DEFAULT 3,
  noise_sensitivity integer NOT NULL DEFAULT 2,
  prey_drive integer NOT NULL DEFAULT 2,
  general_notes text DEFAULT '',
  behavioral_alerts text DEFAULT '',
  last_evaluation_date date DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.medical_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaccination_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deworming_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dog_temperament ENABLE ROW LEVEL SECURITY;

-- RLS policies (anon demo pattern)
CREATE POLICY "Anon full access medical_history" ON public.medical_history FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Anon full access vaccination_schedule" ON public.vaccination_schedule FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Anon full access deworming_records" ON public.deworming_records FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Anon full access medical_conditions" ON public.medical_conditions FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Anon full access dog_temperament" ON public.dog_temperament FOR ALL TO public USING (true) WITH CHECK (true);
