import React, { useState, useEffect } from 'react';
import { CalendarDaysIcon, MapPinIcon, ClockIcon, UserGroupIcon, PlusIcon, CheckCircleIcon, XCircleIcon, XMarkIcon } from './icons';
import type { Event } from '../types';
import { supabase, getCleanImageUrl } from '../supabaseClient';
import { useLanguage } from './LanguageContext';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';

interface EventsPageProps {
    initialEventId?: string;
}

const EventsPage: React.FC<EventsPageProps> = ({ initialEventId }) => {
    const { currentUser } = useAuth();
    const { t } = useLanguage();
    const { addNotification } = useNotifications();
    const [events, setEvents] = useState<Event[]>([]);
    const [activeTab, setActiveTab] = useState<'ativos' | 'historico'>('ativos');
    const [declineModalOpen, setDeclineModalOpen] = useState<string | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
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
        imageUrl: '',
        meetingUrl: '',
        isSpecificAudience: false,
        selectedUsers: [] as string[],
        selectedDepartments: [] as string[]
    });
    const [companyDepartments, setCompanyDepartments] = useState<any[]>([]);
    const [companyUsers, setCompanyUsers] = useState<any[]>([]);

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
                    time: e.start_time ? new Date(e.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '00:00',
                    endTime: e.end_time || '00:00',
                    location: e.location || '',
                    imageUrl: getCleanImageUrl(e.image_url),
                    category: (e.category as any) || 'Outro',
                    imageType: 'url',
                    meeting_url: e.meeting_url,
                    is_specific_audience: e.is_specific_audience,
                    invited_ids: e.invited_ids || [], // Map to the correct column
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
        const fetchCompanyData = async () => {
            if (!currentUser?.company_id) return;
            try {
                const { data: depts } = await supabase.from('departments').select('*').eq('company_id', currentUser.company_id);
                if (depts) setCompanyDepartments(depts);

                const { data: users } = await supabase.from('profiles').select('id, full_name, department_id').eq('company_id', currentUser.company_id);
                if (users) setCompanyUsers(users);
            } catch (e) {
                console.error("Erro ao buscar dados da empresa", e);
            }
        };

        fetchCompanyData();
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

    // Lógica para abrir evento via notificação (initialEventId)
    useEffect(() => {
        if (initialEventId && events.length > 0) {
            const event = events.find(e => e.id === initialEventId);
            if (event) {
                setSelectedEvent(event);
            }
        }
    }, [initialEventId, events]);

    const handleJoinEvent = async (eventId: string) => {
        if (!currentUser) return;
        const event = events.find(e => e.id === eventId);
        if (!event) return;

        const updatedAttendees = [...(event.attendees || []), currentUser.id];
        const updatedInvited = (event.invited_ids || []).filter(id => id !== currentUser.id);
        const updatedDeclined = (event.declined || []).filter((d: any) => d.userId !== currentUser.id);

        try {
            const { error } = await supabase
                .from('events')
                .update({
                    attendees: updatedAttendees,
                    invited_ids: updatedInvited,
                    declined: updatedDeclined
                })
                .eq('id', eventId);

            if (error) throw error;

            // Notify creator and other attendees
            for (const attId of event.attendees) {
                if (attId !== currentUser.id) {
                    addNotification({
                        user_id: attId,
                        company_id: currentUser.company_id,
                        type: 'event',
                        title: 'Nova Confirmação!',
                        description: `${currentUser.name} confirmou presença em: ${event.title}`,
                        link: '/events'
                    });
                }
            }

            await addNotification({
                user_id: currentUser.id,
                company_id: currentUser.company_id,
                type: 'event',
                title: 'Presença Confirmada',
                description: `Sua presença foi confirmada em: ${event.title}`,
                link: '/events'
            });

            alert("Presença confirmada!");
            fetchEvents();
            setSelectedEvent(null);
        } catch (err: any) {
            console.error("Error joining event:", err);
            alert("Erro ao confirmar presença: " + err.message);
        }
    };

    const onDeclineEvent = async (eventId: string, reason: string) => {
        if (!currentUser) return;
        const event = events.find(e => e.id === eventId);
        if (!event) return;

        const updatedDeclined = [...(event.declined || []), { userId: currentUser.id, reason }];
        const updatedInvited = (event.invited_ids || []).filter(id => id !== currentUser.id);
        const updatedAttendees = (event.attendees || []).filter(id => id !== currentUser.id);

        try {
            const { error } = await supabase
                .from('events')
                .update({
                    attendees: updatedAttendees,
                    invited_ids: updatedInvited,
                    declined: updatedDeclined
                })
                .eq('id', eventId);

            if (error) throw error;

            await addNotification({
                user_id: currentUser.id,
                company_id: currentUser.company_id,
                type: 'event',
                title: 'Evento Recusado',
                description: `Você justificou sua ausência no evento: ${event.title}`,
                link: '/events'
            });

            alert("Convite recusado.");
            fetchEvents();
            setSelectedEvent(null);
            setDeclineReason('');
        } catch (err: any) {
            console.error("Error declining event:", err);
            alert("Erro ao recusar evento: " + err.message);
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
        if (!currentUser?.company_id) {
            alert("Erro: Empresa não identificada.");
            return;
        }

        if (!newEvent.date || !newEvent.start_time) {
            alert("Por favor, preencha a data e o horário.");
            return;
        }

        try {
            // Use local date string to avoid timezone issues when possible, or just build ISO
            const isoStart = new Date(`${newEvent.date}T${newEvent.start_time}:00`).toISOString();

            let finalInvitedIds: string[] = [];

            if (newEvent.isSpecificAudience) {
                const deptUserIds = companyUsers.filter(u => newEvent.selectedDepartments.includes(u.department_id)).map(u => u.id);
                finalInvitedIds = Array.from(new Set([...deptUserIds, ...newEvent.selectedUsers]));
            }

            const { data: createdEvent, error } = await supabase
                .from('events')
                .insert([{
                    title: newEvent.title,
                    description: newEvent.description,
                    date: newEvent.date,
                    start_time: isoStart,
                    end_time: isoStart,
                    location: newEvent.location,
                    category: newEvent.category,
                    type: newEvent.category, // Fallback for 'type' column
                    image_url: newEvent.imageUrl,
                    meeting_url: newEvent.meetingUrl || null,
                    is_specific_audience: newEvent.isSpecificAudience,
                    company_id: currentUser.company_id,
                    attendees: [],
                    invited_ids: finalInvitedIds,
                    declined: []
                }])
                .select()
                .single();

            if (error) throw error;

            console.log('Evento criado com sucesso!');
            setIsCreateModalOpen(false);

            // Notify users
            if (newEvent.isSpecificAudience) {
                // Notificar apenas os convidados
                for (const uid of finalInvitedIds) {
                    if (uid !== currentUser.id) {
                        addNotification({
                            user_id: uid,
                            company_id: currentUser.company_id,
                            type: 'event',
                            title: 'Você foi convidado!',
                            description: `Convite para: ${newEvent.title}`,
                            link: '/events'
                        });
                    }
                }
            } else if (['Social', 'Corporativo', 'Treinamento', 'Evento da Empresa'].includes(newEvent.category)) {
            // Fetch employees to notify all
                const { data: emps } = await supabase.from('profiles').select('id').eq('company_id', currentUser.company_id);
                if (emps) {
                    for (const emp of emps) {
                        if (emp.id !== currentUser.id) {
                            addNotification({
                                user_id: emp.id,
                                company_id: currentUser.company_id,
                                type: 'event',
                                title: 'Novo Evento Agendado!',
                                description: `Participe de: ${newEvent.title}`,
                                link: '/events'
                            });
                        }
                    }
                }
            }

            setNewEvent({
                title: '', description: '', date: '', start_time: '09:00', location: '', category: 'Corporativo', imageUrl: '', meetingUrl: '', isSpecificAudience: false, selectedUsers: [], selectedDepartments: []
            });
            fetchEvents();
        } catch (err: any) {
            console.error("Error creating event:", err);
            alert("Erro ao criar evento: " + (err.message || "Erro desconhecido"));
        }
    };

    const accessibleEvents = [...events].filter(event => {
        if (event.category !== 'Comemorativo') return false;

        const isInvited = (event.invited_ids || []).includes(currentUser?.id || '');
        const isAttending = (event.attendees || []).includes(currentUser?.id || '');
        const isDeclined = (event.declined || []).some((d: any) => d.userId === currentUser?.id);
        const isSuperAdmin = currentUser?.role === 'Super Admin';

        // Se for audiência específica, só mostra se estiver convidado ou já confirmado (ou se for Super Admin)
        if (event.is_specific_audience) {
            return (isInvited || isAttending || isSuperAdmin) && !isDeclined;
        }

        return !isDeclined;
    });

    const localToday = new Date();
    const year = localToday.getFullYear();
    const month = String(localToday.getMonth() + 1).padStart(2, '0');
    const day = String(localToday.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const sortedEvents = accessibleEvents.filter(event => {
        if (activeTab === 'ativos') {
            return event.date >= todayStr;
        } else {
            return event.date < todayStr;
        }
    }).sort((a, b) => {
        if (activeTab === 'ativos') {
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        } else {
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
    });

    if (loading) return <div className="p-8 text-center text-gray-500 dark:text-gray-400">Carregando eventos...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Eventos e Acontecimentos</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Fique por dentro de tudo o que acontece na empresa.</p>
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

            {/* Premium Tabs Menu */}
            <div className="flex space-x-1 p-1 bg-gray-150 dark:bg-slate-800/80 rounded-xl max-w-xs mb-8 border border-gray-200/50 dark:border-slate-700">
                <button
                    onClick={() => setActiveTab('ativos')}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                        activeTab === 'ativos'
                            ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                    }`}
                >
                    Próximos Eventos
                </button>
                <button
                    onClick={() => setActiveTab('historico')}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                        activeTab === 'historico'
                            ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                    }`}
                >
                    Histórico
                </button>
            </div>

            {sortedEvents.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700">
                    <CalendarDaysIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        {activeTab === 'ativos' ? 'Nenhum evento agendado' : 'Nenhum evento no histórico'}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                        {activeTab === 'ativos' ? 'Fique atento para novidades em breve!' : 'Nenhum evento passado registrado.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sortedEvents.map(event => {
                        const isAttending = (event.attendees || []).includes(currentUser?.id || '');
                        return (
                            <div key={event.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow group">
                                <div className="h-48 overflow-hidden relative">
                                    <img
                                        src={event.imageUrl || `https://source.unsplash.com/random/800x600/?event,corporate,${event.id}`}
                                        alt={event.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                    <div className="absolute top-4 right-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-brand-primary shadow-sm">
                                        {event.category}
                                    </div>
                                    <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-lg text-center shadow-sm">
                                        <p className="text-xs text-gray-500 uppercase font-bold">{new Date(event.date).toLocaleDateString('pt-BR', { month: 'short' })}</p>
                                        <p className="text-xl font-bold text-gray-900">{new Date(event.date).getDate()}</p>
                                    </div>
                                </div>
                                <div className="p-5">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 line-clamp-1">{event.title}</h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 line-clamp-2">{event.description}</p>

                                    <div className="space-y-2 mb-6">
                                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                            <ClockIcon className="w-4 h-4 mr-2 text-gray-400 dark:text-gray-500" />
                                            {event.time}
                                        </div>
                                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                            <MapPinIcon className="w-4 h-4 mr-2 text-gray-400 dark:text-gray-500" />
                                            {event.location}
                                        </div>
                                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                            <UserGroupIcon className="w-4 h-4 mr-2 text-gray-400 dark:text-gray-500" />
                                            {(event.attendees || []).length} confirmados
                                        </div>
                                    </div>

                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => setSelectedEvent(event)}
                                            className="flex-1 py-2.5 px-4 rounded-lg font-medium transition-all bg-gray-50 dark:bg-slate-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-600"
                                        >
                                            Ver Detalhes
                                        </button>
                                        {isAttending && (
                                            <div className="flex items-center text-green-600 font-medium text-sm px-2">
                                                Confirmado ✓
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Event Detail Modal */}
            {selectedEvent && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="h-48 relative">
                            <img
                                src={selectedEvent.imageUrl || `https://source.unsplash.com/random/800x600/?event,corporate,${selectedEvent.id}`}
                                alt={selectedEvent.title}
                                className="w-full h-full object-cover"
                            />
                            <button
                                onClick={() => setSelectedEvent(null)}
                                className="absolute top-4 right-4 bg-black/20 hover:bg-black/40 text-white p-1.5 rounded-full backdrop-blur-sm transition-colors"
                            >
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                            <div className="absolute top-4 left-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-brand-primary shadow-sm">
                                {selectedEvent.category}
                            </div>
                        </div>

                        <div className="p-6">
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{selectedEvent.title}</h3>
                            <p className="text-gray-600 dark:text-gray-300 mb-6">{selectedEvent.description}</p>

                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                    <CalendarDaysIcon className="w-5 h-5 mr-3 text-brand-primary" />
                                    {new Date(selectedEvent.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                                </div>
                                <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                    <ClockIcon className="w-5 h-5 mr-3 text-brand-primary" />
                                    {selectedEvent.time}
                                </div>
                                <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                    <MapPinIcon className="w-5 h-5 mr-3 text-brand-primary" />
                                    {selectedEvent.location}
                                </div>
                                <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                    <UserGroupIcon className="w-5 h-5 mr-3 text-brand-primary" />
                                    {(selectedEvent.attendees || []).length} confirmados
                                </div>
                            </div>

                            <div className="flex space-x-3">
                                {!(selectedEvent.attendees || []).includes(currentUser?.id || '') ? (
                                    <>
                                        <button
                                            onClick={() => {
                                                handleJoinEvent(selectedEvent.id);
                                                setSelectedEvent(null);
                                            }}
                                            className="flex-1 bg-brand-primary text-white py-3 rounded-xl font-bold hover:bg-emerald-600 shadow-lg shadow-emerald-200 transition-all active:scale-95"
                                        >
                                            Confirmar Presença
                                        </button>
                                        <button
                                            onClick={() => {
                                                setDeclineModalOpen(selectedEvent.id);
                                                setSelectedEvent(null);
                                            }}
                                            className="px-6 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors"
                                        >
                                            Recusar
                                        </button>
                                    </>
                                ) : (
                                    <div className="w-full bg-green-50 text-green-700 py-3 rounded-xl font-bold text-center border border-green-100 flex items-center justify-center space-x-2">
                                        <CheckCircleIcon className="w-5 h-5" />
                                        <span>Você confirmou presença neste evento</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {
                declineModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Justificar Ausência</h3>
                                <button onClick={() => setDeclineModalOpen(null)}><XMarkIcon className="w-6 h-6 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" /></button>
                            </div>
                            <form onSubmit={handleDeclineSubmit}>
                                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Por favor, explique o motivo da sua ausência neste evento.</p>
                                <textarea
                                    required
                                    rows={4}
                                    className="w-full border dark:border-slate-700 rounded-lg p-3 mb-4 focus:ring-brand-primary focus:border-brand-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                                    placeholder={t('events.placeholder_reason')}
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
                        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Cadastrar Novo Evento</h3>
                                <button onClick={() => setIsCreateModalOpen(false)}><XMarkIcon className="w-6 h-6 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" /></button>
                            </div>
                            <form onSubmit={handleCreateEvent} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Título do Evento</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full border dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                                        value={newEvent.title}
                                        onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                                        placeholder="Ex: Treinamento de Integração"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição</label>
                                    <textarea
                                        required
                                        rows={3}
                                        className="w-full border dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                                        value={newEvent.description}
                                        onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                                        placeholder="Breve descrição do evento..."
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data</label>
                                        <input
                                            required
                                            type="date"
                                            className="w-full border dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                                            value={newEvent.date}
                                            onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Horário</label>
                                        <input
                                            required
                                            type="time"
                                            className="w-full border dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                                            value={newEvent.start_time}
                                            onChange={e => setNewEvent({ ...newEvent, start_time: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">localização</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full border dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                                        value={newEvent.location}
                                        onChange={e => setNewEvent({ ...newEvent, location: e.target.value })}
                                        placeholder="Ex: Sala de Reuniões A ou Zoom"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoria</label>
                                    <select
                                        className="w-full border dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                                        value={newEvent.category}
                                        onChange={e => setNewEvent({ ...newEvent, category: e.target.value })}
                                    >
                                        <option value="Corporativo">Corporativo</option>
                                        <option value="Social">Social</option>
                                        <option value="Comemorativo">Comemorativo</option>
                                        <option value="Treinamento">Treinamento</option>
                                        <option value="Evento da Empresa">Evento da Empresa</option>
                                        <option value="Outro">Outro</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL da Imagem (Opcional)</label>
                                    <input
                                        type="text"
                                        className="w-full border dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                                        value={newEvent.imageUrl}
                                        onChange={e => setNewEvent({ ...newEvent, imageUrl: e.target.value })}
                                        placeholder="https://..."
                                    />
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                                        Tamanho recomendado: <strong>800x400px</strong> (Proporção 2:1). Exemplo: <code>https://images.unsplash.com/photo-1514525253440-b393452e8d26?w=800&h=400&fit=crop</code>
                                    </p>
                                </div>
                                <div className="border-t dark:border-slate-700 pt-4 mt-4">
                                    <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3">Videoconferência & Convidados</h4>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link da Reunião (Meet, Zoom, Teams) - Opcional</label>
                                        <input
                                            type="url"
                                            className="w-full border dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                                            value={newEvent.meetingUrl}
                                            onChange={e => setNewEvent({ ...newEvent, meetingUrl: e.target.value })}
                                            placeholder="https://meet.google.com/..."
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Público Alvo</label>
                                        <div className="flex space-x-4">
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    checked={!newEvent.isSpecificAudience}
                                                    onChange={() => setNewEvent({ ...newEvent, isSpecificAudience: false, selectedDepartments: [], selectedUsers: [] })}
                                                    className="w-4 h-4 text-brand-primary border-gray-300 focus:ring-brand-primary"
                                                />
                                                <span className="text-sm text-gray-700 dark:text-gray-300">Toda a Empresa</span>
                                            </label>
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    checked={newEvent.isSpecificAudience}
                                                    onChange={() => setNewEvent({ ...newEvent, isSpecificAudience: true })}
                                                    className="w-4 h-4 text-brand-primary border-gray-300 focus:ring-brand-primary"
                                                />
                                                <span className="text-sm text-gray-700 dark:text-gray-300">Específico (Departamentos/Pessoas)</span>
                                            </label>
                                        </div>
                                    </div>

                                    {newEvent.isSpecificAudience && (
                                        <div className="space-y-4 bg-gray-50 dark:bg-slate-700/50 p-4 rounded-lg border border-gray-100 dark:border-slate-600">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Convidar Departamentos Inteiros</label>
                                                <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 p-2 grid grid-cols-2 gap-2">
                                                    {companyDepartments.map(dept => (
                                                        <label key={dept.id} className="flex items-center space-x-2 text-sm cursor-pointer p-1 hover:bg-gray-50 dark:hover:bg-slate-600 rounded">
                                                            <input
                                                                type="checkbox"
                                                                checked={newEvent.selectedDepartments.includes(dept.id)}
                                                                onChange={(e) => {
                                                                    const updated = e.target.checked
                                                                        ? [...newEvent.selectedDepartments, dept.id]
                                                                        : newEvent.selectedDepartments.filter(id => id !== dept.id);
                                                                    setNewEvent({ ...newEvent, selectedDepartments: updated });
                                                                }}
                                                                className="rounded text-brand-primary focus:ring-brand-primary h-4 w-4"
                                                            />
                                                            <span className="text-gray-700 dark:text-gray-200 line-clamp-1">{dept.name}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Convidar Pessoas Específicas</label>
                                                <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 p-2 space-y-1">
                                                    {companyUsers.filter(u => !newEvent.selectedDepartments.includes(u.department_id)).map(user => (
                                                        <label key={user.id} className="flex items-center space-x-3 text-sm cursor-pointer p-1.5 hover:bg-gray-50 dark:hover:bg-slate-600 rounded">
                                                            <input
                                                                type="checkbox"
                                                                checked={newEvent.selectedUsers.includes(user.id)}
                                                                onChange={(e) => {
                                                                    const updated = e.target.checked
                                                                        ? [...newEvent.selectedUsers, user.id]
                                                                        : newEvent.selectedUsers.filter(id => id !== user.id);
                                                                    setNewEvent({ ...newEvent, selectedUsers: updated });
                                                                }}
                                                                className="rounded text-brand-primary focus:ring-brand-primary h-4 w-4"
                                                            />
                                                            <span className="text-gray-900 dark:text-gray-100 font-medium">{user.full_name}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">* Pessoas de departamentos já selecionados acima foram ocultadas desta lista para evitar duplicidade.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-end pt-4 mt-2">
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
