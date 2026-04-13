-- Final RLS Fix for Onboarding & Simulation
-- This script ensures all necessary policies are in place for a smooth onboarding flow.

-- 1. Tenants Table
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Drop existing to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated to create tenant" ON public.tenants;
DROP POLICY IF EXISTS "Users can view tenants they created" ON public.tenants;
DROP POLICY IF EXISTS "Users can view their own tenant" ON public.tenants;
DROP POLICY IF EXISTS "Allow all authenticated to view all tenants" ON public.tenants;

-- INSERT: Any authenticated user can create a tenant
CREATE POLICY "Allow authenticated to create tenant" ON public.tenants
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- SELECT: Any authenticated user can view any tenant (safe, only name/slug)
CREATE POLICY "Allow authenticated to view all tenants" ON public.tenants
    FOR SELECT USING (auth.role() = 'authenticated');

-- 2. Profiles Table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- 3. Customers Table
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their tenant's customers" ON public.customers;
DROP POLICY IF EXISTS "Users can manage their tenant's customers" ON public.customers;

CREATE POLICY "Users can view their tenant's customers" ON public.customers
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users can manage their tenant's customers" ON public.customers
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

-- 4. Drivers Table
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their tenant's drivers" ON public.drivers;
DROP POLICY IF EXISTS "Users can manage their tenant's drivers" ON public.drivers;

CREATE POLICY "Users can view their tenant's drivers" ON public.drivers
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users can manage their tenant's drivers" ON public.drivers
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

-- 5. Loads Table
ALTER TABLE public.loads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their tenant's loads" ON public.loads;
DROP POLICY IF EXISTS "Users can manage their tenant's loads" ON public.loads;

CREATE POLICY "Users can view their tenant's loads" ON public.loads
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users can manage their tenant's loads" ON public.loads
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
