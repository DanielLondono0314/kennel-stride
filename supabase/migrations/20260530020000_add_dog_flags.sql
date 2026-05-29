-- ============================================================================
-- Drift fix: columnas de comportamiento/salud del perro usadas por la UI
-- (DogModal guarda estos flags; DogsPage/DogProfilePage los muestran con
-- DogCharacteristicIcons; ImportDataModal los mapea en el CSV), pero NINGUNA
-- migración las creaba en `public.dogs` — existían solo en el código (y, según
-- el entorno, añadidas a la BD remota fuera de migraciones).
--
-- Sin esta migración, en un entorno limpio (o tras `supabase db reset`) crear o
-- editar un perro falla con: "Could not find the 'is_aggressive' column".
--
-- Idempotente: `ADD COLUMN IF NOT EXISTS` → no-op si ya existen en remoto.
-- ============================================================================
ALTER TABLE public.dogs
  ADD COLUMN IF NOT EXISTS is_aggressive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_allergies boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS on_medication boolean NOT NULL DEFAULT false;
