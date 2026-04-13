import { auditRepository } from '../repositories/audit.repository';

export const auditService = {
  async getTenantLogs(tenantId: string, options: any = {}): Promise<{ data: any[]; count: number }> {
    return await auditRepository.getLogsByTenant(tenantId, options);
  },

  async getTenantActors(tenantId: string): Promise<any[]> {
    return await auditRepository.getActors(tenantId);
  }
};
