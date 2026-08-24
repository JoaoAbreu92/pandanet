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

    useEffect(() => {
        if (currentUser?.company_id) {
            fetchItems();
        }
    }, [currentUser, activeTab]);

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
            // 1. Criar na tabela public.reservations
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
                selected_items: selectedItem.type === 'room' ? selectedAccessories : []
            };

            const { data: resData, error: resError } = await supabase
                .from('reservations')
                .insert(reservationPayload)
                .select()
                .single();

            if (resError) throw resError;

            // 2. Criar correspondente na tabela public.events (calendário geral)
            // Lembre-se: Reservas e aluguéis: verde (tag 'Reserva')
            const endHour = (Number(startTime.split(':')[0]) + (durationUnit === 'hours' ? Number(duration) : 1)).toString().padStart(2, '0');
            const endTimeCalculated = `${endHour}:00`;

            const eventPayload = {
                company_id: currentUser.company_id,
                creator_id: currentUser.id,
                title: `Reserva: ${selectedItem.name} (${solicitante})`,
                description: `Reserva efetuada pelo colaborador ${solicitante}. Motivo: ${motivo || 'Não informado'}. Duração: ${durationStr}. ${selectedItem.type === 'room' ? `Acessórios: ${selectedAccessories.join(', ') || 'Nenhum'}` : ''}`,
                date: startDate,
                start_time: startTime,
                end_time: durationUnit === 'hours' ? endTimeCalculated : '18:00',
                category: 'Reserva', // Para ter a cor verde
                location: selectedItem.type === 'room' ? selectedItem.name : 'Veículo Corporativo',
                notes: motivo,
                is_private: false
            };

            const { error: eventError } = await supabase
                .from('events')
                .insert(eventPayload);

            if (eventError) throw eventError;

            showToast('Reserva efetuada com sucesso!', 'success');
            // Reset form
            setMotivo('');
            setPeopleCount(1);
            setSelectedAccessories([]);
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
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-3xl p-6 md:p-8 shadow-xl grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Form de Reserva */}
                    <form onSubmit={handleSubmit} className="md:col-span-2 space-y-4">
                        <h3 className="text-lg font-black flex items-center gap-2 border-b dark:border-slate-800 pb-3">
                            <CalendarIcon className="w-5 h-5 text-brand-primary" />
                            Formulário de Solicitação
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                                    {activeTab === 'rooms' ? 'Escolha a Sala *' : 'Escolha o Veículo *'}
                                </label>
                                <select
                                    required
                                    value={selectedItemId}
                                    onChange={(e) => setSelectedItemId(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary text-slate-805 dark:text-white font-semibold"
                                >
                                    {items.map(item => (
                                        <option key={item.id} value={item.id}>{item.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Solicitante *</label>
                                <input
                                    type="text"
                                    required
                                    value={solicitante}
                                    onChange={(e) => setSolicitante(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary text-slate-805 dark:text-white font-semibold"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Motivo / Finalidade da Reserva</label>
                            <input
                                type="text"
                                value={motivo}
                                onChange={(e) => setMotivo(e.target.value)}
                                placeholder={activeTab === 'rooms' ? 'Ex: Reunião de alinhamento com cliente X' : 'Ex: Visita técnica ao cliente Y'}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary text-slate-805 dark:text-white font-semibold"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Data de Início *</label>
                                <input
                                    type="date"
                                    required
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary text-slate-805 dark:text-white font-semibold"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Horário de Início *</label>
                                <input
                                    type="time"
                                    required
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary text-slate-805 dark:text-white font-semibold"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Período / Duração *</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        value={duration}
                                        onChange={(e) => setDuration(e.target.value)}
                                        className="w-1/2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-primary text-slate-805 dark:text-white font-semibold"
                                    />
                                    <select
                                        value={durationUnit}
                                        onChange={(e) => setDurationUnit(e.target.value as any)}
                                        className="w-1/2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-2 py-2.5 text-xs focus:outline-none focus:border-brand-primary text-slate-805 dark:text-white font-semibold"
                                    >
                                        <option value="hours">Horas</option>
                                        <option value="days">Dias</option>
                                        <option value="weeks">Semanas</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {activeTab === 'rooms' && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Quantidade de Pessoas</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={peopleCount}
                                        onChange={(e) => setPeopleCount(Number(e.target.value))}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary text-slate-805 dark:text-white font-semibold"
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === 'rooms' && selectedItem?.details?.accessories && selectedItem.details.accessories.length > 0 && (
                            <div className="space-y-2 pt-2">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase block">Acessórios / Recursos Necessários</label>
                                <div className="flex flex-wrap gap-2">
                                    {selectedItem.details.accessories.map((acc, i) => {
                                        const isSelected = selectedAccessories.includes(acc);
                                        return (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => handleAccessoryToggle(acc)}
                                                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                                    isSelected
                                                        ? 'bg-brand-primary text-white border-brand-primary shadow-sm shadow-brand-primary/20'
                                                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-350 hover:bg-slate-100'
                                                }`}
                                            >
                                                {isSelected && <CheckIcon className="w-3.5 h-3.5" />}
                                                {acc}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="pt-4 border-t dark:border-slate-800 flex justify-end">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="bg-brand-primary hover:bg-emerald-600 disabled:opacity-55 text-white font-black px-8 py-3 rounded-2xl shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                            >
                                <PlusIcon className="w-5 h-5" />
                                {submitting ? 'Finalizando...' : 'Finalizar Reserva'}
                            </button>
                        </div>
                    </form>

                    {/* Detalhes do Item Selecionado */}
                    <div className="bg-slate-50 dark:bg-slate-950/40 rounded-3xl p-6 border dark:border-slate-850 space-y-4 h-fit">
                        <h4 className="font-extrabold text-slate-850 dark:text-white text-sm border-b dark:border-slate-800 pb-2 flex items-center gap-1.5">
                            <ClockIcon className="w-4.5 h-4.5 text-brand-primary" />
                            Detalhes do Recurso
                        </h4>

                        {selectedItem ? (
                            <div className="space-y-4">
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Recurso Selecionado</p>
                                    <p className="font-extrabold text-base text-slate-805 dark:text-white mt-0.5">{selectedItem.name}</p>
                                </div>

                                {selectedItem.type === 'room' ? (
                                    <>
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Capacidade Máxima</p>
                                            <p className="font-bold text-sm mt-0.5 flex items-center gap-1.5">
                                                <UsersIcon className="w-4 h-4 text-slate-500" />
                                                {selectedItem.details?.capacity || '-'} pessoas
                                            </p>
                                        </div>

                                        {selectedItem.details?.accessories && selectedItem.details.accessories.length > 0 && (
                                            <div>
                                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider mb-1.5">Itens Disponíveis nesta Sala</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {selectedItem.details.accessories.map((acc, i) => (
                                                        <span key={i} className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold px-2 py-0.5 rounded text-slate-600 dark:text-slate-300 border dark:border-slate-700">
                                                            {acc}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Modelo</p>
                                                <p className="font-bold text-xs mt-0.5">{selectedItem.details?.model || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Marca</p>
                                                <p className="font-bold text-xs mt-0.5">{selectedItem.details?.brand || '-'}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Placa</p>
                                                <p className="font-bold text-xs mt-0.5 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded w-fit border dark:border-slate-700 font-mono text-slate-700 dark:text-slate-350">
                                                    {selectedItem.details?.plate || '-'}
                                                </p>
                                            </div>
                                            {selectedItem.details?.color && (
                                                <div>
                                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Cor</p>
                                                    <p className="font-bold text-xs mt-0.5">{selectedItem.details.color}</p>
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
            )}
        </div>
    );
};

export default ReservationsPage;
