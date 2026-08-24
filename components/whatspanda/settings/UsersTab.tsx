import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, WhatsAppQueue, WhatsAppPermissions, WhatsAppSettings } from '../../../types';
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
    can_manage_tags: false,
    can_view_groups: false,
    can_start_chats: true
};

const UsersTab: React.FC = () => {
    const { profile } = useAuth();
    const [agents, setAgents] = useState<WhatsAppAgent[]>([]);
    const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
    const [queues, setQueues] = useState<WhatsAppQueue[]>([]);
    const [channels, setChannels] = useState<WhatsAppSettings[]>([]);
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

        // Fetch Channels
        const { data: channelsData } = await supabase
            .from('whatsapp_settings')
            .select('*')
            .eq('company_id', profile.company_id);

        if (channelsData) setChannels(channelsData);

        if (employees) {
            const mappedEmployees: Employee[] = employees.map(e => ({
                ...e,
                name: e.full_name || '',
                avatarUrl: e.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(e.full_name || 'User')}&background=E2E8F0&color=475569`,
                permissions: e.permissions || {}, // Handle potential nulls
                whatspanda_permissions: e.whatspanda_permissions || null
            })) as any;

            setAllEmployees(mappedEmployees);
            setAgents(mappedEmployees);
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
                <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Usuários e Permissões</h3>
                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400 opacity-70 uppercase tracking-widest mt-1">Gerencie quem tem acesso ao WhatsPanda e suas permissões.</p>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-xs opacity-50">Carregando usuários...</div>
            ) : (
                    <div className="bg-white/50 dark:bg-white/5 backdrop-blur-md rounded-[2rem] border border-gray-100 dark:border-white/5 overflow-x-auto custom-scrollbar shadow-2xl">
                        <table className="min-w-full divide-y divide-gray-100 dark:divide-white/5">
                            <thead className="bg-gray-50 dark:bg-transparent">
                            <tr>
                                    <th className="px-8 py-5 text-left text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">Usuário</th>
                                    <th className="px-8 py-5 text-left text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">Permissões</th>
                                    <th className="px-8 py-5 text-right text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">Ações</th>
                            </tr>
                        </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                {agents.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-8 py-20 text-center text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] opacity-50">
                                            Nenhum usuário configurado para o WhatsPanda.
                                        </td>
                                    </tr>
                                )}
                            {agents.map((agent) => (
                                <tr key={agent.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                                    <td className="px-8 py-6 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-12 w-12 group-hover:scale-110 transition-transform duration-500">
                                                {agent.avatarUrl ? (
                                                    <img className="h-12 w-12 rounded-2xl object-cover ring-2 ring-white dark:ring-white/10 shadow-lg" src={agent.avatarUrl} alt="" />
                                                ) : (
                                                        <div className="h-12 w-12 rounded-2xl bg-gray-100 dark:bg-white/10 flex items-center justify-center border border-white/10 text-gray-500 dark:text-gray-400">
                                                            <User className="w-6 h-6" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="ml-5">
                                                <div className="text-base font-bold text-gray-900 dark:text-white tracking-tight">{agent.name}</div>
                                                <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest opacity-70">{agent.role}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 whitespace-nowrap">
                                        <div className="flex flex-wrap gap-2">
                                            {agent.whatspanda_permissions?.can_manage_settings && (
                                                <span className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center">
                                                    <Shield className="w-3.5 h-3.5 mr-2" /> Admin
                                                </span>
                                            )}
                                            {agent.whatspanda_permissions?.can_view_chats && (
                                                <span className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center">
                                                    <MessageSquare className="w-3.5 h-3.5 mr-2" /> Chats
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => handleOpenModal(agent)} className="p-2.5 text-blue-500 hover:text-white bg-blue-500/5 hover:bg-blue-500 rounded-xl transition-all duration-300 mr-3">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleRemoveAgent(agent.id)} className="p-2.5 text-red-500 hover:text-white bg-red-500/5 hover:bg-red-500 rounded-xl transition-all duration-300">
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
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-500">
                    <div className="bg-white dark:bg-slate-900/90 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20 dark:border-white/5">
                        <div className="p-8 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-transparent">
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                                {editingAgent ? 'Editar Permissões' : 'Adicionar Usuário'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-2xl transition-all duration-300 text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-8 overflow-y-auto space-y-10 custom-scrollbar">
                            {/* User Select */}
                             <div>
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">Funcionário</label>
                                <select 
                                    className="w-full px-6 py-4 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all font-medium appearance-none"
                                    value={selectedEmployeeId}
                                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                    disabled={!!editingAgent}
                                >
                                    <option value="">Selecione um funcionário...</option>
                                    {allEmployees.map(emp => (
                                        <option key={emp.id} value={emp.id} className="dark:bg-slate-900">{emp.name} ({emp.email})</option>
                                    ))}
                                </select>
                             </div>

                            {/* Allowed Queues */}
                            <div>
                                <h4 className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">Filas de Atendimento (Setores)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-gray-100 dark:border-white/5 rounded-[2rem] p-6 bg-gray-50/50 dark:bg-white/5 mb-8">
                                    {queues.length === 0 ? (
                                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest col-span-full py-4 text-center opacity-50 italic">Nenhuma fila configurada.</p>
                                    ) : (
                                        queues.map((queue) => (
                                            <div key={queue.id} className="flex items-center group/item hover:translate-x-1 transition-transform">
                                                <input
                                                    id={`queue-${queue.id}`}
                                                    type="checkbox"
                                                    checked={permissions.assigned_queues?.includes(queue.id) || false}
                                                    onChange={(e) => {
                                                        const current = permissions.assigned_queues || [];
                                                        if (e.target.checked) {
                                                            setPermissions({ ...permissions, assigned_queues: [...current, queue.id] });
                                                        } else {
                                                            setPermissions({ ...permissions, assigned_queues: current.filter(id => id !== queue.id) });
                                                        }
                                                    }}
                                                    className="h-5 w-5 rounded-lg border-gray-300/50 dark:border-white/10 text-emerald-500 focus:ring-emerald-500/20 bg-white dark:bg-white/5 transition-all cursor-pointer"
                                                />
                                                <label htmlFor={`queue-${queue.id}`} className="ml-4 text-sm font-bold text-gray-700 dark:text-gray-300 cursor-pointer group-hover/item:text-emerald-500 transition-colors flex items-center gap-2">
                                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: queue.color }}></div>
                                                    {queue.name}
                                                </label>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Allowed Channels */}
                            <div>
                                <h4 className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">Canais Permitidos</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-gray-100 dark:border-white/5 rounded-[2rem] p-6 bg-gray-50/50 dark:bg-white/5">
                                    {channels.length === 0 ? (
                                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest col-span-full py-4 text-center opacity-50 italic">Nenhum canal configurado.</p>
                                    ) : (
                                        channels.map((channel) => (
                                            <div key={channel.id} className="flex items-center group/item hover:translate-x-1 transition-transform">
                                                <input
                                                    id={`channel-${channel.id}`}
                                                    type="checkbox"
                                                    checked={permissions.allowed_connections?.includes(channel.id) || false}
                                                    onChange={(e) => {
                                                        const current = permissions.allowed_connections || [];
                                                        if (e.target.checked) {
                                                            setPermissions({ ...permissions, allowed_connections: [...current, channel.id] });
                                                        } else {
                                                            setPermissions({ ...permissions, allowed_connections: current.filter(id => id !== channel.id) });
                                                        }
                                                    }}
                                                    className="h-5 w-5 rounded-lg border-gray-300/50 dark:border-white/10 text-emerald-500 focus:ring-emerald-500/20 bg-white dark:bg-white/5 transition-all"
                                                />
                                                <label htmlFor={`channel-${channel.id}`} className="ml-4 text-sm font-bold text-gray-700 dark:text-gray-300 cursor-pointer group-hover/item:text-emerald-500 transition-colors">
                                                    {channel.connection_name} <br />
                                                    <span className="text-[9px] text-gray-500 dark:text-gray-500 uppercase tracking-widest font-bold opacity-60">({channel.channel_type || 'whatsapp'})</span>
                                                </label>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Permissions Toggles */}
                             <div>
                                <h4 className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-6">Permissões de Acesso</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                                    {[
                                        { key: 'can_view_contacts', label: 'Ver Contatos', desc: 'Visualizar lista de contatos.' },
                                        { key: 'can_edit_contacts', label: 'Editar Contatos', desc: 'Criar e editar contatos.' },
                                        { key: 'can_view_chats', label: 'Acessar Chats', desc: 'Ver conversas e histórico.' },
                                        { key: 'can_send_messages', label: 'Enviar Mensagens', desc: 'Enviar mensagens de texto.' },
                                        { key: 'can_send_media', label: 'Enviar Mídia', desc: 'Enviar fotos, vídeos e áudios.' },
                                        { key: 'can_start_chats', label: 'Iniciar Conversas', desc: 'Permitir iniciar novos atendimentos / tickets.' },
                                        { key: 'can_transfer', label: 'Transferir Conversas', desc: 'Permitir transferência entre setores/usuários.' },
                                        { key: 'can_see_all_departments', label: 'Ver Todos Departamentos', desc: 'Ver conversas de qualquer departamento.' },
                                        { key: 'can_view_others_chats', label: 'Ver Chats de Terceiros', desc: 'Ver conversas atribuídas a outros usuários.' },
                                        { key: 'can_manage_tags', label: 'Gerenciar Tags', desc: 'Criar e atribuir tags a conversas.' },
                                        { key: 'can_manage_settings', label: 'Gerenciar Configurações', desc: 'Acesso total às configurações.' },
                                    ].map((perm) => (
                                        <div key={perm.key} className="flex items-start group/perm cursor-pointer" onClick={() => handlePermissionChange(perm.key as keyof WhatsAppPermissions)}>
                                            <div className="flex h-6 items-center">
                                                <input
                                                    id={perm.key}
                                                    type="checkbox"
                                                    checked={(permissions as any)[perm.key]}
                                                    readOnly
                                                    className="h-5 w-5 rounded-lg border-gray-300/50 dark:border-white/10 text-emerald-500 focus:ring-emerald-500/20 bg-white dark:bg-white/5 transition-all cursor-pointer"
                                                />
                                            </div>
                                            <div className="ml-4 text-sm">
                                                <label htmlFor={perm.key} className="font-bold text-gray-900 dark:text-white group-hover/perm:text-emerald-500 transition-colors cursor-pointer tracking-tight">{perm.label}</label>
                                                <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest opacity-60 mt-1">{perm.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                             </div>
                        </div>

                        <div className="p-8 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-transparent flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="w-full sm:w-auto justify-center px-8 py-3.5 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-white/10 rounded-2xl transition-all font-bold text-xs uppercase tracking-[0.2em] flex items-center"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!selectedEmployeeId}
                                className="w-full sm:w-auto justify-center px-10 py-3.5 bg-emerald-500 text-white rounded-2xl hover:bg-emerald-600 transition-all font-bold text-xs uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Check className="w-5 h-5 mr-3 shrink-0" />
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
