-- Registro inmutable de cada operación sobre créditos de paquetes.
-- Permite auditar quién descontó qué crédito y cuándo.

CREATE TABLE IF NOT EXISTS public.package_credit_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id      uuid        NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  action          text        NOT NULL CHECK (action IN ('deduct', 'add', 'adjustment')),
  credits_before  int         NOT NULL,
  credits_after   int         NOT NULL,
  reservation_id  uuid        REFERENCES public.reservations(id) ON DELETE SET NULL,
  reason          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.package_credit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read credit log"
  ON public.package_credit_log FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Authenticated can insert credit log"
  ON public.package_credit_log FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()));

CREATE INDEX idx_credit_log_package ON public.package_credit_log(package_id);
CREATE INDEX idx_credit_log_org     ON public.package_credit_log(organization_id);
CREATE INDEX idx_credit_log_created ON public.package_credit_log(created_at DESC);
