import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { 
  WhatsAppConversation, 
  WhatsAppMessage, 
  WhatsAppSettings,
  WhatsAppConversationWithDetails
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
  Smartphone
} from 'lucide-react';

import { useAuth } from '../AuthContext';
import TransferModal from './TransferModal';
import ContactSidebar from './ContactSidebar';

const Chat: React.FC = () => {
  const { user, profile } = useAuth();
  const permissions = (profile?.whatspanda_permissions as any) || {};
  const isAdmin = profile?.isAdmin || profile?.isCompanyAdmin || profile?.role === 'Super Admin';
  const canSendMessages = isAdmin || permissions.can_send_messages !== false; // Default true if undefined? No, types say boolean. Let's assume false default if not admin.
  // Actually, UsersTab set defaults.
  // Let's being strict:
  // const canSendMessages = isAdmin || !!permissions.can_send_messages;

  // However, for existing users without permissions set, we might want to allow or block?
  // Block is safer.

  const canSendMedia = isAdmin || !!permissions.can_send_media;
  const canSendMessagesResult = isAdmin || !!permissions.can_send_messages;
  const [conversations, setConversations] = useState<WhatsAppConversationWithDetails[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversationWithDetails | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'aberto' | 'pendente' | 'fechado'>('aberto');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // const [user] = useState({ id: 'current-user-id' }); // Mock removed
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showContactSidebar, setShowContactSidebar] = useState(false);
  const canTransfer = isAdmin || profile?.whatspanda_permissions?.can_transfer;

  useEffect(() => {
    fetchSettings();
    fetchConversations();
    
    // Real-time subscriptions
    const convSubscription = supabase
      .channel('whatsapp_conversations_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversations' }, payload => {
        fetchConversations(); // Refresh list on change
      })
      .subscribe();

    const msgSubscription = supabase
      .channel('whatsapp_messages_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, payload => {
        const newMsg = payload.new as WhatsAppMessage;
        if (selectedConversation && newMsg.conversation_id === selectedConversation.id) {
          setMessages(prev => [...prev, newMsg]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(convSubscription);
      supabase.removeChannel(msgSubscription);
    };
  }, [selectedConversation]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
      markAsRead(selectedConversation.id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchSettings = async () => {
    const companyId = profile?.company_id || user?.user_metadata?.company_id;
    if (!companyId) return;

    const { data } = await supabase
      .from('whatsapp_settings')
      .select('*')
      .eq('company_id', companyId)
      .limit(1);

    if (data && data.length > 0) setSettings(data[0]);
  };

  const fetchConversations = async () => {
    const companyId = profile?.company_id || user?.user_metadata?.company_id;
    if (!companyId) return;

    const { data } = await supabase
      .from('whatsapp_conversations')
      .select(`
        *,
        assigned_user:profiles!assigned_to(id, full_name, avatar_url),
        department:departments(id, name),
        channel:whatsapp_settings!connection_id(channel_type, connection_name)
      `)
      .eq('company_id', companyId)
      .order('last_message_at', { ascending: false });
    
    if (data) setConversations(data as WhatsAppConversationWithDetails[]);
    setLoading(false);
  };

  const fetchMessages = async (conversationId: string) => {
    const { data } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (data) setMessages(data);
  };

  const markAsRead = async (conversationId: string) => {
    const isImpersonating = localStorage.getItem('pixel_is_impersonating') === 'true';
    if (isImpersonating) return; // Ghost mode blocks marking as read

    await supabase
      .from('whatsapp_conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    // Optimistic update
    // In a real app, wait for server confirmation or use a local ID
    
    const { error } = await supabase
      .from('whatsapp_messages')
      .insert({
        conversation_id: selectedConversation.id,
        message_text: newMessage,
        is_from_customer: false,
        sent_by: user?.id // Replace with actual user ID
      });

    if (!error) {
      setNewMessage('');
      // Update last message in conversation
      await supabase
        .from('whatsapp_conversations')
        .update({ 
            last_message_at: new Date().toISOString(),
            status: selectedConversation.status === 'fechado' ? 'aberto' : selectedConversation.status
        })
        .eq('id', selectedConversation.id);
    }
  };

  const filteredConversations = conversations.filter(c => c.status === activeTab);

  return (
    <div className="flex h-full bg-[#f8fafc] dark:bg-transparent overflow-hidden relative font-sans text-brand-text transition-colors duration-500">
      {/* Middle Section: Conversations List */}
      <div className={`${selectedConversation ? 'hidden md:flex' : 'flex'} w-full md:w-[320px] lg:w-[360px] bg-white dark:bg-slate-900/40 backdrop-blur-xl border-r border-slate-200 dark:border-white/5 flex-col shadow-[2px_0_15px_rgba(0,0,0,0.02)] z-10 transition-all duration-500`}>
        {/* Header - SIMPLIFIED for sub-view (main header handled by layout) */}
        <div className="p-4 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-transparent">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-black flex items-center gap-2 text-slate-800 dark:text-white tracking-tighter uppercase text-sm opacity-80">
              Atendimentos
            </h2>
            <div className={`w-3 h-3 rounded-full ring-4 shadow-lg ${settings?.is_connected ? 'bg-emerald-500 ring-emerald-500/20 animate-pulse' : 'bg-red-500 ring-red-500/20'}`} title={settings?.is_connected ? 'Conectado' : 'Desconectado'}></div>
          </div>
          
          {/* Tabs */}
          <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl shadow-inner border border-transparent dark:border-white/5">
            {(['aberto', 'pendente', 'fechado'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-black rounded-xl capitalize transition-all duration-300 ${activeTab === tab
                  ? 'bg-white dark:bg-emerald-500 text-emerald-600 dark:text-white shadow-xl scale-[1.02]'
                  : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Search and Actions */}
        <div className="p-3 border-b border-slate-100 dark:border-white/5 bg-white dark:bg-transparent space-y-3">
          <div className="relative group">
            <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input
              type="text" 
              placeholder="Buscar atendimento..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 dark:text-white"
            />
          </div>
          {isAdmin && (
            <button
              onClick={async () => {
                if (window.confirm('Tem certeza? Isso irá apagar todo o histórico de conversas do WhatsPanda!')) {
                  try {
                    const { error } = await supabase.from('whatsapp_conversations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                    if (error) throw error;
                    alert('Atendimentos limpos com sucesso.');
                  } catch (err: any) {
                    alert('Erro ao limpar: ' + err.message);
                  }
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-100"
            >
              LIMPAR ATENDIMENTOS
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
                  </div>
                  <h3 className={`font-black text-sm truncate tracking-tight transition-colors ${selectedConversation?.id === conv.id ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-white'}`}>
                    {conv.contact_name || conv.contact_phone}
                  </h3>
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest whitespace-nowrap mt-1 ${selectedConversation?.id === conv.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                    {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2 pl-10">
                <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate max-w-[140px] font-bold tracking-tight opacity-70 group-hover:opacity-100">
                    {conv.contact_phone}
                </p>
                {conv.unread_count > 0 ? (
                  <span className="bg-emerald-500 text-white text-[10px] font-bold min-w-[20px] px-1.5 py-0.5 rounded-full text-center shadow-sm">
                    {conv.unread_count > 99 ? '99+' : conv.unread_count}
                  </span>
                ) : (
                  selectedConversation?.id === conv.id ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : null
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
                  <h3 className="font-black text-slate-800 dark:text-white text-lg truncate leading-tight tracking-tight">{selectedConversation.contact_name || selectedConversation.contact_phone}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[11px] font-black text-slate-500 dark:text-gray-400 truncate opacity-80">{selectedConversation.contact_phone}</p>

                    {selectedConversation.channel && (
                      <span className="text-[10px] bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-gray-300 font-black px-3 py-1 rounded-full border border-slate-200 dark:border-white/5 flex items-center gap-1.5 uppercase tracking-widest shadow-sm">
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
              <div className="flex gap-1.5">
                {canTransfer && (
                  <button
                    onClick={() => setShowTransferModal(true)}
                    className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-indigo-600 transition-colors"
                    title="Transferir Atendimento"
                  >
                    <UserPlus className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => setShowContactSidebar(!showContactSidebar)}
                  className={`p-2 rounded-full transition-colors ${showContactSidebar ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-slate-100 text-slate-500'}`}
                  title="Informações do Contato"
                >
                  <Info className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.is_from_customer ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[75%] md:max-w-[60%] rounded-2xl px-5 py-3 shadow-xl relative backdrop-blur-md border ${msg.is_from_customer
                      ? 'bg-white/90 dark:bg-white/5 text-slate-800 dark:text-white rounded-tl-sm border-slate-100 dark:border-white/10'
                      : 'bg-emerald-100/90 dark:bg-emerald-500/20 text-slate-800 dark:text-emerald-50 rounded-tr-sm border-emerald-200/50 dark:border-emerald-500/20'
                    }`}
                  >
                    <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.message_text}</p>
                    <div className="flex justify-end items-center gap-1.5 mt-2 opacity-60">
                      <span className="text-[10px] font-black uppercase tracking-tighter">
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
            <div className="px-3 py-2 md:px-6 md:py-5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-white/5 z-20 pb-[max(env(safe-area-inset-bottom),8px)] md:pb-5 shadow-[0_-4px_10px_-4px_rgba(0,0,0,0.05)]">
              <div className="flex-1 bg-gray-100/80 dark:bg-white/5 rounded-3xl flex items-end p-1 md:p-2 border border-transparent dark:border-white/5 focus-within:bg-white dark:focus-within:bg-white/10 focus-within:shadow-xl transition-all duration-300">
                <button
                  className={`p-2.5 md:p-3 rounded-2xl transition-all duration-300 ${canSendMedia ? 'hover:bg-brand-primary/10 text-slate-500 dark:text-gray-400 hover:text-brand-primary' : 'opacity-50 cursor-not-allowed text-slate-300'}`}
                  disabled={!canSendMedia}
                  title={!canSendMedia ? "Sem permissão para enviar mídia" : "Anexar"}
                >
                  <Paperclip className="w-5 h-5 md:w-5 md:h-5" />
                </button>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
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
                  disabled={!newMessage.trim() || !canSendMessagesResult}
                  className="p-2.5 md:p-3 bg-brand-primary text-white rounded-full md:rounded-2xl hover:bg-emerald-600 dark:hover:bg-emerald-400 disabled:opacity-50 disabled:bg-slate-300 dark:disabled:bg-white/10 disabled:cursor-not-allowed transform transition-all active:scale-95 shadow-md shadow-brand-primary/20 mb-0.5 md:mb-px ml-1 md:ml-2 flex-shrink-0"
                  title={!canSendMessagesResult ? "Sem permissão para enviar mensagens" : "Enviar"}
                >
                  <Send className="w-5 h-5 md:ml-1" />
                </button>
              </div>
            </div>
          </div>
        ) : (
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-slate-500 p-8">
              <div className="bg-white/50 dark:bg-slate-900/60 backdrop-blur-3xl p-12 rounded-[2.5rem] shadow-2xl flex flex-col items-center max-w-sm text-center border border-white/20 dark:border-white/5">
                <div className="w-24 h-24 bg-gradient-to-tr from-emerald-500 to-emerald-400 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-emerald-500/20 transform rotate-3">
                  <MessageCircle className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-4 tracking-tighter font-brand">WhatsPanda Pro</h2>
                <p className="text-sm font-bold text-slate-500 dark:text-gray-400 leading-relaxed opacity-80">Selecione um atendimento ao lado para visualizar as mensagens e interagir com o cliente.</p>
              </div>
          </div>
        )}
      </div>

      {/* Info Sidebar (Right) */}
      {selectedConversation && (
        <div className={`w-full sm:w-[320px] bg-white dark:bg-slate-900/40 backdrop-blur-xl border-l border-slate-200 dark:border-white/5 flex flex-col transition-all duration-500 fixed right-0 h-full shadow-2xl xl:relative xl:shadow-none ${showContactSidebar ? 'translate-x-0' : 'translate-x-full xl:translate-x-0'} z-30`}>
          {/* Contact Header Component / Modal Wrapper Alternative */}
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center xl:hidden">
            <span className="font-bold text-slate-700">Detalhes</span>
            <button onClick={() => setShowContactSidebar(false)} className="p-1 hover:bg-slate-200 rounded-lg text-slate-500"><CheckCheck className="w-5 h-5" /></button>
          </div>

          <div className="p-8 flex flex-col items-center border-b border-slate-100 dark:border-white/5">
            <div className="w-32 h-32 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-6 ring-8 ring-white dark:ring-white/10 shadow-2xl overflow-hidden transition-all duration-300">
              <User className="w-16 h-16 text-slate-300" />
            </div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white text-center leading-tight tracking-tight">{selectedConversation.contact_name || 'Sem nome'}</h3>
            <p className="text-slate-500 dark:text-gray-400 text-sm font-black mt-2 opacity-80">{selectedConversation.contact_phone}</p>
            </div>

          <div className="p-8 flex-1 overflow-y-auto space-y-8 custom-scrollbar">
            <div>
              <h4 className="text-[11px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-4">Informações do Ticket</h4>
              <div className="bg-gray-100/50 dark:bg-white/5 rounded-2xl p-5 border border-transparent dark:border-white/5 space-y-4">
                <div className="flex items-center gap-4 text-sm text-slate-700 dark:text-gray-200">
                  <Clock className="w-5 h-5 text-emerald-500" />
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-gray-500">Última Interação</span>
                    <span className="font-bold">{new Date(selectedConversation.last_message_at).toLocaleDateString()} às {new Date(selectedConversation.last_message_at).toLocaleTimeString().slice(0, 5)}</span>
                  </div>
                </div>
                    </div>
                </div>

            <div>
              <h4 className="text-[11px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-4">Ações Rápidas</h4>
              <div className="space-y-3">
                <button className="w-full flex items-center justify-center py-4 px-6 bg-brand-primary/10 dark:bg-emerald-500/10 text-brand-primary dark:text-emerald-400 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-brand-primary hover:text-white dark:hover:bg-emerald-500 dark:hover:text-white transition-all duration-300 border border-brand-primary/20">
                  Ver Perfil CRM
                </button>
                <button className="w-full flex items-center justify-center py-4 px-6 bg-red-500/10 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-red-500 hover:text-white transition-all duration-300 border border-red-500/20">
                  Encerrar Atendimento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && selectedConversation && (
        <TransferModal
          conversationId={selectedConversation.id}
          currentAssignedTo={selectedConversation.assigned_to}
          currentDepartmentId={selectedConversation.department_id}
          onClose={() => setShowTransferModal(false)}
          onTransferComplete={() => {
            setShowTransferModal(false);
            fetchConversations();
            if (selectedConversation) {
              fetchMessages(selectedConversation.id);
            }
          }}
        />
      )}
    </div>
  );
};

export default Chat;
