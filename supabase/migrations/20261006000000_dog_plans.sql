-- ============================================================================
-- Planes de los perros (fase 2 del catálogo de servicios).
--
-- Un plan se asigna a UN perro a partir de un servicio del catálogo del centro
-- (Configuración → Servicios) y guarda una COPIA de cómo se vendió (nombre,
-- modalidad, duración/cantidad, precio, incluye, condiciones): si el centro
-- cambia el servicio mañana, los planes ya vendidos no cambian.
--
-- Modalidades:
--   duration → vigente entre start_date y end_date (ej. internado de 2 meses).
--   quantity → quantity_total unidades (clases, días…); quantity_used cuenta lo
--              usado. end_date es opcional (fecha límite para usarlas).
-- start_date puede ser pasada: así se cargan perros que ya estaban en el centro
-- con su plan en curso (y lo que ya usaron).
--
-- Acceso: cualquier miembro del centro VE los planes (el trabajador necesita
-- saber qué incluye el plan de cada perro); crearlos y editarlos es de quien
-- agenda o cobra.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dog_plans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  dog_id           uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  customer_id      uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  service_type     text NOT NULL,
  service_label    text NOT NULL,
  category         text,
  billing          text NOT NULL CHECK (billing IN ('duration', 'quantity')),
  start_date       date NOT NULL,
  end_date         date,
  quantity_total   integer CHECK (quantity_total IS NULL OR quantity_total > 0),
  quantity_used    integer NOT NULL DEFAULT 0 CHECK (quantity_used >= 0),
  unit_label       text,
  consumption      text CHECK (consumption IS NULL OR consumption IN ('per_day', 'per_visit')),
  price            numeric(12, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  includes         text[] NOT NULL DEFAULT '{}',
  conditions       text NOT NULL DEFAULT '',
  notes            text,
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished', 'cancelled')),
  ended_at         timestamptz,
  created_by       uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dog_plans_dates CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT dog_plans_duration_end CHECK (billing <> 'duration' OR end_date IS NOT NULL),
  CONSTRAINT dog_plans_quantity_total CHECK (billing <> 'quantity' OR quantity_total IS NOT NULL),
  CONSTRAINT dog_plans_quantity_used CHECK (quantity_total IS NULL OR quantity_used <= quantity_total)
);

CREATE INDEX IF NOT EXISTS idx_dog_plans_dog ON public.dog_plans (dog_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_dog_plans_org_status ON public.dog_plans (organization_id, status);

-- El dueño se toma del perro si no viene, y el perro debe ser de la misma org.
CREATE OR REPLACE FUNCTION public.dog_plans_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_org uuid; v_customer uuid;
BEGIN
  SELECT organization_id, customer_id INTO v_org, v_customer FROM public.dogs WHERE id = NEW.dog_id;
  IF v_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'El perro no pertenece a esta organización';
  END IF;
  IF NEW.customer_id IS NULL THEN NEW.customer_id := v_customer; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS dog_plans_before_write ON public.dog_plans;
CREATE TRIGGER dog_plans_before_write
  BEFORE INSERT OR UPDATE ON public.dog_plans
  FOR EACH ROW EXECUTE FUNCTION public.dog_plans_before_write();

ALTER TABLE public.dog_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dog_plans read" ON public.dog_plans;
CREATE POLICY "dog_plans read" ON public.dog_plans FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()));

DROP POLICY IF EXISTS "dog_plans write" ON public.dog_plans;
CREATE POLICY "dog_plans write" ON public.dog_plans FOR ALL TO authenticated
  USING (
    organization_id IN (SELECT public.get_scheduler_org_ids())
    OR organization_id IN (SELECT public.get_finance_writer_org_ids())
  )
  WITH CHECK (
    organization_id IN (SELECT public.get_scheduler_org_ids())
    OR organization_id IN (SELECT public.get_finance_writer_org_ids())
  );

-- ── Usos de un plan por cantidad ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dog_plan_usage (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         uuid NOT NULL REFERENCES public.dog_plans(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  used_on         date NOT NULL DEFAULT CURRENT_DATE,
  quantity        integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  note            text,
  reservation_id  uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  created_by      uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dog_plan_usage_plan ON public.dog_plan_usage (plan_id, used_on DESC);

ALTER TABLE public.dog_plan_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dog_plan_usage read" ON public.dog_plan_usage;
CREATE POLICY "dog_plan_usage read" ON public.dog_plan_usage FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()));
-- Escritura solo vía register_plan_usage (atómica con el contador).

-- Registra un uso y actualiza el contador en la misma transacción.
CREATE OR REPLACE FUNCTION public.register_plan_usage(
  p_plan_id  uuid,
  p_quantity integer DEFAULT 1,
  p_used_on  date DEFAULT NULL,
  p_note     text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan public.dog_plans;
BEGIN
  SELECT * INTO v_plan FROM public.dog_plans WHERE id = p_plan_id FOR UPDATE;
  IF v_plan.id IS NULL OR NOT (
    v_plan.organization_id IN (SELECT public.get_scheduler_org_ids())
    OR v_plan.organization_id IN (SELECT public.get_finance_writer_org_ids())
  ) THEN
    RAISE EXCEPTION 'Plan no encontrado o sin permiso';
  END IF;
  IF v_plan.billing <> 'quantity' THEN
    RAISE EXCEPTION 'Este plan es por duración: no lleva conteo de usos';
  END IF;
  IF v_plan.status <> 'active' THEN
    RAISE EXCEPTION 'El plan no está activo';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'La cantidad debe ser al menos 1';
  END IF;
  IF v_plan.quantity_used + p_quantity > v_plan.quantity_total THEN
    RAISE EXCEPTION 'Al plan solo le quedan % %', v_plan.quantity_total - v_plan.quantity_used, COALESCE(v_plan.unit_label, 'unidades');
  END IF;

  INSERT INTO public.dog_plan_usage (plan_id, organization_id, used_on, quantity, note)
  VALUES (p_plan_id, v_plan.organization_id, COALESCE(p_used_on, CURRENT_DATE), p_quantity, NULLIF(btrim(p_note), ''));

  UPDATE public.dog_plans SET quantity_used = quantity_used + p_quantity WHERE id = p_plan_id;

  RETURN v_plan.quantity_total - v_plan.quantity_used - p_quantity;
END $$;

REVOKE EXECUTE ON FUNCTION public.register_plan_usage(uuid, integer, date, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.register_plan_usage(uuid, integer, date, text) TO authenticated;
