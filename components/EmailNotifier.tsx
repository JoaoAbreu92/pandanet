import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../supabaseClient';
import { useNotifications } from './NotificationContext';

const EmailNotifier: React.FC = () => {
    const { currentUser } = useAuth();
    const { addNotification, playNotificationSound, showDesktopNotification, setModuleUnreadCount, moduleUnreadCounts } = useNotifications();
    const [lastUnseenCount, setLastUnseenCount] = useState<number | null>(null);
    const [settings, setSettings] = useState<any>(null);

    // Carregar configurações de email
    useEffect(() => {
        if (!currentUser) return;
        const loadSettings = async () => {
            const { data } = await supabase
                .from('email_settings')
                .select('*')
                .eq('user_id', currentUser.id)
                .single();
            if (data) setSettings(data);
        };
        loadSettings();
    }, [currentUser]);

    // Polling
    useEffect(() => {
        if (!settings || !settings.imap_host || !settings.imap_user || !settings.imap_pass) return;

        let lastCount = lastUnseenCount;

        const checkEmails = async () => {
            const EMAIL_SERVER_URL = (import.meta.env.VITE_EMAIL_SERVER_URL as string) ||
                `${window.location.origin}/api/email`;

            try {
                const session = await supabase.auth.getSession();
                const token = session.data.session?.access_token;

                if (!token) return;

                const response = await fetch(`${EMAIL_SERVER_URL}/fetch`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        config: settings,
                        path: 'INBOX',
                        page: 1,
                        pageSize: 1
                    })
                });
                
                const data = await response.json();
                
                if (data && typeof data.unseen === 'number') {
                    const currentUnseen = data.unseen;

                    setModuleUnreadCount('email', currentUnseen);

                    if (lastCount === null) {
                        lastCount = currentUnseen;
                        setLastUnseenCount(currentUnseen);
                        return;
                    }

                    if (currentUnseen > lastCount) {
                        const newEmailsCount = currentUnseen - lastCount;
                        
                        playNotificationSound('message');
                        showDesktopNotification(
                            'Novo E-mail', 
                            `Você tem ${newEmailsCount} novo(s) e-mail(s).`,
                            '/logo.png'
                        );

                        addNotification({
                            type: 'system',
                            title: 'Novo E-mail Recebido',
                            description: `Você tem e-mail(s) não lido(s) na caixa de entrada.`,
                            link: '/email',
                            avatarUrl: '/logo.png'
                        });
                    }

                    if (currentUnseen === 0 && lastCount > 0) {
                        // Limpa as notificações de sistema do tipo E-mail Recebido se não há mais não lidos
                        if (currentUser?.id) {
                            supabase.from('notifications')
                                .update({ is_read: true })
                                .eq('user_id', currentUser.id)
                                .eq('title', 'Novo E-mail Recebido')
                                .eq('is_read', false)
                                .then(() => { });
                        }
                    }

                    lastCount = currentUnseen;
                    setLastUnseenCount(currentUnseen);
                }
            } catch (err) {
                console.error("[EmailNotifier] Falha no polling:", err);
            }
        };

        checkEmails();
        const interval = setInterval(checkEmails, 60000); // Polling a cada 60s em vez de 30s
        return () => clearInterval(interval);
    }, [settings, currentUser?.id, setModuleUnreadCount, playNotificationSound, showDesktopNotification, addNotification]);

    // Limpa a notificação de banco de dados se a tela de Email reportar zero
    useEffect(() => {
        const globalCount = moduleUnreadCounts['email'];
        if (globalCount === 0 && currentUser?.id) {
            supabase.from('notifications')
                .update({ is_read: true })
                .eq('user_id', currentUser.id)
                .eq('title', 'Novo E-mail Recebido')
                .eq('is_read', false)
                .then(() => { });
            setLastUnseenCount(0);
        } else if (globalCount !== undefined && globalCount !== lastUnseenCount) {
            setLastUnseenCount(globalCount);
        }
    }, [moduleUnreadCounts['email'], currentUser?.id]);

    return null;
};

export default EmailNotifier;
