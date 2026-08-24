import React, { useState } from 'react';
import Card from './Card';
// FIX: Correcting the import path for types.
import type { Banner } from '../types';
import { PencilIcon, PlusIcon, XCircleIcon, TrashIcon } from './icons';

interface BannerManagerProps {
    banners: Banner[];
    setBanners: (banners: Banner[]) => void;
}

const BannerFormModal: React.FC<{
    banner: Partial<Banner> | null;
    onClose: () => void;
    onSave: (banner: Omit<Banner, 'id'> | Banner) => void;
}> = ({ banner, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        title: banner?.title || '',
        subtitle: banner?.subtitle || '',
        link: banner?.link || '#',
        imageUrl: banner?.imageUrl || '',
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setFormData(prev => ({ ...prev, imageUrl: URL.createObjectURL(file) }));
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.imageUrl) {
            alert("Por favor, selecione uma imagem para o banner.");
            return;
        }
        onSave(banner?.id ? { ...banner, ...formData } as Banner : formData);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><XCircleIcon className="w-6 h-6" /></button>
                <h3 className="text-xl font-bold text-brand-text mb-4">{banner?.id ? 'Editar Banner' : 'Adicionar Novo Banner'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Título</label>
                        <input type="text" name="title" value={formData.title} onChange={handleChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Subtítulo</label>
                        <input type="text" name="subtitle" value={formData.subtitle} onChange={handleChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Imagem do Banner</label>
                        {formData.imageUrl && <img src={formData.imageUrl} alt="Preview" className="mt-2 w-full h-32 object-cover rounded-md"/>}
                        <input type="file" accept="image/*" onChange={handleFileChange} className="mt-2 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-brand-primary hover:file:bg-emerald-100"/>
                    </div>
                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Cancelar</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600">Salvar Banner</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const BannerManager: React.FC<BannerManagerProps> = ({ banners, setBanners }) => {
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingBanner, setEditingBanner] = useState<Banner | null>(null);

    const handleSave = (bannerData: Omit<Banner, 'id'> | Banner) => {
        if ('id' in bannerData) {
            setBanners(banners.map(b => b.id === bannerData.id ? bannerData : b));
        } else {
            const newBanner: Banner = { ...bannerData, id: Date.now() };
            setBanners([newBanner, ...banners]);
        }
        setModalOpen(false);
        setEditingBanner(null);
    };

    const handleEdit = (banner: Banner) => {
        setEditingBanner(banner);
        setModalOpen(true);
    };

    const handleDelete = (bannerId: number) => {
        if (window.confirm("Tem certeza que deseja apagar este banner?")) {
            setBanners(banners.filter(b => b.id !== bannerId));
        }
    };

    return (
        <>
            <Card title="Gerenciar Banners" headerAction={
                <button onClick={() => { setEditingBanner(null); setModalOpen(true); }} className="flex items-center space-x-2 px-3 py-2 text-sm bg-brand-primary text-white rounded-md hover:bg-emerald-600">
                    <PlusIcon className="w-4 h-4" />
                    <span>Criar Novo</span>
                </button>
            }>
                <div className="space-y-4">
                    {banners.map(banner => (
                        <div key={banner.id} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50">
                            <div className="flex items-center space-x-4">
                                <img src={banner.imageUrl} alt={banner.title} className="w-20 h-10 object-cover rounded-md" />
                                <div>
                                    <p className="font-semibold text-brand-text">{banner.title}</p>
                                    <p className="text-sm text-brand-subtle-text">{banner.subtitle}</p>
                                </div>
                            </div>
                            <div className="flex space-x-1">
                                <button onClick={() => handleEdit(banner)} className="p-2 text-brand-subtle-text hover:text-brand-primary">
                                    <PencilIcon className="w-5 h-5" />
                                </button>
                                <button onClick={() => handleDelete(banner.id)} className="p-2 text-brand-subtle-text hover:text-red-500">
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
            {isModalOpen && <BannerFormModal banner={editingBanner} onClose={() => setModalOpen(false)} onSave={handleSave} />}
        </>
    );
};

export default BannerManager;