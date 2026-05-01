# Audit de Bugs — 2026-05-01

Documento de referencia para los bugs detectados en la revisión profunda del proyecto.
Cada fix posterior queda registrado como commit independiente vía la sincronización GitHub de Lovable.

## 🔴 Críticos (rompen funcionalidad)

### 1. RLS rechaza inserts por falta de `organization_id`
Archivos afectados:
- `src/components/clinic/VaccinationTab.tsx`
- `src/components/clinic/DewormingTab.tsx`
- `src/components/clinic/ConditionsTab.tsx`
- `src/components/clinic/TemperamentTab.tsx`
- `src/pages/InvoicesPage.tsx`
- `src/components/checkin/CheckOutModal.tsx`

**Síntoma:** los `insert()` fallan silenciosamente o con error RLS porque el payload no incluye `organization_id`, requerido por las políticas multi-tenant.

**Fix:** obtener `organization` desde `useOrganization()` y añadir `organization_id: organization.id` a cada payload.

### 2. Navegación rota por rutas no scoped
Archivos afectados:
- `src/components/navigation/AppHeader.tsx` (campana de notificaciones → `/notices`)
- `src/pages/NoticesPage.tsx` (acciones internas)

**Síntoma:** clic lleva a 404 porque la ruta real es `/<orgSlug>/notices`.

**Fix:** sustituir `useNavigate` por `useOrgNavigate`.

## 🟡 Importantes (técnicos)

### 3. Ciclo de vida de auth incorrecto
Archivo: `src/contexts/AuthContext.tsx`

- `getSession()` se llama antes de registrar `onAuthStateChange` → eventos perdidos en race condition.
- `signOut` no fuerza redirect → flash de contenido protegido.

**Fix:** registrar el listener primero, luego hacer `getSession()`. En `signOut`, redirigir a `/login`.

### 4. Colisiones de canales realtime
Archivos: `src/hooks/useAppCounts.ts`, `src/hooks/useReservations.ts`, `src/pages/Dashboard.tsx`

**Síntoma:** nombres de canal hardcodeados (`"app-counts"`, `"reservations-changes"`). Si el componente se monta dos veces (StrictMode, navegación rápida), Supabase rechaza la suscripción duplicada.

**Fix:** generar nombres únicos con `crypto.randomUUID()` o sufijo por instancia.

### 5. Dependencias inestables en `useReservations`
Archivo: `src/hooks/useReservations.ts`

`JSON.stringify(options.status)` dentro de `useCallback` deps. Si el caller pasa el array inline, re-renderiza en bucle.

**Fix:** memoizar `options.status` con `useMemo` en el hook, o documentar que el caller debe memoizarlo.

## 🟢 Menores / UX

- `OnboardingPage.tsx`: chequeos redundantes ya cubiertos por `LoginPage.tsx`.
- `SettingsPage.tsx`: state management mejorable (ya parcialmente arreglado con URL sync).
- Redundancia "Perfil" / "Configuración" en menú (ya diferenciada por tabs).
