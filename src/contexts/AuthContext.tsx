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
  const mountedRef = useRef(true);

  // Tracks the current profile without stale closure issues.
  const profileRef = useRef<UserProfile | null>(null);

  // Incremented on every new fetch. Used to discard stale responses when a
  // newer fetch completes before an older in-flight one.
  const fetchCounter = useRef(0);

  // In-flight promise deduplication. Callers share the same promise when one
  // is already running. Cleared in the outer catch (timeout) AND inner finally
  // (normal settle) — whichever fires first wins; the second is a no-op.
  const profileFetchPromise = useRef<Promise<UserProfile | null> | null>(null);

  // Prevent state updates after unmount.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchProfile = useCallback(async (
    userId: string,
    email: string | undefined,
    silent = false,
    force = false,
  ): Promise<UserProfile | null> => {
    // Dedup: same user's profile is already loaded — nothing to do.
    if (!force && profileRef.current?.id === userId) {
      console.log('[AuthContext] fetchProfile skipped — profile already loaded for userId:', userId);
      return profileRef.current;
    }

    // Dedup: a fetch is already in-flight — share it.
    if (profileFetchPromise.current) {
      console.log('[AuthContext] fetchProfile deduped — returning in-flight promise');
      return profileFetchPromise.current;
    }

    const thisFetch = ++fetchCounter.current;
    console.log('[AuthContext] fetchProfile start', { userId, thisFetch });

    if (!silent && mountedRef.current) setProfileLoading(true);
    if (mountedRef.current) setError(null);

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        const err = new Error('Profile fetch timeout');
        (err as any).isTimeout = true;
        reject(err);
      }, 8000);
    });

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
        // Clear in-flight ref when the inner promise settles. If the outer
        // catch (timeout path) already cleared it, this is a harmless no-op.
        profileFetchPromise.current = null;
      }
    })();

    profileFetchPromise.current = profilePromise;

    try {
      const result = await Promise.race([profilePromise, timeoutPromise]);

      // Stale-response guard: a newer fetch superseded this one.
      if (fetchCounter.current !== thisFetch) {
        console.log('[AuthContext] fetchProfile stale result discarded', { thisFetch, current: fetchCounter.current });
        return null;
      }

      console.log('[AuthContext] fetchProfile success', { userId, hasProfile: !!result });

      if (mountedRef.current) {
        profileRef.current = result;
        setProfile(result);
      }
      return result;
    } catch (err: any) {
      // Clear immediately so the next call can start a fresh fetch with its
      // own timeout, rather than receiving the hanging inner promise.
      profileFetchPromise.current = null;

      if (fetchCounter.current !== thisFetch) {
        return null; // stale — newer fetch already owns state
      }

      if (err.isTimeout) {
        console.error('[AuthContext] Profile fetch timed out — likely RLS or connection pool issue. Check Supabase API logs for a stalled /rest/v1/profiles request.');
      } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        if (mountedRef.current) setError('Network error: Unable to connect to the backend. Please check your internet connection.');
      } else {
        console.error('[AuthContext] fetchProfile failed:', err);
        if (mountedRef.current) setError(err.message || 'An error occurred during initialization.');
      }

      if (mountedRef.current) {
        profileRef.current = null;
        setProfile(null);
      }
      return null;
    } finally {
      // Always cancel the timeout timer — prevents a dangling rejection if the
      // fetch resolved before the 8s window elapsed.
      if (timeoutId !== null) clearTimeout(timeoutId);
      if (mountedRef.current) setProfileLoading(false);
    }
  }, []); // stable — only accesses refs and state setters

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    let initialBootDone = false;

    const completeInitialBoot = () => {
      if (initialBootDone) return;
      initialBootDone = true;
      if (mountedRef.current) setLoading(false);
    };

    const bootTimeout = setTimeout(() => {
      completeInitialBoot();
    }, 20_000);

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!mountedRef.current) return;

      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        // Skip fetch if profile is already loaded for this user (e.g. hot-reload).
        if (profileRef.current?.id === initialSession.user.id) {
          completeInitialBoot();
          return;
        }
        fetchProfile(initialSession.user.id, initialSession.user.email).finally(completeInitialBoot);
      } else {
        completeInitialBoot();
      }
    }).catch(err => {
      console.error('[AuthContext] getSession error:', err);
      if (mountedRef.current) setError('Failed to initialize session. Please try again.');
      completeInitialBoot();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      // TOKEN_REFRESHED is pure JWT rotation — the profiles row is unchanged.
      // Triggering a fetch here was the primary cause of the intermittent hang.
      // Both session AND user must be synced here: if TOKEN_REFRESHED is the
      // first event after a page load (expired token refreshed immediately),
      // skipping setUser leaves user=null until getSession() resolves, which
      // can cause a spurious redirect to /login.
      if (event === 'TOKEN_REFRESHED') {
        if (mountedRef.current) {
          setSession(newSession);
          setUser(newSession?.user ?? null);
        }
        completeInitialBoot();
        return;
      }

      if (!mountedRef.current) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        const currentProfile = profileRef.current; // live value, not stale closure
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
    if (mountedRef.current) setError(null);

    const safetyTimeout = setTimeout(() => {
      if (!mountedRef.current) return;
      profileRef.current = null;
      setUser(null);
      setSession(null);
      setProfile(null);
      setLoading(false);
      setProfileLoading(false);
    }, 3_000);

    try {
      await supabase.auth.signOut();
      if (mountedRef.current) {
        profileRef.current = null;
        setUser(null);
        setSession(null);
        setProfile(null);
        setLoading(false);
        setProfileLoading(false);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        profileRef.current = null;
        setUser(null);
        setSession(null);
        setProfile(null);
        setLoading(false);
        setProfileLoading(false);
        setError(err.message || 'Failed to sign out');
      }
    } finally {
      clearTimeout(safetyTimeout);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      // Clear both guards so fetchProfile starts a fresh request unconditionally.
      profileFetchPromise.current = null;
      await fetchProfile(user.id, user.email, false, true);
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
