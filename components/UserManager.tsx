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
    Cog6ToothIcon
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
    onClose: () => void;
    onSave: (user: Omit<Employee, 'id'> | Employee) => void;
}> = ({ user, departments, onClose, onSave }) => {
    const { t } = useLanguage();
    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        password: user?.password || '',
        role: user?.role || '',
        team: user?.team || '',
        sectorManager: user?.sectorManager || '',
        employeeManager: user?.employeeManager || '',
        isAdmin: user?.isAdmin || false,
        avatarUrl: user?.avatarUrl || `https://i.pravatar.cc/150?u=${user?.email || Date.now()}`,
        birthDate: user?.birthDate || '1990-01-01',
        joinDate: user?.joinDate || new Date().toISOString().split('T')[0],
        department_id: user?.department_id || '',
        permissions: user?.permissions || {
            viewMessages: true,
            viewCalendar: true,
            useMarketplace: true,
            viewEmail: true,
            viewDirectory: true,
            viewForms: true,
            viewBenefits: true,
            viewOnboarding: true,
            viewRecognition: true,
            viewDocuments: true,
            viewTraining: true,
            viewSurveys: true,
            viewPolicies: true,
            viewWellbeing: true,
            viewTiDashboard: false,
            openTickets: true,
            openTiRequests: true,
            viewKnowledgeBase: true,
            viewServiceStatus: true,
            viewInfoSec: true,
            createEvents: false,
            manageMarketplace: false,
            viewEmployeeDetails: false,
            editEmployeeProfile: false,
            deleteEmployeeProfile: false,
            viewVacationRequests: false,
            manageVacationRequests: false,
            canPostText: true,
            canPostImage: true,
            canPostVideo: true,
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
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave((user?.id && user.id !== '') ? { ...user, ...formData } as Employee : formData as Omit<Employee, 'id'>);
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

                        <div><label className="block text-sm font-medium text-brand-subtle-text">{t('users.sector_manager')}</label><input type="text" name="sectorManager" value={formData.sectorManager} onChange={handleChange} className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" /></div>
                        <div><label className="block text-sm font-medium text-brand-subtle-text">{t('users.employee_manager')}</label><input type="text" name="employeeManager" value={formData.employeeManager} onChange={handleChange} className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" /></div>

                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text">Departamento</label>
                            <select
                                name="department_id"
                                value={formData.department_id}
                                onChange={(e) => setFormData(prev => ({ ...prev, department_id: e.target.value }))}
                                className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"
                            >
                                <option value="">Sem Departamento</option>
                                {departments.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>

                        <div><label className="flex items-center space-x-2 mt-6 text-brand-text"><input type="checkbox" name="isAdmin" checked={formData.isAdmin} onChange={handleChange} className="rounded text-brand-primary" /><span>{t('users.admin')}</span></label></div>
                    </div>

                    <div className="border-t pt-6">
                        <h4 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <ShieldCheckIcon className="w-5 h-5 text-brand-primary" />
                            Configurações de Acesso e Permissões
                        </h4>

                        <div className="space-y-8">
                            {/* Grupo: Social */}
                            <section>
                                <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
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

                            {/* Grupo: Corporativo */}
                            <section>
                                <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <BuildingOfficeIcon className="w-3 h-3" /> Corporativo & RH
                                </h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <PermissionToggle icon={<CalendarDaysIcon className="w-4 h-4" />} label="Calendário" name="viewCalendar" checked={formData.permissions.viewCalendar} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                    <PermissionToggle icon={<UsersIcon className="w-4 h-4" />} label="Diretório de Pessoas" name="viewDirectory" checked={formData.permissions.viewDirectory} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                    <PermissionToggle icon={<DocumentTextIcon className="w-4 h-4" />} label="Formulários" name="viewForms" checked={formData.permissions.viewForms} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                    <PermissionToggle icon={<HeartIcon className="w-4 h-4" />} label="Benefícios" name="viewBenefits" checked={formData.permissions.viewBenefits} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                    <PermissionToggle icon={<RocketLaunchIcon className="w-4 h-4" />} label="Onboarding" name="viewOnboarding" checked={formData.permissions.viewOnboarding} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                    <PermissionToggle icon={<StarIcon className="w-4 h-4" />} label="Reconhecimentos" name="viewRecognition" checked={formData.permissions.viewRecognition} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                    <PermissionToggle icon={<FolderIcon className="w-4 h-4" />} label="Biblioteca de Documentos" name="viewDocuments" checked={formData.permissions.viewDocuments} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                    <PermissionToggle icon={<HeartIcon className="w-4 h-4" />} label="Bem Estar" name="viewWellbeing" checked={formData.permissions.viewWellbeing} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                </div>
                            </section>

                            {/* Grupo: Tecnologia */}
                            <section>
                                <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <LifebuoyIcon className="w-3 h-3" /> Suporte & T.I.
                                </h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <PermissionToggle icon={<TicketIcon className="w-4 h-4" />} label="Meus Chamados" name="openTickets" checked={formData.permissions.openTickets} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                    <PermissionToggle icon={<PlusIcon className="w-4 h-4" />} label="Solicitar Equipamento" name="openTiRequests" checked={formData.permissions.openTiRequests} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                    <PermissionToggle icon={<Cog6ToothIcon className="w-4 h-4" />} label="Dashboard T.I. (Admin)" name="viewTiDashboard" checked={formData.permissions.viewTiDashboard} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                </div>
                            </section>

                            {/* Grupo: Gestão RH Crítica */}
                            <section className="bg-red-50/50 p-4 rounded-2xl border border-red-100">
                                <h5 className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <ShieldCheckIcon className="w-3 h-3" /> Gestão Sensível (RH Admin)
                                </h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <PermissionToggle icon={<UsersIcon className="w-4 h-4" />} label="Ver Dados Confidenciais" name="viewEmployeeDetails" checked={formData.permissions.viewEmployeeDetails} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                    <PermissionToggle icon={<PencilIcon className="w-4 h-4" />} label="Editar Funcionários" name="editEmployeeProfile" checked={formData.permissions.editEmployeeProfile} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                    <PermissionToggle icon={<TrashIcon className="w-4 h-4" />} label="Excluir Funcionários" name="deleteEmployeeProfile" checked={formData.permissions.deleteEmployeeProfile} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                    <PermissionToggle icon={<CalendarDaysIcon className="w-4 h-4" />} label="Aprovar/Rejeitar Férias" name="manageVacationRequests" checked={formData.permissions.manageVacationRequests} onChange={(n, c) => setFormData(p => ({ ...p, permissions: { ...p.permissions, [n]: c } }))} />
                                </div>
                            </section>
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

    const handleSave = async (userData: Omit<Employee, 'id'> | Employee) => {
        if (!profile?.company_id && profile?.role !== 'Super Admin') {
            alert("Erro: Empresa não identificada.");
            return;
        }

        const targetCompanyId = profile?.company_id || '56eaa5ed-8d1b-4879-a002-838702eeb14d'; // Fallback to Pixel if super admin

        try {
            if ('id' in userData && userData.id.length > 15) { // UUID is long, local id (Date.now()) is shorter
                // UPDATE via RPC (SECURITY DEFINER)
                const { error } = await supabase.rpc('update_user_profile', {
                    p_user_id: userData.id,
                    p_full_name: userData.name,
                    p_role: userData.role,
                    p_team: userData.team,
                    p_department_id: (userData as any).department_id || null,
                    p_is_admin: !!userData.isAdmin,
                    p_is_company_admin: !!userData.isAdmin,
                    p_permissions: userData.permissions,
                    p_avatar_url: userData.avatarUrl || null,
                    p_rg: (userData as any).rg || null,
                    p_cpf: (userData as any).cpf || null,
                    p_emergency_contact_name: (userData as any).emergency_contact_name || null,
                    p_emergency_contact_phone: (userData as any).emergency_contact_phone || null,
                    p_health_insurance: (userData as any).health_insurance || null,
                    p_blood_type: (userData as any).blood_type || null,
                    p_marital_status: (userData as any).marital_status || null,
                    p_education_level: (userData as any).education_level || null
                });

                if (error) {
                    console.error("RPC Update Error:", error);
                    throw new Error(`Erro ao atualizar perfil: ${error.message}`);
                }
                setUsers(users.map(u => u.id === userData.id ? userData : u));
            } else {
                // INSERT (Note: This is profile table, not Auth yet. In a real app we'd need Auth.signUp)
                // For this MVP, we create the profile and the user will link via email on first login
                if (users.length >= plan.userLimit) {
                    alert(`Atenção: Sua empresa excedeu o limite de ${plan.userLimit} usuários do seu plano atual (${plan.name}). Por favor, contate o suporte para mudar o plano e liberar novos acessos.`);
                    return;
                }

                // INSERT via RPC (SECURITY DEFINER)
                try {
                    const { data: newId, error } = await supabase.rpc('create_user_admin', {
                        p_email: userData.email,
                        p_password: (userData as any).password || 'PandaNet123', // Default password for new users
                        p_full_name: userData.name,
                        p_role: userData.role,
                        p_team: userData.team,
                        p_company_id: targetCompanyId,
                        p_is_admin: !!userData.isAdmin,
                        p_is_company_admin: !!userData.isAdmin,
                        p_permissions: userData.permissions,
                        p_avatar_url: userData.avatarUrl || null,
                        p_department_id: (userData as any).department_id || null,
                        p_rg: (userData as any).rg || null,
                        p_cpf: (userData as any).cpf || null
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
                                                <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full" />
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
                                            <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full" />
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
                                        <button onClick={() => handleEdit(user)} className="p-2 text-brand-subtle-text hover:text-brand-primary"><PencilIcon className="w-5 h-5" /></button>
                                        <button onClick={() => handleDelete(user.id, user.name)} className="p-2 text-brand-subtle-text hover:text-red-500"><TrashIcon className="w-5 h-5" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
            {isModalOpen && <UserFormModal user={editingUser} departments={departments} onClose={() => setModalOpen(false)} onSave={handleSave} />}
        </div>
    );
};

export default UserManager;