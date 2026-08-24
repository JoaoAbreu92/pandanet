import React, { useState } from 'react';
import Card from './Card';
import { PlusIcon, PencilIcon, TrashIcon, XCircleIcon } from './icons';
// FIX: Correcting the import path for types.
import type { MarketplaceItem, MarketplaceItemCondition, AppData } from '../types';

interface MarketplaceManagerProps {
    items: MarketplaceItem[];
    setItems: (items: MarketplaceItem[]) => void;
}


const ItemFormModal: React.FC<{
    item: Partial<MarketplaceItem> | null;
    onClose: () => void;
    onSave: (item: Omit<MarketplaceItem, 'id' | 'listedBy' | 'listedAt' | 'status'> | MarketplaceItem) => void;
}> = ({ item, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        title: item?.title || '',
        description: item?.description || '',
        category: item?.category || 'Periféricos',
        condition: item?.condition || 'Bom',
        price: item?.price || 0,
        imageUrls: item?.imageUrls || [],
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            // FIX: Changed Array.from to spread syntax to correctly type files from a FileList.
            const files = [...e.target.files];
            const newImageUrls = files.map(file => URL.createObjectURL(file));
            setFormData(prev => ({ ...prev, imageUrls: [...prev.imageUrls, ...newImageUrls] }));
        }
    };

    const handleRemoveImage = (index: number) => {
        setFormData(prev => ({ ...prev, imageUrls: prev.imageUrls.filter((_, i) => i !== index) }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'price' ? parseFloat(value) : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.imageUrls.length === 0) {
            alert("Por favor, adicione pelo menos uma imagem.");
            return;
        }
        onSave(item?.id ? { ...item, ...formData } as MarketplaceItem : formData as Omit<MarketplaceItem, 'id' | 'listedBy' | 'listedAt' | 'status'>);
    };
    
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <XCircleIcon className="w-6 h-6" />
                </button>
                <h3 className="text-xl font-bold text-brand-text mb-4">{item?.id ? 'Editar Item' : 'Adicionar Novo Item'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    {/* Form fields */}
                     <div><label className="block text-sm font-medium text-brand-subtle-text">Título</label><input type="text" name="title" value={formData.title} onChange={handleChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"/></div>
                    <div><label className="block text-sm font-medium text-brand-subtle-text">Descrição</label><textarea name="description" value={formData.description} onChange={handleChange} rows={4} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"/></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-brand-subtle-text">Preço (R$)</label><input type="number" name="price" value={formData.price} onChange={handleChange} required step="0.01" className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"/></div>
                        <div><label className="block text-sm font-medium text-brand-subtle-text">Categoria</label><input type="text" name="category" value={formData.category} onChange={handleChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"/></div>
                    </div>
                     <div><label className="block text-sm font-medium text-brand-subtle-text">Condição</label><select name="condition" value={formData.condition} onChange={handleChange} className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"><option>Novo</option><option>Quase Novo</option><option>Bom</option><option>Usado</option></select></div>
                     <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Imagens</label>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {formData.imageUrls.map((url, index) => (
                                <div key={index} className="relative">
                                    <img src={url} alt="Preview" className="w-24 h-24 object-cover rounded-md"/>
                                    <button type="button" onClick={() => handleRemoveImage(index)} className="absolute -top-2 -right-2 p-0.5 bg-red-500 text-white rounded-full">
                                        <XCircleIcon className="w-5 h-5"/>
                                    </button>
                                </div>
                            ))}
                        </div>
                        <input type="file" multiple accept="image/*" onChange={handleFileChange} className="mt-2 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-brand-primary hover:file:bg-emerald-100"/>
                    </div>
                    
                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Cancelar</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600">Salvar Item</button>
                    </div>
                </form>
            </div>
        </div>
    )
};


const MarketplaceManager: React.FC<MarketplaceManagerProps> = ({ items, setItems }) => {
    const [isFormOpen, setFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<MarketplaceItem | null>(null);

    const handleSaveItem = (itemData: Omit<MarketplaceItem, 'id' | 'listedBy' | 'listedAt' | 'status'> | MarketplaceItem) => {
        if ('id' in itemData) {
            // Editing existing item
            setItems(items.map(i => i.id === itemData.id ? itemData : i));
        } else {
            // Adding new item
            const newItem: MarketplaceItem = {
                ...(itemData as Omit<MarketplaceItem, 'id' | 'listedBy' | 'listedAt' | 'status' | 'price' | 'condition'>),
                id: Date.now(),
                listedBy: 'Admin',
                listedAt: new Date().toISOString().split('T')[0],
                status: 'Disponível',
                price: itemData.price,
                condition: itemData.condition as MarketplaceItemCondition,
                imageUrls: itemData.imageUrls,
            };
            setItems([newItem, ...items]);
        }
        setFormOpen(false);
        setEditingItem(null);
    };

    const handleEdit = (item: MarketplaceItem) => {
        setEditingItem(item);
        setFormOpen(true);
    };

    const handleDelete = (itemId: number) => {
        if (window.confirm('Tem certeza que deseja remover este item?')) {
            setItems(items.filter(i => i.id !== itemId));
        }
    };
    
    return (
        <>
            <Card title="Gerenciar Itens do Marketplace" headerAction={
                <button onClick={() => { setEditingItem(null); setFormOpen(true); }} className="flex items-center space-x-2 px-3 py-2 text-sm bg-brand-primary text-white rounded-md hover:bg-emerald-600">
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
                                <th scope="col" className="px-6 py-3">Reservado por</th>
                                <th scope="col" className="px-6 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(item => (
                                <tr key={item.id} className="bg-white border-b hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{item.title}</td>
                                    <td className="px-6 py-4">R$ {item.price.toFixed(2)}</td>
                                    <td className="px-6 py-4">{item.status}</td>
                                    <td className="px-6 py-4">{item.reservedBy || '---'}</td>
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

            {isFormOpen && <ItemFormModal item={editingItem} onClose={() => setFormOpen(false)} onSave={handleSaveItem} />}
        </>
    );
};

export default MarketplaceManager;