import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { WhatsAppContact, WhatsAppQueue, WhatsAppSettings } from '../../types';
import { useAuth } from '../AuthContext';
import { Search, MessageCircle, User, ArrowRight, Smartphone, Send, Instagram, X } from 'lucide-react';

interface NewTicketProps {
    onBack?: () => void;
}

const NewTicket: React.FC<NewTicketProps> = ({ onBack }) => {
    const { profile, user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
    const [queues, setQueues] = useState<WhatsAppQueue[]>([]);
    const [channels, setChannels] = useState<WhatsAppSettings[]>([]);
    const [selectedContact, setSelectedContact] = useState<WhatsAppContact | null>(null);
    const [manualNumber, setManualNumber] = useState('');
    const [selectedQueue, setSelectedQueue] = useState('');
    const [selectedChannel, setSelectedChannel] = useState('');
    const [initialMessage, setInitialMessage] = useState('');
    const [isManual, setIsManual] = useState(false);
    
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
        const companyId = profile?.company_id || user?.user_metadata?.company_id;
        if (!companyId) return;

        const { data } = await supabase
            .from('whatsapp_settings')
            .select('*')
            .eq('company_id', companyId);

        if (data) {
            const permissions = profile?.whatspanda_permissions as any;
            const allowedIds = permissions?.allowed_connections || [];
            const isAdmin = profile?.isAdmin || profile?.isCompanyAdmin || profile?.role === 'Super Admin';

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
        const companyId = profile?.company_id || user?.user_metadata?.company_id;
        if (!companyId) return;

        const { data } = await supabase
            .from('whatsapp_queues')
            .select('*')
            .eq('company_id', companyId)
            .eq('is_active', true);
        if (data) setQueues(data);
    };

    const searchContacts = async () => {
        const companyId = profile?.company_id || user?.user_metadata?.company_id;
        if (!companyId) return;

        const { data } = await supabase
            .from('whatsapp_contacts')
            .select('*')
            .eq('company_id', companyId)
            .or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
            .limit(5);
        
        if (data) setContacts(data);
    };

    const handleStartConversation = async () => {
        const companyId = profile?.company_id || user?.user_metadata?.company_id;
        if (!companyId) return;

        let contactPhone = '';
        let contactName = '';

        if (isManual) {
            if (!manualNumber.trim()) {
                alert('Por favor, digite um número.');
                return;
            }
            contactPhone = manualNumber.replace(/\D/g, '');
            contactName = manualNumber; // Default name for manual
        } else {
            if (!selectedContact) return;
            contactPhone = selectedContact.phone;
            contactName = selectedContact.name;
        }

        if (!selectedChannel) {
            alert('Por favor, selecione um canal de envio.');
            return;
        }

        // 1. Check if conversation exists
        const { data: existingConv } = await supabase
            .from('whatsapp_conversations')
            .select('*')
            .eq('company_id', companyId)
            .eq('contact_phone', contactPhone)
            .maybeSingle();

        let conversationId = existingConv?.id;

        // 2. If not, create new one
        if (!conversationId) {
            const { data: newConv, error } = await supabase
                .from('whatsapp_conversations')
                .insert({
                    company_id: companyId,
                    contact_phone: contactPhone,
                    contact_name: contactName,
                    status: 'aberto',
                    unread_count: 0,
                    last_message_at: new Date().toISOString(),
                    connection_id: selectedChannel,
                    queue_id: selectedQueue || null
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
            // Re-open and update queue/channel if needed
            await supabase
                .from('whatsapp_conversations')
                .update({ 
                    status: 'aberto', 
                    last_message_at: new Date().toISOString(),
                    connection_id: selectedChannel,
                    queue_id: selectedQueue || null
                })
                .eq('id', conversationId);
        }

        // 3. Send initial message if provided
        if (initialMessage.trim()) {
            await supabase
                .from('whatsapp_messages')
                .insert({
                    company_id: companyId,
                    conversation_id: conversationId,
                    message_text: initialMessage,
                    is_from_customer: false,
                    sent_by: profile?.id
                });
        }

        // 4. Redirect
        alert(`Conversa iniciada com ${contactName}!`);
        if (onBack) onBack();
    };

    return (
        <div className="h-full flex items-center justify-center bg-gray-50/50 dark:bg-transparent p-6">
            <div className="bg-white dark:bg-slate-900/90 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 dark:border-white/5">
                <div className="bg-emerald-600 p-8 text-white text-center relative">
                    {onBack && (
                        <button 
                            onClick={onBack}
                            className="absolute left-6 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-xl transition-all"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    )}
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                        <MessageCircle className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-semibold tracking-tight">Novo Atendimento</h2>
                    <p className="text-emerald-100 mt-1 text-sm font-medium">Inicie uma nova conversa via WhatsApp</p>
                </div>

                <div className="p-10 space-y-8">
                    {!selectedContact && !isManual ? (
                        <div className="space-y-6">
                            <div className="flex flex-col gap-4">
                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Buscar Contato</label>
                                <div className="relative group">
                                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors w-5 h-5" />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-14 pr-6 py-4 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 transition-all dark:text-white"
                                        placeholder="Nome ou telefone..."
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                {contacts.map(contact => (
                                    <button
                                        key={contact.id}
                                        onClick={() => setSelectedContact(contact)}
                                        className="w-full flex items-center p-4 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-2xl transition-all text-left group border border-transparent hover:border-emerald-500/20"
                                    >
                                        <div className="w-12 h-12 bg-gray-100 dark:bg-white/10 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/20 group-hover:text-emerald-600 transition-all">
                                            <User className="w-6 h-6" />
                                        </div>
                                        <div className="ml-4">
                                            <p className="font-semibold text-gray-900 dark:text-white">{contact.name}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{contact.phone}</p>
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-gray-300 ml-auto group-hover:text-emerald-500 transition-all" />
                                    </button>
                                ))}
                            </div>

                            <div className="relative py-4">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100 dark:border-white/5"></div></div>
                                <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold text-gray-400"><span className="bg-white dark:bg-slate-900 px-4">Ou</span></div>
                            </div>

                            <button
                                onClick={() => setIsManual(true)}
                                className="w-full flex items-center justify-center gap-3 p-5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-2xl text-gray-600 dark:text-gray-300 hover:bg-emerald-50 hover:border-emerald-500/30 hover:text-emerald-600 transition-all font-semibold"
                            >
                                <Smartphone className="w-5 h-5" />
                                Digitar número manualmente
                            </button>
                        </div>
                    ) : (isManual && !selectedContact) ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                             <div className="flex flex-col gap-4">
                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Número do WhatsApp</label>
                                <input
                                    type="text"
                                    value={manualNumber}
                                    onChange={(e) => setManualNumber(e.target.value)}
                                    className="w-full px-6 py-4 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl text-2xl font-semibold tracking-tighter focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 transition-all dark:text-white"
                                    placeholder="5511999999999"
                                    autoFocus
                                />
                                <p className="text-xs text-gray-400">Inclua o código do país e DDD (ex: 5511...)</p>
                            </div>
                            
                            <button 
                                onClick={() => setIsManual(false)}
                                className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                            >
                                ← Voltar para busca
                            </button>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Canal</label>
                                    <select
                                        value={selectedChannel}
                                        onChange={(e) => setSelectedChannel(e.target.value)}
                                        className="w-full px-5 py-4 bg-gray-100/50 dark:bg-white/5 border border-transparent rounded-2xl focus:ring-2 focus:ring-emerald-500/20 dark:text-white appearance-none font-medium"
                                    >
                                        {channels.map(c => (
                                            <option key={c.id} value={c.id}>{c.connection_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Fila</label>
                                    <select 
                                        value={selectedQueue}
                                        onChange={(e) => setSelectedQueue(e.target.value)}
                                        className="w-full px-5 py-4 bg-gray-100/50 dark:bg-white/5 border border-transparent rounded-2xl focus:ring-2 focus:ring-emerald-500/20 dark:text-white appearance-none font-medium"
                                    >
                                        <option value="">Sem fila</option>
                                        {queues.map(q => (
                                            <option key={q.id} value={q.id}>{q.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="pt-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Mensagem Inicial</label>
                                <textarea
                                    value={initialMessage}
                                    onChange={(e) => setInitialMessage(e.target.value)}
                                    className="w-full px-6 py-4 bg-gray-100/50 dark:bg-white/5 border border-transparent rounded-2xl focus:ring-2 focus:ring-emerald-500/20 dark:text-white min-h-[120px] resize-none font-medium"
                                    placeholder="Olá! Como posso ajudar?"
                                />
                            </div>

                            <button 
                                onClick={handleStartConversation}
                                className="w-full py-5 bg-emerald-600 text-white rounded-[1.5rem] font-bold text-lg hover:bg-emerald-700 shadow-xl shadow-emerald-500/20 transition-all transform active:scale-[0.98] flex items-center justify-center gap-3"
                            >
                                <Send className="w-5 h-5" />
                                Iniciar Conversa
                            </button>
                        </div>
                    ) : (
                        // Conversation Setup Step (Selection confirmed)
                        <div className="space-y-8 animate-in slide-in-from-right duration-500">
                            <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-500/10 p-6 rounded-3xl border border-emerald-500/20">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                        <User className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white text-lg">{selectedContact?.name}</p>
                                        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-bold tracking-tight">{selectedContact?.phone}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setSelectedContact(null)}
                                    className="px-4 py-2 text-sm font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all"
                                >
                                    Trocar
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Canal de Envio</label>
                                    <select
                                        value={selectedChannel}
                                        onChange={(e) => setSelectedChannel(e.target.value)}
                                        className="w-full px-5 py-4 bg-gray-100/50 dark:bg-white/5 border border-transparent rounded-2xl focus:ring-2 focus:ring-emerald-500/20 dark:text-white font-medium"
                                    >
                                        {channels.map(c => (
                                            <option key={c.id} value={c.id}>{c.connection_name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Fila</label>
                                    <select 
                                        value={selectedQueue}
                                        onChange={(e) => setSelectedQueue(e.target.value)}
                                        className="w-full px-5 py-4 bg-gray-100/50 dark:bg-white/5 border border-transparent rounded-2xl focus:ring-2 focus:ring-emerald-500/20 dark:text-white font-medium"
                                    >
                                        <option value="">Sem fila</option>
                                        {queues.map(q => (
                                            <option key={q.id} value={q.id}>{q.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Mensagem Inicial</label>
                                <textarea
                                    value={initialMessage}
                                    onChange={(e) => setInitialMessage(e.target.value)}
                                    className="w-full px-6 py-4 bg-gray-100/50 dark:bg-white/5 border border-transparent rounded-2xl focus:ring-2 focus:ring-emerald-500/20 dark:text-white min-h-[120px] resize-none font-medium"
                                    placeholder="Escreva a primeira mensagem..."
                                />
                            </div>

                            <button 
                                onClick={handleStartConversation}
                                className="w-full py-5 bg-emerald-600 text-white rounded-[1.5rem] font-bold text-lg hover:bg-emerald-700 shadow-xl shadow-emerald-500/20 transition-all transform active:scale-[0.98] flex items-center justify-center gap-3"
                            >
                                <Send className="w-5 h-5" />
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
