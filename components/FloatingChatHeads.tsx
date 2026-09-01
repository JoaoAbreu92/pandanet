import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ActiveChatHead, Employee, Message } from '../types';
import { supabase, getSignedStorageUrl } from '../supabaseClient';
import { useNotifications } from './NotificationContext';
import {
    XMarkIcon,
    PaperAirplaneIcon,
    ChevronDownIcon,
    ChatBubbleLeftRightIcon
} from './icons';

interface FloatingChatHeadsProps {
    chatHeads: ActiveChatHead[];
    expandedChatHeadIds: string[];
    setChatHeads: React.Dispatch<React.SetStateAction<ActiveChatHead[]>>;
    setExpandedChatHeadIds: React.Dispatch<React.SetStateAction<string[]>>;
    onCloseChatHead: (id: string) => void;
    currentUser: Employee;
}

const FloatingChatHeads: React.FC<FloatingChatHeadsProps> = ({
    chatHeads,
    expandedChatHeadIds,
    setChatHeads,
    setExpandedChatHeadIds,
    onCloseChatHead,
    currentUser
}) => {
    const { playNotificationSound } = useNotifications();
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

    const chatHeadsRef = useRef(chatHeads);
    const expandedIdsRef = useRef(expandedChatHeadIds);

    useEffect(() => {
        chatHeadsRef.current = chatHeads;
    }, [chatHeads]);

    useEffect(() => {
        expandedIdsRef.current = expandedChatHeadIds;
    }, [expandedChatHeadIds]);

    const chatHeadIdsKey = chatHeads
        .map(head => head.conversationId)
        .sort()
        .join('|');

    const reconcileUnreadCounts = useCallback(async () => {
        const ids = chatHeadsRef.current.map(
            head => head.conversationId
        );

        if (!currentUser?.id || ids.length === 0) {
            setUnreadCounts({});
            return;
        }

        const { data, error } = await supabase
            .from('messages')
            .select('conversation_id, id')
            .eq('receiver_id', currentUser.id)
            .eq('is_read', false)
            .in('conversation_id', ids);

        if (error) {
            console.error(
                '[ChatHeads] Falha ao atualizar badges:',
                error
            );
            return;
        }

        const counts: Record<string, number> = {};

        (data || []).forEach((message: any) => {
            counts[message.conversation_id] =
                (counts[message.conversation_id] || 0) + 1;
        });

        setUnreadCounts(counts);
    }, [currentUser?.id]);

    useEffect(() => {
        void reconcileUnreadCounts();

        const interval = window.setInterval(
            () => void reconcileUnreadCounts(),
            12000
        );

        const refresh = () => {
            if (document.visibilityState === 'visible') {
                void reconcileUnreadCounts();
            }
        };

        document.addEventListener('visibilitychange', refresh);
        window.addEventListener('focus', refresh);

        return () => {
            window.clearInterval(interval);
            document.removeEventListener(
                'visibilitychange',
                refresh
            );
            window.removeEventListener('focus', refresh);
        };
    }, [chatHeadIdsKey, reconcileUnreadCounts]);

    useEffect(() => {
        if (!currentUser?.id || !currentUser?.company_id) return;

        let timer: number | undefined;

        const scheduleRefresh = () => {
            if (timer) window.clearTimeout(timer);
            timer = window.setTimeout(
                () => void reconcileUnreadCounts(),
                180
            );
        };

        const channel = supabase
            .channel(
                `floating-chat-global-${currentUser.id}`
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'messages',
                    filter:
                        `company_id=eq.${currentUser.company_id}`
                },
                payload => {
                    const message =
                        (payload.new || payload.old) as any;

                    if (
                        payload.eventType === 'INSERT'
                        && message?.sender_id !== currentUser.id
                        && chatHeadsRef.current.some(
                            head =>
                                head.conversationId
                                === message?.conversation_id
                        )
                        && !expandedIdsRef.current.includes(
                            message?.conversation_id
                        )
                    ) {
                        playNotificationSound('message');
                    }

                    scheduleRefresh();
                }
            )
            .subscribe(status => {
                if (status === 'SUBSCRIBED') {
                    void reconcileUnreadCounts();
                }
            });

        return () => {
            if (timer) window.clearTimeout(timer);
            supabase.removeChannel(channel);
        };
    }, [
        currentUser?.id,
        currentUser?.company_id,
        playNotificationSound,
        reconcileUnreadCounts
    ]);

    if (chatHeads.length === 0) return null;

    return (
        <div className="fixed bottom-24 right-6 flex flex-col items-end space-y-4 z-[9999] pointer-events-none max-w-full">
            {/* Expanded Mini Chat Boxes side-by-side */}
            <div className="flex flex-row-reverse gap-4 pointer-events-auto items-end max-w-[95vw] overflow-x-auto pb-2 scrollbar-hide">
                {expandedChatHeadIds.map(convId => {
                    const activeHead = chatHeads.find(ch => ch.conversationId === convId);
                    if (!activeHead) return null;
                    return (
                        <FloatingChatBox 
                            key={convId}
                            conversationId={convId}
                            activeHead={activeHead}
                            currentUser={currentUser}
                            onClose={() => onCloseChatHead(convId)}
                            onMinimize={() => setExpandedChatHeadIds(prev => prev.filter(id => id !== convId))}
                        />
                    );
                })}
            </div>

            {/* Bubble List Stack */}
            <div className="flex flex-row space-x-3 pointer-events-auto items-end animate-in fade-in duration-300">
                {chatHeads.map((ch) => {
                    const unread = unreadCounts[ch.conversationId] || 0;
                    const isExpanded = expandedChatHeadIds.includes(ch.conversationId);

                    return (
                        <div
                            key={ch.conversationId}
                            className="relative group transition-all duration-300 transform hover:scale-105"
                        >
                            {/* Avatar Bubble */}
                            <button
                                onClick={async () => {
                                    if (isExpanded) {
                                        setExpandedChatHeadIds(prev => prev.filter(id => id !== ch.conversationId));
                                    } else {
                                        if (expandedChatHeadIds.length >= 4) {
                                            const oldestId = expandedChatHeadIds[0];
                                            const oldestHead = chatHeads.find(h => h.conversationId === oldestId);
                                            const confirmOpen = window.confirm(`Você já possui o limite máximo de 4 conversas abertas. Deseja fechar o chat de "${oldestHead?.participantName || 'Colega'}" para abrir este?`);
                                            if (!confirmOpen) return;
                                            setExpandedChatHeadIds(prev => {
                                                const filtered = prev.filter(id => id !== oldestId && id !== ch.conversationId);
                                                return [...filtered, ch.conversationId];
                                            });
                                        } else {
                                            setExpandedChatHeadIds(prev => {
                                                if (prev.includes(ch.conversationId)) return prev;
                                                return [...prev, ch.conversationId];
                                            });
                                        }
                                        
                                        // Clear unread count when expanding
                                        try {
                                            await supabase
                                                .from('messages')
                                                .update({ is_read: true })
                                                .eq('conversation_id', ch.conversationId)
                                                .eq('receiver_id', currentUser.id)
                                                .eq('is_read', false);
                                            setUnreadCounts(prev => ({ ...prev, [ch.conversationId]: 0 }));
                                        } catch (err) {
                                            console.error('[ChatHeads] Error marking read on click:', err);
                                        }
                                    }
                                }}
                                className={`w-16 h-16 rounded-full overflow-hidden border-2 shadow-lg focus:outline-none transition-all ${
                                    isExpanded
                                        ? 'border-brand-primary ring-4 ring-brand-primary/20 scale-[1.05]'
                                        : 'border-white dark:border-slate-800 hover:border-brand-primary'
                                }`}
                            >
                                <img
                                    src={ch.participantAvatarUrl}
                                    alt={ch.participantName}
                                    className="w-full h-full object-cover"
                                />
                            </button>

                            {/* Unread Badge */}
                            {unread > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md animate-pulse">
                                    {unread}
                                </span>
                            )}

                            {/* Hover Close Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCloseChatHead(ch.conversationId);
                                }}
                                className="absolute -top-1 -left-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Fechar"
                            >
                                <XMarkIcon className="w-3 h-3" />
                            </button>

                            {/* Tooltip Name Tag */}
                            <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                                {ch.participantName}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const FloatingMediaPreview: React.FC<{
    file: NonNullable<Message['file']>;
}> = ({ file }) => {
    const [failed, setFailed] = useState(false);
    const type = (file.type || '').toLowerCase();

    if (failed) {
        return (
            <div className="mt-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                ⚠️ Mídia indisponível
            </div>
        );
    }

    if (
        type === 'sticker'
        || type.startsWith('image/')
    ) {
        return (
            <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block overflow-hidden rounded-xl bg-black/5"
            >
                <img
                    src={file.url}
                    alt="Imagem enviada"
                    loading="lazy"
                    className="max-h-40 w-full object-contain"
                    onError={() => setFailed(true)}
                />
            </a>
        );
    }

    if (type.startsWith('video/')) {
        return (
            <div className="mt-1 overflow-hidden rounded-xl bg-black">
                <video
                    src={file.url}
                    controls
                    playsInline
                    preload="metadata"
                    className="max-h-40 w-full object-contain"
                    onError={() => setFailed(true)}
                />
            </div>
        );
    }

    return (
        <a
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex max-w-[210px] items-center gap-2 rounded-xl bg-black/10 px-3 py-2 text-xs font-semibold"
        >
            📎
            <span className="truncate">
                {file.name || 'Abrir arquivo'}
            </span>
        </a>
    );
};

// Encapsulated Chat Box Component
const FloatingChatBox: React.FC<{
    conversationId: string;
    activeHead: ActiveChatHead;
    currentUser: Employee;
    onClose: () => void;
    onMinimize: () => void;
}> = ({ conversationId, activeHead, currentUser, onClose, onMinimize }) => {
    const { playNotificationSound } = useNotifications();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessageText, setNewMessageText] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = useCallback((behavior: 'smooth' | 'auto' = 'smooth') => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior });
        }, 100);
    }, []);

    const markAsRead = useCallback(async () => {
        // Auditoria Ghost nao gera recibo/leitura passiva.
        if (
            localStorage.getItem('pixel_is_ghost_mode')
            === 'true'
        ) {
            return;
        }
        try {
            await supabase
                .from('messages')
                .update({ is_read: true })
                .eq('conversation_id', conversationId)
                .eq('receiver_id', currentUser.id)
                .eq('is_read', false);
        } catch (err) {
            console.error('[ChatBox] Error marking as read:', err);
        }
    }, [conversationId, currentUser.id]);

    useEffect(() => {
        const fetchMessages = async () => {
            setLoading(true);
            try {
                const { data } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('conversation_id', conversationId)
                    .order('created_at', { ascending: false })
                    .limit(40);
                
                if (data) {
                    const mapped = await Promise.all(
                        data.reverse().map(
                            async (msg: any): Promise<Message> => {
                                const signedUrl = msg.file_url
                                    ? await getSignedStorageUrl(
                                        msg.file_url,
                                        86400
                                    )
                                    : null;

                                const rawName = msg.file_url
                                    ? msg.file_url
                                        .split('?')[0]
                                        .split('/')
                                        .pop()
                                    : null;

                                return {
                                    id: msg.id,
                                    sender:
                                        msg.sender_id === currentUser.id
                                            ? 'me'
                                            : msg.sender_id,
                                    senderName:
                                        msg.sender_id === currentUser.id
                                            ? currentUser.name
                                            : (
                                                activeHead.participantName
                                                || 'Colega'
                                            ),
                                    avatarUrl:
                                        msg.sender_id === currentUser.id
                                            ? currentUser.avatarUrl
                                            : (
                                                activeHead.participantAvatarUrl
                                                || ''
                                            ),
                                    text: msg.text || '',
                                    timestamp: new Date(
                                        msg.created_at
                                    ).toLocaleTimeString(
                                        [],
                                        {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        }
                                    ),
                                    reactions: Array.isArray(msg.reactions)
                                        ? msg.reactions
                                        : [],
                                    file: signedUrl
                                        ? {
                                            name: rawName
                                                ? decodeURIComponent(rawName)
                                                : 'arquivo',
                                            url: signedUrl,
                                            type:
                                                msg.file_type
                                                || undefined
                                        }
                                        : undefined
                                };
                            }
                        )
                    );
                    setMessages(mapped);
                    scrollToBottom('auto');
                }
                await markAsRead();
            } catch (err) {
                console.error('[ChatBox] Error loading messages:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchMessages();

        // Subscribe to Realtime channel for this specific conversation
        const channel = supabase
            .channel(`floating-chat-${conversationId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${conversationId}`
            }, async payload => {
                const newMsg = payload.new as any;
                const isMe =
                    newMsg.sender_id === currentUser.id;

                const signedUrl = newMsg.file_url
                    ? await getSignedStorageUrl(
                        newMsg.file_url,
                        86400
                    )
                    : null;

                const rawName = newMsg.file_url
                    ? newMsg.file_url
                        .split('?')[0]
                        .split('/')
                        .pop()
                    : null;

                const mappedMessage: Message = {
                    id: newMsg.id,
                    sender: isMe
                        ? 'me'
                        : newMsg.sender_id,
                    senderName: isMe
                        ? currentUser.name
                        : (
                            activeHead.participantName
                            || 'Colega'
                        ),
                    avatarUrl: isMe
                        ? currentUser.avatarUrl
                        : (
                            activeHead.participantAvatarUrl
                            || ''
                        ),
                    text: newMsg.text || '',
                    timestamp: new Date(
                        newMsg.created_at
                    ).toLocaleTimeString(
                        [],
                        {
                            hour: '2-digit',
                            minute: '2-digit'
                        }
                    ),
                    reactions: Array.isArray(newMsg.reactions)
                        ? newMsg.reactions
                        : [],
                    file: signedUrl
                        ? {
                            name: rawName
                                ? decodeURIComponent(rawName)
                                : 'arquivo',
                            url: signedUrl,
                            type: newMsg.file_type || undefined
                        }
                        : undefined
                };

                setMessages(previous => {
                    if (
                        previous.some(
                            message => message.id === mappedMessage.id
                        )
                    ) {
                        return previous;
                    }

                    return [...previous, mappedMessage];
                });

                scrollToBottom();

                if (!isMe) {
                    playNotificationSound('message');

                    await supabase
                        .from('messages')
                        .update({ is_read: true })
                        .eq('id', newMsg.id);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [conversationId, activeHead, currentUser.id, currentUser.name, currentUser.avatarUrl, markAsRead, playNotificationSound, scrollToBottom]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessageText.trim() || isSending) return;

        const textToSend = newMessageText.trim();
        setNewMessageText('');
        setIsSending(true);

        const receiverId = activeHead?.participantId || null;

        try {
            const { error } = await supabase
                .from('messages')
                .insert({
                    conversation_id: conversationId,
                    sender_id: currentUser.id,
                    receiver_id: receiverId,
                    company_id: currentUser.company_id,
                    text: textToSend
                });

            if (error) throw error;

            await supabase
                .from('conversations')
                .update({
                    last_message: textToSend,
                    last_message_at: new Date().toISOString(),
                    is_closed: false
                })
                .eq('id', conversationId);

            scrollToBottom();
        } catch (err) {
            console.error('[ChatBox] Error sending message:', err);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="w-[320px] h-[440px] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 flex flex-col overflow-hidden pointer-events-auto transform transition-all duration-300 animate-in slide-in-from-bottom-5">
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-brand-primary/10 to-transparent border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                    <img
                        src={activeHead.participantAvatarUrl}
                        alt={activeHead.participantName}
                        className="w-8 h-8 rounded-full object-cover"
                    />
                    <span className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate max-w-[120px]">
                        {activeHead.participantName}
                    </span>
                </div>
                <div className="flex items-center space-x-1.5">
                    <button
                        onClick={onMinimize}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                        title="Minimizar"
                    >
                        <ChevronDownIcon className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                        title="Fechar conversa"
                    >
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Messages Body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50 dark:bg-slate-950/20">
                {loading ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-primary"></div>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4">
                        <ChatBubbleLeftRightIcon className="w-8 h-8 text-gray-300 dark:text-gray-700 mb-2 animate-pulse" />
                        <p className="text-xs text-gray-400 font-medium">Inicie a conversa!</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.sender === 'me';
                        return (
                            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                <div className={`px-3 py-2 rounded-2xl max-w-[240px] text-sm break-words shadow-sm border ${
                                    isMe
                                        ? 'bg-brand-primary text-white border-transparent'
                                        : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 border-gray-100 dark:border-white/5'
                                }`}>
                                    {msg.file && (
                                        <FloatingMediaPreview
                                            file={msg.file}
                                        />
                                    )}
                                    {msg.text && (
                                        <p className={`whitespace-pre-wrap ${
                                            msg.file ? 'mt-2' : ''
                                        }`}>
                                            {msg.text}
                                        </p>
                                    )}
                                    {!msg.text && !msg.file && (
                                        <p className="text-xs italic opacity-70">
                                            Mensagem sem conteúdo
                                        </p>
                                    )}
                                </div>
                                <span className="text-[10px] text-gray-400 mt-1 px-1">
                                    {msg.timestamp}
                                </span>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Footer */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-100 dark:border-white/5 bg-white dark:bg-slate-900 flex gap-2">
                <input
                    type="text"
                    placeholder="Escreva uma mensagem..."
                    value={newMessageText}
                    onChange={(e) => setNewMessageText(e.target.value)}
                    className="flex-1 bg-gray-50 dark:bg-slate-850 border border-gray-200 dark:border-white/5 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-primary dark:focus:border-brand-primary text-gray-800 dark:text-gray-205"
                />
                <button
                    type="submit"
                    disabled={!newMessageText.trim() || isSending}
                    className="bg-brand-primary hover:bg-emerald-600 text-white rounded-xl p-2 shrink-0 transition-colors disabled:opacity-50"
                >
                    <PaperAirplaneIcon className="w-4 h-4" />
                </button>
            </form>
        </div>
    );
};

export default FloatingChatHeads;
