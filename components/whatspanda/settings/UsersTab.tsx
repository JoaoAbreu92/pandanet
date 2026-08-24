import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, WhatsAppQueue } from '../../../types'; // Assuming Employee type has queue assignments if expanded, or we manage via separate table
import { Plus, Edit2, Trash2, X, Check, User } from 'lucide-react';

// Mock Interface for WhatsApp User Management if not strictly bound to Employee yet or if we need extra fields
interface WhatsAppAgent extends Employee {
    queues?: string[]; // Array of Queue IDs
}

const UsersTab: React.FC = () => {
    const [agents, setAgents] = useState<WhatsAppAgent[]>([]);
    const [queues, setQueues] = useState<WhatsAppQueue[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAgent, setEditingAgent] = useState<WhatsAppAgent | null>(null);

    // Form State (Mocking for now as we don't have a full User Picker yet)
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [selectedQueues, setSelectedQueues] = useState<string[]>([]);
    // In a real app, we would fetch all employees to select from

    useEffect(() => {
        fetchAgents();
        fetchQueues();
    }, []);

    const fetchAgents = async () => {
        setLoading(true);
        // This is tricky without a dedicated whatsapp_agents table or junction table.
        // For MVP, we might assume all employees with 'viewMessages' permission are agents?
        // Or we use a specific table.
        // Let's assume we fetch generic employees for now and mock the queue assignment storage.
        
        // TODO: Implement actual fetching logic
        const { data: employees } = await supabase.from('employees').select('*').limit(10);
        
        if (employees) {
            setAgents(employees.map(e => ({ ...e, queues: [] })));
        }
        setLoading(false);
    };

    const fetchQueues = async () => {
        const { data } = await supabase.from('whatsapp_queues').select('*');
        if (data) setQueues(data);
    };

    const handleOpenModal = (agent?: WhatsAppAgent) => {
        if (agent) {
            setEditingAgent(agent);
            setSelectedEmployeeId(agent.id);
            setSelectedQueues(agent.queues || []);
        } else {
            setEditingAgent(null);
            setSelectedEmployeeId('');
            setSelectedQueues([]);
        }
        setIsModalOpen(true);
    };

    const toggleQueue = (queueId: string) => {
        if (selectedQueues.includes(queueId)) {
            setSelectedQueues(selectedQueues.filter(id => id !== queueId));
        } else {
            setSelectedQueues([...selectedQueues, queueId]);
        }
    };

    const handleSave = async () => {
        // Saving logic here would involve updating the employee permissions or a new junction table
        alert('Funcionalidade de salvar Usuários e Filas em desenvolvimento (requer tabela de junção).');
        setIsModalOpen(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">Usuários e Permissões</h3>
                    <p className="text-sm text-gray-500">Gerencie quem tem acesso ao WhatsPanda e suas filas.</p>
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
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Filas Assigned</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
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
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {agent.email}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-wrap gap-1">
                                            {agent.queues && agent.queues.length > 0 ? (
                                                agent.queues.map(qId => {
                                                    const q = queues.find(q => q.id === qId);
                                                    return q ? (
                                                        <span key={qId} className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                                                            {q.name}
                                                        </span>
                                                    ) : null;
                                                })
                                            ) : (
                                                <span className="text-gray-400 text-xs text-italic">Nenhuma fila</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => handleOpenModal(agent)} className="text-blue-600 hover:text-blue-900 mr-4">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button className="text-red-600 hover:text-red-900">
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
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900">
                                {editingAgent ? 'Editar Usuário' : 'Adicionar Usuário'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                             {/* User Select (Simplified) */}
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Funcionário</label>
                                <select 
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                    value={selectedEmployeeId}
                                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                    disabled={!!editingAgent}
                                >
                                    <option value="">Selecione um funcionário...</option>
                                    {/* MOCK OPTIONS */}
                                    <option value="1">João Silva</option>
                                    <option value="2">Maria Oliveira</option>
                                </select>
                             </div>

                             {/* Queues Select */}
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Filas de Atendimento</label>
                                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-100 p-2 rounded">
                                    {queues.map(queue => (
                                        <label key={queue.id} className="flex items-center space-x-2 cursor-pointer p-1 hover:bg-gray-50 rounded">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedQueues.includes(queue.id)} 
                                                onChange={() => toggleQueue(queue.id)}
                                                className="rounded text-green-600 focus:ring-green-500"
                                            />
                                            <div className="flex items-center">
                                                <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: queue.color }}></div>
                                                <span className="text-sm text-gray-700">{queue.name}</span>
                                            </div>
                                        </label>
                                    ))}
                                    {queues.length === 0 && <p className="text-gray-400 text-xs">Nenhuma fila criada.</p>}
                                </div>
                             </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
                            >
                                <Check className="w-4 h-4 mr-2" />
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UsersTab;
