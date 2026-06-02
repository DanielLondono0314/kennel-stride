-- ============================================================================
-- Worker View · Fase 1a — separar ROL (permiso) de ESPECIALIDAD (oficio).
--
-- app_role pasa de ('admin','front_desk','trainer','manager')
--          a       ('admin','front_desk','worker','manager').
-- Estrategia: RENAME VALUE 'trainer' -> 'worker' (preserva TODOS los datos
-- existentes sin reescritura de tablas; no se puede DROP VALUE en un enum).
-- El orden lógico admin/manager/front_desk/worker del spec es cosmético; el
-- enum mantiene su orden físico — la app no depende del orden del enum.
--
-- specialty: columna nueva en staff_members (una sola por staff, YAGNI).
-- Back-fill: quien era 'trainer' queda role='worker' + specialty='trainer'.
--
-- Idempotente: guards con bloques DO/IF para poder re-correr.
-- ============================================================================

-- 1. Renombrar el valor del enum (no-op si ya está renombrado).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'trainer'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'worker'
  ) THEN
    ALTER TYPE public.app_role RENAME VALUE 'trainer' TO 'worker';
  END IF;
END $$;

-- 2. Nueva columna specialty (texto libre con CHECK extensible; NO enum, para
--    poder ampliar especialidades sin migraciones de enum).
ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS specialty text;

-- CHECK extensible (lista inicial del spec). Se hace DROP+ADD por idempotencia.
ALTER TABLE public.staff_members
  DROP CONSTRAINT IF EXISTS staff_members_specialty_check;
ALTER TABLE public.staff_members
  ADD CONSTRAINT staff_members_specialty_check
  CHECK (specialty IS NULL OR specialty IN
    ('trainer','groomer','cleaning','welfare','vet'));

-- 3. Back-fill: los staff que quedaron como 'worker' por el rename y que aún no
--    tienen especialidad → specialty='trainer' (eran entrenadores).
UPDATE public.staff_members
  SET specialty = 'trainer'
  WHERE role = 'worker' AND specialty IS NULL;

-- 4. Cambiar el DEFAULT del rol de staff (antes 'trainer').
ALTER TABLE public.staff_members ALTER COLUMN role SET DEFAULT 'worker';
