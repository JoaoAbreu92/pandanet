import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, WhatsAppQueue, WhatsAppPermissions } from '../../../types';
import { useAuth } from '../../../components/AuthContext';
import { Plus, Edit2, Trash2, X, Check, User, Shield, MessageSquare } from 'lucide-react';

interface WhatsAppAgent extends Employee {
    queues?: string[]; // Stored in whatspanda_permissions for now or separate
}

const DEFAULT_PERMISSIONS: WhatsAppPermissions = {
    can_view_contacts: true,
    can_edit_contacts: false,
    can_view_chats: true,
    can_send_messages: true,
    can_send_media: true,
    can_manage_settings: false,
    can_transfer: false,
    can_see_all_departments: false,
    can_manage_tags: false
};

const UsersTab: React.FC = () => {
    const { profile } = useAuth();
    const [agents, setAgents] = useState<WhatsAppAgent[]>([]);
    const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
    const [queues, setQueues] = useState<WhatsAppQueue[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAgent, setEditingAgent] = useState<WhatsAppAgent | null>(null);

    // Form State
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [selectedQueues, setSelectedQueues] = useState<string[]>([]);
    const [permissions, setPermissions] = useState<WhatsAppPermissions>(DEFAULT_PERMISSIONS);

    useEffect(() => {
        if (profile?.company_id) {
            fetchData();
        }
    }, [profile?.company_id]);

    const fetchData = async () => {
        setLoading(true);
        if (!profile?.company_id) return;

        // Fetch all employees of the company
        const { data: employees, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('company_id', profile.company_id);

        if (error) {
            console.error('Error fetching employees:', error);
            setLoading(false);
            return;
        }

        // Fetch Queues
        const { data: queuesData } = await supabase
            .from('whatsapp_queues')
            .select('*')
            .eq('company_id', profile.company_id);

        if (queuesData) setQueues(queuesData);

        if (employees) {
            const mappedEmployees: Employee[] = employees.map(e => ({
                ...e,
                permissions: e.permissions || {}, // Handle potential nulls
                whatspanda_permissions: e.whatspanda_permissions || null
            })) as any;

            setAllEmployees(mappedEmployees);

            // Filter agents: those who have ANY entries in whatspanda_permissions
            // OR we can just show everyone. Let's show only those with permissions set (Agents)
            // But initially no one has permissions. So maybe show everyone?
            // The user request says "adicionar um usuário... busca na lista de funcionários".
            // So the list should show "Agents" (those added to WhatsPanda).
            // "Adding" means setting initial permissions.

            const activeAgents = mappedEmployees.filter(e => e.whatspanda_permissions !== null && e.whatspanda_permissions !== undefined);
            setAgents(activeAgents);
        }
        setLoading(false);
    };

    const handleOpenModal = (agent?: WhatsAppAgent) => {
        if (agent) {
            setEditingAgent(agent);
            setSelectedEmployeeId(agent.id);
            // Queues are currently not in types.ts for Employee, let's assume they might be in permissions or handled separately.
            // For this implementation, we will store queues in 'whatspanda_permissions' as loose prop if needed, 
            // but strict text says keys: can_view... 
            // Let's rely on the permissions object.
            setPermissions(agent.whatspanda_permissions || DEFAULT_PERMISSIONS);
            // reset queues for now as we don't have storage for them yet in the plan
            setSelectedQueues([]); 
        } else {
            setEditingAgent(null);
            setSelectedEmployeeId('');
            setPermissions(DEFAULT_PERMISSIONS);
            setSelectedQueues([]);
        }
        setIsModalOpen(true);
    };

    const handlePermissionChange = (key: keyof WhatsAppPermissions) => {
        setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSave = async () => {
        if (!selectedEmployeeId) return;

        const employee = allEmployees.find(e => e.id === selectedEmployeeId);
        if (!employee) return;

        // Update profile with new permissions
        const updates = {
            whatspanda_permissions: permissions
        };

        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', selectedEmployeeId);

        if (error) {
            alert('Erro ao salvar permissões: ' + error.message);
        } else {
            // Refresh list
            fetchData();
            setIsModalOpen(false);
        }
    };

    const handleRemoveAgent = async (id: string) => {
        if (!confirm('Tem certeza que deseja remover este usuário do WhatsPanda? (Isso revogará todas as permissões)')) return;

        const { error } = await supabase
            .from('profiles')
            .update({ whatspanda_permissions: null })
            .eq('id', id);

        if (error) {
            alert('Erro ao remover usuário: ' + error.message);
        } else {
            fetchData();
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">Usuários e Permissões</h3>
                    <p className="text-sm text-gray-500">Gerencie quem tem acesso ao WhatsPanda e suas permissões.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Usuário
                </button>
            </div>

            {loading ? (
                <div className="text-center py-8 text-gray-500">Carregando usuários...</div>
            ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuário</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permissões</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                                {agents.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                                            Nenhum usuário configurado para o WhatsPanda.
                                        </td>
                                    </tr>
                                )}
                            {agents.map((agent) => (
                                <tr key={agent.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10">
                                                {agent.avatarUrl ? (
                                                    <img className="h-10 w-10 rounded-full object-cover" src={agent.avatarUrl} alt="" />
                                                ) : (
                                                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                                        <User className="w-5 h-5 text-gray-500" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                                                <div className="text-sm text-gray-500">{agent.role}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-wrap gap-2">
                                            {agent.whatspanda_permissions?.can_manage_settings && (
                                                <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800 flex items-center">
                                                    <Shield className="w-3 h-3 mr-1" /> Admin
                                                </span>
                                            )}
                                            {agent.whatspanda_permissions?.can_view_chats && (
                                                <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 flex items-center">
                                                    <MessageSquare className="w-3 h-3 mr-1" /> Chats
                                                </span>
                                            )}
                                            {/* Add more badges as needed */}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => handleOpenModal(agent)} className="text-blue-600 hover:text-blue-900 mr-4">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleRemoveAgent(agent.id)} className="text-red-600 hover:text-red-900">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900">
                                {editingAgent ? 'Editar Permissões' : 'Adicionar Usuário ao WhatsPanda'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* User Select */}
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Funcionário</label>
                                <select 
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                    value={selectedEmployeeId}
                                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                    disabled={!!editingAgent}
                                >
                                    <option value="">Selecione um funcionário...</option>
                                    {allEmployees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.email})</option>
                                    ))}
                                </select>
                             </div>

                            {/* Permissions Toggles */}
                             <div>
                                <h4 className="text-sm font-medium text-gray-900 mb-3">Permissões de Acesso</h4>
                                <div className="space-y-3">
                                    {[
                                        { key: 'can_view_contacts', label: 'Ver Contatos', desc: 'Pode visualizar a lista de contatos.' },
                                        { key: 'can_edit_contacts', label: 'Editar Contatos', desc: 'Pode criar e editar contatos.' },
                                        { key: 'can_view_chats', label: 'Acessar Chats', desc: 'Pode visualizar conversas e histórico.' },
                                        { key: 'can_send_messages', label: 'Enviar Mensagens', desc: 'Pode enviar mensagens de texto.' },
                                        { key: 'can_send_media', label: 'Enviar Mídia', desc: 'Pode enviar fotos, vídeos e áudios.' },
                                        { key: 'can_manage_settings', label: 'Gerenciar Configurações', desc: 'Acesso total às configurações do WhatsPanda.' },
                                    ].map((perm) => (
                                        <div key={perm.key} className="flex items-start">
                                            <div className="flex h-5 items-center">
                                                <input
                                                    id={perm.key}
                                                    type="checkbox"
                                                    checked={(permissions as any)[perm.key]}
                                                    onChange={() => handlePermissionChange(perm.key as keyof WhatsAppPermissions)}
                                                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                />
                                            </div>
                                            <div className="ml-3 text-sm">
                                                <label htmlFor={perm.key} className="font-medium text-gray-700">{perm.label}</label>
                                                <p className="text-gray-500">{perm.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                             </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!selectedEmployeeId}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Check className="w-4 h-4 mr-2" />
                                Salvar Permissões
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UsersTab;
