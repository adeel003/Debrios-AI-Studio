-- ===============================================================
-- FIX: Profile Fetch Timeout & RLS Recursion
-- ===============================================================

-- 1. Optimize get_auth_tenant_id to be non-recursive and STABLE
-- We use SECURITY DEFINER to bypass RLS on the profiles table lookup.
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS UUID AS $$
BEGIN
  -- This query runs as the owner (postgres) who has bypassrls enabled by default.
  -- This prevents the infinite recursion when called from a profiles policy.
  RETURN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- 2. Fix Profiles RLS Policies
-- We must ensure the policies are efficient and do not cause circular lookups.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in same tenant" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view tenant profiles" ON public.profiles;

-- Policy 1: Always allow users to see their own profile (Simple, non-recursive)
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- Policy 2: Allow users to see other profiles in the same tenant
-- We use the STABLE SECURITY DEFINER function which is now safe from recursion.
CREATE POLICY "Users can view profiles in same tenant" ON public.profiles
    FOR SELECT USING (
        tenant_id IS NOT NULL AND 
        tenant_id = public.get_auth_tenant_id()
    );

-- 3. Add missing index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles(tenant_id);

-- 4. Reload schema cache
NOTIFY pgrst, 'reload schema';
