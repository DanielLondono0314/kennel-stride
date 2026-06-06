# Verificación SQL — Intake clínico del perro (alergias / medicación / JSONB)

> No hay harness de Postgres en el repo (vitest corre en jsdom). Estas son las
> aserciones a ejecutar contra una BD local (`supabase db reset`).

Migración: `supabase/migrations/20260606000000_dog_clinical_intake.sql`

## Fixtures
- Org `O1`; usuario `U1` miembro de `O1` (`request.jwt.claim.sub = U1`).
- Org ajena `O2`; perro `D2` en `O2`.
- Cliente `C1`, perro `D1` en `O1`.

## Aserciones — esquema
1. `\d public.dogs` muestra columnas `aggression_details jsonb` y `feeding jsonb`.
2. `\d public.dog_allergies` y `\d public.dog_medications` existen con sus columnas/CHECKs.
3. `dog_medications.end_date` es columna generada: insertar fila con
   `start_date='2026-06-01'`, `duration_days=10` → `end_date = '2026-06-11'`.
   Insertar con `start_date=NULL` → `end_date IS NULL`.
4. CHECKs rechazan valores fuera de dominio:
   `INSERT ... dog_allergies(type) VALUES ('otro')` → error;
   `INSERT ... dog_medications(route) VALUES ('rectal')` → error.

## Aserciones — RLS (como U1)
5. Insertar alergia para `D1` con `organization_id=O1` → OK.
6. `SELECT` de `dog_allergies` solo devuelve filas de O1 (no las de O2).
7. Insertar alergia con `organization_id=O2` → bloqueado por WITH CHECK.
8. Mismo set de pruebas para `dog_medications`.

## Aserciones — cascada
9. `DELETE FROM dogs WHERE id=D1` → borra en cascada sus filas en
   `dog_allergies` y `dog_medications` (0 filas restantes para `dog_id=D1`).
