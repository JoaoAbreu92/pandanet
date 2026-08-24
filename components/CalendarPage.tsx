import React, { useState, useMemo, useEffect } from 'react';
import Card from './Card';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, XCircleIcon, UsersIcon, CalendarIcon, GiftIcon } from './icons';
// FIX: Correcting the import path for types.
import type { CalendarEvent, Employee, CalendarEventCategory } from '../types';

interface CalendarPageProps {
    allEmployees: Employee[];
    userEvents?: CalendarEvent[];
    onEventCreate?: (event: CalendarEvent) => void;
}

const mockHolidays = [
    { title: 'Dia do Trabalho', date: '2024-05-01' },
    { title: 'Independência do Brasil', date: '2024-09-07' },
    { title: 'Nossa Senhora Aparecida', date: '2024-10-12' },
    { title: 'Finados', date: '2024-11-02' },
    { title: 'Proclamação da República', date: '2024-11-15' },
    { title: 'Natal', date: '2024-12-25' },
];


const CalendarPage: React.FC<CalendarPageProps> = ({ allEmployees, userEvents = [], onEventCreate }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<'month' | 'week'>('month');
    // Removed local events state in favor of props
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
        attendees: [] as Employee[],
        notes: ''
    });

    const allCalendarEvents = useMemo(() => {
        const birthdayEvents: CalendarEvent[] = allEmployees.map(emp => ({
            id: -emp.id, // Negative ID to avoid collision
            title: `Aniversário de ${emp.name.split(' ')[0]}`,
            date: `${currentDate.getFullYear()}-${emp.birthDate.substring(5)}`,
            startTime: '00:00',
            endTime: '23:59',
            category: 'Aniversário',
            location: '',
            attendees: [],
            notes: `Deseje um feliz aniversário para ${emp.name}!`
        }));

        const holidayEvents: CalendarEvent[] = mockHolidays.map((h, i) => ({
            id: -1000 - i,
            title: h.title,
            date: h.date.replace('2024', currentDate.getFullYear().toString()), // Adjust year
            startTime: '00:00',
            endTime: '23:59',
            category: 'Feriado',
            location: '',
            attendees: [],
            notes: 'Feriado Nacional'
        }));

        return [...userEvents, ...birthdayEvents, ...holidayEvents];
    }, [userEvents, allEmployees, currentDate]);


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

    const handleAttendeesChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedIds = [...e.target.selectedOptions].map(option => Number(option.value));
        const selectedEmployees = allEmployees.filter(emp => selectedIds.includes(emp.id));
        setNewEventData(prev => ({ ...prev, attendees: selectedEmployees }));
    };

    const handleCreateEvent = (e: React.FormEvent) => {
        e.preventDefault();
        const newEvent: CalendarEvent = { id: Date.now(), ...newEventData };
        if (onEventCreate) {
            onEventCreate(newEvent);
        }
        setCreateModalOpen(false);
        setNewEventData({ title: '', date: new Date().toISOString().split('T')[0], startTime: '09:00', endTime: '10:00', category: 'Reunião', location: '', attendees: [], notes: '' });
    };

    const getCategoryColor = (category: CalendarEventCategory) => {
        switch (category) {
            case 'Reunião': return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'Evento da Empresa': return 'bg-purple-100 text-purple-800 border-purple-300';
            case 'Feriado': return 'bg-red-100 text-red-800 border-red-300';
            case 'Aniversário': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            default: return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    };

    const EventModal: React.FC<{ event: CalendarEvent, onClose: () => void }> = ({ event, onClose }) => (
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
                    <div className="flex items-center space-x-3"><CalendarIcon className="w-5 h-5" /><span>{new Date(event.date).toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}, {event.startTime} - {event.endTime}</span></div>
                    {event.location && <p><strong>Local:</strong> {event.location}</p>}
                    {event.notes && <p><strong>Observações:</strong> {event.notes}</p>}
                    {event.attendees.length > 0 && <div>
                        <h4 className="font-semibold text-brand-text mb-2">Participantes ({event.attendees.length})</h4>
                        <div className="flex flex-wrap gap-2">{event.attendees.map(a => <span key={a.id} className="flex items-center space-x-2 bg-gray-100 px-2 py-1 rounded-full text-sm"><img src={a.avatarUrl} className="w-5 h-5 rounded-full" alt={a.name} /><span>{a.name}</span></span>)}</div>
                    </div>}
                </div>
            </div>
        </div>
    );

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
                            <div><label className="block text-sm font-medium text-brand-subtle-text">Participantes</label><select multiple name="attendees" onChange={handleAttendeesChange} className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text h-24">{allEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
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