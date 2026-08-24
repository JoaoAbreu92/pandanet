import React, { useState } from 'react';
import { CalendarDaysIcon, MapPinIcon, ClockIcon, UserGroupIcon, PlusIcon, CheckCircleIcon, XCircleIcon, XMarkIcon } from './icons';
import type { Event, Employee } from '../types';

interface EventsPageProps {
    events: Event[];
    onJoinEvent: (eventId: number) => void;
    onDeclineEvent: (eventId: number, reason: string) => void;
    currentUser: Employee;
}

const EventsPage: React.FC<EventsPageProps> = ({ events, onJoinEvent, onDeclineEvent, currentUser }) => {
    const [declineModalOpen, setDeclineModalOpen] = useState<number | null>(null);
    const [declineReason, setDeclineReason] = useState('');

    const handleDeclineSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (declineModalOpen) {
            onDeclineEvent(declineModalOpen, declineReason);
            setDeclineModalOpen(null);
            setDeclineReason('');
        }
    };

    const sortedEvents = [...events].filter(event => {
        const isInvited = (event.invitees || []).includes(currentUser.id);
        const isAttending = event.attendees.includes(currentUser.id);
        return event.category === 'Social' || isInvited || isAttending || event.category === 'Corporativo' || event.category === 'Treinamento';
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Eventos e Acontecimentos</h1>
                    <p className="text-gray-500 mt-1">Fique por dentro de tudo o que acontece na empresa.</p>
                </div>
            </div>

            {sortedEvents.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-lg shadow-sm border border-gray-100">
                    <CalendarDaysIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">Nenhum evento agendado</h3>
                    <p className="text-gray-500">Fique atento para novidades em breve!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sortedEvents.map(event => {
                        const isAttending = event.attendees.includes(currentUser.id);
                        return (
                            <div key={event.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group">
                                <div className="h-48 overflow-hidden relative">
                                    <img
                                        src={event.imageUrl || `https://source.unsplash.com/random/800x600/?event,corporate,${event.id}`}
                                        alt={event.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-brand-primary shadow-sm">
                                        {event.category}
                                    </div>
                                    <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-lg text-center shadow-sm">
                                        <p className="text-xs text-gray-500 uppercase font-bold">{new Date(event.date).toLocaleDateString('pt-BR', { month: 'short' })}</p>
                                        <p className="text-xl font-bold text-gray-900">{new Date(event.date).getDate()}</p>
                                    </div>
                                </div>
                                <div className="p-5">
                                    <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-1">{event.title}</h3>
                                    <p className="text-gray-500 text-sm mb-4 line-clamp-2">{event.description}</p>

                                    <div className="space-y-2 mb-6">
                                        <div className="flex items-center text-sm text-gray-600">
                                            <ClockIcon className="w-4 h-4 mr-2 text-gray-400" />
                                            {event.time}
                                        </div>
                                        <div className="flex items-center text-sm text-gray-600">
                                            <MapPinIcon className="w-4 h-4 mr-2 text-gray-400" />
                                            {event.location}
                                        </div>
                                        <div className="flex items-center text-sm text-gray-600">
                                            <UserGroupIcon className="w-4 h-4 mr-2 text-gray-400" />
                                            {event.attendees.length} confirmados
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => onJoinEvent(event.id)}
                                        className={`w-full py-2.5 px-4 rounded-lg font-medium transition-all ${isAttending
                                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                            : 'bg-brand-primary text-white hover:bg-emerald-600 shadow-md hover:shadow-lg'
                                            }`}
                                    >
                                        {isAttending ? 'Confirmado ✓' : 'Confirmar Presença'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {
                declineModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-gray-900">Justificar Ausência</h3>
                                <button onClick={() => setDeclineModalOpen(null)}><XMarkIcon className="w-6 h-6 text-gray-400" /></button>
                            </div>
                            <form onSubmit={handleDeclineSubmit}>
                                <p className="text-sm text-gray-600 mb-4">Por favor, explique o motivo da sua ausência neste evento.</p>
                                <textarea
                                    required
                                    rows={4}
                                    className="w-full border rounded-lg p-3 mb-4 focus:ring-brand-primary focus:border-brand-primary"
                                    placeholder="Motivo..."
                                    value={declineReason}
                                    onChange={e => setDeclineReason(e.target.value)}
                                />
                                <div className="flex justify-end">
                                    <button type="submit" className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-medium">
                                        Enviar Justificativa
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default EventsPage;
