import React, { useState, useEffect } from 'react';
import Card from './Card';
import { PlusIcon, PencilIcon, TrashIcon, XCircleIcon } from './icons';
import type { MarketplaceItem, MarketplaceItemCondition } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

const ItemFormModal: React.FC<{
    item: MarketplaceItem | null;
    onClose: () => void;
    onSave: () => void;
}> = ({ item, onClose, onSave }) => {
    const { profile: currentUser } = useAuth();
    const [uploading, setUploading] = useState(false);
    const [formData, setFormData] = useState({
        title: item?.title || '',
        description: item?.description || '',
        category: item?.category || 'Periféricos',
        condition: item?.condition || 'Bom',
        price: item?.price || 0,
        imageUrls: item?.imageUrls || [],
    });
    const [newFiles, setNewFiles] = useState<File[]>([]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = [...e.target.files];
            setNewFiles(prev => [...prev, ...files]);

            // Preview locally
            const previews = files.map(file => URL.createObjectURL(file));
            setFormData(prev => ({ ...prev, imageUrls: [...prev.imageUrls, ...previews] }));
        }
    };

    const handleRemoveImage = (index: number) => {
        setFormData(prev => ({
            ...prev,
            imageUrls: prev.imageUrls.filter((_, i) => i !== index)
        }));
        // Note: Removing from newFiles is tricky if we don't track original index,
        // but for a simple manager this is okay for now.
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'price' ? parseFloat(value) : value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser?.company_id) return;

        setUploading(true);
        try {
            let finalImageUrls = [...formData.imageUrls.filter(url => url.startsWith('http'))];

            // 1. Upload new files
            for (const file of newFiles) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `${currentUser.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('marketplace-media')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage
                    .from('marketplace-media')
                    .getPublicUrl(filePath);

                if (urlData) finalImageUrls.push(urlData.publicUrl);
            }

            const payload = {
                title: formData.title,
                description: formData.description,
                category: formData.category,
                condition: formData.condition,
                price: formData.price,
                image_urls: finalImageUrls, // DB column is snake_case
                company_id: currentUser.company_id,
                listed_by: item?.listedBy || currentUser.id,
                status: item?.status || 'Disponível'
            };

            if (item?.id) {
                const { error } = await supabase
                    .from('marketplace_items')
                    .update(payload)
                    .eq('id', item.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('marketplace_items')
                    .insert([payload]);
                if (error) throw error;
            }

            onSave();
            onClose();
        } catch (err) {
            console.error('Error saving marketplace item:', err);
            alert('Erro ao salvar item.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" disabled={uploading}>
                    <XCircleIcon className="w-6 h-6" />
                </button>
                <h3 className="text-xl font-bold text-brand-text mb-4">{item?.id ? 'Editar Item' : 'Adicionar Novo Item'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Título</label>
                        <input type="text" name="title" value={formData.title} onChange={handleChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text border p-2" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Descrição</label>
                        <textarea name="description" value={formData.description} onChange={handleChange} rows={4} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text border p-2" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text">Preço (R$)</label>
                            <input type="number" name="price" value={formData.price} onChange={handleChange} required step="0.01" className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text border p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text">Categoria</label>
                            <input type="text" name="category" value={formData.category} onChange={handleChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text border p-2" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Condição</label>
                        <select name="condition" value={formData.condition} onChange={handleChange} className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text border p-2">
                            <option>Novo</option>
                            <option>Quase Novo</option>
                            <option>Bom</option>
                            <option>Usado</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Imagens</label>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {formData.imageUrls.map((url, index) => (
                                <div key={index} className="relative">
                                    <img src={url} alt="Preview" className="w-24 h-24 object-cover rounded-md border" />
                                    <button type="button" onClick={() => handleRemoveImage(index)} className="absolute -top-2 -right-2 p-0.5 bg-red-500 text-white rounded-full">
                                        <XCircleIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <input type="file" multiple accept="image/*" onChange={handleFileChange} className="mt-2 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-brand-primary hover:file:bg-emerald-100" />
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={onClose} disabled={uploading} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Cancelar</button>
                        <button type="submit" disabled={uploading} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 transition-colors">
                            {uploading ? 'Salvando...' : 'Salvar Item'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
};

const MarketplaceManager: React.FC = () => {
    const { profile: currentUser } = useAuth();
    const [items, setItems] = useState<MarketplaceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<MarketplaceItem | null>(null);

    const fetchItems = async () => {
        if (!currentUser?.company_id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('marketplace_items')
                .select('*')
                .eq('company_id', currentUser.company_id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Map snake_case to camelCase if needed, but MarketplaceItem type uses imageUrls
            setItems((data || []).map(i => ({
                id: i.id,
                title: i.title,
                description: i.description,
                price: i.price,
                category: i.category,
                condition: i.condition as MarketplaceItemCondition,
                status: i.status,
                imageUrls: i.image_urls || [],
                listedBy: i.listed_by,
                listedAt: i.created_at,
                reservedBy: i.reserved_by,
                seller: i.seller || i.listed_by
            })));
        } catch (err) {
            console.error('Error fetching marketplace items:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, [currentUser?.company_id]);

    const handleEdit = (item: MarketplaceItem) => {
        setEditingItem(item);
        setFormOpen(true);
    };

    const handleDelete = async (itemId: string | number) => {
        if (window.confirm('Tem certeza que deseja remover este item?')) {
            try {
                const { error } = await supabase
                    .from('marketplace_items')
                    .delete()
                    .eq('id', itemId);
                if (error) throw error;
                fetchItems();
            } catch (err) {
                console.error('Error deleting item:', err);
                alert('Erro ao remover item.');
            }
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando marketplace...</div>;

    return (
        <>
            <Card title="Gerenciar Itens do Marketplace" headerAction={
                <button onClick={() => { setEditingItem(null); setFormOpen(true); }} className="flex items-center space-x-2 px-3 py-2 text-sm bg-brand-primary text-white rounded-md hover:bg-emerald-600 transition-colors">
                    <PlusIcon className="w-4 h-4" />
                    <span>Adicionar Item</span>
                </button>
            }>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">Item</th>
                                <th scope="col" className="px-6 py-3">Preço</th>
                                <th scope="col" className="px-6 py-3">Status</th>
                                <th scope="col" className="px-6 py-3">Vendedor</th>
                                <th scope="col" className="px-6 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(item => (
                                <tr key={item.id} className="bg-white border-b hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{item.title}</td>
                                    <td className="px-6 py-4">R$ {item.price.toFixed(2)}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${item.status === 'Disponível' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs">{item.listedBy || '---'}</td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button onClick={() => handleEdit(item)} className="p-2 text-brand-subtle-text hover:text-brand-primary"><PencilIcon className="w-5 h-5" /></button>
                                        <button onClick={() => handleDelete(item.id)} className="p-2 text-brand-subtle-text hover:text-red-500"><TrashIcon className="w-5 h-5" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {isFormOpen && <ItemFormModal item={editingItem} onClose={() => setFormOpen(false)} onSave={fetchItems} />}
        </>
    );
};

export default MarketplaceManager;