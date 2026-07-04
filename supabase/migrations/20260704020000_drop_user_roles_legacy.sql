-- PR-22: retirar el sistema de roles legacy single-tenant (user_roles/has_role).
-- Los roles reales viven en organization_members.role (multi-tenant).
-- La policy peligrosa de profiles ya se dropeó en 20260608000000; aquí cae el resto.
-- NOTA: el enum app_role NO se toca — lo usan organization_members,
-- organization_invitations y staff_members.

-- 1. Blindaje contra drift: prod puede tener aún la versión Lovable de
--    handle_new_user que inserta en user_roles ("primer usuario = admin").
--    Re-asegurar la versión limpia ANTES de dropear la tabla, o el signup
--    rompería. (Idéntica a 20260402000002_profiles.sql.)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    ''
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2. Dropear TODA policy que aún referencie has_role (runtime-dependency:
--    si la función cae primero, esas policies empiezan a lanzar errores).
--    Dinámico para cubrir también policies creadas fuera de migraciones.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual ILIKE '%has_role%' OR with_check ILIKE '%has_role%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    RAISE NOTICE 'Policy legacy eliminada: %.% — %', r.schemaname, r.tablename, r.policyname;
  END LOOP;
END $$;

-- 3. Retirar función y tabla legacy.
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP TABLE IF EXISTS public.user_roles;
