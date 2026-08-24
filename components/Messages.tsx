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
} from './icons';
import type { Conversation, Message, Employee } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';

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
    '🥴', '🤢', '🤮', 'sneezing_face', 'mask', 'thermometer', 'head_bandage',
    'poop', 'clown_face', 'ogre', 'goblin', 'ghost', 'alien', 'space_invader', 'robot',
    'jack_o_lantern', 'smiley_cat', 'smile_cat', 'joy_cat', 'heart_eyes_cat', 'smirk_cat',
    'kissing_cat', 'scream_cat', 'crying_cat_face', 'pouting_cat', 'open_hands', 'raised_hands',
    'clap', '👍', '👎', '👊', '✊', '🤛', '🤜',
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
}

interface MessagesProps {
    // No props needed now
}

const Messages: React.FC<MessagesProps> = () => {
    const { profile: currentUser } = useAuth();
    const { addNotification } = useNotifications();
    const [companyEmployees, setCompanyEmployees] = useState<Employee[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null); // Alterado para string (UUID)
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessageText, setNewMessageText] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showStickerPicker, setShowStickerPicker] = useState(false);
    const [stickerTab, setStickerTab] = useState<'gallery' | 'saved'>('gallery');
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
    const [activeTab, setActiveTab] = useState<'conversations' | 'contacts' | 'teams'>('conversations');
    const [typingStatus, setTypingStatus] = useState<Record<string, boolean>>({}); // Changed key to string
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [loading, setLoading] = useState(false);

    // Sticky Notes State (Local Storage)
    const [notes, setNotes] = useState<Note[]>(() => {
        const saved = localStorage.getItem('sticky_notes');
        return saved ? JSON.parse(saved) : [];
    });
    const [newNoteText, setNewNoteText] = useState('');
    const [noteWarning, setNoteWarning] = useState(false);

    const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
    const stickerTimeoutRef = useRef<any>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const typingTimeoutRef = useRef<any>(null);

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

    const stickers = [
        'https://fonts.gstatic.com/s/e/notoemoji/latest/1f600/512.gif',
        'https://fonts.gstatic.com/s/e/notoemoji/latest/1f60d/512.gif',
        'https://fonts.gstatic.com/s/e/notoemoji/latest/1f44d/512.gif',
        'https://fonts.gstatic.com/s/e/notoemoji/latest/1f389/512.gif',
        'https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif'
    ];

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
    useEffect(() => {
        const fetchEmployees = async () => {
            if (!currentUser?.company_id) return;

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('company_id', currentUser.company_id); // Filter by company

            if (data) {
                // Map Supabase profile to Employee type
                const employees: Employee[] = data.map(p => ({
                    id: p.id,
                    name: p.full_name,
                    email: p.email || '',
                    role: p.role,
                    team: p.team,
                    avatarUrl: p.avatar_url || `https://i.pravatar.cc/150?u=${p.email}`,
                    joinDate: p.join_date,
                    birthDate: p.birth_date,
                    isAdmin: p.is_admin,
                    isOnline: false,
                    permissions: p.permissions || {},
                    following: p.following || [],
                    phone: p.phone,
                    officeLocation: p.office_location,
                    bio: p.bio,
                    company_id: p.company_id,
                    sectorManager: p.sector_manager,
                    employeeManager: p.employee_manager,
                    coverUrl: p.cover_url
                }));
                setCompanyEmployees(employees);
            }
        };

        if (currentUser) {
            fetchEmployees();
        }
    }, [currentUser]);

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

            // 3. Buscar OUTROS participantes para cada conversa (para exibir nome/foto)
            const fullConversations = await Promise.all(convData.map(async (conv: any) => {
                const { data: participants, error: ppError } = await supabase
                    .from('conversation_participants')
                    .select('user_id, profiles(full_name, avatar_url)')
                    .eq('conversation_id', conv.id);

                // Encontrar o "outro" usuário (que não seja eu) para mostrar o nome
                const otherPart = participants?.find((p: any) => p.user_id !== currentUser.id);
                // Fallback para conversas antigas ou self-chat
                const otherUser = otherPart ? (otherPart.profiles as any) : null;

                // Se não achar outro, talvez seja eu mesmo ou dados perdidos
                const displayName = conv.is_group
                    ? conv.group_name
                    : (otherUser?.full_name || 'Usuário Desconhecido');

                const displayAvatar = conv.is_group
                    ? `https://ui-avatars.com/api/?name=${displayName}&background=random`
                    : (otherUser?.avatar_url || 'https://via.placeholder.com/150');

                return {
                    id: conv.id,
                    participantName: displayName,
                    participantAvatarUrl: displayAvatar,
                    lastMessage: conv.last_message || 'Inicie a conversa',
                    unreadCount: 0, // TODO: Implementar contagem de não lidos
                    messages: [], // Buscamos mensagens apenas ao selecionar
                    isGroup: conv.is_group,
                    groupName: conv.group_name,
                    admins: [],
                    lastMessageTimestamp: conv.last_message_at ? new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
                };
            }));

            setConversations(fullConversations);

        } catch (error) {
            console.error('Erro ao buscar conversas:', error);
        }
    };

    // Busca inicial
    useEffect(() => {
        fetchConversations();

        // Subscrição para atualizações de novas conversas/mensagens
        const channel = supabase
            .channel('public:conversations')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => fetchConversations())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
                fetchConversations(); // Atualiza última mensagem na lista
                if (selectedConversationId) fetchMessages(selectedConversationId); // Atualiza visão do Chat
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        }
    }, [currentUser.id]); // Re-executa se usuário mudar (raro)

    // Buscar Mensagens quando conversa selecionada
    const fetchMessages = async (convId: string) => {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select(`
                    id, text, created_at, sender_id, file_url, file_type, reactions,
                    profiles:sender_id(full_name, avatar_url)
                `)
                .eq('conversation_id', convId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            const formattedMessages: Message[] = data.map((m: any) => ({
                id: m.id, // UUID
                sender: m.sender_id === currentUser.id ? 'me' : 'other',
                senderName: (m.profiles as any)?.full_name || 'Desconhecido',
                avatarUrl: (m.profiles as any)?.avatar_url || 'https://via.placeholder.com/150',
                text: m.text,
                timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                reactions: m.reactions ? (m.reactions as any[]).map((r: any) => ({ emoji: r.emoji, user: r.user })) : [],
                file: m.file_url ? { name: 'Anexo', url: m.file_url } : undefined,
                // replyingTo: support needs a column or parsing payload
            }));

            setMessages(formattedMessages);

            // Atualiza estado local para feedback imediato na UI
            setConversations(prev => prev.map(c => c.id === convId ? { ...c, messages: formattedMessages } : c));

        } catch (error) {
            console.error('Erro ao buscar mensagens:', error);
        }
    };

    useEffect(() => {
        if (selectedConversationId) {
            fetchMessages(selectedConversationId);
        }
    }, [selectedConversationId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

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

            const { data: profileData } = await supabase.from('profiles').select('company_id').eq('id', currentUser.id).single();

            const { error } = await supabase.from('messages').insert({
                conversation_id: selectedConversationId,
                sender_id: currentUser.id,
                company_id: profileData?.company_id,
                text: stickerUrl || textToSend,
                file_url: uploadedFileUrl || stickerUrl,
                file_type: stickerUrl ? 'sticker' : fileType,
                reactions: []
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
        setActiveTab('conversations'); // Retorna para lista no mobile se necessário
    };

    const handleStartConversation = async (contactId: string) => {
        try {
            setLoading(true);
            // 1. Verificar se já existe uma conversa 1:1 entre esses usuários
            // Buscamos conversas onde AMBOS participam
            const { data: participations, error: partError } = await supabase
                .from('conversation_participants')
                .select('conversation_id')
                .eq('user_id', currentUser.id);

            if (partError) throw partError;

            const myConvIds = participations.map(p => p.conversation_id);

            if (myConvIds.length > 0) {
                const { data: commonPart, error: commonError } = await supabase
                    .from('conversation_participants')
                    .select('conversation_id')
                    .in('conversation_id', myConvIds)
                    .eq('user_id', contactId)
                    .single();

                // If found, just select it
                if (commonPart) {
                    setSelectedConversationId(commonPart.conversation_id);
                    setActiveTab('conversations');
                    setLoading(false);
                    return;
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

    // Lógica de Notas Adesivas
    const handleAddNote = () => {
        if (!newNoteText.trim()) return;

        if (notes.length >= 6) {
            if (!noteWarning) {
                setNoteWarning(true);
                return;
            }
            // FIFO: Remove a primeira, adiciona a nova
            const newNote: Note = { id: Date.now(), text: newNoteText, colorId: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)].id };
            setNotes(prev => [...prev.slice(1), newNote]);
            setNoteWarning(false);
        } else {
            const newNote: Note = { id: Date.now(), text: newNoteText, colorId: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)].id };
            setNotes(prev => [...prev, newNote]);
        }
        setNewNoteText('');
    };

    const handleDeleteNote = (id: number) => {
        setNotes(notes.filter(n => n.id !== id));
        setNoteWarning(false);
    };

    const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
        const isMe = message.sender === 'me';
        return (
            <div className={`flex items-start gap-3 group ${isMe ? 'flex-row-reverse' : ''}`}>
                <img src={message.avatarUrl} alt={message.senderName} className="w-8 h-8 rounded-full mt-1 object-cover" />
                <div className={`flex flex-col relative ${isMe ? 'items-end' : 'items-start'}`}>
                    {/* Mostrar nome para outros usuários em grupos */}
                    {!isMe && selectedConversation?.isGroup && (
                        <span className="text-[10px] text-gray-500 ml-1 mb-0.5">{message.senderName}</span>
                    )}
                    <div className="relative">
                        {message.replyingTo && (
                            <div className={`text-xs p-2 rounded-t-lg max-w-xs sm:max-w-md text-gray-500 border-l-2 border-green-400 ${isMe ? 'bg-emerald-100' : 'bg-gray-200'}`}>
                                <p className="font-semibold">{message.replyingTo.senderName}</p>
                                <p className="truncate">{message.replyingTo.text}</p>
                            </div>
                        )}
                        <div className={`p-3 rounded-lg max-w-xs sm:max-w-md ${isMe ? 'bg-brand-primary text-white rounded-br-none' : 'bg-white text-brand-text rounded-bl-none'} ${message.replyingTo ? 'rounded-t-none' : ''} shadow-sm border border-gray-100`}>
                            <p className="text-sm break-words whitespace-pre-wrap">{message.text}</p>
                            {message.file && (
                                <div className="mt-2 p-2 bg-black/10 rounded-lg flex items-center gap-2 overflow-hidden">
                                    <PaperClipIcon className="w-4 h-4 shrink-0" />
                                    <a href={message.file.url} className="text-sm underline truncate" target="_blank" rel="noopener noreferrer">
                                        {message.file.name}
                                    </a>
                                </div>
                            )}
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
                                >
                                    <ArrowUturnLeftIcon className="w-4 h-4" />
                                </button>
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
        <div className="flex h-[calc(100vh-4rem)] bg-white overflow-hidden">
            {/* Left Sidebar: Conversations/Contacts/Teams */}
            <div className={`w-full md:w-80 lg:w-96 bg-white border-r flex flex-col shrink-0 ${selectedConversationId !== null ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b">
                    <div className="flex bg-gray-100 rounded-md p-1">
                        <button onClick={() => setActiveTab('conversations')} className={`flex-1 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors ${activeTab === 'conversations' ? 'bg-white text-brand-primary shadow' : 'text-gray-500'}`}>Chat</button>
                        <button onClick={() => setActiveTab('contacts')} className={`flex-1 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors ${activeTab === 'contacts' ? 'bg-white text-brand-primary shadow' : 'text-gray-500'}`}>Contatos</button>
                        <button onClick={() => setActiveTab('teams')} className={`flex-1 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors ${activeTab === 'teams' ? 'bg-white text-brand-primary shadow' : 'text-gray-500'}`}>Equipes</button>
                    </div>
                </div>
                <div className="overflow-y-auto flex-1">
                    {activeTab === 'conversations' && (
                        <ul>
                            {conversations.length === 0 && (
                                <div className="p-4 text-center text-sm text-gray-500">
                                    Nenhuma conversa. Vá em "Contatos" para iniciar uma.
                                </div>
                            )}
                            {conversations.filter(c => !c.isGroup).map(conv => {
                                // Online status logic would require presence tracking (realtime), omitted for basic scope
                                return (
                                    <li key={conv.id} onClick={() => handleSelectConversation(conv.id)}>
                                        <div className={`p-4 flex items-center space-x-3 cursor-pointer border-l-4 ${selectedConversationId === conv.id ? 'bg-emerald-50 border-brand-primary' : 'border-transparent hover:bg-gray-50'}`}>
                                            <div className="relative">
                                                <img src={conv.participantAvatarUrl} alt={conv.participantName} className={`w-10 h-10 rounded-full border-2 border-gray-400`} />
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
                                <img src={emp.avatarUrl} alt={emp.name} className={`w-10 h-10 rounded-full border-2 border-gray-400`} />
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
                            {conversations.filter(c => c.isGroup).map(conv => (
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
                                <img src={selectedConversation.participantAvatarUrl} alt={selectedConversation.participantName} className="w-10 h-10 rounded-full object-cover" />
                                <div>
                                    <p className="font-bold text-brand-text">{selectedConversation.participantName}</p>
                                    {/* Online/Typing status removed for MVP as it requires Realtime Presence */}
                                    <p className="text-xs text-gray-500">Online</p>
                                </div>
                            </div>
                            {selectedConversation.isGroup && (
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
                                                    {stickers.map((url, i) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => handleSendSticker(url)}
                                                            className="hover:scale-110 transition-transform p-1 rounded hover:bg-gray-50"
                                                        >
                                                            <img src={url} alt="Sticker" className="w-full h-auto" />
                                                        </button>
                                                    ))}
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
                        <div className="flex-1 p-4 md:p-6 space-y-6 overflow-y-auto">
                            {messages.map(msg => (<MessageBubble key={msg.id} message={msg} />))}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="p-4 bg-white border-t">
                            {replyingToMessage && (<div className="mb-2 p-2 bg-gray-100 rounded-lg text-sm"> <div className="flex justify-between items-center"> <div> <p className="font-semibold text-brand-primary">Respondendo a {replyingToMessage.senderName}</p> <p className="text-gray-600 truncate">{replyingToMessage.text}</p> </div> <button onClick={() => setReplyingToMessage(null)}> <XCircleIcon className="w-5 h-5 text-gray-500 hover:text-red-500" /> </button> </div> </div>)}
                            {attachedFile && (<div className="mb-2 p-2 bg-gray-100 rounded-lg text-sm"> <div className="flex justify-between items-center"> <p className="text-gray-600">Anexo: {attachedFile.name}</p> <button onClick={() => setAttachedFile(null)}> <XCircleIcon className="w-5 h-5 text-gray-500 hover:text-red-500" /> </button> </div> </div>)}
                            <form onSubmit={handleSendMessage} className="relative flex items-center space-x-3">
                                {showEmojiPicker && (
                                    <div className="absolute bottom-14 left-0 bg-white border rounded-lg shadow-lg p-2 flex flex-wrap w-64 max-h-60 overflow-y-auto z-50">
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
                                <input type="file" ref={fileInputRef} onChange={handleFileAttach} className="hidden" />
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 hover:text-brand-primary">
                                    <PaperClipIcon className="w-6 h-6" />
                                </button>
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
                            </form>
                        </div>
                    </>
                ) : (<div className="flex-1 flex-col items-center justify-center text-gray-500 hidden md:flex"> <p className="text-lg">Selecione uma conversa</p><p className="text-sm">Escolha uma pessoa da lista para ver as mensagens.</p> </div>)}
            </div>

            {/* Right Sidebar: Sticky Notes (Local Only) */}
            <div className="hidden lg:flex flex-col w-72 bg-gray-50 border-l p-4 overflow-hidden">
                <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <span className="text-xl">📝</span> Notas Rápidas
                </h3>

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