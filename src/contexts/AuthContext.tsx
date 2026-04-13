import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Database } from '../types/database';
import { UserProfile } from '../types/user';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  appReady: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bootstrapped = React.useRef(false);

  const profileFetchPromise = React.useRef<Promise<UserProfile | null> | null>(null);

  const fetchProfile = async (userId: string, email: string | undefined, silent = false) => {
    // If a fetch is already in progress for this user, return the existing promise
    if (profileFetchPromise.current) {
      return profileFetchPromise.current;
    }
    
    if (!silent) setProfileLoading(true);
    setError(null);
    
    // Create a timeout promise to prevent hanging
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => {
        const timeoutErr = new Error('Profile fetch timeout');
        (timeoutErr as any).isTimeout = true;
        reject(timeoutErr);
      }, 8000) // Reduced to 8 seconds to trigger before AppReadyGate
    );

    const profilePromise = (async () => {
      try {
        const query = supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        
        const { data: profile, error } = await query;
        
        if (error) {
          console.error('Profile fetch error', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
            userId
          });
          throw error;
        }
        const userProfile = profile as UserProfile | null;

        if (!userProfile) {
          // Profile doesn't exist, check for invite
          if (email) {
            const { data: invite } = await supabase
              .from('team_invites')
              .select('*')
              .eq('email', email)
              .eq('status', 'pending')
              .maybeSingle();
            
            if (invite) {
              // Create profile from invite
              const { data: newProfile, error: createError } = await supabase
                .from('profiles')
                .upsert([{
                  id: userId,
                  tenant_id: invite.tenant_id,
                  role: invite.role,
                  status: 'active',
                  email: email,
                  full_name: email.split('@')[0],
                  last_active_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }])
                .select()
                .single();
              
              if (createError) {
                console.error('Error creating profile from invite:', createError);
                throw createError;
              }
              
              if (newProfile) {
                // Mark invite as accepted
                await supabase
                  .from('team_invites')
                  .update({ status: 'accepted' })
                  .eq('id', invite.id);
                
                // If the role is driver, also create a record in the drivers table
                if (invite.role === 'driver') {
                  await supabase
                    .from('drivers')
                    .insert([{
                      tenant_id: invite.tenant_id,
                      user_id: userId,
                      full_name: (newProfile as UserProfile).full_name,
                      status: 'available'
                    }]);
                }

                return newProfile as UserProfile;
              }
            }
          }

          return null;
        } else {
          // Update last active (don't await to speed up boot)
          supabase
            .from('profiles')
            .update({ last_active_at: new Date().toISOString() })
            .eq('id', userId)
            .then(({ error }) => {
              if (error) console.warn('Failed to update last_active_at:', error);
            });
          
          return userProfile;
        }
      } catch (err: any) {
        console.error('Profile fetch failed:', err);
        throw err;
      } finally {
        profileFetchPromise.current = null;
      }
    })();

    profileFetchPromise.current = profilePromise;

    try {
      const result = await Promise.race([profilePromise, timeoutPromise]);
      setProfile(result);
      return result;
    } catch (error: any) {
      if (error.isTimeout) {
        console.error('Profile fetch timed out - query hung');
      }
      console.error('fetchProfile failed:', error);
      if (error.message === 'TypeError: Failed to fetch' || error.message?.includes('NetworkError')) {
        setError('Network error: Unable to connect to the backend. Please check your internet connection.');
      } else {
        setError(error.message || 'An error occurred during initialization.');
      }
      setProfile(null);
      return null;
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    let isInitialCheckDone = false;

    const completeInitialBoot = () => {
      if (isInitialCheckDone) return;
      isInitialCheckDone = true;
      setLoading(false);
    };

    // Safety timeout for initial boot
    const bootTimeout = setTimeout(() => {
      if (!isInitialCheckDone) {
        completeInitialBoot();
      }
    }, 20000); // 20 seconds safety timeout

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email).finally(() => {
          completeInitialBoot();
        });
      } else {
        completeInitialBoot();
      }
    }).catch(err => {
      console.error('Auth session error:', err);
      setError('Failed to initialize session. Please try again.');
      completeInitialBoot();
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const shouldFetch = !profile || profile.id !== session.user.id || event === 'SIGNED_IN';
        
        if (shouldFetch) {
          await fetchProfile(session.user.id, session.user.email, !!profile);
        }
      } else {
        setProfile(null);
      }
      
      completeInitialBoot();
    });

    return () => {
      clearTimeout(bootTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    
    // Safety timeout for signOut
    const timeout = setTimeout(() => {
      setUser(null);
      setSession(null);
      setProfile(null);
      setLoading(false);
      setProfileLoading(false);
    }, 3000);

    try {
      await supabase.auth.signOut();
      
      // Manually clear state to ensure UI updates immediately
      setUser(null);
      setSession(null);
      setProfile(null);
      setLoading(false);
      setProfileLoading(false);
    } catch (err: any) {
      // Even if it fails, we should clear local state
      setUser(null);
      setSession(null);
      setProfile(null);
      setLoading(false);
      setProfileLoading(false);
      setError(err.message || 'Failed to sign out');
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id, user.email);
    }
  }, [user]);

  // appReady logic:
  // 1. Auth loading must be finished
  // 2. If user exists, profile loading must be finished
  const appReady = !loading && (!user || (user && !profileLoading));

  if (import.meta.env.DEV && (loading || profileLoading)) {
    if (import.meta.env.DEV) {
      // Keep minimal status log for dev mode if needed, or remove completely
    }
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile, 
      loading, 
      profileLoading,
      appReady,
      error,
      signOut, 
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
