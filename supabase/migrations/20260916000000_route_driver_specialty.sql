-- ============================================================================
-- Servicio de ruta (transporte puerta a puerta) · Fase 1 — specialty 'driver'.
-- Sigue el mismo patrón que 20260824000000_welfare_checks.sql: CHECK de texto
-- libre, no enum, para poder ampliarlo sin migraciones de tipo.
-- ============================================================================

ALTER TABLE public.staff_members DROP CONSTRAINT IF EXISTS staff_members_specialty_check;
ALTER TABLE public.staff_members ADD CONSTRAINT staff_members_specialty_check
  CHECK (specialty IS NULL OR specialty IN ('trainer','groomer','cleaning','welfare','vet','driver'));
