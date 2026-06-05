# Verificación SQL — Acople Reserva ⇆ Perrera (check_in / check_out)

> No hay harness de Postgres en el repo (vitest corre en jsdom). Estas son las
> aserciones a ejecutar contra una BD local (`supabase db reset`) o en CI con
> pgTAP.

Migración: `supabase/migrations/20260604000000_reservation_kennel_coupling.sql`
Funciones: `public.check_in_reservation(uuid,uuid,text)`, `public.check_out_reservation(uuid)`

## Fixtures
- Org `O1`; usuario `U1` miembro de `O1` (`request.jwt.claim.sub = U1`).
- Cliente `C1`, perro `D1` en `O1`. Perrera `K1` (`facility_units`, status `available`, org `O1`).
- Reserva `R1` de `D1`/`C1` en `O1`, status `scheduled`, start/end definidos.
- Org ajena `O2` con reserva `R2` (`scheduled`) y perrera `K2`.

## Aserciones — check_in_reservation

1. **Happy path:** `SELECT check_in_reservation(R1, K1, 'sin novedad');`
   → `K1.status='occupied'`, `K1.assigned_dog_id=D1`, `K1.assignment_start/end` = `R1.start_date/end_date`,
     `K1.assigned_reservation_id=R1`; `R1.status='checked_in'`, `R1.check_in_time` no nulo,
     `R1.location_id=K1`; existe 1 `notices` con `entity_id=R1`.
2. **Perrera ya ocupada:** repetir con `K1` ya `occupied` (o pasarla a otra reserva)
   → `RAISE EXCEPTION 'Esa perrera no está disponible, elige otra'`. Sin cambios.
3. **Reserva no aprobada:** con `R1.status='requested'`, `check_in_reservation(R1, K1, '')`
   → `RAISE EXCEPTION 'Reserva inválida, fuera de tu organización o no está aprobada'`.
4. **Tenancy reserva ajena:** con `sub=U1`, `check_in_reservation(R2, K1, '')`
   → misma excepción de reserva inválida (no es de O1).
5. **Tenancy perrera ajena:** `check_in_reservation(R1, K2, '')`
   → `RAISE EXCEPTION 'Esa perrera no está disponible, elige otra'` (K2 no es de O1).

## Aserciones — check_out_reservation

6. **Happy path:** tras (1), `SELECT check_out_reservation(R1);`
   → `K1.status='available'` y todos los campos `assigned_*`/`assignment_*` en NULL;
     `R1.status='completed'`, `R1.check_out_time` no nulo; existe `notices` de salida.
7. **Idempotente / perrera ya liberada:** liberar `K1` manualmente, luego `check_out_reservation(R1)`
   → no falla; `R1.status='completed'`.
8. **Estado inválido:** `check_out_reservation(R1)` con `R1.status='requested'`
   → `RAISE EXCEPTION 'Reserva inválida, fuera de tu organización o no está en curso'`.
9. **Tenancy:** `check_out_reservation(R2)` con `sub=U1` → misma excepción de reserva inválida.

## Concurrencia (manual, dos sesiones psql)
10. Dos `check_in_reservation(_, K1, _)` simultáneos sobre `K1` disponible:
    el `FOR UPDATE` serializa; uno ocupa, el otro recibe la excepción de "no disponible".
