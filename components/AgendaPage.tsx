import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { 
    UsersIcon, 
    CalendarIcon, 
    ClockIcon, 
    SparklesIcon,
    PlusIcon,
    CheckIcon,
    XMarkIcon,
    DocumentTextIcon,
    MapPinIcon,
    VideoCameraIcon,
    PencilIcon,
    TrashIcon
} from './icons';

interface Visit {
    id: string;
    company_id: string;
    user_id: string;
    visitor_name: string;
    client_name: string;
    description: string;
    visit_date: string;
    visit_time: string;
    duration: string;
    considerations: string | null;
    status: 'pending' | 'completed' | 'problem';
    needs_return: boolean;
    created_at?: string;
    profiles?: {
        full_name?: string;
    };
}

interface EventItem {
    id: string;
    company_id: string;
    creator_id: string;
    title: string;
    description: string;
    date: string;
    start_time: string;
    end_time: string;
    location: string;
    type: string;
    category: string;
    is_private: boolean;
    created_at?: string;
    profiles?: {
        full_name?: string;
    };
}

interface AgendaPageProps {
    initialTab?: 'visits' | 'meetings' | 'trainings';
    initialDate?: string;
}

const AgendaPage: React.FC<AgendaPageProps> = ({ initialTab, initialDate }) => {
    const { currentUser } = useAuth();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'visits' | 'meetings' | 'trainings'>(initialTab || 'visits');

    const isCompanyAdmin = currentUser?.isAdmin || currentUser?.isCompanyAdmin || currentUser?.role === 'Super Admin' || currentUser?.role === 'Admin';

    // Helper to calculate default date (today) and time (1 hour from now)
    const getInitialDateTime = () => {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-CA'); // Format YYYY-MM-DD
        const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
        const timeStr = `${String(nextHour.getHours()).padStart(2, '0')}:${String(nextHour.getMinutes()).padStart(2, '0')}`;
        return { date: dateStr, time: timeStr };
    };

    const initDT = getInitialDateTime();

    // Loading & Lists
    const [visits, setVisits] = useState<Visit[]>([]);
    const [meetings, setMeetings] = useState<EventItem[]>([]);
    const [trainings, setTrainings] = useState<EventItem[]>([]);
    
    const [loadingVisits, setLoadingVisits] = useState(false);
    const [loadingMeetings, setLoadingMeetings] = useState(false);
    const [loadingTrainings, setLoadingTrainings] = useState(false);
    
    const [submitting, setSubmitting] = useState(false);
    const [showConsiderationsModal, setShowConsiderationsModal] = useState<Visit | null>(null);
    const [showHistoryModal, setShowHistoryModal] = useState<'visits' | 'meetings' | 'trainings' | null>(null);

    // Edit states
    const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
    const [editingMeeting, setEditingMeeting] = useState<EventItem | null>(null);
    const [editingTraining, setEditingTraining] = useState<EventItem | null>(null);

    // Visit Form States
    const [visitorName, setVisitorName] = useState(currentUser?.full_name || currentUser?.name || '');
    const [clientName, setClientName] = useState('');
    const [visitDescription, setVisitDescription] = useState('');
    const [visitDate, setVisitDate] = useState(initialDate || initDT.date);
    const [visitTime, setVisitTime] = useState(initDT.time);
    const [visitDuration, setVisitDuration] = useState('1 hora');

    // Considerations Form States
    const [considerations, setConsiderations] = useState('');
    const [visitStatus, setVisitStatus] = useState<'completed' | 'problem'>('completed');
    const [needsReturn, setNeedsReturn] = useState(false);

    // Meeting Form States
    const [meetingTitle, setMeetingTitle] = useState('');
    const [meetingDate, setMeetingDate] = useState(initialDate || initDT.date);
    const [meetingTime, setMeetingTime] = useState(initDT.time);
    const [meetingDuration, setMeetingDuration] = useState('1 hora');
    const [meetingLocation, setMeetingLocation] = useState('');
    const [meetingNotes, setMeetingNotes] = useState('');
    const [meetingIsPrivate, setMeetingIsPrivate] = useState(false);

    // Training Form States
    const [trainingTitle, setTrainingTitle] = useState('');
    const [trainingDate, setTrainingDate] = useState(initialDate || initDT.date);
    const [trainingTime, setTrainingTime] = useState(initDT.time);
    const [trainingDuration, setTrainingDuration] = useState('2 horas');
    const [trainingType, setTrainingType] = useState('online');
    const [customTrainingTypes, setCustomTrainingTypes] = useState<string[]>(() => {
        const saved = localStorage.getItem('pandanet_custom_training_types');
        return saved ? JSON.parse(saved) : ['online', 'presencial', 'híbrido'];
    });
    const [newTrainingType, setNewTrainingType] = useState('');
    const [showAddTypeInput, setShowAddTypeInput] = useState(false);
    const [trainingNotes, setTrainingNotes] = useState('');

    useEffect(() => {
        if (currentUser?.company_id) {
            if (activeTab === 'visits') fetchVisits();
            if (activeTab === 'meetings') fetchMeetings();
            if (activeTab === 'trainings') fetchTrainings();
        }
    }, [currentUser, activeTab]);

    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);

    // Apply initialDate change
    useEffect(() => {
        if (initialDate) {
            setVisitDate(initialDate);
            setMeetingDate(initialDate);
            setTrainingDate(initialDate);
        }
    }, [initialDate]);

    const fetchVisits = async () => {
        setLoadingVisits(true);
        try {
            const { data, error } = await supabase
                .from('agenda_visits')
                .select('*, profiles:profiles!user_id(full_name)')
                .eq('company_id', currentUser.company_id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setVisits(data || []);
        } catch (err: any) {
            console.error('Erro ao buscar visitas:', err);
        } finally {
            setLoadingVisits(false);
        }
    };

    const fetchMeetings = async () => {
        setLoadingMeetings(true);
        try {
            const { data, error } = await supabase
                .from('events')
                .select('*, profiles:profiles!creator_id(full_name)')
                .eq('company_id', currentUser.company_id)
                .eq('category', 'Reunião')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setMeetings(data || []);
        } catch (err: any) {
            console.error('Erro ao buscar reuniões:', err);
        } finally {
            setLoadingMeetings(false);
        }
    };

    const fetchTrainings = async () => {
        setLoadingTrainings(true);
        try {
            const { data, error } = await supabase
                .from('events')
                .select('*, profiles:profiles!creator_id(full_name)')
                .eq('company_id', currentUser.company_id)
                .eq('category', 'Treinamento')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setTrainings(data || []);
        } catch (err: any) {
            console.error('Erro ao buscar treinamentos:', err);
        } finally {
            setLoadingTrainings(false);
        }
    };

    const handleAddTrainingType = () => {
        if (!newTrainingType.trim()) return;
        const normalized = newTrainingType.trim().toLowerCase();
        if (!customTrainingTypes.includes(normalized)) {
            const updated = [...customTrainingTypes, normalized];
            setCustomTrainingTypes(updated);
            localStorage.setItem('pandanet_custom_training_types', JSON.stringify(updated));
            setTrainingType(normalized);
        }
        setNewTrainingType('');
        setShowAddTypeInput(false);
    };

    // Calculate dynamic end time helper
    const calculateEndTime = (dateStr: string, timeStr: string, durationStr: string) => {
        const hourParts = timeStr.split(':');
        const startHour = Number(hourParts[0]);
        const startMinutes = Number(hourParts[1] || 0);
        
        let addedHours = 1;
        if (durationStr.toLowerCase().includes('hora')) {
            const num = parseInt(durationStr);
            if (!isNaN(num)) addedHours = num;
        } else if (durationStr.toLowerCase().includes('minuto')) {
            const num = parseInt(durationStr);
            const totalMinutes = startMinutes + (isNaN(num) ? 30 : num);
            const endHour = (startHour + Math.floor(totalMinutes / 60)) % 24;
            const endMin = totalMinutes % 60;
            const endTimeStr = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
            return new Date(`${dateStr}T${endTimeStr}:00Z`).toISOString();
        }
        
        const endHour = (startHour + addedHours) % 24;
        const endTimeStr = `${String(endHour).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}`;
        return new Date(`${dateStr}T${endTimeStr}:00Z`).toISOString();
    };

    // Cancel edit helpers
    const cancelEditVisit = () => {
        setEditingVisit(null);
        setVisitorName(currentUser?.full_name || currentUser?.name || '');
        setClientName('');
        setVisitDescription('');
        setVisitDate(initDT.date);
        setVisitTime(initDT.time);
        setVisitDuration('1 hora');
    };

    const cancelEditMeeting = () => {
        setEditingMeeting(null);
        setMeetingTitle('');
        setMeetingDate(initDT.date);
        setMeetingTime(initDT.time);
        setMeetingDuration('1 hora');
        setMeetingLocation('');
        setMeetingNotes('');
        setMeetingIsPrivate(false);
    };

    const cancelEditTraining = () => {
        setEditingTraining(null);
        setTrainingTitle('');
        setTrainingDate(initDT.date);
        setTrainingTime(initDT.time);
        setTrainingDuration('2 horas');
        setTrainingType('online');
        setTrainingNotes('');
    };

    // Save Visit (Create or Edit)
    const handleSaveVisit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const visitPayload = {
                company_id: currentUser.company_id,
                user_id: currentUser.id,
                visitor_name: visitorName,
                client_name: clientName,
                description: visitDescription,
                visit_date: visitDate,
                visit_time: visitTime,
                duration: visitDuration,
            };

            let visitId = editingVisit?.id;

            if (editingVisit) {
                // Update
                const { error: vError } = await supabase
                    .from('agenda_visits')
                    .update(visitPayload)
                    .eq('id', editingVisit.id);

                if (vError) throw vError;
            } else {
                // Insert
                const { data: vData, error: vError } = await supabase
                    .from('agenda_visits')
                    .insert({ ...visitPayload, status: 'pending', needs_return: false })
                    .select()
                    .single();

                if (vError) throw vError;
                visitId = vData.id;
            }

            // Sync with events
            const combinedStartTime = new Date(`${visitDate}T${visitTime}:00Z`).toISOString();
            const combinedEndTime = calculateEndTime(visitDate, visitTime, visitDuration);

            const eventPayload = {
                company_id: currentUser.company_id,
                creator_id: currentUser.id,
                title: `Visita: ${visitorName} em ${clientName}`,
                description: `${visitDescription || 'Visita comercial agendada.'}\n\nVisitante: ${visitorName}\nCliente: ${clientName}\n\n[VisitID: ${visitId}]`,
                date: visitDate,
                start_time: combinedStartTime,
                end_time: combinedEndTime,
                category: 'Visita',
                location: clientName,
                is_private: false
            };

            if (editingVisit) {
                // Find corresponding event
                const { data: existingEvents } = await supabase
                    .from('events')
                    .select('id')
                    .eq('company_id', currentUser.company_id)
                    .like('description', `%[VisitID: ${editingVisit.id}]%`);

                if (existingEvents && existingEvents.length > 0) {
                    await supabase.from('events').update(eventPayload).eq('id', existingEvents[0].id);
                } else {
                    // Try fallback search by older title format
                    const { data: legacyEvents } = await supabase
                        .from('events')
                        .select('id')
                        .eq('company_id', currentUser.company_id)
                        .eq('category', 'Visita')
                        .eq('date', editingVisit.visit_date)
                        .eq('location', editingVisit.client_name);

                    if (legacyEvents && legacyEvents.length > 0) {
                        await supabase.from('events').update(eventPayload).eq('id', legacyEvents[0].id);
                    } else {
                        // Create a new event if missing
                        await supabase.from('events').insert(eventPayload);
                    }
                }
                showToast('Visita atualizada com sucesso!', 'success');
                cancelEditVisit();
            } else {
                // Create new event
                await supabase.from('events').insert(eventPayload);
                showToast('Visita agendada com sucesso!', 'success');
                setClientName('');
                setVisitDescription('');
            }

            fetchVisits();
        } catch (err: any) {
            console.error('Erro ao salvar visita:', err);
            showToast('Erro ao salvar visita: ' + err.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // Delete Visit
    const handleDeleteVisit = async (visit: Visit) => {
        if (!window.confirm('Tem certeza que deseja excluir esta visita e seu evento no calendário?')) return;
        try {
            // Delete from agenda_visits
            const { error: vError } = await supabase
                .from('agenda_visits')
                .delete()
                .eq('id', visit.id);
            if (vError) throw vError;

            // Delete corresponding event
            const { data: existingEvents } = await supabase
                .from('events')
                .select('id')
                .eq('company_id', currentUser.company_id)
                .like('description', `%[VisitID: ${visit.id}]%`);

            if (existingEvents && existingEvents.length > 0) {
                await supabase.from('events').delete().eq('id', existingEvents[0].id);
            } else {
                // Fallback delete
                await supabase
                    .from('events')
                    .delete()
                    .eq('company_id', currentUser.company_id)
                    .eq('category', 'Visita')
                    .eq('date', visit.visit_date)
                    .eq('location', visit.client_name);
            }

            showToast('Visita excluída com sucesso!', 'success');
            fetchVisits();
        } catch (err: any) {
            console.error('Erro ao excluir visita:', err);
            showToast('Erro ao excluir visita: ' + err.message, 'error');
        }
    };

    // Save Considerations
    const handleSaveConsiderations = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!showConsiderationsModal) return;
        setSubmitting(true);

        try {
            const { error } = await supabase
                .from('agenda_visits')
                .update({
                    considerations,
                    status: visitStatus,
                    needs_return: needsReturn
                })
                .eq('id', showConsiderationsModal.id);

            if (error) throw error;

            showToast('Considerações registradas com sucesso!', 'success');
            setShowConsiderationsModal(null);
            setConsiderations('');
            setNeedsReturn(false);
            fetchVisits();
        } catch (err: any) {
            console.error('Erro ao registrar considerações:', err);
            showToast('Erro ao registrar considerações: ' + err.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // Save Meeting (Create or Edit)
    const handleSaveMeeting = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const combinedStartTime = new Date(`${meetingDate}T${meetingTime}:00Z`).toISOString();
            const combinedEndTime = calculateEndTime(meetingDate, meetingTime, meetingDuration);

            const eventPayload = {
                company_id: currentUser.company_id,
                creator_id: currentUser.id,
                title: meetingTitle,
                description: meetingNotes || 'Reunião comercial.',
                date: meetingDate,
                start_time: combinedStartTime,
                end_time: combinedEndTime,
                category: 'Reunião',
                location: meetingLocation || 'Sala Virtual / Presencial',
                is_private: meetingIsPrivate
            };

            if (editingMeeting) {
                const { error } = await supabase
                    .from('events')
                    .update(eventPayload)
                    .eq('id', editingMeeting.id);
                if (error) throw error;
                showToast('Reunião atualizada com sucesso!', 'success');
                cancelEditMeeting();
            } else {
                const { error } = await supabase
                    .from('events')
                    .insert(eventPayload);
                if (error) throw error;
                showToast('Reunião agendada com sucesso!', 'success');
                setMeetingTitle('');
                setMeetingLocation('');
                setMeetingNotes('');
                setMeetingIsPrivate(false);
            }

            fetchMeetings();
        } catch (err: any) {
            console.error('Erro ao salvar reunião:', err);
            showToast('Erro ao salvar reunião: ' + err.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // Delete Event (Meeting or Training)
    const handleDeleteEvent = async (event: EventItem) => {
        if (!window.confirm(`Tem certeza que deseja excluir esta agenda de ${event.category.toLowerCase()}?`)) return;
        try {
            const { error } = await supabase
                .from('events')
                .delete()
                .eq('id', event.id);
            if (error) throw error;

            showToast(`${event.category} excluído com sucesso!`, 'success');
            if (event.category === 'Reunião') fetchMeetings();
            else fetchTrainings();
        } catch (err: any) {
            console.error('Erro ao excluir agenda:', err);
            showToast('Erro ao excluir agenda: ' + err.message, 'error');
        }
    };

    // Save Training (Create or Edit)
    const handleSaveTraining = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const combinedStartTime = new Date(`${trainingDate}T${trainingTime}:00Z`).toISOString();
            const combinedEndTime = calculateEndTime(trainingDate, trainingTime, trainingDuration);

            const eventPayload = {
                company_id: currentUser.company_id,
                creator_id: currentUser.id,
                title: `Treinamento: ${trainingTitle}`,
                description: `Tipo: ${trainingType.toUpperCase()}.\nObservações: ${trainingNotes || 'Nenhuma'}`,
                date: trainingDate,
                start_time: combinedStartTime,
                end_time: combinedEndTime,
                category: 'Treinamento',
                location: trainingType === 'online' ? 'Plataforma Online' : 'Auditório da Empresa',
                is_private: false
            };

            if (editingTraining) {
                const { error } = await supabase
                    .from('events')
                    .update(eventPayload)
                    .eq('id', editingTraining.id);
                if (error) throw error;
                showToast('Treinamento atualizado com sucesso!', 'success');
                cancelEditTraining();
            } else {
                const { error } = await supabase
                    .from('events')
                    .insert(eventPayload);
                if (error) throw error;
                showToast('Treinamento agendado com sucesso!', 'success');
                setTrainingTitle('');
                setTrainingNotes('');
            }

            fetchTrainings();
        } catch (err: any) {
            console.error('Erro ao salvar treinamento:', err);
            showToast('Erro ao salvar treinamento: ' + err.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // Edit button click handlers
    const startEditVisit = (visit: Visit) => {
        setEditingVisit(visit);
        setVisitorName(visit.visitor_name);
        setClientName(visit.client_name);
        setVisitDescription(visit.description);
        setVisitDate(visit.visit_date);
        setVisitTime(visit.visit_time);
        setVisitDuration(visit.duration);
        setShowHistoryModal(null);
    };

    const startEditMeeting = (meeting: EventItem) => {
        setEditingMeeting(meeting);
        setMeetingTitle(meeting.title);
        setMeetingDate(meeting.date);
        const timeStr = meeting.start_time.split('T')[1]?.substring(0, 5) || '10:00';
        setMeetingTime(timeStr);
        
        const diffMs = new Date(meeting.end_time).getTime() - new Date(meeting.start_time).getTime();
        const diffHours = Math.round(diffMs / (60 * 60 * 1000));
        setMeetingDuration(`${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`);
        
        setMeetingLocation(meeting.location);
        setMeetingNotes(meeting.description);
        setMeetingIsPrivate(meeting.is_private);
        setShowHistoryModal(null);
    };

    const startEditTraining = (training: EventItem) => {
        setEditingTraining(training);
        // Remove prefix "Treinamento: " from title
        setTrainingTitle(training.title.replace(/^Treinamento:\s*/, ''));
        setTrainingDate(training.date);
        const timeStr = training.start_time.split('T')[1]?.substring(0, 5) || '14:00';
        setTrainingTime(timeStr);
        
        const diffMs = new Date(training.end_time).getTime() - new Date(training.start_time).getTime();
        const diffHours = Math.round(diffMs / (60 * 60 * 1000));
        setTrainingDuration(`${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`);
        
        // Parse type and notes from description
        const desc = training.description || '';
        const typeMatch = desc.match(/^Tipo:\s*([^\.]+)/i);
        const notesMatch = desc.match(/Observações:\s*(.*)/is);
        
        setTrainingType(typeMatch ? typeMatch[1].toLowerCase() : 'online');
        setTrainingNotes(notesMatch ? notesMatch[1] : desc);
        setShowHistoryModal(null);
    };

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 text-slate-800 dark:text-white">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
                        <CalendarIcon className="w-8 h-8 text-brand-primary" />
                        Agenda
                        <span className="text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 font-bold px-2.5 py-1 rounded-full border border-yellow-500/20 flex items-center gap-1">
                            <SparklesIcon className="w-3.5 h-3.5" />
                            Comercial & Eventos
                        </span>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-sm">
                        Agende visitas comerciais, reuniões com clientes e treinamentos para sua equipe.
                    </p>
                </div>
            </div>

            {/* CONTEÚDO DA ABA: VISITAS */}
            {activeTab === 'visits' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Formulário de Visita */}
                    <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-6 rounded-3xl shadow-xl h-fit">
                        <h3 className="text-base font-extrabold flex items-center justify-between border-b dark:border-slate-800 pb-3 mb-4">
                            <span className="flex items-center gap-2">
                                <PlusIcon className="w-5 h-5 text-brand-primary" />
                                {editingVisit ? 'Editar Visita' : 'Agendar Nova Visita'}
                            </span>
                            {editingVisit && (
                                <button type="button" onClick={cancelEditVisit} className="text-xs text-red-500 font-bold hover:underline">
                                    Cancelar
                                </button>
                            )}
                        </h3>

                        <form onSubmit={handleSaveVisit} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Quem fará a visita? *</label>
                                <input
                                    type="text"
                                    required
                                    value={visitorName}
                                    onChange={(e) => setVisitorName(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Empresa ou Pessoa visitada *</label>
                                <input
                                    type="text"
                                    required
                                    value={clientName}
                                    onChange={(e) => setClientName(e.target.value)}
                                    placeholder="Ex: Coca-Cola Brasil"
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Descrição / Objetivo</label>
                                <textarea
                                    value={visitDescription}
                                    onChange={(e) => setVisitDescription(e.target.value)}
                                    placeholder="Descreva o objetivo da visita..."
                                    rows={3}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Data de Ida *</label>
                                    <input
                                        type="date"
                                        required
                                        value={visitDate}
                                        onChange={(e) => setVisitDate(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Hora da Visita *</label>
                                    <input
                                        type="time"
                                        required
                                        value={visitTime}
                                        onChange={(e) => setVisitTime(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Tempo de Duração *</label>
                                <input
                                    type="text"
                                    required
                                    value={visitDuration}
                                    onChange={(e) => setVisitDuration(e.target.value)}
                                    placeholder="Ex: 1 hora, 30 minutos, dia todo"
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-brand-primary hover:bg-emerald-600 disabled:opacity-55 text-white font-black py-2.5 rounded-xl shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 transition-all"
                            >
                                <CheckIcon className="w-5 h-5" />
                                {submitting ? 'Salvando...' : editingVisit ? 'Salvar Alterações' : 'Agendar Visita'}
                            </button>
                        </form>
                    </div>

                    {/* Lista de Visitas */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black flex items-center gap-2">
                                <DocumentTextIcon className="w-6 h-6 text-brand-primary" />
                                Registro de Visitas Comerciais
                            </h3>
                            <button
                                onClick={() => setShowHistoryModal('visits')}
                                className="text-xs font-bold uppercase tracking-wider text-brand-primary hover:underline"
                            >
                                Ver Histórico Completo
                            </button>
                        </div>

                        {loadingVisits ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                            </div>
                        ) : visits.length === 0 ? (
                            <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-3xl shadow-sm">
                                <UsersIcon className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhuma visita agendada</p>
                                <p className="text-xs text-slate-500 dark:text-gray-400">Preencha o formulário ao lado para agendar a primeira visita.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {visits.slice(0, 5).map(visit => (
                                    <div 
                                        key={visit.id} 
                                        className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all relative flex flex-col justify-between gap-4"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="font-extrabold text-slate-850 dark:text-white text-base">
                                                        {visit.client_name}
                                                    </h4>
                                                    <span className="text-slate-400 text-xs">•</span>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                                        Visitante: <strong className="text-slate-700 dark:text-slate-300">{visit.visitor_name}</strong>
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{visit.description}</p>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full border ${
                                                    visit.status === 'completed' 
                                                        ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-450 dark:border-green-800/30'
                                                        : visit.status === 'problem'
                                                        ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-450 dark:border-red-800/30'
                                                        : 'bg-yellow-50 text-yellow-750 border-yellow-250 dark:bg-yellow-950/10 dark:text-yellow-400 dark:border-yellow-900/30'
                                                }`}>
                                                    {visit.status === 'completed' ? 'Concluída' : visit.status === 'problem' ? 'Com Problema' : 'Pendente'}
                                                </span>

                                                {isCompanyAdmin && (
                                                    <div className="flex gap-1">
                                                        <button 
                                                            onClick={() => startEditVisit(visit)} 
                                                            className="p-1 text-slate-400 hover:text-slate-650 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                                                            title="Editar visita"
                                                        >
                                                            <PencilIcon className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteVisit(visit)} 
                                                            className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded"
                                                            title="Excluir visita"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-950/30 p-3 rounded-2xl text-xs text-slate-500 dark:text-slate-400 border dark:border-slate-850">
                                            <div className="flex items-center gap-1.5">
                                                <CalendarIcon className="w-4 h-4 text-slate-400" />
                                                Data: {new Date(visit.visit_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <ClockIcon className="w-4 h-4 text-slate-400" />
                                                Hora: {visit.visit_time} ({visit.duration})
                                            </div>
                                            {visit.needs_return && (
                                                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-450 font-bold">
                                                    ⚠️ Precisa de Retorno
                                                </div>
                                            )}
                                        </div>

                                        {visit.considerations && (
                                            <div className="p-3 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border dark:border-slate-850 text-xs text-slate-650 dark:text-slate-400 italic">
                                                <strong>Observações do Visitante:</strong> "{visit.considerations}"
                                            </div>
                                        )}

                                        {visit.status === 'pending' && (
                                            <div className="flex justify-end pt-1">
                                                <button
                                                    onClick={() => setShowConsiderationsModal(visit)}
                                                    className="bg-brand-primary hover:bg-emerald-600 text-white font-extrabold text-[10px] px-3.5 py-1.5 rounded-xl shadow-md shadow-brand-primary/10 transition-all flex items-center gap-1 hover:scale-102"
                                                >
                                                    <CheckIcon className="w-3.5 h-3.5" />
                                                    Considerações
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* CONTEÚDO DA ABA: REUNIÕES */}
            {activeTab === 'meetings' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Formulário de Reunião */}
                    <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-6 rounded-3xl shadow-xl h-fit">
                        <h3 className="text-base font-extrabold flex items-center justify-between border-b dark:border-slate-800 pb-3 mb-4">
                            <span className="flex items-center gap-2">
                                <PlusIcon className="w-5 h-5 text-brand-primary" />
                                {editingMeeting ? 'Editar Reunião' : 'Agendar Reunião'}
                            </span>
                            {editingMeeting && (
                                <button type="button" onClick={cancelEditMeeting} className="text-xs text-red-500 font-bold hover:underline">
                                    Cancelar
                                </button>
                            )}
                        </h3>

                        <form onSubmit={handleSaveMeeting} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Assunto / Título *</label>
                                <input
                                    type="text"
                                    required
                                    value={meetingTitle}
                                    onChange={(e) => setMeetingTitle(e.target.value)}
                                    placeholder="Ex: Alinhamento de Metas"
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Data *</label>
                                    <input
                                        type="date"
                                        required
                                        value={meetingDate}
                                        onChange={(e) => setMeetingDate(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Horário *</label>
                                    <input
                                        type="time"
                                        required
                                        value={meetingTime}
                                        onChange={(e) => setMeetingTime(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Duração *</label>
                                <input
                                    type="text"
                                    required
                                    value={meetingDuration}
                                    onChange={(e) => setMeetingDuration(e.target.value)}
                                    placeholder="Ex: 1 hora, 30 min"
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Local / Link Virtual</label>
                                <input
                                    type="text"
                                    value={meetingLocation}
                                    onChange={(e) => setMeetingLocation(e.target.value)}
                                    placeholder="Ex: Google Meet, Sala 2"
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Notas / Detalhes</label>
                                <textarea
                                    value={meetingNotes}
                                    onChange={(e) => setMeetingNotes(e.target.value)}
                                    placeholder="Pauta da reunião, observações..."
                                    rows={3}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                                />
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="isPrivate"
                                    checked={meetingIsPrivate}
                                    onChange={(e) => setMeetingIsPrivate(e.target.checked)}
                                    className="rounded text-brand-primary focus:ring-brand-primary cursor-pointer h-4 w-4"
                                />
                                <label htmlFor="isPrivate" className="text-xs font-bold text-slate-750 dark:text-slate-300 cursor-pointer select-none">
                                    Reunião Privada?
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-brand-primary hover:bg-emerald-600 disabled:opacity-55 text-white font-black py-2.5 rounded-xl shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 transition-all animate-none"
                            >
                                <CheckIcon className="w-5 h-5" />
                                {submitting ? 'Salvando...' : editingMeeting ? 'Salvar Alterações' : 'Agendar Reunião'}
                            </button>
                        </form>
                    </div>

                    {/* Lista de Reuniões */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black flex items-center gap-2">
                                <CalendarIcon className="w-6 h-6 text-brand-primary" />
                                Registro de Reuniões
                            </h3>
                            <button
                                onClick={() => setShowHistoryModal('meetings')}
                                className="text-xs font-bold uppercase tracking-wider text-brand-primary hover:underline"
                            >
                                Ver Histórico Completo
                            </button>
                        </div>

                        {loadingMeetings ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                            </div>
                        ) : meetings.length === 0 ? (
                            <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-3xl shadow-sm">
                                <CalendarIcon className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhuma reunião agendada</p>
                                <p className="text-xs text-slate-500 dark:text-gray-400">Preencha o formulário ao lado para agendar a primeira reunião.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {meetings.slice(0, 5).map(meeting => (
                                    <div 
                                        key={meeting.id} 
                                        className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all relative flex flex-col justify-between gap-4"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="font-extrabold text-slate-850 dark:text-white text-base">
                                                        {meeting.title}
                                                    </h4>
                                                    <span className="text-slate-400 text-xs">•</span>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                                        Organizador: <strong className="text-slate-700 dark:text-slate-300">{meeting.profiles?.full_name || 'Desconhecido'}</strong>
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{meeting.description}</p>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {meeting.is_private && (
                                                    <span className="px-2.5 py-1 text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full border dark:border-slate-700">
                                                        Privada
                                                    </span>
                                                )}

                                                {isCompanyAdmin && (
                                                    <div className="flex gap-1">
                                                        <button 
                                                            onClick={() => startEditMeeting(meeting)} 
                                                            className="p-1 text-slate-400 hover:text-slate-650 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                                                            title="Editar reunião"
                                                        >
                                                            <PencilIcon className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteEvent(meeting)} 
                                                            className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded"
                                                            title="Excluir reunião"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-950/30 p-3 rounded-2xl text-xs text-slate-500 dark:text-slate-400 border dark:border-slate-850">
                                            <div className="flex items-center gap-1.5">
                                                <CalendarIcon className="w-4 h-4 text-slate-400" />
                                                Data: {new Date(meeting.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <ClockIcon className="w-4 h-4 text-slate-400" />
                                                Hora: {meeting.start_time.split('T')[1]?.substring(0, 5)}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <MapPinIcon className="w-4 h-4 text-slate-400" />
                                                Local: {meeting.location}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* CONTEÚDO DA ABA: TREINAMENTOS */}
            {activeTab === 'trainings' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Formulário de Treinamento */}
                    <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-6 rounded-3xl shadow-xl h-fit">
                        <h3 className="text-base font-extrabold flex items-center justify-between border-b dark:border-slate-800 pb-3 mb-4">
                            <span className="flex items-center gap-2">
                                <PlusIcon className="w-5 h-5 text-brand-primary" />
                                {editingTraining ? 'Editar Treinamento' : 'Agendar Treinamento'}
                            </span>
                            {editingTraining && (
                                <button type="button" onClick={cancelEditTraining} className="text-xs text-red-500 font-bold hover:underline">
                                    Cancelar
                                </button>
                            )}
                        </h3>

                        <form onSubmit={handleSaveTraining} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Nome do Treinamento *</label>
                                <input
                                    type="text"
                                    required
                                    value={trainingTitle}
                                    onChange={(e) => setTrainingTitle(e.target.value)}
                                    placeholder="Ex: Capacitação Técnica"
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Data *</label>
                                    <input
                                        type="date"
                                        required
                                        value={trainingDate}
                                        onChange={(e) => setTrainingDate(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Horário *</label>
                                    <input
                                        type="time"
                                        required
                                        value={trainingTime}
                                        onChange={(e) => setTrainingTime(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Duração *</label>
                                <input
                                    type="text"
                                    required
                                    value={trainingDuration}
                                    onChange={(e) => setTrainingDuration(e.target.value)}
                                    placeholder="Ex: 2 horas, 4 horas"
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase block">Tipo de Treinamento</label>
                                <div className="flex gap-2">
                                    <select
                                        value={trainingType}
                                        onChange={(e) => setTrainingType(e.target.value)}
                                        className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary font-bold text-slate-700 dark:text-slate-300 capitalize"
                                    >
                                        {customTrainingTypes.map((t, idx) => (
                                            <option key={idx} value={t}>{t}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => setShowAddTypeInput(!showAddTypeInput)}
                                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 hover:bg-slate-100 px-3 rounded-xl text-xs font-bold text-slate-650 dark:text-slate-300"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            {showAddTypeInput && (
                                <div className="flex gap-2 p-3 bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 rounded-2xl animate-in slide-in-from-top-2 duration-200">
                                    <input
                                        type="text"
                                        value={newTrainingType}
                                        onChange={(e) => setNewTrainingType(e.target.value)}
                                        placeholder="Novo tipo (Ex: workshop)"
                                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-805 dark:text-white font-semibold focus:outline-none focus:border-brand-primary"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddTrainingType}
                                        className="bg-brand-primary hover:bg-emerald-600 text-white font-bold px-3 py-1.5 rounded-xl text-xs"
                                    >
                                        Ok
                                    </button>
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Observações / Programa</label>
                                <textarea
                                    value={trainingNotes}
                                    onChange={(e) => setTrainingNotes(e.target.value)}
                                    placeholder="Tópicos abordados, observações..."
                                    rows={3}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-brand-primary hover:bg-emerald-600 disabled:opacity-55 text-white font-black py-2.5 rounded-xl shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 transition-all animate-none"
                            >
                                <CheckIcon className="w-5 h-5" />
                                {submitting ? 'Salvando...' : editingTraining ? 'Salvar Alterações' : 'Agendar Treinamento'}
                            </button>
                        </form>
                    </div>

                    {/* Lista de Treinamentos */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black flex items-center gap-2">
                                <SparklesIcon className="w-6 h-6 text-brand-primary" />
                                Registro de Treinamentos
                            </h3>
                            <button
                                onClick={() => setShowHistoryModal('trainings')}
                                className="text-xs font-bold uppercase tracking-wider text-brand-primary hover:underline"
                            >
                                Ver Histórico Completo
                            </button>
                        </div>

                        {loadingTrainings ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                            </div>
                        ) : trainings.length === 0 ? (
                            <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-3xl shadow-sm">
                                <SparklesIcon className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhum treinamento agendado</p>
                                <p className="text-xs text-slate-500 dark:text-gray-400">Preencha o formulário ao lado para agendar o primeiro treinamento.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {trainings.slice(0, 5).map(training => (
                                    <div 
                                        key={training.id} 
                                        className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all relative flex flex-col justify-between gap-4"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="font-extrabold text-slate-850 dark:text-white text-base">
                                                        {training.title.replace(/^Treinamento:\s*/, '')}
                                                    </h4>
                                                    <span className="text-slate-400 text-xs">•</span>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                                        Instrutor: <strong className="text-slate-700 dark:text-slate-300">{training.profiles?.full_name || 'Desconhecido'}</strong>
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 whitespace-pre-line">{training.description}</p>
                                            </div>

                                            {isCompanyAdmin && (
                                                <div className="flex gap-1 shrink-0">
                                                    <button 
                                                        onClick={() => startEditTraining(training)} 
                                                        className="p-1 text-slate-400 hover:text-slate-650 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                                                        title="Editar treinamento"
                                                    >
                                                        <PencilIcon className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteEvent(training)} 
                                                        className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded"
                                                        title="Excluir treinamento"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-950/30 p-3 rounded-2xl text-xs text-slate-500 dark:text-slate-400 border dark:border-slate-850">
                                            <div className="flex items-center gap-1.5">
                                                <CalendarIcon className="w-4 h-4 text-slate-400" />
                                                Data: {new Date(training.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <ClockIcon className="w-4 h-4 text-slate-400" />
                                                Hora: {training.start_time.split('T')[1]?.substring(0, 5)}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <VideoCameraIcon className="w-4 h-4 text-slate-400" />
                                                Local: {training.location}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de Considerações de Visita */}
            {showConsiderationsModal && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 animate-scale-in text-slate-800 dark:text-white">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/40">
                            <h3 className="text-lg font-black flex items-center gap-2">
                                <SparklesIcon className="w-5 h-5 text-brand-primary" />
                                Considerações da Visita
                            </h3>
                            <button onClick={() => setShowConsiderationsModal(null)} className="text-slate-400 hover:text-slate-650">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveConsiderations} className="p-6 space-y-4">
                            <div className="p-4 bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 rounded-2xl text-xs space-y-1">
                                <p><span className="font-bold">Cliente:</span> {showConsiderationsModal.client_name}</p>
                                <p><span className="font-bold">Data:</span> {new Date(showConsiderationsModal.visit_date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Como foi a visita? (Observações) *</label>
                                <textarea
                                    required
                                    value={considerations}
                                    onChange={(e) => setConsiderations(e.target.value)}
                                    placeholder="Insira os detalhes do que aconteceu..."
                                    rows={4}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Resultado / Status</label>
                                <select
                                    value={visitStatus}
                                    onChange={(e) => setVisitStatus(e.target.value as any)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary font-bold text-slate-700 dark:text-slate-300"
                                >
                                    <option value="completed">Concluída com Sucesso</option>
                                    <option value="problem">Teve Problema / Incompleta</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="needsReturn"
                                    checked={needsReturn}
                                    onChange={(e) => setNeedsReturn(e.target.checked)}
                                    className="rounded text-brand-primary focus:ring-brand-primary cursor-pointer h-4 w-4"
                                />
                                <label htmlFor="needsReturn" className="text-xs font-bold text-slate-750 dark:text-slate-300 cursor-pointer select-none">
                                    Esta visita necessita de retorno/acompanhamento?
                                </label>
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowConsiderationsModal(null)}
                                    className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold px-4 py-2 rounded-xl text-xs border border-slate-200/50 dark:border-slate-800"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="bg-brand-primary hover:bg-emerald-600 text-white font-black px-6 py-2 rounded-xl text-xs shadow-md shadow-brand-primary/10"
                                >
                                    Finalizar Visita
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Histórico Completo */}
            {showHistoryModal && (
                <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/40">
                            <h3 className="text-lg font-black flex items-center gap-2">
                                <DocumentTextIcon className="w-5 h-5 text-brand-primary" />
                                Histórico de {showHistoryModal === 'visits' ? 'Visitas' : showHistoryModal === 'meetings' ? 'Reuniões' : 'Treinamentos'}
                            </h3>
                            <button onClick={() => setShowHistoryModal(null)} className="text-slate-400 hover:text-slate-650">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            {showHistoryModal === 'visits' && visits.map(visit => (
                                <div key={visit.id} className="border border-slate-100 dark:border-slate-850 p-4 rounded-2xl space-y-2.5 relative">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <h4 className="font-extrabold text-sm text-slate-850 dark:text-white">{visit.client_name}</h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Visitante: {visit.visitor_name}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full border ${
                                                visit.status === 'completed' 
                                                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-450 dark:border-green-800/30'
                                                    : visit.status === 'problem'
                                                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-450 dark:border-red-800/30'
                                                    : 'bg-yellow-50 text-yellow-750 border-yellow-250 dark:bg-yellow-950/10 dark:text-yellow-400 dark:border-yellow-900/30'
                                            }`}>
                                                {visit.status === 'completed' ? 'Concluída' : visit.status === 'problem' ? 'Com Problema' : 'Pendente'}
                                            </span>
                                            {isCompanyAdmin && (
                                                <div className="flex gap-1">
                                                    <button onClick={() => startEditVisit(visit)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                                                        <PencilIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => handleDeleteVisit(visit)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded">
                                                        <TrashIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-400">{visit.description}</p>
                                    <div className="text-[11px] text-slate-400 dark:text-slate-500 flex gap-4">
                                        <span>Data: {new Date(visit.visit_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                                        <span>Hora: {visit.visit_time} ({visit.duration})</span>
                                    </div>
                                </div>
                            ))}

                            {showHistoryModal === 'meetings' && meetings.map(meeting => (
                                <div key={meeting.id} className="border border-slate-100 dark:border-slate-850 p-4 rounded-2xl space-y-2.5 relative">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <h4 className="font-extrabold text-sm text-slate-850 dark:text-white">{meeting.title}</h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Organizador: {meeting.profiles?.full_name}</p>
                                        </div>
                                        {isCompanyAdmin && (
                                            <div className="flex gap-1">
                                                <button onClick={() => startEditMeeting(meeting)} className="p-1 text-slate-400 hover:text-slate-650 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                                                    <PencilIcon className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => handleDeleteEvent(meeting)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded">
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-400">{meeting.description}</p>
                                    <div className="text-[11px] text-slate-400 dark:text-slate-500 flex gap-4">
                                        <span>Data: {new Date(meeting.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                                        <span>Hora: {meeting.start_time.split('T')[1]?.substring(0, 5)}</span>
                                        <span>Local: {meeting.location}</span>
                                    </div>
                                </div>
                            ))}

                            {showHistoryModal === 'trainings' && trainings.map(training => (
                                <div key={training.id} className="border border-slate-100 dark:border-slate-850 p-4 rounded-2xl space-y-2.5 relative">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <h4 className="font-extrabold text-sm text-slate-850 dark:text-white">{training.title.replace(/^Treinamento:\s*/, '')}</h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Instrutor: {training.profiles?.full_name}</p>
                                        </div>
                                        {isCompanyAdmin && (
                                            <div className="flex gap-1">
                                                <button onClick={() => startEditTraining(training)} className="p-1 text-slate-400 hover:text-slate-650 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                                                    <PencilIcon className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => handleDeleteEvent(training)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded">
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-line">{training.description}</p>
                                    <div className="text-[11px] text-slate-400 dark:text-slate-500 flex gap-4">
                                        <span>Data: {new Date(training.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                                        <span>Hora: {training.start_time.split('T')[1]?.substring(0, 5)}</span>
                                        <span>Local: {training.location}</span>
                                    </div>
                                </div>
                            ))}

                            {((showHistoryModal === 'visits' && visits.length === 0) ||
                              (showHistoryModal === 'meetings' && meetings.length === 0) ||
                              (showHistoryModal === 'trainings' && trainings.length === 0)) && (
                                <p className="text-center py-8 text-xs text-slate-400 font-bold uppercase tracking-wider">Nenhum registro no histórico</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgendaPage;
