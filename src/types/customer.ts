import { Database } from './database';

export type Customer = Database['public']['Tables']['customers']['Row'];
export type CustomerStatus = 'active' | 'inactive';
