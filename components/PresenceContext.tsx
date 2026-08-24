import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

interface PresenceContextType {
    onlineUsers: Set<string>;
}

const PresenceContext = createContext<PresenceContextType>({ onlineUsers: new Set() });

export const PresenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser, isGhostMode } = useAuth();
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!currentUser?.id) return;

        const channel = supabase.channel('online-users', {
            config: {
                presence: {
                    key: currentUser.id,
                },
            },
        });

        channel
            .on('presence' as any, { event: 'sync' }, () => {
                const state = channel.presenceState();
                const ids = new Set<string>(Object.keys(state));
                setOnlineUsers(ids);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED' && !isGhostMode) {
                    await channel.track({
                        user_id: currentUser.id,
                        online_at: new Date().toISOString(),
                    });
                }
            });

        return () => {
            channel.unsubscribe();
        };
    }, [currentUser?.id]);

    return (
        <PresenceContext.Provider value={{ onlineUsers }}>
            {children}
        </PresenceContext.Provider>
    );
};

export const usePresence = () => useContext(PresenceContext);
