-- ============================================================================
-- Documentación legal: plantillas de contrato por tipo de servicio y
-- contratos generados, anexados a cada perro, para imprimir y firmar en físico
-- o enviar por correo para firma electrónica (Ley 527 de 1999, Decreto 2364
-- de 2012).
--
-- contract_templates: texto con variables {{...}} que el front reemplaza con
--   los datos del cliente, perros, servicio, fechas y valores. Solo los admins
--   las crean/editan (son el texto legal del negocio).
-- contracts: cada documento generado. Guarda una copia del texto YA renderizado
--   (body) para que reimprimir dé exactamente lo mismo aunque luego cambie la
--   plantilla o los datos del cliente.
-- contract_dogs: perros cubiertos por el contrato (un cliente puede tener
--   varios). El contrato aparece en el perfil de cada uno.
--
-- Firma electrónica: solo la Edge Function `contract-signing` (service role)
-- escribe el token y los datos de firma. El rol authenticated tiene permisos
-- por columna que NO incluyen esas columnas, así el personal no puede fabricar
-- una firma digital desde la API.
--
-- Acceso: quien puede agendar ('schedule') o cobrar ('billing') ve y genera
-- contratos; borrar queda para admins.
-- ============================================================================

-- ── Documento de identidad del cliente ─────────────────────────────────────
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS id_document text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS id_document_type text NOT NULL DEFAULT 'CC';

DO $$ BEGIN
  ALTER TABLE public.customers ADD CONSTRAINT customers_id_document_type_check
    CHECK (id_document_type IN ('CC','CE','TI','PA','PPT','NIT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.customers ADD CONSTRAINT customers_id_document_len
    CHECK (id_document IS NULL OR length(btrim(id_document)) BETWEEN 3 AND 30);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Forma canónica para comparar documentos: sin puntos, espacios ni guiones.
CREATE OR REPLACE FUNCTION public.normalize_id_document(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT nullif(upper(regexp_replace(coalesce(p, ''), '[^0-9A-Za-z]', '', 'g')), '');
$$;

-- Un mismo documento no puede estar en dos clientes de la misma org.
CREATE UNIQUE INDEX IF NOT EXISTS customers_org_id_document_key
  ON public.customers (organization_id, public.normalize_id_document(id_document))
  WHERE id_document IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_contract_org_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_org_ids_with_permission('schedule')
  UNION
  SELECT public.get_org_ids_with_permission('billing');
$$;
GRANT EXECUTE ON FUNCTION public.get_contract_org_ids() TO authenticated;

-- ── Plantillas ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name               text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 80),
  service_type       text,
  body               text NOT NULL DEFAULT '' CHECK (length(body) <= 100000),
  include_signatures boolean NOT NULL DEFAULT true,
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contract_templates_org_idx
  ON public.contract_templates (organization_id, name);

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_templates TO authenticated;
GRANT ALL ON public.contract_templates TO service_role;

DROP POLICY IF EXISTS "contract_templates read"  ON public.contract_templates;
DROP POLICY IF EXISTS "contract_templates write" ON public.contract_templates;
CREATE POLICY "contract_templates read" ON public.contract_templates FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_contract_org_ids()));
CREATE POLICY "contract_templates write" ON public.contract_templates FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_admin_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_admin_org_ids()));

-- ── Contratos generados ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contracts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id     uuid REFERENCES public.contract_templates(id) ON DELETE SET NULL,
  customer_id     uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  reservation_id  uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  package_id      uuid REFERENCES public.packages(id) ON DELETE SET NULL,
  title           text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  service_type    text,
  body            text NOT NULL CHECK (length(body) <= 200000),
  include_signatures boolean NOT NULL DEFAULT true,
  field_values    jsonb NOT NULL DEFAULT '{}'::jsonb,
  start_date      date,
  end_date        date,
  total_value     numeric(12,2),
  -- generated: listo para imprimir · sent: esperando firma electrónica
  -- signed: firmado (en papel o electrónicamente) · void: anulado
  status          text NOT NULL DEFAULT 'generated' CHECK (status IN ('generated','sent','signed','void')),
  signed_at       timestamptz,
  signed_via      text CHECK (signed_via IN ('paper','digital')),
  -- Envío para firma electrónica (solo service role)
  sent_at               timestamptz,
  sent_to               text[],
  sign_token            text UNIQUE,
  sign_token_expires_at timestamptz,
  sign_failed_attempts  int NOT NULL DEFAULT 0,
  body_sha256           text,
  -- Evidencia de la firma electrónica (solo service role)
  signer_name        text,
  signer_document    text,
  signer_ip          text,
  signer_user_agent  text,
  signature_image    text CHECK (signature_image IS NULL OR length(signature_image) <= 400000),
  created_by      uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contracts_dates_order CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS contracts_org_created_idx ON public.contracts (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS contracts_customer_idx    ON public.contracts (customer_id);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
-- Permisos por columna: el personal no toca token ni evidencia de firma.
REVOKE ALL ON public.contracts FROM authenticated;
GRANT SELECT, DELETE ON public.contracts TO authenticated;
GRANT INSERT (organization_id, template_id, customer_id, reservation_id, package_id, title,
              service_type, body, include_signatures, field_values, start_date, end_date,
              total_value)
  ON public.contracts TO authenticated;
GRANT UPDATE (status, signed_at, title) ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;

DROP POLICY IF EXISTS "contracts read"   ON public.contracts;
DROP POLICY IF EXISTS "contracts insert" ON public.contracts;
DROP POLICY IF EXISTS "contracts update" ON public.contracts;
DROP POLICY IF EXISTS "contracts delete" ON public.contracts;
CREATE POLICY "contracts read" ON public.contracts FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_contract_org_ids()));
CREATE POLICY "contracts insert" ON public.contracts FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.get_contract_org_ids()));
CREATE POLICY "contracts update" ON public.contracts FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.get_contract_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_contract_org_ids()));
CREATE POLICY "contracts delete" ON public.contracts FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.get_admin_org_ids()));

-- Transiciones de estado. Un contrato firmado es un documento legal: su texto
-- y partes no cambian, solo se puede anular.
CREATE OR REPLACE FUNCTION public.guard_contract_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_is_staff boolean := coalesce(auth.role(), '') = 'authenticated';
BEGIN
  IF OLD.status = 'void' AND NEW.status IS DISTINCT FROM 'void' THEN
    RAISE EXCEPTION 'Un contrato anulado no se puede reactivar' USING ERRCODE = 'P0001';
  END IF;

  IF OLD.status = 'signed' AND (
       NEW.body IS DISTINCT FROM OLD.body
    OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
    OR NEW.field_values IS DISTINCT FROM OLD.field_values
    OR NEW.total_value IS DISTINCT FROM OLD.total_value
    OR NEW.start_date IS DISTINCT FROM OLD.start_date
    OR NEW.end_date IS DISTINCT FROM OLD.end_date
    OR NEW.signature_image IS DISTINCT FROM OLD.signature_image
    OR NEW.status NOT IN ('signed','void')
  ) THEN
    RAISE EXCEPTION 'Un contrato firmado no se puede modificar, solo anular'
      USING ERRCODE = 'P0001';
  END IF;

  -- El personal solo marca firmado en papel o anula; 'sent' y la firma
  -- electrónica los pone la Edge Function.
  IF v_is_staff AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status NOT IN ('signed','void') THEN
    RAISE EXCEPTION 'Cambio de estado no permitido' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.status = 'signed' AND OLD.status IS DISTINCT FROM 'signed' THEN
    NEW.signed_at := coalesce(NEW.signed_at, now());
    IF v_is_staff OR NEW.signed_via IS NULL THEN
      NEW.signed_via := 'paper';
    END IF;
  END IF;

  -- Anular o firmar invalida el enlace pendiente de firma electrónica.
  IF NEW.status = 'void' OR (NEW.status = 'signed' AND NEW.signed_via = 'paper') THEN
    NEW.sign_token_expires_at := least(NEW.sign_token_expires_at, now());
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_signed_contract ON public.contracts;
DROP TRIGGER IF EXISTS guard_contract_update ON public.contracts;
CREATE TRIGGER guard_contract_update
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.guard_contract_update();

-- Referencias dentro de la misma organización (ver 20260926000000 §6).
DROP TRIGGER IF EXISTS enforce_same_org_refs ON public.contracts;
CREATE TRIGGER enforce_same_org_refs BEFORE INSERT OR UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_same_org_refs(
    'customer_id','customers','reservation_id','reservations',
    'package_id','packages','template_id','contract_templates');

-- ── Perros del contrato ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contract_dogs (
  contract_id     uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  dog_id          uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contract_id, dog_id)
);

CREATE INDEX IF NOT EXISTS contract_dogs_dog_idx ON public.contract_dogs (dog_id);

ALTER TABLE public.contract_dogs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.contract_dogs TO authenticated;
GRANT ALL ON public.contract_dogs TO service_role;

DROP POLICY IF EXISTS "contract_dogs read"   ON public.contract_dogs;
DROP POLICY IF EXISTS "contract_dogs insert" ON public.contract_dogs;
DROP POLICY IF EXISTS "contract_dogs delete" ON public.contract_dogs;
CREATE POLICY "contract_dogs read" ON public.contract_dogs FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_contract_org_ids()));
CREATE POLICY "contract_dogs insert" ON public.contract_dogs FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.get_contract_org_ids()));
CREATE POLICY "contract_dogs delete" ON public.contract_dogs FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.get_admin_org_ids()));

DROP TRIGGER IF EXISTS enforce_same_org_refs ON public.contract_dogs;
CREATE TRIGGER enforce_same_org_refs BEFORE INSERT OR UPDATE ON public.contract_dogs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_same_org_refs('contract_id','contracts','dog_id','dogs');

-- El perro debe ser del cliente del contrato, y a un contrato ya enviado o
-- firmado no se le agregan perros.
CREATE OR REPLACE FUNCTION public.guard_contract_dog()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_contract public.contracts%ROWTYPE;
BEGIN
  SELECT * INTO v_contract FROM public.contracts WHERE id = NEW.contract_id;
  IF v_contract.status IN ('signed','sent','void') THEN
    RAISE EXCEPTION 'No se pueden agregar perros a un contrato enviado, firmado o anulado'
      USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.dogs d WHERE d.id = NEW.dog_id AND d.customer_id = v_contract.customer_id
  ) THEN
    RAISE EXCEPTION 'El perro no pertenece al cliente del contrato' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_contract_dog ON public.contract_dogs;
CREATE TRIGGER guard_contract_dog BEFORE INSERT ON public.contract_dogs
  FOR EACH ROW EXECUTE FUNCTION public.guard_contract_dog();

-- ── Crear contrato + perros en una sola transacción ────────────────────────
-- SECURITY INVOKER: aplican la RLS y los permisos por columna del que llama.
CREATE OR REPLACE FUNCTION public.create_contract(p_contract jsonb, p_dog_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_id  uuid;
  v_org uuid := (p_contract ->> 'organization_id')::uuid;
BEGIN
  INSERT INTO public.contracts (organization_id, template_id, customer_id, reservation_id,
    package_id, title, service_type, body, include_signatures, field_values, start_date,
    end_date, total_value)
  VALUES (
    v_org,
    nullif(p_contract ->> 'template_id', '')::uuid,
    (p_contract ->> 'customer_id')::uuid,
    nullif(p_contract ->> 'reservation_id', '')::uuid,
    nullif(p_contract ->> 'package_id', '')::uuid,
    p_contract ->> 'title',
    nullif(p_contract ->> 'service_type', ''),
    p_contract ->> 'body',
    coalesce((p_contract ->> 'include_signatures')::boolean, true),
    coalesce(p_contract -> 'field_values', '{}'::jsonb),
    nullif(p_contract ->> 'start_date', '')::date,
    nullif(p_contract ->> 'end_date', '')::date,
    nullif(p_contract ->> 'total_value', '')::numeric
  )
  RETURNING id INTO v_id;

  INSERT INTO public.contract_dogs (contract_id, dog_id, organization_id)
  SELECT v_id, d, v_org FROM unnest(coalesce(p_dog_ids, '{}')) AS d;

  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.create_contract(jsonb, uuid[]) TO authenticated;

-- ── Slug reservado ─────────────────────────────────────────────────────────
-- /firmar/:token es la página pública de firma: ninguna org puede usar
-- "firmar" como URL (chocaría con /firmar/dashboard, etc.). Trigger aparte
-- para no redefinir create_organization (20260929000000_legal_consents).
CREATE OR REPLACE FUNCTION public.guard_contract_reserved_slug()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF lower(NEW.slug) = 'firmar' THEN
    RAISE EXCEPTION 'Ese URL está reservado, elige otro' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_contract_reserved_slug ON public.organizations;
CREATE TRIGGER guard_contract_reserved_slug
  BEFORE INSERT OR UPDATE OF slug ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.guard_contract_reserved_slug();
