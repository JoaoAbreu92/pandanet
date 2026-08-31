import ModalPortal from './ui/ModalPortal';
import React, { useState, useEffect } from 'react';
import Card from './Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Textarea } from './ui/Textarea';
import ConfirmModal from './ui/ConfirmModal';
import { useToast } from './ToastContext';
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
    const { showToast } = useToast();
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
            showToast('Não foi possível identificar a empresa.', 'error');
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

            await Promise.resolve(onSave());
            showToast(
                announcement?.id
                    ? 'Anúncio atualizado com sucesso.'
                    : 'Anúncio criado com sucesso.',
                'success'
            );
            onClose();
        } catch (error: any) {
            console.error('Error saving announcement:', error);
            showToast(
                `Erro ao salvar anúncio: ${error?.message || 'Erro desconhecido'}`,
                'error'
            );
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <ModalPortal
            className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[3px] pandanet-modal-viewport"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !isProcessing) onClose();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="announcement-modal-title"
                className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_30px_80px_-24px_rgba(2,6,23,0.55)] animate-fade-in-up dark:border-white/10 dark:bg-[#101d2e] sm:p-6"
            >
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Fechar"
                    disabled={isProcessing}
                    onClick={onClose}
                    className="absolute right-3 top-3"
                >
                    <XCircleIcon className="h-5 w-5" />
                </Button>
                <h3
                    id="announcement-modal-title"
                    className="mb-5 pr-12 text-xl font-bold text-slate-950 dark:text-white"
                >
                    {announcement?.id ? 'Editar anúncio' : 'Criar novo anúncio'}
                </h3>
                <form onSubmit={handleSubmit} className="max-h-[75vh] space-y-4 overflow-y-auto pr-2">
                    <Input
                        label="Título"
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        required
                        autoFocus
                        placeholder="Título do anúncio"
                    />

                    <Textarea
                        label="Resumo"
                        name="summary"
                        value={formData.summary}
                        onChange={handleChange}
                        rows={4}
                        required
                        placeholder="Escreva um resumo claro para o anúncio"
                    />

                    <Select
                        label="Categoria"
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                    >
                        <option>Notícias da Empresa</option>
                        <option>Atualização de Produto</option>
                        <option>RH & Cultura</option>
                        <option>Evento</option>
                    </Select>
                    {/* Media Inputs */}
                    <div>
                        <label
                            htmlFor="announcement-image"
                            className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200"
                        >
                            Imagem
                        </label>
                        <input
                            id="announcement-image"
                            type="file"
                            accept="image/*"
                            onChange={(event) => handleFileChange(event, 'image')}
                            className="block min-h-10 w-full cursor-pointer rounded-xl border border-slate-200 bg-white text-sm text-slate-600 shadow-sm file:mr-4 file:min-h-10 file:border-0 file:bg-emerald-50 file:px-4 file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-500/15 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-300 dark:file:bg-emerald-400/10 dark:file:text-emerald-300"
                        />
                        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                            💡 Dimensão recomendada: <strong>1200x400 pixels (proporção 3:1)</strong>. Para se adaptar ao tamanho do banner da empresa, a imagem será recortada e ajustada automaticamente.
                        </p>
                    </div>
                    <div>
                        <label
                            htmlFor="announcement-video"
                            className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200"
                        >
                            Vídeo
                        </label>
                        <input
                            id="announcement-video"
                            type="file"
                            accept="video/*"
                            onChange={(event) => handleFileChange(event, 'video')}
                            className="block min-h-10 w-full cursor-pointer rounded-xl border border-slate-200 bg-white text-sm text-slate-600 shadow-sm file:mr-4 file:min-h-10 file:border-0 file:bg-emerald-50 file:px-4 file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-500/15 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-300 dark:file:bg-emerald-400/10 dark:file:text-emerald-300"
                        />
                    </div>
                    <Input
                        label="URL do vídeo"
                        hint="Use uma URL externa quando não enviar um arquivo."
                        type="url"
                        name="videoUrl"
                        value={formData.videoUrl}
                        onChange={handleChange}
                        placeholder="https://..."
                    />

                    <div className="flex justify-end space-x-3 pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            disabled={isProcessing}
                            onClick={onClose}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            isLoading={isProcessing}
                            loadingText="Salvando..."
                        >
                            Salvar anúncio
                        </Button>
                    </div>
                </form>
            </div>
        </ModalPortal>
    );
};

const AnnouncementManager: React.FC<AnnouncementManagerProps> = () => {
    const { currentUser } = useAuth();
    const { showToast } = useToast();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
    const [announcementToDelete, setAnnouncementToDelete] = useState<Announcement | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

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

    const handleDelete = async (announcement: Announcement) => {
        if (isDeleting) return;
        setIsDeleting(true);

        try {
            const { error } = await supabase
                .from('announcements')
                .delete()
                .eq('id', announcement.id);

            if (error) throw error;

            await fetchAnnouncements();
            showToast('Anúncio excluído com sucesso.', 'success');
        } catch (error: any) {
            console.error('Error deleting announcement:', error);
            showToast(
                `Erro ao excluir anúncio: ${error?.message || 'Erro desconhecido'}`,
                'error'
            );
        } finally {
            setIsDeleting(false);
            setAnnouncementToDelete(null);
        }
    };

    return (
        <>
            <Card title="Gerenciar Anúncios" headerAction={
                <Button
                    type="button"
                    size="sm"
                    leftIcon={<PlusIcon className="h-4 w-4" />}
                    onClick={() => {
                        setEditingAnnouncement(null);
                        setModalOpen(true);
                    }}
                >
                    Criar anúncio
                </Button>
            }>
                <div className="space-y-3">
                    {announcements.length === 0 ? (
                        <p className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
                            Nenhum anúncio encontrado.
                        </p>
                    ) :
                        announcements.map(ann => (
                            <article
                                key={ann.id}
                                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-emerald-200 hover:shadow-md dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-emerald-400/30 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="min-w-0">
                                    <p className="truncate font-semibold text-slate-950 dark:text-white">
                                        {ann.title}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        {ann.category} · {new Date(ann.date).toLocaleDateString('pt-BR')}
                                    </p>
                                </div>
                                <div className="flex flex-none gap-1">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Editar anúncio ${ann.title}`}
                                        title="Editar anúncio"
                                        onClick={() => {
                                            setEditingAnnouncement(ann);
                                            setModalOpen(true);
                                        }}
                                        className="h-9 w-9"
                                    >
                                        <PencilIcon className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Excluir anúncio ${ann.title}`}
                                        title="Excluir anúncio"
                                        onClick={() => setAnnouncementToDelete(ann)}
                                        className="h-9 w-9 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                    </Button>
                                </div>
                            </article>
                        ))}
                </div>
            </Card>
            <ConfirmModal
                isOpen={announcementToDelete !== null}
                type="danger"
                title="Excluir anúncio?"
                message={announcementToDelete
                    ? `O anúncio "${announcementToDelete.title}" será removido permanentemente.`
                    : ''}
                confirmText={isDeleting ? 'Excluindo...' : 'Excluir anúncio'}
                cancelText="Cancelar"
                onCancel={() => {
                    if (!isDeleting) setAnnouncementToDelete(null);
                }}
                onConfirm={() => {
                    if (announcementToDelete) {
                        void handleDelete(announcementToDelete);
                    }
                }}
            />

            {isModalOpen && (
                <AnnouncementFormModal
                    announcement={editingAnnouncement}
                    onClose={() => setModalOpen(false)}
                    onSave={fetchAnnouncements}
                    currentUser={currentUser}
                />
            )}
        </>
    );
};

export default AnnouncementManager;