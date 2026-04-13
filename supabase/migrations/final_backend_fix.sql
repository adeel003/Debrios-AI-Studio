-- ===============================================================
-- FINAL BACKEND & SCHEMA FIX MIGRATION
-- ===============================================================

-- 1. Fix Tenants Table (Add missing columns)
-- Resolves PGRST204: Could not find the 'logo_url' column
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS default_currency TEXT DEFAULT 'SAR',
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Riyadh';

-- 2. Create Notifications Table
-- Resolves PGRST205: Could not find the table 'public.notifications'
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Notifications RLS Policies
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (user_id = auth.uid());

-- 3. Fix Profiles RLS Recursion
-- Resolves 42P17: infinite recursion detected in policy for relation "profiles"

-- Step A: Break the loop by making tenants SELECT non-recursive
DROP POLICY IF EXISTS "Users can view their own tenant" ON public.tenants;
DROP POLICY IF EXISTS "Allow authenticated to view all tenants" ON public.tenants;
CREATE POLICY "Allow authenticated to view all tenants" ON public.tenants
    FOR SELECT USING (auth.role() = 'authenticated');

-- Step B: Create a Security Definer function to fetch tenant_id without recursion
-- This function runs with the privileges of the creator (postgres), bypassing RLS.
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Step C: Update Profiles policies to use the non-recursive function
DROP POLICY IF EXISTS "Admins can view tenant profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in same tenant" ON public.profiles;

CREATE POLICY "Users can view profiles in same tenant" ON public.profiles
    FOR SELECT USING (tenant_id = public.get_auth_tenant_id());

-- 4. Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
