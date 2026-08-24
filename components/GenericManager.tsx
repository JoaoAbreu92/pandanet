import React, { useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon } from './icons';

// Generic Component for managing listed items
interface GenericManagerProps<T> {
    title: string;
    items: T[];
    setItems: (items: T[]) => void;
    renderItem: (item: T) => React.ReactNode;
    fields: { key: keyof T; label: string; type?: 'text' | 'select'; options?: string[] }[];
    newItemTemplate: Partial<T>;
}

export function GenericManager<T extends { id: number }>({ title, items, setItems, renderItem, fields, newItemTemplate }: GenericManagerProps<T>) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<T | null>(null);
    const [formData, setFormData] = useState<Partial<T>>({});

    const handleOpenModal = (item?: T) => {
        if (item) {
            setEditingItem(item);
            setFormData(item);
        } else {
            setEditingItem(null);
            setFormData({ ...newItemTemplate });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingItem) {
            setItems(items.map(i => i.id === editingItem.id ? { ...i, ...formData } as T : i));
        } else {
            setItems([...items, { id: Date.now(), ...formData } as T]);
        }
        setIsModalOpen(false);
    };

    const handleDelete = (id: number) => {
        if (confirm('Tem certeza?')) setItems(items.filter(i => i.id !== id));
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">{title}</h3>
                <button onClick={() => handleOpenModal()} className="flex items-center px-4 py-2 bg-brand-primary text-white rounded-lg">
                    <PlusIcon className="w-5 h-5 mr-2" /> Novo Item
                </button>
            </div>

            <div className="bg-white rounded-lg shadow border border-gray-200 divide-y">
                {items.map(item => (
                    <div key={item.id} className="p-4 flex justify-between items-center">
                        <div className="flex-1">{renderItem(item)}</div>
                        <div className="flex space-x-2 ml-4">
                            <button onClick={() => handleOpenModal(item)} className="text-blue-600"><PencilIcon className="w-5 h-5" /></button>
                            <button onClick={() => handleDelete(item.id)} className="text-red-600"><TrashIcon className="w-5 h-5" /></button>
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between mb-4">
                            <h3 className="text-lg font-bold">{editingItem ? 'Editar' : 'Novo'} Item</h3>
                            <button onClick={() => setIsModalOpen(false)}><XMarkIcon className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {fields.map(field => (
                                <div key={String(field.key)}>
                                    <label className="block text-sm font-medium text-gray-700">{field.label}</label>
                                    {field.type === 'select' ? (
                                        <select
                                            className="w-full border p-2 rounded mt-1"
                                            value={String(formData[field.key] || '')}
                                            onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                                        >
                                            <option value="">Selecione...</option>
                                            {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    ) : (
                                        <input
                                            className="w-full border p-2 rounded mt-1"
                                            value={String(formData[field.key] || '')}
                                            onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                                        />
                                    )}
                                </div>
                            ))}
                            <button type="submit" className="w-full bg-brand-primary text-white py-2 rounded">Salvar</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
