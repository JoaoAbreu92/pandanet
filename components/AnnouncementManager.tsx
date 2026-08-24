import React, { useState, useEffect } from 'react';
import Card from './Card';
import { PlusIcon, PencilIcon, TrashIcon, XCircleIcon } from './icons';
import type { Announcement } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

interface AnnouncementManagerProps {
    // No longer needs props passed from parent, fetches own data
}

const AnnouncementFormModal: React.FC<{
    announcement: Partial<Announcement> | null;
    onClose: () => void;
    onSave: () => void;
    currentUser: any;
}> = ({ announcement, onClose, onSave, currentUser }) => {
    const [formData, setFormData] = useState({
        title: announcement?.title || '',
        summary: announcement?.summary || '',
        category: announcement?.category || 'Notícias da Empresa',
        imageUrl: announcement?.imageUrl || '',
        videoUrl: announcement?.videoUrl || '',
    });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (type === 'image') setImageFile(file);
            else setVideoFile(file);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const companyId = currentUser?.company_id;
        if (!companyId) {
            alert('Erro: Empresa não identificada.');
            return;
        }
        setIsProcessing(true);

        try {
            let uploadedImageUrl = formData.imageUrl;
            let uploadedVideoUrl = formData.videoUrl;

            // Upload Image
            if (imageFile) {
                const fileName = `img_${Date.now()}_${imageFile.name}`;
                const { error: imgError } = await supabase.storage.from('announcements-media').upload(fileName, imageFile);
                if (imgError) {
                    console.error('Image upload error:', imgError);
                    throw new Error('Erro ao enviar imagem.');
                }
                const { data: { publicUrl } } = supabase.storage.from('announcements-media').getPublicUrl(fileName);
                uploadedImageUrl = publicUrl;
            }

            // Upload Video
            if (videoFile) {
                const fileName = `vid_${Date.now()}_${videoFile.name}`;
                const { error: vidError } = await supabase.storage.from('announcements-media').upload(fileName, videoFile);
                if (vidError) {
                    console.error('Video upload error:', vidError);
                    throw new Error('Erro ao enviar vídeo.');
                }
                const { data: { publicUrl } } = supabase.storage.from('announcements-media').getPublicUrl(fileName);
                uploadedVideoUrl = publicUrl;
            }

            const payload = {
                title: formData.title,
                summary: formData.summary,
                category: formData.category,
                image_url: uploadedImageUrl,
                video_url: uploadedVideoUrl,
                company_id: companyId,
                date: announcement?.id ? announcement.date : new Date().toISOString(),
            };

            if (announcement?.id) {
                const { error } = await supabase.from('announcements').update(payload).eq('id', announcement.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('announcements').insert([payload]);
                if (error) throw error;
            }

            onSave();
            onClose();

        } catch (error: any) {
            console.error('Error saving announcement:', error);
            alert(`Erro ao salvar anúncio: ${error.message || 'Erro desconhecido'}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><XCircleIcon className="w-6 h-6" /></button>
                <h3 className="text-xl font-bold text-brand-text mb-4">{announcement?.id ? 'Editar Anúncio' : 'Criar Novo Anúncio'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-2">
                    {/* Form Fields */}
                    <div><label className="block text-sm font-medium text-brand-subtle-text">Título</label><input type="text" name="title" value={formData.title} onChange={handleChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" /></div>
                    <div><label className="block text-sm font-medium text-brand-subtle-text">Resumo</label><textarea name="summary" value={formData.summary} onChange={handleChange} rows={4} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" /></div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Categoria</label>
                        <select name="category" value={formData.category} onChange={handleChange} className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text">
                            <option>Notícias da Empresa</option>
                            <option>Atualização de Produto</option>
                            <option>RH & Cultura</option>
                            <option>Evento</option>
                        </select>
                    </div>
                    {/* Media Inputs */}
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Upload Imagem</label>
                        <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'image')} className="mt-2 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-brand-primary hover:file:bg-emerald-100" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Upload Vídeo (ou URL externa abaixo)</label>
                        <input type="file" accept="video/*" onChange={(e) => handleFileChange(e, 'video')} className="mt-2 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-brand-primary hover:file:bg-emerald-100" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">URL do Vídeo (YouTube/Externo)</label>
                        <input type="url" name="videoUrl" value={formData.videoUrl} onChange={handleChange} placeholder="https://..." className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" />
                    </div>

                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Cancelar</button>
                        <button type="submit" disabled={isProcessing} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 disabled:bg-emerald-300">
                            {isProcessing ? 'Salvando...' : 'Salvar Anúncio'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AnnouncementManager: React.FC<AnnouncementManagerProps> = () => {
    const { profile: currentUser } = useAuth();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);

    const fetchAnnouncements = async () => {
        if (!currentUser?.company_id) return;
        const { data, error } = await supabase
            .from('announcements')
            .select('*')
            .eq('company_id', currentUser.company_id)
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching announcements:', error);
            return;
        }

        if (data) {
            const formatted: Announcement[] = data.map(a => ({
                id: a.id,
                title: a.title,
                summary: a.summary,
                category: a.category,
                date: a.date, // Keep ISO for internal use
                imageUrl: a.image_url,
                videoUrl: a.video_url,
                reactions: a.reactions || []
            }));
            setAnnouncements(formatted);
        }
    };

    useEffect(() => {
        fetchAnnouncements();
    }, [currentUser]);

    const handleDelete = async (id: string, title: string) => {
        if (window.confirm(`Tem certeza que deseja apagar "${title}"?`)) {
            await supabase.from('announcements').delete().eq('id', id);
            fetchAnnouncements();
        }
    };

    return (
        <>
            <Card title="Gerenciar Anúncios" headerAction={
                <button onClick={() => { setEditingAnnouncement(null); setModalOpen(true); }} className="flex items-center space-x-2 px-3 py-2 text-sm bg-brand-primary text-white rounded-md hover:bg-emerald-600">
                    <PlusIcon className="w-4 h-4" />
                    <span>Criar Novo</span>
                </button>
            }>
                <div className="space-y-3">
                    {announcements.length === 0 ? <p className="text-brand-subtle-text">Nenhum anúncio encontrado.</p> :
                        announcements.map(ann => (
                            <div key={ann.id} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50">
                                <div>
                                    <p className="font-semibold text-brand-text">{ann.title}</p>
                                    <p className="text-sm text-brand-subtle-text">{ann.category} - {new Date(ann.date).toLocaleDateString('pt-BR')}</p>
                                </div>
                                <div className="flex space-x-2">
                                    <button onClick={() => { setEditingAnnouncement(ann); setModalOpen(true); }} className="p-2 text-brand-subtle-text hover:text-brand-primary">
                                        <PencilIcon className="w-5 h-5" />
                                    </button>
                                    <button onClick={() => handleDelete(ann.id, ann.title)} className="p-2 text-brand-subtle-text hover:text-red-500">
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                </div>
            </Card>
            {isModalOpen && <AnnouncementFormModal announcement={editingAnnouncement} onClose={() => setModalOpen(false)} onSave={fetchAnnouncements} currentUser={currentUser} />}
        </>
    );
};

export default AnnouncementManager;