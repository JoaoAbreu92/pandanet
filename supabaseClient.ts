
import { createClient } from '@supabase/supabase-js';

// @ts-ignore - Deno type check workaround for Vite env variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// @ts-ignore
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL or Key not defined in environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    realtime: {
        params: {
            events_per_second: 10
        }
    },
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

/**
 * Normaliza e reescreve URLs absolutas de mídia do Supabase que utilizam HTTP
 * na porta 8000 da VPS para usar o origin atual do site (HTTPS/Nginx),
 * prevenindo o bloqueio de conteúdo misto pelo navegador.
 */
export function getCleanImageUrl(url: string | null | undefined): string {
    if (!url) return '';
    if (url.startsWith('blob:')) return url;
    if (url.includes('/storage/v1/object/public/')) {
        if (url.startsWith('https://')) return url;
        const idx = url.indexOf('/storage/v1/object/public/');
        if (idx !== -1) {
            const path = url.substring(idx);
            if (typeof window !== 'undefined') {
                return `${window.location.origin}${path}`;
            }
            return path;
        }
    }
    return url;
}

