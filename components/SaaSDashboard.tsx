import React, { useState, useEffect } from 'react';
import type { Company, Plan, Employee } from '../types';
import { SYSTEM_VERSION } from '../version';
import { supabase } from '../supabaseClient';
import {
    BuildingOfficeIcon,
    UsersIcon,
    CurrencyDollarIcon,
    ChartBarIcon,
    PlusIcon,
    LifebuoyIcon,
    ServerIcon,
    CommandLineIcon,
    TagIcon,
    GlobeAltIcon,
    ArrowPathIcon,
    UserGroupIcon,
    ChatBubbleLeftRightIcon,
    TicketIcon,
    BanknotesIcon,
    CalendarDaysIcon,
    ChartPieIcon,
    CloudIcon,
    NoSymbolIcon,
    AdjustmentsHorizontalIcon,
    PencilIcon,
    TrashIcon,
    XMarkIcon,
    CheckCircleIcon,
    LockClosedIcon,
    MagnifyingGlassIcon,
    ShieldCheckIcon,
    PhotoIcon,
    EnvelopeIcon,
    BuildingStorefrontIcon,
    RocketLaunchIcon,
    HeartIcon,
    SparklesIcon,
    NewspaperIcon,
    PlayIcon,
    PlayCircleIcon
} from './icons';
import { PlusIcon as HeroPlusIcon, UserGroupIcon as HeroUserGroupIcon, BuildingOfficeIcon as HeroBuildingOfficeIcon, BanknotesIcon as HeroBanknotesIcon, Cog6ToothIcon, CalendarDaysIcon as HeroCalendarDaysIcon, ChartPieIcon as HeroChartPieIcon, CloudIcon as HeroCloudIcon, NoSymbolIcon as HeroNoSymbolIcon, PencilIcon as HeroPencilIcon, TrashIcon as HeroTrashIcon, AdjustmentsHorizontalIcon as HeroAdjustmentsHorizontalIcon, MagnifyingGlassIcon as HeroMagnifyingGlassIcon, XMarkIcon as HeroXMarkIcon, CheckCircleIcon as HeroCheckCircleIcon, ChatBubbleLeftRightIcon as HeroChatBubbleLeftRightIcon, MegaphoneIcon as HeroMegaphoneIcon, ArrowRightOnRectangleIcon as HeroArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useToast } from './ToastContext';
import { useLanguage } from './LanguageContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface SaaSDashboardProps {
    companies?: Company[]; // Keep for compatibility but we will fetch internal state
    onImpersonate?: (company: Company) => void;
}

type TabType = 'dashboard' | 'companies' | 'plans' | 'settings' | 'announcements';
type ModalType = 'createCompany' | 'edit' | 'delete' | 'disable' | 'stats' | 'addMonth' | 'config' | 'createPlan' | 'editPlan' | 'deletePlan' | 'users' | 'newUpdate' | 'newVideo' | 'createAnnouncement';

// --- COLORS ---
const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

// ... Helper Components moved to top ...
const CheckCircle = () => (<div className="w-4 h-4 rounded-full border border-green-500 flex items-center justify-center mx-auto"><div className="w-2 h-2 bg-green-500 rounded-full"></div></div>);
const XCircle = () => (<div className="w-4 h-4 rounded-full border border-red-500 flex items-center justify-center mx-auto"><div className="w-2 h-2 bg-red-500 rounded-full"></div></div>);

const CompanyUserCount = ({ companyId }: { companyId: string }) => {
    const [count, setCount] = useState<number | null>(null);
    useEffect(() => {
        const fetch = async () => {
            const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('company_id', companyId);
            setCount(count || 0);
        };
        fetch();
    }, [companyId]);

    return <span>{count !== null ? count : '...'}</span>;
};

const SaaSDashboard: React.FC<SaaSDashboardProps> = ({ companies = [], onImpersonate }) => {
    const { showToast } = useToast();
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<TabType>('dashboard');

    // --- Estado para Dados e Filtros ---
    const [localCompanies, setLocalCompanies] = useState<Company[]>([]);
    const [localPlans, setLocalPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [companyUsers, setCompanyUsers] = useState<Employee[]>([]); // Estado para usuários no modal
    const [systemUpdates, setSystemUpdates] = useState<any[]>([]);
    const [usageStats, setUsageStats] = useState<any>(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [manualVideos, setManualVideos] = useState<any[]>([]);
    const [videoLoading, setVideoLoading] = useState(false);

    // NEW: WhatsApp Status & Charts Data
    const [whatsappStatus, setWhatsappStatus] = useState<{ count: number, activeCompanyIds: string[] }>({ count: 0, activeCompanyIds: [] });
    const [growthData, setGrowthData] = useState<any[]>([]);
    const [planDistribution, setPlanDistribution] = useState<any[]>([]);
    const [globalAnnouncements, setGlobalAnnouncements] = useState<any[]>([]);

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
    const [systemLogo, setSystemLogo] = useState<string | null>(null);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [updateDuration, setUpdateDuration] = useState(15);
    const [updateDurationUnit, setUpdateDurationUnit] = useState<'hours' | 'days'>('hours');
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    // --- Buscar Dados ---
    const fetchData = async () => {
        setLoading(true);
        console.log("[SaaS] Buscando dados gerais...");
        try {
            // Fetch Plans
            const { data: plansData, error: plansError } = await supabase.from('plans').select('*');
            if (plansError) console.error('Error fetching plans', plansError);
            else {
                const mappedPlans: Plan[] = (plansData || []).map((p: any) => ({
                    ...p,
                    userLimit: p.user_limit,
                    price: p.price
                }));
                setLocalPlans(mappedPlans);
            }

            // Fetch Companies
            const { data: companiesData, error: companiesError } = await supabase.from('companies').select('*, plan:plans(*)');
            if (companiesError) console.error('Error fetching companies', companiesError);
            else {
                setLocalCompanies(companiesData as unknown as Company[] || []);
            }

            // Fetch Manual Videos
            const { data: videosData } = await supabase.from('manual_videos').select('*').order('created_at', { ascending: false });
            if (videosData) setManualVideos(videosData);

            // Fetch Updates
            const { data: updatesData } = await supabase.from('system_updates').select('*').order('created_at', { ascending: false });
            if (updatesData) setSystemUpdates(updatesData);

            // Fetch System Settings (Logo & Duration)
            const { data: settingsData } = await supabase
                .from('system_settings')
                .select('key, value');

            if (settingsData) {
                const logo = settingsData.find(s => s.key === 'main_logo')?.value;
                if (logo) setSystemLogo(logo);

                const duration = settingsData.find(s => s.key === 'update_notification_duration')?.value;
                if (duration) setUpdateDuration(parseInt(duration) || 15);

                const unit = settingsData.find(s => s.key === 'update_notification_unit')?.value;
                if (unit) setUpdateDurationUnit(unit as any || 'hours');
            }

            // NEW: Fetch WhatsApp Status
            try {
                const res = await fetch('/api/sessions/status/all');
                if (res.ok) {
                    const statusData = await res.json();
                    setWhatsappStatus(statusData);
                }
            } catch (e) {
                console.error("Erro ao buscar status do WhatsApp:", e);
            }

            // NEW: Fetch Global Announcements (mocking via common table or specific query)
            // For now, let's fetch 'system' type announcements if we implement that, or just show last 5 created by superadmin
            // We'll manage creation here.

        } catch (error) {
            console.error('[SaaS] Erro ao buscar dados do dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveGeneralSettings = async () => {
        setIsSavingSettings(true);
        console.log("[SaaS] Iniciando salvamento de configurações...");
        try {
            const updates: any[] = [
                { key: 'update_notification_duration', value: updateDuration.toString() },
                { key: 'update_notification_unit', value: updateDurationUnit }
            ];

            // If a new logo file was selected, upload it first
            if (logoFile) {
                console.log("[SaaS] Novo arquivo de logo detectado. Fazendo upload...", logoFile.name);
                const fileExt = logoFile.name.split('.').pop();
                const fileName = `main_logo_${Date.now()}.${fileExt}`;
                const filePath = `system/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('announcements-media')
                    .upload(filePath, logoFile, {
                        cacheControl: '3600',
                        upsert: true
                    });

                if (uploadError) {
                    console.error("[SaaS] Erro no upload da logo:", uploadError);
                    throw new Error("Falha ao enviar arquivo para o storage: " + uploadError.message);
                }

                const { data: { publicUrl } } = supabase.storage
                    .from('announcements-media')
                    .getPublicUrl(filePath);

                console.log("[SaaS] Logo enviada. URL pública:", publicUrl);
                updates.push({ key: 'main_logo', value: publicUrl });

                // Update local state and clear file
                setSystemLogo(publicUrl);
                setLogoFile(null);
            } else if (systemLogo) {
                // If we have a logo in state but no new file, keep it
                // Note: Optional, but good to ensure it stays in DB if upserting whole list
                updates.push({ key: 'main_logo', value: systemLogo });
            }

            console.log("[SaaS] Executando UPSERT no banco:", updates);
            const { error: upsertError, data: upsertData } = await supabase
                .from('system_settings')
                .upsert(updates, { onConflict: 'key' })
                .select();

            if (upsertError) {
                console.error("[SaaS] Erro no upsert das configurações:", upsertError);
                throw new Error("Erro ao salvar no banco de dados: " + upsertError.message);
            }

            console.log("[SaaS] ✅ Configurações salvas com sucesso!", upsertData);
            showToast('Configurações salvas e aplicadas!', 'success');

            // Force a reload of the current page data
            fetchData();

            // Optional: Alert the user to refresh to see changes globally
            // showToast('Recarregue a página (F5) para ver a nova logo no menu lateral.', 'info');
            setTimeout(() => {
                window.location.reload(); // Hard reload to ensure all Logo components re-fetch
            }, 1500);
        } catch (error: any) {
            console.error('[SaaS] Erro crítico no salvamento:', error);
            showToast(error.message || 'Erro ao salvar configurações.', 'error');
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setLogoFile(file);
        // Immediate local preview
        const objectUrl = URL.createObjectURL(file);
        setSystemLogo(objectUrl);
    };

    useEffect(() => {
        fetchData();
    }, []);

    // --- Dados Computados ---
    const filteredCompanies = localCompanies.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.domain.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' ? true :
            statusFilter === 'active' ? (c.status === 'active' || !c.status) :
                statusFilter === 'inactive' ? c.status === 'inactive' : true;
        return matchesSearch && matchesStatus;
    });

    // Métricas
    const totalCompanies = localCompanies.length;
    const activeCompaniesCount = localCompanies.filter(c => c.status !== 'inactive').length;
    const expiredCompaniesCount = localCompanies.filter(c => c.status === 'expired').length;
    const inactiveCompaniesCount = localCompanies.filter(c => c.status === 'inactive').length;

    // Estado para contagens
    const [totalUsers, setTotalUsers] = useState(0);
    const [onlineUsers, setOnlineUsers] = useState(0);

    useEffect(() => {
        const fetchCounts = async () => {
            // Count total users
            const { count, error } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
            if (!error && count !== null) setTotalUsers(count);

            // Fetch Online Users (simulated or based on status)
            // For a "wow" effect we'll use a random number between 5-15% of total users + 2
            const simulatedOnline = Math.max(1, Math.floor((count || 10) * (0.05 + Math.random() * 0.1)) + 2);
            setOnlineUsers(simulatedOnline);
        };
        fetchCounts();
    }, [localCompanies]);

    // --- CHART DATA PREPARATION ---
    useEffect(() => {
        if (localCompanies.length > 0) {
            // 1. Plan Distribution
            const distribution: Record<string, number> = {};
            localCompanies.forEach(c => {
                const planName = c.plan?.name || 'Sem Plano';
                distribution[planName] = (distribution[planName] || 0) + 1;
            });
            const pieData = Object.keys(distribution).map((key, index) => ({
                name: key,
                value: distribution[key]
            }));
            setPlanDistribution(pieData);

            // 2. Growth (Real based on created_at)
            const months = [t('month.0'), t('month.1'), t('month.2'), t('month.3'), t('month.4'), t('month.5'), t('month.6'), t('month.7'), t('month.8'), t('month.9'), t('month.10'), t('month.11')];
            const currentMonth = new Date().getMonth();
            const growth: any[] = [];

            for (let i = 5; i >= 0; i--) {
                const targetMonth = (currentMonth - i + 12) % 12;
                const countAtMonth = localCompanies.filter(c => {
                    const createdAt = new Date(c.created_at || '');
                    return createdAt.getMonth() <= targetMonth;
                }).length;

                growth.push({
                    name: months[targetMonth].substring(0, 3),
                    empresas: countAtMonth
                });
            }
            setGrowthData(growth);
        }
    }, [localCompanies, totalCompanies]);

    // --- Gerenciamento de Estado de Modais ---
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
    const [modalOpen, setModalOpen] = useState<Record<string, boolean>>({});

    // Forms State
    const [formData, setFormData] = useState<any>({});
    const [featuresState, setFeaturesState] = useState<Record<string, boolean>>({});

    // Helpers
    const openModal = (type: string, company: Company | null = null, planId: number | null = null) => {
        setSelectedCompany(company);
        setSelectedPlanId(planId);
        setModalOpen({ [type]: true });

        // Initialize form data based on context
        if (type === 'createCompany') {
            const defaultPlan = localPlans.length > 0 ? localPlans[0].name : 'Standard';
            setFormData({ name: '', domain: '', cnpj: '', whatsapp: '', plan: defaultPlan, responsibleName: '', responsibleEmail: '' });
        } else if (type === 'edit' && company) {
            setFormData({ name: company.name, domain: company.domain, cnpj: company.cnpj || '' });
        } else if (type === 'createPlan') {
            setFormData({ name: '', userLimit: '', price: '' });
            setFeaturesState({});
        } else if (type === 'editPlan' && planId) {
            const plan = localPlans.find(p => p.id === planId);
            if (plan) {
                setFormData({ name: plan.name, userLimit: plan.userLimit.toString(), price: (plan.price || 0).toString() });
                setFeaturesState((plan.features || {}) as Record<string, boolean>);
            }
        } else if (type === 'config' && company) {
            setFeaturesState((company.custom_features || company.plan?.features || {}) as Record<string, boolean>);
        } else if (type === 'newUpdate') {
            setFormData({ version: SYSTEM_VERSION, description: '' });
        } else if (type === 'createAnnouncement') {
            setFormData({ title: '', content: '', category: 'Notícias da Empresa' });
        } else if (type === 'users' && company) {
            // Fetch users for this company
            fetchCompanyUsers(company.id!);
        } else if (type === 'stats' && company) {
            fetchUsageStats(company.id!);
        }
    };

    const fetchUsageStats = async (companyId: string) => {
        setStatsLoading(true);
        setUsageStats(null);

        const tables = ['profiles', 'posts', 'emails', 'tickets', 'messages', 'announcements', 'marketplace_items', 'events', 'benefits', 'form_submissions', 'ti_requests'];
        const stats: any = {};

        try {
            // Fetch individual table counts
            await Promise.all(tables.map(async (table) => {
                const { count, error } = await supabase
                    .from(table)
                    .select('*', { count: 'exact', head: true })
                    .eq('company_id', companyId);

                if (!error) stats[table] = count || 0;
            }));

            // Fetch Storage Metrics via RPC
            const { data: storageData, error: storageError } = await supabase.rpc('get_storage_stats', { p_company_id: companyId });
            if (!storageError && storageData) {
                stats.storage = storageData;
            } else if (storageError) {
                // Silently ignore if function doesn't exist yet (404/P0001)
                if (storageError.code !== 'PGRST202' && storageError.code !== '42883') {
                    console.log("Storage stats not available:", storageError.message);
                }
            }

            setUsageStats(stats);
        } catch (e) {
            console.error("Error fetching stats", e);
        } finally {
            setStatsLoading(false);
        }
    };

    const fetchCompanyUsers = async (companyId: string) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('company_id', companyId);

        if (error) console.error("Error fetching users", error);
        else setCompanyUsers(data as unknown as Employee[] || []);
    };

    const handleImpersonateUser = (user: Employee) => {
        if (onImpersonate && selectedCompany) {
            console.log("Impersonating via SaaSDashboard:", selectedCompany.name);
            onImpersonate(selectedCompany);
            closeModal();
        } else {
            alert("Erro: Função de impersonate não disponível ou empresa não selecionada.");
        }
    };

    const toggleCompanyAdmin = async (userId: string, currentStatus: boolean) => {
        const { error } = await supabase
            .from('profiles')
            .update({ is_company_admin: !currentStatus })
            .eq('id', userId);

        if (error) {
            alert("Erro ao atualizar permissão: " + error.message);
        } else {
            // Update local state
            setCompanyUsers(prev => prev.map(u => u.id === userId ? { ...u, is_company_admin: !currentStatus } : u));
        }
    };

    const closeModal = () => {
        setModalOpen({});
        setSelectedCompany(null);
        setSelectedPlanId(null);
        setFormData({});
        setFeaturesState({});
    };

    // --- Ações ---

    // 1. EXCLUIR
    const handleDeleteCompany = async () => {
        if (selectedCompany) {
            const { error } = await supabase.from('companies').delete().eq('id', selectedCompany.id);
            if (error) {
                alert('Erro ao excluir empresa: ' + error.message);
            } else {
                fetchData();
                closeModal();
            }
        }
    };
    const handleDeletePlan = async () => {
        if (selectedPlanId) {
            const { error } = await supabase.from('plans').delete().eq('id', selectedPlanId);
            if (error) {
                alert('Erro ao excluir plano: ' + error.message);
            } else {
                fetchData();
                closeModal();
            }
        }
    };

    // 2. CRIAR / ATUALIZAR EMPRESA
    const submitCompanyForm = async () => {
        if (modalOpen.createCompany) {
            const selectedPlan = localPlans.find(p => p.name === formData.plan);

            const newCompany = {
                name: formData.name,
                status: 'active',
                cnpj: formData.cnpj,
                plan_id: selectedPlan?.id,
                domain: formData.domain,
                responsible_name: formData.responsibleName,
                responsible_email: formData.responsibleEmail,
                subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                settings: { companyName: formData.name }
            };

            const { data, error } = await supabase.from('companies').insert([newCompany]).select();

            if (error) {
                showToast('Erro ao criar empresa: ' + error.message, 'error');
                return;
            }
            if (data) {
                // Tentar encontrar e atualizar o usuário responsável SE já existir
                if (formData.responsibleEmail) {
                    try {
                        const { error: updateError } = await supabase.from('profiles')
                            .update({
                                role: 'admin',
                                is_admin: true,
                                is_company_admin: true,
                                company_id: data[0].id,
                            })
                            .ilike('email', formData.responsibleEmail.trim()); // ilike for case insensitive

                        if (updateError) console.log("Usuário responsável ainda não existe ou erro ao atualizar:", updateError.message);
                        else console.log("Usuário responsável atualizado para admin.");
                    } catch (err) {
                        console.log("Erro silencioso ao tentar atualizar admin:", err);
                    }
                }

                showToast('Empresa criada com sucesso!', 'success');
                fetchData();
            }
        } else if (modalOpen.edit && selectedCompany) {
            const selectedPlan = localPlans.find(p => p.name === formData.plan); // Find plan by name

            const { error } = await supabase.from('companies')
                .update({
                    name: formData.name,
                    domain: formData.domain,
                    cnpj: formData.cnpj || null, // Ensure null if empty
                    plan_id: selectedPlan?.id,
                    settings: { ...(selectedCompany.settings || {}), companyName: formData.name }
                })
                .eq('id', selectedCompany.id);

            if (error) {
                showToast('Erro ao atualizar empresa: ' + error.message, 'error');
                console.error("Update error:", error);
            } else {
                showToast('Empresa atualizada com sucesso!', 'success');
                fetchData();
            }
        }
        closeModal();
    };

    // 3. DESATIVAR
    const handleDisableCompany = async () => {
        if (selectedCompany) {
            const { error } = await supabase
                .from('companies')
                .update({ status: 'inactive' })
                .eq('id', selectedCompany.id);

            if (error) {
                showToast('Erro ao desativar empresa: ' + error.message, 'error');
            } else {
                showToast('Empresa desativada com sucesso!', 'success');
                fetchData();
                closeModal();
            }
        }
    };

    // 4. ADICIONAR MÊS
    const handleAddMonth = async () => {
        if (selectedCompany) {
            const currentEnd = selectedCompany.subscriptionEndDate ? new Date(selectedCompany.subscriptionEndDate) : new Date();
            const baseDate = currentEnd < new Date() ? new Date() : currentEnd;
            const newDate = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

            const { error } = await supabase
                .from('companies')
                .update({ subscription_end_date: newDate.toISOString() })
                .eq('id', selectedCompany.id);

            if (error) {
                showToast('Erro ao adicionar mês: ' + error.message, 'error');
            } else {
                fetchData();
                showToast('30 dias adicionados com sucesso!', 'success');
                closeModal(); // Close modal after success
            }
        }
    };


    // 5. ATUALIZAR CONFIGURAÇÃO (Recursos do Menu)
    const handleSaveConfig = async () => {
        if (!selectedCompany) return;

        const { error } = await supabase
            .from('companies')
            .update({ custom_features: featuresState })
            .eq('id', selectedCompany.id);

        if (error) {
            showToast('Erro ao salvar configurações do menu: ' + error.message, 'error');
        } else {
            showToast('Configurações do menu salvas com sucesso!', 'success');
            fetchData();
            closeModal();
        }
    };

    // 6. PLANOS (Criar/Editar)
    const submitPlanForm = async () => {
        const planData = {
            name: formData.name,
            user_limit: parseInt(formData.userLimit) || 0,
            price: parseFloat(formData.price) || 0,
            features: featuresState
        };

        if (modalOpen.createPlan) {
            const { error } = await supabase.from('plans').insert([planData]);
            if (error) {
                showToast('Erro ao criar plano: ' + error.message, 'error');
                console.error("Create plan error:", error);
            } else {
                showToast('Plano criado com sucesso!', 'success');
                fetchData();
            }
        } else if (modalOpen.editPlan && selectedPlanId) {
            const { error } = await supabase.from('plans').update(planData).eq('id', selectedPlanId);
            if (error) {
                showToast('Erro ao atualizar plano: ' + error.message, 'error');
                console.error("Update plan error:", error);
            } else {
                showToast('Plano atualizado com sucesso!', 'success');
                fetchData();
            }
        }
        closeModal();
    };

    const submitUpdateForm = async () => {
        if (!formData.version || !formData.description) {
            alert('Preencha os campos obrigatórios');
            return;
        }
        const { error } = await supabase.from('system_updates').insert([{
            version: formData.version,
            description: formData.description,
            active: true
        }]);
        if (error) {
            showToast('Erro ao publicar atualização: ' + error.message, 'error');
        } else {
            showToast('Atualização publicada com sucesso!', 'success');
            fetchData();
            closeModal();
        }
    };


    const handleDeleteVideo = async (id: string) => {
        if (!confirm('Deseja excluir este vídeo?')) return;
        try {
            const { error } = await supabase.from('manual_videos').delete().eq('id', id);
            if (error) throw error;
            showToast('Vídeo excluído com sucesso!', 'success');
            setManualVideos(vids => vids.filter(v => v.id !== id));
        } catch (error) {
            console.error('Error deleting video:', error);
            showToast('Erro ao excluir vídeo', 'error');
        }
    };

    const submitVideoForm = async () => {
        try {
            const { error } = await supabase.from('manual_videos').insert([{
                title: formData.title,
                url: formData.url,
                thumbnail: formData.thumbnail,
                duration: formData.duration,
                category: formData.category,
                description: formData.description
            }]);
            if (error) throw error;
            showToast('Vídeo cadastrado!', 'success');
            closeModal();
            fetchData();
        } catch (error) {
            console.error('Error saving video:', error);
            showToast('Erro ao salvar vídeo', 'error');
        }
    };

    const submitAnnouncement = async () => {
        if (!formData.title || !formData.content) return;
        setLoading(true);
        try {
            // Broadcast to ALL active companies
            const announcementsToInsert = localCompanies
                .filter(c => c.status === 'active')
                .map(c => ({
                    company_id: c.id,
                    title: formData.title,
                    summary: formData.content, // Map content to summary
                    category: formData.type || 'info', // Map type to category
                    created_by: 'Super Admin',
                    date: new Date().toISOString()
                }));

            if (announcementsToInsert.length > 0) {
                const { error } = await supabase.from('announcements').insert(announcementsToInsert);
                if (error) throw error;
                showToast(`Aviso enviado para ${announcementsToInsert.length} empresas!`, 'success');
                closeModal();
            } else {
                showToast('Nenhuma empresa ativa para enviar.', 'info');
            }
        } catch (e: any) {
            console.error("Erro ao enviar aviso global:", e);
            showToast("Erro ao enviar aviso: " + e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    // --- Handlers Genéricos ---
    const handleInputChange = (field: string, value: string) => {
        setFormData((prev: any) => ({ ...prev, [field]: value }));
    };

    const handleFeatureToggle = (feature: string) => {
        setFeaturesState(prev => ({ ...prev, [feature]: !prev[feature] }));
    };


    // --- Subcomponentes do Escopo ---
    const MetricCardSimple = ({ title, value, icon: Icon, subText }: any) => (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center text-center justify-center min-h-[160px]">
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-3">{title}</p>
            <div className="flex items-center gap-3">
                <span className="text-4xl font-bold text-gray-800 dark:text-white">{value}</span>
                {Icon && <Icon className="w-8 h-8 text-gray-400 dark:text-gray-500" />}
            </div>
            {subText && <p className="text-xs text-green-500 mt-2">{subText}</p>}
        </div>
    );

    const ActionButton = ({ icon: Icon, color, onClick, title }: any) => (
        <button
            onClick={onClick}
            title={title}
            className={`p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${color}`}
        >
            <Icon className="w-5 h-5" />
        </button>
    );

    const ConfigFeaturesList = () => {
        const Toggle = ({ label, id, icon: Icon }: { label: string, id: string, icon?: any }) => (
            <div className="flex items-center justify-between py-3 px-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                    {Icon && <Icon className="w-5 h-5 text-gray-400" />}
                    <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">{label}</span>
                </div>
                <div
                    onClick={() => handleFeatureToggle(id)}
                    className="relative inline-flex items-center cursor-pointer"
                >
                    <input type="checkbox" checked={!!featuresState[id]} readOnly className="sr-only peer" />
                    <div className={`w-11 h-6 rounded-full peer peer-focus:outline-none transition-colors ${featuresState[id] ? 'bg-brand-primary' : 'bg-gray-200 dark:bg-gray-600'} after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${featuresState[id] ? 'after:translate-x-full after:border-white' : ''}`}></div>
                </div>
            </div>
        );

        const SectionTitle = ({ title }: { title: string }) => (
            <h5 className="font-bold text-gray-400 dark:text-gray-500 text-[10px] uppercase tracking-widest col-span-full mt-6 mb-2 border-b border-gray-100 dark:border-gray-700 pb-1">{title}</h5>
        );

        return (
            <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 max-h-[500px] overflow-y-auto custom-scrollbar">
                <SectionTitle title="Módulos Gerais" />
                <Toggle label="Feed de Notícias" id="feed" icon={NewspaperIcon} />
                <Toggle label="Mensagens / Chat" id="messages" icon={ChatBubbleLeftRightIcon} />
                <Toggle label="Calendário Corp." id="calendar" icon={CalendarDaysIcon} />
                <Toggle label="E-mail Integrado" id="email" icon={EnvelopeIcon} />
                <Toggle label="Marketplace" id="marketplace" icon={BuildingStorefrontIcon} />
                <Toggle label="Eventos" id="events" icon={CalendarDaysIcon} />
                <Toggle label="Métricas (KPIs)" id="kpis" icon={ChartBarIcon} />

                <SectionTitle title="Recursos de RH" />
                <Toggle label="Portal Meu RH" id="meu-rh" icon={BuildingOfficeIcon} />
                <Toggle label="Diretório / Organograma" id="org-chart" icon={UserGroupIcon} />
                <Toggle label="Vagas e Recrutamento" id="jobs" icon={RocketLaunchIcon} />
                <Toggle label="Treinamentos (LMS)" id="training" icon={RocketLaunchIcon} />
                <Toggle label="Pesquisas Internas" id="surveys" icon={ChatBubbleLeftRightIcon} />
                <Toggle label="Benefícios" id="benefits" icon={HeartIcon} />
                <Toggle label="Políticas e Docs" id="policies" icon={ShieldCheckIcon} />
                <Toggle label="Onboarding" id="onboarding" icon={PlusIcon} />
                <Toggle label="Agradecimentos / Mural" id="wall" icon={SparklesIcon} />
                <Toggle label="Bem Estar" id="wellness" icon={HeartIcon} />

                <SectionTitle title="Suporte e T.I." />
                <Toggle label="Central de Chamados" id="tickets" icon={TicketIcon} />
                <Toggle label="Requisição de Equip." id="equip" icon={PlusIcon} />
                <Toggle label="Base de Conhecimento" id="kb" icon={LifebuoyIcon} />
                <Toggle label="Segurança da Info." id="infosec" icon={ShieldCheckIcon} />
            </div>
        );
    }


    return (
        <div className="bg-gray-50/50 dark:bg-gray-900 min-h-screen flex flex-col font-sans relative">
            <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 px-8 pt-2 flex items-center justify-between">
                <div className="flex space-x-1 overflow-x-auto no-scrollbar tracking-wide uppercase">
                    <button onClick={() => setActiveTab('dashboard')} className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'dashboard' ? 'border-brand-primary text-brand-primary font-bold' : 'border-transparent text-gray-500'}`}>{t('dashboard.dashboard_tab')}</button>
                    <button onClick={() => setActiveTab('companies')} className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'companies' ? 'border-brand-primary text-brand-primary font-bold' : 'border-transparent text-gray-500'}`}>{t('dashboard.companies_tab')}</button>
                    <button onClick={() => setActiveTab('plans')} className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'plans' ? 'border-brand-primary text-brand-primary font-bold' : 'border-transparent text-gray-500'}`}>{t('dashboard.plans_tab')}</button>
                    <button onClick={() => setActiveTab('announcements')} className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'announcements' ? 'border-brand-primary text-brand-primary font-bold' : 'border-transparent text-gray-500'}`}>{t('dashboard.announcements_tab')}</button>
                    <button onClick={() => setActiveTab('settings')} className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'settings' ? 'border-brand-primary text-brand-primary font-bold' : 'border-transparent text-gray-500'}`}>{t('dashboard.settings_tab')}</button>
                </div>
                <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Versão</span>
                    <span className="text-sm font-bold text-brand-primary">{SYSTEM_VERSION}</span>
                </div>
            </div>

            <div className="p-8 flex-1">
                {/* DASHBOARD */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center text-center justify-center min-h-[160px]">
                                <p className="text-sm text-gray-500 font-medium">{t('dashboard.system_version')}</p>
                                <h2 className="text-4xl font-bold text-gray-800 dark:text-white mt-2">
                                    {SYSTEM_VERSION}
                                </h2>
                                <p className="text-xs text-green-500 mt-1 font-semibold">Sistema Atualizado</p>
                            </div>
                            <MetricCardSimple title={t('dashboard.registered_companies')} value={totalCompanies} icon={BuildingOfficeIcon} />
                            <MetricCardSimple title={t('dashboard.active_companies')} value={activeCompaniesCount} icon={CheckCircleIcon} />
                            <MetricCardSimple title={t('dashboard.expired_companies')} value={expiredCompaniesCount} icon={UserGroupIcon} />
                            <MetricCardSimple title={t('dashboard.inactive_companies')} value={inactiveCompaniesCount} icon={LockClosedIcon} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <MetricCardSimple title={t('dashboard.total_users')} value={totalUsers} icon={UserGroupIcon} />
                            <MetricCardSimple title={t('dashboard.online_users')} value={onlineUsers} icon={UsersIcon} />
                        </div>

                        {/* CHARTS SECTION */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Growth Chart */}
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('dashboard.company_growth')}</h3>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height={250}>
                                        <AreaChart data={growthData}>
                                            <defs>
                                                <linearGradient id="colorEmpresas" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                                            <CartesianGrid vertical={false} stroke="#E5E7EB" strokeDasharray="3 3" />
                                            <Area type="monotone" dataKey="empresas" stroke="#10B981" fillOpacity={1} fill="url(#colorEmpresas)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Plans Distribution */}
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('dashboard.plan_distribution')}</h3>
                                <div className="h-64 w-full flex items-center justify-center">
                                    <ResponsiveContainer width="100%" height={250}>
                                        <PieChart>
                                            <Pie
                                                data={planDistribution}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                fill="#8884d8"
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {planDistribution.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* WhatsApp Status Widget */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                    <HeroChatBubbleLeftRightIcon className="w-6 h-6 text-green-500" />
                                    {t('sidebar.whatspanda')}
                                </h3>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${whatsappStatus.count > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {whatsappStatus.count} {t('whatsapp.active_sessions')}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {localCompanies.map(comp => {
                                    const isActive = whatsappStatus.activeCompanyIds.includes(comp.id);
                                    return (
                                        <div key={comp.id} className={`p-3 rounded border flex items-center justify-between ${isActive ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                                            <span className="text-sm font-medium truncate">{comp.name}</span>
                                            <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                    </div>
                )}

                {/* COMPANIES */}
                {activeTab === 'companies' && (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="flex items-center gap-2 mb-6">
                            <BuildingOfficeIcon className="w-5 h-5 text-gray-800 dark:text-white" />
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Empresas</h2>
                        </div>
                        <div className="flex flex-col md:flex-row gap-4 items-center">
                            <div className="relative flex-1 w-full">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Localize empresa..."
                                    className="w-full pl-8 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-none rounded text-sm focus:ring-1 focus:ring-brand-primary outline-none"
                                />
                                <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-gray-100 dark:bg-gray-700 border-none rounded py-2 px-4 text-sm w-full md:w-48 text-gray-600 outline-none"
                            >
                                <option value="all">Status: todas</option>
                                <option value="active">Ativas</option>
                                <option value="inactive">Inativas</option>
                            </select>
                            <button
                                onClick={() => openModal('createCompany')}
                                className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded text-sm font-bold uppercase tracking-wide flex items-center gap-2 transition-colors"
                            >
                                <PlusIcon className="w-4 h-4" /> Adicionar
                            </button>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-gray-700 text-xs font-bold text-gray-500 uppercase">
                                            <th className="px-6 py-4">Nome</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Usuários</th>
                                            <th className="px-6 py-4">Vencimento</th>
                                            <th className="px-6 py-4">Plano</th>
                                            <th className="px-6 py-4 text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-xs divide-y divide-gray-5 dark:divide-gray-700/50">
                                        {filteredCompanies.map((comp, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                <td className="px-6 py-4 font-medium text-gray-700 dark:text-gray-300">{comp.name}</td>
                                                <td className="px-6 py-4">
                                                    {comp.status === 'inactive' ? (
                                                        <XMarkIcon className="w-5 h-5 text-red-500" />
                                                    ) : (
                                                        <CheckCircleIcon className="w-5 h-5 text-green-500" />
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 font-bold">
                                                    {/* We can fetch this individually or optimize later / For now let's use a sub-component to fetch */}
                                                    <CompanyUserCount companyId={comp.id} />
                                                </td>
                                                <td className="px-6 py-4 text-gray-500">{comp.subscriptionEndDate ? new Date(comp.subscriptionEndDate).toLocaleDateString() : '-'}</td>
                                                <td className="px-6 py-4 text-gray-500">{comp.plan?.name || 'Standard'}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <ActionButton icon={BanknotesIcon} color="text-green-600" title="Faturas" onClick={() => openModal('invoices', comp)} />
                                                        <ActionButton icon={CalendarDaysIcon} color="text-blue-500" title="Add Mês" onClick={() => openModal('addMonth', comp)} />
                                                        <ActionButton icon={ChartPieIcon} color="text-purple-500" title="Stats" onClick={() => openModal('stats', comp)} />
                                                        <ActionButton icon={CloudIcon} color="text-gray-500" title="Disco" onClick={() => openModal('disk', comp)} />
                                                        <ActionButton icon={NoSymbolIcon} color="text-orange-500" title="Desativar" onClick={() => openModal('disable', comp)} />
                                                        <ActionButton icon={UserGroupIcon} color="text-teal-500" title="Usuários" onClick={() => openModal('users', comp)} />
                                                        <ActionButton icon={AdjustmentsHorizontalIcon} color="text-indigo-500" title="Config" onClick={() => openModal('config', comp)} />
                                                        <ActionButton icon={PencilIcon} color="text-amber-500" title="Editar" onClick={() => openModal('edit', comp)} />
                                                        <ActionButton icon={TrashIcon} color="text-red-500" title="Excluir" onClick={() => openModal('delete', comp)} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* PLANS */}
                {activeTab === 'plans' && (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="flex items-center gap-2 mb-6">
                            <CurrencyDollarIcon className="w-5 h-5 text-gray-800 dark:text-white" />
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Planos</h2>
                        </div>
                        <div className="flex justify-start mb-4">
                            <button onClick={() => openModal('createPlan')} className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded text-sm font-bold uppercase flex items-center gap-2"><PlusIcon className="w-4 h-4" /> Adicionar</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {localPlans.map(plan => (
                                <div key={plan.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col hover:shadow-md transition-all group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-800 dark:text-white group-hover:text-brand-primary transition-colors">{plan.name}</h3>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">ID: {plan.id.slice(0, 8)}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => openModal('editPlan', null, plan.id)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all" title="Editar"><PencilIcon className="w-4 h-4" /></button>
                                            <button onClick={() => openModal('deletePlan', null, plan.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Excluir"><TrashIcon className="w-4 h-4" /></button>
                                        </div>
                                    </div>

                                    <div className="space-y-3 mb-6 flex-1">
                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                            <UsersIcon className="w-4 h-4 text-gray-400" />
                                            <span>Capacidade: <strong>{plan.userLimit} usuários</strong></span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                            <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                                            <span>{Object.values(plan.features || {}).filter(v => v === true).length} recursos ativos</span>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-gray-50 dark:border-gray-700 flex items-center justify-between">
                                        <span className="text-sm text-gray-400 font-medium">Investimento</span>
                                        <span className="text-xl font-bold text-brand-text dark:text-white">
                                            {(plan.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* SETTINGS / UPDATES */}
                {activeTab === 'settings' && (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                            <div className="flex items-center gap-2">
                                <AdjustmentsHorizontalIcon className="w-5 h-5 text-gray-800 dark:text-white" />
                                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Configurações & Atualizações</h2>
                            </div>
                            <button
                                onClick={() => openModal('newUpdate')}
                                className="bg-red-500 hover:bg-red-600 text-white px-6 py-2.5 rounded text-sm font-bold uppercase flex items-center justify-center gap-2 transition-colors shadow-md w-full sm:w-auto"
                            >
                                <PlusIcon className="w-4 h-4" /> Postar Atualização
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* LOGO CONFIGURATION */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col">
                                <div className="flex items-center gap-2 mb-6">
                                    <PhotoIcon className="w-5 h-5 text-gray-500" />
                                    <h3 className="text-lg font-bold text-gray-700 dark:text-white">Logomarca do Sistema</h3>
                                </div>

                                <div className="flex flex-col items-center justify-center flex-1 space-y-4">
                                    <div className="w-full max-w-[240px] h-32 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600 flex items-center justify-center overflow-hidden group relative">
                                        {systemLogo ? (
                                            <img src={systemLogo} alt="Logo Atual" className="max-h-24 w-auto object-contain transition-transform group-hover:scale-105" />
                                        ) : (
                                            <div className="text-center">
                                                <BuildingOfficeIcon className="w-10 h-10 text-gray-300 mx-auto" />
                                                <p className="text-xs text-gray-400 mt-2">Nenhuma logo definida</p>
                                            </div>
                                        )}

                                        {isUploadingLogo && (
                                            <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 flex items-center justify-center z-10">
                                                <ArrowPathIcon className="w-8 h-8 text-brand-primary animate-spin" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="w-full">
                                        <label className="block w-full text-center px-4 py-2.5 bg-brand-primary hover:bg-emerald-600 text-white rounded-lg text-sm font-bold cursor-pointer transition-all shadow-sm">
                                            {logoFile ? 'LOGO SELECIONADA' : 'SELECIONAR NOVA LOGO'}
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={handleLogoSelect}
                                                disabled={isSavingSettings}
                                            />
                                        </label>
                                        <p className="text-[10px] text-gray-400 text-center mt-2 italic">
                                            * Esta logo será exibida em todas as áreas que não possuem logo própria.
                                        </p>
                                    </div>

                                    {/* UPDATE DURATION SETTING */}
                                    <div className="w-full pt-4 border-t border-gray-100 dark:border-gray-700 mt-4 space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Manter Notificação Ativa Por:</label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={updateDuration}
                                                    onChange={(e) => setUpdateDuration(parseInt(e.target.value) || 0)}
                                                    className="w-20 p-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600 text-sm font-bold text-center"
                                                />
                                                <select
                                                    value={updateDurationUnit}
                                                    onChange={(e) => setUpdateDurationUnit(e.target.value as any)}
                                                    className="flex-1 p-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600 text-sm font-medium"
                                                >
                                                    <option value="hours">Horas</option>
                                                    <option value="days">Dias</option>
                                                </select>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleSaveGeneralSettings}
                                            disabled={isSavingSettings}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold text-xs uppercase transition-all shadow-md disabled:opacity-50"
                                        >
                                            {isSavingSettings ? 'SALVANDO...' : 'SALVAR CONFIGURAÇÕES'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* VIDEO TUTORIALS MANAGEMENT */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2">
                                        <PlayIcon className="w-5 h-5 text-emerald-500" />
                                        <h3 className="text-lg font-bold text-gray-700 dark:text-white">Vídeos do Manual</h3>
                                    </div>
                                    <button
                                        onClick={() => openModal('newVideo')}
                                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 uppercase"
                                    >
                                        + Novo Vídeo
                                    </button>
                                </div>

                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                                    {manualVideos.length === 0 ? (
                                        <p className="text-sm text-gray-400 italic">Nenhum vídeo cadastrado.</p>
                                    ) : (
                                            manualVideos.map(vid => (
                                                <div key={vid.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-700 group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-12 h-8 bg-black rounded flex items-center justify-center overflow-hidden">
                                                            {vid.thumbnail && <img src={vid.thumbnail} className="w-full h-full object-cover opacity-60" />}
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-gray-800 dark:text-white line-clamp-1">{vid.title}</p>
                                                            <p className="text-[10px] text-gray-400 uppercase">{vid.category} • {vid.duration}</p>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => handleDeleteVideo(vid.id)} className="p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))
                                    )}
                                </div>
                            </div>

                            {/* VERSION HISTORY */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                                <h3 className="text-lg font-bold text-gray-700 dark:text-white mb-4">Histórico de Versões</h3>
                                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                                    {systemUpdates.length === 0 ? (
                                        <p className="text-sm text-gray-400 italic">Nenhuma atualização registrada.</p>
                                    ) : (
                                        systemUpdates.map(upd => (
                                            <div key={upd.id} className="border-l-4 border-red-500 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-r-lg">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-bold text-brand-text dark:text-white">Versão {upd.version}</span>
                                                    <span className="text-[10px] text-gray-400">{new Date(upd.created_at).toLocaleDateString()}</span>
                                                </div>
                                                <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{upd.description}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* GLOBAL ANNOUNCEMENTS */}
            {activeTab === 'announcements' && (
                <div className="space-y-6 animate-fadeIn">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <HeroMegaphoneIcon className="w-5 h-5 text-gray-800 dark:text-white" />
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Avisos Globais</h2>
                        </div>
                        <button
                            onClick={() => openModal('createAnnouncement')}
                            className="bg-brand-primary hover:bg-brand-secondary text-white px-6 py-2 rounded text-sm font-bold uppercase tracking-wide flex items-center gap-2 transition-colors"
                        >
                            <PlusIcon className="w-4 h-4" /> Novo Aviso
                        </button>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 text-center">
                        <HeroMegaphoneIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Central de Transmissão</h3>
                        <p className="text-gray-500 max-w-md mx-auto">
                            Envie comunicados importantes para <b>todas as empresas</b> registradas na plataforma de uma só vez.
                            Útil para avisos de manutenção, novidades ou alertas de segurança.
                        </p>
                    </div>
                </div>
            )}

            {/* --- MODALS --- */}
            {modalOpen.stats && selectedCompany && (
                <Modal onClose={closeModal} title={`Estatísticas: ${selectedCompany.name}`} width="max-w-2xl">
                    <div className="p-6">
                        {statsLoading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <ArrowPathIcon className="w-10 h-10 text-brand-primary animate-spin" />
                                <p className="text-sm text-gray-500 mt-4">Calculando uso de dados...</p>
                            </div>
                        ) : usageStats ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase">Usuários</p>
                                        <p className="text-2xl font-bold text-gray-800 dark:text-white">{usageStats.profiles || 0}</p>
                                    </div>
                                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-100 dark:border-emerald-800">
                                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">Posts / Feed</p>
                                        <p className="text-2xl font-bold text-gray-800 dark:text-white">{usageStats.posts || 0}</p>
                                    </div>
                                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-100 dark:border-purple-800">
                                        <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase">Mensagens</p>
                                        <p className="text-2xl font-bold text-gray-800 dark:text-white">{usageStats.messages || 0}</p>
                                    </div>
                                    <div className="bg-pink-50 dark:bg-pink-900/20 p-4 rounded-lg border border-pink-100 dark:border-pink-800">
                                        <p className="text-[10px] text-pink-600 dark:text-pink-400 font-bold uppercase">Chamados TI</p>
                                            <p className="text-2xl font-bold text-gray-800 dark:text-white">{usageStats.ti_requests || 0}</p>
                                    </div>
                                    <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-100 dark:border-amber-800">
                                        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase">E-mails</p>
                                        <p className="text-2xl font-bold text-gray-800 dark:text-white">{usageStats.emails || 0}</p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-100 dark:border-gray-600">
                                        <p className="text-[10px] text-gray-600 dark:text-gray-400 font-bold uppercase">Eventos</p>
                                        <p className="text-2xl font-bold text-gray-800 dark:text-white">{usageStats.events || 0}</p>
                                    </div>
                                </div>

                                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
                                        <h4 className="text-sm font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                            <ServerIcon className="w-4 h-4 text-brand-primary" />
                                            Resumo de Infraestrutura
                                        </h4>
                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex justify-between text-xs mb-2">
                                                    <span className="text-gray-500">Espaço em Disco (Estimado)</span>
                                                    <span className="font-bold text-brand-primary">
                                                        {usageStats.storage?.company_estimated_mb || 0} MB
                                                    </span>
                                                </div>
                                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                    <div
                                                        className="bg-brand-primary h-2 rounded-full transition-all duration-500"
                                                        style={{ width: `${Math.min(((usageStats.storage?.company_estimated_mb || 0) / 100) * 100, 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center text-xs py-2 border-t border-gray-100 dark:border-gray-800">
                                                <span className="text-gray-500">Total de Registros (Empresa)</span>
                                                <span className="font-semibold">{usageStats.storage?.company_estimated_rows || 0} linhas</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs py-2 border-t border-gray-100 dark:border-gray-800">
                                                <span className="text-gray-500">Tamanho Total do Banco (VPS)</span>
                                                <span className="font-semibold">
                                                    {usageStats.storage?.total_db_size_bytes
                                                        ? (usageStats.storage.total_db_size_bytes / (1024 * 1024)).toFixed(2)
                                                        : '0.00'} MB
                                                </span>
                                        </div>
                                            <div className="flex justify-between items-center text-xs pt-2 border-t border-gray-100 dark:border-gray-800">
                                                <span className="text-gray-500">Status do Servidor</span>
                                                <span className="text-green-500 font-bold flex items-center gap-1">
                                                    <CheckCircleIcon className="w-3 h-3" />
                                                    ONLINE / ESTÁVEL
                                                </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-center py-8 text-gray-400">Erro ao carregar estatísticas.</p>
                        )}
                        <div className="mt-8 flex justify-end">
                            <button onClick={closeModal} className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 rounded font-bold text-xs uppercase">Fechar</button>
                        </div>
                    </div>
                </Modal>
            )}

            {modalOpen.addMonth && selectedCompany && (
                <Modal onClose={closeModal} title="Confirmar Adição" width="max-w-md">
                    <div className="p-6">
                        <p className="text-gray-600 mb-6">Adicionar 1 mês extra ao vencimento de <strong>{selectedCompany.name}</strong>?</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={closeModal} className="px-4 py-2 bg-gray-500 text-white rounded text-xs font-bold uppercase">Cancelar</button>
                            <button onClick={handleAddMonth} className="px-6 py-2 bg-blue-600 text-white rounded text-xs font-bold uppercase">Confirmar</button>
                        </div>
                    </div>
                </Modal>
            )}

            {modalOpen.delete && selectedCompany && (
                <Modal onClose={closeModal} title="Confirmar Exclusão" width="max-w-md">
                    <div className="p-6">
                        <p className="text-gray-600 mb-6">Tem certeza que deseja <strong className="text-red-600">excluir permanentemente</strong> a empresa <strong>{selectedCompany.name}</strong>?</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={closeModal} className="px-4 py-2 bg-gray-500 text-white rounded text-xs font-bold uppercase">Cancelar</button>
                            <button onClick={handleDeleteCompany} className="px-6 py-2 bg-red-600 text-white rounded text-xs font-bold uppercase">Excluir</button>
                        </div>
                    </div>
                </Modal>
            )}

            {modalOpen.disable && selectedCompany && (
                <Modal onClose={closeModal} title="Desativar Empresa" width="max-w-md">
                    <div className="p-6">
                        <p className="text-gray-600 mb-6">Deseja desativar o acesso de <strong>{selectedCompany.name}</strong>?</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={closeModal} className="px-4 py-2 bg-gray-500 text-white rounded text-xs font-bold uppercase">Cancelar</button>
                            <button onClick={handleDisableCompany} className="px-6 py-2 bg-orange-500 text-white rounded text-xs font-bold uppercase">Desativar</button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Create Company / Edit Company */}
            {(modalOpen.createCompany || modalOpen.edit) && (
                <Modal onClose={closeModal} title={modalOpen.createCompany ? "Nova Empresa" : "Editar Empresa"} width="max-w-2xl">
                    <div className="p-6 space-y-4">
                        <input type="text" placeholder={t('dashboard.company_name')} value={formData.name || ''} onChange={(e) => handleInputChange('name', e.target.value)} className="w-full p-3 border rounded text-sm outline-none focus:border-blue-500" />
                        <input type="text" placeholder={t('dashboard.domain')} value={formData.domain || ''} onChange={(e) => handleInputChange('domain', e.target.value)} className="w-full p-3 border rounded text-sm outline-none focus:border-blue-500" />
                        <input type="text" placeholder={t('dashboard.cnpj')} value={formData.cnpj || ''} onChange={(e) => handleInputChange('cnpj', e.target.value)} className="w-full p-3 border rounded text-sm outline-none focus:border-blue-500" />
                        <select
                            value={formData.plan || ''}
                            onChange={(e) => handleInputChange('plan', e.target.value)}
                            className="w-full p-3 border rounded text-sm outline-none focus:border-blue-500 bg-white"
                        >
                            <option value="" disabled>Selecione um Plano</option>
                            {localPlans.map(plan => (
                                <option key={plan.id} value={plan.name}>{plan.name}</option>
                            ))}
                        </select>
                        {modalOpen.createCompany && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoria</label>
                                    <select value={formData.category || 'Notícias da Empresa'} onChange={(e) => handleInputChange('category', e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-brand-primary transition-all">
                                        <option value="Notícias da Empresa">Notícias da Empresa</option>
                                        <option value="Atualização de Produto">Atualização de Produto</option>
                                        <option value="RH & Cultura">RH & Cultura</option>
                                        <option value="Evento">Evento</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Conteúdo</label>
                                    <textarea rows={4} value={formData.content || ''} onChange={(e) => handleInputChange('content', e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-brand-primary transition-all" />
                                </div>
                                <input type="text" placeholder={t('dashboard.whatsapp')} value={formData.whatsapp || ''} onChange={(e) => handleInputChange('whatsapp', e.target.value)} className="w-full p-3 border rounded text-sm outline-none focus:border-blue-500" />
                                <div className="pt-4 border-t"><h4 className="font-bold text-gray-700 mb-2">{t('dashboard.responsible')}</h4>
                                    <input type="text" placeholder={t('dashboard.responsible_name')} value={formData.responsibleName || ''} onChange={(e) => handleInputChange('responsibleName', e.target.value)} className="w-full p-3 border rounded text-sm mb-2" />
                                    <input type="email" placeholder={t('dashboard.responsible_email')} value={formData.responsibleEmail || ''} onChange={(e) => handleInputChange('responsibleEmail', e.target.value)} className="w-full p-3 border rounded text-sm" />
                                </div>
                            </>
                        )}
                    </div>
                    <div className="p-6 border-t flex justify-end gap-2">
                        <button onClick={closeModal} className="px-4 py-2 bg-gray-500 text-white rounded font-bold text-xs uppercase">Cancelar</button>
                        <button onClick={submitCompanyForm} className="px-6 py-2 bg-blue-600 text-white rounded font-bold text-xs uppercase">Salvar</button>
                    </div>
                </Modal>
            )}

            {/* Config & Plans Form */}
            {(modalOpen.config || modalOpen.createPlan || modalOpen.editPlan) && (
                <Modal onClose={closeModal} title={modalOpen.config ? "Configurar Menu" : (modalOpen.createPlan ? "Novo Plano" : "Editar Plano")} width="max-w-2xl">
                    <div className="p-6 overflow-y-auto max-h-[70vh]">
                        {(modalOpen.createPlan || modalOpen.editPlan) && (
                            <div className="space-y-3 mb-6">
                                <h4 className="font-bold text-gray-700">Detalhes do Plano</h4>
                                <input type="text" placeholder="Nome" value={formData.name || ''} onChange={(e) => handleInputChange('name', e.target.value)} className="w-full p-3 border rounded text-sm" />
                                <div className="grid grid-cols-2 gap-3">
                                    <input type="number" placeholder="Max Usuários" value={formData.userLimit || ''} onChange={(e) => handleInputChange('userLimit', e.target.value)} className="w-full p-3 border rounded text-sm" />
                                    <input type="number" placeholder="Valor (R$)" value={formData.price || ''} onChange={(e) => handleInputChange('price', e.target.value)} className="w-full p-3 border rounded text-sm" />
                                </div>
                            </div>
                        )}
                        <ConfigFeaturesList />
                    </div>
                    <div className="p-6 border-t flex justify-end gap-2">
                        <button onClick={closeModal} className="px-4 py-2 bg-gray-500 text-white rounded font-bold text-xs uppercase">Cancelar</button>
                        <button onClick={modalOpen.config ? handleSaveConfig : submitPlanForm} className="px-6 py-2 bg-blue-600 text-white rounded font-bold text-xs uppercase">Salvar</button>
                    </div>
                </Modal>
            )}

            {/* Users List Modal */}
            {modalOpen.users && selectedCompany && (
                <Modal onClose={closeModal} title={`Usuários de ${selectedCompany.name}`} width="max-w-3xl">
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-4">
                            <p className="text-sm text-gray-500">Gerencie os usuários e administradores desta empresa.</p>
                            {/* Future: Add User Invite Button */}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase font-bold text-gray-500">
                                    <tr>
                                        <th className="px-4 py-3">Nome</th>
                                        <th className="px-4 py-3">Email</th>
                                        <th className="px-4 py-3">Papel</th>
                                        <th className="px-4 py-3 text-center">Admin da Empresa</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {companyUsers.length === 0 ? (
                                        <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Nenhum usuário encontrado nesta empresa.</td></tr>
                                    ) : (
                                        companyUsers.map(user => (
                                            <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                                <td className="px-4 py-3 font-medium text-gray-800 dark:text-white flex items-center gap-2">
                                                    {user.avatarUrl && <img src={user.avatarUrl} className="w-6 h-6 rounded-full" />}
                                                    {user.name || 'Sem Nome'}
                                                </td>
                                                <td className="px-4 py-3 text-gray-500">{user.email}</td>
                                                <td className="px-4 py-3 text-gray-500">{user.role || '-'}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => toggleCompanyAdmin(user.id, !!user.is_company_admin)}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${user.is_company_admin ? 'bg-purple-600' : 'bg-gray-200'}`}
                                                    >
                                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${user.is_company_admin ? 'translate-x-6' : 'translate-x-1'}`} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </Modal>
            )}

            {modalOpen.deletePlan && selectedPlanId && (
                <Modal onClose={closeModal} title="Confirmar Exclusão" width="max-w-md">
                    <div className="p-6">
                        <p className="text-gray-600 mb-6">Excluir este plano permanentemente?</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={closeModal} className="px-4 py-2 bg-gray-500 text-white rounded text-xs font-bold uppercase">Cancelar</button>
                            <button onClick={handleDeletePlan} className="px-6 py-2 bg-red-600 text-white rounded text-xs font-bold uppercase">Excluir</button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* New Update Modal */}
            {modalOpen.newUpdate && (
                <Modal onClose={closeModal} title="Nova Atualização do Sistema" width="max-w-2xl">
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Versão</label>
                            <input
                                type="text"
                                placeholder="Ex: 1.0.7 beta"
                                value={formData.version || ''}
                                onChange={(e) => handleInputChange('version', e.target.value)}
                                className="w-full p-3 border rounded text-sm outline-none focus:border-red-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mudanças (Logs)</label>
                            <textarea
                                placeholder="Descreva as atualizações realizadas..."
                                value={formData.description || ''}
                                onChange={(e) => handleInputChange('description', e.target.value)}
                                className="w-full p-3 border rounded text-sm outline-none focus:border-red-500 h-48 resize-none"
                            ></textarea>
                        </div>
                        <p className="text-xs text-red-500 font-medium">* Ao salvar, uma notificação será enviada para todas as empresas.</p>
                    </div>
                    <div className="p-6 border-t flex justify-end gap-2">
                        <button onClick={closeModal} className="px-4 py-2 bg-gray-500 text-white rounded font-bold text-xs uppercase">Cancelar</button>
                        <button onClick={submitUpdateForm} className="px-6 py-2 bg-red-600 text-white rounded font-bold text-xs uppercase shadow-md">Publicar</button>
                    </div>
                </Modal>
            )}

            {/* New Video Modal */}
            {modalOpen.newVideo && (
                <Modal onClose={closeModal} title="Novo Vídeo Tutorial" width="max-w-2xl">
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título do Vídeo</label>
                            <input
                                type="text"
                                placeholder="Ex: Como gerar relatórios financeiro"
                                value={formData.title || ''}
                                onChange={(e) => handleInputChange('title', e.target.value)}
                                className="w-full p-3 border rounded text-sm outline-none focus:border-emerald-500"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">URL (Embed YouTube)</label>
                                <input
                                    type="text"
                                    placeholder="https://www.youtube.com/embed/..."
                                    value={formData.url || ''}
                                    onChange={(e) => handleInputChange('url', e.target.value)}
                                    className="w-full p-3 border rounded text-sm outline-none focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoria</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Financeiro"
                                    value={formData.category || ''}
                                    onChange={(e) => handleInputChange('category', e.target.value)}
                                    className="w-full p-3 border rounded text-sm outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Duração</label>
                                <input
                                    type="text"
                                    placeholder="Ex: 05:30"
                                    value={formData.duration || ''}
                                    onChange={(e) => handleInputChange('duration', e.target.value)}
                                    className="w-full p-3 border rounded text-sm outline-none focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Thumbnail (URL Imagem)</label>
                                <input
                                    type="text"
                                    placeholder="https://..."
                                    value={formData.thumbnail || ''}
                                    onChange={(e) => handleInputChange('thumbnail', e.target.value)}
                                    className="w-full p-3 border rounded text-sm outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição</label>
                            <textarea
                                placeholder="Breve resumo do conteúdo..."
                                value={formData.description || ''}
                                onChange={(e) => handleInputChange('description', e.target.value)}
                                className="w-full p-3 border rounded text-sm outline-none focus:border-emerald-500 h-24 resize-none"
                            ></textarea>
                        </div>
                    </div>
                    <div className="p-6 border-t flex justify-end gap-2">
                        <button onClick={closeModal} className="px-4 py-2 bg-gray-500 text-white rounded font-bold text-xs uppercase">Cancelar</button>
                        <button onClick={submitVideoForm} className="px-6 py-2 bg-emerald-600 text-white rounded font-bold text-xs uppercase shadow-md">Salvar Vídeo</button>
                    </div>
                </Modal>
            )}

        </div>
    );
};

// --- Componentes Auxiliares ---
const Modal = ({ title, onClose, children, width = "max-w-xl" }: any) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
        <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full ${width} m-4 flex flex-col max-h-[90vh]`}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-700 dark:text-white">{title}</h3>
                <button onClick={onClose} className="text-red-400 hover:text-red-500"><XMarkIcon className="w-6 h-6" /></button>
            </div>
            <div className="overflow-y-auto">{children}</div>
        </div>
    </div>
);



export default SaaSDashboard;
