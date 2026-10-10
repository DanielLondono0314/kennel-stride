-- Panel unificado: ya no hay una "app de trabajador" aparte. Todos los roles
-- entran al mismo panel y ven las secciones que su rol permite.
--
-- El tipo de acceso 'worker' se conserva en la BD con otro significado:
-- "Personal operativo" (paseadores, cuidadores, groomers…). Sigue derivando
-- role='worker' en organization_members/staff_members, que es lo que usan la
-- asignación automática de rondas de bienestar y los selectores de encargado.
-- La diferencia ya no es la app, sino que:
--   · también se limita por secciones (antes solo 'panel'), y
--   · su página de inicio es "Mi día".
--
-- Secciones nuevas: my_day (Mi día), my_schedule (Mi horario), my_route (Mi
-- ruta), que antes solo existían en la app del trabajador.

CREATE OR REPLACE FUNCTION public.org_page_catalog()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    'dashboard', 'requests', 'calendar', 'tasks', 'facility', 'notices', 'routes',
    'customers', 'dogs', 'dog_panel', 'staff', 'report_cards', 'clinic',
    'plans', 'invoices', 'contracts', 'reports', 'campaigns',
    'my_day', 'my_schedule', 'my_route'
  ]::text[]
$$;

-- Lo que veía un trabajador en su app, ahora como secciones del panel.
CREATE OR REPLACE FUNCTION public.org_worker_default_pages()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['clinic', 'dogs', 'facility', 'my_day', 'my_route', 'my_schedule', 'notices']::text[]
$$;

-- Administrador ve todo (pages NULL). Panel y Personal operativo se limitan
-- por secciones; un rol operativo sin lista recibe las de la app anterior.
CREATE OR REPLACE FUNCTION public.org_roles_normalize_pages()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.access_type = 'admin' THEN
    NEW.pages := NULL;
  ELSIF NEW.access_type = 'worker' AND NEW.pages IS NULL THEN
    NEW.pages := public.org_worker_default_pages();
  ELSIF NEW.pages IS NOT NULL THEN
    NEW.pages := ARRAY(SELECT DISTINCT p FROM unnest(NEW.pages) p ORDER BY p);
  END IF;
  RETURN NEW;
END $$;

-- Roles operativos existentes: mismas secciones que su app (el trigger las
-- pone al tocar la fila).
UPDATE public.org_roles SET pages = NULL WHERE access_type = 'worker';
