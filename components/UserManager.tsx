import React, { useState } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Card from './Card';
import type { Employee, Plan } from '../types';
import {
    PlusIcon,
    PencilIcon,
    TrashIcon,
    XCircleIcon,
    ShieldCheckIcon,
    IdentificationIcon,
    ChatBubbleLeftRightIcon,
    EnvelopeIcon,
    SparklesIcon,
    BuildingOfficeIcon,
    CalendarDaysIcon,
    UsersIcon,
    DocumentTextIcon,
    HeartIcon,
    RocketLaunchIcon,
    StarIcon,
    FolderIcon,
    LifebuoyIcon,
    TicketIcon,
    Cog6ToothIcon,
    ClockIcon,
    BriefcaseIcon,
    AcademicCapIcon,
    BookOpenIcon,
    ArrowPathIcon
} from './icons';
import { useLanguage } from './LanguageContext';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import type { Department } from '../types';

interface UserManagerProps {
    users: Employee[];
    setUsers: (users: Employee[]) => void;
    plan: Plan;
    departments: Department[];
}

const PermissionToggle: React.FC<{
    label: string,
    name: string,
    checked: boolean,
    onChange: (name: string, checked: boolean) => void,
    icon?: React.ReactNode
}> = ({ label, name, checked, onChange, icon }) => (
    <div
        onClick={() => onChange(name, !checked)}
        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer group ${checked
                ? 'bg-emerald-50 border-emerald-100 shadow-sm'
                : 'bg-white border-gray-100 hover:border-emerald-100'
            }`}
    >
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg transition-colors ${checked ? 'bg-emerald-500 text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-emerald-50 group-hover:text-emerald-500'}`}>
                {icon}
            </div>
            <span className={`text-xs font-bold transition-colors ${checked ? 'text-emerald-900' : 'text-gray-500'}`}>
                {label}
            </span>
        </div>
        <div className={`w-10 h-5 rounded-full relative transition-colors ${checked ? 'bg-emerald-500' : 'bg-gray-200'}`}>
            <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${checked ? 'right-0.5' : 'left-0.5'}`} />
        </div>
    </div>
);

const UserFormModal: React.FC<{
    user: Partial<Employee> | null;
    departments: Department[];
    users: Employee[];
    plan: Plan;
    onClose: () => void;
    onSave: (user: Omit<Employee, 'id'> | Employee) => void;
}> = ({ user, departments, users, plan, onClose, onSave }) => {
    const { t } = useLanguage();
    const { profile } = useAuth();
    const [channels, setChannels] = useState<any[]>([]);

    React.useEffect(() => {
        if (profile?.company_id) {
            supabase.from('whatsapp_settings')
                .select('id, instance_name, phone_number')
                .eq('company_id', profile.company_id)
                .then(({ data }) => {
                    if (data) setChannels(data);
                });
        }
    }, [profile?.company_id]);

    const totalAllocatedOtherUsers = users
        .filter(u => u.id !== user?.id)
        .reduce((sum, u) => sum + (u.email_permissions?.account_limit || 0), 0);
    const planEmailLimit = plan?.emailLimit ?? 0;
    const remainingLimit = Math.max(0, planEmailLimit - totalAllocatedOtherUsers);

    const [permissionTab, setPermissionTab] = useState<'social' | 'rh' | 'ti' | 'rh_admin' | 'whatspanda' | 'admin_panel'>('social');

    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        password: user?.password || '',
        role: user?.role || '',
        team: user?.team || '',
        sectorManager: user?.sectorManager || '',
        employeeManager: user?.employeeManager || '',
        reports_to: user?.reports_to || '',
        sector_manager_id: user?.sector_manager_id || '',
        isAdmin: user?.isAdmin || false,
        is_manager: user?.is_manager || false,
        avatarUrl: user?.avatarUrl || '',
        birthDate: user?.birthDate || '1990-01-01',
        joinDate: user?.joinDate || new Date().toISOString().split('T')[0],
        department_id: user?.department_id || '',
        permissions: {
            viewMessages: user?.permissions?.viewMessages ?? true,
            viewCalendar: user?.permissions?.viewCalendar ?? true,
            useMarketplace: user?.permissions?.useMarketplace ?? true,
            viewEmail: user?.permissions?.viewEmail ?? true,
            viewWhatsPanda: user?.permissions?.viewWhatsPanda ?? (user?.is_whatsapp_agent ?? false),
            viewScheduling: user?.permissions?.viewScheduling ?? true,
            viewDirectory: user?.permissions?.viewDirectory ?? true,
            viewForms: user?.permissions?.viewForms ?? true,
            viewBenefits: user?.permissions?.viewBenefits ?? true,
            viewOnboarding: user?.permissions?.viewOnboarding ?? true,
            viewRecognition: user?.permissions?.viewRecognition ?? true,
            viewDocuments: user?.permissions?.viewDocuments ?? true,
            viewTraining: user?.permissions?.viewTraining ?? true,
            viewSurveys: user?.permissions?.viewSurveys ?? true,
            viewPolicies: user?.permissions?.viewPolicies ?? true,
            viewWellbeing: user?.permissions?.viewWellbeing ?? true,
            viewMeuRH: user?.permissions?.viewMeuRH ?? true,
            viewJobs: user?.permissions?.viewJobs ?? true,
            viewOrgChart: user?.permissions?.viewOrgChart ?? true,
            viewKPIDashboard: user?.permissions?.viewKPIDashboard ?? true,
            manageKPIs: user?.permissions?.manageKPIs ?? false,
            viewReservations: user?.permissions?.viewReservations ?? true,
            viewAgenda: user?.permissions?.viewAgenda ?? true,
            viewTiDashboard: user?.permissions?.viewTiDashboard ?? false,
            openTickets: user?.permissions?.openTickets ?? true,
            openTiRequests: user?.permissions?.openTiRequests ?? true,
            viewKnowledgeBase: user?.permissions?.viewKnowledgeBase ?? true,
            viewServiceStatus: user?.permissions?.viewServiceStatus ?? true,
            viewInfoSec: user?.permissions?.viewInfoSec ?? true,
            createEvents: user?.permissions?.createEvents ?? false,
            manageMarketplace: user?.permissions?.manageMarketplace ?? false,
            viewEmployeeDetails: user?.permissions?.viewEmployeeDetails ?? false,
            editEmployeeProfile: user?.permissions?.editEmployeeProfile ?? false,
            deleteEmployeeProfile: user?.permissions?.deleteEmployeeProfile ?? false,
            viewVacationRequests: user?.permissions?.viewVacationRequests ?? false,
            manageVacationRequests: user?.permissions?.manageVacationRequests ?? false,
            canPostText: user?.permissions?.canPostText ?? true,
            canPostImage: user?.permissions?.canPostImage ?? true,
            canPostVideo: user?.permissions?.canPostVideo ?? true,
            viewProjects: user?.permissions?.viewProjects ?? true,
            viewTimeBank: user?.permissions?.viewTimeBank ?? true,
            manageTimeBank: user?.permissions?.manageTimeBank ?? false,
            viewEmployeeBenefitsAdmin: user?.permissions?.viewEmployeeBenefitsAdmin ?? false,
            viewPerformance: user?.permissions?.viewPerformance ?? true,
            managePerformance: user?.permissions?.managePerformance ?? false,
            admin_view_dp: user?.permissions?.admin_view_dp ?? false,
            admin_view_gestao_rh: user?.permissions?.admin_view_gestao_rh ?? false,
            admin_view_administrativo: user?.permissions?.admin_view_administrativo ?? false,
            admin_view_social: user?.permissions?.admin_view_social ?? false,
            admin_view_ti: user?.permissions?.admin_view_ti ?? false,
            admin_view_comercial: user?.permissions?.admin_view_comercial ?? false,
            admin_view_configuracoes: user?.permissions?.admin_view_configuracoes ?? false,
            admin_tab_users: user?.permissions?.admin_tab_users ?? false,
            admin_tab_departments: user?.permissions?.admin_tab_departments ?? false,
            admin_tab_teams: user?.permissions?.admin_tab_teams ?? false,
            admin_tab_training: user?.permissions?.admin_tab_training ?? false,
            admin_tab_hr: user?.permissions?.admin_tab_hr ?? false,
            admin_tab_forms: user?.permissions?.admin_tab_forms ?? false,
            admin_tab_policies: user?.permissions?.admin_tab_policies ?? false,
            admin_tab_onboarding: user?.permissions?.admin_tab_onboarding ?? false,
            admin_tab_documentos: user?.permissions?.admin_tab_documentos ?? false,
            admin_tab_benefits: user?.permissions?.admin_tab_benefits ?? false,
            admin_tab_jobs: user?.permissions?.admin_tab_jobs ?? false,
            admin_tab_org_flow: user?.permissions?.admin_tab_org_flow ?? false,
            admin_tab_badges: user?.permissions?.admin_tab_badges ?? false,
            admin_tab_reservas_admin: user?.permissions?.admin_tab_reservas_admin ?? false,
            admin_tab_dashboard: user?.permissions?.admin_tab_dashboard ?? false,
            admin_tab_mural: user?.permissions?.admin_tab_mural ?? false,
            admin_tab_polls: user?.permissions?.admin_tab_polls ?? false,
            admin_tab_events: user?.permissions?.admin_tab_events ?? false,
            admin_tab_marketplace: user?.permissions?.admin_tab_marketplace ?? false,
            admin_tab_wellbeing: user?.permissions?.admin_tab_wellbeing ?? false,
            admin_tab_ti_requests: user?.permissions?.admin_tab_ti_requests ?? false,
            admin_tab_status: user?.permissions?.admin_tab_status ?? false,
            admin_tab_kb: user?.permissions?.admin_tab_kb ?? false,
            admin_tab_infosec: user?.permissions?.admin_tab_infosec ?? false,
            admin_tab_scheduling: user?.permissions?.admin_tab_scheduling ?? false,
            admin_tab_scheduling_events: user?.permissions?.admin_tab_scheduling_events ?? false,
            admin_tab_settings: user?.permissions?.admin_tab_settings ?? false,
            action_view_holerite: user?.permissions?.action_view_holerite ?? true,
            action_register_hours: user?.permissions?.action_register_hours ?? true,
            action_approve_reservations: user?.permissions?.action_approve_reservations ?? false,
        },
        // Personal Data
        rg: user?.rg || '',
        cpf: user?.cpf || '',
        emergency_contact_name: user?.emergency_contact_name || '',
        emergency_contact_phone: user?.emergency_contact_phone || '',
        health_insurance: user?.health_insurance || '',
        blood_type: user?.blood_type || '',
        marital_status: user?.marital_status || '',
        education_level: user?.education_level || '',
        can_nudge: user?.can_nudge ?? true,
        nudge_cooldown: user?.nudge_cooldown ?? 30,
        is_whatsapp_agent: user?.is_whatsapp_agent ?? false,
        whatspanda_permissions: user?.whatspanda_permissions || {
            can_view_contacts: true,
            can_edit_contacts: false,
            can_view_chats: true,
            can_send_messages: true,
            can_send_media: true,
            can_manage_settings: false,
            can_view_groups: true,
        },
        email_permissions: user?.email_permissions || {
            can_manage_accounts: false,
            can_view_all_accounts: false,
            account_limit: 1,
            allowed_accounts: [], 
        }
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validação de limite de e-mail de acordo com o plano
        const newLimit = formData.email_permissions.account_limit || 0;
        if (newLimit > remainingLimit) {
            alert(`Erro: Você tentou definir um limite de ${newLimit} contas de e-mail para este usuário. Porém, restam apenas ${remainingLimit} contas de e-mail disponíveis para distribuição no plano atual da empresa (Limite total do plano: ${planEmailLimit} contas).`);
            return;
        }

        // Garante que a permissão viewWhatsPanda esteja sincronizada com o status de agente do WhatsApp
        const updatedPermissions = {
            ...formData.permissions,
            viewWhatsPanda: !!formData.is_whatsapp_agent
        };

        // Garante que o formData sobrescreva tudo do usuário anterior, mantendo o ID
        const finalData = { 
            ...user, 
            ...formData,
            permissions: updatedPermissions
        };
        onSave(finalData as Employee);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><XCircleIcon className="w-6 h-6" /></button>
                <h3 className="text-xl font-bold text-brand-text mb-4">{user?.id ? t('users.edit') : t('users.add')}</h3>
                <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-brand-subtle-text">{t('users.name')}</label><input type="text" name="name" value={formData.name} onChange={handleChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" /></div>
                        <div><label className="block text-sm font-medium text-brand-subtle-text">{t('users.email')}</label><input type="email" name="email" value={formData.email} onChange={handleChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" /></div>
                        <div><label className="block text-sm font-medium text-brand-subtle-text">{t('users.password')}</label><input type="password" name="password" placeholder="Deixe em branco para não alterar" onChange={handleChange} className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" /></div>
                        <div><label className="block text-sm font-medium text-brand-subtle-text">{t('users.role')}</label><input type="text" name="role" value={formData.role} onChange={handleChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" /></div>
                        <div><label className="block text-sm font-medium text-brand-subtle-text">{t('users.team')}</label><input type="text" name="team" value={formData.team} onChange={handleChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" /></div>

                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text">Departamento</label>
                            <select
                                name="department_id"
                                value={formData.department_id}
                                onChange={(e) => setFormData(prev => ({ ...prev, department_id: e.target.value }))}
                                className="mt-1 w-full border border-gray-300 rounded-md sm:text-sm bg-white text-brand-text p-2"
                            >
                                <option value="">Sem Departamento</option>
                                {departments.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text">{t('users.employee_manager')}</label>
                            <select 
                                name="reports_to"
                                value={formData.reports_to || ''} 
                                onChange={(e) => setFormData(p => ({ ...p, reports_to: e.target.value || '' }))} 
                                className="mt-1 w-full border border-gray-300 rounded-md sm:text-sm bg-white text-brand-text p-2"
                            >
                                <option value="">Sem Gerente do Funcionário</option>
                                {users.filter(u => u.id !== user?.id && (u.is_manager || u.isAdmin || u.id === formData.reports_to)).map(u => (
                                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text">{t('users.sector_manager')}</label>
                            <select 
                                name="sector_manager_id"
                                value={formData.sector_manager_id || ''} 
                                onChange={(e) => setFormData(p => ({ ...p, sector_manager_id: e.target.value || '' }))} 
                                className="mt-1 w-full border border-gray-300 rounded-md sm:text-sm bg-white text-brand-text p-2"
                            >
                                <option value="">Sem Gestor do Setor</option>
                                {users.filter(u => u.id !== user?.id && (u.is_manager || u.isAdmin || u.id === formData.sector_manager_id)).map(u => (
                                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-4 mt-6">
                            <label className="flex items-center space-x-2 text-brand-text cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    name="is_manager" 
                                    checked={formData.is_manager} 
                                    onChange={handleChange} 
                                    className="rounded text-brand-primary focus:ring-emerald-500" 
                                />
                                <span className="text-sm font-medium">Gestor do Setor (Esta pessoa é gestora)</span>
                            </label>
                        </div>

                        <div className="flex items-center gap-4 mt-6">
                            <label className="flex items-center space-x-2 text-brand-text cursor-pointer">
                                <input type="checkbox" name="isAdmin" checked={formData.isAdmin} onChange={handleChange} className="rounded text-brand-primary focus:ring-emerald-500" />
                                <span className="text-sm font-medium">{t('users.admin')}</span>
                            </label>
                        </div>
                    </div>

                    <div className="border-t pt-6">
                        <h4 className="font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                            <ShieldCheckIcon className="w-5 h-5 text-brand-primary" />
                            Configurações de Acesso e Permissões
                        </h4>

                        {/* Seletor de Abas de Permissões */}
                        <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
                            {[
                                { id: 'social', label: 'Social', icon: SparklesIcon },
                                { id: 'rh', label: 'RH', icon: BuildingOfficeIcon },
                                { id: 'ti', label: 'Suporte & T.I.', icon: LifebuoyIcon },
                                { id: 'rh_admin', label: 'RH Admin Sensível', icon: ShieldCheckIcon },
                                { id: 'whatspanda', label: 'WhatsPanda & E-mail', icon: ChatBubbleLeftRightIcon },
                                { id: 'admin_panel', label: 'Painel Admin', icon: ShieldCheckIcon }
                            ].map(tab => {
                                const Icon = tab.icon;
                                const active = permissionTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setPermissionTab(tab.id as any)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                                            active
                                                ? 'bg-brand-primary/10 border-brand-primary text-brand-primary shadow-sm dark:bg-brand-primary/20 dark:text-emerald-400'
                                                : 'bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700/50 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                                        }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="space-y-6">
                            {/* Grupo: Social */}
                            {permissionTab === 'admin_panel' && (
                                <div className="space-y-6 animate-fade-in-up max-h-[50vh] overflow-y-auto pr-2">
                                    {/* Categorias Principais */}
                                    <section className="bg-slate-50/50 dark:bg-gray-800/10 p-4 rounded-2xl border border-slate-200 dark:border-gray-700">
                                        <h5 className="text-[10px] font-bold text-slate-650 dark:text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <ShieldCheckIcon className="w-3 h-3 text-brand-primary" /> Categorias do Painel Admin
                                        </h5>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <PermissionToggle icon={<BuildingOfficeIcon className="w-4 h-4" />} label="Categoria: DP" name="admin_view_dp" checked={!!formData.permissions.admin_view_dp} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                            <PermissionToggle icon={<BuildingOfficeIcon className="w-4 h-4" />} label="Categoria: Gestão de RH" name="admin_view_gestao_rh" checked={!!formData.permissions.admin_view_gestao_rh} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                            <PermissionToggle icon={<BuildingOfficeIcon className="w-4 h-4" />} label="Categoria: Administrativo" name="admin_view_administrativo" checked={!!formData.permissions.admin_view_administrativo} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                            <PermissionToggle icon={<SparklesIcon className="w-4 h-4" />} label="Categoria: Social" name="admin_view_social" checked={!!formData.permissions.admin_view_social} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                            <PermissionToggle icon={<LifebuoyIcon className="w-4 h-4" />} label="Categoria: Tecnologia & TI" name="admin_view_ti" checked={!!formData.permissions.admin_view_ti} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                            <PermissionToggle icon={<BuildingOfficeIcon className="w-4 h-4" />} label="Categoria: Comercial" name="admin_view_comercial" checked={!!formData.permissions.admin_view_comercial} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                            <PermissionToggle icon={<Cog6ToothIcon className="w-4 h-4" />} label="Categoria: Configurações" name="admin_view_configuracoes" checked={!!formData.permissions.admin_view_configuracoes} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        </div>
                                    </section>

                                    {/* Abas / Submenus */}
                                    <section className="bg-slate-50/50 dark:bg-gray-800/10 p-4 rounded-2xl border border-slate-200 dark:border-gray-700">
                                        <h5 className="text-[10px] font-bold text-slate-650 dark:text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <FolderIcon className="w-3 h-3 text-brand-primary" /> Submenus / Abas do Painel
                                        </h5>
                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-[9px] font-extrabold text-gray-450 dark:text-gray-500 uppercase tracking-wider mb-2">Abas de DP (Departamento Pessoal)</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    <PermissionToggle icon={<UsersIcon className="w-4 h-4" />} label="Aba: Usuários" name="admin_tab_users" checked={!!formData.permissions.admin_tab_users} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                    <PermissionToggle icon={<BuildingOfficeIcon className="w-4 h-4" />} label="Aba: Departamentos" name="admin_tab_departments" checked={!!formData.permissions.admin_tab_departments} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                    <PermissionToggle icon={<UsersIcon className="w-4 h-4" />} label="Aba: Equipes" name="admin_tab_teams" checked={!!formData.permissions.admin_tab_teams} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                    <PermissionToggle icon={<SparklesIcon className="w-4 h-4" />} label="Aba: Treinamentos" name="admin_tab_training" checked={!!formData.permissions.admin_tab_training} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                    <PermissionToggle icon={<DocumentTextIcon className="w-4 h-4" />} label="Aba: Formulários" name="admin_tab_forms" checked={!!formData.permissions.admin_tab_forms} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                    <PermissionToggle icon={<DocumentTextIcon className="w-4 h-4" />} label="Aba: Políticas" name="admin_tab_policies" checked={!!formData.permissions.admin_tab_policies} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                    <PermissionToggle icon={<RocketLaunchIcon className="w-4 h-4" />} label="Aba: Onboarding" name="admin_tab_onboarding" checked={!!formData.permissions.admin_tab_onboarding} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                    <PermissionToggle icon={<FolderIcon className="w-4 h-4" />} label="Aba: Biblioteca Corp." name="admin_tab_documentos" checked={!!formData.permissions.admin_tab_documentos} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                    <PermissionToggle icon={<HeartIcon className="w-4 h-4" />} label="Aba: Benefícios" name="admin_tab_benefits" checked={!!formData.permissions.admin_tab_benefits} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                </div>
                                            </div>

                                            <div>
                                                <p className="text-[9px] font-extrabold text-gray-455 dark:text-gray-500 uppercase tracking-wider mb-2">Abas de RH</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    <PermissionToggle icon={<BuildingOfficeIcon className="w-4 h-4" />} label="Aba: Gestão RH" name="admin_tab_hr" checked={!!formData.permissions.admin_tab_hr} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                    <PermissionToggle icon={<BuildingOfficeIcon className="w-4 h-4" />} label="Aba: Gestão de Vagas" name="admin_tab_jobs" checked={!!formData.permissions.admin_tab_jobs} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                    <PermissionToggle icon={<BuildingOfficeIcon className="w-4 h-4" />} label="Aba: Organograma" name="admin_tab_org_flow" checked={!!formData.permissions.admin_tab_org_flow} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                </div>
                                            </div>

                                            <div>
                                                <p className="text-[9px] font-extrabold text-gray-455 dark:text-gray-500 uppercase tracking-wider mb-2">Abas de Administrativo</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    <PermissionToggle icon={<StarIcon className="w-4 h-4" />} label="Aba: Selos & Gamificação" name="admin_tab_badges" checked={!!formData.permissions.admin_tab_badges} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                    <PermissionToggle icon={<BuildingOfficeIcon className="w-4 h-4" />} label="Aba: Reservas (Admin)" name="admin_tab_reservas_admin" checked={!!formData.permissions.admin_tab_reservas_admin} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                </div>
                                            </div>

                                            <div>
                                                <p className="text-[9px] font-extrabold text-gray-455 dark:text-gray-500 uppercase tracking-wider mb-2">Abas de Social</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    <PermissionToggle icon={<SparklesIcon className="w-4 h-4" />} label="Aba: Feed/Mural" name="admin_tab_dashboard" checked={!!formData.permissions.admin_tab_dashboard} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                    <PermissionToggle icon={<StarIcon className="w-4 h-4" />} label="Aba: Reconhecimentos" name="admin_tab_mural" checked={!!formData.permissions.admin_tab_mural} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                    <PermissionToggle icon={<DocumentTextIcon className="w-4 h-4" />} label="Aba: Enquetes" name="admin_tab_polls" checked={!!formData.permissions.admin_tab_polls} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                    <PermissionToggle icon={<CalendarDaysIcon className="w-4 h-4" />} label="Aba: Eventos" name="admin_tab_events" checked={!!formData.permissions.admin_tab_events} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                    <PermissionToggle icon={<BuildingOfficeIcon className="w-4 h-4" />} label="Aba: Marketplace" name="admin_tab_marketplace" checked={!!formData.permissions.admin_tab_marketplace} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                    <PermissionToggle icon={<HeartIcon className="w-4 h-4" />} label="Aba: Bem Estar" name="admin_tab_wellbeing" checked={!!formData.permissions.admin_tab_wellbeing} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                </div>
                                            </div>

                                            <div>
                                                <p className="text-[9px] font-extrabold text-gray-455 dark:text-gray-500 uppercase tracking-wider mb-2">Abas de Tecnologia & TI</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    <PermissionToggle icon={<LifebuoyIcon className="w-4 h-4" />} label="Aba: Chamados TI" name="admin_tab_ti_requests" checked={!!formData.permissions.admin_tab_ti_requests} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                    <PermissionToggle icon={<LifebuoyIcon className="w-4 h-4" />} label="Aba: Status TI" name="admin_tab_status" checked={!!formData.permissions.admin_tab_status} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                    <PermissionToggle icon={<FolderIcon className="w-4 h-4" />} label="Aba: Base de Conhecimento" name="admin_tab_kb" checked={!!formData.permissions.admin_tab_kb} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                    <PermissionToggle icon={<ShieldCheckIcon className="w-4 h-4" />} label="Aba: Segurança" name="admin_tab_infosec" checked={!!formData.permissions.admin_tab_infosec} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                </div>
                                            </div>

                                            <div>
                                                <p className="text-[9px] font-extrabold text-gray-455 dark:text-gray-500 uppercase tracking-wider mb-2">Abas de Comercial</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    <PermissionToggle icon={<CalendarDaysIcon className="w-4 h-4" />} label="Aba: Agendamentos" name="admin_tab_scheduling" checked={!!formData.permissions.admin_tab_scheduling} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                    <PermissionToggle icon={<CalendarDaysIcon className="w-4 h-4" />} label="Aba: Espaços" name="admin_tab_scheduling_events" checked={!!formData.permissions.admin_tab_scheduling_events} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                </div>
                                            </div>

                                            <div>
                                                <p className="text-[9px] font-extrabold text-gray-455 dark:text-gray-500 uppercase tracking-wider mb-2">Abas de Configurações</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    <PermissionToggle icon={<Cog6ToothIcon className="w-4 h-4" />} label="Aba: Geral" name="admin_tab_settings" checked={!!formData.permissions.admin_tab_settings} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Ações Específicas / Funcionário */}
                                    <section className="bg-emerald-50/20 dark:bg-emerald-950/10 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                                        <h5 className="text-[10px] font-bold text-emerald-650 dark:text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <SparklesIcon className="w-3 h-3 text-emerald-500" /> Ações do Colaborador
                                        </h5>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <PermissionToggle icon={<IdentificationIcon className="w-4 h-4" />} label="Visualizar Holerite" name="action_view_holerite" checked={formData.permissions.action_view_holerite !== false} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                            <PermissionToggle icon={<ClockIcon className="w-4 h-4" />} label="Lançar/Ver Banco de Horas" name="action_register_hours" checked={formData.permissions.action_register_hours !== false} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                            <PermissionToggle icon={<BuildingOfficeIcon className="w-4 h-4" />} label="Aprovar/Recusar Reservas" name="action_approve_reservations" checked={!!formData.permissions.action_approve_reservations} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        </div>
                                    </section>
                                </div>
                            )}
                            {permissionTab === 'social' && (
                                <div className="space-y-6 animate-fade-in-up">
                                    <section>
                                        <h5 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <SparklesIcon className="w-3 h-3" /> Redes e Comunicação
                                        </h5>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <PermissionToggle icon={<ChatBubbleLeftRightIcon className="w-4 h-4" />} label="Chat & Mensagens" name="viewMessages" checked={formData.permissions.viewMessages} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                            <PermissionToggle icon={<EnvelopeIcon className="w-4 h-4" />} label="E-mail Corporativo" name="viewEmail" checked={formData.permissions.viewEmail} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                            <PermissionToggle icon={<PlusIcon className="w-4 h-4" />} label="Postar Texto" name="canPostText" checked={formData.permissions.canPostText} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                            <PermissionToggle icon={<PlusIcon className="w-4 h-4" />} label="Postar Imagem" name="canPostImage" checked={formData.permissions.canPostImage} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                            <PermissionToggle icon={<PlusIcon className="w-4 h-4" />} label="Postar Vídeo" name="canPostVideo" checked={formData.permissions.canPostVideo} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        </div>
                                    </section>

                                    <section className="bg-emerald-50/30 dark:bg-emerald-950/10 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                                        <h5 className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <SparklesIcon className="w-3 h-3" /> Comunicação Avançada
                                        </h5>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                                            <PermissionToggle 
                                                icon={<SparklesIcon className="w-4 h-4" />} 
                                                label="Poder Chamar Atenção (Nudge)" 
                                                name="can_nudge" 
                                                checked={formData.can_nudge} 
                                                onChange={(n, c) => setFormData(p => ({ ...p, [n]: c }))} 
                                            />
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase px-1">Cooldown Nudge (segundos)</label>
                                                <input 
                                                    type="number" 
                                                    name="nudge_cooldown" 
                                                    value={formData.nudge_cooldown} 
                                                    onChange={handleChange} 
                                                    min="0"
                                                    className="w-full bg-white dark:bg-gray-800 border border-gray-250 dark:border-gray-700 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 dark:text-white transition-all outline-none" 
                                                />
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            )}

                            {/* Grupo: Corporativo & RH */}
                            {permissionTab === 'rh' && (
                                <section className="animate-fade-in-up">
                                    <h5 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <BuildingOfficeIcon className="w-3 h-3" /> Corporativo & RH
                                    </h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <PermissionToggle icon={<CalendarDaysIcon className="w-4 h-4" />} label="Calendário" name="viewCalendar" checked={formData.permissions.viewCalendar} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<CalendarDaysIcon className="w-4 h-4" />} label="Agenda (Agendamentos e Eventos)" name="viewScheduling" checked={formData.permissions.viewScheduling} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<UsersIcon className="w-4 h-4" />} label="Diretório de Pessoas" name="viewDirectory" checked={formData.permissions.viewDirectory} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<DocumentTextIcon className="w-4 h-4" />} label="Formulários" name="viewForms" checked={formData.permissions.viewForms} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<HeartIcon className="w-4 h-4" />} label="Benefícios" name="viewBenefits" checked={formData.permissions.viewBenefits} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<RocketLaunchIcon className="w-4 h-4" />} label="Onboarding" name="viewOnboarding" checked={formData.permissions.viewOnboarding} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<StarIcon className="w-4 h-4" />} label="Reconhecimentos" name="viewRecognition" checked={formData.permissions.viewRecognition} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<FolderIcon className="w-4 h-4" />} label="Gestão de Projetos" name="viewProjects" checked={formData.permissions.viewProjects} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<FolderIcon className="w-4 h-4" />} label="Biblioteca de Documentos" name="viewDocuments" checked={formData.permissions.viewDocuments} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<HeartIcon className="w-4 h-4" />} label="Bem Estar" name="viewWellbeing" checked={formData.permissions.viewWellbeing} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<BuildingOfficeIcon className="w-4 h-4" />} label="Meu RH (Holerites e Férias)" name="viewMeuRH" checked={formData.permissions.viewMeuRH} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<BriefcaseIcon className="w-4 h-4" />} label="Vagas de Emprego" name="viewJobs" checked={formData.permissions.viewJobs} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<AcademicCapIcon className="w-4 h-4" />} label="Treinamentos" name="viewTraining" checked={formData.permissions.viewTraining} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<ChatBubbleLeftRightIcon className="w-4 h-4" />} label="Pesquisas de Clima" name="viewSurveys" checked={formData.permissions.viewSurveys} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<ShieldCheckIcon className="w-4 h-4" />} label="Políticas Internas" name="viewPolicies" checked={formData.permissions.viewPolicies} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<UsersIcon className="w-4 h-4" />} label="Organograma" name="viewOrgChart" checked={formData.permissions.viewOrgChart} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<BuildingOfficeIcon className="w-4 h-4" />} label="Reservas de Salas/Espaços" name="viewReservations" checked={formData.permissions.viewReservations} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                    </div>
                                </section>
                            )}

                            {/* Grupo: Tecnologia */}
                            {permissionTab === 'ti' && (
                                <section className="animate-fade-in-up">
                                    <h5 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <LifebuoyIcon className="w-3 h-3" /> Suporte & T.I.
                                    </h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <PermissionToggle icon={<TicketIcon className="w-4 h-4" />} label="Meus Chamados" name="openTickets" checked={formData.permissions.openTickets} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<PlusIcon className="w-4 h-4" />} label="Solicitar Equipamento" name="openTiRequests" checked={formData.permissions.openTiRequests} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<Cog6ToothIcon className="w-4 h-4" />} label="Dashboard T.I. (Admin)" name="viewTiDashboard" checked={formData.permissions.viewTiDashboard} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<BookOpenIcon className="w-4 h-4" />} label="Base de Conhecimento" name="viewKnowledgeBase" checked={formData.permissions.viewKnowledgeBase} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<ArrowPathIcon className="w-4 h-4" />} label="Status de Serviços" name="viewServiceStatus" checked={formData.permissions.viewServiceStatus} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<ShieldCheckIcon className="w-4 h-4" />} label="Segurança da Informação" name="viewInfoSec" checked={formData.permissions.viewInfoSec} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                    </div>
                                </section>
                            )}

                            {/* Grupo: Gestão RH Crítica */}
                            {permissionTab === 'rh_admin' && (
                                <section className="bg-red-50/50 dark:bg-red-950/10 p-4 rounded-2xl border border-red-100 dark:border-red-900/30 animate-fade-in-up">
                                    <h5 className="text-[10px] font-bold text-red-500 dark:text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <ShieldCheckIcon className="w-3 h-3" /> Gestão Sensível (RH Admin)
                                    </h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <PermissionToggle icon={<UsersIcon className="w-4 h-4" />} label="Ver Dados Confidenciais" name="viewEmployeeDetails" checked={formData.permissions.viewEmployeeDetails} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<PencilIcon className="w-4 h-4" />} label="Editar Funcionários" name="editEmployeeProfile" checked={formData.permissions.editEmployeeProfile} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<TrashIcon className="w-4 h-4" />} label="Excluir Funcionários" name="deleteEmployeeProfile" checked={formData.permissions.deleteEmployeeProfile} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<CalendarDaysIcon className="w-4 h-4" />} label="Aprovar/Rejeitar Férias" name="manageVacationRequests" checked={formData.permissions.manageVacationRequests} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<CalendarDaysIcon className="w-4 h-4" />} label="Visualizar Banco de Horas" name="viewTimeBank" checked={formData.permissions.viewTimeBank} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<CalendarDaysIcon className="w-4 h-4" />} label="Gerenciar Banco de Horas" name="manageTimeBank" checked={formData.permissions.manageTimeBank} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<HeartIcon className="w-4 h-4" />} label="Gerenciar Benefícios de Funcionários" name="viewEmployeeBenefitsAdmin" checked={formData.permissions.viewEmployeeBenefitsAdmin} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<StarIcon className="w-4 h-4" />} label="Visualizar Desempenho e Metas" name="viewPerformance" checked={formData.permissions.viewPerformance} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                        <PermissionToggle icon={<StarIcon className="w-4 h-4" />} label="Gerenciar Desempenho e Metas" name="managePerformance" checked={formData.permissions.managePerformance} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                    </div>
                                </section>
                            )}

                            {/* Grupo: WhatsPanda & E-mail */}
                            {permissionTab === 'whatspanda' && (
                                <div className="space-y-6 animate-fade-in-up">
                                    <section className={`p-4 rounded-2xl border transition-all ${formData.is_whatsapp_agent ? 'bg-emerald-50/50 border-emerald-250 dark:bg-emerald-950/10 dark:border-emerald-900/30' : 'bg-gray-50/50 border-gray-100 dark:bg-gray-800/10 dark:border-gray-800'}`}>
                                        <h5 className={`text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2 ${formData.is_whatsapp_agent ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                            <ChatBubbleLeftRightIcon className="w-3 h-3" /> WhatsPanda (Atendimento)
                                        </h5>
                                        <div className="grid grid-cols-1 gap-4">
                                            <div className="max-w-md">
                                                <PermissionToggle 
                                                    icon={<ChatBubbleLeftRightIcon className="w-4 h-4" />} 
                                                    label="Agente WhatsPanda" 
                                                    name="is_whatsapp_agent" 
                                                    checked={formData.is_whatsapp_agent} 
                                                    onChange={(n, c) => setFormData(p => ({ ...p, [n]: c }))} 
                                                />
                                            </div>

                                            {formData.is_whatsapp_agent && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in-up">
                                                    {/* Permissões Gerais */}
                                                    <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-emerald-100 dark:border-emerald-900/35 shadow-sm">
                                                        <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Permissões do Agente</p>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                            {[
                                                                { key: 'can_view_contacts', label: 'Ver Contatos' },
                                                                { key: 'can_edit_contacts', label: 'Editar Contatos' },
                                                                { key: 'can_view_chats', label: 'Ver Chats' },
                                                                { key: 'can_send_messages', label: 'Enviar Mensagens' },
                                                                { key: 'can_send_media', label: 'Enviar Mídia' },
                                                                { key: 'can_manage_settings', label: 'Gerenciar Configs' },
                                                            ].map(perm => (
                                                                <label key={perm.key} className="flex items-center space-x-2 text-[11px] text-gray-655 bg-gray-50 dark:bg-gray-700/50 p-1.5 rounded-lg border border-transparent hover:border-emerald-100 cursor-pointer transition-colors dark:text-gray-300">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={(formData.whatspanda_permissions as any)?.[perm.key]} 
                                                                        onChange={(e) => setFormData(prev => ({
                                                                            ...prev,
                                                                            whatspanda_permissions: {
                                                                                ...(prev.whatspanda_permissions as any),
                                                                                [perm.key]: e.target.checked
                                                                            }
                                                                        }))}
                                                                        className="rounded text-emerald-500 w-3.5 h-3.5"
                                                                    />
                                                                    <span className="font-medium">{perm.label}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Conexões (Canais Permitidos) */}
                                                    <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-emerald-100 dark:border-emerald-900/35 shadow-sm flex flex-col gap-3">
                                                        <div>
                                                            <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Canais Vinculados</p>
                                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">Escolha quais números este agente pode acessar e responder.</p>
                                                        </div>
                                                        
                                                        <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                                                            {channels.map(ch => (
                                                                <label key={ch.id} className="flex items-center space-x-3 p-2 border border-gray-100 dark:border-gray-700 rounded-lg hover:bg-emerald-55 dark:hover:bg-emerald-950/20 cursor-pointer transition-colors">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={((formData.whatspanda_permissions as any)?.allowed_connections || []).includes(ch.id)}
                                                                        onChange={(e) => {
                                                                            const current = (formData.whatspanda_permissions as any)?.allowed_connections || [];
                                                                            const updated = e.target.checked ? [...current, ch.id] : current.filter((id: string) => id !== ch.id);
                                                                            setFormData(prev => ({
                                                                                ...prev,
                                                                                whatspanda_permissions: {
                                                                                    ...(prev.whatspanda_permissions as any),
                                                                                    allowed_connections: updated
                                                                                }
                                                                            }));
                                                                        }}
                                                                        className="rounded text-emerald-500 focus:ring-emerald-500" 
                                                                    />
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{ch.instance_name || 'Instância sem nome'}</span>
                                                                        <span className="text-[10px] text-gray-500 dark:text-gray-400">{ch.phone_number || 'Sem número'}</span>
                                                                    </div>
                                                                </label>
                                                            ))}
                                                            {channels.length === 0 && (
                                                                <span className="text-[11px] text-red-500 bg-red-50 dark:bg-red-950/20 p-2 rounded border border-red-100 dark:border-red-900/35">Nenhum WhatsApp conectado na empresa.</span>
                                                            )}
                                                        </div>

                                                        <label className="flex items-start space-x-3 p-2 bg-blue-50/50 dark:bg-blue-950/10 border border-blue-105 dark:border-blue-900/20 rounded-lg cursor-pointer mt-auto">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={(formData.whatspanda_permissions as any)?.can_connect_own_whatsapp || false}
                                                                onChange={(e) => setFormData(prev => ({
                                                                    ...prev, 
                                                                    whatspanda_permissions: {
                                                                        ...(prev.whatspanda_permissions as any), 
                                                                        can_connect_own_whatsapp: e.target.checked
                                                                    }
                                                                }))}
                                                                className="rounded text-blue-500 mt-0.5" 
                                                            />
                                                            <div className="flex flex-col">
                                                                <span className="text-[11px] font-bold text-blue-800 dark:text-blue-400">Conectar o Próprio WhatsApp</span>
                                                                <span className="text-[10px] text-blue-600/70 dark:text-blue-500 leading-tight">O usuário poderá escanear o QR Code de seu celular pessoal ou corporativo no painel.</span>
                                                            </div>
                                                        </label>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </section>

                                    {/* Grupo: PandaMail */}
                                    <section className="bg-slate-50/50 dark:bg-gray-800/10 p-4 rounded-2xl border border-slate-200 dark:border-gray-800">
                                        <h5 className="text-[10px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <EnvelopeIcon className="w-3 h-3" /> PandaMail (E-mail Corporativo)
                                        </h5>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <PermissionToggle 
                                                icon={<EnvelopeIcon className="w-4 h-4" />} 
                                                label="Acesso ao Módulo PandaMail" 
                                                name="viewEmail" 
                                                checked={formData.permissions.viewEmail} 
                                                onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} 
                                            />
                                            <PermissionToggle 
                                                icon={<Cog6ToothIcon className="w-4 h-4" />} 
                                                label="Pode Adicionar/Remover Contas" 
                                                name="can_manage_accounts" 
                                                checked={formData.email_permissions.can_manage_accounts} 
                                                onChange={(n, c) => setFormData(p => ({ ...p, email_permissions: { ...p.email_permissions, [n]: c } }))} 
                                            />
                                            <PermissionToggle 
                                                icon={<ShieldCheckIcon className="w-4 h-4" />} 
                                                label="Ver Todas as Contas da Empresa" 
                                                name="can_view_all_accounts" 
                                                checked={formData.email_permissions.can_view_all_accounts} 
                                                onChange={(n, c) => setFormData(p => ({ ...p, email_permissions: { ...p.email_permissions, [n]: c } }))} 
                                            />
                                            <div className="flex flex-col gap-1.5 p-3 bg-white dark:bg-gray-800 rounded-xl border border-slate-250 dark:border-gray-700">
                                                <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase px-1">
                                                    Limite de Contas de E-mail (Max: {planEmailLimit})
                                                </label>
                                                <input 
                                                    type="number" 
                                                    placeholder="Ex: 2"
                                                    min="0"
                                                    value={formData.email_permissions.account_limit || 0} 
                                                    onChange={(e) => {
                                                        const val = Math.max(0, parseInt(e.target.value) || 0);
                                                        setFormData(p => ({ 
                                                            ...p, 
                                                            email_permissions: { 
                                                                ...p.email_permissions, 
                                                                account_limit: val 
                                                            } 
                                                        }));
                                                    }} 
                                                    className="w-full bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500/20 dark:text-white outline-none transition-all" 
                                                />
                                                <p className="text-[9px] text-slate-400 dark:text-gray-500 italic px-1 leading-tight">
                                                    Máximo de contas que este usuário pode cadastrar. (Disponível no plano: {remainingLimit} livre(s)).
                                                </p>
                                            </div>

                                            <div className="flex flex-col gap-1.5 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-150 dark:border-gray-700 shadow-sm">
                                                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase px-1">Equipe / Setor</label>
                                                <input type="text" placeholder="Ex: Comercial" value={formData.team} onChange={(e) => setFormData(p => ({ ...p, team: e.target.value }))} className="w-full bg-gray-50 dark:bg-gray-700 border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 dark:text-white outline-none transition-all" />
                                            </div>

                                            <div className="sm:col-span-2 p-3 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-slate-200 dark:border-gray-700">
                                                <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight mb-2">Contas específicas que este usuário pode acessar:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    <p className="text-[10px] text-slate-400 dark:text-gray-500 italic">As contas disponíveis aparecerão aqui para seleção após serem cadastradas no PandaMail.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="border-t pt-6">
                        <h4 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <IdentificationIcon className="w-5 h-5 text-brand-primary" />
                            Dados de Funcionário (Confidencial/RH)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase px-1">RG</label>
                                <input type="text" name="rg" value={formData.rg} onChange={handleChange} className="w-full bg-gray-50 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-primary/20 transition-all" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase px-1">CPF</label>
                                <input type="text" name="cpf" value={formData.cpf} onChange={handleChange} className="w-full bg-gray-50 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-primary/20 transition-all" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase px-1">Emergência (Nome)</label>
                                <input type="text" name="emergency_contact_name" value={formData.emergency_contact_name} onChange={handleChange} className="w-full bg-gray-50 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-primary/20 transition-all" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase px-1">Emergência (Telefone)</label>
                                <input type="text" name="emergency_contact_phone" value={formData.emergency_contact_phone} onChange={handleChange} className="w-full bg-gray-50 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-primary/20 transition-all" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase px-1">Plano de Saúde</label>
                                <input type="text" name="health_insurance" value={formData.health_insurance} onChange={handleChange} className="w-full bg-gray-50 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-primary/20 transition-all" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase px-1">Tipo Sanguíneo</label>
                                <input type="text" name="blood_type" value={formData.blood_type} onChange={handleChange} className="w-full bg-gray-50 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-primary/20 transition-all" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase px-1">Estado Civil</label>
                                <input type="text" name="marital_status" value={formData.marital_status} onChange={handleChange} className="w-full bg-gray-50 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-primary/20 transition-all" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase px-1">Escolaridade</label>
                                <input type="text" name="education_level" value={formData.education_level} onChange={handleChange} className="w-full bg-gray-50 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-primary/20 transition-all" />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">{t('users.cancel')}</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600">{t('users.save')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const UserManager: React.FC<UserManagerProps> = ({ users, setUsers, plan, departments }) => {
    const { profile } = useAuth();
    const { t } = useLanguage();
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<Employee | null>(null);
    const [resetPasswordUser, setResetPasswordUser] = useState<Employee | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [isResetting, setIsResetting] = useState(false);

    const handleSave = async (userData: Omit<Employee, 'id'> | Employee) => {
        if (!profile?.company_id && profile?.role !== 'Super Admin') {
            alert("Erro: Empresa não identificada.");
            return;
        }

        const targetCompanyId = profile?.company_id || '56eaa5ed-8d1b-4879-a002-838702eeb14d'; // Fallback to Pixel if super admin

        try {
            if ('id' in userData && userData.id.length > 15) { // UUID is long, local id (Date.now()) is shorter
                // UPDATE via RPC (SECURITY DEFINER)
                console.log("[UserManager] RPC Payload:", {
                    p_user_id: userData.id,
                    p_email_permissions: userData.email_permissions,
                    p_permissions: userData.permissions
                });

                const { error } = await supabase.rpc('update_user_profile', {
                    p_user_id: userData.id,
                    p_full_name: userData.name,
                    p_role: userData.role,
                    p_team: userData.team,
                    p_department_id: userData.department_id || null,
                    p_is_admin: !!userData.isAdmin,
                    p_is_company_admin: !!userData.isAdmin,
                    p_permissions: userData.permissions,
                    p_avatar_url: (userData.avatarUrl && !userData.avatarUrl.includes('ui-avatars.com')) ? userData.avatarUrl : null,
                    p_rg: userData.rg || null,
                    p_cpf: userData.cpf || null,
                    p_emergency_contact_name: userData.emergency_contact_name || null,
                    p_emergency_contact_phone: userData.emergency_contact_phone || null,
                    p_health_insurance: userData.health_insurance || null,
                    p_blood_type: userData.blood_type || null,
                    p_marital_status: userData.marital_status || null,
                    p_education_level: userData.education_level || null,
                    p_can_nudge: !!userData.can_nudge,
                    p_nudge_cooldown: parseInt(String(userData.nudge_cooldown)) || 30,
                    p_is_whatsapp_agent: !!userData.is_whatsapp_agent,
                    p_whatspanda_permissions: userData.whatspanda_permissions || {},
                    p_email_permissions: userData.email_permissions || {},
                    p_reports_to: userData.reports_to || null,
                    p_sector_manager_id: userData.sector_manager_id || null,
                    p_is_manager: !!userData.is_manager,
                    p_clear_reports_to: !userData.reports_to,
                    p_clear_sector_manager: !userData.sector_manager_id
                });

                // Manual password update if field is provided
                if ((userData as any).password) {
                    console.log("[UserManager] Updating password manually...");
                    const { error: resetError } = await supabase.rpc('admin_reset_user_password', {
                        p_user_id: userData.id,
                        p_new_password: (userData as any).password
                    });
                    if (resetError) {
                        console.error("Password Reset Error during save:", resetError);
                        alert("Perfil atualizado, mas erro ao mudar senha: " + resetError.message);
                    }
                }

                if (error) {
                    console.error("RPC Update Error:", error);
                    throw new Error(`Erro ao atualizar perfil: ${error.message}`);
                }
                setUsers(users.map(u => u.id === userData.id ? userData : u));
            } else {
                // CREATE USER via RPC (SECURITY DEFINER - corrected version)
                if (activeUsers.length >= plan.userLimit) {
                    alert(`Atenção: Sua empresa excedeu o limite de ${plan.userLimit} usuários do seu plano atual (${plan.name}). Por favor, contate o suporte para mudar o plano e liberar novos acessos.`);
                    return;
                }

                try {
                    const { data: newId, error } = await supabase.rpc('create_user_admin', {
                        p_email: userData.email,
                        p_password: (userData as any).password || 'PandaNet123',
                        p_full_name: userData.name,
                        p_role: userData.role,
                        p_team: userData.team,
                        p_company_id: targetCompanyId,
                        p_is_admin: !!userData.isAdmin,
                        p_is_company_admin: !!userData.isAdmin,
                        p_permissions: userData.permissions,
                        p_avatar_url: (userData.avatarUrl && !userData.avatarUrl.includes('ui-avatars.com')) ? userData.avatarUrl : null,
                        p_department_id: (userData as any).department_id || null,
                        p_rg: (userData as any).rg || null,
                        p_cpf: (userData as any).cpf || null,
                        p_can_nudge: !!(userData as any).can_nudge,
                        p_nudge_cooldown: parseInt(String((userData as any).nudge_cooldown)) || 30,
                        p_is_whatsapp_agent: !!(userData as any).is_whatsapp_agent,
                        p_whatspanda_permissions: (userData as any).whatspanda_permissions || {},
                        p_email_permissions: (userData as any).email_permissions || {},
                        p_reports_to: userData.reports_to || null,
                        p_sector_manager_id: userData.sector_manager_id || null,
                        p_is_manager: !!userData.is_manager
                    });

                    if (error) {
                        console.error("RPC Create Error:", error);
                        throw new Error(`Erro ao criar usuário: ${error.message}`);
                    }

                    if (newId) {
                        const newUser = { ...userData, id: newId } as Employee;
                        setUsers([newUser, ...users]);
                        alert(`Usuário criado com sucesso!\nSenha temporária: ${(userData as any).password || 'PandaNet123'}`);
                    }
                } catch (rpcErr: any) {
                    console.error("Falha ao criar usuário via RPC:", rpcErr);
                    throw new Error("Falha ao criar usuário: " + rpcErr.message);
                }
            }

        } catch (err: any) {
            console.error("Erro ao salvar usuário:", err.message);
            alert("Erro ao salvar no banco: " + err.message);
        }
        setModalOpen(false);
        setEditingUser(null);
    };

    const handleResetPassword = async () => {
        if (!resetPasswordUser || !newPassword) return;
        if (newPassword.length < 6) {
            alert("A senha deve ter pelo menos 6 caracteres.");
            return;
        }

        setIsResetting(true);
        try {
            const { data, error } = await supabase.rpc('admin_reset_user_password', {
                p_user_id: resetPasswordUser.id,
                p_new_password: newPassword
            });

            if (error) throw error;
            
            if (data?.success) {
                alert("Senha resetada com sucesso!");
                setResetPasswordUser(null);
                setNewPassword('');
            } else {
                alert("Erro: " + (data?.error || "Falha desconhecida"));
            }
        } catch (err: any) {
            console.error("Erro ao resetar senha:", err);
            alert("Erro ao resetar senha: " + err.message);
        } finally {
            setIsResetting(false);
        }
    };

    const handleEdit = (user: Employee) => {
        setEditingUser(user);
        setModalOpen(true);
    };

    const getBase64ImageFromURL = (url: string): Promise<{ data: string, width: number, height: number }> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.setAttribute('crossOrigin', 'anonymous');
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0);
                const dataURL = canvas.toDataURL('image/png');
                resolve({ data: dataURL, width: img.width, height: img.height });
            };
            img.onerror = error => reject(error);
            img.src = url;
        });
    };

    const stripEmojis = (str: string) => {
        return str.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1F170}-\u{1F251}]/gu, '');
    };

    const generatePDFHistory = async (userId: string, userName: string) => {
        const doc = new jsPDF();

        try {
            // 1. Obter Logo da Empresa ou Sistema
            let logoUrl = '';
            if (profile?.company_id) {
                const { data: company } = await supabase
                    .from('companies')
                    .select('settings')
                    .eq('id', profile.company_id)
                    .maybeSingle();
                logoUrl = (company?.settings as any)?.companyLogo;
            }

            if (!logoUrl || logoUrl === '/logo.png') {
                const { data: systemLogo } = await supabase
                    .from('system_settings')
                    .select('value')
                    .eq('key', 'main_logo')
                    .maybeSingle();
                logoUrl = systemLogo?.value || '/logo.png';
            }

            // 2. Adicionar Logo ao PDF (Resiliente)
            if (logoUrl) {
                console.log('[UserManager] Carregando logo:', logoUrl);
                try {
                    const { data: base64Logo, width, height } = await getBase64ImageFromURL(logoUrl);
                    const maxWidth = 35;
                    const aspectRatio = height / width;
                    const finalHeight = maxWidth * aspectRatio;
                    doc.addImage(base64Logo, 'PNG', 14, 10, maxWidth, finalHeight, undefined, 'FAST');
                } catch (e) {
                    console.error('[UserManager] Erro ao carregar logo, continuando sem ela:', e);
                }
            }

            // 3. Cabeçalho
            doc.setFontSize(22);
            doc.setTextColor(16, 185, 129); // Brand Primary
            doc.text('Relatório de Histórico', 50, 25);

            doc.setFontSize(14);
            doc.setTextColor(31, 41, 55);
            doc.text(`Usuário: ${userName}`, 50, 35);

            doc.setFontSize(10);
            doc.setTextColor(107, 114, 128);
            const now = new Date();
            doc.text(`Emitido em: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`, 14, 45);

            let messages: any[] = [];
            try {
                console.log('[UserManager] Buscando conversas participadas...');
                const { data: participations } = await supabase
                    .from('conversation_participants')
                    .select('conversation_id')
                    .eq('user_id', userId);

                const conversationIds = participations?.map(p => p.conversation_id) || [];
                console.log(`[UserManager] Encontradas ${conversationIds.length} conversas.`);

                let query = supabase
                    .from('messages')
                    .select(`
                        id, 
                        text, 
                        created_at, 
                        sender_id,
                        profiles:sender_id(full_name)
                    `)
                    .order('created_at', { ascending: true });

                if (conversationIds.length > 0) {
                    // Proteção contra query muito longa/complexa
                    const limitedIds = conversationIds.slice(0, 50);
                    query = query.or(`sender_id.eq.${userId},conversation_id.in.(${limitedIds.map(id => `'${id}'`).join(',')})`);
                } else {
                    query = query.eq('sender_id', userId);
                }

                const { data, error: msgError } = await query;
                if (msgError) throw msgError;
                messages = data || [];
                console.log(`[UserManager] ${messages.length} mensagens recuperadas.`);
            } catch (err) {
                console.error('[UserManager] Erve ao buscar mensagens, gerando PDF vazio:', err);
            }

            const tableData = messages?.map(m => [
                new Date(m.created_at).toLocaleString('pt-BR'),
                (m.profiles as any)?.full_name || 'Usuário Excluído',
                m.text || '[Arquivo/Midia]'
            ]) || [];

            (doc as any).autoTable({
                startY: 50,
                head: [['Data/Hora', 'Remetente', 'Mensagem']],
                body: tableData.map(row => row.map(cell => stripEmojis(String(cell)))),
                theme: 'striped',
                headStyles: {
                    fillColor: [16, 185, 129],
                    textColor: [255, 255, 255],
                    fontSize: 11,
                    fontStyle: 'bold'
                },
                alternateRowStyles: {
                    fillColor: [249, 250, 251]
                },
                margin: { top: 50 },
                styles: {
                    fontSize: 9,
                    cellPadding: 3
                },
                columnStyles: {
                    0: { cellWidth: 35 },
                    1: { cellWidth: 40 },
                    2: { cellWidth: 'auto' }
                }
            });

            doc.save(`historico_${userName.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
            return true;
        } catch (err) {
            console.error('Erro ao gerar PDF:', err);
            return false;
        }
    };

    const handleDelete = async (userId: string, userName: string) => {
        if (!window.confirm(`Tem certeza que deseja excluir permanentemente o usuário ${userName}? Esta ação não pode ser desfeita.`)) return;

        console.log(`[UserManager] Iniciando backup e deleção via Database RPC: ${userName} (${userId})`);

        try {
            // 1. Limpeza do JSONB da Empresa (Legacy cache)
            const companyId = profile?.company_id;
            if (companyId) {
                console.log(`[UserManager] Limpando JSONB da empresa: ${companyId}`);
                const { data: company } = await supabase.from('companies').select('data').eq('id', companyId).single();
                if (company?.data && Array.isArray(company.data.employees)) {
                    const updatedEmployees = company.data.employees.filter((e: any) => e.id !== userId);
                    if (updatedEmployees.length !== company.data.employees.length) {
                        await supabase.from('companies').update({
                            data: { ...company.data, employees: updatedEmployees }
                        }).eq('id', companyId);
                        console.log(`[UserManager] JSONB atualizado.`);
                    }
                }
            }

            // 2. Chamar a Database RPC para deletar de forma segura (Auth + Profiles)
            console.log(`[UserManager] Chamando Database Function (RPC) para deletar: ${userId}`);
            const { error } = await supabase.rpc('delete_user_admin', { target_user_id: userId });

            if (error) {
                console.error("[UserManager] Erro no RPC:", error);
                throw new Error(error.message || "Falha ao chamar a função de exclusão no banco.");
            }

            console.log("[UserManager] Sucesso!");
            setUsers(users.filter(u => u.id !== userId));
            alert("Usuário excluído com sucesso.");
        } catch (err: any) {
            console.error("[UserManager] Erro fatal:", err);
            alert("Erro ao excluir: " + (err.message || "Você não tem permissão ou houve um erro no servidor."));
        }
    };

    const handleApprove = async (userId: string) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ status: 'active' })
                .eq('id', userId);
            if (error) throw error;
            setUsers(users.map(u => u.id === userId ? { ...u, status: 'active' } : u));
        } catch (err: any) {
            alert("Erro ao aprovar: " + err.message);
        }
    };

    const handleReject = async (userId: string) => {
        if (!window.confirm("Tem certeza que deseja rejeitar este usuário? Ele será removido do sistema.")) return;
        try {
            // Limpeza JSONB
            const companyId = profile?.company_id;
            if (companyId) {
                const { data: company } = await supabase.from('companies').select('data').eq('id', companyId).single();
                if (company?.data && Array.isArray(company.data.employees)) {
                    const updatedEmployees = company.data.employees.filter((e: any) => e.id !== userId);
                    await supabase.from('companies').update({
                        data: { ...company.data, employees: updatedEmployees }
                    }).eq('id', companyId);
                }
            }

            const { error } = await supabase.from('profiles').delete().eq('id', userId);
            if (error) throw error;
            setUsers(users.filter(u => u.id !== userId));
        } catch (err: any) {
            alert("Erro ao rejeitar: " + err.message);
        }
    };

    const pendingUsers = users.filter(u => u.status === 'pending');
    const activeUsers = users.filter(u => u.status !== 'pending');

    return (
        <div className="space-y-6">
            {pendingUsers.length > 0 && (
                <Card title="Solicitações de Acesso (Pendentes)" icon={<div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-amber-50">
                                <tr>
                                    <th className="px-6 py-3">Nome / E-mail</th>
                                    <th className="px-6 py-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {pendingUsers.map(user => (
                                    <tr key={user.id} className="bg-white hover:bg-amber-50/50">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center space-x-3">
                                                <img 
                                                    src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=E2E8F0&color=475569`} 
                                                    alt={user.name} 
                                                    className="w-8 h-8 rounded-full object-cover" 
                                                />
                                                <div>
                                                    <p className="font-medium text-gray-900">{user.name}</p>
                                                    <p className="text-xs text-gray-400">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            <button
                                                onClick={() => handleApprove(user.id)}
                                                className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-md hover:bg-emerald-200 text-xs font-bold"
                                            >
                                                APROVAR
                                            </button>
                                            <button
                                                onClick={() => handleReject(user.id)}
                                                className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-xs font-bold"
                                            >
                                                REJEITAR
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            <Card title={t('users.title')} headerAction={
                <div className="flex items-center space-x-4">
                    <span className="text-sm text-brand-subtle-text">{activeUsers.length} de {plan.userLimit} usuários ativos</span>
                    <button onClick={() => { setEditingUser(null); setModalOpen(true); }} className="flex items-center space-x-2 px-3 py-2 text-sm bg-brand-primary text-white rounded-md hover:bg-emerald-600 disabled:opacity-50" disabled={activeUsers.length >= plan.userLimit}>
                        <PlusIcon className="w-4 h-4" />
                        <span>{t('generic.new_item')}</span>
                    </button>
                </div>
            }>
                <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                            <tr>
                                <th scope="col" className="px-6 py-3">{t('users.name')}</th>
                                <th scope="col" className="px-6 py-3">{t('users.role')}</th>
                                <th scope="col" className="px-6 py-3">{t('users.team')}</th>
                                <th scope="col" className="px-6 py-3">{t('users.admin')}</th>
                                <th scope="col" className="px-6 py-3 text-right">{t('users.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {activeUsers.map(user => (
                                <tr key={user.id} className="bg-white hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                        <div className="flex items-center space-x-3">
                                            <img 
                                                src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=E2E8F0&color=475569`} 
                                                alt={user.name} 
                                                className="w-8 h-8 rounded-full object-cover" 
                                            />
                                            <div>
                                                <p>{user.name}</p>
                                                <p className="text-xs text-gray-400">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">{user.role}</td>
                                    <td className="px-6 py-4">{user.team}</td>
                                    <td className="px-6 py-4">{user.isAdmin ? 'Sim' : 'Não'}</td>
                                    <td className="px-6 py-4 text-right space-x-1">
                                        <button onClick={() => { setResetPasswordUser(user); setNewPassword(''); }} title="Resetar Senha" className="p-2 text-brand-subtle-text hover:text-amber-500"><ShieldCheckIcon className="w-5 h-5" /></button>
                                        <button onClick={() => handleEdit(user)} className="p-2 text-brand-subtle-text hover:text-brand-primary"><PencilIcon className="w-5 h-5" /></button>
                                        <button onClick={() => handleDelete(user.id, user.name)} className="p-2 text-brand-subtle-text hover:text-red-500"><TrashIcon className="w-5 h-5" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
            {isModalOpen && <UserFormModal user={editingUser} departments={departments} users={users} plan={plan} onClose={() => setModalOpen(false)} onSave={handleSave} />}
            
            {resetPasswordUser && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
                        <button onClick={() => setResetPasswordUser(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><XCircleIcon className="w-6 h-6" /></button>
                        <h3 className="text-xl font-bold text-brand-text mb-2">Resetar Senha</h3>
                        <p className="text-sm text-gray-500 mb-6 font-medium">Resetando senha para: <span className="text-brand-primary font-bold">{resetPasswordUser.name}</span></p>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">Nova Senha</label>
                                <input 
                                    type="password" 
                                    value={newPassword} 
                                    onChange={(e) => setNewPassword(e.target.value)} 
                                    placeholder="Digite a nova senha..."
                                    className="w-full bg-gray-50 border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium" 
                                />
                            </div>
                            
                            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 mb-4">
                                <p className="text-xs text-amber-700 leading-relaxed font-medium">Atenção: Ao confirmar, a senha do usuário será alterada imediatamente.</p>
                            </div>

                            <div className="flex justify-end space-x-3 pt-2">
                                <button 
                                    onClick={() => setResetPasswordUser(null)} 
                                    className="px-4 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleResetPassword}
                                    disabled={isResetting || !newPassword}
                                    className="px-6 py-2.5 text-sm font-bold text-white bg-brand-primary rounded-xl hover:bg-emerald-600 disabled:opacity-50 shadow-sm transition-all"
                                >
                                    {isResetting ? 'Alterando...' : 'Confirmar Alteração'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManager;