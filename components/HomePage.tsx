import React, { useState, useEffect, useRef } from 'react';
import Announcements from './Announcements';
import UpcomingEvents from './UpcomingEvents';
import Carousel from './Carousel';
import RecognitionWall from './RecognitionWall';
import CompanyPoll from './CompanyPoll';
import QuickLinks from './QuickLinks';
import { supabase } from '../supabaseClient';
import type { Employee, AppData } from '../types';
import Card from './Card';
import { GiftIcon, UserPlusIcon } from './icons';
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
            const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(path);
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
                            className="w-full object-cover"
                            style={{ minHeight: '415px', maxHeight: '515px' }}
                        />
                    ) : bannerData!.link ? (
                        <a href={bannerData!.link} target="_blank" rel="noopener noreferrer" className="block">
                            <img
                                src={bannerData!.imageUrl}
                                alt="Banner Master"
                                className="w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                                style={{ minHeight: '415px', maxHeight: '515px' }}
                            />
                            {bannerData!.buttonText && (
                                <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                                    <span className="px-8 py-3 bg-white/95 backdrop-blur text-gray-900 font-bold rounded-full shadow-2xl text-base hover:bg-white transition-all transform group-hover:scale-105">
                                        {bannerData!.buttonText}
                                    </span>
                                </div>
                            )}
                        </a>
                    ) : (
                        <img
                            src={bannerData!.imageUrl}
                            alt="Banner Master"
                            className="w-full object-cover"
                            style={{ minHeight: '415px', maxHeight: '515px' }}
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
                </div>
                {/* Right Sidebar */}
                <div className="space-y-8">
                    <QuickLinks onNavigate={onNavigate} currentUser={currentUser} />
                    <CompanyPoll />
                    <Birthdays employees={employees} />
                    <NewHires employees={employees} />
                    <UpcomingEvents />
                </div>
            </div>
        </div>
    );
};

export default HomePage;