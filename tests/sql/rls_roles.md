# Verificación SQL — Stream D (RLS por rol + suscripción)

> Sin harness de pg en el repo. Ejecutar contra BD local (`supabase db reset`)
> o CI con pgTAP. Cubre C3 (enforcement de suscripción) y C4 (roles en BD).
> Migración: `supabase/migrations/20260530010000_role_based_rls.sql`.

## Modelo
- `app_role = ('admin','front_desk','trainer','manager')`, en `organization_members.role`.
- Escritores de finanzas: admin/manager/front_desk. `trainer` = solo lectura en finanzas.
- Lectura SIEMPRE permitida a miembros (aunque la suscripción haya vencido).
- Escritura requiere suscripción `active` o `trialing` no vencido.

## Fixtures
- Org `A` con `subscription_status='active'`. Miembros: `U_admin` (admin),
  `U_fd` (front_desk), `U_trainer` (trainer).
- Org `B` con `subscription_status='cancelled'` (o trial vencido). Miembro `U_b` (admin).

## Aserciones — C4 (roles)
1. **trainer NO puede escribir finanzas.** `SET request.jwt.claim.sub = U_trainer`;
   `UPDATE public.packages SET price = 1 WHERE organization_id = A;` → 0 filas (RLS bloquea).
   `INSERT INTO public.invoices(...)` en org A → error/0 filas.
2. **trainer SÍ puede leer finanzas.** `SELECT count(*) FROM public.invoices WHERE organization_id=A` → ve las filas.
3. **trainer SÍ puede operar tablas operativas.** `INSERT INTO public.reservations(...)` org A → OK
   (org activa; cualquier rol opera). *(Nota: en la app las reservas se crean por RPC create_reservation.)*
4. **front_desk puede crear factura.** `sub=U_fd`; `INSERT INTO public.invoices(...)` org A → OK.
5. **admin puede gestionar staff; front_desk NO.** `sub=U_fd`; `INSERT INTO public.staff_members(...)` org A
   → bloqueado. `sub=U_admin` → OK.

## Aserciones — C3 (suscripción)
6. **Org cancelada NO puede escribir (ni siquiera el admin).** `sub=U_b`;
   `INSERT INTO public.customers(...)` org B → bloqueado;
   `UPDATE public.invoices ... WHERE organization_id=B` → 0 filas.
7. **Org cancelada SÍ puede leer.** `sub=U_b`; `SELECT * FROM public.customers WHERE organization_id=B` → ve sus filas.
8. **RPCs Fase 1 siguen funcionando (SECURITY DEFINER bypassa RLS).**
   En org A activa, `SELECT public.deduct_package_credit(<pkg>)` y
   `SELECT public.create_reservation(...)` → OK pese a las políticas endurecidas.

## Notas / residuales conocidos
- La RLS de escritura financiera es a nivel tabla (admin/manager/front_desk). La
  distinción fina (p.ej. *cancelar* factura solo admin/manager vs *marcar pagada*
  front_desk) se mantiene en la UI (`usePermission`); endurecerla en BD requeriría
  políticas por-columna/por-estado (follow-up).
- `business_profile` conserva su política org-scoped previa (no financiera).
- Aplicar y correr estas aserciones ANTES de desplegar; un error de RLS puede
  bloquear a usuarios legítimos.
