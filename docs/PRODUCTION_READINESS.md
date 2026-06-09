# Production Readiness — Registro vivo

> **Qué es esto:** la única fuente de verdad de todo lo conocido que falta para que KennelOps
> sea un producto sólido que cobra. Cada hallazgo (de auditorías, bugs o mejoras) vive aquí con
> severidad, dueño, estado y **Definición de Hecho (DoD)**. Si algo no está en esta lista, es un
> desconocido — no un "ya estaba listo".
>
> **Cómo se usa:**
> - "Listo / done" = el ítem cumple su **DoD**, no la palabra de nadie.
> - Una versión está *lista para vender* cuando **no hay P0 ni P1 abiertos**.
> - Las auditorías futuras **suman a esta lista** (mismo formato), nunca empiezan de cero.
>
> **Última actualización:** 2026-06-09

## Leyenda

- **Severidad:** 🔴 P0 (bloquea ingresos / rompe prod) · 🟠 P1 (vuelas a ciegas / riesgo de confianza) · 🟡 P2 (deuda que toca dinero) · 🟢 P3 (UX/conversión) · ⚪ P4 (polish/refactor)
- **Dueño:** 🧑‍💻 código (lo hago yo) · 🎛️ dashboard/cuenta (lo configuras tú: Vercel/Supabase/LemonSqueezy) · 🤝 ambos
- **Estado:** `ABIERTO` · `EN CURSO` · `BLOQUEADO` · `HECHO`

---

## 🔴 P0 — Bloqueadores de ingresos (verificar ya)

| ID | Ítem | Dueño | Esfuerzo | Estado |
|----|------|-------|----------|--------|
| PR-1 | Emails transaccionales por SMTP por defecto de Supabase → caen en spam / rate-limit | 🤝 | M | ABIERTO |
| PR-2 | Checkout de LemonSqueezy puede estar "no configurado" en prod (env vars + webhook secret) | 🎛️ | S | ABIERTO |
| PR-3 | No hay smoke end-to-end del camino del dinero (registro→trial→pago→activación) | 🤝 | M | ABIERTO |

- **PR-1** — `signUp`/`resetPasswordForEmail` usan el SMTP por defecto de Supabase (~3-4/h, va a spam). Un registro que no recibe el correo de confirmación = trial que nunca empieza = venta perdida. Ya hay cuenta de **Resend** (`send-campaign`).
  **DoD:** Supabase Auth apuntado a Resend SMTP; un registro nuevo en prod recibe confirmación <1 min en bandeja de entrada; "recuperar contraseña" llega y funciona.
- **PR-2** — `BillingPage` lee `VITE_LS_CHECKOUT_URL_STARTER`/`GROWTH`; si faltan en Vercel, no se puede comprar. El webhook necesita su secret y la URL registrada en LemonSqueezy.
  **DoD:** env vars presentes en prod; webhook registrado apuntando a la edge function con secret; documentado.
- **PR-3** — **DoD:** un recorrido real (o sandbox de LS) registrado: alta → trial → click upgrade → checkout → webhook → org pasa a `active`. Sin pasos rotos.

## 🟠 P1 — Observabilidad y confianza (volar a ciegas)

| ID | Ítem | Dueño | Esfuerzo | Estado |
|----|------|-------|----------|--------|
| PR-4 | Sentry instalado (`@sentry/react`) pero **sin inicializar** → 0 visibilidad de errores en prod | 🧑‍💻 | S | ABIERTO |
| PR-5 | Sin analítica de producto → embudo de conversión invisible | 🤝 | S | ABIERTO |
| PR-6 | Sin páginas legales (Términos/Privacidad) en el router | 🧑‍💻 | S | ABIERTO |
| PR-7 | Edge functions (webhook/email) sin alerta ante fallos | 🤝 | M | ABIERTO |

- **PR-4** — **DoD:** `Sentry.init` en el frontend con DSN por env; un error provocado en prod aparece en Sentry; source maps subidos.
- **PR-5** — PostHog (gratis). Eventos mínimos: `signup`, `org_created`, `first_reservation`, `paywall_view`, `checkout_click`, `subscription_active`. **DoD:** embudo visible en PostHog con esos eventos llegando desde prod.
- **PR-6** — **DoD:** `/terminos` y `/privacidad` renderizan contenido real, enlazados desde el footer del landing y el registro. (Requisito para cobrar + señal de confianza.)
- **PR-7** — **DoD:** un fallo del webhook de pago genera una señal observable (Sentry/log/alerta), no se pierde en silencio.

## 🟡 P2 — Robustez/correctitud que toca dinero

| ID | Ítem | Dueño | Esfuerzo | Estado |
|----|------|-------|----------|--------|
| PR-8 | Check-out no atómico: factura y completitud en pasos separados → factura huérfana si falla | 🧑‍💻 | M | ABIERTO |
| PR-9 | `types.ts` desactualizado + ~65 casts `as any` (RPCs/inserts) → cambios de esquema no dan error de compilación | 🧑‍💻 | M | ABIERTO |
| PR-10 | Sin guard de RLS en CI contra el drift de Lovable (ya se coló acceso anónimo a `reservations` antes) | 🧑‍💻 | M | ABIERTO |
| PR-11 | Sin tests de los RPCs de dinero/cupos (`deduct_package_credit`, `create_reservation`, `check_in/out`) | 🧑‍💻 | M-L | ABIERTO |

- **PR-8** — **DoD:** un único RPC `SECURITY DEFINER` hace pago + completitud + liberación de perrera en una transacción; fallar a mitad no deja factura huérfana; cubierto por test.
- **PR-9** — **DoD:** `supabase gen types` regenerado; 0 `as any` en llamadas a supabase; `DbDog`/`DbReservation`/`DbPackage` dedupe desde `Database[...]`; tsc verde.
- **PR-10** — **DoD:** test en CI que falla si alguna tabla sensible tiene policy `TO public USING(true)` o RLS deshabilitada.
- **PR-11** — **DoD:** tests de integración de los 4 RPCs con asserts de cambio de estado y aislamiento por org.

## 🟢 P3 — UX / conversión

| ID | Ítem | Dueño | Esfuerzo | Estado |
|----|------|-------|----------|--------|
| PR-12 | Onboarding / time-to-value: primer-uso guiado o datos de ejemplo | 🧑‍💻 | M | ABIERTO |
| PR-13 | Validación inline en formularios (no solo toast): `aria-invalid` + error por campo + scroll-to-error | 🧑‍💻 | M | ABIERTO |
| PR-14 | `DogModal` muy largo → tabs/pasos; "Alimentación" (obligatoria) está al final | 🧑‍💻 | M | ABIERTO |
| PR-15 | ~25 colores Tailwind crudos fuera del sistema de tokens (solo se migraron los componentes de perro) | 🧑‍💻 | M | ABIERTO |
| PR-16 | 78 warnings `react-hooks/exhaustive-deps` (riesgo de stale-closures) | 🧑‍💻 | M | ABIERTO |

- **PR-12 DoD:** una org nueva puede correr una reserva real en <10 min sin ayuda; medido.
- **PR-13 DoD:** los errores se muestran en el campo (no solo toast) en formularios de perro/cliente/reserva; foco al primer error.
- **PR-14 DoD:** formulario organizado en secciones/pasos con un solo submit; obligatorios primero.
- **PR-15 DoD:** 0 clases `text/bg-{yellow,blue,green,red,purple}-NNN` de estado fuera de tokens.
- **PR-16 DoD:** cada warning resuelto o con `// eslint-disable` justificado.

## ⚪ P4 — Polish / refactor / decisiones

| ID | Ítem | Dueño | Esfuerzo | Estado |
|----|------|-------|----------|--------|
| PR-17 | Buckets de storage públicos (`dog-photos`, `report-card-photos`) — decisión de negocio | 🤝 | S | ABIERTO |
| PR-18 | `create_organization` sin validar formato de slug ni rate-limit | 🧑‍💻 | S | ABIERTO |
| PR-19 | `getAge` parsea fecha `date` como local → desfase de día en el borde | 🧑‍💻 | S | ABIERTO |
| PR-20 | Bundle ~622kB sin medir; confirmar lazy boundaries (no reintroducir `manualChunks`) | 🧑‍💻 | S | ABIERTO |
| PR-21 | Archivos grandes: `LandingPage` 1483 LOC, `RequestsPage` 732, `CustomerProfilePage` 576 | 🧑‍💻 | L | ABIERTO |
| PR-22 | `user_roles`/`has_role` legacy obsoletos (la policy peligrosa ya se dropeó; falta la tabla) | 🧑‍💻 | S | ABIERTO |
| PR-23 | Webhook idempotencia: fallback a hash del body si falta event id del proveedor | 🧑‍💻 | S | ABIERTO |

---

## ✅ HECHO (desplegado) — para ver la tendencia

| Fecha | Qué |
|-------|-----|
| 2026-06-08 | **Auditoría fase-2** (Crít+Alto+Medio): bug crítico de check-out (perreras nunca se liberaban), refresh+errores de `DogsPage`, RLS clínica alineada + policy legacy de `profiles` eliminada (PII cross-tenant), a11y/contraste del formulario de perro, config de tests unificada, foto del perro en reservas, guards de organización. Migración `20260608000000`. |
| 2026-06-08 | Corrección de datos: liberar perreras atascadas (0 filas — no había usuarios afectados). Migración `20260608010000`. |
| 2026-06-08 | **Formulario de perro** ampliado (intake clínico: agresividad/alergias/medicación/alimentación). Migración `20260606000000`. |
| 2026-06-03 | **Worker View** + endurecimiento anon-RLS de reservas. |
| 2026-06-03 | **Impeccable UI/UX** P1–P3 (a11y de botones, skeletons, EmptyState, toasts accionables, cohesión de marca). |

---

## Cómo priorizo (regla simple)

1. **P0 primero, siempre** — sin esto no entra dinero.
2. **P1 antes de empujar marketing** — sin ojos (Sentry/analítica) no sabes qué arreglar ni por qué no convierten.
3. **P2** en paralelo cuando toque facturación/datos.
4. **P3/P4** como mejora continua, medidos contra conversión.

> Definición de "listo para cobrar de verdad": **0 abiertos en P0 y P1.**
