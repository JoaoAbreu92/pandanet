import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { WhatsAppContact, WhatsAppQueue, WhatsAppTag } from '../../types';
import { 
    Search, Plus, User, Tag, Layers, MoreVertical, Edit2, Trash2, X, Check, RefreshCw, 
    MessageSquare, Mail, UserPlus, Filter, ShieldOff, Shield, Ban, ListFilter, LayoutGrid
} from 'lucide-react';
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
    const [activeTab, setActiveTab] = useState<'dados' | 'kanban' | 'etiqueta' | 'anotacoes'>('dados');
    
    // Form fields
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [notes, setNotes] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedQueue, setSelectedQueue] = useState<string>('');
    const [isBlocked, setIsBlocked] = useState(false);
    const [ignoreContact, setIgnoreContact] = useState(false);
    const [disableTranscription, setDisableTranscription] = useState(false);
    const [disableKanban, setDisableKanban] = useState(false);

    // Auxiliary Data
    const [availableTags, setAvailableTags] = useState<WhatsAppTag[]>([]);
    const [availableQueues, setAvailableQueues] = useState<WhatsAppQueue[]>([]);
    const [availableUsers, setAvailableUsers] = useState<any[]>([]);

    const { profile, user } = useAuth();
    
    useEffect(() => {
        fetchContacts();
        fetchAuxData();
    }, []);

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
        
        if (!error) setContacts(data || []);
        setLoading(false);
    };

    const fetchAuxData = async () => {
        const companyId = profile?.company_id || user?.user_metadata?.company_id;
        if (!companyId) return;

        const { data: tags } = await supabase.from('whatsapp_tags').select('*').eq('company_id', companyId);
        if (tags) setAvailableTags(tags);

        const { data: queues } = await supabase.from('whatsapp_queues').select('*').eq('company_id', companyId);
        if (queues) setAvailableQueues(queues);

        const { data: users } = await supabase.from('profiles').select('id, full_name').eq('company_id', companyId);
        if (users) setAvailableUsers(users);
    };

    const handleSyncContacts = async () => {
        const companyId = profile?.company_id || user?.user_metadata?.company_id;
        if (!companyId) return;
        setSyncing(true);
        try {
            const { data: settings } = await supabase.from('whatsapp_settings').select('id').eq('company_id', companyId).limit(1).single();
            if (settings?.id) {
                const { data: sessionData } = await supabase.auth.getSession();
                const token = sessionData?.session?.access_token;
                if (token) {
                    await fetch(`/api/whatsapp/sync/${companyId}/${settings.id}`, { 
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                }
            }
            setTimeout(() => fetchContacts(), 2000);
        } catch (error) {
            console.error('Error syncing:', error);
        } finally {
            setSyncing(false);
        }
    };

    const handleOpenModal = (contact?: WhatsAppContact) => {
        if (contact) {
            setEditingContact(contact);
            setName(contact.name || '');
            setPhone(contact.phone || '');
            setEmail(contact.email || '');
            setNotes(contact.notes || '');
            setSelectedTags(contact.tags || []);
            setSelectedQueue(contact.queue_id || '');
            setIsBlocked(contact.is_blocked || false);
            // Simulação de outros campos do print 3
            setIgnoreContact(contact.ignore_contact || false);
            setDisableTranscription(contact.disable_transcription || false);
            setDisableKanban(contact.disable_kanban || false);
        } else {
            setEditingContact(null);
            setName('');
            setPhone('');
            setEmail('');
            setNotes('');
            setSelectedTags([]);
            setSelectedQueue('');
            setIsBlocked(false);
            setIgnoreContact(false);
            setDisableTranscription(false);
            setDisableKanban(false);
        }
        setActiveTab('dados');
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!name.trim() || !phone.trim()) return;
        const companyId = profile?.company_id || user?.user_metadata?.company_id;
        
        const contactData = {
            name,
            phone,
            email,
            notes,
            tags: selectedTags,
            queue_id: selectedQueue || null,
            is_blocked: isBlocked,
            // Mock de suporte para campos do print 3 no futuro
            ignore_contact: ignoreContact,
            disable_transcription: disableTranscription,
            disable_kanban: disableKanban,
            updated_at: new Date().toISOString()
        };

        let res;
        if (editingContact) {
            res = await supabase.from('whatsapp_contacts').update(contactData).eq('id', editingContact.id);
        } else {
            res = await supabase.from('whatsapp_contacts').insert({ ...contactData, company_id: companyId });
        }

        if (!res.error) {
            fetchContacts();
            setIsModalOpen(false);
        }
    };

    const toggleBlock = async (contact: WhatsAppContact) => {
        const { error } = await supabase
            .from('whatsapp_contacts')
            .update({ is_blocked: !contact.is_blocked })
            .eq('id', contact.id);
        if (!error) fetchContacts();
    };

    const handleDelete = async (contactId: string) => {
        if (!window.confirm('Excluir este contato?')) return;
        const { error } = await supabase.from('whatsapp_contacts').delete().eq('id', contactId);
        if (!error) fetchContacts();
    };

    const filteredContacts = contacts.filter(c => 
        (c.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
        (c.phone || '').includes(searchTerm) ||
        (c.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex h-full flex-col bg-white dark:bg-[#0f111a] text-gray-700 dark:text-gray-300 overflow-hidden font-sans transition-colors duration-300">
            {/* Toolbar - Estilo Print 2 */}
            <div className="p-4 flex flex-wrap gap-2 items-center bg-gray-50 dark:bg-[#161925] border-b border-gray-200 dark:border-gray-800">
                <button 
                    onClick={handleSyncContacts}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#2d3245] border border-gray-200 dark:border-transparent hover:bg-gray-100 dark:hover:bg-[#3d445f] rounded-lg text-xs font-bold uppercase transition-all shadow-sm"
                >
                    <RefreshCw className={`w-4 h-4 text-emerald-500 ${syncing ? 'animate-spin' : ''}`} />
                    Sincronizar Contatos
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#2d3245] border border-gray-200 dark:border-transparent rounded-lg text-xs font-bold uppercase opacity-40 cursor-not-allowed shadow-sm">
                    <RefreshCw className="w-4 h-4" /> Sincronizar Grupos
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#2d3245] border border-gray-200 dark:border-transparent rounded-lg text-xs font-bold uppercase opacity-40 cursor-not-allowed shadow-sm">
                    <RefreshCw className="w-4 h-4 transform rotate-90" /> Importar
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#2d3245] border border-gray-200 dark:border-transparent rounded-lg text-xs font-bold uppercase opacity-40 cursor-not-allowed shadow-sm">
                    <RefreshCw className="w-4 h-4 transform -rotate-90" /> Exportar
                </button>
                <button 
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg text-xs font-bold uppercase ml-auto shadow-md"
                >
                    <Plus className="w-4 h-4" /> Adicionar
                </button>
            </div>

            {/* Filtros */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-[#0f111a]">
                <div className="relative col-span-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Localizar contato..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-[#161925] border border-gray-200 dark:border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:border-emerald-500 outline-none transition-all dark:text-white"
                    />
                </div>
                <div className="relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select className="w-full bg-gray-50 dark:bg-[#161925] border border-gray-200 dark:border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm appearance-none outline-none dark:text-white">
                        <option>Etiquetas</option>
                    </select>
                </div>
                <div className="relative">
                    <ListFilter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select className="w-full bg-gray-50 dark:bg-[#161925] border border-gray-200 dark:border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm appearance-none outline-none dark:text-white">
                        <option>Carteira</option>
                    </select>
                </div>
            </div>

            {/* Tabela de Contatos */}
            <div className="flex-1 overflow-auto bg-white dark:bg-[#0f111a] custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-[#0f111a] border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-500 z-10">
                        <tr>
                            <th className="p-4 w-12"><input type="checkbox" className="rounded border-gray-300 dark:bg-gray-800 dark:border-gray-700" /></th>
                            <th className="p-4">Nome</th>
                            <th className="p-4">WhatsApp</th>
                            <th className="p-4">Carteira</th>
                            <th className="p-4">Etiquetas</th>
                            <th className="p-4">Email</th>
                            <th className="p-4 text-center">Bloquear</th>
                            <th className="p-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                        {filteredContacts.map(contact => (
                            <tr key={contact.id} className="hover:bg-gray-50 dark:hover:bg-[#161925] transition-colors group">
                                <td className="p-4"><input type="checkbox" className="rounded border-gray-300 dark:bg-gray-800 dark:border-gray-700" /></td>
                                <td className="p-4 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                                        {contact.name?.charAt(0) || <User className="w-4 h-4" />}
                                    </div>
                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-200">{contact.name}</span>
                                </td>
                                <td className="p-4 text-xs font-mono text-emerald-600 dark:text-emerald-500 font-semibold">{contact.phone}</td>
                                <td className="p-4"><span className="text-xs text-gray-400 dark:text-gray-500 italic">Nenhuma</span></td>
                                <td className="p-4">
                                    <div className="flex gap-1">
                                        {contact.tags?.map(t => (
                                            <div key={t} title={availableTags.find(at => at.id === t)?.name} className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: availableTags.find(at => at.id === t)?.color || '#ccc' }} />
                                        ))}
                                    </div>
                                </td>
                                <td className="p-4 text-xs text-gray-500">{contact.email || '-'}</td>
                                <td className="p-4 text-center">
                                    <button 
                                        onClick={() => toggleBlock(contact)}
                                        className={`transition-colors p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 ${contact.is_blocked ? 'text-red-500' : 'text-emerald-500'}`}
                                        title={contact.is_blocked ? 'Desbloquear' : 'Bloquear'}
                                    >
                                        <Ban className="w-5 h-5" />
                                    </button>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => alert('Iniciando conversa...')}
                                            className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 rounded-lg transition-all"
                                        >
                                            <MessageSquare className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleOpenModal(contact)} className="p-2 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-blue-600 dark:text-blue-500 rounded-lg transition-all">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(contact.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 dark:text-red-500 rounded-lg transition-all">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal de Edição Reformulado - Estilo Print 3 */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
                    <div className="bg-white dark:bg-[#161a27] rounded-xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-300">
                        {/* Header do Modal */}
                        <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-800">
                            <UserPlus className="w-5 h-5 text-emerald-500" />
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex-1">
                                {editingContact ? 'Editar Contato' : 'Adicionar Contato'}
                            </h3>
                            <div className="flex items-center gap-2">
                                <button className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 rounded-lg transition-all">
                                    <MessageSquare className="w-5 h-5" />
                                </button>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 dark:text-gray-500 hover:text-red-500 rounded-lg transition-all">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#1e2335]">
                            {[
                                { id: 'dados', label: 'DADOS CONTATO', icon: User },
                                { id: 'kanban', label: 'KANBAN', icon: LayoutGrid },
                                { id: 'etiqueta', label: 'ETIQUETA', icon: Tag },
                                { id: 'anotacoes', label: 'ANOTAÇÕES', icon: Edit2 },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 border-b-2 transition-all ${
                                        activeTab === tab.id 
                                        ? 'border-emerald-500 text-emerald-600 dark:text-white' 
                                        : 'border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                                    }`}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    <span className="text-[9px] font-extrabold tracking-wider">{tab.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Conteúdo do Modal */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-white dark:bg-transparent">
                            {activeTab === 'dados' && (
                                <div className="space-y-6">
                                    <div className="bg-gray-50 dark:bg-[#11141d] p-4 rounded-xl border border-gray-200 dark:border-gray-800 relative group focus-within:border-emerald-500 transition-all">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2">
                                            <User className="w-4 h-4 text-emerald-500" />
                                        </div>
                                        <input 
                                            type="text" 
                                            placeholder="Nome 👶"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full bg-transparent pl-10 pr-4 py-1 text-sm outline-none text-gray-900 dark:text-white"
                                        />
                                    </div>

                                    <div className="bg-gray-50 dark:bg-[#11141d] p-4 rounded-xl border border-gray-200 dark:border-gray-800 relative group focus-within:border-emerald-500 transition-all">
                                        <input 
                                            type="text" 
                                            placeholder="WhatsApp"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            className="w-full bg-transparent pl-4 pr-10 py-1 text-sm outline-none text-gray-900 dark:text-white font-mono"
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            <MessageSquare className="w-4 h-4 text-emerald-500" />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 text-[11px] font-bold text-emerald-600 dark:text-emerald-500/80 px-2 cursor-pointer select-none" onClick={() => { /* Op op op */ }}>
                                        <div className={`w-10 h-5 rounded-full relative transition-all duration-300 ${ignoreContact ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm ${ignoreContact ? 'left-6' : 'left-1'}`} />
                                        </div>
                                        <span className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Validar se o número possui WhatsApp</span>
                                    </div>

                                    <div className="bg-gray-50 dark:bg-[#11141d] p-4 rounded-xl border border-gray-200 dark:border-gray-800 relative group focus-within:border-emerald-500 transition-all">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2">
                                            <Mail className="w-4 h-4 text-emerald-500" />
                                        </div>
                                        <input 
                                            type="email" 
                                            placeholder="E-mail"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-transparent pl-10 pr-4 py-1 text-sm outline-none text-gray-900 dark:text-white"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-2">
                                        <div className="flex items-center justify-between p-2">
                                            <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-2 uppercase tracking-wider">
                                                <Ban className="w-3.5 h-3.5 text-red-400" /> Ignorar contato
                                            </span>
                                            <div className={`w-8 h-4 rounded-full relative transition-all cursor-pointer ${ignoreContact ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`} onClick={() => setIgnoreContact(!ignoreContact)}>
                                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${ignoreContact ? 'left-4.5 translate-x-1' : 'left-0.5'}`} />
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between p-2">
                                            <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-2 uppercase tracking-wider">
                                                <RefreshCw className="w-3.5 h-3.5 text-blue-400" /> Desativar Transcrição
                                            </span>
                                            <div className={`w-8 h-4 rounded-full relative transition-all cursor-pointer ${disableTranscription ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`} onClick={() => setDisableTranscription(!disableTranscription)}>
                                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${disableTranscription ? 'left-4.5 translate-x-1' : 'left-0.5'}`} />
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between p-2">
                                            <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-2 uppercase tracking-wider">
                                                <LayoutGrid className="w-3.5 h-3.5 text-purple-400" /> Desativar KANBAN
                                            </span>
                                            <div className={`w-8 h-4 rounded-full relative transition-all cursor-pointer ${disableKanban ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`} onClick={() => setDisableKanban(!disableKanban)}>
                                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${disableKanban ? 'left-4.5 translate-x-1' : 'left-0.5'}`} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'kanban' && (
                                <div className="space-y-4">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Mover para Estágio Kanban</label>
                                    <select 
                                        value={selectedQueue}
                                        onChange={(e) => setSelectedQueue(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-[#11141d] border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm outline-none text-gray-900 dark:text-white appearance-none"
                                    >
                                        <option value="">Selecione um Estágio...</option>
                                        {availableQueues.map(q => (
                                            <option key={q.id} value={q.id}>{q.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {activeTab === 'etiqueta' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {availableTags.map(tag => (
                                        <button
                                            key={tag.id}
                                            onClick={() => {
                                                if (selectedTags.includes(tag.id)) setSelectedTags(selectedTags.filter(id => id !== tag.id));
                                                else setSelectedTags([...selectedTags, tag.id]);
                                            }}
                                            className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                                                selectedTags.includes(tag.id) 
                                                ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/20' 
                                                : 'bg-gray-50 dark:bg-[#11141d] border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                                            }`}
                                        >
                                            <div className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: tag.color }} />
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">{tag.name}</span>
                                            {selectedTags.includes(tag.id) && <Check className="w-3.5 h-3.5 ml-auto text-emerald-500" />}
                                        </button>
                                    ))}
                                    {availableTags.length === 0 && (
                                        <div className="col-span-2 py-8 text-center text-gray-400 italic text-xs">Nenhuma etiqueta cadastrada.</div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'anotacoes' && (
                                <textarea 
                                    placeholder="Escreva anotações internas sobre este contato..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-[#11141d] border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-sm outline-none resize-none h-48 focus:border-emerald-500 transition-all text-gray-900 dark:text-white"
                                />
                            )}
                        </div>

                        {/* Footer do Modal */}
                        <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50 dark:bg-transparent">
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="px-6 py-2.5 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold uppercase flex items-center gap-2 transition-all shadow-sm"
                            >
                                <X className="w-4 h-4" /> Cancelar
                            </button>
                            <button 
                                onClick={handleSave}
                                className="px-8 py-2.5 bg-[#161a27] dark:bg-emerald-500 hover:bg-black dark:hover:bg-emerald-600 text-white rounded-lg text-xs font-bold uppercase flex items-center gap-2 transition-all border border-gray-700 dark:border-transparent shadow-lg"
                            >
                                <Check className="w-4 h-4" /> {editingContact ? 'Salvar Alterações' : 'Criar Contato'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
            `}</style>
        </div>
    );
};

export default Contacts;

