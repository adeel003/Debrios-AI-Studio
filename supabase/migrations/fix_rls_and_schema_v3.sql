-- ===============================================================
-- FIX BACKEND ERRORS & PREPARE FOR WORKFLOW UPDATES
-- ===============================================================

-- 1. Ensure Dumpyards Table exists with correct columns
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

-- 2. Ensure Client Sites Table exists with correct columns
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

-- 3. Update Loads Table for new workflow
ALTER TABLE public.loads ADD COLUMN IF NOT EXISTS google_maps_link TEXT;
ALTER TABLE public.loads ADD COLUMN IF NOT EXISTS parent_load_id UUID REFERENCES public.loads(id) ON DELETE SET NULL;

-- 4. Robust Non-Recursive RLS Helper
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS UUID AS $$
  -- Using a subquery on profiles with SECURITY DEFINER to bypass RLS on profiles
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 5. Fix Customers RLS (Crucial for Part A.3)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant based access for customers" ON public.customers;
DROP POLICY IF EXISTS "Admin and dispatcher can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Allow authenticated to view customers" ON public.customers;
DROP POLICY IF EXISTS "Users can view customers in same tenant" ON public.customers;

CREATE POLICY "Admin and dispatcher can manage customers" ON public.customers
    FOR ALL TO authenticated
    USING (tenant_id = public.get_auth_tenant_id())
    WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 6. Fix Client Sites RLS
ALTER TABLE public.client_sites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant based access for client_sites" ON public.client_sites;
CREATE POLICY "Tenant based access for client_sites" ON public.client_sites
    FOR ALL TO authenticated
    USING (tenant_id = public.get_auth_tenant_id())
    WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 7. Fix Dumpyards RLS
ALTER TABLE public.dumpyards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant based access for dumpyards" ON public.dumpyards;
CREATE POLICY "Tenant based access for dumpyards" ON public.dumpyards
    FOR ALL TO authenticated
    USING (tenant_id = public.get_auth_tenant_id())
    WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 8. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
