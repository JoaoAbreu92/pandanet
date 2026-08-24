import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import type { Company, Employee, CompanyBadge, UserBadge } from '../types';
import { useNotifications } from './NotificationContext';
import { useAuth } from './AuthContext';
import Card from './Card';
import { UserAvatar } from './UserAvatar';
import { Download, Zap, Sparkles, Palette, Check } from 'lucide-react';

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

    const [activeTab, setActiveTab] = useState<'create' | 'award' | 'history' | 'gamification' | 'design_elo'>('create');
    const [companyBadges, setCompanyBadges] = useState<CompanyBadge[]>([]);
    const [history, setHistory] = useState<AwardHistoryItem[]>([]);
    
    // Create Badge Form State
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newIcon, setNewIcon] = useState('🏆');
    const [newColor, setNewColor] = useState(PRESET_GRADIENTS[0].class);
    const [newXP, setNewXP] = useState<number>(15);
    const [isUploadingIcon, setIsUploadingIcon] = useState(false);
    const [editingBadgeId, setEditingBadgeId] = useState<string | null>(null);
    
    // Award Badge Form State
    const [targetUserId, setTargetUserId] = useState('');
    const [selectedBadgeId, setSelectedBadgeId] = useState('');
    const [awardReason, setAwardReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchEmployeeQuery, setSearchEmployeeQuery] = useState('');

    // Gamification config states
    const [companyLevels, setCompanyLevels] = useState<any[]>([]);
    const [isSavingLevels, setIsSavingLevels] = useState(false);
    const [uploadingLevelNum, setUploadingLevelNum] = useState<number | null>(null);

    const [userProfiles, setUserProfiles] = useState<any[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const levelRingInputRef = useRef<HTMLInputElement>(null);

    const fetchCompanyLevels = async () => {
        if (!company?.id) return;
        const { data, error } = await supabase
            .from('company_levels')
            .select('*')
            .eq('company_id', company.id)
            .order('level_number', { ascending: true });
        if (data && data.length > 0) {
            setCompanyLevels(data);
            localStorage.setItem('pixel_company_levels', JSON.stringify(data));
        }
    };

    const getLevelForXP = (xp: number, levels: any[]) => {
        if (!levels || levels.length === 0) return 1;
        let currentLvl = 1;
        const sorted = [...levels].sort((a, b) => a.level_number - b.level_number);
        for (let i = 0; i < sorted.length; i++) {
            if (xp >= sorted[i].required_xp) {
                currentLvl = sorted[i].level_number;
            }
        }
        return currentLvl;
    };

    const recalculateAllUsersXPAndLevels = async () => {
        try {
            // 1. Obter todos os badges da empresa para mapear seus XPs atualizados
            const { data: badgesData } = await supabase
                .from('company_badges')
                .select('id, xp')
                .eq('company_id', company.id);

            if (!badgesData) return;
            const badgeXpMap = new Map<string, number>();
            badgesData.forEach(b => {
                badgeXpMap.set(b.id, b.xp || 0);
            });

            // 2. Obter todas as concessões de selo (user_badges) da empresa
            const { data: userBadgesData } = await supabase
                .from('user_badges')
                .select('user_id, badge_id')
                .eq('company_id', company.id);

            // 3. Obter todos os profiles da empresa
            const { data: profilesData } = await supabase
                .from('profiles')
                .select('id, xp, level')
                .eq('company_id', company.id);

            if (!profilesData) return;

            // 4. Obter as company_levels ordenadas
            const { data: levelsData } = await supabase
                .from('company_levels')
                .select('*')
                .eq('company_id', company.id)
                .order('level_number', { ascending: true });

            const levels = levelsData || [];

            // Mapear XP acumulado para cada usuário
            const userXpMap = new Map<string, number>();
            // Inicializar todos os usuários da empresa com 0 XP
            profilesData.forEach(p => {
                userXpMap.set(p.id, 0);
            });

            // Somar o XP dos selos concedidos
            if (userBadgesData) {
                userBadgesData.forEach(ub => {
                    const badgeXp = badgeXpMap.get(ub.badge_id) || 0;
                    const currentXp = userXpMap.get(ub.user_id) || 0;
                    userXpMap.set(ub.user_id, currentXp + badgeXp);
                });
            }

            // 5. Atualizar cada usuário no banco se houver discrepância de XP ou Nível
            const updates = [];
            for (const p of profilesData) {
                const calculatedXp = userXpMap.get(p.id) || 0;
                const calculatedLevel = getLevelForXP(calculatedXp, levels);

                if (p.xp !== calculatedXp || p.level !== calculatedLevel) {
                    updates.push(
                        supabase
                            .from('profiles')
                            .update({ xp: calculatedXp, level: calculatedLevel })
                            .eq('id', p.id)
                    );
                }
            }

            if (updates.length > 0) {
                await Promise.all(updates);
            }

            // Atualizar os perfis da tela
            await fetchUserProfiles();
        } catch (err) {
            console.error("Erro ao recalcular XP de usuários:", err);
        }
    };

    const triggerRingUpload = (levelNum: number) => {
        setUploadingLevelNum(levelNum);
        levelRingInputRef.current?.click();
    };

    const handleLevelRingUpload = async (e: React.ChangeEvent<HTMLInputElement>, levelNumber: number) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `ring-lvl-${levelNumber}-${Date.now()}.${fileExt}`;
            const filePath = `${company.id}/levels/${fileName}`;
            
            const { error: uploadError } = await supabase.storage
                .from('feed-media')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('feed-media')
                .getPublicUrl(filePath);

            if (publicUrl) {
                setCompanyLevels(prev => prev.map(lvl => 
                    lvl.level_number === levelNumber ? { ...lvl, ring_image_url: publicUrl } : lvl
                ));
                alert(`Upload do anel do nível ${levelNumber} concluído! Lembre-se de salvar as alterações para persistir.`);
            }
        } catch (error: any) {
            console.error('Error uploading level ring:', error);
            alert('Erro ao fazer upload do anel do elo: ' + error.message);
        }
    };

    const handleSaveLevels = async () => {
        setIsSavingLevels(true);
        try {
            const sortedLevels = [...companyLevels].sort((a, b) => a.level_number - b.level_number);
            
            if (sortedLevels.length > 0) {
                sortedLevels[0].required_xp = 0; // O nível 1 sempre é 0 XP
            }

            for (let i = 1; i < sortedLevels.length; i++) {
                if (Number(sortedLevels[i].required_xp) <= Number(sortedLevels[i-1].required_xp)) {
                    alert(`Erro: O XP do Nível ${sortedLevels[i].level_number} (${sortedLevels[i].required_xp} XP) deve ser maior que o do Nível ${sortedLevels[i-1].level_number} (${sortedLevels[i-1].required_xp} XP).`);
                    setIsSavingLevels(false);
                    return;
                }
            }

            const { error } = await supabase
                .from('company_levels')
                .upsert(sortedLevels.map(lvl => ({
                    id: lvl.id,
                    company_id: company.id,
                    level_number: lvl.level_number,
                    name: lvl.name,
                    required_xp: Number(lvl.required_xp),
                    ring_image_url: lvl.ring_image_url
                })));

            if (error) throw error;

            alert('Configurações de níveis salvas com sucesso!');
            await fetchCompanyLevels();
            await recalculateAllUsersXPAndLevels();
        } catch (e: any) {
            console.error('Erro ao salvar níveis:', e);
            alert('Erro ao salvar níveis: ' + e.message);
        } finally {
            setIsSavingLevels(false);
        }
    };

    const handleAddNewLevel = () => {
        const nextLevelNumber = companyLevels.length > 0 
            ? Math.max(...companyLevels.map(l => l.level_number)) + 1 
            : 1;
        const lastXP = companyLevels.length > 0
            ? Math.max(...companyLevels.map(l => l.required_xp))
            : 0;

        const newLevel = {
            company_id: company.id,
            level_number: nextLevelNumber,
            name: `Elo Nível ${nextLevelNumber}`,
            required_xp: lastXP + 500,
            ring_image_url: null
        };

        setCompanyLevels(prev => [...prev, newLevel]);
    };

    const handleRemoveLastLevel = async () => {
        if (companyLevels.length <= 1) {
            alert('Você deve manter pelo menos o Nível 1.');
            return;
        }
        const maxLvl = Math.max(...companyLevels.map(l => l.level_number));
        if (!confirm(`Deseja realmente remover o Nível ${maxLvl}? Colaboradores com este nível serão reajustados para o nível inferior.`)) return;

        const target = companyLevels.find(l => l.level_number === maxLvl);
        if (target && target.id) {
            try {
                const { error } = await supabase
                    .from('company_levels')
                    .delete()
                    .eq('id', target.id);

                if (error) throw error;

                await fetchCompanyLevels();
                await recalculateAllUsersXPAndLevels();
                alert(`Nível ${maxLvl} removido com sucesso.`);
            } catch (err: any) {
                console.error("Erro ao deletar nível:", err);
                alert("Erro ao remover nível: " + err.message);
            }
        } else {
            setCompanyLevels(prev => prev.filter(l => l.level_number !== maxLvl));
        }
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
        fetchCompanyLevels();
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

    const handleEditBadge = (badge: CompanyBadge) => {
        setEditingBadgeId(badge.id);
        setNewName(badge.name);
        setNewDescription(badge.description || '');
        setNewIcon(badge.icon);
        setNewColor(badge.color);
        setNewXP(badge.xp || 15);
        setActiveTab('create');
    };

    const handleCancelEdit = () => {
        setEditingBadgeId(null);
        setNewName('');
        setNewDescription('');
        setNewIcon('🏆');
        setNewColor(PRESET_GRADIENTS[0].class);
        setNewXP(15);
    };

    const handleCreateBadge = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim() || !newIcon.trim() || !newColor) {
            alert('Por favor, preencha todos os campos obrigatórios.');
            return;
        }

        try {
            const badgePayload = {
                company_id: company.id,
                name: newName,
                description: newDescription,
                icon: newIcon,
                color: newColor,
                xp: newXP
            };

            if (editingBadgeId) {
                const { error } = await supabase
                    .from('company_badges')
                    .update(badgePayload)
                    .eq('id', editingBadgeId);

                if (error) throw error;
                alert('Selo atualizado com sucesso!');
                setEditingBadgeId(null);
            } else {
                const { error } = await supabase
                    .from('company_badges')
                    .insert(badgePayload);

                if (error) throw error;
                alert('Selo criado com sucesso!');
            }

            setNewName('');
            setNewDescription('');
            setNewIcon('🏆');
            setNewXP(15);
            setNewColor(PRESET_GRADIENTS[0].class);
            
            // Recalcular XP e nível retroativamente após criar ou editar selo
            await recalculateAllUsersXPAndLevels();
            fetchCompanyBadges();
            fetchAwardHistory();
        } catch (error: any) {
            console.error('Error saving badge:', error);
            alert('Erro ao salvar selo: ' + error.message);
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
            // Recalcular XP e nível retroativamente após deletar selo
            await recalculateAllUsersXPAndLevels();
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
            
            const newLevelValue = getLevelForXP(newXPValue, companyLevels);

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

            // Recalcular XP e nível globalmente/retroativamente
            await recalculateAllUsersXPAndLevels();

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
                    message: `Subiu para o Nível ${newLevelValue}! Parabéns pela jornada de evolução! 🛡️⚔️`
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
            const { error } = await supabase
                .from('user_badges')
                .delete()
                .eq('id', userBadgeId);

            if (error) throw error;

            // Executar recálculo retroativo de XP e nível após revogar
            await recalculateAllUsersXPAndLevels();

            alert('Concessão revogada com sucesso.');
            fetchAwardHistory();
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
                        ⚙️ Elos, RPG & Metas
                    </button>
                    <button
                        onClick={() => setActiveTab('design_elo')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'design_elo' ? 'bg-white dark:bg-slate-600 shadow-sm text-brand-primary' : 'text-slate-500 hover:text-slate-700 dark:text-gray-400'}`}
                    >
                        🎨 Criar Design do Elo
                    </button>
                </div>
            </div>

            {activeTab === 'create' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1">
                        <Card title={editingBadgeId ? "Editar Selo" : "Criar Novo Selo"} className="bg-white dark:bg-slate-800 shadow-sm">
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

                                <div className="pt-2 space-y-2">
                                    <button
                                        type="submit"
                                        className="w-full py-2.5 bg-brand-primary hover:bg-emerald-600 text-white font-bold rounded-xl transition-all shadow-md active:scale-98 text-sm"
                                    >
                                        {editingBadgeId ? 'Salvar Alterações' : 'Criar Selo da Empresa'}
                                    </button>
                                    {editingBadgeId && (
                                        <button
                                            type="button"
                                            onClick={handleCancelEdit}
                                            className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-650 text-slate-700 dark:text-gray-250 font-bold rounded-xl transition-all active:scale-98 text-xs"
                                        >
                                            Cancelar Edição
                                        </button>
                                    )}
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
                                            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                                                <button
                                                    onClick={() => handleEditBadge(badge)}
                                                    className="text-xs font-bold text-slate-500 hover:text-brand-primary px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteBadge(badge.id)}
                                                    className="text-xs font-bold text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                >
                                                    Excluir
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
                        <Card title="Metas de XP e Anéis dos Elos" className="bg-white dark:bg-slate-800 shadow-sm">
                            <div className="space-y-4 mt-2">
                                <div className="bg-emerald-50 dark:bg-emerald-500/10 p-3.5 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 text-xs text-slate-650 dark:text-slate-350 leading-relaxed font-semibold">
                                    O XP acumulado é cumulativo. Personalize o nome do elo, a meta de XP requerida e faça o upload da moldura (anel) em PNG transparente para cada nível do ecossistema.
                                </div>

                                {/* Hidden input file for level ring upload */}
                                <input
                                    type="file"
                                    ref={levelRingInputRef}
                                    onChange={async (e) => {
                                        if (uploadingLevelNum !== null) {
                                            await handleLevelRingUpload(e, uploadingLevelNum);
                                            setUploadingLevelNum(null);
                                        }
                                        if (e.target) e.target.value = '';
                                    }}
                                    accept="image/*"
                                    className="hidden"
                                />

                                <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                                    {companyLevels.map(lvl => {
                                        const maxLvl = companyLevels.length > 0 
                                            ? Math.max(...companyLevels.map(l => l.level_number)) 
                                            : 10;
                                        return (
                                            <div key={lvl.level_number} className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-black text-slate-700 dark:text-gray-300">Nível {lvl.level_number}</span>
                                                    {lvl.level_number > 10 && lvl.level_number === maxLvl && (
                                                        <button 
                                                            type="button" 
                                                            onClick={handleRemoveLastLevel}
                                                            className="text-[10px] text-red-500 hover:text-red-700 font-bold"
                                                        >
                                                            Remover Nível
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Nome do Elo</label>
                                                        <input
                                                            type="text"
                                                            value={lvl.name}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                setCompanyLevels(prev => prev.map(l => 
                                                                    l.level_number === lvl.level_number ? { ...l, name: val } : l
                                                                ));
                                                            }}
                                                            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-750 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">XP Requerido</label>
                                                        <input
                                                            type="number"
                                                            value={lvl.required_xp}
                                                            disabled={lvl.level_number === 1}
                                                            onChange={e => {
                                                                const val = Number(e.target.value);
                                                                setCompanyLevels(prev => prev.map(l => 
                                                                    l.level_number === lvl.level_number ? { ...l, required_xp: val } : l
                                                                ));
                                                            }}
                                                            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-750 text-slate-800 dark:text-white disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                                                        />
                                                    </div>
                                                </div>
                                                
                                                {/* Upload/Exibição da Moldura do Elo (PNG transparente) */}
                                                <div className="flex items-center gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                                                    {lvl.ring_image_url ? (
                                                        <div className="flex items-center justify-between w-full">
                                                            <div className="flex items-center gap-2">
                                                                <img src={lvl.ring_image_url} className="w-8 h-8 object-contain bg-slate-200 dark:bg-slate-700 rounded" alt="Anel" />
                                                                <span className="text-[10px] text-slate-500 truncate max-w-[120px]">Anel customizado ativo</span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setCompanyLevels(prev => prev.map(l => 
                                                                        l.level_number === lvl.level_number ? { ...l, ring_image_url: null } : l
                                                                    ));
                                                                }}
                                                                className="text-[10px] text-red-500 hover:text-red-700 font-bold"
                                                            >
                                                                Remover
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-between w-full">
                                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">Usando gradiente CSS padrão</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => triggerRingUpload(lvl.level_number)}
                                                                className="text-[10px] text-brand-primary hover:text-emerald-600 font-bold"
                                                            >
                                                                + Enviar Anel PNG
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="pt-3 space-y-2 border-t border-slate-100 dark:border-slate-800">
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={handleAddNewLevel}
                                            className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-650 text-slate-750 dark:text-gray-250 font-bold rounded-xl transition-all text-xs border border-slate-200 dark:border-slate-650"
                                        >
                                            + Adicionar Novo Elo
                                        </button>
                                        {companyLevels.length > 10 && (
                                            <button
                                                type="button"
                                                onClick={handleRemoveLastLevel}
                                                className="py-2 px-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-650 dark:text-red-400 font-bold rounded-xl transition-all text-xs"
                                            >
                                                Excluir Último
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleSaveLevels}
                                        disabled={isSavingLevels}
                                        className="w-full py-2.5 bg-brand-primary hover:bg-emerald-600 text-white font-bold rounded-xl transition-all shadow-md active:scale-98 disabled:opacity-50 text-xs flex items-center justify-center gap-1.5"
                                    >
                                        {isSavingLevels ? 'Salvando...' : '💾 Salvar Alterações dos Elos'}
                                    </button>
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
                                    
                                    // Determinar limites de XP para a barra de progresso usando companyLevels
                                    const maxLevel = companyLevels.length > 0 
                                        ? Math.max(...companyLevels.map(l => l.level_number)) 
                                        : 10;
                                    
                                    const currentLvlConfig = companyLevels.find(l => l.level_number === level);
                                    const nextLvlConfig = companyLevels.find(l => l.level_number === level + 1);
                                    const prevLvlConfig = companyLevels.find(l => l.level_number === level - 1);

                                    const prevThreshold = level === 1 ? 0 : (prevLvlConfig?.required_xp || 0);
                                    const nextThreshold = level >= maxLevel ? (currentLvlConfig?.required_xp || 0) : (nextLvlConfig?.required_xp || 100);

                                    const progressVal = level >= maxLevel 
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
                                                        {currentLvlConfig?.name || `Nível ${level}`}
                                                    </span>
                                                </div>
                                                
                                                {/* XP Progress Bar */}
                                                <div className="relative w-full bg-slate-200 dark:bg-slate-750 h-2.5 rounded-full overflow-hidden border dark:border-slate-700">
                                                    <div 
                                                        className={`h-full transition-all duration-500 bg-gradient-to-r ${
                                                            level >= maxLevel 
                                                                ? 'from-pink-500 via-purple-500 to-cyan-400 animate-pulse' 
                                                                : 'from-emerald-400 to-brand-primary'
                                                        }`}
                                                        style={{ width: `${Math.max(3, Math.min(100, progressVal))}%` }}
                                                    ></div>
                                                </div>

                                                <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-1">
                                                    <span>{xp} XP Acumulado</span>
                                                    <span>
                                                        {level >= maxLevel ? 'Nível Máximo Atingido! 🎉' : `${nextThreshold} XP para subir`}
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

            {activeTab === 'design_elo' && (
                <EloDesignGenerator 
                    company={company} 
                    companyLevels={companyLevels} 
                    fetchCompanyLevels={fetchCompanyLevels} 
                    recalculateAllUsersXPAndLevels={recalculateAllUsersXPAndLevels}
                    profile={profile}
                />
            )}
        </div>
    );
};

interface EloDesignGeneratorProps {
    company: Company;
    companyLevels: any[];
    fetchCompanyLevels: () => Promise<void>;
    recalculateAllUsersXPAndLevels: () => Promise<void>;
    profile: any;
}

export const EloDesignGenerator: React.FC<EloDesignGeneratorProps> = ({
    company,
    companyLevels,
    fetchCompanyLevels,
    recalculateAllUsersXPAndLevels,
    profile
}) => {
    const [selectedLevel, setSelectedLevel] = useState<number>(2);
    const [color1, setColor1] = useState('#b45309');
    const [color2, setColor2] = useState('#f59e0b');
    const [color3, setColor3] = useState('#78350f');
    const [glowColor, setGlowColor] = useState('#fbbf24');
    const [glowBlur, setGlowBlur] = useState<number>(15);
    const [borderColor, setBorderColor] = useState('#fef08a');
    const [borderWidth, setBorderWidth] = useState<number>(3);
    const [innerBorderColor, setInnerBorderColor] = useState('#b45309');
    const [innerBorderWidth, setInnerBorderWidth] = useState<number>(1);
    const [starsCount, setStarsCount] = useState<number>(3);
    const [ringThickness, setRingThickness] = useState<number>(35);
    const [segmentedStyle, setSegmentedStyle] = useState<'clean' | 'segmented' | 'neon' | 'sparkle'>('sparkle');
    const [showBadgeFrame, setShowBadgeFrame] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [previewUrl, setPreviewUrl] = useState<string>('');

    const [levelName, setLevelName] = useState<string>('');
    const [levelXP, setLevelXP] = useState<number>(0);

    const currentConfig = companyLevels.find(l => l.level_number === selectedLevel);

    useEffect(() => {
        if (currentConfig) {
            setLevelName(currentConfig.name || '');
            setLevelXP(currentConfig.required_xp || 0);
        }
    }, [selectedLevel, companyLevels]);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    const PRESETS = [
        { name: 'Bronze 🟫', color1: '#8a4f32', color2: '#c98a6b', color3: '#5c301c', glowColor: '#c98a6b', glowBlur: 10, borderColor: '#d7a187', borderWidth: 2, innerBorderColor: '#5c301c', innerBorderWidth: 1, starsCount: 1, ringThickness: 30, segmentedStyle: 'clean', showBadgeFrame: true },
        { name: 'Prata ⬜', color1: '#7e8590', color2: '#cbd5e1', color3: '#475569', glowColor: '#cbd5e1', glowBlur: 12, borderColor: '#ffffff', borderWidth: 2, innerBorderColor: '#475569', innerBorderWidth: 1, starsCount: 2, ringThickness: 30, segmentedStyle: 'clean', showBadgeFrame: true },
        { name: 'Ouro 🟨', color1: '#b45309', color2: '#f59e0b', color3: '#78350f', glowColor: '#fbbf24', glowBlur: 15, borderColor: '#fef08a', borderWidth: 3, innerBorderColor: '#78350f', innerBorderWidth: 1.5, starsCount: 3, ringThickness: 35, segmentedStyle: 'sparkle', showBadgeFrame: true },
        { name: 'Platina 💎', color1: '#0891b2', color2: '#38bdf8', color3: '#1e3a8a', glowColor: '#06b6d4', glowBlur: 16, borderColor: '#e0f2fe', borderWidth: 3, innerBorderColor: '#1e3a8a', innerBorderWidth: 1.5, starsCount: 4, ringThickness: 35, segmentedStyle: 'segmented', showBadgeFrame: true },
        { name: 'Esmeralda 🟩', color1: '#047857', color2: '#34d399', color3: '#064e3b', glowColor: '#10b981', glowBlur: 16, borderColor: '#a7f3d0', borderWidth: 3, innerBorderColor: '#064e3b', innerBorderWidth: 1.5, starsCount: 5, ringThickness: 38, segmentedStyle: 'segmented', showBadgeFrame: true },
        { name: 'Safira 🟦', color1: '#1d4ed8', color2: '#60a5fa', color3: '#1e3a8a', glowColor: '#3b82f6', glowBlur: 18, borderColor: '#bfdbfe', borderWidth: 3, innerBorderColor: '#1e3a8a', innerBorderWidth: 1.5, starsCount: 5, ringThickness: 38, segmentedStyle: 'segmented', showBadgeFrame: true },
        { name: 'Rubi 🟥', color1: '#b91c1c', color2: '#f87171', color3: '#7f1d1d', glowColor: '#ef4444', glowBlur: 20, borderColor: '#fca5a5', borderWidth: 3, innerBorderColor: '#7f1d1d', innerBorderWidth: 1.5, starsCount: 5, ringThickness: 40, segmentedStyle: 'segmented', showBadgeFrame: true },
        { name: 'Diamante 👑', color1: '#0284c7', color2: '#bae6fd', color3: '#a855f7', glowColor: '#38bdf8', glowBlur: 22, borderColor: '#ffffff', borderWidth: 4, innerBorderColor: '#a855f7', innerBorderWidth: 2, starsCount: 5, ringThickness: 42, segmentedStyle: 'sparkle', showBadgeFrame: true },
        { name: 'Lendário 👾', color1: '#ec4899', color2: '#8b5cf6', color3: '#06b6d4', glowColor: '#d946ef', glowBlur: 25, borderColor: '#fdf2f8', borderWidth: 4, innerBorderColor: '#0891b2', innerBorderWidth: 2, starsCount: 5, ringThickness: 45, segmentedStyle: 'neon', showBadgeFrame: true },
        { name: 'Arco-Íris 🌈', color1: '#f43f5e', color2: '#eab308', color3: '#3b82f6', glowColor: '#10b981', glowBlur: 25, borderColor: '#ffffff', borderWidth: 4, innerBorderColor: '#1e1b4b', innerBorderWidth: 2, starsCount: 5, ringThickness: 45, segmentedStyle: 'neon', showBadgeFrame: true }
    ];

    useEffect(() => {
        if (companyLevels.length > 0 && !companyLevels.find(l => l.level_number === selectedLevel)) {
            setSelectedLevel(companyLevels[0].level_number);
        }
    }, [companyLevels]);

    const applyPreset = (preset: typeof PRESETS[0]) => {
        setColor1(preset.color1);
        setColor2(preset.color2);
        setColor3(preset.color3);
        setGlowColor(preset.glowColor);
        setGlowBlur(preset.glowBlur);
        setBorderColor(preset.borderColor);
        setBorderWidth(preset.borderWidth);
        setInnerBorderColor(preset.innerBorderColor);
        setInnerBorderWidth(preset.innerBorderWidth);
        setStarsCount(preset.starsCount);
        setRingThickness(preset.ringThickness);
        setSegmentedStyle(preset.segmentedStyle as any);
        setShowBadgeFrame(preset.showBadgeFrame);
    };

    const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) => {
        let rot = (Math.PI / 2) * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fill();
    };

    const renderRing = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = 512;
        canvas.height = 512;

        ctx.clearRect(0, 0, 512, 512);

        const cx = 256;
        const cy = 256;
        const outerRadius = 220; 
        const innerRadius = outerRadius - ringThickness;

        // 1. Draw Glow Shadow using canvas shadow API
        if (glowBlur > 0) {
            ctx.save();
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = glowBlur;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            ctx.beginPath();
            ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
            ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.fillStyle = color2;
            ctx.fill();
            ctx.restore();
        }

        // 2. Draw Main Ring Donut with linear gradient
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
        ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2, true);
        ctx.closePath();

        const grad = ctx.createLinearGradient(64, 64, 448, 448);
        grad.addColorStop(0, color1);
        grad.addColorStop(0.5, color2);
        grad.addColorStop(1, color3);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();

        // 3. Segmented Styles
        if (segmentedStyle === 'segmented') {
            ctx.save();
            ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)'; 
            ctx.lineWidth = 5;
            const numSegments = 8;
            for (let i = 0; i < numSegments; i++) {
                const angle = (i * Math.PI * 2) / numSegments;
                const xStart = cx + innerRadius * Math.cos(angle);
                const yStart = cy + innerRadius * Math.sin(angle);
                const xEnd = cx + outerRadius * Math.cos(angle);
                const yEnd = cy + outerRadius * Math.sin(angle);
                ctx.beginPath();
                ctx.moveTo(xStart, yStart);
                ctx.lineTo(xEnd, yEnd);
                ctx.stroke();
            }
            ctx.restore();
        } else if (segmentedStyle === 'neon') {
            ctx.save();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(cx, cy, (outerRadius + innerRadius) / 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        } else if (segmentedStyle === 'sparkle') {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 4;
            const numDots = 16;
            const midRadius = (outerRadius + innerRadius) / 2;
            for (let i = 0; i < numDots; i++) {
                const angle = (i * Math.PI * 2) / numDots;
                const x = cx + midRadius * Math.cos(angle);
                const y = cy + midRadius * Math.sin(angle);
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // 4. Draw outer border
        if (borderWidth > 0) {
            ctx.save();
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = borderWidth;
            ctx.beginPath();
            ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // 5. Draw inner border
        if (innerBorderWidth > 0) {
            ctx.save();
            ctx.strokeStyle = innerBorderColor;
            ctx.lineWidth = innerBorderWidth;
            ctx.beginPath();
            ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // 6. Draw Stars at the top
        if (starsCount > 0) {
            ctx.save();
            ctx.fillStyle = borderColor || '#ffffff';
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 10;
            const starRadius = 40;
            const startAngle = -Math.PI / 2 - (starsCount - 1) * 0.22;
            for (let i = 0; i < starsCount; i++) {
                const angle = startAngle + i * 0.44;
                const dist = outerRadius + 38;
                const sx = cx + dist * Math.cos(angle);
                const sy = cy + dist * Math.sin(angle);
                drawStar(ctx, sx, sy, 5, starRadius, starRadius / 2);
            }
            ctx.restore();
        }

        // 7. Draw Level Badge Frame at the bottom right
        if (showBadgeFrame) {
            const bx = 458;
            const by = 458;
            const br = 48; 

            ctx.save();
            ctx.beginPath();
            ctx.arc(bx, by, br, 0, Math.PI * 2);
            ctx.fillStyle = '#0f172a'; 
            ctx.fill();

            const badgeGrad = ctx.createLinearGradient(bx - br, by - br, bx + br, by + br);
            badgeGrad.addColorStop(0, color2);
            badgeGrad.addColorStop(1, color3);
            ctx.strokeStyle = badgeGrad;
            ctx.lineWidth = 6;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(bx, by, br + 3, 0, Math.PI * 2);
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.restore();
        }

        setPreviewUrl(canvas.toDataURL());
    };

    useEffect(() => {
        renderRing();
    }, [
        color1, color2, color3, glowColor, glowBlur, borderColor, borderWidth,
        innerBorderColor, innerBorderWidth, starsCount, ringThickness,
        segmentedStyle, showBadgeFrame
    ]);

    const handleDownload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = `anel_elo_nivel_${selectedLevel}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    const handleApplyRing = async () => {
        const canvas = canvasRef.current;
        if (!canvas || !company?.id) return;

        setIsSaving(true);
        try {
            const targetConfig = companyLevels.find(l => l.level_number === selectedLevel);
            if (!targetConfig) {
                alert(`Por favor, crie o Nível ${selectedLevel} na aba "Elos, RPG & Metas" primeiro antes de aplicar o design.`);
                setIsSaving(false);
                return;
            }

            // Validação de XP
            if (selectedLevel === 1 && Number(levelXP) !== 0) {
                alert("O Nível 1 deve requerer 0 XP.");
                setIsSaving(false);
                return;
            }

            const sortedLevels = [...companyLevels].sort((a, b) => a.level_number - b.level_number);
            const targetIndex = sortedLevels.findIndex(l => l.level_number === selectedLevel);
            if (targetIndex > 0) {
                const prevLevel = sortedLevels[targetIndex - 1];
                if (Number(levelXP) <= Number(prevLevel.required_xp)) {
                    alert(`Erro: O XP do Nível ${selectedLevel} (${levelXP} XP) deve ser maior que o do Nível ${prevLevel.level_number} (${prevLevel.required_xp} XP).`);
                    setIsSaving(false);
                    return;
                }
            }
            const nextLevel = sortedLevels[targetIndex + 1];
            if (nextLevel && Number(levelXP) >= Number(nextLevel.required_xp)) {
                alert(`Erro: O XP do Nível ${selectedLevel} (${levelXP} XP) deve ser menor que o do Nível ${nextLevel.level_number} (${nextLevel.required_xp} XP).`);
                setIsSaving(false);
                return;
            }

            if (!levelName.trim()) {
                alert("O nome do Elo não pode ficar vazio.");
                setIsSaving(false);
                return;
            }

            const blob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob((b) => resolve(b), 'image/png');
            });

            if (!blob) throw new Error("Erro ao gerar blob da imagem");

            const fileName = `ring-lvl-${selectedLevel}-${Date.now()}.png`;
            const filePath = `${company.id}/levels/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('feed-media')
                .upload(filePath, blob, {
                    contentType: 'image/png',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('feed-media')
                .getPublicUrl(filePath);

            if (!publicUrl) throw new Error("Erro ao obter URL pública da imagem");

            const { error: dbError } = await supabase
                .from('company_levels')
                .update({ 
                    ring_image_url: publicUrl,
                    name: levelName,
                    required_xp: Number(levelXP)
                })
                .eq('id', targetConfig.id);

            if (dbError) throw dbError;

            alert(`Design do anel e configurações salvos com sucesso para o Nível ${selectedLevel}!`);
            await fetchCompanyLevels();
            await recalculateAllUsersXPAndLevels();
        } catch (err: any) {
            console.error("Erro ao aplicar design do anel:", err);
            alert("Erro ao aplicar design: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-2 animate-in fade-in duration-200">
            <div className="lg:col-span-7 space-y-6">
                <Card title="Customização do Anel do Elo" className="bg-white dark:bg-slate-800 shadow-sm">
                    <div className="space-y-5 mt-2">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Nível do Elo de Destino</label>
                            <select
                                value={selectedLevel}
                                onChange={(e) => setSelectedLevel(Number(e.target.value))}
                                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-750 text-slate-800 dark:text-white font-semibold cursor-pointer"
                            >
                                {companyLevels.map(lvl => (
                                    <option key={lvl.level_number} value={lvl.level_number}>
                                        Nível {lvl.level_number} - {lvl.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-750 dark:text-slate-300 mb-1">Nome do Elo</label>
                                <input
                                    type="text"
                                    value={levelName}
                                    onChange={(e) => setLevelName(e.target.value)}
                                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-750 text-slate-850 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-750 dark:text-slate-300 mb-1">XP Requerido</label>
                                <input
                                    type="number"
                                    value={levelXP}
                                    disabled={selectedLevel === 1}
                                    onChange={(e) => setLevelXP(Number(e.target.value))}
                                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-750 text-slate-850 dark:text-white disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Modelos Rápidos (Presets)</label>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                {PRESETS.map((preset, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => applyPreset(preset)}
                                        className="py-2 px-1 text-[11px] font-bold bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-750 hover:border-brand-primary rounded-xl text-slate-700 dark:text-gray-300 transition-all text-center"
                                    >
                                        {preset.name.replace(/ \p{Emoji}/u, '')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <hr className="border-slate-100 dark:border-slate-700" />

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-750 dark:text-slate-300 mb-1">Cor Inicial</label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="color"
                                        value={color1}
                                        onChange={(e) => setColor1(e.target.value)}
                                        className="w-10 h-10 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer bg-transparent"
                                    />
                                    <input
                                        type="text"
                                        value={color1}
                                        onChange={(e) => setColor1(e.target.value)}
                                        className="flex-1 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-750 text-slate-800 dark:text-white"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-750 dark:text-slate-300 mb-1">Cor Central</label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="color"
                                        value={color2}
                                        onChange={(e) => setColor2(e.target.value)}
                                        className="w-10 h-10 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer bg-transparent"
                                    />
                                    <input
                                        type="text"
                                        value={color2}
                                        onChange={(e) => setColor2(e.target.value)}
                                        className="flex-1 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-750 text-slate-800 dark:text-white"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-750 dark:text-slate-300 mb-1">Cor Final</label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="color"
                                        value={color3}
                                        onChange={(e) => setColor3(e.target.value)}
                                        className="w-10 h-10 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer bg-transparent"
                                    />
                                    <input
                                        type="text"
                                        value={color3}
                                        onChange={(e) => setColor3(e.target.value)}
                                        className="flex-1 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-750 text-slate-800 dark:text-white"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-750 dark:text-slate-300 mb-1">Espessura do Anel ({ringThickness}px)</label>
                                <input
                                    type="range"
                                    min="15"
                                    max="55"
                                    value={ringThickness}
                                    onChange={(e) => setRingThickness(Number(e.target.value))}
                                    className="w-full h-2 bg-gray-255 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-750 dark:text-slate-300 mb-1">Brilho Externo (Glow: {glowBlur}px)</label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="range"
                                        min="0"
                                        max="35"
                                        value={glowBlur}
                                        onChange={(e) => setGlowBlur(Number(e.target.value))}
                                        className="flex-1 h-2 bg-gray-255 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                                    />
                                    <input
                                        type="color"
                                        value={glowColor}
                                        onChange={(e) => setGlowColor(e.target.value)}
                                        className="w-8 h-8 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer bg-transparent shrink-0"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-750 dark:text-slate-300 mb-1">Borda Externa ({borderWidth}px)</label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="range"
                                        min="0"
                                        max="8"
                                        value={borderWidth}
                                        onChange={(e) => setBorderWidth(Number(e.target.value))}
                                        className="flex-1 h-2 bg-gray-255 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                                    />
                                    <input
                                        type="color"
                                        value={borderColor}
                                        onChange={(e) => setBorderColor(e.target.value)}
                                        className="w-8 h-8 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer bg-transparent shrink-0"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-750 dark:text-slate-300 mb-1">Borda Interna ({innerBorderWidth}px)</label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="range"
                                        min="0"
                                        max="8"
                                        value={innerBorderWidth}
                                        onChange={(e) => setInnerBorderWidth(Number(e.target.value))}
                                        className="flex-1 h-2 bg-gray-255 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                                    />
                                    <input
                                        type="color"
                                        value={innerBorderColor}
                                        onChange={(e) => setInnerBorderColor(e.target.value)}
                                        className="w-8 h-8 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer bg-transparent shrink-0"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-750 dark:text-slate-300 mb-1">Estrelas Ornamentais ({starsCount})</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="5"
                                    value={starsCount}
                                    onChange={(e) => setStarsCount(Number(e.target.value))}
                                    className="w-full h-2 bg-gray-255 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-750 dark:text-slate-300 mb-1">Estilo do Preenchimento</label>
                                <select
                                    value={segmentedStyle}
                                    onChange={(e) => setSegmentedStyle(e.target.value as any)}
                                    className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-750 text-slate-800 dark:text-white"
                                >
                                    <option value="clean">Contínuo / Limpo</option>
                                    <option value="segmented">Segmentado (8 divisões)</option>
                                    <option value="sparkle">Com Pontos de Brilho</option>
                                    <option value="neon">Brilho Neon Interno</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-3 pt-4">
                                <input
                                    type="checkbox"
                                    id="badge_frame"
                                    checked={showBadgeFrame}
                                    onChange={(e) => setShowBadgeFrame(e.target.checked)}
                                    className="w-5 h-5 rounded-lg border-gray-300 text-brand-primary focus:ring-brand-primary"
                                />
                                <label htmlFor="badge_frame" className="text-xs font-bold text-slate-750 dark:text-slate-300 cursor-pointer">
                                    Adicionar suporte para o badge do nível
                                </label>
                            </div>
                        </div>

                        <hr className="border-slate-100 dark:border-slate-700" />

                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleDownload}
                                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-650 text-slate-800 dark:text-white font-bold rounded-xl transition-all text-xs flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-600 shadow-sm"
                            >
                                <Download className="w-4 h-4" />
                                Baixar Anel PNG
                            </button>
                            <button
                                type="button"
                                onClick={handleApplyRing}
                                disabled={isSaving}
                                className="flex-1 py-2.5 px-4 bg-brand-primary hover:bg-emerald-600 text-white font-bold rounded-xl transition-all shadow-md active:scale-98 disabled:opacity-50 text-xs flex items-center justify-center gap-2"
                            >
                                {isSaving ? 'Aplicando...' : <><Zap className="w-4 h-4" /> Aplicar Design ao Nível {selectedLevel}</>}
                            </button>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="lg:col-span-5 flex flex-col items-center justify-start space-y-6">
                <Card title="Desenho do Canvas" className="w-full bg-white dark:bg-slate-800 shadow-sm flex flex-col items-center">
                    <div className="flex flex-col items-center justify-center py-4">
                        <div className="relative border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-4 bg-slate-50 dark:bg-slate-900/30">
                            <canvas
                                ref={canvasRef}
                                className="w-64 h-64 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2220%22 height=%2220%22 viewBox=%220 0 20 20%22><rect width=%2210%22 height=%2210%22 fill=%22%23ccc%22 opacity=%220.2%22/><rect x=%2210%22 y=%2210%22 width=%2210%22 height=%2210%22 fill=%22%23ccc%22 opacity=%220.2%22/></svg>')] bg-repeat"
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-2">Dimensão real: 512x512px (PNG transparente)</p>
                    </div>
                </Card>

                <Card title="Amostra no Colaborador" className="w-full bg-white dark:bg-slate-800 shadow-sm">
                    <div className="flex flex-col items-center justify-center py-6 space-y-4">
                        <div className="scale-110">
                            {previewUrl && (
                                <UserAvatar
                                    src={profile?.avatar_url}
                                    name={profile?.full_name || 'Amostra'}
                                    level={selectedLevel}
                                    size="xl"
                                    ring_image_url={previewUrl}
                                />
                            )}
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default BadgesManager;
