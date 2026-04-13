-- ===============================================================
-- OPERATIONAL WORKFLOW MIGRATION
-- ===============================================================

-- 1. Client Sites Table
CREATE TABLE IF NOT EXISTS public.client_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    site_name TEXT NOT NULL,
    address TEXT NOT NULL,
    google_maps_link TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Dumpyards Table
CREATE TABLE IF NOT EXISTS public.dumpyards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    region_or_city TEXT,
    google_maps_link TEXT,
    active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Update Drivers Table
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS monthly_target_loads INTEGER DEFAULT 0;

-- 4. Update Loads Table
-- Add load_type and link to site/dumpyard
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='load_type') THEN
        ALTER TABLE public.loads ADD COLUMN load_type TEXT CHECK (load_type IN ('New Deployment', 'Pickup', 'Exchange')) DEFAULT 'New Deployment';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='site_id') THEN
        ALTER TABLE public.loads ADD COLUMN site_id UUID REFERENCES public.client_sites(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='dumpyard_id') THEN
        ALTER TABLE public.loads ADD COLUMN dumpyard_id UUID REFERENCES public.dumpyards(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Update status constraint for loads
ALTER TABLE public.loads DROP CONSTRAINT IF EXISTS loads_status_check;
ALTER TABLE public.loads ADD CONSTRAINT loads_status_check 
CHECK (status IN ('scheduled', 'assigned', 'en_route', 'on_site', 'service_done', 'dumpyard_required', 'completed', 'cancelled'));

-- 5. Enable RLS
ALTER TABLE public.client_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dumpyards ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
-- Use get_auth_tenant_id() helper
DROP POLICY IF EXISTS "Tenant based access for client_sites" ON public.client_sites;
CREATE POLICY "Tenant based access for client_sites" ON public.client_sites
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

DROP POLICY IF EXISTS "Tenant based access for dumpyards" ON public.dumpyards;
CREATE POLICY "Tenant based access for dumpyards" ON public.dumpyards
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_client_sites_customer_id ON public.client_sites(customer_id);
CREATE INDEX IF NOT EXISTS idx_loads_site_id ON public.loads(site_id);
CREATE INDEX IF NOT EXISTS idx_loads_dumpyard_id ON public.loads(dumpyard_id);

-- 8. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
