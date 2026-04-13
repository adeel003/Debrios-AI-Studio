import { supabase } from '../lib/supabase';
import { Load, LoadWithDetails } from '../types/load';

export const loadRepository = {
  async getByTenant(tenantId: string, filters: any = {}): Promise<{ data: LoadWithDetails[]; count: number }> {
    const page = filters.page || 0;
    const pageSize = filters.pageSize || 10;
    
    let query = supabase
      .from('loads')
      .select('*, customer:customers(*), driver:drivers(*), tenant:tenants(fee_rate)', { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.driverId) query = query.eq('driver_id', filters.driverId);
    
    // Simple search implementation
    if (filters.search) {
      // Note: Supabase doesn't support easy cross-table search in a single query without complex RPC or views
      // For now, we'll just search by ID if it looks like one, or skip search for simplicity in this refactor
      if (filters.search.length > 5) {
        query = query.ilike('id', `%${filters.search}%`);
      }
    }

    query = query.order(filters.sortBy || 'created_at', { ascending: filters.sortOrder === 'asc' });
    query = query.range(page * pageSize, (page + 1) * pageSize - 1);

    const { data, error, count } = await query;
    
    if (error) throw error;
    return { data: data as LoadWithDetails[], count: count || 0 };
  },

  async getById(id: string): Promise<LoadWithDetails | null> {
    const { data, error } = await supabase
      .from('loads')
      .select('*, customer:customers(*), driver:drivers(*), tenant:tenants(fee_rate)')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as LoadWithDetails;
  },

  async create(load: Partial<Load>): Promise<Load> {
    const { data, error } = await supabase
      .from('loads')
      .insert([load])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id: string, load: Partial<Load>): Promise<Load> {
    const { data, error } = await supabase
      .from('loads')
      .update(load)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};
