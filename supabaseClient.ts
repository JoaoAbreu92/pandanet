
import { createClient } from '@supabase/supabase-js';

// @ts-ignore - Deno type check workaround for Vite env variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// @ts-ignore
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL or Key not defined in environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
