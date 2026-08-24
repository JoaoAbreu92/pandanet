import React, { useState } from 'react';
// FIX: Correcting the import path for types.
import type { Ticket, TicketPriority, Employee } from '../types';

interface TicketFormProps {
    onSubmit: (ticket: Omit<Ticket, 'id' | 'requester' | 'status' | 'createdAt' | 'lastUpdate' | 'comments'>) => void;
    onCancel: () => void;
    allEmployees: Employee[];
    currentUser: Employee;
}

const TicketForm: React.FC<TicketFormProps> = ({ onSubmit, onCancel, allEmployees, currentUser }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<TicketPriority>('Média');
    const [assignedTo, setAssignedTo] = useState<string>('');

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
            assignedTo: assignedTo || undefined,
        });
    };

    const assignableUsers = allEmployees.filter(e => e.id !== currentUser.id);

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
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
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm bg-white text-brand-text"
                    required
                ></textarea>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="priority" className="block text-sm font-medium text-brand-text">Prioridade</label>
                    <select
                        id="priority"
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
                 <div>
                    <label htmlFor="assignedTo" className="block text-sm font-medium text-brand-text">Atribuir a (Opcional)</label>
                    <select
                        id="assignedTo"
                        value={assignedTo}
                        onChange={(e) => setAssignedTo(e.target.value)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm rounded-md bg-white text-brand-text"
                    >
                        <option value="">Ninguém</option>
                        {assignableUsers.map(user => (
                            <option key={user.id} value={user.name}>{user.name} - ({user.team})</option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">
                    Cancelar
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-primary border border-transparent rounded-md shadow-sm hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary">
                    Enviar Chamado
                </button>
            </div>
        </form>
    );
};

export default TicketForm;