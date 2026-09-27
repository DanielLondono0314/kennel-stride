# Membresías por plan — estrategia e implementación

Estado: implementado en código, **pendiente de desplegar y de configurar LemonSqueezy** (ver §7).
Mercado objetivo: Latinoamérica. Precios en USD (LemonSqueezy cobra en USD), con equivalente COP referencial.

> Los precios y límites son una **hipótesis de lanzamiento**, no un dato validado. No se contrastaron
> con precios de competidores ni con costos reales de Twilio/Resend en cada país. §8 lista qué validar primero.

---

## 1. Idea central

El **plan** es un atributo de la **organización** (`organizations.plan_tier`), no del usuario.
Los roles existentes (`admin`, `manager`, `front_desk`, `worker`) siguen siendo de permisos *dentro* del negocio.

| Lo que pediste | Cómo queda |
|---|---|
| Rol A (admin del plan básico) | Usuario `admin` en una org con `plan_tier = 'basic'` |
| Rol B (admin del plan medio) | Usuario `admin` en una org con `plan_tier = 'pro'` |
| Rol C (admin del plan premium) | Usuario `admin` en una org con `plan_tier = 'premium'` |
| Super super admin | Platform admin (`/platform-admin`, ya existía): ve **todas** las features en **cualquier** org y puede cambiar el plan de una org |

**Por qué no 3 roles nuevos en `app_role`:** subir/bajar de plan sería migrar usuarios uno por uno, habría que
duplicar toda la RLS por rol, y un dueño con 5 empleados tendría 5 "roles de plan" distintos. Con `plan_tier`,
un upgrade es cambiar **un campo**.

---

## 2. Segmentos y planes

| | **Esencial** (`basic`) | **Pro** (`pro`) | **Premium** (`premium`) |
|---|---|---|---|
| **Cliente ideal** | Adiestrador, paseador, groomer independiente | Guardería / daycare con equipo | Hotel, resort, centro canino completo |
| **Su dolor** | "Tengo todo en WhatsApp y Excel" | "Mis clientes preguntan todo el día cómo le fue a su perro" | "Necesito controlar ocupación, salud y ventas" |
| **USD / mes** | $19 | $49 | $99 |
| **COP / mes (ref.)** | 79.000 | 199.000 | 399.000 |
| **Anual (−20%)** | $15/mes | $39/mes | $79/mes |
| **Usuarios** | 2 | 10 | Ilimitados |
| **Perros** | 200 | 1.000 | Ilimitados |

### Matriz de módulos

| Módulo | Esencial | Pro | Premium |
|---|:-:|:-:|:-:|
| Dashboard, Clientes, Perros | ✅ | ✅ | ✅ |
| Calendario / agenda, Tareas | ✅ | ✅ | ✅ |
| Paquetes y bonos | ✅ | ✅ | ✅ |
| Facturación, Reportes | ✅ | ✅ | ✅ |
| Rutas (recogida/entrega) | ✅ | ✅ | ✅ |
| Personal (dentro del límite de usuarios) | ✅ | ✅ | ✅ |
| Solicitudes de clientes | – | ✅ | ✅ |
| Avisos | – | ✅ | ✅ |
| Report Cards | – | ✅ | ✅ |
| Notificaciones de ruta SMS/WhatsApp | – | ✅ | ✅ |
| Instalaciones y perreras | – | – | ✅ |
| Clínica veterinaria | – | – | ✅ |
| Campañas de marketing | – | – | ✅ |

### Lógica de cada frontera (por qué está donde está)

- **Esencial → Pro (comunicación con el cliente + equipo).** Un independiente no necesita Report Cards ni
  avisos: es él quien habla con el dueño. Cuando contrata a alguien y quiere que los dueños *vean* el servicio,
  ya es Pro. Las **notificaciones de ruta** están en Pro además porque cada SMS/WhatsApp tiene costo variable.
- **Pro → Premium (activos físicos + salud + ventas).** Instalaciones, clínica y campañas solo importan a quien
  aloja perros o tiene base de clientes para reactivar. Son los módulos más pesados de mantener y los que
  más justifican pagar el doble.
- **Rutas en todos los planes:** un paseador vive de las rutas; ponerlas en Pro dejaría al segmento Esencial
  sin su caso de uso principal.

---

## 3. Posicionamiento y argumentos de venta

- **Esencial — "Deja el Excel y el WhatsApp."** *Tu agenda, tus clientes y tus cobros en un solo lugar por menos
  de lo que cobras por un paseo.* Barrera de entrada baja a propósito: es el plan que trae volumen y luego crece.
- **Pro — "Que tus clientes vean lo que haces."** *Report Cards y avisos de ruta hacen que el dueño se sienta
  cerca de su perro, y eso se paga solo en retención.* Es el plan **objetivo** (badge "Más popular").
- **Premium — "Tu centro completo, bajo control."** *Ocupación, historial médico y campañas en una sola vista.*
  Se vende con demo acompañada, no autoservicio.

## 4. Trial y upgrade

- **Trial de 14 días con todo desbloqueado (Premium).** Ya es así hoy: el default de `plan_tier` es `premium`.
  El cliente prueba el producto completo y elige plan al final. Los clientes actuales quedan en Premium
  (sin pérdida de funciones).
- **Módulos bloqueados visibles con candado**, no ocultos: cada candado es un anuncio de upgrade en el momento
  exacto en que el cliente lo necesita. Al abrirlos, `UpgradePrompt` explica desde qué plan están y lleva a `/billing`.
- **Disparadores de upgrade naturales:** llegar al límite de perros/usuarios (el error `plan_limit_*` bloquea solo
  altas nuevas, nunca borra datos), tocar un módulo con candado, activar notificaciones de ruta.
- **Downgrade seguro:** bajar de plan **no borra nada**. Oculta módulos, bloquea altas sobre el límite y apaga
  las notificaciones de ruta si el plan ya no las incluye.

---

## 5. Cómo funciona por dentro

| Pieza | Dónde |
|---|---|
| Columna `organizations.plan_tier` (`basic`/`pro`/`premium`, default `premium`) | `supabase/migrations/20260924000000_membership_plans.sql` |
| Catálogo: precios, límites, `ls_variant_id` → `plan_catalog` | idem |
| Matriz de features → `plan_features`; función `org_has_feature(org, feature)` | idem |
| Blindaje: un admin de kennel **no** puede cambiar su `plan_tier` (trigger) | idem |
| Límites de perros/usuarios (trigger `enforce_plan_limit`) | idem |
| Módulos de pago: policy `RESTRICTIVE` de INSERT en `facility_zones`, `facility_units`, `campaigns`, `report_cards` | idem |
| Cambio de plan por soporte, auditado: `platform_admin_set_plan_tier` | idem + botón "Cambiar plan" en `/platform-admin/organizations/:id` |
| Webhook: `variant_id` → `plan_tier` en `subscription_created` / `subscription_updated` | `supabase/functions/handle-ls-webhook/index.ts` |
| `send-campaign` rechaza si el plan no incluye campañas | `supabase/functions/send-campaign/index.ts` |
| Matriz espejo para la UI | `src/lib/plans.ts` |
| `hasFeature()` / `planTier` | `src/contexts/OrganizationContext.tsx` |
| Guard de ruta + upsell | `src/components/auth/FeatureRoute.tsx`, `src/components/shared/UpgradePrompt.tsx` |
| Candados en el menú | `src/components/navigation/AppNavLink.tsx` |
| Selector de 3 planes | `src/pages/BillingPage.tsx` |

### Qué hace cumplir el backend y qué es solo UX

| Módulo | Backend | UI |
|---|---|---|
| Instalaciones, Campañas, Report Cards | ✅ INSERT bloqueado por RLS (campañas además en la edge function) | ✅ |
| Notificaciones de ruta | ✅ trigger las apaga | ✅ switch deshabilitado |
| Límites de perros y usuarios | ✅ trigger | ✅ |
| **Solicitudes, Avisos, Clínica** | ❌ **solo UI** | ✅ |

Solicitudes, Avisos y Clínica no se blindaron en el backend a propósito: los Avisos los generan automáticamente
triggers del sistema para todas las orgs, y las tablas médicas (`medical_history`, vacunas, etc.) se usan dentro
de la ficha del perro, así que una policy restrictiva ahí puede romper flujos que sí son del plan Esencial.
Un usuario técnico que llame a la API directamente podría escribir en ellas. Si quieres cerrarlo, hay que
analizar cada flujo antes.

---

## 6. Cómo prueba todo el "super super admin"

1. **Ver todo:** un platform admin ve todas las features en cualquier org (`org_has_feature` y `hasFeature()`
   lo respetan), sin cambiar nada.
2. **Ver cómo lo vive cada cliente:** en `/platform-admin/organizations/:id` → **Cambiar plan** (solo rol `owner`,
   requiere motivo, queda en el audit log). Recomendado: crear 3 orgs de QA (una por plan) y recorrerlas.

---

## 7. Puesta en marcha (pasos manuales, en orden)

1. **LemonSqueezy:** crear 3 productos/variants de suscripción mensual (Esencial $19, Pro $49, Premium $99;
   opcional: variants anuales). Anotar el **variant ID** de cada uno.
2. **Registrar los variants** (SQL editor de Supabase):
   ```sql
   update public.plan_catalog set ls_variant_id = '<id>' where tier = 'basic';
   update public.plan_catalog set ls_variant_id = '<id>' where tier = 'pro';
   update public.plan_catalog set ls_variant_id = '<id>' where tier = 'premium';
   ```
   Si un variant no está mapeado, el webhook lo registra en logs y **no toca** el plan (ni sube ni baja).
   Si hay variants anuales, cada uno necesita su propia fila: hoy `plan_catalog` tiene un `ls_variant_id` por tier;
   habría que ampliarlo a varios variants por plan.
3. **Vercel:** definir `VITE_LS_CHECKOUT_URL_BASIC`, `_PRO`, `_PREMIUM` (reemplazan a `_STARTER` y `_GROWTH`).
4. **Aplicar la migración** `20260924000000_membership_plans.sql` y **desplegar las edge functions**
   `handle-ls-webhook` y `send-campaign`.
5. **Regenerar tipos** (`supabase gen types`): `src/integrations/supabase/types.ts` se editó a mano para esto.
6. **QA con 3 orgs** (una por plan), incluyendo: candados del menú, upsell, límite de perros, downgrade con
   datos por encima del límite, y una compra real en modo test de LemonSqueezy.

---

## 8. Riesgos y qué validar primero

- **Precios sin validar.** Antes de fijar, compara con lo que hoy pagan tus prospectos por alternativas
  (hojas de cálculo, apps de agenda genéricas) y con competidores locales. El precio Esencial es el más sensible.
- **Costo variable de Premium/Pro:** SMS/WhatsApp (Twilio) y email (Resend) se consumen por uso. Revisa la tarifa
  real por mensaje en los países objetivo; si es alta, considera un tope mensual de mensajes por plan.
- **LemonSqueezy** cobra comisión por transacción (5% + $0.50 es su tarifa publicada; confírmalo en tu cuenta):
  en Esencial ($19) pesa proporcionalmente más.
- **COP referencial:** LemonSqueezy cobra en USD; el valor en COP fluctúa. Si el mercado principal es Colombia y la
  fricción de pagar en USD es alta, puede hacer falta una pasarela local.
- **Límites (200 perros / 2 usuarios en Esencial):** son un supuesto. Míralos contra el uso real en
  `/platform-admin` (conteos por organización) antes de lanzar.
- **Hueco de seguridad previo, sin tocar:** las policies de `organizations` dejan a cualquier admin del kennel
  escribir **cualquier** columna, incluidas `subscription_status` y `trial_ends_at`. Esta migración blinda solo
  `plan_tier`. Conviene blindar las otras dos con el mismo patrón (requiere revisar que ningún flujo legítimo
  las escriba desde el cliente).
- **Enterprise / multisede:** la landing ya no lo muestra como plan; se ofrece "a medida" por contacto. Hoy el
  producto es una organización = una sede.
