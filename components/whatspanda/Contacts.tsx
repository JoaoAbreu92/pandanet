import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { WhatsAppContact, WhatsAppQueue, WhatsAppTag } from '../../types';
import { Search, Plus, User, Tag, Layers, MoreVertical, Edit2, Trash2, X, Check, RefreshCw } from 'lucide-react';
import { useAuth } from '../AuthContext';
interface ContactsProps {
    initialSearch?: string;
}

const Contacts: React.FC<ContactsProps> = ({ initialSearch = '' }) => {
    const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    
    // Modal & Form State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<WhatsAppContact | null>(null);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [notes, setNotes] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedQueue, setSelectedQueue] = useState<string>('');

    // Auxiliary Data
    const [availableTags, setAvailableTags] = useState<WhatsAppTag[]>([]);
    const [availableQueues, setAvailableQueues] = useState<WhatsAppQueue[]>([]);

    useEffect(() => {
        fetchContacts();
        fetchAuxData();
    }, []);

    const { profile, user } = useAuth();
    
    // Update searchTerm if initialSearch changes
    useEffect(() => {
        if (initialSearch !== undefined) {
            setSearchTerm(initialSearch);
        }
    }, [initialSearch]);

    const fetchContacts = async () => {
        const companyId = profile?.company_id || user?.user_metadata?.company_id;
        if (!companyId) return;

        setLoading(true);
        const { data, error } = await supabase
            .from('whatsapp_contacts')
            .select('*')
            .eq('company_id', companyId)
            .order('updated_at', { ascending: false })
            .limit(100);
        
        if (error) {
            // handle specialized error if table doesn't exist yet (migration might be needed)
            console.error('Error fetching contacts:', error);
        } else {
            setContacts(data || []);
        }
        setLoading(false);
    };

    const fetchAuxData = async () => {
        const { data: tags } = await supabase.from('whatsapp_tags').select('*').eq('is_active', true);
        if (tags) setAvailableTags(tags);

        const { data: queues } = await supabase.from('whatsapp_queues').select('*').eq('is_active', true);
        if (queues) setAvailableQueues(queues);
    };

    const handleSyncContacts = async () => {
        const companyId = profile?.company_id || user?.user_metadata?.company_id;
        if (!companyId) return;

        setSyncing(true);
        try {
            // 1. Get connection ID
            const { data: settings } = await supabase
                .from('whatsapp_settings')
                .select('id')
                .eq('company_id', companyId)
                .limit(1)
                .single();
            
            if (settings?.id) {
                // Get current session token
                const { data: sessionData } = await supabase.auth.getSession();
                const token = sessionData?.session?.access_token;

                if (!token) {
                    throw new Error("No active session token found");
                }

                await fetch(`/api/whatsapp/sync/${companyId}/${settings.id}`, { 
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
            }

            // 3. Refresh list from Supabase
            await fetchContacts();
            alert('Sincronização iniciada em segundo plano! Os contatos aparecerão em instantes.');
        } catch (error: any) {
            console.error('Error syncing:', error);
            alert(`Erro ao iniciar sincronização: ${error.message || 'Erro desconhecido'}`);
        } finally {
            setSyncing(false);
        }
    };

    const handleOpenModal = (contact?: WhatsAppContact) => {
        if (contact) {
            setEditingContact(contact);
            setName(contact.name);
            setPhone(contact.phone);
            setNotes(contact.notes || '');
            setSelectedTags(contact.tags || []);
            setSelectedQueue(contact.queue_id || '');
        } else {
            setEditingContact(null);
            setName('');
            setPhone('');
            setNotes('');
            setSelectedTags([]);
            setSelectedQueue('');
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!name.trim() || !phone.trim()) {
            alert('Nome e Telefone são obrigatórios.');
            return;
        }

        const contactData = {
            name,
            phone,
            notes,
            tags: selectedTags,
            queue_id: selectedQueue || null,
            // company_id: '...' // handled by default or auth context usually
        };

        let error;
        if (editingContact) {
            const { error: updateError } = await supabase
                .from('whatsapp_contacts')
                .update(contactData)
                .eq('id', editingContact.id);
            error = updateError;
        } else {
            const companyId = profile?.company_id || user?.user_metadata?.company_id;
            const { error: insertError } = await supabase
                .from('whatsapp_contacts')
                .insert({ ...contactData, company_id: companyId });
            error = insertError;
        }

        if (error) {
            console.error('Error saving contact:', error);
            alert('Erro ao salvar contato.');
        } else {
            fetchContacts();
            setIsModalOpen(false);
        }
    };

    const toggleTag = (tagId: string) => {
        if (selectedTags.includes(tagId)) {
            setSelectedTags(selectedTags.filter(id => id !== tagId));
        } else {
            setSelectedTags([...selectedTags, tagId]);
        }
    };

    const filteredContacts = contacts.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.phone.includes(searchTerm)
    );

    return (
        <div className="flex h-full flex-col bg-gray-50 dark:bg-transparent transition-colors duration-500">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900/40 backdrop-blur-xl border-b border-gray-200 dark:border-white/5 p-8 flex justify-between items-center shadow-lg">
                <div>
                    <h2 className="text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">Contatos</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium opacity-80 uppercase tracking-widest mt-1">Gerencie sua base de contatos do WhatsApp.</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={handleSyncContacts}
                        disabled={syncing}
                        className={`flex items-center px-6 py-3 bg-blue-600/10 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl hover:bg-blue-600 hover:text-white transition-all duration-300 shadow-xl border border-blue-500/20 gap-2 font-semibold text-xs uppercase tracking-widest ${syncing ? 'opacity-70 cursor-wait' : ''}`}
                        title="Sincronizar Contatos do WhatsApp"
                    >
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        <span>{syncing ? 'Sincronizando...' : 'Sincronizar'}</span>
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center px-6 py-3 bg-emerald-500 text-white rounded-2xl hover:bg-emerald-600 dark:hover:bg-emerald-400 transition-all duration-300 shadow-xl shadow-emerald-500/20 font-semibold text-xs uppercase tracking-widest"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Novo Contato
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="p-6 bg-white/50 dark:bg-slate-900/20 border-b border-gray-200 dark:border-white/5 flex gap-4 backdrop-blur-md">
                <div className="relative flex-1 max-w-md group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou telefone..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-6 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 transition-all text-sm dark:text-white placeholder-gray-400 font-medium"
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {loading ? (
                    <div className="text-center py-20 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-xs">Carregando contatos...</div>
                ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredContacts.map(contact => (
                            <div key={contact.id} className="bg-white/50 dark:bg-white/5 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 p-6 flex flex-col group backdrop-blur-sm">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-gray-100 dark:bg-white/10 rounded-2xl flex items-center justify-center text-gray-500 dark:text-gray-300 shadow-inner group-hover:scale-110 transition-transform duration-500">
                                            <User className="w-7 h-7" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 dark:text-white tracking-tight text-lg">{contact.name}</h3>
                                            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest opacity-80">{contact.phone}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleOpenModal(contact)}
                                        className="text-gray-400 hover:text-emerald-500 p-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-500/20 transition-all duration-300 transform group-hover:rotate-12"
                                    >
                                        <Edit2 className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="mt-auto space-y-4">
                                    {/* Queue Info */}
                                    <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-gray-600 dark:text-gray-400">
                                        <Layers className="w-4 h-4 text-emerald-500" />
                                        <span>
                                            {availableQueues.find(q => q.id === contact.queue_id)?.name || 'Sem Fila'}
                                        </span>
                                    </div>

                                    {/* Tags */}
                                    <div className="flex flex-wrap gap-1">
                                        {contact.tags && contact.tags.length > 0 ? (
                                            contact.tags.map(tagId => {
                                                const tag = availableTags.find(t => t.id === tagId);
                                                return tag ? (
                                                    <span 
                                                        key={tagId} 
                                                        className="px-3 py-1 text-[9px] rounded-lg font-bold uppercase tracking-widest border"
                                                        style={{ backgroundColor: tag.color + '15', color: tag.color, borderColor: tag.color + '30' }}
                                                    >
                                                        {tag.name}
                                                    </span>
                                                ) : null;
                                            })
                                        ) : (
                                                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest flex items-center gap-2 italic">
                                                    <Tag className="w-3.5 h-3.5" /> Sem etiquetas
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {filteredContacts.length === 0 && (
                                <div className="col-span-full py-20 text-center text-gray-400 dark:text-gray-500 font-bold uppercase tracking-[0.2em] text-xs opacity-50">
                                Nenhum contato encontrado.
                            </div>
                        )}
                    </div>
                )}
            </div>


            
            {/* Contact Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-500">
                    <div className="bg-white dark:bg-slate-900/90 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20 dark:border-white/5">
                        <div className="p-8 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-transparent">
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                                {editingContact ? 'Editar Contato' : 'Novo Contato'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-2xl transition-all duration-300 text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto space-y-8 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Nome Completo</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-5 py-3.5 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all font-medium placeholder-gray-400"
                                        placeholder="Ex: Maria Silva"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Telefone (WhatsApp)</label>
                                    <input
                                        type="text"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="w-full px-5 py-3.5 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all font-medium placeholder-gray-400"
                                        placeholder="Ex: 5511999999999"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Anotações</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full px-5 py-3.5 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all font-medium placeholder-gray-400 resize-none"
                                    rows={4}
                                    placeholder="Observações sobre o cliente..."
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Fila Preferencial</label>
                                    <select
                                        value={selectedQueue}
                                        onChange={(e) => setSelectedQueue(e.target.value)}
                                        className="w-full px-5 py-3.5 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all font-medium appearance-none"
                                    >
                                        <option value="">Nenhuma</option>
                                        {availableQueues.map(q => (
                                            <option key={q.id} value={q.id} className="dark:bg-slate-900">{q.name}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Etiquetas</label>
                                    <div className="flex flex-wrap gap-2 border border-gray-100 dark:border-white/5 rounded-2xl p-4 bg-gray-100/30 dark:bg-white/5 min-h-[60px]">
                                        {availableTags.map(tag => (
                                            <button
                                                key={tag.id}
                                                onClick={() => toggleTag(tag.id)}
                                                className={`px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${
                                                    selectedTags.includes(tag.id)
                                                    ? 'scale-105 shadow-lg brightness-110'
                                                    : 'opacity-40 hover:opacity-100'
                                                }`}
                                                style={{ 
                                                    backgroundColor: tag.color + '25', 
                                                    color: tag.color,
                                                    border: `1px solid ${tag.color}40`,
                                                    boxShadow: selectedTags.includes(tag.id) ? `0 4px 12px ${tag.color}30` : 'none'
                                                }}
                                            >
                                                {tag.name}
                                            </button>
                                        ))}
                                        {availableTags.length === 0 && <span className="text-xs text-gray-400">Nenhuma tag disponível.</span>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-transparent flex justify-end gap-4">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-8 py-3.5 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-white/10 rounded-2xl transition-all font-bold text-xs uppercase tracking-[0.2em]"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-10 py-3.5 bg-emerald-500 text-white rounded-2xl hover:bg-emerald-600 dark:hover:bg-emerald-400 transition-all font-bold text-xs uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 flex items-center"
                            >
                                <Check className="w-5 h-5 mr-3" />
                                Salvar Contato
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Contacts;
