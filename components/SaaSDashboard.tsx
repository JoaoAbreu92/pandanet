import React, { useState, useEffect } from 'react';
import type { Company, Plan, Employee } from '../types';
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
    ShieldCheckIcon
} from './icons';

interface SaaSDashboardProps {
    companies?: Company[]; // Keep for compatibility but we will fetch internal state
}

type TabType = 'dashboard' | 'companies' | 'plans' | 'settings';

const SaaSDashboard: React.FC<SaaSDashboardProps> = ({ companies = [] }) => {
    const [activeTab, setActiveTab] = useState<TabType>('dashboard');

    // --- State for Data & Filters ---
    const [localCompanies, setLocalCompanies] = useState<Company[]>([]);
    const [localPlans, setLocalPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [companyUsers, setCompanyUsers] = useState<Employee[]>([]); // State for users in modal

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'

    // --- Fetch Data ---
    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Plans
            const { data: plansData, error: plansError } = await supabase.from('plans').select('*');
            if (plansError) console.error('Error fetching plans', plansError);
            else setLocalPlans(plansData || []);

            // Fetch Companies
            const { data: companiesData, error: companiesError } = await supabase.from('companies').select('*, plan:plans(*)'); // Join plan
            if (companiesError) console.error('Error fetching companies', companiesError);
            else {
                // Fetch user counts for each company if possible, or just raw companies
                // Ideally we join profiles count, but for now just getting companies
                setLocalCompanies(companiesData as unknown as Company[] || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // --- Computed Data ---
    const filteredCompanies = localCompanies.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.domain.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' ? true :
            statusFilter === 'active' ? (c.status === 'active' || !c.status) :
                statusFilter === 'inactive' ? c.status === 'inactive' : true;
        return matchesSearch && matchesStatus;
    });

    // Metrics
    const totalCompanies = localCompanies.length;
    const activeCompaniesCount = localCompanies.filter(c => c.status !== 'inactive').length;
    const expiredCompaniesCount = localCompanies.filter(c => c.status === 'expired').length;
    const inactiveCompaniesCount = localCompanies.filter(c => c.status === 'inactive').length;
    const totalUsers = 0; // TODO: Count from profiles
    const onlineUsers = 0; // TODO

    // --- Modal State Management ---
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
            setFormData({ name: '', domain: '', whatsapp: '', plan: 'Standard', responsibleName: '', responsibleEmail: '' });
        } else if (type === 'edit' && company) {
            setFormData({ name: company.name, domain: company.domain });
        } else if (type === 'createPlan') {
            setFormData({ name: '', users: '', conn: '', val: '' });
            setFeaturesState({});
        } else if (type === 'editPlan' && planId) {
            const plan = localPlans.find(p => p.id === planId);
            if (plan) {
                setFormData({ name: plan.name, users: plan.users, conn: plan.conn, val: plan.val });
                setFeaturesState(plan.features || {});
            }
        } else if (type === 'config' && company) {
            // Load company features if they exist, otherwise default
            setFeaturesState({}); // In a real app, this would come from company.settings
        } else if (type === 'users' && company) {
            // Fetch users for this company
            fetchCompanyUsers(company.id!);
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

    // --- Actions ---

    // 1. DELETE
    const handleDeleteCompany = () => {
        if (selectedCompany) {
            setLocalCompanies(prev => prev.filter(c => c !== selectedCompany));
            closeModal();
        }
    };
    const handleDeletePlan = () => {
        if (selectedPlanId) {
            setLocalPlans(prev => prev.filter(p => p.id !== selectedPlanId));
            closeModal();
        }
    };

    // 2. CREATE / UPDATE COMPANY
    const submitCompanyForm = async () => {
        if (modalOpen.createCompany) {
            const selectedPlan = localPlans.find(p => p.name === formData.plan);

            const newCompany = {
                name: formData.name,
                status: 'active',
                cnpj: formData.cnpj, // Assuming added field
                plan_id: selectedPlan?.id,
                domain: formData.domain, // Ensure domain is sent
                responsible_name: formData.responsibleName,
                responsible_email: formData.responsibleEmail,
                subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                settings: { companyName: formData.name }
            };

            const { data, error } = await supabase.from('companies').insert([newCompany]).select();

            if (error) {
                alert('Erro ao criar empresa: ' + error.message);
                return;
            }
            if (data) {
                // If created successfully, we could try to assign the responsible user
                // But normally we'd create the user profile next.
                // Re-fetch logic or optimistically update
                fetchData();
            }
        } else if (modalOpen.edit && selectedCompany) {
            const { error } = await supabase.from('companies')
                .update({ name: formData.name, domain: formData.domain })
                .eq('id', selectedCompany.id);

            if (!error) fetchData();
        }
        closeModal();
    };

    // 3. DISABLE
    const handleDisableCompany = () => {
        if (selectedCompany) {
            setLocalCompanies(prev => prev.map(c => c === selectedCompany ? { ...c, status: 'inactive' } : c));
            closeModal();
        }
    };

    // 4. ADD MONTH
    const handleAddMonth = () => {
        if (selectedCompany) {
            setLocalCompanies(prev => prev.map(c => {
                if (c === selectedCompany) {
                    const currentEnd = c.subscriptionEndDate ? new Date(c.subscriptionEndDate) : new Date();
                    currentEnd.setMonth(currentEnd.getMonth() + 1);
                    return { ...c, subscriptionEndDate: currentEnd.toISOString() };
                }
                return c;
            }));
            closeModal();
        }
    };

    // 5. UPDATE CONFIG (Menu Features)
    const handleSaveConfig = () => {
        // In a real app we would save 'featuresState' to the company settings
        console.log("Saving features for company", selectedCompany?.name, featuresState);
        closeModal();
    };

    // 6. PLANS (Create/Edit)
    // 6. PLANS (Create/Edit)
    const submitPlanForm = async () => {
        const planData = {
            name: formData.name,
            user_limit: parseInt(formData.users) || 0,
            price: parseFloat(formData.val) || 0,
            features: featuresState
        };

        if (modalOpen.createPlan) {
            const { error } = await supabase.from('plans').insert([planData]);
            if (error) alert('Erro ao criar plano: ' + error.message);
            else fetchData();
        } else if (modalOpen.editPlan && selectedPlanId) {
            const { error } = await supabase.from('plans').update(planData).eq('id', selectedPlanId);
            if (error) alert('Erro ao atualizar plano: ' + error.message);
            else fetchData();
        }
        closeModal();
    };


    // --- Generic Handlers ---
    const handleInputChange = (field: string, value: string) => {
        setFormData((prev: any) => ({ ...prev, [field]: value }));
    };

    const handleFeatureToggle = (feature: string) => {
        setFeaturesState(prev => ({ ...prev, [feature]: !prev[feature] }));
    };


    // --- Subcomponents within Scope ---
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
        const Toggle = ({ label, id }: { label: string, id: string }) => (
            <div className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-600 font-medium">{label}</span>
                <div
                    onClick={() => handleFeatureToggle(id)}
                    className="relative inline-flex items-center cursor-pointer"
                >
                    <input type="checkbox" checked={!!featuresState[id]} readOnly className="sr-only peer" />
                    <div className={`w-11 h-6 rounded-full peer peer-focus:outline-none transition-colors ${featuresState[id] ? 'bg-blue-600' : 'bg-gray-200'} after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${featuresState[id] ? 'after:translate-x-full after:border-white' : ''}`}></div>
                </div>
            </div>
        );

        return (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2 max-h-[400px] overflow-y-auto">
                <h5 className="font-bold text-gray-700 col-span-full mb-2">Opções do Menu</h5>
                <Toggle label="Feed de Notícias" id="feed" />
                <Toggle label="Mensagens" id="messages" />
                <Toggle label="Calendário" id="calendar" />
                <Toggle label="Marketplace" id="marketplace" />
                <Toggle label="Bem Estar" id="wellness" />
                <Toggle label="Eventos" id="events" />

                <h5 className="font-bold text-gray-700 col-span-full mt-4 mb-2">Recursos de RH</h5>
                <Toggle label="Benefícios" id="benefits" />
                <Toggle label="Políticas" id="policies" />
                <Toggle label="Mural" id="wall" />

                <h5 className="font-bold text-gray-700 col-span-full mt-4 mb-2">Recursos de TI</h5>
                <Toggle label="Chamados" id="tickets" />
                <Toggle label="Equipamentos" id="equip" />
                <Toggle label="Base de Conhecimento" id="kb" />
            </div>
        );
    }


    return (
        <div className="bg-gray-50/50 dark:bg-gray-900 min-h-screen flex flex-col font-sans relative">
            <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 px-8 pt-2">
                <div className="flex space-x-1 overflow-x-auto no-scrollbar tracking-wide uppercase">
                    <button onClick={() => setActiveTab('dashboard')} className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'dashboard' ? 'border-brand-primary text-brand-primary font-bold' : 'border-transparent text-gray-500'}`}>DASHBOARD</button>
                    <button onClick={() => setActiveTab('companies')} className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'companies' ? 'border-brand-primary text-brand-primary font-bold' : 'border-transparent text-gray-500'}`}>EMPRESAS</button>
                    <button onClick={() => setActiveTab('plans')} className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'plans' ? 'border-brand-primary text-brand-primary font-bold' : 'border-transparent text-gray-500'}`}>PLANOS</button>
                    <button onClick={() => setActiveTab('settings')} className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'settings' ? 'border-brand-primary text-brand-primary font-bold' : 'border-transparent text-gray-500'}`}>CONFIGURAÇÕES</button>
                </div>
            </div>

            <div className="p-8 flex-1 overflow-y-auto">
                {/* DASHBOARD */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center text-center justify-center min-h-[160px]">
                                <p className="text-sm text-gray-500 font-medium">Versão do Sistema</p>
                                <h2 className="text-4xl font-bold text-gray-800 dark:text-white mt-2">1.0</h2>
                                <p className="text-xs text-green-500 mt-1 font-semibold">Sistema Atualizado</p>
                            </div>
                            <MetricCardSimple title="Empresas Cadastradas" value={totalCompanies} icon={BuildingOfficeIcon} />
                            <MetricCardSimple title="Empresas Ativas" value={activeCompaniesCount} icon={CheckCircleIcon} />
                            <MetricCardSimple title="Empresas Vencidas" value={expiredCompaniesCount} icon={UserGroupIcon} />
                            <MetricCardSimple title="Empresas Inativas" value={inactiveCompaniesCount} icon={LockClosedIcon} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <MetricCardSimple title="Total de Usuários" value={totalUsers} icon={UserGroupIcon} />
                            <MetricCardSimple title="Usuários Online" value={onlineUsers} icon={UsersIcon} />
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
                                            <th className="px-6 py-4">Vencimento</th>
                                            <th className="px-6 py-4">Plano</th>
                                            <th className="px-6 py-4 text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-xs divide-y divide-gray-50 dark:divide-gray-700/50">
                                        {filteredCompanies.map((comp, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                <td className="px-6 py-4 font-medium text-gray-700 dark:text-gray-300">{comp.name}</td>
                                                <td className="px-6 py-4">
                                                    {comp.status === 'inactive' ? <XCircle /> : <CheckCircle />}
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
                        <div className="bg-white dark:bg-gray-800 rounded shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="border-b border-gray-100 text-xs font-bold text-gray-500 uppercase">
                                    <tr>
                                        <th className="px-6 py-4">Nome</th>
                                        <th className="px-6 py-4 text-center">Usuários</th>
                                        <th className="px-6 py-4 text-center">Conexões</th>
                                        <th className="px-6 py-4 text-right">Valor</th>
                                        <th className="px-6 py-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs divide-y divide-gray-50">
                                    {localPlans.map(plan => (
                                        <tr key={plan.id}>
                                            <td className="px-6 py-4 font-medium">{plan.name}</td>
                                            <td className="px-6 py-4 text-center">{plan.users}</td>
                                            <td className="px-6 py-4 text-center">{plan.conn}</td>
                                            <td className="px-6 py-4 text-right">{plan.val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-3 text-green-500">
                                                    <button onClick={() => openModal('editPlan', null, plan.id)} className="hover:text-blue-600"><PencilIcon className="w-4 h-4" /></button>
                                                    <button onClick={() => openModal('deletePlan', null, plan.id)} className="hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* --- MODALS --- */}
            {modalOpen.invoices && selectedCompany && (
                <Modal onClose={closeModal} title="Faturas em Aberto">
                    <div className="p-4">
                        <div className="bg-yellow-50 text-yellow-800 p-3 rounded mb-4 text-sm font-medium border border-yellow-200">
                            Simulação: Visualize e gerencie as faturas desta empresa.
                        </div>
                        <table className="w-full text-xs text-left">
                            <thead className="border-b border-gray-200"><tr><th className="py-2">Plano</th><th className="py-2">Valor</th><th className="py-2">Status</th><th className="py-2 text-right">Ações</th></tr></thead>
                            <tbody>
                                <tr>
                                    <td className="py-3">{selectedCompany.plan?.name || 'Standard'}</td>
                                    <td className="py-3">R$ 330,00</td>
                                    <td className="py-3"><span className="bg-yellow-300 text-yellow-900 px-2 py-1 font-bold rounded">ABERTO</span></td>
                                    <td className="py-3 text-right flex justify-end gap-2">
                                        <button className="text-green-600 hover:bg-green-50 p-1" title="Pagar"><CurrencyDollarIcon className="w-5 h-5" /></button>
                                        <button className="text-red-500 hover:bg-red-50 p-1" title="Excluir"><TrashIcon className="w-5 h-5" /></button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
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
                        <input type="text" placeholder="Nome da Empresa" value={formData.name || ''} onChange={(e) => handleInputChange('name', e.target.value)} className="w-full p-3 border rounded text-sm outline-none focus:border-blue-500" />
                        <input type="text" placeholder="Domínio" value={formData.domain || ''} onChange={(e) => handleInputChange('domain', e.target.value)} className="w-full p-3 border rounded text-sm outline-none focus:border-blue-500" />
                        {modalOpen.createCompany && (
                            <>
                                <input type="text" placeholder="Whatsapp" value={formData.whatsapp || ''} onChange={(e) => handleInputChange('whatsapp', e.target.value)} className="w-full p-3 border rounded text-sm outline-none focus:border-blue-500" />
                                <div className="pt-4 border-t"><h4 className="font-bold text-gray-700 mb-2">Responsável</h4>
                                    <input type="text" placeholder="Nome" value={formData.responsibleName || ''} onChange={(e) => handleInputChange('responsibleName', e.target.value)} className="w-full p-3 border rounded text-sm mb-2" />
                                    <input type="email" placeholder="Email" value={formData.responsibleEmail || ''} onChange={(e) => handleInputChange('responsibleEmail', e.target.value)} className="w-full p-3 border rounded text-sm" />
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
                                <div className="grid grid-cols-3 gap-3">
                                    <input type="number" placeholder="Max Usuários" value={formData.users || ''} onChange={(e) => handleInputChange('users', e.target.value)} className="w-full p-3 border rounded text-sm" />
                                    <input type="number" placeholder="Max Conexões" value={formData.conn || ''} onChange={(e) => handleInputChange('conn', e.target.value)} className="w-full p-3 border rounded text-sm" />
                                    <input type="number" placeholder="Valor (R$)" value={formData.val || ''} onChange={(e) => handleInputChange('val', e.target.value)} className="w-full p-3 border rounded text-sm" />
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

        </div>
    );
};

// --- Helper Components ---
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

const CheckCircle = () => (<div className="w-4 h-4 rounded-full border border-green-500 flex items-center justify-center mx-auto"><div className="w-2 h-2 bg-green-500 rounded-full"></div></div>);
const XCircle = () => (<div className="w-4 h-4 rounded-full border border-red-500 flex items-center justify-center mx-auto"><div className="w-2 h-2 bg-red-500 rounded-full"></div></div>);

export default SaaSDashboard;
