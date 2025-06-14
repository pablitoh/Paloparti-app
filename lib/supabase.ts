import { createClient } from '@supabase/supabase-js';

// Helper function to get environment variables with Vercel integration prefixes
function getEnvVar(name: string): string | undefined {
  // Try different possible prefixes that Vercel might use
  const prefixes = ['PALOPARTIPROD_', 'PALOPARTI_', ''];

  for (const prefix of prefixes) {
    const value = process.env[`${prefix}${name}`];
    if (value) {
      return value;
    }
  }

  return undefined;
}

const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables not configured. Looking for NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY with possible prefixes: PALOPARTIPROD_, PALOPARTI_, or no prefix'
  );
  console.warn(
    'Available env vars:',
    Object.keys(process.env).filter((key) => key.includes('SUPABASE'))
  );
}

if (!supabaseServiceKey) {
  console.warn(
    'Supabase service role key not configured. Looking for SUPABASE_SERVICE_ROLE_KEY with possible prefixes: PALOPARTIPROD_, PALOPARTI_, or no prefix'
  );
  console.warn(
    'Available env vars:',
    Object.keys(process.env).filter((key) => key.includes('SUPABASE'))
  );
}

// Cliente público para el frontend
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// Cliente con permisos de servicio para operaciones de backend
export const supabaseAdmin =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;
