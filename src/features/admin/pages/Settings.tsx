import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Building2, Globe, Clock, CreditCard, Save, Loader2, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import { handleError } from '../../../lib/error-handler';

export function Settings() {
  const { profile, refreshProfile, appReady } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenant, setTenant] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: '',
    logo_url: '',
    default_currency: 'SAR',
    timezone: 'Asia/Riyadh',
  });

  useEffect(() => {
    const fetchTenant = async () => {
      if (!appReady || !profile?.tenant_id) return;

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', profile.tenant_id)
          .single();

        if (error) throw error;
        setTenant(data);
        setFormData({
          name: data.name,
          logo_url: data.logo_url || '',
          default_currency: data.default_currency || 'SAR',
          timezone: data.timezone || 'Asia/Riyadh',
        });
      } catch (err: any) {
        handleError(err, 'fetchTenant');
      } finally {
        setLoading(false);
      }
    };

    fetchTenant();
  }, [profile?.tenant_id, appReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id) return;

    setSaving(true);
    const toastId = toast.loading('Saving settings...');

    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          name: formData.name,
          logo_url: formData.logo_url,
          default_currency: formData.default_currency,
          timezone: formData.timezone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.tenant_id);

      if (error) throw error;

      // Log audit
      await supabase.from('audit_logs').insert({
        tenant_id: profile.tenant_id,
        actor_id: profile.id,
        action: 'update',
        entity_type: 'tenant',
        entity_id: profile.tenant_id,
        old_data: tenant,
        new_data: formData,
      });

      toast.success('Settings updated successfully', { id: toastId });
      await refreshProfile();
    } catch (err: any) {
      handleError(err, 'updateSettings');
      toast.error('Failed to update settings', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Organization Settings</h1>
        <p className="text-gray-500">Manage your company profile and preferences.</p>
      </div>

      <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
        <form onSubmit={handleSubmit} className="divide-y divide-gray-200">
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Company Profile</h3>
                <p className="text-sm text-gray-500">Basic information about your organization.</p>
              </div>
              <div className="md:col-span-2 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building2 className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      required
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Camera className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="url"
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="https://example.com/logo.png"
                      value={formData.logo_url}
                      onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Localization</h3>
                <p className="text-sm text-gray-500">Set your preferred currency and timezone.</p>
              </div>
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Currency</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <CreditCard className="h-5 w-5 text-gray-400" />
                    </div>
                    <select
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      value={formData.default_currency}
                      onChange={(e) => setFormData({ ...formData, default_currency: e.target.value })}
                    >
                      <option value="SAR">Saudi Riyal (SAR)</option>
                      <option value="USD">US Dollar (USD)</option>
                      <option value="EUR">Euro (EUR)</option>
                      <option value="GBP">British Pound (GBP)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Clock className="h-5 w-5 text-gray-400" />
                    </div>
                    <select
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      value={formData.timezone}
                      onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    >
                      <option value="Asia/Riyadh">Riyadh (GMT+3)</option>
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">New York (EST)</option>
                      <option value="Europe/London">London (GMT)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
