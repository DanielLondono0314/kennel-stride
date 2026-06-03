# Verificación SQL — Tasks (RLS: scheduler-only insert, worker ve sólo lo asignado, aislamiento cross-org)

> Sin harness pg. Las migraciones bajo prueba (`20260531000002_tasks_table.sql`,
> `20260531000003_worker_rls.sql`) YA están aplicadas en la BD local; **no** ejecutar
> `supabase db reset`. Ejecutar impersonando usuarios con
> `SET LOCAL ROLE authenticated;` + `SET LOCAL request.jwt.claim.sub = '<uuid>';`
> (`auth.uid()` lee `request.jwt.claim.sub`). Para anónimo: `SET LOCAL ROLE anon;`.
>
> Sin `psql` en el host — ejecutar vía el contenedor de la BD local:
> `docker exec -i supabase_db_vdcwrtqrnsekyguhqowc psql -U postgres -d postgres -v ON_ERROR_STOP=0 -f - < este_script.sql`
>
> Todo el bloque va dentro de una transacción `BEGIN … ROLLBACK` (no deja datos).
> Las aserciones que esperan bloqueo de RLS se envuelven en `SAVEPOINT` / `ROLLBACK TO`
> porque un error aborta el bloque de transacción.
>
> Este doc complementa `worker_rls.md`: las aserciones 1–7 de `worker_rls.md` ya cubren
> visibilidad/insert/update por asignación; aquí el foco es **scheduler-only insert**,
> **worker-sees-only-assigned** y **aislamiento cross-org** (lectura e inserción).

## Estado: TODAS PASAN (verificado 2026-06-02 contra BD local, sin reset).

## Fixtures

```sql
BEGIN;

-- Org A (activa) + Org B (sólo para aislamiento cross-org).
INSERT INTO public.organizations (id, name, slug, subscription_status, trial_ends_at) VALUES
 ('a0000000-0000-0000-0000-00000000000a','Org A','org-a','active', now()+interval '30 days'),
 ('b0000000-0000-0000-0000-00000000000b','Org B','org-b','active', now()+interval '30 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, email) VALUES
 ('10000000-0000-0000-0000-000000000001','admin@a.com'),
 ('10000000-0000-0000-0000-000000000002','fd@a.com'),     -- U_fd    (front_desk = scheduler Org A)
 ('10000000-0000-0000-0000-000000000005','clean@a.com'),  -- U_clean (worker / specialty=cleaning)
 ('10000000-0000-0000-0000-000000000004','train@a.com'),  -- U_train (worker / specialty=trainer)
 ('10000000-0000-0000-0000-00000000000b','fdb@b.com')     -- U_fdb   (front_desk = scheduler Org B)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, first_name, last_name) VALUES
 ('10000000-0000-0000-0000-000000000001','admin@a.com','Ada','Admin'),
 ('10000000-0000-0000-0000-000000000002','fd@a.com','Fred','Front'),
 ('10000000-0000-0000-0000-000000000005','clean@a.com','Cleo','Clean'),
 ('10000000-0000-0000-0000-000000000004','train@a.com','Tom','Train'),
 ('10000000-0000-0000-0000-00000000000b','fdb@b.com','Bea','Boss')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
 ('a0000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000001','admin'),
 ('a0000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000002','front_desk'),
 ('a0000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000005','worker'),
 ('a0000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000004','worker'),
 ('b0000000-0000-0000-0000-00000000000b','10000000-0000-0000-0000-00000000000b','front_desk')
ON CONFLICT (organization_id, user_id) DO NOTHING;

INSERT INTO public.staff_members (id, organization_id, profile_id, first_name, last_name, email, role, specialty) VALUES
 ('20000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000005','Cleo','Clean','clean@a.com','worker','cleaning'),
 ('20000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000004','Tom','Train','train@a.com','worker','trainer')
ON CONFLICT (id) DO NOTHING;

-- T1 -> U_clean, T2 -> U_train. T_B en Org B (aislamiento).
INSERT INTO public.tasks (id, organization_id, type, title, assignee_staff_id, status) VALUES
 ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a','cleaning','Aseo zona 1','20000000-0000-0000-0000-000000000005','pending'),  -- T1
 ('c0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-00000000000a','other','Sesion entren','20000000-0000-0000-0000-000000000004','pending')  -- T2
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tasks (id, organization_id, type, title, status) VALUES
 ('c0000000-0000-0000-0000-0000000000bb','b0000000-0000-0000-0000-00000000000b','cleaning','Tarea Org B','pending')                                     -- T_B
ON CONFLICT (id) DO NOTHING;
```

---

## Aserciones

**T1 — worker ve sólo lo suyo.** `sub=U_clean`: PASS (`total_visible=1`; `sees_t2=0`).
```sql
SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000005';
SELECT count(*) AS total_visible FROM public.tasks;                                       -- 1
SELECT count(*) AS sees_t2 FROM public.tasks WHERE id='c0000000-0000-0000-0000-000000000002'; -- 0
RESET ROLE;
```

**T2 — scheduler (front_desk) ve todo en su org.** `sub=U_fd`: PASS (`scheduler_total=2`).
```sql
SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
SELECT count(*) AS scheduler_total FROM public.tasks;  -- 2
RESET ROLE;
```

**T3 — worker NO inserta tareas (scheduler-only insert).** `sub=U_clean`: PASS
(`ERROR: new row violates row-level security policy for table "tasks"`).
```sql
SAVEPOINT s3;
SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000005';
INSERT INTO public.tasks (organization_id, type, title) VALUES ('a0000000-0000-0000-0000-00000000000a','cleaning','hack'); -- ERROR RLS
ROLLBACK TO s3; RESET ROLE;
```

**T4 — scheduler SÍ inserta/asigna.** `sub=U_fd`: PASS (`INSERT 0 1`).
```sql
SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
INSERT INTO public.tasks (organization_id, type, title, assignee_staff_id)
  VALUES ('a0000000-0000-0000-0000-00000000000a','feeding','Comida','20000000-0000-0000-0000-000000000005'); -- INSERT 0 1
RESET ROLE;
```

**T5 — worker actualiza su tarea.** `sub=U_clean`, `WHERE id=T1`: PASS (`UPDATE 1`).
```sql
SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000005';
UPDATE public.tasks SET status='in_progress' WHERE id='c0000000-0000-0000-0000-000000000001'; -- UPDATE 1
RESET ROLE;
```

**T6 — worker NO actualiza tarea de otro.** `sub=U_clean`, `WHERE id=T2`: PASS (`UPDATE 0` — no la ve).
```sql
SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000005';
UPDATE public.tasks SET status='done' WHERE id='c0000000-0000-0000-0000-000000000002'; -- UPDATE 0
RESET ROLE;
```

**T7 — worker NO se reasigna una tarea ajena.** `sub=U_clean`, `SET assignee_staff_id=<self> WHERE id=T2`: PASS (`UPDATE 0`).
```sql
SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000005';
UPDATE public.tasks SET assignee_staff_id='20000000-0000-0000-0000-000000000005' WHERE id='c0000000-0000-0000-0000-000000000002'; -- UPDATE 0
RESET ROLE;
```

**T8 — cross-org lectura: scheduler de Org A no ve tareas de Org B.** `sub=U_fd`: PASS (`sees_org_b=0`).
```sql
SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
SELECT count(*) AS sees_org_b FROM public.tasks WHERE organization_id='b0000000-0000-0000-0000-00000000000b'; -- 0
RESET ROLE;
```

**T9 — cross-org inserción: scheduler de Org A NO inserta en Org B.** `sub=U_fd`: PASS
(`ERROR: new row violates row-level security policy for table "tasks"`).
```sql
SAVEPOINT s9;
SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
INSERT INTO public.tasks (organization_id, type, title) VALUES ('b0000000-0000-0000-0000-00000000000b','cleaning','crossorg'); -- ERROR RLS
ROLLBACK TO s9; RESET ROLE;
```

**T10 — anónimo sin acceso.** `SET LOCAL ROLE anon;`: PASS (`anon_total=0`).
```sql
SET LOCAL ROLE anon;
SELECT count(*) AS anon_total FROM public.tasks;  -- 0
RESET ROLE;
```

```sql
ROLLBACK;  -- al final del bloque de fixtures
```
