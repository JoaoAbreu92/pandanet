import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { 
    BuildingOfficeIcon, 
    RocketLaunchIcon, 
    CalendarIcon, 
    ClockIcon, 
    UsersIcon, 
    SparklesIcon,
    CheckIcon,
    PlusIcon
} from './icons';

interface ReservationItem {
    id: string;
    company_id: string;
    type: 'room' | 'vehicle';
    name: string;
    details: {
        capacity?: number;
        accessories?: string[];
        plate?: string;
        model?: string;
        brand?: string;
        color?: string;
    };
}

interface ReservationsPageProps {
    initialTab?: 'rooms' | 'vehicles';
}

const ReservationsPage: React.FC<ReservationsPageProps> = ({ initialTab }) => {
    const { currentUser } = useAuth();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'rooms' | 'vehicles'>(initialTab || 'rooms');
    const [items, setItems] = useState<ReservationItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form states
    const [selectedItemId, setSelectedItemId] = useState('');
    const [solicitante, setSolicitante] = useState(currentUser?.full_name || currentUser?.name || '');
    const [motivo, setMotivo] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState('09:00');
    const [duration, setDuration] = useState('2');
    const [durationUnit, setDurationUnit] = useState<'hours' | 'days' | 'weeks'>('hours');

    // Room specific
    const [peopleCount, setPeopleCount] = useState<number>(1);
    const [selectedAccessories, setSelectedAccessories] = useState<string[]>([]);
    
    // Reservations state
    const [reservations, setReservations] = useState<any[]>([]);

    useEffect(() => {
        if (currentUser?.company_id) {
            fetchItems();
            fetchReservations();
        }
    }, [currentUser, activeTab]);

    const fetchReservations = async () => {
        if (!currentUser?.company_id) return;
        try {
            const { data, error } = await supabase
                .from('reservations')
                .select('*, reservation_items(name, type)')
                .eq('company_id', currentUser.company_id)
                .order('start_date', { ascending: false })
                .order('start_time', { ascending: false });

            if (error) throw error;
            setReservations(data || []);
        } catch (err) {
            console.error('Erro ao carregar reservas:', err);
        }
    };

    const getEndTime = (startDateStr: string, startTimeStr: string, durationStr: string) => {
        try {
            const start = new Date(`${startDateStr}T${startTimeStr}:00`);
            const num = parseInt(durationStr) || 1;
            const unit = durationStr.toLowerCase();
            const end = new Date(start.getTime());
            if (unit.includes('hora') || unit.includes('hour')) {
                end.setHours(end.getHours() + num);
            } else if (unit.includes('dia') || unit.includes('day')) {
                end.setDate(end.getDate() + num);
            } else if (unit.includes('semana') || unit.includes('week')) {
                end.setDate(end.getDate() + num * 7);
            } else {
                end.setHours(end.getHours() + num);
            }
            return end;
        } catch (e) {
            return null;
        }
    };

    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const itemType = activeTab === 'rooms' ? 'room' : 'vehicle';
            const { data, error } = await supabase
                .from('reservation_items')
                .select('*')
                .eq('company_id', currentUser.company_id)
                .eq('type', itemType)
                .order('name', { ascending: true });

            if (error) throw error;
            setItems(data || []);
            if (data && data.length > 0) {
                setSelectedItemId(data[0].id);
            } else {
                setSelectedItemId('');
            }
        } catch (err: any) {
            console.error('Erro ao carregar itens:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAccessoryToggle = (accessory: string) => {
        setSelectedAccessories(prev => 
            prev.includes(accessory) 
                ? prev.filter(a => a !== accessory)
                : [...prev, accessory]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItemId) {
            showToast('Por favor, cadastre um item no painel administrativo antes de fazer uma reserva.', 'error');
            return;
        }
        setSubmitting(true);

        const selectedItem = items.find(i => i.id === selectedItemId);
        if (!selectedItem) return;

        const durationStr = `${duration} ${durationUnit === 'hours' ? (Number(duration) === 1 ? 'hora' : 'horas') : durationUnit === 'days' ? (Number(duration) === 1 ? 'dia' : 'dias') : (Number(duration) === 1 ? 'semana' : 'semanas')}`;

        try {
            // 1. Validar conflitos de horários no frontend
            const { data: existingReservations, error: fetchErr } = await supabase
                .from('reservations')
                .select('*')
                .eq('item_id', selectedItemId)
                .in('status', ['approved', 'pending']);

            if (fetchErr) throw fetchErr;

            const reqStart = new Date(`${startDate}T${startTime}:00`).getTime();
            const reqDurationNum = parseInt(duration) || 1;
            let reqDurationMs = reqDurationNum * 60 * 60 * 1000;
            if (durationUnit === 'days') reqDurationMs = reqDurationNum * 24 * 60 * 60 * 1000;
            if (durationUnit === 'weeks') reqDurationMs = reqDurationNum * 7 * 24 * 60 * 60 * 1000;
            const reqEnd = reqStart + reqDurationMs;

            const bufferMs = 30 * 60 * 1000; // 30 minutos de buffer
            const reqStartWithBuffer = reqStart - bufferMs;
            const reqEndWithBuffer = reqEnd + bufferMs;

            let conflict = false;
            let conflictingRes = null;

            if (existingReservations && existingReservations.length > 0) {
                for (const res of existingReservations) {
                    const existStart = new Date(`${res.start_date}T${res.start_time}:00`).getTime();
                    const existDurationNum = parseInt(res.duration) || 1;
                    let existDurationMs = existDurationNum * 60 * 60 * 1000;
                    if (res.duration.toLowerCase().includes('dia') || res.duration.toLowerCase().includes('day')) {
                        existDurationMs = existDurationNum * 24 * 60 * 60 * 1000;
                    } else if (res.duration.toLowerCase().includes('semana') || res.duration.toLowerCase().includes('week')) {
                        existDurationMs = existDurationNum * 7 * 24 * 60 * 60 * 1000;
                    }
                    const existEnd = existStart + existDurationMs;

                    // Verifica sobreposição
                    if (Math.max(reqStartWithBuffer, existStart) < Math.min(reqEndWithBuffer, existEnd)) {
                        conflict = true;
                        conflictingRes = res;
                        break;
                    }
                }
            }

            if (conflict) {
                const confStartStr = conflictingRes?.start_time || '';
                showToast(`Conflito: Este recurso já possui reserva solicitada/aprovada por ${conflictingRes?.solicitante} às ${confStartStr} com buffer de tolerância de 30min.`, 'error');
                setSubmitting(false);
                return;
            }

            // 2. Criar na tabela public.reservations com status 'pending'
            const reservationPayload = {
                company_id: currentUser.company_id,
                user_id: currentUser.id,
                item_id: selectedItemId,
                type: selectedItem.type,
                start_date: startDate,
                start_time: startTime,
                duration: durationStr,
                solicitante,
                motivo,
                people_count: selectedItem.type === 'room' ? Number(peopleCount) : null,
                selected_items: selectedItem.type === 'room' ? selectedAccessories : [],
                status: 'pending'
            };

            const { error: resError } = await supabase
                .from('reservations')
                .insert(reservationPayload);

            if (resError) throw resError;

            showToast('Solicitação de reserva enviada para aprovação do administrador!', 'success');
            
            // Reset form
            setMotivo('');
            setPeopleCount(1);
            setSelectedAccessories([]);
            fetchReservations();
        } catch (err: any) {
            console.error('Erro ao efetuar reserva:', err);
            showToast('Erro ao efetuar reserva: ' + err.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const selectedItem = items.find(i => i.id === selectedItemId);

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 text-slate-800 dark:text-white">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
                        <BuildingOfficeIcon className="w-8 h-8 text-brand-primary" />
                        Reservas Corporativas
                        <span className="text-xs bg-emerald-500/10 text-emerald-500 font-bold px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
                            <SparklesIcon className="w-3.5 h-3.5" />
                            Ativo
                        </span>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-sm">
                        Reserve salas de reunião, espaços de trabalho ou veículos da frota corporativa.
                    </p>
                </div>
            </div>

            {/* Abas */}
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl max-w-sm border dark:border-slate-800">
                <button
                    onClick={() => setActiveTab('rooms')}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'rooms'
                            ? 'bg-white dark:bg-slate-900 text-brand-primary shadow-md'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                    }`}
                >
                    <BuildingOfficeIcon className="w-4 h-4" />
                    Salas e Espaços
                </button>
                <button
                    onClick={() => setActiveTab('vehicles')}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'vehicles'
                            ? 'bg-white dark:bg-slate-900 text-brand-primary shadow-md'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                    }`}
                >
                    <RocketLaunchIcon className="w-4 h-4" />
                    Veículos
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary"></div>
                </div>
            ) : items.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl shadow-sm">
                    <BuildingOfficeIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nenhum recurso cadastrado</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 max-w-md mx-auto">
                        Não existem {activeTab === 'rooms' ? 'salas' : 'veículos'} cadastrados pela administração para esta empresa ainda. Entre em contato com seu gestor.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
                    {/* Formulário & Detalhes (Coluna 1) */}
                    <div className="xl:col-span-1 space-y-6">
                        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-3xl p-5 shadow-lg space-y-4">
                            <h3 className="text-base font-black flex items-center gap-2 border-b dark:border-slate-800 pb-2.5">
                                <CalendarIcon className="w-5 h-5 text-brand-primary" />
                                Nova Solicitação
                            </h3>

                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                                        {activeTab === 'rooms' ? 'Escolha a Sala *' : 'Escolha o Veículo *'}
                                    </label>
                                    <select
                                        required
                                        value={selectedItemId}
                                        onChange={(e) => setSelectedItemId(e.target.value)}
                                        className="w-full bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-primary text-slate-800 dark:text-white font-semibold"
                                    >
                                        {items.map(item => (
                                            <option key={item.id} value={item.id}>{item.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Solicitante *</label>
                                    <input
                                        type="text"
                                        required
                                        value={solicitante}
                                        onChange={(e) => setSolicitante(e.target.value)}
                                        className="w-full bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-primary text-slate-800 dark:text-white font-semibold"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Motivo / Finalidade</label>
                                    <input
                                        type="text"
                                        value={motivo}
                                        onChange={(e) => setMotivo(e.target.value)}
                                        placeholder={activeTab === 'rooms' ? 'Reunião de alinhamento' : 'Visita externa'}
                                        className="w-full bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-primary text-slate-800 dark:text-white font-semibold"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Data *</label>
                                        <input
                                            type="date"
                                            required
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="w-full bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-brand-primary text-slate-800 dark:text-white font-semibold"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Hora *</label>
                                        <input
                                            type="time"
                                            required
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                            className="w-full bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-brand-primary text-slate-800 dark:text-white font-semibold"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Duração *</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            min="1"
                                            required
                                            value={duration}
                                            onChange={(e) => setDuration(e.target.value)}
                                            className="w-1/2 bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-brand-primary text-slate-800 dark:text-white font-semibold"
                                        />
                                        <select
                                            value={durationUnit}
                                            onChange={(e) => setDurationUnit(e.target.value as any)}
                                            className="w-1/2 bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-brand-primary text-slate-800 dark:text-white font-semibold"
                                        >
                                            <option value="hours">Horas</option>
                                            <option value="days">Dias</option>
                                            <option value="weeks">Semanas</option>
                                        </select>
                                    </div>
                                </div>

                                {activeTab === 'rooms' && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Pessoas</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={peopleCount}
                                            onChange={(e) => setPeopleCount(Number(e.target.value))}
                                            className="w-full bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-primary text-slate-800 dark:text-white font-semibold"
                                        />
                                    </div>
                                )}

                                {activeTab === 'rooms' && selectedItem?.details?.accessories && selectedItem.details.accessories.length > 0 && (
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Acessórios Necessários</label>
                                        <div className="flex flex-wrap gap-1">
                                            {selectedItem.details.accessories.map((acc, i) => {
                                                const isSelected = selectedAccessories.includes(acc);
                                                return (
                                                    <button
                                                        key={i}
                                                        type="button"
                                                        onClick={() => handleAccessoryToggle(acc)}
                                                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                                                            isSelected
                                                                ? 'bg-brand-primary text-white border-brand-primary'
                                                                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                                                        }`}
                                                    >
                                                        {acc}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-brand-primary hover:bg-emerald-600 disabled:opacity-55 text-white font-black py-2.5 rounded-xl shadow-md text-xs transition-all active:scale-95"
                            >
                                {submitting ? 'Solicitando...' : 'Reservar'}
                            </button>
                        </form>

                        {/* Detalhes do Recurso */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl p-5 border dark:border-slate-800 space-y-3">
                            <h4 className="font-extrabold text-slate-800 dark:text-white text-xs border-b dark:border-slate-800 pb-1.5 flex items-center gap-1.5">
                                <ClockIcon className="w-4 h-4 text-brand-primary" />
                                Detalhes do Recurso
                            </h4>

                            {selectedItem ? (
                                <div className="space-y-3 text-xs">
                                    <div>
                                        <p className="text-[9px] text-slate-400 uppercase font-black">Recurso Selecionado</p>
                                        <p className="font-extrabold text-slate-800 dark:text-white mt-0.5">{selectedItem.name}</p>
                                    </div>

                                    {selectedItem.type === 'room' ? (
                                        <>
                                            <div>
                                                <p className="text-[9px] text-slate-400 uppercase font-black">Capacidade</p>
                                                <p className="font-bold mt-0.5">{selectedItem.details?.capacity || '-'} pessoas</p>
                                            </div>
                                            {selectedItem.details?.accessories && selectedItem.details.accessories.length > 0 && (
                                                <div>
                                                    <p className="text-[9px] text-slate-400 uppercase font-black mb-1">Itens Disponíveis</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {selectedItem.details.accessories.map((acc, i) => (
                                                            <span key={i} className="bg-slate-100 dark:bg-slate-800 text-[9px] font-bold px-1.5 py-0.5 rounded text-slate-650 dark:text-slate-350 border dark:border-slate-700">
                                                                {acc}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <p className="text-[9px] text-slate-400 uppercase font-black">Modelo</p>
                                                    <p className="font-bold">{selectedItem.details?.model || '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] text-slate-400 uppercase font-black">Marca</p>
                                                    <p className="font-bold">{selectedItem.details?.brand || '-'}</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <p className="text-[9px] text-slate-400 uppercase font-black">Placa</p>
                                                    <p className="font-bold font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded border dark:border-slate-700 w-fit">{selectedItem.details?.plate || '-'}</p>
                                                </div>
                                                {selectedItem.details?.color && (
                                                    <div>
                                                        <p className="text-[9px] text-slate-400 uppercase font-black">Cor</p>
                                                        <p className="font-bold">{selectedItem.details.color}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic">Nenhum item selecionado.</p>
                            )}
                        </div>
                    </div>

                    {/* Colunas do Layout (Coluna 2, 3, 4) */}
                    <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Coluna 1: Reservas feitas (Aprovadas ativas hoje/futuro) */}
                        <div className="bg-slate-50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 space-y-4">
                            <h3 className="text-sm font-black text-emerald-600 dark:text-emerald-450 border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Reservas Feitas ({reservations.filter(r => r.status === 'approved' && r.start_date >= new Date().toISOString().split('T')[0]).length})
                            </h3>
                            <div className="space-y-3 overflow-y-auto max-h-[70vh] pr-1">
                                {reservations.filter(r => r.status === 'approved' && r.start_date >= new Date().toISOString().split('T')[0]).length === 0 ? (
                                    <p className="text-xs text-slate-400 italic py-4 text-center">Nenhuma reserva ativa para hoje ou próximos dias.</p>
                                ) : (
                                    reservations.filter(r => r.status === 'approved' && r.start_date >= new Date().toISOString().split('T')[0]).map(res => {
                                        const endObj = getEndTime(res.start_date, res.start_time, res.duration);
                                        const endStr = endObj ? endObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
                                        return (
                                            <div key={res.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-105 dark:border-slate-800 rounded-2xl shadow-sm hover:border-emerald-200 transition-colors">
                                                <p className="font-extrabold text-slate-800 dark:text-white text-xs">{res.reservation_items?.name || 'Recurso'}</p>
                                                <p className="text-[10px] text-slate-500 mt-1">
                                                    📅 {new Date(res.start_date + 'T12:00:00').toLocaleDateString('pt-BR')} às {res.start_time}
                                                </p>
                                                {endStr && (
                                                    <p className="text-[10px] text-emerald-650 font-bold">
                                                        ⏱️ Término estimado: {endStr} ({res.duration})
                                                    </p>
                                                )}
                                                <p className="text-[9px] text-slate-400 mt-1 italic">Por: {res.solicitante}</p>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Coluna 2: Pendentes de aprovação */}
                        <div className="bg-slate-50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 space-y-4">
                            <h3 className="text-sm font-black text-amber-600 dark:text-amber-500 border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                                Aguardando Aprovação ({reservations.filter(r => r.status === 'pending').length})
                            </h3>
                            <div className="space-y-3 overflow-y-auto max-h-[70vh] pr-1">
                                {reservations.filter(r => r.status === 'pending').length === 0 ? (
                                    <p className="text-xs text-slate-400 italic py-4 text-center">Nenhuma solicitação pendente.</p>
                                ) : (
                                    reservations.filter(r => r.status === 'pending').map(res => (
                                        <div key={res.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-105 dark:border-slate-800 rounded-2xl shadow-sm hover:border-amber-250 transition-colors">
                                            <p className="font-extrabold text-slate-800 dark:text-white text-xs">{res.reservation_items?.name || 'Recurso'}</p>
                                            <p className="text-[10px] text-slate-500 mt-1">
                                                📅 {new Date(res.start_date + 'T12:00:00').toLocaleDateString('pt-BR')} às {res.start_time}
                                            </p>
                                            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Duração: {res.duration}</p>
                                            <p className="text-[9px] text-slate-400 mt-1 italic">Solicitado por: {res.solicitante}</p>
                                            {res.motivo && <p className="text-[9px] text-slate-500 mt-1 bg-slate-50 dark:bg-slate-850 p-1 rounded font-medium">📝 "{res.motivo}"</p>}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Coluna 3: Histórico */}
                        <div className="bg-slate-50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 space-y-4">
                            <h3 className="text-sm font-black text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center gap-1.5">
                                <ClockIcon className="w-4 h-4 text-slate-400" />
                                Histórico ({reservations.filter(r => r.status === 'rejected' || (r.status === 'approved' && r.start_date < new Date().toISOString().split('T')[0])).length})
                            </h3>
                            <div className="space-y-3 overflow-y-auto max-h-[70vh] pr-1">
                                {reservations.filter(r => r.status === 'rejected' || (r.status === 'approved' && r.start_date < new Date().toISOString().split('T')[0])).length === 0 ? (
                                    <p className="text-xs text-slate-400 italic py-4 text-center">Nenhum histórico registrado.</p>
                                ) : (
                                    reservations.filter(r => r.status === 'rejected' || (r.status === 'approved' && r.start_date < new Date().toISOString().split('T')[0])).map(res => {
                                        const isRejected = res.status === 'rejected';
                                        return (
                                            <div key={res.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-105 dark:border-slate-800 rounded-2xl shadow-sm hover:border-slate-300 transition-colors">
                                                <div className="flex justify-between items-start">
                                                    <p className="font-extrabold text-slate-850 dark:text-white text-xs">{res.reservation_items?.name || 'Recurso'}</p>
                                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                                                        isRejected ? 'bg-red-50 text-red-650 dark:bg-red-950/20' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-350'
                                                    }`}>
                                                        {isRejected ? 'Recusado' : 'Concluído'}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 mt-1">
                                                    📅 {new Date(res.start_date + 'T12:00:00').toLocaleDateString('pt-BR')} às {res.start_time}
                                                </p>
                                                <p className="text-[9px] text-slate-400 mt-1">Colaborador: {res.solicitante}</p>
                                                {isRejected && res.rejection_reason && (
                                                    <p className="text-[9px] text-red-650 bg-red-50 dark:bg-red-950/10 p-1.5 rounded mt-1.5 border border-red-100 dark:border-red-950/30">
                                                        ❌ Motivo: "{res.rejection_reason}"
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReservationsPage;
