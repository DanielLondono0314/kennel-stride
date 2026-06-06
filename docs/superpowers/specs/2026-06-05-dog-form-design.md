# Rediseño del formulario de perro (DogModal) — Design Spec

**Fecha:** 2026-06-05
**Estado:** Diseño aprobado (brainstorm). Listo para `writing-plans`.

## Goal

Ampliar el formulario de registro/edición de perro (`DogModal`) para capturar
datos **estructurados** de agresividad, alergias, medicación y alimentación, en
lugar de los 3 booleanos sueltos + 3 textareas libres actuales. El objetivo es
que recepción (front_desk/admin) registre información accionable y que el modelo
de datos quede listo para generar tareas de worker (comida/medicación) en la
fase siguiente.

## Scope

**Dentro:**
- Sub-formularios condicionales para agresividad, alergias y medicación
  (desplegados por toggle).
- Sección de alimentación **siempre visible y obligatoria**.
- Listas repetibles (varias alergias / varios medicamentos por perro).
- Cambios de esquema: 2 columnas JSONB en `dogs` + 2 tablas nuevas
  (`dog_allergies`, `dog_medications`) con RLS org-scoped.
- Persistencia desde `DogsPage.handleSave` (upsert de `dogs` + sync de filas
  hijas).

**Fuera (fase siguiente, NO en este spec):**
- Generación automática de tareas de comida/medicación hacia la tabla `tasks`.
- Tablas clínicas vet-gated (`medical_conditions`, `medical_history`,
  `vaccination_schedule`, `deworming_records`) — esas las escribe el rol clínico,
  no el intake.
- Histórico/versionado de medicaciones más allá de las columnas base.

## Contexto del código actual

- Form: `src/components/dogs/DogModal.tsx`. Hoy: foto, dueño, nombre, raza,
  género, fecha nac., peso, color, microchip, castrado, **3 toggles booleanos**
  (`is_aggressive` / `has_allergies` / `on_medication`) y **3 textareas libres**
  (`notes` / `behavior_notes` / `medical_notes`).
- Validación: `src/lib/schemas.ts` `dogSchema` (línea 54).
- Persistencia: `src/pages/DogsPage.tsx` `handleSave` (línea 89) — arma un
  payload plano y hace un `update` o `insert` directo sobre `dogs`.
- Los 3 booleanos alimentan las alertas de "Mi día" del worker-view (en prod).
- La tabla `tasks` ya tiene el tipo `feeding` (loop de tareas = fase futura).

## Decisiones de diseño (confirmadas)

1. **Alcance:** solo el formulario ahora. La generación de tareas es fase
   siguiente; el modelo de datos debe quedar listo para ella.
2. **Alimentación – horario:** nº de comidas/día **sin hora fija** + porción por
   comida (las tareas futuras se agruparán por turno mañana/tarde).
3. **Multiplicidad:** alergias y medicamentos son **listas** (filas repetibles).
4. **Alimentación es OBLIGATORIA:** el guardado exige como mínimo `food_type` +
   `meals_per_day`. (Decisión 2026-06-05.)
5. **Apagar un toggle con datos → limpiar con confirmación:** si el usuario apaga
   agresivo/alergias/medicación teniendo datos cargados, se pide confirmación
   ("¿Descartar los datos de …?"). Si confirma, se borran los datos del
   sub-form y el flag pasa a `false`. Si cancela, el toggle permanece encendido.
   (Decisión 2026-06-05.)

## Modelo de datos

Enfoque **híbrido**: cardinalidad 1-a-1 → JSONB en `dogs`; 1-a-muchos → tablas
nuevas.

### 1. `dogs` — dos columnas JSONB nuevas

Se **conservan** los 3 booleanos (siguen siendo los flags que disparan las
alertas del worker-view) y las 3 notas libres.

```sql
ALTER TABLE public.dogs
  ADD COLUMN IF NOT EXISTS aggression_details jsonb,
  ADD COLUMN IF NOT EXISTS feeding jsonb;
```

- `aggression_details` (presente solo si `is_aggressive = true`):
  ```jsonc
  {
    "severity": "baja" | "media" | "alta",
    "handling": "texto libre de manejo",
    "requires_muzzle": false,
    "handle_alone": false,
    "no_other_dogs": false
  }
  ```
- `feeding` (siempre presente; obligatorio):
  ```jsonc
  {
    "food_type": "seco" | "humedo" | "crudo" | "mixto",   // requerido
    "brand": "marca/producto",                            // opcional
    "meals_per_day": 2,                                    // requerido (entero ≥1)
    "portion_amount": 150,                                 // opcional (número >0)
    "portion_unit": "g" | "taza" | "scoop",                // opcional
    "instructions": "instrucciones especiales"             // opcional
  }
  ```

> La forma del JSONB la valida la capa de aplicación (zod). No se añaden CHECKs
> de estructura JSONB en la BD para no acoplar el esquema a cambios de UI.

### 2. `dog_allergies` (1-a-muchos)

```sql
CREATE TABLE public.dog_allergies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id          uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  allergen        text NOT NULL,
  type            text NOT NULL CHECK (type IN ('comida','ambiental','medicamento')),
  reaction        text,
  severity        text CHECK (severity IN ('baja','media','alta')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dog_allergies_dog ON public.dog_allergies(dog_id);
```

### 3. `dog_medications` (1-a-muchos, con ciclo de vida para task-gen futura)

```sql
CREATE TABLE public.dog_medications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id          uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  dose            text,
  frequency       text,
  duration_days   integer CHECK (duration_days IS NULL OR duration_days > 0),
  start_date      date,
  route           text CHECK (route IN ('oral','topica','inyectable')),
  with_food       boolean NOT NULL DEFAULT false,
  -- end_date derivada. `date + integer` → date (inmutable), apto para STORED.
  end_date        date GENERATED ALWAYS AS (
                    CASE WHEN start_date IS NOT NULL AND duration_days IS NOT NULL
                         THEN start_date + duration_days
                         ELSE NULL END
                  ) STORED,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dog_medications_dog ON public.dog_medications(dog_id);
```

> `is_active` (¿la medicación sigue vigente hoy?) se deriva en lectura
> (`end_date IS NULL OR end_date >= current_date`) en la fase de task-gen; no se
> persiste para evitar columnas que dependan de `now()`.

### RLS (ambas tablas)

Org-scoped, mismo patrón que `dogs` — es **intake**, NO vet-gated. Se reutiliza
el helper `SECURITY DEFINER public.get_user_org_ids()` (ya existente, usado por
las RPCs de check-in).

```sql
ALTER TABLE public.dog_allergies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dog_medications ENABLE ROW LEVEL SECURITY;
-- Por tabla, una policy FOR ALL (o SELECT/INSERT/UPDATE/DELETE) con:
--   USING      (organization_id IN (SELECT public.get_user_org_ids()))
--   WITH CHECK (organization_id IN (SELECT public.get_user_org_ids()))
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dog_allergies   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dog_medications TO authenticated;
```

## UX / Comportamiento del formulario

El `DogModal` mantiene su estructura actual (foto, datos básicos, castrado) y
**reemplaza** el bloque "Alertas de comportamiento/salud" + las 3 textareas por:

1. **Toggles que despliegan sub-form inline** (uno por flag):
   - **Perro agresivo** (`is_aggressive`): al encender, muestra
     severidad (select baja/media/alta), manejo (textarea) y 3 flags rápidos
     (requiere bozal, manejar a solas, no con otros perros).
   - **Tiene alergias** (`has_allergies`): al encender, muestra una **lista
     repetible** de filas (alérgeno, tipo comida/ambiental/medicamento, reacción,
     severidad). Botón "Añadir alergia".
   - **En medicación** (`on_medication`): al encender, muestra una **lista
     repetible** de filas (nombre, dosis, frecuencia, duración días, fecha
     inicio, vía oral/tópica/inyectable, ¿con comida?). Botón "Añadir
     medicamento".

2. **Alimentación — SIEMPRE visible y obligatoria.** Sección fija (sin toggle)
   con: tipo (seco/húmedo/crudo/mixto), marca/producto, nº comidas/día, porción
   por comida + unidad (g/taza/scoop), instrucciones especiales.

3. **Cross-link alergia-comida ⚠️:** las alergias de `type = 'comida'` se
   resaltan con un aviso junto a la sección de Alimentación (p. ej. "⚠️ Alergias
   alimentarias: pollo, lácteos") para que recepción no asigne una dieta
   conflictiva.

4. **Notas libres:** se conservan las 3 textareas (`notes`, `behavior_notes`,
   `medical_notes`) como campos de texto general (no se eliminan).

### Reglas de validación

- **Toggle ON ⇒ su sub-form es requerido:**
  - Agresivo: severidad + manejo no vacío.
  - Alergias: ≥1 fila completa (alérgeno + tipo).
  - Medicación: ≥1 fila completa (nombre como mínimo).
- **Alimentación (obligatoria):** `food_type` + `meals_per_day` (entero ≥1)
  requeridos para guardar. El resto opcional.
- Si una validación falla, el guardado se bloquea con toast señalando el campo.

### Apagar un toggle con datos (limpiar con confirmación)

- Toggle pasa de ON→OFF **sin datos** cargados: se apaga directamente.
- Toggle pasa de ON→OFF **con datos** cargados: se abre un `AlertDialog`
  ("¿Descartar los datos de [agresividad|alergias|medicación]?"). Confirmar →
  limpia el estado del sub-form (JSONB a `null` / filas a `[]`) y deja el flag en
  `false`. Cancelar → el toggle vuelve a ON y los datos permanecen.

## Persistencia (guardado)

`DogModal.handleSubmit` arma el payload extendido; `DogsPage.handleSave` lo
persiste. Secuencia:

1. **Upsert de `dogs`** (mismo `update`/`insert` actual) con los campos de hoy +
   `aggression_details` (jsonb o `null`) + `feeding` (jsonb) + los 3 booleanos en
   sync con sus toggles.
2. **Sync de filas hijas** para `dog_allergies` y `dog_medications`: estrategia
   **delete-all + insert** por `dog_id` (borrar las filas existentes del perro e
   insertar las actuales del form). Es simple, idempotente y adecuado para listas
   cortas de intake.
   - Si el toggle está OFF, la lista actual es `[]` → quedan 0 filas.

> **Atomicidad:** igual que el guardado de `dogs` actual, esta secuencia se hace
> con llamadas de cliente, no en una única transacción. Para listas de intake el
> riesgo de guardado parcial es bajo y aceptable. Si más adelante se quiere
> atomicidad fuerte, se envuelve el paso 2 en una RPC
> `sync_dog_clinical(dog_id, allergies jsonb, medications jsonb)` — fuera de
> alcance de este spec.

### Validación (zod)

`dogSchema` se extiende (o se añade un schema compañero) con:
- `feeding`: objeto requerido con `food_type` (enum) + `meals_per_day`
  (int ≥1) requeridos; resto opcional.
- `aggression_details`: objeto opcional; requerido (severity + handling) solo si
  `is_aggressive`.
- `allergies`: array; cada fila `{ allergen, type, reaction?, severity? }`.
- `medications`: array; cada fila `{ name, dose?, frequency?, duration_days?,
  start_date?, route?, with_food }`.

## Componentes / aislamiento

`DogModal` ya es grande (~413 líneas). Para no inflarlo más, los 3 sub-forms
nuevos se extraen como componentes hijos controlados (estado en el padre,
props in/out):

- `AggressionFields` — severidad + manejo + 3 flags.
- `AllergyList` — lista repetible de filas de alergia (añadir/quitar fila).
- `MedicationList` — lista repetible de filas de medicación.
- `FeedingFields` — sección fija de alimentación.

Cada uno: recibe su valor + onChange, no toca Supabase, es testeable aislado.

## Testing

- **Schema (zod):** alimentación obligatoria (falla sin `food_type`/
  `meals_per_day`); sub-forms requeridos cuando su flag está ON; filas de
  alergia/medicación bien tipadas.
- **DogModal (vitest + @testing-library/react):**
  - "Crear perro" deshabilitado / toast si falta alimentación.
  - Encender toggle revela el sub-form; apagar con datos abre el AlertDialog;
    confirmar limpia; cancelar conserva.
  - Añadir/quitar filas en alergias y medicación.
  - Cross-link: una alergia tipo 'comida' muestra el aviso junto a Alimentación.
- **Sub-componentes:** render + onChange aislados.
- **SQL (manual, `tests/sql/`):** migración aplica limpio; RLS org-scoped
  (un usuario de O1 no ve/inserta filas de O2); `end_date` generada correcta;
  `ON DELETE CASCADE` borra alergias/medicaciones al borrar el perro.
- Patrón de migración SQL: mismo que `tests/sql/reservation_kennel_coupling.md`
  (documento de aserciones, verificación manual; no hay harness de Postgres).

## Fuera de alcance (recordatorio)

- Generación de tareas worker (comida/medicación) → tabla `tasks`.
- Atomicidad transaccional del sync de hijas (RPC) salvo que se decida después.
- Cualquier cambio a las tablas clínicas vet-gated.

Relacionado: el worker-view ya en prod consumirá `dog_medications` /
`feeding` para generar tareas en la fase siguiente.
