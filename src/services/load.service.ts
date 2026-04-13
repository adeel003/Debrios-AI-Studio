import { loadRepository } from '../repositories/load.repository';
import { Load, LoadStatus } from '../types/load';

export const loadService = {
  async getLoadsByTenant(tenantId: string, filters: any = {}) {
    return loadRepository.getByTenant(tenantId, filters);
  },

  async getLoadById(id: string) {
    return loadRepository.getById(id);
  },

  async createLoad(load: Partial<Load>) {
    return loadRepository.create(load);
  },

  async updateLoadStatus(id: string, status: LoadStatus) {
    const updateData: Partial<Load> = { status };
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    } else if (status === 'en_route') {
      updateData.started_at = new Date().toISOString();
    }
    return loadRepository.update(id, updateData);
  },

  async assignDriver(id: string, driverId: string) {
    return loadRepository.update(id, { 
      driver_id: driverId, 
      status: 'assigned',
      dispatched_at: new Date().toISOString()
    });
  }
};
