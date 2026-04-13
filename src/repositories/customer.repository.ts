import { supabase } from '../lib/supabase';
import { Customer } from '../types/customer';

export const customerRepository = {
  async getCustomersByTenant(tenantId: string, options: { page?: number; pageSize?: number } = {}): Promise<{ data: Customer[]; count: number }> {
    const page = options.page || 0;
    const pageSize = options.pageSize || 10;

    const { data, error, count } = await supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('name')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;
    return { data: data || [], count: count || 0 };
  },

  async createCustomer(customer: Partial<Customer>): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .insert([customer])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateCustomer(id: string, customer: Partial<Customer>): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .update(customer)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
