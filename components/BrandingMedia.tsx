import React, { useEffect, useRef, useState } from 'react';
import { supabase, parseSupabaseStorageUrl } from '../supabaseClient';
import { resolveBrandingUrl } from './brandingStorage';

function useBrandingMedia(src?: string) {
    const [state, setState] = useState({ source: '', url: '', failed: false });
    const reload = useRef<() => void>(() => {});
    useEffect(() => {
        let disposed = false;
        let running = false;
        let lastAttempt = 0;
        let lastSuccess = 0;
        let imageRetry = false;
        const resolve = async () => {
            if (!src || disposed || running) return;
            running = true;
            lastAttempt = Date.now();
            try {
                const url = await resolveBrandingUrl(src);
                if (!disposed) {
                    lastSuccess = Date.now();
                    setState({ source: src, url, failed: false });
                }
            } catch {
                if (!disposed) setState({ source: src, url: '', failed: true });
            } finally { running = false; }
        };
        reload.current = () => {
            if (!imageRetry && parseSupabaseStorageUrl(src || '')) {
                imageRetry = true;
                void resolve();
            } else setState({ source: src || '', url: '', failed: true });
        };
        const wake = () => {
            if (!document.hidden && Date.now() - lastAttempt > 10000 &&
                (!lastSuccess || Date.now() - lastSuccess > 40 * 60000)) void resolve();
        };
        void resolve();
        const timer = setInterval(wake, 60000);
        window.addEventListener('online', wake);
        window.addEventListener('focus', wake);
        document.addEventListener('visibilitychange', wake);
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            // Defer Storage calls until the auth callback has released its lock.
            lastSuccess = 0;
            if (!disposed) setState({ source: src || '', url: '', failed: false });
            if (event === 'SIGNED_OUT') return;
            setTimeout(() => { if (!disposed) void resolve(); }, 0);
        });
        return () => {
            disposed = true;
            clearInterval(timer);
            subscription.unsubscribe();
            window.removeEventListener('online', wake);
            window.removeEventListener('focus', wake);
            document.removeEventListener('visibilitychange', wake);
        };
    }, [src]);
    return {
        url: state.source === src ? state.url : '',
        failed: state.source === src && state.failed,
        retry: () => reload.current(),
    };
}

export function BrandingImage({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
    const media = useBrandingMedia(src);
    if (!media.url) return <span className={props.className} style={props.style}
        role="img" aria-label={alt || 'Imagem'}
        title={media.failed ? 'Imagem indisponível. Verifique o arquivo e as permissões.' : 'Carregando imagem'}>
        {media.failed ? (alt || 'Imagem indisponível') : ''}
    </span>;
    return <img {...props} src={media.url} alt={alt} onError={() => media.retry()} />;
}

export function BrandingVideo({ src, ...props }: React.VideoHTMLAttributes<HTMLVideoElement>) {
    const media = useBrandingMedia(src);
    if (!media.url) return <span className={props.className} role="status">
        {media.failed ? 'Vídeo indisponível' : 'Carregando vídeo…'}
    </span>;
    return <video {...props} src={media.url} onError={() => media.retry()} />;
}
