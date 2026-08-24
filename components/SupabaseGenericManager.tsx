import React, { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, PhotoIcon } from './icons';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import type { Employee } from '../types';

interface SupabaseGenericManagerProps<T> {
    title: string;
    tableName: string;
    storageBucket?: string;
    fields: {
        key: string;
        label: string;
        type?: 'text' | 'select' | 'textarea' | 'file' | 'user_list';
        options?: string[];
        dbColumn?: string; // If mapping is different
    }[];
    renderItem: (item: T) => React.ReactNode;
    newItemTemplate: Partial<T>;
    users?: Employee[]; // Added users for user_list selection
}

export function SupabaseGenericManager<T extends { id: string }>({
    title,
    tableName,
    storageBucket = 'announcements-media',
    fields,
    renderItem,
    newItemTemplate,
    users = []
}: SupabaseGenericManagerProps<T>) {
    const { currentUser } = useAuth();
    const [items, setItems] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<T | null>(null);
    const [formData, setFormData] = useState<any>({});
    const [files, setFiles] = useState<Record<string, File>>({});
    const [isProcessing, setIsProcessing] = useState(false);

    const fetchItems = async () => {
        if (!currentUser?.company_id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .eq('company_id', currentUser.company_id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) {
                // Map DB columns back to frontend keys if needed
                const formatted = data.map((d: any) => {
                    const obj: any = { id: d.id };
                    fields.forEach(f => {
                        const dbCol = f.dbColumn || f.key;
                        obj[f.key] = d[dbCol];
                    });
                    return obj as T;
                });
                setItems(formatted);
            }
        } catch (err) {
            console.error(`Error fetching ${tableName}:`, err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, [currentUser?.company_id, tableName]);

    const handleOpenModal = (item?: T) => {
        if (item) {
            setEditingItem(item);
            setFormData({ ...item });
        } else {
            setEditingItem(null);
            setFormData({ ...newItemTemplate });
        }
        setFiles({});
        setIsModalOpen(true);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setFiles(prev => ({ ...prev, [key]: file }));
            // Preview
            if (file.type.startsWith('image/')) {
                setFormData((prev: any) => ({ ...prev, [key]: URL.createObjectURL(file) }));
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser?.company_id) return;
        setIsProcessing(true);

        try {
            const payload: any = { company_id: currentUser.company_id };

            // Handle updates/inserts
            for (const field of fields) {
                const key = field.key;
                const dbCol = field.dbColumn || key;

                if (field.type === 'file' && files[key]) {
                    const file = files[key];
                    const fileName = `${tableName}_${Date.now()}_${file.name}`;
                    const { error: uploadError } = await supabase.storage
                        .from(storageBucket)
                        .upload(fileName, file);

                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabase.storage
                        .from(storageBucket)
                        .getPublicUrl(fileName);

                    payload[dbCol] = publicUrl;
                } else {
                    const isArrayField = Array.isArray(newItemTemplate[key as keyof T]);
                    if (isArrayField) {
                        if (typeof formData[key] === 'string') {
                            payload[dbCol] = formData[key].split('\n').map((s: string) => s.trim()).filter(Boolean);
                        } else {
                            payload[dbCol] = formData[key] || [];
                        }
                    } else {
                        payload[dbCol] = formData[key];
                    }
                }
            }

            if (editingItem) {
                const { error } = await supabase
                    .from(tableName)
                    .update(payload)
                    .eq('id', editingItem.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from(tableName)
                    .insert([payload]);
                if (error) throw error;
            }

            fetchItems();
            setIsModalOpen(false);
        } catch (err: any) {
            console.error(`Error saving ${tableName}:`, err);
            alert('Erro ao salvar item: ' + (err?.message || err?.details || JSON.stringify(err)));
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir este item?')) {
            try {
                const { error } = await supabase
                    .from(tableName)
                    .delete()
                    .eq('id', id);
                if (error) throw error;
                fetchItems();
            } catch (err: any) {
                console.error(`Error deleting ${tableName}:`, err);
                alert('Erro ao excluir item: ' + (err?.message || err?.details || JSON.stringify(err)));
            }
        }
    };

    if (loading) return <div className="p-4 text-center text-gray-500">Carregando...</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">{title}</h3>
                <button onClick={() => handleOpenModal()} className="flex items-center px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-emerald-600 transition-colors">
                    <PlusIcon className="w-5 h-5 mr-2" /> Novo Item
                </button>
            </div>

            <div className="bg-white rounded-lg shadow border border-gray-200 divide-y overflow-hidden">
                {items.length === 0 ? (
                    <p className="p-8 text-center text-gray-500">Nenhum item encontrado.</p>
                ) : (
                    items.map(item => (
                        <div key={item.id} className="p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                            <div className="flex-1 overflow-hidden">{renderItem(item)}</div>
                            <div className="flex space-x-3 ml-4">
                                <button onClick={() => handleOpenModal(item)} className="text-blue-600 hover:text-blue-800 transition-colors"><PencilIcon className="w-5 h-5" /></button>
                                <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800 transition-colors"><TrashIcon className="w-5 h-5" /></button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">{editingItem ? 'Editar Item' : 'Novo Item'}</h3>
                            <button onClick={() => setIsModalOpen(false)} disabled={isProcessing}><XMarkIcon className="w-6 h-6 text-gray-400 hover:text-gray-600" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {fields.map(field => (
                                <div key={field.key}>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                                    {field.type === 'select' ? (
                                        <select
                                            className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all"
                                            value={formData[field.key] || ''}
                                            onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                                            required
                                        >
                                            <option value="">Selecione...</option>
                                            {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    ) : field.type === 'textarea' ? (
                                        <textarea
                                            className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all"
                                            rows={4}
                                            value={Array.isArray(formData[field.key]) ? formData[field.key].join('\n') : (formData[field.key] || '')}
                                            onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                                            required
                                        />
                                    ) : field.type === 'file' ? (
                                        <div className="mt-1">
                                            <div className="flex items-center space-x-4">
                                                {formData[field.key] && formData[field.key].startsWith('http') && (
                                                    <div className="w-16 h-16 rounded border overflow-hidden flex-shrink-0">
                                                        <img src={formData[field.key]} alt="Preview" className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                <input
                                                    type="file"
                                                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-brand-primary hover:file:bg-emerald-100 cursor-pointer"
                                                    onChange={(e) => handleFileChange(e, field.key)}
                                                />
                                            </div>
                                            {files[field.key] && <p className="text-xs text-emerald-600 mt-2 font-medium">Arquivo selecionado: {files[field.key].name}</p>}
                                        </div>
                                    ) : field.type === 'user_list' ? (
                                        <div className="mt-1 border rounded-lg p-3 max-h-40 overflow-y-auto bg-gray-50 space-y-2">
                                            {users.map(u => (
                                                <label key={u.id} className="flex items-center space-x-3 p-2 hover:bg-white rounded transition-colors cursor-pointer border border-transparent hover:border-gray-200">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded text-brand-primary focus:ring-brand-primary"
                                                        checked={(formData[field.key] || []).includes(u.id)}
                                                        onChange={(e) => {
                                                            const current = formData[field.key] || [];
                                                            const updated = e.target.checked
                                                                ? [...current, u.id]
                                                                : current.filter((id: string) => id !== u.id);
                                                            setFormData({ ...formData, [field.key]: updated });
                                                        }}
                                                    />
                                                    <div className="flex items-center space-x-2">
                                                        <img src={u.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                                                        <span className="text-sm font-medium text-gray-700">{u.name}</span>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    ) : (
                                        <input
                                            className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all"
                                            value={formData[field.key] || ''}
                                            onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                                            required
                                        />
                                    )}
                                </div>
                            ))}
                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={isProcessing}
                                    className="w-full bg-brand-primary text-white py-3 rounded-lg font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50 shadow-md"
                                >
                                    {isProcessing ? 'Salvando...' : 'Salvar Alterações'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
