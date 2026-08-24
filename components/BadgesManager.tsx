import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { Company, Employee, CompanyBadge, UserBadge } from '../types';
import { useNotifications } from './NotificationContext';
import { useAuth } from './AuthContext';
import Card from './Card';

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

    const [activeTab, setActiveTab] = useState<'create' | 'award' | 'history'>('create');
    const [companyBadges, setCompanyBadges] = useState<CompanyBadge[]>([]);
    const [history, setHistory] = useState<AwardHistoryItem[]>([]);
    
    // Create Badge Form State
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newIcon, setNewIcon] = useState('🏆');
    const [newColor, setNewColor] = useState(PRESET_GRADIENTS[0].class);
    
    // Award Badge Form State
    const [targetUserId, setTargetUserId] = useState('');
    const [selectedBadgeId, setSelectedBadgeId] = useState('');
    const [awardReason, setAwardReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchEmployeeQuery, setSearchEmployeeQuery] = useState('');

    const fetchCompanyBadges = async () => {
        if (!company?.id) return;
        const { data, error } = await supabase
            .from('company_badges')
            .select('*')
            .eq('company_id', company.id)
            .order('created_at', { ascending: false });

        if (data) setCompanyBadges(data);
    };

    const fetchAwardHistory = async () => {
        if (!company?.id) return;
        const { data, error } = await supabase
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
                    color
                )
            `)
            .eq('company_id', company.id)
            .order('created_at', { ascending: false });

        if (data) setHistory(data as any[]);
    };

    useEffect(() => {
        fetchCompanyBadges();
        fetchAwardHistory();
    }, [company?.id]);

    const handleCreateBadge = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim() || !newIcon.trim() || !newColor) {
            alert('Por favor, preencha todos os campos obrigatórios.');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('company_badges')
                .insert({
                    company_id: company.id,
                    name: newName,
                    description: newDescription,
                    icon: newIcon,
                    color: newColor
                })
                .select();

            if (error) throw error;

            alert('Selo criado com sucesso!');
            setNewName('');
            setNewDescription('');
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

            // 1. Insert user badge
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

            // 2. Insert public post inside feed
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

            const { error: postError } = await supabase
                .from('posts')
                .insert({
                    author_id: profile?.id || targetUserId,
                    company_id: company.id,
                    content: `[BADGE_AWARD]${JSON.stringify(awardPayload)}`,
                    media_url: null,
                    media_type: null,
                    mentions: [recipient.id]
                });

            if (postError) console.error('Erro ao postar premiação no feed:', postError);

            // 3. Send system notification
            await addNotification({
                user_id: recipient.id,
                company_id: company.id,
                type: 'system',
                title: 'Você recebeu um Selo! 🏆',
                description: `${profile?.name || 'Um administrador'} concedeu o selo "${badge.name}" a você.`,
                avatarUrl: recipient.avatarUrl,
                link: '/'
            });

            alert(`Selo "${badge.name}" concedido com sucesso para ${recipient.name}!`);
            setTargetUserId('');
            setSelectedBadgeId('');
            setAwardReason('');
            setSearchEmployeeQuery('');
            fetchAwardHistory();
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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Gerenciador de Gamificação</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Crie selos de qualidade e premie colaboradores de destaque</p>
                </div>
                <div className="flex space-x-2 bg-gray-100 dark:bg-slate-700/50 p-1.5 rounded-xl">
                    <button
                        onClick={() => setActiveTab('create')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'create' ? 'bg-white dark:bg-slate-600 shadow-sm text-brand-primary' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Criar Selos
                    </button>
                    <button
                        onClick={() => setActiveTab('award')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'award' ? 'bg-white dark:bg-slate-600 shadow-sm text-brand-primary' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Conceder Selo
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'history' ? 'bg-white dark:bg-slate-600 shadow-sm text-brand-primary' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Histórico
                    </button>
                </div>
            </div>

            {activeTab === 'create' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1">
                        <Card title="Criar Novo Selo" className="bg-white dark:bg-slate-800 shadow-sm">
                            <form onSubmit={handleCreateBadge} className="space-y-4 mt-2">
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
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Ícone (Emoji) *</label>
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
                                    </div>
                                    <input
                                        type="text"
                                        value={newIcon}
                                        onChange={e => setNewIcon(e.target.value)}
                                        maxLength={4}
                                        placeholder="Emoji customizado"
                                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-750 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                    />
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
                                                <span className={`w-6 h-6 rounded-lg ${grad.class} flex items-center justify-center font-bold text-xs`}>
                                                    {newIcon}
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
                                                <div className={`w-14 h-14 rounded-2xl ${badge.color} border flex items-center justify-center text-3xl shadow-md shrink-0 select-none transform group-hover:scale-110 transition-transform duration-300`}>
                                                    {badge.icon}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-slate-800 dark:text-white text-base truncate">{badge.name}</h4>
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
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Selecionar Selo *</label>
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
                                                <div className={`w-10 h-10 rounded-xl ${badge.color} border flex items-center justify-center text-xl shadow shrink-0 select-none`}>
                                                    {badge.icon}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{badge.name}</p>
                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{badge.description || 'Sem descrição.'}</p>
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
                                                        <span className={`w-7 h-7 rounded-lg ${badge.color} border flex items-center justify-center text-sm shadow-sm select-none`}>
                                                            {badge.icon}
                                                        </span>
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
        </div>
    );
};

export default BadgesManager;
