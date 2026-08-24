import React, { useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon } from './icons';
import type { TrainingModule } from '../types';

interface TrainingManagerProps {
    trainings: TrainingModule[];
    setTrainings: (data: TrainingModule[]) => void;
}

const TrainingManager: React.FC<TrainingManagerProps> = ({ trainings, setTrainings }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<TrainingModule | null>(null);
    const [formData, setFormData] = useState<Partial<TrainingModule>>({});

    const handleOpenModal = (item?: TrainingModule) => {
        if (item) {
            setEditingItem(item);
            setFormData(item);
        } else {
            setEditingItem(null);
            setFormData({ title: '', duration: '', category: '', thumbnail: '' });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingItem) {
            setTrainings(trainings.map(t => t.id === editingItem.id ? { ...t, ...formData } as TrainingModule : t));
        } else {
            setTrainings([...trainings, { id: Date.now(), ...formData } as TrainingModule]);
        }
        setIsModalOpen(false);
    };

    const handleDelete = (id: number) => {
        if (confirm('Tem certeza?')) setTrainings(trainings.filter(t => t.id !== id));
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Gerenciar Treinamentos</h3>
                <button onClick={() => handleOpenModal()} className="flex items-center px-4 py-2 bg-brand-primary text-white rounded-lg">
                    <PlusIcon className="w-5 h-5 mr-2" /> Novo Treinamento
                </button>
            </div>

            <div className="bg-white rounded-lg shadow border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Título</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {trainings.map(t => (
                            <tr key={t.id}>
                                <td className="px-6 py-4">{t.title}</td>
                                <td className="px-6 py-4">{t.category}</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleOpenModal(t)} className="text-blue-600"><PencilIcon className="w-5 h-5" /></button>
                                    <button onClick={() => handleDelete(t.id)} className="text-red-600"><TrashIcon className="w-5 h-5" /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <div className="flex justify-between mb-4">
                            <h3 className="text-lg font-bold">{editingItem ? 'Editar' : 'Novo'} Treinamento</h3>
                            <button onClick={() => setIsModalOpen(false)}><XMarkIcon className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <input className="w-full border p-2 rounded" placeholder="Título" value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
                            <input className="w-full border p-2 rounded" placeholder="Duração (ex: 30 min)" value={formData.duration || ''} onChange={e => setFormData({ ...formData, duration: e.target.value })} required />
                            <input className="w-full border p-2 rounded" placeholder="Categoria" value={formData.category || ''} onChange={e => setFormData({ ...formData, category: e.target.value })} />
                            <input className="w-full border p-2 rounded" placeholder="URL da Thumbnail" value={formData.thumbnail || ''} onChange={e => setFormData({ ...formData, thumbnail: e.target.value })} />
                            <button type="submit" className="w-full bg-brand-primary text-white py-2 rounded">Salvar</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrainingManager;
