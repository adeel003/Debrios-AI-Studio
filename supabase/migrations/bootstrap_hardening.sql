-- ===============================================================
-- HARDENING BOOTSTRAP FLOW & RLS POLICIES
-- ===============================================================

-- 1. Harden Tenant Creation
-- Prevents a user from creating multiple tenants if they already belong to one.
-- This ensures the "one company per admin" rule during bootstrap.
DROP POLICY IF EXISTS "Allow authenticated to create tenant" ON public.tenants;
CREATE POLICY "Allow authenticated to create tenant once" ON public.tenants
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND 
        NOT EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND tenant_id IS NOT NULL
        )
    );

-- 2. Allow users to update their own profile
-- Required for the 'upsert' operation during bootstrap and profile updates.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- 3. Ensure admins can update their tenant settings
-- Allows the company admin to manage their organization details.
DROP POLICY IF EXISTS "Admins can update tenant" ON public.tenants;
CREATE POLICY "Admins can update tenant" ON public.tenants
    FOR UPDATE USING (
        id IN (
            SELECT tenant_id FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 4. Fix Check Constraints (Ensure 'admin' is the standard role)
-- The code was using 'companyAdmin' which would fail against the DB constraints.
-- These policies ensure the standard roles are strictly enforced.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'dispatcher', 'driver'));

ALTER TABLE public.team_invites DROP CONSTRAINT IF EXISTS team_invites_role_check;
ALTER TABLE public.team_invites ADD CONSTRAINT team_invites_role_check CHECK (role IN ('admin', 'dispatcher', 'driver'));
