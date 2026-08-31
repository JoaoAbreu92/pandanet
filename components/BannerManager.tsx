import ModalPortal from './ui/ModalPortal';
import React, { useState, useEffect, useCallback } from 'react';
import Card from './Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import ConfirmModal from './ui/ConfirmModal';
import { useToast } from './ToastContext';
import type { Banner } from '../types';
import { PencilIcon, PlusIcon, XCircleIcon, TrashIcon } from './icons';
import { supabase, getCleanImageUrl, getSignedStorageUrl } from '../supabaseClient';
import { useAuth } from './AuthContext';

// --- Image Cropper Component ---
interface ImageCropperProps {
    imageSrc: string;
    onCrop: (croppedFile: File) => void;
    onCancel: () => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({ imageSrc, onCrop, onCancel }) => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const [scale, setScale] = useState(1);
    const [offsetX, setOffsetX] = useState(0);
    const [offsetY, setOffsetY] = useState(0);
    const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);

    useEffect(() => {
        const img = new Image();
        img.src = imageSrc;
        img.onload = () => {
            setImgElement(img);
            // Calculate initial scale to cover the 1200x400 canvas
            const scaleX = 1200 / img.width;
            const scaleY = 400 / img.height;
            const initialScale = Math.max(scaleX, scaleY);
            setScale(initialScale);
            setOffsetX(0);
            setOffsetY(0);
        };
    }, [imageSrc]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !imgElement) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(0, 0, 1200, 400);

        // Draw image centered with scale and offset
        const w = imgElement.width * scale;
        const h = imgElement.height * scale;
        const x = (1200 - w) / 2 + offsetX;
        const y = (400 - h) / 2 + offsetY;

        ctx.drawImage(imgElement, x, y, w, h);
    }, [imgElement, scale, offsetX, offsetY]);

    useEffect(() => {
        draw();
    }, [draw]);

    const handleConfirm = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], 'cropped_banner.png', { type: 'image/png' });
                onCrop(file);
            }
        }, 'image/png');
    };

    return (
        <ModalPortal className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4 pandanet-modal-viewport">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-2xl shadow-2xl border dark:border-white/10 space-y-6">
                <div className="flex justify-between items-center border-b dark:border-white/5 pb-4">
                    <h4 className="text-xl font-bold text-gray-900 dark:text-white">Ajustar e Recortar Imagem (3:1)</h4>
                </div>

                <div className="relative border rounded-2xl overflow-hidden bg-gray-50 flex items-center justify-center">
                    <canvas
                        ref={canvasRef}
                        width={1200}
                        height={400}
                        className="w-full h-auto max-h-[300px] object-contain bg-gray-100"
                    />
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase w-20">Zoom:</label>
                        <input
                            type="range"
                            min="0.1"
                            max="3.0"
                            step="0.05"
                            value={scale}
                            onChange={(e) => setScale(parseFloat(e.target.value))}
                            className="flex-1 accent-brand-primary"
                        />
                        <span className="text-xs font-mono w-10 text-right text-gray-700 dark:text-gray-300">{Math.round(scale * 100)}%</span>
                    </div>

                    <div className="flex items-center gap-4">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase w-20">Eixo X:</label>
                        <input
                            type="range"
                            min="-600"
                            max="600"
                            step="1"
                            value={offsetX}
                            onChange={(e) => setOffsetX(parseInt(e.target.value, 10))}
                            className="flex-1 accent-brand-primary"
                        />
                        <span className="text-xs font-mono w-10 text-right text-gray-700 dark:text-gray-300">{offsetX}px</span>
                    </div>

                    <div className="flex items-center gap-4">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase w-20">Eixo Y:</label>
                        <input
                            type="range"
                            min="-300"
                            max="300"
                            step="1"
                            value={offsetY}
                            onChange={(e) => setOffsetY(parseInt(e.target.value, 10))}
                            className="flex-1 accent-brand-primary"
                        />
                        <span className="text-xs font-mono w-10 text-right text-gray-700 dark:text-gray-300">{offsetY}px</span>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t dark:border-white/5">
                    <Button type="button" variant="ghost" onClick={onCancel}>
                        Cancelar
                    </Button>
                    <Button type="button" onClick={handleConfirm}>
                        Cortar e confirmar
                    </Button>
                </div>
            </div>
        </ModalPortal>
    );
};

// --- Form Modal Component ---
const BannerFormModal: React.FC<{
    banner: Partial<Banner> | null;
    onClose: () => void;
    onSave: (bannerData: Partial<Banner>) => void;
    isProcessing?: boolean;
}> = ({ banner, onClose, onSave, isProcessing }) => {
    const { showToast } = useToast();
    const [formData, setFormData] = useState({
        title: banner?.title || '',
        subtitle: banner?.subtitle || '',
        link: banner?.link || '#',
        imageUrl: banner?.imageUrl || '',
        showButton: banner?.showButton !== false
    });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [showCropper, setShowCropper] = useState(false);
    const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = () => {
                setTempImageSrc(reader.result as string);
                setShowCropper(true);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCropComplete = (croppedFile: File) => {
        setImageFile(croppedFile);
        setFormData(prev => ({ ...prev, imageUrl: URL.createObjectURL(croppedFile) }));
        setShowCropper(false);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.imageUrl && !imageFile) {
            showToast('Selecione uma imagem para o banner.', 'error');
            return;
        }

        let finalImageUrl = formData.imageUrl;

        if (imageFile) {
            const fileName = `banner_${Date.now()}_${imageFile.name}`;
            const { data, error: uploadError } = await supabase.storage
                .from('chat-media')
                .upload(fileName, imageFile);

            if (uploadError) {
                console.error('Error uploading banner image:', uploadError);
                showToast(
                    `Erro ao enviar imagem: ${uploadError.message || 'Erro desconhecido'}`,
                    'error'
                );
                return;
            }

            finalImageUrl = await getSignedStorageUrl(
            `https://pandanet.grupopixel.com.br/storage/v1/object/public/chat-media/${data?.path || fileName}`
            );
        }

        onSave({ ...formData, imageUrl: finalImageUrl });
    };

    return (
        <>
            <ModalPortal className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 pandanet-modal-viewport">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Fechar"
                        onClick={onClose}
                        disabled={isProcessing}
                        className="absolute right-3 top-3"
                    >
                        <XCircleIcon className="h-5 w-5" />
                    </Button>
                    <h3 className="text-xl font-bold text-brand-text mb-4 dark:text-white">{banner?.id ? 'Editar Banner' : 'Adicionar Novo Banner'}</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input
                            label="Título"
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            required
                            autoFocus
                            placeholder="Título principal do banner"
                        />
                        <Input
                            label="Subtítulo"
                            type="text"
                            name="subtitle"
                            value={formData.subtitle}
                            onChange={handleChange}
                            required
                            placeholder="Texto complementar"
                        />
                        
                        <div className="flex items-center justify-between py-2">
                            <label className="text-sm font-medium text-brand-subtle-text dark:text-gray-300">Mostrar botão "Saiba mais"</label>
                            <input
                                type="checkbox"
                                checked={formData.showButton}
                                onChange={(e) => setFormData(prev => ({ ...prev, showButton: e.target.checked }))}
                                className="rounded border-gray-350 text-brand-primary focus:ring-brand-primary h-5 w-5 cursor-pointer dark:bg-slate-800"
                            />
                        </div>

                        {formData.showButton && (
                            <Input
                                label="Link de destino"
                                type="url"
                                name="link"
                                value={formData.link}
                                onChange={handleChange}
                                required={formData.showButton}
                                placeholder="https://..."
                            />
                        )}

                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">Imagem do Banner</label>
                            <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-500 mt-1">Tamanho sugerido do banner: 1200x400 pixels (Proporção 3:1 para não cortar informações)</p>
                            {formData.imageUrl && <img src={getCleanImageUrl(formData.imageUrl)} alt="Preview" className="mt-2 w-full h-32 object-cover rounded-md border dark:border-gray-700" />}
                            <input type="file" accept="image/*" onChange={handleFileChange} className="mt-2 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-brand-primary hover:file:bg-emerald-100 cursor-pointer" />
                        </div>
                        <div className="flex justify-end space-x-3 pt-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={onClose}
                                disabled={isProcessing}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                isLoading={isProcessing}
                                loadingText="Salvando..."
                            >
                                Salvar banner
                            </Button>
                        </div>
                    </form>
                </div>
            </ModalPortal>
            {showCropper && tempImageSrc && (
                <ImageCropper
                    imageSrc={tempImageSrc}
                    onCrop={handleCropComplete}
                    onCancel={() => setShowCropper(false)}
                />
            )}
        </>
    );
};

// --- Main Component ---
const BannerManager: React.FC = () => {
    const { showToast } = useToast();
    const { currentUser } = useAuth();
    const [banners, setBanners] = useState<Banner[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
    const [bannerToDelete, setBannerToDelete] = useState<Banner | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
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
                    imageUrl: b.image_url,
                    showButton: b.show_button !== false
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
                link: bannerData.showButton ? bannerData.link : '',
                image_url: bannerData.imageUrl,
                show_button: bannerData.showButton
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

            await fetchBanners();
            setModalOpen(false);
            setEditingBanner(null);
            showToast(
                bannerData.id
                    ? 'Banner atualizado com sucesso.'
                    : 'Banner criado com sucesso.',
                'success'
            );
        } catch (err: any) {
            console.error('Error saving banner:', err);
            showToast(
                `Erro ao salvar banner: ${err?.message || 'Erro desconhecido'}`,
                'error'
            );
        } finally {
            setIsProcessing(false);
        }
    };

    const handleEdit = (banner: Banner) => {
        setEditingBanner(banner);
        setModalOpen(true);
    };

    const handleDelete = async (banner: Banner) => {
        if (isDeleting) return;
        setIsDeleting(true);

        try {
            const { error } = await supabase
                .from('banners')
                .delete()
                .eq('id', banner.id);

            if (error) throw error;

            await fetchBanners();
            showToast('Banner excluído com sucesso.', 'success');
        } catch (err: any) {
            console.error('Error deleting banner:', err);
            showToast(
                `Erro ao excluir banner: ${err?.message || 'Erro desconhecido'}`,
                'error'
            );
        } finally {
            setIsDeleting(false);
            setBannerToDelete(null);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500 dark:text-gray-400">Carregando gerenciador de banners...</div>;

    return (
        <>
            <Card title="Gerenciar Banners" headerAction={
                <Button
                    type="button"
                    size="sm"
                    leftIcon={<PlusIcon className="h-4 w-4" />}
                    onClick={() => {
                        setEditingBanner(null);
                        setModalOpen(true);
                    }}
                >
                    Criar banner
                </Button>
            }>
                <div className="space-y-4">
                    {banners.length === 0 ? (
                        <p className="text-center text-gray-500 dark:text-gray-400 py-4">Nenhum banner encontrado.</p>
                    ) : (
                        banners.map(banner => (
                            <div key={banner.id} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 dark:hover:bg-slate-800 border border-transparent hover:border-gray-100 dark:hover:border-slate-700 transition-all">
                                <div className="flex items-center space-x-4">
                                    <img src={getCleanImageUrl(banner.imageUrl)} alt={banner.title} className="w-20 h-10 object-cover rounded-md border dark:border-slate-700" />
                                    <div>
                                        <p className="font-semibold text-brand-text dark:text-white">{banner.title}</p>
                                        <p className="text-sm text-brand-subtle-text dark:text-gray-400">{banner.subtitle}</p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">{banner.showButton ? 'Botão Ativo' : 'Apenas Banner Visual'}</p>
                                    </div>
                                </div>
                                <div className="flex space-x-1">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Editar banner ${banner.title}`}
                                        title="Editar banner"
                                        onClick={() => handleEdit(banner)}
                                        className="h-9 w-9"
                                    >
                                        <PencilIcon className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Excluir banner ${banner.title}`}
                                        title="Excluir banner"
                                        onClick={() => setBannerToDelete(banner)}
                                        className="h-9 w-9 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Card>
            <ConfirmModal
                isOpen={bannerToDelete !== null}
                type="danger"
                title="Excluir banner?"
                message={bannerToDelete
                    ? `O banner "${bannerToDelete.title}" será removido permanentemente.`
                    : ''}
                confirmText={isDeleting ? 'Excluindo...' : 'Excluir banner'}
                cancelText="Cancelar"
                onCancel={() => {
                    if (!isDeleting) setBannerToDelete(null);
                }}
                onConfirm={() => {
                    if (bannerToDelete) {
                        void handleDelete(bannerToDelete);
                    }
                }}
            />

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