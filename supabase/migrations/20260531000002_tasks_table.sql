-- ============================================================================
-- Worker View · Fase 1b — tabla `tasks` (trabajo ligero que NO es reserva:
-- aseo de zona, rondas de alimentación, paseos, chequeo veterinario).
-- RLS se añade en 20260531000003_worker_rls.sql (este archivo solo crea la
-- tabla + índices y la habilita para RLS).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type              text NOT NULL CHECK (type IN ('cleaning','feeding','walk','vet_check','grooming','other')),
  title             text NOT NULL,
  dog_id            uuid REFERENCES public.dogs(id) ON DELETE SET NULL,
  zone_id           uuid REFERENCES public.facility_zones(id) ON DELETE SET NULL,
  assignee_staff_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  due_at            timestamptz,
  priority          text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','skipped')),
  notes             text,
  report_data       jsonb,            -- estructura de reporte por especialidad (welfare/cleaning/groomer)
  photos            text[],           -- urls de fotos del reporte
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at      timestamptz,
  completed_by      uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_tasks_org        ON public.tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee   ON public.tasks(assignee_staff_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due        ON public.tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_status     ON public.tasks(status);

-- Trigger updated_at (reusa el patrón existente si hay una función genérica;
-- si no existe public.set_updated_at, créala aquí de forma idempotente).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS tasks_set_updated_at ON public.tasks;
CREATE TRIGGER tasks_set_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
