-- ===============================================================
-- EXTEND DRIVERS (mvpi_expiry) + DUMPSTERS (location_link)
-- ===============================================================
-- Safe / additive migration. No destructive changes.
-- All other compliance fields already exist via
-- drivers_compliance_migration.sql.
-- ===============================================================

-- 1. Add MVPI (Motor Vehicle Periodic Inspection) expiry to drivers
ALTER TABLE public.drivers
ADD COLUMN IF NOT EXISTS mvpi_expiry DATE;

-- 2. Add location link (e.g. Google Maps URL) to dumpsters
ALTER TABLE public.dumpsters
ADD COLUMN IF NOT EXISTS location_link TEXT;

-- 3. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
