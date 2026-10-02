-- Secciones del menú por rol: un rol de acceso "Panel" puede limitarse a
-- ciertas secciones (p. ej. Médico veterinario: Perros, Panel de perros,
-- Clínica, Report Cards, Tareas y Calendario). NULL = todas, como hasta ahora,
-- así que los roles existentes no cambian.
--
-- Es visibilidad de navegación (menú y rutas). Lo que cada rol puede hacer con
-- los datos lo siguen decidiendo sus permisos y la RLS.

CREATE OR REPLACE FUNCTION public.org_page_catalog()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    'dashboard', 'requests', 'calendar', 'tasks', 'facility', 'notices', 'routes',
    'customers', 'dogs', 'dog_panel', 'staff', 'report_cards', 'clinic',
    'plans', 'invoices', 'contracts', 'reports', 'campaigns'
  ]::text[]
$$;

ALTER TABLE public.org_roles ADD COLUMN IF NOT EXISTS pages text[];

ALTER TABLE public.org_roles DROP CONSTRAINT IF EXISTS org_roles_pages_valid;
ALTER TABLE public.org_roles ADD CONSTRAINT org_roles_pages_valid
  CHECK (pages IS NULL OR (pages <@ public.org_page_catalog() AND cardinality(pages) > 0));

-- Solo el acceso Panel limita secciones: Administrador ve todo y el
-- trabajador usa su propia app.
CREATE OR REPLACE FUNCTION public.org_roles_normalize_pages()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.access_type <> 'panel' THEN
    NEW.pages := NULL;
  ELSIF NEW.pages IS NOT NULL THEN
    NEW.pages := ARRAY(SELECT DISTINCT p FROM unnest(NEW.pages) p ORDER BY p);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS org_roles_normalize_pages ON public.org_roles;
CREATE TRIGGER org_roles_normalize_pages
  BEFORE INSERT OR UPDATE ON public.org_roles
  FOR EACH ROW EXECUTE FUNCTION public.org_roles_normalize_pages();
