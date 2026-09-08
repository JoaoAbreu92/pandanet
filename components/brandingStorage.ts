import { supabase, parseSupabaseStorageUrl, getCleanImageUrl } from '../supabaseClient';

// This is a reference, never a public-access grant. Private media stays private.
export function brandingReference(url: string): string {
    const parsed = parseSupabaseStorageUrl(url);
    if (!parsed) return url;
    return '/storage/v1/object/authenticated/' +
        encodeURIComponent(parsed.bucket) + '/' +
        parsed.path.split('/').map(encodeURIComponent).join('/');
}

export async function resolveBrandingUrl(url: string): Promise<string> {
    const parsed = parseSupabaseStorageUrl(url);
    if (!parsed) return getCleanImageUrl(url);
    // Never fall back to an expired token or turn a private URL into a public URL.
    const { data, error } = await supabase.storage.from(parsed.bucket)
        .createSignedUrl(parsed.path, 3600);
    if (error || !data?.signedUrl) throw new Error('Imagem indisponível ou sem permissão.');
    return data.signedUrl;
}
