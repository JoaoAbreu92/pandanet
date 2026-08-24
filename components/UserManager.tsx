import React, { useState } from 'react';
import Card from './Card';
import type { Employee, Plan } from '../types';
import { PlusIcon, PencilIcon, TrashIcon, XCircleIcon } from './icons';
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
            openTickets: true,
            viewCalendar: true,
            viewResources: true,
            useMarketplace: true,
            canPostText: true,
            canPostImage: true,
            canPostVideo: true,
            createEvents: false,
            manageMarketplace: false,
        },
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handlePermissionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            permissions: { ...prev.permissions, [name]: checked }
        }));
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
                    <div>
                        <div className="space-y-4">
                            {/* Feed Permissions */}
                            <div>
                                <h4 className="font-semibold text-sm text-gray-700 mb-2 border-b pb-1">Feed Social</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    <label className="flex items-center space-x-2 text-brand-text">
                                        <input type="checkbox" name="canPostText" checked={formData.permissions.canPostText} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                        <span className="text-sm">Postar Texto</span>
                                    </label>
                                    <label className="flex items-center space-x-2 text-brand-text">
                                        <input type="checkbox" name="canPostImage" checked={formData.permissions.canPostImage} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                        <span className="text-sm">Postar Imagem</span>
                                    </label>
                                    <label className="flex items-center space-x-2 text-brand-text">
                                        <input type="checkbox" name="canPostVideo" checked={formData.permissions.canPostVideo} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                        <span className="text-sm">Postar Vídeo</span>
                                    </label>
                                </div>
                            </div>

                            {/* General Permissions */}
                            <div>
                                <h4 className="font-semibold text-sm text-gray-700 mb-2 border-b pb-1">Geral</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    <label className="flex items-center space-x-2 text-brand-text">
                                        <input type="checkbox" name="viewMessages" checked={formData.permissions.viewMessages} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                        <span className="text-sm">Chat & Mensagens</span>
                                    </label>
                                    <label className="flex items-center space-x-2 text-brand-text">
                                        <input type="checkbox" name="viewCalendar" checked={formData.permissions.viewCalendar} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                        <span className="text-sm">Calendário</span>
                                    </label>
                                    <label className="flex items-center space-x-2 text-brand-text">
                                        <input type="checkbox" name="useMarketplace" checked={formData.permissions.useMarketplace} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                        <span className="text-sm">Marketplace</span>
                                    </label>
                                    <label className="flex items-center space-x-2 text-brand-text">
                                        <input type="checkbox" name="viewWellbeing" checked={formData.permissions.viewWellbeing} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                        <span className="text-sm">Bem Estar</span>
                                    </label>
                                </div>
                            </div>

                            {/* RH Permissions */}
                            <div>
                                <h4 className="font-semibold text-sm text-gray-700 mb-2 border-b pb-1">Recursos Humanos (RH)</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    <label className="flex items-center space-x-2 text-brand-text">
                                        <input type="checkbox" name="viewDirectory" checked={formData.permissions.viewDirectory} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                        <span className="text-sm">Diretório</span>
                                    </label>
                                    <label className="flex items-center space-x-2 text-brand-text">
                                        <input type="checkbox" name="viewForms" checked={formData.permissions.viewForms} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                        <span className="text-sm">Formulários</span>
                                    </label>
                                    <label className="flex items-center space-x-2 text-brand-text">
                                        <input type="checkbox" name="viewBenefits" checked={formData.permissions.viewBenefits} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                        <span className="text-sm">Benefícios</span>
                                    </label>
                                    <label className="flex items-center space-x-2 text-brand-text">
                                        <input type="checkbox" name="viewOnboarding" checked={formData.permissions.viewOnboarding} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                        <span className="text-sm">Onboarding</span>
                                    </label>
                                    <label className="flex items-center space-x-2 text-brand-text">
                                        <input type="checkbox" name="viewRecognition" checked={formData.permissions.viewRecognition} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                        <span className="text-sm">Reconhecimentos</span>
                                    </label>
                                    <label className="flex items-center space-x-2 text-brand-text">
                                        <input type="checkbox" name="viewDocuments" checked={formData.permissions.viewDocuments} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                        <span className="text-sm">Documentos</span>
                                    </label>
                                    <label className="flex items-center space-x-2 text-brand-text">
                                        <input type="checkbox" name="viewTraining" checked={formData.permissions.viewTraining} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                        <span className="text-sm">Treinamentos</span>
                                    </label>
                                    <label className="flex items-center space-x-2 text-brand-text">
                                        <input type="checkbox" name="viewSurveys" checked={formData.permissions.viewSurveys} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                        <span className="text-sm">Pesquisas</span>
                                    </label>
                                    <label className="flex items-center space-x-2 text-brand-text">
                                        <input type="checkbox" name="viewPolicies" checked={formData.permissions.viewPolicies} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                        <span className="text-sm">Políticas</span>
                                    </label>
                                </div>
                            </div>

                            {/* TI Permissions */}
                            <div>
                                <h4 className="font-semibold text-sm text-gray-700 mb-2 border-b pb-1">Tecnologia da Informação (TI)</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    <label className="flex items-center space-x-2 text-brand-text">
                                        <input type="checkbox" name="viewTiDashboard" checked={formData.permissions.viewTiDashboard} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                        <span className="text-sm">Dashboard TI</span>
                                    </label>
                                    <label className="flex items-center space-x-2 text-brand-text">
                                        <input type="checkbox" name="openTickets" checked={formData.permissions.openTickets} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                        <span className="text-sm">Meus Chamados</span>
                                    </label>
                                    <label className="flex items-center space-x-2 text-brand-text">
                                        <input type="checkbox" name="openTiRequests" checked={formData.permissions.openTiRequests} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                        <span className="text-sm">Solicitar Equipamento</span>
                                    </label>
                                    <label className="flex items-center space-x-2 text-brand-text">
                                        <input type="checkbox" name="viewKnowledgeBase" checked={formData.permissions.viewKnowledgeBase} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                        <span className="text-sm">Base de Conhecimento</span>
                                    </label>
                                    <label className="flex items-center space-x-2 text-brand-text">
                                        <input type="checkbox" name="viewServiceStatus" checked={formData.permissions.viewServiceStatus} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                        <span className="text-sm">Status de Serviços</span>
                                    </label>
                                    <label className="flex items-center space-x-2 text-brand-text">
                                        <input type="checkbox" name="viewInfoSec" checked={formData.permissions.viewInfoSec} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                        <span className="text-sm">Segurança da Info.</span>
                                    </label>
                                </div>
                            </div>

                            {/* New Permissions */}
                            <div>
                                <h4 className="font-semibold text-sm text-gray-700 mb-2 border-b pb-1">Permissões Especiais</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    <label className="flex items-center space-x-2 text-brand-text">
                                        <input type="checkbox" name="createEvents" checked={formData.permissions.createEvents} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                        <span className="text-sm">Criar Eventos</span>
                                    </label>
                                    <label className="flex items-center space-x-2 text-brand-text">
                                        <input type="checkbox" name="manageMarketplace" checked={formData.permissions.manageMarketplace} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                        <span className="text-sm">Gerenciar Marketplace</span>
                                    </label>
                                </div>
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
                // UPDATE
                const { error } = await supabase
                    .from('profiles')
                    .update({
                        full_name: userData.name,
                        email: userData.email,
                        role: userData.role,
                        team: userData.team,
                        is_admin: userData.isAdmin,
                        is_company_admin: userData.isAdmin,
                        permissions: userData.permissions,
                        avatar_url: userData.avatarUrl,
                        department_id: (userData as any).department_id || null
                    })
                    .eq('id', userData.id);

                if (error) throw error;
                setUsers(users.map(u => u.id === userData.id ? userData : u));
            } else {
                // INSERT (Note: This is profile table, not Auth yet. In a real app we'd need Auth.signUp)
                // For this MVP, we create the profile and the user will link via email on first login
                if (users.length >= plan.userLimit) {
                    alert(`Limite de ${plan.userLimit} usuários para o plano ${plan.name} atingido.`);
                    return;
                }

                // Since we don't have auth.uid yet, we generate a UUID for the profile
                const { data, error } = await supabase
                    .from('profiles')
                    .insert([{
                        full_name: userData.name,
                        email: userData.email,
                        role: userData.role,
                        team: userData.team,
                        company_id: targetCompanyId,
                        is_admin: userData.isAdmin,
                        is_company_admin: userData.isAdmin,
                        permissions: userData.permissions,
                        avatar_url: userData.avatarUrl,
                        join_date: userData.joinDate,
                        birth_date: userData.birthDate,
                        department_id: (userData as any).department_id || null
                    }])
                    .select();

                if (error) throw error;
                if (data) {
                    const newUser = { ...userData, id: data[0].id } as Employee;
                    setUsers([newUser, ...users]);
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

    const handleDelete = async (userId: string) => {
        if (window.confirm("Tem certeza que deseja apagar este usuário?")) {
            try {
                const { error } = await supabase.from('profiles').delete().eq('id', userId);
                if (error) throw error;
                setUsers(users.filter(u => u.id !== userId));
            } catch (err: any) {
                alert("Erro ao excluir: " + err.message);
            }
        }
    };

    return (
        <>
            <Card title={t('users.title')} headerAction={
                <div className="flex items-center space-x-4">
                    <span className="text-sm text-brand-subtle-text">{users.length} de {plan.userLimit} usuários</span>
                    <button onClick={() => { setEditingUser(null); setModalOpen(true); }} className="flex items-center space-x-2 px-3 py-2 text-sm bg-brand-primary text-white rounded-md hover:bg-emerald-600 disabled:opacity-50" disabled={users.length >= plan.userLimit}>
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
                            {users.map(user => (
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
                                        <button onClick={() => handleDelete(user.id)} className="p-2 text-brand-subtle-text hover:text-red-500"><TrashIcon className="w-5 h-5" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
            {isModalOpen && <UserFormModal user={editingUser} departments={departments} onClose={() => setModalOpen(false)} onSave={handleSave} />}
        </>
    );
};

export default UserManager;