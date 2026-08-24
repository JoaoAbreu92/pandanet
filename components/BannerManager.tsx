import React, { useState, useEffect, useCallback } from 'react';
import Card from './Card';
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
        <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4">
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
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-6 py-2 bg-gray-100 text-gray-700 dark:text-gray-300 dark:bg-white/10 rounded-xl hover:bg-gray-250 text-xs font-bold uppercase tracking-widest"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="px-8 py-2 bg-brand-primary text-white rounded-xl hover:bg-emerald-600 text-xs font-bold uppercase tracking-widest shadow-lg shadow-brand-primary/20"
                    >
                        Cortar e Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Form Modal Component ---
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
            alert("Por favor, selecione uma imagem para o banner.");
            return;
        }

        let finalImageUrl = formData.imageUrl;

        if (imageFile) {
            const fileName = `banner_${Date.now()}_${imageFile.name}`;
            const { data, error: uploadError } = await supabase.storage
                .from('chat-media')
                .upload(fileName, imageFile);

            if (uploadError) {
                alert("Erro ao enviar imagem.");
                return;
            }

            finalImageUrl = await getSignedStorageUrl(
            `https://pandanet.grupopixel.com.br/storage/v1/object/public/chat-media/${fileName}`
        );
        }

        onSave({ ...formData, imageUrl: finalImageUrl });
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up">
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" disabled={isProcessing}><XCircleIcon className="w-6 h-6" /></button>
                    <h3 className="text-xl font-bold text-brand-text mb-4 dark:text-white">{banner?.id ? 'Editar Banner' : 'Adicionar Novo Banner'}</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">Título</label>
                            <input type="text" name="title" value={formData.title} onChange={handleChange} required className="mt-1 w-full border-gray-300 dark:border-gray-700 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2 focus:outline-none focus:ring-1 focus:ring-brand-primary" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">Subtítulo</label>
                            <input type="text" name="subtitle" value={formData.subtitle} onChange={handleChange} required className="mt-1 w-full border-gray-300 dark:border-gray-700 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2 focus:outline-none focus:ring-1 focus:ring-brand-primary" />
                        </div>
                        
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
                            <div>
                                <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">Link de Destino</label>
                                <input type="text" name="link" value={formData.link} onChange={handleChange} required={formData.showButton} className="mt-1 w-full border-gray-300 dark:border-gray-700 rounded-md sm:text-sm bg-white dark:bg-slate-800 text-brand-text dark:text-white border p-2 focus:outline-none focus:ring-1 focus:ring-brand-primary" />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text dark:text-gray-300">Imagem do Banner</label>
                            <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-500 mt-1">Tamanho sugerido do banner: 1200x400 pixels (Proporção 3:1 para não cortar informações)</p>
                            {formData.imageUrl && <img src={getCleanImageUrl(formData.imageUrl)} alt="Preview" className="mt-2 w-full h-32 object-cover rounded-md border dark:border-gray-700" />}
                            <input type="file" accept="image/*" onChange={handleFileChange} className="mt-2 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-brand-primary hover:file:bg-emerald-100 cursor-pointer" />
                        </div>
                        <div className="flex justify-end space-x-3 pt-2">
                            <button type="button" onClick={onClose} disabled={isProcessing} className="px-4 py-2 text-sm font-medium text-gray-750 bg-gray-200 dark:bg-slate-800 dark:text-gray-300 rounded-md hover:bg-gray-300">Cancelar</button>
                            <button type="submit" disabled={isProcessing} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 disabled:opacity-50">
                                {isProcessing ? 'Salvando...' : 'Salvar Banner'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
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

    if (loading) return <div className="p-8 text-center text-gray-500 dark:text-gray-400">Carregando gerenciador de banners...</div>;

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
                                    <button onClick={() => handleEdit(banner)} className="p-2 text-brand-subtle-text hover:text-brand-primary dark:text-gray-400 dark:hover:text-brand-primary">
                                        <PencilIcon className="w-5 h-5" />
                                    </button>
                                    <button onClick={() => handleDelete(banner.id)} className="p-2 text-brand-subtle-text hover:text-red-500 dark:text-gray-400 dark:hover:text-red-500">
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