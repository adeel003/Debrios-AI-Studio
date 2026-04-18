-- ===============================================================
-- FIX: Profile Fetch Stability
--
-- Problems solved:
--   1. get_auth_tenant_id() was VOLATILE (emergency_auth_fix.sql dropped STABLE).
--      VOLATILE means Postgres calls it once per row during any table scan,
--      multiplying DB round-trips under load. STABLE = called once per query.
--
--   2. final_rls_fix.sql regressed customers/drivers/loads back to raw inline
--      subqueries instead of the SECURITY DEFINER function, re-introducing
--      un-cached per-row lookups. This migration restores the function-based
--      approach on all affected tables.
--
--   3. search_path was set to "public, auth" — the auth schema is internal to
--      Supabase and must NOT be in the search_path of user-defined functions.
--      auth.uid() is already fully-qualified in the function body.
-- ===============================================================

-- 1. Canonical get_auth_tenant_id: SQL language, STABLE, no auth in search_path
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 2. Restore index (idempotent)
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles(tenant_id);

-- 3. Restore SECURITY DEFINER-based policies on customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their tenant's customers" ON public.customers;
DROP POLICY IF EXISTS "Users can manage their tenant's customers" ON public.customers;

CREATE POLICY "Users can view their tenant's customers" ON public.customers
    FOR SELECT USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY "Users can manage their tenant's customers" ON public.customers
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

-- 4. Restore SECURITY DEFINER-based policies on drivers
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their tenant's drivers" ON public.drivers;
DROP POLICY IF EXISTS "Users can manage their tenant's drivers" ON public.drivers;

CREATE POLICY "Users can view their tenant's drivers" ON public.drivers
    FOR SELECT USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY "Users can manage their tenant's drivers" ON public.drivers
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

-- 5. Restore SECURITY DEFINER-based policies on loads
ALTER TABLE public.loads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their tenant's loads" ON public.loads;
DROP POLICY IF EXISTS "Users can manage their tenant's loads" ON public.loads;

CREATE POLICY "Users can view their tenant's loads" ON public.loads
    FOR SELECT USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY "Users can manage their tenant's loads" ON public.loads
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
