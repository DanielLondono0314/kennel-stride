# Camino del dinero — Checklist de configuración (P0)

> Estos pasos **no son de código** — se hacen en los dashboards de Supabase, Vercel y
> LemonSqueezy. Son los que bloquean ventas si faltan. Marca cada uno al completarlo.
> Referencias: `PR-1`, `PR-2`, `PR-3` y `PR-4` de `docs/PRODUCTION_READINESS.md`.

---

## PR-1 · Emails transaccionales (Supabase Auth → Resend)

**Por qué:** hoy el registro/confirmación/recuperación salen por el SMTP por defecto de
Supabase (≈3-4/h, caen en spam). Si el usuario no recibe el correo, no entra → no hay trial
→ no hay venta. Ya tienes cuenta de Resend (la usa `send-campaign`).

- [ ] **Verifica tu dominio en Resend** → https://resend.com/domains (añade los registros DNS SPF/DKIM). Sin dominio verificado, los correos no salen.
- [ ] **Supabase → Project Settings → Authentication → SMTP Settings → Enable Custom SMTP:**
  - Host: `smtp.resend.com`
  - Port: `465` (SSL) o `587` (TLS)
  - Username: `resend`
  - Password: tu **Resend API key** (`re_…`)
  - Sender email: una dirección de tu dominio verificado (ej. `noreply@tudominio.com`)
  - Sender name: el nombre de tu marca
- [ ] **Supabase → Authentication → URL Configuration:** pon el **Site URL** y los **Redirect URLs** al dominio real de producción (hoy `https://kennel-stride.vercel.app`; cuando compres dominio propio, actualízalo). Si no coinciden, los enlaces de confirmación/recuperación apuntan mal.
- [ ] **Prueba real:** regístrate con un email tuyo en prod → confirma que llega en <1 min y a bandeja de entrada (no spam). Repite con "recuperar contraseña".

> Nota: al cambiar de dominio también actualiza `ALLOWED_ORIGIN` (secret de la edge function `send-campaign`).

---

## PR-2 · Checkout + webhook de LemonSqueezy

**Por qué:** `BillingPage` lee las URLs de checkout de env vars; si faltan, muestra "no
configurado" y nadie puede pagar. Y si el webhook no está bien, el cliente paga pero su
organización no pasa a `active` → bloqueado → reembolso + churn.

- [ ] **Vercel → Project → Settings → Environment Variables (Production):** confirma que existen y apuntan a los checkout links de cada plan en LemonSqueezy:
  - `VITE_LS_CHECKOUT_URL_STARTER`
  - `VITE_LS_CHECKOUT_URL_GROWTH`
  - (Tras añadirlas, **redeploy** para que entren al build.)
- [ ] **Edge function desplegada:** confirma que `handle-ls-webhook` está en prod (`supabase functions deploy handle-ls-webhook`). *Yo puedo desplegar el código si me lo pides; el resto es dashboard.*
- [ ] **LemonSqueezy → Settings → Webhooks → +:**
  - URL: `https://<project-ref>.functions.supabase.co/handle-ls-webhook` (tu ref de prod es `jqnpqmkwcaxqrevfqmue`)
  - Eventos: `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_payment_success` (los que use el handler).
  - Define un **Signing secret**.
- [ ] **Supabase → Edge Functions → Secrets:** `LEMONSQUEEZY_WEBHOOK_SECRET` = el signing secret de arriba.
- [ ] **Prueba (test mode de LemonSqueezy):** haz una compra de prueba → verifica que llega el webhook (logs de la función) y que la organización pasa a `active` (deja de mostrar el paywall).

---

## PR-4 · Sentry (solo falta el DSN)

**Estado:** el código ya está hecho (`src/lib/sentry.ts` + `initSentry()` + ErrorBoundary).
Solo falta la variable de entorno.

- [ ] **Crea un proyecto en https://sentry.io** (plataforma: React) y copia el **DSN**.
- [ ] **Vercel → Environment Variables (Production):** `VITE_SENTRY_DSN = https://…@sentry.io/…` → redeploy.
- [ ] **Prueba:** provoca un error en prod y confirma que aparece en Sentry.

---

## PR-3 · Smoke end-to-end del camino del dinero (cuando PR-1/PR-2 estén)

- [ ] Registro nuevo → recibe email → confirma → entra.
- [ ] Onboarding → crea organización → arranca trial.
- [ ] Click "Mejorar/Upgrade" → llega al checkout de LemonSqueezy.
- [ ] Compra de prueba → webhook → la organización pasa a `active` y desaparece el paywall.
- [ ] **Documenta aquí la fecha del primer recorrido exitoso:** ____________
