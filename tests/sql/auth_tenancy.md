# Verificación SQL — Stream C (auth/tenancy)

Migración bajo prueba: `supabase/migrations/20260529030000_fix_invitation_and_idor.sql`.

Este repo **no tiene harness de pg** (no hay runner de SQL en `tests/`), así que las
aserciones se documentan aquí como SQL ejecutable a mano contra una base con la
migración aplicada (p. ej. `supabase db reset` en local, o el SQL editor de Supabase).
Cada bloque indica el resultado esperado.

Funciones cubiertas:

- `public.accept_invitation(p_token text)` — debe rechazar si el email del invite
  difiere del email del usuario autenticado (cierra escalada de privilegios
  cross-tenant; ítem C2 del análisis).
- `public.get_inactive_customer_ids(p_organization_id uuid, p_days int)` — no debe
  devolver datos de organizaciones a las que el usuario autenticado no pertenece
  (cierra IDOR; ítem M2). `service_role` (edge function, `auth.uid()` NULL) conserva
  acceso.

> Nota de auth context: `auth.uid()` lee `request.jwt.claim.sub`. Para simular un
> usuario autenticado en una sesión SQL: `SET LOCAL request.jwt.claim.sub = '<uuid>';`
> y `SET LOCAL ROLE authenticated;`. Para simular la edge function: `SET LOCAL ROLE
> service_role;` SIN fijar el claim `sub` (así `auth.uid()` es NULL).

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

-- Dos usuarios en auth.users con emails distintos
INSERT INTO auth.users (id, email)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'mallory@evil.com')
ON CONFLICT (id) DO NOTHING;

-- Perfiles (el trigger handle_new_user normalmente los crea; los forzamos por si
-- los users se insertan directo en pruebas)
INSERT INTO public.profiles (id, email, first_name, last_name)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com', 'Alice', 'A'),
  ('22222222-2222-2222-2222-222222222222', 'mallory@evil.com', 'Mallory', 'M')
ON CONFLICT (id) DO NOTHING;

-- Alice pertenece a Org A; Mallory no pertenece a ninguna org
INSERT INTO public.organization_members (organization_id, user_id, role)
VALUES ('00000000-0000-0000-0000-0000000000a1',
        '11111111-1111-1111-1111-111111111111', 'admin')
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Invitación de Org A dirigida a alice@example.com, con rol admin
INSERT INTO public.organization_invitations
  (id, organization_id, email, role, token, expires_at)
VALUES
  ('33333333-3333-3333-3333-333333333333',
   '00000000-0000-0000-0000-0000000000a1',
   'alice@example.com', 'admin', 'TOKEN_ALICE_ADMIN', now() + interval '7 days')
ON CONFLICT (id) DO NOTHING;

-- Cliente en Org B (objetivo del IDOR), sin reservas recientes → "inactivo"
INSERT INTO public.customers (id, organization_id, first_name, last_name)
VALUES ('44444444-4444-4444-4444-444444444444',
        '00000000-0000-0000-0000-0000000000b2', 'Bob', 'B')
ON CONFLICT (id) DO NOTHING;
```

(Ajusta columnas NOT NULL adicionales de tu esquema vivo si el INSERT lo pide;
los valores anteriores cubren las columnas relevantes para estas aserciones.)

---

## Aserción C1.a — accept_invitation rechaza email distinto → EXCEPCIÓN

Mallory (`mallory@evil.com`) intenta aceptar el invite de admin dirigido a Alice.
**Esperado:** excepción `Esta invitación es para otro correo electrónico`. Mallory NO
queda en `organization_members` de Org A y el invite sigue sin `accepted_at`.

```sql
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222'; -- Mallory

-- DEBE lanzar: 'Esta invitación es para otro correo electrónico'
SELECT public.accept_invitation('TOKEN_ALICE_ADMIN');

RESET ROLE;

-- Post-condición (correr como superusuario/postgres): ninguna membresía creada
-- Esperado: 0
SELECT count(*) FROM public.organization_members
WHERE organization_id = '00000000-0000-0000-0000-0000000000a1'
  AND user_id = '22222222-2222-2222-2222-222222222222';

-- Esperado: invitación aún sin aceptar (accepted_at IS NULL) → 1
SELECT count(*) FROM public.organization_invitations
WHERE id = '33333333-3333-3333-3333-333333333333' AND accepted_at IS NULL;
```

## Aserción C1.b — accept_invitation acepta el email correcto (regresión: no rompimos el flujo)

Alice (`alice@example.com`) acepta su propio invite.
**Esperado:** devuelve `{"slug":"org-a","role":"admin"}`; Alice queda como miembro
admin de Org A; existe un `staff_members` enlazado (`profile_id = Alice`); el invite
queda con `accepted_at`.

```sql
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111'; -- Alice

-- Esperado: {"slug":"org-a","role":"admin"}
SELECT public.accept_invitation('TOKEN_ALICE_ADMIN');

RESET ROLE;

-- Membresía creada con rol admin → 1
SELECT count(*) FROM public.organization_members
WHERE organization_id = '00000000-0000-0000-0000-0000000000a1'
  AND user_id = '11111111-1111-1111-1111-111111111111'
  AND role = 'admin';

-- Linking de staff preservado: staff_members creado/enlazado para Alice → 1
SELECT count(*) FROM public.staff_members
WHERE organization_id = '00000000-0000-0000-0000-0000000000a1'
  AND profile_id = '11111111-1111-1111-1111-111111111111';

-- Invitación marcada como aceptada → 1
SELECT count(*) FROM public.organization_invitations
WHERE id = '33333333-3333-3333-3333-333333333333' AND accepted_at IS NOT NULL;
```

> Comparación case-insensitive: el guard usa `lower()` en ambos lados, así que
> `Alice@Example.com` también pasaría. Variante opcional: actualizar
> `auth.users.email` de Alice a mayúsculas y repetir C1.b → debe seguir aceptando.

---

## Aserción C2.a — get_inactive_customer_ids con org ajena (usuario normal) → 0 filas

Alice (miembro solo de Org A) consulta inactivos de **Org B**. El guard de tenancy
debe filtrarlo aunque el cliente de Org B esté inactivo.
**Esperado:** 0 filas (no se filtra el ID del cliente de Org B).

```sql
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111'; -- Alice (Org A)

-- Esperado: 0 filas (IDOR cerrado)
SELECT * FROM public.get_inactive_customer_ids('00000000-0000-0000-0000-0000000000b2', 30);

RESET ROLE;
```

## Aserción C2.b — get_inactive_customer_ids con org propia (usuario normal) → devuelve sus inactivos

Para confirmar que el guard no rompe el caso legítimo, insertamos un cliente inactivo
en Org A y dejamos que Alice lo consulte.
**Esperado:** incluye el ID del cliente inactivo de Org A.

```sql
-- (dentro del mismo BEGIN de fixtures)
INSERT INTO public.customers (id, organization_id, first_name, last_name)
VALUES ('55555555-5555-5555-5555-555555555555',
        '00000000-0000-0000-0000-0000000000a1', 'Carol', 'C')
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111'; -- Alice (Org A)

-- Esperado: contiene 55555555-5555-5555-5555-555555555555 → count >= 1
SELECT count(*) FROM public.get_inactive_customer_ids('00000000-0000-0000-0000-0000000000a1', 30)
WHERE get_inactive_customer_ids = '55555555-5555-5555-5555-555555555555';

RESET ROLE;
```

## Aserción C2.c — service_role (edge function) conserva acceso cross-org → devuelve filas

`send-campaign` corre como `service_role`, sin claim `sub` → `auth.uid()` NULL → el
guard se omite por diseño.
**Esperado:** devuelve el cliente inactivo de Org B (1 fila) aun sin membresía.

```sql
SET LOCAL ROLE service_role;   -- sin fijar request.jwt.claim.sub → auth.uid() = NULL

-- Esperado: contiene 44444444-4444-4444-4444-444444444444 → count >= 1
SELECT count(*) FROM public.get_inactive_customer_ids('00000000-0000-0000-0000-0000000000b2', 30)
WHERE get_inactive_customer_ids = '44444444-4444-4444-4444-444444444444';

RESET ROLE;

ROLLBACK;  -- descartar fixtures
```

---

## Resumen de criterios de aceptación

| ID    | Escenario                                                       | Esperado                          |
|-------|-----------------------------------------------------------------|-----------------------------------|
| C1.a  | accept_invitation, email del invite ≠ email del usuario         | EXCEPCIÓN; sin membresía nueva     |
| C1.b  | accept_invitation, email correcto                               | OK; membresía + staff link + accepted_at |
| C2.a  | get_inactive_customer_ids, org ajena, usuario autenticado       | 0 filas (IDOR cerrado)            |
| C2.b  | get_inactive_customer_ids, org propia, usuario autenticado      | devuelve sus inactivos            |
| C2.c  | get_inactive_customer_ids, org cualquiera, service_role         | devuelve filas (bypass del guard) |
