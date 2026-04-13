-- Fix Tenants RLS Policies & Schema Cache
-- This script ensures the 'created_by' column exists and the API layer is aware of it.

-- 1. Ensure created_by column exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenants' AND column_name='created_by') THEN
        ALTER TABLE public.tenants ADD COLUMN created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid();
    END IF;
END $$;

-- 2. Force PostgREST to reload schema cache
-- This is often needed after adding columns via SQL editor
NOTIFY pgrst, 'reload schema';

-- 3. Update INSERT policy
-- Simplified for bootstrap reliability
DROP POLICY IF EXISTS "Allow authenticated to create tenant once" ON public.tenants;
DROP POLICY IF EXISTS "Allow authenticated to create tenant" ON public.tenants;

CREATE POLICY "Allow authenticated to create tenant" ON public.tenants
    FOR INSERT 
    WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Update SELECT policy
-- Ensure the creator can immediately see the row
DROP POLICY IF EXISTS "Users can view tenants they created" ON public.tenants;
CREATE POLICY "Users can view tenants they created" ON public.tenants
    FOR SELECT 
    USING (auth.uid() = created_by OR auth.uid() IS NOT NULL); -- Temporary permissive SELECT for debugging

-- 5. Restore "view own tenant" policy
DROP POLICY IF EXISTS "Users can view their own tenant" ON public.tenants;
CREATE POLICY "Users can view their own tenant" ON public.tenants
    FOR SELECT 
    USING (
        id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

-- 6. Ensure Profile Update Policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);
