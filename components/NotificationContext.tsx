import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import type { Notification, NotificationType } from '../types';

// Audio assets
// Audio assets - Base64 encoded for reliability
const BEEP_SOUND = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//uQZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWgAAAA0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABYaW5nAAAAEAAAAAEAAABwAAD/AAAAAQAAcAAA//uQZAmAAABAAAAXAAD/AAAAcAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/7kmQWgAAAABAAAA8AAAD/AAAAcAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//uQZBgAAABAAAA8AAAD/AAAAcAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//uQZCIAAAAABAAAA8AAAD/AAAAcAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

// Nudge Sound (MSN Style Mock)
const NUDGE_SOUND = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//uQZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWgAAAA0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABYaW5nAAAAEAAAAAEAAAAtAAABjQAAEQAAAC0AAAGNAAABAAAAAAAAAAAAAAAAAAA//uQZBmAAABAAAA8AAAD/AAAAcAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//uQZBsAAABAAAA8AAAD/AAAAcAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//uQZB8AAABAAAA8AAAD/AAAAcAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
// Note: These are short silent/dummy base64 strings for illustration. In a real scenario I would put the full base64. 
// Since I cannot upload a full MP3 base64 here without making the prompt huge, I will use a reliable beep for all sounds temporarily to prove it works.
// PROD FIX: Use a simple beep daturi that works.

const REAL_BEEP = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'; // Shortened for brevity

const SOUNDS: Record<string, string> = {
    message: 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU', // Placeholder beep
    mention: 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU',
    event: 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU',
    nudge: 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU', // Placeholder beep
    default: 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'
};

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => Promise<void>;
    testNotifications: () => Promise<void>;
    showDesktopNotification: (title: string, body: string, icon?: string) => void;
    playNotificationSound: (type: NotificationType | 'nudge', overrideSoundId?: string) => void;
    loading: boolean;
    // New Sound Selection
    selectedSound: string;
    availableSounds: { id: string; name: string; path: string | null }[];
    changeSound: (soundId: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    // Sound Customization
    const [selectedSound, setSelectedSound] = useState<string>(() => localStorage.getItem('pixel_notification_sound') || 'synth');

    // Carregar preferência do banco ao iniciar
    useEffect(() => {
        if (currentUser?.id) {
            supabase.from('profiles').select('notification_sound').eq('id', currentUser.id).single()
                .then(({ data }) => {
                    if (data?.notification_sound) {
                        setSelectedSound(data.notification_sound);
                        localStorage.setItem('pixel_notification_sound', data.notification_sound);
                    }
                });
        }
    }, [currentUser?.id]);

    const AVAILABLE_SOUNDS = [
        { id: 'synth', name: 'Original (Bip)', path: null },
        { id: 'custom1', name: 'Toque 1', path: '/sounds/custom1.mp3' },
        { id: 'custom2', name: 'Toque 2', path: '/sounds/custom2.mp3' },
        { id: 'custom3', name: 'Toque 3', path: '/sounds/custom3.mp3' },
        { id: 'custom4', name: 'Toque 4', path: '/sounds/custom4.mp3' },
        { id: 'custom5', name: 'Toque 5', path: '/sounds/custom5.mp3' },
        { id: 'custom6', name: 'Toque 6', path: '/sounds/custom6.mp3' },
    ];

    const playNotificationSound = useCallback((type: NotificationType | 'nudge', overrideSoundId?: string) => {
        const soundId = overrideSoundId || selectedSound;
        const soundDef = AVAILABLE_SOUNDS.find(s => s.id === soundId);

        try {
            if (!soundDef || !soundDef.path) {
                const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                if (!AudioContext) return;

                const ctx = new AudioContext();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.connect(gain);
                gain.connect(ctx.destination);

                const now = ctx.currentTime;

                if (type === 'nudge') {
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(150, now);
                    osc.frequency.linearRampToValueAtTime(600, now + 0.1);
                    osc.frequency.linearRampToValueAtTime(150, now + 0.2);
                    osc.frequency.linearRampToValueAtTime(600, now + 0.3);

                    gain.gain.setValueAtTime(0.5, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

                    osc.start(now);
                    osc.stop(now + 0.5);
                } else {
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(800, now);
                    osc.frequency.exponentialRampToValueAtTime(400, now + 0.3);

                    gain.gain.setValueAtTime(0.3, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

                    osc.start(now);
                    osc.stop(now + 0.3);
                }
                console.log(`[PandaNet] Playing synthesized sound for: ${type}`);
            } else {
                const audio = new Audio(soundDef.path);
                audio.volume = 0.9;
                audio.play().catch(e => console.error("Erro ao tocar MP3 customizado:", e, soundDef.path));
                console.log(`[PandaNet] Playing custom sound: ${soundDef.name}`);
            }

        } catch (e) {
            console.error('[PandaNet] Fatal error in playNotificationSound:', e);
        }
    }, [selectedSound]);

    const changeSound = async (soundId: string) => {
        setSelectedSound(soundId);
        localStorage.setItem('pixel_notification_sound', soundId);

        // Persistir no banco
        if (currentUser?.id) {
            await supabase.from('profiles').update({ notification_sound: soundId }).eq('id', currentUser.id);
        }

        // Toca o som para testar imediatamente
        setTimeout(() => playNotificationSound('message', soundId), 100);
    };

    const showDesktopNotification = useCallback((title: string, body: string, icon?: string) => {
        if (!('Notification' in window)) {
            console.warn('[PandaNet] Browser does not support desktop notifications.');
            return;
        }

        const options = {
            body,
            icon: icon || '/logo.png',
            silent: false
        };

        if (Notification.permission === 'granted') {
            new Notification(title, options);
        } else if (Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification(title, options);
                }
            });
        }
    }, []);

    const fetchNotifications = useCallback(async () => {
        if (!currentUser?.id) return;

        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            if (data) {
                const mapped: Notification[] = data.map(n => ({
                    id: n.id,
                    type: n.type as any,
                    title: n.title,
                    description: n.description || '',
                    timestamp: new Date(n.created_at).toLocaleString('pt-BR'),
                    isRead: n.is_read,
                    avatarUrl: n.avatar_url,
                    link: n.link
                }));
                setNotifications(mapped);
            }
        } catch (err) {
            console.error('Error fetching notifications:', err);
        } finally {
            setLoading(false);
        }
    }, [currentUser?.id]);

    useEffect(() => {
        fetchNotifications();

        if (currentUser?.id) {
            console.log('--- TESTE REALTIME: Iniciando para usuário:', currentUser.id);
            const channel = supabase
                .channel(`notifications-global`) // Nome genérico para teste
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'notifications'
                    // Removido o filtro temporariamente para garantir recepção total
                }, (payload) => {
                    console.log('--- REALTIME EVENTO RECEBIDO ---', payload);
                    // Verificamos se o registro pertence ao usuário atual no frontend
                    const newNotif = payload.new as any;
                    if (newNotif && newNotif.user_id === currentUser.id) {
                        console.log('Aviso: Notificação pertence a este usuário. Atualizando...');

                        // Action on new notification
                        if (payload.eventType === 'INSERT') {
                            playNotificationSound(newNotif.type as NotificationType);
                            showDesktopNotification(newNotif.title, newNotif.description, newNotif.avatar_url);
                        }

                        fetchNotifications();
                    } else {
                        console.log('Aviso: Notificação ignorada (pertence a outro usuário).');
                    }
                })
                .subscribe((status, err) => {
                    console.log('--- REALTIME STATUS:', status, err || '');
                    if (status === 'CHANNEL_ERROR') {
                        console.error('Erro crítico no canal Realtime:', err);
                    }
                });

            return () => {
                console.log('Finalizando Realtime');
                supabase.removeChannel(channel);
            };
        }
    }, [currentUser?.id, fetchNotifications, playNotificationSound, showDesktopNotification]);

    const markAsRead = async (id: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', id);

            if (error) throw error;
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }
    };

    const markAllAsRead = async () => {
        if (!currentUser?.id) return;
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', currentUser.id)
                .eq('is_read', false);

            if (error) throw error;
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (err) {
            console.error('Error marking all notifications as read:', err);
        }
    };

    const addNotification = async (notif: Omit<Notification, 'id' | 'timestamp' | 'isRead'> & { user_id?: string, company_id?: string }) => {
        let targetUserId = notif.user_id;
        let targetCompanyId = notif.company_id;

        // Se não houver destinatário, assume o usuário atual (self-notification)
        if (!targetUserId) targetUserId = currentUser?.id;

        // Se a empresa não foi passada, tenta pegar do perfil do destinatário ou do usuário atual
        if (!targetCompanyId) {
            if (targetUserId === currentUser?.id) {
                targetCompanyId = currentUser?.company_id;
            } else {
                const { data: prof } = await supabase.from('profiles').select('company_id').eq('id', targetUserId).single();
                targetCompanyId = prof?.company_id;
            }
        }

        console.log('Tentando adicionar notificação:', { targetUserId, targetCompanyId, type: notif.type, title: notif.title });

        if (!targetUserId || !targetCompanyId) {
            console.error('Falha ao adicionar notificação: User ID ou Company ID ausente.', { targetUserId, targetCompanyId });
            return;
        }

        try {
            const { error } = await supabase
                .from('notifications')
                .insert({
                    user_id: targetUserId,
                    company_id: targetCompanyId,
                    type: notif.type,
                    title: notif.title,
                    description: notif.description,
                    avatar_url: notif.avatarUrl || currentUser?.avatarUrl,
                    link: notif.link
                });

            if (error) {
                console.error('Erro do Supabase ao inserir notificação:', error);
                // Reportar erro para o usuário se estiver em modo debug
                if (window.location.search.includes('debug')) {
                    alert('Erro notificação: ' + error.message);
                }
            } else {
                console.log('Notificação inserida com sucesso no banco.');
            }
        } catch (err) {
            console.error('Erro catch em addNotification:', err);
        }
    };

    const testNotifications = async () => {
        // Request Permission
        if ("Notification" in window) {
            const permission = await Notification.requestPermission();
            console.log('[PandaNet] Notification permission:', permission);
            if (permission !== 'granted') {
                alert('Permissão de notificação negada. Ative nas configurações do navegador para receber alertas.');
            }
        }

        // Play Sound using the robust method
        try {
            console.log('[PandaNet] Testing sound playback...');
            playNotificationSound('message');
        } catch (err) {
            console.error('Falha ao acionar playNotificationSound:', err);
        }

        // Show Desktop Notif
        showDesktopNotification('Teste de Notificação', 'Se você está vendo isso, as notificações estão funcionando!', currentUser?.avatarUrl);
    };

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount: notifications.filter(n => !n.isRead).length,
            markAsRead,
            markAllAsRead,
            addNotification,
            testNotifications,
            showDesktopNotification,
            playNotificationSound,
            loading,
            // Exposed Sound Selection
            selectedSound,
            availableSounds: AVAILABLE_SOUNDS,
            changeSound
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};
