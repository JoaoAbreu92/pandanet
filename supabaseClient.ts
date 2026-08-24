
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
 * Sanitiza o nome de um arquivo para evitar problemas de caracteres especiais e acentos no Supabase Storage.
 */
export function sanitizeFileName(name: string): string {
    if (!name) return name;
    return name
        .split('/')
        .map(part => part
            .normalize('NFD') // Decompõe caracteres acentuados
            .replace(/[\u0300-\u036f]/g, '') // Remove os acentos
            .replace(/[^a-zA-Z0-9.-]/g, '_') // Substitui caracteres especiais/espaços por underscore
            .replace(/_+/g, '_') // Evita múltiplos underscores
        )
        .join('/');
}

// Wrapper para interceptar todas as chamadas do Storage e sanitizar os nomes dos arquivos transparentemente
const originalFrom = supabase.storage.from.bind(supabase.storage);
supabase.storage.from = (bucket: string) => {
    const fileApi = originalFrom(bucket);
    
    const originalUpload = fileApi.upload.bind(fileApi);
    const originalUpdate = fileApi.update.bind(fileApi);
    const originalGetPublicUrl = fileApi.getPublicUrl.bind(fileApi);
    const originalRemove = fileApi.remove.bind(fileApi);

    fileApi.upload = (path: string, file: any, options?: any) => {
        return originalUpload(sanitizeFileName(path), file, options);
    };

    fileApi.update = (path: string, file: any, options?: any) => {
        return originalUpdate(sanitizeFileName(path), file, options);
    };

    fileApi.getPublicUrl = (path: string, options?: any) => {
        return originalGetPublicUrl(sanitizeFileName(path), options);
    };

    fileApi.remove = (paths: string[]) => {
        return originalRemove(paths.map(p => sanitizeFileName(p)));
    };

    return fileApi;
};

/**
 * Normaliza e reescreve URLs absolutas de mídia do Supabase que utilizam HTTP
 * na porta 8000 da VPS para usar o origin atual do site (HTTPS/Nginx),
 * prevenindo o bloqueio de conteúdo misto pelo navegador.
 */
export function getCleanImageUrl(url: string | null | undefined): string {
    if (!url) return '';
    if (url.startsWith('blob:')) return url;
    if (url.includes('/storage/v1/object/public/')) {
        if (typeof window !== 'undefined') {
            const hostname = window.location.hostname;
            const port = window.location.port;
            
            // Se estivermos rodando no Vite Dev Server (porta 3000, 5173, etc.) ou se for localhost,
            // não reescrevemos o host original do banco de dados (que aponta para a porta 8000 da VPS),
            // pois o Vite Dev Server local não tem proxy para a rota /storage.
            const isDevServer = port === '3000' || port === '5173' || port === '3001' ||
                                hostname === 'localhost' || 
                                hostname === '127.0.0.1' || 
                                hostname.startsWith('192.168.') || 
                                hostname.startsWith('10.') || 
                                hostname.startsWith('172.');
            
            if (isDevServer) {
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


