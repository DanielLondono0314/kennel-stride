-- Permisos detallados por módulo.
--
-- Los 10 permisos gruesos (schedule, billing, clinical…) se reemplazan por un
-- catálogo de acciones y de visibilidad por módulo: por ejemplo, mover perros
-- entre perreras ya no exige poder hacer check-in/check-out, y aprobar
-- solicitudes es distinto de cancelar reservas.
--
-- Conversión: cada rol recibe exactamente los permisos detallados que
-- equivalen a lo que podía hacer antes (nadie gana ni pierde acceso). Los
-- permisos de visibilidad se dan a quien ya veía esa información: Oficina y
-- Administrador todo; Personal operativo el contacto del cliente y la salud del
-- perro, que era lo que mostraba su app.
--
-- Dónde se aplica cada permiso:
--   · RLS de cada tabla, con get_org_ids_with_permission('<key>').
--   · Triggers de guarda (reservas, facturas, perreras) para las acciones que
--     son cambios de columnas de la misma fila: aprobar, cancelar, cobrar,
--     anular, asignar perrera… Solo revisan escrituras directas desde la app
--     (current_user = authenticated): las RPC SECURITY DEFINER corren como su
--     dueño y validan su propio permiso.
--   · Cada RPC, con el permiso de su acción.
-- Los de visibilidad que son de una tabla entera (facturas, historia clínica)
-- se aplican en la RLS de lectura; los de un campo (precios, contacto,
-- ingresos) los aplica la interfaz.

-- ── 1. Catálogo ─────────────────────────────────────────────────────────────
ALTER TABLE public.org_roles DROP CONSTRAINT IF EXISTS org_roles_permissions_valid;

CREATE OR REPLACE FUNCTION public.org_permission_catalog()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    -- Reservas y estadías
    'reservations.view_all', 'reservations.create', 'reservations.edit',
    'reservations.approve', 'reservations.cancel', 'reservations.delete',
    'stays.checkin', 'stays.checkout',
    -- Instalaciones
    'kennels.move', 'kennels.assign', 'facility.manage',
    -- Tareas y rutas
    'tasks.view_all', 'tasks.create', 'tasks.edit', 'tasks.delete', 'routes.manage',
    -- Clientes
    'customers.view_contact', 'customers.create', 'customers.edit', 'customers.delete',
    -- Perros
    'dogs.create', 'dogs.edit', 'dogs.delete',
    -- Salud y bienestar
    'clinical.view', 'clinical.edit', 'clinical.import',
    'weight.record', 'weight.edit', 'welfare.configure',
    -- Report cards
    'report_cards.write',
    -- Planes y paquetes
    'plans.sell', 'plans.use', 'packages.manage',
    -- Facturación
    'prices.view', 'invoices.view', 'invoices.create', 'invoices.payment', 'invoices.cancel',
    -- Contratos
    'contracts.view', 'contracts.create',
    -- Comunicación y análisis
    'campaigns.send', 'reports.view', 'finance.view_income'
  ]::text[];
$$;

-- Permisos que necesitan otro para tener sentido (no se puede editar una
-- reserva que no se ve). El editor de roles y el trigger los agregan solos.
CREATE OR REPLACE FUNCTION public.org_permission_implied(p_perms text[])
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  WITH RECURSIVE m(k, i) AS (VALUES
      ('reservations.create', 'reservations.view_all'), ('reservations.edit', 'reservations.view_all'),
      ('reservations.approve', 'reservations.view_all'), ('reservations.cancel', 'reservations.view_all'),
      ('reservations.delete', 'reservations.view_all'), ('stays.checkin', 'reservations.view_all'),
      ('stays.checkout', 'reservations.view_all'),
      ('reservations.create', 'prices.view'), ('reservations.edit', 'prices.view'),
      ('tasks.create', 'tasks.view_all'), ('tasks.edit', 'tasks.view_all'), ('tasks.delete', 'tasks.view_all'),
      ('customers.create', 'customers.view_contact'), ('customers.edit', 'customers.view_contact'),
      ('clinical.edit', 'clinical.view'), ('clinical.import', 'clinical.view'),
      ('plans.sell', 'prices.view'), ('packages.manage', 'prices.view'),
      ('invoices.create', 'invoices.view'), ('invoices.payment', 'invoices.view'),
      ('invoices.cancel', 'invoices.view'), ('invoices.view', 'prices.view'),
      ('finance.view_income', 'prices.view'),
      ('contracts.create', 'contracts.view')
    ),
  closure(p) AS (
    SELECT unnest(p_perms)
    UNION
    SELECT m.i FROM closure c JOIN m ON m.k = c.p
  )
  SELECT ARRAY(SELECT p FROM closure);
$$;

-- Especialidades que ya daban permisos sin importar el rol (se conserva).
CREATE OR REPLACE FUNCTION public.org_specialty_permissions(p_specialty text)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_specialty
    WHEN 'vet'     THEN ARRAY['clinical.view', 'clinical.edit', 'clinical.import', 'weight.edit', 'welfare.configure']
    WHEN 'trainer' THEN ARRAY['report_cards.write']
    ELSE '{}'::text[]
  END;
$$;

-- ── 2. Conversión de los roles existentes ──────────────────────────────────
-- (El trigger org_roles_guard los ordena y completa con los implícitos.)
UPDATE public.org_roles r SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(
     CASE WHEN 'schedule' = ANY(r.permissions) THEN ARRAY[
       'reservations.view_all', 'reservations.create', 'reservations.edit', 'reservations.approve',
       'reservations.cancel', 'reservations.delete', 'stays.checkin', 'stays.checkout',
       'kennels.move', 'kennels.assign', 'facility.manage',
       'tasks.view_all', 'tasks.create', 'tasks.edit', 'tasks.delete', 'routes.manage',
       'customers.create', 'customers.edit', 'dogs.create', 'dogs.edit',
       'plans.sell', 'plans.use', 'contracts.view', 'contracts.create'] ELSE '{}' END
  || CASE WHEN 'billing' = ANY(r.permissions) THEN ARRAY[
       'customers.create', 'customers.edit', 'plans.sell', 'plans.use',
       'packages.manage', 'invoices.create', 'invoices.payment', 'contracts.view', 'contracts.create'] ELSE '{}' END
  || CASE WHEN 'cancel_invoice' = ANY(r.permissions) THEN ARRAY['invoices.cancel'] ELSE '{}' END
  || CASE WHEN 'clinical' = ANY(r.permissions) THEN ARRAY[
       'dogs.create', 'dogs.edit', 'clinical.edit', 'clinical.import', 'weight.record',
       'weight.edit', 'welfare.configure'] ELSE '{}' END
  || CASE WHEN 'report_cards' = ANY(r.permissions) THEN ARRAY['report_cards.write'] ELSE '{}' END
  || CASE WHEN 'delete_records' = ANY(r.permissions) THEN ARRAY['customers.delete', 'dogs.delete'] ELSE '{}' END
  || CASE WHEN 'view_reports' = ANY(r.permissions) THEN ARRAY['reports.view'] ELSE '{}' END
  || CASE WHEN 'send_campaign' = ANY(r.permissions) THEN ARRAY['campaigns.send'] ELSE '{}' END
  || CASE WHEN 'manage_facility' = ANY(r.permissions) THEN ARRAY['facility.manage', 'kennels.assign', 'kennels.move'] ELSE '{}' END
  || CASE WHEN 'record_weight' = ANY(r.permissions) THEN ARRAY['weight.record'] ELSE '{}' END
  || CASE WHEN r.access_type = 'worker'
          THEN ARRAY['clinical.view', 'customers.view_contact']
          ELSE ARRAY['clinical.view', 'customers.view_contact', 'prices.view', 'invoices.view', 'finance.view_income'] END
) p);

UPDATE public.org_roles SET permissions = public.org_permission_catalog() WHERE access_type = 'admin';

ALTER TABLE public.org_roles
  ADD CONSTRAINT org_roles_permissions_valid CHECK (permissions <@ public.org_permission_catalog());

-- ── 3. Reglas de edición de roles: además, completar los implícitos ────────
CREATE OR REPLACE FUNCTION public.guard_org_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Borrado en cascada de la organización: no aplicar reglas.
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = OLD.organization_id) THEN
      RETURN OLD;
    END IF;
    IF OLD.is_system THEN
      RAISE EXCEPTION 'Los roles predeterminados no se pueden eliminar (puedes renombrarlos)';
    END IF;
    IF EXISTS (SELECT 1 FROM public.organization_members WHERE role_id = OLD.id)
       OR EXISTS (SELECT 1 FROM public.staff_members WHERE role_id = OLD.id)
       OR EXISTS (SELECT 1 FROM public.organization_invitations
                  WHERE role_id = OLD.id AND accepted_at IS NULL) THEN
      RAISE EXCEPTION 'Este rol está asignado a personas o invitaciones. Reasígnalas antes de eliminarlo';
    END IF;
    RETURN OLD;
  END IF;

  IF NOT (NEW.permissions <@ public.org_permission_catalog()) THEN
    RAISE EXCEPTION 'Permiso desconocido en el rol';
  END IF;
  NEW.name := btrim(NEW.name);
  NEW.updated_at := now();
  -- Permisos únicos, con sus implícitos y ordenados según el catálogo.
  NEW.permissions := ARRAY(
    SELECT p FROM unnest(public.org_permission_catalog()) WITH ORDINALITY AS c(p, i)
    WHERE p = ANY(public.org_permission_implied(NEW.permissions)) ORDER BY i
  );

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF NEW.organization_id <> OLD.organization_id
     OR NEW.is_system <> OLD.is_system
     OR NEW.system_key IS DISTINCT FROM OLD.system_key THEN
    RAISE EXCEPTION 'Cambio de rol no permitido';
  END IF;
  IF OLD.is_system AND NEW.access_type <> OLD.access_type THEN
    RAISE EXCEPTION 'No se puede cambiar el tipo de acceso de un rol predeterminado';
  END IF;
  IF OLD.system_key = 'admin' THEN
    NEW.permissions := public.org_permission_catalog();
  END IF;
  RETURN NEW;
END;
$$;

-- ── 4. Roles de sistema de las organizaciones nuevas ───────────────────────
CREATE OR REPLACE FUNCTION public.seed_org_system_roles(p_org uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.org_roles (organization_id, name, access_type, permissions, is_system, system_key)
  VALUES
    (p_org, 'Administrador', 'admin', public.org_permission_catalog(), true, 'admin'),
    (p_org, 'Gerente', 'panel', public.org_permission_catalog(), true, 'manager'),
    (p_org, 'Recepción', 'panel', ARRAY[
      'reservations.view_all', 'reservations.create', 'reservations.edit', 'reservations.approve',
      'reservations.cancel', 'reservations.delete', 'stays.checkin', 'stays.checkout',
      'kennels.move', 'kennels.assign', 'facility.manage',
      'tasks.view_all', 'tasks.create', 'tasks.edit', 'tasks.delete', 'routes.manage',
      'customers.view_contact', 'customers.create', 'customers.edit', 'dogs.create', 'dogs.edit',
      'clinical.view', 'weight.record', 'plans.sell', 'plans.use', 'packages.manage',
      'prices.view', 'invoices.view', 'invoices.create', 'invoices.payment',
      'contracts.view', 'contracts.create', 'finance.view_income'], true, 'front_desk'),
    (p_org, 'Trabajador', 'worker', ARRAY['customers.view_contact', 'clinical.view', 'weight.record'], true, 'worker')
  ON CONFLICT (organization_id, system_key) WHERE system_key IS NOT NULL DO NOTHING;
$$;
REVOKE EXECUTE ON FUNCTION public.seed_org_system_roles(uuid) FROM PUBLIC, anon, authenticated;

-- ── 5. Funciones de capacidad ──────────────────────────────────────────────
-- Orgs (activas o en prueba) donde el usuario tiene ALGUNO de los permisos:
-- por su rol (admin = todos) o por su especialidad.
CREATE OR REPLACE FUNCTION public.get_org_ids_with_any_permission(p_perms text[])
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT om.organization_id
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  JOIN public.org_roles r     ON r.id = om.role_id
  WHERE om.user_id = auth.uid()
    AND (o.subscription_status = 'active'
         OR (o.subscription_status = 'trialing' AND o.trial_ends_at > now()))
    AND (r.access_type = 'admin'
         OR r.permissions && p_perms
         OR EXISTS (
           SELECT 1 FROM public.staff_members sm
           WHERE sm.profile_id = auth.uid()
             AND sm.organization_id = om.organization_id
             AND public.org_specialty_permissions(sm.specialty::text) && p_perms));
$$;

CREATE OR REPLACE FUNCTION public.get_org_ids_with_permission(p_perm text)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_org_ids_with_any_permission(ARRAY[p_perm]);
$$;

GRANT EXECUTE ON FUNCTION public.get_org_ids_with_any_permission(text[]) TO authenticated;

-- Qué permiso exige pasar una reserva de un estado a otro.
CREATE OR REPLACE FUNCTION public.reservation_status_permission(p_from text, p_to text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_from = 'requested' AND p_to IN ('scheduled', 'cancelled', 'rejected') THEN 'reservations.approve'
    WHEN p_to = 'rejected'                         THEN 'reservations.approve'
    WHEN p_to IN ('cancelled', 'no_show')          THEN 'reservations.cancel'
    WHEN p_to IN ('checked_in', 'in_progress')     THEN 'stays.checkin'
    WHEN p_to IN ('ready', 'completed')            THEN 'stays.checkout'
    ELSE 'reservations.edit'
  END;
$$;

-- ── 6. RLS por tabla ───────────────────────────────────────────────────────
-- Atajo de lectura para este bloque: perm('x') = organization_id IN
-- (SELECT public.get_org_ids_with_permission('x')).

-- Reservas: ver todas, o solo las asignadas a mí.
DROP POLICY IF EXISTS "reservations read"   ON public.reservations;
DROP POLICY IF EXISTS "reservations insert" ON public.reservations;
DROP POLICY IF EXISTS "reservations update" ON public.reservations;
DROP POLICY IF EXISTS "reservations delete" ON public.reservations;
CREATE POLICY "reservations read" ON public.reservations FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_org_ids_with_permission('reservations.view_all'))
      OR staff_id IN (SELECT public.get_my_staff_ids()));
CREATE POLICY "reservations insert" ON public.reservations FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('reservations.create')));
-- Quién puede tocar una reserva; qué columnas/estados, lo decide guard_reservation_update.
CREATE POLICY "reservations update" ON public.reservations FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.get_org_ids_with_any_permission(ARRAY[
           'reservations.create', 'reservations.edit', 'reservations.approve', 'reservations.cancel',
           'stays.checkin', 'stays.checkout']))
      OR staff_id IN (SELECT public.get_my_staff_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_any_permission(ARRAY[
           'reservations.create', 'reservations.edit', 'reservations.approve', 'reservations.cancel',
           'stays.checkin', 'stays.checkout']))
      OR (staff_id IN (SELECT public.get_my_staff_ids())
          AND organization_id IN (SELECT public.get_user_org_ids())));
CREATE POLICY "reservations delete" ON public.reservations FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.get_org_ids_with_permission('reservations.delete')));

-- Tareas: ver todas, o solo las asignadas a mí (y completarlas).
DROP POLICY IF EXISTS "tasks read"   ON public.tasks;
DROP POLICY IF EXISTS "tasks insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks update" ON public.tasks;
DROP POLICY IF EXISTS "tasks delete" ON public.tasks;
CREATE POLICY "tasks read" ON public.tasks FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_org_ids_with_permission('tasks.view_all'))
      OR assignee_staff_id IN (SELECT public.get_my_staff_ids()));
CREATE POLICY "tasks insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('tasks.create')));
CREATE POLICY "tasks update" ON public.tasks FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.get_org_ids_with_permission('tasks.edit'))
      OR assignee_staff_id IN (SELECT public.get_my_staff_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('tasks.edit'))
      OR (assignee_staff_id IN (SELECT public.get_my_staff_ids())
          AND organization_id IN (SELECT public.get_user_org_ids())));
CREATE POLICY "tasks delete" ON public.tasks FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.get_org_ids_with_permission('tasks.delete')));

DROP POLICY IF EXISTS "welfare_check_entries write" ON public.welfare_check_entries;
CREATE POLICY "welfare_check_entries write" ON public.welfare_check_entries FOR ALL TO authenticated
  USING (task_id IN (SELECT t.id FROM public.tasks t
                     WHERE t.organization_id IN (SELECT public.get_org_ids_with_permission('tasks.edit'))
                        OR t.assignee_staff_id IN (SELECT public.get_my_staff_ids())))
  WITH CHECK (task_id IN (SELECT t.id FROM public.tasks t
                     WHERE t.organization_id IN (SELECT public.get_org_ids_with_permission('tasks.edit'))
                        OR t.assignee_staff_id IN (SELECT public.get_my_staff_ids())));

DROP POLICY IF EXISTS "welfare_check_items write" ON public.welfare_check_items;
CREATE POLICY "welfare_check_items write" ON public.welfare_check_items FOR ALL TO authenticated
  USING      (organization_id IN (SELECT public.get_org_ids_with_permission('welfare.configure')))
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('welfare.configure')));

DROP POLICY IF EXISTS "route_stops write" ON public.route_stops;
CREATE POLICY "route_stops write" ON public.route_stops FOR ALL TO authenticated
  USING (task_id IN (SELECT t.id FROM public.tasks t
                     WHERE t.organization_id IN (SELECT public.get_org_ids_with_permission('routes.manage'))))
  WITH CHECK (task_id IN (SELECT t.id FROM public.tasks t
                     WHERE t.organization_id IN (SELECT public.get_org_ids_with_permission('routes.manage'))));

-- Perreras y zonas: crear, renombrar, mover y borrar es configurar
-- (facility.manage); ocupar, liberar o marcar mantenimiento es operar
-- (kennels.assign), lo separa guard_facility_unit_update.
DROP POLICY IF EXISTS "facility_zones write" ON public.facility_zones;
CREATE POLICY "facility_zones write" ON public.facility_zones FOR ALL TO authenticated
  USING      (organization_id IN (SELECT public.get_org_ids_with_permission('facility.manage')))
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('facility.manage')));

DROP POLICY IF EXISTS "facility_units write"  ON public.facility_units;
DROP POLICY IF EXISTS "facility_units insert" ON public.facility_units;
DROP POLICY IF EXISTS "facility_units update" ON public.facility_units;
DROP POLICY IF EXISTS "facility_units delete" ON public.facility_units;
CREATE POLICY "facility_units insert" ON public.facility_units FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('facility.manage')));
CREATE POLICY "facility_units update" ON public.facility_units FOR UPDATE TO authenticated
  USING      (organization_id IN (SELECT public.get_org_ids_with_any_permission(ARRAY['facility.manage', 'kennels.assign'])))
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_any_permission(ARRAY['facility.manage', 'kennels.assign'])));
CREATE POLICY "facility_units delete" ON public.facility_units FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.get_org_ids_with_permission('facility.manage')));

-- Clientes
DROP POLICY IF EXISTS "customers insert" ON public.customers;
DROP POLICY IF EXISTS "customers update" ON public.customers;
DROP POLICY IF EXISTS "customers delete" ON public.customers;
CREATE POLICY "customers insert" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('customers.create')));
CREATE POLICY "customers update" ON public.customers FOR UPDATE TO authenticated
  USING      (organization_id IN (SELECT public.get_org_ids_with_permission('customers.edit')))
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('customers.edit')));
CREATE POLICY "customers delete" ON public.customers FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.get_org_ids_with_permission('customers.delete')));

-- Perros
DROP POLICY IF EXISTS "dogs insert" ON public.dogs;
DROP POLICY IF EXISTS "dogs update" ON public.dogs;
DROP POLICY IF EXISTS "dogs delete" ON public.dogs;
CREATE POLICY "dogs insert" ON public.dogs FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('dogs.create')));
CREATE POLICY "dogs update" ON public.dogs FOR UPDATE TO authenticated
  USING      (organization_id IN (SELECT public.get_org_ids_with_permission('dogs.edit')))
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('dogs.edit')));
CREATE POLICY "dogs delete" ON public.dogs FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.get_org_ids_with_permission('dogs.delete')));

-- Ficha del perro: alergias, medicación y temperamento.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['dog_allergies', 'dog_medications', 'dog_temperament'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' write', t);
    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR ALL TO authenticated
        USING      (organization_id IN (SELECT public.get_org_ids_with_any_permission(ARRAY['dogs.edit', 'clinical.edit'])))
        WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_any_permission(ARRAY['dogs.edit', 'clinical.edit'])))
    $p$, t || ' write', t);
  END LOOP;
END $$;

-- Historia clínica: verla es un permiso aparte. Las condiciones médicas se
-- siguen viendo con solo ser miembro (las necesita quien cuida al perro).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['medical_history', 'vaccination_schedule', 'deworming_records'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' read', t);
    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
        USING (organization_id IN (SELECT public.get_org_ids_with_permission('clinical.view')))
    $p$, t || ' read', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['medical_history', 'vaccination_schedule', 'deworming_records', 'medical_conditions'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' write', t);
    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR ALL TO authenticated
        USING      (organization_id IN (SELECT public.get_org_ids_with_permission('clinical.edit')))
        WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('clinical.edit')))
    $p$, t || ' write', t);
  END LOOP;
END $$;

-- Pesos
DROP POLICY IF EXISTS "dog_weight_logs insert" ON public.dog_weight_logs;
DROP POLICY IF EXISTS "dog_weight_logs update" ON public.dog_weight_logs;
DROP POLICY IF EXISTS "dog_weight_logs delete" ON public.dog_weight_logs;
CREATE POLICY "dog_weight_logs insert" ON public.dog_weight_logs FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('weight.record')));
CREATE POLICY "dog_weight_logs update" ON public.dog_weight_logs FOR UPDATE TO authenticated
  USING      (organization_id IN (SELECT public.get_org_ids_with_permission('weight.edit')))
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('weight.edit')));
CREATE POLICY "dog_weight_logs delete" ON public.dog_weight_logs FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.get_org_ids_with_permission('weight.edit')));

-- Report cards
DROP POLICY IF EXISTS "report_cards write" ON public.report_cards;
CREATE POLICY "report_cards write" ON public.report_cards FOR ALL TO authenticated
  USING      (organization_id IN (SELECT public.get_org_ids_with_permission('report_cards.write')))
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('report_cards.write')));

-- Planes y paquetes
DROP POLICY IF EXISTS "dog_plans write" ON public.dog_plans;
CREATE POLICY "dog_plans write" ON public.dog_plans FOR ALL TO authenticated
  USING      (organization_id IN (SELECT public.get_org_ids_with_permission('plans.sell')))
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('plans.sell')));

DROP POLICY IF EXISTS "packages write" ON public.packages;
CREATE POLICY "packages write" ON public.packages FOR ALL TO authenticated
  USING      (organization_id IN (SELECT public.get_org_ids_with_permission('packages.manage')))
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('packages.manage')));

-- Facturas: verlas es un permiso; crear, cobrar y anular los separa
-- guard_invoice_write. Borrar una factura equivale a anularla.
DROP POLICY IF EXISTS "invoices read"   ON public.invoices;
DROP POLICY IF EXISTS "invoices write"  ON public.invoices;
DROP POLICY IF EXISTS "invoices insert" ON public.invoices;
DROP POLICY IF EXISTS "invoices update" ON public.invoices;
DROP POLICY IF EXISTS "invoices delete" ON public.invoices;
CREATE POLICY "invoices read" ON public.invoices FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_org_ids_with_permission('invoices.view')));
CREATE POLICY "invoices insert" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('invoices.create')));
CREATE POLICY "invoices update" ON public.invoices FOR UPDATE TO authenticated
  USING      (organization_id IN (SELECT public.get_org_ids_with_any_permission(ARRAY['invoices.create', 'invoices.payment', 'invoices.cancel'])))
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_any_permission(ARRAY['invoices.create', 'invoices.payment', 'invoices.cancel'])));
CREATE POLICY "invoices delete" ON public.invoices FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.get_org_ids_with_permission('invoices.cancel')));

DROP POLICY IF EXISTS "invoice_items read"  ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items write" ON public.invoice_items;
CREATE POLICY "invoice_items read" ON public.invoice_items FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_org_ids_with_permission('invoices.view')));
CREATE POLICY "invoice_items write" ON public.invoice_items FOR ALL TO authenticated
  USING      (organization_id IN (SELECT public.get_org_ids_with_permission('invoices.create')))
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('invoices.create')));

-- Contratos (las plantillas siguen siendo solo del administrador).
DROP POLICY IF EXISTS "contracts read"   ON public.contracts;
DROP POLICY IF EXISTS "contracts insert" ON public.contracts;
DROP POLICY IF EXISTS "contracts update" ON public.contracts;
CREATE POLICY "contracts read" ON public.contracts FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_org_ids_with_permission('contracts.view')));
CREATE POLICY "contracts insert" ON public.contracts FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('contracts.create')));
CREATE POLICY "contracts update" ON public.contracts FOR UPDATE TO authenticated
  USING      (organization_id IN (SELECT public.get_org_ids_with_permission('contracts.create')))
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('contracts.create')));

DROP POLICY IF EXISTS "contract_dogs read"   ON public.contract_dogs;
DROP POLICY IF EXISTS "contract_dogs insert" ON public.contract_dogs;
CREATE POLICY "contract_dogs read" ON public.contract_dogs FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_org_ids_with_permission('contracts.view')));
CREATE POLICY "contract_dogs insert" ON public.contract_dogs FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('contracts.create')));

DROP POLICY IF EXISTS "contract_templates read" ON public.contract_templates;
CREATE POLICY "contract_templates read" ON public.contract_templates FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_org_ids_with_permission('contracts.view')));

-- Campañas
DROP POLICY IF EXISTS "campaigns write" ON public.campaigns;
CREATE POLICY "campaigns write" ON public.campaigns FOR ALL TO authenticated
  USING      (organization_id IN (SELECT public.get_org_ids_with_permission('campaigns.send')))
  WITH CHECK (organization_id IN (SELECT public.get_org_ids_with_permission('campaigns.send')));

-- ── 7. Guardas por acción ──────────────────────────────────────────────────
-- SECURITY INVOKER a propósito: así current_user distingue una escritura
-- directa desde la app ('authenticated') de una hecha dentro de una RPC
-- SECURITY DEFINER (corre como su dueño y ya validó su permiso).

-- Reservas: cada cambio exige el permiso de esa acción. El encargado asignado
-- puede avanzar el estado de su servicio (en curso, listo, completado).
DROP TRIGGER IF EXISTS guard_reservation_worker_update ON public.reservations;
DROP FUNCTION IF EXISTS public.guard_reservation_worker_update();

CREATE OR REPLACE FUNCTION public.guard_reservation_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_org uuid := OLD.organization_id;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF (NEW.customer_id     IS DISTINCT FROM OLD.customer_id
   OR NEW.dog_id          IS DISTINCT FROM OLD.dog_id
   OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
   OR NEW.service_type    IS DISTINCT FROM OLD.service_type
   OR NEW.service_name    IS DISTINCT FROM OLD.service_name
   OR NEW.start_date      IS DISTINCT FROM OLD.start_date
   OR NEW.end_date        IS DISTINCT FROM OLD.end_date
   OR NEW.total_price     IS DISTINCT FROM OLD.total_price
   OR NEW.location_id     IS DISTINCT FROM OLD.location_id)
     AND NOT public.has_org_permission(v_org, 'reservations.edit') THEN
    RAISE EXCEPTION 'No tienes permiso para editar reservas';
  END IF;

  -- Recogida y entrega se marcan también al crear la reserva.
  IF (NEW.pickup_requested  IS DISTINCT FROM OLD.pickup_requested
   OR NEW.dropoff_requested IS DISTINCT FROM OLD.dropoff_requested)
     AND NOT (public.has_org_permission(v_org, 'reservations.edit')
              OR public.has_org_permission(v_org, 'reservations.create')) THEN
    RAISE EXCEPTION 'No tienes permiso para editar reservas';
  END IF;

  -- Al aprobar una solicitud se puede elegir el encargado.
  IF NEW.staff_id IS DISTINCT FROM OLD.staff_id
     AND NOT public.has_org_permission(v_org, 'reservations.edit')
     AND NOT (OLD.status = 'requested' AND NEW.status = 'scheduled'
              AND public.has_org_permission(v_org, 'reservations.approve')) THEN
    RAISE EXCEPTION 'No tienes permiso para cambiar el encargado de la reserva';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT public.has_org_permission(v_org, public.reservation_status_permission(OLD.status, NEW.status))
     AND NOT (COALESCE(OLD.staff_id IN (SELECT public.get_my_staff_ids()), false)
              AND NEW.status IN ('in_progress', 'ready', 'completed')) THEN
    RAISE EXCEPTION 'No tienes permiso para cambiar la reserva a ese estado';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_reservation_update ON public.reservations;
CREATE TRIGGER guard_reservation_update
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.guard_reservation_update();

-- Facturas: crear/editar, registrar pagos y anular son permisos distintos.
CREATE OR REPLACE FUNCTION public.guard_invoice_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_org uuid := COALESCE(NEW.organization_id, OLD.organization_id);
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT public.has_org_permission(v_org, 'invoices.create') THEN
      RAISE EXCEPTION 'No tienes permiso para crear facturas';
    END IF;
    -- Una factura que nace pagada también registra un pago.
    IF NEW.status = 'paid' AND NOT public.has_org_permission(v_org, 'invoices.payment') THEN
      RAISE EXCEPTION 'No tienes permiso para registrar pagos';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF NOT public.has_org_permission(v_org, 'invoices.cancel') THEN
      RAISE EXCEPTION 'No tienes permiso para anular facturas';
    END IF;
    RETURN OLD;
  END IF;

  IF (NEW.invoice_number  IS DISTINCT FROM OLD.invoice_number
   OR NEW.customer_id     IS DISTINCT FROM OLD.customer_id
   OR NEW.reservation_id  IS DISTINCT FROM OLD.reservation_id
   OR NEW.subtotal        IS DISTINCT FROM OLD.subtotal
   OR NEW.tax             IS DISTINCT FROM OLD.tax
   OR NEW.discount        IS DISTINCT FROM OLD.discount
   OR NEW.total           IS DISTINCT FROM OLD.total
   OR NEW.due_date        IS DISTINCT FROM OLD.due_date
   OR NEW.ls_order_id     IS DISTINCT FROM OLD.ls_order_id
   OR NEW.ls_payment_id   IS DISTINCT FROM OLD.ls_payment_id
   OR NEW.organization_id IS DISTINCT FROM OLD.organization_id)
     AND NOT public.has_org_permission(v_org, 'invoices.create') THEN
    RAISE EXCEPTION 'No tienes permiso para editar facturas';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'cancelled' THEN
    IF NOT public.has_org_permission(v_org, 'invoices.cancel') THEN
      RAISE EXCEPTION 'No tienes permiso para anular facturas';
    END IF;
  ELSIF (NEW.status IS DISTINCT FROM OLD.status
      OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
      OR NEW.paid_at IS DISTINCT FROM OLD.paid_at)
     AND NOT public.has_org_permission(v_org, 'invoices.payment') THEN
    RAISE EXCEPTION 'No tienes permiso para registrar pagos';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_invoice_write ON public.invoices;
CREATE TRIGGER guard_invoice_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_write();

-- Perreras: cambiar nombre, zona, tipo u orden es configurar. Ocupar, liberar,
-- mantenimiento y notas lo puede hacer quien pasa la RLS (kennels.assign o
-- facility.manage).
CREATE OR REPLACE FUNCTION public.guard_facility_unit_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF (NEW.name            IS DISTINCT FROM OLD.name
   OR NEW.zone_id         IS DISTINCT FROM OLD.zone_id
   OR NEW.unit_type       IS DISTINCT FROM OLD.unit_type
   OR NEW.position_index  IS DISTINCT FROM OLD.position_index
   OR NEW.organization_id IS DISTINCT FROM OLD.organization_id)
     AND NOT public.has_org_permission(OLD.organization_id, 'facility.manage') THEN
    RAISE EXCEPTION 'No tienes permiso para configurar perreras';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_facility_unit_update ON public.facility_units;
CREATE TRIGGER guard_facility_unit_update
  BEFORE UPDATE ON public.facility_units
  FOR EACH ROW EXECUTE FUNCTION public.guard_facility_unit_update();

-- ── 8. RPC: cada una exige el permiso de su acción ─────────────────────────
-- (Mismo cuerpo que la versión anterior; solo cambia la validación.)

-- complete_checkout
CREATE OR REPLACE FUNCTION public.complete_checkout(p_reservation_id uuid, p_payment_method text, p_package_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT ''::text, p_plan_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_res        record;
  v_plan       public.dog_plans;
  v_invoice_id uuid;
  v_units      integer;
  v_now        timestamptz := now();
  v_today      date;
  v_tz         text;
BEGIN
  SELECT r.id, r.organization_id, r.customer_id, r.dog_id, r.service_name, r.total_price,
         r.start_date, r.check_in_time
    INTO v_res
  FROM public.reservations r
  WHERE r.id = p_reservation_id
    AND r.organization_id IN (SELECT public.get_org_ids_with_permission('stays.checkout'))
    AND r.status IN ('checked_in', 'in_progress', 'ready')
  FOR UPDATE;

  IF v_res.id IS NULL THEN
    RAISE EXCEPTION 'Reserva inválida, fuera de tu organización, no está en curso o no tienes permiso para hacer check-out';
  END IF;

  -- Descontar de un plan es usar el plan; cualquier otro método es cobrar.
  IF p_payment_method = 'plan' THEN
    IF NOT public.has_org_permission(v_res.organization_id, 'plans.use') THEN
      RAISE EXCEPTION 'No tienes permiso para descontar servicios de un plan';
    END IF;
  ELSIF NOT public.has_org_permission(v_res.organization_id, 'invoices.create') THEN
    RAISE EXCEPTION 'No tienes permiso para cobrar';
  END IF;

  IF p_payment_method = 'plan' THEN
    IF p_plan_id IS NULL THEN
      RAISE EXCEPTION 'Falta el plan con el que se cubre el servicio';
    END IF;
    SELECT * INTO v_plan FROM public.dog_plans
     WHERE id = p_plan_id AND organization_id = v_res.organization_id
     FOR UPDATE;
    IF v_plan.id IS NULL OR v_plan.dog_id IS DISTINCT FROM v_res.dog_id THEN
      RAISE EXCEPTION 'El plan no es de este perro';
    END IF;
    IF v_plan.status <> 'active' THEN
      RAISE EXCEPTION 'El plan no está vigente';
    END IF;

    SELECT COALESCE(NULLIF(o.timezone, ''), 'America/Bogota') INTO v_tz
      FROM public.organizations o WHERE o.id = v_res.organization_id;
    v_today := (v_now AT TIME ZONE v_tz)::date;

    IF v_plan.start_date > v_today THEN
      RAISE EXCEPTION 'El plan empieza el %: todavía no cubre servicios', to_char(v_plan.start_date, 'DD/MM/YYYY');
    END IF;
    IF v_plan.end_date IS NOT NULL AND v_plan.end_date < (v_res.start_date AT TIME ZONE v_tz)::date THEN
      RAISE EXCEPTION 'El plan venció el % , antes de esta reserva', to_char(v_plan.end_date, 'DD/MM/YYYY');
    END IF;

    IF v_plan.billing = 'quantity' THEN
      v_units := CASE
        WHEN v_plan.consumption = 'per_day' THEN
          GREATEST(1, v_today - (COALESCE(v_res.check_in_time, v_res.start_date) AT TIME ZONE v_tz)::date + 1)
        ELSE 1
      END;
      IF v_plan.quantity_used + v_units > v_plan.quantity_total THEN
        RAISE EXCEPTION 'Al plan solo le quedan % % y esta estadía usa %. Cobra con otro método o renueva el plan.',
          v_plan.quantity_total - v_plan.quantity_used, COALESCE(v_plan.unit_label, 'unidades'), v_units;
      END IF;

      INSERT INTO public.dog_plan_usage (plan_id, organization_id, used_on, quantity, note, reservation_id, created_by)
      VALUES (v_plan.id, v_plan.organization_id, v_today, v_units,
              'Check-out · ' || COALESCE(v_res.service_name, 'Servicio'), v_res.id, auth.uid());

      UPDATE public.dog_plans SET quantity_used = quantity_used + v_units WHERE id = v_plan.id;
    END IF;

  ELSIF p_payment_method = 'package' THEN
    IF p_package_id IS NULL THEN
      RAISE EXCEPTION 'Falta el paquete para cobrar con créditos';
    END IF;
    PERFORM 1 FROM public.packages p
     WHERE p.id = p_package_id
       AND p.organization_id = v_res.organization_id
       AND p.customer_id = v_res.customer_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'El paquete no pertenece a este cliente';
    END IF;
    PERFORM public.deduct_package_credit(p_package_id, 'check-out');

  ELSIF p_payment_method IN ('cash', 'card') THEN
    INSERT INTO public.invoices
      (customer_id, reservation_id, status, subtotal, discount, tax, total,
       payment_method, paid_at, due_date, notes, organization_id)
    VALUES
      (v_res.customer_id, v_res.id, 'paid', v_res.total_price, 0, 0, v_res.total_price,
       p_payment_method, v_now, v_now, NULLIF(btrim(p_notes), ''), v_res.organization_id)
    RETURNING id INTO v_invoice_id;

    INSERT INTO public.invoice_items
      (invoice_id, description, quantity, unit_price, total, organization_id)
    VALUES
      (v_invoice_id, COALESCE(v_res.service_name, 'Servicio'), 1,
       v_res.total_price, v_res.total_price, v_res.organization_id);

  ELSIF p_payment_method = 'invoice' THEN
    INSERT INTO public.invoices
      (customer_id, reservation_id, status, subtotal, discount, tax, total,
       due_date, notes, organization_id)
    VALUES
      (v_res.customer_id, v_res.id, 'pending', v_res.total_price, 0, 0, v_res.total_price,
       v_now + interval '30 days', NULLIF(btrim(p_notes), ''), v_res.organization_id)
    RETURNING id INTO v_invoice_id;

    INSERT INTO public.invoice_items
      (invoice_id, description, quantity, unit_price, total, organization_id)
    VALUES
      (v_invoice_id, COALESCE(v_res.service_name, 'Servicio'), 1,
       v_res.total_price, v_res.total_price, v_res.organization_id);

  ELSE
    RAISE EXCEPTION 'Método de pago inválido: %', p_payment_method;
  END IF;

  UPDATE public.facility_units
     SET status = 'available',
         assigned_dog_id = NULL,
         assigned_dog_name = NULL,
         assignment_start = NULL,
         assignment_end = NULL,
         assigned_reservation_id = NULL,
         updated_at = now()
   WHERE assigned_reservation_id = p_reservation_id;

  -- Las notas del check-out se AÑADEN (antes reemplazaban las del check-in).
  UPDATE public.reservations
     SET status = 'completed',
         check_out_time = v_now,
         notes = CASE WHEN btrim(COALESCE(p_notes, '')) <> ''
                      THEN COALESCE(NULLIF(notes, '') || E'\n', '') || '[Check-out]: ' || p_notes
                      ELSE notes END,
         updated_at = v_now
   WHERE id = p_reservation_id;

  RETURN json_build_object('invoice_id', v_invoice_id, 'plan_id', v_plan.id, 'plan_units', v_units);
END $function$;

-- update_reservation
CREATE OR REPLACE FUNCTION public.update_reservation(p_reservation_id uuid, p_service_type text, p_service_name text, p_start timestamp with time zone, p_end timestamp with time zone, p_total_price numeric, p_notes text DEFAULT ''::text, p_status text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org      uuid;
  v_dog_id   uuid;
  v_status   text;
BEGIN
  SELECT organization_id, dog_id, status INTO v_org, v_dog_id, v_status
  FROM public.reservations
  WHERE id = p_reservation_id
    AND organization_id IN (SELECT public.get_org_ids_with_permission('reservations.edit'))
  FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Reserva inválida o no tienes permiso para editarla';
  END IF;

  IF p_end <= p_start THEN
    RAISE EXCEPTION 'La fecha de fin debe ser posterior al inicio';
  END IF;

  IF p_total_price IS NULL OR p_total_price < 0 THEN
    RAISE EXCEPTION 'El precio no puede ser negativo';
  END IF;

  IF p_status IS NOT NULL THEN
    -- checked_in / in_progress ocupan perrera: solo vía check_in_reservation.
    -- (Pasar a completed/cancelled libera la perrera por trigger.)
    IF p_status NOT IN ('requested','scheduled','cancelled','rejected','completed','no_show')
       AND p_status IS DISTINCT FROM v_status THEN
      RAISE EXCEPTION 'Estado no permitido desde la edición: %', p_status;
    END IF;
    IF p_status IS DISTINCT FROM v_status
       AND NOT public.has_org_permission(v_org, public.reservation_status_permission(v_status, p_status)) THEN
      RAISE EXCEPTION 'No tienes permiso para cambiar la reserva a ese estado';
    END IF;
    v_status := p_status;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('reservation-dog:' || v_dog_id::text, 0));

  IF v_status NOT IN ('cancelled','completed','rejected','no_show') AND EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.dog_id = v_dog_id
      AND r.id <> p_reservation_id
      AND r.status NOT IN ('cancelled','completed','rejected','no_show')
      AND tstzrange(r.start_date, r.end_date, '[)') && tstzrange(p_start, p_end, '[)')
  ) THEN
    RAISE EXCEPTION 'El perro ya tiene otra reserva que se solapa en ese horario';
  END IF;

  UPDATE public.reservations
  SET service_type = p_service_type,
      service_name = p_service_name,
      start_date   = p_start,
      end_date     = p_end,
      total_price  = p_total_price,
      notes        = COALESCE(p_notes, ''),
      status       = v_status,
      updated_at   = now()
  WHERE id = p_reservation_id;
END $function$;

-- check_in_reservation
CREATE OR REPLACE FUNCTION public.check_in_reservation(p_reservation_id uuid, p_unit_id uuid, p_notes text DEFAULT ''::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org      uuid;
  v_dog_id   uuid;
  v_dog_name text;
  v_start    timestamptz;
  v_end      timestamptz;
  v_current  public.facility_units;
  v_unit     uuid := p_unit_id;
BEGIN
  SELECT r.organization_id, r.dog_id, r.start_date, r.end_date
    INTO v_org, v_dog_id, v_start, v_end
  FROM public.reservations r
  WHERE r.id = p_reservation_id
    AND r.organization_id IN (SELECT public.get_org_ids_with_permission('stays.checkin'))
    AND r.status = 'scheduled'
  FOR UPDATE;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Reserva inválida, fuera de tu organización o no está aprobada';
  END IF;

  SELECT d.name INTO v_dog_name FROM public.dogs d WHERE d.id = v_dog_id;

  -- Perrera donde el perro ya está (si está en alguna).
  SELECT * INTO v_current
    FROM public.facility_units u
   WHERE u.organization_id = v_org AND u.assigned_dog_id = v_dog_id::text
   ORDER BY (u.id = p_unit_id) DESC, u.updated_at DESC
   LIMIT 1
   FOR UPDATE;

  -- Si esa perrera pertenece a otra estadía en curso, el perro ya está
  -- registrado: hay que hacer el check-out de esa reserva primero.
  IF v_current.id IS NOT NULL AND v_current.assigned_reservation_id IS NOT NULL
     AND v_current.assigned_reservation_id <> p_reservation_id
     AND EXISTS (
       SELECT 1 FROM public.reservations r2
        WHERE r2.id = v_current.assigned_reservation_id
          AND r2.status IN ('checked_in', 'in_progress', 'ready')
     ) THEN
    RAISE EXCEPTION 'Este perro ya tiene otra estadía en curso en la perrera %. Haz el check-out de esa reserva primero.', v_current.name;
  END IF;

  IF v_unit IS NULL THEN
    v_unit := v_current.id;
    IF v_unit IS NULL THEN
      RAISE EXCEPTION 'Elige una perrera para el check-in';
    END IF;
  END IF;

  IF v_current.id IS DISTINCT FROM v_unit THEN
    -- Perrera nueva: debe estar libre.
    PERFORM 1 FROM public.facility_units u
     WHERE u.id = v_unit AND u.organization_id = v_org AND u.status = 'available'
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Esa perrera no está disponible, elige otra';
    END IF;
  END IF;

  -- El perro sale de cualquier otra perrera en la que figure (se mueve).
  UPDATE public.facility_units
     SET status = 'available', assigned_dog_id = NULL, assigned_dog_name = NULL,
         assignment_start = NULL, assignment_end = NULL, assigned_reservation_id = NULL,
         updated_at = now()
   WHERE organization_id = v_org AND assigned_dog_id = v_dog_id::text AND id <> v_unit;

  UPDATE public.facility_units
     SET status = 'occupied',
         assigned_dog_id = v_dog_id::text,
         assigned_dog_name = v_dog_name,
         assignment_start = v_start,
         assignment_end = v_end,
         assigned_reservation_id = p_reservation_id,
         updated_at = now()
   WHERE id = v_unit;

  UPDATE public.reservations
     SET status = 'checked_in',
         check_in_time = now(),
         location_id = v_unit,
         notes = CASE WHEN COALESCE(p_notes, '') <> ''
                      THEN COALESCE(notes, '') || E'\n[Check-in]: ' || p_notes
                      ELSE notes END,
         updated_at = now()
   WHERE id = p_reservation_id;

  INSERT INTO public.notices
    (title, message, severity, entity_type, entity_id, auto_generated, organization_id)
  VALUES
    ('Check-in registrado',
     COALESCE(v_dog_name, 'El perro') || ' ingresó al centro.',
     'info', 'reservation', p_reservation_id::text, true, v_org);
END $function$;

-- check_out_reservation
CREATE OR REPLACE FUNCTION public.check_out_reservation(p_reservation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
BEGIN
  SELECT r.organization_id INTO v_org
  FROM public.reservations r
  WHERE r.id = p_reservation_id
    AND r.organization_id IN (SELECT public.get_org_ids_with_permission('stays.checkout'))
    AND r.status IN ('checked_in', 'in_progress', 'ready')
  FOR UPDATE;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Reserva inválida, fuera de tu organización o no está en curso';
  END IF;

  UPDATE public.facility_units
     SET status = 'available',
         assigned_dog_id = NULL,
         assigned_dog_name = NULL,
         assignment_start = NULL,
         assignment_end = NULL,
         assigned_reservation_id = NULL,
         updated_at = now()
   WHERE assigned_reservation_id = p_reservation_id;

  UPDATE public.reservations
     SET status = 'completed',
         check_out_time = now(),
         updated_at = now()
   WHERE id = p_reservation_id;

  INSERT INTO public.notices
    (title, message, severity, entity_type, entity_id, auto_generated, organization_id)
  VALUES
    ('Check-out registrado',
     'La estadía se completó y la perrera quedó libre.',
     'info', 'reservation', p_reservation_id::text, true, v_org);
END $function$;

-- create_daily_route
CREATE OR REPLACE FUNCTION public.create_daily_route(p_organization_id uuid, p_route_type text, p_assignee_staff_id uuid, p_reservation_ids uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_task_id uuid;
  v_res     RECORD;
  v_seq     integer := 0;
BEGIN
  IF p_organization_id NOT IN (SELECT public.get_org_ids_with_permission('routes.manage')) THEN
    RAISE EXCEPTION 'No autorizado para crear rutas en esta organización';
  END IF;

  IF p_route_type NOT IN ('route_pickup','route_dropoff') THEN
    RAISE EXCEPTION 'route_type inválido: %', p_route_type;
  END IF;

  IF p_reservation_ids IS NULL OR array_length(p_reservation_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'La ruta necesita al menos una parada';
  END IF;

  IF p_assignee_staff_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE id = p_assignee_staff_id AND organization_id = p_organization_id AND is_active
  ) THEN
    RAISE EXCEPTION 'El chofer no pertenece a esta organización o está inactivo';
  END IF;

  INSERT INTO public.tasks (organization_id, type, title, priority, status, assignee_staff_id, due_at)
  VALUES (
    p_organization_id, p_route_type,
    CASE WHEN p_route_type = 'route_pickup' THEN 'Ruta de recogida — ' ELSE 'Ruta de entrega — ' END
      || to_char(now(), 'DD/MM/YYYY'),
    'high', 'pending', p_assignee_staff_id, now()
  )
  RETURNING id INTO v_task_id;

  FOR v_res IN
    SELECT r.id AS reservation_id, r.customer_id, r.dog_id,
           c.address AS address_snapshot, c.address_lat AS lat, c.address_lng AS lng
    FROM public.reservations r
    JOIN public.customers c ON c.id = r.customer_id
    WHERE r.id = ANY(p_reservation_ids)
      AND r.organization_id = p_organization_id
      AND r.status NOT IN ('cancelled', 'rejected', 'no_show')
    ORDER BY array_position(p_reservation_ids, r.id)
  LOOP
    IF v_res.lat IS NULL OR v_res.lng IS NULL THEN
      RAISE EXCEPTION 'El cliente de la reserva % no tiene dirección geocodificada', v_res.reservation_id;
    END IF;

    v_seq := v_seq + 1;
    INSERT INTO public.route_stops (
      task_id, reservation_id, customer_id, dog_id, sequence,
      address_snapshot, lat, lng
    ) VALUES (
      v_task_id, v_res.reservation_id, v_res.customer_id, v_res.dog_id, v_seq,
      v_res.address_snapshot, v_res.lat, v_res.lng
    );
  END LOOP;

  IF v_seq = 0 THEN
    RAISE EXCEPTION 'Ninguna de las reservas indicadas está activa en esta organización';
  END IF;

  RETURN v_task_id;
END;
$function$;

-- complete_route_stop
CREATE OR REPLACE FUNCTION public.complete_route_stop(p_stop_id uuid, p_skip_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_task_id    uuid;
  v_new_status text := CASE WHEN p_skip_reason IS NULL THEN 'completed' ELSE 'skipped' END;
BEGIN
  SELECT task_id INTO v_task_id FROM public.route_stops WHERE id = p_stop_id;
  IF v_task_id IS NULL THEN
    RAISE EXCEPTION 'Parada no encontrada';
  END IF;

  IF v_task_id NOT IN (
    SELECT t.id FROM public.tasks t
    WHERE t.organization_id IN (SELECT public.get_org_ids_with_permission('routes.manage'))
       OR (t.assignee_staff_id IN (SELECT public.get_my_staff_ids())
           AND t.organization_id IN (SELECT public.get_active_org_ids()))
  ) THEN
    RAISE EXCEPTION 'No autorizado para esta parada';
  END IF;

  UPDATE public.route_stops
  SET status = v_new_status, completed_at = now(), skipped_reason = p_skip_reason
  WHERE id = p_stop_id
    AND status NOT IN ('completed', 'skipped');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esta parada ya estaba cerrada';
  END IF;

  UPDATE public.tasks
  SET status = 'done', completed_at = now()
  WHERE id = v_task_id
    AND NOT EXISTS (
      SELECT 1 FROM public.route_stops
      WHERE task_id = v_task_id AND status IN ('pending','en_route','notified','arrived')
    );
END;
$function$;

-- mark_route_stop_departed
CREATE OR REPLACE FUNCTION public.mark_route_stop_departed(p_stop_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_task_id uuid;
BEGIN
  SELECT task_id INTO v_task_id FROM public.route_stops WHERE id = p_stop_id;
  IF v_task_id IS NULL THEN
    RAISE EXCEPTION 'Parada no encontrada';
  END IF;

  IF v_task_id NOT IN (
    SELECT t.id FROM public.tasks t
    WHERE t.organization_id IN (SELECT public.get_org_ids_with_permission('routes.manage'))
       OR (t.assignee_staff_id IN (SELECT public.get_my_staff_ids())
           AND t.organization_id IN (SELECT public.get_active_org_ids()))
  ) THEN
    RAISE EXCEPTION 'No autorizado para esta parada';
  END IF;

  UPDATE public.route_stops
  SET status = 'en_route', departed_at = COALESCE(departed_at, now())
  WHERE id = p_stop_id AND status IN ('pending', 'en_route');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La parada ya no está pendiente (estado actual no permite salida)';
  END IF;
END;
$function$;

-- create_reservation
CREATE OR REPLACE FUNCTION public.create_reservation(p_customer_id uuid, p_dog_id uuid, p_service_type text, p_service_name text, p_start timestamp with time zone, p_end timestamp with time zone, p_total_price numeric, p_notes text DEFAULT ''::text, p_staff_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org    uuid;
  v_res_id uuid;
BEGIN
  SELECT organization_id INTO v_org
  FROM public.customers
  WHERE id = p_customer_id
    AND organization_id IN (SELECT public.get_org_ids_with_permission('reservations.create'));
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Cliente inválido, fuera de tu organización o sin permiso para crear reservas';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.dogs
    WHERE id = p_dog_id AND organization_id = v_org AND customer_id = p_customer_id
  ) THEN
    RAISE EXCEPTION 'Perro inválido o no pertenece a este cliente';
  END IF;

  IF p_staff_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.staff_members WHERE id = p_staff_id AND organization_id = v_org
  ) THEN
    RAISE EXCEPTION 'El miembro del equipo no pertenece a esta organización';
  END IF;

  IF p_end <= p_start THEN
    RAISE EXCEPTION 'La fecha de fin debe ser posterior al inicio';
  END IF;

  IF p_total_price IS NULL OR p_total_price < 0 THEN
    RAISE EXCEPTION 'El precio no puede ser negativo';
  END IF;

  -- Serializa por perro: sin esto dos solicitudes simultáneas pasaban ambas el
  -- chequeo de solapamiento (doble reserva).
  PERFORM pg_advisory_xact_lock(hashtextextended('reservation-dog:' || p_dog_id::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.dog_id = p_dog_id
      AND r.status NOT IN ('cancelled','completed','rejected','no_show')
      AND tstzrange(r.start_date, r.end_date, '[)') && tstzrange(p_start, p_end, '[)')
  ) THEN
    RAISE EXCEPTION 'El perro ya tiene una reserva que se solapa en ese horario';
  END IF;

  INSERT INTO public.reservations
    (customer_id, dog_id, service_type, service_name, start_date, end_date,
     total_price, notes, status, organization_id, staff_id)
  VALUES
    (p_customer_id, p_dog_id, p_service_type, p_service_name, p_start, p_end,
     p_total_price, COALESCE(p_notes, ''), 'requested', v_org, p_staff_id)
  RETURNING id INTO v_res_id;

  INSERT INTO public.notices
    (title, message, severity, entity_type, entity_id, auto_generated, organization_id)
  SELECT
    'Nueva solicitud de reserva',
    c.first_name || ' ' || c.last_name || ' ha solicitado ' || p_service_name || ' para ' || d.name || '.',
    'info', 'reservation', v_res_id::text, true, v_org
  FROM public.customers c, public.dogs d
  WHERE c.id = p_customer_id AND d.id = p_dog_id;

  RETURN v_res_id;
END $function$;

-- seed_demo_data
CREATE OR REPLACE FUNCTION public.seed_demo_data(p_org_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer uuid;
  v_dog_max  uuid;
  v_dog_luna uuid;
  v_zone     uuid;
BEGIN
  IF p_org_id IS NULL OR p_org_id NOT IN (SELECT public.get_org_ids_with_permission('reservations.create')) THEN
    RAISE EXCEPTION 'Organización inválida o sin permiso';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.customers
    WHERE organization_id = p_org_id AND email = 'demo@kennelops.example'
  ) THEN
    RAISE EXCEPTION 'Esta organización ya tiene datos de ejemplo';
  END IF;

  INSERT INTO public.customers
    (first_name, last_name, email, phone, notes, organization_id)
  VALUES
    ('Cliente', 'de Ejemplo', 'demo@kennelops.example', '555-0100',
     'Datos de ejemplo — puedes borrarlos desde el checklist del dashboard.', p_org_id)
  RETURNING id INTO v_customer;

  INSERT INTO public.dogs
    (customer_id, name, breed, gender, birth_date, weight, color, is_neutered,
     notes, feeding, organization_id)
  VALUES
    (v_customer, 'Max', 'Golden Retriever', 'male',
     (now() - interval '3 years')::date, 28, 'Dorado', true,
     'Perro de ejemplo', '{"food_type":"seco","brand":"","meals_per_day":2,"portion_amount":150,"portion_unit":"g","instructions":""}'::jsonb,
     p_org_id)
  RETURNING id INTO v_dog_max;

  INSERT INTO public.dogs
    (customer_id, name, breed, gender, birth_date, weight, color, is_neutered,
     has_allergies, notes, feeding, organization_id)
  VALUES
    (v_customer, 'Luna', 'Border Collie', 'female',
     (now() - interval '18 months')::date, 17, 'Negro y blanco', false,
     true, 'Perra de ejemplo',
     '{"food_type":"mixto","brand":"","meals_per_day":3,"portion_amount":120,"portion_unit":"g","instructions":"Separar de otros perros al comer"}'::jsonb,
     p_org_id)
  RETURNING id INTO v_dog_luna;

  INSERT INTO public.dog_allergies (dog_id, organization_id, allergen, type, reaction, severity)
  VALUES (v_dog_luna, p_org_id, 'Pollo', 'comida', 'Picazón en la piel', 'media');

  IF NOT EXISTS (SELECT 1 FROM public.facility_zones WHERE organization_id = p_org_id) THEN
    INSERT INTO public.facility_zones (name, organization_id)
    VALUES ('Zona Demo', p_org_id)
    RETURNING id INTO v_zone;

    INSERT INTO public.facility_units (zone_id, name, status, organization_id)
    VALUES (v_zone, 'Demo K-01', 'available', p_org_id),
           (v_zone, 'Demo K-02', 'available', p_org_id);
  END IF;

  INSERT INTO public.reservations
    (customer_id, dog_id, service_type, service_name, start_date, end_date,
     total_price, status, notes, organization_id)
  VALUES
    (v_customer, v_dog_max, 'daycare', 'Guardería',
     now() + interval '1 hour', now() + interval '8 hours',
     35, 'scheduled', 'Reserva de ejemplo — prueba el check-in', p_org_id),
    (v_customer, v_dog_luna, 'training_session', 'Sesión de Entrenamiento',
     now() + interval '1 day', now() + interval '1 day 2 hours',
     50, 'requested', 'Solicitud de ejemplo — apruébala desde Solicitudes', p_org_id);

  INSERT INTO public.dog_plans
    (organization_id, dog_id, customer_id, service_type, service_label, category, billing,
     start_date, end_date, quantity_total, unit_label, consumption, price, includes, conditions)
  VALUES
    (p_org_id, v_dog_max, v_customer, 'daycare', 'Guardería · 5 días', 'daycare', 'quantity',
     CURRENT_DATE, CURRENT_DATE + 89, 5, 'días', 'per_day', 150,
     ARRAY['Snacks', 'Reporte por WhatsApp'], 'Plan de ejemplo: se descuenta un día en cada check-out.');

  RETURN json_build_object('customer_id', v_customer);
END $function$;

-- remove_demo_data
CREATE OR REPLACE FUNCTION public.remove_demo_data(p_org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_org_id IS NULL OR p_org_id NOT IN (SELECT public.get_org_ids_with_permission('reservations.create')) THEN
    RAISE EXCEPTION 'Organización inválida o sin permiso';
  END IF;

  -- Liberar primero perreras ocupadas por reservas demo (el borrado en cascada
  -- de la reserva dejaba la perrera 'occupied' con un perro inexistente).
  UPDATE public.facility_units u
     SET status = 'available', assigned_dog_id = NULL, assigned_dog_name = NULL,
         assignment_start = NULL, assignment_end = NULL,
         assigned_reservation_id = NULL, updated_at = now()
   WHERE u.organization_id = p_org_id
     AND u.assigned_dog_id IN (
       SELECT d.id::text FROM public.dogs d
       JOIN public.customers c ON c.id = d.customer_id
       WHERE c.organization_id = p_org_id AND c.email = 'demo@kennelops.example'
     );

  DELETE FROM public.customers
  WHERE organization_id = p_org_id AND email = 'demo@kennelops.example';

  DELETE FROM public.facility_units
  WHERE organization_id = p_org_id
    AND name LIKE 'Demo K-%'
    AND assigned_reservation_id IS NULL
    AND assigned_dog_id IS NULL;

  DELETE FROM public.facility_zones z
  WHERE z.organization_id = p_org_id
    AND z.name = 'Zona Demo'
    AND NOT EXISTS (SELECT 1 FROM public.facility_units u WHERE u.zone_id = z.id);
END $function$;

-- deduct_package_credit
CREATE OR REPLACE FUNCTION public.deduct_package_credit(p_package_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_before int; v_after int; v_org uuid; v_found boolean;
BEGIN
  -- El log lo escribe este RPC; el trigger de auditoría no debe duplicarlo.
  PERFORM set_config('app.credit_change_logged', 'on', true);

  UPDATE public.packages
    SET remaining_credits = remaining_credits - 1,
        status = CASE WHEN remaining_credits - 1 = 0 THEN 'depleted' ELSE status END,
        updated_at = now()
  WHERE id = p_package_id
    AND organization_id IN (SELECT public.get_org_ids_with_any_permission(ARRAY['invoices.create','packages.manage']))
    AND remaining_credits > 0
    AND expires_at >= CURRENT_DATE
  RETURNING (remaining_credits + 1), remaining_credits, organization_id
  INTO v_before, v_after, v_org;
  v_found := FOUND;  -- capturar antes: PERFORM reescribe FOUND

  PERFORM set_config('app.credit_change_logged', 'off', true);

  IF NOT v_found THEN
    RAISE EXCEPTION 'Sin créditos disponibles, paquete vencido o sin permiso';
  END IF;

  INSERT INTO public.package_credit_log
    (package_id, organization_id, user_id, action, credits_before, credits_after, reason)
  VALUES (p_package_id, v_org, auth.uid(), 'deduct', v_before, v_after, p_reason);

  RETURN v_after;
END $function$;

-- import_clinical_records
CREATE OR REPLACE FUNCTION public.import_clinical_records(p_org_id uuid, p_kind text, p_rows jsonb, p_dry_run boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r          jsonb;
  v_dog      record;
  v_inserted integer := 0;
  v_dups     integer := 0;
  v_invalid  integer := 0;
  v_seen     text[] := '{}';
  v_key      text;
  v_date     date;
  v_weight   numeric;
  v_dogs_before jsonb := '{}'::jsonb;
BEGIN
  IF p_org_id IS NULL OR p_org_id NOT IN (SELECT public.get_org_ids_with_permission('clinical.import')) THEN
    RAISE EXCEPTION 'No tienes permiso para registrar historia clínica en esta organización';
  END IF;
  IF p_kind NOT IN ('medical', 'vaccines', 'deworming', 'weights') THEN
    RAISE EXCEPTION 'Tipo de importación inválido: %', p_kind;
  END IF;
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Las filas deben venir como una lista';
  END IF;
  IF jsonb_array_length(p_rows) > 2000 THEN
    RAISE EXCEPTION 'Máximo 2000 filas por envío';
  END IF;

  -- Pesos: foto del estado antes de importar (¿tenía pesadas? ¿qué peso?).
  IF p_kind = 'weights' AND NOT p_dry_run THEN
    SELECT coalesce(jsonb_object_agg(d.id::text, jsonb_build_object(
             'weight', d.weight,
             'had_logs', EXISTS (SELECT 1 FROM public.dog_weight_logs l WHERE l.dog_id = d.id))), '{}'::jsonb)
      INTO v_dogs_before
      FROM public.dogs d
     WHERE d.organization_id = p_org_id
       AND d.id::text IN (SELECT x ->> 'dog_id' FROM jsonb_array_elements(p_rows) x);
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    SELECT d.id, d.name INTO v_dog
      FROM public.dogs d
     WHERE d.id::text = r ->> 'dog_id' AND d.organization_id = p_org_id;
    IF v_dog.id IS NULL THEN
      v_invalid := v_invalid + 1;
      CONTINUE;
    END IF;

    IF p_kind = 'medical' THEN
      v_date := (r ->> 'record_date')::date;
      v_key := md5(concat_ws('|', v_dog.id, v_date,
        public.clinical_norm(r ->> 'reason'), public.clinical_norm(r ->> 'diagnosis'),
        public.clinical_norm(r ->> 'treatment'), public.clinical_norm(r ->> 'prescription'),
        public.clinical_norm(r ->> 'notes')));
      IF v_key = ANY (v_seen) OR EXISTS (
        SELECT 1 FROM public.medical_history m
         WHERE m.dog_id = v_dog.id::text AND m.record_date = v_date
           AND public.clinical_norm(m.reason)       = public.clinical_norm(r ->> 'reason')
           AND public.clinical_norm(m.diagnosis)    = public.clinical_norm(r ->> 'diagnosis')
           AND public.clinical_norm(m.treatment)    = public.clinical_norm(r ->> 'treatment')
           AND public.clinical_norm(m.prescription) = public.clinical_norm(r ->> 'prescription')
           AND public.clinical_norm(m.notes)        = public.clinical_norm(r ->> 'notes')
      ) THEN
        v_dups := v_dups + 1;
        CONTINUE;
      END IF;
      v_seen := v_seen || v_key;
      IF NOT p_dry_run THEN
        INSERT INTO public.medical_history
          (dog_id, dog_name, organization_id, record_date, record_type, veterinarian, reason, diagnosis,
           treatment, prescription, weight, temperature, heart_rate, respiratory_rate, blood_pressure,
           body_condition_score, notes, next_appointment)
        VALUES
          (v_dog.id::text, v_dog.name, p_org_id, v_date, coalesce(nullif(r ->> 'record_type', ''), 'consultation'),
           coalesce(r ->> 'veterinarian', ''), coalesce(r ->> 'reason', ''), coalesce(r ->> 'diagnosis', ''),
           coalesce(r ->> 'treatment', ''), coalesce(r ->> 'prescription', ''),
           (r ->> 'weight')::numeric, (r ->> 'temperature')::numeric, (r ->> 'heart_rate')::integer,
           (r ->> 'respiratory_rate')::integer, nullif(r ->> 'blood_pressure', ''),
           (r ->> 'body_condition_score')::integer, coalesce(r ->> 'notes', ''), (r ->> 'next_appointment')::date);
      END IF;

    ELSIF p_kind = 'deworming' THEN
      v_date := (r ->> 'date_administered')::date;
      v_key := concat_ws('|', v_dog.id, v_date, public.clinical_norm(r ->> 'product_name'));
      IF v_key = ANY (v_seen) OR EXISTS (
        SELECT 1 FROM public.deworming_records x
         WHERE x.dog_id = v_dog.id::text AND x.date_administered = v_date
           AND public.clinical_norm(x.product_name) = public.clinical_norm(r ->> 'product_name')
      ) THEN
        v_dups := v_dups + 1;
        CONTINUE;
      END IF;
      v_seen := v_seen || v_key;
      IF NOT p_dry_run THEN
        INSERT INTO public.deworming_records
          (dog_id, dog_name, organization_id, product_name, product_type, date_administered,
           next_dose_date, weight_at_time, veterinarian, notes)
        VALUES
          (v_dog.id::text, v_dog.name, p_org_id, r ->> 'product_name', coalesce(nullif(r ->> 'product_type', ''), 'internal'),
           v_date, (r ->> 'next_dose_date')::date, (r ->> 'weight_at_time')::numeric,
           coalesce(r ->> 'veterinarian', ''), coalesce(r ->> 'notes', ''));
      END IF;

    ELSIF p_kind = 'vaccines' THEN
      v_date := (r ->> 'date_administered')::date;
      v_key := concat_ws('|', v_dog.id, v_date, public.clinical_norm(r ->> 'vaccine_name'));
      IF v_key = ANY (v_seen) OR EXISTS (
        SELECT 1 FROM public.vaccination_schedule x
         WHERE x.dog_id = v_dog.id::text AND x.date_administered = v_date
           AND public.clinical_norm(x.vaccine_name) = public.clinical_norm(r ->> 'vaccine_name')
      ) THEN
        v_dups := v_dups + 1;
        CONTINUE;
      END IF;
      v_seen := v_seen || v_key;
      IF NOT p_dry_run THEN
        INSERT INTO public.vaccination_schedule
          (dog_id, dog_name, organization_id, vaccine_name, vaccine_type, date_administered,
           next_dose_date, batch_number, veterinarian, status, notes)
        VALUES
          (v_dog.id::text, v_dog.name, p_org_id, r ->> 'vaccine_name', coalesce(nullif(r ->> 'vaccine_type', ''), 'core'),
           v_date, (r ->> 'next_dose_date')::date, coalesce(r ->> 'batch_number', ''),
           coalesce(r ->> 'veterinarian', ''), 'administered', coalesce(r ->> 'notes', ''));
      END IF;

    ELSE -- weights
      v_date := (r ->> 'recorded_at')::date;
      v_weight := (r ->> 'weight')::numeric;
      v_key := concat_ws('|', v_dog.id, v_date, v_weight);
      IF v_key = ANY (v_seen)
         OR EXISTS (SELECT 1 FROM public.dog_weight_logs l
                     WHERE l.dog_id = v_dog.id AND l.recorded_at = v_date AND l.weight = v_weight)
         OR EXISTS (SELECT 1 FROM public.medical_history m
                     WHERE m.dog_id = v_dog.id::text AND m.record_date = v_date AND m.weight = v_weight)
      THEN
        v_dups := v_dups + 1;
        CONTINUE;
      END IF;
      v_seen := v_seen || v_key;
      IF NOT p_dry_run THEN
        INSERT INTO public.dog_weight_logs (dog_id, organization_id, weight, recorded_at, notes, body_condition_score)
        VALUES (v_dog.id, p_org_id, v_weight, v_date, nullif(r ->> 'notes', ''), (r ->> 'body_condition_score')::smallint);
      END IF;
    END IF;

    v_inserted := v_inserted + 1;
  END LOOP;

  -- Pesos: el perro que no tenía pesadas conserva su peso actual.
  IF p_kind = 'weights' AND NOT p_dry_run THEN
    UPDATE public.dogs d
       SET weight = (v_dogs_before -> d.id::text ->> 'weight')::numeric, updated_at = now()
     WHERE d.organization_id = p_org_id
       AND v_dogs_before ? d.id::text
       AND NOT (v_dogs_before -> d.id::text ->> 'had_logs')::boolean
       AND (v_dogs_before -> d.id::text ->> 'weight') IS NOT NULL
       AND d.weight IS DISTINCT FROM (v_dogs_before -> d.id::text ->> 'weight')::numeric;
  END IF;

  RETURN json_build_object('inserted', v_inserted, 'duplicates', v_dups, 'invalid_dogs', v_invalid, 'dry_run', p_dry_run);
END $function$;

-- register_plan_usage
CREATE OR REPLACE FUNCTION public.register_plan_usage(p_plan_id uuid, p_quantity integer DEFAULT 1, p_used_on date DEFAULT NULL::date, p_note text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_plan public.dog_plans;
BEGIN
  SELECT * INTO v_plan FROM public.dog_plans WHERE id = p_plan_id FOR UPDATE;
  IF v_plan.id IS NULL OR NOT (
    v_plan.organization_id IN (SELECT public.get_org_ids_with_permission('plans.use'))
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
END $function$;

-- move_dog_kennel
CREATE OR REPLACE FUNCTION public.move_dog_kennel(p_from_unit uuid, p_to_unit uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_from public.facility_units;
  v_to   public.facility_units;
BEGIN
  IF p_from_unit = p_to_unit THEN
    RAISE EXCEPTION 'Elige una perrera distinta';
  END IF;

  SELECT * INTO v_from FROM public.facility_units WHERE id = p_from_unit FOR UPDATE;
  SELECT * INTO v_to   FROM public.facility_units WHERE id = p_to_unit   FOR UPDATE;

  IF v_from.id IS NULL OR v_to.id IS NULL OR v_from.organization_id IS DISTINCT FROM v_to.organization_id THEN
    RAISE EXCEPTION 'Perrera no encontrada';
  END IF;

  IF NOT public.has_org_permission(v_from.organization_id, 'kennels.move') THEN
    RAISE EXCEPTION 'No tienes permiso para mover perros entre perreras';
  END IF;

  IF v_from.assigned_dog_id IS NULL THEN
    RAISE EXCEPTION 'La perrera de origen no tiene perro';
  END IF;
  IF v_to.status <> 'available' OR v_to.assigned_dog_id IS NOT NULL THEN
    RAISE EXCEPTION 'La perrera de destino no está disponible';
  END IF;

  UPDATE public.facility_units SET
    status = 'occupied',
    assigned_dog_id = v_from.assigned_dog_id,
    assigned_dog_name = v_from.assigned_dog_name,
    assignment_start = v_from.assignment_start,
    assignment_end = v_from.assignment_end,
    assigned_reservation_id = v_from.assigned_reservation_id,
    updated_at = now()
  WHERE id = v_to.id;

  UPDATE public.facility_units SET
    status = 'available',
    assigned_dog_id = NULL,
    assigned_dog_name = NULL,
    assignment_start = NULL,
    assignment_end = NULL,
    assigned_reservation_id = NULL,
    updated_at = now()
  WHERE id = v_from.id;

  IF v_from.assigned_reservation_id IS NOT NULL THEN
    UPDATE public.reservations
       SET location_id = v_to.id, updated_at = now()
     WHERE id = v_from.assigned_reservation_id;
  END IF;
END;
$function$;

-- ── 9. Funciones de capacidad viejas: ya no las usa nada ───────────────────
DROP FUNCTION IF EXISTS public.get_scheduler_org_ids();
DROP FUNCTION IF EXISTS public.get_finance_writer_org_ids();
DROP FUNCTION IF EXISTS public.get_clinical_writer_org_ids();
DROP FUNCTION IF EXISTS public.get_reportcard_writer_org_ids();
DROP FUNCTION IF EXISTS public.get_contract_org_ids();
