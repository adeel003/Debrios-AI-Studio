import { createClient } from '@supabase/supabase-js';

// Access environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Environment variables not loaded: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing.");
}

// Check if configuration is complete and valid
const isValidUrl = (url: string | undefined): url is string => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

// Loose validation for the Supabase key to accept both JWT anon keys and sb_publishable keys.
// We only check that it's a non-empty string.
export const isSupabaseConfigured = isValidUrl(supabaseUrl) && typeof supabaseAnonKey === 'string' && supabaseAnonKey.length > 0;

// Initialize the client with placeholders if not configured to prevent crash at module load
// The UI will handle showing the configuration error screen
const finalUrl = isValidUrl(supabaseUrl) ? supabaseUrl : 'https://placeholder.supabase.co';
const finalKey = supabaseAnonKey || 'placeholder';

export const supabase = createClient(finalUrl, finalKey);
