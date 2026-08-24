import React, { useState, useEffect } from 'react';
import Card from './Card';
import type { Banner } from '../types';
import { PencilIcon, PlusIcon, XCircleIcon, TrashIcon } from './icons';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

const BannerFormModal: React.FC<{
    banner: Partial<Banner> | null;
    onClose: () => void;
    onSave: (bannerData: Partial<Banner>) => void;
    isProcessing?: boolean;
}> = ({ banner, onClose, onSave, isProcessing }) => {
    const [formData, setFormData] = useState({
        title: banner?.title || '',
        subtitle: banner?.subtitle || '',
        link: banner?.link || '#',
        imageUrl: banner?.imageUrl || '',
    });
    const [imageFile, setImageFile] = useState<File | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setFormData(prev => ({ ...prev, imageUrl: URL.createObjectURL(file) }));
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.imageUrl && !imageFile) {
            alert("Por favor, selecione uma imagem para o banner.");
            return;
        }

        let finalImageUrl = formData.imageUrl;

        if (imageFile) {
            const fileName = `banner_${Date.now()}_${imageFile.name}`;
            const { data, error: uploadError } = await supabase.storage
                .from('announcements-media')
                .upload(fileName, imageFile);

            if (uploadError) {
                alert("Erro ao enviar imagem.");
                return;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('announcements-media')
                .getPublicUrl(fileName);

            finalImageUrl = publicUrl;
        }

        onSave({ ...formData, imageUrl: finalImageUrl });
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" disabled={isProcessing}><XCircleIcon className="w-6 h-6" /></button>
                <h3 className="text-xl font-bold text-brand-text mb-4">{banner?.id ? 'Editar Banner' : 'Adicionar Novo Banner'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Título</label>
                        <input type="text" name="title" value={formData.title} onChange={handleChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text border p-2" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Subtítulo</label>
                        <input type="text" name="subtitle" value={formData.subtitle} onChange={handleChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text border p-2" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Link de Destino</label>
                        <input type="text" name="link" value={formData.link} onChange={handleChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text border p-2" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Imagem do Banner</label>
                        {formData.imageUrl && <img src={formData.imageUrl} alt="Preview" className="mt-2 w-full h-32 object-cover rounded-md border" />}
                        <input type="file" accept="image/*" onChange={handleFileChange} className="mt-2 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-brand-primary hover:file:bg-emerald-100" />
                    </div>
                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} disabled={isProcessing} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Cancelar</button>
                        <button type="submit" disabled={isProcessing} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 disabled:opacity-50">
                            {isProcessing ? 'Salvando...' : 'Salvar Banner'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const BannerManager: React.FC = () => {
    const { currentUser } = useAuth();
    const [banners, setBanners] = useState<Banner[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const fetchBanners = async () => {
        if (!currentUser?.company_id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('banners')
                .select('*')
                .eq('company_id', currentUser.company_id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) {
                setBanners(data.map((b: any) => ({
                    id: b.id,
                    title: b.title || '',
                    subtitle: b.subtitle || '',
                    link: b.link || '#',
                    imageUrl: b.image_url
                })));
            }
        } catch (err) {
            console.error('Error fetching banners:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBanners();
    }, [currentUser?.company_id]);

    const handleSave = async (bannerData: Partial<Banner>) => {
        if (!currentUser?.company_id) return;
        setIsProcessing(true);
        try {
            const payload = {
                company_id: currentUser.company_id,
                title: bannerData.title,
                subtitle: bannerData.subtitle,
                link: bannerData.link,
                image_url: bannerData.imageUrl
            };

            if (editingBanner) {
                const { error } = await supabase
                    .from('banners')
                    .update(payload)
                    .eq('id', editingBanner.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('banners')
                    .insert([payload]);
                if (error) throw error;
            }

            fetchBanners();
            setModalOpen(false);
            setEditingBanner(null);
        } catch (err) {
            console.error('Error saving banner:', err);
            alert('Erro ao salvar banner.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleEdit = (banner: Banner) => {
        setEditingBanner(banner);
        setModalOpen(true);
    };

    const handleDelete = async (bannerId: string) => {
        if (window.confirm("Tem certeza que deseja apagar este banner?")) {
            try {
                const { error } = await supabase
                    .from('banners')
                    .delete()
                    .eq('id', bannerId);
                if (error) throw error;
                fetchBanners();
            } catch (err) {
                console.error('Error deleting banner:', err);
                alert('Erro ao excluir banner.');
            }
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando gerenciador de banners...</div>;

    return (
        <>
            <Card title="Gerenciar Banners" headerAction={
                <button onClick={() => { setEditingBanner(null); setModalOpen(true); }} className="flex items-center space-x-2 px-3 py-2 text-sm bg-brand-primary text-white rounded-md hover:bg-emerald-600">
                    <PlusIcon className="w-4 h-4" />
                    <span>Criar Novo</span>
                </button>
            }>
                <div className="space-y-4">
                    {banners.length === 0 ? (
                        <p className="text-center text-gray-500 py-4">Nenhum banner encontrado.</p>
                    ) : (
                        banners.map(banner => (
                            <div key={banner.id} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all">
                                <div className="flex items-center space-x-4">
                                    <img src={banner.imageUrl} alt={banner.title} className="w-20 h-10 object-cover rounded-md border" />
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
                        ))
                    )}
                </div>
            </Card>
            {isModalOpen && (
                <BannerFormModal
                    banner={editingBanner}
                    onClose={() => setModalOpen(false)}
                    onSave={handleSave}
                    isProcessing={isProcessing}
                />
            )}
        </>
    );
};

export default BannerManager;