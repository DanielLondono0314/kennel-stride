

# Mapa Arquitectonico del Centro Canino — Constructor Interactivo

## Resumen
Un editor visual tipo "playground" donde el usuario arrastra y coloca zonas del centro canino sobre un canvas 2D. Cada zona contiene elementos individuales (perreras, mesas de limpieza, comederos, etc.) que se pueden añadir, mover y redimensionar. Las perreras son asignables: se les asigna un perro y un periodo de permanencia.

## Base de datos

### Tabla `facility_zones`
| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid PK | Identificador |
| name | text | Nombre de la zona (ej: "Zona de Perreras A") |
| zone_type | text | Tipo: kennels, cleaning, feeding, training, grooming, play_yard, reception, storage |
| x | numeric | Posicion X en el canvas |
| y | numeric | Posicion Y en el canvas |
| width | numeric | Ancho en el canvas |
| height | numeric | Alto en el canvas |
| color | text | Color de la zona |
| capacity | integer | Capacidad maxima |
| is_active | boolean | Si esta activa |
| sort_order | integer | Orden de renderizado |
| created_at / updated_at | timestamptz | Timestamps |

### Tabla `facility_units`
| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid PK | Identificador |
| zone_id | uuid FK | Zona padre |
| name | text | Nombre (ej: "Perrera 01") |
| unit_type | text | Tipo: kennel, grooming_table, feeding_station, wash_station |
| x | numeric | Posicion relativa dentro de la zona |
| y | numeric | Posicion relativa |
| width / height | numeric | Dimensiones |
| status | text | available, occupied, maintenance, reserved |
| assigned_dog_id | text | ID del perro asignado (mock) |
| assigned_dog_name | text | Nombre desnormalizado |
| assignment_start | timestamptz | Inicio del periodo |
| assignment_end | timestamptz | Fin del periodo |
| created_at / updated_at | timestamptz | Timestamps |

RLS: Mismo patron anon demo que las demas tablas.

## Interfaz de usuario

### Pagina `/facility` — Editor del Centro
1. **Toolbar lateral izquierda**: Paleta de zonas arrastrables (Perreras, Limpieza, Comidas, Entrenamiento, Grooming, Patio, Recepcion, Almacen). Cada tipo con icono y color distintivo.

2. **Canvas central**: Area de grid donde se colocan las zonas. Cada zona es un rectangulo coloreado con titulo y contenido interior. Las zonas se pueden:
   - Arrastrar para reposicionar (drag con mouse/touch)
   - Redimensionar con handles en esquinas
   - Eliminar con boton X
   - Editar nombre/propiedades con doble click

3. **Dentro de cada zona tipo "kennels"**: Grid de perreras individuales representadas como celdas. Cada perrera muestra:
   - Numero/nombre
   - Estado (color: verde=disponible, rojo=ocupada, amarillo=mantenimiento)
   - Si esta ocupada: nombre del perro + dias restantes

4. **Modal de asignacion de perrera**: Al hacer click en una perrera:
   - Selector de perro (de mockDogs)
   - Date picker para periodo de inicio y fin
   - Notas opcionales
   - Boton liberar perrera

5. **Panel derecho**: Resumen del centro mostrando ocupacion por zona, perreras disponibles vs ocupadas, y alertas de perreras que estan por vencer su periodo.

### Navegacion
- Nuevo enlace en sidebar seccion "Operaciones": icono `Map` label "Instalaciones"
- Ruta `/facility` en App.tsx

## Implementacion tecnica

El editor usara **posicionamiento CSS absoluto dentro de un contenedor relativo** con drag nativo (no requiere libreria externa pesada). Se implementara con `onMouseDown/onMouseMove/onMouseUp` handlers para drag-and-drop y resize. No se necesita React Three Fiber — es un canvas 2D con divs posicionados.

## Archivos a crear/editar
1. **Migracion SQL**: tablas `facility_zones` y `facility_units` + RLS
2. **`src/pages/FacilityPage.tsx`**: Pagina principal con toolbar, canvas y panel resumen
3. **`src/components/facility/FacilityCanvas.tsx`**: Canvas con zonas arrastrables
4. **`src/components/facility/ZoneBlock.tsx`**: Componente de zona individual
5. **`src/components/facility/KennelGrid.tsx`**: Grid de perreras dentro de una zona
6. **`src/components/facility/KennelAssignmentModal.tsx`**: Modal para asignar perro a perrera
7. **`src/components/facility/FacilityToolbar.tsx`**: Paleta de zonas para agregar
8. **`src/components/facility/FacilitySummary.tsx`**: Panel resumen de ocupacion
9. **`src/components/navigation/AppSidebar.tsx`**: Agregar enlace "Instalaciones"
10. **`src/App.tsx`**: Agregar ruta `/facility`

