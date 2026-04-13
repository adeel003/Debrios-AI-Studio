-- ===============================================================
-- DRIVERS COMPLIANCE & EMPLOYEE ID MIGRATION
-- ===============================================================

-- 1. Add missing columns to drivers table
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS employee_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS iqama_number TEXT,
ADD COLUMN IF NOT EXISTS iqama_expiry DATE,
ADD COLUMN IF NOT EXISTS route_permit_expiry DATE,
ADD COLUMN IF NOT EXISTS driver_card_expiry DATE,
ADD COLUMN IF NOT EXISTS driver_license_expiry DATE,
ADD COLUMN IF NOT EXISTS driver_picture_url TEXT;

-- 2. Create index for employee_id
CREATE INDEX IF NOT EXISTS idx_drivers_employee_id ON public.drivers(employee_id);

-- 3. Employee ID Generation Trigger (EMP-XXXX)
CREATE OR REPLACE FUNCTION public.generate_driver_employee_id()
RETURNS TRIGGER AS $$
DECLARE
    next_val INTEGER;
BEGIN
    -- Get the next sequence number globally
    SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id FROM 5) AS INTEGER)), 0) + 1
    INTO next_val
    FROM public.drivers;

    NEW.employee_id := 'EMP-' || LPAD(next_val::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_generate_driver_employee_id ON public.drivers;
CREATE TRIGGER tr_generate_driver_employee_id
BEFORE INSERT ON public.drivers
FOR EACH ROW
WHEN (NEW.employee_id IS NULL OR NEW.employee_id = '')
EXECUTE FUNCTION public.generate_driver_employee_id();

-- 4. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
