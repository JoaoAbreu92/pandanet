import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  Check,
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
  Mic,
  Edit2,
  RefreshCw,
  Bell,
  BellOff,
  Share,
  Share2,
  CornerUpRight
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
  const [selectedMedia, setSelectedMedia] = useState<{url: string, type: string} | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [chatFontSize, setChatFontSize] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('whatspanda_chat_font_size');
      return saved ? parseInt(saved, 10) : 14;
    }
    return 14;
  });

  useEffect(() => {
    const handleFontSizeChange = () => {
      const saved = localStorage.getItem('whatspanda_chat_font_size');
      if (saved) {
        setChatFontSize(parseInt(saved, 10));
      }
    };
    window.addEventListener('whatspanda_font_size_changed', handleFontSizeChange);
    window.addEventListener('storage', handleFontSizeChange);
    return () => {
      window.removeEventListener('whatspanda_font_size_changed', handleFontSizeChange);
      window.removeEventListener('storage', handleFontSizeChange);
    };
  }, []);

  // Message Context Menu & Edit/Delete States
  const [messageContextMenu, setMessageContextMenu] = useState<{ x: number, y: number, message: WhatsAppMessage } | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // Voice messages state & refs
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<any>(null);

  // Estados e Funções para as Mensagens Rápidas com atalho '/'
  const [quickMessages, setQuickMessages] = useState<any[]>([]);
  const [showQuickMsgPopup, setShowQuickMsgPopup] = useState(false);
  const [quickMsgFilter, setQuickMsgFilter] = useState('');
  const [selectedQuickMsgIdx, setSelectedQuickMsgIdx] = useState(0);

  const fetchQuickMessages = async () => {
    const companyId = activeProfile?.company_id || profile?.company_id;
    const userId = activeProfile?.id || profile?.id;
    if (!companyId || !userId) return;

    try {
      const { data } = await supabase
        .from('whatsapp_quick_messages')
        .select('*')
        .eq('company_id', companyId)
        .or(`is_public.eq.true,created_by.eq.${userId}`)
        .order('shortcut', { ascending: true });

      if (data) {
        setQuickMessages(data);
      }
    } catch (err) {
      console.error('Erro ao buscar mensagens rápidas:', err);
    }
  };

  useEffect(() => {
    fetchQuickMessages();
  }, [activeProfile?.company_id, activeProfile?.id]);

  const selectQuickMessage = (msg: any) => {
    const words = newMessage.split(/\s+/);
    words.pop(); // Remove o atalho ex: "/pix"
    const prefix = words.join(' ');
    const updatedMessage = prefix ? `${prefix} ${msg.message}` : msg.message;
    setNewMessage(updatedMessage);
    setShowQuickMsgPopup(false);
  };

  const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'aguardando' | 'meus' | 'todos' | 'fechados'>('meus');
  const [unreadCounts, setUnreadCounts] = useState({ meus: 0, aguardando: 0, todos: 0 });
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
  const handleToggleSignature = async () => {
    const nextVal = !useSignature;
    setUseSignature(nextVal);
    
    const profileId = activeProfile?.id || profile?.id;
    if (!profileId) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ use_whatsapp_signature: nextVal })
        .eq('id', profileId);

      if (error) {
        console.error('Erro ao atualizar assinatura no banco:', error.message);
      }
    } catch (err) {
      console.error('Exceção ao atualizar assinatura no banco:', err);
    }
  };
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, conversationId: string, isMuted: boolean } | null>(null);
  const [nudgeCooldowns, setNudgeCooldowns] = useState<{ [key: string]: number }>({});
  const [cooldownTimeouts, setCooldownTimeouts] = useState<{ [key: string]: number }>({});
  const [forwardingMessage, setForwardingMessage] = useState<WhatsAppMessage | null>(null);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [forwardTargetSearch, setForwardTargetSearch] = useState('');
  const [forwardLoading, setForwardLoading] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferType, setTransferType] = useState<'agent' | 'queue'>('agent');
  const [transferSearch, setTransferSearch] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [convToClose, setConvToClose] = useState<string | null>(null);
  const [terminationReasons, setTerminationReasons] = useState<any[]>([]);
  const [selectedReasonId, setSelectedReasonId] = useState<string>('');

  const renderMessageText = (text: string) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        const url = part.startsWith('http') ? part : `https://${part}`;
        return (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline break-all font-bold">
            {part}
          </a>
        );
      }
      return part;
    });
  };

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
  const fetchConversationsRef = useRef<any>(null);
  useEffect(() => {
    fetchConversationsRef.current = fetchConversations;
  }, [fetchConversations]);

  // Canal access: list of {channel_id, can_send_messages, can_send_media, force_signature}
  const [channelAccess, setChannelAccess] = useState<any[]>([]);
  const [accessibleChannelIds, setAccessibleChannelIds] = useState<string[] | null>(null); // null = all
  const [filterPlatform, setFilterPlatform] = useState<string>('all'); // 'all' | 'whatsapp' | 'telegram' | 'instagram' | 'messenger'

  // Load channel access for non-admins
  useEffect(() => {
    const userId = activeProfile?.id || profile?.id;
    const companyId = activeProfile?.company_id || profile?.company_id;
    if (!userId || !companyId) return;
    if (isAdmin) {
      setAccessibleChannelIds(null); // admins see all
      return;
    }
    const loadChannelAccess = async () => {
      try {
        const { data } = await supabase
          .from('whatsapp_channel_users')
          .select('channel_id, can_send_messages, can_send_media, force_signature')
          .eq('user_id', userId)
          .eq('company_id', companyId);
        
        const profileAllowed = permissions?.allowed_connections || [];
        if (data && data.length > 0) {
          setChannelAccess(data);
          setAccessibleChannelIds(data.map((d: any) => d.channel_id));
        } else if (profileAllowed.length > 0) {
          setChannelAccess(profileAllowed.map((id: string) => ({ 
            channel_id: id, 
            can_send_messages: true, 
            can_send_media: true, 
            force_signature: false 
          })));
          setAccessibleChannelIds(profileAllowed);
        } else {
          setChannelAccess([]);
          setAccessibleChannelIds(null); // No connection restrictions, show all
        }
      } catch (err) {
        console.error('Erro ao buscar whatsapp_channel_users:', err);
        setChannelAccess([]);
        setAccessibleChannelIds(null);
      }
    };
    loadChannelAccess();
  }, [activeProfile?.id, profile?.id, isAdmin, permissions?.allowed_connections]);

  useEffect(() => {
    if (onConversationSelect) {
      onConversationSelect(!!selectedConversation);
    }
  }, [selectedConversation, onConversationSelect]);

  useEffect(() => {
    fetchSettings();
    fetchConversations();
    loadFiltersData();
    fetchTerminationReasons();
  }, []); // Run once on mount

  useEffect(() => {
    const companyId = currentUser?.company_id || profile?.company_id;
    if (!companyId) return;

    // Conversation list subscription com debounce para evitar spam de refetch
    const convSubscription = supabase
      .channel(`whatsapp_conversations_changes_${companyId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'whatsapp_conversations',
        filter: `company_id=eq.${companyId}`
      }, payload => {
        const userId = activeProfile?.id || profile?.id;
        
        // Se a conversa foi atualizada (UPDATE) e atribuída para o atendente logado, move pro "Meus"
        if (payload.eventType === 'UPDATE') {
          const isAssignedToMe = payload.new?.assigned_to === userId;
          
          if (isAssignedToMe) {
            // Tocar um som discreto de nova atribuição
            try {
              const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-120.wav');
              audio.volume = 0.4;
              audio.play().catch(() => {});
            } catch (e) {}

            setActiveTab('meus');
          }
        }

        // Se for um novo registro (INSERT), atualiza na hora para nao ter delay
        if (payload.eventType === 'INSERT') {
          fetchConversationsRef.current?.();
          return;
        }
        
        // Debounce: aguardar 600ms antes de refazer o fetch para updates/deletes
        if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = setTimeout(() => {
          fetchConversationsRef.current?.();
        }, 600);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(convSubscription);
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
    };
  }, [currentUser?.company_id, profile?.company_id, activeProfile?.id, profile?.id]); // Run when companyId is available

  useEffect(() => {
    // Message subscription - depends on selectedConversation
    if (!selectedConversation) return;

    const msgSubscription = supabase
      .channel(`whatsapp_messages_changes_${selectedConversation.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'whatsapp_messages', 
        filter: `conversation_id=eq.${selectedConversation.id}` 
      }, payload => {
        console.log('[WP-DEBUG] Nova mensagem/update recebida via Realtime', payload);
        const newMsg = payload.new as any; // Cast as any to avoid TS errors with missing type definitions
        
        // Aplicar filtro de privacidade do setor em tempo real
        const conn = connections.find(c => c.id === selectedConversation?.connection_id) || settings;
        if (conn?.isolate_chat_history && !isAdmin) {
          const allowedQueues = permissions.assigned_queues || [];
          if (newMsg && newMsg.queue_id !== null && !allowedQueues.includes(newMsg.queue_id)) {
            return;
          }
        }

        if (payload.eventType === 'INSERT') {
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id || (newMsg.whatsapp_message_id && (m as any).whatsapp_message_id === newMsg.whatsapp_message_id))) return prev;
            return [...prev, newMsg];
          });
        } else if (payload.eventType === 'UPDATE') {
          setMessages(prev => {
            const exists = prev.some(m => m.id === newMsg.id);
            if (!exists) return [...prev, newMsg];
            return prev.map(m => m.id === newMsg.id ? newMsg : m);
          });
        } else if (payload.eventType === 'DELETE') {
          const oldMsg = payload.old as any;
          setMessages(prev => prev.filter(m => m.id !== oldMsg.id));
        }
      })
      .subscribe((status) => {
        console.log(`[WP-DEBUG] Realtime Status (Mensagens): ${status}`);
      });

    return () => {
      supabase.removeChannel(msgSubscription);
    };
  }, [selectedConversation]);

  const shouldForceScrollRef = useRef(true);

  useEffect(() => {
    if (selectedConversation) {
      shouldForceScrollRef.current = true;
      fetchMessages(selectedConversation.id);
      fetchContactNotes(selectedConversation.id);
      markAsRead(selectedConversation.id);
      
      // Clear bell notifications for this conversation
      markNotificationsByLink('/whatspanda');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id]);

  // Forçar reconexão do realtime e recarregar dados do chat quando a aba é focada ou volta a ficar visível
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        console.log('[WP-DEBUG] App focado ou visível. Forçando conexão do Supabase Realtime...');
        try {
          supabase.realtime.connect();
        } catch (e) {
          console.error('[WP-DEBUG] Erro ao conectar realtime:', e);
        }
        
        // Recarrega conversas e mensagens ativamente
        if (typeof fetchConversationsRef.current === 'function') {
          fetchConversationsRef.current();
        }
        if (selectedConversation?.id) {
          console.log('[WP-DEBUG] Recarregando mensagens da conversa ativa por garantia:', selectedConversation.id);
          fetchMessages(selectedConversation.id);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [selectedConversation?.id]);

  const [isUserReading, setIsUserReading] = useState(false);

  useEffect(() => {
    if (shouldForceScrollRef.current) {
      scrollToBottom(true, 'auto');
      shouldForceScrollRef.current = false;
    } else if (!isUserReading) {
      scrollToBottom();
    }
  }, [messages]);

  const scrollToBottom = (force = false, behavior: 'smooth' | 'auto' = 'smooth') => {
    if (force) {
      // Força scroll apenas quando o user abre uma nova conversa ou envia mensagem
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior });
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
    const companyId = activeProfile?.company_id || profile?.company_id;
    if (!companyId) return;

    // Busca todos os canais da empresa
    const { data } = await supabase
      .from('whatsapp_settings')
      .select('*')
      .eq('company_id', companyId);

    if (data && data.length > 0) {
      setSettings(data[0]); // Mantém um padrão para a abertura de ticket
      setConnections(data); // Preenche os canais disponíveis para o filtro avançado
    }
  };

  const fetchTerminationReasons = async () => {
    const companyId = activeProfile?.company_id || profile?.company_id;
    if (!companyId) return;

    const { data } = await supabase
      .from('chat_termination_reasons')
      .select('*')
      .eq('company_id', companyId)
      .order('name');
    
    if (data) {
      setTerminationReasons(data);
    }
  };

  const handleOpenCloseModal = (conversationId: string) => {
    setConvToClose(conversationId);
    setSelectedReasonId('');
    fetchTerminationReasons();
    setIsCloseModalOpen(true);
  };
  
  const loadFiltersData = async () => {
    const companyId = currentUser?.company_id;
    if (!companyId) return;
    const userId = activeProfile?.id || profile?.id;

    const [{ data: qData }, { data: cols }, { data: agentsData }] = await Promise.all([
      supabase.from('whatsapp_queues').select('id, name, color').eq('company_id', companyId).eq('is_active', true).order('name'),
      supabase.from('whatsapp_kanban_columns').select('*').eq('company_id', companyId).order('order_index', { ascending: true }),
      supabase.from('profiles').select('id, full_name').eq('company_id', companyId)
    ]);
    if (qData) setQueues(qData);
    if (cols) setKanbanColumns(cols);
    if (agentsData) setAgents(agentsData);
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
  }, [searchTerm, activeTab, filterConnection, filterQueue, filterAssignee, chatTypeFilter, filterPlatform]);

  // Polling fallback para sincronização de lista de conversas (a cada 10 segundos)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations();
    }, 10000);
    return () => clearInterval(interval);
  }, [searchTerm, activeTab, filterConnection, filterQueue, filterAssignee, chatTypeFilter, filterPlatform]);

  useEffect(() => {
    if (type) {
      setChatTypeFilter(type as any);
    } else {
      setChatTypeFilter('all');
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
        queue:whatsapp_queues!queue_id(id, name, color),
        channel:whatsapp_settings!connection_id(channel_type, connection_name, is_connected),
        tags:whatsapp_conversation_tags(tag:whatsapp_tags(id, name, color)),
        kanban_column:whatsapp_kanban_columns!kanban_column_id(*)
      `)
      .eq('id', id)
      .single();

    if (data && !error) {
      setSelectedConversation(data as WhatsAppConversationWithDetails);
      if (data.status === 'fechado') {
        setActiveTab('fechados');
      } else {
        const userId = activeProfile?.id || profile?.id;
        if (data.assigned_to === userId) {
          setActiveTab('meus');
        } else if (data.assigned_to === null) {
          setActiveTab('aguardando');
        } else {
          if (isAdmin || permissions?.can_view_others_chats) {
            setActiveTab('todos');
          } else {
            setActiveTab('meus'); // fallback
          }
        }
      }
      // If it's a group, ensure the filter allows it
      if (data.is_group) {
        setChatTypeFilter('group');
      } else {
        setChatTypeFilter('private');
      }
    }
  };

   // --- Helpers ---
  const fixMediaUrl = (url?: string | null) => {
    if (!url) return '';
    let processedUrl = url;

    // 1. Resolve host base para Supabase interno
    const supabaseBaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    if (processedUrl.includes('supabase-kong:8000')) {
      processedUrl = processedUrl.replace('http://supabase-kong:8000', supabaseBaseUrl).replace('supabase-kong:8000', supabaseBaseUrl);
    }
    // 2. Se for path relativo
    if (processedUrl.startsWith('/storage/v1/')) {
        processedUrl = `${supabaseBaseUrl}${processedUrl}`;
    }

    // 3. FIX MASTER PARA VPS / MIXED CONTENT
    // Se o backend/DB salvou ou env de rede for HTTP (ex: http://77.37.43.60:8000), 
    // mas o painel estiver rodando em HTTPS (https://pandanet...), o browser vai bloquear.
    // Tenta contornar isso forçando https se for seguro ou via proxy do mesmo host!
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
        // Se a url original estiver apontando para um IP via HTTP puro 
        // e o sistema roda atrás de um proxy SSL, forçamos o path pelo mesmo host SSL
        if (processedUrl.startsWith('http://')) {
            // Em vez de falhar por Mixed Content pegando do IP direto,
            // redireciona a requisição de storage para o host atual, assumindo que NGINX roteia.
            // Extrai só a rota do storage (ex: /storage/v1/object/public/...)
            const storagePathMatch = processedUrl.match(/(\/storage\/v1\/.+)/);
            if (storagePathMatch) {
               processedUrl = `${window.location.origin}${storagePathMatch[1]}`;
            } else {
               // Fallback: força https cegamente
               processedUrl = processedUrl.replace('http://', 'https://');
            }
        }
    }

    return processedUrl;
  };

  const fetchUnreadCounts = async () => {
    const companyId = currentUser?.company_id || profile?.company_id;
    if (!companyId) return;
    const userId = activeProfile?.id || profile?.id;
    if (!userId) return;

    try {
      let query = supabase
        .from('whatsapp_conversations')
        .select('id, status, assigned_to, unread_count')
        .eq('company_id', companyId)
        .eq('status', 'aberto')
        .gt('unread_count', 0);

      if (!isAdmin && accessibleChannelIds !== null) {
        if (accessibleChannelIds.length === 0) {
          setUnreadCounts({ meus: 0, aguardando: 0, todos: 0 });
          return;
        }
        query = query.in('connection_id', accessibleChannelIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        const meus = data.filter(c => c.assigned_to === userId).length;
        const aguardando = data.filter(c => !c.assigned_to).length;
        const todos = data.length;
        setUnreadCounts({ meus, aguardando, todos });
      } else {
        setUnreadCounts({ meus: 0, aguardando: 0, todos: 0 });
      }
    } catch (err) {
      console.error('Erro ao buscar contagens de não lidas:', err);
    }
  };

  async function fetchConversations() {
    const companyId = currentUser?.company_id;
    if (!companyId) return;

    const userId = activeProfile?.id || profile?.id;

    let query = supabase
      .from('whatsapp_conversations')
      .select(`
        *,
        assigned_user:profiles!assigned_to(id, full_name, avatar_url),
        queue:whatsapp_queues!queue_id(id, name, color),
        channel:whatsapp_settings!connection_id(channel_type, connection_name, is_connected),
        tags:whatsapp_conversation_tags(tag:whatsapp_tags(id, name, color)),
        kanban_column:whatsapp_kanban_columns!kanban_column_id(*)
      `)
      .eq('company_id', companyId);

    // Se tiver filtrado conexões, aplica. Caso contrário mostra dos canais acessíveis
    if (filterConnection.length > 0) {
      query = query.in('connection_id', filterConnection);
    } else if (!isAdmin && accessibleChannelIds !== null) {
      // Usuário não-admin: só vê conversas dos canais que tem acesso
      if (accessibleChannelIds.length === 0) {
        // Sem acesso a nenhum canal: retorna vazio
        setConversations([]);
        setLoading(false);
        return;
      }
      query = query.in('connection_id', accessibleChannelIds);
    }

    // Plataforma selecionada: filtra pelos channel_ids daquela plataforma
    if (filterPlatform !== 'all') {
      const platformChannelIds = connections
        .filter((c: any) => (c.channel_type || 'whatsapp') === filterPlatform)
        .map((c: any) => c.id);
      if (platformChannelIds.length > 0) {
        query = query.in('connection_id', platformChannelIds);
      } else {
        // Nenhum canal dessa plataforma cadastrado
        setConversations([]);
        setLoading(false);
        return;
      }
    }

    if (activeTab === 'aguardando') {
      query = query.eq('status', 'aberto').is('assigned_to', null);
    } else if (activeTab === 'meus') {
      query = query.eq('status', 'aberto').eq('assigned_to', userId);
    } else if (activeTab === 'todos') {
      query = query.eq('status', 'aberto');
    } else if (activeTab === 'fechados') {
      query = query.eq('status', 'fechado');
    }

    // Filtro de filas/setores por permissão (para não administradores e apenas fora de "Meus")
    if (!isAdmin && activeTab !== 'meus') {
      const canSeeAll = permissions.can_see_all_departments === true;
      if (!canSeeAll) {
        const allowedQueues = permissions.assigned_queues || [];
        if (allowedQueues.length > 0) {
          query = query.or(`queue_id.in.(${allowedQueues.join(',')}),queue_id.is.null`);
        } else {
          query = query.is('queue_id', null);
        }
      }
    }

    // Pesquisa por nome ou telefone
    if (searchTerm) {
      query = query.or(`contact_name.ilike.%${searchTerm}%,contact_phone.ilike.%${searchTerm}%`);
    }
    
    // Filtros de departamento
    if (filterQueue.length > 0) query = query.in('queue_id', filterQueue);

    // Filtra pelo tipo de chat selecionado
    if (chatTypeFilter === 'group') {
      query = query.eq('is_group', true);
    } else if (chatTypeFilter === 'private') {
      query = query.or('is_group.eq.false,is_group.is.null');
    }

    const { data, error } = await query.order('last_message_at', { ascending: false });
    
    if (error) {
      console.error('[WP] Erro ao buscar conversas:', error.message);
    }
    
    if (data) {
      setConversations(data as WhatsAppConversationWithDetails[]);
    }
    setLoading(false);
    fetchUnreadCounts();
  }

  const handleMuteToggle = async (conversationId: string, currentMuteStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('whatsapp_conversations')
        .update({ is_muted: !currentMuteStatus })
        .eq('id', conversationId);

      if (error) throw error;

      setConversations(prev => prev.map(c => 
        c.id === conversationId ? { ...c, is_muted: !currentMuteStatus } : c
      ));

      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(prev => prev ? { ...prev, is_muted: !currentMuteStatus } : null);
      }
      
      setContextMenu(null);
    } catch (err: any) {
      console.error('Erro ao silenciar:', err);
    }
  };

  const handleUpdateStatus = async (
    conversationId: string, 
    newStatus: 'aberto' | 'fechado', 
    assignToMe: boolean = false,
    reasonId?: string | null,
    reasonName?: string | null
  ) => {
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
      
      // Finalizar: desvincula o setor (queue_id), atendente (assigned_to) e reseta o chatbot_node_id para recomeçar o fluxo do bot
      if (newStatus === 'fechado') {
        updateData.assigned_to = null;
        updateData.queue_id = null;
        updateData.chatbot_node_id = null;
        updateData.closed_at = new Date().toISOString();
        updateData.closed_by = activeProfile?.id || profile?.id || null;
        updateData.termination_reason_id = reasonId || null;
        updateData.termination_reason = reasonName || null;
      }

      if (newStatus === 'aberto') {
        updateData.termination_reason_id = null;
        updateData.termination_reason = null;
        updateData.closed_at = null;
        updateData.closed_by = null;
      }

      // Enviar mensagem de encerramento se configurado no canal
      const targetConv = conversations.find(c => c.id === conversationId) || selectedConversation;
      const conn = targetConv ? (connections.find(c => c.id === targetConv.connection_id) || settings) : null;
      const closeMsg = conn?.close_message;

      if (newStatus === 'fechado' && closeMsg && closeMsg.trim()) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (token) {
          const res = await fetch(`/api/whatsapp/messages/send/${conversationId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
              message: closeMsg.trim(),
              keepClosed: true
            })
          });
          if (!res.ok) {
            throw new Error('Falha ao enviar mensagem de encerramento automática pelo servidor.');
          }
        } else {
          throw new Error('Usuário não autenticado.');
        }
      } else {
        const { error } = await supabase
          .from('whatsapp_conversations')
          .update(updateData)
          .eq('id', conversationId);

        if (error) throw error;
      }

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

  const handleTransfer = async (targetId: string, type: 'agent' | 'queue') => {
    if (!selectedConversation || isGhostMode) return;
    setTransferLoading(true);
    try {
      // 1. Resolver o nome do destino
      let targetName = 'outro';
      if (type === 'agent') {
        const agent = agents.find((a: any) => a.id === targetId);
        targetName = agent?.full_name || 'outro atendente';
      } else {
        const queue = queues.find((q: any) => q.id === targetId);
        targetName = queue?.name || 'outro setor';
      }

      // 2. Buscar configurações de transferência do canal
      const { data: connSettings } = await supabase
        .from('whatsapp_settings')
        .select('transfer_message_client, transfer_message_agent, send_transfer_message_to_client')
        .eq('id', selectedConversation.connection_id)
        .maybeSingle();

      const clientTpl = connSettings?.transfer_message_client || 'Seu atendimento foi transferido para {target}. Por favor, aguarde.';
      const agentTpl = connSettings?.transfer_message_agent || 'Atendimento transferido para {target} por {sender}.';
      const sendToClient = connSettings?.send_transfer_message_to_client !== false;

      const senderName = activeProfile?.full_name || profile?.full_name || 'Atendente';
      const formattedClient = clientTpl.replace(/{target}/g, targetName).replace(/{sender}/g, senderName);
      const formattedAgent = agentTpl.replace(/{target}/g, targetName).replace(/{sender}/g, senderName);

      // 3. Atualizar a conversa no banco
      const updateData: any = type === 'agent'
        ? { assigned_to: targetId }
        : { queue_id: targetId, assigned_to: null };
      
      const { error } = await supabase
        .from('whatsapp_conversations')
        .update(updateData)
        .eq('id', selectedConversation.id);

      if (error) throw error;

      // 4. Inserir log interno no chat
      const logQueueId = type === 'queue' ? targetId : selectedConversation.queue_id;
      await supabase.from('whatsapp_messages').insert({
        conversation_id: selectedConversation.id,
        company_id: currentUser?.company_id || profile?.company_id,
        message_text: formattedAgent,
        is_from_customer: false,
        sent_by: activeProfile?.id || profile?.id,
        queue_id: logQueueId || null
      });

      // 5. Enviar mensagem de transferência ao cliente via WhatsApp
      if (sendToClient) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (token) {
          fetch(`/api/whatsapp/messages/send/${selectedConversation.id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
              message: formattedClient
            })
          }).catch(e => console.error('Error sending client transfer message:', e));
        }
      }

      setIsTransferModalOpen(false);
      setTransferSearch('');
      setTimeout(() => fetchConversations(), 300);
    } catch (err: any) {
      alert('Erro ao transferir: ' + err.message);
    } finally {
      setTransferLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string, silent: boolean = false) => {
    const companyId = currentUser?.company_id;
    if (!companyId) return;

    if (!silent) setLoadingMessages(true);
    
    let query = supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('company_id', companyId);

    // Filtrar mensagens por privacidade de setor (se isolate_chat_history estiver ativo e o usuário não for Admin)
    const conn = connections.find(c => c.id === selectedConversation?.connection_id) || settings;
    if (conn?.isolate_chat_history && !isAdmin) {
      const allowedQueues = permissions.assigned_queues || [];
      if (allowedQueues.length > 0) {
        const allowedQueuesStr = allowedQueues.map((id: string) => `"${id}"`).join(',');
        query = query.or(`queue_id.is.null,queue_id.in.(${allowedQueuesStr})`);
      } else {
        query = query.is('queue_id', null);
      }
    }

    const { data, error } = await query.order('created_at', { ascending: true });
    
    if (data) setMessages(data);
    if (!silent) setLoadingMessages(false);
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

  const handleSaveEdit = async (msgId: string) => {
    if (!editingText.trim()) return;
    const { error } = await supabase
      .from('whatsapp_messages')
      .update({ message_text: editingText })
      .eq('id', msgId);

    if (error) {
      console.error('Erro ao editar mensagem:', error);
      alert('Erro ao editar mensagem: ' + error.message);
    } else {
      setEditingMessageId(null);
      setEditingText('');
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta mensagem?')) return;
    const { error } = await supabase
      .from('whatsapp_messages')
      .delete()
      .eq('id', msgId);

    if (error) {
      console.error('Erro ao excluir mensagem:', error);
      alert('Erro ao excluir mensagem: ' + error.message);
    }
  };

  useEffect(() => {
    const handleCloseMenu = () => setMessageContextMenu(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [selectedConvTags, setSelectedConvTags] = useState<string[]>([]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation?.id]);

  // Polling fallback para sincronização de novas mensagens na conversa ativa (a cada 5 segundos)
  useEffect(() => {
    if (!selectedConversation?.id) return;
    const interval = setInterval(() => {
      fetchMessages(selectedConversation.id, true); // silent = true para não exibir spinner
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedConversation?.id]);

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

  const handleExportPDF = () => {
    if (!selectedConversation || !messages.length) return;

    const doc = new jsPDF();
    const contactName = selectedConversation.contact_name || selectedConversation.contact_phone;
    const date = new Date().toLocaleDateString('pt-BR');
    const time = new Date().toLocaleTimeString('pt-BR');

    // Cabeçalho do PDF
    doc.setFontSize(20);
    doc.setTextColor(16, 185, 129); // Emerald 500
    doc.text('Relatório de Atendimento - WhatsPanda', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${date} às ${time}`, 14, 30);

    // Informações do Contato
    autoTable(doc, {
      startY: 40,
      head: [['Campo', 'Informação']],
      body: [
        ['Cliente', contactName],
        ['Telefone', selectedConversation.contact_phone],
        ['Canal', selectedConversation.channel?.connection_name || 'WhatsApp'],
        ['Atendente', selectedConversation.assigned_user?.full_name || 'Não atribuído'],
        ['Setor', selectedConversation.queue?.name || 'Geral'],
        ['Status', selectedConversation.status === 'fechado' ? 'Finalizado' : selectedConversation.status === 'pendente' ? 'Aguardando' : 'Aberto'],
      ],
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] },
    });

    // Histórico de Mensagens
    const messageBody = messages.map(msg => [
      new Date(msg.created_at).toLocaleString('pt-BR'),
      msg.is_from_customer ? 'Cliente' : 'Atendente',
      msg.message_text || (msg.media_url ? '[Arquivo/Mídia]' : '')
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 15,
      head: [['Data/Hora', 'Remetente', 'Mensagem']],
      body: messageBody,
      theme: 'grid',
      headStyles: { fillColor: [100, 116, 139] }, // Slate 500
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 30 },
        2: { cellWidth: 'auto' }
      },
      styles: { fontSize: 9 }
    });

    doc.save(`atendimento-${contactName}-${date}.pdf`);
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

  const startRecording = async () => {
    if (isGhostMode) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else {
          mimeType = '';
        }
      }

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
          await handleSendAudio(audioBlob);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Erro ao acessar microfone:', err);
      alert('Não foi possível acessar o microfone. Verifique as permissões do navegador.');
    }
  };

  const stopRecording = (shouldSend: boolean) => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      if (!shouldSend) {
        audioChunksRef.current = [];
      }
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleSendAudio = async (blob: Blob) => {
    if (!selectedConversation || !currentUser?.company_id) return;
    try {
      let fileExt = 'webm';
      if (blob.type.includes('ogg')) fileExt = 'ogg';
      else if (blob.type.includes('mp4')) fileExt = 'mp4';
      else if (blob.type.includes('mpeg') || blob.type.includes('mp3')) fileExt = 'mp3';

      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `whatsapp/${selectedConversation.id}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
          .from('chat-media')
          .upload(filePath, blob, {
              contentType: blob.type
          });

      if (uploadError) {
          console.error('Falha no upload do áudio:', uploadError);
          alert(`Erro ao subir áudio: ${uploadError.message}`);
          return;
      }

      const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(filePath);

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
              message: '',
              mediaUrl: publicUrl,
              mediaType: blob.type
          })
      });

      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to send audio');
      }

      fetchMessages(selectedConversation.id);
      scrollToBottom(true, 'smooth');
    } catch (error) {
        console.error('Error sending audio message:', error);
        alert('Erro ao enviar áudio.');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSendMessage = async (e?: React.FormEvent, type: 'text' | 'sticker' = 'text', content?: string) => {
    if (isGhostMode) {
      alert('Modo Auditoria: O envio de mensagens está desabilitado.');
      return;
    }
    if (isSending) return; // Evita duplo envio concorrente no frontend
    
    if (e) e.preventDefault();
    if (!newMessage.trim() && !attachedFile && type !== 'sticker') return;
    if (!selectedConversation || !currentUser?.company_id) return;

    const messageText = type === 'text' ? newMessage : '';
    const stickerUrl = type === 'sticker' ? content : null;
    const isSticker = type === 'sticker';


    let messageWithSignature = messageText;

    // Assinatura: verifica force_signature no canal da conversa, ou se o usuário ativou manualmente
    const channelPerms = channelAccess.find((ca: any) => ca.channel_id === selectedConversation.connection_id);
    const forceSig = channelPerms?.force_signature === true;
    const senderName = activeProfile?.full_name || profile?.full_name || activeProfile?.name || profile?.name || '';
    const autoSignature = forceSig && senderName ? `*${senderName}*` : null;
    const effectiveSignature = autoSignature || (useSignature && signatureText.trim() ? signatureText.trim() : null);

    if (messageText && effectiveSignature && !isSticker) {
      messageWithSignature = `${messageText}\n\n${effectiveSignature}`;
    }

    setIsSending(true);
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
                console.log(`[SEND] Upload OK. URL: ${publicUrl} | MIME: ${fileType}`);
            } else {
                console.error('[SEND] Upload retornou sem dados e sem erro.');
                alert('Erro inesperado no upload do arquivo. Tente novamente.');
                return;
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
            let errorMsg = `HTTP ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorData.details || JSON.stringify(errorData);
            } catch (_) {
                errorMsg = await response.text().catch(() => errorMsg);
            }
            throw new Error(errorMsg);
        }

        setNewMessage('');
        setAttachedFile(null);
        setShowStickerPicker(false);
        // Recarregar mensagens após o envio
        fetchMessages(selectedConversation.id);
        // Forçar scroll para baixo para ver a própria mensagem enviada
        scrollToBottom(true, 'smooth');
    } catch (error: any) {
        console.error('Error sending message:', error);
        alert(`Erro ao enviar mensagem: ${error?.message || error}`);
    } finally {
        setIsSending(false);
    }
  };

  const handleForward = async (targetConversationId: string) => {
    if (!forwardingMessage || isGhostMode) return;
    setForwardLoading(true);
    
    try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error("No active session");

        const response = await fetch(`/api/whatsapp/messages/send/${targetConversationId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                message: forwardingMessage.message_text,
                mediaUrl: forwardingMessage.media_url,
                mediaType: forwardingMessage.media_type
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to forward message');
        }

        setIsForwardModalOpen(false);
        setForwardingMessage(null);
        alert('Mensagem encaminhada com sucesso!');
        
        if (selectedConversation?.id === targetConversationId) {
            fetchMessages(targetConversationId);
        }
    } catch (error: any) {
        console.error('Error forwarding message:', error);
        alert('Erro ao encaminhar: ' + error.message);
    } finally {
        setForwardLoading(false);
    }
  };

  const filteredConversations = conversations; // Already filtered by fetchConversations

  return (
    <div className="flex h-full bg-[#f8fafc] dark:bg-transparent overflow-hidden relative font-sans text-brand-text transition-colors duration-500">
      {/* Middle Section: Conversations List */}
      <div className={`${selectedConversation ? 'hidden lg:flex' : 'flex'} w-full md:w-[320px] lg:w-[360px] bg-white dark:bg-slate-900/40 backdrop-blur-xl border-r border-slate-200 dark:border-white/5 flex-col shadow-[2px_0_15px_rgba(0,0,0,0.02)] z-10 transition-all duration-500`}>
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
          
          {/* Platform Filter Pills - shown only if company has multiple platform types */}
          {(() => {
            const platformTypes = [...new Set(connections.map((c: any) => c.channel_type || 'whatsapp'))];
            if (platformTypes.length <= 1) return null;
            const platformConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
              whatsapp:  { label: 'WhatsApp',  color: 'emerald', icon: <Smartphone className="w-3 h-3" /> },
              telegram:  { label: 'Telegram',  color: 'blue',    icon: <Send className="w-3 h-3" /> },
              instagram: { label: 'Instagram', color: 'pink',    icon: <Instagram className="w-3 h-3" /> },
              messenger: { label: 'Messenger', color: 'indigo',  icon: <MessageCircle className="w-3 h-3" /> },
            };
            return (
              <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar pb-0.5">
                <button
                  onClick={() => setFilterPlatform('all')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all whitespace-nowrap ${
                    filterPlatform === 'all'
                      ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900 dark:border-white'
                      : 'bg-white dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10 hover:border-slate-400'
                  }`}
                >
                  Todos
                </button>
                {platformTypes.map(pt => {
                  const cfg = platformConfig[pt] || { label: pt, color: 'gray', icon: <MessageCircle className="w-3 h-3" /> };
                  const active = filterPlatform === pt;
                  const colorMap: Record<string, string> = {
                    emerald: active ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white dark:bg-white/5 text-emerald-600 border-emerald-200 hover:border-emerald-400',
                    blue:    active ? 'bg-blue-500 text-white border-blue-500'       : 'bg-white dark:bg-white/5 text-blue-600 border-blue-200 hover:border-blue-400',
                    pink:    active ? 'bg-pink-500 text-white border-pink-500'       : 'bg-white dark:bg-white/5 text-pink-600 border-pink-200 hover:border-pink-400',
                    indigo:  active ? 'bg-indigo-500 text-white border-indigo-500'   : 'bg-white dark:bg-white/5 text-indigo-600 border-indigo-200 hover:border-indigo-400',
                    gray:    active ? 'bg-gray-700 text-white border-gray-700'       : 'bg-white dark:bg-white/5 text-gray-600 border-gray-200 hover:border-gray-400',
                  };
                  return (
                    <button
                      key={pt}
                      onClick={() => setFilterPlatform(active ? 'all' : pt)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all whitespace-nowrap ${colorMap[cfg.color] || colorMap.gray}`}
                    >
                      {cfg.icon}
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* Tabs */}
          <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl shadow-inner border border-transparent dark:border-white/5">
            {((isAdmin || permissions?.can_view_others_chats)
              ? (['meus', 'aguardando', 'todos', 'fechados'] as const)
              : (['meus', 'aguardando', 'fechados'] as const)
            ).map((tab) => {
              const badgeCount = unreadCounts[tab as keyof typeof unreadCounts] || 0;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-xl capitalize transition-all duration-300 ${activeTab === tab
                    ? 'bg-white dark:bg-emerald-500 text-emerald-600 dark:text-white shadow-xl scale-[1.02]'
                    : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5'
                  }`}
                >
                  <span>{tab}</span>
                  {badgeCount > 0 && (
                    <span className={`flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold ${
                      activeTab === tab 
                        ? 'bg-emerald-600 dark:bg-white text-white dark:text-emerald-500' 
                        : 'bg-red-500 text-white animate-pulse'
                    }`}>
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
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
          {isAdmin && !isGhostMode && (activeTab === 'aguardando' || activeTab === 'meus') && filteredConversations.length > 0 && (
            <button
              onClick={async () => {
                if (!confirm(`Deseja fechar TODOS os ${filteredConversations.length} atendimentos visíveis?\n\nEles irão para a aba "Fechados".`)) return;
                try {
                  const ids = filteredConversations.map(c => c.id);
                  // Dividir em blocos de 50 IDs para evitar erro 414 do Nginx
                  const chunkSize = 50;
                  for (let i = 0; i < ids.length; i += chunkSize) {
                    const chunk = ids.slice(i, i + chunkSize);
                    const { error } = await supabase
                      .from('whatsapp_conversations')
                      .update({ 
                        status: 'fechado',
                        assigned_to: null,
                        queue_id: null,
                        chatbot_node_id: null
                      })
                      .in('id', chunk);
                    if (error) throw error;
                  }
                  setConversations([]);
                  setSelectedConversation(null);
                } catch (err: any) {
                  alert('Erro: ' + err.message);
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-1.5 text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 dark:text-amber-400 rounded-lg transition-colors border border-amber-100 dark:border-amber-500/20"
            >
              ✓ FECHAR TODOS OS TICKETS ({filteredConversations.length})
            </button>
          )}
          {isAdmin && activeTab === 'fechados' && (
            <button
              onClick={async () => {
                  if (isGhostMode) return;
                  if (!confirm('Apagar permanentemente todos os atendimentos fechados?\n\nEsta ação não pode ser desfeita.')) return;
                  try {
                    const companyId = currentUser?.company_id;
                    if (!companyId) return;

                    const { data: closedConvs } = await supabase
                      .from('whatsapp_conversations')
                      .select('id')
                      .eq('company_id', companyId)
                      .eq('status', 'fechado');
                    
                    const ids = (closedConvs || []).map(c => c.id);
                    if (ids.length > 0) {
                      // Dividir em blocos de 50 IDs para evitar erro 414 do Nginx
                      const chunkSize = 50;
                      for (let i = 0; i < ids.length; i += chunkSize) {
                        const chunk = ids.slice(i, i + chunkSize);
                        await supabase.from('whatsapp_messages').delete().in('conversation_id', chunk);
                        await supabase.from('whatsapp_conversation_tags').delete().in('conversation_id', chunk);
                        await supabase.from('whatsapp_contact_notes').delete().in('conversation_id', chunk);
                        await supabase.from('whatsapp_conversations').delete().in('id', chunk);
                      }
                    }
                    setConversations([]);
                    setSelectedConversation(null);
                    alert('Atendimentos fechados apagados com sucesso.');
                  } catch (err: any) {
                    alert('Erro ao limpar: ' + err.message);
                  }
              }}
              className="w-full flex items-center justify-center gap-2 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-100"
            >
              🗑 APAGAR PERMANENTEMENTE (FECHADOS)
            </button>
          )}
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-2 bg-slate-50/50 dark:bg-transparent">
          {filteredConversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setSelectedConversation(conv)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, conversationId: conv.id, isMuted: !!conv.is_muted });
              }}
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
                <div className="flex items-center gap-1.5 mt-1">
                  {conv.is_muted && <BellOff className="w-3 h-3 text-slate-400" />}
                  <span className={`text-[10px] font-medium uppercase tracking-widest whitespace-nowrap ${selectedConversation?.id === conv.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                      {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
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
                    {conv.queue && (
                      <span className="text-[9px] px-2 py-0.5 rounded-md border font-bold flex items-center gap-1 shadow-sm"
                        style={{
                          backgroundColor: `${conv.queue.color}15`,
                          color: conv.queue.color,
                          borderColor: `${conv.queue.color}30`
                        }}
                      >
                        <LayoutGrid className="w-2.5 h-2.5" style={{ color: conv.queue.color }} />
                        {conv.queue.name}
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
      <div className={`${selectedConversation ? 'flex' : 'hidden lg:flex'} flex-1 flex flex-col bg-[#F3F6F8] dark:bg-[#020617] relative transition-colors duration-500`} style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundRepeat: 'repeat', opacity: 1 }}>
        <div className="absolute inset-0 bg-white/70 dark:bg-[#020617]/90 pointer-events-none" /> {/* Overlay to soften the background */}

        {selectedConversation ? (
          <div className="relative z-10 flex flex-col h-full"> {/* Container for z-index */}
            {/* Chat Header */}
            <div className="px-3 py-2 sm:px-6 sm:py-4 bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 flex justify-between items-center shadow-lg z-20 min-w-0 w-full">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="p-1 sm:p-2 -ml-1 sm:-ml-2 lg:hidden hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-9 h-9 sm:w-12 sm:h-12 bg-gray-100 dark:bg-white/5 rounded-full hidden sm:flex items-center justify-center text-slate-400 shrink-0 ring-2 ring-white dark:ring-white/10 shadow-lg overflow-hidden transition-all duration-300">
                  <User className="w-4 h-4 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0 flex flex-col flex-1">
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm sm:text-lg truncate leading-tight tracking-tight">{selectedConversation.contact_name || selectedConversation.contact_phone}</h3>
                  <div className="hidden sm:flex flex-wrap items-center gap-1 mt-0.5 sm:mt-1 max-w-full">
                    <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-gray-400 truncate opacity-80">{selectedConversation.contact_phone}</p>

                    {selectedConversation.channel && (
                      <span className="text-[9px] sm:text-[10px] bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-gray-300 font-bold px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full border border-slate-200 dark:border-white/5 flex items-center gap-1 uppercase tracking-wider shadow-sm truncate max-w-[80px] sm:max-w-none" title={selectedConversation.channel.connection_name || 'WhatsApp'}>
                        {selectedConversation.channel.channel_type === 'instagram' ? <Instagram className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-pink-500" /> :
                          selectedConversation.channel.channel_type === 'messenger' ? <MessageCircle className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-blue-500" /> :
                            selectedConversation.channel.channel_type === 'telegram' ? <Send className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-sky-500" /> :
                              <Smartphone className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-emerald-500" />}
                        <span className="truncate">{selectedConversation.channel.connection_name || 'WhatsApp'}</span>
                      </span>
                    )}

                    {selectedConversation.assigned_user && (
                      <span className="text-[9px] sm:text-[10px] bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 font-bold px-1.5 sm:px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-500/30 flex items-center gap-0.5 shadow-sm truncate max-w-[80px] sm:max-w-none" title={selectedConversation.assigned_user.full_name}>
                        <User className="w-2.5 h-2.5" />
                        <span className="truncate">{selectedConversation.assigned_user.full_name.split(' ')[0]}</span>
                      </span>
                    )}
                    {selectedConversation.queue && (
                      <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2.5 py-0.5 rounded-full border truncate max-w-[80px] sm:max-w-none"
                        style={{
                          backgroundColor: `${selectedConversation.queue.color}15`,
                          color: selectedConversation.queue.color,
                          borderColor: `${selectedConversation.queue.color}30`
                        }}
                        title={selectedConversation.queue.name}
                      >
                        <span className="truncate">{selectedConversation.queue.name}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-1 sm:gap-2 items-center flex-shrink-0">
                {!selectedConversation.assigned_user && selectedConversation.status === 'aberto' && !isGhostMode && (
                  <button
                    onClick={() => handleUpdateStatus(selectedConversation.id, 'aberto', true)}
                    className="px-2 sm:px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-lg shadow-lg shadow-emerald-500/20 transition-all whitespace-nowrap"
                  >
                    Aceitar
                  </button>
                )}
                <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-0.5 sm:mx-1 hidden sm:block" />
                <div className="flex gap-0.5 sm:gap-1.5 items-center">
                  {!isGhostMode && selectedConversation.status !== 'fechado' && (
                    <button
                      onClick={() => handleOpenCloseModal(selectedConversation.id)}
                      className="p-1 sm:p-2 rounded-full hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-500 transition-colors"
                      title="Encerrar Atendimento"
                    >
                      <CheckCheck className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                    </button>
                  )}
                  {/* Botão Reabrir - aparece apenas quando fechado */}
                  {!isGhostMode && selectedConversation.status === 'fechado' && (
                    <button
                      onClick={() => handleUpdateStatus(selectedConversation.id, 'aberto')}
                      className="px-2 sm:px-4 py-1 sm:py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-lg shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-1"
                      title="Reabrir Atendimento"
                    >
                      <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <span className="hidden sm:inline">Reabrir</span>
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={handleExportPDF}
                      className="p-1 sm:p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors hidden sm:block"
                      title="Exportar Relatório PDF"
                    >
                      <Download className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                    </button>
                  )}
                  {!isGhostMode && (
                    <button
                      onClick={() => {
                        setIsTransferModalOpen(true);
                        setTransferSearch('');
                      }}
                      className="p-1 sm:p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
                      title="Transferir Atendimento"
                    >
                      <CornerUpRight className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                    </button>
                  )}
                  <button
                    onClick={() => setShowContactSidebar(!showContactSidebar)}
                    className={`p-1 sm:p-2 rounded-full transition-colors ${showContactSidebar ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-slate-100 text-slate-500'}`}
                    title="Informações do Contato"
                  >
                    <Info className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
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
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMessageContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        message: msg
                      });
                    }}
                    className={`p-3 md:p-4 rounded-2xl shadow-sm border cursor-context-menu ${
                      msg.is_from_customer
                      ? 'bg-white dark:bg-white/5 text-slate-800 dark:text-slate-100 rounded-tl-sm border-gray-100 dark:border-white/5'
                      : (msg.media_type === 'sticker' || msg.media_type === 'gif' || msg.media_url?.toLowerCase().endsWith('.gif'))
                        ? 'bg-transparent shadow-none border-0 p-0 overflow-visible'
                        : 'bg-emerald-100/90 dark:bg-emerald-500/20 text-slate-800 dark:text-emerald-50 rounded-tr-sm border-emerald-200/50 dark:border-emerald-500/20'
                    }`}
                  >
                    <div className="space-y-2">
                      {selectedConversation?.is_group && msg.is_from_customer && (msg.sender_name || msg.sender_phone) && (
                        <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                          {msg.sender_name || (() => {
                            const clean = (msg.sender_phone || '').replace(/\D/g, '');
                            if (clean.length === 12 && clean.startsWith('55')) {
                              return `+${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, 8)}-${clean.slice(8)}`;
                            } else if (clean.length === 13 && clean.startsWith('55')) {
                              return `+${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, 9)}-${clean.slice(9)}`;
                            }
                            return msg.sender_phone;
                          })()}
                        </div>
                      )}
                      {msg.media_type === 'gif' ? (
                        <div className="relative group inline-block" onClick={() => setSelectedMedia({ url: fixMediaUrl(msg.media_url)!, type: 'video' })}>
                          <video
                            src={fixMediaUrl(msg.media_url)}
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="rounded-xl h-auto object-contain cursor-pointer border border-white/10 shadow-sm max-h-[250px] max-w-[200px] md:max-w-[300px] hover:opacity-90 transition-opacity border-0 shadow-none bg-transparent"
                          />
                          <a 
                            href={fixMediaUrl(msg.media_url)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="absolute bottom-2 right-2 p-1.5 bg-black/40 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      ) : (msg.media_type?.includes('image') || msg.media_type === 'sticker' || (msg.media_url && typeof msg.media_url === 'string' && msg.media_url.match(/\.(jpeg|jpg|gif|png|webp)$/i))) ? (
                        <div className={`relative group inline-block`} onClick={() => setSelectedMedia({ url: fixMediaUrl(msg.media_url)!, type: 'image' })}>
                          <img 
                            src={fixMediaUrl(msg.media_url)} 
                            alt="Mídia" 
                            className={`rounded-xl h-auto object-contain cursor-pointer border border-white/10 shadow-sm max-h-[250px] max-w-[200px] md:max-w-[300px] hover:opacity-90 transition-opacity ${
                              (msg.media_type === 'sticker' || msg.media_type === 'gif' || msg.media_url?.toLowerCase().endsWith('.gif')) 
                              ? 'border-0 shadow-none bg-transparent' 
                              : ''
                            }`}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = 'https://placehold.co/200x250/22c55e/ffffff?text=Falha+na+Imagem';
                              target.title = 'Erro ao carregar imagem';
                            }}
                          />
                          <a 
                            href={fixMediaUrl(msg.media_url)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="absolute bottom-2 right-2 p-1.5 bg-black/40 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      ) : (msg.media_type?.includes('audio') || (msg.media_url && typeof msg.media_url === 'string' && msg.media_url.match(/\.(ogg|mp3|wav|m4a)$/i))) ? (
                        <div className="flex flex-col gap-1 min-w-[200px] p-1">
                          <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tight">
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>Áudio</span>
                            </div>
                            <a 
                              href={fixMediaUrl(msg.media_url)} 
                              download 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-[10px] text-slate-400 hover:text-emerald-500 transition-colors"
                            >
                              <Download className="w-3 h-3" />
                            </a>
                          </div>
                          <audio controls className="w-full h-8 brightness-95 opacity-90 hover:opacity-100 transition-opacity">
                            <source src={fixMediaUrl(msg.media_url)} />
                            Seu navegador não suporta áudio.
                          </audio>
                        </div>
                      ) : (msg.media_type?.includes('video') || (msg.media_url && typeof msg.media_url === 'string' && msg.media_url.match(/\.(mp4|mov|avi|webm)$/i))) ? (
                        <div className="relative group rounded-xl overflow-hidden shadow-sm cursor-pointer" onClick={() => setSelectedMedia({ url: fixMediaUrl(msg.media_url)!, type: 'video' })}>
                          <video 
                            className="max-h-[250px] max-w-[200px] md:max-w-[300px] object-cover pointer-events-none"
                            preload="metadata"
                            onError={(e) => {
                              console.error('Erro ao carregar miniatura do vídeo');
                            }}
                          >
                            <source src={fixMediaUrl(msg.media_url)} type="video/mp4" />
                            Seu navegador não suporta vídeos.
                          </video>
                          {/* Botão de play estilizado no centro para indicar miniatura de vídeo */}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors pointer-events-none">
                            <div className="w-12 h-12 rounded-full bg-white/40 flex items-center justify-center backdrop-blur-md">
                              <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent ml-1" />
                            </div>
                          </div>
                        </div>
                      ) : msg.media_url ? (
                        <a 
                          href={fixMediaUrl(msg.media_url)} 
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

                      {editingMessageId === msg.id ? (
                        <div className="space-y-2 min-w-[220px]" onClick={(e) => e.stopPropagation()}>
                          <textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            style={{ fontSize: `${chatFontSize}px` }}
                            className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 dark:text-white resize-none"
                            rows={3}
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setEditingMessageId(null);
                                setEditingText('');
                              }}
                              className="px-2.5 py-1 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleSaveEdit(msg.id)}
                              className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg shadow-md shadow-emerald-500/10 transition-colors"
                            >
                              Salvar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {msg.message_text && (
                            <p 
                              style={{ fontSize: `${chatFontSize}px` }}
                              className={`font-medium leading-relaxed whitespace-pre-wrap ${(msg.media_type === 'sticker' || msg.media_type === 'gif' || msg.media_url?.toLowerCase().endsWith('.gif')) ? 'mt-2 p-3 bg-emerald-100/90 dark:bg-emerald-500/20 rounded-2xl text-slate-800 dark:text-emerald-50' : ''}`}
                            >
                              {renderMessageText(msg.message_text)}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                    <div className={`flex justify-end items-center gap-1.5 mt-2 opacity-60 ${
                      (msg.media_type === 'sticker' || msg.media_type === 'gif' || msg.media_url?.toLowerCase().endsWith('.gif')) 
                      ? 'bg-black/20 dark:bg-white/10 px-2 py-0.5 rounded-full w-fit ml-auto' 
                      : ''
                    }`}>
                      <span className="text-[10px] font-medium uppercase tracking-tight">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {!msg.is_from_customer && (
                        <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                      )}
                      
                      <button 
                        onClick={() => {
                          setForwardingMessage(msg);
                          setIsForwardModalOpen(true);
                        }}
                        className="ml-2 p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
                        title="Encaminhar"
                      >
                        <Share2 className="w-3 h-3 text-slate-400" />
                      </button>
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

                {isRecording ? (
                  <div className="flex-1 flex items-center justify-between px-3 py-1.5 md:py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-sm font-bold text-red-500 dark:text-red-400">
                        Gravando ({formatTime(recordingTime)})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => stopRecording(false)}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-500/20 text-slate-500 hover:text-red-500 rounded-xl transition-all"
                        title="Cancelar Gravação"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => stopRecording(true)}
                        className="p-2.5 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 shadow-md shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center"
                        title="Enviar Áudio"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={`p-2.5 md:p-3 rounded-2xl transition-all duration-300 ${canSendMedia ? 'hover:bg-brand-primary/10 text-slate-500 dark:text-gray-400 hover:text-brand-primary' : 'opacity-50 cursor-not-allowed text-slate-300'}`}
                      disabled={!canSendMedia}
                      title={!canSendMedia ? "Anexar Arquivo" : "Anexar Arquivo"}
                    >
                      <Paperclip className="w-5 h-5 md:w-5 md:h-5" />
                    </button>

                    <button
                      onClick={() => setShowStickerPicker(!showStickerPicker)}
                      className={`p-2.5 md:p-3 rounded-2xl transition-all duration-300 ${canSendMedia ? 'hover:bg-brand-primary/10 text-slate-500 dark:text-gray-400 hover:text-brand-primary' : 'opacity-50 cursor-not-allowed text-slate-300'} ${showStickerPicker ? 'bg-brand-primary/10 text-brand-primary' : ''}`}
                      disabled={!canSendMedia}
                      title={!canSendMedia ? "Figurinhas / Gifs" : "Figurinhas / Gifs"}
                    >
                      <Smile className="w-5 h-5 md:w-5 md:h-5" />
                    </button>

                    <div className="flex flex-col items-center justify-center px-1 mb-2">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Assin.</span>
                      <button
                        onClick={handleToggleSignature}
                        className={`p-1.5 rounded-lg transition-all ${useSignature ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5'}`}
                        title={useSignature ? "Assinatura Ativa" : "Sem Assinatura"}
                      >
                        <CheckCheck className={`w-3.5 h-3.5 ${useSignature ? 'opacity-100' : 'opacity-40'}`} />
                      </button>
                    </div>

                    {/* Botão Chamar Atenção (Nudge) */}
                    {activeProfile?.can_nudge !== false && (
                      <div className="flex-shrink-0 flex items-center justify-center mr-1 mb-1">
                        <button
                          type="button"
                          onClick={handleSendNudge}
                          disabled={!!cooldownTimeouts[selectedConversation?.id || '']}
                          className={`p-2.5 rounded-2xl transition-all relative flex items-center justify-center ${
                            cooldownTimeouts[selectedConversation?.id || '']
                              ? 'text-slate-300 cursor-not-allowed opacity-50'
                              : 'text-orange-500 hover:text-orange-600 hover:bg-orange-50 active:scale-95'
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
                    {/* Popup de Mensagens Rápidas */}
                    {showQuickMsgPopup && (
                      <div className="absolute bottom-[100%] left-4 right-4 md:left-12 md:right-12 mb-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-200 font-sans max-h-60 overflow-y-auto custom-scrollbar">
                        <div className="p-3 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-transparent flex justify-between items-center">
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Atalhos Rápidos (/{quickMsgFilter})</span>
                          <span className="text-[9px] text-gray-400">Use ↑ ↓ e Enter para selecionar</span>
                        </div>
                        {quickMessages.filter(m => m.shortcut.toLowerCase().includes(quickMsgFilter.toLowerCase())).length === 0 ? (
                          <div className="p-4 text-xs text-gray-400 text-center font-bold opacity-60">Nenhum atalho correspondente</div>
                        ) : (
                          quickMessages.filter(m => m.shortcut.toLowerCase().includes(quickMsgFilter.toLowerCase())).map((msg, idx) => (
                            <button
                              key={msg.id}
                              type="button"
                              onClick={() => selectQuickMessage(msg)}
                              className={`w-full flex flex-col items-start gap-1 p-3 text-left transition-all ${
                                selectedQuickMsgIdx === idx 
                                  ? 'bg-emerald-500/10 dark:bg-emerald-500/20' 
                                  : 'hover:bg-slate-50 dark:hover:bg-white/5'
                              }`}
                            >
                              <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                /{msg.shortcut}
                              </span>
                              <p className="text-xs text-slate-700 dark:text-slate-200 truncate w-full font-medium">{msg.message}</p>
                            </button>
                          ))
                        )}
                      </div>
                    )}

                    <textarea
                      value={newMessage}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewMessage(val);
                        const lastWord = val.split(/\s+/).pop() || '';
                        if (lastWord.startsWith('/')) {
                          setShowQuickMsgPopup(true);
                          setQuickMsgFilter(lastWord.slice(1));
                          setSelectedQuickMsgIdx(0);
                        } else {
                          setShowQuickMsgPopup(false);
                        }
                      }}
                      onPaste={handlePaste}
                      onKeyDown={(e) => {
                        const filtered = quickMessages.filter(m => 
                          m.shortcut.toLowerCase().includes(quickMsgFilter.toLowerCase())
                        );
                        if (showQuickMsgPopup && filtered.length > 0) {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setSelectedQuickMsgIdx(prev => (prev + 1) % filtered.length);
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setSelectedQuickMsgIdx(prev => (prev - 1 + filtered.length) % filtered.length);
                          } else if (e.key === 'Enter') {
                            e.preventDefault();
                            selectQuickMessage(filtered[selectedQuickMsgIdx]);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setShowQuickMsgPopup(false);
                          }
                        } else if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          canSendMessagesResult && !isSending && handleSendMessage();
                        }
                      }}
                      placeholder={canSendMessagesResult ? "Mensagem" : "Apenas leitura"}
                      disabled={!canSendMessagesResult || isSending}
                      style={{ fontSize: `${chatFontSize}px` }}
                      className="flex-1 max-h-32 min-h-[40px] py-3 px-2 md:px-4 bg-transparent resize-none focus:outline-none dark:text-white placeholder-gray-400/80 font-medium leading-[1.3]"
                      rows={1}
                    />
                    {newMessage.trim() || attachedFile ? (
                      <button
                        onClick={handleSendMessage}
                        disabled={!canSendMessagesResult || isSending}
                        className="p-2.5 md:p-3 bg-brand-primary text-white rounded-full md:rounded-2xl hover:bg-emerald-600 dark:hover:bg-emerald-400 disabled:opacity-50 disabled:bg-slate-300 dark:disabled:bg-white/10 disabled:cursor-not-allowed transform transition-all active:scale-95 mb-0.5 md:mb-px ml-1 md:ml-2 flex-shrink-0"
                        title={!canSendMessagesResult ? "Sem permissão para enviar mensagens" : "Enviar"}
                      >
                        <Send className="w-5 h-5 md:ml-1" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={startRecording}
                        disabled={!canSendMessagesResult || isSending}
                        className="p-2.5 md:p-3 bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 rounded-full md:rounded-2xl hover:bg-slate-300 dark:hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transform transition-all active:scale-95 mb-0.5 md:mb-px ml-1 md:ml-2 flex-shrink-0"
                        title={!canSendMessagesResult ? "Sem permissão para enviar áudios" : "Gravar Áudio"}
                      >
                        <Mic className="w-5 h-5" />
                      </button>
                    )}
                  </>
                )}
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

            {/* Atribuição Section */}
            <div className="border-t border-slate-100 dark:border-white/5 pt-6">
              <h4 className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <UserPlus className="w-3.5 h-3.5" /> Atribuição
              </h4>
              <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-3 text-xs mb-3">
                <p className="text-slate-400 mb-1">Atendente</p>
                <p className="font-bold text-slate-700 dark:text-white">{selectedConversation.assigned_user?.full_name || 'Sem atendente'}</p>
                <p className="text-slate-400 mt-2 mb-1">Setor</p>
                <p className="font-bold text-slate-700 dark:text-white">{selectedConversation.queue?.name || 'Sem setor'}</p>
              </div>
              {!isGhostMode && (
                <button
                  onClick={() => { setIsTransferModalOpen(true); setTransferSearch(''); setTransferType('agent'); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 dark:text-indigo-400 rounded-xl transition-colors border border-indigo-100 dark:border-indigo-500/20"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Transferir Atendimento
                </button>
              )}
            </div>

             <button 
              onClick={() => {
                if (selectedConversation.status === 'fechado') {
                  handleUpdateStatus(selectedConversation.id, 'aberto');
                } else {
                  handleOpenCloseModal(selectedConversation.id);
                }
              }}
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

      {/* Context Menu for Conversations */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setContextMenu(null)} />
          <div 
            className="fixed z-[101] bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden py-1 min-w-[180px] animate-in fade-in zoom-in-95 duration-100 font-sans"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button 
              onClick={() => handleMuteToggle(contextMenu.conversationId, contextMenu.isMuted)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-500/20 transition-colors font-medium"
            >
              {contextMenu.isMuted ? (
                <>
                  <Bell className="w-4 h-4 text-emerald-500" />
                  Ativar Notificações
                </>
              ) : (
                <>
                  <BellOff className="w-4 h-4 text-slate-400" />
                  Silenciar Notificações
                </>
              )}
            </button>
            {!isGhostMode && (
              <button 
                onClick={() => {
                  const targetConv = conversations.find(c => c.id === contextMenu.conversationId);
                  if (targetConv) {
                    setSelectedConversation(targetConv);
                    setIsTransferModalOpen(true);
                    setTransferSearch('');
                  }
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-500/20 transition-colors font-medium border-t border-slate-100 dark:border-white/5"
              >
                <CornerUpRight className="w-4 h-4 text-indigo-500" />
                Transferir Atendimento
              </button>
            )}
            {!isGhostMode && (
              <button 
                onClick={async () => {
                  const targetConv = conversations.find(c => c.id === contextMenu.conversationId);
                  if (targetConv) {
                    handleOpenCloseModal(contextMenu.conversationId);
                  }
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors font-medium border-t border-slate-100 dark:border-white/5"
              >
                <CheckCheck className="w-4 h-4 text-red-500" />
                Finalizar Atendimento
              </button>
            )}
          </div>
        </>
      )}

      {/* Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Transferir Atendimento</h3>
                <p className="text-xs text-slate-500 mt-1">Transfira para um atendente ou fila</p>
              </div>
              <button onClick={() => setIsTransferModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Tipo de Transferência */}
            <div className="flex gap-2 p-4 bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
              <button
                onClick={() => setTransferType('agent')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  transferType === 'agent'
                    ? 'bg-indigo-500 text-white shadow-lg'
                    : 'bg-white dark:bg-white/10 text-slate-500 hover:text-indigo-600'
                }`}
              >
                Atendente
              </button>
              <button
                onClick={() => setTransferType('queue')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  transferType === 'queue'
                    ? 'bg-emerald-500 text-white shadow-lg'
                    : 'bg-white dark:bg-white/10 text-slate-500 hover:text-emerald-600'
                }`}
              >
                Fila / Setor
              </button>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-white/5">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder={transferType === 'agent' ? 'Buscar atendente...' : 'Buscar setor...'}
                  value={transferSearch}
                  onChange={(e) => setTransferSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            <div className="max-h-[300px] overflow-y-auto p-2">
              {(transferType === 'agent' ? agents : queues)
                .filter(item =>
                  (item.full_name || item.name || '').toLowerCase().includes(transferSearch.toLowerCase())
                )
                .map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleTransfer(item.id, transferType)}
                    disabled={transferLoading}
                    className="w-full flex items-center gap-4 p-3 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-2xl transition-all group"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${
                      transferType === 'agent' ? 'bg-indigo-500' : 'bg-emerald-500'
                    }`}>
                      {(item.full_name || item.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{item.full_name || item.name}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                        {transferType === 'agent' ? 'Atendente' : 'Setor'}
                      </p>
                    </div>
                    <CornerUpRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                  </button>
                ))
              }
              {(transferType === 'agent' ? agents : queues).filter(i =>
                (i.full_name || i.name || '').toLowerCase().includes(transferSearch.toLowerCase())
              ).length === 0 && (
                <p className="text-center text-slate-400 text-sm py-6">Nenhum resultado encontrado</p>
              )}
            </div>

            {transferLoading && (
              <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 flex items-center justify-center backdrop-blur-[1px]">
                <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Close Chat Modal with Termination Reason */}
      {isCloseModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-transparent">
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Encerrar Atendimento</h3>
                <p className="text-xs text-slate-500 mt-1">Selecione o motivo de fechamento</p>
              </div>
              <button onClick={() => setIsCloseModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="max-h-[300px] overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
              {terminationReasons.map((reason) => (
                <button
                  key={reason.id}
                  onClick={() => setSelectedReasonId(reason.id)}
                  className={`w-full flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all duration-300 ${
                    selectedReasonId === reason.id
                      ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/5'
                      : 'border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                    selectedReasonId === reason.id
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-slate-300 dark:border-slate-600'
                  }`}>
                    {selectedReasonId === reason.id && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-white leading-snug">{reason.name}</p>
                    {reason.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{reason.description}</p>
                    )}
                  </div>
                </button>
              ))}

              <button
                onClick={() => setSelectedReasonId('other')}
                className={`w-full flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all duration-300 ${
                  selectedReasonId === 'other'
                    ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/5'
                    : 'border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                  selectedReasonId === 'other'
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {selectedReasonId === 'other' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-white leading-snug">Sem motivo específico / Outros</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">Finalizar sem registrar um motivo padrão.</p>
                </div>
              </button>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-3">
              <button
                onClick={() => setIsCloseModalOpen(false)}
                className="px-6 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors uppercase tracking-widest"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!convToClose) return;
                  const reason = selectedReasonId === 'other' ? null : terminationReasons.find(r => r.id === selectedReasonId);
                  await handleUpdateStatus(
                    convToClose, 
                    'fechado', 
                    false, 
                    reason?.id || null, 
                    reason?.name || (selectedReasonId === 'other' ? 'Sem motivo específico / Outros' : null)
                  );
                  setIsCloseModalOpen(false);
                }}
                className="px-8 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 uppercase tracking-widest"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forward Message Modal */}
      {isForwardModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Encaminhar Mensagem</h3>
                <p className="text-xs text-slate-500 mt-1">Selecione o destino da mensagem</p>
              </div>
              <button 
                onClick={() => {
                  setIsForwardModalOpen(false);
                  setForwardingMessage(null);
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="p-4 bg-slate-50 dark:bg-white/5">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Buscar contato ou grupo..."
                  value={forwardTargetSearch}
                  onChange={(e) => setForwardTargetSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>
            
            <div className="max-h-[400px] overflow-y-auto p-2">
              {conversations
                .filter(c => 
                  c.contact_name?.toLowerCase().includes(forwardTargetSearch.toLowerCase()) || 
                  c.contact_phone?.includes(forwardTargetSearch)
                )
                .map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => handleForward(conv.id)}
                    disabled={forwardLoading}
                    className="w-full flex items-center gap-4 p-3 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-2xl transition-all group"
                  >
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(conv.contact_name || 'User')}&background=random`}
                      className="w-10 h-10 rounded-full border border-slate-200 group-hover:scale-110 transition-transform"
                      alt={conv.contact_name}
                    />
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{conv.contact_name}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{conv.contact_phone}</p>
                    </div>
                    <CornerUpRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                  </button>
                ))
              }
            </div>
            
            {forwardLoading && (
              <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 flex items-center justify-center backdrop-blur-[1px]">
                <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Media Modal */}
      {selectedMedia && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={() => setSelectedMedia(null)}
        >
          <button 
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            onClick={(e) => { e.stopPropagation(); setSelectedMedia(null); }}
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="relative max-w-5xl max-h-[90vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
            {selectedMedia.type === 'image' || selectedMedia.url.endsWith('.gif') ? (
              <img src={selectedMedia.url} alt="Mídia em tamanho real" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" />
            ) : selectedMedia.type === 'video' ? (
              <video src={selectedMedia.url} controls autoPlay className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl outline-none" />
            ) : null}
            
            <a 
              href={selectedMedia.url} 
              download 
              target="_blank" 
              rel="noreferrer"
              className="absolute bottom-4 right-4 p-3 bg-emerald-500 hover:bg-emerald-600 rounded-full text-white shadow-lg transition-transform hover:scale-110 flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
            </a>
          </div>
        </div>
      )}

      {/* Message Context Menu */}
      {messageContextMenu && (
        <div 
          className="fixed z-[9999] bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl py-2 w-48 animate-in fade-in zoom-in-95 duration-100 font-sans"
          style={{ 
            top: `${messageContextMenu.y}px`, 
            left: `${messageContextMenu.x}px` 
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setEditingMessageId(messageContextMenu.message.id);
              setEditingText(messageContextMenu.message.message_text || '');
              setMessageContextMenu(null);
            }}
            className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5 text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2.5 transition-colors"
          >
            <Edit2 className="w-4 h-4 text-slate-400" />
            <span>Editar Mensagem</span>
          </button>
          
          {isAdmin && (
            <button
              onClick={() => {
                handleDeleteMessage(messageContextMenu.message.id);
                setMessageContextMenu(null);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-500/10 text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-2.5 border-t border-slate-100 dark:border-white/5 transition-colors"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
              <span>Deletar Mensagem</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Chat;
