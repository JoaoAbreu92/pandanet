import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import { PlusIcon, XMarkIcon, ClockIcon, MapPinIcon, Bars3BottomLeftIcon } from '../components/icons';
import { useAuth } from './AuthContext';
import { supabase } from '../supabaseClient';

const CRMCalendar: React.FC = () => {
    const { currentUser } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        startTime: '09:00',
        endTime: '10:00',
        priority: 'medium'
    });

    const [events, setEvents] = useState<any[]>([]);

    const fetchTasks = async () => {
        if (!currentUser?.company_id) return;

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('crm_tasks')
                .select('*')
                .eq('company_id', currentUser.company_id);

            if (error) throw error;

            const calendarEvents = (data || []).map(task => ({
                id: task.id,
                title: task.title,
                start: task.start_date,
                end: task.due_date,
                backgroundColor: task.priority === 'high' ? '#f59e0b' : task.priority === 'urgent' ? '#ef4444' : '#3b82f6',
                borderColor: 'transparent',
                extendedProps: { ...task }
            }));

            setEvents(calendarEvents);
        } catch (error) {
            console.error('Error fetching tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, [currentUser?.company_id]);

    const handleDateClick = (arg: any) => {
        setSelectedDate(arg.dateStr);
        setIsModalOpen(true);
    };

    const handleSaveTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser?.company_id || !selectedDate) return;

        try {
            const startDateTime = `${selectedDate}T${formData.startTime}:00Z`;
            const endDateTime = `${selectedDate}T${formData.endTime}:00Z`;

            const { data, error } = await supabase
                .from('crm_tasks')
                .insert([{
                    company_id: currentUser.company_id,
                    title: formData.title,
                    description: formData.description,
                    start_date: startDateTime,
                    due_date: endDateTime,
                    priority: formData.priority,
                    created_by: currentUser.id,
                    status: 'not_started'
                }])
                .select();

            if (error) throw error;

            if (data && data[0]) {
                const newTask = data[0];
                const newEvent = {
                    id: newTask.id,
                    title: newTask.title,
                    start: newTask.start_date,
                    end: newTask.due_date,
                    backgroundColor: newTask.priority === 'high' ? '#f59e0b' : newTask.priority === 'urgent' ? '#ef4444' : '#3b82f6',
                    borderColor: 'transparent',
                    extendedProps: { ...newTask }
                };
                setEvents([...events, newEvent]);
            }

            setIsModalOpen(false);
            setFormData({ title: '', description: '', startTime: '09:00', endTime: '10:00', priority: 'medium' });
        } catch (error) {
            console.error('Error saving task:', error);
            alert('Erro ao salvar tarefa. Verifique o console.');
        }
    };

    return (
        <div className="p-4 md:p-8 bg-white dark:bg-slate-950 min-h-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Calendário CRM</h1>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Gerencie suas tarefas e compromissos vinculados à sua conta.</p>
                </div>
                <button 
                    onClick={() => { setSelectedDate(new Date().toISOString().split('T')[0]); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-bold text-sm transition-all shadow-lg"
                >
                    <PlusIcon className="w-4 h-4" />
                    Criar Tarefa
                </button>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xl calendar-container">
                <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    locale={ptBrLocale}
                    headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,timeGridWeek,timeGridDay'
                    }}
                    events={events}
                    dateClick={handleDateClick}
                    height="auto"
                    dayMaxEvents={true}
                    eventContent={(eventInfo) => (
                        <div className="p-1 overflow-hidden">
                            <div className="flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full bg-white/50`} />
                                <span className="text-[10px] font-bold truncate text-white">{eventInfo.event.title}</span>
                            </div>
                        </div>
                    )}
                />
            </div>

            {/* NEW TASK MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/10">
                        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-gray-800 dark:text-white">Nova Tarefa para {selectedDate}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <XMarkIcon className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveTask} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Título</label>
                                <input 
                                    required
                                    type="text" 
                                    value={formData.title}
                                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                                    placeholder="Ex: Reunião com Cliente..."
                                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Início</label>
                                    <div className="relative">
                                        <ClockIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input 
                                            type="time" 
                                            value={formData.startTime}
                                            onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                                            className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 pl-10 text-sm focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Fim</label>
                                    <div className="relative">
                                        <ClockIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input 
                                            type="time" 
                                            value={formData.endTime}
                                            onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                                            className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 pl-10 text-sm focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Prioridade</label>
                                <select 
                                    value={formData.priority}
                                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 appearance-none"
                                >
                                    <option value="low">Baixa</option>
                                    <option value="medium">Média</option>
                                    <option value="high">Alta</option>
                                    <option value="urgent">Urgente</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Descrição</label>
                                <textarea 
                                    rows={3}
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 no-scrollbar"
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
                                <button type="submit" className="flex-1 px-4 py-3 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-lg shadow-blue-500/20">Salvar Tarefa</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .calendar-container .fc { --fc-border-color: #f1f5f9; --fc-today-bg-color: #f1f5f9; }
                .dark .calendar-container .fc { --fc-border-color: #1e293b; --fc-today-bg-color: #1e293b; }
                .fc-theme-standard th { padding: 12px 0; font-size: 10px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.1em; }
                .fc-event { border-radius: 6px; border: none; box-shadow: 2px 2px 10px rgba(0,0,0,0.1); }
                .fc-toolbar-title { font-size: 1.25rem !important; font-weight: 800 !important; color: #1e293b; }
                .dark .fc-toolbar-title { color: #f8fafc; }
                .fc-button-primary { background-color: transparent !important; border-color: #e2e8f0 !important; color: #64748b !important; font-weight: 700 !important; font-size: 12px !important; text-transform: capitalize !important; }
                .dark .fc-button-primary { border-color: #1e293b !important; color: #94a3b8 !important; }
                .fc-button-active { background-color: #0ea5e9 !important; border-color: #0ea5e9 !important; color: white !important; }
            `}</style>
        </div>
    );
};

export default CRMCalendar;
