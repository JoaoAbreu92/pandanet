import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Plus, Edit2, Trash2, X, Check, FileText } from 'lucide-react';
import { useAuth } from '../../AuthContext';

export interface ChatTerminationReason {
    id: string;
    company_id: string;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
}

const TerminationReasonsTab: React.FC = () => {
    const { user, profile } = useAuth();
    const [reasons, setReasons] = useState<ChatTerminationReason[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingReason, setEditingReason] = useState<ChatTerminationReason | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        fetchReasons();
    }, []);

    const fetchReasons = async () => {
        const companyId = profile?.company_id || user?.user_metadata?.company_id;
        if (!companyId) return;

        setLoading(true);
        const { data, error } = await supabase
            .from('chat_termination_reasons')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: true });

        if (error) console.error('Error fetching reasons:', error);
        else setReasons(data || []);
        setLoading(false);
    };

    const handleOpenModal = (reason?: ChatTerminationReason) => {
        if (reason) {
            setEditingReason(reason);
            setName(reason.name);
            setDescription(reason.description || '');
        } else {
            setEditingReason(null);
            setName('');
            setDescription('');
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

        const reasonData = {
            name,
            description: description || null,
            company_id: companyId
        };

        let error;
        if (editingReason) {
            const { error: updateError } = await supabase
                .from('chat_termination_reasons')
                .update(reasonData)
                .eq('id', editingReason.id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase
                .from('chat_termination_reasons')
                .insert(reasonData);
            error = insertError;
        }

        if (error) {
            console.error('Error saving termination reason:', error);
            alert(`Erro ao salvar motivo: ${error.message}`);
        } else {
            fetchReasons();
            setIsModalOpen(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este motivo de fechamento?')) return;

        const { error } = await supabase
            .from('chat_termination_reasons')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting reason:', error);
            alert('Erro ao excluir motivo.');
        } else {
            fetchReasons();
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
                <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Motivos de Encerramento</h3>
                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400 opacity-70 mt-1">Configure os motivos para encerramento de atendimentos no chat.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center px-6 py-3 bg-emerald-500 text-white rounded-2xl hover:bg-emerald-600 transition-all duration-300 shadow-xl shadow-emerald-500/20 font-bold text-xs"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Motivo
                </button>
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-500 dark:text-gray-400 font-bold text-xs opacity-50">Carregando motivos...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {reasons.map((reason) => (
                        <div key={reason.id} className="bg-white/50 dark:bg-white/5 backdrop-blur-md p-4 sm:p-6 rounded-[1.2rem] sm:rounded-[2rem] border border-gray-100 dark:border-white/5 flex justify-between items-center hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 group">
                            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 mr-4">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-[0.8rem] sm:rounded-2xl flex items-center justify-center bg-emerald-500/10 shadow-inner group-hover:scale-110 transition-transform duration-500 shrink-0">
                                    <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-bold text-gray-900 dark:text-white tracking-tight text-base sm:text-lg leading-tight truncate">{reason.name}</h4>
                                    {reason.description && (
                                        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{reason.description}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button onClick={() => handleOpenModal(reason)} className="p-2 text-gray-400 hover:text-blue-500 bg-gray-100 dark:bg-white/5 hover:bg-blue-500/10 rounded-xl transition-all">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(reason.id)} className="p-2 text-gray-400 hover:text-red-500 bg-gray-100 dark:bg-white/5 hover:bg-red-500/10 rounded-xl transition-all">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {reasons.length === 0 && (
                        <div className="col-span-full bg-white/50 dark:bg-white/5 backdrop-blur-xl border border-dashed border-gray-200 dark:border-white/10 rounded-[1.2rem] sm:rounded-[2rem] p-10 sm:p-20 flex flex-col items-center text-center shadow-xl">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4 sm:mb-6 border border-white/5">
                                <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-gray-300 dark:text-gray-600" />
                            </div>
                            <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white tracking-tight">Nenhum motivo de encerramento cadastrado</h3>
                            <p className="text-[10px] sm:text-[11px] font-bold text-gray-500 dark:text-gray-400 mt-2 opacity-60">Comece criando os motivos de fechamento mais comuns.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-500">
                    <div className="bg-white dark:bg-slate-900/90 backdrop-blur-2xl rounded-[1.5rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20 dark:border-white/5 animate-in zoom-in duration-500">
                        <div className="p-4 sm:p-8 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-transparent">
                            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                                {editingReason ? 'Editar Motivo' : 'Novo Motivo'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-2xl transition-all duration-300 text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                <X className="w-5 h-5 sm:w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-4 sm:p-8 space-y-6 sm:space-y-8 overflow-y-auto custom-scrollbar">
                            <div>
                                <label className="block text-[10px] sm:text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-2 sm:mb-3">Nome / Título</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all font-medium placeholder-gray-400 text-sm"
                                    placeholder="Ex: Dúvida Resolvida"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] sm:text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-2 sm:mb-3">Descrição / Detalhes</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={2}
                                    className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all font-medium placeholder-gray-400 resize-none text-sm"
                                    placeholder="Detalhes adicionais sobre este motivo de encerramento..."
                                />
                            </div>
                        </div>

                        <div className="p-4 sm:p-8 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-transparent flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="w-full sm:w-auto justify-center px-6 sm:px-8 py-2.5 sm:py-3.5 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-white/10 rounded-2xl transition-all font-bold text-xs flex items-center"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                className="w-full sm:w-auto justify-center px-8 sm:px-10 py-2.5 sm:py-3.5 bg-emerald-500 text-white rounded-2xl hover:bg-emerald-600 transition-all font-bold text-xs shadow-xl shadow-emerald-500/20 flex items-center"
                            >
                                <Check className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 shrink-0" />
                                Salvar Motivo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TerminationReasonsTab;
