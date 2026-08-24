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
    VideoCameraIcon
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

interface AgendaPageProps {
    initialTab?: 'visits' | 'meetings' | 'trainings';
    initialDate?: string;
}

const AgendaPage: React.FC<AgendaPageProps> = ({ initialTab, initialDate }) => {
    const { currentUser } = useAuth();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'visits' | 'meetings' | 'trainings'>(initialTab || 'visits');

    // Visits lists and loading
    const [visits, setVisits] = useState<Visit[]>([]);
    const [loadingVisits, setLoadingVisits] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showConsiderationsModal, setShowConsiderationsModal] = useState<Visit | null>(null);

    // Visit Form
    const [visitorName, setVisitorName] = useState(currentUser?.full_name || currentUser?.name || '');
    const [clientName, setClientName] = useState('');
    const [visitDescription, setVisitDescription] = useState('');
    const [visitDate, setVisitDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
    const [visitTime, setVisitTime] = useState('09:00');
    const [visitDuration, setVisitDuration] = useState('1 hora');

    // Considerations Form
    const [considerations, setConsiderations] = useState('');
    const [visitStatus, setVisitStatus] = useState<'completed' | 'problem'>('completed');
    const [needsReturn, setNeedsReturn] = useState(false);

    // Meeting Form
    const [meetingTitle, setMeetingTitle] = useState('');
    const [meetingDate, setMeetingDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
    const [meetingTime, setMeetingTime] = useState('10:00');
    const [meetingDuration, setMeetingDuration] = useState('1 hora');
    const [meetingLocation, setMeetingLocation] = useState('');
    const [meetingNotes, setMeetingNotes] = useState('');
    const [meetingIsPrivate, setMeetingIsPrivate] = useState(false);

    // Training Form
    const [trainingTitle, setTrainingTitle] = useState('');
    const [trainingDate, setTrainingDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
    const [trainingTime, setTrainingTime] = useState('14:00');
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
            fetchVisits();
        }
    }, [currentUser, activeTab]);

    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);

    const fetchVisits = async () => {
        if (activeTab !== 'visits') return;
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

    // Save Visit
    const handleSaveVisit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            // 1. Inserir na tabela agenda_visits
            const visitPayload = {
                company_id: currentUser.company_id,
                user_id: currentUser.id,
                visitor_name: visitorName,
                client_name: clientName,
                description: visitDescription,
                visit_date: visitDate,
                visit_time: visitTime,
                duration: visitDuration,
                status: 'pending',
                needs_return: false
            };

            const { data: vData, error: vError } = await supabase
                .from('agenda_visits')
                .insert(visitPayload)
                .select()
                .single();

            if (vError) throw vError;

            // 2. Criar evento amarelo ('Visita') no calendário geral (events)
            const hourParts = visitTime.split(':');
            const endHour = (Number(hourParts[0]) + 1).toString().padStart(2, '0');
            const endTimeCalculated = `${endHour}:00`;

            const combinedStartTime = new Date(`${visitDate}T${visitTime}:00Z`).toISOString();
            const combinedEndTime = new Date(`${visitDate}T${endTimeCalculated}:00Z`).toISOString();

            const eventPayload = {
                company_id: currentUser.company_id,
                creator_id: currentUser.id,
                title: `Visita: ${visitorName} em ${clientName}`,
                description: `${visitDescription || 'Visita comercial agendada.'}\n\nVisitante: ${visitorName}\nCliente: ${clientName}`,
                date: visitDate,
                start_time: combinedStartTime,
                end_time: combinedEndTime,
                category: 'Visita', // Cor amarela
                location: clientName,
                is_private: false
            };

            const { error: eventError } = await supabase
                .from('events')
                .insert(eventPayload);

            if (eventError) throw eventError;

            showToast('Visita agendada com sucesso!', 'success');
            setClientName('');
            setVisitDescription('');
            fetchVisits();
        } catch (err: any) {
            console.error('Erro ao agendar visita:', err);
            showToast('Erro ao agendar visita: ' + err.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // Finalizar Visita (Salvar Considerações)
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

    // Save Meeting
    const handleSaveMeeting = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const hourParts = meetingTime.split(':');
            const endHour = (Number(hourParts[0]) + 1).toString().padStart(2, '0');
            const endTimeCalculated = `${endHour}:00`;

            const combinedStartTime = new Date(`${meetingDate}T${meetingTime}:00Z`).toISOString();
            const combinedEndTime = new Date(`${meetingDate}T${endTimeCalculated}:00Z`).toISOString();

            const eventPayload = {
                company_id: currentUser.company_id,
                creator_id: currentUser.id,
                title: meetingTitle,
                description: meetingNotes || 'Reunião comercial.',
                date: meetingDate,
                start_time: combinedStartTime,
                end_time: combinedEndTime,
                category: 'Reunião', // Cor amarela
                location: meetingLocation || 'Sala Virtual / Presencial',
                is_private: meetingIsPrivate
            };

            const { error } = await supabase
                .from('events')
                .insert(eventPayload);

            if (error) throw error;

            showToast('Reunião agendada com sucesso!', 'success');
            setMeetingTitle('');
            setMeetingLocation('');
            setMeetingNotes('');
            setMeetingIsPrivate(false);
        } catch (err: any) {
            console.error('Erro ao agendar reunião:', err);
            showToast('Erro ao agendar reunião: ' + err.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // Save Training
    const handleSaveTraining = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const hourParts = trainingTime.split(':');
            const endHour = (Number(hourParts[0]) + 2).toString().padStart(2, '0');
            const endTimeCalculated = `${endHour}:00`;

            const combinedStartTime = new Date(`${trainingDate}T${trainingTime}:00Z`).toISOString();
            const combinedEndTime = new Date(`${trainingDate}T${endTimeCalculated}:00Z`).toISOString();

            const eventPayload = {
                company_id: currentUser.company_id,
                creator_id: currentUser.id,
                title: `Treinamento: ${trainingTitle}`,
                description: `Tipo: ${trainingType.toUpperCase()}.\nObservações: ${trainingNotes || 'Nenhuma'}`,
                date: trainingDate,
                start_time: combinedStartTime,
                end_time: combinedEndTime,
                category: 'Treinamento', // Cor azul
                location: trainingType === 'online' ? 'Plataforma Online' : 'Auditório da Empresa',
                is_private: false
            };

            const { error } = await supabase
                .from('events')
                .insert(eventPayload);

            if (error) throw error;

            showToast('Treinamento agendado com sucesso!', 'success');
            setTrainingTitle('');
            setTrainingNotes('');
        } catch (err: any) {
            console.error('Erro ao agendar treinamento:', err);
            showToast('Erro ao agendar treinamento: ' + err.message, 'error');
        } finally {
            setSubmitting(false);
        }
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

            {/* Abas */}
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl max-w-md border dark:border-slate-800">
                <button
                    onClick={() => setActiveTab('visits')}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'visits'
                            ? 'bg-white dark:bg-slate-900 text-brand-primary shadow-md'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                    }`}
                >
                    <UsersIcon className="w-4 h-4" />
                    Visitas
                </button>
                <button
                    onClick={() => setActiveTab('meetings')}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'meetings'
                            ? 'bg-white dark:bg-slate-900 text-brand-primary shadow-md'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                    }`}
                >
                    <CalendarIcon className="w-4 h-4" />
                    Reuniões
                </button>
                <button
                    onClick={() => setActiveTab('trainings')}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'trainings'
                            ? 'bg-white dark:bg-slate-900 text-brand-primary shadow-md'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                    }`}
                >
                    <SparklesIcon className="w-4 h-4" />
                    Treinamentos
                </button>
            </div>

            {/* CONTEÚDO DA ABA: VISITAS */}
            {activeTab === 'visits' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Formulário de Visita */}
                    <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-6 rounded-3xl shadow-xl h-fit">
                        <h3 className="text-base font-extrabold flex items-center gap-2 border-b dark:border-slate-800 pb-3 mb-4">
                            <PlusIcon className="w-5 h-5 text-brand-primary" />
                            Agendar Nova Visita
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
                                {submitting ? 'Salvando...' : 'Agendar Visita'}
                            </button>
                        </form>
                    </div>

                    {/* Lista de Visitas */}
                    <div className="lg:col-span-2 space-y-4">
                        <h3 className="text-lg font-black flex items-center gap-2">
                            <DocumentTextIcon className="w-6 h-6 text-brand-primary" />
                            Registro de Visitas Comerciais
                        </h3>

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
                                {visits.map(visit => (
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

                                            <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full border ${
                                                visit.status === 'completed' 
                                                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-450 dark:border-green-800/30'
                                                    : visit.status === 'problem'
                                                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-450 dark:border-red-800/30'
                                                    : 'bg-yellow-50 text-yellow-750 border-yellow-250 dark:bg-yellow-950/10 dark:text-yellow-400 dark:border-yellow-900/30'
                                            }`}>
                                                {visit.status === 'completed' ? 'Concluída' : visit.status === 'problem' ? 'Com Problema' : 'Pendente'}
                                            </span>
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
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-6 md:p-8 rounded-3xl shadow-xl max-w-2xl mx-auto">
                    <h3 className="text-lg font-black flex items-center gap-2 border-b dark:border-slate-800 pb-3 mb-6">
                        <CalendarIcon className="w-6 h-6 text-brand-primary" />
                        Agendar Reunião
                    </h3>

                    <form onSubmit={handleSaveMeeting} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Assunto / Título *</label>
                            <input
                                type="text"
                                required
                                value={meetingTitle}
                                onChange={(e) => setMeetingTitle(e.target.value)}
                                placeholder="Ex: Alinhamento de Metas Q3"
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Data *</label>
                                <input
                                    type="date"
                                    required
                                    value={meetingDate}
                                    onChange={(e) => setMeetingDate(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Horário *</label>
                                <input
                                    type="time"
                                    required
                                    value={meetingTime}
                                    onChange={(e) => setMeetingTime(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Duração *</label>
                                <input
                                    type="text"
                                    required
                                    value={meetingDuration}
                                    onChange={(e) => setMeetingDuration(e.target.value)}
                                    placeholder="Ex: 1 hora, 30 min"
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Local / Link Virtual</label>
                            <input
                                type="text"
                                value={meetingLocation}
                                onChange={(e) => setMeetingLocation(e.target.value)}
                                placeholder="Ex: Google Meet, Teams, Sala de Reunião 2"
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Notas / Detalhes</label>
                            <textarea
                                value={meetingNotes}
                                onChange={(e) => setMeetingNotes(e.target.value)}
                                placeholder="Pauta da reunião, observações extras..."
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
                                Reunião Privada? (Apenas participantes verão os detalhes no calendário)
                            </label>
                        </div>

                        <div className="pt-4 border-t dark:border-slate-800 flex justify-end">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="bg-brand-primary hover:bg-emerald-600 disabled:opacity-55 text-white font-black px-8 py-3 rounded-2xl shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                            >
                                <CheckIcon className="w-5 h-5" />
                                {submitting ? 'Agendando...' : 'Agendar Reunião'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* CONTEÚDO DA ABA: TREINAMENTOS */}
            {activeTab === 'trainings' && (
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-6 md:p-8 rounded-3xl shadow-xl max-w-2xl mx-auto">
                    <h3 className="text-lg font-black flex items-center gap-2 border-b dark:border-slate-800 pb-3 mb-6">
                        <SparklesIcon className="w-6 h-6 text-brand-primary" />
                        Agendar Treinamento
                    </h3>

                    <form onSubmit={handleSaveTraining} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Nome do Treinamento *</label>
                            <input
                                type="text"
                                required
                                value={trainingTitle}
                                onChange={(e) => setTrainingTitle(e.target.value)}
                                placeholder="Ex: Capacitação Técnica em Supabase"
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Data *</label>
                                <input
                                    type="date"
                                    required
                                    value={trainingDate}
                                    onChange={(e) => setTrainingDate(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Horário *</label>
                                <input
                                    type="time"
                                    required
                                    value={trainingTime}
                                    onChange={(e) => setTrainingTime(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Duração *</label>
                                <input
                                    type="text"
                                    required
                                    value={trainingDuration}
                                    onChange={(e) => setTrainingDuration(e.target.value)}
                                    placeholder="Ex: 2 horas, 4 horas"
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                                />
                            </div>
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
                                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 hover:bg-slate-100 px-4 rounded-xl text-xs font-bold text-slate-650 dark:text-slate-300"
                                >
                                    Adicionar Tipo
                                </button>
                            </div>
                        </div>

                        {showAddTypeInput && (
                            <div className="flex gap-2 p-3 bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 rounded-2xl animate-in slide-in-from-top-2 duration-200">
                                <input
                                    type="text"
                                    value={newTrainingType}
                                    onChange={(e) => setNewTrainingType(e.target.value)}
                                    placeholder="Digite um novo tipo (Ex: presencial)"
                                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-805 dark:text-white font-semibold focus:outline-none focus:border-brand-primary"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddTrainingType}
                                    className="bg-brand-primary hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl text-xs"
                                >
                                    Adicionar
                                </button>
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Observações / Programa</label>
                            <textarea
                                value={trainingNotes}
                                onChange={(e) => setTrainingNotes(e.target.value)}
                                placeholder="Tópicos abordados, pré-requisitos..."
                                rows={4}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                            />
                        </div>

                        <div className="pt-4 border-t dark:border-slate-800 flex justify-end">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="bg-brand-primary hover:bg-emerald-600 disabled:opacity-55 text-white font-black px-8 py-3 rounded-2xl shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                            >
                                <CheckIcon className="w-5 h-5" />
                                {submitting ? 'Agendando...' : 'Agendar Treinamento'}
                            </button>
                        </div>
                    </form>
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
        </div>
    );
};

export default AgendaPage;
