import React, { useState, useMemo, useEffect } from 'react';
import Card from './Card';
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    PlusIcon,
    XCircleIcon,
    UsersIcon,
    CalendarIcon,
    GiftIcon,
    VideoCameraIcon,
    PaintBrushIcon,
    CalendarDaysIcon,
    ClockIcon,
    MapPinIcon,
    DocumentTextIcon,
    CheckIcon,
    XMarkIcon,
    UserPlusIcon,
    ArrowUturnLeftIcon
} from './icons';
import type { CalendarEvent, Employee, CalendarEventCategory } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';

const mockHolidays = [
    // Nacionais
    { title: 'Confraternização Universal', date: '2026-01-01', scope: 'Nacional', description: 'Início do ano civil, adotado por quase todas as nações do mundo. Celebra a paz e a união entre os povos.' },
    { title: 'Carnaval', date: '2026-02-16', scope: 'Nacional (Ponto Facultativo)', description: 'Tradicional celebração popular que antecede a Quaresma. No Brasil, é marcado por desfiles e blocos de rua.' },
    { title: 'Paixão de Cristo', date: '2026-04-03', scope: 'Nacional', description: 'Data religiosa cristã que relembra a crucificação e morte de Jesus Cristo. Também conhecida como Sexta-feira Santa.' },
    { title: 'Tiradentes', date: '2026-04-21', scope: 'Nacional', description: 'Homenagem a Joaquim José da Silva Xavier, o Tiradentes, mártir da Inconfidência Mineira e patrono cívico do Brasil.' },
    { title: 'Dia do Trabalho', date: '2026-05-01', scope: 'Nacional', description: 'Celebra as conquistas históricas dos trabalhadores e a luta por melhores condições de trabalho ao redor do mundo.' },
    { title: 'Corpus Christi', date: '2026-06-04', scope: 'Nacional (Ponto Facultativo)', description: 'Festa religiosa da Igreja Católica que celebra o mistério da Eucaristia, o sacramento do corpo e do sangue de Jesus Cristo.' },
    { title: 'Independência do Brasil', date: '2026-09-07', scope: 'Nacional', description: 'Data que marca o grito de independência de D. Pedro I às margens do Rio Ipiranga em 1822, libertando o Brasil de Portugal.' },
    { title: 'Nossa Senhora Aparecida', date: '2026-10-12', scope: 'Nacional', description: 'Celebra a padroeira do Brasil. A data também é popularmente comemorada como o Dia das Crianças.' },
    { title: 'Finados', date: '2026-11-02', scope: 'Nacional', description: 'Dia dedicado à memória dos mortos, prática comum em diversas culturas e religiões para homenagear entes queridos.' },
    { title: 'Proclamação da República', date: '2026-11-15', scope: 'Nacional', description: 'Relembra o golpe militar de 1889 que pôs fim ao período do Império e instituiu a República Federativa no Brasil.' },
    { title: 'Consciência Negra', date: '2026-11-20', scope: 'Nacional', description: 'Homenagem a Zumbi dos Palmares, líder do quilombo mais famoso do Brasil. Celebra a resistência e a cultura afro-brasileira.' },
    { title: 'Natal', date: '2026-12-25', scope: 'Nacional', description: 'Celebração cristã do nascimento de Jesus Cristo. É um momento de união familiar.' },

    // Estaduais de destaque
    { title: 'Aniversário de São Paulo', date: '2026-01-25', scope: 'Estadual/Municipal', origin: 'São Paulo', description: 'Data da fundação da cidade de São Paulo em 1554 pelos jesuítas Manuel da Nóbrega e José de Anchieta.' },
    { title: 'Revolução Constitucionalista', date: '2026-07-09', scope: 'Estadual', origin: 'São Paulo', description: 'Homenagem ao levante armado de 1932 no estado de SP contra o governo de Getúlio Vargas e em prol de uma Constituição.' },
    { title: 'São Jorge', date: '2026-04-23', scope: 'Estadual', origin: 'Rio de Janeiro', description: 'Homenagem ao santo guerreiro, muito popular no Rio de Janeiro, feriado estadual oficial desde 2008.' },
    { title: 'Adesão do Pará', date: '2026-08-15', scope: 'Estadual', origin: 'Pará', description: 'Data que marca a adesão do estado do Pará à independência do Brasil em 1823, quase um ano após o grito do Ipiranga.' },
    { title: 'Data Magna de Pernambuco', date: '2026-03-06', scope: 'Estadual', origin: 'Pernambuco', description: 'Relembra a Revolução Pernambucana de 1817, primeiro movimento emancipacionista que instituiu um governo próprio.' },
    { title: 'Independência da Bahia', date: '2026-07-02', scope: 'Estadual', origin: 'Bahia', description: 'Celebra a vitória das tropas brasileiras sobre as forças portuguesas na Bahia em 1823, consolidando a independência regional.' },
    { title: 'Revolução Farroupilha', date: '2026-09-20', scope: 'Estadual', origin: 'Rio Grande do Sul', description: 'Também chamado de Dia do Gaúcho, recorda o início do levante republicano de 1835 contra o governo imperial.' },
];

const MONTH_THEMES: Record<number, { name: string, color: string, bg: string, border: string, text: string, phrase: string, campaign: string }> = {
    0: { name: 'Janeiro', color: 'bg-white', bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', campaign: 'Branco', phrase: 'Cuidar da mente é cuidar da vida.' },
    1: { name: 'Fevereiro', color: 'bg-purple-500', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', campaign: 'Roxo', phrase: 'Conscientização sobre Lúpus, Alzheimer e Fibromialgia.' },
    2: { name: 'Março', color: 'bg-fuchsia-500', bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', text: 'text-fuchsia-700', campaign: 'Lilás', phrase: 'Prevenção do câncer de colo de útero.' },
    3: { name: 'Abril', color: 'bg-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', campaign: 'Azul', phrase: 'Conscientização sobre o Autismo.' },
    4: { name: 'Maio', color: 'bg-yellow-400', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', campaign: 'Amarelo', phrase: 'Atenção pela vida no trânsito.' },
    5: { name: 'Junho', color: 'bg-red-500', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', campaign: 'Vermelho', phrase: 'Doe sangue, doe vida.' },
    6: { name: 'Julho', color: 'bg-yellow-500', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', campaign: 'Amarelo', phrase: 'Combate às hepatites virais.' },
    7: { name: 'Agosto', color: 'bg-amber-400', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', campaign: 'Dourado', phrase: 'Amamentar é a base da vida.' },
    8: { name: 'Setembro', color: 'bg-yellow-400', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', campaign: 'Amarelo', phrase: 'Falar é a melhor solução (Prevenção ao Suicídio).' },
    9: { name: 'Outubro', color: 'bg-pink-400', bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', campaign: 'Rosa', phrase: 'Um toque de cuidado (Pela prevenção do câncer de mama).' },
    10: { name: 'Novembro', color: 'bg-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', campaign: 'Azul', phrase: 'Saúde também é coisa de homem.' },
    11: { name: 'Dezembro', color: 'bg-orange-500', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', campaign: 'Laranja', phrase: 'Prevenção do câncer de pele.' },
};

interface CalendarPageProps {
    events?: CalendarEvent[];
    currentUser?: Employee | null;
}

const CalendarPage: React.FC<CalendarPageProps> = ({ events: initialEvents, currentUser: propUser }) => {
    const { profile: contextUser } = useAuth();
    const currentUser = propUser || contextUser;
    const { addNotification } = useNotifications();

    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<'year' | 'month' | 'week'>('year');
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [isRSVPModalOpen, setRSVPModalOpen] = useState(false);
    const [declineReason, setDeclineReason] = useState('');
    const [newEventData, setNewEventData] = useState({
        title: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '10:00',
        category: 'Reunião' as CalendarEventCategory,
        location: '',
        attendees: [] as string[],
        departmentId: '',
        notes: '',
        isPrivate: false
    });

    useEffect(() => {
        if (!currentUser?.company_id) return;

        const fetchData = async () => {
            const { data: emps } = await supabase.from('profiles').select('*').eq('company_id', currentUser.company_id);
            if (emps) {
                setEmployees(emps.map((e: any) => ({
                    id: e.id,
                    name: e.full_name,
                    email: e.email,
                    role: e.role,
                    team: e.team,
                    avatarUrl: e.avatar_url,
                    birthDate: e.birth_date,
                    permissions: {} as any, joinDate: e.created_at, following: []
                })));
            }
            const { data: depts } = await supabase.from('departments').select('*').eq('company_id', currentUser.company_id);
            if (depts) setDepartments(depts);

            const { data: evts } = await supabase
                .from('events')
                .select('*, calendar_invites(*)')
                .or(`company_id.eq.${currentUser.company_id},and(is_private.eq.true,creator_id.eq.${currentUser.id})`);

            if (evts) {
                const empsMap = emps || [];
                const formattedEvents: CalendarEvent[] = evts
                    .filter((e: any) => !e.is_private || e.creator_id === currentUser.id)
                    .map((e: any) => ({
                    id: e.id,
                    title: e.title,
                    date: e.date ? e.date.split('T')[0] : (e.created_at ? e.created_at.split('T')[0] : ''),
                    startTime: e.start_time ? new Date(e.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : '00:00',
                    endTime: e.end_time ? new Date(e.end_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : '00:00',
                    category: (e.category as CalendarEventCategory) || 'Reunião',
                    location: e.location || '',
                    attendees: (empsMap || []).filter((emp: any) => (e.attendees || []).includes(emp.id)).map((emp: any) => ({
                        id: emp.id,
                        name: emp.full_name,
                        avatarUrl: emp.avatar_url
                    } as Employee)),
                    invitedIds: e.invited_ids || [],
                    notes: e.description || '',
                        isPrivate: e.is_private,
                    invites: (e.calendar_invites || []).map((inv: any) => {
                        const invitee = empsMap.find((emp: any) => emp.id === inv.user_id);
                        return {
                            id: inv.id,
                            event_id: inv.event_id,
                            user_id: inv.user_id,
                            status: inv.status,
                            decline_reason: inv.decline_reason,
                            invitee_name: invitee?.full_name,
                            invitee_avatar: invitee?.avatar_url
                        };
                    })
                }));
                setEvents(formattedEvents);
            }
        };
        fetchData();
    }, [currentUser]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setNewEventData(prev => ({ ...prev, [name]: value }));
    };

    const handleCreateEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser?.company_id) return;

        let finalAttendees = [...newEventData.attendees];
        if (newEventData.departmentId) {
            const deptUsers = employees.filter(emp => (emp as any).department_id === newEventData.departmentId).map(emp => emp.id);
            finalAttendees = Array.from(new Set([...finalAttendees, ...deptUsers]));
        }

        try {
            const combinedStartTime = new Date(`${newEventData.date}T${newEventData.startTime}:00Z`).toISOString();
            const combinedEndTime = new Date(`${newEventData.date}T${newEventData.endTime}:00Z`).toISOString();

            const { data, error } = await supabase.from('events').insert({
                company_id: currentUser.company_id,
                title: newEventData.title,
                description: newEventData.notes,
                date: newEventData.date,
                start_time: combinedStartTime,
                end_time: combinedEndTime,
                category: newEventData.category,
                location: newEventData.location,
                attendees: [currentUser.id],
                invited_ids: newEventData.isPrivate ? [] : finalAttendees.filter(id => id !== currentUser.id),
                creator_id: currentUser.id,
                is_private: newEventData.isPrivate
            }).select();

            if (data && data[0]) {
                const eventId = data[0].id;

                // Criar convites na tabela calendar_invites (apenas se não for privado)
                if (!newEventData.isPrivate && finalAttendees.length > 0) {
                    const invites = finalAttendees
                        .filter(id => id !== currentUser.id)
                        .map(userId => ({
                            event_id: eventId,
                            user_id: userId,
                            status: 'pending'
                        }));

                    if (invites.length > 0) {
                        const { error: inviteError } = await supabase
                            .from('calendar_invites')
                            .insert(invites);

                        if (inviteError) {
                            console.error('Error creating invites:', inviteError);
                            // Se falhar a tabela (não existir), ainda assim o evento foi criado pelo fallback invited_ids
                        }
                    }
                }

                setCreateModalOpen(false);
                window.location.reload();
            }
        } catch (err) { console.error(err); }
    };

    const handleRSVP = async (status: 'accepted' | 'declined') => {
        if (!currentUser?.id || !selectedEvent) return;

        try {
            const { error } = await supabase
                .from('calendar_invites')
                .update({
                    status,
                    decline_reason: status === 'declined' ? declineReason : null
                })
                .eq('event_id', selectedEvent.id)
                .eq('user_id', currentUser.id);

            if (error) throw error;

            setRSVPModalOpen(false);
            setDeclineReason('');
            setDetailModalOpen(false);
            window.location.reload();
        } catch (err) {
            console.error('Error updating RSVP:', err);
        }
    };

    const allCalendarEvents = useMemo(() => {
        const birthdayEvents: CalendarEvent[] = employees.map((emp: any) => ({
            id: `bday-${emp.id}`,
            title: `Aniversário de ${emp.name?.split(' ')[0]}`,
            date: emp.birthDate ? `${currentDate.getFullYear()}-${emp.birthDate.substring(5, 10)}` : '',
            startTime: '00:00', endTime: '23:59', category: 'Aniversário', location: '', attendees: [], notes: ''
        })).filter(e => e.date);

        const holidayEvents: CalendarEvent[] = mockHolidays.map((h, i) => ({
            id: `holiday-${i}`,
            title: h.title,
            date: h.date.replace('2024', currentDate.getFullYear().toString()),
            startTime: '00:00',
            endTime: '23:59',
            category: 'Feriado',
            location: h.scope + (h.origin ? ` (${h.origin})` : ''),
            attendees: [],
            notes: h.description,
            isSystem: true
        }));

        return [...events, ...birthdayEvents, ...holidayEvents];
    }, [events, employees, currentDate]);

    const handleMonthClick = (monthIndex: number) => {
        setCurrentDate(new Date(currentDate.getFullYear(), monthIndex, 1));
        setView('month');
    };

    const handleNextYear = () => setCurrentDate(new Date(currentDate.getFullYear() + 1, 0, 1));
    const handlePrevYear = () => setCurrentDate(new Date(currentDate.getFullYear() - 1, 0, 1));

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const YearView = () => (
        <div className="p-6 bg-white rounded-b-xl animate-fade-in-down">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Object.entries(MONTH_THEMES).map(([idx, theme]) => {
                    const monthIdx = parseInt(idx);
                    const monthEvents = allCalendarEvents.filter(e => {
                        const d = new Date(e.date);
                        return d.getUTCFullYear() === currentDate.getFullYear() && d.getUTCMonth() === monthIdx;
                    });

                    return (
                        <button
                            key={idx}
                            onClick={() => handleMonthClick(monthIdx)}
                            className={`group relative flex flex-col p-4 rounded-2xl border ${theme.border} ${theme.bg} hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left overflow-hidden`}
                        >
                            {/* Theme Ribbon */}
                            <div className={`absolute top-0 right-0 w-16 h-16 opacity-10 pointer-events-none`}>
                                <div className={`absolute top-2 right-2 p-2 rounded-full ${theme.color} text-white`}>
                                    <PaintBrushIcon className="w-5 h-5" />
                                </div>
                            </div>

                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h4 className={`text-lg font-bold ${theme.text}`}>{theme.name}</h4>
                                    <p className="text-[10px] uppercase tracking-wider font-semibold opacity-60">{theme.campaign}</p>
                                </div>
                                <span className="bg-white/50 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-gray-500 border border-gray-100 italic">
                                    {monthEvents.length} {monthEvents.length === 1 ? 'evento' : 'eventos'}
                                </span>
                            </div>

                            <div className="space-y-2 mb-4">
                                {monthEvents.slice(0, 3).map(e => (
                                    <div key={e.id} className="text-[10px] truncate bg-white/40 px-2 py-1 rounded border border-white/50 text-gray-600">
                                        • {e.title}
                                    </div>
                                ))}
                                {monthEvents.length > 3 && (
                                    <div className="text-[9px] text-gray-400 font-medium pl-2">
                                        + {monthEvents.length - 3} mais...
                                    </div>
                                )}
                                {monthEvents.length === 0 && (
                                    <div className="text-[10px] text-gray-400 italic py-2">Sem compromissos</div>
                                )}
                            </div>

                            <div className="mt-auto pt-3 border-t border-black/5">
                                <p className="text-[9px] leading-tight text-gray-500 italic">"{theme.phrase}"</p>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );

    const MonthView = () => {
        const month = currentDate.getMonth();
        const year = currentDate.getFullYear();
        const theme = MONTH_THEMES[month];
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)));

        return (
            <div className={`animate-scale-in transition-all duration-500`}>
                <div className={`p-4 ${theme.bg} border-b ${theme.border} flex items-center justify-between`}>
                    <div className="flex items-center space-x-6">
                        <button
                            onClick={() => setView('year')}
                            className="p-2 hover:bg-white/50 rounded-xl text-gray-400 hover:text-gray-600 transition-all border border-transparent hover:border-white/50"
                            title="Voltar para Visão Anual"
                        >
                            <ArrowUturnLeftIcon className="w-5 h-5" />
                        </button>

                        <div className="flex items-center space-x-4">
                            <button
                                onClick={handlePrevMonth}
                                className={`p-2 rounded-xl transition-all ${theme.border} border bg-white/30 hover:bg-white shadow-sm text-gray-500`}
                            >
                                <ChevronLeftIcon className="w-5 h-5" />
                            </button>

                            <div className="text-center min-w-[200px]">
                                <h3 className={`text-2xl font-black ${theme.text}`}>{theme.name} <span className="opacity-40">{year}</span></h3>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 italic mt-0.5">{theme.phrase}</p>
                            </div>

                            <button
                                onClick={handleNextMonth}
                                className={`p-2 rounded-xl transition-all ${theme.border} border bg-white/30 hover:bg-white shadow-sm text-gray-500`}
                            >
                                <ChevronRightIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3">
                        <div className={`px-4 py-2 rounded-xl bg-white/80 border ${theme.border} shadow-sm backdrop-blur-md`}>
                            <p className="text-[10px] uppercase font-bold text-gray-400 leading-none mb-1">Campanha do Mês</p>
                            <p className={`text-xs font-black uppercase ${theme.text}`}>Mês {theme.campaign}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-7 border-b">
                    {['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].map(d => (
                        <div key={d} className="py-4 text-center text-xs font-black uppercase tracking-widest text-gray-400 border-r last:border-0">{d}</div>
                    ))}
                </div>

                <div className="grid grid-cols-7">
                    {days.map((day, idx) => {
                        const isToday = day && day.toDateString() === new Date().toDateString();
                        const evs = day ? allCalendarEvents.filter(e => {
                            const d = new Date(e.date);
                            return d.getUTCFullYear() === day.getFullYear() && d.getUTCMonth() === day.getMonth() && d.getUTCDate() === day.getDate();
                        }) : [];

                        return (
                            <div key={idx} className={`h-32 border-b border-r p-2 relative transition-colors ${day ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50'} last:border-r-0`}>
                                {day && (
                                    <>
                                        <span className={`text-sm font-black absolute top-2 left-2 w-7 h-7 flex items-center justify-center rounded-lg transition-all ${isToday ? 'bg-brand-primary text-white shadow-lg' : 'text-slate-400 group-hover:text-slate-600'}`}>{day.getDate()}</span>
                                        <div className="mt-8 space-y-1 overflow-y-auto max-h-[calc(100%-2rem)]">
                                            {evs.map(e => (
                                                <button key={e.id} onClick={() => { setSelectedEvent(e); setDetailModalOpen(true); }} className={`w-full text-left p-1.5 rounded-lg text-[9px] font-bold truncate border shadow-sm transition-all hover:scale-[1.02] ${getCategoryColor(e.category)}`}>
                                                    {e.category === 'Aniversário' && <GiftIcon className="w-3 h-3 inline mr-1" />}
                                                    {e.title}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const getCategoryColor = (category: CalendarEventCategory) => {
        switch (category) {
            case 'Reunião': return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'Evento da Empresa': return 'bg-purple-50 text-purple-700 border-purple-200';
            case 'Feriado': return 'bg-rose-50 text-rose-700 border-rose-200';
            case 'Aniversário': return 'bg-amber-50 text-amber-700 border-amber-200';
            default: return 'bg-gray-50 text-gray-700 border-gray-200';
        }
    };

    return (
        <div className="max-w-screen-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Calendário <span className="text-brand-primary italic">Panda</span></h1>
                    <p className="text-slate-500 font-medium">Gestão de eventos e compromissos</p>
                </div>
                <div className="flex items-center space-x-3">
                    <button onClick={() => setCreateModalOpen(true)} className="flex items-center space-x-2 px-6 py-3 text-sm font-black text-white bg-brand-primary rounded-2xl hover:bg-emerald-600 shadow-lg shadow-emerald-200 transition-all active:scale-95">
                        <PlusIcon className="w-5 h-5" /><span>Novo Evento</span>
                    </button>
                </div>
            </div>

            <Card className="p-0 overflow-hidden border-0 shadow-2xl shadow-slate-200 rounded-3xl">
                <header className="bg-slate-900 text-white p-6 flex flex-col md:flex-row md:items-center justify-between border-b border-white/10 gap-4">
                    <div className="flex items-center space-x-6">
                        <div className="flex items-center space-x-2 bg-white/10 p-1.5 rounded-2xl">
                            <button onClick={handlePrevYear} className="p-2 hover:bg-white/20 rounded-xl transition-all"><ChevronLeftIcon className="w-5 h-5" /></button>
                            <span className="text-2xl font-black px-4">{currentDate.getFullYear()}</span>
                            <button onClick={handleNextYear} className="p-2 hover:bg-white/20 rounded-xl transition-all"><ChevronRightIcon className="w-5 h-5" /></button>
                        </div>
                        <div className="hidden lg:flex items-center space-x-2 bg-white/5 px-4 py-2 rounded-2xl border border-white/10">
                            <CalendarDaysIcon className="w-5 h-5 text-brand-primary" />
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Ano do Planejamento</span>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 bg-white/10 p-1.5 rounded-2xl">
                        <button onClick={() => setView('year')} className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${view === 'year' ? 'bg-white text-slate-900 shadow-lg' : 'text-white/60 hover:text-white'}`}>VISÃO ANUAL</button>
                        <button onClick={() => setView('month')} className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${view === 'month' ? 'bg-white text-slate-900 shadow-lg' : 'text-white/60 hover:text-white'}`}>VISÃO MENSAL</button>
                    </div>
                </header>

                {view === 'year' && <YearView />}
                {view === 'month' && <MonthView />}
                {view === 'week' && <div className="p-20 text-center text-gray-400">Em desenvolvimento</div>}
            </Card>

            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 relative animate-scale-in">
                        <button onClick={() => setCreateModalOpen(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-500 transition-colors"><XCircleIcon className="w-8 h-8" /></button>
                        <div className="mb-6">
                            <h3 className="text-3xl font-black text-slate-800">Agendar Evento</h3>
                            <p className="text-slate-500 font-medium">Preencha os detalhes do compromisso</p>
                        </div>
                        <form onSubmit={handleCreateEvent} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Assunto</label>
                                <input type="text" name="title" value={newEventData.title} onChange={handleInputChange} required className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-slate-800 focus:ring-2 focus:ring-brand-primary transition-all font-semibold" placeholder="Ex: Planejamento Trimestral" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Data</label>
                                    <input type="date" name="date" value={newEventData.date} onChange={handleInputChange} required className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-slate-800 focus:ring-2 focus:ring-brand-primary transition-all font-semibold" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                                    <select name="category" value={newEventData.category} onChange={handleInputChange} className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-slate-800 focus:ring-2 focus:ring-brand-primary transition-all font-semibold appearance-none">
                                        <option>Reunião</option>
                                        <option>Evento da Empresa</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-brand-primary/20 transition-all cursor-pointer group">
                                <input
                                    type="checkbox"
                                    id="isPrivate"
                                    name="isPrivate"
                                    checked={newEventData.isPrivate}
                                    onChange={(e) => setNewEventData(prev => ({ ...prev, isPrivate: e.target.checked }))}
                                    className="w-5 h-5 text-brand-primary border-slate-300 rounded focus:ring-brand-primary"
                                />
                                <label htmlFor="isPrivate" className="flex-1 cursor-pointer">
                                    <div className="text-sm font-bold text-slate-800 group-hover:text-brand-primary transition-colors">Evento Privado</div>
                                    <p className="text-[10px] text-slate-500 font-medium">Este evento aparecerá somente para você no calendário.</p>
                                </label>
                            </div>

                            {!newEventData.isPrivate && (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Convidar Equipe/Departamento</label>
                                        <select
                                            name="departmentId"
                                            value={newEventData.departmentId}
                                            onChange={handleInputChange}
                                            className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-slate-800 focus:ring-2 focus:ring-brand-primary transition-all font-semibold appearance-none"
                                        >
                                            <option value="">Nenhum departamento específico</option>
                                            {departments.map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Convidar Usuários</label>
                                        <div className="bg-slate-50 rounded-2xl p-4 max-h-40 overflow-y-auto border border-transparent focus-within:ring-2 focus-within:ring-brand-primary transition-all">
                                            {employees.filter(emp => emp.id !== currentUser?.id).map(emp => (
                                                <label key={emp.id} className="flex items-center space-x-3 p-2 hover:bg-white rounded-xl cursor-pointer transition-colors group">
                                                    <input
                                                        type="checkbox"
                                                        checked={newEventData.attendees.includes(emp.id)}
                                                        onChange={(e) => {
                                                            const checked = e.target.checked;
                                                            setNewEventData(prev => ({
                                                                ...prev,
                                                                attendees: checked
                                                                    ? [...prev.attendees, emp.id]
                                                                    : prev.attendees.filter(id => id !== emp.id)
                                                            }));
                                                        }}
                                                        className="w-4 h-4 text-brand-primary border-slate-300 rounded focus:ring-brand-primary"
                                                    />
                                                    <div className="flex items-center space-x-2">
                                                        {emp.avatarUrl ? (
                                                            <img src={emp.avatarUrl} className="w-6 h-6 rounded-full object-cover" />
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                                {emp.name?.charAt(0)}
                                                            </div>
                                                        )}
                                                        <span className="text-sm font-semibold text-slate-700 group-hover:text-brand-primary transition-colors">{emp.name}</span>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setCreateModalOpen(false)} className="px-8 py-4 text-sm font-black text-slate-400 hover:text-slate-600 transition-all">CANCELAR</button>
                                <button type="submit" className="px-8 py-4 text-sm font-black text-white bg-slate-900 rounded-2xl hover:bg-slate-800 shadow-xl transition-all active:scale-95 uppercase tracking-widest">SALVAR EVENTO</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isDetailModalOpen && selectedEvent && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative animate-scale-in">
                        <button onClick={() => setDetailModalOpen(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-500 transition-colors"><XCircleIcon className="w-8 h-8" /></button>
                        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 ${getCategoryColor(selectedEvent.category)}`}>
                            {selectedEvent.category === 'Aniversário' ? <GiftIcon className="w-10 h-10" /> : <CalendarIcon className="w-10 h-10" />}
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full ${getCategoryColor(selectedEvent.category)}`}>{selectedEvent.category}</span>
                        <h3 className="text-3xl font-black text-slate-800 mt-3 mb-2">{selectedEvent.title}</h3>
                        <p className="text-slate-500 font-bold flex items-center mb-6">
                            <ClockIcon className="w-5 h-5 mr-2" />
                            {new Date(selectedEvent.date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
                        </p>
                        <div className="space-y-4 pt-6 border-t border-slate-100">
                            {selectedEvent.location && (
                                <div className="flex items-start space-x-3 text-slate-600 font-medium">
                                    <MapPinIcon className="w-5 h-5 text-slate-400 mt-1" />
                                    <div>
                                        <span className="block">{selectedEvent.location}</span>
                                        {selectedEvent.isSystem && (
                                            <span className="text-[10px] text-brand-primary font-black uppercase tracking-widest bg-brand-primary/10 px-2 py-0.5 rounded-md mt-1 inline-block">
                                                Abrangência do Feriado
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                            {selectedEvent.notes && (
                                <div className="flex flex-col space-y-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="flex items-center space-x-2 text-slate-400">
                                        <DocumentTextIcon className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{selectedEvent.isSystem ? 'Histórico/Descrição' : 'Observações'}</span>
                                    </div>
                                    <p className="text-sm text-slate-600 font-medium leading-relaxed italic opacity-80">
                                        {selectedEvent.notes}
                                    </p>
                                </div>
                            )}

                            {/* Status dos Convidados */}
                            {!selectedEvent.isSystem && (
                                <div className="space-y-3 pt-4">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                        <UsersIcon className="w-3 h-3" /> Convidados
                                    </p>
                                    <div className="space-y-2">
                                        {selectedEvent.isPrivate ? (
                                            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-900 text-white shadow-lg">
                                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                                                    <XMarkIcon className="w-5 h-5 text-white/40" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold">Evento Privado</span>
                                                    <span className="text-[9px] opacity-60">Visível apenas para você</span>
                                                </div>
                                            </div>
                                        ) : selectedEvent.invites && selectedEvent.invites.length > 0 ? (
                                            selectedEvent.invites.map(inv => (
                                                <div key={inv.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                                                    <div className="flex items-center gap-2">
                                                        {inv.invitee_avatar ? (
                                                            <img src={inv.invitee_avatar} className="w-8 h-8 rounded-full object-cover" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                                {inv.invitee_name?.charAt(0)}
                                                            </div>
                                                        )}
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-slate-700">{inv.invitee_name}</span>
                                                            {inv.status === 'declined' && inv.decline_reason && (
                                                                <span className="text-[9px] text-red-500 italic">" {inv.decline_reason} "</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {inv.status === 'accepted' && <CheckIcon className="w-4 h-4 text-emerald-500" />}
                                                        {inv.status === 'declined' && <XMarkIcon className="w-4 h-4 text-red-500" />}
                                                        {inv.status === 'pending' && <ClockIcon className="w-4 h-4 text-slate-300" />}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-[10px] text-slate-400 italic font-bold ml-1">Sem convidados externos</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* RSVP Action para o usuário logado */}
                        {(() => {
                            const myInvite = selectedEvent.invites?.find(inv => inv.user_id === currentUser?.id);
                            if (myInvite && myInvite.status === 'pending') {
                                return (
                                    <div className="mt-8 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 animate-pulse-slow">
                                        <p className="text-xs font-bold text-emerald-800 mb-3 text-center uppercase tracking-wide">Você foi convidado!</p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleRSVP('accepted')}
                                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-xl font-bold text-xs uppercase transition-all shadow-md shadow-emerald-100"
                                            >
                                                Confirmar
                                            </button>
                                            <button
                                                onClick={() => setRSVPModalOpen(true)}
                                                className="flex-1 bg-white hover:bg-red-50 text-red-500 p-3 rounded-xl font-bold text-xs uppercase border border-red-100 transition-all"
                                            >
                                                Recusar
                                            </button>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}

                        <button onClick={() => setDetailModalOpen(false)} className="w-full mt-10 py-4 bg-slate-900 text-white font-black rounded-2xl uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-xl">FECHAR</button>
                    </div>
                </div>
            )}

            {isRSVPModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 relative animate-scale-in">
                        <button onClick={() => setRSVPModalOpen(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-500 transition-colors"><XCircleIcon className="w-8 h-8" /></button>
                        <div className="mb-6">
                            <h3 className="text-2xl font-black text-slate-800">Recusar Convite</h3>
                            <p className="text-slate-500 font-medium text-sm">Por favor, informe o motivo da recusa:</p>
                        </div>
                        <div className="space-y-4">
                            <textarea
                                value={declineReason}
                                onChange={(e) => setDeclineReason(e.target.value)}
                                className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-slate-800 focus:ring-2 focus:ring-brand-primary transition-all font-semibold h-32 resize-none"
                                placeholder="Ex: Estarei em outra reunião externa..."
                            ></textarea>
                            <div className="flex gap-3">
                                <button onClick={() => setRSVPModalOpen(false)} className="flex-1 py-4 text-sm font-black text-slate-400 hover:text-slate-600">CANCELAR</button>
                                <button
                                    onClick={() => handleRSVP('declined')}
                                    disabled={!declineReason.trim()}
                                    className="flex-1 py-4 text-sm font-black text-white bg-red-500 rounded-2xl hover:bg-red-600 shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    RECUSAR
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarPage;