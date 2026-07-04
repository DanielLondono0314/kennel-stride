-- PR-10: Guard de RLS contra drift (p. ej. cambios aplicados por Lovable
-- directamente en remoto). Falla (exit != 0 con ON_ERROR_STOP) si:
--   1. Alguna tabla de `public` tiene RLS deshabilitada.
--   2. Alguna policy permisiva aplica a `anon`/`public` con USING(true) y
--      WITH CHECK(true) — acceso totalmente abierto.
-- Ya ocurrió una vez: se coló acceso anónimo a `reservations`.
--
-- Uso: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rls_guard.sql
-- Corre en CI (.github/workflows/rls-guard.yml) contra la DB local con
-- las migraciones aplicadas.

DO $$
DECLARE
  v_offenders text := '';
  r record;
  -- Policies abiertas INTENCIONALMENTE (revisar antes de añadir nada aquí).
  v_allowlist text[] := ARRAY[]::text[];
BEGIN
  -- 1. Tablas de public sin RLS.
  FOR r IN
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
    ORDER BY c.relname
  LOOP
    v_offenders := v_offenders || format(E'\n- RLS deshabilitada: public.%I', r.tablename);
  END LOOP;

  -- 2. Policies permisivas totalmente abiertas para anon/public.
  FOR r IN
    SELECT tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND permissive = 'PERMISSIVE'
      AND (roles @> ARRAY['public'::name] OR roles @> ARRAY['anon'::name])
      AND coalesce(qual, 'true') = 'true'
      AND coalesce(with_check, 'true') = 'true'
      AND NOT (tablename || '.' || policyname = ANY (v_allowlist))
    ORDER BY tablename, policyname
  LOOP
    v_offenders := v_offenders
      || format(E'\n- Policy abierta a anon/public: %I.%I (%s)', r.tablename, r.policyname, r.cmd);
  END LOOP;

  IF v_offenders <> '' THEN
    RAISE EXCEPTION E'Guard de RLS: configuración insegura detectada:%\n\nSi un cambio es intencional, añádelo al allowlist de scripts/rls_guard.sql con justificación.', v_offenders;
  END IF;

  RAISE NOTICE 'Guard de RLS: OK (todas las tablas con RLS y sin policies abiertas a anon)';
END $$;
