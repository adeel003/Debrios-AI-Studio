import { Database } from './database';

export type Profile = Database['public']['Tables']['profiles']['Row'];

export type UserRole = 'admin' | 'dispatcher' | 'driver';

export interface UserProfile extends Omit<Profile, 'role'> {
  role: UserRole | null;
}
