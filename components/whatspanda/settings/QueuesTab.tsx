import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { WhatsAppQueue } from '../../../types';
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react';
import { useAuth } from '../../AuthContext';

const QueuesTab: React.FC = () => {
    const { user, profile } = useAuth();
    const [queues, setQueues] = useState<WhatsAppQueue[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingQueue, setEditingQueue] = useState<WhatsAppQueue | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState('#3B82F6');

    // Business Hours State
    const [customHours, setCustomHours] = useState(false);
    const [businessHours, setBusinessHours] = useState<any>({
        mon: { start: '08:00', end: '18:00', closed: false },
        tue: { start: '08:00', end: '18:00', closed: false },
        wed: { start: '08:00', end: '18:00', closed: false },
        thu: { start: '08:00', end: '18:00', closed: false },
        fri: { start: '08:00', end: '18:00', closed: false },
        sat: { start: '08:00', end: '12:00', closed: true },
        sun: { start: '08:00', end: '12:00', closed: true }
    });
    const [awayMessage, setAwayMessage] = useState('');

    useEffect(() => {
        fetchQueues();
    }, []);

    const fetchQueues = async () => {
        const companyId = profile?.company_id || user?.user_metadata?.company_id;
        if (!companyId) return;

        setLoading(true);
        const { data, error } = await supabase
            .from('whatsapp_queues')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: true });
        
        if (error) console.error('Error fetching queues:', error);
        else setQueues(data || []);
        setLoading(false);
    };

    const handleOpenModal = (queue?: WhatsAppQueue) => {
        if (queue) {
            setEditingQueue(queue);
            setName(queue.name);
            setDescription(queue.description || '');
            setColor(queue.color);
            setCustomHours(!!queue.custom_hours);
            setAwayMessage(queue.away_message || '');
            if (queue.business_hours) {
                setBusinessHours(queue.business_hours);
            } else {
                setBusinessHours({
                    mon: { start: '08:00', end: '18:00', closed: false },
                    tue: { start: '08:00', end: '18:00', closed: false },
                    wed: { start: '08:00', end: '18:00', closed: false },
                    thu: { start: '08:00', end: '18:00', closed: false },
                    fri: { start: '08:00', end: '18:00', closed: false },
                    sat: { start: '08:00', end: '12:00', closed: true },
                    sun: { start: '08:00', end: '12:00', closed: true }
                });
            }
        } else {
            setEditingQueue(null);
            setName('');
            setDescription('');
            setColor('#3B82F6');
            setCustomHours(false);
            setAwayMessage('');
            setBusinessHours({
                mon: { start: '08:00', end: '18:00', closed: false },
                tue: { start: '08:00', end: '18:00', closed: false },
                wed: { start: '08:00', end: '18:00', closed: false },
                thu: { start: '08:00', end: '18:00', closed: false },
                fri: { start: '08:00', end: '18:00', closed: false },
                sat: { start: '08:00', end: '12:00', closed: true },
                sun: { start: '08:00', end: '12:00', closed: true }
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!name.trim()) return;

        const companyId = profile?.company_id || user?.user_metadata?.company_id;
        if (!companyId) {
            alert('Não foi possível identificar a empresa. Tente fazer login novamente.');
            return;
        }

        const queueData = {
            name,
            description,
            color,
            company_id: companyId,
            is_active: true,
            custom_hours: customHours,
            business_hours: customHours ? businessHours : null,
            away_message: customHours ? awayMessage : null
        };

        let error;
        if (editingQueue) {
            const { error: updateError } = await supabase
                .from('whatsapp_queues')
                .update(queueData)
                .eq('id', editingQueue.id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase
                .from('whatsapp_queues')
                .insert(queueData);
            error = insertError;
        }

        if (error) {
            console.error('Error saving queue:', error);
            alert(`Erro ao salvar fila: ${error.message}`);
        } else {
            fetchQueues();
            setIsModalOpen(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta fila?')) return;

        const { error } = await supabase
            .from('whatsapp_queues')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting queue:', error);
            alert('Erro ao excluir fila.');
        } else {
            fetchQueues();
        }
    };

    const handleToggleActive = async (queue: WhatsAppQueue) => {
        const { error } = await supabase
            .from('whatsapp_queues')
            .update({ is_active: !queue.is_active })
            .eq('id', queue.id);
        
        if (!error) fetchQueues();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Filas de Atendimento</h3>
                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400 opacity-70 uppercase tracking-widest mt-1">Gerencie as filas para organizar os atendimentos com eficiência.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center px-6 py-3 bg-emerald-500 text-white rounded-2xl hover:bg-emerald-600 transition-all duration-300 shadow-xl shadow-emerald-500/20 font-bold text-xs uppercase tracking-widest"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Fila
                </button>
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-xs opacity-50">Carregando filas...</div>
            ) : (
                    <div className="bg-white/50 dark:bg-white/5 backdrop-blur-md rounded-[2rem] border border-gray-100 dark:border-white/5 overflow-hidden shadow-2xl">
                        <table className="min-w-full divide-y divide-gray-100 dark:divide-white/5">
                            <thead className="bg-gray-50 dark:bg-transparent">
                            <tr>
                                    <th className="px-8 py-5 text-left text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">Nome</th>
                                    <th className="px-8 py-5 text-left text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">Descrição</th>
                                    <th className="px-8 py-5 text-left text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">Status</th>
                                    <th className="px-8 py-5 text-right text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">Ações</th>
                            </tr>
                        </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                {queues.map((queue) => (
                                 <tr key={queue.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                                     <td className="px-8 py-6 whitespace-nowrap">
                                        <div className="flex items-center">
                                             <div className="w-4 h-4 rounded-full mr-4 shadow-[0_0_12px_rgba(0,0,0,0.2)] group-hover:scale-125 transition-transform" style={{ backgroundColor: queue.color, boxShadow: `0 0 15px ${queue.color}40` }}></div>
                                                <span className="font-bold text-gray-900 dark:text-white tracking-tight text-base">{queue.name}</span>
                                        </div>
                                    </td>
                                     <td className="px-8 py-6 whitespace-nowrap text-[11px] font-bold text-gray-500 dark:text-gray-400 opacity-80 uppercase tracking-widest">
                                        {queue.description || '-'}
                                    </td>
                                     <td className="px-8 py-6 whitespace-nowrap">
                                        <button 
                                            onClick={() => handleToggleActive(queue)}
                                                className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-lg border transition-all ${queue.is_active
                                                     ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                                     : 'bg-red-500/10 text-red-500 border-red-500/20'
                                            }`}
                                        >
                                            {queue.is_active ? 'Ativo' : 'Inativo'}
                                        </button>
                                    </td>
                                     <td className="px-8 py-6 whitespace-nowrap text-right text-sm font-medium">
                                         <button onClick={() => handleOpenModal(queue)} className="p-2.5 text-blue-500 hover:text-white bg-blue-500/5 hover:bg-blue-500 rounded-xl transition-all duration-300 mr-3">
                                             <Edit2 className="w-4.5 h-4.5" />
                                        </button>
                                         <button onClick={() => handleDelete(queue.id)} className="p-2.5 text-red-500 hover:text-white bg-red-500/5 hover:bg-red-500 rounded-xl transition-all duration-300">
                                             <Trash2 className="w-4.5 h-4.5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                                {queues.length === 0 && (
                                <tr>
                                        <td colSpan={4} className="px-8 py-20 text-center text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] opacity-50">
                                        Nenhuma fila cadastrada.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-500">
                    <div className="bg-white dark:bg-slate-900/90 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20 dark:border-white/5 animate-in zoom-in duration-500">
                        <div className="p-8 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-transparent">
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                                {editingQueue ? 'Editar Fila' : 'Nova Fila'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-2xl transition-all duration-300 text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Nome da Fila</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-6 py-4 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all font-medium placeholder-gray-400"
                                    placeholder="Ex: Suporte Técnico"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Descrição</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full px-6 py-4 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all font-medium placeholder-gray-400 resize-none"
                                    rows={3}
                                    placeholder="Descrição opcional..."
                                />
                            </div>

                            {/* Horário de Funcionamento do Setor */}
                            <div className="space-y-4 border-t border-gray-100 dark:border-white/5 pt-6">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Expediente Personalizado</label>
                                        <p className="text-[10px] text-gray-400 mt-1">Defina horários de atendimento exclusivos para este setor.</p>
                                    </div>
                                    <div className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={customHours}
                                            onChange={(e) => setCustomHours(e.target.checked)}
                                            className="sr-only peer cursor-pointer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 dark:bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 cursor-pointer" />
                                    </div>
                                </div>

                                {customHours && (
                                    <div className="space-y-4 p-6 bg-gray-50/50 dark:bg-white/5 rounded-3xl border border-gray-100 dark:border-white/5 animate-in fade-in duration-300">
                                        <div className="space-y-3">
                                            {Object.entries({
                                                mon: 'Segunda-Feira',
                                                tue: 'Terça-Feira',
                                                wed: 'Quarta-Feira',
                                                thu: 'Quinta-Feira',
                                                fri: 'Sexta-Feira',
                                                sat: 'Sábado',
                                                sun: 'Domingo'
                                            }).map(([day, label]) => {
                                                const dayConfig = businessHours[day] || { start: '08:00', end: '18:00', closed: false };
                                                return (
                                                    <div key={day} className="flex items-center justify-between gap-4 py-2 border-b border-gray-100 dark:border-white/5 last:border-0">
                                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 w-28">{label}</span>
                                                        
                                                        <div className="flex items-center gap-4">
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={dayConfig.closed}
                                                                    onChange={(e) => {
                                                                        setBusinessHours({
                                                                            ...businessHours,
                                                                            [day]: { ...dayConfig, closed: e.target.checked }
                                                                        });
                                                                    }}
                                                                    className="rounded border-gray-300 dark:border-white/10 text-emerald-500 focus:ring-emerald-500/20 bg-transparent"
                                                                />
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Fechado</span>
                                                            </label>

                                                            {!dayConfig.closed && (
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="time"
                                                                        value={dayConfig.start}
                                                                        onChange={(e) => {
                                                                            setBusinessHours({
                                                                                ...businessHours,
                                                                                [day]: { ...dayConfig, start: e.target.value }
                                                                            });
                                                                        }}
                                                                        className="px-2.5 py-1 text-xs bg-gray-100 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-lg text-gray-800 dark:text-white"
                                                                    />
                                                                    <span className="text-gray-400 text-xs">às</span>
                                                                    <input
                                                                        type="time"
                                                                        value={dayConfig.end}
                                                                        onChange={(e) => {
                                                                            setBusinessHours({
                                                                                ...businessHours,
                                                                                [day]: { ...dayConfig, end: e.target.value }
                                                                            });
                                                                        }}
                                                                        className="px-2.5 py-1 text-xs bg-gray-100 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-lg text-gray-800 dark:text-white"
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="pt-4 border-t border-gray-100 dark:border-white/5">
                                            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Mensagem de Ausência do Setor</label>
                                            <textarea
                                                value={awayMessage}
                                                onChange={(e) => setAwayMessage(e.target.value)}
                                                rows={2}
                                                placeholder="Mensagem enviada se o contato interagir com este setor fora do horário..."
                                                className="w-full px-4 py-3 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all text-xs resize-none font-medium placeholder:text-gray-400"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">Identidade Visual (Cor)</label>
                                <div className="flex flex-wrap gap-4 p-6 bg-gray-50/50 dark:bg-white/5 rounded-3xl border border-gray-100 dark:border-white/5">
                                    {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'].map((c) => (
                                        <button
                                            key={c}
                                            onClick={() => setColor(c)}
                                            className={`w-10 h-10 rounded-2xl transition-all duration-300 transform ${color === c ? 'scale-125 ring-4 ring-white dark:ring-white/20 shadow-xl' : 'opacity-40 hover:opacity-100 hover:scale-110'}`}
                                            style={{ backgroundColor: c, boxShadow: color === c ? `0 0 20px ${c}60` : 'none' }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-8 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-transparent flex justify-end gap-4">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-8 py-3.5 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-white/10 rounded-2xl transition-all font-bold text-xs uppercase tracking-[0.2em]"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-10 py-3.5 bg-emerald-500 text-white rounded-2xl hover:bg-emerald-600 transition-all font-bold text-xs uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 flex items-center"
                            >
                                <Check className="w-5 h-5 mr-3" />
                                Salvar Fila
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QueuesTab;
