import React, { useState } from 'react';
import Card from './Card';
import type { Employee, Plan } from '../types';
import { PlusIcon, PencilIcon, TrashIcon, XCircleIcon } from './icons';
import { useLanguage } from './LanguageContext';

interface UserManagerProps {
    users: Employee[];
    setUsers: (users: Employee[]) => void;
    plan: Plan;
}

const UserFormModal: React.FC<{
    user: Partial<Employee> | null;
    onClose: () => void;
    onSave: (user: Omit<Employee, 'id'> | Employee) => void;
}> = ({ user, onClose, onSave }) => {
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
        permissions: user?.permissions || {
            viewMessages: true,
            openTickets: true,
            viewCalendar: true,
            viewResources: true,
            useMarketplace: true,
            canPostText: true,
            canPostImage: true,
            canPostVideo: true,
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
        onSave(user?.id ? { ...user, ...formData } as Employee : formData as Omit<Employee, 'id'>);
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

                        <div><label className="flex items-center space-x-2 mt-6 text-brand-text"><input type="checkbox" name="isAdmin" checked={formData.isAdmin} onChange={handleChange} className="rounded text-brand-primary" /><span>{t('users.admin')}</span></label></div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text mb-2">{t('users.permissions_feed')}</label>
                        <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-gray-50 rounded-md">
                            <label className="flex items-center space-x-2 text-brand-text">
                                <input type="checkbox" name="canPostText" checked={formData.permissions.canPostText} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                <span>Postar Pensamentos</span>
                            </label>
                            <label className="flex items-center space-x-2 text-brand-text">
                                <input type="checkbox" name="canPostImage" checked={formData.permissions.canPostImage} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                <span>Postar Imagens</span>
                            </label>
                            <label className="flex items-center space-x-2 text-brand-text">
                                <input type="checkbox" name="canPostVideo" checked={formData.permissions.canPostVideo} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                <span>Postar Vídeos</span>
                            </label>
                        </div>

                        <label className="block text-sm font-medium text-brand-subtle-text mb-2">{t('users.permissions_other')}</label>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.keys(formData.permissions).filter(k => !k.startsWith('canPost')).map(key => (
                                <label key={key} className="flex items-center space-x-2 text-brand-text">
                                    <input type="checkbox" name={key} checked={formData.permissions[key as keyof typeof formData.permissions]} onChange={handlePermissionChange} className="rounded text-brand-primary" />
                                    <span>{key.replace('view', 'Ver ').replace('open', 'Abrir ').replace('use', 'Usar ')}</span>
                                </label>
                            ))}
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


const UserManager: React.FC<UserManagerProps> = ({ users, setUsers, plan }) => {
    const { t } = useLanguage();
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<Employee | null>(null);

    const handleSave = (userData: Omit<Employee, 'id'> | Employee) => {
        if ('id' in userData) {
            setUsers(users.map(u => u.id === userData.id ? userData : u));
        } else {
            if (users.length >= plan.userLimit) {
                alert(`Limite de ${plan.userLimit} usuários para o plano ${plan.name} atingido.`);
                return;
            }
            const newUser: Employee = { ...userData, id: Date.now() };
            setUsers([newUser, ...users]);
        }
        setModalOpen(false);
        setEditingUser(null);
    };

    const handleEdit = (user: Employee) => {
        setEditingUser(user);
        setModalOpen(true);
    };

    const handleDelete = (userId: number) => {
        if (window.confirm("Tem certeza que deseja apagar este usuário?")) {
            setUsers(users.filter(u => u.id !== userId));
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
            {isModalOpen && <UserFormModal user={editingUser} onClose={() => setModalOpen(false)} onSave={handleSave} />}
        </>
    );
};

export default UserManager;