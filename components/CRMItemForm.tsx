import React, { useState } from 'react';
import { 
    XMarkIcon, 
    CheckIcon,
    Bars3CenterLeftIcon,
    CurrencyDollarIcon,
    TagIcon,
    QueueListIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

interface CRMItemFormProps {
    onClose: () => void;
    onSave: () => void;
}

const CRMItemForm: React.FC<CRMItemFormProps> = ({ onClose, onSave }) => {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        name: '', // Displayed as *Descrição*
        description: '', // Displayed as *Descrição Longa*
        rate: 0,
        tax_1: 0,
        tax_2: 0,
        unit: 'unidade',
        item_group: ''
    });

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser?.company_id) return;

        try {
            setLoading(true);
            const { error } = await supabase
                .from('crm_items')
                .insert([{
                    company_id: currentUser.company_id,
                    description: formData.name,       // 'description' is the name column in crm_items
                    long_description: formData.description, // 'long_description' is the detailed description
                    rate: formData.rate,
                    tax_1: formData.tax_1,
                    tax_2: formData.tax_2,
                    unit: formData.unit,
                    item_group: formData.item_group,
                    group_name: formData.item_group,
                    status: 'active'
                }]);

            if (error) throw error;
            toast.success('Item criado com sucesso!');
            onSave();
            onClose();
        } catch (error: any) {
            console.error('Error saving item:', error);
            // Handling missing table or columns for seamless setup
            if (error.code === '42P01') {
                toast.error('SQL Error: A tabela crm_items não foi encontrada.');
            } else {
                toast.error('Erro ao salvar item.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 border border-white/10 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-800/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <QueueListIcon className="w-6 h-6 text-brand-primary" />
                            Adicionar Novo Item
                        </h2>
                        <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-bold">Cadastro de serviços ou produtos</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <XMarkIcon className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar max-h-[75vh]">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                            <span className="text-red-500">*</span> Descrição (Nome do Item)
                        </label>
                        <div className="relative">
                            <TagIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                required
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 pl-10 focus:ring-2 focus:ring-brand-primary outline-none text-sm dark:text-white"
                                placeholder="Consultoria Mensal, Servidor VPS, etc..."
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Descrição Longa</label>
                        <div className="relative">
                            <Bars3CenterLeftIcon className="absolute left-3 top-4 w-4 h-4 text-gray-400" />
                            <textarea
                                rows={3}
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 pl-10 focus:ring-2 focus:ring-brand-primary outline-none text-sm dark:text-white resize-none"
                                placeholder="Detalhes completos que aparecerão na fatura..."
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                                <span className="text-red-500">*</span> Tarifa / Preço Base
                            </label>
                            <div className="relative">
                                <CurrencyDollarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input 
                                    type="number"
                                    step="0.01"
                                    required
                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 pl-10 focus:ring-2 focus:ring-brand-primary outline-none text-sm dark:text-white"
                                    value={formData.rate}
                                    onChange={e => setFormData({ ...formData, rate: Number(e.target.value) })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Unidade</label>
                            <input 
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none text-sm dark:text-white"
                                placeholder="Ex: hrs, meses, unidades..."
                                value={formData.unit}
                                onChange={e => setFormData({ ...formData, unit: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Imposto 1 (%)</label>
                            <input 
                                type="number"
                                step="0.01"
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none text-sm dark:text-white"
                                value={formData.tax_1}
                                onChange={e => setFormData({ ...formData, tax_1: Number(e.target.value) })}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Imposto 2 (%)</label>
                            <input 
                                type="number"
                                step="0.01"
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none text-sm dark:text-white"
                                value={formData.tax_2}
                                onChange={e => setFormData({ ...formData, tax_2: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Grupo do Item / Categoria</label>
                        <select 
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none text-sm dark:text-white appearance-none"
                            value={formData.item_group}
                            onChange={e => setFormData({ ...formData, item_group: e.target.value })}
                        >
                            <option value="">Sem grupo</option>
                            <option value="Hardware">Hardware</option>
                            <option value="Software">Software</option>
                            <option value="Serviços">Serviços</option>
                        </select>
                    </div>

                </form>

                <div className="p-6 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        type="button"
                        onClick={handleSave}
                        disabled={loading || !formData.name}
                        className="px-6 py-2.5 text-sm font-semibold text-white bg-brand-primary hover:bg-brand-primary/90 rounded-xl shadow-lg hover:shadow-brand-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading ? (
                            <ArrowPathIcon className="w-5 h-5 animate-spin" />
                        ) : (
                            <CheckIcon className="w-5 h-5" />
                        )}
                        Salvar Item
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CRMItemForm;
