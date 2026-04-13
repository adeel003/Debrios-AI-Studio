-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    default_currency TEXT DEFAULT 'SAR',
    timezone TEXT DEFAULT 'Asia/Riyadh',
    fee_rate NUMERIC DEFAULT 0.05,
    created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    role TEXT CHECK (role IN ('admin', 'dispatcher', 'driver')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    country TEXT,
    lat NUMERIC,
    lng NUMERIC,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Drivers Table
CREATE TABLE IF NOT EXISTS public.drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    license_number TEXT,
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'busy', 'off_duty')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Loads Table
CREATE TABLE IF NOT EXISTS public.loads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
    vehicle_id UUID, -- Placeholder for future vehicles table
    dumpster_id UUID, -- Placeholder for future dumpsters table
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'dispatched', 'in_progress', 'completed', 'cancelled')),
    weight_kg NUMERIC,
    load_value NUMERIC,
    currency TEXT DEFAULT 'USD',
    dispatched_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Load Events Table
CREATE TABLE IF NOT EXISTS public.load_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Platform Fees Table
CREATE TABLE IF NOT EXISTS public.platform_fees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    debtor_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
    load_value NUMERIC NOT NULL,
    fee_rate NUMERIC NOT NULL,
    fee_amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Team Invites Table
CREATE TABLE IF NOT EXISTS public.team_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'dispatcher', 'driver')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL, -- 'load_assigned', 'status_updated', etc.
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Audit Logs Table (General)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'create', 'update', 'delete', 'login', etc.
    entity_type TEXT NOT NULL, -- 'load', 'customer', 'driver', 'profile', etc.
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.load_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Tenants: Allow authenticated users to create a tenant (signup)
CREATE POLICY "Allow authenticated to create tenant" ON public.tenants
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Tenants: Allow users to view tenants they created
CREATE POLICY "Users can view tenants they created" ON public.tenants
    FOR SELECT USING (auth.uid() = created_by);

-- Tenants: Allow users to view their own tenant (non-recursive)
CREATE POLICY "Users can view their own tenant" ON public.tenants
    FOR SELECT USING (
        id IN (
            SELECT tenant_id FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

-- Profiles: Allow users to view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- Profiles: Allow users to insert their own profile (signup)
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Profiles: Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Profiles: Allow admins to view all profiles in their tenant
-- Non-recursive: checks if the current user is the creator of the tenant
CREATE POLICY "Admins can view tenant profiles" ON public.profiles
    FOR SELECT USING (
        tenant_id IN (
            SELECT id FROM public.tenants 
            WHERE created_by = auth.uid()
        )
    );

-- Customers: Tenant-based isolation
CREATE POLICY "Tenant based access for customers" ON public.customers
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

-- Drivers: Tenant-based isolation
CREATE POLICY "Tenant based access for drivers" ON public.drivers
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

-- Loads: Tenant-based isolation
CREATE POLICY "Tenant based access for loads" ON public.loads
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

-- Load Events: Tenant-based isolation
CREATE POLICY "Tenant based access for load_events" ON public.load_events
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

-- Platform Fees: Tenant-based isolation (debtor side)
CREATE POLICY "Tenant based access for platform_fees" ON public.platform_fees
    FOR SELECT USING (
        debtor_tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

-- Team Invites: Tenant-based isolation
CREATE POLICY "Tenant based access for team_invites" ON public.team_invites
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

-- Notifications: User-based isolation
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR ALL USING (user_id = auth.uid());

-- Audit Logs: Tenant-based isolation
CREATE POLICY "Tenant based access for audit_logs" ON public.audit_logs
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

-- Special policy for team_invites: Allow checking invite by email without being in tenant yet
CREATE POLICY "Allow checking invites by email" ON public.team_invites
    FOR SELECT USING (email = auth.jwt() ->> 'email');
