import React, { useState, useEffect } from 'react';
import { CalendarDaysIcon, MapPinIcon, ClockIcon, UserGroupIcon, PlusIcon, CheckCircleIcon, XCircleIcon, XMarkIcon } from './icons';
import type { Event } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

const EventsPage: React.FC = () => {
    const { currentUser } = useAuth();
    const [events, setEvents] = useState<Event[]>([]);
    const [declineModalOpen, setDeclineModalOpen] = useState<string | null>(null);
    const [declineReason, setDeclineReason] = useState('');
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newEvent, setNewEvent] = useState({
        title: '',
        description: '',
        date: '',
        start_time: '09:00',
        location: '',
        category: 'Corporativo',
        imageUrl: ''
    });

    const fetchEvents = async () => {
        if (!currentUser?.company_id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .eq('company_id', currentUser.company_id)
                .order('date', { ascending: true }); // Future events first? ascending works.

            if (error) throw error;

            if (data) {
                const formattedEvents: Event[] = data.map((e: any) => ({
                    id: e.id,
                    title: e.title,
                    description: e.description,
                    date: e.date?.split('T')[0] || e.created_at?.split('T')[0],
                    time: e.start_time || '00:00', // start_time mapped to time
                    location: e.location || '',
                    imageUrl: e.imageUrl, // Assuming imageUrl column exists or mapped from media? Schema said generic. let's assume not.
                    // Schema check result didn't show imageUrl. 
                    // I should probably allow random or generic image if null.
                    category: (e.category as any) || 'Outro',
                    imageType: 'url',
                    invitees: e.invitees || [],
                    attendees: e.attendees || [],
                    declined: e.declined || []
                }));
                setEvents(formattedEvents);
            }
        } catch (err) {
            console.error('Error fetching events:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();

        // Subscription for realtime updates?
        const subscription = supabase
            .channel('public:events')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `company_id=eq.${currentUser?.company_id}` }, () => {
                fetchEvents();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        }
    }, [currentUser?.company_id]);

    const handleJoinEvent = async (eventId: string) => {
        if (!currentUser) return;
        const event = events.find(e => e.id === eventId);
        if (!event) return;

        // Optimistic update
        const updatedAttendees = [...(event.attendees || []), currentUser.id];

        // Remove from declined if present?
        const updatedDeclined = (event.declined || []).filter(d => d.userId !== currentUser.id);

        try {
            // In DB attendees is array of strings (uuid)
            const { error } = await supabase
                .from('events')
                .update({
                    attendees: updatedAttendees,
                    declined: updatedDeclined
                })
                .eq('id', eventId);

            if (error) throw error;
            // State updates via realtime or manual refresh (realtime set above)
        } catch (err) {
            console.error("Error joining event:", err);
            alert("Erro ao confirmar presença.");
        }
    };

    const onDeclineEvent = async (eventId: string, reason: string) => {
        if (!currentUser) return;
        const event = events.find(e => e.id === eventId);
        if (!event) return;

        const updatedDeclined = [...(event.declined || []), { userId: currentUser.id, reason }];
        const updatedAttendees = (event.attendees || []).filter(id => id !== currentUser.id);

        try {
            const { error } = await supabase
                .from('events')
                .update({
                    attendees: updatedAttendees,
                    declined: updatedDeclined
                })
                .eq('id', eventId);

            if (error) throw error;
        } catch (err) {
            console.error("Error declining event:", err);
            alert("Erro ao recusar evento.");
        }
    };

    const handleDeclineSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (declineModalOpen) {
            onDeclineEvent(declineModalOpen, declineReason);
            setDeclineModalOpen(null);
            setDeclineReason('');
        }
    };

    const handleCreateEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser?.company_id) return;

        try {
            const { error } = await supabase
                .from('events')
                .insert([{
                    ...newEvent,
                    company_id: currentUser.company_id,
                    attendees: [],
                    invitees: [],
                    declined: []
                }]);

            if (error) throw error;
            setIsCreateModalOpen(false);
            setNewEvent({
                title: '',
                description: '',
                date: '',
                start_time: '09:00',
                location: '',
                category: 'Corporativo',
                imageUrl: ''
            });
            fetchEvents();
        } catch (err) {
            console.error("Error creating event:", err);
            alert("Erro ao criar evento.");
        }
    };

    const sortedEvents = [...events].filter(event => {
        const isInvited = (event.invitees || []).includes(currentUser?.id || '');
        const isAttending = (event.attendees || []).includes(currentUser?.id || '');
        const isSocialOrPublic = ['Social', 'Corporativo', 'Treinamento', 'Evento da Empresa'].includes(event.category) || !event.invitees || event.invitees.length === 0;

        return isSocialOrPublic || isInvited || isAttending;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando eventos...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Eventos e Acontecimentos</h1>
                    <p className="text-gray-500 mt-1">Fique por dentro de tudo o que acontece na empresa.</p>
                </div>
                {currentUser?.permissions?.createEvents && (
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center space-x-2 bg-brand-primary text-white px-4 py-2 rounded-lg hover:bg-emerald-600 transition-colors shadow-md"
                    >
                        <PlusIcon className="w-5 h-5" />
                        <span>Novo Evento</span>
                    </button>
                )}
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
                        const isAttending = (event.attendees || []).includes(currentUser?.id || '');
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
                                            {(event.attendees || []).length} confirmados
                                        </div>
                                    </div>

                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => handleJoinEvent(event.id)}
                                            disabled={isAttending}
                                            className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all ${isAttending
                                                ? 'bg-green-100 text-green-700 cursor-default'
                                                : 'bg-brand-primary text-white hover:bg-emerald-600 shadow-md hover:shadow-lg'
                                                }`}
                                        >
                                            {isAttending ? 'Confirmado ✓' : 'Confirmar'}
                                        </button>
                                        {!isAttending && (
                                            <button
                                                onClick={() => setDeclineModalOpen(event.id)}
                                                className="px-4 py-2.5 rounded-lg font-medium bg-red-50 text-red-600 hover:bg-red-100"
                                            >
                                                Recusar
                                            </button>
                                        )}
                                    </div>
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
            {
                isCreateModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-gray-900">Cadastrar Novo Evento</h3>
                                <button onClick={() => setIsCreateModalOpen(false)}><XMarkIcon className="w-6 h-6 text-gray-400" /></button>
                            </div>
                            <form onSubmit={handleCreateEvent} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Título do Evento</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full border rounded-lg p-2.5"
                                        value={newEvent.title}
                                        onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                                        placeholder="Ex: Treinamento de Integração"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                                    <textarea
                                        required
                                        rows={3}
                                        className="w-full border rounded-lg p-2.5"
                                        value={newEvent.description}
                                        onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                                        placeholder="Breve descrição do evento..."
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                                        <input
                                            required
                                            type="date"
                                            className="w-full border rounded-lg p-2.5"
                                            value={newEvent.date}
                                            onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Horário</label>
                                        <input
                                            required
                                            type="time"
                                            className="w-full border rounded-lg p-2.5"
                                            value={newEvent.start_time}
                                            onChange={e => setNewEvent({ ...newEvent, start_time: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">localização</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full border rounded-lg p-2.5"
                                        value={newEvent.location}
                                        onChange={e => setNewEvent({ ...newEvent, location: e.target.value })}
                                        placeholder="Ex: Sala de Reuniões A ou Zoom"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                                    <select
                                        className="w-full border rounded-lg p-2.5"
                                        value={newEvent.category}
                                        onChange={e => setNewEvent({ ...newEvent, category: e.target.value })}
                                    >
                                        <option value="Corporativo">Corporativo</option>
                                        <option value="Social">Social</option>
                                        <option value="Treinamento">Treinamento</option>
                                        <option value="Evento da Empresa">Evento da Empresa</option>
                                        <option value="Outro">Outro</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">URL da Imagem (Opcional)</label>
                                    <input
                                        type="text"
                                        className="w-full border rounded-lg p-2.5"
                                        value={newEvent.imageUrl}
                                        onChange={e => setNewEvent({ ...newEvent, imageUrl: e.target.value })}
                                        placeholder="https://..."
                                    />
                                </div>
                                <div className="flex justify-end pt-4">
                                    <button type="submit" className="bg-brand-primary text-white px-6 py-2.5 rounded-lg hover:bg-emerald-600 font-bold shadow-lg transition-all">
                                        Criar Evento
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
