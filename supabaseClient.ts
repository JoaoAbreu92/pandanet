
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

    let processedUrl = url;

    // Se contiver host interno do supabase
    if (processedUrl.includes('supabase-kong:8000')) {
        processedUrl = processedUrl.replace('http://supabase-kong:8000', 'https://pandanet.grupopixel.com.br').replace('supabase-kong:8000', 'pandanet.grupopixel.com.br');
    }

    if (processedUrl.includes('/storage/v1/object/public/')) {
        const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor;
        let isDevServer = false;

        if (typeof window !== 'undefined' && !isCapacitor) {
            const hostname = window.location.hostname;
            const port = window.location.port;
            isDevServer = port === '3000' || port === '5173' || port === '3001' ||
                hostname === 'localhost' ||
                hostname === '127.0.0.1' ||
                hostname.startsWith('192.168.') ||
                hostname.startsWith('10.') ||
                hostname.startsWith('172.');
        }

        // Em desenvolvimento local no PC (fora do Capacitor), mantém IP da VPS para acesso direto
        if (isDevServer) {
            return processedUrl;
        }

        // Em produção ou no aplicativo APK (Capacitor), sempre força HTTPS para o domínio oficial
        const idx = processedUrl.indexOf('/storage/v1/object/public/');
        if (idx !== -1) {
            const path = processedUrl.substring(idx);
            return `https://pandanet.grupopixel.com.br${path}`;
        }
    }
    return processedUrl;
}

/**
 * Realiza o download de um arquivo de forma segura convertendo a resposta em Blob.
 * Evita o redirecionamento indevido de rotas de SPA (single-page application).
 */
export async function downloadFile(url: string, fileName: string) {
try {
const parsed = parseSupabaseStorageUrl(url);
const sensitiveBuckets = new Set([
    'hr-files',
    'documents',
    'ticket-media',
    'message-attachments'
]);

const cleanUrl = parsed && sensitiveBuckets.has(parsed.bucket)
    ? await getSignedStorageUrl(url)
    : getCleanImageUrl(url);

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
        const parsed = parseSupabaseStorageUrl(url);
        const sensitiveBuckets = new Set([
            'hr-files',
            'documents',
            'ticket-media',
            'message-attachments'
        ]);

        const fallbackUrl = parsed && sensitiveBuckets.has(parsed.bucket)
            ? await getSignedStorageUrl(url)
            : getCleanImageUrl(url);

        window.open(fallbackUrl, '_blank');
    } catch (e) {
        console.error('Fallback falhou:', e);
    }
    }
}



/**
 * Extrai bucket e caminho de URLs antigas do Supabase Storage.
 * Suporta URLs públicas já gravadas no banco.
 */
export function parseSupabaseStorageUrl(url: string): { bucket: string; path: string } | null {
    if (!url) return null;

    try {
        const markers = [
            '/storage/v1/object/public/',
            '/storage/v1/object/sign/',
            '/storage/v1/object/authenticated/'
        ];

        const marker = markers.find(candidate => url.includes(candidate));
        if (!marker) return null;

        const markerIndex = url.indexOf(marker);
        const remainder = url
            .substring(markerIndex + marker.length)
            .split('?')[0];

        const slashIndex = remainder.indexOf('/');
        if (slashIndex === -1) return null;

        const bucket = decodeURIComponent(
            remainder.substring(0, slashIndex)
        );

        const path = decodeURIComponent(
            remainder.substring(slashIndex + 1)
        );

        if (!bucket || !path) return null;

        return { bucket, path };
    } catch (err) {
        console.error('Erro ao interpretar URL do Storage:', err);
        return null;
    }
}

/**
 * Gera URL assinada temporária para arquivo privado.
 * Mantém compatibilidade com URLs públicas antigas salvas no banco.
 */
export async function getSignedStorageUrl(
    url: string,
    expiresIn: number = 3600
): Promise<string> {
    const parsed = parseSupabaseStorageUrl(url);

    if (!parsed) {
        return getCleanImageUrl(url);
    }

    const { data, error } = await supabase.storage
        .from(parsed.bucket)
        .createSignedUrl(parsed.path, expiresIn);

    if (error || !data?.signedUrl) {
        console.error('Erro ao gerar URL assinada:', error);
        return getCleanImageUrl(url);
    }

    return getCleanImageUrl(data.signedUrl);
}
