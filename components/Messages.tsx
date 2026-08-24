import React, { useState, useRef, useEffect } from 'react';
import {
    FaceSmileIcon,
    PaperClipIcon,
    PaperAirplaneIcon,
    XCircleIcon,
    ArrowUturnLeftIcon,
    SearchIcon,
    ChevronLeftIcon,
    PlusIcon,
    TrashIcon,
    UserGroupIcon,
    XMarkIcon,
    SparklesIcon,
    LockClosedIcon,
    BellIcon,
} from './icons';
import type { Company, Employee, Page, AppData, Announcement, EmployeePermissions, Notification, Post, Ticket, Conversation, CalendarEvent, Recognition, TIRequest, Message } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import { usePresence } from './PresenceContext';

const availableReactions = ['👍', '❤️', '😂', '😮', '😢', '😡', '🤔', '🎉', '🔥', '👀'];
const availableEmojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
    '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
    '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
    '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
    '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
    '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
    '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯',
    '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
    '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕',
    '💩', '🤡', '👺', '👹', '👻', '👽', '👾', '🤖',
    '🎃', '😺', '😸', '😹', '😻', '😼',
    '😽', '🙀', '😿', '😾', '👐', '🙌',
    '👏', '👍', '👎', '👊', '✊', '🤛', '🤜',
    '🤞', '✌️', '🤟', '🤘', '👌', '🤏', '🤌',
    '💪', '🦾', '🦵', '🦿', '🦶', '👂', '🦻',
    '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅',
    '👄', '👄', '👶', '🧒', '👦', '👧', '👤', '👱', '👨',
    '🧔', '🧑', '👩', '🧓', '👴', '👵',
    '☹️', '😮‍💨', '🙅', '🙆', '💁',
    '🙋', '🧏', '🙇', '🤦', '🤷',
    '🧑‍⚕️', '🧑‍🎓', '🧑‍🏫', '🧑‍⚖️', '🧑‍🌾', '🧑‍🍳', '🧑‍🔧', '🧑‍🏭',
    '🧑‍💼', '🧑‍🔬', '🧑‍💻', '🧑‍🎤', '🧑‍🎨', '🧑‍✈️', '🧑‍🚀',
    '🧑‍🚒', '👮', '🕵️', '💂', '🥷', '👷', '🤴',
    '👸', '👳', '👲', '🧕'
];

const MASTER_ADMIN_ID = 'bd6b9e1b-52c0-482a-8caa-96f11677b261';

const NOTE_COLORS = [
    { id: 'blue', bg: 'bg-blue-100', border: 'border-blue-200' },
    { id: 'green', bg: 'bg-green-100', border: 'border-green-200' },
    { id: 'red', bg: 'bg-red-100', border: 'border-red-200' },
    { id: 'yellow', bg: 'bg-yellow-100', border: 'border-yellow-200' },
    { id: 'pink', bg: 'bg-pink-100', border: 'border-pink-200' },
];

interface Note {
    id: number;
    text: string;
    colorId: string;
    createdAt: number;
}

interface MessagesProps {
    initialConversationId?: string;
}

const Messages: React.FC<MessagesProps> = ({ initialConversationId }) => {
    const { profile: currentUser } = useAuth();
    const { addNotification, playNotificationSound, showDesktopNotification } = useNotifications();
    const { onlineUsers } = usePresence();
    const [companyEmployees, setCompanyEmployees] = useState<Employee[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeTab, setActiveTab] = useState<'conversations' | 'contacts' | 'teams'>('conversations');
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(initialConversationId || null);

    // Sync with prop for deep linking/nudges
    useEffect(() => {
        if (initialConversationId) {
            setSelectedConversationId(initialConversationId);
        }
    }, [initialConversationId]);
    // Ref para evitar stale closure no Realtime
    const selectedConvRef = useRef<string | null>(null);
    useEffect(() => {
        selectedConvRef.current = selectedConversationId;
    }, [selectedConversationId]);
    // Alterado para string (UUID)
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessageText, setNewMessageText] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showStickerPicker, setShowStickerPicker] = useState(false);
    const [stickerTab, setStickerTab] = useState<'gallery' | 'saved'>('gallery');
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
    const [typingStatus, setTypingStatus] = useState<Record<string, boolean>>({}); // Changed key to string
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [loading, setLoading] = useState(false);
    
    // Paginação de mensagens
    const [messageLimit, setMessageLimit] = useState(50);
    const [hasMoreMessages, setHasMoreMessages] = useState(false);
    const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);

    // MSN Nudge States
    const [nudgeCooldowns, setNudgeCooldowns] = useState<Record<string, number>>(() => {
        const saved = localStorage.getItem('nudge_cooldowns');
        return saved ? JSON.parse(saved) : {};
    });
    const [cooldownTimeouts, setCooldownTimeouts] = useState<Record<string, number>>({});

    useEffect(() => {
        localStorage.setItem('nudge_cooldowns', JSON.stringify(nudgeCooldowns));

        // Update local state for remaining timers
        const interval = setInterval(() => {
            const now = Date.now();
            const newTimeouts: Record<string, number> = {};
            let hasChanges = false;

            Object.entries(nudgeCooldowns).forEach(([id, ts]) => {
                const diff = now - (ts as number);
                const remaining = Math.max(0, (5 * 60 * 1000) - diff);
                if (remaining > 0) {
                    newTimeouts[id] = Math.ceil(remaining / 1000);
                    hasChanges = true;
                }
            });

            setCooldownTimeouts(newTimeouts);
        }, 1000);

        return () => clearInterval(interval);
    }, [nudgeCooldowns]);

    const handleSendNudge = async () => {
        if (!selectedConversationId || !selectedConversation) return;

        const now = Date.now();
        const lastNudge = nudgeCooldowns[selectedConversationId] || 0;
        if (now - lastNudge < 5 * 60 * 1000) return; // 5 minute cooldown

        try {
            const compId = currentUser?.company_id;
            if (!compId) return;

            // OPTIMISTIC UI: Shake immediately!
            // OPTIMISTIC UI: Shake immediately!
            try {
                if ((window as any).triggerDetectionShake) {
                    console.log("[PandaNet] Triggering local shake via window function");
                    (window as any).triggerDetectionShake();
                } else {
                    console.warn("[PandaNet] triggerDetectionShake not found on window object");
                }
            } catch (e) {
                console.error("Error triggering shake:", e);
            }

            const { error } = await supabase.from('messages').insert({
                conversation_id: selectedConversationId,
                sender_id: currentUser?.id,
                company_id: compId,
                text: '!!! CHAMEI SUA ATENÇÃO !!!',
                file_type: 'nudge'
            });

            if (error) throw error;

            await supabase.from('conversations').update({
                last_message: 'Chamou sua atenção!',
                last_message_at: new Date().toISOString()
            }).eq('id', selectedConversationId);

            // Update cooldown state
            setNudgeCooldowns(prev => ({ ...prev, [selectedConversationId]: now }));

            if (selectedConversation.participantId) {
                addNotification({
                    user_id: selectedConversation.participantId as any,
                    type: 'message',
                    title: 'Pedindo Atenção!',
                    description: `${currentUser?.name} chamou sua atenção!`,
                    avatarUrl: currentUser?.avatarUrl,
                    link: '/messages'
                } as any);
            }

            fetchMessages(selectedConversationId);


            // 1. BROADCAST NUDGE (Imediato) - Use the GLOBAL channel
            console.log('[PandaNet] Sending broadcast nudge to global-nudges channel...');
            const broadcastChannel = supabase.channel('global-nudges');

            // Send broadcast immediately without waiting for subscription
            // The global listener in App.tsx is already subscribed
            broadcastChannel.send({
                type: 'broadcast',
                event: 'nudge',
                payload: {
                    sender_id: currentUser?.id,
                    conversation_id: selectedConversationId,
                    receiver_id: selectedConversation?.participantId
                }
            }).then(() => {
                console.log('[PandaNet] ✅ Broadcast sent successfully');
            }).catch((err) => {
                console.error('[PandaNet] ❌ Broadcast failed:', err);
            });

            // 2. DEDICATED NUDGE TABLE (Garantia de entrega)
            if (selectedConversation?.participantId) {
                console.log('[PandaNet] Inserting nudge into table...');
                console.log('[PandaNet] Sender ID:', currentUser.id);
                console.log('[PandaNet] Receiver ID:', selectedConversation.participantId);
                console.log('[PandaNet] Conversation ID:', selectedConversationId);

                const { data, error: nudgeError } = await supabase
                    .from('nudges')
                    .insert({
                        sender_id: currentUser.id,
                        receiver_id: selectedConversation.participantId, // ID do destinatário direto
                        conversation_id: selectedConversationId
                    })
                    .select();

                if (nudgeError) {
                    console.error('[PandaNet] ❌ Erro ao registrar nudge na tabela:', nudgeError);
                } else {
                    console.log('[PandaNet] ✅ Nudge registrado na tabela dedicada:', data);
                }
            } else {
                console.warn('[PandaNet] ⚠️ participantId não encontrado, nudge não foi inserido na tabela');
            }


        } catch (err) {
            console.error('Erro ao enviar nudge:', err);
        }
    };

    // Sticky Notes State (Local Storage)
    const [notes, setNotes] = useState<Note[]>(() => {
        try {
            const saved = localStorage.getItem('sticky_notes');
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.error('Failed to parse sticky notes', e);
        }
        return [];
    });

    useEffect(() => {
        localStorage.setItem('sticky_notes', JSON.stringify(notes));
    }, [notes]);
    const [newNoteText, setNewNoteText] = useState('');
    const [noteWarning, setNoteWarning] = useState(false);

    const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
    const stickerTimeoutRef = useRef<any>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const stickerUploadRefHeader = useRef<HTMLInputElement>(null);
    const stickerUploadRefInput = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const typingTimeoutRef = useRef<any>(null);
    
    // Refs para controlar scroll automático
    const isInitialLoad = useRef(true);
    const lastMessageCount = useRef(0);
    const previousConversationId = useRef<string | null>(null);

    const handleMouseEnterReaction = (msgId: string) => {
        if (stickerTimeoutRef.current) clearTimeout(stickerTimeoutRef.current);
        stickerTimeoutRef.current = setTimeout(() => {
            setShowReactionPicker(msgId);
        }, 1000); // 1.0s delay
    };

    const handleMouseLeaveReaction = () => {
        if (stickerTimeoutRef.current) clearTimeout(stickerTimeoutRef.current);
        stickerTimeoutRef.current = setTimeout(() => {
            setShowReactionPicker(null);
        }, 1500); // Increased stay time
    };

    const [customStickers, setCustomStickers] = useState<string[]>(() => {
        const saved = localStorage.getItem('custom_stickers');
        return saved ? JSON.parse(saved) : [
            'https://fonts.gstatic.com/s/e/notoemoji/latest/1f600/512.gif',
            'https://fonts.gstatic.com/s/e/notoemoji/latest/1f60d/512.gif',
            'https://fonts.gstatic.com/s/e/notoemoji/latest/1f44d/512.gif',
            'https://fonts.gstatic.com/s/e/notoemoji/latest/1f389/512.gif',
            'https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif'
        ];
    });

    useEffect(() => {
        localStorage.setItem('custom_stickers', JSON.stringify(customStickers));
    }, [customStickers]);

    const handleAddManualGif = () => {
        const url = prompt('Cole o link do GIF (URL):');
        if (url && url.trim()) {
            setCustomStickers(prev => [...prev, url.trim()]);
        }
    };

    const handleUploadGif = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.includes('gif') && !file.type.includes('image')) {
            alert('Por favor, selecione um GIF ou imagem.');
            return;
        }

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `stickers/${currentUser.id}/${fileName}`;

            const { data, error } = await supabase.storage
                .from('chat-media')
                .upload(filePath, file);

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(filePath);
            setCustomStickers(prev => [...prev, publicUrl]);
        } catch (err) {
            console.error('Erro no upload do GIF:', err);
            alert('Falha ao subir o GIF.');
        }
    };

    const removeSticker = (url: string) => {
        setCustomStickers(prev => prev.filter(s => s !== url));
    };

    const handleSendSticker = (url: string) => {
        handleSendMessage(undefined, 'sticker', url);
        setShowStickerPicker(false);
    };

    const selectedConversation = conversations.find(c => c.id === selectedConversationId);

    // Save notes to local storage
    useEffect(() => {
        localStorage.setItem('sticky_notes', JSON.stringify(notes));
    }, [notes]);

    // Buscar Funcionários (Contatos)
    // Buscar Funcionários (Contatos)
    useEffect(() => {
        const fetchEmployees = async () => {
            if (!currentUser?.company_id) return;
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('company_id', currentUser.company_id); // Filter by company

            if (data) {
                // Map Supabase profile to Employee type
                const employees: Employee[] = data.map(p => {
                    // Helper para URL do avatar
                    let avatarUrl = p.avatar_url;
                    if (avatarUrl && !avatarUrl.startsWith('http')) {
                        const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(avatarUrl);
                        avatarUrl = publicUrl.publicUrl;
                    }
                    if (!avatarUrl) {
                        avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(p.full_name || 'User')}&background=random`;
                    }

                    return {
                        id: p.id,
                        name: p.full_name,
                        email: p.email || '',
                        role: p.role,
                        team: p.team,
                        avatarUrl: avatarUrl,
                        joinDate: p.join_date,
                        birthDate: p.birth_date,
                        isAdmin: p.is_admin,
                        isOnline: onlineUsers.has(p.id),
                        permissions: p.permissions || {},
                        following: p.following || [],
                        phone: p.phone,
                        officeLocation: p.office_location,
                        bio: p.bio,
                        company_id: p.company_id,
                        sectorManager: p.sector_manager,
                        employeeManager: p.employee_manager,
                        coverUrl: p.cover_url
                    };
                });
                setCompanyEmployees(employees);
            }
        };

        if (currentUser) {
            fetchEmployees();
        }
    }, [currentUser, onlineUsers]); // Adicionado onlineUsers como dependência

    // Restaurar última conversa selecionada do localStorage
    useEffect(() => {
        const lastConvId = localStorage.getItem('lastSelectedConversation');
        if (lastConvId && conversations.length > 0 && !selectedConversationId) {
            // Verificar se a conversa ainda existe
            if (conversations.some(c => c.id === lastConvId)) {
                setSelectedConversationId(lastConvId);
            }
        }
    }, [conversations]); // Executa quando conversas são carregadas

    // Buscar Conversas
    const fetchConversations = async () => {
        if (!currentUser) return;
        try {
            // 1. Obter todos os IDs de conversa do usuário atual
            const { data: myParticipations, error: partError } = await supabase
                .from('conversation_participants')
                .select('conversation_id')
                .eq('user_id', currentUser.id);

            if (partError) {
                console.error("Erro busca participações:", partError);
                return;
            }

            const conversationIds = myParticipations.map((p: any) => p.conversation_id);

            if (conversationIds.length === 0) {
                setConversations([]);
                return;
            }

            // 2. Buscar detalhes da conversa
            const { data: convData, error: convError } = await supabase
                .from('conversations')
                .select('*')
                .in('id', conversationIds)
                .order('last_message_at', { ascending: false });

            if (convError) {
                console.error("Erro busca conversas:", convError);
                return;
            }

            // 3. Buscar OUTROS participantes para cada conversa
            const fullConversations = await Promise.all(convData.map(async (conv: any) => {
                try {
                    const { data: participants, error: ppError } = await supabase
                        .from('conversation_participants')
                        .select('user_id, profiles(full_name, avatar_url)')
                        .eq('conversation_id', conv.id);

                    if (ppError) {
                        console.error('Erro ao buscar participantes para conversa', conv.id, ppError);
                        return null; // Skip this conversation on error
                    }

                    // Encontrar o "outro" usuário
                    const otherPart = participants?.find((p: any) => p.user_id !== currentUser.id);
                    const otherUser = otherPart ? (otherPart.profiles as any) : null;

                    // Se não achar outro, talvez seja eu mesmo ou dados perdidos
                    const displayName = conv.is_group
                        ? conv.group_name
                        : (otherUser?.full_name || (otherPart ? 'Usuário Excluído' : 'Usuário Desconhecido'));

                    const displayAvatar = conv.is_group
                        ? `https://ui-avatars.com/api/?name=${displayName}&background=random`
                        : (otherUser?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`);

                    return {
                        id: conv.id,
                        participantName: displayName,
                        participantAvatarUrl: displayAvatar,
                        participantId: otherPart?.user_id,
                        lastMessage: conv.last_message || 'Inicie a conversa',
                        unreadCount: 0,
                        messages: [],
                        isGroup: conv.is_group,
                        groupName: conv.group_name,
                        is_closed: !!conv.is_closed,
                        admins: [],
                        lastMessageTimestamp: conv.last_message_at ? new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
                    };
                } catch (err) {
                    console.error('Erro processando conversa', conv.id, err);
                    return null;
                }
            }));

            // Filter out nulls and conversations with "Usuário Excluído" or "Usuário Desconhecido"
            const filteredConversations = fullConversations.filter((c: any) =>
                c !== null &&
                c.participantName !== 'Usuário Excluído' &&
                c.participantName !== 'Usuário Desconhecido'
            );

            console.log("Conversas filtradas e definidas no estado:", filteredConversations);
            setConversations(filteredConversations as Conversation[]);

        } catch (error) {
            console.error('Erro crítico ao buscar conversas:', error);
        }
    };

    // Busca inicial
    useEffect(() => {
        fetchConversations();

        console.log("[Realtime] Iniciando subscription para usuário:", currentUser.id);

        // Subscrição para atualizações de novas conversas/mensagens
        const channel = supabase
            .channel('public:messages_and_convs')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, (payload) => {
                console.log("[Realtime] Mudança em conversas detectada:", payload);
                fetchConversations();
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
                const newMsg = payload.new as any;
                console.log("[Realtime] Nova mensagem recebida:", newMsg);
                console.log("[Realtime] Conversa ativa:", selectedConvRef.current);
                console.log("[Realtime] Conversa da mensagem:", newMsg.conversation_id);

                // Se a mensagem não for minha, notificar
                if (newMsg.sender_id !== currentUser.id) {
                    console.log("[Realtime] Mensagem de outro usuário, tocando som");
                    playNotificationSound('message');

                    // Notificação de Desktop se não for a conversa ativa
                    if (newMsg.conversation_id !== selectedConvRef.current) {
                        console.log("[Realtime] Mostrando notificação desktop");
                        try {
                            const { data: sender } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', newMsg.sender_id).single();
                            showDesktopNotification(
                                `Mensagem de ${sender?.full_name || 'Usuário'}`,
                                newMsg.text || 'Enviou um anexo',
                                sender?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(sender?.full_name || 'U')}`
                            );
                        } catch (e) {
                            console.error("[Realtime] Erro ao buscar dados do remetente:", e);
                        }
                    }
                } else {
                    console.log("[Realtime] Mensagem própria, não notificar");
                }

                console.log("[Realtime] Atualizando conversas...");
                fetchConversations();
                
                if (selectedConvRef.current === newMsg.conversation_id) {
                    console.log("[Realtime] Atualizando mensagens da conversa ativa");
                    fetchMessages(selectedConvRef.current);
                } else {
                    console.log("[Realtime] Mensagem de outra conversa, não atualizar");
                }
            })
            .subscribe((status, err) => {
                console.log("[Realtime] Status da subscription:", status);
                if (err) {
                    console.error("[Realtime] Erro na subscription:", err);
                }
                if (status === 'SUBSCRIBED') {
                    console.log("[Realtime] ✅ Conectado com sucesso!");
                } else if (status === 'CHANNEL_ERROR') {
                    console.error("[Realtime] ❌ Erro no canal!");
                } else if (status === 'TIMED_OUT') {
                    console.error("[Realtime] ⏱️ Timeout na conexão!");
                } else if (status === 'CLOSED') {
                    console.warn("[Realtime] 🔌 Canal fechado");
                }
            });

        return () => {
            console.log("[Realtime] Removendo subscription");
            supabase.removeChannel(channel);
        };
    }, [currentUser.id]); // Re-executa se usuário mudar (raro)

    // Buscar Mensagens quando conversa selecionada
    const fetchMessages = async (convId: string, limit = messageLimit) => {
        try {
            // Buscar limit + 1 para saber se há mais mensagens
            const { data, error } = await supabase
                .from('messages')
                .select(`
                    id, text, created_at, sender_id, file_url, file_type, reactions, sender_deleted_at, reply_to,
                    profiles:sender_id(full_name, avatar_url),
                    replied_message:reply_to(id, text, sender_id, file_url, file_type, profiles:sender_id(full_name))
                `)
                .eq('conversation_id', convId)
                .order('created_at', { ascending: false })  // Ordem decrescente para pegar as mais recentes
                .limit(limit + 1);  // +1 para verificar se há mais

            if (error) throw error;

            // Verificar se há mais mensagens
            const hasMore = data.length > limit;
            setHasMoreMessages(hasMore);
            
            // Remover a mensagem extra se houver
            const messagesToShow = hasMore ? data.slice(0, limit) : data;
            
            // Reverter ordem para exibir cronologicamente
            const formattedMessages: Message[] = messagesToShow.reverse().map((m: any) => ({
                id: m.id, // UUID
                sender: m.sender_id === currentUser.id ? 'me' : 'other',
                senderName: (m.profiles as any)?.full_name || 'Usuário Excluído',
                avatarUrl: (m.profiles as any)?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent((m.profiles as any)?.full_name || 'Usuario Excluido')}&background=random`,
                text: m.text,
                timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                reactions: m.reactions ? (m.reactions as any[]).map((r: any) => ({ emoji: r.emoji, user: r.user })) : [],
                file: m.file_url ? { name: (m.file_type?.startsWith('image/') || m.file_type === 'sticker') ? 'Imagem' : 'Anexo', url: m.file_url, type: m.file_type } : undefined,
                sender_deleted_at: m.sender_deleted_at,
                reply_to: m.reply_to,
                replied_message: m.replied_message ? {
                    id: m.replied_message.id,
                    text: m.replied_message.text,
                    senderName: m.replied_message.profiles?.full_name || 'Usuário',
                    file_url: m.replied_message.file_url,
                    file_type: m.replied_message.file_type
                } : undefined
            }));

            // Filter out messages that I deleted from MY view
            const visibleMessages = formattedMessages.filter(m => {
                if (m.sender === 'me' && m.sender_deleted_at) return false;
                return true;
            });

            setMessages(visibleMessages);

            // Atualiza estado local para feedback imediato na UI
            setConversations(prev => prev.map(c => c.id === convId ? { ...c, messages: visibleMessages } : c));

        } catch (error) {
            console.error('Erro ao buscar mensagens:', error);
        }
    };

    useEffect(() => {
        if (selectedConversationId) {
            // Só resetar flag se for uma conversa diferente
            if (previousConversationId.current !== selectedConversationId) {
                isInitialLoad.current = true;
                previousConversationId.current = selectedConversationId;
                setMessageLimit(50); // Reset limit ao trocar de conversa
            }
            fetchMessages(selectedConversationId);
        }
    }, [selectedConversationId]);

    // Função para carregar mensagens antigas
    const loadOlderMessages = async () => {
        if (!selectedConversationId || loadingOlderMessages || !hasMoreMessages) return;
        
        setLoadingOlderMessages(true);
        const newLimit = messageLimit + 50;
        setMessageLimit(newLimit);
        await fetchMessages(selectedConversationId, newLimit);
        setLoadingOlderMessages(false);
    };

    // Auto-scroll inteligente: apenas no carregamento inicial ou ao enviar mensagem
    useEffect(() => {
        // Scroll apenas se:
        // 1. É o carregamento inicial da conversa
        // 2. O número de mensagens aumentou E a última mensagem é minha
        const shouldScroll = isInitialLoad.current || 
            (messages.length > lastMessageCount.current && 
             messages[messages.length - 1]?.sender === 'me');
        
        if (shouldScroll) {
            // Scroll instantâneo sem animação
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
            isInitialLoad.current = false;
        }
        
        lastMessageCount.current = messages.length;
    }, [messages]);

    // Deselecionar se a conversa for fechada (Suporte)
    useEffect(() => {
        if (selectedConversationId) {
            const current = conversations.find(c => c.id === selectedConversationId);
            if (current && current.is_closed === true) {
                console.log("Chat encerrado detectado, limpando seleção:", selectedConversationId);
                setSelectedConversationId(null);
            }
        }
    }, [conversations, selectedConversationId]);

    const handleSendMessage = async (e?: React.FormEvent, type: 'text' | 'sticker' = 'text', content?: string) => {
        if (e) e.preventDefault();

        const textToSend = type === 'text' ? newMessageText : '';
        const stickerUrl = type === 'sticker' ? content : null;

        if (!textToSend.trim() && !stickerUrl && !attachedFile) return;
        if (!selectedConversationId) return;

        try {
            let uploadedFileUrl = null;
            let fileType = null;

            if (attachedFile) {
                // Lógica de Upload
                const fileExt = attachedFile.name.split('.').pop();
                const fileName = `${Date.now()}.${fileExt}`;
                const filePath = `${selectedConversationId}/${fileName}`;

                const { data, error: uploadError } = await supabase.storage
                    .from('chat-media')
                    .upload(filePath, attachedFile);

                if (uploadError) {
                    console.error('Falha no upload:', uploadError);
                } else if (data) {
                    const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(filePath);
                    uploadedFileUrl = publicUrl;
                    fileType = attachedFile.type;
                }
            }

            const compId = currentUser.company_id;
            if (!compId) {
                console.error("Missing company_id for current user", currentUser);
                alert("Erro: Empresa não identificada no seu perfil.");
                return;
            }

            const { error } = await supabase.from('messages').insert({
                conversation_id: selectedConversationId,
                sender_id: currentUser.id,
                company_id: compId,
                text: stickerUrl || textToSend,
                file_url: uploadedFileUrl || stickerUrl,
                file_type: stickerUrl ? 'sticker' : fileType,
                reactions: [],
                reply_to: replyingToMessage?.id || null  // Adicionar referência à mensagem respondida
            });

            if (error) throw error;

            // Atualiza última mensagem da conversa
            await supabase.from('conversations').update({
                last_message: stickerUrl ? 'Enviou uma figurinha' : (attachedFile ? 'Enviou um anexo' : textToSend),
                last_message_at: new Date().toISOString()
            }).eq('id', selectedConversationId);

            setNewMessageText('');
            setAttachedFile(null);
            setReplyingToMessage(null);
            fetchMessages(selectedConversationId);

            // Trigger Notification for the participants (except me)
            if (selectedConversation) {
                // If group, notify all members? For now keep it simple.
                // In a real app we'd trigger this on the backend or filter here.
                if (!selectedConversation.isGroup && selectedConversation.participantId) {
                    addNotification({
                        user_id: selectedConversation.participantId as any, // Context handles my storage but we want to notify participant
                        type: 'message',
                        title: 'Nova Mensagem',
                        description: `${currentUser.name}: ${stickerUrl ? 'Figurinha' : textToSend.slice(0, 50)}`,
                        avatarUrl: currentUser.avatarUrl,
                        link: '/messages'
                    } as any);
                }
            }

        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            alert('Falha ao enviar mensagem');
        }
    };

    const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) { alert('O arquivo excede o limite de 10MB.'); return; }
            setAttachedFile(file);
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1 || items[i].type.indexOf('file') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    if (file.size > 10 * 1024 * 1024) {
                        alert('O arquivo colado excede o limite de 10MB.');
                        return;
                    }
                    setAttachedFile(file);
                }
            }
        }
    };

    const handleReact = async (messageId: string, emoji: string) => { // Alterado messageId para string
        const msg = messages.find(m => m.id === messageId);
        if (!msg) return;

        const currentReactions = msg.reactions || [];
        const userReactionIndex = currentReactions.findIndex(r => r.user === currentUser.name);

        let newReactions = [...currentReactions];
        if (userReactionIndex > -1) {
            if (newReactions[userReactionIndex].emoji === emoji) {
                newReactions.splice(userReactionIndex, 1); // Remove
            } else {
                newReactions[userReactionIndex].emoji = emoji; // Atualiza
            }
        } else {
            newReactions.push({ emoji, user: currentUser.name }); // Adiciona
        }

        // UI Otimista
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions: newReactions } : m));

        // Atualização no BD
        try {
            await supabase.from('messages').update({
                reactions: newReactions
            }).eq('id', messageId);
        } catch (err) {
            console.error('Erro ao atualizar reação:', err);
        }
    };

    const handleSelectConversation = (convId: string) => {
        setSelectedConversationId(convId);
        localStorage.setItem('lastSelectedConversation', convId);
        setActiveTab('conversations'); // Retorna para lista no mobile se necessário
    };

    const handleStartConversation = async (contactId: string) => {
        try {
            setLoading(true);
            // 1. Se for o Master Admin (Suporte VIP), usamos um RPC especial para evitar RLS cross-tenant
            if (contactId === MASTER_ADMIN_ID) {
                const { data: convId, error: rpcError } = await supabase.rpc('get_or_create_support_conversation', {
                    admin_id: currentUser.id,
                    master_id: contactId
                });

                if (rpcError) throw rpcError;

                if (convId) {
                    // Garantir que a conversa não esteja fechada ao reabrir
                    await supabase
                        .from('conversations')
                        .update({ is_closed: false })
                        .eq('id', convId);

                    setSelectedConversationId(convId);
                    setActiveTab('conversations');
                    setLoading(false);
                    await fetchConversations();
                    return;
                }
            }

            // 1. Verificar se já existe uma conversa 1:1 entre esses usuários (Lógica padrão)
            const { data: participations, error: partError } = await supabase
                .from('conversation_participants')
                .select('conversation_id')
                .eq('user_id', currentUser.id);

            if (partError) throw partError;

            const myConvIds = participations.map(p => p.conversation_id);

            if (myConvIds.length > 0) {
                const { data: commonPart, error: commonError } = await supabase
                    .from('conversation_participants')
                    .select('conversation_id, user_id')
                    .in('conversation_id', myConvIds)
                    .eq('user_id', contactId);

                if (commonPart && commonPart.length > 0) {
                    // Verificar se não é grupo
                    const { data: convs } = await supabase
                        .from('conversations')
                        .select('id')
                        .eq('id', commonPart[0].conversation_id)
                        .eq('is_group', false)
                        .single();

                    if (convs) {
                        // Se for suporte VIP e estiver fechado, reabre
                        if (contactId === MASTER_ADMIN_ID) {
                            await supabase
                                .from('conversations')
                                .update({ is_closed: false })
                                .eq('id', convs.id);
                        }

                        setSelectedConversationId(convs.id);
                        setActiveTab('conversations');
                        setLoading(false);
                        return;
                    }
                }
            }

            // 2. Se não existe, criar nova conversa
            const { data: newConv, error: createError } = await supabase
                .from('conversations')
                .insert({
                    company_id: currentUser.company_id,
                    is_group: false,
                    last_message: 'Conversa iniciada',
                    last_message_at: new Date().toISOString()
                })
                .select()
                .single();

            if (createError) throw createError;

            // 3. Adicionar participantes
            const { error: partInsertError } = await supabase.from('conversation_participants').insert([
                { conversation_id: newConv.id, user_id: currentUser.id, company_id: currentUser.company_id },
                { conversation_id: newConv.id, user_id: contactId, company_id: currentUser.company_id }
            ]);

            if (partInsertError) throw partInsertError;

            await fetchConversations();
            setSelectedConversationId(newConv.id);
            setActiveTab('conversations');

        } catch (error: any) {
            console.error('Erro ao iniciar conversa:', error);
            alert('Erro ao iniciar conversa: ' + (error.message || error));
        } finally {
            setLoading(false);
        }
    };

    const handleCloseConversation = async () => {
        if (!selectedConversationId) return;
        if (!window.confirm("Deseja encerrar este suporte? O chat será bloqueado para novas mensagens.")) return;

        try {
            const { error } = await supabase
                .from('conversations')
                .update({ is_closed: true })
                .eq('id', selectedConversationId);

            if (error) throw error;

            setConversations(prev => prev.map(c => c.id === selectedConversationId ? { ...c, is_closed: true } : c));
            // Trigger refresh to block input
            await fetchConversations();
        } catch (err: any) {
            alert("Erro ao encerrar suporte: " + err.message);
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        if (!window.confirm("Deseja apagar esta mensagem? Ela sumirá para você agora e em 20 minutos para o destinatário.")) return;

        try {
            const { error } = await supabase
                .from('messages')
                .update({ sender_deleted_at: new Date().toISOString() })
                .eq('id', messageId);

            if (error) throw error;

            // Update local state immediately
            setMessages(prev => prev.filter(m => m.id !== messageId));
        } catch (err: any) {
            alert("Erro ao apagar mensagem: " + err.message);
        }
    };

    // Lógica de Notas Adesivas
    const handleAddNote = () => {
        if (!newNoteText.trim()) return;

        if (notes.length >= 6) {
            if (!noteWarning) {
                setNoteWarning(true);
                return;
            }
            // FIFO: Remove a primeira, adiciona a nova
            const newNote: Note = { id: Date.now(), text: newNoteText, colorId: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)].id, createdAt: Date.now() };
            setNotes(prev => [...prev.slice(1), newNote]);
            setNoteWarning(false);
        } else {
            const newNote: Note = { id: Date.now(), text: newNoteText, colorId: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)].id, createdAt: Date.now() };
            setNotes(prev => [...prev, newNote]);
        }
        setNewNoteText('');
    };

    const handleDeleteNote = (id: number) => {
        setNotes(notes.filter(n => n.id !== id));
        setNoteWarning(false);
    };

    // Componente para exibir mensagem citada (no input de resposta)
    const QuotedMessage: React.FC<{ message: Message; onClose: () => void }> = ({ message, onClose }) => (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r-lg flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-blue-700">{message.senderName}</p>
                <p className="text-sm text-gray-700 truncate">
                    {message.file?.url && !message.text ? 
                        (message.file.type === 'sticker' || message.file.type?.startsWith('image/') ? '🖼️ Imagem' : '📎 Anexo') 
                        : message.text || 'Mensagem'}
                </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0">
                <XCircleIcon className="w-5 h-5" />
            </button>
        </div>
    );

    const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
        const isMe = message.sender === 'me';
        const [timeLeft, setTimeLeft] = useState<number | null>(null);

        useEffect(() => {
            if (!isMe && message.sender_deleted_at) {
                const deletedAt = new Date(message.sender_deleted_at).getTime();
                const now = new Date().getTime();
                const diff = (deletedAt + 20 * 60 * 1000) - now;

                if (diff > 0) {
                    setTimeLeft(Math.floor(diff / 1000));
                    const timer = setInterval(() => {
                        setTimeLeft(prev => {
                            if (prev && prev > 0) return prev - 1;
                            clearInterval(timer);
                            return 0;
                        });
                    }, 1000);
                    return () => clearInterval(timer);
                } else {
                    setTimeLeft(0);
                }
            }
        }, [isMe, message.sender_deleted_at]);

        const formatTime = (seconds: number) => {
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            return `${m}:${s.toString().padStart(2, '0')}`;
        };

        if (!isMe && timeLeft === 0) return null;

        return (
            <div className={`flex items-start gap-3 group ${isMe ? 'flex-row-reverse' : ''}`}>
                <img src={message.avatarUrl} alt={message.senderName} className="w-8 h-8 rounded-full mt-1 object-cover" />
                <div className={`flex flex-col relative ${isMe ? 'items-end' : 'items-start'}`}>
                    {/* Balão informativo para o destinatário */}
                    {!isMe && message.sender_deleted_at && (
                        <div className="bg-red-50 text-red-600 text-[10px] font-bold px-3 py-1 rounded-full mb-1 border border-red-200 animate-pulse flex items-center gap-1 shadow-sm">
                            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                            {message.senderName} apagou esta mensagem para todos. Ela sumirá permanentemente em {timeLeft ? formatTime(timeLeft) : '...'}
                        </div>
                    )}

                    {/* Mostrar nome para outros usuários em grupos */}
                    {!isMe && selectedConversation?.isGroup && (
                        <span className="text-[10px] text-gray-500 ml-1 mb-0.5">{message.senderName}</span>
                    )}
                    
                    <div className="relative">
                        {/* Mensagem Respondida (Citada) */}
                        {message.replied_message && (
                            <div className={`text-xs p-2 rounded-t-lg max-w-xs sm:max-w-md border-l-4 mb-1 ${
                                isMe ? 'bg-blue-100 border-blue-400' : 'bg-green-100 border-green-400'
                            }`}>
                                <p className="font-semibold text-gray-700">{message.replied_message.senderName}</p>
                                <p className="truncate text-gray-600">
                                    {message.replied_message.file_url && !message.replied_message.text ?
                                        (message.replied_message.file_type === 'sticker' || message.replied_message.file_type?.startsWith('image/') ? 
                                            '🖼️ Imagem' : '📎 Anexo')
                                        : message.replied_message.text || 'Mensagem'}
                                </p>
                            </div>
                        )}
                        
                        <div className={`p-3 rounded-lg max-w-xs sm:max-w-md ${isMe ? 'bg-brand-primary text-white rounded-br-none' : 'bg-white text-brand-text rounded-bl-none'} ${message.replied_message ? 'rounded-t-none' : ''} shadow-md border premium-shadow ${!isMe && message.sender_deleted_at ? 'border-red-500 border-4 ring-2 ring-red-200' : 'border-gray-100'}`}>
                            {/* Check if text is a single image URL */}
                            {(() => {
                                const isImageUrl = (text: string) => {
                                    if (!text) return false;
                                    try {
                                        const url = new URL(text);
                                        return /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(url.pathname);
                                    } catch {
                                        return false;
                                    }
                                };

                                if (message.file?.type === 'nudge') {
                                    return (
                                        <div className="flex flex-col items-center justify-center py-2 px-4 gap-2">
                                            <BellIcon className={`w-12 h-12 ${isMe ? 'text-white' : 'text-orange-500'} animate-bounce`} />
                                            <p className={`font-black text-center text-sm italic uppercase tracking-tighter ${isMe ? 'text-white' : 'text-orange-600'}`}>
                                                {isMe ? 'Você chamou a atenção!' : 'Chamou sua atenção!'}
                                            </p>
                                        </div>
                                    );
                                }

                                if (isImageUrl(message.text) && !message.file) {
                                    return (
                                        <div className="rounded-lg overflow-hidden border bg-gray-50 bg-opacity-50">
                                            <img
                                                src={message.text}
                                                alt="Imagem enviada"
                                                className="max-w-full h-auto max-h-64 object-contain cursor-pointer transition-transform hover:scale-105"
                                                onClick={() => window.open(message.text)}
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                    e.currentTarget.parentElement?.classList.add('hidden');
                                                }}
                                            />
                                        </div>
                                    );
                                }
                                return <p className="text-sm break-words whitespace-pre-wrap">{message.text}</p>;
                            })()}

                            {message.file && (message.file.type?.startsWith('image/') || message.file.type === 'sticker') ? (
                                <div className="mt-2 rounded-lg overflow-hidden border bg-gray-50">
                                    <img src={message.file.url} alt="Anexo" className="max-w-full h-auto max-h-64 object-contain cursor-pointer" onClick={() => window.open(message.file?.url)} />
                                </div>
                            ) : message.file ? (
                                <div className="mt-2 p-2 bg-black/10 rounded-lg flex items-center gap-2 overflow-hidden">
                                    <PaperClipIcon className="w-4 h-4 shrink-0" />
                                    <a href={message.file.url} className="text-sm underline truncate" target="_blank" rel="noopener noreferrer">
                                        {message.file.name}
                                    </a>
                                </div>
                            ) : null}
                        </div>
                        <div className={`absolute top-0 -mt-8 flex items-center bg-white shadow-lg rounded-full border border-gray-100 transition-all duration-300 opacity-0 group-hover:opacity-100 z-50 ${isMe ? 'right-0' : 'left-0'}`}>
                            <div className="flex items-center p-1 space-x-0.5">
                                {availableReactions.map(emoji => (
                                    <button
                                        key={emoji}
                                        onClick={() => handleReact(message.id as string, emoji)}
                                        className="p-1 px-1.5 text-lg hover:scale-125 transition-transform hover:bg-gray-100 rounded-full"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                                <div className="w-px h-4 bg-gray-200 mx-1"></div>
                                <button
                                    onClick={() => setReplyingToMessage(message)}
                                    className="p-1.5 text-gray-400 hover:text-brand-primary hover:bg-gray-100 rounded-full transition-colors"
                                    title="Responder"
                                >
                                    <ArrowUturnLeftIcon className="w-4 h-4" />
                                </button>
                                {isMe && (
                                    <button
                                        onClick={() => handleDeleteMessage(message.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-full transition-colors"
                                        title="Apagar para mim"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-between items-center w-full">
                        <div className={`flex gap-1 mt-1 ${isMe ? 'order-2' : ''}`}>
                            {message.reactions.length > 0 && message.reactions.map((r, i) => (<span key={i} className="text-xs bg-gray-200 px-1.5 py-0.5 rounded-full cursor-pointer" title={r.user}>{r.emoji}</span>))}
                        </div>
                        <span className={`text-xs text-gray-400 mt-1 ${isMe ? 'mr-2' : 'ml-1'}`}>{message.timestamp}</span>
                    </div>
                </div>
            </div>
        );
    };

    if (!currentUser) return <div className="flex items-center justify-center h-full">Carregando...</div>;

    return (
        <div className="flex h-full bg-white overflow-hidden">
            {/* Left Sidebar: Conversations/Contacts/Teams */}
            <div className={`w-full md:w-80 lg:w-96 bg-white border-r flex flex-col shrink-0 ${selectedConversationId !== null ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b">
                    <div className="flex bg-gray-100 rounded-md p-1">
                        <button onClick={() => setActiveTab('conversations')} className={`flex-1 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors ${activeTab === 'conversations' ? 'bg-white text-brand-primary shadow' : 'text-gray-500'}`}>Chat</button>
                        <button onClick={() => setActiveTab('contacts')} className={`flex-1 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors ${activeTab === 'contacts' ? 'bg-white text-brand-primary shadow' : 'text-gray-500'}`}>Contatos</button>
                        <button onClick={() => setActiveTab('teams')} className={`flex-1 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors ${activeTab === 'teams' ? 'bg-white text-brand-primary shadow' : 'text-gray-500'}`}>Equipes</button>
                    </div>
                </div>
                
                {/* Suporte VIP para Admins */}
                {(currentUser.isCompanyAdmin || currentUser.isAdmin || currentUser.role === 'Super Admin' || currentUser.role === 'admin') && 
                 currentUser.id !== MASTER_ADMIN_ID && currentUser.email !== 'ti@grupopixel.com.br' && (
                    <div className="px-4 py-3 bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-100 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-150 duration-500" />
                        <button 
                            onClick={() => handleStartConversation(MASTER_ADMIN_ID)}
                            className="w-full flex items-center justify-center gap-3 bg-red-600 text-white py-2.5 rounded-xl text-xs font-black hover:bg-red-700 transition-all shadow-lg active:scale-95 group-hover:shadow-red-200"
                        >
                            <SparklesIcon className="w-5 h-5 animate-pulse" />
                            SOLICITAR SUPORTE MASTER ADMIN
                        </button>
                    </div>
                )}

                <div className="overflow-y-auto flex-1">
                    {activeTab === 'conversations' && (
                        <ul>
                            {conversations.length === 0 && (
                                <div className="p-4 text-center text-sm text-gray-500">
                                    Nenhuma conversa. Vá em "Contatos" para iniciar uma.
                                </div>
                            )}
                            {conversations.filter(c => {
                                const shouldShow = !c.isGroup && c.is_closed !== true;
                                if (c.participantName === 'Master Admin') {
                                    console.log('Filtrando Master Admin:', { id: c.id, is_closed: c.is_closed, shouldShow });
                                }
                                return shouldShow;
                            }).map(conv => {
                                // Online status logic would require presence tracking (realtime), omitted for basic scope
                                return (
                                    <li key={conv.id} onClick={() => handleSelectConversation(conv.id)}>
                                        <div className={`p-4 flex items-center space-x-3 cursor-pointer border-l-4 premium-card ${selectedConversationId === conv.id ? 'bg-emerald-50 border-brand-primary' : 'border-transparent hover:bg-gray-50'}`}>
                                            <div className="relative">
                                                <img
                                                    src={conv.participantAvatarUrl}
                                                    alt={conv.participantName}
                                                    className={`w-10 h-10 rounded-full border-2 transition-colors ${conv.participantId && onlineUsers.has(conv.participantId)
                                                        ? 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                                                        : 'border-gray-300'
                                                        }`}
                                                />
                                                {conv.participantId && onlineUsers.has(conv.participantId) && (
                                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                                                )}
                                                {conv.unreadCount > 0 && <span className="absolute -top-1 -right-1 flex items-center justify-center h-5 w-5 bg-red-500 text-white text-xs rounded-full">{conv.unreadCount}</span>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center">
                                                    <p className="text-sm font-semibold text-brand-text truncate">{conv.participantName}</p>
                                                    <p className="text-xs text-gray-400">{conv.lastMessageTimestamp}</p>
                                                </div>
                                                <p className="text-sm text-brand-subtle-text truncate">{conv.lastMessage}</p>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {activeTab === 'contacts' && (
                        <ul> {companyEmployees.filter(e => e.id !== currentUser.id).map(emp => (
                            <li key={emp.id} onClick={() => handleStartConversation(emp.id)} className="p-4 flex items-center space-x-4 cursor-pointer hover:bg-gray-50">
                                <div className="relative">
                                    <img
                                        src={emp.avatarUrl}
                                        alt={emp.name}
                                        className={`w-10 h-10 rounded-full border-2 transition-colors ${onlineUsers.has(emp.id)
                                            ? 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                                            : 'border-gray-300'
                                            }`}
                                    />
                                    {onlineUsers.has(emp.id) && (
                                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-brand-text truncate">{emp.name}</p>
                                    <p className="text-sm text-brand-subtle-text truncate">{emp.role}</p>
                                </div>
                            </li>
                        ))} </ul>
                    )}
                    {activeTab === 'teams' && (
                        <ul>
                            {conversations.filter(c => c.isGroup).length === 0 && (
                                <li className="p-4 text-center text-sm text-gray-400">
                                    Nenhuma equipe encontrada.
                                </li>
                            )}
                            {conversations.filter(c => c.isGroup && c.is_closed !== true).map(conv => (
                                <li key={conv.id} onClick={() => handleSelectConversation(conv.id)}>
                                    <div className={`p-4 flex items-center space-x-3 cursor-pointer border-l-4 ${selectedConversationId === conv.id ? 'bg-emerald-50 border-brand-primary' : 'border-transparent hover:bg-gray-50'}`}>
                                        <div className="relative">
                                            <img src={conv.participantAvatarUrl} alt={conv.participantName} className="w-10 h-10 rounded-full border-2 border-gray-400" />
                                            {conv.unreadCount > 0 && <span className="absolute -top-1 -right-1 flex items-center justify-center h-5 w-5 bg-red-500 text-white text-xs rounded-full">{conv.unreadCount}</span>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center">
                                                <p className="text-sm font-semibold text-brand-text truncate">{conv.participantName}</p>
                                                <p className="text-xs text-gray-400">{conv.lastMessageTimestamp}</p>
                                            </div>
                                            <p className="text-sm text-brand-subtle-text truncate">{conv.lastMessage}</p>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* Right Main Content */}
            <div className={`flex-1 flex flex-col relative ${!selectedConversationId ? 'hidden md:flex' : 'flex'}`}>
                {/* Background Image Layer */}
                <div
                    className="absolute inset-0 z-0 opacity-10 pointer-events-none"
                    style={{
                        backgroundImage: `url('/backgrounds/message-bg.jpg')`,
                        backgroundRepeat: 'repeat',
                        backgroundSize: '400px', // Adjust size as needed
                        backgroundPosition: 'center'
                    }}
                />

                {selectedConversationId ? (
                    <>
                        {/* Header */}
                        <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center shadow-sm z-10 relative">
                            <div className="flex items-center space-x-3">
                                <button onClick={() => setSelectedConversationId(null)} className="md:hidden -ml-2 mr-2 p-2 text-gray-500 rounded-full hover:bg-gray-100">
                                    <ChevronLeftIcon className="w-6 h-6" />
                                </button>
                                <img src={selectedConversation?.participantAvatarUrl} alt={selectedConversation?.participantName} className="w-10 h-10 rounded-full object-cover" />
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-brand-text">{selectedConversation?.participantName}</p>
                                        {selectedConversation?.is_closed && (
                                            <span className="bg-red-100 text-red-600 text-[10px] uppercase font-black px-2 py-0.5 rounded-full border border-red-200">Encerrado</span>
                                        )}
                                    </div>
                                    <p className="text-xs font-medium">
                                        {selectedConversation?.participantId && onlineUsers.has(selectedConversation.participantId)
                                            ? <span className="text-emerald-500 flex items-center gap-1">● Online</span>
                                            : <span className="text-gray-400 flex items-center gap-1">○ Offline</span>
                                        }
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                {(currentUser.id === MASTER_ADMIN_ID || selectedConversation?.participantId === MASTER_ADMIN_ID) && !selectedConversation?.is_closed && (
                                    <button 
                                        onClick={handleCloseConversation}
                                        className="flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-600 transition-all border border-slate-200 hover:border-red-200"
                                    >
                                        <LockClosedIcon className="w-4 h-4" />
                                        <span className="hidden sm:inline">ENCERRAR SUPORTE</span>
                                        <span className="sm:hidden">FECHAR</span>
                                    </button>
                                )}
                                {selectedConversation?.isGroup && (
                                    <div className="flex items-center space-x-1">
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowStickerPicker(!showStickerPicker)}
                                                className="p-2 text-gray-500 hover:text-brand-primary rounded-full hover:bg-gray-100 transition-colors"
                                                title="Figurinhas e GIFs"
                                            >
                                                <FaceSmileIcon className="w-5 h-5" />
                                            </button>
                                            {showStickerPicker && (
                                                <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-xl border p-3 z-50 animate-in fade-in slide-in-from-bottom-2 w-64 lg:w-80">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Figurinhas</h4>
                                                        <button onClick={() => setShowStickerPicker(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
                                                    </div>
                                                    <div className="grid grid-cols-4 gap-2">
                                                        {customStickers.map((url, i) => (
                                                            <div key={i} className="relative group aspect-square">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSendSticker(url)}
                                                                    className="w-full h-full hover:scale-110 transition-transform p-1 rounded hover:bg-gray-50 flex items-center justify-center overflow-hidden"
                                                                >
                                                                    <img src={url} alt="Sticker" className="max-w-full max-h-full object-contain" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); removeSticker(url); }}
                                                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                >
                                                                    <XMarkIcon className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <div className="flex flex-col gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={handleAddManualGif}
                                                                className="border-2 border-dashed border-gray-200 rounded-lg p-1 flex items-center justify-center hover:bg-gray-50 hover:border-brand-primary transition-colors aspect-square"
                                                                title="Adicionar por Link"
                                                            >
                                                                <PlusIcon className="w-5 h-5 text-gray-400" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => stickerUploadRefHeader.current?.click()}
                                                                className="border-2 border-dashed border-gray-200 rounded-lg p-1 flex items-center justify-center hover:bg-gray-50 hover:border-brand-primary transition-colors aspect-square"
                                                                title="Subir GIF"
                                                            >
                                                                <PaperClipIcon className="w-5 h-5 text-gray-400" />
                                                            </button>
                                                            <input type="file" ref={stickerUploadRefHeader} hidden accept="image/gif,image/png,image/jpeg" onChange={handleUploadGif} />
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 pt-3 border-t">
                                                        <p className="text-[10px] text-gray-400 text-center">Integração com GIPHY em breve</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <button className="p-2 text-gray-500 hover:text-brand-primary rounded-full hover:bg-gray-100 transition-colors">
                                            <PaperClipIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div 
                            className="flex-1 p-4 md:p-6 space-y-6 overflow-y-auto scrollbar-hide hover-scrollbar"
                            onScroll={(e) => {
                                const target = e.currentTarget;
                                // Detectar se chegou no topo (com margem de 100px)
                                if (target.scrollTop < 100 && hasMoreMessages && !loadingOlderMessages) {
                                    loadOlderMessages();
                                }
                            }}
                        >
                            {/* Indicador de carregamento de mensagens antigas */}
                            {loadingOlderMessages && (
                                <div className="text-center py-2">
                                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-brand-primary"></div>
                                    <p className="text-xs text-gray-500 mt-1">Carregando mensagens antigas...</p>
                                </div>
                            )}
                            {hasMoreMessages && !loadingOlderMessages && (
                                <div className="text-center py-2">
                                    <button 
                                        onClick={loadOlderMessages}
                                        className="text-xs text-brand-primary hover:underline"
                                    >
                                        ↑ Carregar mensagens antigas
                                    </button>
                                </div>
                            )}
                            {messages.map(msg => (<MessageBubble key={msg.id} message={msg} />))}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="p-4 bg-white border-t border-gray-100 z-10 relative shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)]">
                            {selectedConversation?.is_closed ? (
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-center animate-pulse">
                                    <p className="text-sm font-bold text-gray-500 flex items-center justify-center gap-2">
                                        <LockClosedIcon className="w-4 h-4" />
                                        ESTE CHAT DE SUPORTE FOI ENCERRADO
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">Abra um novo chamado se precisar de mais ajuda.</p>
                                </div>
                            ) : (
                                <>
                                    {replyingToMessage && (
                                        <QuotedMessage 
                                            message={replyingToMessage} 
                                            onClose={() => setReplyingToMessage(null)} 
                                        />
                                    )}
                                    {attachedFile && (<div className="mb-2 p-2 bg-gray-100 rounded-lg text-sm"> <div className="flex justify-between items-center"> <p className="text-gray-600">Anexo: {attachedFile.name}</p> <button onClick={() => setAttachedFile(null)}> <XCircleIcon className="w-5 h-5 text-gray-500 hover:text-red-500" /> </button> </div> </div>)}
                                    <form onSubmit={handleSendMessage} className="relative flex items-center space-x-3">
                                        {showEmojiPicker && (
                                                <div className="absolute bottom-14 left-0 bg-white border rounded-lg shadow-lg p-2 flex flex-wrap w-64 max-h-60 overflow-y-auto z-40">
                                                {availableEmojis.map(emoji => (
                                                    <button key={emoji} type="button" onClick={() => setNewMessageText(prev => prev + emoji)} className="text-2xl p-1 hover:bg-gray-200 rounded-md">
                                                        {emoji}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        <button type="button" onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowStickerPicker(false); }} className="p-2 text-gray-500 hover:text-brand-primary">
                                            <FaceSmileIcon className="w-6 h-6" />
                                        </button>
                                        <button type="button" onClick={() => { setShowStickerPicker(!showStickerPicker); setShowEmojiPicker(false); }} title="Stickers e GIFs" className="p-2 text-gray-500 hover:text-brand-primary">
                                            <SparklesIcon className="w-6 h-6" />
                                        </button>
                                        <input type="file" ref={fileInputRef} onChange={handleFileAttach} className="hidden" />
                                        <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 hover:text-brand-primary">
                                            <PaperClipIcon className="w-6 h-6" />
                                        </button>

                                            {/* Nudge Button */}
                                            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
                                                <button
                                                    type="button"
                                                    onClick={handleSendNudge}
                                                    disabled={!!cooldownTimeouts[selectedConversationId || '']}
                                                    className={`p-2 rounded-full transition-all relative flex items-center justify-center w-full h-full ${cooldownTimeouts[selectedConversationId || '']
                                                            ? 'text-gray-400 cursor-not-allowed'
                                                            : 'text-orange-500 hover:text-orange-600 hover:bg-orange-50 active:scale-95'
                                                        }`}
                                                    title="Chamar Atenção (MSN Nudge)"
                                                >
                                                    <BellIcon className={`w-6 h-6 ${cooldownTimeouts[selectedConversationId || ''] ? '' : 'animate-bounce'
                                                        }`} />
                                                    {cooldownTimeouts[selectedConversationId || ''] && (
                                                        <span className="absolute -top-1 -right-2 bg-orange-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold shadow-sm whitespace-nowrap min-w-[28px] text-center border border-white">
                                                            {Math.floor(cooldownTimeouts[selectedConversationId || ''] / 60)}:{(cooldownTimeouts[selectedConversationId || ''] % 60).toString().padStart(2, '0')}
                                                        </span>
                                                    )}
                                                </button>
                                            </div>
                                        <input
                                            type="text"
                                            value={newMessageText}
                                            onChange={(e) => setNewMessageText(e.target.value)}
                                            onPaste={handlePaste}
                                            placeholder="Digite uma mensagem..."
                                            className="flex-1 w-full px-4 py-2 bg-gray-100 border border-transparent rounded-full focus:outline-none focus:ring-2 focus:ring-brand-primary h-10"
                                        />
                                        <button type="submit" className="p-2 bg-brand-primary text-white rounded-full hover:bg-emerald-600 disabled:bg-emerald-300" disabled={(!newMessageText.trim() && !attachedFile)}>
                                            <PaperAirplaneIcon className="w-6 h-6" />
                                        </button>
                                        {showStickerPicker && (
                                            <div className="absolute bottom-14 left-0 bg-white border rounded-lg shadow-lg p-3 w-72 z-50 animate-fade-in-up">
                                                <div className="flex justify-between items-center mb-3">
                                                    <h4 className="font-bold text-sm text-gray-600">Stickers e GIFs</h4>
                                                    <button onClick={() => setShowStickerPicker(false)}><XMarkIcon className="w-4 h-4 text-gray-400" /></button>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                                    {customStickers.map((url, i) => (
                                                        <div key={i} className="relative group aspect-square">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSendSticker(url)}
                                                                className="w-full h-full hover:scale-110 transition-transform bg-gray-50 rounded-lg p-1 flex items-center justify-center overflow-hidden"
                                                            >
                                                                <img src={url} alt="sticker" className="max-w-full max-h-full object-contain" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); removeSticker(url); }}
                                                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                <XMarkIcon className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <div className="flex flex-col gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={handleAddManualGif}
                                                            className="border-2 border-dashed border-gray-200 rounded-lg p-1 flex items-center justify-center hover:bg-gray-50 hover:border-brand-primary transition-colors h-10 w-full"
                                                            title="Adicionar por Link"
                                                        >
                                                            <PlusIcon className="w-4 h-4 text-gray-400 mr-1" />
                                                            <span className="text-[10px] text-gray-400">Lin</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => stickerUploadRefInput.current?.click()}
                                                            className="border-2 border-dashed border-gray-200 rounded-lg p-1 flex items-center justify-center hover:bg-gray-50 hover:border-brand-primary transition-colors h-10 w-full"
                                                            title="Subir GIF"
                                                        >
                                                            <PaperClipIcon className="w-4 h-4 text-gray-400 mr-1" />
                                                            <span className="text-[10px] text-gray-400">Up</span>
                                                        </button>
                                                        <input type="file" ref={stickerUploadRefInput} hidden accept="image/gif,image/png,image/jpeg" onChange={handleUploadGif} />
                                                    </div>
                                                </div>
                                                <p className="text-[10px] text-gray-400 mt-3 text-center">Mais itens em breve!</p>
                                            </div>
                                        )}
                                    </form>
                                </>
                            )}
                        </div>
                    </>
                ) : (<div className="flex-1 flex-col items-center justify-center text-gray-500 hidden md:flex"> <p className="text-lg">Selecione uma conversa</p><p className="text-sm">Escolha uma pessoa da lista para ver as mensagens.</p> </div>)}
            </div>

            {/* Right Sidebar: Sticky Notes (Local Only) */}
            <div className="hidden lg:flex flex-col w-72 bg-gray-50 border-l p-4 overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                        <span className="text-xl">📝</span> Notas Rápidas
                    </h3>
                    {notes.length > 0 && (
                        <button onClick={() => setNotes([])} className="text-[10px] text-red-500 hover:underline uppercase font-bold">Limpar</button>
                    )}
                </div>

                {noteWarning && (
                    <div className="mb-4 p-3 bg-orange-100 border-l-4 border-orange-500 text-orange-700 text-xs rounded animate-pulse">
                        <p className="font-bold">Aviso!</p>
                        <p>Criar mais uma nota excluirá a mais antiga.</p>
                    </div>
                )}

                <div className="space-y-3 mb-4 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                    {notes.map((note) => {
                        const color = NOTE_COLORS.find(c => c.id === note.colorId) || NOTE_COLORS[0];
                        return (
                            <div key={note.id} className={`p-3 relative rounded-lg shadow-sm ${color.bg} ${color.border} border group animate-fade-in-up transition-all hover:scale-102`}>
                                <button onClick={() => handleDeleteNote(note.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-500 transition-opacity">
                                    <XCircleIcon className="w-4 h-4" />
                                </button>
                                <p className="text-sm text-gray-800 whitespace-pre-wrap font-handwriting leading-snug">{note.text}</p>
                            </div>
                        );
                    })}
                    {notes.length === 0 && (
                        <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                            <p className="text-sm">Nenhuma nota ainda.</p>
                        </div>
                    )}
                </div>

                <div className="mt-auto">
                    <textarea
                        value={newNoteText}
                        onChange={(e) => {
                            setNewNoteText(e.target.value);
                            if (noteWarning && notes.length < 6) setNoteWarning(false);
                        }}
                        placeholder="Nova nota..."
                        className="w-full p-2 border rounded-md text-sm mb-2 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAddNote();
                            }
                        }}
                    />
                    <button
                        onClick={handleAddNote}
                        disabled={!newNoteText.trim()}
                        className="w-full py-2 bg-brand-primary text-white rounded-md hover:bg-emerald-600 disabled:opacity-50 text-sm font-medium"
                    >
                        {noteWarning ? 'Adicionar e Substituir' : 'Adicionar Nota'}
                    </button>
                    <p className="text-[10px] text-center text-gray-400 mt-2">
                        {notes.length}/6 notas • FIFO ativado
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Messages;