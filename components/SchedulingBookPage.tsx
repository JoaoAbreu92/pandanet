import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
    CalendarIcon, 
    ClockIcon, 
    CheckIcon, 
    SparklesIcon, 
    CurrencyDollarIcon, 
    ArrowLeftIcon,
    ExclamationTriangleIcon
} from './icons';
import type { SchedulingEventType, SchedulingBooking } from '../types';

const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

interface SchedulingBookPageProps {
    eventTypeId?: string;
    isPublic?: boolean;
}

const SchedulingBookPage: React.FC<SchedulingBookPageProps> = ({ eventTypeId, isPublic = true }) => {
    const [eventType, setEventType] = useState<SchedulingEventType | null>(null);
    const [hostProfile, setHostProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activePhotoIndex, setActivePhotoIndex] = useState(0);

    // Flow states
    const [step, setStep] = useState<'datetime' | 'form' | 'payment' | 'success'>('datetime');
    const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD
    const [selectedTime, setSelectedTime] = useState<string>(''); // HH:MM
    const [existingBookings, setExistingBookings] = useState<SchedulingBooking[]>([]);

    // Form inputs
    const [guestName, setGuestName] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [guestCompany, setGuestCompany] = useState('');
    const [guestCnpj, setGuestCnpj] = useState('');
    const [guestCpf, setGuestCpf] = useState('');
    const [notes, setNotes] = useState('');

    // Calendar view state
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Fetch Event Type details
    useEffect(() => {
        if (!eventTypeId) {
            setLoading(false);
            setError('ID da agenda não informado ou link inválido.');
            return;
        }
        fetchEventDetails();
    }, [eventTypeId]);

    const fetchEventDetails = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchErr } = await supabase
                .from('scheduling_event_types')
                .select('*, profiles(*)')
                .eq('id', eventTypeId)
                .single();

            if (fetchErr || !data) {
                throw new Error('Agenda não encontrada ou inativa.');
            }

            setEventType(data);
            setHostProfile(data.profiles);

            // Auto-focus and auto-select specific date if configured
            if (data.availability?.specific_date) {
                const [year, month, day] = data.availability.specific_date.split('-').map(Number);
                if (!isNaN(year) && !isNaN(month)) {
                    setCurrentMonth(new Date(year, month - 1, 1));
                    const specDate = new Date(year, month - 1, day);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (specDate >= today) {
                        setSelectedDate(data.availability.specific_date);
                        if (data.disable_time_slots) {
                            setSelectedTime('Dia Inteiro');
                        } else {
                            setSelectedTime('');
                        }
                    }
                }
            }
            
            // Buscar todas as reservas ativas para verificar ocupação de horários e limite de capacidade
            const { data: bookingsData } = await supabase
                .from('scheduling_bookings')
                .select('*')
                .eq('event_type_id', eventTypeId)
                .neq('status', 'rejected')
                .neq('status', 'cancelled');

            setExistingBookings((bookingsData || []) as any);
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar detalhes do agendamento.');
        } finally {
            setLoading(false);
        }
    };

    // Calculate dates in month
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysCount = new Date(year, month + 1, 0).getDate();
        
        const days = [];
        // Fill padding days for layout alignment
        for (let i = 0; i < firstDay; i++) {
            days.push(null);
        }
        for (let i = 1; i <= daysCount; i++) {
            days.push(new Date(year, month, i));
        }
        return days;
    };

    const handlePrevMonth = () => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    // Verify if date is selectable
    const isDateAvailable = (date: Date | null) => {
        if (!date || !eventType) return false;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Date must be today or future
        if (date < today) return false;

        // If specific date is set, restrict selectable dates to ONLY that day!
        if (eventType.availability?.specific_date) {
            const dateStr = formatLocalDate(date);
            if (dateStr !== eventType.availability.specific_date) {
                return false;
            }
        } else {
            // Day of week check
            const dayOfWeek = date.getDay(); // 0: Sunday, 1: Monday...
            const allowedDays = eventType.availability?.days || [1, 2, 3, 4, 5];
            if (!allowedDays.includes(dayOfWeek)) return false;
        }

        // If time slots are disabled (full-day rental), check if already booked
        if (eventType.disable_time_slots && !eventType.requirements?.allow_multiple_bookings) {
            const dateStr = formatLocalDate(date);
            const isBooked = existingBookings.some(
                b => b.booking_date === dateStr && b.status !== 'rejected' && b.status !== 'cancelled'
            );
            if (isBooked) return false;
        }

        return true;
    };

    // Generate time slots based on start/end hour and duration, respecting lunch breaks
    const generateTimeSlots = () => {
        if (!eventType || !selectedDate) return [];
        
        const startTime = eventType.availability?.startTime || '09:00';
        const endTime = eventType.availability?.endTime || '18:00';
        const duration = eventType.duration || 30; // minutes

        const slots: string[] = [];
        const periods: { start: string; end: string }[] = [];

        if (eventType.has_lunch_break && eventType.lunch_start_time && eventType.lunch_end_time) {
            periods.push({ start: startTime, end: eventType.lunch_start_time });
            periods.push({ start: eventType.lunch_end_time, end: endTime });
        } else {
            periods.push({ start: startTime, end: endTime });
        }

        for (const period of periods) {
            let [startHours, startMins] = period.start.split(':').map(Number);
            let [endHours, endMins] = period.end.split(':').map(Number);

            if (isNaN(startHours) || isNaN(startMins)) { startHours = 9; startMins = 0; }
            if (isNaN(endHours) || isNaN(endMins)) { endHours = 18; endMins = 0; }

            let currentMins = startHours * 60 + startMins;
            const limitMins = endHours * 60 + endMins;

            while (currentMins + duration <= limitMins) {
                const h = Math.floor(currentMins / 60);
                const m = currentMins % 60;
                const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                
                // Check if slot is already booked on selectedDate
                const isTaken = !eventType.requirements?.allow_multiple_bookings && existingBookings.some(
                    b => b.booking_date === selectedDate && b.booking_time === timeStr && b.status !== 'rejected' && b.status !== 'cancelled'
                );

                if (!isTaken) {
                    slots.push(timeStr);
                }
                
                currentMins += duration;
            }
        }

        return slots;
    };

    const handleDateSelect = (date: Date) => {
        const dateStr = formatLocalDate(date);
        setSelectedDate(dateStr);
        if (eventType?.disable_time_slots) {
            setSelectedTime('Dia Inteiro');
        } else {
            setSelectedTime(''); // Reset time on date change
        }
    };

    const handleSubmitDetails = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validation check for requirements
        if (eventType?.requirements?.phone && !guestPhone.trim()) {
            alert('Por favor, informe um número de telefone.');
            return;
        }
        if (eventType?.requirements?.company_name && !guestCompany.trim()) {
            alert('Por favor, informe o nome da empresa.');
            return;
        }
        if (eventType?.requirements?.cnpj && !guestCnpj.trim()) {
            alert('Por favor, informe o CNPJ.');
            return;
        }
        if (eventType?.requirements?.cpf && !guestCpf.trim()) {
            alert('Por favor, informe o CPF.');
            return;
        }

        if (eventType?.is_paid) {
            setStep('payment');
        } else {
            createBooking('free');
        }
    };

    const createBooking = async (paymentStatus: 'free' | 'paid' | 'pending') => {
        if (!eventType) return;
        setLoading(true);
        try {
            // Verificar limite de capacidade atualizado antes de confirmar
            if (eventType.has_capacity_limit) {
                const { data: latestBookings, error: countErr } = await supabase
                    .from('scheduling_bookings')
                    .select('id')
                    .eq('event_type_id', eventType.id)
                    .neq('status', 'rejected')
                    .neq('status', 'cancelled');
                
                if (countErr) throw countErr;
                
                const currentCount = latestBookings?.length || 0;
                if (currentCount >= eventType.capacity_limit) {
                    alert('Desculpe, todas as vagas para esta agenda foram preenchidas recentemente. Não é possível realizar mais reservas.');
                    setStep('datetime');
                    fetchEventDetails();
                    return;
                }
            }

            const payload = {
                company_id: eventType.company_id,
                event_type_id: eventType.id,
                host_id: eventType.owner_id,
                guest_name: guestName,
                guest_email: guestEmail.trim().toLowerCase(),
                guest_phone: guestPhone,
                guest_company_name: guestCompany || null,
                guest_cnpj: guestCnpj || null,
                guest_cpf: guestCpf || null,
                booking_date: selectedDate,
                booking_time: selectedTime,
                status: 'pending', // host needs to confirm
                payment_status: paymentStatus,
                price: eventType.is_paid ? eventType.price : 0,
                notes: notes || null
            };

            const { error: insertErr } = await supabase
                .from('scheduling_bookings')
                .insert(payload);

            if (insertErr) throw insertErr;

            // Enviar notificação para o anfitrião no banco (fire-and-forget, não bloqueia)
            supabase.from('notifications').insert({
                user_id: eventType.owner_id,
                company_id: eventType.company_id,
                type: 'event',
                title: 'Nova Reserva Pendente',
                description: `${guestName} solicitou reserva para ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR')}${selectedTime !== 'Dia Inteiro' ? ' às ' + selectedTime : ' (Dia Inteiro)'}.`,
                isRead: false,
                link: '/scheduling'
            }).then(); // fire-and-forget

            setStep('success');
        } catch (err: any) {
            alert('Erro ao realizar reserva: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading && step === 'datetime') {
        return (
            <div className="flex justify-center items-center py-20 bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-4xl w-full shadow-2xl border border-slate-100 dark:border-slate-800">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary mx-auto mb-4"></div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Carregando detalhes do agendamento...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-800 text-center space-y-4">
                <div className="w-16 h-16 bg-red-50 dark:bg-red-950/20 rounded-full flex items-center justify-center mx-auto text-red-500">
                    <ExclamationTriangleIcon className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Ops! Link Inválido</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">{error}</p>
            </div>
        );
    }

    if (!eventType) return null;

    const days = getDaysInMonth(currentMonth);
    const monthsNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const totalBookingsCount = existingBookings.filter(
        b => b.status !== 'rejected' && b.status !== 'cancelled'
    ).length;
    const spotsLeft = eventType.has_capacity_limit ? Math.max(0, eventType.capacity_limit - totalBookingsCount) : 999999;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 max-w-4xl w-full overflow-hidden flex flex-col md:flex-row min-h-[600px] animate-in fade-in zoom-in-95 duration-300">
            {/* Left Sidebar: Host & Event Info */}
            <div className="w-full md:w-[320px] bg-slate-50 dark:bg-slate-900/60 p-6 md:p-8 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-850 flex flex-col justify-between">
                <div className="space-y-6">
                    {/* Host Avatar / Logo */}
                    <div className="space-y-3">
                        <div className="w-14 h-14 bg-gradient-to-tr from-brand-primary to-emerald-400 rounded-2xl flex items-center justify-center text-white font-extrabold text-lg shadow-lg shadow-brand-primary/20">
                            {hostProfile?.full_name ? hostProfile.full_name.substring(0, 2).toUpperCase() : 'PM'}
                        </div>
                        <div>
                            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Agendar com</div>
                            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                                {hostProfile?.full_name || 'Anfitrião'}
                            </h3>
                        </div>
                    </div>

                    {/* Event Photos Carousel */}
                    {eventType.photos && eventType.photos.length > 0 && (
                        <div className="relative h-44 w-full rounded-2xl overflow-hidden border border-slate-205 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 shadow-inner group">
                            <img 
                                src={eventType.photos[activePhotoIndex]} 
                                alt={eventType.name}
                                className="w-full h-full object-cover transition-all duration-300"
                            />
                            {eventType.photos.length > 1 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setActivePhotoIndex(prev => (prev - 1 + eventType.photos!.length) % eventType.photos!.length)}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/45 hover:bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs transition-colors"
                                    >
                                        ‹
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActivePhotoIndex(prev => (prev + 1) % eventType.photos!.length)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/45 hover:bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs transition-colors"
                                    >
                                        ›
                                    </button>
                                    <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1">
                                        {eventType.photos.map((_, idx) => (
                                            <span 
                                                key={idx}
                                                className={`w-1 h-1 rounded-full transition-all ${idx === activePhotoIndex ? 'bg-white w-2' : 'bg-white/50'}`}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Event Type Meta */}
                    <div className="space-y-2">
                        <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                            {eventType.name}
                        </h2>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <ClockIcon className="w-4 h-4 text-brand-primary" />
                            <span>
                                {eventType.duration} {
                                    eventType.duration_unit === 'days' 
                                        ? (eventType.duration === 1 ? 'dia' : 'dias') 
                                        : eventType.duration_unit === 'hours' 
                                            ? (eventType.duration === 1 ? 'hora' : 'horas') 
                                            : (eventType.duration === 1 ? 'minuto' : 'minutos')
                                }
                            </span>
                        </div>
                        {eventType.is_paid && (
                            <div className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/40 rounded-lg px-2.5 py-1 text-xs font-black">
                                <CurrencyDollarIcon className="w-3.5 h-3.5" />
                                R$ {eventType.price.toFixed(2)}
                            </div>
                        )}
                        {eventType.has_capacity_limit && eventType.show_capacity_to_guest && (
                            <div className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-350 bg-brand-primary/5 border border-brand-primary/10 rounded-xl p-2.5 flex items-center justify-between">
                                <span>Vagas restantes:</span>
                                <span className="text-brand-primary font-black">{spotsLeft} / {eventType.capacity_limit}</span>
                            </div>
                        )}
                        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed pt-2">
                            {eventType.description || 'Sem descrição adicional.'}
                        </p>
                    </div>
                </div>

                {/* Footer brand */}
                <div className="text-[10px] text-slate-400 dark:text-slate-600 mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1">
                    <SparklesIcon className="w-3 h-3 text-brand-primary" />
                    Powered by <span className="font-bold text-slate-500 dark:text-slate-400">PandaMail Schedules</span>
                </div>
            </div>

            {/* Right: Flow Screens */}
            <div className="flex-1 p-6 md:p-8 flex flex-col justify-between bg-white dark:bg-slate-900">
                {/* Step 1: Select Date & Time */}
                {step === 'datetime' && (
                    eventType.has_capacity_limit && spotsLeft <= 0 ? (
                        <div className="flex-1 flex flex-col justify-center items-center text-center p-8 bg-slate-50 dark:bg-slate-950/20 border border-dashed rounded-3xl border-slate-200 dark:border-slate-800 my-auto min-h-[400px]">
                            <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/20 rounded-full flex items-center justify-center text-amber-500 mb-4 animate-pulse">
                                <ExclamationTriangleIcon className="w-8 h-8" />
                            </div>
                            <h3 className="font-extrabold text-slate-900 dark:text-white text-lg">Sem Vagas Disponíveis</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mt-2 font-medium">
                                Esta agenda atingiu o limite máximo de participantes e não está aceitando novas reservas no momento.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6 flex-1 flex flex-col">
                            <div className="flex items-center justify-between">
                            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Selecione Data e Horário</h3>
                            <div className="flex gap-1">
                                <button onClick={handlePrevMonth} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400">
                                    <ArrowLeftIcon className="w-4 h-4" />
                                </button>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 self-center px-2">
                                    {monthsNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                                </span>
                                <button onClick={handleNextMonth} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400">
                                    <ArrowLeftIcon className="w-4 h-4 rotate-180" />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
                            {/* Calendar Grid */}
                            <div className="space-y-2">
                                <div className="grid grid-cols-7 text-center text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                                    <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span>
                                </div>
                                <div className="grid grid-cols-7 gap-1 text-sm text-center">
                                    {days.map((day, idx) => {
                                        if (!day) return <div key={`empty-${idx}`} />;
                                        const isAvailable = isDateAvailable(day);
                                        const isSelected = selectedDate === formatLocalDate(day);
                                        return (
                                            <button
                                                key={`day-${idx}`}
                                                disabled={!isAvailable}
                                                onClick={() => handleDateSelect(day)}
                                                className={`aspect-square flex items-center justify-center rounded-xl font-bold transition-all relative ${
                                                    isSelected 
                                                        ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20 scale-[1.05]'
                                                        : isAvailable
                                                            ? 'text-slate-800 dark:text-slate-200 bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800'
                                                            : 'text-slate-300 dark:text-slate-700 cursor-not-allowed text-xs'
                                                }`}
                                            >
                                                {day.getDate()}
                                                {isAvailable && !isSelected && (
                                                    <span className="absolute bottom-1 w-1 h-1 bg-brand-primary rounded-full" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Time Slots Column */}
                            <div className="border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-850 lg:pl-6 pt-4 lg:pt-0 flex flex-col justify-center">
                                {eventType.disable_time_slots ? (
                                    <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800 rounded-2xl p-5 text-center space-y-4 my-auto">
                                        <CalendarIcon className="w-10 h-10 text-brand-primary mx-auto" />
                                        <div>
                                            <h4 className="font-extrabold text-slate-800 dark:text-white text-sm">Reserva por Dia Inteiro</h4>
                                            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Este aluguel/reserva é feito por dia inteiro. Não é necessária a seleção de horários específicos.</p>
                                        </div>
                                        {selectedDate && (
                                            <div className="bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-xs font-bold py-2 px-4 rounded-xl inline-block">
                                                Data Selecionada: {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                                            {selectedDate ? `Horários para ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR')}` : 'Selecione uma data'}
                                        </h4>
                                        {selectedDate ? (
                                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                                {generateTimeSlots().length === 0 ? (
                                                    <p className="text-slate-400 text-xs py-8 text-center">Nenhum horário livre nesta data.</p>
                                                ) : (
                                                    generateTimeSlots().map(time => (
                                                        <button
                                                            key={time}
                                                            onClick={() => setSelectedTime(time)}
                                                            className={`w-full py-2.5 rounded-xl border text-sm font-bold transition-all ${
                                                                selectedTime === time
                                                                    ? 'bg-brand-primary border-brand-primary text-white shadow-md shadow-brand-primary/10'
                                                                    : 'border-slate-200 dark:border-slate-800 hover:border-brand-primary text-slate-800 dark:text-slate-200 hover:bg-brand-primary/5'
                                                            }`}
                                                        >
                                                            {time}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex-1 flex items-center justify-center py-10 bg-slate-50 dark:bg-slate-950/20 border border-dashed rounded-2xl border-slate-200 dark:border-slate-850">
                                                <p className="text-slate-400 text-xs text-center px-4">Selecione uma data no calendário para ver a disponibilidade de horários.</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Next step trigger */}
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-850 flex justify-end">
                            <button
                                disabled={!selectedDate || !selectedTime}
                                onClick={() => setStep('form')}
                                className="bg-brand-primary hover:bg-emerald-600 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all shadow-md shadow-brand-primary/10"
                            >
                                Avançar
                            </button>
                        </div>
                    </div>
                    )
                )}

                {/* Step 2: Guest Details Form */}
                {step === 'form' && (
                    <div className="space-y-6 flex-1 flex flex-col justify-between">
                        <div>
                            <button onClick={() => setStep('datetime')} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 mb-4 font-bold">
                                <ArrowLeftIcon className="w-3.5 h-3.5" />
                                Voltar para Data e Horário
                            </button>
                            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Insira seus Dados de Contato</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Preencha as informações obrigatórias para prosseguir com a reserva.</p>
                        </div>

                        <form onSubmit={handleSubmitDetails} className="space-y-4 py-4 flex-1 overflow-y-auto">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Seu Nome *</label>
                                    <input 
                                        type="text" required
                                        value={guestName} onChange={e => setGuestName(e.target.value)}
                                        placeholder="Ex: João da Silva"
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Seu E-mail *</label>
                                    <input 
                                        type="email" required
                                        value={guestEmail} onChange={e => setGuestEmail(e.target.value)}
                                        placeholder="Ex: joao@email.com"
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {eventType.requirements?.phone && (
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Celular / Telefone *</label>
                                        <input 
                                            type="tel" required
                                            value={guestPhone} onChange={e => setGuestPhone(e.target.value)}
                                            placeholder="Ex: (11) 99999-9999"
                                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary"
                                        />
                                    </div>
                                )}
                                {eventType.requirements?.company_name && (
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Nome da Empresa *</label>
                                        <input 
                                            type="text" required
                                            value={guestCompany} onChange={e => setGuestCompany(e.target.value)}
                                            placeholder="Ex: Minha Empresa LTDA"
                                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {eventType.requirements?.cnpj && (
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">CNPJ da Empresa *</label>
                                        <input 
                                            type="text" required
                                            value={guestCnpj} onChange={e => setGuestCnpj(e.target.value)}
                                            placeholder="Ex: 00.000.000/0001-00"
                                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary"
                                        />
                                    </div>
                                )}
                                {eventType.requirements?.cpf && (
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">CPF *</label>
                                        <input 
                                            type="text" required
                                            value={guestCpf} onChange={e => setGuestCpf(e.target.value)}
                                            placeholder="Ex: 000.000.000-00"
                                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Notas / Detalhes adicionais</label>
                                <textarea 
                                    value={notes} onChange={e => setNotes(e.target.value)}
                                    placeholder="Caso queira informar algum detalhe importante para o anfitrião."
                                    rows={3}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary"
                                />
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-slate-850 flex justify-end">
                                <button
                                    type="submit"
                                    className="bg-brand-primary hover:bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all shadow-md shadow-brand-primary/10"
                                >
                                    {eventType.is_paid ? 'Seguir para Pagamento' : 'Confirmar Reserva'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Step 3: Payment Simulation (Only for Paid Events) */}
                {step === 'payment' && (
                    <div className="space-y-6 flex-1 flex flex-col justify-between">
                        <div>
                            <button onClick={() => setStep('form')} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 mb-4 font-bold">
                                <ArrowLeftIcon className="w-3.5 h-3.5" />
                                Voltar para Detalhes
                            </button>
                            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Efetuar Pagamento de Reserva</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Este evento exige um pagamento profissional para reservar a agenda.</p>
                        </div>

                        <div className="my-auto py-6 space-y-6">
                            {/* Pix simulated QR Code */}
                            <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 p-5 flex flex-col items-center text-center space-y-4">
                                <div className="font-black text-slate-900 dark:text-white text-lg">
                                    Total: R$ {eventType.price.toFixed(2)}
                                </div>
                                <div className="w-40 h-40 bg-white border border-slate-200 rounded-xl flex items-center justify-center p-2">
                                    {/* Mock QR Code image */}
                                    <svg className="w-full h-full text-slate-800" viewBox="0 0 100 100" fill="currentColor">
                                        <path d="M5 5h30v30H5V5zm35 0h20v20H40V5zm25 0h30v30H65V5zM5 40h20v20H5V40zm25 0h20v20H30V40zm25 0h15v15H55V40zm20 0h20v20H75V40zm-45 25h20v20H30V65zm25 0h15v15H55V65zm20 0h20v20H75V65zm-70 10h20v15H5v-15z" />
                                        <rect x="12" y="12" width="16" height="16" />
                                        <rect x="72" y="12" width="16" height="16" />
                                        <rect x="12" y="72" width="16" height="16" />
                                    </svg>
                                </div>
                                <div className="w-full space-y-1">
                                    <div className="text-[10px] font-bold text-slate-500 uppercase">Pix Copia e Cola</div>
                                    <input 
                                        type="text" readOnly
                                        value="00020101021226840014br.gov.bcb.pix25620021pandonet-schedules-key-928"
                                        className="w-full bg-white dark:bg-slate-900 border text-center rounded-lg px-3 py-1.5 text-xs focus:outline-none select-all"
                                    />
                                    <div className="text-[9px] text-slate-400">Escaneie o QR Code ou copie o código Pix acima para realizar o pagamento simulado.</div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-850 flex justify-end gap-2">
                            <button
                                onClick={() => createBooking('pending')} // Salva como pagamento pendente
                                className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-750 dark:text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition-all border"
                            >
                                Pagar Depois
                            </button>
                            <button
                                onClick={() => createBooking('paid')} // Salva como pago
                                className="bg-brand-primary hover:bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-all shadow-md shadow-brand-primary/10 flex items-center gap-1.5"
                            >
                                <CheckIcon className="w-4 h-4" />
                                Confirmei o Pagamento
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 4: Success Confirmation */}
                {step === 'success' && (
                    <div className="space-y-6 flex-1 flex flex-col justify-center items-center text-center py-10 animate-in zoom-in-95 duration-500">
                        <div className="w-16 h-16 bg-green-50 dark:bg-green-950/20 rounded-full flex items-center justify-center text-green-500 shadow-lg shadow-green-500/10">
                            <CheckIcon className="w-10 h-10" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-extrabold text-slate-900 dark:text-white text-2xl tracking-tight">Solicitação Enviada!</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto">
                                Sua reserva foi registrada. O anfitrião <span className="font-bold">{hostProfile?.full_name}</span> foi notificado e revisará os detalhes.
                            </p>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-2xl p-5 text-sm space-y-3 w-full max-w-sm text-left">
                            <div className="font-extrabold text-slate-800 dark:text-slate-200 border-b pb-2 mb-2 border-slate-200/50 dark:border-slate-800">Detalhes do Agendamento:</div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400 text-xs">Agenda:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{eventType.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400 text-xs">Data:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400 text-xs">Horário:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{selectedTime}</span>
                            </div>
                            {eventType.is_paid && (
                                <div className="flex justify-between border-t pt-2 border-dashed border-slate-200 dark:border-slate-800">
                                    <span className="text-slate-500 dark:text-slate-400 text-xs">Preço Pago:</span>
                                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-xs">R$ {eventType.price.toFixed(2)}</span>
                                </div>
                            )}
                        </div>

                        <p className="text-[10px] text-slate-400">Você receberá uma confirmação no seu e-mail ({guestEmail}) em breve.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SchedulingBookPage;
