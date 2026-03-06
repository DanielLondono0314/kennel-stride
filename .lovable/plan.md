

# Modulos de Reportes y Campanas

## Resumen
Crear dos modulos completos con persistencia en Lovable Cloud: **Reportes** (analytics financieros y operativos del centro) y **Campanas** (marketing segmentado para clientes).

## Base de datos

### No se necesita tabla para Reportes
Los reportes son vistas analiticas que consultan datos existentes: `invoices`, `packages`, `customers`, `facility_units`, `report_cards`, `notices`. Se calculan KPIs en tiempo real con queries agregados.

### Tabla `campaigns`
| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid PK | Identificador |
| name | text | Nombre de la campana |
| description | text | Descripcion |
| segment_type | text | inactive, new, vip, all, custom |
| segment_filters | jsonb | Filtros de segmentacion |
| message_template | text | Plantilla del mensaje |
| channel | text | email, sms, whatsapp |
| scheduled_at | timestamptz | Fecha programada |
| sent_at | timestamptz | Fecha de envio |
| status | text | draft, scheduled, sent, cancelled |
| stats_sent | integer | Enviados |
| stats_delivered | integer | Entregados |
| stats_opened | integer | Abiertos |
| stats_clicked | integer | Clicks |
| created_at / updated_at | timestamptz | Timestamps |

RLS: Mismo patron anon demo.

## Modulo de Reportes (`/reports`)

### Pagina `ReportsPage.tsx`
Dashboard analitico con tabs:

1. **Resumen General**: KPIs principales (ingresos totales, facturas cobradas vs pendientes, clientes activos, ocupacion de perreras)
2. **Financiero**: Grafico de ingresos por periodo (recharts BarChart), desglose por tipo de servicio (PieChart), facturas pendientes vs cobradas
3. **Operaciones**: Ocupacion de perreras por zona, report cards generados, paquetes activos vs expirados
4. **Clientes**: Top clientes por gasto, clientes nuevos por mes, distribucion de servicios

Filtros de rango de fecha (ultimo mes, trimestre, ano, personalizado).

Usa `recharts` (ya instalado) para graficos.

## Modulo de Campanas (`/campaigns`)

### Pagina `CampaignsPage.tsx`
- Lista de campanas con status badges (Borrador, Programada, Enviada, Cancelada)
- KPIs: total campanas, enviadas este mes, tasa de apertura promedio
- Modal de creacion/edicion con:
  - Nombre, descripcion
  - Segmento target (Todos, Nuevos, Inactivos 30+ dias, VIP, Personalizado)
  - Canal (Email, SMS, WhatsApp)
  - Plantilla de mensaje con variables ({nombre}, {perro})
  - Programar o enviar ahora (por ahora solo marca como "enviada", sin envio real)
- Vista de detalle con estadisticas de la campana (metricas simuladas por ahora)

## Archivos a crear/editar
1. **Migracion SQL**: tabla `campaigns` + RLS
2. **`src/pages/ReportsPage.tsx`**: Dashboard analitico con graficos recharts
3. **`src/pages/CampaignsPage.tsx`**: CRUD de campanas con segmentacion
4. **`src/App.tsx`**: Reemplazar ComingSoon por las paginas funcionales

## Detalles tecnicos
- Reportes: queries directos a tablas existentes con funciones de agregacion via supabase client
- Campanas: CRUD completo contra tabla `campaigns`
- Graficos con recharts (BarChart, PieChart, LineChart)
- Patron de UI consistente con PackagesPage/InvoicesPage (KPI cards + tabla + modales)

