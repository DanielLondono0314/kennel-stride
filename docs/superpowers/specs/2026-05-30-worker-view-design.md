# Vista de Trabajador — Diseño

**Fecha:** 2026-05-30
**Branch:** `worktree-worker-view` (desde `origin/main`)
**Estado:** Aprobado (diseño) — pendiente plan de implementación

## Resumen

KennelStride hoy tiene un único app (vista admin) que todos los miembros de la
organización ven por igual, con permisos aplicados de forma desigual (gating real
en RLS solo para finanzas y staff; el resto del menú es visible para todos).

Este diseño introduce una **vista dedicada y simplificada (mobile-first) para el
personal operativo de campo** —entrenadores, aseo, bienestar animal y
veterinarios— que **reemplaza** el app admin para esos usuarios. El personal de
recepción (`front_desk`) y administración sigue en la vista admin y es quien
**programa y asigna** el trabajo.

El objetivo: que cada trabajador vea *su día* (reservas + tareas asignadas),
ejecute su trabajo y lo **reporte** con un formulario adecuado a su especialidad,
sin exponerle finanzas, configuración, ni el trabajo de otros.

## Decisiones de diseño (del brainstorming)

1. **UI dedicada y simplificada** (mobile-first) en lugar del app admin para workers.
2. **Separar rol (permiso) de especialidad (oficio).**
3. **Modelo de trabajo híbrido:** reservas existentes + entidad nueva `tasks` ligera.
4. **Reporte por especialidad** (mini-formulario distinto por oficio).
5. **Redirección automática por rol** al iniciar sesión; separación estricta de rutas.

## 1. Modelo de roles y especialidades

### Roles (nivel de permiso) — 4 valores

| Rol | Vista | Resumen |
|-----|-------|---------|
| `admin` | Admin | Todo, incl. staff/settings/finanzas/reportes/asignación |
| `manager` | Admin | Operación + finanzas + reportes + asignación; sin staff/settings |
| `front_desk` | Admin | Operación + finanzas operativas; **programa y asigna tareas/reservas** |
| `worker` | **Worker** | Solo su trabajo asignado: ejecuta y reporta |

**Migración:** el rol actual `trainer` se migra a `worker`. El enum `app_role`
pasa a `('admin','manager','front_desk','worker')`. Los staff que eran `trainer`
quedan con `role = 'worker'` y `specialty = 'trainer'`.

### Especialidad / departamento — campo nuevo

Campo `specialty` en `staff_members` (y/o `organization_members`, ver §3). Valores
iniciales (extensible):

- `trainer` — Entrenador
- `groomer` — Grooming
- `cleaning` — Aseo
- `welfare` — Bienestar animal (alimentación, paseos)
- `vet` — Veterinario

La especialidad **no cambia el nivel de permiso**; determina qué *tipos de tarea*
recibe el trabajador y qué *formulario de reporte* usa (§4). Decisión abierta para
el plan: una sola especialidad por staff (simple) vs. múltiples. Por defecto:
**una sola** (YAGNI); se puede ampliar después.

## 2. Modelo de trabajo (híbrido)

### Reservas (existente)

`reservations` ya es una unidad de trabajo asignable: tiene `staff_id`,
`service_type` (`daycare`, `board_and_train`, `training_session`, `grooming`,
`evaluation`) y ciclo de estados
(`requested → scheduled → checked_in → in_progress → ready → picked_up → completed | cancelled`).
Se reutiliza tal cual para servicios agendados.

### Tareas (entidad nueva, ligera)

Para trabajo que **no** es una reserva (aseo de zona, rondas de alimentación,
paseos, chequeo veterinario):

```
public.tasks
  id               uuid PK
  organization_id  uuid NOT NULL  → organizations
  type             text NOT NULL  -- 'cleaning' | 'feeding' | 'walk' | 'vet_check' | 'other'
  title            text NOT NULL
  dog_id           uuid NULL      → dogs        (cuando aplica a un perro)
  zone_id          uuid NULL      → facility_zones (cuando aplica a una zona)
  assignee_staff_id uuid NULL     → staff_members
  due_at           timestamptz NULL
  priority         text NOT NULL DEFAULT 'normal' -- 'low'|'normal'|'high'
  status           text NOT NULL DEFAULT 'pending' -- 'pending'|'in_progress'|'done'|'skipped'
  notes            text
  created_by       uuid NULL      → auth.users
  completed_at     timestamptz NULL
  completed_by     uuid NULL      → staff_members
  created_at       timestamptz NOT NULL DEFAULT now()
  updated_at       timestamptz NOT NULL DEFAULT now()
```

### Feed unificado "Mi día"

El worker ve reservas asignadas (`staff_id = su staff`) + tareas asignadas
(`assignee_staff_id = su staff`) del día, fusionadas, ordenadas por hora y
agrupadas por estado (Pendiente / En curso / Hecho).

## 3. Datos y seguridad (RLS)

### Quién ve qué

- **Worker:** lee/escribe **solo lo asignado a él** (sus `tasks`, sus
  `reservations`) + **lectura** de la ficha del perro implicado (`dogs`,
  banderas, datos clínicos relevantes para la tarea). No lee finanzas, no lee
  tareas/reservas de otros, no `settings`.
- **front_desk / manager / admin:** crean y asignan tareas; ven todo el tablero.

### Endurecimiento RLS

Hoy las tablas operativas tienen `FOR ALL` para cualquier miembro con suscripción
vigente. Con el rol `worker` se restringe:

- `tasks`: SELECT/UPDATE del worker limitado a `assignee_staff_id = (su staff)`;
  INSERT/asignación solo `front_desk/manager/admin` (reusar
  `get_finance_writer_org_ids` o un nuevo `get_scheduler_org_ids`).
- `reservations`: el worker solo actualiza estado/campos de las reservas donde es
  `staff_id`; crear/reasignar solo scheduler roles.
- Escrituras **clínicas** (`medical_history`, `vaccination_schedule`,
  `deworming_records`, `medical_conditions`): restringir a especialidad `vet`
  (+ admin/manager). Cierra el hueco actual donde cualquier miembro escribe clínica.
- `report_cards`: escribibles por especialidad `trainer` (+ admin/manager).

Patrón: helpers `SECURITY DEFINER` (alineado con el patrón existente de
`get_*_org_ids`) que devuelvan el `staff_id` del usuario y/o validen especialidad.

> **Nota de seguridad pendiente:** `reservations` tiene hoy una política
> `Anon full access` (`FOR ALL TO public USING (true)`). Debe revisarse/eliminarse
> como parte de este trabajo o referenciarse a la remediación; un worker no debe
> depender de acceso anónimo. Se detalla en el plan.

## 4. Reporte por especialidad

Al cerrar una tarea/reserva, mini-formulario según `specialty`:

| Especialidad | Formulario | Destino de datos |
|--------------|-----------|------------------|
| `trainer` | Report Card: puntajes (energía, socialización, obediencia, apetito), notas, highlights, fotos | `report_cards` (existente) |
| `vet` | Nota clínica / medicación / vacuna | `medical_history` / `vaccination_schedule` / `deworming_records` / `medical_conditions` |
| `cleaning` | Checklist de zona + foto opcional | `tasks` (status + notes + fotos) |
| `welfare` | Registro alimentación/paseo (hora, cantidad, notas) | `tasks` (campos estructurados en notes/JSON) |
| `groomer` | Notas de grooming + fotos antes/después | `tasks` / report ligero |

Todos cierran con `status = done`, `completed_at`, `completed_by`.

## 5. Experiencia del trabajador (mobile-first)

Ruta raíz `/worker` (con `:orgSlug` según convención actual de `useOrgNavigate`).
Sin sidebar admin; navegación inferior simple.

- **Mi día** (`/worker`): tarjetas (foto/nombre del perro, tipo, hora, zona,
  banderas de alerta: agresivo / alergias / medicación). Agrupadas por estado.
- **Detalle** (`/worker/task/:id` o `/worker/reservation/:id`): info del perro +
  acción primaria grande ("Iniciar" → "Completar y reportar").
- **Reportar:** formulario por especialidad (§4).
- **Avisos** (`/worker/notices`): notificaciones que le conciernen.
- **Perfil** (`/worker/profile`): datos, especialidad, cerrar sesión.

Nav inferior: **Mi día · Avisos · Perfil**.

## 6. Entrada y enrutamiento

- Al iniciar sesión, según `currentUserRole`:
  - `worker` → redirige a `/:orgSlug/worker`.
  - `admin`/`manager`/`front_desk` → dashboard admin (comportamiento actual).
- Un **guard** impide que `worker` abra rutas admin (lo redirige a `/worker`) y
  que roles admin entren "por error" a `/worker` salvo decisión futura de
  "modo supervisión" (fuera de alcance ahora — YAGNI).
- Reutiliza `ProtectedRoute` / `OrgGuard` existentes; se añade un
  `WorkerRoute`/role-guard.

## 7. Responsabilidades ("qué deben/se espera que hagan")

Se codifica vía: cada especialidad tiene un conjunto de **tipos de tarea
esperados**, agendados por front_desk/admin. Operacionalmente:

- **Qué pueden hacer:** ver y ejecutar sus tareas/reservas; reportar; leer la
  ficha del perro implicado.
- **Qué deben hacer:** cerrar cada tarea con su formulario de reporte antes de fin
  de turno.
- **Qué se espera:** completar las tareas del día asignadas; las banderas de
  alerta del perro deben revisarse antes de manipularlo.
- **Cómo se reportan:** formulario por especialidad → cierre con timestamp + autor;
  el reporte queda visible para front_desk/admin y (en el caso de report cards)
  enviable al dueño.

Matriz especialidad → tipos de tarea → formulario (detallada en el plan):

| Especialidad | Tipos de tarea típicos |
|--------------|------------------------|
| trainer | training_session, evaluation, daycare (report card) |
| vet | vet_check, vacunación, desparasitación |
| cleaning | cleaning (zona/unidad) |
| welfare | feeding, walk |
| groomer | grooming |

## 8. Alcance y fases (para el plan)

1. **Modelo de datos + migración de rol/especialidad + tabla `tasks` + RLS.**
2. **Routing + guard + shell de la vista worker** (Mi día mostrando reservas).
3. **Tareas no-reserva + creación/asignación** desde la vista admin (front_desk).
4. **Formularios de reporte por especialidad.**

## Alternativas descartadas

- **Roles inflados** (un rol por oficio): mezcla permiso y oficio; la matriz de
  permisos crece y se enreda.
- **Solo reusar reservas**: no cubre aseo/alimentación/paseos, que no son reservas.
- **Reporte universal genérico**: más simple, pero menos útil para el dueño del
  perro y para el control operativo.
- **Vista por defecto + toggle / URL separada**: añade complejidad de sesión sin
  necesidad inmediata; la redirección por rol es más simple y segura.

## Preguntas abiertas (resolver en el plan)

- ¿`specialty` vive en `staff_members`, `organization_members`, o ambos? (el rol
  vive en `organization_members`; el detalle operativo en `staff_members`).
- ¿Una o varias especialidades por staff? (default: una).
- ¿Cómo se mapea el usuario autenticado a su `staff_member` (vía `profile_id`)?
- Política `Anon full access reservations`: eliminar/endurecer dentro de este
  trabajo o referenciar a remediación.
