import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../supabaseClient';
import { useNotifications } from './NotificationContext';

const EmailNotifier: React.FC = () => {
    const { currentUser } = useAuth();
    const { addNotification, playNotificationSound, showDesktopNotification, setModuleUnreadCount, moduleUnreadCounts } = useNotifications();
    const lastUnseenCountsRef = useRef<Record<string, number>>({});
    const [accounts, setAccounts] = useState<any[]>([]);

    // Carregar todas as configurações de email acessíveis pelo usuário
    useEffect(() => {
        if (!currentUser?.company_id) return;
        const loadAccounts = async () => {
            let query = supabase.from('email_settings').select('*').eq('company_id', currentUser.company_id);
            const perms = currentUser.email_permissions;
            const isSuperOrMaster = currentUser.role === 'Super Admin' || currentUser.email === 'ti@grupopixel.com.br';
            const canViewAll = isSuperOrMaster || perms?.can_view_all_accounts === true;
            
            if (!canViewAll) {
                if (perms?.allowed_accounts && perms.allowed_accounts.length > 0) {
                    query = query.or(`user_id.eq.${currentUser.id},id.in.(${perms.allowed_accounts.join(',')})`);
                } else {
                    query = query.eq('user_id', currentUser.id);
                }
            }
            const { data } = await query;
            if (data) setAccounts(data);
        };
        loadAccounts();
    }, [currentUser]);

    // Polling
    const isFetching = useRef(false);

    useEffect(() => {
        if (accounts.length === 0) return;

        const checkEmails = async () => {
            if (isFetching.current) return;
            isFetching.current = true;

            const EMAIL_SERVER_URL = (import.meta.env.VITE_EMAIL_SERVER_URL as string) ||
                `${window.location.origin}/api/email`;

            try {
                const session = await supabase.auth.getSession();
                const token = session.data.session?.access_token;

                if (!token) {
                    isFetching.current = false;
                    return;
                }

                const newCounts: Record<string, number> = {};

                // Verifica o status de cada conta em paralelo
                await Promise.all(accounts.map(async (account) => {
                    try {
                        const response = await fetch(`${EMAIL_SERVER_URL}/status`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                config: account,
                                folder: 'INBOX'
                            })
                        });

                        if (response.status === 429) {
                            console.warn(`[EmailNotifier] Rate limited (429) para a conta ${account.imap_user}.`);
                            return;
                        }

                        const data = await response.json();
                        if (data && typeof data.unseen === 'number') {
                            const currentUnseen = data.unseen;
                            newCounts[account.id] = currentUnseen;

                            const prevUnseen = lastUnseenCountsRef.current[account.id];

                            if (prevUnseen !== undefined && currentUnseen > prevUnseen) {
                                const newEmailsCount = currentUnseen - prevUnseen;
                                
                                playNotificationSound('message');
                                showDesktopNotification(
                                    `Novo E-mail (${account.imap_user})`, 
                                    `Você tem ${newEmailsCount} novo(s) e-mail(s) na conta ${account.imap_user}.`,
                                    '/logo.png'
                                );

                                addNotification({
                                    type: 'system',
                                    title: `Novo E-mail (${account.imap_user})`,
                                    description: `Você recebeu e-mail(s) não lido(s) na conta ${account.imap_user}.`,
                                    link: `/email?accountId=${account.id}`,
                                    avatarUrl: '/logo.png'
                                });
                            }

                            if (currentUnseen === 0 && prevUnseen > 0) {
                                // Limpa as notificações de sistema desta conta
                                if (currentUser?.id) {
                                    await supabase.from('notifications')
                                        .update({ is_read: true })
                                        .eq('user_id', currentUser.id)
                                        .eq('title', `Novo E-mail (${account.imap_user})`)
                                        .eq('is_read', false);
                                }
                            }
                        }
                    } catch (err) {
                        console.error(`[EmailNotifier] Erro no status da conta ${account.imap_user}:`, err);
                    }
                }));

                // Atualiza o contador global no sidebar como a soma de todas as contas
                const totalUnseen = Object.values(newCounts).reduce((sum, val) => sum + val, 0);
                setModuleUnreadCount('email', totalUnseen);

                lastUnseenCountsRef.current = newCounts;
            } catch (err) {
                console.error("[EmailNotifier] Falha no polling:", err);
            } finally {
                isFetching.current = false;
            }
        };

        checkEmails();
        const interval = setInterval(checkEmails, 90000); // Polling a cada 90s para evitar 429
        return () => clearInterval(interval);
    }, [accounts, currentUser?.id, setModuleUnreadCount, playNotificationSound, showDesktopNotification, addNotification]);

    // Limpa a notificação de banco de dados se a tela de Email reportar zero
    useEffect(() => {
        const globalCount = moduleUnreadCounts['email'];
        if (globalCount === 0 && currentUser?.id) {
            supabase.from('notifications')
                .update({ is_read: true })
                .eq('user_id', currentUser.id)
                .like('title', 'Novo E-mail%')
                .eq('is_read', false)
                .then(() => { });
            lastUnseenCountsRef.current = {};
        }
    }, [moduleUnreadCounts['email'], currentUser?.id]);

    return null;
};

export default EmailNotifier;
