import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

interface PresenceContextType {
    onlineUsers: Set<string>;
    awayUsers: Set<string>;
    isUserOnline: (userId: string) => boolean;
    isUserAway: (userId: string) => boolean;
}

type PresencePayload = {
    user_id?: string;
    company_id?: string;
    status?: 'online' | 'away';
    tab_id?: string;
    online_at?: string;
    updated_at?: string;
};

const PresenceContext = createContext<PresenceContextType>({
    onlineUsers: new Set(),
    awayUsers: new Set(),
    isUserOnline: () => false,
    isUserAway: () => false
});

export const PresenceProvider: React.FC<{
    children: React.ReactNode;
}> = ({ children }) => {
    const { currentUser, isGhostMode } = useAuth();

    const [onlineUsers, setOnlineUsers] =
        useState<Set<string>>(new Set());

    const [awayUsers, setAwayUsers] =
        useState<Set<string>>(new Set());

    const channelRef = useRef<RealtimeChannel | null>(null);

    const tabIdRef = useRef(
        `${Date.now()}-${Math.random().toString(36).slice(2)}`
    );

    const userId = currentUser?.id;
    const companyId = currentUser?.company_id;

    useEffect(() => {
        setOnlineUsers(new Set());
        setAwayUsers(new Set());

        if (!userId || !companyId) return;

        let cancelled = false;
        let tracked = false;

        const channel = supabase.channel(
            `company-presence-${companyId}`,
            {
                config: {
                    presence: {
                        key: `${userId}:${tabIdRef.current}`
                    }
                }
            }
        );

        channelRef.current = channel;

        const synchronizePresence = () => {
            if (cancelled) return;

            const state = channel.presenceState() as Record<
                string,
                PresencePayload[]
            >;

            const activeUsers = new Set<string>();

            const statusMap = new Map<
                string,
                {
                    online: boolean;
                    away: boolean;
                }
            >();

            Object.values(state).forEach(entries => {
                entries.forEach(entry => {
                    if (
                        !entry?.user_id
                        || entry.company_id !== companyId
                    ) {
                        return;
                    }

                    const status = statusMap.get(
                        entry.user_id
                    ) || {
                        online: false,
                        away: false
                    };

                    if (entry.status === 'away') {
                        status.away = true;
                    } else {
                        status.online = true;
                    }

                    statusMap.set(entry.user_id, status);
                    activeUsers.add(entry.user_id);
                });
            });

            const usersAway = new Set<string>();

            statusMap.forEach((status, id) => {
                if (!status.online && status.away) {
                    usersAway.add(id);
                }
            });

            setOnlineUsers(activeUsers);
            setAwayUsers(usersAway);
        };

        const publishStatus = async (
            status: 'online' | 'away'
        ) => {
            if (cancelled || isGhostMode) return;

            try {
                await channel.track({
                    user_id: userId,
                    company_id: companyId,
                    status,
                    tab_id: tabIdRef.current,
                    online_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

                tracked = true;
            } catch (error) {
                console.warn(
                    '[Presence] Falha ao atualizar presença:',
                    error
                );
            }
        };

        const handleVisibility = () => {
            void publishStatus(
                document.visibilityState === 'visible'
                    ? 'online'
                    : 'away'
            );
        };

        channel
            .on(
                'presence',
                { event: 'sync' },
                synchronizePresence
            )
            .on(
                'presence',
                { event: 'join' },
                synchronizePresence
            )
            .on(
                'presence',
                { event: 'leave' },
                synchronizePresence
            )
            .subscribe(status => {
                if (
                    status === 'SUBSCRIBED'
                    && !isGhostMode
                ) {
                    void publishStatus(
                        document.visibilityState === 'visible'
                            ? 'online'
                            : 'away'
                    );
                }

                if (
                    status === 'CHANNEL_ERROR'
                    || status === 'TIMED_OUT'
                ) {
                    console.warn(
                        `[Presence] Estado do canal: ${status}`
                    );
                }
            });

        document.addEventListener(
            'visibilitychange',
            handleVisibility
        );

        return () => {
            cancelled = true;

            document.removeEventListener(
                'visibilitychange',
                handleVisibility
            );

            setOnlineUsers(new Set());
            setAwayUsers(new Set());

            if (tracked) {
                void channel
                    .untrack()
                    .catch(() => undefined);
            }

            void supabase
                .removeChannel(channel)
                .catch(() => undefined);

            if (channelRef.current === channel) {
                channelRef.current = null;
            }
        };
    }, [
        companyId,
        isGhostMode,
        userId
    ]);

    const value = useMemo<PresenceContextType>(() => ({
        onlineUsers,
        awayUsers,
        isUserOnline: id => onlineUsers.has(id),
        isUserAway: id => awayUsers.has(id)
    }), [
        awayUsers,
        onlineUsers
    ]);

    return (
        <PresenceContext.Provider value={value}>
            {children}
        </PresenceContext.Provider>
    );
};

export const usePresence = () =>
    useContext(PresenceContext);
