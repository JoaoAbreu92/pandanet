import React, { useState, useEffect, useRef } from 'react';
import Announcements from './Announcements';
import UpcomingEvents from './UpcomingEvents';
import Carousel from './Carousel';
import RecognitionWall from './RecognitionWall';
import CompanyPoll from './CompanyPoll';
import QuickLinks from './QuickLinks';
import MiniCalendar from './MiniCalendar';
import { supabase, getSignedStorageUrl } from '../supabaseClient';
import type { Employee, AppData } from '../types';
import Card from './Card';
import { GiftIcon, UserPlusIcon, VideoCameraIcon, BuildingStorefrontIcon, ClipboardDocumentCheckIcon, Cog6ToothIcon } from './icons';
import { useAuth } from './AuthContext';

interface HomePageProps {
    onNavigate: (page: string, context?: any) => void;
    employees: Employee[];
    currentUser: Employee;
}

import { useLanguage } from './LanguageContext';

const Birthdays: React.FC<{ employees: Employee[] }> = ({ employees }) => {
    const { t } = useLanguage();
    const currentMonth = new Date().getMonth() + 1;
    const upcomingBirthdays = employees.filter(e => {
        const birthMonth = new Date(e.birthDate).getUTCMonth() + 1;
        return birthMonth === currentMonth;
    }).sort((a, b) => new Date(a.birthDate).getUTCDate() - new Date(b.birthDate).getUTCDate());

    return (
        <Card title={t('home.birthdays_title') || 'Aniversariantes do Mês'}>
            {upcomingBirthdays.length > 0 ? (
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                    {upcomingBirthdays.map(employee => (
                        <div key={employee.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <img src={employee.avatarUrl} alt={employee.name} className="w-10 h-10 rounded-full" />
                            <div>
                                <p className="font-semibold text-sm text-brand-text dark:text-gray-100">{employee.name}</p>
                                <p className="text-xs text-brand-subtle-text dark:text-gray-400">
                                    <GiftIcon className="w-3 h-3 inline-block mr-1" />
                                    {new Date(employee.birthDate).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' })}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                    <p className="text-sm text-brand-subtle-text dark:text-gray-500">{t('home.birthdays_none') || 'Nenhum aniversário este mês.'}</p>
            )}
        </Card>
    );
};

const NewHires: React.FC<{ employees: Employee[] }> = ({ employees }) => {
    const { t } = useLanguage();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newHires = employees.filter(e => new Date(e.joinDate) >= thirtyDaysAgo).sort((a, b) => new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime());

    return (
        <Card title={t('home.welcome_title') || 'Boas-vindas!'}>
            {newHires.length > 0 ? (
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                    {newHires.map(employee => (
                        <div key={employee.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <img src={employee.avatarUrl} alt={employee.name} className="w-10 h-10 rounded-full" />
                            <div>
                                <p className="font-semibold text-sm text-brand-text dark:text-gray-100">{employee.name}</p>
                                <p className="text-xs text-brand-subtle-text dark:text-gray-400">{employee.role}, {employee.team}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                    <UserPlusIcon className="w-3 h-3 inline-block mr-1" />
                                    Entrou em {new Date(employee.joinDate).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' })}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                    <p className="text-sm text-brand-subtle-text dark:text-gray-500">{t('home.welcome_none') || 'Nenhum novo colaborador recentemente.'}</p>
            )}
        </Card>
    );
};

// ─── Master Banner Component ─────────────────────────────────────────────────
interface MasterBannerData {
    isActive: boolean;
    imageUrl: string;
    videoUrl?: string;
    link?: string;
    buttonText?: string;
}

const MasterBanner: React.FC = () => {
    const { profile } = useAuth();
    const [bannerData, setBannerData] = useState<MasterBannerData | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [editForm, setEditForm] = useState<MasterBannerData>({
        isActive: true, imageUrl: '', videoUrl: '', link: '', buttonText: ''
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Verificar se pode editar: masteradmin (grupopixel.com.br) ou Super Admin
    const canEdit = profile?.role === 'Super Admin' || 
                    (profile?.email || '').toLowerCase().endsWith('@grupopixel.com.br');

    useEffect(() => {
        fetchBanner();
    }, []);

    const fetchBanner = async () => {
        try {
            const { data } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'master_banner')
                .single();
            if (data?.value) {
                const parsed = JSON.parse(data.value);
                setBannerData(parsed);
                setEditForm(parsed);
            }
        } catch {
            // sem banner ainda
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isVideo = file.type.startsWith('video/');
        const isImage = file.type.startsWith('image/');
        if (!isImage && !isVideo) {
            alert('Por favor, selecione uma imagem ou vídeo.');
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            alert('Arquivo muito grande. Máximo 20MB.');
            return;
        }

        setUploading(true);
        try {
            const ext = file.name.split('.').pop();
            const path = `master-banner/banner_${Date.now()}.${ext}`;
            const { error: upErr } = await supabase.storage
                .from('chat-media')
                .upload(path, file, { upsert: true });
            if (upErr) throw upErr;
            const publicUrl = await getSignedStorageUrl(`https://pandanet.grupopixel.com.br/storage/v1/object/public/chat-media/${path}`);
            if (isVideo) {
                setEditForm(prev => ({ ...prev, videoUrl: publicUrl, imageUrl: '' }));
            } else {
                setEditForm(prev => ({ ...prev, imageUrl: publicUrl, videoUrl: '' }));
            }
        } catch (err: any) {
            alert('Erro no upload: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        try {
            const payload = JSON.stringify(editForm);
            const { error } = await supabase
                .from('system_settings')
                .upsert({ key: 'master_banner', value: payload }, { onConflict: 'key' });
            if (error) throw error;
            setBannerData(editForm);
            setIsEditing(false);
        } catch (err: any) {
            alert('Erro ao salvar banner: ' + err.message);
        }
    };

    const hasContent = bannerData?.isActive && (bannerData?.imageUrl || bannerData?.videoUrl);

    // Se não tem conteúdo e não pode editar → não renderiza nada
    if (!hasContent && !canEdit) return null;

    return (
        <div className="w-full flex flex-col items-center gap-4 overflow-hidden">
            {/* Banner exibido */}
            {hasContent && (
                <div className="w-full relative group overflow-hidden rounded-none md:rounded-[2.5rem] shadow-2xl border-y md:border border-gray-100/50 dark:border-gray-800/50 animate-in fade-in slide-in-from-bottom-6 duration-1000">
                    {bannerData!.videoUrl ? (
                        <video
                            src={bannerData!.videoUrl}
                            autoPlay muted loop playsInline
                            className="w-full object-cover h-[180px] sm:h-[280px] md:h-[415px] lg:h-[515px]"
                        />
                    ) : bannerData!.link ? (
                        <a href={bannerData!.link} target="_blank" rel="noopener noreferrer" className="block">
                            <img
                                src={bannerData!.imageUrl}
                                alt="Banner Master"
                                className="w-full object-cover transition-transform duration-700 group-hover:scale-[1.02] h-[180px] sm:h-[280px] md:h-[415px] lg:h-[515px]"
                            />
                            {bannerData!.buttonText && (
                                <div className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2">
                                    <span className="px-4 py-2 sm:px-8 sm:py-3 bg-white/95 backdrop-blur text-gray-900 font-semibold rounded-full shadow-2xl text-xs sm:text-base hover:bg-white transition-all transform group-hover:scale-105">
                                        {bannerData!.buttonText}
                                    </span>
                                </div>
                            )}
                        </a>
                    ) : (
                        <img
                            src={bannerData!.imageUrl}
                            alt="Banner Master"
                            className="w-full object-cover h-[180px] sm:h-[280px] md:h-[415px] lg:h-[515px]"
                        />
                    )}

                    {/* Botão de edição para admins */}
                    {canEdit && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white text-xs font-bold px-3 py-1.5 rounded-lg backdrop-blur"
                        >
                            ✏️ Editar Banner
                        </button>
                    )}
                </div>
            )}

            {/* Botão para adicionar banner (quando vazio, só para admin) */}
            {!hasContent && canEdit && (
                <button
                    onClick={() => setIsEditing(true)}
                    className="w-full h-32 flex items-center justify-center gap-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[2.5rem] text-gray-400 hover:text-brand-primary hover:border-brand-primary transition-all text-lg font-medium bg-gray-50/30 dark:bg-gray-800/30 hover:bg-white dark:hover:bg-gray-800 group"
                >
                    <span className="text-3xl group-hover:scale-125 transition-transform">🖼️</span>
                    Adicionar Banner Global (Masteradmin)
                </button>
            )}

            {/* Modal de edição */}
            {isEditing && canEdit && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-lg p-8 space-y-6 animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Banner Global (Masteradmin)</h3>
                            <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                        </div>

                        <p className="text-xs text-gray-500">Tamanho ideal: <strong>800 × 320px</strong>. Carregue imagem ou vídeo (máx. 20MB)</p>

                        {/* Upload */}
                        <div>
                            <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileUpload} />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-brand-primary hover:text-brand-primary transition-all disabled:opacity-50"
                            >
                                {uploading ? (
                                    <><span className="animate-spin text-2xl">⏳</span><span className="text-sm font-medium">Enviando...</span></>
                                ) : (editForm.imageUrl || editForm.videoUrl) ? (
                                    <><span className="text-2xl">✅</span><span className="text-sm font-medium">Mídia carregada. Clique para trocar</span></>
                                ) : (
                                    <><span className="text-2xl">📤</span><span className="text-sm font-medium">Clique para enviar imagem ou vídeo</span></>
                                )}
                            </button>
                        </div>

                        {/* Preview */}
                        {(editForm.imageUrl || editForm.videoUrl) && (
                            <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                                {editForm.videoUrl ? (
                                    <video src={editForm.videoUrl} className="w-full max-h-40 object-cover" muted autoPlay loop />
                                ) : (
                                    <img src={editForm.imageUrl} alt="preview" className="w-full max-h-40 object-cover" />
                                )}
                            </div>
                        )}

                        {/* Link */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 block">Link ao clicar (opcional)</label>
                            <input
                                value={editForm.link || ''}
                                onChange={e => setEditForm(p => ({ ...p, link: e.target.value }))}
                                placeholder="https://..."
                                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-brand-primary/30"
                            />
                        </div>

                        {/* Texto do botão */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 block">Texto do botão (opcional)</label>
                            <input
                                value={editForm.buttonText || ''}
                                onChange={e => setEditForm(p => ({ ...p, buttonText: e.target.value }))}
                                placeholder="Ex: Saiba mais"
                                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-brand-primary/30"
                            />
                        </div>

                        {/* Toggle ativo */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setEditForm(p => ({ ...p, isActive: !p.isActive }))}
                                className={`w-12 h-6 rounded-full transition-colors relative ${editForm.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}
                            >
                                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow ${editForm.isActive ? 'left-7' : 'left-1'}`} />
                            </button>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {editForm.isActive ? 'Banner ativo (visível para todos)' : 'Banner desativado'}
                            </span>
                        </div>

                        {/* Ações */}
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex-1 py-3 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                            >
                                Salvar Banner
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

interface CompanyHighlightsWidgetProps {
    onNavigate: (page: string, context?: any) => void;
    currentUser: Employee;
}

const CompanyHighlightsWidget: React.FC<CompanyHighlightsWidgetProps> = ({ onNavigate, currentUser }) => {
    const [youtubeUrls, setYoutubeUrls] = useState<string[]>([]);
    const [activeVideoIndex, setActiveVideoIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [latestMarketplaces, setLatestMarketplaces] = useState<any[]>([]);
    const [latestProjects, setLatestProjects] = useState<any[]>([]);
    
    const projectsScrollRef = React.useRef<HTMLDivElement>(null);
    const marketScrollRef = React.useRef<HTMLDivElement>(null);

    const scrollContainer = (ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
        if (ref.current) {
            const scrollAmount = direction === 'left' ? -350 : 350;
            ref.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };
    
    const [isEditingVideo, setIsEditingVideo] = useState(false);
    const [videoInputs, setVideoInputs] = useState<string[]>(['', '', '', '', '']);

    const companyId = currentUser?.company_id;
    const canEditVideo = currentUser?.isAdmin || currentUser?.role === 'Super Admin' || currentUser?.isCompanyAdmin;

    const fetchHighlights = async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            // 1. YouTube Video settings
            const { data: videoSetting } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', `company_video_${companyId}`)
                .maybeSingle();
            
            if (videoSetting?.value) {
                const val = videoSetting.value.trim();
                let urls: string[] = [];
                if (val.startsWith('[') && val.endsWith(']')) {
                    try {
                        urls = JSON.parse(val);
                    } catch {
                        urls = val.split(',').map((u: string) => u.trim());
                    }
                } else {
                    urls = val.split(',').map((u: string) => u.trim());
                }
                urls = urls.filter(u => u.length > 0).slice(0, 5);
                setYoutubeUrls(urls);
                
                const inputs = ['', '', '', '', ''];
                urls.forEach((url, idx) => {
                    if (idx < 5) inputs[idx] = url;
                });
                setVideoInputs(inputs);
            } else {
                setYoutubeUrls([]);
                setVideoInputs(['', '', '', '', '']);
            }

            // 2. Latest 3 Marketplace Items
            const { data: marketData } = await supabase
                .from('marketplace_items')
                .select(`
                    *,
                    seller:listed_by(full_name)
                `)
                .eq('company_id', companyId)
                .order('created_at', { ascending: false })
                .limit(8);

            if (marketData && marketData.length > 0) {
                setLatestMarketplaces(marketData.map((item: any) => ({
                    id: item.id,
                    title: item.title,
                    price: item.price,
                    imageUrl: item.image_urls?.[0] || '',
                    seller: item.seller?.full_name || 'Usuário',
                    status: item.status
                })));
            } else {
                setLatestMarketplaces([]);
            }

            // 3. Latest 3 Active Projects
            const { data: projData } = await supabase
                .from('projects')
                .select('*, manager:profiles(full_name, avatar_url)')
                .eq('company_id', companyId)
                .neq('status', 'Concluído')
                .order('created_at', { ascending: false });

            const { data: taskData } = await supabase
                .from('project_tasks')
                .select('id, project_id, assigned_to, stage:project_stages(name)');

            if (projData) {
                const mapped = projData.map((p: any) => {
                    const projectTasks = (taskData || []).filter((t: any) => t.project_id === p.id);
                    const completedTasks = projectTasks.filter((t: any) => t.stage?.name === 'Concluído' || t.stage?.name === 'Done');
                    return {
                        ...p,
                        task_count: projectTasks.length,
                        completed_task_count: completedTasks.length,
                        tasks: projectTasks
                    };
                });

                const userProjects = mapped.filter((p: any) => {
                    if (canEditVideo) return true; // Admins see all
                    const isManager = p.manager_id === currentUser.id;
                    const hasAssignedTask = p.tasks.some((t: any) => t.assigned_to === currentUser.id);
                    return isManager || hasAssignedTask;
                });

                setLatestProjects(userProjects.slice(0, 8));
            } else {
                setLatestProjects([]);
            }
        } catch (error) {
            console.error("Erro ao buscar destaques:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHighlights();
    }, [companyId]);

    useEffect(() => {
        if (youtubeUrls.length > 2) {
            const timer = setInterval(() => {
                setActiveVideoIndex(prev => (prev + 1) % youtubeUrls.length);
            }, 5000);
            return () => clearInterval(timer);
        }
    }, [youtubeUrls]);

    const handleSaveVideo = async () => {
        if (!companyId) return;
        try {
            const urlsToSave = videoInputs.map(u => u.trim()).filter(u => u.length > 0);
            const valueToSave = urlsToSave.join(',');
            
            const { error } = await supabase
                .from('system_settings')
                .upsert({ key: `company_video_${companyId}`, value: valueToSave }, { onConflict: 'key' });
            
            if (error) throw error;
            setYoutubeUrls(urlsToSave);
            setActiveVideoIndex(0);
            setIsEditingVideo(false);
        } catch (err: any) {
            alert('Erro ao salvar vídeo: ' + err.message);
        }
    };

    const getYouTubeEmbedUrl = (url: string) => {
        if (!url) return '';
        let videoId = '';
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        if (match && match[2].length === 11) {
            videoId = match[2];
        } else {
            if (url.includes('youtube.com/embed/')) {
                return url;
            }
            return '';
        }
        return `https://www.youtube.com/embed/${videoId}`;
    };

    const currentVideoUrl = youtubeUrls[activeVideoIndex] || '';
    const embedUrl = getYouTubeEmbedUrl(currentVideoUrl);

    if (loading) {
        return <div className="text-center text-slate-450 py-4 text-xs font-semibold">Carregando destaques...</div>;
    }

    return (
        <div className="space-y-8 mt-8">
            {/* Bloco 1: Vídeos em Destaque */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/20 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                    <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        📺 Vídeos em Destaque {youtubeUrls.length > 2 && `(${activeVideoIndex + 1}/${youtubeUrls.length})`}
                    </h4>
                    {canEditVideo && (
                        <button
                            onClick={() => setIsEditingVideo(true)}
                            className="text-[11px] text-brand-primary font-bold hover:underline flex items-center gap-1 bg-brand-primary/10 px-3 py-1.5 rounded-full transition-all"
                        >
                            <Cog6ToothIcon className="w-3.5 h-3.5" />
                            Configurar Vídeos
                        </button>
                    )}
                </div>

                {youtubeUrls.length === 0 ? (
                    <div className="w-full h-40 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center p-4">
                        <span className="text-2xl mb-1">📺</span>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Nenhum vídeo configurado</span>
                        {canEditVideo && (
                            <button
                                onClick={() => setIsEditingVideo(true)}
                                className="mt-2 text-[10px] bg-brand-primary text-white px-3 py-1.5 rounded-full font-bold shadow-sm hover:bg-emerald-600 transition-all"
                            >
                                Adicionar
                            </button>
                        )}
                    </div>
                ) : youtubeUrls.length === 1 ? (
                    <div className="max-w-3xl mx-auto">
                        <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-lg bg-black">
                            <iframe
                                src={getYouTubeEmbedUrl(youtubeUrls[0])}
                                title="YouTube video player"
                                frameBorder="0"
                                className="w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        </div>
                    </div>
                ) : youtubeUrls.length === 2 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {youtubeUrls.map((url, idx) => (
                            <div key={idx} className="relative aspect-video w-full rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-lg bg-black">
                                <iframe
                                    src={getYouTubeEmbedUrl(url)}
                                    title={`YouTube video player ${idx + 1}`}
                                    frameBorder="0"
                                    className="w-full h-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Carousel de 3 ou mais vídeos com transição automática de 5s */
                    <div className="relative group/carousel aspect-video max-w-4xl mx-auto w-full rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-xl bg-black">
                        <iframe
                            src={getYouTubeEmbedUrl(youtubeUrls[activeVideoIndex])}
                            title="YouTube video player"
                            frameBorder="0"
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                        
                        {/* Seta Esquerda */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setActiveVideoIndex(prev => (prev === 0 ? youtubeUrls.length - 1 : prev - 1));
                            }}
                            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-900/70 hover:bg-slate-900/90 text-white flex items-center justify-center transition-all opacity-0 group-hover/carousel:opacity-100 shadow-md backdrop-blur-sm"
                            title="Vídeo Anterior"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                            </svg>
                        </button>
                        
                        {/* Seta Direita */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setActiveVideoIndex(prev => (prev === youtubeUrls.length - 1 ? 0 : prev + 1));
                            }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-900/70 hover:bg-slate-900/90 text-white flex items-center justify-center transition-all opacity-0 group-hover/carousel:opacity-100 shadow-md backdrop-blur-sm"
                            title="Próximo Vídeo"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                        </button>

                        {/* Dots Indicadores */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 px-4 py-1.5 rounded-full backdrop-blur-sm z-10">
                            {youtubeUrls.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setActiveVideoIndex(idx)}
                                    className={`w-2.5 h-2.5 rounded-full transition-all ${idx === activeVideoIndex ? 'bg-brand-primary w-5' : 'bg-white/60 hover:bg-white'}`}
                                    title={`Vídeo ${idx + 1}`}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Bloco 2: Últimos Projetos Ativos */}
            {latestProjects.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/20 space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                        <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                            📂 Meus Projetos Ativos
                        </h4>
                        <div className="flex gap-2">
                            <button
                                onClick={() => scrollContainer(projectsScrollRef, 'left')}
                                className="p-1.5 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-slate-100 dark:border-slate-850"
                                title="Rolar para esquerda"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                                </svg>
                            </button>
                            <button
                                onClick={() => scrollContainer(projectsScrollRef, 'right')}
                                className="p-1.5 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-slate-100 dark:border-slate-850"
                                title="Rolar para direita"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div
                        ref={projectsScrollRef}
                        className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 scroll-smooth snap-x snap-mandatory"
                    >
                        {latestProjects.map((project: any) => {
                            const progress = project.task_count > 0 ? Math.round((project.completed_task_count / project.task_count) * 100) : 0;
                            return (
                                <div
                                    key={project.id}
                                    onClick={() => {
                                        localStorage.setItem('pixel_selected_project', JSON.stringify(project));
                                        onNavigate('projects');
                                    }}
                                    className="flex-shrink-0 w-80 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-sm cursor-pointer transition-all flex flex-col justify-between h-[110px] snap-start animate-in fade-in duration-300"
                                    style={{ borderLeft: `4px solid ${project.color || '#10B981'}` }}
                                >
                                    <div>
                                        <h5 className="text-xs font-bold text-slate-850 dark:text-slate-200 truncate">{project.name}</h5>
                                        <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
                                            Gerente: {project.manager?.full_name || 'Sem gerente'}
                                        </p>
                                    </div>
                                    <div className="space-y-1.5 pt-1.5 shrink-0">
                                        <div className="flex justify-between text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                                            <span>Progresso</span>
                                            <span>{progress}% ({project.completed_task_count}/{project.task_count})</span>
                                        </div>
                                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: project.color || '#10B981' }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Bloco 3: Marketplace */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/20 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                    <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        🛍️ Destaques do Marketplace
                    </h4>
                    <div className="flex gap-2">
                        <button
                            onClick={() => scrollContainer(marketScrollRef, 'left')}
                            className="p-1.5 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-slate-100 dark:border-slate-850"
                            title="Rolar para esquerda"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                            </svg>
                        </button>
                        <button
                            onClick={() => scrollContainer(marketScrollRef, 'right')}
                            className="p-1.5 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-slate-100 dark:border-slate-850"
                            title="Rolar para direita"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div
                    ref={marketScrollRef}
                    className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 scroll-smooth snap-x snap-mandatory"
                >
                    {latestMarketplaces.length > 0 ? (
                        <>
                            {latestMarketplaces.map((item: any) => (
                                <div
                                    key={item.id}
                                    onClick={() => onNavigate('marketplace')}
                                    className="flex-shrink-0 w-72 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-sm cursor-pointer transition-all flex flex-col justify-between h-[130px] snap-start animate-in fade-in duration-300"
                                >
                                    <div className="flex gap-3">
                                        {item.imageUrl ? (
                                            <img src={item.imageUrl} alt={item.title} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                                        ) : (
                                            <div className="w-16 h-16 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-lg shrink-0">🛍️</div>
                                        )}
                                        <div className="min-w-0">
                                            <h5 className="text-xs font-bold text-slate-850 dark:text-slate-200 truncate">{item.title}</h5>
                                            <p className="text-[10px] text-slate-400 font-medium truncate">Por {item.seller}</p>
                                            <span className="inline-block mt-1 bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">
                                                {item.status}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 shrink-0">
                                        <span className="text-[9px] text-slate-400 font-bold uppercase">Preço</span>
                                        <span className="text-xs font-black text-brand-primary">R$ {item.price.toFixed(2)}</span>
                                    </div>
                                </div>
                            ))}
                            
                            {/* Card Gradiente Especial "Ver Todos" no Final */}
                            <div
                                onClick={() => onNavigate('marketplace')}
                                className="flex-shrink-0 w-48 bg-gradient-to-br from-brand-primary to-emerald-600 text-white p-4 rounded-2xl shadow-md cursor-pointer transition-all hover:scale-[1.02] flex flex-col items-center justify-center text-center h-[130px] snap-start"
                            >
                                <span className="text-2xl mb-1">➔</span>
                                <span className="text-xs font-bold uppercase tracking-wider">Ver Todos</span>
                                <span className="text-[9px] text-white/85 mt-1 font-medium">Acessar Marketplace</span>
                            </div>
                        </>
                    ) : (
                        <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-150 dark:border-slate-850 flex flex-col items-center justify-center text-center w-full h-[130px]">
                            <span className="text-2xl mb-1">🛍️</span>
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Nenhum anúncio disponível no momento</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal para Configurar Vídeos em Destaque (Suporta até 5 vídeos) */}
            {isEditingVideo && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-4 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-black text-slate-850 dark:text-white uppercase tracking-wider">Configurar Vídeos em Destaque</h3>
                            <button onClick={() => setIsEditingVideo(false)} className="text-slate-450 hover:text-slate-650 text-lg font-bold">&times;</button>
                        </div>
                        <p className="text-xs text-slate-450 dark:text-slate-500">Cole até 5 URLs do YouTube. Caso adicione mais de um vídeo, eles serão exibidos em estilo carrossel.</p>
                        
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                            {videoInputs.map((val, idx) => (
                                <div key={idx} className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                        Vídeo {idx + 1} {idx === 0 ? '(Principal)' : '(Opcional)'}
                                    </label>
                                    <input
                                        type="text"
                                        value={val}
                                        onChange={(e) => {
                                            const updated = [...videoInputs];
                                            updated[idx] = e.target.value;
                                            setVideoInputs(updated);
                                        }}
                                        placeholder="https://www.youtube.com/watch?v=..."
                                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setIsEditingVideo(false)}
                                className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-550 dark:text-slate-450 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveVideo}
                                className="flex-1 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-emerald-600 shadow-lg"
                            >
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

interface RecentBadgeAward {
    id: string;
    reason: string;
    created_at: string;
    company_badges: {
        name: string;
        icon: string;
        color: string;
    };
    recipient: {
        full_name: string;
        avatar_url: string;
    };
    awarder: {
        full_name: string;
    } | null;
}

const PendingTrainingsWidget: React.FC<{ currentUser: Employee; onNavigate: (page: string) => void }> = ({ currentUser, onNavigate }) => {
    const [pendingTrainings, setPendingTrainings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPendingTrainings = async () => {
            if (!currentUser?.company_id) return;
            try {
                // Fetch trainings where user is a participant
                const { data: trainings, error: trainError } = await supabase
                    .from('training_modules')
                    .select('*')
                    .eq('company_id', currentUser.company_id);

                if (trainError) throw trainError;

                // Fetch user submissions
                const { data: submissions, error: subError } = await supabase
                    .from('training_submissions')
                    .select('training_id')
                    .eq('employee_id', currentUser.id);

                if (subError) throw subError;

                if (trainings) {
                    const completedIds = new Set(submissions?.map(s => s.training_id) || []);
                    const pending = trainings.filter(t => 
                        t.participants && 
                        t.participants.includes(currentUser.id) && 
                        !completedIds.has(t.id)
                    );
                    setPendingTrainings(pending);
                }
            } catch (err) {
                console.error('Error fetching pending trainings for home:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchPendingTrainings();
    }, [currentUser?.id, currentUser?.company_id]);

    if (loading || pendingTrainings.length === 0) return null;

    return (
        <Card title="🎓 Treinamentos Pendentes" className="border border-brand-primary/10">
            <div className="space-y-3">
                {pendingTrainings.map(t => (
                    <div 
                        key={t.id} 
                        onClick={() => onNavigate('training')}
                        className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 border dark:border-slate-800 cursor-pointer transition-all flex justify-between items-center group"
                    >
                        <div className="min-w-0 flex-1 pr-2">
                            <span className="text-[9px] font-bold text-brand-primary dark:text-emerald-400 uppercase tracking-widest block mb-0.5">{t.category || 'Geral'}</span>
                            <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-brand-primary transition-colors">{t.title}</h5>
                            {t.end_date && (
                                <p className="text-[10px] text-red-500 font-bold mt-1">
                                    Prazo: {new Date(t.end_date).toLocaleDateString('pt-BR')}
                                </p>
                            )}
                        </div>
                        <span className="text-[10px] shrink-0 font-bold bg-brand-primary/10 text-brand-primary dark:text-emerald-400 px-2.5 py-1 rounded-full">
                            {t.duration || '0 min'}
                        </span>
                    </div>
                ))}
            </div>
        </Card>
    );
};

const HomePage: React.FC<HomePageProps> = ({ onNavigate, employees, currentUser }) => {
    const [recentAwards, setRecentAwards] = useState<RecentBadgeAward[]>([]);

    useEffect(() => {
        const fetchRecentAwards = async () => {
            let companyId = currentUser?.company_id;
            if (!companyId && currentUser?.id) {
                try {
                    const { data } = await supabase
                        .from('profiles')
                        .select('company_id')
                        .eq('id', currentUser.id)
                        .single();
                    if (data?.company_id) {
                        companyId = data.company_id;
                    }
                } catch (err) {
                    console.error('Error fetching company_id fallback:', err);
                }
            }
            if (!companyId) return;

            try {
                const threeDaysAgo = new Date();
                threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

                const { data, error } = await supabase
                    .from('user_badges')
                    .select(`
                        id,
                        reason,
                        created_at,
                        company_badges (
                            name,
                            icon,
                            color
                        ),
                        recipient:profiles!user_id (
                            full_name,
                            avatar_url
                        ),
                        awarder:profiles!awarded_by (
                            full_name
                        )
                    `)
                    .eq('company_id', companyId)
                    .gte('created_at', threeDaysAgo.toISOString())
                    .order('created_at', { ascending: false });

                if (data) {
                    setRecentAwards(data as any[]);
                }
            } catch (err) {
                console.error('Error fetching recent awards:', err);
            }
        };

        fetchRecentAwards();

        const channel = supabase
            .channel('public:user_badges_home')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'user_badges' }, () => fetchRecentAwards())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUser?.id, currentUser?.company_id]);

    return (
        <div className="space-y-8">
            {/* Banner Master - visível para todos, editável só pelo Masteradmin/GrupoPixel */}
            <MasterBanner />

            {/* Carrossel principal da empresa */}
            <Carousel />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Column */}
                <div className="lg:col-span-2 space-y-8">
                    <Announcements onNavigate={onNavigate} />

                    {recentAwards.length > 0 && (
                        <div className="space-y-4 bg-gradient-to-r from-amber-500/5 via-rose-500/5 to-amber-500/5 dark:from-slate-800/20 dark:via-slate-900/30 dark:to-slate-800/20 p-5 rounded-3xl border border-amber-200/40 dark:border-amber-500/10 backdrop-blur-sm shadow-sm">
                            <div className="flex items-center space-x-2 px-1">
                                <span className="text-xl">🎉</span>
                                <div>
                                    <h4 className="text-sm font-black text-slate-850 dark:text-white uppercase tracking-wider">
                                        Conquistas Recentes da Empresa
                                    </h4>
                                    <p className="text-[10px] text-slate-550 dark:text-slate-400 font-bold">
                                        Destaques dos últimos 3 dias
                                    </p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-4">
                                {recentAwards.map(award => {
                                    const badge = award.company_badges;
                                    const recipient = award.recipient;
                                    const awarder = award.awarder;
                                    if (!badge || !recipient) return null;
                                    
                                    const isUrl = badge.icon.startsWith('http://') || badge.icon.startsWith('https://');
                                    
                                    return (
                                        <div 
                                            key={award.id}
                                            className="flex flex-col md:flex-row items-center gap-5 p-5 bg-white/95 dark:bg-slate-900/95 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800/80 relative overflow-hidden"
                                        >
                                            <div className="absolute top-2.5 right-2.5 bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm animate-pulse">
                                                Destaque
                                            </div>

                                            {/* Left: Badge Icon */}
                                            <div className="flex-shrink-0 relative">
                                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-amber-400/25 rounded-full blur-xl -z-10 animate-pulse"></div>
                                                <div className={`w-20 h-20 rounded-2xl ${badge.color} border flex items-center justify-center text-4xl shadow-md select-none transform hover:scale-105 hover:rotate-2 transition-all duration-305 cursor-pointer animate-float overflow-hidden`}>
                                                    {isUrl ? (
                                                        <img src={badge.icon} className="w-full h-full object-cover rounded-2xl border border-white/10" alt={badge.name} />
                                                    ) : (
                                                        badge.icon
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right: Details */}
                                            <div className="flex-1 min-w-0 text-left space-y-2">
                                                <h5 className="text-base font-black text-slate-850 dark:text-white leading-tight">
                                                    {recipient.full_name} recebeu o selo "{badge.name}"!
                                                </h5>
                                                
                                                <p className="text-xs text-slate-650 dark:text-slate-350 italic line-clamp-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100/50 dark:border-slate-750/50 font-medium">
                                                    "{award.reason}"
                                                </p>
                                                
                                                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 dark:text-slate-500">
                                                    <span>Concedido por {awarder?.full_name || 'Administrador'}</span>
                                                    <span>•</span>
                                                    <span>{new Date(award.created_at).toLocaleDateString('pt-BR')}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <RecognitionWall />
                    <CompanyHighlightsWidget onNavigate={onNavigate} currentUser={currentUser} />
                </div>
                {/* Right Sidebar */}
                <div className="space-y-8">
                    <QuickLinks onNavigate={onNavigate} currentUser={currentUser} />
                    <PendingTrainingsWidget currentUser={currentUser} onNavigate={onNavigate} />
                    <MiniCalendar onNavigate={onNavigate} currentUser={currentUser} employees={employees} />
                    <CompanyPoll />
                    <Birthdays employees={employees} />
                    <NewHires employees={employees} />
                    <UpcomingEvents onNavigate={onNavigate} />
                </div>
            </div>
        </div>
    );
};

export default HomePage;