import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import type { Notification, NotificationType } from '../types';

// Audio assets
const SOUNDS: Record<string, string> = {
    message: '/sounds/message.mp3',
    mention: '/sounds/mention.mp3',
    event: '/sounds/event.mp3',
    nudge: '/sounds/nudge.mp3',
    default: '/sounds/message.mp3'
};

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => Promise<void>;
    testNotifications: () => Promise<void>;
    showDesktopNotification: (title: string, body: string, icon?: string) => void;
    playNotificationSound: (type: NotificationType | 'nudge') => void;
    loading: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    // Request desktop notification permission
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    const playNotificationSound = useCallback((type: NotificationType | 'nudge') => {
        try {
            const soundPath = SOUNDS[type] || SOUNDS.default;
            const audio = new Audio(soundPath);
            audio.volume = 0.9;

            console.log(`[PandaNet] Playing sound: ${type} (${soundPath})`);

            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(err => {
                    console.warn('[PandaNet] Audio playback blocked or failed. Please click "Ativar Toques" in the header.', err);
                });
            }
        } catch (e) {
            console.error('[PandaNet] Fatal error in playNotificationSound:', e);
        }
    }, []);

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
    }, [currentUser?.id, fetchNotifications]);

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
            if (permission !== 'granted') {
                alert('Permissão de notificação negada. Ative nas configurações do navegador.');
            }
        }

        // Play Sound
        try {
            const audio = new Audio(SOUNDS.message);
            await audio.play();
        } catch (err) {
            console.error('Falha ao tocar áudio de teste:', err);
            alert('Falha ao tocar som. O navegador pode estar bloqueando áudio automático.');
        }

        // Show Desktop Notif
        showDesktopNotification('Teste de Notificação', 'Se você está vendo isso, as notificações estão funcionando!', currentUser?.avatarUrl);
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, addNotification, testNotifications, showDesktopNotification, playNotificationSound, loading }}>
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
