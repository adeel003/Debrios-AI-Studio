import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { LogIn, AlertTriangle, CheckCircle } from 'lucide-react';


export function Login() {
  const { user, profile, loading: authLoading, profileLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for error in URL (common for magic links)
    const params = new URLSearchParams(window.location.search);
    const errorMsg = params.get('error_description') || params.get('error');
    if (errorMsg) {
      setError(errorMsg.replace(/\+/g, ' '));
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  React.useEffect(() => {
    if (user && !authLoading && !profileLoading) {
      if (profile) {
        if (profile.role === 'driver') {
          navigate('/driver', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } else {
        // Authenticated but no profile found
        navigate('/profile-setup', { replace: true });
      }
    }
  }, [user, profile, authLoading, profileLoading, navigate]);

  if (user && profile && !authLoading) {
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!url) {
      setError('Missing VITE_SUPABASE_URL configuration');
      return;
    }

    if (!key) {
      setError('Missing VITE_SUPABASE_ANON_KEY configuration');
      return;
    }

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message === 'TypeError: Failed to fetch' || error.message?.includes('NetworkError')) {
        setError('Network error: Unable to connect to the login service. Please check your internet connection or if an ad-blocker is blocking Supabase.');
      } else {
        setError(error.message);
      }
      setLoading(false);
    } else {
      navigate('/');
    }
  };

  const handleMagicLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!url) {
      setError('Missing VITE_SUPABASE_URL configuration');
      return;
    }

    if (!key) {
      setError('Missing VITE_SUPABASE_ANON_KEY configuration');
      return;
    }

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin
      }
    });

    if (error) {
      if (error.message === 'TypeError: Failed to fetch' || error.message?.includes('NetworkError')) {
        setError('Network error: Unable to send magic link. Please check your connection or ad-blocker.');
      } else {
        setError(error.message);
      }
      setLoading(false);
    } else {
      setMagicLinkSent(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
        <div>
          <div className="flex justify-center">
            <div className="bg-blue-100 p-3 rounded-full">
              <LogIn className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {magicLinkSent ? 'Check your email' : 'Sign in to Debrios'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {magicLinkSent 
              ? `We've sent a magic link to ${email}` 
              : 'Enter your credentials to access your dashboard'}
          </p>
        </div>

        {/* Pilot Notice */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start">
          <AlertTriangle className="h-5 w-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-800 leading-relaxed">
            <strong>Pilot Access Only:</strong> Debrios is currently in a controlled pilot phase. 
            If you do not have an account, please contact your administrator or the Debrios team.
          </div>
        </div>

        {magicLinkSent ? (
          <div className="mt-8">
            <button
              onClick={() => setMagicLinkSent(false)}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div className="rounded-md shadow-sm space-y-4">
              <div>
                <label htmlFor="email-address" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="password" id="password-label" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleMagicLink}
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send magic link
              </button>

              <div className="text-center mt-4">
                <p className="text-sm text-gray-600">
                  New to Debrios?{' '}
                  <Link to="/signup" className="font-medium text-blue-600 hover:text-blue-500">
                    Create company account
                  </Link>
                </p>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
