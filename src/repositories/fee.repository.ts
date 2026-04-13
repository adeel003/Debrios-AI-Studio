import { supabase } from '../lib/supabase';
import { startOfMonth, endOfMonth } from 'date-fns';

export const feeRepository = {
  async getFeesByTenant(tenantId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('platform_fees')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getFeeStats(tenantId: string): Promise<any> {
    const start = startOfMonth(new Date()).toISOString();
    const end = endOfMonth(new Date()).toISOString();

    const [loadsRes, feesRes, driversRes] = await Promise.all([
      supabase
        .from('loads')
        .select('load_value', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('status', 'completed')
        .gte('completed_at', start)
        .lte('completed_at', end),
      supabase
        .from('platform_fees')
        .select('*')
        .eq('debtor_tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('drivers')
        .select('id', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('status', 'available')
    ]);

    if (loadsRes.error) throw loadsRes.error;
    if (feesRes.error) throw feesRes.error;

    const totalRevenue = loadsRes.data?.reduce((sum, load) => sum + (Number(load.load_value) || 0), 0) || 0;
    const platformFees = feesRes.data?.reduce((sum, fee) => sum + (Number(fee.fee_amount) || 0), 0) || 0;

    return {
      stats: {
        totalLoads: loadsRes.count || 0,
        totalRevenue,
        platformFees,
        activeDrivers: driversRes.count || 0,
      },
      recentFees: feesRes.data || []
    };
  }
};
