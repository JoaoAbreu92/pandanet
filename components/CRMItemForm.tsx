import React, { useState } from 'react';
import { 
    XMarkIcon, 
    CheckIcon,
    DocumentTextIcon,
    CurrencyDollarIcon,
    TagIcon,
    Square3Stack3DIcon,
    ScaleIcon,
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
        description: '',
        long_description: '',
        rate: 0,
        tax1: 0,
        tax2: 0,
        unit: '',
        group_name: ''
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
                    description: formData.description,
                    long_description: formData.long_description,
                    rate: formData.rate,
                    tax1_vlr: formData.tax1,
                    tax2_vlr: formData.tax2,
                    unit: formData.unit,
                    group_name: formData.group_name
                }]);

            if (error) throw error;
            toast.success('Item cadastrado com sucesso!');
            onSave();
            onClose();
        } catch (error) {
            console.error('Error saving item:', error);
            toast.error('Erro ao salvar item.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 border border-white/10">
                <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Adicionar novo item</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <XMarkIcon className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto no-scrollbar max-h-[80vh]">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                            <span className="text-red-500">*</span> Descrição
                        </label>
                        <input 
                            required
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none text-sm dark:text-white"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Descrição longa</label>
                        <textarea 
                            rows={3}
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none text-sm dark:text-white resize-none"
                            value={formData.long_description}
                            onChange={e => setFormData({ ...formData, long_description: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                                <span className="text-red-500">*</span> Tarifa - BRL (Moeda base)
                            </label>
                            <input 
                                required
                                type="number"
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none text-sm dark:text-white"
                                value={formData.rate}
                                onChange={e => setFormData({ ...formData, rate: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Unidade</label>
                            <input 
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none text-sm dark:text-white"
                                placeholder="Ex: hrs, un, etc"
                                value={formData.unit}
                                onChange={e => setFormData({ ...formData, unit: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Imposto 1 (%)</label>
                            <input 
                                type="number"
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none text-sm dark:text-white"
                                value={formData.tax1}
                                onChange={e => setFormData({ ...formData, tax1: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Imposto 2 (%)</label>
                            <input 
                                type="number"
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none text-sm dark:text-white"
                                value={formData.tax2}
                                onChange={e => setFormData({ ...formData, tax2: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Grupo de itens</label>
                        <select 
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none text-sm dark:text-white"
                            value={formData.group_name}
                            onChange={e => setFormData({ ...formData, group_name: e.target.value })}
                        >
                            <option value="">Nenhum selecionado</option>
                            <option value="Serviços">Serviços</option>
                            <option value="Produtos">Produtos</option>
                        </select>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button 
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            Fechar
                        </button>
                        <button 
                            type="submit"
                            disabled={loading}
                            className="px-8 py-2.5 rounded-xl font-bold text-sm bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white transition-all shadow-lg flex items-center gap-2"
                        >
                            {loading && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
                            Salvar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CRMItemForm;
