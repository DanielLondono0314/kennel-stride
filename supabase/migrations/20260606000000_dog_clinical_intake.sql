-- ============================================================
-- Intake clínico del perro (formulario ampliado)
-- 1) dogs += aggression_details / feeding (JSONB, 1-a-1).
-- 2) dog_allergies / dog_medications (1-a-muchos, org-scoped, intake).
-- ============================================================

-- 1. Columnas JSONB en dogs (la forma la valida la app con zod).
ALTER TABLE public.dogs
  ADD COLUMN IF NOT EXISTS aggression_details jsonb,
  ADD COLUMN IF NOT EXISTS feeding jsonb;

-- 2. Alergias (varias por perro).
CREATE TABLE IF NOT EXISTS public.dog_allergies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id          uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  allergen        text NOT NULL,
  type            text NOT NULL CHECK (type IN ('comida','ambiental','medicamento')),
  reaction        text,
  severity        text CHECK (severity IN ('baja','media','alta')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dog_allergies_dog ON public.dog_allergies(dog_id);

-- 3. Medicación (varias por perro; end_date derivada para task-gen futura).
CREATE TABLE IF NOT EXISTS public.dog_medications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id          uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  dose            text,
  frequency       text,
  duration_days   integer CHECK (duration_days IS NULL OR duration_days > 0),
  start_date      date,
  route           text CHECK (route IN ('oral','topica','inyectable')),
  with_food       boolean NOT NULL DEFAULT false,
  end_date        date GENERATED ALWAYS AS (
                    CASE WHEN start_date IS NOT NULL AND duration_days IS NOT NULL
                         THEN start_date + duration_days
                         ELSE NULL END
                  ) STORED,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dog_medications_dog ON public.dog_medications(dog_id);

-- 4. RLS org-scoped (intake; reusa el helper SECURITY DEFINER existente).
ALTER TABLE public.dog_allergies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dog_medications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dog_allergies_org_access ON public.dog_allergies;
CREATE POLICY dog_allergies_org_access ON public.dog_allergies
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

DROP POLICY IF EXISTS dog_medications_org_access ON public.dog_medications;
CREATE POLICY dog_medications_org_access ON public.dog_medications
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dog_allergies   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dog_medications TO authenticated;
