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
    const [assignedTo, setAssignedTo] = useState<string>('');

    // Auxiliary Data
    const [availableTags, setAvailableTags] = useState<WhatsAppTag[]>([]);
    const [availableQueues, setAvailableQueues] = useState<WhatsAppQueue[]>([]);
    const [availableUsers, setAvailableUsers] = useState<any[]>([]);

    const { profile, user, currentUser } = useAuth();
    
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
        const companyId = currentUser?.company_id;
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
        const companyId = currentUser?.company_id;
        if (!companyId) return;

        const { data: tags } = await supabase.from('whatsapp_tags').select('*').eq('company_id', companyId);
        if (tags) setAvailableTags(tags);

        const { data: queues } = await supabase.from('whatsapp_queues').select('*').eq('company_id', companyId);
        if (queues) setAvailableQueues(queues);

        const { data: users } = await supabase.from('profiles').select('id, full_name').eq('company_id', companyId);
        if (users) setAvailableUsers(users);
    };

    const handleSyncContacts = async () => {
        const companyId = currentUser?.company_id;
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
            setTimeout(() => {
                fetchContacts();
                alert('Sincronização concluída!');
            }, 2000);
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
            setIgnoreContact(contact.ignore_contact || false);
            setDisableTranscription(contact.disable_transcription || false);
            setDisableKanban(contact.disable_kanban || false);
            setAssignedTo(contact.assigned_to || '');
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
            setAssignedTo('');
        }
        setActiveTab('dados');
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!name.trim() || !phone.trim()) return;
        const companyId = currentUser?.company_id;
        
        const contactData: any = {
            name,
            phone,
            email,
            notes,
            tags: selectedTags,
            queue_id: selectedQueue || null,
            is_blocked: isBlocked,
            ignore_contact: ignoreContact,
            disable_transcription: disableTranscription,
            disable_kanban: disableKanban,
            assigned_to: assignedTo || null,
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
            {/* Toolbar */}
            <div className="p-4 flex flex-wrap gap-2 items-center bg-gray-50 dark:bg-[#11141d] border-b border-gray-200 dark:border-gray-800">
                <button 
                    onClick={handleSyncContacts}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#2d3245] border border-gray-200 dark:border-transparent hover:bg-gray-100 dark:hover:bg-[#3d445f] rounded-lg text-xs font-bold uppercase transition-all shadow-sm"
                >
                    <RefreshCw className={`w-4 h-4 text-emerald-500 ${syncing ? 'animate-spin' : ''}`} />
                    Sincronizar Contatos
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
            </div>

            {/* Tabela de Contatos */}
            <div className="flex-1 overflow-auto bg-white dark:bg-[#0f111a] custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-[#0f111a] border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-500 z-10">
                        <tr>
                            <th className="p-4 w-12"><input type="checkbox" className="rounded border-gray-300 dark:bg-gray-800 dark:border-gray-700" /></th>
                            <th className="p-4">Nome</th>
                            <th className="p-4">WhatsApp</th>
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
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-gray-900 dark:text-gray-200">{contact.name}</span>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            {contact.queue_id && (
                                                <span 
                                                    className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white uppercase"
                                                    style={{ backgroundColor: availableQueues.find(q => q.id === contact.queue_id)?.color || '#6366f1' }}
                                                >
                                                    {availableQueues.find(q => q.id === contact.queue_id)?.name || 'Setor'}
                                                </span>
                                            )}
                                            {contact.assigned_to && (
                                                <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-[9px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-1 uppercase">
                                                    <User className="w-2.5 h-2.5" />
                                                    {availableUsers.find(u => u.id === contact.assigned_to)?.full_name?.split(' ')[0] || 'Atendente'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 text-xs font-mono text-emerald-600 dark:text-emerald-500 font-semibold">{contact.phone}</td>
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

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
                    <div className="bg-white dark:bg-[#161a27] rounded-xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-800">
                            <UserPlus className="w-5 h-5 text-emerald-500" />
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex-1">
                                {editingContact ? 'Editar Contato' : 'Adicionar Contato'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 dark:text-gray-500 hover:text-red-500 rounded-lg transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#11141d]">
                            {['dados', 'kanban', 'etiqueta', 'anotacoes'].map(id => (
                                <button
                                    key={id}
                                    onClick={() => setActiveTab(id as any)}
                                    className={`flex-1 py-3 text-[10px] font-bold tracking-wider border-b-2 transition-all ${
                                        activeTab === id ? 'border-emerald-500 text-emerald-600 dark:text-white' : 'border-transparent text-gray-400'
                                    }`}
                                >
                                    {id.toUpperCase()}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            {activeTab === 'dados' && (
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Nome</label>
                                        <input 
                                            type="text" 
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full bg-gray-50 dark:bg-[#11141d] border border-gray-200 dark:border-gray-800 rounded-lg p-2.5 text-sm outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">WhatsApp</label>
                                        <input 
                                            type="text" 
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            className="w-full bg-gray-50 dark:bg-[#11141d] border border-gray-200 dark:border-gray-800 rounded-lg p-2.5 text-sm outline-none font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">E-mail</label>
                                        <input 
                                            type="email" 
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-gray-50 dark:bg-[#11141d] border border-gray-200 dark:border-gray-800 rounded-lg p-2.5 text-sm outline-none"
                                        />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase">Setor (Fila)</label>
                                            <select 
                                                value={selectedQueue}
                                                onChange={(e) => setSelectedQueue(e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-[#11141d] border border-gray-200 dark:border-gray-800 rounded-lg p-2.5 text-sm outline-none"
                                            >
                                                <option value="">Nenhum</option>
                                                {availableQueues.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase">Atendente (Usuário)</label>
                                            <select 
                                                value={assignedTo}
                                                onChange={(e) => setAssignedTo(e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-[#11141d] border border-gray-200 dark:border-gray-800 rounded-lg p-2.5 text-sm outline-none"
                                            >
                                                <option value="">Nenhum</option>
                                                {availableUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'etiqueta' && (
                                <div className="grid grid-cols-2 gap-2">
                                    {availableTags.map(tag => (
                                        <button
                                            key={tag.id}
                                            onClick={() => {
                                                if (selectedTags.includes(tag.id)) setSelectedTags(selectedTags.filter(id => id !== tag.id));
                                                else setSelectedTags([...selectedTags, tag.id]);
                                            }}
                                            className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                                                selectedTags.includes(tag.id) ? 'bg-emerald-500/10 border-emerald-500' : 'bg-gray-50 dark:bg-[#11141d] border-gray-800'
                                            }`}
                                        >
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                                            <span className="text-[10px] font-bold uppercase">{tag.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'anotacoes' && (
                                <textarea 
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-[#11141d] border border-gray-200 dark:border-gray-800 rounded-lg p-4 text-sm outline-none resize-none h-48"
                                    placeholder="Notas internas..."
                                />
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg text-xs font-bold uppercase transition-all">Cancelar</button>
                            <button onClick={handleSave} className="px-8 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold uppercase transition-all">Salvar</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
            `}</style>
        </div>
    );
};

export default Contacts;
