import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ActiveChatHead, Employee, Message } from '../types';
import { supabase } from '../supabaseClient';
import { useNotifications } from './NotificationContext';
import {
    XMarkIcon,
    PaperAirplaneIcon,
    ChevronDownIcon,
    ChatBubbleLeftRightIcon
} from './icons';

interface FloatingChatHeadsProps {
    chatHeads: ActiveChatHead[];
    expandedChatHeadId: string | null;
    setChatHeads: React.Dispatch<React.SetStateAction<ActiveChatHead[]>>;
    setExpandedChatHeadId: (id: string | null) => void;
    onCloseChatHead: (id: string) => void;
    currentUser: Employee;
}

const FloatingChatHeads: React.FC<FloatingChatHeadsProps> = ({
    chatHeads,
    expandedChatHeadId,
    setChatHeads,
    setExpandedChatHeadId,
    onCloseChatHead,
    currentUser
}) => {
    const { playNotificationSound } = useNotifications();
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessageText, setNewMessageText] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const expandedConvIdRef = useRef<string | null>(null);

    // Keep ref updated to avoid stale closure in Realtime subscription
    useEffect(() => {
        expandedConvIdRef.current = expandedChatHeadId;
    }, [expandedChatHeadId]);

    const scrollToBottom = useCallback((behavior: 'smooth' | 'auto' = 'smooth') => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior });
        }, 100);
    }, []);

    // 1. Fetch initial unread counts for all active chat heads
    useEffect(() => {
        const fetchInitialUnreadCounts = async () => {
            if (!currentUser?.id || chatHeads.length === 0) return;
            
            try {
                const { data } = await supabase
                    .from('messages')
                    .select('conversation_id, id')
                    .eq('receiver_id', currentUser.id)
                    .eq('is_read', false)
                    .in('conversation_id', chatHeads.map(ch => ch.conversationId));
                
                if (data) {
                    const counts: Record<string, number> = {};
                    data.forEach((msg: any) => {
                        counts[msg.conversation_id] = (counts[msg.conversation_id] || 0) + 1;
                    });
                    setUnreadCounts(counts);
                }
            } catch (err) {
                console.error('[ChatHeads] Error fetching unread counts:', err);
            }
        };
        
        fetchInitialUnreadCounts();
    }, [chatHeads, currentUser?.id]);

    // 2. Global Realtime subscription for incoming messages in minimized heads
    useEffect(() => {
        if (!currentUser?.id || !currentUser?.company_id) return;

        const companyFilter = `company_id=eq.${currentUser.company_id}`;

        const channel = supabase
            .channel('floating-chat-heads-global')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: companyFilter
            }, (payload) => {
                const newMsg = payload.new as any;
                
                // If message is from someone else and belongs to one of our minimized bubbles
                if (newMsg.sender_id !== currentUser.id && chatHeads.some(ch => ch.conversationId === newMsg.conversation_id)) {
                    if (expandedConvIdRef.current !== newMsg.conversation_id) {
                        setUnreadCounts(prev => ({
                            ...prev,
                            [newMsg.conversation_id]: (prev[newMsg.conversation_id] || 0) + 1
                        }));
                        playNotificationSound('message');
                    }
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [chatHeads, currentUser?.id, currentUser?.company_id, playNotificationSound]);

    // 3. Helper to mark messages as read
    const markAsRead = useCallback(async (convId: string) => {
        try {
            await supabase
                .from('messages')
                .update({ is_read: true })
                .eq('conversation_id', convId)
                .eq('receiver_id', currentUser.id)
                .eq('is_read', false);
            
            setUnreadCounts(prev => ({ ...prev, [convId]: 0 }));
        } catch (err) {
            console.error('[ChatHeads] Error marking messages as read:', err);
        }
    }, [currentUser.id]);

    // 4. Fetch messages & subscribe to Realtime for the expanded chat head
    useEffect(() => {
        if (!expandedChatHeadId) {
            setMessages([]);
            return;
        }

        const fetchMessages = async () => {
            setLoading(true);
            try {
                const { data } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('conversation_id', expandedChatHeadId)
                    .order('created_at', { ascending: false })
                    .limit(40);
                
                if (data) {
                    const activeHead = chatHeads.find(ch => ch.conversationId === expandedChatHeadId);
                    const mapped: Message[] = data.reverse().map((msg: any) => ({
                        id: msg.id,
                        sender: msg.sender_id === currentUser.id ? 'me' : msg.sender_id,
                        senderName: msg.sender_id === currentUser.id ? currentUser.name : (activeHead?.participantName || 'Colega'),
                        avatarUrl: msg.sender_id === currentUser.id ? currentUser.avatarUrl : (activeHead?.participantAvatarUrl || ''),
                        text: msg.text,
                        timestamp: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        reactions: []
                    }));
                    setMessages(mapped);
                    scrollToBottom('auto');
                }
                await markAsRead(expandedChatHeadId);
            } catch (err) {
                console.error('[ChatHeads] Error loading messages:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchMessages();

        // Subscribe to Realtime channel for this specific conversation
        const channel = supabase
            .channel(`floating-chat-${expandedChatHeadId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${expandedChatHeadId}`
            }, async (payload) => {
                const newMsg = payload.new as any;
                
                setMessages(prev => {
                    if (prev.some(m => m.id === newMsg.id)) return prev;
                    const isMe = newMsg.sender_id === currentUser.id;
                    const activeHead = chatHeads.find(ch => ch.conversationId === expandedChatHeadId);
                    const mappedMsg: Message = {
                        id: newMsg.id,
                        sender: isMe ? 'me' : newMsg.sender_id,
                        senderName: isMe ? currentUser.name : (activeHead?.participantName || 'Colega'),
                        avatarUrl: isMe ? currentUser.avatarUrl : (activeHead?.participantAvatarUrl || ''),
                        text: newMsg.text,
                        timestamp: new Date(newMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        reactions: []
                    };
                    return [...prev, mappedMsg];
                });
                
                scrollToBottom();

                if (newMsg.sender_id !== currentUser.id) {
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
    }, [expandedChatHeadId, chatHeads, currentUser.id, currentUser.name, currentUser.avatarUrl, markAsRead, playNotificationSound, scrollToBottom]);

    // 5. Send message from mini chatbox
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessageText.trim() || !expandedChatHeadId || isSending) return;

        const textToSend = newMessageText.trim();
        setNewMessageText('');
        setIsSending(true);

        const activeHead = chatHeads.find(ch => ch.conversationId === expandedChatHeadId);
        const receiverId = activeHead?.participantId || null;

        try {
            const { error } = await supabase
                .from('messages')
                .insert({
                    conversation_id: expandedChatHeadId,
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
                    last_message_at: new Date().toISOString()
                })
                .eq('id', expandedChatHeadId);

            scrollToBottom();
        } catch (err) {
            console.error('[ChatHeads] Error sending message:', err);
        } finally {
            setIsSending(false);
        }
    };

    if (chatHeads.length === 0) return null;

    const activeExpandedHead = chatHeads.find(ch => ch.conversationId === expandedChatHeadId);

    return (
        <div className="fixed bottom-24 right-6 flex flex-col items-end space-y-4 z-[9999] pointer-events-none">
            {/* Expanded Mini Chat Box */}
            {expandedChatHeadId && activeExpandedHead && (
                <div className="w-[380px] h-[480px] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 flex flex-col overflow-hidden pointer-events-auto transform transition-all duration-300 animate-in slide-in-from-bottom-5">
                    {/* Header */}
                    <div className="px-4 py-3 bg-gradient-to-r from-brand-primary/10 to-transparent border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                            <img
                                src={activeExpandedHead.participantAvatarUrl}
                                alt={activeExpandedHead.participantName}
                                className="w-8 h-8 rounded-full object-cover"
                            />
                            <span className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate max-w-[150px]">
                                {activeExpandedHead.participantName}
                            </span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                            <button
                                onClick={() => setExpandedChatHeadId(null)}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                                title="Minimizar"
                            >
                                <ChevronDownIcon className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => onCloseChatHead(expandedChatHeadId)}
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
                                        <div className={`px-3 py-2 rounded-2xl max-w-[290px] text-sm break-words shadow-sm border ${
                                            isMe
                                                ? 'bg-brand-primary text-white border-transparent rounded-br-none'
                                                : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 border-gray-100 dark:border-white/5 rounded-bl-none'
                                        }`}>
                                            <p className="whitespace-pre-wrap">{msg.text}</p>
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
                            className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-white/5 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-primary dark:focus:border-brand-primary text-gray-800 dark:text-gray-200"
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
            )}

            {/* Bubble List Stack */}
            <div className="flex flex-row space-x-3 pointer-events-auto items-end animate-in fade-in duration-300">
                {chatHeads.map((ch) => {
                    const unread = unreadCounts[ch.conversationId] || 0;
                    const isExpanded = expandedChatHeadId === ch.conversationId;

                    return (
                        <div
                            key={ch.conversationId}
                            className="relative group transition-all duration-300 transform hover:scale-105"
                        >
                            {/* Avatar Bubble */}
                            <button
                                onClick={() => setExpandedChatHeadId(isExpanded ? null : ch.conversationId)}
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

export default FloatingChatHeads;
