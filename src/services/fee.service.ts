import { feeRepository } from '../repositories/fee.repository';

export const feeService = {
  async getTenantFees(tenantId: string) {
    return await feeRepository.getFeesByTenant(tenantId);
  },

  async getTenantFeeStats(tenantId: string) {
    return await feeRepository.getFeeStats(tenantId);
  }
};
