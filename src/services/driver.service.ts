import { driverRepository } from '../repositories/driver.repository';
import { Driver } from '../types/driver';

export const driverService = {
  async getDriverProfile(userId: string): Promise<Driver | null> {
    return await driverRepository.getDriverByUserId(userId);
  },

  async getTenantDrivers(tenantId: string, options: any = {}): Promise<{ data: Driver[]; count: number }> {
    return await driverRepository.getDriversByTenant(tenantId, options);
  },

  async updateStatus(id: string, status: string): Promise<void> {
    return await driverRepository.updateDriverStatus(id, status);
  }
};
