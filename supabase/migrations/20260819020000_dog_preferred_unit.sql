-- Permite asignar (opcionalmente) una perrera "preferida/habitual" a un perro
-- desde su ficha, sin depender de una reserva activa. Es solo referencia para
-- el staff — la ocupación real de la perrera sigue gestionada por
-- check_in_reservation()/check_out_reservation().
ALTER TABLE public.dogs
  ADD COLUMN IF NOT EXISTS preferred_unit_id uuid REFERENCES public.facility_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dogs_preferred_unit ON public.dogs(preferred_unit_id);
