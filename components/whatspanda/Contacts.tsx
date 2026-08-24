import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { WhatsAppContact, WhatsAppQueue, WhatsAppTag } from '../../types';
import { Search, Plus, User, Tag, Layers, MoreVertical, Edit2, Trash2, X, Check } from 'lucide-react';

import NewTicket from './NewTicket';

const Contacts: React.FC = () => {
    const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal & Form State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAutoAttendanceOpen, setIsAutoAttendanceOpen] = useState(false);
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

    const fetchContacts = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('whatsapp_contacts')
            .select('*')
            .order('name', { ascending: true });
        
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
            const { error: insertError } = await supabase
                .from('whatsapp_contacts')
                .insert({ ...contactData, company_id: '15d38706-59a6-43b8-9366-2371904d90ce' }); // Hardcoded for MVP
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
        <div className="flex h-full flex-col bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 p-6 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Contatos</h2>
                    <p className="text-gray-500 text-sm">Gerencie sua base de contatos do WhatsApp.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsAutoAttendanceOpen(true)}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm gap-2"
                        title="Iniciar Atendimento Automático"
                    >
                        <img src="/img/panda_phone_icon.png" alt="Panda" className="w-6 h-6 rounded-full bg-white p-0.5" />
                        <span className="font-medium">Atendimento Automático</span>
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Novo Contato
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="p-4 bg-white border-b border-gray-200 flex gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou telefone..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="text-center py-10 text-gray-500">Carregando contatos...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredContacts.map(contact => (
                            <div key={contact.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
                                            <User className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900">{contact.name}</h3>
                                            <p className="text-sm text-gray-500">{contact.phone}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleOpenModal(contact)}
                                        className="text-gray-400 hover:text-green-600 p-1 rounded-full hover:bg-green-50 transition-colors"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="mt-auto space-y-3">
                                    {/* Queue Info */}
                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                        <Layers className="w-3.5 h-3.5" />
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
                                                        className="px-2 py-0.5 text-[10px] rounded-full font-medium"
                                                        style={{ backgroundColor: tag.color + '20', color: tag.color }}
                                                    >
                                                        {tag.name}
                                                    </span>
                                                ) : null;
                                            })
                                        ) : (
                                            <span className="text-xs text-gray-400 italic flex items-center gap-1">
                                                <Tag className="w-3 h-3" /> Sem etiquetas
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {filteredContacts.length === 0 && (
                            <div className="col-span-full py-12 text-center text-gray-400">
                                Nenhum contato encontrado.
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* New Ticket / Auto Attendance Modal */}
            {isAutoAttendanceOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[80vh] overflow-hidden flex flex-col relative">
                        <button 
                            onClick={() => setIsAutoAttendanceOpen(false)}
                            className="absolute top-4 right-4 z-10 bg-white rounded-full p-1 shadow-md hover:bg-gray-100"
                        >
                            <X className="w-6 h-6 text-gray-600" />
                        </button>
                        <div className="flex-1 overflow-hidden">
                             <NewTicket />
                        </div>
                    </div>
                 </div>
            )}
            
            {/* Contact Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="text-xl font-bold text-gray-900">
                                {editingContact ? 'Editar Contato' : 'Novo Contato'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                        placeholder="Ex: Maria Silva"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone (WhatsApp)</label>
                                    <input
                                        type="text"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                        placeholder="Ex: 5511999999999"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Anotações</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                    rows={3}
                                    placeholder="Observações sobre o cliente..."
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Fila Preferencial</label>
                                    <select
                                        value={selectedQueue}
                                        onChange={(e) => setSelectedQueue(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                    >
                                        <option value="">Nenhuma</option>
                                        {availableQueues.map(q => (
                                            <option key={q.id} value={q.id}>{q.name}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Etiquetas</label>
                                    <div className="flex flex-wrap gap-2 border border-gray-200 rounded-lg p-3 bg-gray-50 min-h-[50px]">
                                        {availableTags.map(tag => (
                                            <button
                                                key={tag.id}
                                                onClick={() => toggleTag(tag.id)}
                                                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                                                    selectedTags.includes(tag.id)
                                                    ? 'ring-2 ring-offset-1'
                                                    : 'opacity-60 hover:opacity-100'
                                                }`}
                                                style={{ 
                                                    backgroundColor: tag.color + '20', 
                                                    color: tag.color,
                                                    boxShadow: selectedTags.includes(tag.id) ? `0 0 0 2px ${tag.color}` : 'none'
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

                        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-6 py-2.5 text-gray-700 hover:bg-white border border-transparent hover:border-gray-200 rounded-lg transition-all font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-medium shadow-md shadow-green-600/20 flex items-center"
                            >
                                <Check className="w-5 h-5 mr-2" />
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
