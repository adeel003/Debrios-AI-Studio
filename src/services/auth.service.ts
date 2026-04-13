import { supabase } from '../lib/supabase';
import { userRepository } from '../repositories/user.repository';
import { Profile } from '../types/user';

export const authService = {
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) return null;
    return user;
  },

  async getProfile(userId: string): Promise<Profile | null> {
    return userRepository.getProfile(userId);
  },

  async createProfile(profile: Partial<Profile>): Promise<Profile> {
    return userRepository.createProfile(profile);
  }
};
