import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { Conversation } from '../types';
import { ChatBubbleLeftRightIcon, CheckCircleIcon } from './icons';

interface Props {
    onNavigate: (page: string, context?: any) => void;
}

interface SupportConversation extends Conversation {
    company_name?: string;
    company_domain?: string;
}

const SupportInbox: React.FC<Props> = ({ onNavigate }) => {
    const { currentUser } = useAuth();
    const [conversations, setConversations] = useState<SupportConversation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSupportConvos();
        
        // Subscribe to changes in messages table to keep inbox updated
        const channel = supabase
            .channel('public:messages')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                () => { fetchSupportConvos(); }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUser]);

    const fetchSupportConvos = async () => {
        try {
            setLoading(true);
            
            // 1. Get all conversations that involve ti@grupopixel.com.br
            const { data: participations, error: partError } = await supabase
                .from('conversation_participants')
                .select('conversation_id')
                .eq('user_id', currentUser?.id);

            if (partError) throw partError;
            if (!participations?.length) {
                setConversations([]);
                setLoading(false);
                return;
            }

            const convoIds = participations.map(p => p.conversation_id);

            // 2. Fetch those conversations
            const { data: convos, error: convosError } = await supabase
                .from('conversations')
                .select('*')
                .in('id', convoIds)
                .order('last_message_at', { ascending: false });

            if (convosError) throw convosError;
            
            // Filter to only include cross-company support conversations 
            // (where company_id is not Grupo Pixel, or where it's explicitly a support chat)
            // But since this is just the inbox, we can fetch the company details for all of them
            
            const companiesResult = await supabase.from('companies').select('id, name, domain');
            const companies = companiesResult.data || [];
            
            const companyMap = companies.reduce((acc, curr) => {
                acc[curr.id] = curr;
                return acc;
            }, {} as Record<string, any>);

            // 3. Get the OTHER participant for each 1:1 conversation
            const { data: allParticipants, error: allPartError } = await supabase
                .from('conversation_participants')
                .select('conversation_id, user_id, profiles(full_name, avatar_url, company_id)')
                .in('conversation_id', convoIds)
                .neq('user_id', currentUser?.id);

            if (allPartError) throw allPartError;

            const mappedConvos: SupportConversation[] = convos.map(conv => {
                const otherPart = allParticipants?.find(p => p.conversation_id === conv.id);
                const profile = otherPart?.profiles as any;
                
                const companyIdContext = conv.company_id || profile?.company_id;
                const companyInfo = companyMap[companyIdContext];

                return {
                    id: conv.id,
                    company_id: conv.company_id,
                    is_closed: conv.is_closed,
                    isGroup: conv.is_group,
                    groupName: conv.name,
                    participantName: conv.is_group ? conv.name : (profile?.full_name || 'Usuário'),
                    participantAvatarUrl: conv.is_group 
                        ? 'https://ui-avatars.com/api/?name=Suporte&background=0284c7&color=fff' 
                        : (profile?.avatar_url || 'https://ui-avatars.com/api/?name=Usuário'),
                    participantId: otherPart?.user_id,
                    lastMessage: conv.last_message || '',
                    lastMessageTimestamp: conv.last_message_at || '',
                    unreadCount: 0,
                    messages: [],
                    company_name: companyInfo?.name || 'Desconhecida',
                    company_domain: companyInfo?.domain || 'N/A'
                };
            });
            
            // For Support Inbox, we only want conversations that are from OTHER companies
            // Grupo Pixel is f832... (wait, no, Grupo Pixel is 56eaa5ed-8d1b-4879-a002-838702eeb14d)
            const supportConvos = mappedConvos.filter(c => c.company_id !== currentUser?.company_id);

            setConversations(supportConvos);
        } catch (error) {
            console.error('Error fetching support convos:', error);
        } finally {
            setLoading(false);
        }
    };

    if (currentUser?.email !== 'ti@grupopixel.com.br') {
        return (
            <div className="flex h-full items-center justify-center bg-gray-50/50 dark:bg-gray-900">
                <p className="text-gray-500 dark:text-gray-400">Acesso negado</p>
            </div>
        );
    }

    return (
        <div className="flex-1 bg-gray-50/50 dark:bg-gray-900 overflow-y-auto p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <ChatBubbleLeftRightIcon className="w-8 h-8 text-brand-primary" />
                            Caixa de Entrada de Suporte
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                            Gerencie todos os chamados de suporte técnico de todas as empresas clientes.
                        </p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-brand-subtle-border overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center text-gray-500 dark:text-gray-400 animate-pulse">
                            Carregando histórico de suporte...
                        </div>
                    ) : conversations.length === 0 ? (
                        <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                            Nenhuma conversa de suporte no momento.
                        </div>
                    ) : (
                        <div className="divide-y divide-brand-subtle-border">
                            {conversations.map(conv => (
                                <div 
                                    key={conv.id}
                                    onClick={() => onNavigate('messages', { conversationId: conv.id })}
                                    className={`p-4 sm:p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between ${conv.is_closed ? 'opacity-75' : ''}`}
                                >
                                    <div className="flex items-center gap-4 flex-1 overflow-hidden">
                                        <div className="relative shrink-0">
                                            <img 
                                                src={conv.participantAvatarUrl} 
                                                alt={conv.participantName}
                                                className="w-12 h-12 rounded-full object-cover border-2 border-white dark:border-gray-800 shadow-sm"
                                            />
                                            {conv.is_closed && (
                                                <div className="absolute -bottom-1 -right-1 bg-gray-500 text-white rounded-full p-0.5 border-2 border-white dark:border-gray-800" title="Conversa Encerrada">
                                                    <CheckCircleIcon className="w-4 h-4" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                                    {conv.participantName}
                                                </h3>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-brand-primary/10 text-brand-primary border border-brand-primary/20 shrink-0">
                                                    {conv.company_domain}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                                {conv.lastMessage || 'Nova conversa'}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-4 w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-0 border-gray-100 dark:border-gray-700/50 shrink-0">
                                        <div className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                                            {new Date(conv.lastMessageTimestamp).toLocaleString('pt-BR', {
                                                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </div>
                                        <button 
                                            className="ml-auto sm:ml-0 text-sm font-medium text-brand-primary hover:text-brand-primary/80"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onNavigate('messages', { conversationId: conv.id });
                                            }}
                                        >
                                            Abrir Chat &rarr;
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SupportInbox;
