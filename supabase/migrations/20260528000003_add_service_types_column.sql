-- service_types was referenced in OrganizationContext but never added to the table.
-- Stores an array of { value, label } objects for the business profile.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS service_types jsonb NOT NULL DEFAULT '[]'::jsonb;
