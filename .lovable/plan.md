

# Clínica Veterinaria — Perros desde BD + Edición completa

## Problema actual
1. La clínica usa `mockDogs` (datos estáticos en memoria). No refleja perros reales registrados en la base de datos.
2. Los registros médicos solo se pueden **crear** (INSERT), no **editar** ni **eliminar**.
3. No existe tabla `dogs` en la base de datos — los perros solo existen como mock data.

## Plan

### 1. Crear tabla `dogs` en la base de datos
Migración SQL para crear la tabla `dogs` con los campos del tipo Dog actual: `name`, `breed`, `birth_date`, `weight`, `color`, `gender`, `is_neutered`, `microchip_number`, `notes`, `behavior_notes`, `medical_notes`, `customer_id` (uuid FK a customers). RLS anon demo. Insertar los 4-5 perros mock como datos semilla.

### 2. Actualizar `ClinicPage.tsx` — Cargar perros desde BD
Reemplazar `mockDogs`/`mockCustomers` por queries a las tablas `dogs` y `customers` de Supabase. El sidebar mostrará perros reales con sus dueños reales.

### 3. Agregar edición y eliminación a todos los tabs clínicos
En cada tab (`MedicalHistoryTab`, `VaccinationTab`, `DewormingTab`, `ConditionsTab`, `TemperamentTab`):
- Agregar botón **Editar** en cada registro que abre el mismo modal con datos precargados y hace UPDATE en vez de INSERT.
- Agregar botón **Eliminar** con confirmación que hace DELETE.
- Reutilizar el modal existente en modo edición (detectar si hay `editingRecord` para decidir INSERT vs UPDATE).

### 4. Actualizar `DogsPage.tsx` — CRUD contra BD
Migrar la página de perros para usar la tabla `dogs` de Supabase en vez de mock data, permitiendo crear, editar y eliminar perros reales.

### 5. Actualizar `DogModal.tsx` — Guardar en BD
El modal de crear/editar perro hará INSERT/UPDATE contra la tabla `dogs`.

## Archivos a crear/editar
1. **Migración SQL**: tabla `dogs` + RLS + datos semilla
2. **`src/pages/ClinicPage.tsx`**: Query a `dogs` + `customers` desde BD
3. **`src/pages/DogsPage.tsx`**: CRUD contra tabla `dogs`
4. **`src/components/dogs/DogModal.tsx`**: INSERT/UPDATE contra BD
5. **`src/components/clinic/MedicalHistoryTab.tsx`**: Agregar editar/eliminar registros
6. **`src/components/clinic/VaccinationTab.tsx`**: Agregar editar/eliminar
7. **`src/components/clinic/DewormingTab.tsx`**: Agregar editar/eliminar
8. **`src/components/clinic/ConditionsTab.tsx`**: Agregar editar/eliminar
9. **`src/components/clinic/TemperamentTab.tsx`**: Ya soporta update (upsert), verificar que funcione correctamente

