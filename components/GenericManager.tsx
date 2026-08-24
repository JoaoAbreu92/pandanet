import React, { useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon } from './icons';

// Generic Component for managing listed items
import { useLanguage } from './LanguageContext';

// Generic Component for managing listed items
interface GenericManagerProps<T> {
    title: string;
    items: T[];
    setItems: (items: T[]) => void;
    renderItem: (item: T) => React.ReactNode;
    fields: { key: keyof T; label: string; type?: 'text' | 'select' | 'textarea' | 'file'; options?: string[] }[];
    newItemTemplate: Partial<T>;
}

export function GenericManager<T extends { id: number }>({ title, items, setItems, renderItem, fields, newItemTemplate }: GenericManagerProps<T>) {
    const { t } = useLanguage();
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
        if (confirm(t('generic.delete_confirm'))) setItems(items.filter(i => i.id !== id));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, key: keyof T) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const fakePath = `C:\\fakepath\\${file.name}`; // Simulate file upload

            let updates: any = { [key]: fakePath };

            // Auto-detect type if 'type' field exists (Specifically for Policies)
            // This assumes 'type' is a field in T and we want to auto-fill it.
            // We'll check if formData has a 'type' property (initialized in newItemTemplate)
            if ('type' in (newItemTemplate || {})) {
                let detectedType = 'Outro';
                if (file.name.endsWith('.pdf')) detectedType = 'PDF';
                else if (file.name.endsWith('.doc') || file.name.endsWith('.docx')) detectedType = 'DOC';
                else if (file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) detectedType = 'XLS';
                else if (file.name.endsWith('.jpg') || file.name.endsWith('.png')) detectedType = 'IMG';

                updates = { ...updates, type: detectedType };
            }

            setFormData(prev => ({ ...prev, ...updates }));
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">{title}</h3>
                <button onClick={() => handleOpenModal()} className="flex items-center px-4 py-2 bg-brand-primary text-white rounded-lg">
                    <PlusIcon className="w-5 h-5 mr-2" /> {t('generic.new_item')}
                </button>
            </div>

            <div className="bg-white rounded-lg shadow border border-gray-200 divide-y">
                {items.map(item => (
                    <div key={item.id} className="p-4 flex justify-between items-center">
                        <div className="flex-1 overflow-hidden">{renderItem(item)}</div>
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
                            <h3 className="text-lg font-bold">{editingItem ? t('generic.edit_item') : t('generic.new_item')}</h3>
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
                                    ) : field.type === 'textarea' ? (
                                        <textarea
                                            className="w-full border p-2 rounded mt-1"
                                            rows={5}
                                            value={String(formData[field.key] || '')}
                                            onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                                        />
                                    ) : field.type === 'file' ? (
                                        <div className="mt-1">
                                            <input
                                                type="file"
                                                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-primary file:text-white hover:file:bg-brand-secondary"
                                                onChange={(e) => handleFileChange(e, field.key)}
                                            />
                                            {formData[field.key] && <p className="text-xs text-gray-500 mt-1">Atual: {String(formData[field.key])}</p>}
                                        </div>
                                    ) : (
                                        <input
                                            className="w-full border p-2 rounded mt-1"
                                            value={String(formData[field.key] || '')}
                                            onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                                        />
                                    )}
                                </div>
                            ))}
                            <button type="submit" className="w-full bg-brand-primary text-white py-2 rounded">{t('generic.save')}</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
