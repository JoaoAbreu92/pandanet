import React from 'react';
// FIX: Correcting the import path for types.
import type { Ticket, Employee } from '../types';
import { PaperAirplaneIcon } from './icons';
import StarRating from './StarRating';

interface TicketDetailProps {
    ticket: Ticket;
    onClose: () => void;
    onUpdateTicket: (ticket: Ticket) => void;
    currentUser: Employee;
}

const TicketDetail: React.FC<TicketDetailProps> = ({ ticket, onClose, onUpdateTicket, currentUser }) => {
    const [newComment, setNewComment] = React.useState('');

    const handleCommentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        const comment = {
            id: Date.now(),
            author: currentUser.name,
            authorAvatarUrl: currentUser.avatarUrl,
            text: newComment,
            timestamp: new Date().toLocaleString('pt-BR')
        };

        const updatedTicket = {
            ...ticket,
            comments: [...ticket.comments, comment],
            hasNotification: true // Mark as having update
        };

        onUpdateTicket(updatedTicket);
        setNewComment('');
    };

    const handleRatingSubmit = (rating: number) => {
        onUpdateTicket({ ...ticket, rating });
    };

    const getStatusColor = (status: Ticket['status']) => {
        switch (status) {
            case 'Aberto': return 'bg-green-100 text-green-800';
            case 'Em Andamento': return 'bg-yellow-100 text-yellow-800';
            case 'Resolvido': return 'bg-blue-100 text-blue-800';
            case 'Fechado': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getPriorityColor = (priority: Ticket['priority']) => {
        switch (priority) {
            case 'Baixa': return 'bg-gray-100 text-gray-800';
            case 'Média': return 'bg-yellow-100 text-yellow-800';
            case 'Alta': return 'bg-orange-100 text-orange-800';
            case 'Urgente': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const isRequester = ticket.requester === currentUser.name;

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                    <h3 className="text-xl font-bold text-brand-text pr-8">Chamado #{ticket.id}: {ticket.title}</h3>
                    <button onClick={onClose} className="text-sm font-medium text-brand-primary hover:underline">Voltar</button>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                            <p className="text-gray-500">Status</p>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>{ticket.status}</span>
                        </div>
                        <div>
                            <p className="text-gray-500">Prioridade</p>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
                        </div>
                        <div>
                            <p className="text-gray-500">Criado em</p>
                            <p className="text-brand-text">{ticket.createdAt}</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Solicitante</p>
                            <p className="text-brand-text">{ticket.requester}</p>
                        </div>
                        <div className="md:col-span-2">
                            <p className="text-gray-500">Atribuído a</p>
                            <p className="text-brand-text font-semibold">{ticket.assignedTo || 'Ninguém'}</p>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-semibold text-brand-text mb-2">Descrição</h4>
                        <p className="text-brand-subtle-text whitespace-pre-wrap">{ticket.description}</p>
                    </div>

                    {isRequester && ticket.status === 'Resolvido' && (
                        <div className="p-4 bg-emerald-50 rounded-lg">
                            {ticket.rating ? (
                                <div>
                                    <h4 className="font-semibold text-brand-text mb-2">Obrigado pelo seu feedback!</h4>
                                    <p className="text-brand-subtle-text">Você avaliou este chamado com {ticket.rating} de 5 estrelas.</p>
                                </div>
                            ) : (
                                <div>
                                    <h4 className="font-semibold text-brand-text mb-2">Como foi o suporte recebido?</h4>
                                    <StarRating onSubmit={handleRatingSubmit} />
                                </div>
                            )}
                        </div>
                    )}

                    <div>
                        <h4 className="font-semibold text-brand-text mb-4">Comentários ({ticket.comments.length})</h4>
                        <div className="space-y-4">
                            {ticket.comments.map((comment, index) => (
                                <div key={index} className="flex items-start space-x-3">
                                    <img src={comment.authorAvatarUrl || 'https://via.placeholder.com/40'} alt={comment.author} className="w-8 h-8 rounded-full object-cover" />
                                    <div>
                                        <div className="bg-gray-100 p-3 rounded-lg rounded-tl-none">
                                            <p className="font-semibold text-sm text-brand-text">{comment.author}</p>
                                            <p className="text-sm text-brand-subtle-text">{comment.text}</p>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">{comment.timestamp}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <form onSubmit={handleCommentSubmit} className="mt-6 flex items-center space-x-3">
                            <img src={currentUser.avatarUrl} alt="Sua foto" className="w-8 h-8 rounded-full object-cover" />
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Adicionar um comentário..."
                                    className="w-full pl-4 pr-12 py-2 bg-gray-100 border border-transparent rounded-full focus:outline-none focus:ring-2 focus:ring-brand-primary text-brand-text"
                                />
                                <button type="submit" disabled={!newComment.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-brand-primary text-white rounded-full hover:bg-emerald-600 disabled:opacity-50">
                                    <PaperAirplaneIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TicketDetail;