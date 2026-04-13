import { Database } from './database';

export type Tenant = Database['public']['Tables']['tenants']['Row'];

export interface TenantSettings {
  logo_url?: string;
  default_currency: string;
  timezone: string;
  fee_rate: number;
}
