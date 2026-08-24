import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { 
    BuildingOfficeIcon, 
    RocketLaunchIcon, 
    PlusIcon, 
    TrashIcon, 
    PencilIcon,
    SparklesIcon,
    XMarkIcon,
    ClockIcon
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
    created_at?: string;
}

const ReservationsManager: React.FC = () => {
    const { currentUser } = useAuth();
    const [items, setItems] = useState<ReservationItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<ReservationItem | null>(null);

    // Form states
    const [type, setType] = useState<'room' | 'vehicle'>('room');
    const [name, setName] = useState('');
    
    // Room specific
    const [capacity, setCapacity] = useState<number>(4);
    const [accessoriesInput, setAccessoriesInput] = useState('');
    
    // Vehicle specific
    const [plate, setPlate] = useState('');
    const [model, setModel] = useState('');
    const [brand, setBrand] = useState('');
    const [color, setColor] = useState('');

    // New states for requests management
    const [subTab, setSubTab] = useState<'items' | 'pending' | 'history'>('items');
    const [reservations, setReservations] = useState<any[]>([]);
    const [rejectingResId, setRejectingResId] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    useEffect(() => {
        if (currentUser?.company_id) {
            fetchItems();
            fetchReservations();
        }
    }, [currentUser]);

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
        } catch (err: any) {
            console.error('Erro ao buscar solicitações de reserva:', err);
        }
    };

    const handleApprove = async (res: any) => {
        try {
            // 1. Update reservation status
            const { error: updateErr } = await supabase
                .from('reservations')
                .update({ status: 'approved' })
                .eq('id', res.id);

            if (updateErr) throw updateErr;

            // 2. Calculate times and create calendar event
            const startObj = new Date(`${res.start_date}T${res.start_time}:00`);
            const num = parseInt(res.duration) || 1;
            const unit = res.duration.toLowerCase();
            const endObj = new Date(startObj.getTime());
            if (unit.includes('hora') || unit.includes('hour')) {
                endObj.setHours(endObj.getHours() + num);
            } else if (unit.includes('dia') || unit.includes('day')) {
                endObj.setDate(endObj.getDate() + num);
            } else if (unit.includes('semana') || unit.includes('week')) {
                endObj.setDate(endObj.getDate() + num * 7);
            } else {
                endObj.setHours(endObj.getHours() + num);
            }

            const combinedStartTime = startObj.toISOString();
            const combinedEndTime = endObj.toISOString();

            const eventPayload = {
                company_id: res.company_id,
                creator_id: res.user_id,
                title: `Reserva: ${res.reservation_items?.name} (${res.solicitante})`,
                description: `Reserva efetuada pelo colaborador ${res.solicitante}. Motivo: ${res.motivo || 'Não informado'}. Duração: ${res.duration}.`,
                date: res.start_date,
                start_time: combinedStartTime,
                end_time: combinedEndTime,
                category: 'Reserva',
                location: res.reservation_items?.type === 'room' ? res.reservation_items?.name : 'Veículo Corporativo',
                is_private: false
            };

            const { error: eventError } = await supabase
                .from('events')
                .insert(eventPayload);

            if (eventError) throw eventError;

            // 3. Notify applicant
            await supabase.from('notifications').insert({
                user_id: res.user_id,
                type: 'system',
                title: 'Reserva Aprovada 🟢',
                description: `Sua solicitação de reserva para ${res.reservation_items?.name || 'recurso'} no dia ${new Date(res.start_date + 'T12:00:00').toLocaleDateString('pt-BR')} às ${res.start_time} foi APROVADA!`,
                is_read: false,
                link: '/reservations'
            });

            alert('Reserva aprovada com sucesso!');
            fetchReservations();
        } catch (err: any) {
            alert('Erro ao aprovar reserva: ' + err.message);
        }
    };

    const handleReject = async (resId: string) => {
        if (!rejectionReason.trim()) {
            alert('Por favor, informe o motivo da recusa.');
            return;
        }

        const res = reservations.find(r => r.id === resId);
        if (!res) return;

        try {
            // 1. Update status and rejection reason
            const { error: updateErr } = await supabase
                .from('reservations')
                .update({ status: 'rejected', rejection_reason: rejectionReason.trim() })
                .eq('id', resId);

            if (updateErr) throw updateErr;

            // 2. Notify applicant
            await supabase.from('notifications').insert({
                user_id: res.user_id,
                type: 'system',
                title: 'Reserva Recusada 🔴',
                description: `Sua solicitação de reserva para ${res.reservation_items?.name || 'recurso'} foi recusada. Motivo: ${rejectionReason.trim()}`,
                is_read: false,
                link: '/reservations'
            });

            alert('Reserva recusada com sucesso!');
            setRejectingResId(null);
            setRejectionReason('');
            fetchReservations();
        } catch (err: any) {
            alert('Erro ao recusar reserva: ' + err.message);
        }
    };

    const fetchItems = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('reservation_items')
                .select('*')
                .eq('company_id', currentUser.company_id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setItems(data || []);
        } catch (err: any) {
            console.error('Erro ao buscar itens de reserva:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCreate = () => {
        setEditingItem(null);
        setType('room');
        setName('');
        setCapacity(4);
        setAccessoriesInput('');
        setPlate('');
        setModel('');
        setBrand('');
        setColor('');
        setShowModal(true);
    };

    const handleOpenEdit = (item: ReservationItem) => {
        setEditingItem(item);
        setType(item.type);
        setName(item.name);
        if (item.type === 'room') {
            setCapacity(item.details?.capacity || 4);
            setAccessoriesInput(item.details?.accessories?.join(', ') || '');
        } else {
            setPlate(item.details?.plate || '');
            setModel(item.details?.model || '');
            setBrand(item.details?.brand || '');
            setColor(item.details?.color || '');
        }
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        const details = type === 'room' 
            ? {
                capacity: Number(capacity),
                accessories: accessoriesInput.split(',').map(s => s.trim()).filter(Boolean)
              }
            : {
                plate: plate.trim(),
                model: model.trim(),
                brand: brand.trim(),
                color: color.trim()
              };

        const payload = {
            company_id: currentUser.company_id,
            type,
            name: name.trim(),
            details
        };

        try {
            if (editingItem) {
                const { error } = await supabase
                    .from('reservation_items')
                    .update(payload)
                    .eq('id', editingItem.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('reservation_items')
                    .insert(payload);
                if (error) throw error;
            }

            setShowModal(false);
            fetchItems();
        } catch (err: any) {
            alert('Erro ao salvar item: ' + err.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Tem certeza que deseja excluir este item? Isso pode afetar reservas existentes.')) return;
        try {
            const { error } = await supabase
                .from('reservation_items')
                .delete()
                .eq('id', id);
            if (error) throw error;
            fetchItems();
        } catch (err: any) {
            alert('Erro ao excluir item: ' + err.message);
        }
    };

    return (
        <div className="space-y-6">
            {/* Sub-tab switcher */}
            <div className="flex flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <button
                    type="button"
                    onClick={() => setSubTab('items')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                        subTab === 'items'
                            ? 'bg-brand-primary/10 border-brand-primary text-brand-primary shadow-sm dark:bg-emerald-950/20 dark:text-emerald-400'
                            : 'bg-white hover:bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                >
                    Recursos Cadastrados
                </button>
                <button
                    type="button"
                    onClick={() => setSubTab('pending')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                        subTab === 'pending'
                            ? 'bg-amber-500/10 border-amber-500 text-amber-600 shadow-sm dark:bg-amber-950/20 dark:text-amber-400'
                            : 'bg-white hover:bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                >
                    Solicitações Pendentes
                    {reservations.filter(r => r.status === 'pending').length > 0 && (
                        <span className="bg-amber-500 text-white rounded-full px-1.5 py-0.5 text-[9px] font-bold">
                            {reservations.filter(r => r.status === 'pending').length}
                        </span>
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => setSubTab('history')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                        subTab === 'history'
                            ? 'bg-slate-500/10 border-slate-500 text-slate-600 shadow-sm dark:bg-slate-850 dark:text-slate-350'
                            : 'bg-white hover:bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                >
                    Histórico de Reservas
                </button>
            </div>

            {subTab === 'items' && (
                <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 dark:text-gray-100 flex items-center gap-2">
                                <BuildingOfficeIcon className="w-6 h-6 text-brand-primary" />
                                Gerenciamento de Reservas
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-gray-400">Cadastre salas e veículos que ficarão disponíveis para reserva pelos colaboradores.</p>
                        </div>
                        <button
                            onClick={handleOpenCreate}
                            className="bg-brand-primary hover:bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-2xl shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 transition-all active:scale-95 text-sm"
                        >
                            <PlusIcon className="w-5 h-5" />
                            Novo Item Reservável
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center items-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="text-center py-12 bg-slate-50 dark:bg-slate-850 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                            <BuildingOfficeIcon className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhum item cadastrado</p>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Adicione salas ou veículos para os colaboradores fazerem reservas.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {items.map(item => (
                                <div key={item.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex items-start justify-between gap-4 hover:shadow-md transition-all">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            {item.type === 'room' ? (
                                                <span className="p-2 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl">
                                                    <BuildingOfficeIcon className="w-5 h-5" />
                                                </span>
                                            ) : (
                                                <span className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                                                    <RocketLaunchIcon className="w-5 h-5" />
                                                </span>
                                            )}
                                            <div>
                                                <h4 className="font-extrabold text-slate-800 dark:text-white text-sm">{item.name}</h4>
                                                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                                                    {item.type === 'room' ? 'Sala / Espaço' : 'Veículo'}
                                                </span>
                                            </div>
                                        </div>

                                        {item.type === 'room' ? (
                                            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 pl-1">
                                                <p><span className="font-bold">Capacidade:</span> {item.details?.capacity || 0} pessoas</p>
                                                {item.details?.accessories && item.details.accessories.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {item.details.accessories.map((acc, i) => (
                                                            <span key={i} className="bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold px-2 py-0.5 rounded-md text-slate-660 dark:text-slate-300">
                                                                {acc}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5 pl-1">
                                                <p><span className="font-bold">Modelo:</span> {item.details?.model || '-'} ({item.details?.brand || '-'})</p>
                                                <p><span className="font-bold">Placa:</span> {item.details?.plate || '-'}</p>
                                                {item.details?.color && <p><span className="font-bold">Cor:</span> {item.details.color}</p>}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleOpenEdit(item)}
                                            className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-650 dark:text-slate-300 rounded-xl text-xs border border-slate-100 dark:border-slate-800"
                                        >
                                            <PencilIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="p-2 bg-red-50 hover:bg-red-100 text-red-650 dark:bg-red-950/20 dark:hover:bg-red-950/40 rounded-xl text-xs"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {subTab === 'pending' && (
                <div className="space-y-4">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 dark:text-gray-100 flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                            Solicitações de Reserva Pendentes
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-gray-400">Analise e aprove ou recuse os pedidos de reserva pendentes da empresa.</p>
                    </div>

                    {reservations.filter(r => r.status === 'pending').length === 0 ? (
                        <div className="text-center py-12 bg-slate-55 dark:bg-slate-850 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                            <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Nenhuma solicitação pendente no momento.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {reservations.filter(r => r.status === 'pending').map(res => (
                                <div key={res.id} className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded">PENDENTE</span>
                                            <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">{res.reservation_items?.name || 'Recurso'}</h4>
                                        </div>
                                        <p className="text-xs text-slate-600 dark:text-slate-350">
                                            <strong>Solicitante:</strong> {res.solicitante}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            <strong>Data:</strong> {new Date(res.start_date + 'T12:00:00').toLocaleDateString('pt-BR')} às {res.start_time} ({res.duration})
                                        </p>
                                        {res.motivo && (
                                            <p className="text-xs italic text-slate-400 bg-slate-50 dark:bg-slate-850 p-2 rounded border dark:border-slate-800">
                                                "{res.motivo}"
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleApprove(res)}
                                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-500/10"
                                        >
                                            Aprovar
                                        </button>
                                        <button
                                            onClick={() => setRejectingResId(res.id)}
                                            className="px-4 py-2 bg-red-500 hover:bg-red-650 text-white font-bold rounded-xl text-xs shadow-md shadow-red-500/10"
                                        >
                                            Recusar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {subTab === 'history' && (
                <div className="space-y-4">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 dark:text-gray-100 flex items-center gap-2">
                            <ClockIcon className="w-6 h-6 text-slate-500" />
                            Histórico Geral de Reservas
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-gray-400">Veja o histórico completo de solicitações aprovadas, concluídas ou recusadas.</p>
                    </div>

                    {reservations.filter(r => r.status !== 'pending').length === 0 ? (
                        <div className="text-center py-12 bg-slate-55 dark:bg-slate-855 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                            <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Nenhum histórico disponível.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {reservations.filter(r => r.status !== 'pending').map(res => {
                                const isApproved = res.status === 'approved';
                                const isRejected = res.status === 'rejected';
                                return (
                                    <div key={res.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-2">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">{res.reservation_items?.name || 'Recurso'}</h4>
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                                isApproved ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-red-50 text-red-650 dark:bg-red-950/20 dark:text-red-400'
                                            }`}>
                                                {isApproved ? 'Aprovado' : isRejected ? 'Recusado' : res.status}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                                            <p><strong>Solicitante:</strong> {res.solicitante}</p>
                                            <p><strong>Data:</strong> {new Date(res.start_date + 'T12:00:00').toLocaleDateString('pt-BR')} às {res.start_time} ({res.duration})</p>
                                            {res.rejection_reason && (
                                                <p className="text-red-550 dark:text-red-400 font-semibold bg-red-50/50 dark:bg-red-950/10 p-2 rounded border border-red-100 dark:border-red-950/30">
                                                    ❌ <strong>Motivo da Recusa:</strong> "{res.rejection_reason}"
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Modal de Motivo de Recusa */}
            {rejectingResId && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 p-6 space-y-4">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white">Recusar Solicitação de Reserva</h3>
                        <p className="text-xs text-slate-500">Informe o motivo da recusa. Este motivo será enviado ao colaborador solicitante.</p>
                        
                        <textarea
                            required
                            rows={3}
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Ex: Sala reservada para treinamento interno / Veículo em manutenção programada..."
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-brand-primary text-slate-800 dark:text-white font-semibold resize-none"
                        />

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => { setRejectingResId(null); setRejectionReason(''); }}
                                className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-350 font-bold px-4 py-2 rounded-xl text-xs border"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => handleReject(rejectingResId)}
                                className="bg-red-500 hover:bg-red-600 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-md"
                            >
                                Confirmar Recusa
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Cadastro/Edição */}
            {showModal && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 animate-scale-in">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <SparklesIcon className="w-5 h-5 text-brand-primary" />
                                {editingItem ? 'Editar Item' : 'Cadastrar Item'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Tipo</label>
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value as any)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary text-slate-805 dark:text-white font-semibold"
                                >
                                    <option value="room">Sala / Espaço</option>
                                    <option value="vehicle">Veículo</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Nome / Identificação *</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={type === 'room' ? 'Ex: Sala de Reunião Direção' : 'Ex: Corolla Executivo'}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary text-slate-805 dark:text-white font-semibold"
                                />
                            </div>

                            {type === 'room' ? (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Capacidade Máxima de Pessoas</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={capacity}
                                            onChange={(e) => setCapacity(Number(e.target.value))}
                                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary text-slate-805 dark:text-white font-semibold"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Acessórios / Recursos</label>
                                        <input
                                            type="text"
                                            value={accessoriesInput}
                                            onChange={(e) => setAccessoriesInput(e.target.value)}
                                            placeholder="Ex: TV, Projetor, Quadro Branco (separado por vírgula)"
                                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary text-slate-805 dark:text-white font-semibold"
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Placa *</label>
                                            <input
                                                type="text"
                                                required={type === 'vehicle'}
                                                value={plate}
                                                onChange={(e) => setPlate(e.target.value)}
                                                placeholder="Ex: ABC-1234"
                                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary text-slate-805 dark:text-white font-semibold"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Modelo *</label>
                                            <input
                                                type="text"
                                                required={type === 'vehicle'}
                                                value={model}
                                                onChange={(e) => setModel(e.target.value)}
                                                placeholder="Ex: Corolla"
                                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary text-slate-805 dark:text-white font-semibold"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Marca</label>
                                            <input
                                                type="text"
                                                value={brand}
                                                onChange={(e) => setBrand(e.target.value)}
                                                placeholder="Ex: Toyota"
                                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary text-slate-805 dark:text-white font-semibold"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Cor</label>
                                            <input
                                                type="text"
                                                value={color}
                                                onChange={(e) => setColor(e.target.value)}
                                                placeholder="Ex: Prata"
                                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary text-slate-805 dark:text-white font-semibold"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold px-4 py-2 rounded-xl text-xs border border-slate-200/50 dark:border-slate-800"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="bg-brand-primary hover:bg-emerald-600 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-md shadow-brand-primary/10"
                                >
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReservationsManager;
