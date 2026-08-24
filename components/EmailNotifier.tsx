import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../supabaseClient';
import { useNotifications } from './NotificationContext';

const EmailNotifier: React.FC = () => {
    const { currentUser } = useAuth();
    const { addNotification, playNotificationSound, showDesktopNotification, setModuleUnreadCount } = useNotifications();
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

        const checkEmails = async () => {
            const EMAIL_SERVER_URL = (import.meta.env.VITE_EMAIL_SERVER_URL as string) ||
                `${(import.meta.env.VITE_SUPABASE_URL as string).replace(':8000', ':3001')}/api/email`;

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
                        pageSize: 1 // Only need stats
                    })
                });
                
                const data = await response.json();
                
                if (data && typeof data.unseen === 'number') {
                    const currentUnseen = data.unseen;

                    // Atualiza o contador global no contexto para o Sidebar
                    setModuleUnreadCount('email', currentUnseen);

                    // Se é a primeira carga, apenas sincroniza sem notificar
                    if (lastUnseenCount === null) {
                        setLastUnseenCount(currentUnseen);
                        return;
                    }

                    // Se aumentou o número de não lidos, notifica!
                    if (currentUnseen > lastUnseenCount) {
                        const newEmailsCount = currentUnseen - lastUnseenCount;
                        
                        playNotificationSound('message');
                        showDesktopNotification(
                            'Novo E-mail', 
                            `Você tem ${newEmailsCount} novo(s) e-mail(s).`,
                            '/logo.png'
                        );

                        // Adiciona ao sininho
                        addNotification({
                            type: 'message',
                            title: 'Novo E-mail Recebido',
                            description: `Você tem ${newEmailsCount} novo(s) e-mail(s) na caixa de entrada.`,
                            link: '/email',
                            avatarUrl: '/logo.png'
                        });
                    }

                    setLastUnseenCount(currentUnseen);
                }
            } catch (err) {
                console.error("[EmailNotifier] Falha no polling:", err);
            }
        };

        // Check immediately
        checkEmails();

        // Then every 30 seconds
        const interval = setInterval(checkEmails, 30000); 

        return () => clearInterval(interval);
    }, [settings, lastUnseenCount]); // Re-run if settings change or count updates

    return null; // Componente visualmente invisível
};

export default EmailNotifier;
