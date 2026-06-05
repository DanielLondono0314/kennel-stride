# Diseño — Acople Reserva ⇆ Perrera en el flujo operativo

**Fecha:** 2026-06-04
**Estado:** Aprobado para planificación
**Enfoque elegido:** A — Selección de perrera dentro del Check-in

## Problema

Hoy la app tiene todas las piezas del flujo operativo, pero **desacopladas**:

- Crear reserva (`create_reservation` RPC) y asignar perrera (`KennelAssignmentModal` sobre `facility_units`) son dos pasos manuales independientes.
- `reservations.location_id` existe pero **nunca se setea**.
- El `CheckInModal` muestra `Ubicación: Sin asignar` y no ofrece elegir perrera.
- Nada garantiza la regla de negocio: **un perro con reserva en curso debe ocupar una perrera por su estadía**.

## Flujo objetivo (operado por staff/recepción)

```
1. Registrar CLIENTE
        ↓ (el sistema sugiere crear su perro; no obliga)
2. Crear PERRO  → ligado al cliente
        ↓
3. Crear RESERVA → cliente + perro + tipo de servicio (plan) + fechas (duración) + precio
        → nace 'requested'  (sin perrera todavía)
        ↓
4. APROBAR → 'scheduled' + entrenador  (sin perrera todavía)
        ↓
5. CHECK-IN (cuando el perro llega)
        → staff elige PERRERA LIBRE (o crea una nueva ahí mismo)
        → perrera ocupada por la estadía (fechas de la reserva)
        → perrera ligada a la reserva (location_id)
        → 'checked_in'
        ↓
6. CHECK-OUT → libera la perrera → 'completed'
```

### Reglas de negocio (decididas en brainstorming)

- **Quién lo opera:** staff / recepción (no autoservicio del cliente).
- **"Plan de trabajo" = `service_type`** ya existente (Guardería, Internado+Entrenamiento, Sesión, Grooming, Evaluación). No se introduce un concepto nuevo de programa ni se usan `packages` en este flujo.
- **Toda reserva ocupa perrera** (al check-in).
- **Una perrera = un perro** a la vez (sin capacidad compartida).
- **Disponibilidad "solo ahora mismo":** no se rastrea una línea de tiempo de disponibilidad futura; una perrera está simplemente `available` u `occupied`.
- **Momento de elegir/bloquear perrera:** en el **check-in** (cuando el perro llega y hay disponibilidad real), no al crear ni al aprobar.
- **Reserva creada por staff sigue requiriendo aprobación** (`requested` → `scheduled`).
- **Cliente sin perro:** se permite; el sistema guía a crear el perro pero no lo obliga.
- **Si no hay perrera libre en el check-in:** el staff crea una nueva perrera en el momento (no se bloquea el check-in).

## Arquitectura

### Sección 1 — Modelo de datos

No se crean tablas nuevas. El modelo "una perrera = un perro" + "disponibilidad solo ahora" encaja con los campos denormalizados que `facility_units` ya tiene:

| Campo `facility_units` | Uso |
|---|---|
| `status` | `available` → `occupied` → `available` |
| `assigned_dog_id` / `assigned_dog_name` | el perro de la reserva |
| `assignment_start` / `assignment_end` | = `start_date` / `end_date` de la reserva |
| **`assigned_reservation_id` (NUEVO)** | liga perrera ⇆ reserva para liberarla en el check-out |

Del lado de `reservations`, ya existe `location_id` (FK a `facility_units`), hoy sin usar.

**Único cambio de esquema:** agregar `assigned_reservation_id uuid` a `facility_units`, FK a `reservations(id)` con `ON DELETE SET NULL`.

> `assigned_dog_id` se deja como `text` (no FK) para no romper datos existentes.

### Sección 2 — Lógica transaccional (RPCs)

Dos funciones `SECURITY DEFINER SET search_path = public`, con validación multi-tenant vía `get_user_org_ids()` (mismo patrón que `create_reservation`). Toda la lógica crítica vive en la base de datos para evitar condiciones de carrera.

**`check_in_reservation(p_reservation_id uuid, p_unit_id uuid, p_notes text DEFAULT '')`**, una transacción:
1. Reserva existe, pertenece a una org del usuario y está en `scheduled`. Si no → excepción clara.
2. Perrera existe, es de la misma org y `status = 'available'` **en este instante**. Si otro staff la ocupó → excepción: "Esa perrera acaba de ocuparse, elige otra."
3. Ocupa la perrera: `status='occupied'`, `assigned_dog_id/name` = perro de la reserva, `assignment_start/end` = `start_date/end_date` de la reserva, `assigned_reservation_id` = la reserva.
4. Actualiza reserva: `status='checked_in'`, `check_in_time=now()`, `location_id` = la perrera.
5. Inserta `notice` de entrada (consistente con `create_reservation`).
6. `GRANT EXECUTE ... TO authenticated`.

**`check_out_reservation(p_reservation_id uuid)`**, una transacción:
1. Reserva en `checked_in` / `in_progress` / `ready`, de la org del usuario.
2. Libera la perrera con `assigned_reservation_id = p_reservation_id`: `status='available'`, limpia `assigned_dog_id/name`, `assignment_start/end`, `assigned_reservation_id`. **Idempotente:** si ya está liberada, no falla.
3. Actualiza reserva: `status='completed'`, `check_out_time=now()`.
4. Inserta `notice` de salida.
5. `GRANT EXECUTE ... TO authenticated`.

**Crear perrera nueva** NO va en el RPC: se hace con un `insert` normal en `facility_units` desde el modal de check-in, y luego su `id` se pasa a `check_in_reservation`.

### Sección 3 — Cambios de UI

**`CheckInModal`** gana una sección "Perrera" donde hoy muestra `Ubicación: Sin asignar`:
- Selector que lista solo perreras `status='available'` de la organización (consulta en vivo al abrir).
- Opción **"+ Crear perrera nueva…"** → mini-form inline **mínimo (nombre + zona)**, status `available` → inserta en `facility_units` → la selecciona automáticamente.
- **"Confirmar Check-in" deshabilitado mientras no haya perrera elegida** (hace imposible saltar la regla).
- Si el RPC devuelve "perrera ya ocupada" → refresca la lista y muestra toast para reintentar.

**`useReservations`**:
- `checkIn(id)` → `checkIn(id, unitId, notes)` que llama a `check_in_reservation`.
- `checkOut(id)` → llama a `check_out_reservation` (ya no toca la perrera manualmente).

**`FacilityPage` / `KennelGrid`**: sin cambios obligatorios. Las perreras ocupadas vía check-in ahora se ven con su perro y fechas. El flujo manual de `KennelAssignmentModal` queda como respaldo (posible deprecación posterior, fuera de alcance).

### Sección 4 — Casos borde

| Situación | Comportamiento |
|---|---|
| Dos staff eligen la misma perrera a la vez | El RPC valida `status='available'` en la transacción; el segundo recibe error y reintenta. |
| No hay perreras libres | "+ Crear perrera nueva" en el modal; check-in no se bloquea. |
| Check-out con perrera ya liberada manualmente | RPC libera solo si `assigned_reservation_id` coincide; idempotente. |
| Cliente sin perro en el paso de reserva | Selector de perro vacío con CTA "crear perro". |
| Reserva en `requested` | No aparece para check-in; primero aprobar. |

## Pruebas

Siguiendo el patrón de `tests/`:
- `check_in_reservation`: ocupa perrera + liga reserva atómicamente; rechaza perrera ya ocupada; rechaza reserva de otra org; rechaza reserva no-`scheduled`.
- `check_out_reservation`: libera la perrera correcta; idempotente si ya liberada.
- Concurrencia: dos check-ins a la misma perrera → uno falla.
- UI: "Confirmar" deshabilitado sin perrera; crear perrera inline la selecciona.

## Fuera de alcance

- Línea de tiempo de disponibilidad futura / pre-reserva de perreras.
- Capacidad compartida (varios perros por perrera).
- Concepto de "programa estructurado" de entrenamiento.
- Uso de `packages`/créditos en este flujo.
- Deprecación del `KennelAssignmentModal` manual.
- Autoservicio del cliente.

## Archivos afectados (estimado)

- **Nueva migración** `supabase/migrations/`: `ALTER TABLE facility_units ADD assigned_reservation_id`; `create_reservation` sin cambios; nuevos RPCs `check_in_reservation`, `check_out_reservation` + grants.
- `src/components/checkin/CheckInModal.tsx` — selector de perrera + crear inline.
- `src/hooks/useReservations.ts` — firmas de `checkIn`/`checkOut` → RPCs.
- Callers de `checkIn`/`checkOut` (`Dashboard.tsx`, donde apliquen).
- `tests/` — pruebas de RPCs y UI.
