import React, { useState } from 'react';
import Card from './Card';
import { PlusIcon, PencilIcon, TrashIcon, XCircleIcon } from './icons';
// FIX: Correcting the import path for types.
import type { Announcement } from '../types';

interface AnnouncementManagerProps {
    announcements: Announcement[];
    setAnnouncements: (announcements: Announcement[]) => void;
}

const AnnouncementFormModal: React.FC<{
    announcement: Partial<Announcement> | null;
    onClose: () => void;
    onSave: (announcement: Omit<Announcement, 'date'> | Announcement) => void;
}> = ({ announcement, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        title: announcement?.title || '',
        summary: announcement?.summary || '',
        category: announcement?.category || 'Notícias da Empresa',
        imageUrl: announcement?.imageUrl || '',
        videoUrl: announcement?.videoUrl || '',
        videoFile: announcement?.videoFile || '',
    });
    const [isProcessingVideo, setIsProcessingVideo] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const fileUrl = URL.createObjectURL(file);

            if (type === 'image') {
                setFormData(prev => ({ ...prev, imageUrl: fileUrl }));
            } else if (type === 'video') {
                // Validate video duration (max 2 minutes)
                setIsProcessingVideo(true);
                const video = document.createElement('video');
                video.preload = 'metadata';
                
                video.onloadedmetadata = function() {
                    window.URL.revokeObjectURL(video.src);
                    const duration = video.duration;
                    if (duration > 120) {
                        alert("O vídeo excede o limite de 2 minutos.");
                        setFormData(prev => ({ ...prev, videoFile: '' }));
                    } else {
                        setFormData(prev => ({ ...prev, videoFile: fileUrl }));
                    }
                    setIsProcessingVideo(false);
                }

                video.onerror = function() {
                    alert("Erro ao carregar vídeo. Tente outro arquivo.");
                    setIsProcessingVideo(false);
                }

                video.src = URL.createObjectURL(file);
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(announcement?.title ? { ...announcement, ...formData } as Announcement : formData as any);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><XCircleIcon className="w-6 h-6" /></button>
                <h3 className="text-xl font-bold text-brand-text mb-4">{announcement?.title ? 'Editar Anúncio' : 'Criar Novo Anúncio'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-2">
                    <div><label className="block text-sm font-medium text-brand-subtle-text">Título</label><input type="text" name="title" value={formData.title} onChange={handleChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"/></div>
                    <div><label className="block text-sm font-medium text-brand-subtle-text">Resumo</label><textarea name="summary" value={formData.summary} onChange={handleChange} rows={4} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"/></div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Categoria</label>
                        <select name="category" value={formData.category} onChange={handleChange} className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text">
                            <option>Notícias da Empresa</option>
                            <option>Atualização de Produto</option>
                            <option>RH & Cultura</option>
                            <option>Evento</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">URL do Vídeo (YouTube)</label>
                        <input type="url" name="videoUrl" value={formData.videoUrl} onChange={handleChange} placeholder="https://www.youtube.com/watch?v=..." className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Upload de Vídeo Direto (Máx. 2 min)</label>
                        {formData.videoFile && (
                             <div className="mt-2 w-full bg-gray-50 rounded-md p-2 border">
                                <p className="text-xs text-green-600 font-semibold">Vídeo carregado com sucesso</p>
                            </div>
                        )}
                         <input type="file" accept="video/*" onChange={(e) => handleFileChange(e, 'video')} className="mt-2 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-brand-primary hover:file:bg-emerald-100"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Imagem (Opcional)</label>
                        {formData.imageUrl && (
                            <div className="mt-2 w-full h-40 bg-gray-50 rounded-md flex items-center justify-center overflow-hidden border">
                                <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-contain"/>
                            </div>
                        )}
                        <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'image')} className="mt-2 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-brand-primary hover:file:bg-emerald-100"/>
                    </div>
                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Cancelar</button>
                        <button type="submit" disabled={isProcessingVideo} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 disabled:bg-emerald-300">
                            {isProcessingVideo ? 'Processando...' : 'Salvar Anúncio'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AnnouncementManager: React.FC<AnnouncementManagerProps> = ({ announcements, setAnnouncements }) => {
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);

    const handleSave = (announcementData: Omit<Announcement, 'date'> | Announcement) => {
        if ('date' in announcementData) { // Editing
            setAnnouncements(announcements.map(a => a.title === announcementData.title ? announcementData : a));
        } else { // Creating
            const newAnnouncement: Announcement = {
                ...(announcementData as Announcement),
                date: new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
            };
            setAnnouncements([newAnnouncement, ...announcements]);
        }
        setModalOpen(false);
        setEditingAnnouncement(null);
    };
    
    const handleEdit = (announcement: Announcement) => {
        setEditingAnnouncement(announcement);
        setModalOpen(true);
    };

    const handleDelete = (announcementTitle: string) => {
        if (window.confirm("Tem certeza que deseja apagar este anúncio?")) {
            setAnnouncements(announcements.filter(a => a.title !== announcementTitle));
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
                    {announcements.length === 0 ? <p className="text-brand-subtle-text">Carregando anúncios...</p> : 
                    announcements.slice(0, 4).map(ann => (
                        <div key={ann.title} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50">
                            <div>
                                <p className="font-semibold text-brand-text">{ann.title}</p>
                                <p className="text-sm text-brand-subtle-text">{ann.category} - {ann.date}</p>
                            </div>
                            <div className="flex space-x-2">
                                <button onClick={() => handleEdit(ann)} className="p-2 text-brand-subtle-text hover:text-brand-primary">
                                    <PencilIcon className="w-5 h-5" />
                                </button>
                                <button onClick={() => handleDelete(ann.title)} className="p-2 text-brand-subtle-text hover:text-red-500">
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
            {isModalOpen && <AnnouncementFormModal announcement={editingAnnouncement} onClose={() => setModalOpen(false)} onSave={handleSave} />}
        </>
    );
};

export default AnnouncementManager;