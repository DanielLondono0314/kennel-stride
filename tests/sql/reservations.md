# Verificación SQL — Stream B (create_reservation / anti doble-booking)

> No hay harness de Postgres en el repo (vitest corre en jsdom). Estas son las
> aserciones a ejecutar contra una BD local (`supabase db reset`) o en CI con
> pgTAP. Cubren H2 (doble-booking) y H5 (atomicidad reserva+notice).

Migración: `supabase/migrations/20260529020000_reservation_booking.sql`
Función: `public.create_reservation(uuid,uuid,text,text,timestamptz,timestamptz,numeric,text,uuid)`

## Fixtures
- Org `O1`; usuario `U1` miembro de `O1` (`request.jwt.claim.sub = U1`).
- Cliente `C1` y perro `D1` en `O1`.
- Org ajena `O2` con cliente `C2`/perro `D2`.

## Aserciones

1. **Crea reserva + notice atómicamente (happy path)**
   `SELECT create_reservation(C1, D1, 'daycare', 'Daycare', '2026-06-01 09:00Z', '2026-06-01 17:00Z', 50, '', NULL);`
   → devuelve un uuid; existe 1 fila en `reservations` (status `requested`) y 1 `notices` con `entity_id` = ese uuid.

2. **Rechaza solapamiento del mismo perro (H2)**
   Tras (1), `create_reservation(C1, D1, 'daycare', 'Daycare', '2026-06-01 12:00Z', '2026-06-01 15:00Z', 50, '', NULL);`
   → `RAISE EXCEPTION 'El perro ya tiene una reserva que se solapa en ese horario'`. No se crea fila.

3. **Permite reservas contiguas (rango half-open '[)')**
   `create_reservation(C1, D1, ..., '2026-06-01 17:00Z', '2026-06-01 19:00Z', ...)` justo cuando termina (1)
   → OK (no solapa en el borde).

4. **Ignora reservas canceladas/completadas al chequear solapamiento**
   Si la reserva de (1) pasa a `cancelled`, repetir (2) → OK (ya no bloquea).

5. **Pertenencia: cliente de otra org (tenancy)**
   Con `sub = U1`, `create_reservation(C2, D2, ...)` → `RAISE EXCEPTION 'Cliente inválido o fuera de tu organización'`.

6. **Pertenencia: perro de otra org**
   `create_reservation(C1, D2, ...)` → `RAISE EXCEPTION 'Perro inválido o fuera de tu organización'`.

7. **Validación de fechas**
   `p_end <= p_start` → `RAISE EXCEPTION 'La fecha de fin debe ser posterior al inicio'`.
