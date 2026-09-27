## Ensayo con copia de producción (2026-09-27)

Respaldo en ~/Desktop/backup-prod-esquema.sql y backup-prod-datos.sql.
Historial remoto (`migration list`): aplicado hasta 20260915020000. 0925 NO
está en el historial pero sus objetos sí existen (se corrió a mano); `db push`
la re-ejecuta y es idempotente. Pendientes 9 (0916×4, 0924, 0925, 0926×2, 0928),
ensayadas en ese orden sobre la copia: OK, pesos y datos intactos, 94/94 tests.
No hace falta `--include-all`.

## Estado de pruebas (2026-09-27)

`supabase test db` pasa completo en local (5 archivos, 94 tests) con TODAS las
migraciones pendientes (0924, 0925, 0926×2, 0928) aplicadas sobre una BD limpia.
Se corrigieron tests desactualizados por la auditoría (mensajes, choferes sin
membresía, reintento de salida) y se agregaron GRANTs explícitos a las tablas
nuevas (plan_catalog, plan_features, org_roles).
Ojo local: el Supabase CLI nuevo no otorga acceso a tablas de public por
defecto; para emular producción tras `supabase db reset` correr
`GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;`.

---

## Roles y permisos personalizados — desplegar (2026-09-27)

Código listo SIN commit y SIN probar contra BD (no hay Docker). Cada org crea
sus roles (nombre + tipo de acceso admin/panel/worker + ~10 permisos) en
Configuración → Roles. Plan: `~/.claude/plans/elegant-brewing-turing.md`.
La columna enum `role` se conserva sincronizada por trigger con `role_id`, así
que las policies/chequeos legados siguen valiendo.

**Orden obligatorio** (DESPUÉS de desplegar la auditoría del 2026-09-26):
1. `supabase test db` → debe pasar `supabase/tests/database/custom_roles.test.sql`
   (y los existentes).
2. Aplicar `20260928000000_custom_roles.sql` (siembra 4 roles por org y
   rellena role_id de miembros, invitaciones y personal).
3. Desplegar Edge Functions `send-campaign`, `notify-route-stop`, `send-invitation`.
4. Desplegar frontend. Regenerar `types.ts` (se editó a mano: org_roles, role_id).

**QA:** crear rol "Cajero" (panel, solo Cobrar) → ve facturación, no reportes
ni campañas; darle "Agendar" → ya agenda sin recargar la BD. Rol worker
"Paseador" → entra a la app de trabajador. Renombrar "Trabajador" → se ve en
Personal/Invitaciones/Join. Cambiar el rol en Personal a alguien con cuenta →
su acceso cambia (antes no). Intentar dejar la org sin admin → error.

---

## Auditoría de seguridad/bugs — desplegar (2026-09-26)

Código listo SIN commit y SIN probar contra BD (no hay Docker). Qué incluye:
migraciones `20260926000000_audit_security_hardening.sql` y
`20260926010000_audit_kennel_integrity.sql`, Edge Functions
`notify-route-stop`, `send-campaign`, `send-report-card` (+ versión fijada de
supabase-js en todas salvo el webhook), `vercel.json` (GPS permitido) y
frontend.

**Orden obligatorio:**
1. `supabase test db` → debe pasar `supabase/tests/database/audit_hardening.test.sql`.
2. Aplicar las 2 migraciones ANTES del frontend: CustomerModal ahora guarda
   `customers.marketing_opt_out` y las fotos de reportes suben a `<org_id>/…`
   (la policy nueva lo exige).
3. Desplegar las 3 Edge Functions modificadas.
4. Desplegar frontend (Vercel).
5. Verificar en SQL (producción):
   `select has_function_privilege('anon','public.generate_welfare_checks_all_orgs()','execute');` → false

**QA manual tras desplegar:**
- Worker: iniciar y cerrar su reserva desde la app (debe funcionar); la perrera
  queda libre al cerrarla.
- Recepción: crear reserva, check-in, check-out con efectivo y con paquete.
- Cancelar desde el Dashboard una reserva con check-in → perrera libre.
- Subir foto de un perro NUEVO y de uno existente; fotos de reporte (admin y worker).
- Ruta: "Salí hacia aquí" pide GPS y envía SMS; reintentar tras un fallo.
- Campaña: enviar (admin/gerente); un worker debe recibir 403.
- Buscar "Pérez, Juan" en clientes/búsqueda global.

**Pendiente que requiere tu decisión (no se tocó):**
- Planes Esencial/Pro no pueden crear perreras (`facility` es Premium) pero el
  check-in exige perrera → no pueden hacer check-in/cobrar. Decidir: check-in
  sin perrera, o incluir perreras básicas en todos los planes.
- Esencial no incluye `requests` pero toda reserva nace `requested`.
- Confirmación de email en Supabase Auth: verificar que esté activa (si no,
  alguien puede registrarse con el correo de un invitado y tomar la invitación).
- `supabase/config.toml` apunta a `jqnpqmkwcaxqrevfqmue`; este archivo usa
  `vdcwrtqrnsekyguhqowc`. Confirmar cuál es producción.
- Números de factura aleatorios (no consecutivos): revisar requisito DIAN.
- react-router: queda 1 advisory moderado que requiere migrar a v7.
- Columnas `ls_*` de organizations siguen legibles por miembros (el REVOKE por
  columna no tiene efecto con GRANT de tabla); bajo riesgo, requiere GRANT por
  columna y mantenerlo al agregar columnas.

---

## Peso trazable + Panel de perros — desplegar (2026-09-25)

Código listo SIN commit y SIN probar contra la BD (la migración nunca corrió).
**Orden obligatorio:** aplicar `20260925000000_dog_weight_tracking.sql` ANTES de
desplegar el frontend: la pestaña Peso ahora pide `body_condition_score` y
falla si esa columna no existe.
- Regenerar `types.ts` (se editó a mano: body_condition_score, dog_dashboard_config).
- QA: registrar peso → dogs.weight se actualiza (trigger), "Registró: <nombre>"
  aparece, alertas con ±5%/30 días, Personalizar guarda (solo admin).
- Decidido: TODO el personal registra pesos (RLS insert = get_active_org_ids);
  borrar/corregir solo admin/manager/vet. Workers pesan desde el detalle de
  cada trabajo en su app. QA: pesar como front_desk y como worker.
- Decidido: el Panel va en todos los planes (sin gating).

---

## Membresías Esencial / Pro / Premium — desplegar y validar (2026-09-24)

Código implementado y SIN commit (no probado contra BD: no había Docker, el
test pgTAP `supabase/tests/database/membership_plans.test.sql` nunca corrió).
Doc completo: `docs/membership-plans.md`. Modelo: `organizations.plan_tier`
(no roles nuevos); Rol A/B/C = admin de una org en basic/pro/premium.

**Pasos manuales, en orden:**
1. Correr `supabase test db` y arreglar lo que falle (migración + test).
2. LemonSqueezy: crear 3 variants mensuales (Esencial $19, Pro $49, Premium $99).
3. SQL: `update public.plan_catalog set ls_variant_id='<id>' where tier='basic'|'pro'|'premium';`
   (si hay variants anuales, ampliar plan_catalog a varios variants por plan).
4. Vercel: reemplazar `VITE_LS_CHECKOUT_URL_STARTER/_GROWTH` por
   `VITE_LS_CHECKOUT_URL_BASIC/_PRO/_PREMIUM`.
5. Aplicar migración `20260924000000_membership_plans.sql`.
6. Desplegar edge functions `handle-ls-webhook` y `send-campaign`.
7. Regenerar `src/integrations/supabase/types.ts` (se editó a mano).
8. QA con 3 orgs (una por plan) vía "Cambiar plan" en /platform-admin:
   candados del menú, upsell, límite de perros/usuarios, downgrade con datos
   sobre el límite, compra real en modo test de LemonSqueezy.

**Decisiones / trabajo pendiente:**
- Validar precios y límites (200 perros/2 usuarios en Esencial) contra
  competidores y costo real de Twilio/Resend por país; posible tope de mensajes.
- Solicitudes, Avisos y Clínica solo se bloquean en UI, no en backend
  (analizar flujos antes de agregar RLS restrictiva).
- HUECO DE SEGURIDAD previo: cualquier admin de kennel puede UPDATE de
  `subscription_status` y `trial_ends_at` en `organizations`. Blindarlos con
  el patrón de `guard_org_plan_tier` (revisar que ningún flujo legítimo los
  escriba desde el cliente).
- Mensaje de error amigable en UI para `plan_limit_dogs` / `plan_limit_members`.
- `RoutesPage` no tiene link en el sidebar (WIP tuyo); agregarlo para paseadores.
- Fase 5 (abajo) se solapa: `plan_catalog` ya existe con precios, límites y
  ls_variant_id; reutilizarlo en vez de crear otra tabla.
- Landing y BillingPage ya muestran los 3 planes nuevos (Enterprise eliminado;
  multisede = "a medida" por contacto).

---

## Panel de plataforma (/platform-admin) — Fase 5 pendiente

Fases 1-4 ya están en producción y funcionando (2026-09-16):
Overview, Organizaciones, Usuarios, consolas de escritura (créditos +
subscription_status), Uso y consumo (DAU/WAU/MAU, créditos consumidos),
e Infraestructura (Vercel + Supabase + Sentry, todo centralizado).

**Fase 5 — Facturación / MRR (no iniciada):**
- Mapear los variant IDs de LemonSqueezy a plan/precio. Hoy no existe ese
  mapeo en la base de datos (`packages.ls_variant_id` guarda el ID crudo,
  sin traducir a nombre de plan ni precio).
- Crear tabla `plan_catalog(variant_id, plan_name, monthly_price,
  credit_limit, seat_limit)` para poder estimar MRR sin hardcodear precios
  en el frontend.
- Página nueva "Facturación" en /platform-admin: breakdown de
  subscription_status + MRR estimado + link de salida al dashboard real
  de LemonSqueezy (fuente de verdad financiera).
- Para arrancar esto se necesita: la lista de tus planes actuales
  (Starter, Growth, etc.) con su variant_id de LemonSqueezy y precio
  mensual, o el link a tu dashboard de LemonSqueezy para sacarlos ahí.

Plan completo guardado en (histórico de la sesión que lo construyó):
/Users/daniellondono/.claude/plans/fluttering-mapping-church.md

---

  Lista de tareas pre-producción (sin Supabase CLI)aaa                                                
                                                                                                      
  1. Desplegar las Edge Functions (CRÍTICO)                                                           
                                                                                                      
  Las funciones send-campaign y handle-ls-webhook fueron modificadas con los fixes de seguridad       
  críticos. Necesitas subirlas manualmente al dashboard de Supabase.                                  
                                                                                                      
  Accede a: https://supabase.com/dashboard/project/vdcwrtqrnsekyguhqowc/functions                     
   
  Para cada función, copia el contenido del archivo correspondiente:                                  
                                                            
  - supabase/functions/send-campaign/index.ts → función send-campaign                                 
  - supabase/functions/handle-ls-webhook/index.ts → función handle-ls-webhook
                                                                                                      
  En el dashboard: Edge Functions → selecciona la función → Edit code → pega el contenido → Deploy.   
                                                                                                      
  ---                                                                                                 
  2. Configurar los secrets de las Edge Functions (CRÍTICO) 
                                                                                                      
  Accede a: https://supabase.com/dashboard/project/vdcwrtqrnsekyguhqowc/settings/functions
                                                                                                      
  Añade estos secrets (o verifica que ya existen):                                                    
                                                                                                      
  ┌─────────────────────────────┬──────────────────────────────────────────────────────┐              
  │           Secret            │                     Descripción                      │
  ├─────────────────────────────┼──────────────────────────────────────────────────────┤
  │ RESEND_API_KEY              │ Tu API key de Resend para envío de emails            │
  ├─────────────────────────────┼──────────────────────────────────────────────────────┤
  │ LEMONSQUEEZY_WEBHOOK_SECRET │ Signing secret del webhook en LemonSqueezy dashboard │              
  ├─────────────────────────────┼──────────────────────────────────────────────────────┤              
  │ ALLOWED_ORIGIN              │ https://tudominio.lovable.app (o tu dominio custom)  │              
  ├─────────────────────────────┼──────────────────────────────────────────────────────┤              
  │ SUPABASE_ANON_KEY           │ Tu anon/public key de Supabase (ya tienes la URL)    │
  └─────────────────────────────┴──────────────────────────────────────────────────────┘              
                                                            
  SUPABASE_SERVICE_ROLE_KEY y SUPABASE_URL son auto-inyectadas por Supabase en las edge functions — no
   necesitas configurarlas.                                 
                                                                                                      
  ---                                                       
  3. Verificar RLS Policies (ALTO)
                                  
  Accede a: https://supabase.com/dashboard/project/vdcwrtqrnsekyguhqowc/auth/policies
                                                                                                      
  Verifica que las tablas críticas tengan RLS habilitado y políticas que filtren por organization_id  
  y/o user_id:                                                                                        
                                                                                                      
  - reservations — ✅ debe tener organization_id en policies                                          
  - customers — ✅ debe tener organization_id
  - vaccination_schedule — ✅ debe tener organization_id                                              
  - medical_history — ✅ debe tener organization_id                                                   
  - campaigns — ✅ debe tener organization_id
                                                                                                      
  Si alguna tabla tiene RLS disabled, actívalo con el toggle en el dashboard.                         
                                                                                                      
  ---                                                                                                 
  4. Redesplegar el frontend desde Lovable                  
                                                                                                      
  Desde el editor de Lovable, haz clic en "Publish" (botón en la esquina superior derecha). Esto
  redespliega el frontend con todos los cambios de código que hemos aplicado.                         
                                                            
  Si tienes conectado un repositorio GitHub, Lovable detecta los commits automáticamente.             
                                                            
  ---                                                                                                 
  5. Verificación rápida post-deploy                        
                                    
  Una vez desplegado, prueba manualmente:
                                                                                                      
  1. Login → entra a tu organización
  2. Nueva reserva → crea una y verifica que aparece en el calendario                                 
  3. Check-in → comprueba que los warnings de vacunas/balance aparecen correctamente                  
  4. Campañas → intenta enviar una campaña de prueba (segmento "all")                                 
  5. Facturación → verifica que LemonSqueezy redirige correctamente                                   
                                                                                                      
  ---                                                                                                 
  Lo más urgente es el punto 1 (Edge Functions) — sin el redeploy, las funciones en producción siguen 
  teniendo el código sin autenticación JWT y el bug de cross-org data leakage. Los cambios del        
  frontend ya están en el repositorio y se despliegan solos desde Lovable.