import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { Building2, Loader2, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';

export function ProfileSetup() {
  const { user, profile, refreshProfile, signOut, profileLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState('');

  if (!user) return <Navigate to="/login" replace />;
  if (profile?.tenant_id) return <Navigate to="/" replace />;

  // Check for pending invites on mount to handle invited users
  React.useEffect(() => {
    const checkInvites = async () => {
      if (!user.email) return;
      
      const { data: invite } = await supabase
        .from('team_invites')
        .select('*')
        .eq('email', user.email)
        .eq('status', 'pending')
        .single();
      
      if (invite) {
        // If an invite exists, we should probably let AuthContext handle it 
        // or trigger a refresh.
        await refreshProfile();
      }
    };
    
    checkInvites();
  }, [user.email, refreshProfile]);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loading || !companyName.trim()) {
      return;
    }
    
    setLoading(true);
    const toastId = toast.loading('Setting up your organization...');

    try {
      // 0. Double check if profile already exists (idempotency)
      const { data: existingProfile, error: profileFetchError } = await supabase
        .from('profiles')
        .select('id, tenant_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileFetchError) {
        console.error('Error fetching profile during setup:', profileFetchError);
      }

      if (existingProfile?.tenant_id) {
        toast.loading('Recovering session...', { id: toastId });
        await refreshProfile();
        navigate('/', { replace: true });
        return;
      }

      // 1. Idempotency Check: Did this user already create a tenant?
      const { data: existingTenants, error: tenantFetchError } = await supabase
        .from('tenants')
        .select('id, name, slug, created_by')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (tenantFetchError) {
        console.error('Error checking existing tenant:', tenantFetchError);
      }

      let tenantId = existingTenants && existingTenants.length > 0 ? existingTenants[0].id : null;

      if (tenantId) {
        toast.loading('Recovering your organization...', { id: toastId });
      } else {
        // Also check if a tenant with this slug exists
        const baseSlug = companyName.toLowerCase().trim()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');

        const { data: slugTenant } = await supabase
          .from('tenants')
          .select('id, created_by')
          .eq('slug', baseSlug)
          .maybeSingle();
        
        if (slugTenant) {
          if (slugTenant.created_by === user.id) {
            tenantId = slugTenant.id;
            toast.loading('Recovering organization...', { id: toastId });
          }
        }
      }

      if (!tenantId) {
        // 2. Create Tenant with collision-safe slug
        const baseSlug = companyName.toLowerCase().trim()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        
        let attempts = 0;
        let success = false;

        while (attempts < 5 && !success) {
          const slugToTry = attempts === 0 ? baseSlug : `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
          
          const { data: tenant, error: insertError } = await supabase
            .from('tenants')
            .insert([{
              name: companyName.trim(),
              slug: slugToTry,
              fee_rate: 0.05,
              created_by: user.id
            }])
            .select('id')
            .single();

          if (!insertError) {
            tenantId = tenant.id;
            success = true;
          } else if (insertError.code === '23505') { // Unique violation
            // Fallback: Check if THIS slug belongs to the current user
            const { data: collisionTenant } = await supabase
              .from('tenants')
              .select('id, created_by')
              .eq('slug', slugToTry)
              .maybeSingle();
            
            if (collisionTenant && collisionTenant.created_by === user.id) {
              tenantId = collisionTenant.id;
              success = true;
              break;
            }

            attempts++;
            if (attempts === 1) {
              toast.loading('Name already taken, generating a unique ID...', { id: toastId });
            }
          } else {
            console.error('Unexpected error during tenant creation:', insertError);
            throw insertError;
          }
        }

        if (!success) {
          throw new Error('Could not generate a unique organization ID. Please try a different company name.');
        }
      }

      // 3. Create or Update Profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert([{
          id: user.id,
          tenant_id: tenantId,
          role: 'admin',
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
          status: 'active',
          last_active_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

      if (profileError) {
        console.error('Failed to link profile to tenant:', profileError);
        // Log failure to audit_logs for observability
        await supabase.from('audit_logs').insert([{
          tenant_id: tenantId,
          user_id: user.id,
          action: 'ONBOARDING_FAILURE',
          entity_type: 'profile',
          entity_id: user.id,
          metadata: {
            error: profileError.message,
            company_name: companyName,
            tenant_id: tenantId
          }
        }]);
        throw profileError;
      }

      // Log success
      await supabase.from('audit_logs').insert([{
        tenant_id: tenantId,
        user_id: user.id,
        action: 'ONBOARDING_SUCCESS',
        entity_type: 'tenant',
        entity_id: tenantId,
        metadata: {
          company_name: companyName
        }
      }]);

      toast.success('Organization setup complete!', { id: toastId });
      
      // Force a small delay to ensure Supabase replication/indexing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await refreshProfile();
      navigate('/', { replace: true });
    } catch (error: any) {
      console.error('Onboarding error:', error);
      toast.error(error.message || 'Failed to setup profile', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // Pre-fill company name from metadata if available
  React.useEffect(() => {
    if (user?.user_metadata?.company_name && !companyName) {
      setCompanyName(user.user_metadata.company_name);
    }
  }, [user?.user_metadata?.company_name, companyName]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
        <div className="text-center">
          <div className="flex justify-center">
            <div className="bg-blue-100 p-3 rounded-full">
              <Building2 className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Complete your profile</h2>
          <p className="mt-2 text-sm text-gray-600">
            We couldn't find an organization associated with your account. Please create one to continue.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleCreateCompany}>
          <div>
            <label htmlFor="company-name" className="block text-sm font-medium text-gray-700">
              Company Name
            </label>
            <input
              id="company-name"
              type="text"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Your Logistics Company"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>

          <div className="space-y-3 relative z-10">
            <button
              type="submit"
              disabled={loading || profileLoading || !companyName.trim()}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Setting up...
                </>
              ) : (
                'Create Organization'
              )}
            </button>
            
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                try {
                  toast.dismiss();
                  await signOut();
                } catch (err) {
                  toast.error('Failed to sign out');
                }
              }}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
