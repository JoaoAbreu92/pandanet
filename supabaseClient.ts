
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
        // Se estivermos em ambiente local/desenvolvimento (localhost ou IP local),
        // não reescrevemos para o origin do Vite dev server que não tem o proxy.
        if (typeof window !== 'undefined') {
            const hostname = window.location.hostname;
            const isLocal = hostname === 'localhost' || 
                            hostname === '127.0.0.1' || 
                            hostname.startsWith('192.168.') || 
                            hostname.startsWith('10.') || 
                            hostname.startsWith('172.');
            if (isLocal) {
                return url;
            }
        }

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

/**
 * Realiza o download de um arquivo de forma segura convertendo a resposta em Blob.
 * Evita o redirecionamento indevido de rotas de SPA (single-page application).
 */
export async function downloadFile(url: string, fileName: string) {
    try {
        const cleanUrl = getCleanImageUrl(url);
        const response = await fetch(cleanUrl);
        if (!response.ok) throw new Error('Falha na resposta do servidor');
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(link);
    } catch (err) {
        console.error('Erro ao baixar arquivo via blob, tentando fallback direto:', err);
        // Fallback: abre a URL em uma nova aba
        try {
            const cleanUrl = getCleanImageUrl(url);
            window.open(cleanUrl, '_blank');
        } catch (e) {
            console.error('Fallback falhou:', e);
        }
    }
}


