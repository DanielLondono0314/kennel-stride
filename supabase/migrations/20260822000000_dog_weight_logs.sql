-- Hoja de pesos: registro rápido de peso por perro (para la gráfica de
-- tendencia), separado del Historial Médico completo — no toda pesada
-- necesita una consulta clínica de por medio.
CREATE TABLE public.dog_weight_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  weight numeric NOT NULL,
  recorded_at date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_dog_weight_logs_dog ON public.dog_weight_logs(dog_id, recorded_at);
CREATE INDEX idx_dog_weight_logs_org ON public.dog_weight_logs(organization_id);

ALTER TABLE public.dog_weight_logs ENABLE ROW LEVEL SECURITY;

-- Mismo patrón que medical_history/vaccination_schedule/etc.: lectura para
-- cualquier miembro de la org, escritura solo para quien puede escribir
-- clínica (admin/manager, o worker con specialty='vet').
CREATE POLICY "dog_weight_logs read" ON public.dog_weight_logs FOR SELECT TO authenticated
USING (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "dog_weight_logs write" ON public.dog_weight_logs FOR ALL TO authenticated
USING (organization_id IN (SELECT public.get_clinical_writer_org_ids()))
WITH CHECK (organization_id IN (SELECT public.get_clinical_writer_org_ids()));
