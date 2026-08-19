-- Permite marcar perros/clientes como inactivos en vez de forzar borrado
-- duro cuando dejan de ser relevantes, y acelera filtrar por ese estado en
-- las listas (que además ahora traen selección múltiple para borrado real).
ALTER TABLE public.dogs
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_dogs_is_active ON public.dogs(is_active);
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON public.customers(is_active);
