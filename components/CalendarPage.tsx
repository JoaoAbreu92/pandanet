import React, { useState, useMemo, useEffect } from 'react';
import Card from './Card';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, XCircleIcon, UsersIcon, CalendarIcon, GiftIcon } from './icons';
import type { CalendarEvent, Employee, CalendarEventCategory } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';

const mockHolidays = [
    { title: 'Dia do Trabalho', date: '2024-05-01' },
    { title: 'Independência do Brasil', date: '2024-09-07' },
    { title: 'Nossa Senhora Aparecida', date: '2024-10-12' },
    { title: 'Finados', date: '2024-11-02' },
    { title: 'Proclamação da República', date: '2024-11-15' },
    { title: 'Natal', date: '2024-12-25' },
];

interface CalendarPageProps {
    events?: CalendarEvent[];
    currentUser?: Employee | null;
}

const CalendarPage: React.FC<CalendarPageProps> = ({ events: initialEvents, currentUser: propUser }) => {
    const { profile: contextUser } = useAuth();
    const currentUser = propUser || contextUser;
    const { addNotification } = useNotifications();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<'month' | 'week'>('month');
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [newEventData, setNewEventData] = useState({
        title: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '10:00',
        category: 'Reunião' as CalendarEventCategory,
        location: '',
        attendees: [] as string[], // IDs
        departmentId: '', // To invite entire dept
        notes: ''
    });

    useEffect(() => {
        // Ensure currentUser is fully loaded with company_id
        if (!currentUser || !currentUser.company_id) {
            console.warn('[CalendarPage] Waiting for currentUser with company_id...', {
                hasUser: !!currentUser,
                userId: currentUser?.id,
                companyId: currentUser?.company_id
            });
            return;
        }

        const fetchData = async () => {
            console.log('Fetching calendar data for user:', currentUser.id, 'company:', currentUser.company_id);

            // Fetch Employees - Filter by company_id
            const { data: emps, error: empError } = await supabase
                .from('profiles')
                .select('*')
                .eq('company_id', currentUser.company_id);
            if (empError) {
                console.error('Error fetching employees:', empError);
            }

            if (emps) {
                setEmployees(emps.map((e: any) => ({
                    id: e.id,
                    name: e.full_name,
                    email: e.email,
                    role: e.role,
                    team: e.team,
                    department_id: e.department_id,
                    avatarUrl: e.avatar_url,
                    permissions: {} as any,
                    joinDate: e.created_at,
                    birthDate: e.birth_date,
                    following: []
                })));
            }

            // Fetch Departments - Filter by company_id
            const { data: depts, error: deptError } = await supabase
                .from('departments')
                .select('*')
                .eq('company_id', currentUser.company_id);
            if (deptError) {
                console.error('Error fetching departments:', deptError);
            }
            if (depts) {
                setDepartments(depts);
            }

            // Fetch Events - Filter by company_id
            const { data: evts, error: evtError } = await supabase
                .from('events')
                .select('*')
                .eq('company_id', currentUser.company_id);

            if (evtError) {
                console.error('Error fetching events:', evtError);
                // alert('Erro ao buscar eventos: ' + evtError.message);
            }

            if (evts) {
                const formattedEvents: CalendarEvent[] = evts.map((e: any) => ({
                    id: e.id,
                    title: e.title,
                    date: e.date ? e.date.split('T')[0] : (e.created_at ? e.created_at.split('T')[0] : ''),
                    startTime: e.start_time ? new Date(e.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '00:00',
                    endTime: e.end_time ? new Date(e.end_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '00:00',
                    category: (e.category as CalendarEventCategory) || 'Reunião',
                    location: e.location || '',
                    attendees: [], // Mapped below
                    notes: e.description || ''
                }));

                const eventsWithAttendees = formattedEvents.map((fe, index) => {
                    const raw = evts[index];
                    const attendeeIds = raw.attendees || [];
                    return {
                        ...fe,
                        attendees: (emps || []).filter((emp: any) => attendeeIds.includes(emp.id)).map((emp: any) => ({
                            id: emp.id,
                            name: emp.full_name,
                            avatarUrl: emp.avatar_url
                        } as Employee)),
                        invitedIds: raw.invited_ids || [],
                        declined: raw.declined || []
                    };
                });
                setEvents(eventsWithAttendees);
            }
        };

        fetchData();
    }, [currentUser]);

    const handleCreateEvent = async (e: React.FormEvent) => {
        e.preventDefault();

        let targetCompanyId = currentUser?.company_id;

        if (!targetCompanyId) {
            alert("Erro: Não foi possível identificar sua empresa. Por favor, recarregue a página ou entre em contato com o suporte.");
            return;
        }

        let finalAttendees = [...newEventData.attendees];
        if ((newEventData as any).departmentId) {
            const deptUsers = employees.filter(emp => (emp as any).department_id === (newEventData as any).departmentId).map(emp => emp.id);
            finalAttendees = Array.from(new Set([...finalAttendees, ...deptUsers]));
        }

        try {
            // Garantir formato ISO 8601 completo para timestamptz
            const combinedStartTime = new Date(`${newEventData.date}T${newEventData.startTime}:00`).toISOString();
            const combinedEndTime = new Date(`${newEventData.date}T${newEventData.endTime}:00`).toISOString();

            console.log('Enviando evento:', { combinedStartTime, combinedEndTime, date: newEventData.date });

            const { data, error } = await supabase.from('events').insert({
                company_id: targetCompanyId,
                title: newEventData.title,
                description: newEventData.notes,
                date: newEventData.date,
                start_time: combinedStartTime,
                end_time: combinedEndTime,
                category: newEventData.category,
                location: newEventData.location,
                attendees: [currentUser.id], // Apenas o criador começa confirmado
                invited_ids: finalAttendees.filter(id => id !== currentUser.id), // Os outros são convidados
                creator_id: currentUser.id
            }).select();

            if (error) {
                console.error('Supabase error creating event:', error);
                throw error;
            }

            if (data) {
                // Refresh or append
                // Simple refresh for now
                // Or manual append
                const newEvt: CalendarEvent = {
                    id: data[0].id,
                    title: data[0].title,
                    date: data[0].date?.split('T')[0],
                    startTime: data[0].start_time,
                    endTime: data[0].end_time,
                    category: data[0].category as any,
                    location: data[0].location,
                    attendees: employees.filter(emp => [currentUser.id].includes(emp.id)),
                    invitedIds: data[0].invited_ids || [],
                    notes: data[0].description
                };
                setEvents([...events, newEvt]);
                setCreateModalOpen(false);
                setNewEventData({
                    title: '',
                    date: new Date().toISOString().split('T')[0],
                    startTime: '09:00',
                    endTime: '10:00',
                    category: 'Reunião',
                    location: '',
                    attendees: [],
                    departmentId: '',
                    notes: ''
                });

                // Notificar os convidados
                for (const invitedId of data[0].invited_ids || []) {
                    addNotification({
                        user_id: invitedId,
                        company_id: currentUser.company_id,
                        type: 'event',
                        title: 'Novo Convite de Evento!',
                        description: `${currentUser.full_name} convidou você para: ${newEventData.title}`,
                        link: '/calendar'
                    });
                }

                alert('Evento criado com sucesso e convites enviados!');
                window.location.reload();
            }
        } catch (error: any) {
            console.error('Error creating event:', error);
            const detail = error.details || error.message || 'Erro de conexão ou política de segurança';
            alert(`Erro ao criar evento: ${detail}`);
        }
    };


    const allCalendarEvents = useMemo(() => {
        // ... (birthday and holiday logic same as before)
        const birthdayEvents: CalendarEvent[] = employees.map((emp: any) => ({
            id: `bday-${emp.id}`,
            title: `Aniversário de ${emp.name?.split(' ')[0] || 'Colega'}`,
            date: emp.birthDate ? `${currentDate.getFullYear()}-${emp.birthDate.substring(5, 10)}` : '',
            startTime: '00:00',
            endTime: '23:59',
            category: 'Aniversário',
            location: '',
            attendees: [],
            notes: `Deseje um feliz aniversário para ${emp.name}!`
        })).filter(e => e.date);

        const holidayEvents: CalendarEvent[] = mockHolidays.map((h, i) => ({
            id: `holiday-${i}`,
            title: h.title,
            date: h.date.replace('2024', currentDate.getFullYear().toString()),
            startTime: '00:00',
            endTime: '23:59',
            category: 'Feriado',
            location: '',
            attendees: [],
            notes: 'Feriado Nacional'
        }));

        return [...events, ...birthdayEvents, ...holidayEvents];
    }, [events, employees, currentDate]);


    const { grid: calendarGrid, title: calendarTitle } = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        if (view === 'month') {
            const firstDayOfMonth = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            const days = [];
            for (let i = 0; i < firstDayOfMonth; i++) {
                days.push(null);
            }
            for (let i = 1; i <= daysInMonth; i++) {
                days.push(new Date(year, month, i));
            }
            return {
                grid: days,
                title: currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
            };
        } else { // week view
            const currentDay = currentDate.getDay();
            const weekStart = new Date(currentDate);
            weekStart.setDate(currentDate.getDate() - currentDay);
            const weekDays = Array.from({ length: 7 }, (_, i) => {
                const day = new Date(weekStart);
                day.setDate(weekStart.getDate() + i);
                return day;
            });
            const weekEnd = weekDays[6];
            return {
                grid: weekDays,
                title: `${weekStart.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} - ${weekEnd.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`
            }
        }
    }, [currentDate, view]);

    const handlePrev = () => view === 'month' ? setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)) : setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)));
    const handleNext = () => view === 'month' ? setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)) : setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)));
    const handleToday = () => setCurrentDate(new Date());

    const handleViewEvent = (event: CalendarEvent) => { setSelectedEvent(event); setDetailModalOpen(true); };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setNewEventData(prev => ({ ...prev, [name]: value }));
    }

    const toggleAttendee = (id: string) => {
        setNewEventData(prev => {
            const current = prev.attendees;
            if (current.includes(id)) {
                return { ...prev, attendees: current.filter(cid => cid !== id) };
            } else {
                return { ...prev, attendees: [...current, id] };
            }
        });
    };

    const [attendeeSearch, setAttendeeSearch] = useState('');

    const getCategoryColor = (category: CalendarEventCategory) => {
        switch (category) {
            case 'Reunião': return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'Evento da Empresa': return 'bg-purple-100 text-purple-800 border-purple-300';
            case 'Feriado': return 'bg-red-100 text-red-800 border-red-300';
            case 'Aniversário': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            default: return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    };

    const EventModal: React.FC<{ event: CalendarEvent, onClose: () => void }> = ({ event, onClose }) => {
        const isInvited = event.invitedIds?.includes(currentUser?.id || '');
        const isConfirmed = event.attendees.some(a => a.id === currentUser?.id);
        const [showReasonInput, setShowReasonInput] = useState(false);
        const [reason, setReason] = useState('');

        const handleStatusUpdate = async (status: 'confirm' | 'decline') => {
            if (!currentUser) return;

            try {
                // Obter a lista mais atual de recusados para garantir sincronia
                const { data: currentEvt } = await supabase.from('events').select('declined, invited_ids, attendees').eq('id', event.id).single();

                if (status === 'confirm') {
                    const updatedAttendees = Array.from(new Set([...(currentEvt?.attendees || []), currentUser.id]));
                    const updatedInvited = (currentEvt?.invited_ids || []).filter((id: string) => id !== currentUser.id);
                    const updatedDeclined = (currentEvt?.declined || []).filter((d: any) => d.userId !== currentUser.id);

                    const { error } = await supabase
                        .from('events')
                        .update({
                            attendees: updatedAttendees,
                            invited_ids: updatedInvited,
                            declined: updatedDeclined
                        })
                        .eq('id', event.id);

                    if (error) throw error;

                    // Notificar todos os que já confirmaram (incluindo o criador)
                    for (const attId of (currentEvt?.attendees || [])) {
                        if (attId !== currentUser.id) {
                            addNotification({
                                user_id: attId,
                                company_id: currentUser.company_id,
                                type: 'event',
                                title: 'Nova Confirmação!',
                                description: `${currentUser.full_name} confirmou presença em: ${event.title}`,
                                link: '/calendar'
                            });
                        }
                    }
                } else {
                    if (!reason.trim()) {
                        setShowReasonInput(true);
                        return;
                    }

                    const declinedList = currentEvt?.declined || [];
                    const updatedDeclined = [...declinedList.filter((d: any) => d.userId !== currentUser.id), { userId: currentUser.id, reason }];
                    const updatedInvited = (currentEvt?.invited_ids || []).filter((id: string) => id !== currentUser.id);
                    const updatedAttendees = (currentEvt?.attendees || []).filter((id: string) => id !== currentUser.id);

                    const { error } = await supabase
                        .from('events')
                        .update({
                            declined: updatedDeclined,
                            invited_ids: updatedInvited,
                            attendees: updatedAttendees
                        })
                        .eq('id', event.id);

                    if (error) throw error;
                }

                alert(status === 'confirm' ? 'Presença confirmada!' : 'Convite recusado.');
                onClose();
                window.location.reload(); // Simplificado para garantir atualização do estado global
            } catch (err: any) {
                alert('Erro ao atualizar status: ' + err.message);
            }
        };

        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up">
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><XCircleIcon className="w-6 h-6" /></button>
                    <div className="flex items-start space-x-4">
                        <div className={`mt-1 p-2 rounded-full ${getCategoryColor(event.category)}`}>
                            {event.category === 'Aniversário' ? <GiftIcon className="w-6 h-6" /> : <CalendarIcon className="w-6 h-6" />}
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-brand-text mb-1">{event.title}</h3>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getCategoryColor(event.category)}`}>{event.category}</span>
                        </div>
                    </div>

                    <div className="space-y-4 text-brand-subtle-text mt-6">
                        <div className="flex items-center space-x-3">
                            <CalendarIcon className="w-5 h-5" />
                            <span>{new Date(event.date).toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}, {event.startTime} - {event.endTime}</span>
                        </div>
                        {event.location && <p><strong>Local:</strong> {event.location}</p>}
                        {event.notes && <p><strong>Observações:</strong> {event.notes}</p>}

                        {/* Ações para convidados */}
                        {isInvited && !isConfirmed && !showReasonInput && (
                            <div className="flex space-x-3 pt-4">
                                <button onClick={() => handleStatusUpdate('confirm')} className="flex-1 py-2 bg-emerald-500 text-white rounded-md font-semibold hover:bg-emerald-600">
                                    Confirmar Presença
                                </button>
                                <button onClick={() => setShowReasonInput(true)} className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-md font-semibold hover:bg-gray-300">
                                    Recusar
                                </button>
                            </div>
                        )}

                        {showReasonInput && (
                            <div className="space-y-3 pt-4 border-t">
                                <label className="block text-sm font-medium text-brand-text">Por que você não poderá participar?</label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Escreva o motivo..."
                                    className="w-full border-gray-300 rounded-md p-2 text-sm bg-white text-brand-text"
                                    rows={2}
                                />
                                <div className="flex space-x-2">
                                    <button onClick={() => handleStatusUpdate('decline')} className="flex-1 py-2 bg-red-500 text-white rounded-md text-sm font-semibold hover:bg-red-600">
                                        Confirmar Recusa
                                    </button>
                                    <button onClick={() => setShowReasonInput(false)} className="px-4 py-2 bg-gray-100 text-gray-500 rounded-md text-sm">Cancelar</button>
                                </div>
                            </div>
                        )}

                        {event.attendees && event.attendees.length > 0 && (
                            <div className="pt-4 border-t">
                                <h4 className="font-semibold text-brand-text mb-2 text-sm">Confirmados ({event.attendees.length})</h4>
                                <div className="flex flex-wrap gap-2">
                                    {event.attendees.map(a => (
                                        <span key={a.id} className="flex items-center space-x-2 bg-emerald-50 px-2 py-1 rounded-full text-xs text-emerald-700 border border-emerald-100">
                                            <img src={a.avatarUrl || 'https://via.placeholder.com/32'} className="w-4 h-4 rounded-full" alt={a.name} />
                                            <span>{a.name}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto">
            <Card title="" className="p-0">
                <header className="flex items-center justify-between p-4 border-b flex-wrap gap-2">
                    <div className="flex items-center space-x-2">
                        <button onClick={handlePrev} className="p-2 rounded-full hover:bg-gray-100 text-gray-500"><ChevronLeftIcon className="w-5 h-5" /></button>
                        <h2 className="text-xl font-bold text-brand-text capitalize w-64 text-center">{calendarTitle}</h2>
                        <button onClick={handleNext} className="p-2 rounded-full hover:bg-gray-100 text-gray-500"><ChevronRightIcon className="w-5 h-5" /></button>
                        <button onClick={handleToday} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-100 text-brand-text bg-white transition-colors">Hoje</button>
                    </div>
                    <div className="flex items-center space-x-2">
                        {(currentUser?.isAdmin || currentUser?.email === 'ti@grupopixel.com.br') && (
                            <button onClick={async () => {
                                const { data, error } = await supabase.rpc('get_my_company_id');
                                alert(`Debug: Company ID from DB: ${data} \nError: ${error?.message} \nLocal User ID: ${currentUser?.id} \nLocal Company ID: ${currentUser?.company_id}`);
                                console.log('Debug Employees:', employees);
                                console.log('Debug Departments:', departments);
                            }} className="px-2 py-1 bg-red-500 text-white text-xs rounded">Debug DB</button>
                        )}

                        <div className="bg-gray-100 p-1 rounded-md flex">
                            <button onClick={() => setView('month')} className={`px-3 py-1 text-sm rounded transition-colors ${view === 'month' ? 'bg-white shadow text-brand-primary font-medium' : 'text-gray-500 hover:text-gray-700'}`}>Mês</button>
                            <button onClick={() => setView('week')} className={`px-3 py-1 text-sm rounded transition-colors ${view === 'week' ? 'bg-white shadow text-brand-primary font-medium' : 'text-gray-500 hover:text-gray-700'}`}>Semana</button>
                        </div>
                        <button onClick={() => setCreateModalOpen(true)} className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 transition-colors">
                            <PlusIcon className="w-4 h-4" /><span>Criar Evento</span>
                        </button>
                    </div>
                </header>

                {view === 'month' ? (
                    <div className="grid grid-cols-7">
                        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => <div key={day} className="text-center font-semibold text-xs text-brand-subtle-text py-3 border-b">{day}</div>)}
                        {calendarGrid.map((day, index) => {
                            const eventsOnDay = day ? allCalendarEvents.filter(e => new Date(e.date).getUTCFullYear() === day.getFullYear() && new Date(e.date).getUTCMonth() === day.getMonth() && new Date(e.date).getUTCDate() === day.getDate()) : [];
                            const isToday = day ? new Date().toDateString() === day.toDateString() : false;
                            return (
                                <div key={index} className="h-28 border-b border-r p-1 relative">
                                    {day && (
                                        <>
                                            <span className={`text-xs font-semibold absolute top-1.5 left-1.5 w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-brand-primary text-white' : 'text-gray-500'}`}>{day.getDate()}</span>
                                            <div className="mt-7 space-y-1 overflow-y-auto h-[calc(100%-1.75rem)] pr-1">
                                                {eventsOnDay.map(event => (
                                                    <div key={event.id} onClick={() => handleViewEvent(event)} className={`p-1 rounded border-l-4 text-xs truncate cursor-pointer hover:opacity-80 ${getCategoryColor(event.category)}`}>
                                                        {event.category === 'Aniversário' && <GiftIcon className="w-3 h-3 inline mr-1" />}
                                                        {event.title}
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                ) : ( // Week View
                    <div className="grid grid-cols-7">
                        {calendarGrid.map((day, index) => (
                            <div key={index} className="text-center py-3 border-b border-r">
                                <p className="font-semibold text-xs text-brand-subtle-text">{day.toLocaleDateString('pt-BR', { weekday: 'short' })}</p>
                                <p className={`text-xl font-bold ${new Date().toDateString() === day.toDateString() ? 'text-brand-primary' : 'text-brand-text'}`}>{day.getDate()}</p>
                            </div>
                        ))}
                        {calendarGrid.map((day, index) => (
                            <div key={index} className="h-96 border-r p-1 overflow-y-auto space-y-1">
                                {allCalendarEvents.filter(e => new Date(e.date).getUTCFullYear() === day.getFullYear() && new Date(e.date).getUTCMonth() === day.getMonth() && new Date(e.date).getUTCDate() === day.getDate()).map(event => (
                                    <div key={event.id} onClick={() => handleViewEvent(event)} className={`p-1.5 rounded border-l-4 text-xs cursor-pointer hover:opacity-80 ${getCategoryColor(event.category)}`}>
                                        <p className="font-semibold">{event.title}</p>
                                        <p>{event.startTime !== '00:00' && `${event.startTime} - ${event.endTime}`}</p>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative">
                        <button onClick={() => setCreateModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><XCircleIcon className="w-6 h-6" /></button>
                        <h3 className="text-xl font-bold text-brand-text mb-4">Criar Novo Evento</h3>
                        <form onSubmit={handleCreateEvent} className="space-y-4">
                            <div><label className="block text-sm font-medium text-brand-subtle-text">Título do Evento</label><input type="text" name="title" value={newEventData.title} onChange={handleInputChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" /></div>
                            <div><label className="block text-sm font-medium text-brand-subtle-text">Categoria</label><select name="category" value={newEventData.category} onChange={handleInputChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"><option>Reunião</option><option>Evento da Empresa</option></select></div>
                            <div><label className="block text-sm font-medium text-brand-subtle-text">Data</label><input type="date" name="date" value={newEventData.date} onChange={handleInputChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-brand-subtle-text">Início</label><input type="time" name="startTime" value={newEventData.startTime} onChange={handleInputChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" /></div>
                                <div><label className="block text-sm font-medium text-brand-subtle-text">Fim</label><input type="time" name="endTime" value={newEventData.endTime} onChange={handleInputChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" /></div>
                            </div>
                            <div><label className="block text-sm font-medium text-brand-subtle-text">Local</label><input type="text" name="location" value={newEventData.location} onChange={handleInputChange} placeholder="Ex: Sala de Reunião 1 ou Virtual" className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" /></div>
                            <div>
                                <label className="block text-sm font-medium text-brand-subtle-text">Convidar Departamento Inteiro (Opcional)</label>
                                <select
                                    name="departmentId"
                                    value={newEventData.departmentId}
                                    onChange={handleInputChange}
                                    className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"
                                >
                                    <option value="">Nenhum Departamento</option>
                                    {departments.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-brand-subtle-text mb-1">Participantes</label>
                                <div className="border rounded-md p-2 bg-gray-50">
                                    <div className="flex items-center bg-white border border-gray-200 rounded-md px-2 py-1 mb-2">
                                        <UsersIcon className="w-4 h-4 text-gray-400 mr-2" />
                                        <input
                                            type="text"
                                            placeholder="Buscar participantes..."
                                            value={attendeeSearch}
                                            onChange={(e) => setAttendeeSearch(e.target.value)}
                                            className="w-full text-sm py-1 focus:outline-none bg-transparent"
                                        />
                                    </div>
                                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                                        {employees
                                            .filter(emp => emp.name.toLowerCase().includes(attendeeSearch.toLowerCase()))
                                            .map(e => (
                                                <label key={e.id} className="flex items-center space-x-2 p-1.5 hover:bg-white rounded cursor-pointer transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={newEventData.attendees.includes(e.id)}
                                                        onChange={() => toggleAttendee(e.id)}
                                                        className="w-4 h-4 text-brand-primary rounded border-gray-300 focus:ring-brand-primary"
                                                    />
                                                    <img src={e.avatarUrl || 'https://via.placeholder.com/24'} className="w-6 h-6 rounded-full object-cover" alt="" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-brand-text truncate">{e.name}</p>
                                                        <p className="text-[10px] text-gray-500 truncate">{e.role}</p>
                                                    </div>
                                                </label>
                                            ))}
                                    </div>
                                    {newEventData.attendees.length > 0 && (
                                        <div className="mt-2 pt-2 border-t flex flex-wrap gap-1">
                                            {newEventData.attendees.map(id => {
                                                const emp = employees.find(e => e.id === id);
                                                return emp ? (
                                                    <span key={id} className="inline-flex items-center bg-brand-primary/10 text-brand-primary text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                        {emp.name.split(' ')[0]}
                                                    </span>
                                                ) : null;
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div><label className="block text-sm font-medium text-brand-subtle-text">Observações</label><textarea name="notes" value={newEventData.notes} onChange={handleInputChange} rows={3} className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"></textarea></div>
                            <div className="flex justify-end space-x-3 pt-2"><button type="button" onClick={() => setCreateModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors">Cancelar</button><button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 transition-colors">Salvar Evento</button></div>
                        </form>
                    </div>
                </div>
            )}
            {isDetailModalOpen && selectedEvent && <EventModal event={selectedEvent} onClose={() => setDetailModalOpen(false)} />}
        </div>
    );
};

export default CalendarPage;