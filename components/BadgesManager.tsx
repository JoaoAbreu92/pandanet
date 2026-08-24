import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import type { Company, Employee, CompanyBadge, UserBadge } from '../types';
import { useNotifications } from './NotificationContext';
import { useAuth } from './AuthContext';
import Card from './Card';
import { UserAvatar } from './UserAvatar';

interface BadgesManagerProps {
    company: Company;
    employees: Employee[];
}

interface AwardHistoryItem {
    id: string;
    user_id: string;
    badge_id: string;
    awarded_by: string;
    reason: string;
    created_at: string;
    company_badges: {
        id: string;
        name: string;
        icon: string;
        color: string;
        xp: number;
    };
}

const PRESET_GRADIENTS = [
    { name: 'Ouro 3D', class: 'bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 text-white shadow-lg shadow-amber-500/20 border-amber-300' },
    { name: 'Rubi de Elite', class: 'bg-gradient-to-br from-red-400 via-rose-500 to-red-700 text-white shadow-lg shadow-rose-500/20 border-rose-300' },
    { name: 'Safira Estelar', class: 'bg-gradient-to-br from-blue-400 via-indigo-500 to-blue-700 text-white shadow-lg shadow-indigo-500/20 border-indigo-300' },
    { name: 'Esmeralda Lendária', class: 'bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-700 text-white shadow-lg shadow-teal-500/20 border-teal-300' },
    { name: 'Ametista Mística', class: 'bg-gradient-to-br from-purple-400 via-fuchsia-500 to-indigo-700 text-white shadow-lg shadow-fuchsia-500/20 border-fuchsia-300' },
    { name: 'Arco-Íris Mestre', class: 'bg-gradient-to-br from-pink-500 via-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 text-white shadow-lg shadow-purple-500/20 border-white/20' },
    { name: 'Lava Vulcânica', class: 'bg-gradient-to-br from-orange-500 via-red-600 to-yellow-500 text-white shadow-lg shadow-red-500/20 border-orange-400' },
    { name: 'Prata Cromada', class: 'bg-gradient-to-br from-gray-300 via-slate-100 to-gray-500 text-white shadow-lg shadow-slate-400/20 border-slate-200' },
];

const PRESET_EMOJIS = ['🏆', '⭐', '🎯', '🚀', '💡', '💎', '❤️', '🧠', '🤝', '🦄', '🥇', '👑', '🔥', '🛡️', '⚡', '🌟', '🐼'];

export const BadgesManager: React.FC<BadgesManagerProps> = ({ company, employees }) => {
    const { profile } = useAuth();
    const { addNotification } = useNotifications();

    const [activeTab, setActiveTab] = useState<'create' | 'award' | 'history' | 'gamification'>('create');
    const [companyBadges, setCompanyBadges] = useState<CompanyBadge[]>([]);
    const [history, setHistory] = useState<AwardHistoryItem[]>([]);
    
    // Create Badge Form State
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newIcon, setNewIcon] = useState('🏆');
    const [newColor, setNewColor] = useState(PRESET_GRADIENTS[0].class);
    const [newXP, setNewXP] = useState<number>(15);
    const [isUploadingIcon, setIsUploadingIcon] = useState(false);
    
    // Award Badge Form State
    const [targetUserId, setTargetUserId] = useState('');
    const [selectedBadgeId, setSelectedBadgeId] = useState('');
    const [awardReason, setAwardReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchEmployeeQuery, setSearchEmployeeQuery] = useState('');

    // Gamification config states
    const [level2XP, setLevel2XP] = useState(100);
    const [level3XP, setLevel3XP] = useState(300);
    const [level4XP, setLevel4XP] = useState(600);
    const [level5XP, setLevel5XP] = useState(1000);

    const [userProfiles, setUserProfiles] = useState<any[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Carregar configurações de metas de XP do localStorage
    useEffect(() => {
        const saved = localStorage.getItem('pixel_gamification_thresholds');
        if (saved) {
            try {
                const [l2, l3, l4, l5] = JSON.parse(saved);
                setLevel2XP(l2 || 100);
                setLevel3XP(l3 || 300);
                setLevel4XP(l4 || 600);
                setLevel5XP(l5 || 1000);
            } catch (e) {}
        }
    }, []);

    const saveThresholds = (l2: number, l3: number, l4: number, l5: number) => {
        localStorage.setItem('pixel_gamification_thresholds', JSON.stringify([l2, l3, l4, l5]));
    };

    const getThresholds = () => {
        return [level2XP, level3XP, level4XP, level5XP];
    };

    const getLevelForXP = (xp: number, thresholds: number[]) => {
        let lvl = 1;
        for (let i = 0; i < thresholds.length; i++) {
            if (xp >= thresholds[i]) {
                lvl = i + 2;
            } else {
                break;
            }
        }
        return Math.min(lvl, 5);
    };

    const fetchCompanyBadges = async () => {
        if (!company?.id) return;
        const { data, error } = await supabase
            .from('company_badges')
            .select('*')
            .eq('company_id', company.id)
            .order('created_at', { ascending: false });

        if (data) {
            if (data.length === 0) {
                // Pre-popula selos padrão caso não existam selos criados
                const defaultBadges = [
                    { company_id: company.id, name: 'Foco no Cliente', description: 'Atendimento excepcional e foco total nas necessidades do cliente.', icon: '🎯', color: PRESET_GRADIENTS[0].class, xp: 15 },
                    { company_id: company.id, name: 'Inovação', description: 'Criação de novas soluções, automações ou ideias inovadoras.', icon: '💡', color: PRESET_GRADIENTS[2].class, xp: 20 },
                    { company_id: company.id, name: 'Trabalho em Equipe', description: 'Demonstração de forte colaboração, empatia e ajuda mútua.', icon: '🤝', color: PRESET_GRADIENTS[3].class, xp: 15 },
                    { company_id: company.id, name: 'Qualidade Excepcional', description: 'Entregas técnicas impecáveis e atenção apurada aos detalhes.', icon: '🏆', color: PRESET_GRADIENTS[1].class, xp: 10 },
                ];
                const { data: inserted } = await supabase.from('company_badges').insert(defaultBadges).select();
                if (inserted) setCompanyBadges(inserted);
            } else {
                setCompanyBadges(data);
            }
        }
    };

    const fetchAwardHistory = async () => {
        if (!company?.id) return;
        const { data } = await supabase
            .from('user_badges')
            .select(`
                id,
                user_id,
                badge_id,
                awarded_by,
                reason,
                created_at,
                company_badges (
                    id,
                    name,
                    icon,
                    color,
                    xp
                )
            `)
            .eq('company_id', company.id)
            .order('created_at', { ascending: false });

        if (data) setHistory(data as any[]);
    };

    const fetchUserProfiles = async () => {
        if (!company?.id) return;
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url, role, team, xp, level')
            .eq('company_id', company.id)
            .order('xp', { ascending: false });
        if (data) {
            setUserProfiles(data);
        }
    };

    useEffect(() => {
        fetchCompanyBadges();
        fetchAwardHistory();
        fetchUserProfiles();
    }, [company?.id]);

    const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setIsUploadingIcon(true);
        try {
            if (!profile?.id) {
                alert('Erro: Usuário não autenticado.');
                return;
            }
            const fileExt = file.name.split('.').pop();
            const fileName = `badge-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
            const filePath = `${profile.id}/company_badges/${fileName}`;
            
            const { error: uploadError } = await supabase.storage
                .from('feed-media')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('feed-media')
                .getPublicUrl(filePath);

            if (publicUrl) {
                setNewIcon(publicUrl);
            }
        } catch (error: any) {
            console.error('Error uploading badge icon:', error);
            alert('Erro ao fazer upload do selo: ' + error.message);
        } finally {
            setIsUploadingIcon(false);
        }
    };

    const handleCreateBadge = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim() || !newIcon.trim() || !newColor) {
            alert('Por favor, preencha todos os campos obrigatórios.');
            return;
        }

        try {
            const { error } = await supabase
                .from('company_badges')
                .insert({
                    company_id: company.id,
                    name: newName,
                    description: newDescription,
                    icon: newIcon,
                    color: newColor,
                    xp: newXP
                });

            if (error) throw error;

            alert('Selo criado com sucesso!');
            setNewName('');
            setNewDescription('');
            setNewIcon('🏆');
            setNewXP(15);
            fetchCompanyBadges();
        } catch (error: any) {
            console.error('Error creating badge:', error);
            alert('Erro ao criar selo: ' + error.message);
        }
    };

    const handleDeleteBadge = async (badgeId: string) => {
        if (!confirm('Deseja realmente excluir este selo? Isso removerá o selo de todos os usuários que o conquistaram.')) return;

        try {
            const { error } = await supabase
                .from('company_badges')
                .delete()
                .eq('id', badgeId);

            if (error) throw error;

            alert('Selo excluído com sucesso!');
            fetchCompanyBadges();
            fetchAwardHistory();
        } catch (error: any) {
            console.error('Error deleting badge:', error);
            alert('Erro ao excluir selo: ' + error.message);
        }
    };

    const handleAwardBadge = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetUserId || !selectedBadgeId || !awardReason.trim()) {
            alert('Por favor, preencha todos os campos.');
            return;
        }

        setIsSubmitting(true);
        try {
            const badge = companyBadges.find(b => b.id === selectedBadgeId);
            const recipient = employees.find(emp => emp.id === targetUserId);

            if (!badge || !recipient) {
                alert('Erro ao carregar dados do selo ou do colaborador.');
                return;
            }

            // 1. Obter XP e Level atuais do banco
            const { data: recipientProfile } = await supabase
                .from('profiles')
                .select('xp, level')
                .eq('id', targetUserId)
                .single();

            const currentXP = recipientProfile?.xp || 0;
            const currentLevel = recipientProfile?.level || 1;
            const badgeXP = badge.xp || 10;
            const newXPValue = currentXP + badgeXP;
            
            const thresholds = getThresholds();
            const newLevelValue = getLevelForXP(newXPValue, thresholds);

            // 2. Conceder o selo
            const { error: insertError } = await supabase
                .from('user_badges')
                .insert({
                    company_id: company.id,
                    user_id: targetUserId,
                    badge_id: selectedBadgeId,
                    awarded_by: profile?.id,
                    reason: awardReason,
                    is_equipped: true
                });

            if (insertError) throw insertError;

            // 3. Atualizar XP e Nível do usuário no banco
            await supabase
                .from('profiles')
                .update({ xp: newXPValue, level: newLevelValue })
                .eq('id', targetUserId);

            // 4. Inserir post de conquista de selo no feed
            const awardPayload = {
                type: 'badge_award',
                recipient_id: recipient.id,
                recipient_name: recipient.name,
                recipient_avatar: recipient.avatarUrl,
                badge_id: badge.id,
                badge_name: badge.name,
                badge_icon: badge.icon,
                badge_color: badge.color,
                reason: awardReason,
                awarded_by_name: profile?.name || 'Administrador'
            };

            await supabase
                .from('posts')
                .insert({
                    author_id: profile?.id || targetUserId,
                    company_id: company.id,
                    content: `[BADGE_AWARD]${JSON.stringify(awardPayload)}`,
                    media_url: null,
                    media_type: null,
                    mentions: [recipient.id]
                });

            // 5. Se subiu de nível, gerar o post de parabéns por level up
            if (newLevelValue > currentLevel) {
                const levelUpPayload = {
                    recipient_id: recipient.id,
                    recipient_name: recipient.name,
                    recipient_avatar: recipient.avatarUrl,
                    new_level: newLevelValue,
                    message: `Subiu para o Nível ${newLevelValue} no RPG PandaNet! Parabéns pela jornada de evolução! 🛡️⚔️`
                };

                await supabase
                    .from('posts')
                    .insert({
                        author_id: profile?.id || targetUserId,
                        company_id: company.id,
                        content: `[LEVEL_UP]${JSON.stringify(levelUpPayload)}`,
                        media_url: null,
                        media_type: null,
                        mentions: [recipient.id]
                    });
            }

            // 6. Enviar notificação de sistema
            await addNotification({
                user_id: recipient.id,
                company_id: company.id,
                type: 'system',
                title: 'Você recebeu um Selo! 🏆',
                description: `${profile?.name || 'Um administrador'} concedeu o selo "${badge.name}" a você (+${badgeXP} XP).`,
                avatarUrl: recipient.avatarUrl,
                link: '/'
            });

            alert(`Selo "${badge.name}" concedido com sucesso para ${recipient.name}! (+${badgeXP} XP)`);
            setTargetUserId('');
            setSelectedBadgeId('');
            setAwardReason('');
            setSearchEmployeeQuery('');
            fetchAwardHistory();
            fetchUserProfiles();
        } catch (error: any) {
            console.error('Error awarding badge:', error);
            alert('Erro ao conceder selo: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRevokeBadge = async (userBadgeId: string) => {
        if (!confirm('Deseja realmente revogar esta concessão de selo?')) return;

        try {
            // Buscando o selo e o usuário para diminuir XP correspondente
            const { data: userBadge } = await supabase
                .from('user_badges')
                .select('user_id, badge_id')
                .eq('id', userBadgeId)
                .single();

            if (userBadge) {
                const targetUser = userBadge.user_id;
                const badge = companyBadges.find(b => b.id === userBadge.badge_id);
                const badgeXP = badge?.xp || 10;

                const { data: p } = await supabase.from('profiles').select('xp, level').eq('id', targetUser).single();
                if (p) {
                    const currentXP = p.xp || 0;
                    const newXP = Math.max(0, currentXP - badgeXP);
                    const thresholds = getThresholds();
                    const newLvl = getLevelForXP(newXP, thresholds);
                    
                    await supabase.from('profiles').update({ xp: newXP, level: newLvl }).eq('id', targetUser);
                }
            }

            const { error } = await supabase
                .from('user_badges')
                .delete()
                .eq('id', userBadgeId);

            if (error) throw error;

            alert('Concessão revogada com sucesso.');
            fetchAwardHistory();
            fetchUserProfiles();
        } catch (error: any) {
            console.error('Error revoking badge:', error);
            alert('Erro ao revogar selo: ' + error.message);
        }
    };

    const filteredEmployees = employees.filter(emp =>
        emp.name.toLowerCase().includes(searchEmployeeQuery.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchEmployeeQuery.toLowerCase())
    );

    const renderBadgeIcon = (icon: string, sizeClass = 'w-14 h-14 text-3xl') => {
        const isUrl = icon.startsWith('http://') || icon.startsWith('https://');
        if (isUrl) {
            return <img src={icon} className={`${sizeClass} object-cover rounded-2xl shrink-0 border border-white/10`} alt="" />;
        }
        return icon;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Gerenciador de Gamificação (RPG)</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Crie selos de qualidade, configure metas de XP e premie colaboradores de destaque</p>
                </div>
                <div className="flex flex-wrap bg-gray-100 dark:bg-slate-700/50 p-1.5 rounded-xl gap-1 shrink-0">
                    <button
                        onClick={() => setActiveTab('create')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'create' ? 'bg-white dark:bg-slate-600 shadow-sm text-brand-primary' : 'text-slate-500 hover:text-slate-700 dark:text-gray-400'}`}
                    >
                        Criar Selos
                    </button>
                    <button
                        onClick={() => setActiveTab('award')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'award' ? 'bg-white dark:bg-slate-600 shadow-sm text-brand-primary' : 'text-slate-500 hover:text-slate-700 dark:text-gray-400'}`}
                    >
                        Conceder Selo
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'history' ? 'bg-white dark:bg-slate-600 shadow-sm text-brand-primary' : 'text-slate-500 hover:text-slate-700 dark:text-gray-400'}`}
                    >
                        Histórico
                    </button>
                    <button
                        onClick={() => setActiveTab('gamification')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'gamification' ? 'bg-white dark:bg-slate-600 shadow-sm text-brand-primary' : 'text-slate-500 hover:text-slate-700 dark:text-gray-400'}`}
                    >
                        ⚙️ RPG & Metas
                    </button>
                </div>
            </div>

            {activeTab === 'create' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1">
                        <Card title="Criar Novo Selo" className="bg-white dark:bg-slate-800 shadow-sm">
                            <form onSubmit={handleCreateBadge} className="space-y-4 mt-2">
                                {/* Interactive Preview Card */}
                                <div className="flex items-center space-x-4 mb-4 bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`w-20 h-20 rounded-2xl ${newColor} border-2 border-white/20 flex items-center justify-center text-4xl shadow-md cursor-pointer hover:scale-105 active:scale-95 transition-all select-none overflow-hidden shrink-0 group relative`}
                                        title="Clique para carregar uma imagem do computador"
                                    >
                                        {renderBadgeIcon(newIcon, 'w-full h-full text-3xl object-cover')}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold">
                                            Alterar
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-sm text-slate-800 dark:text-white truncate">{newName || 'Nome do Selo'}</h4>
                                        <p className="text-xs text-brand-primary font-bold">+{newXP} XP para o colaborador</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Nome do Selo *</label>
                                    <input
                                        type="text"
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        placeholder="Ex: Foco no Cliente"
                                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-750 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Descrição</label>
                                    <textarea
                                        value={newDescription}
                                        onChange={e => setNewDescription(e.target.value)}
                                        placeholder="Ex: Concedido a quem demonstrar atenção excepcional..."
                                        rows={3}
                                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-750 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Pontos de XP ao Conquistar *</label>
                                    <input
                                        type="number"
                                        value={newXP}
                                        onChange={e => setNewXP(Number(e.target.value))}
                                        placeholder="Ex: 15"
                                        min="1"
                                        max="500"
                                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-750 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Ícone ou Imagem do Selo *</label>
                                    <div className="flex gap-2 flex-wrap mb-2">
                                        {PRESET_EMOJIS.map(emoji => (
                                            <button
                                                key={emoji}
                                                type="button"
                                                onClick={() => setNewIcon(emoji)}
                                                className={`text-xl p-2 rounded-lg border transition-all ${newIcon === emoji ? 'bg-brand-primary/10 border-brand-primary scale-110' : 'bg-slate-50 dark:bg-slate-700/50 border-transparent hover:scale-105'}`}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                        {/* Upload inline button */}
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploadingIcon}
                                            className="text-xl p-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-650 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-600 transition-all flex items-center justify-center hover:scale-105 hover:border-brand-primary"
                                            title="Carregar imagem do computador"
                                        >
                                            {isUploadingIcon ? '⏳' : '📁'}
                                        </button>
                                    </div>

                                    {/* Hidden Input file */}
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleIconUpload}
                                        accept="image/*"
                                        className="hidden"
                                    />

                                    <div className="mt-3">
                                        <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Ícone Atual (Texto ou URL)</label>
                                        <input
                                            type="text"
                                            value={newIcon}
                                            onChange={e => setNewIcon(e.target.value)}
                                            placeholder="Emoji ou Link da imagem"
                                            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-750 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Tema / Gradiente *</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {PRESET_GRADIENTS.map(grad => (
                                            <button
                                                key={grad.name}
                                                type="button"
                                                onClick={() => setNewColor(grad.class)}
                                                className={`flex items-center space-x-2 p-2 rounded-xl border text-left transition-all ${newColor === grad.class ? 'border-brand-primary scale-[1.02]' : 'border-transparent hover:scale-98'}`}
                                            >
                                                <span className={`w-10 h-10 rounded-xl ${grad.class} flex items-center justify-center font-bold text-xs overflow-hidden`}>
                                                    {renderBadgeIcon(newIcon, 'w-8 h-8 text-lg')}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">{grad.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        className="w-full py-2.5 bg-brand-primary hover:bg-emerald-600 text-white font-bold rounded-xl transition-all shadow-md active:scale-98 text-sm"
                                    >
                                        Criar Selo da Empresa
                                    </button>
                                </div>
                            </form>
                        </Card>
                    </div>

                    <div className="lg:col-span-2">
                        <Card title="Selos Cadastrados" className="bg-white dark:bg-slate-800 shadow-sm">
                            {companyBadges.length === 0 ? (
                                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                                    Nenhum selo cadastrado ainda. Crie um no formulário ao lado!
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                    {companyBadges.map(badge => (
                                        <div
                                            key={badge.id}
                                            className="flex flex-col justify-between p-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 hover:shadow-md transition-all group"
                                        >
                                            <div className="flex items-start space-x-4">
                                                <div className={`w-14 h-14 rounded-2xl ${badge.color} border flex items-center justify-center shadow-md shrink-0 select-none overflow-hidden transform group-hover:scale-110 transition-transform duration-300`}>
                                                    {renderBadgeIcon(badge.icon)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-slate-800 dark:text-white text-base truncate">{badge.name}</h4>
                                                    <p className="text-xs text-brand-primary font-bold">+{badge.xp || 10} XP</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-3 leading-relaxed">
                                                        {badge.description || 'Sem descrição.'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex justify-end mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                                                <button
                                                    onClick={() => handleDeleteBadge(badge.id)}
                                                    className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors"
                                                >
                                                    Excluir Selo
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            )}

            {activeTab === 'award' && (
                <div className="max-w-2xl mx-auto">
                    <Card title="Conceder Selo de Qualidade" className="bg-white dark:bg-slate-800 shadow-sm">
                        <form onSubmit={handleAwardBadge} className="space-y-5 mt-2">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Selecionar Colaborador *</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Buscar por nome ou e-mail..."
                                        value={searchEmployeeQuery}
                                        onChange={e => setSearchEmployeeQuery(e.target.value)}
                                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-750 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                    />
                                    {searchEmployeeQuery && (
                                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                            {filteredEmployees.slice(0, 5).map(emp => (
                                                <button
                                                    key={emp.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setTargetUserId(emp.id);
                                                        setSearchEmployeeQuery(emp.name);
                                                    }}
                                                    className="flex items-center space-x-3 w-full p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700/50 last:border-0 transition-colors"
                                                >
                                                    <img src={emp.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-800 dark:text-white">{emp.name}</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">{emp.role} • {emp.team}</p>
                                                    </div>
                                                </button>
                                            ))}
                                            {filteredEmployees.length === 0 && (
                                                <p className="p-3 text-sm text-slate-500 text-center">Nenhum colaborador encontrado.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {targetUserId && (
                                    <div className="mt-2 flex items-center space-x-2 bg-emerald-50 dark:bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
                                        <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">✓ Selecionado:</span>
                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                            {employees.find(e => e.id === targetUserId)?.name}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Selecionar Selo *</label>
                                {companyBadges.length === 0 ? (
                                    <div className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-500/10 p-3 rounded-xl border border-amber-100 dark:border-amber-500/20">
                                        Nenhum selo criado ainda. Vá até a aba "Criar Selos" antes de prosseguir!
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {companyBadges.map(badge => (
                                            <button
                                                key={badge.id}
                                                type="button"
                                                onClick={() => setSelectedBadgeId(badge.id)}
                                                className={`flex items-center space-x-3 p-3 rounded-xl border text-left transition-all ${selectedBadgeId === badge.id ? 'border-brand-primary bg-emerald-50/20 dark:bg-slate-700/50 scale-[1.01]' : 'border-slate-100 dark:border-slate-700 hover:scale-99'}`}
                                            >
                                                <div className={`w-10 h-10 rounded-xl ${badge.color} border flex items-center justify-center shadow shrink-0 select-none overflow-hidden`}>
                                                    {renderBadgeIcon(badge.icon, 'w-8 h-8 text-lg')}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{badge.name}</p>
                                                    <p className="text-[10px] text-brand-primary font-bold">+{badge.xp || 10} XP</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Motivo do Reconhecimento (Justificativa) *</label>
                                <textarea
                                    value={awardReason}
                                    onChange={e => setAwardReason(e.target.value)}
                                    placeholder="Explique o motivo deste prêmio. Todos na empresa poderão ver essa mensagem..."
                                    rows={4}
                                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-750 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                    required
                                />
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !targetUserId || !selectedBadgeId}
                                    className="w-full py-3 bg-brand-primary hover:bg-emerald-600 text-white font-bold rounded-xl transition-all shadow-md active:scale-98 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? 'Concedendo...' : '🏆 Conceder Selo de Qualidade'}
                                </button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {activeTab === 'history' && (
                <Card title="Histórico de Selos Concedidos" className="bg-white dark:bg-slate-800 shadow-sm">
                    {history.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                            Nenhum selo foi concedido na empresa até o momento.
                        </div>
                    ) : (
                        <div className="overflow-x-auto mt-2">
                            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700/50">
                                <thead>
                                    <tr>
                                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Colaborador</th>
                                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Selo</th>
                                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Concedido por</th>
                                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Motivo</th>
                                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data</th>
                                        <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                    {history.map(item => {
                                        const recipient = employees.find(e => e.id === item.user_id);
                                        const awarder = employees.find(e => e.id === item.awarded_by);
                                        const badge = item.company_badges;

                                        if (!badge) return null;

                                        return (
                                            <tr key={item.id} className="text-xs hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="flex items-center space-x-3">
                                                        <img src={recipient?.avatarUrl} className="w-8 h-8 rounded-full object-cover" alt="" />
                                                        <span className="font-bold text-slate-850 dark:text-slate-200">{recipient?.name || 'Carregando...'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="flex items-center space-x-2">
                                                        <div className={`w-8 h-8 rounded-lg ${badge.color} border flex items-center justify-center shadow-sm select-none overflow-hidden`}>
                                                            {renderBadgeIcon(badge.icon, 'w-6 h-6 text-sm')}
                                                        </div>
                                                        <span className="font-bold text-slate-700 dark:text-slate-300">{badge.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                                                    {awarder?.name || 'Administrador'}
                                                </td>
                                                <td className="px-4 py-3 max-w-xs truncate text-slate-600 dark:text-slate-400" title={item.reason}>
                                                    {item.reason}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                                                    {new Date(item.created_at).toLocaleDateString('pt-BR')}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                                    <button
                                                        onClick={() => handleRevokeBadge(item.id)}
                                                        className="text-red-500 hover:text-red-700 font-bold"
                                                    >
                                                        Revogar
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            )}

            {activeTab === 'gamification' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* XP Goals Config Box */}
                    <div className="lg:col-span-1">
                        <Card title="Metas de XP por Nível" className="bg-white dark:bg-slate-800 shadow-sm">
                            <div className="space-y-4 mt-2">
                                <div className="bg-emerald-50 dark:bg-emerald-500/10 p-3.5 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 text-xs text-slate-650 dark:text-slate-350 leading-relaxed font-semibold">
                                    A XP acumulada é cumulativa. Configure a pontuação necessária que o usuário precisa atingir para ser promovido a cada nível de RPG.
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 uppercase mb-1">Nível 2 (Bronze)</label>
                                    <input
                                        type="number"
                                        value={level2XP}
                                        onChange={e => {
                                            const v = Number(e.target.value);
                                            setLevel2XP(v);
                                            saveThresholds(v, level3XP, level4XP, level5XP);
                                        }}
                                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-750 text-slate-800 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 uppercase mb-1">Nível 3 (Prata)</label>
                                    <input
                                        type="number"
                                        value={level3XP}
                                        onChange={e => {
                                            const v = Number(e.target.value);
                                            setLevel3XP(v);
                                            saveThresholds(level2XP, v, level4XP, level5XP);
                                        }}
                                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-750 text-slate-800 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 uppercase mb-1">Nível 4 (Ouro)</label>
                                    <input
                                        type="number"
                                        value={level4XP}
                                        onChange={e => {
                                            const v = Number(e.target.value);
                                            setLevel4XP(v);
                                            saveThresholds(level2XP, level3XP, v, level5XP);
                                        }}
                                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-750 text-slate-800 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 uppercase mb-1">Nível 5 (Lendário)</label>
                                    <input
                                        type="number"
                                        value={level5XP}
                                        onChange={e => {
                                            const v = Number(e.target.value);
                                            setLevel5XP(v);
                                            saveThresholds(level2XP, level3XP, level4XP, v);
                                        }}
                                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-750 text-slate-800 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                    />
                                </div>

                                <div className="text-[10px] text-orange-600 bg-orange-50 dark:bg-orange-500/10 p-3 rounded-xl border border-orange-100 dark:border-orange-500/20 font-bold leading-normal">
                                    🛡️ Nota do RPG: Nível 5 é o limite padrão predefinido e exibe o anel lendário neon pulsante ao redor do avatar!
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Users list with progress bars */}
                    <div className="lg:col-span-2">
                        <Card title="Classificação e Progresso de XP dos Colaboradores" className="bg-white dark:bg-slate-800 shadow-sm">
                            <div className="space-y-4 mt-2">
                                {userProfiles.map((user, idx) => {
                                    const xp = user.xp || 0;
                                    const level = user.level || 1;
                                    
                                    // Determinar limites de XP para a barra de progresso
                                    const thresholds = getThresholds();
                                    const prevThreshold = level === 1 ? 0 : thresholds[level - 2];
                                    const nextThreshold = level >= 5 ? thresholds[3] : thresholds[level - 1];
                                    
                                    const progressVal = level >= 5 
                                        ? 100 
                                        : ((xp - prevThreshold) / (nextThreshold - prevThreshold)) * 100;
                                    
                                    return (
                                        <div key={user.id} className="flex items-center space-x-4 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/60 bg-slate-50/40 dark:bg-slate-900/30 hover:bg-slate-100/30 transition-colors">
                                            <span className="font-extrabold text-slate-400 text-sm w-5 text-center shrink-0">
                                                {idx + 1}
                                            </span>
                                            
                                            <div className="shrink-0">
                                                <UserAvatar src={user.avatar_url} name={user.full_name} level={level} size="sm" />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-bold text-sm text-slate-800 dark:text-white truncate">
                                                        {user.full_name}
                                                    </span>
                                                    <span className="text-xs font-black text-brand-primary uppercase">
                                                        Nível {level}
                                                    </span>
                                                </div>
                                                
                                                {/* XP Progress Bar */}
                                                <div className="relative w-full bg-slate-200 dark:bg-slate-750 h-2.5 rounded-full overflow-hidden border dark:border-slate-700">
                                                    <div 
                                                        className={`h-full transition-all duration-500 bg-gradient-to-r ${
                                                            level >= 5 
                                                                ? 'from-pink-500 via-purple-500 to-cyan-400 animate-pulse' 
                                                                : 'from-emerald-400 to-brand-primary'
                                                        }`}
                                                        style={{ width: `${Math.max(3, Math.min(100, progressVal))}%` }}
                                                    ></div>
                                                </div>

                                                <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-1">
                                                    <span>{xp} XP Acumulado</span>
                                                    <span>
                                                        {level >= 5 ? 'Nível Máximo Atingido! 🎉' : `${nextThreshold} XP para subir`}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {userProfiles.length === 0 && (
                                    <div className="text-center py-6 text-slate-500 italic">
                                        Nenhum perfil carregado.
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BadgesManager;
