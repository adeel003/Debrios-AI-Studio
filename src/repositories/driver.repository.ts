import { supabase } from '../lib/supabase';
import { Driver } from '../types/driver';

export const driverRepository = {
  async getDriverByUserId(userId: string): Promise<Driver | null> {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  },

  async getDriversByTenant(tenantId: string, options: { page?: number; pageSize?: number } = {}): Promise<{ data: Driver[]; count: number }> {
    const page = options.page || 0;
    const pageSize = options.pageSize || 10;

    const { data, error, count } = await supabase
      .from('drivers')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('full_name')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;
    return { data: data || [], count: count || 0 };
  },

  async updateDriverStatus(id: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('drivers')
      .update({ status })
      .eq('id', id);

    if (error) throw error;
  }
};
