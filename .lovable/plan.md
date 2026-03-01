
# Modulo de Report Cards

## Resumen
Crear un sistema completo de Report Cards donde los entrenadores registran el progreso de cada perro con metricas, notas y fotos. Los report cards se persisten en Lovable Cloud y se pueden consultar por perro, entrenador o fecha.

## Base de datos

### Tabla `report_cards`
| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid (PK) | Identificador |
| dog_id | text | ID del perro (referencia mock por ahora) |
| dog_name | text | Nombre del perro (desnormalizado para consultas rapidas) |
| trainer_id | uuid (FK staff_members) | Entrenador que creo el report |
| service_type | text | Tipo de servicio (daycare, training, etc.) |
| session_date | date | Fecha de la sesion |
| overall_score | integer | Puntuacion general 1-5 |
| energy_level | integer | Nivel de energia 1-5 |
| socialization | integer | Socializacion 1-5 |
| obedience | integer | Obediencia 1-5 |
| appetite | integer | Apetito 1-5 |
| notes | text | Observaciones generales |
| highlights | text | Logros destacados |
| areas_to_improve | text | Areas de mejora |
| photos | text[] | URLs de fotos (array) |
| is_sent | boolean | Si ya se envio al dueno |
| sent_at | timestamptz | Cuando se envio |
| created_at / updated_at | timestamptz | Timestamps |

RLS: Lectura y escritura anonima (demo) + override para admins autenticados (mismo patron que staff_members).

### Storage bucket `report-card-photos`
Bucket publico para las fotos adjuntas a los report cards.

## Interfaz de usuario

### Pagina principal (`/report-cards`)
- **Vista de lista/grid** con cards que muestran: nombre del perro, fecha, puntuacion general (estrellas), entrenador, tipo de servicio, estado (borrador/enviado)
- **Filtros**: busqueda por nombre de perro, filtro por entrenador, filtro por tipo de servicio, rango de fechas
- **Boton "Nuevo Report Card"** que abre el modal de creacion

### Modal de creacion/edicion
- Selector de perro (de los mock dogs existentes)
- Selector de entrenador (de staff_members en DB)
- Selector de tipo de servicio
- Fecha de sesion (date picker)
- **5 metricas con sliders visuales** (1-5 estrellas): Puntuacion general, Energia, Socializacion, Obediencia, Apetito
- Campos de texto: Notas, Logros destacados, Areas de mejora
- Subida de fotos (hasta 4 fotos por report card)
- Botones: Guardar borrador / Enviar al dueno

### Vista de detalle (modal)
- Perfil del perro con avatar y datos
- Las 5 metricas presentadas como barras de progreso o estrellas
- Notas completas
- Galeria de fotos
- Historial: mini-grafico de progreso del perro (ultimos 5 report cards)

## Archivos a crear/editar
1. **Migracion SQL**: tabla `report_cards` + bucket `report-card-photos` + RLS
2. **`src/pages/ReportCardsPage.tsx`**: Pagina principal con lista, filtros y modales
3. **`src/components/report-cards/ReportCardModal.tsx`**: Formulario de creacion/edicion
4. **`src/components/report-cards/ReportCardDetail.tsx`**: Vista de detalle con metricas y fotos
5. **`src/components/report-cards/StarRating.tsx`**: Componente reutilizable de estrellas interactivas
6. **`src/App.tsx`**: Reemplazar el ComingSoon por la pagina funcional

## Detalles tecnicos
- Consultas a Lovable Cloud via `supabase` client para CRUD de report cards
- Upload de fotos al bucket `report-card-photos` con el Storage API
- Perros tomados de `mockDogs` (datos locales) ya que aun no hay tabla de perros en DB
- Entrenadores cargados de `staff_members` en DB
- Tipos TypeScript existentes (`ReportCard`, `ReportMetric` en `src/types/index.ts`) se usaran como referencia pero la estructura de DB sera ligeramente distinta (metricas como columnas individuales en lugar de array JSON)
- Toast notifications con sonner para feedback de acciones
