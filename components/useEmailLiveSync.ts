import { useEffect, useRef } from 'react';

// A single scheduler owns automatic refresh; it always calls the latest render.
export function useEmailLiveSync(options: {
    userId?: string;
    accountId: string | null;
    scope: string;
    enabled: boolean;
    refresh: () => Promise<void>;
    busy: () => boolean;
}) {
    const latest = useRef(options);
    latest.current = options;
    useEffect(() => {
        if (!options.userId) return;
        let disposed = false;
        let running = false;
        let pending = false;
        let lastRun = 0;
        let retry: ReturnType<typeof setTimeout> | undefined;
        const tick = async () => {
            if (disposed || !latest.current.enabled || document.hidden) return;
            pending = true;
            if (running) return;
            if (latest.current.busy() || Date.now() - lastRun < 3000) {
                if (!retry) retry = setTimeout(() => { retry = undefined; void tick(); }, 3000);
                return;
            }
            running = true;
            pending = false;
            lastRun = Date.now();
            try { await latest.current.refresh(); }
            catch { /* fetchEmails reports errors and preserves the last list. */ }
            finally {
                running = false;
                if (pending && !disposed) void tick();
            }
        };
        const wake = () => { void tick(); };
        const counts = (event: Event) => {
            const detail = (event as CustomEvent).detail;
            if (detail?.userId === options.userId &&
                detail?.accountIds?.includes(latest.current.accountId)) wake();
        };
        const interval = setInterval(wake, 30000);
        window.addEventListener('pandanet:email-counts-changed', counts);
        window.addEventListener('focus', wake);
        window.addEventListener('online', wake);
        document.addEventListener('visibilitychange', wake);
        wake();
        return () => {
            disposed = true;
            clearInterval(interval);
            if (retry) clearTimeout(retry);
            window.removeEventListener('pandanet:email-counts-changed', counts);
            window.removeEventListener('focus', wake);
            window.removeEventListener('online', wake);
            document.removeEventListener('visibilitychange', wake);
        };
    }, [options.userId, options.accountId, options.enabled, options.scope]);
}
