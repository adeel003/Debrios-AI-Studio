-- ===============================================================
-- EMERGENCY AUTH & LOGIN RESTORATION FIX
-- ===============================================================

-- 1. Ensure get_auth_tenant_id is robust and handles search path
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS UUID AS $$
DECLARE
  _tenant_id UUID;
BEGIN
  -- Use explicit subquery with SECURITY DEFINER to bypass RLS
  SELECT tenant_id INTO _tenant_id FROM public.profiles WHERE id = auth.uid();
  RETURN _tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 2. Fix Profiles RLS (The likely cause of broken login)
-- We must ensure a user can ALWAYS see their own profile, even if tenant_id is NULL
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in same tenant" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view tenant profiles" ON public.profiles;

-- Policy 1: Always allow users to see their own profile (CRITICAL for login/onboarding)
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- Policy 2: Allow users to see other profiles in the same tenant
CREATE POLICY "Users can view profiles in same tenant" ON public.profiles
    FOR SELECT USING (tenant_id = public.get_auth_tenant_id());

-- Policy 3: Ensure users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 3. Ensure Tenants are visible to all authenticated users (for onboarding/lookup)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated to view all tenants" ON public.tenants;
CREATE POLICY "Allow authenticated to view all tenants" ON public.tenants
    FOR SELECT USING (auth.role() = 'authenticated');

-- 4. Fix Customers RLS (Ensure it doesn't block app boot if checked)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin and dispatcher can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Users can view their tenant's customers" ON public.customers;
DROP POLICY IF EXISTS "Users can manage their tenant's customers" ON public.customers;

CREATE POLICY "Users can view their tenant's customers" ON public.customers
    FOR SELECT USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY "Users can manage their tenant's customers" ON public.customers
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

-- 5. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
