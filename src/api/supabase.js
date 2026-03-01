import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Reuse existing client across HMR reloads to prevent duplicate
// GoTrueClient instances from interfering with each other
export const supabase = globalThis.__supabase ??= createClient(supabaseUrl, supabaseAnonKey)
