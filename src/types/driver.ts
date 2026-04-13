import { Database } from './database';

export type Driver = Database['public']['Tables']['drivers']['Row'];
export type DriverStatus = 'available' | 'busy' | 'off_duty';
