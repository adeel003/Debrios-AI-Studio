-- ===============================================================
-- DUMPSTERS INVENTORY BACKEND MIGRATION
-- ===============================================================

-- 1. Create Dumpsters Table
CREATE TABLE IF NOT EXISTS public.dumpsters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    asset_number TEXT NOT NULL UNIQUE,
    size TEXT NOT NULL,
    condition TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Available',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add Constraints
ALTER TABLE public.dumpsters 
DROP CONSTRAINT IF EXISTS dumpsters_condition_check;

ALTER TABLE public.dumpsters 
ADD CONSTRAINT dumpsters_condition_check 
CHECK (condition IN ('Able to Rent', 'Damaged', 'Under Maintenance'));

ALTER TABLE public.dumpsters 
DROP CONSTRAINT IF EXISTS dumpsters_status_check;

ALTER TABLE public.dumpsters 
ADD CONSTRAINT dumpsters_status_check 
CHECK (status IN ('Available', 'Assigned', 'Out of Service'));

-- 3. Add Indexes
CREATE INDEX IF NOT EXISTS idx_dumpsters_tenant_id ON public.dumpsters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dumpsters_asset_number ON public.dumpsters(asset_number);
CREATE INDEX IF NOT EXISTS idx_dumpsters_size ON public.dumpsters(size);
CREATE INDEX IF NOT EXISTS idx_dumpsters_status ON public.dumpsters(status);

-- 4. Enable RLS
ALTER TABLE public.dumpsters ENABLE ROW LEVEL SECURITY;

-- 5. Add RLS Policies
-- Use the non-recursive get_auth_tenant_id() function created in previous migrations
DROP POLICY IF EXISTS "Admins and dispatchers can manage dumpsters" ON public.dumpsters;
CREATE POLICY "Admins and dispatchers can manage dumpsters" ON public.dumpsters
    FOR ALL USING (
        tenant_id = public.get_auth_tenant_id()
        AND (
            SELECT role FROM public.profiles WHERE id = auth.uid()
        ) IN ('admin', 'dispatcher')
    );

DROP POLICY IF EXISTS "Users can view their tenant's dumpsters" ON public.dumpsters;
CREATE POLICY "Users can view their tenant's dumpsters" ON public.dumpsters
    FOR SELECT USING (
        tenant_id = public.get_auth_tenant_id()
    );

-- 6. Asset Number Generation Trigger
CREATE OR REPLACE FUNCTION public.generate_dumpster_asset_number()
RETURNS TRIGGER AS $$
DECLARE
    next_val INTEGER;
BEGIN
    -- Get the next sequence number globally to ensure global uniqueness as requested
    SELECT COALESCE(MAX(CAST(SUBSTRING(asset_number FROM 5) AS INTEGER)), 0) + 1
    INTO next_val
    FROM public.dumpsters;

    NEW.asset_number := 'DMP-' || LPAD(next_val::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_generate_dumpster_asset_number ON public.dumpsters;
CREATE TRIGGER tr_generate_dumpster_asset_number
BEFORE INSERT ON public.dumpsters
FOR EACH ROW
WHEN (NEW.asset_number IS NULL OR NEW.asset_number = '')
EXECUTE FUNCTION public.generate_dumpster_asset_number();

-- 7. Updated At Trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_dumpsters_handle_updated_at ON public.dumpsters;
CREATE TRIGGER tr_dumpsters_handle_updated_at
BEFORE UPDATE ON public.dumpsters
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 8. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
