import { customerRepository } from '../repositories/customer.repository';
import { Customer } from '../types/customer';

export const customerService = {
  async getTenantCustomers(tenantId: string, options: { page?: number; pageSize?: number } = {}): Promise<{ data: Customer[]; count: number }> {
    return await customerRepository.getCustomersByTenant(tenantId, options);
  },

  async createCustomer(customer: Partial<Customer>): Promise<Customer> {
    return await customerRepository.createCustomer(customer);
  },

  async updateCustomer(id: string, customer: Partial<Customer>): Promise<Customer> {
    return await customerRepository.updateCustomer(id, customer);
  }
};
