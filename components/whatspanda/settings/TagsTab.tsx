import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { WhatsAppTag } from '../../../types';
import { Plus, Edit2, Trash2, X, Check, Tag } from 'lucide-react';

const TagsTab: React.FC = () => {
    const [tags, setTags] = useState<WhatsAppTag[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTag, setEditingTag] = useState<WhatsAppTag | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [color, setColor] = useState('#10B981');

    useEffect(() => {
        fetchTags();
    }, []);

    const fetchTags = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('whatsapp_tags')
            .select('*')
            .order('created_at', { ascending: true });
        
        if (error) console.error('Error fetching tags:', error);
        else setTags(data || []);
        setLoading(false);
    };

    const handleOpenModal = (tag?: WhatsAppTag) => {
        if (tag) {
            setEditingTag(tag);
            setName(tag.name);
            setColor(tag.color);
        } else {
            setEditingTag(null);
            setName('');
            setColor('#10B981');
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!name.trim()) return;

        const tagData = {
            name,
            color,
            company_id: '15d38706-59a6-43b8-9366-2371904d90ce', // TODO: Get from context/auth
            is_active: true
        };

        let error;
        if (editingTag) {
            const { error: updateError } = await supabase
                .from('whatsapp_tags')
                .update(tagData)
                .eq('id', editingTag.id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase
                .from('whatsapp_tags')
                .insert(tagData);
            error = insertError;
        }

        if (error) {
            console.error('Error saving tag:', error);
            alert('Erro ao salvar tag.');
        } else {
            fetchTags();
            setIsModalOpen(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta tag?')) return;

        const { error } = await supabase
            .from('whatsapp_tags')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting tag:', error);
            alert('Erro ao excluir tag.');
        } else {
            fetchTags();
        }
    };

    const handleToggleActive = async (tag: WhatsAppTag) => {
        const { error } = await supabase
            .from('whatsapp_tags')
            .update({ is_active: !tag.is_active })
            .eq('id', tag.id);
        
        if (!error) fetchTags();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">Etiquetas (Tags)</h3>
                    <p className="text-sm text-gray-500">Organize seus contatos e atendimentos com etiquetas.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Tag
                </button>
            </div>

            {loading ? (
                <div className="text-center py-8 text-gray-500">Carregando tags...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tags.map((tag) => (
                        <div key={tag.id} className="bg-white p-4 rounded-lg border border-gray-200 flex justify-between items-center hover:shadow-sm transition-shadow">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-opacity-10" style={{ backgroundColor: tag.color + '20' }}>
                                    <Tag className="w-5 h-5" style={{ color: tag.color }} />
                                </div>
                                <div>
                                    <h4 className="font-medium text-gray-900">{tag.name}</h4>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${tag.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {tag.is_active ? 'Ativo' : 'Inativo'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleOpenModal(tag)} className="text-gray-400 hover:text-blue-600">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(tag.id)} className="text-gray-400 hover:text-red-600">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                     {tags.length === 0 && (
                        <div className="col-span-3 text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                            Nenhuma etiqueta cadastrada.
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900">
                                {editingTag ? 'Editar Tag' : 'Nova Tag'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
                                    placeholder="Ex: Cliente VIP"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Cor</label>
                                <div className="flex gap-2 flex-wrap">
                                    {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280', '#000000'].map((c) => (
                                        <button
                                            key={c}
                                            onClick={() => setColor(c)}
                                            className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-gray-900' : 'border-transparent'}`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
                            >
                                <Check className="w-4 h-4 mr-2" />
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TagsTab;
