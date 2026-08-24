import React, { useState } from 'react';
import type { Ticket, TicketPriority, Employee } from '../types';

interface TicketFormProps {
    onSubmit: (ticket: any) => void;
    onCancel: () => void;
    allEmployees: Employee[];
    currentUser: Employee;
    departments: any[];
}

const TicketForm: React.FC<TicketFormProps> = ({ onSubmit, onCancel, allEmployees, currentUser, departments }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<TicketPriority>('Média');
    const [departmentId, setDepartmentId] = useState<string>('');
    const [assignedTo, setAssignedTo] = useState<string>('');

    // Pre-select TI department if exists
    React.useEffect(() => {
        const tiDept = departments.find(d => d.name.toUpperCase() === 'TI');
        if (tiDept) setDepartmentId(tiDept.id);
    }, [departments]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !description.trim()) {
            alert('Por favor, preencha o título e a descrição.');
            return;
        }
        onSubmit({
            title,
            description,
            priority,
            department_id: departmentId || undefined,
            assigned_to_id: assignedTo || undefined,
        });
    };

    const technicians = allEmployees.filter(e => {
        if (!departmentId) return true;
        // Check department_id or team as fallback
        return (e as any).department_id === departmentId || e.team === 'TI' || e.role.includes('Técnico');
    });

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-brand-text">Departamento Destino</label>
                    <select
                        value={departmentId}
                        onChange={(e) => {
                            setDepartmentId(e.target.value);
                            setAssignedTo('');
                        }}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm rounded-md bg-white text-brand-text"
                    >
                        <option value="">Selecione um Departamento</option>
                        {departments.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-brand-text">Prioridade</label>
                    <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as TicketPriority)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm rounded-md bg-white text-brand-text"
                    >
                        <option>Baixa</option>
                        <option>Média</option>
                        <option>Alta</option>
                        <option>Urgente</option>
                    </select>
                </div>
            </div>

            <div>
                <label htmlFor="title" className="block text-sm font-medium text-brand-text">Título</label>
                <input
                    type="text"
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm bg-white text-brand-text"
                    required
                />
            </div>
            <div>
                <label htmlFor="description" className="block text-sm font-medium text-brand-text">Descrição</label>
                <textarea
                    id="description"
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm bg-white text-brand-text"
                    required
                ></textarea>
            </div>

            {departmentId && (
                <div>
                    <label htmlFor="assignedTo" className="block text-sm font-medium text-brand-text">Mencionar Pessoa Específica (Opcional)</label>
                    <select
                        id="assignedTo"
                        value={assignedTo}
                        onChange={(e) => setAssignedTo(e.target.value)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm rounded-md bg-white text-brand-text"
                    >
                        <option value="">Qualquer Pessoa do Setor</option>
                        {technicians.map(user => (
                            <option key={user.id} value={user.id}>{user.name} {user.team ? `(${user.team})` : ''}</option>
                        ))}
                    </select>
                </div>
            )}

            <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">
                    Cancelar
                </button>
                <button type="submit" className="px-6 py-2 bg-brand-primary text-white font-semibold rounded-lg hover:bg-emerald-600 transition-all shadow-md">
                    Enviar Chamado
                </button>
            </div>
        </form>
    );
};

export default TicketForm;