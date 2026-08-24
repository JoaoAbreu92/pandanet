import React, { useState } from 'react';
import Card from './Card';
import TicketForm from './TicketForm';
import TicketDetail from './TicketDetail';
// FIX: Correcting the import path for types.
import type { Ticket, TicketStatus, Employee } from '../types';
import { XCircleIcon } from './icons';

interface TicketPageProps {
    tickets: Ticket[];
    setTickets: (tickets: Ticket[]) => void;
    currentUser: Employee;
    allEmployees: Employee[];
}

const TicketPage: React.FC<TicketPageProps> = ({ tickets, setTickets, currentUser, allEmployees }) => {
    const [isFormOpen, setFormOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

    const handleCreateTicket = (ticketData: Omit<Ticket, 'id' | 'requester' | 'status' | 'createdAt' | 'lastUpdate' | 'comments'>) => {
        const newTicket: Ticket = {
            id: Math.floor(Math.random() * 1000) + 1,
            ...ticketData,
            requester: currentUser.name,
            status: 'Aberto',
            createdAt: new Date().toLocaleString('pt-BR'),
            lastUpdate: new Date().toLocaleString('pt-BR'),
            comments: [],
        };
        setTickets([newTicket, ...tickets]);
        setFormOpen(false);
    };
    
    const handleViewDetail = (ticket: Ticket) => {
        setSelectedTicket(ticket);
        if (ticket.hasNotification) {
            const updatedTickets = tickets.map(t => 
                t.id === ticket.id ? { ...t, hasNotification: false } : t
            );
            setTickets(updatedTickets);
        }
    };

    const handleCloseDetail = () => {
        setSelectedTicket(null);
    };

    const handleUpdateTicket = (updatedTicket: Ticket) => {
        setTickets(tickets.map(t => t.id === updatedTicket.id ? updatedTicket : t));
        setSelectedTicket(updatedTicket); // Keep detail view updated
    };

    const getStatusColor = (status: TicketStatus) => {
        switch (status) {
            case 'Aberto': return 'bg-green-100 text-green-800';
            case 'Em Andamento': return 'bg-yellow-100 text-yellow-800';
            case 'Resolvido': return 'bg-blue-100 text-blue-800';
            case 'Fechado': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const userTickets = tickets.filter(t => t.requester === currentUser.name || t.assignedTo === currentUser.name);

    return (
        <>
            <Card title="Meus Chamados de Suporte" headerAction={
                <button onClick={() => setFormOpen(true)} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600">
                    Abrir Novo Chamado
                </button>
            }>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">ID</th>
                                <th scope="col" className="px-6 py-3">Título</th>
                                <th scope="col" className="px-6 py-3">Atribuído a</th>
                                <th scope="col" className="px-6 py-3">Status</th>
                                <th scope="col" className="px-6 py-3">Prioridade</th>
                                <th scope="col" className="px-6 py-3">Última Atualização</th>
                            </tr>
                        </thead>
                        <tbody>
                            {userTickets.map(ticket => (
                                <tr key={ticket.id} onClick={() => handleViewDetail(ticket)} className="bg-white border-b hover:bg-gray-50 cursor-pointer">
                                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                        <div className="flex items-center space-x-2">
                                            {ticket.hasNotification && (
                                                <span 
                                                    className={`w-2.5 h-2.5 rounded-full ${ticket.status === 'Resolvido' ? 'bg-green-500' : 'bg-yellow-400'}`}
                                                    title={ticket.status === 'Resolvido' ? 'Resolvido' : 'Nova resposta'}
                                                ></span>
                                            )}
                                            <span>#{ticket.id}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">{ticket.title}</td>
                                    <td className="px-6 py-4">{ticket.assignedTo || '---'}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>{ticket.status}</span>
                                    </td>
                                    <td className="px-6 py-4">{ticket.priority}</td>
                                    <td className="px-6 py-4">{ticket.lastUpdate}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {isFormOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 relative animate-fade-in-up">
                        <button onClick={() => setFormOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                            <XCircleIcon className="w-6 h-6" />
                        </button>
                        <h3 className="text-xl font-bold text-brand-text mb-4">Abrir Novo Chamado</h3>
                        <TicketForm 
                            onSubmit={handleCreateTicket} 
                            onCancel={() => setFormOpen(false)}
                            allEmployees={allEmployees}
                            currentUser={currentUser}
                        />
                    </div>
                </div>
            )}

            {selectedTicket && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl relative animate-fade-in-up max-h-[90vh] flex flex-col">
                        <TicketDetail 
                            ticket={selectedTicket} 
                            onClose={handleCloseDetail} 
                            onUpdateTicket={handleUpdateTicket}
                            currentUser={currentUser}
                        />
                    </div>
                </div>
            )}
        </>
    );
};

export default TicketPage;