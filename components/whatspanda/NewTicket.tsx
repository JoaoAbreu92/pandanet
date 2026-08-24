import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { WhatsAppContact, WhatsAppQueue, WhatsAppSettings } from '../../types';
import { useAuth } from '../AuthContext';
import { Search, MessageCircle, User, ArrowRight, Smartphone, Send, Instagram } from 'lucide-react';

const NewTicket: React.FC = () => {
    const { profile } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
    const [queues, setQueues] = useState<WhatsAppQueue[]>([]);
    const [channels, setChannels] = useState<WhatsAppSettings[]>([]);
    const [selectedContact, setSelectedContact] = useState<WhatsAppContact | null>(null);
    const [selectedQueue, setSelectedQueue] = useState('');
    const [selectedChannel, setSelectedChannel] = useState('');
    const [initialMessage, setInitialMessage] = useState('');
    
    // Simulating navigation to chat
    // In a real app, we would use a router or context to switch views and pass the conversation ID
    
    useEffect(() => {
        if (searchTerm.length > 2) {
            searchContacts();
        } else {
            setContacts([]);
        }
    }, [searchTerm]);

    useEffect(() => {
        fetchQueues();
        fetchChannels();
    }, [profile]);

    const fetchChannels = async () => {
        if (!profile?.company_id) return;

        const { data } = await supabase
            .from('whatsapp_settings')
            .select('*')
            .eq('company_id', profile.company_id);

        if (data) {
            // Filter by allowed connections if profile has permissions set
            const permissions = profile.whatspanda_permissions as any;
            const allowedIds = permissions?.allowed_connections || [];

            // If the user is an admin or we don't have constraints, maybe show all?
            // "listar apenas aqueles que o atendente possui em allowed_connections"
            const isAdmin = profile.isAdmin || profile.isCompanyAdmin || profile.role === 'Super Admin';

            let userChannels = data;
            if (!isAdmin && allowedIds.length > 0) {
                userChannels = data.filter(c => allowedIds.includes(c.id));
            }

            setChannels(userChannels);
            if (userChannels.length > 0) {
                setSelectedChannel(userChannels[0].id);
            }
        }
    };

    const fetchQueues = async () => {
        const { data } = await supabase.from('whatsapp_queues').select('*').eq('is_active', true);
        if (data) setQueues(data);
    };

    const searchContacts = async () => {
        const { data } = await supabase
            .from('whatsapp_contacts')
            .select('*')
            .or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
            .limit(5);
        
        if (data) setContacts(data);
    };

    const handleStartConversation = async () => {
        if (!selectedContact) return;
        if (!selectedChannel) {
            alert('Por favor, selecione um canal de envio.');
            return;
        }

        // 1. Check if conversation exists (open or closed) for THIS channel
        const { data: existingConv } = await supabase
            .from('whatsapp_conversations')
            .select('*')
            .eq('contact_phone', selectedContact.phone)
            .single();

        let conversationId = existingConv?.id;

        // 2. If not, create new one
        if (!conversationId) {
            const { data: newConv, error } = await supabase
                .from('whatsapp_conversations')
                .insert({
                    company_id: profile?.company_id || '15d38706-59a6-43b8-9366-2371904d90ce',
                    contact_phone: selectedContact.phone,
                    contact_name: selectedContact.name,
                    status: 'aberto',
                    unread_count: 0,
                    last_message_at: new Date().toISOString(),
                    connection_id: selectedChannel
                    // department_id: selectedQueue // If we map queue to department or add queue_id to conversation
                })
                .select()
                .single();
            
            if (error) {
                console.error('Error creating conversation:', error);
                alert('Erro ao criar conversa.');
                return;
            }
            conversationId = newConv.id;
        } else {
            // Re-open if needed
            await supabase
                .from('whatsapp_conversations')
                .update({ status: 'aberto', last_message_at: new Date().toISOString() })
                .eq('id', conversationId);
        }

        // 3. Send initial message if provided
        if (initialMessage.trim()) {
            await supabase
                .from('whatsapp_messages')
                .insert({
                    conversation_id: conversationId,
                    message_text: initialMessage,
                    is_from_customer: false,
                    sent_by: 'current-user-id' // Mock
                });
        }

        // 4. Redirect (Mock alert for now)
        alert(`Conversa iniciada com ${selectedContact.name}! Redirecionando para o chat...`);
        // In real impl: navigation('/whatspanda?view=chat&id=' + conversationId);
    };

    return (
        <div className="h-full flex items-center justify-center bg-gray-50 p-6">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-gray-100">
                <div className="bg-green-600 p-6 text-white text-center">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-90" />
                    <h2 className="text-2xl font-bold">Iniciar Novo Atendimento</h2>
                    <p className="text-green-100 mt-1">Busque um contato existente para começar.</p>
                </div>

                <div className="p-8 space-y-6">
                    {/* Search Step */}
                    {!selectedContact ? (
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                                    placeholder="Digite o nome ou telefone..."
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-2">
                                {contacts.map(contact => (
                                    <button
                                        key={contact.id}
                                        onClick={() => setSelectedContact(contact)}
                                        className="w-full flex items-center p-3 hover:bg-green-50 rounded-lg transition-colors text-left group"
                                    >
                                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 mr-3 group-hover:bg-green-100 group-hover:text-green-600">
                                            <User className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-900">{contact.name}</p>
                                            <p className="text-sm text-gray-500">{contact.phone}</p>
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-gray-300 ml-auto group-hover:text-green-500" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        // Conversation Setup Step
                        <div className="space-y-6 animate-in slide-in-from-right duration-300">
                            <div className="flex items-center justify-between bg-green-50 p-4 rounded-xl border border-green-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center text-green-700">
                                        <User className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900">{selectedContact.name}</p>
                                        <p className="text-sm text-gray-600">{selectedContact.phone}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setSelectedContact(null)}
                                    className="text-sm text-green-700 hover:text-green-800 font-medium hover:underline"
                                >
                                    Trocar
                                </button>
                            </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Canal de Envio</label>
                                    <select
                                        value={selectedChannel}
                                        onChange={(e) => setSelectedChannel(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 bg-white"
                                    >
                                        {channels.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.connection_name} ({c.channel_type || 'whatsapp'})
                                            </option>
                                        ))}
                                        {channels.length === 0 && <option value="">Nenhum canal disponível</option>}
                                    </select>
                                </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Fila de Atendimento (Opcional)</label>
                                <select 
                                    value={selectedQueue}
                                    onChange={(e) => setSelectedQueue(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 bg-white"
                                >
                                    <option value="">Sem fila específica</option>
                                    {queues.map(q => (
                                        <option key={q.id} value={q.id}>{q.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Mensagem Inicial</label>
                                <textarea
                                    value={initialMessage}
                                    onChange={(e) => setInitialMessage(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 min-h-[100px]"
                                    placeholder="Escreva a primeira mensagem..."
                                />
                            </div>

                            <button 
                                onClick={handleStartConversation}
                                className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 shadow-lg shadow-green-600/30 transition-all transform hover:-translate-y-1"
                            >
                                Iniciar Conversa
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NewTicket;
