import React, {
    useCallback,
    useEffect,
    useRef,
    useState
} from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../supabaseClient';
import { useNotifications } from './NotificationContext';

const POLL_INTERVAL_MS = 90000;
const LEASE_DURATION_MS = 35000;

type EmailAccount = {
    id: string;
    imap_user?: string;
    [key: string]: unknown;
};

type EmailCountMessage = {
    type: 'EMAIL_COUNTS';
    userId: string;
    counts: Record<string, number>;
    sentAt: number;
};

const EmailNotifier: React.FC = () => {
    const { currentUser } = useAuth();
    const {
        setModuleUnreadCount,
        moduleUnreadCounts
    } = useNotifications();

    const [accounts, setAccounts] = useState<EmailAccount[]>([]);
    const lastUnseenCountsRef = useRef<Record<string, number>>({});
    const isFetchingRef = useRef(false);
    const mountedRef = useRef(true);
    const abortControllerRef = useRef<AbortController | null>(null);

    const tabIdRef = useRef(
        `${Date.now()}-${Math.random().toString(36).slice(2)}`
    );

    const channelRef = useRef<BroadcastChannel | null>(null);

    const userId = currentUser?.id;
    const companyId = currentUser?.company_id;

    const countsStorageKey = userId
        ? `pandanet_email_counts_${userId}`
        : '';

    const leaseStorageKey = userId
        ? `pandanet_email_poll_lease_${userId}`
        : '';

    const readPersistedCounts = useCallback(() => {
        if (!countsStorageKey) return {};

        try {
            const rawValue = localStorage.getItem(countsStorageKey);
            const parsedValue = rawValue
                ? JSON.parse(rawValue)
                : {};

            if (
                parsedValue
                && typeof parsedValue === 'object'
                && !Array.isArray(parsedValue)
            ) {
                return parsedValue as Record<string, number>;
            }
        } catch (error) {
            console.warn(
                '[EmailNotifier] Não foi possível ler os contadores persistidos:',
                error
            );
        }

        return {};
    }, [countsStorageKey]);

    const applyCounts = useCallback((
        counts: Record<string, number>,
        persist: boolean
    ) => {
        const totalUnseen = Object.values(counts).reduce(
            (sum, value) => sum + (
                Number.isFinite(value)
                    ? Number(value)
                    : 0
            ),
            0
        );

        const previous = lastUnseenCountsRef.current;
        const accountIds = Object.keys(counts).filter(id => counts[id] !== previous[id]);
        lastUnseenCountsRef.current = counts;
        setModuleUnreadCount('email', totalUnseen);
        if (accountIds.length) window.dispatchEvent(new CustomEvent('pandanet:email-counts-changed', {
            detail: { userId, accountIds }
        }));

        if (persist && countsStorageKey) {
            try {
                localStorage.setItem(
                    countsStorageKey,
                    JSON.stringify(counts)
                );
            } catch (error) {
                console.warn(
                    '[EmailNotifier] Não foi possível salvar os contadores:',
                    error
                );
            }
        }
    }, [countsStorageKey, setModuleUnreadCount, userId]);

    const broadcastCounts = useCallback((
        counts: Record<string, number>
    ) => {
        if (!userId) return;

        const message: EmailCountMessage = {
            type: 'EMAIL_COUNTS',
            userId,
            counts,
            sentAt: Date.now()
        };

        channelRef.current?.postMessage(message);
    }, [userId]);

    const acquireFallbackLease = useCallback(() => {
        if (!leaseStorageKey) return false;

        const now = Date.now();
        const tabId = tabIdRef.current;

        try {
            const rawLease = localStorage.getItem(leaseStorageKey);
            const currentLease = rawLease
                ? JSON.parse(rawLease)
                : null;

            if (
                currentLease
                && currentLease.tabId !== tabId
                && Number(currentLease.expiresAt) > now
            ) {
                return false;
            }

            const nextLease = {
                tabId,
                expiresAt: now + LEASE_DURATION_MS
            };

            localStorage.setItem(
                leaseStorageKey,
                JSON.stringify(nextLease)
            );

            const confirmedLease = JSON.parse(
                localStorage.getItem(leaseStorageKey) || '{}'
            );

            return confirmedLease.tabId === tabId;
        } catch (error) {
            console.warn(
                '[EmailNotifier] Falha na coordenação por localStorage:',
                error
            );

            return true;
        }
    }, [leaseStorageKey]);

    const releaseFallbackLease = useCallback(() => {
        if (!leaseStorageKey) return;

        try {
            const rawLease = localStorage.getItem(leaseStorageKey);
            const currentLease = rawLease
                ? JSON.parse(rawLease)
                : null;

            if (currentLease?.tabId === tabIdRef.current) {
                localStorage.removeItem(leaseStorageKey);
            }
        } catch {
            // A expiração temporal libera o lease automaticamente.
        }
    }, [leaseStorageKey]);

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (!userId) {
            lastUnseenCountsRef.current = {};
            setModuleUnreadCount('email', 0);
            return;
        }

        const persistedCounts = readPersistedCounts();
        applyCounts(persistedCounts, false);

        const browserWindow: Window = globalThis.window;

        if ('BroadcastChannel' in window) {
            const channel = new BroadcastChannel(
                `pandanet-email-counts-${userId}`
            );

            channel.onmessage = event => {
                const message = event.data as EmailCountMessage;

                if (
                    message?.type === 'EMAIL_COUNTS'
                    && message.userId === userId
                    && message.counts
                ) {
                    applyCounts(message.counts, true);
                }
            };

            channelRef.current = channel;

            return () => {
                channel.close();

                if (channelRef.current === channel) {
                    channelRef.current = null;
                }
            };
        }

        const handleStorage = (event: StorageEvent) => {
            if (
                event.key !== countsStorageKey
                || !event.newValue
            ) {
                return;
            }

            try {
                const counts = JSON.parse(event.newValue);

                if (
                    counts
                    && typeof counts === 'object'
                    && !Array.isArray(counts)
                ) {
                    applyCounts(counts, false);
                }
            } catch {
                // Valor inválido é ignorado.
            }
        };

        browserWindow.addEventListener('storage', handleStorage);

        return () => {
            browserWindow.removeEventListener('storage', handleStorage);
        };
    }, [
        applyCounts,
        countsStorageKey,
        readPersistedCounts,
        setModuleUnreadCount,
        userId
    ]);

    useEffect(() => {
        if (!companyId || !userId) {
            setAccounts([]);
            return;
        }

        let cancelled = false;

        const loadAccounts = async () => {
            const EMAIL_SERVER_URL =
                (import.meta.env.VITE_EMAIL_SERVER_URL as string)
                || `${window.location.origin}/api/email`;
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) return;
            const response = await fetch(`${EMAIL_SERVER_URL}/accounts/list`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ viewAllCompanyEmails: true })
            });
            const result = await response.json();

            if (!response.ok) {
                console.error(
                    '[EmailNotifier] Erro ao carregar contas:',
                    result.error || response.status
                );
                return;
            }

            if (!cancelled) {
                setAccounts((result.accounts || []) as EmailAccount[]);
            }
        };

        void loadAccounts();

        return () => {
            cancelled = true;
        };
    }, [
        companyId,
        currentUser?.email,
        currentUser?.email_permissions,
        currentUser?.role,
        userId
    ]);

    const registerEmailNotification = useCallback(async (
        account: EmailAccount,
        newEmailsCount: number
    ) => {
        if (!userId || !companyId) return;

        const accountAddress =
            account.imap_user
            || 'conta de e-mail';

        const { error } = await supabase.rpc(
            'upsert_email_notification',
            {
                target_user_id: userId,
                target_company_id: companyId,
                notification_title:
                    `Novo E-mail (${accountAddress})`,
                notification_description:
                    newEmailsCount === 1
                        ? `Você recebeu um novo e-mail na conta ${accountAddress}.`
                        : `Você recebeu ${newEmailsCount} novos e-mails na conta ${accountAddress}.`,
                notification_link:
                    `/email?accountId=${account.id}`,
                notification_avatar_url: '/logo.png'
            }
        );

        if (error) {
            console.error(
                '[EmailNotifier] Falha ao registrar notificação:',
                error
            );
        }
    }, [companyId, userId]);

    const runEmailCheck = useCallback(async () => {
        if (
            !userId
            || !companyId
            || accounts.length === 0
            || isFetchingRef.current
        ) {
            return;
        }

        isFetchingRef.current = true;

        abortControllerRef.current?.abort();
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const EMAIL_SERVER_URL =
            (import.meta.env.VITE_EMAIL_SERVER_URL as string)
            || `${window.location.origin}/api/email`;

        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;

            if (!token || abortController.signal.aborted) {
                return;
            }

            const previousCounts = {
                ...readPersistedCounts(),
                ...lastUnseenCountsRef.current
            };

            const newCounts: Record<string, number> = {};

            await Promise.all(accounts.map(async account => {
                try {
                    const response = await fetch(
                        `${EMAIL_SERVER_URL}/status`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                config: account,
                                folder: 'INBOX'
                            }),
                            signal: abortController.signal
                        }
                    );

                    if (response.status === 429) {
                        console.warn(
                            `[EmailNotifier] Limite temporário na conta ${account.imap_user}.`
                        );
                        return;
                    }

                    if (!response.ok) {
                        console.warn(
                            `[EmailNotifier] Consulta da conta ${account.imap_user} retornou ${response.status}.`
                        );
                        return;
                    }

                    const data = await response.json();

                    if (
                        !data
                        || typeof data.unseen !== 'number'
                    ) {
                        return;
                    }

                    const currentUnseen = Math.max(
                        0,
                        Number(data.unseen)
                    );

                    newCounts[account.id] = currentUnseen;

                    const previousUnseen =
                        previousCounts[account.id];

                    if (
                        previousUnseen !== undefined
                        && currentUnseen > previousUnseen
                    ) {
                        let notificationsEnabled = true;

                        try {
                            const disabledValue =
                                localStorage.getItem(
                                    `panda_email_disabled_notifications_${userId}`
                                );

                            const disabledIds = disabledValue
                                ? JSON.parse(disabledValue)
                                : [];

                            if (
                                Array.isArray(disabledIds)
                                && disabledIds.includes(account.id)
                            ) {
                                notificationsEnabled = false;
                            }
                        } catch (error) {
                            console.warn(
                                '[EmailNotifier] Preferência de notificação inválida:',
                                error
                            );
                        }

                        if (notificationsEnabled) {
                            await registerEmailNotification(
                                account,
                                currentUnseen - previousUnseen
                            );
                        }
                    }

                    if (
                        currentUnseen === 0
                        && Number(previousUnseen) > 0
                    ) {
                        await supabase
                            .from('notifications')
                            .update({ is_read: true })
                            .eq('user_id', userId)
                            .eq(
                                'link',
                                `/email?accountId=${account.id}`
                            )
                            .eq('is_read', false);
                    }
                } catch (error: any) {
                    if (
                        error?.name !== 'AbortError'
                        && !abortController.signal.aborted
                    ) {
                        console.error(
                            `[EmailNotifier] Erro na conta ${account.imap_user}:`,
                            error
                        );
                    }
                }
            }));

            if (
                mountedRef.current
                && !abortController.signal.aborted
            ) {
                const mergedCounts = {
                    ...previousCounts,
                    ...newCounts
                };

                applyCounts(mergedCounts, true);
                broadcastCounts(mergedCounts);
            }
        } catch (error: any) {
            if (
                error?.name !== 'AbortError'
                && !abortController.signal.aborted
            ) {
                console.error(
                    '[EmailNotifier] Falha no monitoramento:',
                    error
                );
            }
        } finally {
            isFetchingRef.current = false;
        }
    }, [
        accounts,
        applyCounts,
        broadcastCounts,
        companyId,
        readPersistedCounts,
        registerEmailNotification,
        userId
    ]);

    const runCoordinatedCheck = useCallback(async () => {
        const lockManager = (
            navigator as Navigator & {
                locks?: {
                    request: (
                        name: string,
                        options: {
                            ifAvailable: boolean;
                            mode: 'exclusive';
                        },
                        callback: (
                            lock: unknown | null
                        ) => Promise<void>
                    ) => Promise<void>;
                };
            }
        ).locks;

        if (lockManager && userId) {
            await lockManager.request(
                `pandanet-email-poll-${userId}`,
                {
                    ifAvailable: true,
                    mode: 'exclusive'
                },
                async lock => {
                    if (lock) {
                        await runEmailCheck();
                    }
                }
            );

            return;
        }

        if (!acquireFallbackLease()) return;

        try {
            await runEmailCheck();
        } finally {
            releaseFallbackLease();
        }
    }, [
        acquireFallbackLease,
        releaseFallbackLease,
        runEmailCheck,
        userId
    ]);

    useEffect(() => {
        if (!userId || accounts.length === 0) return;

        let cancelled = false;

        const execute = async () => {
            if (!cancelled) {
                await runCoordinatedCheck();
            }
        };

        void execute();

        const interval = window.setInterval(
            () => void execute(),
            POLL_INTERVAL_MS
        );

        const handleVisibility = () => {
            if (
                document.visibilityState === 'visible'
                && !cancelled
            ) {
                void execute();
            }
        };

        document.addEventListener(
            'visibilitychange',
            handleVisibility
        );

        return () => {
            cancelled = true;
            window.clearInterval(interval);
            document.removeEventListener(
                'visibilitychange',
                handleVisibility
            );
            abortControllerRef.current?.abort();
            releaseFallbackLease();
        };
    }, [
        accounts.length,
        releaseFallbackLease,
        runCoordinatedCheck,
        userId
    ]);

    useEffect(() => {
        const globalCount = moduleUnreadCounts.email;

        if (globalCount !== 0 || !userId) return;

        void supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userId)
            .like('title', 'Novo E-mail%')
            .eq('is_read', false);

        lastUnseenCountsRef.current = {};
    }, [moduleUnreadCounts.email, userId]);

    return null;
};

export default EmailNotifier;
