# Verificación SQL — Worker View (RLS por rol/especialidad/asignación)

> Sin harness pg. Ejecutar contra BD local tras `supabase db reset`, impersonando
> usuarios con `SET LOCAL request.jwt.claim.sub`. Migraciones bajo prueba:
> `20260531000001_worker_role_specialty.sql`, `20260531000002_tasks_table.sql`,
> `20260531000003_worker_rls.sql`.
> DEPENDE de `fix/reservations-anon-rls` (la política `Anon full access reservations`
> debe estar eliminada; la migración `_000003` la elimina de forma defensiva).

> Nota de auth context: `auth.uid()` lee `request.jwt.claim.sub`. Para simular un
> usuario autenticado: `SET LOCAL ROLE authenticated;` + `SET LOCAL request.jwt.claim.sub = '<uuid>';`.
> Para simular anónimo: `SET LOCAL ROLE anon;` sin fijar el claim.
> Sin `psql` en el host — ejecutar vía el contenedor de la BD local:
> `docker exec -i supabase_db_vdcwrtqrnsekyguhqowc psql -U postgres -d postgres -f - < este_script.sql`
>
> Las aserciones que esperan bloqueo de RLS deben envolverse en `SAVEPOINT` /
> `ROLLBACK TO` porque un error aborta el bloque de transacción.

## Estado: TODAS PASAN (verificado 2026-06-02 contra BD local tras `supabase db reset`).

## Fixtures

```sql
BEGIN;

-- Org A (suscripción activa). Org B sólo para aislamiento cross-org.
INSERT INTO public.organizations (id, name, slug, subscription_status, trial_ends_at) VALUES
 ('a0000000-0000-0000-0000-00000000000a','Org A','org-a','active', now()+interval '30 days'),
 ('b0000000-0000-0000-0000-00000000000b','Org B','org-b','active', now()+interval '30 days')
ON CONFLICT (id) DO NOTHING;

-- Usuarios auth + profiles.
INSERT INTO auth.users (id, email) VALUES
 ('10000000-0000-0000-0000-000000000001','admin@a.com'),  -- U_admin
 ('10000000-0000-0000-0000-000000000002','fd@a.com'),     -- U_fd    (front_desk = scheduler)
 ('10000000-0000-0000-0000-000000000003','vet@a.com'),    -- U_vet   (worker / specialty=vet)
 ('10000000-0000-0000-0000-000000000004','train@a.com'),  -- U_train (worker / specialty=trainer)
 ('10000000-0000-0000-0000-000000000005','clean@a.com')   -- U_clean (worker / specialty=cleaning)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name) VALUES
 ('10000000-0000-0000-0000-000000000001','admin@a.com','Ada','Admin'),
 ('10000000-0000-0000-0000-000000000002','fd@a.com','Fred','Front'),
 ('10000000-0000-0000-0000-000000000003','vet@a.com','Vera','Vet'),
 ('10000000-0000-0000-0000-000000000004','train@a.com','Tom','Train'),
 ('10000000-0000-0000-0000-000000000005','clean@a.com','Cleo','Clean')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
 ('a0000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000001','admin'),
 ('a0000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000002','front_desk'),
 ('a0000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000003','worker'),
 ('a0000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000004','worker'),
 ('a0000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000005','worker')
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- staff_members con profile_id (= auth.uid()) y specialty.
INSERT INTO public.staff_members (id, organization_id, profile_id, first_name, last_name, email, role, specialty) VALUES
 ('20000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000003','Vera','Vet','vet@a.com','worker','vet'),
 ('20000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000004','Tom','Train','train@a.com','worker','trainer'),
 ('20000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000005','Cleo','Clean','clean@a.com','worker','cleaning')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customers (id, organization_id, first_name, last_name, email) VALUES
 ('30000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a','Carl','Customer','carl@a.com')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.dogs (id, organization_id, customer_id, name, breed) VALUES
 ('40000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a','30000000-0000-0000-0000-000000000001','Rex','Mestizo')
ON CONFLICT (id) DO NOTHING;

-- T1 -> U_clean, T2 -> U_train.
INSERT INTO public.tasks (id, organization_id, type, title, assignee_staff_id, status) VALUES
 ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a','cleaning','Aseo zona 1','20000000-0000-0000-0000-000000000005','pending'),  -- T1
 ('c0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-00000000000a','other','Sesion entren','20000000-0000-0000-0000-000000000004','pending')  -- T2
ON CONFLICT (id) DO NOTHING;

-- R1 -> staff_id = U_train.
INSERT INTO public.reservations (id, organization_id, customer_id, dog_id, staff_id, service_name, status, start_date, end_date) VALUES
 ('d0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','Guarderia','requested', now(), now()+interval '1 day')
ON CONFLICT (id) DO NOTHING;

-- Fila clínica para pruebas de lectura.
INSERT INTO public.medical_conditions (id, organization_id, dog_id, dog_name, condition_name) VALUES
 ('50000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a','40000000-0000-0000-0000-000000000001','Rex','Test cond')
ON CONFLICT (id) DO NOTHING;
```

---

## Aserciones — tasks

**A1 — worker ve sólo lo suyo.** `sub=U_clean`: PASS (ve T1; count=1; no ve T2 → 0).
```sql
SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000005';
SELECT count(*) FROM public.tasks;                                       -- 1
SELECT count(*) FROM public.tasks WHERE id='c0000000-0000-0000-0000-000000000002'; -- 0
RESET ROLE;
```

**A2 — scheduler ve todo.** `sub=U_fd`: PASS (count=2).
```sql
SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
SELECT count(*) FROM public.tasks;  -- 2
RESET ROLE;
```

**A3 — worker NO inserta tareas.** `sub=U_clean`: PASS (ERROR `new row violates row-level security policy for table "tasks"`).
```sql
SAVEPOINT s3;
SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000005';
INSERT INTO public.tasks (organization_id, type, title) VALUES ('a0000000-0000-0000-0000-00000000000a','cleaning','hack'); -- ERROR
ROLLBACK TO s3; RESET ROLE;
```

**A4 — scheduler SÍ inserta/asigna.** `sub=U_fd`: PASS (`INSERT 0 1`).
```sql
SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
INSERT INTO public.tasks (organization_id, type, title, assignee_staff_id)
  VALUES ('a0000000-0000-0000-0000-00000000000a','feeding','Comida','20000000-0000-0000-0000-000000000005'); -- INSERT 0 1
RESET ROLE;
```

**A5 — worker actualiza su tarea.** `sub=U_clean`, `UPDATE ... WHERE id=T1`: PASS (`UPDATE 1`).

**A6 — worker NO actualiza tarea de otro.** `sub=U_clean`, `WHERE id=T2`: PASS (`UPDATE 0` — no la ve).

**A7 — worker NO se reasigna ajena.** `sub=U_clean`, `SET assignee_staff_id=<self> WHERE id=T2`: PASS (`UPDATE 0`).

## Aserciones — reservations

**A8 — worker ve sólo sus reservas.** `sub=U_train`: PASS (ve R1 → 1). `sub=U_clean`: PASS (no ve R1 → 0).

**A9 — worker actualiza estado de su reserva.** `sub=U_train`, `SET status='in_progress' WHERE id=R1`: PASS (`UPDATE 1`).

**A10 — worker NO crea/reasigna reserva.**
- A10a `sub=U_train` INSERT reserva → PASS (ERROR RLS).
- A10b `sub=U_train` `SET staff_id=<otro> WHERE id=R1` → PASS (ERROR RLS por `WITH CHECK`; la reserva dejaría de pertenecerle).

**A11 — NINGÚN acceso anónimo.** `SET LOCAL ROLE anon;`: PASS (`SELECT count(*) FROM reservations` → 0).
```sql
SET LOCAL ROLE anon;
SELECT count(*) FROM public.reservations;  -- 0
RESET ROLE;
```

## Aserciones — clínica

**A12 — vet escribe clínica.** `sub=U_vet` INSERT `medical_history`: PASS (`INSERT 0 1`).

**A13 — trainer NO escribe clínica.** `sub=U_train` INSERT `vaccination_schedule`: PASS (ERROR RLS).

**A14 — todos LEEN clínica.** `sub=U_clean` `SELECT count(*) FROM medical_conditions`: PASS (count=1).

## Aserciones — report_cards

**A15 — trainer escribe report card.** `sub=U_train` INSERT `report_cards`: PASS (`INSERT 0 1`).

**A16 — cleaning NO escribe report card.** `sub=U_clean` INSERT `report_cards`: PASS (ERROR RLS).

**A17 — admin/manager escriben ambas sin importar especialidad.** `sub=U_admin`:
- A17a INSERT `medical_history` → PASS (`INSERT 0 1`).
- A17b INSERT `report_cards` → PASS (`INSERT 0 1`).

## Aserción extra — aislamiento cross-org

**A18 — scheduler de Org A no ve Org B.** `sub=U_fd` `SELECT count(*) FROM tasks WHERE organization_id=<Org B>`: PASS (0).

```sql
ROLLBACK;  -- al final del bloque de fixtures
```
