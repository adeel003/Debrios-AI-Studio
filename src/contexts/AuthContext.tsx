import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
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

  const bootstrapped = useRef(false);

  // Ref so onAuthStateChange closure always sees the current profile
  // without being stale (the effect runs with [] deps).
  const profileRef = useRef<UserProfile | null>(null);

  // Deduplication: if a fetch is already in-flight, callers share it.
  // IMPORTANT: must be cleared on timeout in the *outer* catch, not only
  // inside the inner promise's finally — see the comment below.
  const profileFetchPromise = useRef<Promise<UserProfile | null> | null>(null);

  const fetchProfile = useCallback(async (
    userId: string,
    email: string | undefined,
    silent = false,
  ): Promise<UserProfile | null> => {
    if (profileFetchPromise.current) {
      return profileFetchPromise.current;
    }

    if (!silent) setProfileLoading(true);
    setError(null);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => {
        const err = new Error('Profile fetch timeout');
        (err as any).isTimeout = true;
        reject(err);
      }, 8000),
    );

    const profilePromise = (async (): Promise<UserProfile | null> => {
      try {
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (fetchError) {
          console.error('[AuthContext] Profile fetch error', {
            code: fetchError.code,
            message: fetchError.message,
            hint: fetchError.hint,
            userId,
          });
          throw fetchError;
        }

        const userProfile = data as UserProfile | null;

        if (!userProfile) {
          if (email) {
            const { data: invite } = await supabase
              .from('team_invites')
              .select('*')
              .eq('email', email)
              .eq('status', 'pending')
              .maybeSingle();

            if (invite) {
              const { data: newProfile, error: createError } = await supabase
                .from('profiles')
                .upsert([{
                  id: userId,
                  tenant_id: invite.tenant_id,
                  role: invite.role,
                  status: 'active',
                  email,
                  full_name: email.split('@')[0],
                  last_active_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }])
                .select()
                .single();

              if (createError) throw createError;

              if (newProfile) {
                await supabase
                  .from('team_invites')
                  .update({ status: 'accepted' })
                  .eq('id', invite.id);

                if (invite.role === 'driver') {
                  await supabase.from('drivers').insert([{
                    tenant_id: invite.tenant_id,
                    user_id: userId,
                    full_name: (newProfile as UserProfile).full_name,
                    status: 'available',
                  }]);
                }

                return newProfile as UserProfile;
              }
            }
          }

          return null;
        }

        // Fire-and-forget — must not block the critical-path SELECT above.
        supabase
          .from('profiles')
          .update({ last_active_at: new Date().toISOString() })
          .eq('id', userId)
          .then(({ error: updateErr }) => {
            if (updateErr) console.warn('[AuthContext] last_active_at update failed:', updateErr);
          });

        return userProfile;
      } finally {
        // Always clear when the inner fetch settles (success, error, or after
        // the outer timeout already cleared it — that's a harmless no-op).
        profileFetchPromise.current = null;
      }
    })();

    profileFetchPromise.current = profilePromise;

    try {
      const result = await Promise.race([profilePromise, timeoutPromise]);
      profileRef.current = result;
      setProfile(result);
      return result;
    } catch (err: any) {
      // BUG FIX: clear the ref here, not only inside profilePromise.finally.
      // When the timeout wins the race, profilePromise is still running in the
      // background and will clear the ref eventually — but until then, any
      // subsequent fetchProfile call would return the hanging promise with NO
      // new timeout, causing an indefinite hang.
      profileFetchPromise.current = null;

      if (err.isTimeout) {
        console.error('[AuthContext] Profile fetch timed out — likely RLS or connection pool issue. Check Supabase logs for a stalled /rest/v1/profiles request.');
      } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        setError('Network error: Unable to connect to the backend. Please check your internet connection.');
      } else {
        console.error('[AuthContext] fetchProfile failed:', err);
        setError(err.message || 'An error occurred during initialization.');
      }

      profileRef.current = null;
      setProfile(null);
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, []); // stable — only uses refs and state setters

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    let initialBootDone = false;

    const completeInitialBoot = () => {
      if (initialBootDone) return;
      initialBootDone = true;
      setLoading(false);
    };

    const bootTimeout = setTimeout(() => {
      completeInitialBoot();
    }, 20_000);

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        fetchProfile(initialSession.user.id, initialSession.user.email).finally(completeInitialBoot);
      } else {
        completeInitialBoot();
      }
    }).catch(err => {
      console.error('[AuthContext] getSession error:', err);
      setError('Failed to initialize session. Please try again.');
      completeInitialBoot();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      // TOKEN_REFRESHED is pure JWT rotation — the profiles row is unchanged.
      // Fetching here is wasteful and, combined with the promise-dedup bug,
      // was the primary trigger for the intermittent infinite hang.
      if (event === 'TOKEN_REFRESHED') {
        setSession(newSession);
        completeInitialBoot();
        return;
      }

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // Use profileRef (not the closed-over `profile` state) so we always
        // read the current value, not the stale mount-time value.
        const currentProfile = profileRef.current;
        const needsFetch =
          event === 'SIGNED_IN' ||
          event === 'USER_UPDATED' ||
          !currentProfile ||
          currentProfile.id !== newSession.user.id;

        if (needsFetch) {
          await fetchProfile(newSession.user.id, newSession.user.email, !!currentProfile);
        }
      } else {
        profileRef.current = null;
        setProfile(null);
      }

      completeInitialBoot();
    });

    return () => {
      clearTimeout(bootTimeout);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    setError(null);

    const safetyTimeout = setTimeout(() => {
      profileRef.current = null;
      setUser(null);
      setSession(null);
      setProfile(null);
      setLoading(false);
      setProfileLoading(false);
    }, 3_000);

    try {
      await supabase.auth.signOut();
      profileRef.current = null;
      setUser(null);
      setSession(null);
      setProfile(null);
      setLoading(false);
      setProfileLoading(false);
    } catch (err: any) {
      profileRef.current = null;
      setUser(null);
      setSession(null);
      setProfile(null);
      setLoading(false);
      setProfileLoading(false);
      setError(err.message || 'Failed to sign out');
    } finally {
      clearTimeout(safetyTimeout);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      profileFetchPromise.current = null; // force a fresh fetch on manual refresh
      await fetchProfile(user.id, user.email);
    }
  }, [user, fetchProfile]);

  const appReady = !loading && (!user || !profileLoading);

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
      refreshProfile,
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
