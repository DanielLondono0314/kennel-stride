# Verificación SQL — RLS anon en reservations

Migración bajo prueba: `supabase/migrations/20260531000000_force_clean_anon_policies.sql`.

Este repo **no tiene harness de pg** (no hay runner de SQL en `tests/`), así que las
aserciones se documentan aquí como SQL ejecutable a mano contra una base con la
migración aplicada (p. ej. `supabase db reset` en local, o el SQL editor de Supabase).
Cada bloque indica el resultado esperado.

Objetivo: probar que tras la migración (a) NO queda ninguna política anon/public en
`public.reservations`; (b) un usuario autenticado de la Org A NO puede leer las
reservas de la Org B; (c) un miembro autenticado de la Org A SÍ puede acceder a las
reservas de su propia org.

> Nota de auth context: `auth.uid()` lee `request.jwt.claim.sub`. Para simular un
> usuario autenticado en una sesión SQL: `SET LOCAL request.jwt.claim.sub = '<uuid>';`
> y `SET LOCAL ROLE authenticated;`. `RESET ROLE` vuelve a la sesión privilegiada.

---

## Fixtures comunes

```sql
BEGIN;

-- Dos organizaciones independientes
INSERT INTO public.organizations (id, name, slug)
VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'Org A', 'org-a'),
  ('00000000-0000-0000-0000-0000000000b2', 'Org B', 'org-b')
ON CONFLICT (id) DO NOTHING;

-- Dos usuarios
INSERT INTO auth.users (id, email)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),  -- Org A
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com')     -- Org B
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com', 'Alice', 'A'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com',   'Bob',   'B')
ON CONFLICT (id) DO NOTHING;

-- Alice es miembro de Org A; Bob de Org B
INSERT INTO public.organization_members (organization_id, user_id, role)
VALUES
  ('00000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('00000000-0000-0000-0000-0000000000b2', '22222222-2222-2222-2222-222222222222', 'admin')
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Cliente + perro en cada org (FKs de reservations)
INSERT INTO public.customers (id, organization_id, first_name, last_name)
VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'CustA', 'A'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b2', 'CustB', 'B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.dogs (id, organization_id, customer_id, name)
VALUES
  ('a0a0a0a0-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-00000000000a', 'DogA'),
  ('b0b0b0b0-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b2', 'bbbbbbbb-0000-0000-0000-00000000000b', 'DogB')
ON CONFLICT (id) DO NOTHING;

-- Una reserva en cada org
INSERT INTO public.reservations
  (id, organization_id, customer_id, dog_id, service_type, service_name,
   start_date, end_date, total_price, status)
VALUES
  ('11110000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1',
   'aaaaaaaa-0000-0000-0000-00000000000a', 'a0a0a0a0-0000-0000-0000-00000000000a',
   'boarding', 'Hospedaje', now(), now() + interval '2 days', 100, 'requested'),
  ('22220000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b2',
   'bbbbbbbb-0000-0000-0000-00000000000b', 'b0b0b0b0-0000-0000-0000-00000000000b',
   'boarding', 'Hospedaje', now(), now() + interval '2 days', 100, 'requested')
ON CONFLICT (id) DO NOTHING;
```

(Ajusta columnas NOT NULL adicionales de tu esquema vivo si el INSERT lo pide.)

---

## Aserción A — no queda ninguna política anon/public en reservations → 0 filas

Tras la migración, el catálogo no debe contener ninguna política sobre
`public.reservations` cuyos roles incluyan `anon` o `public`.
**Esperado:** 0 filas.

```sql
-- Correr como superusuario/postgres (lectura de catálogo).
-- Esperado: 0 filas.
SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename  = 'reservations'
  AND (roles && ARRAY['anon']::name[] OR roles && ARRAY['public']::name[]);
```

Comprobación complementaria: la política org-scoped canónica SÍ existe y es solo
para `authenticated`.
**Esperado:** 1 fila, `roles = {authenticated}`, `cmd = ALL`.

```sql
-- Esperado: 1 fila con roles = {authenticated}
SELECT policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename  = 'reservations'
  AND policyname = 'Org members full access reservations';
```

## Aserción B — usuario de Org A NO puede leer reservas de Org B → 0 filas

Alice (miembro solo de Org A) intenta leer la reserva de Org B.
**Esperado:** 0 filas (aislamiento cross-tenant).

```sql
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111'; -- Alice (Org A)

-- Esperado: 0 filas (no ve la reserva de Org B)
SELECT id FROM public.reservations
WHERE organization_id = '00000000-0000-0000-0000-0000000000b2';

RESET ROLE;
```

Variante de escritura (defensa WITH CHECK): Alice no puede insertar una reserva en Org B.
**Esperado:** 0 filas insertadas / error de RLS.

```sql
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111'; -- Alice (Org A)

-- Esperado: violación de RLS (new row violates row-level security policy)
INSERT INTO public.reservations
  (organization_id, customer_id, dog_id, service_type, service_name,
   start_date, end_date, total_price, status)
VALUES
  ('00000000-0000-0000-0000-0000000000b2',
   'bbbbbbbb-0000-0000-0000-00000000000b', 'b0b0b0b0-0000-0000-0000-00000000000b',
   'boarding', 'Hospedaje', now(), now() + interval '1 day', 50, 'requested');

RESET ROLE;
```

## Aserción C — miembro de Org A SÍ accede a las reservas de su org → 1 fila

Para confirmar que la política no rompe el caso legítimo, Alice lee las reservas de Org A.
**Esperado:** incluye la reserva de Org A (count = 1).

```sql
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111'; -- Alice (Org A)

-- Esperado: 1 (ve su propia reserva)
SELECT count(*) FROM public.reservations
WHERE id = '11110000-0000-0000-0000-00000000000a';

RESET ROLE;

ROLLBACK;  -- descartar fixtures
```

---

## Resumen de criterios de aceptación

| ID | Escenario                                                       | Esperado                              |
|----|-----------------------------------------------------------------|---------------------------------------|
| A  | Políticas anon/public sobre reservations tras la migración      | 0 filas; existe la org-scoped authenticated |
| B  | Usuario de Org A lee/inserta reservas de Org B                   | 0 filas / violación de RLS            |
| C  | Miembro de Org A accede a reservas de su propia org             | devuelve sus reservas                 |
