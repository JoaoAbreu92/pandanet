import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { 
  WhatsAppConversation, 
  WhatsAppMessage, 
  WhatsAppSettings,
  WhatsAppConversationWithDetails,
  WhatsAppKanbanColumn
} from '../../types';
import { 
  MessageCircle, 
  Send, 
  MoreVertical, 
  Phone, 
  Search, 
  Paperclip, 
  CheckCheck,
  User,
  Clock,
  ArrowLeft,
  Info,
  UserPlus,
  Instagram,
  Smartphone,
  LayoutGrid,
  List,
  RefreshCcw,
  Smile,
  X,
  Plus,
  Image as ImageIcon,
  Sticker,
  Trash2,
  Download,
  File as FileIcon,
  Video,
  Volume2,
  Calendar,
  AlertCircle,
  Menu,
  Edit2,
  RefreshCw,
  Bell
} from 'lucide-react';

import { useAuth } from '../AuthContext';
import { useNotifications } from '../NotificationContext';
import ContactSidebar from './ContactSidebar';
import KanbanBoard from './KanbanBoard';

interface ChatProps {
  onConversationSelect?: (isActive: boolean) => void;
  initialSearch?: string;
  type?: 'private' | 'group' | 'all';
  initialConversationId?: string | null;
}

const Chat: React.FC<ChatProps> = ({ onConversationSelect, initialSearch = '', type = 'private', initialConversationId }) => {
  const { user, profile, currentUser, isGhostMode } = useAuth();
  const activeProfile = currentUser || profile;
  const permissions = (activeProfile?.whatspanda_permissions as any) || {};
  const isAdmin = activeProfile?.isAdmin || activeProfile?.isCompanyAdmin || activeProfile?.role === 'Super Admin';
  const canSendMessages = (isAdmin || permissions.can_send_messages !== false) && !isGhostMode;
  // Actually, UsersTab set defaults.
  // Let's being strict:
  // const canSendMessages = isAdmin || !!permissions.can_send_messages;

  // However, for existing users without permissions set, we might want to allow or block?
  // Block is safer.

  const canSendMedia = (isAdmin || !!permissions.can_send_media) && !isGhostMode;
  const canSendMessagesResult = (isAdmin || !!permissions.can_send_messages) && !isGhostMode;
  const [conversations, setConversations] = useState<WhatsAppConversationWithDetails[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversationWithDetails | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [newMessage, setNewMessage] = useState('');
  const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'aberto' | 'pendente' | 'fechado'>('aberto');
  const [useSignature, setUseSignature] = useState(false);
  const [signatureText, setSignatureText] = useState('');
  
  // Busca assinatura direto do banco para garantir valor atualizado
  useEffect(() => {
    const fetchSignature = async () => {
      const profileId = activeProfile?.id || profile?.id;
      if (!profileId) return;
      const { data } = await supabase
        .from('profiles')
        .select('whatsapp_signature, use_whatsapp_signature')
        .eq('id', profileId)
        .single();
      if (data) {
        setSignatureText(data.whatsapp_signature || '');
        setUseSignature(data.use_whatsapp_signature || false);
      }
    };
    fetchSignature();
  }, [activeProfile?.id, profile?.id]);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [nudgeCooldowns, setNudgeCooldowns] = useState<{ [key: string]: number }>({});
  const [cooldownTimeouts, setCooldownTimeouts] = useState<{ [key: string]: number }>({});

  // Efeito para gerenciar o contador visual de cooldown do Nudge
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const newTimeouts: { [key: string]: number } = {};
      
      Object.keys(nudgeCooldowns).forEach(convId => {
        const lastNudge = nudgeCooldowns[convId];
        const cooldownSeconds = activeProfile?.nudge_cooldown ?? 30;
        const cooldownMs = cooldownSeconds * 1000;
        const elapsed = now - lastNudge;

        if (elapsed < cooldownMs) {
          newTimeouts[convId] = Math.ceil((cooldownMs - elapsed) / 1000);
        }
      });

      setCooldownTimeouts(newTimeouts);
    }, 1000);

    return () => clearInterval(interval);
  }, [nudgeCooldowns, activeProfile?.nudge_cooldown]);

  const handleSendNudge = async () => {
    if (isGhostMode) return;
    if (!selectedConversation) return;

    const now = Date.now();
    const lastNudge = nudgeCooldowns[selectedConversation.id] || 0;
    const cooldownSeconds = activeProfile?.nudge_cooldown ?? 30;
    const cooldownMs = cooldownSeconds * 1000;

    if (now - lastNudge < cooldownMs) return;

    try {
      // 1. Shake Local (Optimistic)
      if ((window as any).triggerDetectionShake) {
        (window as any).triggerDetectionShake();
      }

      // 2. Persistir mensagem de Nudge
      const { error } = await supabase.from('messages').insert({
        conversation_id: selectedConversation.id,
        sender_id: activeProfile?.id,
        company_id: activeProfile?.company_id,
        text: '!!! CHAMEI SUA ATENÇÃO !!!',
        file_type: 'nudge'
      });

      if (error) throw error;

      // 3. Atualizar última mensagem da conversa
      await supabase.from('conversations').update({
        last_message: 'Chamou sua atenção!',
        last_message_at: new Date().toISOString()
      }).eq('id', selectedConversation.id);

      // 4. Notificação push (opcional, já integrado no Messages)
      // Aqui poderíamos chamar addNotification se necessário.

      setNudgeCooldowns(prev => ({ ...prev, [selectedConversation.id]: now }));
    } catch (err) {
      console.error("Erro ao enviar nudge:", err);
    }
  };
  
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/') || file.type.includes('gif')) {
        return resolve(file);
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_WIDTH = 1280;
          const MAX_HEIGHT = 1280;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.7
          );
        };
        img.onerror = () => resolve(file);
      };
      reader.onerror = () => resolve(file);
    });
  };

  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false); // Added loading state for messages
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // const [user] = useState({ id: 'current-user-id' }); // Mock removed
  const [showContactSidebar, setShowContactSidebar] = useState(true); // Default open for 3-col
  const [contactNotes, setContactNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [kanbanColumns, setKanbanColumns] = useState<WhatsAppKanbanColumn[]>([]);
  const canTransfer = isAdmin || activeProfile?.whatspanda_permissions?.can_transfer;
  const { markNotificationsByLink } = useNotifications();
  
  // State para filtros avancados
  const [showFilters, setShowFilters] = useState(false);
  
  // States para Arquivos e Figurinhas
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [stickerTab, setStickerTab] = useState<'emojis' | 'gallery' | 'saved'>('emojis');
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

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stickerUploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('custom_stickers', JSON.stringify(customStickers));
  }, [customStickers]);
  const [filterConnection, setFilterConnection] = useState<string[]>([]);
  const [filterQueue, setFilterQueue] = useState<string[]>([]);
  const [filterAssignee, setFilterAssignee] = useState<string[]>([]);
  const [chatTypeFilter, setChatTypeFilter] = useState<'all' | 'private' | 'group'>(type);
  const [connections, setConnections] = useState<any[]>([]);
  const [queues, setQueues] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (onConversationSelect) {
      onConversationSelect(!!selectedConversation);
    }
  }, [selectedConversation, onConversationSelect]);

  useEffect(() => {
    fetchSettings();
    fetchConversations();
    loadFiltersData();
    
    // Conversation list subscription com debounce para evitar spam de refetch
    const convSubscription = supabase
      .channel('whatsapp_conversations_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversations' }, payload => {
        // Se for um novo registro (INSERT), atualiza na hora para nao ter delay
        if (payload.eventType === 'INSERT') {
          fetchConversations();
          return;
        }
        
        // Debounce: aguardar 600ms antes de refazer o fetch para updates/deletes
        if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = setTimeout(() => {
          fetchConversations();
        }, 600);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(convSubscription);
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
    };
  }, []); // Run once on mount

  useEffect(() => {
    // Message subscription - depends on selectedConversation
    if (!selectedConversation) return;

    const msgSubscription = supabase
      .channel(`whatsapp_messages_changes_${selectedConversation.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'whatsapp_messages', 
        filter: `conversation_id=eq.${selectedConversation.id}` 
      }, payload => {
        console.log('[WP-DEBUG] Nova mensagem recebida via Realtime');
        const newMsg = payload.new as WhatsAppMessage;
        setMessages(prev => [...prev, newMsg]);
      })
      .subscribe((status) => {
        console.log(`[WP-DEBUG] Realtime Status (Mensagens): ${status}`);
      });

    return () => {
      supabase.removeChannel(msgSubscription);
    };
  }, [selectedConversation]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
      fetchContactNotes(selectedConversation.id);
      markAsRead(selectedConversation.id);
      
      // Force scroll on conversation change
      scrollToBottom(true);
      
      // Clear bell notifications for this conversation
      markNotificationsByLink('/whatspanda');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id]);

  const [isUserReading, setIsUserReading] = useState(false);

  useEffect(() => {
    // Only scroll if we are not actively reading the history
    if (!isUserReading) {
      scrollToBottom();
    }
  }, [messages]);

  const scrollToBottom = (force = false) => {
    if (force) {
      // Força scroll apenas quando o user abre uma nova conversa ou envia mensagem
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        setIsUserReading(false);
      }, 100);
      return;
    }
    // Scroll automático apenas se já estava no fundo (não interrompe leitura de histórico)
    const container = scrollContainerRef.current;
    if (container) {
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 150;
      if (isAtBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
      // Se não está no fundo, não faz nada (usuário está lendo histórico)
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 150;
    
    if (isAtBottom) {
      setIsUserReading(false);
    } else {
      setIsUserReading(true);
    }
  };

  const fetchSettings = async () => {
    const userId = activeProfile?.id || profile?.id;
    if (!userId) return;

    const { data } = await supabase
      .from('whatsapp_settings')
      .select('*')
      .eq('user_id', userId)
      .limit(1);

    if (data && data.length > 0) setSettings(data[0]);
  };
  
  const loadFiltersData = async () => {
    const companyId = currentUser?.company_id;
    if (!companyId) return;
    const [{ data: deps }, { data: cols }] = await Promise.all([
      supabase.from('departments').select('id, name').eq('company_id', companyId),
      supabase.from('whatsapp_kanban_columns').select('*').eq('company_id', companyId).order('order_index', { ascending: true })
    ]);
    if (deps) setQueues(deps);
    if (cols) setKanbanColumns(cols);
  };

  // Update searchTerm if initialSearch changes
  useEffect(() => {
    if (initialSearch !== undefined) {
      setSearchTerm(initialSearch);
    }
  }, [initialSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchConversations();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, activeTab, filterConnection, filterQueue, filterAssignee, chatTypeFilter]);

  useEffect(() => {
    if (type) {
      setChatTypeFilter(type);
    }
  }, [type]);

  useEffect(() => {
    if (initialConversationId) {
      selectConversationById(initialConversationId);
    }
  }, [initialConversationId]);

  const selectConversationById = async (id: string) => {
    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .select(`
        *,
        assigned_user:profiles!assigned_to(id, full_name, avatar_url),
        queue:departments(id, name),
        channel:whatsapp_settings!connection_id(channel_type, connection_name, is_connected),
        tags:whatsapp_conversation_tags(tag:whatsapp_tags(id, name, color)),
        kanban_column:whatsapp_kanban_columns!kanban_column_id(*)
      `)
      .eq('id', id)
      .single();

    if (data && !error) {
      setSelectedConversation(data as WhatsAppConversationWithDetails);
      if (data.status) setActiveTab(data.status as any);
      // If it's a group, ensure the filter allows it
      if (data.is_group) {
        setChatTypeFilter('group');
      } else {
        setChatTypeFilter('private');
      }
    }
  };


  const fetchConversations = async () => {
    const companyId = currentUser?.company_id;
    if (!companyId || !settings?.id) return;

    const userId = activeProfile?.id || profile?.id;

    let query = supabase
      .from('whatsapp_conversations')
      .select(`
        *,
        assigned_user:profiles!assigned_to(id, full_name, avatar_url),
        queue:departments(id, name),
        channel:whatsapp_settings!connection_id(channel_type, connection_name, is_connected),
        tags:whatsapp_conversation_tags(tag:whatsapp_tags(id, name, color)),
        kanban_column:whatsapp_kanban_columns!kanban_column_id(*)
      `)
      .eq('company_id', companyId)
      .eq('connection_id', settings.id); // Força filtro pela conexão do usuário

    // Na aba de grupos, mostramos todos independente do status (aberto/pendente/fechado)
    if (chatTypeFilter !== 'group') {
      query = query.eq('status', activeTab);
    }

    // Pesquisa por nome ou telefone
    if (searchTerm) {
      query = query.or(`contact_name.ilike.%${searchTerm}%,contact_phone.ilike.%${searchTerm}%`);
    }
    
    // Filtros de departamento
    if (filterQueue.length > 0) query = query.in('queue_id', filterQueue);

    // Filtro de Tipo (Privado / Grupo)
    if (chatTypeFilter === 'group') {
      query = query.or('is_group.eq.true,contact_phone.ilike.%@g.us%,contact_name.ilike.%Grupo%');
    } else if (chatTypeFilter === 'private') {
      query = query.neq('is_group', true).not('contact_phone', 'ilike', '%@g.us%');
    }

    const { data } = await query.order('last_message_at', { ascending: false });
    
    if (data) {
      setConversations(data as WhatsAppConversationWithDetails[]);
    }
    setLoading(false);
  };

  const handleUpdateStatus = async (conversationId: string, newStatus: 'aberto' | 'fechado' | 'pendente', assignToMe: boolean = false) => {
    if (isGhostMode) {
      alert('Modo Auditoria: Não é permitido alterar o status do atendimento.');
      return;
    }
    try {
      const updateData: any = { status: newStatus };
      
      // Aceitar Atendimento: sempre atribuir ao usuário logado
      if (newStatus === 'aberto' && assignToMe) {
        if (isGhostMode) {
          alert('Modo Auditoria: Não é permitido aceitar atendimentos.');
          return;
        }
        const userId = activeProfile?.id || profile?.id;
        if (!userId) {
          alert('Não foi possível identificar o usuário logado. Faça login novamente.');
          return;
        }
        updateData.assigned_to = userId;
      }
      
      // Finalizar: limpa o assigned_to para voltar ao pool se reaberto
      if (newStatus === 'fechado') {
        // mantém assigned_to para histórico
      }

      const { error } = await supabase
        .from('whatsapp_conversations')
        .update(updateData)
        .eq('id', conversationId);

      if (error) throw error;

      // Remove da lista atual (mudou de aba) e atualiza o objeto selecionado
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(prev => prev ? { ...prev, ...updateData } : null);
      }
      
      // Recarrega a lista para refletir mudanças
      setTimeout(() => fetchConversations(), 500);

    } catch (err: any) {
      alert('Erro ao atualizar status: ' + err.message);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    const companyId = currentUser?.company_id;
    if (!companyId) return;

    setLoadingMessages(true);
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });
    
    if (data) setMessages(data);
    setLoadingMessages(false);
  };

  const handleMoveConversation = (conversationId: string, newColumnId: string | null) => {
    if (isGhostMode) return;
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId ? { ...conv, kanban_column_id: newColumnId } : conv
    ));
    // Also update selectedConversation if matched
    if (selectedConversation?.id === conversationId) {
      setSelectedConversation(prev => prev ? { ...prev, kanban_column_id: newColumnId } : null);
    }
  };

  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [selectedConvTags, setSelectedConvTags] = useState<string[]>([]);

  useEffect(() => {
    if (selectedConversation) {
      fetchConvTags(selectedConversation.id);
    }
    fetchAvailableTags();
  }, [selectedConversation]);

  const fetchAvailableTags = async () => {
    const companyId = currentUser?.company_id;
    if (!companyId) return;
    const { data } = await supabase.from('whatsapp_tags').select('*').eq('company_id', companyId);
    if (data) setAvailableTags(data);
  };

  const fetchConvTags = async (conversationId: string) => {
    const { data } = await supabase
      .from('whatsapp_conversation_tags')
      .select('tag_id')
      .eq('conversation_id', conversationId);
    if (data) setSelectedConvTags(data.map(d => d.tag_id));
  };

  const handleToggleTag = async (tagId: string) => {
    if (!selectedConversation || isGhostMode) return;

    if (selectedConvTags.includes(tagId)) {
      // Remove
      await supabase
        .from('whatsapp_conversation_tags')
        .delete()
        .eq('conversation_id', selectedConversation.id)
        .eq('tag_id', tagId);
      setSelectedConvTags(prev => prev.filter(id => id !== tagId));
    } else {
      // Add
      await supabase
        .from('whatsapp_conversation_tags')
        .insert({ conversation_id: selectedConversation.id, tag_id: tagId });
      setSelectedConvTags(prev => [...prev, tagId]);
    }
  };

  const markAsRead = async (conversationId: string) => {
    if (isGhostMode) return; // Ghost mode blocks marking as read
    
    const isImpersonating = localStorage.getItem('pixel_is_impersonating') === 'true';
    if (isImpersonating) return; 

    await supabase
      .from('whatsapp_conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId);
  };

  const fetchContactNotes = async (conversationId: string) => {
    const { data } = await supabase
      .from('whatsapp_contact_notes')
      .select('note_text')
      .eq('conversation_id', conversationId)
      .limit(1)
      .single();
    
    setContactNotes(data?.note_text || '');
  };

  const handleSaveNotes = async () => {
    if (!selectedConversation || isGhostMode) return;
    setIsSavingNotes(true);
    
    const companyId = currentUser?.company_id;
    const userId = activeProfile?.id || profile?.id;

    // Check if exists
    const { data: existing } = await supabase
      .from('whatsapp_contact_notes')
      .select('id')
      .eq('conversation_id', selectedConversation.id)
      .single();

    if (existing) {
      await supabase
        .from('whatsapp_contact_notes')
        .update({ note_text: contactNotes, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('whatsapp_contact_notes')
        .insert({
          conversation_id: selectedConversation.id,
          company_id: companyId,
          user_id: userId,
          note_text: contactNotes
        });
    }
    setIsSavingNotes(false);
  };

  const handleUpdateKanbanColumn = async (columnId: string | null) => {
    if (!selectedConversation || isGhostMode) return;
    
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ kanban_column_id: columnId })
      .eq('id', selectedConversation.id);

    if (!error) {
      setSelectedConversation(prev => prev ? { ...prev, kanban_column_id: columnId } : null);
      fetchConversations();
    }
  };

  const EMOJI_LIST = [
    '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '🤨', '🧐', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🙏', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '🔥', '✨', '⚡', '💣', '💥', '💨', '💦', '🕳️', '💤', '👋'
  ];

  const handleSendEmoji = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
  };

  // --- Funções de Mídia e Figurinhas ---
  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { 
        alert('O arquivo excede o limite de 10MB.'); 
        return; 
      }
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

  const removeSticker = (url: string) => {
    setCustomStickers(prev => prev.filter(s => s !== url));
  };

  const handleUploadSticker = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes('gif') && !file.type.includes('image')) {
        alert('Por favor, selecione um GIF ou imagem.');
        return;
    }

    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `stickers/${currentUser?.id}/${fileName}`;

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

  const handleSendSticker = (url: string) => {
    handleSendMessage(undefined, 'sticker', url);
    setShowStickerPicker(false);
  };
  
  const handleSendMessage = async (e?: React.FormEvent, type: 'text' | 'sticker' = 'text', content?: string) => {
    if (isGhostMode) {
      alert('Modo Auditoria: O envio de mensagens está desabilitado.');
      return;
    }
    if (e) e.preventDefault();
    if (!newMessage.trim() && !attachedFile && type !== 'sticker') return;
    if (!selectedConversation || !currentUser?.company_id) return;

    const messageText = type === 'text' ? newMessage : '';
    const stickerUrl = type === 'sticker' ? content : null;
    const isSticker = type === 'sticker';


    let messageWithSignature = messageText;

    // Adiciona assinatura se ativada, exceto em stickers
    if (messageText && useSignature && signatureText.trim() !== '' && !isSticker) {
      messageWithSignature = `${messageText}\n\n${signatureText}`;
    }

    try {
        let uploadedFileUrl = null;
        let fileType = null;

        if (attachedFile) {
            let fileToUpload = attachedFile;
            
            // Comprimir se for imagem (exceto GIF)
            if (attachedFile.type.startsWith('image/') && !attachedFile.type.includes('gif')) {
                try {
                    fileToUpload = await compressImage(attachedFile);
                } catch (err) {
                    console.error('Erro na compressão:', err);
                }
            }

            const fileExt = fileToUpload.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `whatsapp/${selectedConversation.id}/${fileName}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('chat-media')
                .upload(filePath, fileToUpload);

            if (uploadError) {
                console.error('Falha no upload:', uploadError);
                alert(`Erro ao subir arquivo: ${uploadError.message}`);
                return;
            } else if (uploadData) {
                const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(filePath);
                uploadedFileUrl = publicUrl;
                fileType = attachedFile.type;
            }
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error("No active session");

        const response = await fetch(`/api/whatsapp/messages/send/${selectedConversation.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                message: messageWithSignature,
                mediaUrl: uploadedFileUrl || stickerUrl,
                mediaType: type === 'sticker' ? 'sticker' : fileType
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to send message');
        }

        setNewMessage('');
        setAttachedFile(null);
        setShowStickerPicker(false);
        // Recarregar mensagens após o envio
        fetchMessages(selectedConversation.id);
        // Forçar scroll para baixo para ver a própria mensagem enviada
        scrollToBottom(true);
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Erro ao enviar mensagem.');
    }
  };

  const filteredConversations = conversations; // Already filtered by fetchConversations

  return (
    <div className="flex h-full bg-[#f8fafc] dark:bg-transparent overflow-hidden relative font-sans text-brand-text transition-colors duration-500">
      {/* Middle Section: Conversations List */}
      <div className={`${selectedConversation ? 'hidden md:flex' : 'flex'} w-full md:w-[320px] lg:w-[360px] bg-white dark:bg-slate-900/40 backdrop-blur-xl border-r border-slate-200 dark:border-white/5 flex-col shadow-[2px_0_15px_rgba(0,0,0,0.02)] z-10 transition-all duration-500`}>
        {/* Header - SIMPLIFIED for sub-view (main header handled by layout) */}
        <div className="p-4 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-transparent">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-slate-800 dark:text-white tracking-tight uppercase text-sm opacity-80">
              Atendimentos
            </h2>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setViewMode(viewMode === 'list' ? 'kanban' : 'list')}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-500 transition-colors"
                title={viewMode === 'list' ? 'Mudar para Kanban' : 'Mudar para Lista'}
              >
                {viewMode === 'list' ? <LayoutGrid className="w-4 h-4" /> : <List className="w-4 h-4" />}
              </button>
              
              <button 
                onClick={async () => {
                  const companyId = currentUser?.company_id;
                  const connectionId = settings?.id;
                  if (!companyId || !connectionId) return;

                  try {
                    const { data: sessionData } = await supabase.auth.getSession();
                    const token = sessionData?.session?.access_token;
                    if (!token) throw new Error("No active session");

                    const response = await fetch(`/api/whatsapp/repair-webhooks/${companyId}/${connectionId}`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${token}`
                      }
                    });
                    
                    if (!response.ok) throw new Error();
                    alert('Conexão reparada! Webhooks recriados na Evolution API.');
                    fetchConversations();
                  } catch {
                    alert('Erro ao reparar conexão. Verifique se a conexão está ativa nas configurações.');
                  }
                }}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-500 transition-colors"
                title="Sincronizar e Reparar Conexão"
              >
                <RefreshCcw className="w-4 h-4" />
              </button>

              <div className={`w-3 h-3 rounded-full ring-4 shadow-lg ${settings?.is_connected ? 'bg-emerald-500 ring-emerald-500/20 animate-pulse' : 'bg-red-500 ring-red-500/20'}`} title={settings?.is_connected ? 'Conectado' : 'Desconectado'}></div>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl shadow-inner border border-transparent dark:border-white/5">
            {(['aberto', 'pendente', 'fechado'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-xl capitalize transition-all duration-300 ${activeTab === tab
                  ? 'bg-white dark:bg-emerald-500 text-emerald-600 dark:text-white shadow-xl scale-[1.02]'
                  : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          {/* Tipo de conversa: Privado / Grupo - Hide if enforced by prop */}
          {type === 'all' && (
            <div className="flex gap-1 mt-2">
              {([{ v: 'private', label: '💬 Privados' }, { v: 'group', label: '👥 Grupos' }] as const).map(({ v, label }) => (
                <button
                  key={v}
                  onClick={() => setChatTypeFilter(chatTypeFilter === v ? 'all' : v as any)}
                  className={`flex-1 text-[10px] py-1 rounded-lg font-semibold border transition-all ${
                    chatTypeFilter === v
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                      : 'bg-slate-50 dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10 hover:border-emerald-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search and Actions */}
        <div className="p-3 border-b border-slate-100 dark:border-white/5 bg-white dark:bg-transparent space-y-2">
          <div className="flex gap-1.5">
            <div className="relative group flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
              <input
                type="text" 
                placeholder="Buscar atendimento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 dark:text-white"
              />
            </div>
            <button
              onClick={() => fetchConversations()}
              className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-500 border border-slate-200 dark:border-white/10 hover:border-emerald-500 hover:text-emerald-500 transition-all"
              title="Recarregar"
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                showFilters || filterConnection.length > 0 || filterQueue.length > 0 || filterAssignee.length > 0
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'bg-slate-50 dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10 hover:border-emerald-300'
              }`}
              title="Filtros Avançados"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          
          {/* Painel de filtros avancados */}
          {showFilters && (
            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-3 space-y-2 text-xs">
              <p className="font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px]">Filtros Avançados</p>
              
              {/* Conexão */}
              {connections.length > 0 && (
                <div>
                  <p className="text-slate-500 mb-1">Conexão</p>
                  <div className="flex flex-wrap gap-1">
                    {connections.map((c: any) => (
                      <button
                        key={c.id}
                        onClick={() => setFilterConnection(prev =>
                          prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id]
                        )}
                        className={`px-2 py-0.5 rounded-full border text-[10px] transition-all ${
                          filterConnection.includes(c.id)
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                            : 'bg-white dark:bg-white/10 text-slate-600 dark:text-slate-300 border-slate-200'
                        }`}
                      >
                        {c.connection_name || 'Canal'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Fila/Setor */}
              {queues.length > 0 && (
                <div>
                  <p className="text-slate-500 mb-1">Fila / Setor</p>
                  <div className="flex flex-wrap gap-1">
                    {queues.map((q: any) => (
                      <button
                        key={q.id}
                        onClick={() => setFilterQueue(prev =>
                          prev.includes(q.id) ? prev.filter(x => x !== q.id) : [...prev, q.id]
                        )}
                        className={`px-2 py-0.5 rounded-full border text-[10px] transition-all ${
                          filterQueue.includes(q.id)
                            ? 'bg-blue-100 text-blue-700 border-blue-300'
                            : 'bg-white dark:bg-white/10 text-slate-600 dark:text-slate-300 border-slate-200'
                        }`}
                      >
                        {q.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Atendente (admin only) */}
              {isAdmin && agents.length > 0 && (
                <div>
                  <p className="text-slate-500 mb-1">Atendente</p>
                  <div className="flex flex-wrap gap-1">
                    {agents.map((a: any) => (
                      <button
                        key={a.id}
                        onClick={() => setFilterAssignee(prev =>
                          prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id]
                        )}
                        className={`px-2 py-0.5 rounded-full border text-[10px] transition-all ${
                          filterAssignee.includes(a.id)
                            ? 'bg-purple-100 text-purple-700 border-purple-300'
                            : 'bg-white dark:bg-white/10 text-slate-600 dark:text-slate-300 border-slate-200'
                        }`}
                      >
                        {a.full_name || 'Agente'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {(filterConnection.length > 0 || filterQueue.length > 0 || filterAssignee.length > 0) && (
                <button
                  onClick={() => { setFilterConnection([]); setFilterQueue([]); setFilterAssignee([]); }}
                  className="text-red-500 hover:text-red-700 text-[10px] font-bold"
                >
                  ✕ Limpar filtros
                </button>
              )}
            </div>
          )}
          {isAdmin && activeTab === 'fechado' && (
            <button
              onClick={async () => {
                  if (isGhostMode) return;
                  try {
                    const companyId = currentUser?.company_id;
                    if (!companyId) return;

                    const { error } = await supabase
                      .from('whatsapp_conversations')
                      .delete()
                      .eq('company_id', companyId)
                      .eq('status', 'fechado');
                    
                    if (error) throw error;
                    setConversations([]);
                    setSelectedConversation(null);
                    alert('Atendimentos fechados limpos com sucesso.');
                  } catch (err: any) {
                    alert('Erro ao limpar: ' + err.message);
                  }
              }}
              className="w-full flex items-center justify-center gap-2 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-100"
            >
              LIMPAR ATENDIMENTOS (FECHADOS)
            </button>
          )}
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-2 bg-slate-50/50 dark:bg-transparent">
          {filteredConversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setSelectedConversation(conv)}
              className={`p-3 rounded-2xl border cursor-pointer hover:shadow-lg transition-all duration-300 relative overflow-hidden group ${selectedConversation?.id === conv.id
                ? 'bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/5 shadow-sm hover:border-emerald-300 dark:hover:bg-white/10'
              }`}
            >
              {/* Active bar */}
              {selectedConversation?.id === conv.id && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
              )}

              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="relative flex-shrink-0">
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(conv.contact_name || conv.contact_phone || 'User')}&background=random`}
                      className="w-8 h-8 rounded-full border border-slate-200"
                      alt={conv.contact_name || conv.contact_phone}
                    />
                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-px shadow-sm border border-slate-100">
                      {conv.channel?.channel_type === 'instagram' ? (
                        <Instagram className="w-3 h-3 text-pink-500" />
                      ) : conv.channel?.channel_type === 'messenger' ? (
                          <MessageCircle className="w-3 h-3 text-blue-500" />
                        ) : conv.channel?.channel_type === 'telegram' ? (
                            <Send className="w-3 h-3 text-sky-500" />
                          ) : (
                        <Smartphone className="w-3 h-3 text-emerald-500" />
                      )}
                    </div>
                    {/* Tags Badge on Avatar */}
                    {conv.tags && conv.tags.length > 0 && (
                      <div className="absolute -top-1 -right-1 flex gap-0.5">
                        {conv.tags.slice(0, 2).map((t: any, i: number) => (
                          <div 
                            key={i} 
                            className="w-2.5 h-2.5 rounded-full border border-white dark:border-slate-800 shadow-sm"
                            style={{ backgroundColor: t.tag?.color || '#10B981' }}
                            title={t.tag?.name}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <h3 className={`font-semibold text-sm truncate tracking-tight transition-colors ${selectedConversation?.id === conv.id ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-white'}`}>
                    {conv.contact_name || conv.contact_phone}
                  </h3>
                </div>
                <span className={`text-[10px] font-medium uppercase tracking-widest whitespace-nowrap mt-1 ${selectedConversation?.id === conv.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                    {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2 pl-10">
                <div className="flex flex-col gap-1 min-w-0">
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate max-w-[140px] font-medium tracking-tight opacity-70 group-hover:opacity-100">
                      {conv.contact_phone}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {conv.assigned_user && (
                      <span className="text-[9px] bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-md border border-indigo-200/50 dark:border-indigo-500/30 font-bold flex items-center gap-1 shadow-sm">
                        <User className="w-2.5 h-2.5" />
                        {conv.assigned_user.full_name.split(' ')[0]}
                      </span>
                    )}
                    {conv.department && (
                      <span className="text-[9px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-200/50 dark:border-emerald-500/30 font-bold flex items-center gap-1 shadow-sm">
                        <LayoutGrid className="w-2.5 h-2.5" />
                        {conv.department.name}
                      </span>
                    )}
                    {conv.kanban_column && (
                      <span 
                        className="text-[9px] px-2 py-0.5 rounded-md border font-bold flex items-center gap-1 shadow-sm"
                        style={{ 
                          backgroundColor: `${conv.kanban_column.color}20`, 
                          color: conv.kanban_column.color,
                          borderColor: `${conv.kanban_column.color}40`
                        }}
                      >
                        <Clock className="w-2.5 h-2.5" />
                        {conv.kanban_column.name}
                      </span>
                    )}
                  </div>
                </div>
                {conv.unread_count > 0 ? (
                  <span className="bg-emerald-500 text-white text-[10px] font-medium min-w-[20px] px-1.5 py-0.5 rounded-full text-center shadow-sm flex-shrink-0">
                    {conv.unread_count > 99 ? '99+' : conv.unread_count}
                  </span>
                ) : (
                  selectedConversation?.id === conv.id ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> : null
                )}
              </div>
            </div>
          ))}
          {filteredConversations.length === 0 && (
            <div className="p-8 text-center text-slate-400 mt-4">
              <div className="w-12 h-12 bg-slate-200/50 rounded-full flex items-center justify-center mx-auto mb-3">
                <MessageCircle className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium">Nenhum atendimento {activeTab}.</p>
              </div>
          )}
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <KanbanBoard 
          companyId={profile?.company_id || user?.user_metadata?.company_id || ''}
          conversations={conversations}
          onOpenChat={(conv) => {
            setSelectedConversation(conv);
            setViewMode('list');
          }}
          onMoveConversation={handleMoveConversation}
        />
      ) : (
      <>
      {/* Main Chat Area */}
      <div className={`${selectedConversation ? 'flex' : 'hidden md:flex'} flex-1 flex flex-col bg-[#F3F6F8] dark:bg-[#020617] relative transition-colors duration-500`} style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundRepeat: 'repeat', opacity: 1 }}>
        <div className="absolute inset-0 bg-white/70 dark:bg-[#020617]/90 pointer-events-none" /> {/* Overlay to soften the background */}

        {selectedConversation ? (
          <div className="relative z-10 flex flex-col h-full"> {/* Container for z-index */}
            {/* Chat Header */}
            <div className="px-6 py-4 bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 flex justify-between items-center shadow-lg z-20">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="p-2 -ml-2 md:hidden hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-12 h-12 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center text-slate-400 shrink-0 ring-2 ring-white dark:ring-white/10 shadow-lg overflow-hidden transition-all duration-300">
                  <User className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex flex-col">
                  <h3 className="font-bold text-slate-800 dark:text-white text-lg truncate leading-tight tracking-tight">{selectedConversation.contact_name || selectedConversation.contact_phone}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[11px] font-bold text-slate-500 dark:text-gray-400 truncate opacity-80">{selectedConversation.contact_phone}</p>

                    {selectedConversation.channel && (
                      <span className="text-[10px] bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-gray-300 font-bold px-3 py-1 rounded-full border border-slate-200 dark:border-white/5 flex items-center gap-1.5 uppercase tracking-widest shadow-sm">
                        {selectedConversation.channel.channel_type === 'instagram' ? <Instagram className="w-3.5 h-3.5 text-pink-500" /> :
                          selectedConversation.channel.channel_type === 'messenger' ? <MessageCircle className="w-3.5 h-3.5 text-blue-500" /> :
                            selectedConversation.channel.channel_type === 'telegram' ? <Send className="w-3.5 h-3.5 text-sky-500" /> :
                              <Smartphone className="w-3.5 h-3.5 text-emerald-500" />}
                        {selectedConversation.channel.connection_name || 'WhatsApp'}
                      </span>
                    )}

                    {selectedConversation.assigned_user && (
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-100">
                        {selectedConversation.assigned_user.full_name}
                      </span>
                    )}
                    {selectedConversation.department && (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-100">
                        {selectedConversation.department.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
                    <div className="flex gap-2 items-center">
                      <div className="h-8 w-px bg-slate-200 dark:bg-white/10 mx-1" />
                      <div className="flex gap-1.5">
                <button
                  onClick={() => setShowContactSidebar(!showContactSidebar)}
                  className={`p-2 rounded-full transition-colors ${showContactSidebar ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-slate-100 text-slate-500'}`}
                  title="Informações do Contato"
                >
                  <Info className="w-5 h-5" />
                </button>
              </div>
            </div>
                  </div>

            {/* Messages */}
            <div 
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4"
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.is_from_customer ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`p-3 md:p-4 rounded-2xl shadow-sm border ${
                      msg.is_from_customer
                      ? 'bg-white dark:bg-white/5 text-slate-800 dark:text-slate-100 rounded-tl-sm border-gray-100 dark:border-white/5'
                      : (msg.media_type === 'sticker' || msg.media_url?.toLowerCase().endsWith('.gif'))
                        ? 'bg-transparent shadow-none border-0 p-0 overflow-visible'
                        : 'bg-emerald-100/90 dark:bg-emerald-500/20 text-slate-800 dark:text-emerald-50 rounded-tr-sm border-emerald-200/50 dark:border-emerald-500/20'
                    }`}
                  >
                    <div className="space-y-2">
                      {(msg.media_type?.includes('image') || msg.media_type === 'sticker' || (msg.media_url && typeof msg.media_url === 'string' && msg.media_url.match(/\.(jpeg|jpg|gif|png|webp)$/i))) ? (
                        <div className={`relative group inline-block`}>
                          <img 
                            src={msg.media_url || ''} 
                            alt="Mídia" 
                            className={`rounded-xl h-auto object-contain cursor-pointer border border-white/10 shadow-sm max-h-[250px] max-w-[200px] md:max-w-[300px] ${
                              (msg.media_type === 'sticker' || msg.media_url?.toLowerCase().endsWith('.gif')) 
                              ? 'border-0 shadow-none bg-transparent' 
                              : ''
                            }`}
                            onClick={() => window.open(msg.media_url || '_blank')} 
                          />
                          <a 
                            href={msg.media_url || ''} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="absolute bottom-2 right-2 p-1.5 bg-black/40 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      ) : msg.media_type?.includes('audio') ? (
                        <div className="flex flex-col gap-1 min-w-[200px]">
                          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            <Volume2 className="w-4 h-4" />
                            <span>Mensagem de Áudio</span>
                          </div>
                          <audio controls className="w-full h-10">
                            <source src={msg.media_url || ''} type="audio/mpeg" />
                          </audio>
                        </div>
                      ) : msg.media_type?.includes('video') ? (
                        <div className="relative group rounded-xl overflow-hidden shadow-sm">
                          <video controls className="max-w-full h-auto">
                            <source src={msg.media_url || ''} type="video/mp4" />
                          </video>
                        </div>
                      ) : msg.media_url ? (
                        <a 
                          href={msg.media_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 bg-white/10 dark:bg-white/5 rounded-xl border border-white/20 hover:border-emerald-400 transition-all group"
                        >
                          <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg group-hover:scale-110 transition-transform">
                            <FileIcon className="w-6 h-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">Arquivo / Documento</p>
                            <p className="text-[10px] opacity-60 uppercase font-bold tracking-tighter">Clique para baixar</p>
                          </div>
                          <Download className="w-4 h-4 opacity-40 group-hover:opacity-100" />
                        </a>
                      ) : null}

                      {msg.message_text && (
                        <p className={`text-sm font-medium leading-relaxed whitespace-pre-wrap ${
                          (msg.media_type === 'sticker' || msg.media_url?.toLowerCase().endsWith('.gif')) 
                          ? 'mt-2 p-3 bg-emerald-100/90 dark:bg-emerald-500/20 rounded-2xl text-slate-800 dark:text-emerald-50' 
                          : ''
                        }`}>
                          {msg.message_text}
                        </p>
                      )}
                    </div>
                    <div className={`flex justify-end items-center gap-1.5 mt-2 opacity-60 ${
                      (msg.media_type === 'sticker' || msg.media_url?.toLowerCase().endsWith('.gif')) 
                      ? 'bg-black/20 dark:bg-white/10 px-2 py-0.5 rounded-full w-fit ml-auto' 
                      : ''
                    }`}>
                      <span className="text-[10px] font-medium uppercase tracking-tight">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {!msg.is_from_customer && (
                        <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="px-3 py-2 md:px-6 md:py-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-white/5 z-20 pb-3 md:pb-4 shadow-[0_-4px_10px_-4px_rgba(0,0,0,0.05)]">
              
              {/* Sticker Picker UI */}
              {showStickerPicker && (
                <div className="absolute bottom-[100%] left-4 right-4 mb-4 bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden z-50 animate-in slide-in-from-bottom-4 duration-300">
                  <div className="flex border-b border-slate-100 dark:border-white/5">
                    <button onClick={() => setStickerTab('emojis')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider ${stickerTab === 'emojis' ? 'text-emerald-500 border-b-2 border-emerald-500 bg-emerald-50/10' : 'text-slate-400'}`}>Emojis</button>
                    <button onClick={() => setStickerTab('gallery')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider ${stickerTab === 'gallery' ? 'text-emerald-500 border-b-2 border-emerald-500 bg-emerald-50/10' : 'text-slate-400'}`}>Figus</button>
                    <button onClick={() => setStickerTab('saved')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider ${stickerTab === 'saved' ? 'text-emerald-500 border-b-2 border-emerald-500 bg-emerald-50/10' : 'text-slate-400'}`}>Gifs</button>
                    <button onClick={() => setShowStickerPicker(false)} className="px-4 text-slate-400 hover:text-red-500"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="p-4 max-h-64 overflow-y-auto custom-scrollbar">
                    {stickerTab === 'emojis' ? (
                      <div className="grid grid-cols-7 sm:grid-cols-9 md:grid-cols-12 gap-1 px-1">
                        {EMOJI_LIST.map((emoji, i) => (
                          <button
                            key={i}
                            onClick={() => handleSendEmoji(emoji)}
                            className="p-2 text-2xl hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-all active:scale-90"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 gap-3">
                        {(stickerTab === 'gallery' ? [
                          'https://fonts.gstatic.com/s/e/notoemoji/latest/1f600/512.gif',
                          'https://fonts.gstatic.com/s/e/notoemoji/latest/1f60d/512.gif',
                          'https://fonts.gstatic.com/s/e/notoemoji/latest/1f44d/512.gif',
                          'https://fonts.gstatic.com/s/e/notoemoji/latest/1f389/512.gif',
                          'https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif',
                          'https://fonts.gstatic.com/s/e/notoemoji/latest/1f680/512.gif',
                          'https://fonts.gstatic.com/s/e/notoemoji/latest/1f4af/512.gif',
                          'https://fonts.gstatic.com/s/e/notoemoji/latest/1f4e6/512.gif'
                        ] : customStickers).map((url, i) => (
                          <div key={i} className="relative group aspect-square max-w-[60px] mx-auto">
                            <img 
                              src={url} 
                              alt="sticker" 
                              className="w-full h-full object-contain cursor-pointer hover:scale-110 transition-transform drop-shadow-sm" 
                              onClick={() => handleSendSticker(url)}
                            />
                            {stickerTab === 'saved' && (
                              <button onClick={() => removeSticker(url)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                            )}
                          </div>
                        ))}
                        {stickerTab === 'saved' && (
                          <div className="relative aspect-square max-w-[60px] mx-auto">
                            <button 
                              onClick={() => stickerUploadRef.current?.click()}
                              className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl text-slate-400 hover:border-emerald-500 hover:text-emerald-500 transition-all"
                            >
                              <Plus className="w-5 h-5" />
                              <span className="text-[8px] font-bold mt-1">NOVO</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Attachment Preview */}
              {attachedFile && (
                <div className="mb-3 p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-between border border-emerald-100 dark:border-emerald-500/20 animate-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400">
                      <Paperclip className="w-5 h-5" />
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-bold text-slate-700 dark:text-emerald-50 truncate">{attachedFile.name}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">{(attachedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button onClick={() => setAttachedFile(null)} className="p-2 hover:bg-red-100 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500 rounded-xl transition-all">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}

              {isGhostMode ? (
                <div className="bg-purple-50 p-3 md:p-4 rounded-xl border border-purple-200 text-center shadow-inner">
                  <p className="text-xs md:text-sm font-bold text-purple-600 flex items-center justify-center gap-2">
                    MODO AUDITORIA ATIVO
                  </p>
                  <p className="text-[10px] md:text-xs text-purple-500 mt-1">
                    Você não pode interagir neste WhatsApp.
                  </p>
                </div>
              ) : (
              <div className="flex-1 bg-gray-100/80 dark:bg-white/5 rounded-3xl flex items-end p-1 md:p-2 border border-transparent dark:border-white/5 focus-within:bg-white dark:focus-within:bg-white/10 focus-within:shadow-xl transition-all duration-300">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileAttach} 
                  className="hidden" 
                />
                <input 
                  type="file" 
                  ref={stickerUploadRef} 
                  onChange={handleUploadSticker} 
                  className="hidden" 
                  accept="image/*,.gif"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-2.5 md:p-3 rounded-2xl transition-all duration-300 ${canSendMedia ? 'hover:bg-brand-primary/10 text-slate-500 dark:text-gray-400 hover:text-brand-primary' : 'opacity-50 cursor-not-allowed text-slate-300'}`}
                  disabled={!canSendMedia}
                  title={!canSendMedia ? "Sem permissão para enviar mídia" : "Anexar Arquivo"}
                >
                  <Paperclip className="w-5 h-5 md:w-5 md:h-5" />
                </button>

                <button
                  onClick={() => setShowStickerPicker(!showStickerPicker)}
                  className={`p-2.5 md:p-3 rounded-2xl transition-all duration-300 ${canSendMedia ? 'hover:bg-brand-primary/10 text-slate-500 dark:text-gray-400 hover:text-brand-primary' : 'opacity-50 cursor-not-allowed text-slate-300'} ${showStickerPicker ? 'bg-brand-primary/10 text-brand-primary' : ''}`}
                  disabled={!canSendMedia}
                  title={!canSendMedia ? "Sem permissão para enviar figurinhas" : "Figurinhas / Gifs"}
                >
                  <Smile className="w-5 h-5 md:w-5 md:h-5" />
                </button>

                <div className="flex flex-col items-center justify-center px-1 mb-2">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Assin.</span>
                  <button
                    onClick={() => setUseSignature(!useSignature)}
                    className={`p-1.5 rounded-lg transition-all ${useSignature ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5'}`}
                    title={useSignature ? "Assinatura Ativa" : "Sem Assinatura"}
                  >
                    <CheckCheck className={`w-3.5 h-3.5 ${useSignature ? 'opacity-100' : 'opacity-40'}`} />
                  </button>
                </div>

                {/* Botão Chamar Atenção (Nudge) */}
                {activeProfile?.can_nudge && (
                  <div className="flex-shrink-0 flex items-center justify-center mr-1 mb-1">
                    <button
                      type="button"
                      onClick={handleSendNudge}
                      disabled={!!cooldownTimeouts[selectedConversation?.id || '']}
                      className={`p-2.5 rounded-2xl transition-all relative flex items-center justify-center ${
                        cooldownTimeouts[selectedConversation?.id || '']
                          ? 'text-slate-300 cursor-not-allowed opacity-50'
                          : 'text-orange-500 hover:text-orange-600 hover:bg-orange-50  active:scale-95'
                      }`}
                      title="Chamar Atenção (Nudge)"
                    >
                      <Bell className={`w-5 h-5 ${cooldownTimeouts[selectedConversation?.id || ''] ? '' : 'animate-bounce'}`} />
                      {cooldownTimeouts[selectedConversation?.id || ''] && (
                        <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-[9px] px-1 py-0.5 rounded-full font-bold shadow-sm whitespace-nowrap min-w-[18px] text-center border border-white">
                          {cooldownTimeouts[selectedConversation?.id || '']}s
                        </span>
                      )}
                    </button>
                  </div>
                )}
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onPaste={handlePaste}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      canSendMessagesResult && handleSendMessage();
                    }
                  }}
                  placeholder={canSendMessagesResult ? "Mensagem" : "Apenas leitura"}
                  disabled={!canSendMessagesResult}
                  className="flex-1 max-h-32 min-h-[40px] py-3 px-2 md:px-4 bg-transparent text-[15px] resize-none focus:outline-none dark:text-white placeholder-gray-400/80 font-medium leading-[1.3]"
                  rows={1}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={(!newMessage.trim() && !attachedFile) || !canSendMessagesResult}
                  className="p-2.5 md:p-3 bg-brand-primary text-white rounded-full md:rounded-2xl hover:bg-emerald-600 dark:hover:bg-emerald-400 disabled:opacity-50 disabled:bg-slate-300 dark:disabled:bg-white/10 disabled:cursor-not-allowed transform transition-all active:scale-95 shadow-md shadow-brand-primary/20 mb-0.5 md:mb-px ml-1 md:ml-2 flex-shrink-0"
                  title={!canSendMessagesResult ? "Sem permissão para enviar mensagens" : "Enviar"}
                >
                  <Send className="w-5 h-5 md:ml-1" />
                </button>
              </div>
              )}
            </div>
          </div>
        ) : (
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-slate-500 p-8">
              <div className="bg-white/50 dark:bg-slate-900/60 backdrop-blur-3xl p-12 rounded-[2.5rem] shadow-2xl flex flex-col items-center max-w-sm text-center border border-white/20 dark:border-white/5">
                <div className="w-24 h-24 bg-gradient-to-tr from-emerald-500 to-emerald-400 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-emerald-500/20 transform rotate-3">
                  <MessageCircle className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-4 font-brand">WhatsPanda Pro</h2>
                <p className="text-sm font-bold text-slate-500 dark:text-gray-400 leading-relaxed opacity-80">Selecione um atendimento ao lado para visualizar as mensagens e interagir com o cliente.</p>
              </div>
          </div>
        )}
      </div>

      {/* Info Sidebar (Right) */}
      {selectedConversation && (
        <div className={`w-full sm:w-[350px] bg-white dark:bg-slate-900/40 backdrop-blur-xl border-l border-slate-200 dark:border-white/5 flex flex-col transition-all duration-500 fixed right-0 h-full shadow-2xl lg:relative lg:shadow-none ${showContactSidebar ? 'translate-x-0' : 'translate-x-full lg:hidden'} z-30`}>
          <div className="p-5 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-transparent flex justify-between items-center lg:hidden">
            <span className="font-bold text-slate-700 dark:text-gray-300 uppercase text-[10px] tracking-widest">Painel do Contato</span>
            <button onClick={() => setShowContactSidebar(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-slate-500"><X className="w-5 h-5" /></button>
          </div>

          <div className="p-8 flex flex-col items-center border-b border-slate-100 dark:border-white/5 bg-gradient-to-b from-slate-50/50 to-transparent dark:from-white/5">
            <div className="w-24 h-24 bg-gray-100 dark:bg-white/5 rounded-3xl flex items-center justify-center mb-6 ring-4 ring-white dark:ring-white/10 shadow-xl overflow-hidden transition-all duration-300 group">
              <User className="w-12 h-12 text-slate-300 group-hover:scale-110 transition-transform" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white text-center leading-tight tracking-tight">{selectedConversation.contact_name || 'Sem nome'}</h3>
            <p className="text-emerald-500 dark:text-emerald-400 text-[10px] font-bold mt-2 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full">{selectedConversation.contact_phone}</p>
          </div>

          <div className="p-6 flex-1 overflow-y-auto space-y-8 custom-scrollbar">
            {/* Kanban Section */}
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <LayoutGrid className="w-3.5 h-3.5" /> Etapa do Kanban
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {kanbanColumns.map(col => (
                  <button
                    key={col.id}
                    onClick={() => handleUpdateKanbanColumn(col.id)}
                    className={`flex items-center gap-3 p-3 rounded-2xl border text-[11px] font-bold transition-all ${
                      selectedConversation.kanban_column_id === col.id
                      ? 'bg-white dark:bg-white/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-md ring-2 ring-emerald-500/10'
                      : 'bg-slate-50 dark:bg-white/5 border-transparent text-slate-500 dark:text-gray-400 hover:border-slate-200 dark:hover:border-white/20'
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: col.color }} />
                    {col.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags Section */}
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Paperclip className="w-3.5 h-3.5" /> Etiquetas
              </h4>
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => handleToggleTag(tag.id)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all ${
                      selectedConvTags.includes(tag.id)
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20'
                      : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-gray-400 border-transparent hover:border-emerald-300'
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Edit2 className="w-3.5 h-3.5" /> Anotações Internas
                </h4>
                {isSavingNotes && <RefreshCw className="w-3 h-3 animate-spin text-emerald-500" />}
              </div>
              <textarea
                value={contactNotes}
                onChange={(e) => setContactNotes(e.target.value)}
                onBlur={handleSaveNotes}
                placeholder="Clique para escrever uma observação sobre este contato..."
                className="w-full h-32 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-transparent focus:border-emerald-500/50 focus:bg-white dark:focus:bg-white/10 text-sm dark:text-white resize-none transition-all placeholder:text-[11px] placeholder:font-bold placeholder:uppercase placeholder:tracking-widest placeholder:opacity-30"
              />
              <button 
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
                className="w-full mt-3 py-3 bg-slate-900 dark:bg-emerald-500/20 text-white dark:text-emerald-400 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
              >
                {isSavingNotes ? 'Salvando...' : 'Salvar Anotação'}
              </button>
            </div>

            {/* Interaction History Info */}
            <div className="pt-6 border-t border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-4 text-sm text-slate-700 dark:text-gray-200 bg-slate-50 dark:bg-white/5 p-4 rounded-2xl">
                <Clock className="w-5 h-5 text-emerald-500" />
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400 dark:text-gray-500">Última Interação</span>
                  <span className="font-bold text-[11px]">{new Date(selectedConversation.last_message_at).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => handleUpdateStatus(selectedConversation.id, selectedConversation.status === 'fechado' ? 'aberto' : 'fechado')}
              className={`w-full flex items-center justify-center py-4 px-6 font-bold text-xs uppercase tracking-widest rounded-2xl transition-all duration-300 border ${
                selectedConversation.status === 'fechado'
                ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 hover:bg-indigo-500 hover:text-white'
                : 'bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500 hover:text-white'
              }`}
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              {selectedConversation.status === 'fechado' ? 'Reabrir Conversa' : 'Encerrar Atendimento'}
            </button>
          </div>
        </div>
      )}
      </>
      )}

    </div>
  );
};

export default Chat;
