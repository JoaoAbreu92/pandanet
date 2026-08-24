import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { 
  WhatsAppConversation, 
  WhatsAppMessage, 
  WhatsAppSettings 
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
  Clock
} from 'lucide-react';

import { useAuth } from '../AuthContext';

const Chat: React.FC = () => {
  const { profile } = useAuth();
  const permissions = profile?.whatspanda_permissions || {};
  const isAdmin = profile?.isAdmin || profile?.isCompanyAdmin || profile?.role === 'Super Admin';
  const canSendMessages = isAdmin || permissions.can_send_messages !== false; // Default true if undefined? No, types say boolean. Let's assume false default if not admin.
  // Actually, UsersTab set defaults.
  // Let's being strict:
  // const canSendMessages = isAdmin || !!permissions.can_send_messages;

  // However, for existing users without permissions set, we might want to allow or block?
  // Block is safer.

  const canSendMedia = isAdmin || !!permissions.can_send_media;
  const canSendMessagesResult = isAdmin || !!permissions.can_send_messages;
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversation | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'aberto' | 'pendente' | 'fechado'>('aberto');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [user] = useState({ id: 'current-user-id' }); // Mock for now, replace with actual auth

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
    const { data } = await supabase.from('whatsapp_settings').select('*').single();
    if (data) setSettings(data);
  };

  const fetchConversations = async () => {
    const { data } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .order('last_message_at', { ascending: false });
    
    if (data) setConversations(data);
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
        sent_by: user.id // Replace with actual user ID
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
    <div className="flex h-full bg-gray-100 overflow-hidden">
      {/* Sidebar: Conversations List */}
      <div className="w-1/4 bg-white border-r border-gray-200 flex flex-col">
        {/* Header - SIMPLIFIED for sub-view (main header handled by layout) */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              Conversas
            </h2>
            <div className={`w-3 h-3 rounded-full ${settings?.is_connected ? 'bg-green-500' : 'bg-red-500'}`} title={settings?.is_connected ? 'Conectado' : 'Desconectado'}></div>
          </div>
          
          {/* Tabs */}
          <div className="flex bg-gray-200 rounded-lg p-1">
            {(['aberto', 'pendente', 'fechado'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1 text-sm font-medium rounded-md capitalize ${
                  activeTab === tab ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="p-2 border-b border-gray-100">
            <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Buscar conversa..." 
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
            </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setSelectedConversation(conv)}
              className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                selectedConversation?.id === conv.id ? 'bg-green-50 border-l-4 border-l-green-600' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <h3 className="font-semibold text-gray-900">{conv.contact_name || conv.contact_phone}</h3>
                <span className="text-xs text-gray-400">
                    {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <p className="text-sm text-gray-500 truncate w-32">
                    {conv.contact_phone}
                </p>
                {conv.unread_count > 0 && (
                  <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {conv.unread_count}
                  </span>
                )}
              </div>
            </div>
          ))}
          {filteredConversations.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">
                  Nenhuma conversa {activeTab}.
              </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-[#efeae2]">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-3 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-gray-600">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedConversation.contact_name}</h3>
                  <p className="text-xs text-gray-500">{selectedConversation.contact_phone}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                  <Phone className="w-5 h-5" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.is_from_customer ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 shadow-sm relative ${
                      msg.is_from_customer ? 'bg-white rounded-tl-none' : 'bg-[#d9fdd3] rounded-tr-none'
                    }`}
                  >
                    <p className="text-gray-800 text-sm">{msg.message_text}</p>
                    <div className="flex justify-end items-center gap-1 mt-1">
                      <span className="text-[10px] text-gray-500">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {!msg.is_from_customer && (
                        <CheckCheck className="w-3 h-3 text-blue-500" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white flex items-center gap-2">
              <button
                className={`p-2 rounded-full ${canSendMedia ? 'hover:bg-gray-100 text-gray-500' : 'opacity-50 cursor-not-allowed text-gray-300'}`}
                disabled={!canSendMedia}
                title={!canSendMedia ? "Sem permissão para enviar mídia" : "Anexar"}
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && canSendMessagesResult && handleSendMessage()}
                placeholder={canSendMessagesResult ? "Digite uma mensagem..." : "Apenas leitura"}
                disabled={!canSendMessagesResult}
                className="flex-1 py-2 px-4 bg-gray-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-500 disabled:bg-gray-200 disabled:text-gray-500"
              />
              <button 
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || !canSendMessagesResult}
                className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transform transition-transform active:scale-95"
                title={!canSendMessagesResult ? "Sem permissão para enviar mensagens" : "Enviar"}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-[#f0f2f5] border-b-[6px] border-green-500">
            <MessageCircle className="w-16 h-16 text-gray-300 mb-4" />
            <h2 className="text-2xl font-light text-gray-600">WhatsPanda</h2>
            <p className="text-sm mt-2">Escolha uma conversa para começar o atendimento.</p>
          </div>
        )}
      </div>

      {/* Right Sidebar: Contact Info (Optional/Collapsible) */}
      {selectedConversation && (
        <div className="w-1/4 bg-white border-l border-gray-200 p-4 hidden xl:block">
            <div className="flex flex-col items-center mb-6">
                <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-3">
                     <User className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold">{selectedConversation.contact_name}</h3>
                <p className="text-gray-500 text-sm">{selectedConversation.contact_phone}</p>
            </div>

            <div className="space-y-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Detalhes</h4>
                    <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                        <Clock className="w-4 h-4" />
                        <span>Criado em: {new Date(selectedConversation.last_message_at).toLocaleDateString()}</span>
                    </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg">
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Ações</h4>
                    <button className="w-full text-left text-sm text-red-600 hover:bg-red-50 p-2 rounded transition-colors">
                        Fechar Conversa
                    </button>
                    <button className="w-full text-left text-sm text-gray-700 hover:bg-gray-200 p-2 rounded transition-colors">
                        Ver Perfil Completo
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
