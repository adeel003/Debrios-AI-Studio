import { supabase } from '../lib/supabase';

export const auditRepository = {
  async getLogsByTenant(tenantId: string, options: { 
    page?: number; 
    pageSize?: number;
    action?: string;
    entityType?: string;
    actorId?: string;
    date?: string;
  } = {}): Promise<{ data: any[]; count: number }> {
    const page = options.page || 0;
    const pageSize = options.pageSize || 20;

    let query = supabase
      .from('audit_logs')
      .select(`
        *,
        actor:profiles(full_name, email)
      `, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (options.action) query = query.eq('action', options.action);
    if (options.entityType) query = query.eq('entity_type', options.entityType);
    if (options.actorId) query = query.eq('actor_id', options.actorId);
    if (options.date) {
      const start = new Date(options.date).toISOString();
      const end = new Date(new Date(options.date).setDate(new Date(options.date).getDate() + 1)).toISOString();
      query = query.gte('created_at', start).lt('created_at', end);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: data || [], count: count || 0 };
  },

  async getActors(tenantId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return data || [];
  }
};
