import React, { useState, useEffect } from 'react';
import { handleTabKeyDown } from '../utils/tabAccessibility';
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
    PlayCircleIcon,
    ClipboardDocumentCheckIcon
} from './icons';
import { PlusIcon as HeroPlusIcon, UserGroupIcon as HeroUserGroupIcon, BuildingOfficeIcon as HeroBuildingOfficeIcon, BanknotesIcon as HeroBanknotesIcon, Cog6ToothIcon, CalendarDaysIcon as HeroCalendarDaysIcon, ChartPieIcon as HeroChartPieIcon, CloudIcon as HeroCloudIcon, NoSymbolIcon as HeroNoSymbolIcon, PencilIcon as HeroPencilIcon, TrashIcon as HeroTrashIcon, AdjustmentsHorizontalIcon as HeroAdjustmentsHorizontalIcon, MagnifyingGlassIcon as HeroMagnifyingGlassIcon, XMarkIcon as HeroXMarkIcon, CheckCircleIcon as HeroCheckCircleIcon, ChatBubbleLeftRightIcon as HeroChatBubbleLeftRightIcon, MegaphoneIcon as HeroMegaphoneIcon, ArrowRightOnRectangleIcon as HeroArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { Ghost } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { useLanguage } from './LanguageContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { usePresence } from './PresenceContext';

interface SaaSDashboardProps {
    companies?: Company[]; // Keep for compatibility but we will fetch internal state
    onImpersonate?: (company: Company) => void;
}

type TabType = 'dashboard' | 'companies' | 'plans' | 'settings' | 'announcements' | 'validations';
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
    const { onlineUsers: presenceOnlineUsers } = usePresence();
    const { currentUser, realProfile } = useAuth();
    const { showToast } = useToast();
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<TabType>('dashboard');

    // --- Estado para Dados e Filtros ---
    const [localCompanies, setLocalCompanies] = useState<Company[]>([]);
    const [localPlans, setLocalPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [dashboardError, setDashboardError] = useState<string | null>(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
    const [companyUsers, setCompanyUsers] = useState<Employee[]>([]); // Estado para usuários no modal
    const [systemUpdates, setSystemUpdates] = useState<any[]>([]);
    const [usageStats, setUsageStats] = useState<any>(null);
    const [statsLoading, setStatsLoading] = useState(false);

    const [
        storageOverrideInput,
        setStorageOverrideInput
    ] = useState<string>('');

    const [manualVideos, setManualVideos] = useState<any[]>([]);
    const [videoLoading, setVideoLoading] = useState(false);

    // NEW: WhatsApp Status & Charts Data
    const [whatsappStatus, setWhatsappStatus] = useState<{
        count: number;
        total: number;
        activeCompanyIds: string[];
        connections: Array<{
            id: string;
            companyId: string;
            name: string;
            phoneNumber: string | null;
            connected: boolean;
            syncHealthy: boolean;
            updatedAt: string;
        }>;
    }>({ count: 0, total: 0, activeCompanyIds: [], connections: [] });
    const [operationalMetrics, setOperationalMetrics] = useState<Record<string, number | null>>({});
    const [growthData, setGrowthData] = useState<any[]>([]);
    const [planDistribution, setPlanDistribution] = useState<any[]>([]);
    const [globalAnnouncements, setGlobalAnnouncements] = useState<any[]>([]);
    const [pendingUsers, setPendingUsers] = useState<Employee[]>([]);
    const [rejectedUsers, setRejectedUsers] = useState<Employee[]>([]);
    const [validationSubTab, setValidationSubTab] = useState<'pending' | 'rejected'>('pending');
    const [isValidating, setIsValidating] = useState<string | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
    const [systemLogo, setSystemLogo] = useState<string | null>(null);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [pandaIaIcon, setPandaIaIcon] = useState<string | null>(null);
    const [iaIconFile, setIaIconFile] = useState<File | null>(null);
    const [updateDuration, setUpdateDuration] = useState(15);
    const [updateDurationUnit, setUpdateDurationUnit] = useState<'hours' | 'days'>('hours');
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [isSavingUser, setIsSavingUser] = useState(false);
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [newUserForm, setNewUserForm] = useState({ name: '', email: '', password: '' });

    // NEW: Manual Settings State
    const [manualLinks, setManualLinks] = useState<any[]>([]);
    const [manualPromo, setManualPromo] = useState<any>({
        title: 'O que falta para você ser nosso próximo caso de sucesso?',
        description: 'Nossa equipe está pronta para te ajudar a extrair o máximo do sistema. Converse com seu analista para descobrir novos caminhos de eficiência.',
        tag: 'Destaque',
        image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=600&h=400&fit=crop'
    });

    // NEW: Master Banner State
    const [masterBannerData, setMasterBannerData] = useState<any>({
        imageUrl: '',
        link: '',
        isActive: false
    });
    const [masterBannerFile, setMasterBannerFile] = useState<File | null>(null);

    // --- Buscar Dados ---
    const fetchData = async () => {
        setLoading(true);
        setDashboardError(null);
        console.log("[SaaS] Buscando dados gerais...");
        try {
            // Fetch Plans
            const { data: plansData, error: plansError } = await supabase.from('plans').select('*');
            if (plansError) throw plansError;
            else {
                const mappedPlans: Plan[] = (plansData || []).map((p: any) => ({
                    ...p,
                    userLimit: p.user_limit,
                    whatsappLimit: p.whatsapp_limit ?? 0,
                    emailLimit: p.email_limit ?? 0,
                    storageLimit: Number(
                        p.storage_limit_gb || 10
                    ),
                    price: p.price
                }));
                setLocalPlans(mappedPlans);
            }

            // Fetch Companies
            const { data: companiesData, error: companiesError } = await supabase.from('companies').select('*, plan:plans(*)');
            if (companiesError) throw companiesError;
            else {
                setLocalCompanies(companiesData as unknown as Company[] || []);
            }

            // Fetch Manual Videos
            const { data: videosData } = await supabase.from('manual_videos').select('*').order('created_at', { ascending: false });
            if (videosData) setManualVideos(videosData);

            // Fetch Updates
            const { data: updatesData } = await supabase.from('system_updates').select('*').order('created_at', { ascending: false });
            if (updatesData) setSystemUpdates(updatesData);

            // Fetch System Settings (Logo & Duration & Manual Settings)
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

                const links = settingsData.find(s => s.key === 'manual_links')?.value;
                if (links) {
                    try { setManualLinks(JSON.parse(links)); } catch (e) { }
                } else {
                    setManualLinks([
                        { id: 'roadmap', title: 'Roadmap do sistema', description: 'Veja as novidades que vêm por aí.', icon: 'RocketLaunchIcon', type: 'info' }
                    ]);
                }

                const promo = settingsData.find(s => s.key === 'manual_promo')?.value;
                if (promo) {
                    try { setManualPromo(JSON.parse(promo)); } catch (e) { }
                }

                const banner = settingsData.find(s => s.key === 'master_banner')?.value;
                if (banner) {
                    try { setMasterBannerData(JSON.parse(banner)); } catch (e) { }
                }

                const iaIcon = settingsData.find(s => s.key === 'panda_ia_icon')?.value;
                if (iaIcon) setPandaIaIcon(iaIcon);
            }

            // Resumo operacional global autenticado do Painel SaaS.
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) throw new Error('Sessão administrativa não encontrada.');

                const res = await fetch('/api/saas/overview', {
                    headers: { Authorization: `Bearer ${session.access_token}` }
                });
                const statusData = await res.json();
                if (!res.ok) throw new Error(statusData?.error || `HTTP ${res.status}`);

                setWhatsappStatus(statusData.whatsapp);
                setOperationalMetrics(statusData.activity || {});
                setGlobalAnnouncements(statusData.recentAnnouncements || []);
            } catch (e) {
                console.error("Erro ao buscar status do WhatsApp:", e);
                throw e;
            }

            // Fetch Pending Users
            const { data: pendingData } = await supabase
                .from('profiles')
                .select('*, company:companies(*)')
                .eq('status', 'pending');
            if (pendingData) setPendingUsers(pendingData as any);

            // Fetch Rejected Users
            const { data: rejectedData } = await supabase
                .from('profiles')
                .select('*, company:companies(*)')
                .eq('status', 'rejected');
            if (rejectedData) setRejectedUsers(rejectedData as any);
            setLastUpdatedAt(new Date());
        } catch (error) {
            console.error('[SaaS] Erro ao buscar dados do dashboard:', error);
            setDashboardError('Não foi possível atualizar todos os dados do Painel SaaS.');
        } finally {
            setLoading(false);
        }
    };

    const validateSaasImageFile = (
        file: File,
        label: string
    ) => {
        const allowedTypes = new Set([
            'image/png',
            'image/jpeg',
            'image/webp'
        ]);

        const maxBytes =
            8 * 1024 * 1024;

        if (!allowedTypes.has(file.type)) {
            throw new Error(
                `${label}: formato inválido. Use PNG, JPG ou WEBP.`
            );
        }

        if (file.size <= 0 || file.size > maxBytes) {
            throw new Error(
                `${label}: arquivo deve possuir no máximo 8 MB.`
            );
        }
    };


    const handleSaveGeneralSettings = async () => {
        setIsSavingSettings(true);
        console.log("[SaaS] Iniciando salvamento de configurações...");
        try {
            const updates: any[] = [
                { key: 'update_notification_duration', value: updateDuration.toString() },
                { key: 'update_notification_unit', value: updateDurationUnit },
                { key: 'manual_links', value: JSON.stringify(manualLinks) },
                { key: 'manual_promo', value: JSON.stringify(manualPromo) }
            ];

            // If a new logo file was selected, upload it first
            if (logoFile) {
                validateSaasImageFile(
                    logoFile,
                    'Logo principal'
                );

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
                updates.push({ key: 'main_logo', value: systemLogo });
            }

            // Handle Panda IA Icon Upload
            if (iaIconFile) {
                validateSaasImageFile(
                    iaIconFile,
                    'Ícone da Panda IA'
                );

                console.log("[SaaS] Novo ícone da IA detectado. Fazendo upload...", iaIconFile.name);
                const fileExt = iaIconFile.name.split('.').pop();
                const fileName = `panda_ia_icon_${Date.now()}.${fileExt}`;
                const filePath = `system/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('announcements-media')
                    .upload(filePath, iaIconFile, { cacheControl: '3600', upsert: true });

                if (uploadError) throw new Error("Falha ao enviar ícone da IA: " + uploadError.message);

                const { data: { publicUrl } } = supabase.storage.from('announcements-media').getPublicUrl(filePath);
                updates.push({ key: 'panda_ia_icon', value: publicUrl });
                setPandaIaIcon(publicUrl);
                setIaIconFile(null);
            } else if (pandaIaIcon) {
                updates.push({ key: 'panda_ia_icon', value: pandaIaIcon });
            }

            // Handle Master Banner Upload
            let currentBannerData = { ...masterBannerData };
            if (masterBannerFile) {
                validateSaasImageFile(
                    masterBannerFile,
                    'Master Banner'
                );

                console.log("[SaaS] Novo Master Banner detectado. Fazendo upload...", masterBannerFile.name);
                const fileExt = masterBannerFile.name.split('.').pop();
                const fileName = `master_banner_${Date.now()}.${fileExt}`;
                const filePath = `system/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('announcements-media')
                    .upload(filePath, masterBannerFile, { cacheControl: '3600', upsert: true });

                if (uploadError) throw new Error("Falha ao enviar Master Banner: " + uploadError.message);

                const { data: { publicUrl } } = supabase.storage.from('announcements-media').getPublicUrl(filePath);
                currentBannerData.imageUrl = publicUrl;
                setMasterBannerData(currentBannerData);
                setMasterBannerFile(null);
            }
            updates.push({ key: 'master_banner', value: JSON.stringify(currentBannerData) });

            console.log("[SaaS] Executando UPSERT no banco:", updates);
            const {
                error: upsertError,
                data: upsertData
            } = await supabase.rpc(
                'save_system_settings_admin',
                {
                    p_updates: updates
                }
            );

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

        // Realtime listener for profiles changes (new signups, status updates)
        const profilesChannel = supabase
            .channel('saas-profiles-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'profiles' },
                () => {
                    console.log('[SaaS] Mudança detectada nos perfis. Atualizando dados...');
                    fetchData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(profilesChannel);
        };
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
    const activeCompanyRate = totalCompanies > 0
        ? Math.round((activeCompaniesCount / totalCompanies) * 100)
        : 0;

    // Estado para contagens
    const [totalUsers, setTotalUsers] = useState(0);

    useEffect(() => {
        const fetchCounts = async () => {
            const { count, error } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true });

            if (!error && count !== null) {
                setTotalUsers(count);
            }
        };

        fetchCounts();
    }, [localCompanies]);

    // Supabase Realtime Presence - contagem real de sessoes presentes.
    const onlineUsers = presenceOnlineUsers.size;
    const averageUsersPerCompany = totalCompanies > 0
        ? (totalUsers / totalCompanies).toFixed(1).replace('.', ',')
        : '0';
    const whatsappCoverage = totalCompanies > 0
        ? Math.round((whatsappStatus.count / totalCompanies) * 100)
        : 0;

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

            // 2. Growth real baseado em created_at,
            // considerando corretamente mês E ano.
            const months = [
                t('month.0'),
                t('month.1'),
                t('month.2'),
                t('month.3'),
                t('month.4'),
                t('month.5'),
                t('month.6'),
                t('month.7'),
                t('month.8'),
                t('month.9'),
                t('month.10'),
                t('month.11')
            ];

            const now = new Date();
            const growth: any[] = [];

            for (let i = 5; i >= 0; i--) {
                const targetDate = new Date(
                    now.getFullYear(),
                    now.getMonth() - i,
                    1
                );

                const periodEnd = new Date(
                    targetDate.getFullYear(),
                    targetDate.getMonth() + 1,
                    1
                );

                const count =
                    localCompanies.filter(c => {
                        const createdAt =
                            new Date(c.created_at || '');

                        return (
                            !Number.isNaN(
                                createdAt.getTime()
                            )
                            && createdAt < periodEnd
                        );
                    }).length;

                growth.push({
                    name:
                        months[
                            targetDate.getMonth()
                        ].substring(0, 3)
                        + '/'
                        + String(
                            targetDate.getFullYear()
                        ).slice(-2),

                    empresas: count
                });
            }

            setGrowthData(growth);
        }
    }, [localCompanies, totalCompanies]);

    // --- Gerenciamento de Estado de Modais ---
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState<Record<string, boolean>>({});

    // Forms State
    const [formData, setFormData] = useState<any>({});
    const [featuresState, setFeaturesState] = useState<Record<string, any>>({});

    // Helpers
    const openModal = (type: string, company: Company | null = null, planId: string | null = null) => {
        setSelectedCompany(company);
        setSelectedPlanId(planId);
        setModalOpen({ [type]: true });

        // Initialize form data based on context
        if (type === 'createCompany') {
            const defaultPlan = localPlans.length > 0 ? localPlans[0].name : 'Standard';
            setFormData({ name: '', domain: '', cnpj: '', whatsapp: '', plan: defaultPlan, responsibleName: '', responsibleEmail: '' });
        } else if (type === 'edit' && company) {
            setFormData({
                name: company.name,
                domain: company.domain,
                cnpj: company.cnpj || '',
                plan: company.plan?.name || ''
            });
        } else if (type === 'createPlan') {
            setFormData({
                    name: '',
                    userLimit: '',
                    whatsappLimit: '1',
                    emailLimit: '1',
                    storageLimit: '10',
                    price: ''
                });
            setFeaturesState({});
        } else if (type === 'editPlan' && planId) {
            const plan = localPlans.find(p => p.id === planId);
            if (plan) {
                setFormData({
                    name: plan.name,
                    userLimit: plan.userLimit.toString(),
                    whatsappLimit: (plan.whatsappLimit ?? 0).toString(),
                    emailLimit: (plan.emailLimit ?? 0).toString(),
                    price: (plan.price || 0).toString()
                });
                setFeaturesState((plan.features || {}) as Record<string, any>);
            }
        } else if (type === 'config' && company) {
            setFeaturesState((company.custom_features || company.plan?.features || {}) as Record<string, any>);
        } else if (type === 'newUpdate') {
            setFormData({ version: SYSTEM_VERSION, description: '' });
        } else if (type === 'createAnnouncement') {
            setFormData({ title: '', content: '', category: 'Notícias da Empresa' });
        } else if (type === 'users' && company) {
            // Fetch users for this company
            fetchCompanyUsers(company.id!);
        } else if ((type === 'stats' || type === 'disk') && company) {
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


            const {
                data: quotaData,
                error: quotaError
            } = await supabase.rpc(
                'get_company_storage_quota',
                {
                    p_company_id: companyId
                }
            );

            if (
                !quotaError
                && quotaData
            ) {

                stats.storageQuota =
                    quotaData;

                setStorageOverrideInput(
                    quotaData.override_limit_gb == null
                        ? ''
                        : String(
                            quotaData.override_limit_gb
                        )
                );

            } else if (quotaError) {

                console.error(
                    '[SaaS] Erro ao carregar quota de armazenamento:',
                    quotaError
                );

            }

            setUsageStats(stats);
        } catch (e) {
            console.error("Error fetching stats", e);
        } finally {
            setStatsLoading(false);
        }
    };


    const handleSaveStorageOverride = async () => {

        if (!selectedCompany?.id) {
            return;
        }

        const value = Number(
            storageOverrideInput
                .replace(',', '.')
                .trim()
        );

        if (
            !Number.isFinite(value)
            || value <= 0
        ) {
            showToast(
                'Informe um limite válido em GB.',
                'error'
            );
            return;
        }

        try {

            const {
                data,
                error
            } = await supabase.rpc(
                'set_company_storage_limit_admin',
                {
                    target_company_id:
                        selectedCompany.id,

                    p_override_limit_gb:
                        value
                }
            );

            if (error) {
                throw error;
            }

            if (
                data
                && data.success === false
            ) {
                throw new Error(
                    data.error
                    || 'Falha ao salvar limite.'
                );
            }

            showToast(
                `Limite personalizado definido em ${value} GB.`,
                'success'
            );

            await fetchUsageStats(
                selectedCompany.id
            );

        } catch (error: any) {

            console.error(
                '[SaaS] Erro ao alterar quota:',
                error
            );

            showToast(
                error?.message
                || 'Não foi possível alterar o limite.',
                'error'
            );

        }

    };


    const handleResetStorageOverride = async () => {

        if (!selectedCompany?.id) {
            return;
        }

        if (
            !window.confirm(
                'Voltar a utilizar o limite de armazenamento definido pelo plano?'
            )
        ) {
            return;
        }

        try {

            const {
                data,
                error
            } = await supabase.rpc(
                'set_company_storage_limit_admin',
                {
                    target_company_id:
                        selectedCompany.id,

                    p_override_limit_gb:
                        null
                }
            );

            if (error) {
                throw error;
            }

            if (
                data
                && data.success === false
            ) {
                throw new Error(
                    data.error
                    || 'Falha ao restaurar limite.'
                );
            }

            setStorageOverrideInput('');

            showToast(
                'A empresa voltou a utilizar o limite do plano.',
                'success'
            );

            await fetchUsageStats(
                selectedCompany.id
            );

        } catch (error: any) {

            console.error(
                '[SaaS] Erro ao restaurar quota:',
                error
            );

            showToast(
                error?.message
                || 'Não foi possível restaurar o limite.',
                'error'
            );

        }

    };


    const fetchCompanyUsers = async (companyId: string) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('company_id', companyId);

        if (error) {
            console.error("Error fetching users", error);
        } else {
            // Map database columns to the component's expected Employee interface
            const mappedUsers = (data || []).map((user: any) => ({
                ...user,
                name: user.full_name,
                isCompanyAdmin: user.is_company_admin,
                avatarUrl: user.avatar_url
            }));
            setCompanyUsers(mappedUsers as unknown as Employee[]);
        }
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

    const handleAddUserToCompany = async () => {
        if (!selectedCompany?.id) return;

        const name = newUserForm.name.trim();
        const email = newUserForm.email.trim().toLowerCase();
        const password = newUserForm.password;

        if (!name || !email || !password) {
            showToast('Preencha nome, e-mail e senha.', 'error');
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showToast('Informe um e-mail válido.', 'error');
            return;
        }

        if (password.length < 6) {
            showToast('A senha deve ter pelo menos 6 caracteres.', 'error');
            return;
        }

        const planLimit = selectedCompany.plan?.userLimit;

        if (
            typeof planLimit === 'number'
            && planLimit > 0
            && companyUsers.filter(u => (u as any).status === 'active').length >= planLimit
        ) {
            showToast(
                `Limite de ${planLimit} usuários ativos atingido para este plano.`,
                'error'
            );
            return;
        }

        setIsSavingUser(true);

        try {
            const { data, error } = await supabase.rpc(
                'create_admin_user_for_company_safe',
                {
                    p_company_id: selectedCompany.id,
                    p_admin_email: email,
                    p_admin_password: password,
                    p_admin_name: name
                }
            );

            if (error) throw error;

            if (data && data.success === false) {
                throw new Error(
                    data.error || 'Não foi possível criar o usuário.'
                );
            }

            showToast(
                'Administrador criado com sucesso!',
                'success'
            );

            setIsAddingUser(false);

            setNewUserForm({
                name: '',
                email: '',
                password: ''
            });

            await fetchCompanyUsers(selectedCompany.id);

        } catch (err: any) {

            console.error(
                '[SaaS] Erro ao criar administrador:',
                err
            );

            showToast(
                err.message || 'Falha ao criar administrador.',
                'error'
            );

        } finally {
            setIsSavingUser(false);
        }
    };

    const toggleCompanyAdmin = async (
        userId: string,
        currentStatus: boolean
    ) => {
        const nextStatus = !currentStatus;

        if (currentStatus) {
            const otherAdmins = companyUsers.filter(
                u =>
                    u.id !== userId
                    && !!u.isCompanyAdmin
                    && (u as any).status === 'active'
            );

            if (otherAdmins.length === 0) {
                showToast(
                    'A empresa precisa manter pelo menos um Administrador da Empresa.',
                    'error'
                );
                return;
            }
        }

        try {
            const { data, error } = await supabase.rpc(
                'set_company_admin_safe',
                {
                    target_user_id: userId,
                    new_status: nextStatus
                }
            );

            if (error) throw error;

            if (data && data.success === false) {
                throw new Error(
                    data.error || 'Não foi possível alterar o administrador.'
                );
            }

            setCompanyUsers(prev =>
                prev.map(u =>
                    u.id === userId
                        ? {
                            ...u,
                            isCompanyAdmin: nextStatus,
                            is_company_admin: nextStatus
                        }
                        : u
                )
            );

            showToast(
                nextStatus
                    ? 'Usuário promovido a Administrador da Empresa.'
                    : 'Privilégio de Administrador da Empresa removido.',
                'success'
            );

        } catch (err: any) {

            console.error(
                '[SaaS] Erro ao alterar Company Admin:',
                err
            );

            showToast(
                err.message || 'Falha ao alterar privilégio.',
                'error'
            );
        }
    };

    const handleDeleteUser = async (userId: string, userEmail: string, userName: string) => {
        if (currentUser?.role !== 'Super Admin') {
            showToast('Apenas administradores master podem excluir usuários.', 'error');
            return;
        }

        const nameLabel = userName ? `${userName} (${userEmail})` : userEmail;
        if (!window.confirm(`ATENÇÃO: Deseja realmente excluir permanentemente o usuário "${nameLabel}" da empresa e de todo o banco de dados? Esta ação não pode ser desfeita.`)) {
            return;
        }

        try {
            console.log(`[SaaS] Excluindo usuário permanentemente: ${userId}`);
            const { data, error } = await supabase.rpc(
                'delete_user_admin_safe',
                { target_user_id: userId }
            );

            if (data && data.success === false) {
                throw new Error(
                    data.error || 'Não foi possível excluir o usuário.'
                );
            }

            if (error) throw error;

            showToast('Usuário excluído permanentemente!', 'success');
            if (selectedCompany?.id) {
                fetchCompanyUsers(selectedCompany.id);
            }
        } catch (err: any) {
            console.error("Erro ao excluir usuário:", err);
            showToast('Erro ao excluir: ' + (err.message || 'Falha na exclusão'), 'error');
        }
    };

    // --- Validação de Usuários ---
    const handleApproveUser = async (user: Employee) => {
        setIsValidating(user.id);
        try {
            const { data: rpcData, error: rpcError } = await supabase.rpc('approve_user_and_create_company', {
                p_user_id: user.id,
                p_plan_id: localPlans[0]?.id || null
            });

            if (rpcError) throw rpcError;
            if (rpcData && !rpcData.success) throw new Error(rpcData.error || 'Erro ao aprovar');

            showToast('Usuário aprovado com sucesso!', 'success');
            fetchData();
        } catch (error: any) {
            showToast('Erro ao aprovar: ' + error.message, 'error');
        } finally {
            setIsValidating(null);
        }
    };

    const handleRejectUser = async (userId: string) => {
        if (!confirm('Tem certeza que deseja rejeitar este acesso?')) return;
        setIsValidating(userId);
        try {
            const { data, error } = await supabase.rpc(
                'reject_user_admin',
                {
                    target_user_id: userId
                }
            );

            if (error) throw error;

            if (data && data.success === false) {
                throw new Error(
                    data.error || 'Falha ao rejeitar acesso'
                );
            }
            showToast('Acesso rejeitado.', 'info');
            fetchData();
        } catch (error: any) {
            showToast('Erro ao rejeitar: ' + error.message, 'error');
        } finally {
            setIsValidating(null);
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
        if (!selectedCompany?.id) return;

        try {
            const { data, error } = await supabase.rpc(
                'delete_company_admin',
                { target_company_id: selectedCompany.id }
            );

            if (error) throw error;

            if (data && data.success === false) {
                throw new Error(data.error || 'Não foi possível excluir a empresa.');
            }

            showToast('Empresa excluída com segurança.', 'success');
            await fetchData();
            closeModal();
        } catch (err: any) {
            console.error('[SaaS] Erro ao excluir empresa:', err);
            showToast(
                err.message || 'Não foi possível excluir a empresa.',
                'error'
            );
        }
    };
    const handleDeletePlan = async () => {
        if (!selectedPlanId) return;

        try {
            const { data, error } = await supabase.rpc(
                'delete_plan_admin',
                {
                    target_plan_id: selectedPlanId
                }
            );

            if (error) throw error;

            if (data && data.success === false) {
                throw new Error(
                    data.error || 'Falha ao excluir plano.'
                );
            }

            showToast(
                'Plano excluído com sucesso!',
                'success'
            );

            await fetchData();
            closeModal();

        } catch (error: any) {
            console.error(
                '[SaaS] Erro ao excluir plano:',
                error
            );

            showToast(
                error.message || 'Não foi possível excluir o plano.',
                'error'
            );
        }
    };

    // 2. CRIAR / ATUALIZAR EMPRESA
    const submitCompanyForm = async () => {
        if (modalOpen.createCompany) {
            const selectedPlan = localPlans.find(p => p.name === formData.plan);

            if (!formData.name || !formData.domain || !formData.responsibleEmail || !formData.adminPassword) {
                showToast('Preencha todos os campos obrigatórios (Nome, Domínio, E-mail e Senha)', 'error');
                return;
            }

            console.log("[SaaS] Chamando RPC create_company_with_admin_safe...");
            const { data: rpcData, error: rpcError } = await supabase.rpc('create_company_with_admin_safe', {
                p_company_name: formData.name,
                p_company_domain: formData.domain,
                p_company_cnpj: formData.cnpj || '',
                p_plan_id: selectedPlan?.id,
                p_admin_email: formData.responsibleEmail,
                p_admin_password: formData.adminPassword,
                p_admin_name: formData.responsibleName || formData.name
            });

            if (rpcError) {
                const errorMsg = `Erro RPC: ${rpcError.message} (Código: ${rpcError.code})`;
                showToast(errorMsg, 'error');
                console.error("RPC Error Details:", rpcError);
                return;
            }

            if (rpcData && !rpcData.success) {
                const errorMsg = `Erro no Banco: ${rpcData.error} (${rpcData.detail || ''})`;
                showToast(errorMsg, 'error');
                console.error("Database Business Error:", rpcData);
                return;
            }

            showToast('Empresa e Administrador criados com sucesso!', 'success');
            fetchData();
        } else if (modalOpen.edit && selectedCompany) {
            const selectedPlan = localPlans.find(
                p => p.name === formData.plan
            );

            const name = String(formData.name || '').trim();
            const domain = String(formData.domain || '')
                .trim()
                .toLowerCase();

            if (!name || !domain) {
                showToast(
                    'Informe nome e domínio da empresa.',
                    'error'
                );
                return;
            }

            if (!selectedPlan?.id) {
                showToast(
                    'Selecione um plano válido.',
                    'error'
                );
                return;
            }

            try {
                const { data, error } = await supabase.rpc(
                    'update_company_admin',
                    {
                        target_company_id: selectedCompany.id,
                        p_name: name,
                        p_domain: domain,
                        p_cnpj: formData.cnpj || null,
                        p_plan_id: selectedPlan.id
                    }
                );

                if (error) throw error;

                if (data && data.success === false) {
                    throw new Error(
                        data.error || 'Falha ao atualizar empresa.'
                    );
                }

                showToast(
                    'Empresa atualizada com sucesso!',
                    'success'
                );

                await fetchData();
                closeModal();

            } catch (error: any) {
                console.error(
                    '[SaaS] Erro ao atualizar empresa:',
                    error
                );

                showToast(
                    'Erro ao atualizar empresa: '
                    + (error.message || 'Falha desconhecida'),
                    'error'
                );
            }

            return;
        }

        closeModal();
    };

    // 3. DESATIVAR
    const handleDisableCompany = async () => {
        if (!selectedCompany?.id) return;

        const nextStatus =
            selectedCompany.status === 'inactive'
                ? 'active'
                : 'inactive';

        try {
            const { data, error } = await supabase.rpc(
                'set_company_status_admin',
                {
                    target_company_id: selectedCompany.id,
                    new_status: nextStatus
                }
            );

            if (error) throw error;

            if (data && data.success === false) {
                throw new Error(
                    data.error || 'Falha ao alterar status.'
                );
            }

            showToast(
                nextStatus === 'inactive'
                    ? 'Empresa desativada com sucesso!'
                    : 'Empresa reativada com sucesso!',
                'success'
            );

            await fetchData();
            closeModal();

        } catch (error: any) {
            console.error(
                '[SaaS] Erro ao alterar status:',
                error
            );

            showToast(
                'Erro ao alterar status: '
                + (error.message || 'Falha desconhecida'),
                'error'
            );
        }
    };

    // 4. ADICIONAR MÊS
    const handleAddMonth = async () => {
        if (!selectedCompany?.id) return;

        try {
            const { data, error } = await supabase.rpc(
                'extend_company_subscription_admin',
                {
                    target_company_id: selectedCompany.id,
                    days_to_add: 30
                }
            );

            if (error) throw error;

            if (data && data.success === false) {
                throw new Error(
                    data.error || 'Falha ao adicionar período.'
                );
            }

            showToast(
                '30 dias adicionados com sucesso!',
                'success'
            );

            await fetchData();
            closeModal();

        } catch (error: any) {
            console.error(
                '[SaaS] Erro ao adicionar período:',
                error
            );

            showToast(
                'Erro ao adicionar 30 dias: '
                + (error.message || 'Falha desconhecida'),
                'error'
            );
        }
    };


    // 5. ATUALIZAR CONFIGURAÇÃO (Recursos do Menu)
    const handleSaveConfig = async () => {
        if (!selectedCompany?.id) return;

        try {
            const { data, error } = await supabase.rpc(
                'update_company_features_admin',
                {
                    target_company_id: selectedCompany.id,
                    new_features: featuresState
                }
            );

            if (error) throw error;

            if (data && data.success === false) {
                throw new Error(
                    data.error || 'Falha ao atualizar módulos.'
                );
            }

            showToast(
                data?.changed === false
                    ? 'Nenhuma alteração nos módulos.'
                    : 'Módulos atualizados com sucesso!',
                'success'
            );

            await fetchData();
            closeModal();

        } catch (error: any) {
            console.error(
                '[SaaS] Erro ao atualizar módulos:',
                error
            );

            showToast(
                'Erro ao salvar módulos: '
                + (error.message || 'Falha desconhecida'),
                'error'
            );
        }
    };

    // 6. PLANOS (Criar/Editar)
    const submitPlanForm = async () => {
        const name = String(formData.name || '').trim();
        const userLimit = parseInt(formData.userLimit);
        const whatsappLimit = parseInt(formData.whatsappLimit || '0');
        const emailLimit = parseInt(formData.emailLimit || '0');
        const price = parseFloat(formData.price || '0');

        const storageLimit = parseFloat(
            String(
                formData.storageLimit || '10'
            ).replace(',', '.')
        );

        if (!name) {
            showToast('Informe o nome do plano.', 'error');
            return;
        }

        if (!Number.isFinite(userLimit) || userLimit < 1) {
            showToast(
                'O limite de usuários deve ser maior que zero.',
                'error'
            );
            return;
        }

        if (
            !Number.isFinite(storageLimit)
            || storageLimit <= 0
        ) {
            showToast(
                'O limite de armazenamento deve ser maior que zero.',
                'error'
            );
            return;
        }

        try {
            let data: any;
            let error: any;

            if (modalOpen.createPlan) {
                const result = await supabase.rpc(
                    'create_plan_admin',
                    {
                        p_name: name,
                        p_user_limit: userLimit,
                        p_whatsapp_limit: Number.isFinite(whatsappLimit) ? whatsappLimit : 0,
                        p_email_limit: Number.isFinite(emailLimit) ? emailLimit : 0,
                        p_price: Number.isFinite(price) ? price : 0,
                        p_features: featuresState
                    }
                );

                data = result.data;
                error = result.error;

            } else if (
                modalOpen.editPlan
                && selectedPlanId
            ) {
                const result = await supabase.rpc(
                    'update_plan_admin',
                    {
                        target_plan_id: selectedPlanId,
                        p_name: name,
                        p_user_limit: userLimit,
                        p_whatsapp_limit: Number.isFinite(whatsappLimit) ? whatsappLimit : 0,
                        p_email_limit: Number.isFinite(emailLimit) ? emailLimit : 0,
                        p_price: Number.isFinite(price) ? price : 0,
                        p_features: featuresState
                    }
                );

                data = result.data;
                error = result.error;

            } else {
                return;
            }

            if (error) throw error;

            if (data && data.success === false) {
                throw new Error(
                    data.error || 'Falha ao salvar plano.'
                );
            }

            const quotaPlanId =
                modalOpen.createPlan
                    ? data?.plan_id
                    : selectedPlanId;

            if (!quotaPlanId) {
                throw new Error(
                    'Não foi possível identificar o plano.'
                );
            }

            const {
                data: storageResult,
                error: storageError
            } = await supabase.rpc(
                'set_plan_storage_limit_admin',
                {
                    target_plan_id:
                        quotaPlanId,

                    p_storage_limit_gb:
                        storageLimit
                }
            );

            if (storageError) {
                throw storageError;
            }

            if (
                storageResult
                && storageResult.success === false
            ) {
                throw new Error(
                    storageResult.error
                    || 'Falha ao configurar armazenamento.'
                );
            }

            showToast(
                modalOpen.createPlan
                    ? 'Plano criado com sucesso!'
                    : 'Plano atualizado com sucesso!',
                'success'
            );

            await fetchData();
            closeModal();

        } catch (error: any) {
            console.error(
                '[SaaS] Erro ao salvar plano:',
                error
            );

            showToast(
                'Erro ao salvar plano: '
                + (error.message || 'Falha desconhecida'),
                'error'
            );
        }
    };

    const submitUpdateForm = async () => {
        if (!formData.version || !formData.description) {
            alert('Preencha os campos obrigatórios');
            return;
        }
        const { error } = await supabase.rpc(
            'publish_system_update_admin',
            {
                p_version: formData.version,
                p_description: formData.description,
                p_pdf_url: formData.pdf_url || null
            }
        );
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
            const { error } = await supabase.rpc(
                'delete_manual_video_admin',
                {
                    target_video_id: id
                }
            );
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
            const { error } = await supabase.rpc(
                'create_manual_video_admin',
                {
                    p_payload: {
                        title: formData.title,
                        url: formData.url,
                        thumbnail: formData.thumbnail,
                        duration: formData.duration,
                        category: formData.category,
                        description: formData.description
                    }
                }
            );
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
                .filter(c => c.status !== 'inactive' && c.status !== 'expired')
                .map(c => ({
                    company_id: c.id,
                    title: formData.title,
                    summary: formData.content, // Map content to summary
                    category: formData.type || 'info', // Map type to category
                    created_by: 'Super Admin',
                    date: new Date().toISOString()
                }));

            if (announcementsToInsert.length > 0) {
                const { data, error } = await supabase.rpc(
                    'broadcast_saas_announcement_admin',
                    {
                        p_title: formData.title.trim(),
                        p_summary: formData.content.trim(),
                        p_category: formData.category || 'Notícias da Empresa',
                        target_company_ids: null
                    }
                );

                if (data && data.success === false) {
                    throw new Error(
                        data.error || 'Falha ao enviar aviso.'
                    );
                }
                if (error) throw error;
                showToast(`Aviso enviado para ${announcementsToInsert.length} empresas!`, 'success');
                closeModal();
                await fetchData();
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

        const SelectLevelToggle = ({ label, id, icon: Icon }: { label: string, id: string, icon?: any }) => {
            const currentValue = featuresState[id];
            // Normalize: true -> 'complete', false/undefined/null -> 'disabled', string -> string
            let valStr = 'disabled';
            if (currentValue === true || currentValue === 'complete') valStr = 'complete';
            else if (currentValue === 'limited') valStr = 'limited';

            return (
                <div className="flex items-center justify-between py-3 px-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg transition-colors col-span-full md:col-span-1 border border-dashed border-gray-100 dark:border-gray-800 my-1">
                    <div className="flex items-center gap-3">
                        {Icon && <Icon className="w-5 h-5 text-brand-primary" />}
                        <span className="text-sm text-gray-700 dark:text-gray-200 font-bold">{label}</span>
                    </div>
                    <select
                        value={valStr}
                        onChange={(e) => {
                            const val = e.target.value;
                            setFeaturesState(prev => ({
                                ...prev,
                                [id]: val === 'complete' ? true : (val === 'disabled' ? false : 'limited')
                            }));
                        }}
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-brand-primary font-bold text-slate-700 dark:text-slate-200"
                    >
                        <option value="disabled">🚫 Desabilitado</option>
                        <option value="limited">⚠️ Com Limites</option>
                        <option value="complete">🚀 Completo</option>
                    </select>
                </div>
            );
        };

        const SectionTitle = ({ title }: { title: string }) => (
            <h5 className="font-bold text-gray-400 dark:text-gray-500 text-[10px] uppercase tracking-widest col-span-full mt-6 mb-2 border-b border-gray-100 dark:border-gray-700 pb-1">{title}</h5>
        );

        return (
            <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 max-h-[500px] overflow-y-auto custom-scrollbar">
                <SectionTitle title="Módulos Gerais" />
                <Toggle label="Feed de Notícias" id="feed" icon={NewspaperIcon} />
                <Toggle label="Banners de Destaque" id="banners" icon={NewspaperIcon} />
                <Toggle label="Mensagens / Chat" id="messages" icon={ChatBubbleLeftRightIcon} />
                <Toggle label="Calendário Corp." id="calendar" icon={CalendarDaysIcon} />
                <Toggle label="E-mail Integrado" id="email" icon={EnvelopeIcon} />
                <Toggle label="Módulo CRM" id="crm" icon={BuildingOfficeIcon} />
                <Toggle label="Marketplace" id="marketplace" icon={BuildingStorefrontIcon} />
                <Toggle label="Eventos" id="events" icon={CalendarDaysIcon} />

                <SelectLevelToggle label="Comercial" id="scheduling" icon={CalendarDaysIcon} />
                <Toggle label="Agenda (Visitas/Reuniões/Treinamentos)" id="new_agenda" icon={CalendarDaysIcon} />
                <Toggle label="Reservas (Salas/Veículos)" id="reservations" icon={BuildingOfficeIcon} />
                <SelectLevelToggle label="Gestão de Projetos" id="projects" icon={ClipboardDocumentCheckIcon} />

                <Toggle label="Métricas (KPIs)" id="kpis" icon={ChartBarIcon} />
                <Toggle label="WhatsPanda (CRM)" id="whatspanda" icon={ChatBubbleLeftRightIcon} />
                <Toggle label="Assistente IA (Panda)" id="ai_assistant" icon={SparklesIcon} />

                <SectionTitle title="Recursos de RH" />
                <Toggle label="Portal Meu RH" id="meu-rh" icon={BuildingOfficeIcon} />
                <Toggle label="Banco de Horas" id="timebank" icon={CalendarDaysIcon} />
                <Toggle label="Avaliações e Metas" id="performance" icon={SparklesIcon} />
                <Toggle label="Benefícios Individuais" id="employee_benefits" icon={HeartIcon} />
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
                <div role="tablist" aria-label="Seções do Painel SaaS" className="flex space-x-1 overflow-x-auto no-scrollbar tracking-wide uppercase">
                    <button id="saas-dashboard-tab-dashboard" role="tab" aria-selected={activeTab === 'dashboard'} tabIndex={activeTab === 'dashboard' ? 0 : -1} onKeyDown={handleTabKeyDown} onClick={() => setActiveTab('dashboard')} className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'dashboard' ? 'border-brand-primary text-brand-primary font-bold' : 'border-transparent text-gray-500'}`}>{t('dashboard.dashboard_tab')}</button>
                    <button id="saas-dashboard-tab-companies" role="tab" aria-selected={activeTab === 'companies'} tabIndex={activeTab === 'companies' ? 0 : -1} onKeyDown={handleTabKeyDown} onClick={() => setActiveTab('companies')} className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'companies' ? 'border-brand-primary text-brand-primary font-bold' : 'border-transparent text-gray-500'}`}>{t('dashboard.companies_tab')}</button>
                    <button id="saas-dashboard-tab-plans" role="tab" aria-selected={activeTab === 'plans'} tabIndex={activeTab === 'plans' ? 0 : -1} onKeyDown={handleTabKeyDown} onClick={() => setActiveTab('plans')} className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'plans' ? 'border-brand-primary text-brand-primary font-bold' : 'border-transparent text-gray-500'}`}>{t('dashboard.plans_tab')}</button>
                    <button id="saas-dashboard-tab-announcements" role="tab" aria-selected={activeTab === 'announcements'} tabIndex={activeTab === 'announcements' ? 0 : -1} onKeyDown={handleTabKeyDown} onClick={() => setActiveTab('announcements')} className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'announcements' ? 'border-brand-primary text-brand-primary font-bold' : 'border-transparent text-gray-500'}`}>{t('dashboard.announcements_tab')}</button>
                    <button id="saas-dashboard-tab-validations" role="tab" aria-selected={activeTab === 'validations'} tabIndex={activeTab === 'validations' ? 0 : -1} onKeyDown={handleTabKeyDown} onClick={() => setActiveTab('validations')} className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'validations' ? 'border-brand-primary text-brand-primary font-bold' : 'border-transparent text-gray-500'}`}>Validações {pendingUsers.length > 0 && <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingUsers.length}</span>}</button>
                    <button id="saas-dashboard-tab-settings" role="tab" aria-selected={activeTab === 'settings'} tabIndex={activeTab === 'settings' ? 0 : -1} onKeyDown={handleTabKeyDown} onClick={() => setActiveTab('settings')} className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'settings' ? 'border-brand-primary text-brand-primary font-bold' : 'border-transparent text-gray-500'}`}>{t('dashboard.settings_tab')}</button>
                </div>
                <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Versão</span>
                    <span className="text-sm font-bold text-brand-primary">{SYSTEM_VERSION}</span>
                </div>
            </div>

            <div className="p-8 flex-1">
                {/* DASHBOARD */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-7 animate-fadeIn">

                        {/* Executive SaaS Header */}
                        <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.07] via-transparent to-blue-500/[0.05] pointer-events-none" />

                            <div className="relative p-6 lg:p-8 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-14 h-14 shrink-0 rounded-2xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center shadow-sm">
                                        <ChartBarIcon className="w-7 h-7 text-emerald-600" />
                                    </div>

                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                                                Central SaaS
                                            </h2>

                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${dashboardError ? 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/30 dark:border-rose-900/40' : 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900/40'}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${dashboardError ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`} />
                                                {dashboardError ? 'Atenção necessária' : 'Operação ativa'}
                                            </span>
                                        </div>

                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-2xl">
                                            Visão executiva da operação do PandaNet, empresas, usuários, presença e distribuição dos planos.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => void fetchData()}
                                        disabled={loading}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 text-xs font-black text-slate-600 dark:text-slate-200 hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-50 transition-colors"
                                    >
                                        <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                        {loading ? 'Atualizando' : 'Atualizar dados'}
                                    </button>
                                    <div className="px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700">
                                        <p className="text-[9px] uppercase tracking-[0.14em] font-black text-slate-400">
                                            Empresas
                                        </p>
                                        <p className="text-lg font-black text-slate-800 dark:text-white">
                                            {totalCompanies}
                                        </p>
                                    </div>

                                    <div className="px-4 py-2.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
                                        <p className="text-[9px] uppercase tracking-[0.14em] font-black text-emerald-500">
                                            Online agora
                                        </p>
                                        <p className="text-lg font-black text-emerald-600">
                                            {onlineUsers}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="relative px-6 lg:px-8 pb-6 -mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                                <span>{lastUpdatedAt ? `Atualizado às ${lastUpdatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Aguardando primeira atualização'}</span>
                                {dashboardError && <span role="alert" className="font-bold text-rose-600">{dashboardError}</span>}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-slate-200/70 dark:border-slate-800 flex flex-col items-center text-center justify-center min-h-[160px]">
                                <p className="text-sm text-gray-500 font-medium">{t('dashboard.system_version')}</p>
                                <h2 className="text-4xl font-bold text-gray-800 dark:text-white mt-2">
                                    {SYSTEM_VERSION}
                                </h2>
                                <p className="text-xs text-emerald-500 mt-1 font-semibold">Versão em produção</p>
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                            <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Empresas ativas</p>
                                <p className="mt-2 text-3xl font-black text-emerald-600">{activeCompanyRate}%</p>
                                <p className="mt-1 text-xs text-slate-500">{activeCompaniesCount} de {totalCompanies} empresas</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Média de usuários</p>
                                <p className="mt-2 text-3xl font-black text-blue-600">{averageUsersPerCompany}</p>
                                <p className="mt-1 text-xs text-slate-500">usuários por empresa</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">WhatsPanda conectado</p>
                                <p className="mt-2 text-3xl font-black text-violet-600">{whatsappCoverage}%</p>
                                <p className="mt-1 text-xs text-slate-500">{whatsappStatus.count} sessões ativas</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setActiveTab('validations')}
                                className="text-left rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
                            >
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Validações pendentes</p>
                                <p className="mt-2 text-3xl font-black text-amber-500">{pendingUsers.length}</p>
                                <p className="mt-1 text-xs text-slate-500">Clique para revisar cadastros</p>
                            </button>
                        </div>

                        <div className="rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 lg:p-6 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white">Atividade da plataforma</h3>
                                    <p className="text-xs text-slate-500 mt-1">Indicadores consolidados diretamente dos serviços em produção.</p>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Dados reais</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                                {[
                                    ['Mensagens', operationalMetrics.totalMessages],
                                    ['No mês', operationalMetrics.monthlyMessages],
                                    ['Conversas', operationalMetrics.totalConversations],
                                    ['Contatos', operationalMetrics.totalContacts],
                                    ['Projetos', operationalMetrics.totalProjects],
                                    ['Eventos', operationalMetrics.totalEvents],
                                    ['Chamados', operationalMetrics.totalTickets],
                                    ['E-mails', operationalMetrics.totalEmails],
                                    ['Marketplace', operationalMetrics.marketplaceItems],
                                    ['Avisos', operationalMetrics.announcements],
                                    ['Treinamentos', operationalMetrics.trainingModules],
                                    ['Planos ativos', localPlans.length]
                                ].map(([label, value]) => (
                                    <div key={String(label)} className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700 p-4">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                                        <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{typeof value === 'number' ? value.toLocaleString('pt-BR') : '—'}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* CHARTS SECTION */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            {/* Growth Chart */}
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-slate-200/70 dark:border-slate-800">
                                <h3 className="text-base font-black tracking-tight text-slate-800 dark:text-white mb-1">{t('dashboard.company_growth')}</h3>
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
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-slate-200/70 dark:border-slate-800">
                                <h3 className="text-base font-black tracking-tight text-slate-800 dark:text-white mb-1">{t('dashboard.plan_distribution')}</h3>
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
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-slate-200/70 dark:border-slate-800">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                    <HeroChatBubbleLeftRightIcon className="w-6 h-6 text-green-500" />
                                    {t('sidebar.whatspanda')}
                                </h3>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${whatsappStatus.count > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {whatsappStatus.count} conexões ativas
                                </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {localCompanies.map(comp => {
                                    const isActive = (whatsappStatus.activeCompanyIds || []).includes(comp.id);
                                    return (
                                        <div key={comp.id} className={`p-3 rounded border flex items-center justify-between ${isActive ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                                            <span className="text-sm font-medium truncate">{comp.name}</span>
                                            <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                                        </div>
                                    )
                                })}
                            </div>
                            {whatsappStatus.connections.length > 0 && (
                                <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-700 grid grid-cols-1 lg:grid-cols-2 gap-3">
                                    {whatsappStatus.connections.map(connection => {
                                        const company = localCompanies.find(item => item.id === connection.companyId);
                                        return (
                                            <div key={connection.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{company?.name || connection.name}</p>
                                                    <p className="text-xs text-slate-500 truncate">{connection.name}{connection.phoneNumber ? ` · ${connection.phoneNumber}` : ''}</p>
                                                </div>
                                                <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${connection.connected ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                                    {connection.connected ? 'Conectado' : 'Desconectado'}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                    </div>
                )}

                {/* COMPANIES */}
                {activeTab === 'companies' && (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="flex items-center gap-2 mb-6">
                            <BuildingOfficeIcon className="w-5 h-5 text-gray-800 dark:text-white" />
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white">{t('dashboard.companies_tab')}</h2>
                        </div>
                        <div className="flex flex-col md:flex-row gap-4 items-center">
                            <div className="relative flex-1 w-full">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={t('dashboard.search_company')}
                                    className="w-full pl-8 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-none rounded text-sm focus:ring-1 focus:ring-brand-primary outline-none"
                                />
                                <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-gray-100 dark:bg-gray-700 border-none rounded py-2 px-4 text-sm w-full md:w-48 text-gray-600 outline-none"
                            >
                                <option value="all">{t('dashboard.status_all')}</option>
                                <option value="active">{t('dashboard.active_companies')}</option>
                                <option value="inactive">{t('dashboard.inactive_companies')}</option>
                            </select>
                            <button
                                onClick={() => openModal('createCompany')}
                                className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded text-sm font-bold uppercase tracking-wide flex items-center gap-2 transition-colors"
                            >
                                <PlusIcon className="w-4 h-4" /> Nova Empresa
                            </button>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/70 dark:border-slate-800 overflow-visible">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-gray-700 text-xs font-bold text-gray-500 uppercase">
                                            <th className="px-6 py-4">{t('dashboard.name')}</th>
                                            <th className="px-6 py-4">{t('dashboard.status')}</th>
                                            <th className="px-6 py-4">{t('dashboard.users')}</th>
                                            <th className="px-6 py-4">{t('dashboard.expiry')}</th>
                                            <th className="px-6 py-4">{t('dashboard.plan')}</th>
                                            <th className="px-6 py-4 text-center">{t('dashboard.actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-xs divide-y divide-gray-5 dark:divide-gray-700/50">
                                        {filteredCompanies.map((comp, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors">
                                                <td className="px-6 py-4 font-medium text-gray-700 dark:text-gray-300">{comp.name}</td>
                                                <td className="px-6 py-4">
                                                    {comp.status === 'inactive' ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-100 dark:bg-red-950/30 dark:border-red-900/50 font-bold">
                                                            <XMarkIcon className="w-3.5 h-3.5" />
                                                            Inativa
                                                        </span>
                                                    ) : comp.status === 'expired' ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-950/30 dark:border-amber-900/50 font-bold">
                                                            <CalendarDaysIcon className="w-3.5 h-3.5" />
                                                            Vencida
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900/50 font-bold">
                                                            <CheckCircleIcon className="w-3.5 h-3.5" />
                                                            Ativa
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 font-bold">
                                                    {/* We can fetch this individually or optimize later / For now let's use a sub-component to fetch */}
                                                    <CompanyUserCount companyId={comp.id} />
                                                </td>
                                                <td className="px-6 py-4 text-gray-500">{comp.subscriptionEndDate ? new Date(comp.subscriptionEndDate).toLocaleDateString() : '-'}</td>
                                                <td className="px-6 py-4 text-gray-500">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/50 font-bold">
                                                        {comp.plan?.name || 'Sem plano'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-center gap-2">

                                                        {/* Acesso Fantasma */}
                                                        {realProfile?.role === 'Super Admin' && onImpersonate && (
                                                            <ActionButton
                                                                icon={Ghost}
                                                                color="text-slate-800 dark:text-slate-100 hover:text-purple-600"
                                                                title="Acesso Fantasma"
                                                                onClick={() => onImpersonate(comp)}
                                                            />
                                                        )}

                                                        {/* Faturamento */}
                                                        <ActionButton
                                                            icon={BanknotesIcon}
                                                            color="text-emerald-600"
                                                            title="Faturamento / Mensalidades"
                                                            onClick={() => openModal('invoices', comp)}
                                                        />

                                                        {/* Adicionar período */}
                                                        <ActionButton
                                                            icon={CalendarDaysIcon}
                                                            color="text-blue-500"
                                                            title={t('dashboard.add_month')}
                                                            onClick={() => openModal('addMonth', comp)}
                                                        />

                                                        {/* Estatísticas */}
                                                        <ActionButton
                                                            icon={ChartPieIcon}
                                                            color="text-purple-500"
                                                            title={t('dashboard.stats')}
                                                            onClick={() => openModal('stats', comp)}
                                                        />

                                                        {/* Armazenamento */}
                                                        <ActionButton
                                                            icon={CloudIcon}
                                                            color="text-slate-500"
                                                            title="Uso de Disco / Armazenamento"
                                                            onClick={() => openModal('disk', comp)}
                                                        />

                                                        {/* Mais ações */}
                                                        <div className="relative group/actions">
                                                            <button
                                                                type="button"
                                                                title="Mais ações"
                                                                aria-label={`Mais ações para ${comp.name}`}
                                                                aria-haspopup="menu"
                                                                onClick={(event) => {
                                                                    const menu = document.getElementById(`company-actions-${comp.id}`) as (HTMLElement & { togglePopover?: () => void }) | null;
                                                                    if (!menu?.togglePopover) return;

                                                                    const trigger = event.currentTarget.getBoundingClientRect();
                                                                    const menuWidth = 320;
                                                                    const menuHeight = 360;
                                                                    const gutter = 12;
                                                                    const left = Math.max(gutter, Math.min(window.innerWidth - menuWidth - gutter, trigger.right - menuWidth));
                                                                    const top = trigger.bottom + menuHeight + gutter <= window.innerHeight
                                                                        ? trigger.bottom + 8
                                                                        : Math.max(gutter, trigger.top - menuHeight - 8);

                                                                    menu.style.left = `${left}px`;
                                                                    menu.style.top = `${top}px`;
                                                                    menu.togglePopover();
                                                                }}
                                                                className="list-none cursor-pointer w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all select-none"
                                                            >
                                                                <span className="text-xl leading-none tracking-widest -mt-1">•••</span>
                                                            </button>

                                                            <div
                                                                id={`company-actions-${comp.id}`}
                                                                {...({ popover: 'auto' } as any)}
                                                                role="menu"
                                                                className="fixed z-[10000] m-0 w-[min(320px,calc(100vw-24px))] max-h-[min(360px,calc(100vh-24px))] overflow-y-auto p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl backdrop:bg-transparent"
                                                            >
                                                                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                                                                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                                                                        Gerenciar empresa
                                                                    </p>
                                                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5 truncate">
                                                                        {comp.name}
                                                                    </p>
                                                                </div>

                                                                <div className="grid grid-cols-1 gap-0.5">

                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            (e.currentTarget.closest('[popover]') as (HTMLElement & { hidePopover?: () => void }) | null)?.hidePopover?.();
                                                                            openModal('disable', comp);
                                                                        }}
                                                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors"
                                                                    >
                                                                        <span className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center">
                                                                            <NoSymbolIcon className="w-4 h-4 text-orange-500" />
                                                                        </span>
                                                                        <div>
                                                                            <p className="font-bold">
                                                                                {comp.status === 'inactive'
                                                                                    ? 'Reativar Empresa'
                                                                                    : 'Desativar Empresa'}
                                                                            </p>
                                                                            <p className="text-[10px] text-slate-400">
                                                                                {comp.status === 'inactive'
                                                                                    ? 'Restaura o acesso da empresa'
                                                                                    : 'Bloqueia o acesso sem apagar dados'}
                                                                            </p>
                                                                        </div>
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            (e.currentTarget.closest('[popover]') as (HTMLElement & { hidePopover?: () => void }) | null)?.hidePopover?.();
                                                                            openModal('users', comp);
                                                                        }}
                                                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-teal-50 dark:hover:bg-teal-950/20 transition-colors"
                                                                    >
                                                                        <span className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center">
                                                                            <UserGroupIcon className="w-4 h-4 text-teal-500" />
                                                                        </span>
                                                                        <div>
                                                                            <p className="font-bold">Usuários da Empresa</p>
                                                                            <p className="text-[10px] text-slate-400">Usuários, administradores e permissões</p>
                                                                        </div>
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            (e.currentTarget.closest('[popover]') as (HTMLElement & { hidePopover?: () => void }) | null)?.hidePopover?.();
                                                                            openModal('config', comp);
                                                                        }}
                                                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-colors"
                                                                    >
                                                                        <span className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center">
                                                                            <AdjustmentsHorizontalIcon className="w-4 h-4 text-indigo-500" />
                                                                        </span>
                                                                        <div>
                                                                            <p className="font-bold">Configurar Módulos</p>
                                                                            <p className="text-[10px] text-slate-400">Recursos e menus liberados</p>
                                                                        </div>
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            (e.currentTarget.closest('[popover]') as (HTMLElement & { hidePopover?: () => void }) | null)?.hidePopover?.();
                                                                            openModal('edit', comp);
                                                                        }}
                                                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors"
                                                                    >
                                                                        <span className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
                                                                            <PencilIcon className="w-4 h-4 text-amber-500" />
                                                                        </span>
                                                                        <div>
                                                                            <p className="font-bold">Editar Empresa</p>
                                                                            <p className="text-[10px] text-slate-400">Cadastro, domínio, CNPJ e plano</p>
                                                                        </div>
                                                                    </button>

                                                                    <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            (e.currentTarget.closest('[popover]') as (HTMLElement & { hidePopover?: () => void }) | null)?.hidePopover?.();
                                                                            openModal('delete', comp);
                                                                        }}
                                                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                                                    >
                                                                        <span className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
                                                                            <TrashIcon className="w-4 h-4 text-red-500" />
                                                                        </span>
                                                                        <div>
                                                                            <p className="font-bold">Excluir Empresa</p>
                                                                            <p className="text-[10px] text-red-400">Somente empresas sem dados vinculados</p>
                                                                        </div>
                                                                    </button>

                                                                </div>
                                                            </div>
                                                        </div>
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
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white">{t('dashboard.plans_tab')}</h2>
                        </div>
                        <div className="flex justify-start mb-4">
                            <button onClick={() => openModal('createPlan')} className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded text-sm font-bold uppercase flex items-center gap-2"><PlusIcon className="w-4 h-4" /> Adicionar Plano</button>
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
                                            <span>{t('dashboard.capacity')} <strong>{plan.userLimit} {t('dashboard.users_plural')}</strong></span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                            <ChatBubbleLeftRightIcon className="w-4 h-4 text-blue-500" />
                                            <span>Limite WhatsApp: <strong>{plan.whatsappLimit ?? 0} canais</strong></span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                            <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                                            <span>{Object.values(plan.features || {}).filter(v => v === true).length} {t('dashboard.active_features')}</span>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-gray-50 dark:border-gray-700 flex items-center justify-between">
                                        <span className="text-sm text-gray-400 font-medium">{t('dashboard.investment')}</span>
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
                                <h2 className="text-xl font-bold text-gray-800 dark:text-white">{t('dashboard.settings_tab')}</h2>
                            </div>
                            <button
                                onClick={() => openModal('newUpdate')}
                                className="bg-red-500 hover:bg-red-600 text-white px-6 py-2.5 rounded text-sm font-bold uppercase flex items-center justify-center gap-2 transition-colors shadow-md w-full sm:w-auto"
                            >
                                <PlusIcon className="w-4 h-4" /> {t('dashboard.post_update')}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* LOGO CONFIGURATION */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col">
                                <div className="flex items-center gap-2 mb-6">
                                    <PhotoIcon className="w-5 h-5 text-gray-500" />
                                    <h3 className="text-lg font-bold text-gray-700 dark:text-white">{t('dashboard.system_logo')}</h3>
                                </div>

                                <div className="flex flex-col items-center justify-center flex-1 space-y-4">
                                    <div className="w-full max-w-[240px] h-32 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600 flex items-center justify-center overflow-hidden group relative">
                                        {systemLogo ? (
                                            <img src={systemLogo} alt="Logo Atual" className="max-h-24 w-auto object-contain transition-transform group-hover:scale-105" />
                                        ) : (
                                            <div className="text-center">
                                                <BuildingOfficeIcon className="w-10 h-10 text-gray-300 mx-auto" />
                                                    <p className="text-xs text-gray-400 mt-2">{t('dashboard.no_logo_defined')}</p>
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
                                            {logoFile ? t('dashboard.logo_selected') : t('dashboard.select_new_logo')}
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={handleLogoSelect}
                                                disabled={isSavingSettings}
                                            />
                                        </label>
                                        <p className="text-[10px] text-gray-400 text-center mt-2 italic">
                                            {t('dashboard.logo_hint')}
                                        </p>
                                    </div>

                                    {/* PANDA IA ICON */}
                                    <div className="w-full pt-6 border-t border-gray-100 dark:border-gray-700 mt-6 space-y-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <SparklesIcon className="w-4 h-4 text-emerald-500" />
                                            <h4 className="text-xs font-bold text-gray-700 dark:text-white uppercase tracking-widest">Ícone da Panda IA</h4>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 rounded-full border-2 border-emerald-500 overflow-hidden flex-shrink-0 bg-white dark:bg-gray-900 shadow-inner">
                                                {pandaIaIcon ? <img src={pandaIaIcon} className="w-full h-full object-cover"  alt="Identidade visual da empresa" /> : <img src="/logo.png" className="w-full h-full object-contain p-2"  alt="Identidade visual da empresa" />}
                                            </div>
                                            <div className="flex-1">
                                                <label className="block w-full text-center px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold cursor-pointer transition-all uppercase">
                                                    {iaIconFile ? 'Selecionado' : 'Mudar Ícone'}
                                                    <input type="file" className="hidden" accept="image/*,video/*" onChange={(e) => e.target.files && setIaIconFile(e.target.files[0])} disabled={isSavingSettings} />
                                                </label>
                                                <p className="text-[9px] text-gray-400 mt-1 italic leading-tight">PNG, GIF ou Vídeo Curto.</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* UPDATE DURATION SETTING */}
                                    <div className="w-full pt-4 border-t border-gray-100 dark:border-gray-700 mt-4 space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('dashboard.notification_duration')}</label>
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
                                                    <option value="hours">{t('dashboard.hours')}</option>
                                                    <option value="days">{t('dashboard.days')}</option>
                                                </select>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleSaveGeneralSettings}
                                            disabled={isSavingSettings}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold text-xs uppercase transition-all shadow-md disabled:opacity-50"
                                        >
                                            {isSavingSettings ? t('dashboard.saving') : t('dashboard.save_settings')}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* VIDEO TUTORIALS MANAGEMENT */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2">
                                        <PlayIcon className="w-5 h-5 text-emerald-500" />
                                        <h3 className="text-lg font-bold text-gray-700 dark:text-white">{t('dashboard.manual_videos')}</h3>
                                    </div>
                                    <button
                                        onClick={() => openModal('newVideo')}
                                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 uppercase"
                                    >
                                        {t('dashboard.new_video')}
                                    </button>
                                </div>

                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                                    {manualVideos.length === 0 ? (
                                        <p className="text-sm text-gray-400 italic">{t('dashboard.no_videos')}</p>
                                    ) : (
                                            manualVideos.map(vid => (
                                                <div key={vid.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-700 group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-12 h-8 bg-black rounded flex items-center justify-center overflow-hidden">
                                                            {vid.thumbnail && <img src={vid.thumbnail} className="w-full h-full object-cover opacity-60"  alt="Identidade visual da empresa" />}
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
                                <h3 className="text-lg font-bold text-gray-700 dark:text-white mb-4">{t('dashboard.version_history')}</h3>
                                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                                    {systemUpdates.length === 0 ? (
                                        <p className="text-sm text-gray-400 italic">{t('dashboard.no_updates')}</p>
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

                            {/* MANUAL PAGE CONFIGURATION */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6 xl:col-span-3">
                                <h3 className="text-lg font-bold text-gray-700 dark:text-white mb-6">Configurações da Central de Ajuda (Manual)</h3>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Master Banner Section */}
                                    <div className="space-y-4 col-span-1 lg:col-span-2 bg-brand-primary/5 dark:bg-brand-primary/10 p-6 rounded-xl border border-brand-primary/20">
                                        <div className="flex items-center justify-between border-b border-brand-primary/20 pb-2">
                                            <h4 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                                <SparklesIcon className="w-5 h-5 text-brand-primary" />
                                                Master Banner (Global)
                                            </h4>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Exibir Banner?</span>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={masterBannerData.isActive}
                                                        onChange={(e) => setMasterBannerData({ ...masterBannerData, isActive: e.target.checked })}
                                                    />
                                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                                                </label>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500">Este banner aparecerá no topo da tela inicial de <strong>todas as empresas</strong>. Use para Master Class, Ofertas da Matriz, etc.</p>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">URL de Redirecionamento (Link)</label>
                                                <input type="text" placeholder="Ex: https://grupopixel.com.br/oferta" value={masterBannerData.link} onChange={(e) => setMasterBannerData({ ...masterBannerData, link: e.target.value })} className="w-full p-2 border rounded text-sm bg-white dark:bg-gray-700 outline-none" />

                                                <label className="block text-xs font-bold text-gray-500 uppercase mt-4 mb-2">Imagem do Banner</label>
                                                <div className="flex items-center gap-4">
                                                    <label className="flex-1 text-center px-3 py-2 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-700 dark:text-white rounded text-xs font-bold cursor-pointer transition-all uppercase border border-dashed border-gray-300 dark:border-gray-500">
                                                        {masterBannerFile ? masterBannerFile.name : 'Subir Nova Imagem'}
                                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && setMasterBannerFile(e.target.files[0])} disabled={isSavingSettings} />
                                                    </label>
                                                </div>
                                                <p className="text-[10px] text-gray-400 mt-1 italic">Recomendado: 1200x300px (Banner horizontal largo).</p>
                                            </div>

                                            <div className="flex items-center justify-center bg-black/5 dark:bg-black/20 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-2 min-h-[120px]">
                                                {masterBannerFile ? (
                                                    <img src={URL.createObjectURL(masterBannerFile)} className="max-w-full max-h-[100px] object-contain rounded" alt="Preview Novo" />
                                                ) : masterBannerData.imageUrl ? (
                                                    <img src={masterBannerData.imageUrl} className="max-w-full max-h-[100px] object-contain rounded" alt="Master Banner Atual" />
                                                ) : (
                                                    <span className="text-xs text-gray-400 font-bold uppercase">Sem Imagem</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Promo Section */}
                                    <div className="space-y-4">
                                        <h4 className="font-bold text-gray-600 dark:text-gray-300 border-b pb-2">Banner Promocional (Rodapé)</h4>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título</label>
                                            <input type="text" value={manualPromo.title} onChange={(e) => setManualPromo({ ...manualPromo, title: e.target.value })} className="w-full p-2 border rounded text-sm bg-white dark:bg-gray-700 outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição</label>
                                            <textarea value={manualPromo.description} onChange={(e) => setManualPromo({ ...manualPromo, description: e.target.value })} className="w-full p-2 border rounded text-sm bg-white dark:bg-gray-700 outline-none h-20"></textarea>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tag (Ex: Destaque)</label>
                                                <input type="text" value={manualPromo.tag} onChange={(e) => setManualPromo({ ...manualPromo, tag: e.target.value })} className="w-full p-2 border rounded text-sm bg-white dark:bg-gray-700 outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">URL Imagem</label>
                                                <input type="text" value={manualPromo.image} onChange={(e) => setManualPromo({ ...manualPromo, image: e.target.value })} className="w-full p-2 border rounded text-sm bg-white dark:bg-gray-700 outline-none" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Links Section */}
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center border-b pb-2">
                                            <h4 className="font-bold text-gray-600 dark:text-gray-300">Links Importantes</h4>
                                            <button
                                                onClick={() => setManualLinks([...manualLinks, { id: Date.now().toString(), title: 'Novo Link', description: '', icon: 'BookOpenIcon', type: 'info' }])}
                                                className="text-xs font-bold text-emerald-600 flex items-center gap-1"
                                            >
                                                <PlusIcon className="w-4 h-4" /> Add Link
                                            </button>
                                        </div>

                                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                            {manualLinks.map((link, idx) => (
                                                <div key={link.id || idx} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 relative group">
                                                    <button
                                                        onClick={() => setManualLinks(manualLinks.filter((_, i) => i !== idx))}
                                                        className="absolute top-2 right-2 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <XMarkIcon className="w-4 h-4" />
                                                    </button>
                                                    <input type="text" value={link.title} onChange={(e) => {
                                                        const newLinks = [...manualLinks];
                                                        newLinks[idx].title = e.target.value;
                                                        setManualLinks(newLinks);
                                                    }} className="w-full p-1 mb-2 border-b bg-transparent text-sm font-bold outline-none" placeholder="Título" />
                                                    <input type="text" value={link.description} onChange={(e) => {
                                                        const newLinks = [...manualLinks];
                                                        newLinks[idx].description = e.target.value;
                                                        setManualLinks(newLinks);
                                                    }} className="w-full p-1 mb-2 border-b bg-transparent text-xs outline-none" placeholder="Descrição" />
                                                    <select value={link.icon} onChange={(e) => {
                                                        const newLinks = [...manualLinks];
                                                        newLinks[idx].icon = e.target.value;
                                                        setManualLinks(newLinks);
                                                    }} className="w-full p-1 bg-transparent text-xs text-gray-500 outline-none">
                                                        <option value="RocketLaunchIcon">Foguete</option>
                                                        <option value="AcademicCapIcon">Capelo (Academia)</option>
                                                        <option value="StarIcon">Estrela</option>
                                                        <option value="BookOpenIcon">Livro</option>
                                                        <option value="LightBulbIcon">Lâmpada</option>
                                                        <option value="QuestionMarkCircleIcon">Interrogação</option>
                                                    </select>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

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

                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                            <div>
                                <h3 className="font-black text-slate-900 dark:text-white">Histórico de transmissões</h3>
                                <p className="text-xs text-slate-500 mt-1">Últimos avisos enviados para as empresas.</p>
                            </div>
                            <span className="text-xs font-bold text-slate-400">{globalAnnouncements.length} registros</span>
                        </div>

                        {globalAnnouncements.length === 0 ? (
                            <div className="px-6 py-10 text-center text-sm text-slate-500">Nenhum aviso global enviado ainda.</div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                {globalAnnouncements.map(item => (
                                    <div key={item.id} className="px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-bold text-slate-900 dark:text-white">{item.title}</p>
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase">{item.category || 'Informativo'}</span>
                                            </div>
                                            <p className="text-sm text-slate-500 mt-1 line-clamp-2">{item.summary}</p>
                                            <p className="text-xs text-slate-400 mt-2">
                                                <span className="font-bold text-slate-500">Origem:</span> {item.origin || 'Administração PandaNet'}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-1">
                                                <span className="font-bold text-slate-500">Empresas:</span>{' '}
                                                {Array.isArray(item.recipientCompanies) && item.recipientCompanies.length > 0
                                                    ? item.recipientCompanies.join(', ')
                                                    : 'Destinatários não identificados'}
                                            </p>
                                        </div>
                                        <div className="shrink-0 lg:text-right">
                                            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{item.recipientCount} empresa(s)</p>
                                            <p className="text-[11px] text-slate-400 mt-1">{item.createdAt ? new Date(item.createdAt).toLocaleString('pt-BR') : 'Data indisponível'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

                {/* VALIDATIONS */}
                {activeTab === 'validations' && (
                    <div className="space-y-6 animate-fadeIn pb-20">
                        <div className="flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-gray-700 pb-4">
                            <ShieldCheckIcon className="w-6 h-6 text-brand-primary" />
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Validação de Cadastros</h2>
                                <p className="text-xs text-gray-500 mt-1">Aprove ou rejeite solicitações de acesso no sistema.</p>
                            </div>
                        </div>

                        {/* Sub-abas */}
                        <div className="flex gap-2 border-b border-gray-100 dark:border-gray-700 mb-6">
                            <button
                                onClick={() => setValidationSubTab('pending')}
                                className={`pb-3 px-4 text-sm font-bold transition-colors relative ${validationSubTab === 'pending'
                                        ? 'text-brand-primary border-b-2 border-brand-primary'
                                        : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                Pendentes
                                {pendingUsers.length > 0 && (
                                    <span className="ml-2 bg-yellow-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                        {pendingUsers.length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setValidationSubTab('rejected')}
                                className={`pb-3 px-4 text-sm font-bold transition-colors relative ${validationSubTab === 'rejected'
                                        ? 'text-red-500 border-b-2 border-red-500'
                                        : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                Rejeitados
                                {rejectedUsers.length > 0 && (
                                    <span className="ml-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                        {rejectedUsers.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* PENDENTES */}
                        {validationSubTab === 'pending' && (
                            pendingUsers.length === 0 ? (
                                <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-dashed border-gray-200 dark:border-gray-700">
                                    <CheckCircleIcon className="w-12 h-12 text-green-500/20 mx-auto mb-4" />
                                    <h3 className="text-lg font-bold text-gray-400">Tudo limpo por aqui!</h3>
                                    <p className="text-sm text-gray-400">Não há solicitações pendentes de validação no momento.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {pendingUsers.map((user: any) => (
                                        <div key={user.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col group hover:shadow-lg transition-all duration-300">
                                            <div className="p-6 flex-1">
                                                <div className="flex items-center gap-4 mb-4">
                                                    <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary font-bold text-lg">
                                                        {(user.full_name || user.email || '?')[0].toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="font-bold text-gray-800 dark:text-white truncate">{user.full_name || 'Usuário s/ Nome'}</h4>
                                                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                                                    </div>
                                                </div>
                                                <div className="space-y-3 pt-4 border-t border-gray-50 dark:border-gray-700/50">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-gray-400">Empresa Detectada:</span>
                                                        <span className="font-bold text-gray-600 dark:text-gray-300">
                                                            {user.company?.name || user.email?.split('@')[1] || 'Desconhecida'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-gray-400">Data do Cadastro:</span>
                                                        <span className="text-gray-600 dark:text-gray-300">
                                                            {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 flex gap-2">
                                                <button
                                                    onClick={() => handleRejectUser(user.id)}
                                                    disabled={!!isValidating}
                                                    className="flex-1 py-2 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border border-red-100 dark:border-red-900/30 disabled:opacity-50"
                                                >
                                                    Rejeitar
                                                </button>
                                                <button
                                                    onClick={() => handleApproveUser(user)}
                                                    disabled={!!isValidating}
                                                    className="flex-[2] py-2 rounded-lg text-xs font-bold text-white bg-brand-primary hover:bg-brand-primary/90 transition-all shadow-md hover:shadow-brand-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                                                >
                                                    {isValidating === user.id ? (
                                                        <ArrowPathIcon className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        <CheckCircleIcon className="w-3 h-3" />
                                                    )}
                                                    Aprovar Acesso
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    </div>
                            )
                        )}

                        {/* REJEITADOS */}
                        {validationSubTab === 'rejected' && (
                            rejectedUsers.length === 0 ? (
                                <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-dashed border-gray-200 dark:border-gray-700">
                                    <XMarkIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-bold text-gray-400">Nenhum usuário rejeitado</h3>
                                    <p className="text-sm text-gray-400">Usuários rejeitados aparecerão aqui e poderão ser reaprovados.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {rejectedUsers.map((user: any) => (
                                        <div key={user.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-red-100 dark:border-red-900/30 overflow-hidden flex flex-col group hover:shadow-lg transition-all duration-300">
                                            <div className="px-4 py-1.5 bg-red-50 dark:bg-red-900/20 flex items-center gap-1">
                                                <XMarkIcon className="w-3 h-3 text-red-400" />
                                                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Acesso Rejeitado</span>
                                            </div>
                                            <div className="p-6 flex-1">
                                                <div className="flex items-center gap-4 mb-4">
                                                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-400 font-bold text-lg">
                                                        {(user.full_name || user.email || '?')[0].toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="font-bold text-gray-800 dark:text-white truncate">{user.full_name || 'Usuário s/ Nome'}</h4>
                                                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                                                    </div>
                                                </div>
                                                <div className="space-y-3 pt-4 border-t border-gray-50 dark:border-gray-700/50">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-gray-400">Domínio:</span>
                                                        <span className="font-bold text-gray-600 dark:text-gray-300">
                                                            {user.email?.split('@')[1] || 'Desconhecido'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-gray-400">Rejeitado em:</span>
                                                        <span className="text-gray-600 dark:text-gray-300">
                                                            {user.updated_at ? new Date(user.updated_at).toLocaleDateString() : 'N/A'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-4 bg-gray-50 dark:bg-gray-700/30">
                                                <button
                                                    onClick={() => handleApproveUser(user)}
                                                    disabled={!!isValidating}
                                                    className="w-full py-2 rounded-lg text-xs font-bold text-white bg-green-500 hover:bg-green-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                                >
                                                    {isValidating === user.id ? (
                                                        <ArrowPathIcon className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        <CheckCircleIcon className="w-3 h-3" />
                                                    )}
                                                    Reativar Acesso
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}
                    </div>
                )}      {/* --- MODALS --- */}
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
                <Modal onClose={closeModal} title="Adicionar 30 dias" width="max-w-md">
                    <div className="p-6">
                        <p className="text-gray-600 mb-6">Adicionar <strong>30 dias</strong> ao vencimento de <strong>{selectedCompany.name}</strong>?</p>
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
                        <p className="text-gray-600 mb-3">
                            Tem certeza que deseja <strong className="text-red-600">excluir permanentemente</strong> a empresa <strong>{selectedCompany.name}</strong>?
                        </p>
                        <p className="text-xs text-red-500 mb-6">
                            Por segurança, empresas que possuam usuários ou qualquer dado vinculado não podem ser excluídas. Para empresas em uso, utilize Desativar.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button onClick={closeModal} className="px-4 py-2 bg-gray-500 text-white rounded text-xs font-bold uppercase">Cancelar</button>
                            <button onClick={handleDeleteCompany} className="px-6 py-2 bg-red-600 text-white rounded text-xs font-bold uppercase">Excluir</button>
                        </div>
                    </div>
                </Modal>
            )}

            {modalOpen.disable && selectedCompany && (
                <Modal
                    onClose={closeModal}
                    title={
                        selectedCompany.status === 'inactive'
                            ? 'Reativar Empresa'
                            : 'Desativar Empresa'
                    }
                    width="max-w-md"
                >
                    <div className="p-6">
                        <p className="text-gray-600 mb-2">
                            {selectedCompany.status === 'inactive'
                                ? <>Deseja reativar o acesso de <strong>{selectedCompany.name}</strong>?</>
                                : <>Deseja desativar o acesso de <strong>{selectedCompany.name}</strong>?</>}
                        </p>

                        <p className="text-xs text-gray-400 mb-6">
                            {selectedCompany.status === 'inactive'
                                ? 'A empresa voltará a acessar os recursos permitidos pelo plano.'
                                : 'Os dados serão preservados. Esta ação não exclui a empresa nem seus usuários.'}
                        </p>

                        <div className="flex justify-end gap-2">
                            <button
                                onClick={closeModal}
                                className="px-4 py-2 bg-gray-500 text-white rounded text-xs font-bold uppercase"
                            >
                                Cancelar
                            </button>

                            <button
                                onClick={handleDisableCompany}
                                className={
                                    selectedCompany.status === 'inactive'
                                        ? 'px-6 py-2 bg-emerald-600 text-white rounded text-xs font-bold uppercase'
                                        : 'px-6 py-2 bg-orange-500 text-white rounded text-xs font-bold uppercase'
                                }
                            >
                                {selectedCompany.status === 'inactive'
                                    ? 'Reativar'
                                    : 'Desativar'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
            {modalOpen.invoices && selectedCompany && (
                <Modal
                    onClose={closeModal}
                    title={`Mensalidades & Faturamento: ${selectedCompany.name}`}
                    width="max-w-xl"
                >
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                <p className="text-xs text-gray-400 font-bold uppercase">
                                    Plano Atual
                                </p>
                                <h4 className="text-base font-black text-gray-800 dark:text-white mt-1">
                                    {selectedCompany.plan?.name || 'Sem plano'}
                                </h4>
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                <p className="text-xs text-gray-400 font-bold uppercase">
                                    Valor Mensal
                                </p>
                                <h4 className="text-base font-black text-brand-primary mt-1">
                                    {typeof selectedCompany.plan?.price === 'number'
                                        ? selectedCompany.plan.price.toLocaleString('pt-BR', {
                                            style: 'currency',
                                            currency: 'BRL'
                                        })
                                        : 'Não informado'}
                                </h4>
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                <p className="text-xs text-gray-400 font-bold uppercase">
                                    Validade
                                </p>
                                <h4 className="text-base font-black text-gray-800 dark:text-white mt-1">
                                    {selectedCompany.subscriptionEndDate
                                        ? new Date(selectedCompany.subscriptionEndDate).toLocaleDateString('pt-BR')
                                        : 'Não definida'}
                                </h4>
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                <p className="text-xs text-gray-400 font-bold uppercase">
                                    Status
                                </p>
                                <h4 className="text-base font-black text-gray-800 dark:text-white mt-1">
                                    {selectedCompany.status || 'Não informado'}
                                </h4>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900/40">
                            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                                Histórico de faturamento ainda não configurado
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                                O PandaNet ainda não possui uma tabela de faturas ou pagamentos.
                                Nenhum pagamento será simulado e nenhuma validade será alterada por esta tela.
                            </p>
                        </div>

                        <div className="flex justify-end pt-4 border-t">
                            <button
                                onClick={closeModal}
                                className="px-4 py-2 bg-gray-500 text-white rounded text-xs font-bold uppercase"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {modalOpen.disk && selectedCompany && (
                <Modal
                    onClose={closeModal}
                    title={`Uso de Disco & Armazenamento: ${selectedCompany.name}`}
                    width="max-w-xl"
                >
                    <div className="p-6 space-y-6">
                        {statsLoading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <ArrowPathIcon className="w-10 h-10 text-brand-primary animate-spin" />
                                <p className="text-sm text-gray-500 mt-4">
                                    Calculando uso real...
                                </p>
                            </div>
                        ) : usageStats?.storage ? (
                            <>

                                {usageStats?.storageQuota && (() => {

                                    const quota =
                                        usageStats.storageQuota;

                                    const percentage =
                                        Math.min(
                                            Number(
                                                quota.percentage
                                                || 0
                                            ),
                                            100
                                        );

                                    const statusLabel =
                                        quota.status === 'limit'
                                            ? 'Limite atingido'
                                            : quota.status === 'critical'
                                                ? 'Crítico'
                                                : quota.status === 'warning'
                                                    ? 'Atenção'
                                                    : 'Normal';

                                    const barClass =
                                        quota.status === 'limit'
                                            ? 'bg-red-500'
                                            : quota.status === 'critical'
                                                ? 'bg-orange-500'
                                                : quota.status === 'warning'
                                                    ? 'bg-amber-500'
                                                    : 'bg-emerald-500';

                                    return (
                                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-5 bg-white dark:bg-slate-900 shadow-sm space-y-5">

                                            <div className="flex items-start justify-between gap-4">

                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                                        Quota comercial
                                                    </p>

                                                    <h4 className="text-xl font-black text-slate-900 dark:text-white mt-1">

                                                        {Number(
                                                            quota.used_gb
                                                            || 0
                                                        ).toFixed(2)}
                                                        {' '}GB

                                                        <span className="text-sm text-slate-400">
                                                            {' '}de{' '}
                                                            {Number(
                                                                quota.effective_limit_gb
                                                                || 0
                                                            ).toFixed(2)}
                                                            {' '}GB
                                                        </span>

                                                    </h4>
                                                </div>

                                                <span className={`
                                                    px-2.5
                                                    py-1
                                                    rounded-full
                                                    text-[10px]
                                                    font-black
                                                    uppercase
                                                    tracking-wider
                                                    border
                                                    ${
                                                        quota.status === 'limit'
                                                            ? 'bg-red-50 text-red-600 border-red-200'
                                                            : quota.status === 'critical'
                                                                ? 'bg-orange-50 text-orange-600 border-orange-200'
                                                                : quota.status === 'warning'
                                                                    ? 'bg-amber-50 text-amber-600 border-amber-200'
                                                                    : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                                    }
                                                `}>
                                                    {statusLabel}
                                                </span>

                                            </div>


                                            <div>

                                                <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">

                                                    <div
                                                        className={`
                                                            h-full
                                                            rounded-full
                                                            transition-all
                                                            ${barClass}
                                                        `}
                                                        style={{
                                                            width:
                                                                `${percentage}%`
                                                        }}
                                                    />

                                                </div>


                                                <div className="flex justify-between text-[11px] font-bold text-slate-400 mt-2">

                                                    <span>
                                                        {Number(
                                                            quota.percentage
                                                            || 0
                                                        ).toFixed(1)}
                                                        % utilizado
                                                    </span>

                                                    <span>
                                                        {Number(
                                                            quota.remaining_gb
                                                            || 0
                                                        ).toFixed(2)}
                                                        {' '}GB disponíveis
                                                    </span>

                                                </div>

                                            </div>


                                            {Number(
                                                quota.percentage
                                                || 0
                                            ) >= 80 && (

                                                <div className={`
                                                    p-3
                                                    rounded-xl
                                                    border
                                                    text-xs
                                                    font-medium
                                                    ${
                                                        Number(
                                                            quota.percentage
                                                            || 0
                                                        ) >= 100
                                                            ? 'bg-red-50 text-red-700 border-red-200'
                                                            : Number(
                                                                quota.percentage
                                                                || 0
                                                            ) >= 90
                                                                ? 'bg-orange-50 text-orange-700 border-orange-200'
                                                                : 'bg-amber-50 text-amber-700 border-amber-200'
                                                    }
                                                `}>

                                                    {Number(
                                                        quota.percentage
                                                        || 0
                                                    ) >= 100
                                                        ? 'Esta empresa atingiu o limite de armazenamento. Novos uploads autenticados serão bloqueados.'
                                                        : `A empresa já utilizou ${Number(quota.used_gb || 0).toFixed(2)} GB do limite de ${Number(quota.effective_limit_gb || 0).toFixed(2)} GB.`}

                                                </div>

                                            )}


                                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">

                                                <div className="flex items-end gap-2">

                                                    <div className="flex-1">

                                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                                                            Limite personalizado
                                                        </label>

                                                        <div className="relative">

                                                            <input
                                                                type="number"
                                                                min="0.1"
                                                                step="0.1"
                                                                value={
                                                                    storageOverrideInput
                                                                }
                                                                onChange={(e) =>
                                                                    setStorageOverrideInput(
                                                                        e.target.value
                                                                    )
                                                                }
                                                                placeholder={
                                                                    `Plano: ${Number(
                                                                        quota.plan_limit_gb
                                                                        || 0
                                                                    ).toFixed(2)} GB`
                                                                }
                                                                className="w-full p-2.5 pr-12 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 dark:bg-slate-800 dark:text-white"
                                                            />

                                                            <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                                                                GB
                                                            </span>

                                                        </div>

                                                    </div>


                                                    <button
                                                        type="button"
                                                        onClick={
                                                            handleSaveStorageOverride
                                                        }
                                                        className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black transition-colors"
                                                    >
                                                        Salvar
                                                    </button>

                                                </div>


                                                <div className="flex items-center justify-between mt-3 gap-4">

                                                    <p className="text-[10px] text-slate-400">

                                                        Limite do plano:{' '}
                                                        <strong>
                                                            {Number(
                                                                quota.plan_limit_gb
                                                                || 0
                                                            ).toFixed(2)}
                                                            {' '}GB
                                                        </strong>

                                                        {quota.override_limit_gb != null && (
                                                            <>
                                                                {' '}• Personalizado:{' '}
                                                                <strong>
                                                                    {Number(
                                                                        quota.override_limit_gb
                                                                    ).toFixed(2)}
                                                                    {' '}GB
                                                                </strong>
                                                            </>
                                                        )}

                                                    </p>


                                                    {quota.override_limit_gb != null && (

                                                        <button
                                                            type="button"
                                                            onClick={
                                                                handleResetStorageOverride
                                                            }
                                                            className="text-[10px] font-black text-purple-600 hover:underline shrink-0"
                                                        >
                                                            Usar limite do plano
                                                        </button>

                                                    )}

                                                </div>

                                            </div>

                                        </div>
                                    );

                                })()}

                                <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl border border-gray-100 dark:border-gray-700 space-y-4">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 dark:text-gray-400 font-bold">
                                            Espaço estimado da empresa
                                        </span>
                                        <span className="font-bold text-brand-primary">
                                            {Number(usageStats.storage.company_estimated_mb || 0).toFixed(2)} MB
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm border-t border-gray-100 dark:border-gray-700 pt-4">
                                        <span className="text-gray-500 dark:text-gray-400 font-bold">
                                            Registros estimados
                                        </span>
                                        <span className="font-bold text-gray-700 dark:text-gray-200">
                                            {Number(usageStats.storage.company_estimated_rows || 0).toLocaleString('pt-BR')}
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm border-t border-gray-100 dark:border-gray-700 pt-4">
                                        <span className="text-gray-500 dark:text-gray-400 font-bold">
                                            Banco completo na VPS
                                        </span>
                                        <span className="font-bold text-gray-700 dark:text-gray-200">
                                            {usageStats.storage.total_db_size_bytes
                                                ? (
                                                    Number(usageStats.storage.total_db_size_bytes)
                                                    / (1024 * 1024)
                                                ).toFixed(2)
                                                : '0.00'} MB
                                        </span>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-900/40">
                                    <p className="text-xs text-blue-700 dark:text-blue-300">
                                        Estes valores são calculados pelo banco através da função
                                        de métricas do PandaNet. Não são valores demonstrativos.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <div className="p-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900/40">
                                <p className="text-sm font-bold text-red-700 dark:text-red-300">
                                    Não foi possível carregar as métricas de armazenamento.
                                </p>
                            </div>
                        )}

                        <div className="flex justify-end pt-4 border-t">
                            <button
                                onClick={closeModal}
                                className="px-4 py-2 bg-gray-500 text-white rounded text-xs font-bold uppercase"
                            >
                                Fechar
                            </button>
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
                                <input type="text" placeholder={t('dashboard.whatsapp')} value={formData.whatsapp || ''} onChange={(e) => handleInputChange('whatsapp', e.target.value)} className="w-full p-3 border rounded text-sm outline-none focus:border-blue-500" />
                                    <div className="pt-4 border-t">
                                        <h4 className="font-bold text-gray-700 mb-2">Dados do Administrador da Empresa</h4>
                                        <input type="text" placeholder="Nome Completo do Admin" value={formData.responsibleName || ''} onChange={(e) => handleInputChange('responsibleName', e.target.value)} className="w-full p-3 border rounded text-sm mb-2" />
                                        <input type="email" placeholder="E-mail de Login do Admin" value={formData.responsibleEmail || ''} onChange={(e) => handleInputChange('responsibleEmail', e.target.value)} className="w-full p-3 border rounded text-sm mb-2" />
                                        <input type="password" placeholder="Senha de Acesso do Admin" value={formData.adminPassword || ''} onChange={(e) => handleInputChange('adminPassword', e.target.value)} className="w-full p-3 border rounded text-sm" />
                                        <p className="text-[10px] text-gray-400 mt-1 italic">* O administrador poderá alterar esses dados após o primeiro login.</p>
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
                            <div className="space-y-4 mb-8">
                                <h4 className="font-bold text-gray-700 dark:text-gray-200 border-b pb-2 mb-4">Detalhes do Plano</h4>

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nome do Plano</label>
                                    <input type="text" placeholder="Ex: Profissional" value={formData.name || ''} onChange={(e) => handleInputChange('name', e.target.value)} className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:bg-gray-800 dark:text-white" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Limite de Usuários</label>
                                        <input type="number" placeholder="Ex: 50" value={formData.userLimit || ''} onChange={(e) => handleInputChange('userLimit', e.target.value)} className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:bg-gray-800 dark:text-white" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Canais WhatsApp</label>
                                        <input type="number" placeholder="Ex: 5" value={formData.whatsappLimit || ''} onChange={(e) => handleInputChange('whatsappLimit', e.target.value)} className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:bg-gray-800 dark:text-white" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Limite de E-mails</label>
                                        <input type="number" placeholder="Ex: 5" value={formData.emailLimit || ''} onChange={(e) => handleInputChange('emailLimit', e.target.value)} className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:bg-gray-800 dark:text-white" />
                                    </div>
                                </div>


                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                                            Armazenamento (GB)
                                        </label>

                                        <input
                                            type="number"
                                            min="0.1"
                                            step="0.1"
                                            placeholder="Ex: 10"
                                            value={
                                                formData.storageLimit
                                                || '10'
                                            }
                                            onChange={(e) =>
                                                handleInputChange(
                                                    'storageLimit',
                                                    e.target.value
                                                )
                                            }
                                            className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:bg-gray-800 dark:text-white"
                                        />

                                        <p className="text-[10px] text-gray-400 mt-1">
                                            Limite total de arquivos da empresa.
                                        </p>
                                    </div>

<div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Valor Mensal (R$)</label>
                                    <input type="number" placeholder="Ex: 299.00" value={formData.price || ''} onChange={(e) => handleInputChange('price', e.target.value)} className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:bg-gray-800 dark:text-white" />
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
                            <div>
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    Gerencie usuários e Administradores da Empresa.
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    {companyUsers.filter(u => (u as any).status === 'active').length}
                                    {typeof selectedCompany.plan?.userLimit === 'number'
                                        ? ` de ${selectedCompany.plan.userLimit}`
                                        : ''} usuários ativos
                                    {selectedCompany.plan?.name
                                        ? ` • Plano ${selectedCompany.plan.name}`
                                        : ''}
                                </p>
                            </div>
                                <button
                                    onClick={() => setIsAddingUser(!isAddingUser)}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${isAddingUser ? 'bg-gray-500 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                                >
                                    {isAddingUser
                                        ? 'Cancelar'
                                        : <><PlusIcon className="w-4 h-4" /> Novo administrador</>}
                                </button>
                            </div>

                            {isAddingUser && (
                                <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-xl animate-fadeIn">
                                    <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-400 mb-3 flex items-center gap-2">
                                        <PlusIcon className="w-4 h-4" /> Novo Administrador da Empresa
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <input
                                            type="text"
                                            placeholder="Nome Completo"
                                            value={newUserForm.name}
                                            onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                                            className="p-2.5 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                        <input
                                            type="email"
                                            placeholder="E-mail"
                                            value={newUserForm.email}
                                            onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                                            className="p-2.5 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                        <input
                                            type="password"
                                            placeholder="Senha"
                                            value={newUserForm.password}
                                            onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                                            className="p-2.5 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                    </div>
                                    <div className="mt-4 flex justify-end">
                                        <button
                                            onClick={handleAddUserToCompany}
                                            disabled={isSavingUser}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2"
                                        >
                                            {isSavingUser
                                                ? <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                                : 'Criar administrador'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase font-bold text-gray-500">
                                    <tr>
                                        <th className="px-4 py-3">Nome</th>
                                        <th className="px-4 py-3">Email</th>
                                        <th className="px-4 py-3">Papel</th>
                                        <th className="px-4 py-3 text-center">Admin da Empresa</th>
                                        {currentUser?.role === 'Super Admin' && (
                                            <th className="px-4 py-3 text-center">Ações</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {companyUsers.length === 0 ? (
                                        <tr><td colSpan={currentUser?.role === 'Super Admin' ? 5 : 4} className="px-4 py-8 text-center text-gray-400">Nenhum usuário encontrado nesta empresa.</td></tr>
                                    ) : (
                                        companyUsers.map(user => (
                                            <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                                <td className="px-4 py-3 font-medium text-gray-800 dark:text-white flex items-center gap-2">
                                                    {user.avatarUrl && <img src={user.avatarUrl} className="w-6 h-6 rounded-full"  alt="Identidade visual da empresa" />}
                                                    {user.name || 'Sem Nome'}
                                                </td>
                                                <td className="px-4 py-3 text-gray-500">{user.email}</td>
                                                <td className="px-4 py-3 text-gray-500">{user.role || '-'}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => toggleCompanyAdmin(user.id, !!user.isCompanyAdmin)}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${user.isCompanyAdmin ? 'bg-purple-600' : 'bg-gray-200'}`}
                                                    >
                                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${user.isCompanyAdmin ? 'translate-x-6' : 'translate-x-1'}`} />
                                                    </button>
                                                </td>
                                                {currentUser?.role === 'Super Admin' && (
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => handleDeleteUser(user.id, user.email, user.name || '')}
                                                            className="text-red-500 hover:text-red-700 transition-colors p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20"
                                                            title="Excluir Usuário do Banco de Dados"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                )}
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

            {/* Global Announcement Modal */}
            {modalOpen.createAnnouncement && (
                <Modal onClose={closeModal} title="Novo Aviso Global" width="max-w-2xl">
                    <div className="p-6 space-y-5">
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            Este aviso será enviado para todas as empresas ativas. Revise o conteúdo antes de publicar.
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título</label>
                            <input
                                type="text"
                                maxLength={120}
                                value={formData.title || ''}
                                onChange={(event) => handleInputChange('title', event.target.value)}
                                placeholder="Ex: Manutenção programada"
                                className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm outline-none focus:border-emerald-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoria</label>
                            <select
                                value={formData.category || 'Notícias da Empresa'}
                                onChange={(event) => handleInputChange('category', event.target.value)}
                                className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm outline-none focus:border-emerald-500"
                            >
                                <option value="Notícias da Empresa">Notícia</option>
                                <option value="Manutenção">Manutenção</option>
                                <option value="Segurança">Segurança</option>
                                <option value="Atualização">Atualização</option>
                                <option value="Importante">Importante</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mensagem</label>
                            <textarea
                                rows={6}
                                maxLength={2000}
                                value={formData.content || ''}
                                onChange={(event) => handleInputChange('content', event.target.value)}
                                placeholder="Escreva o comunicado que será exibido às empresas..."
                                className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm outline-none focus:border-emerald-500 resize-y"
                            />
                            <p className="mt-1 text-right text-[11px] text-slate-400">{String(formData.content || '').length}/2000</p>
                        </div>
                    </div>
                    <div className="p-6 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
                        <button type="button" onClick={closeModal} disabled={loading} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 rounded-lg font-bold text-xs uppercase disabled:opacity-50">Cancelar</button>
                        <button
                            type="button"
                            onClick={submitAnnouncement}
                            disabled={loading || !String(formData.title || '').trim() || !String(formData.content || '').trim()}
                            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs uppercase shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Enviando...' : 'Enviar para todas'}
                        </button>
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
