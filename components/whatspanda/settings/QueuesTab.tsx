import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { WhatsAppQueue } from '../../../types';
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react';

const QueuesTab: React.FC = () => {
    const [queues, setQueues] = useState<WhatsAppQueue[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingQueue, setEditingQueue] = useState<WhatsAppQueue | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState('#3B82F6');

    useEffect(() => {
        fetchQueues();
    }, []);

    const fetchQueues = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('whatsapp_queues')
            .select('*')
            .order('created_at', { ascending: true });
        
        if (error) console.error('Error fetching queues:', error);
        else setQueues(data || []);
        setLoading(false);
    };

    const handleOpenModal = (queue?: WhatsAppQueue) => {
        if (queue) {
            setEditingQueue(queue);
            setName(queue.name);
            setDescription(queue.description || '');
            setColor(queue.color);
        } else {
            setEditingQueue(null);
            setName('');
            setDescription('');
            setColor('#3B82F6');
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!name.trim()) return;

        const queueData = {
            name,
            description,
            color,
            company_id: '15d38706-59a6-43b8-9366-2371904d90ce', // TODO: Get from context/auth
            is_active: true
        };

        let error;
        if (editingQueue) {
            const { error: updateError } = await supabase
                .from('whatsapp_queues')
                .update(queueData)
                .eq('id', editingQueue.id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase
                .from('whatsapp_queues')
                .insert(queueData);
            error = insertError;
        }

        if (error) {
            console.error('Error saving queue:', error);
            alert('Erro ao salvar fila.');
        } else {
            fetchQueues();
            setIsModalOpen(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta fila?')) return;

        const { error } = await supabase
            .from('whatsapp_queues')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting queue:', error);
            alert('Erro ao excluir fila.');
        } else {
            fetchQueues();
        }
    };

    const handleToggleActive = async (queue: WhatsAppQueue) => {
        const { error } = await supabase
            .from('whatsapp_queues')
            .update({ is_active: !queue.is_active })
            .eq('id', queue.id);
        
        if (!error) fetchQueues();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">Filas de Atendimento</h3>
                    <p className="text-sm text-gray-500">Gerencie as filas para organizar os atendimentos.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Fila
                </button>
            </div>

            {loading ? (
                <div className="text-center py-8 text-gray-500">Carregando filas...</div>
            ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {queues.map((queue) => (
                                <tr key={queue.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: queue.color }}></div>
                                            <span className="font-medium text-gray-900">{queue.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {queue.description || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <button 
                                            onClick={() => handleToggleActive(queue)}
                                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                queue.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}
                                        >
                                            {queue.is_active ? 'Ativo' : 'Inativo'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => handleOpenModal(queue)} className="text-blue-600 hover:text-blue-900 mr-4">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(queue.id)} className="text-red-600 hover:text-red-900">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {queues.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        Nenhuma fila cadastrada.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900">
                                {editingQueue ? 'Editar Fila' : 'Nova Fila'}
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
                                    placeholder="Ex: Suporte Técnico"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
                                    rows={3}
                                    placeholder="Descrição opcional..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Cor</label>
                                <div className="flex gap-2">
                                    {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'].map((c) => (
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

export default QueuesTab;
