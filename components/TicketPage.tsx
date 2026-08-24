import React, { useState, useEffect } from 'react';
import Card from './Card';
import TicketForm from './TicketForm';
import TicketDetail from './TicketDetail';
import type { Ticket, TicketStatus, Employee } from '../types';
import { XCircleIcon } from './icons';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';

const TicketPage: React.FC = () => {
    const { profile: currentUser } = useAuth();
    const { addNotification } = useNotifications();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [isFormOpen, setFormOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchTickets = async () => {
        if (!currentUser?.company_id) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            // Fetch Tickets
            const { data: ticketsData, error: ticketsError } = await supabase
                .from('tickets')
                .select(`
                    *,
                    requester:requester_id(full_name, avatar_url),
                    assignee:assigned_to_id(full_name, avatar_url)
                `)
                .eq('company_id', currentUser.company_id)
                .order('created_at', { ascending: false });

            if (ticketsError) throw ticketsError;

            // Fetch Employees for assignment dropdown
            const { data: employeesData } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, role, team, department_id')
                .eq('company_id', currentUser.company_id);

            if (employeesData) {
                setAllEmployees(employeesData.map((e: any) => ({
                    id: e.id,
                    name: e.full_name,
                    role: e.role,
                    team: e.team,
                    avatarUrl: e.avatar_url,
                    email: '',
                    joinDate: '',
                    birthDate: '',
                    isAdmin: false,
                    permissions: {} as any,
                    following: [],
                    department_id: e.department_id
                })));
            }

            if (ticketsData) {
                const formattedTickets: Ticket[] = ticketsData.map((t: any) => ({
                    id: t.id,
                    title: t.title,
                    description: t.description,
                    status: t.status as TicketStatus,
                    priority: t.priority,
                    requester: t.requester?.full_name || 'Desconhecido',
                    assignedTo: t.assignee?.full_name, // Can be null
                    assignedToId: t.assigned_to_id, // Helper for updates
                    createdAt: new Date(t.created_at).toLocaleDateString('pt-BR'),
                    lastUpdate: new Date(t.updated_at || t.created_at).toLocaleDateString('pt-BR'),
                    comments: t.comments || [],
                    hasNotification: false // Simple logic for now
                }));
                setTickets(formattedTickets);
            }
            // Fetch Departments
            const { data: deptsData, error: deptsErr } = await supabase
                .from('departments')
                .select('*')
                .eq('company_id', currentUser.company_id);

            if (deptsErr) {
                console.error('Error fetching departments:', deptsErr);
            } else if (deptsData) {
                console.log('Departments fetched:', deptsData.length);
                setDepartments(deptsData);

                // If no departments exist and it's an admin, we might want to suggest creating one, 
                // but for now let's just log it.
                if (deptsData.length === 0) {
                    console.log('No departments found for this company.');
                }
            }

        } catch (error) {
            console.error('Error fetching tickets:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();

        const subscription = supabase
            .channel('public:tickets')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: `company_id=eq.${currentUser?.company_id}` }, () => {
                fetchTickets();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [currentUser?.company_id]);

    const handleCreateTicket = async (ticketData: any) => {
        if (!currentUser) return;
        try {
            const { error } = await supabase
                .from('tickets')
                .insert([{
                    company_id: currentUser.company_id,
                    requester_id: currentUser.id,
                    title: ticketData.title,
                    description: ticketData.description,
                    priority: ticketData.priority,
                    department_id: ticketData.department_id || null,
                    assigned_to_id: ticketData.assigned_to_id || null,
                    status: 'Aberto',
                    comments: []
                }]);

            if (error) throw error;
            console.log('Ticket criado com sucesso!');
            setFormOpen(false);
            fetchTickets();
        } catch (error: any) {
            console.error('Error creating ticket:', error);
            alert(`Erro ao criar chamado: ${error.message || 'Erro desconhecido'}. Verifique os campos.`);
        }
    };

    const handleViewDetail = (ticket: Ticket) => {
        setSelectedTicket(ticket);
    };

    const handleCloseDetail = () => {
        setSelectedTicket(null);
    };

    const handleRepairForm = () => {
        console.log('Opening ticket form. Current state:', isFormOpen);
        setFormOpen(true);
    };

    const handleUpdateTicket = async (updatedTicket: Ticket) => {
        // Optimistic update for UI
        setTickets(tickets.map(t => t.id === updatedTicket.id ? updatedTicket : t));
        setSelectedTicket(updatedTicket);

        // In real app, TicketDetail would handle the DB update directly or trigger a refetch
        // We'll leave the DB update logic to TicketDetail refactor or implement here if needed.
        // For now, let's assume TicketDetail will handle the specific updates (status, comments) internally 
        // but it currently calls this prop.
        // Let's implement the DB update here to be safe since TicketDetail calls this.
        try {
            const { error } = await supabase
                .from('tickets')
                .update({
                    status: updatedTicket.status,
                    priority: updatedTicket.priority,
                    // comments are special, usually appended. 
                    // If we are strictly updating the object, we can save the whole JSONB.
                    comments: updatedTicket.comments
                })
                .eq('id', updatedTicket.id);

            if (error) throw error;

            // Notify assigned user or requester
            addNotification({
                user_id: updatedTicket.assignedToId || (updatedTicket as any).requester_id,
                type: 'ticket',
                title: 'Chamado Atualizado',
                description: `O chamado #${updatedTicket.id.slice(0, 8)} teve uma atualização.`,
                link: '/tickets'
            } as any);

        } catch (err) {
            console.error("Error updating ticket", err);
        }
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

    const userTickets = tickets; // Show all for now. Filter if needed: tickets.filter(t => t.requester === currentUser.name || t.assignedTo === currentUser.name);

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando chamados...</div>;

    return (
        <>
            <Card title="Central de Suporte (Chamados)" headerAction={
                <button
                    onClick={() => { console.log('Button CLICKED'); handleRepairForm(); }}
                    className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 relative z-50 cursor-pointer"
                >
                    Abrir Novo Chamado
                </button>
            }>
                <div className="overflow-x-auto">
                    {tickets.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">Nenhum chamado encontrado.</p>
                    ) : (
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3">ID</th>
                                    <th scope="col" className="px-6 py-3">Título</th>
                                    <th scope="col" className="px-6 py-3">Solicitante</th>
                                    <th scope="col" className="px-6 py-3">Atribuído a</th>
                                    <th scope="col" className="px-6 py-3">Status</th>
                                    <th scope="col" className="px-6 py-3">Prioridade</th>
                                    <th scope="col" className="px-6 py-3">Data</th>
                                </tr>
                            </thead>
                            <tbody>
                                {userTickets.map(ticket => (
                                    <tr key={ticket.id} onClick={() => handleViewDetail(ticket)} className="bg-white border-b hover:bg-gray-50 cursor-pointer">
                                        <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                            <div className="flex items-center space-x-2">
                                                {ticket.hasNotification && (
                                                    <span
                                                        className={`w-2.5 h-2.5 rounded-full ${ticket.status === 'Resolvido' ? 'bg-green-50' : 'bg-yellow-400'}`}
                                                        title={ticket.status === 'Resolvido' ? 'Resolvido' : 'Nova resposta'}
                                                    ></span>
                                                )}
                                                <span title={ticket.id}>#{ticket.id.slice(0, 8)}...</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">{ticket.title}</td>
                                        <td className="px-6 py-4">{ticket.requester}</td>
                                        <td className="px-6 py-4">{ticket.assignedTo || '---'}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>{ticket.status}</span>
                                        </td>
                                        <td className="px-6 py-4">{ticket.priority}</td>
                                        <td className="px-6 py-4">{ticket.createdAt}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </Card>

            {isFormOpen && currentUser && (
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
                            departments={departments}
                        />
                    </div>
                </div>
            )}

            {selectedTicket && currentUser && (
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