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
    <div className="flex h-full bg-[#f8fafc] overflow-hidden relative font-sans text-brand-text">
      {/* Sidebar: Conversations List */}
      <div className={`${selectedConversation ? 'hidden md:flex' : 'flex'} w-full md:w-[320px] lg:w-[360px] bg-white border-r border-slate-200 flex-col shadow-[2px_0_15px_rgba(0,0,0,0.02)] z-10`}>
        {/* Header - SIMPLIFIED for sub-view (main header handled by layout) */}
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 tracking-tight">
              Atendimentos
            </h2>
            <div className={`w-2 h-2 rounded-full ring-4 shadow-sm ${settings?.is_connected ? 'bg-emerald-500 ring-emerald-50' : 'bg-red-500 ring-red-50'}`} title={settings?.is_connected ? 'Conectado' : 'Desconectado'}></div>
          </div>
          
          {/* Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
            {(['aberto', 'pendente', 'fechado'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg capitalize transition-all duration-200 ${activeTab === tab ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] text-emerald-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Search and Actions */}
        <div className="p-3 border-b border-slate-100 bg-white space-y-3">
          <div className="relative group">
            <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input
              type="text" 
              placeholder="Buscar atendimento..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
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
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-2 bg-slate-50">
          {filteredConversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setSelectedConversation(conv)}
              className={`p-3 rounded-xl border cursor-pointer hover:shadow-md transition-all duration-300 relative overflow-hidden ${selectedConversation?.id === conv.id ? 'bg-white border-emerald-500 shadow-[0_4px_20px_rgba(16,185,129,0.08)]' : 'bg-white border-slate-200 shadow-sm hover:border-emerald-300'
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
                  <h3 className={`font-bold text-sm truncate ${selectedConversation?.id === conv.id ? 'text-emerald-700' : 'text-slate-800'}`}>
                    {conv.contact_name || conv.contact_phone}
                  </h3>
                </div>
                <span className={`text-[10px] font-semibold whitespace-nowrap mt-0.5 ${selectedConversation?.id === conv.id ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-slate-500 truncate max-w-[140px] font-medium">
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
      <div className={`${selectedConversation ? 'flex' : 'hidden md:flex'} flex-1 flex flex-col bg-[#F3F6F8] relative`} style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundRepeat: 'repeat', opacity: 1 }}>
        <div className="absolute inset-0 bg-white/70 pointer-events-none" /> {/* Overlay to soften the background */}

        {selectedConversation ? (
          <div className="relative z-10 flex flex-col h-full"> {/* Container for z-index */}
            {/* Chat Header */}
            <div className="px-5 py-3 bg-white/95 backdrop-blur-md border-b border-slate-200 flex justify-between items-center shadow-sm z-20">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="p-2 -ml-2 md:hidden hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-11 h-11 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 shrink-0 ring-2 ring-white shadow-sm overflow-hidden">
                  <User className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex flex-col">
                  <h3 className="font-bold text-slate-800 text-base truncate leading-tight">{selectedConversation.contact_name || selectedConversation.contact_phone}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs font-semibold text-slate-500 truncate">{selectedConversation.contact_phone}</p>

                    {selectedConversation.channel && (
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full border border-slate-200 flex items-center gap-1">
                        {selectedConversation.channel.channel_type === 'instagram' ? <Instagram className="w-3 h-3 text-pink-500" /> :
                          selectedConversation.channel.channel_type === 'messenger' ? <MessageCircle className="w-3 h-3 text-blue-500" /> :
                            selectedConversation.channel.channel_type === 'telegram' ? <Send className="w-3 h-3 text-sky-500" /> :
                              <Smartphone className="w-3 h-3 text-emerald-500" />}
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
                    className={`max-w-[75%] md:max-w-[60%] rounded-2xl px-4 py-2.5 shadow-sm relative filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.04)] ${msg.is_from_customer
                      ? 'bg-white text-slate-800 rounded-tl-sm border border-slate-100'
                      : 'bg-[#dafde0] text-slate-800 rounded-tr-sm border border-[#c4f2cd]'
                    }`}
                  >
                    <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.message_text}</p>
                    <div className="flex justify-end items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] font-semibold text-slate-400">
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
            <div className="px-4 py-3 bg-white border-t border-slate-200 z-20 flex gap-2">
              <div className="flex-1 bg-slate-50 rounded-2xl flex items-end p-1.5 border border-slate-200 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-50 focus-within:bg-white transition-all">
                <button
                  className={`p-2 rounded-xl transition-colors ${canSendMedia ? 'hover:bg-slate-200 text-slate-500 hover:text-slate-700' : 'opacity-50 cursor-not-allowed text-slate-300'}`}
                  disabled={!canSendMedia}
                  title={!canSendMedia ? "Sem permissão para enviar mídia" : "Anexar"}
                >
                  <Paperclip className="w-5 h-5" />
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
                  placeholder={canSendMessagesResult ? "Escreva uma mensagem..." : "Apenas leitura"}
                  disabled={!canSendMessagesResult}
                  className="flex-1 max-h-32 min-h-[40px] py-2 px-3 bg-transparent text-sm resize-none focus:outline-none disabled:text-slate-500"
                  rows={1}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || !canSendMessagesResult}
                  className="p-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 disabled:bg-slate-300 disabled:cursor-not-allowed transform transition-all active:scale-95 shadow-md shadow-emerald-500/20 mb-px"
                  title={!canSendMessagesResult ? "Sem permissão para enviar mensagens" : "Enviar"}
                >
                  <Send className="w-5 h-5 ml-0.5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-slate-500 p-8">
              <div className="bg-white/60 backdrop-blur-md p-10 rounded-3xl shadow-xl flex flex-col items-center max-w-sm text-center border border-white/40">
                <div className="w-20 h-20 bg-gradient-to-tr from-emerald-100 to-emerald-50 rounded-2xl flex items-center justify-center mb-6 shadow-inner ring-1 ring-emerald-100">
                  <MessageCircle className="w-10 h-10 text-emerald-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">WhatsPanda Pro</h2>
                <p className="text-sm font-medium text-slate-500 leading-relaxed">Selecione um atendimento ao lado para visualizar as mensagens e interagir com o cliente.</p>
              </div>
          </div>
        )}
      </div>

      {/* Right Sidebar: Contact Info */}
      {selectedConversation && (
        <div className={`w-[280px] bg-white border-l border-slate-200 flex flex-col transition-all duration-300 ${showContactSidebar ? 'translate-x-0' : 'translate-x-full fixed right-0 h-full shadow-2xl xl:translate-x-0 xl:static'} xl:block z-30`}>
          {/* Contact Header Component / Modal Wrapper Alternative */}
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center xl:hidden">
            <span className="font-bold text-slate-700">Detalhes</span>
            <button onClick={() => setShowContactSidebar(false)} className="p-1 hover:bg-slate-200 rounded-lg text-slate-500"><CheckCheck className="w-5 h-5" /></button>
          </div>

          <div className="p-6 flex flex-col items-center border-b border-slate-100">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4 ring-4 ring-white shadow-md">
              <User className="w-12 h-12 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 text-center leading-tight">{selectedConversation.contact_name || 'Sem nome'}</h3>
            <p className="text-slate-500 text-sm font-semibold mt-1">{selectedConversation.contact_phone}</p>
            </div>

          <div className="p-6 flex-1 overflow-y-auto space-y-5">
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Informações do Ticket</h4>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-3">
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-500">Última Interação</span>
                    <span className="font-semibold">{new Date(selectedConversation.last_message_at).toLocaleDateString()} às {new Date(selectedConversation.last_message_at).toLocaleTimeString().slice(0, 5)}</span>
                  </div>
                </div>
                    </div>
                </div>

            <div>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Ações Rápidas</h4>
              <div className="space-y-2">
                <button className="w-full flex items-center justify-center py-2.5 px-4 bg-emerald-50 text-emerald-700 font-bold text-sm rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-100">
                  Ver Perfil CRM
                </button>
                <button className="w-full flex items-center justify-center py-2.5 px-4 bg-red-50 text-red-600 font-bold text-sm rounded-xl hover:bg-red-100 transition-colors border border-red-100">
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
