import React, { useState, useEffect } from 'react';
import { 
    XMarkIcon, 
    CheckIcon,
    ArrowPathIcon,
    UserIcon,
    CalendarIcon,
    BanknotesIcon,
    QueueListIcon,
    DocumentTextIcon,
    InformationCircleIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { CRMCustomer } from '../types';
import toast from 'react-hot-toast';

interface CRMSubscriptionFormProps {
    onClose: () => void;
    onSave: () => void;
}

const CRMSubscriptionForm: React.FC<CRMSubscriptionFormProps> = ({ onClose, onSave }) => {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [customers, setCustomers] = useState<CRMCustomer[]>([]);
    const [loadingCustomers, setLoadingCustomers] = useState(false);

    const [formData, setFormData] = useState({
        customer_id: '',
        name: '',
        description: '',
        quantity: 1,
        currency: 'BRL',
        stripe_plan_id: '',
        terms: '',
        next_billing_cycle: ''
    });

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        if (!currentUser?.company_id) return;
        try {
            setLoadingCustomers(true);
            const { data, error } = await supabase
                .from('crm_customers')
                .select('*')
                .eq('company_id', currentUser.company_id)
                .eq('status', 'active');
            
            if (error) throw error;
            setCustomers(data || []);
        } catch (error) {
            console.error('Error fetching customers:', error);
        } finally {
            setLoadingCustomers(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser?.company_id) return;

        try {
            setLoading(true);
            const { error } = await supabase
                .from('crm_subscriptions')
                .insert([{
                    company_id: currentUser.company_id,
                    customer_id: formData.customer_id,
                    name: formData.name,
                    description: formData.description,
                    quantity: formData.quantity,
                    currency: formData.currency,
                    stripe_plan_id: formData.stripe_plan_id,
                    terms: formData.terms,
                    next_billing_cycle: formData.next_billing_cycle || null,
                    status: 'active'
                }]);

            if (error) throw error;
            toast.success('Assinatura criada com sucesso!');
            onSave();
            onClose();
        } catch (error) {
            console.error('Error saving subscription:', error);
            toast.error('Erro ao salvar assinatura.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 border border-white/10 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-800/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Nova Assinatura</h2>
                        <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-bold">Configuração de fatura recorrente</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <XMarkIcon className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar max-h-[75vh]">
                    {/* Customer Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                                <span className="text-red-500">*</span> Selecionar Cliente
                            </label>
                            <div className="relative">
                                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <select 
                                    required
                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 pl-10 focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:text-white appearance-none"
                                    value={formData.customer_id}
                                    onChange={e => setFormData({ ...formData, customer_id: e.target.value })}
                                >
                                    <option value="">Selecione um cliente...</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                                <span className="text-red-500">*</span> Nome da Assinatura
                            </label>
                            <input 
                                required
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:text-white"
                                placeholder="Ex: Upgrade de armazenamento"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Moeda</label>
                            <div className="relative">
                                <BanknotesIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <select 
                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 pl-10 focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:text-white appearance-none"
                                    value={formData.currency}
                                    onChange={e => setFormData({ ...formData, currency: e.target.value })}
                                >
                                    <option value="BRL">BRL - Real</option>
                                    <option value="USD">USD - Dólar</option>
                                    <option value="EUR">EUR - Euro</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Quantidade</label>
                            <input 
                                type="number"
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:text-white"
                                value={formData.quantity}
                                onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Faturamento Futuro</label>
                            <div className="relative">
                                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input 
                                    type="date"
                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 pl-10 focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:text-white"
                                    value={formData.next_billing_cycle}
                                    onChange={e => setFormData({ ...formData, next_billing_cycle: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Descrição (Opcional)</label>
                        <textarea 
                            rows={3}
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:text-white resize-none"
                            placeholder="Descreva detalhes específicos da assinatura..."
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Termos e Condições</label>
                        <div className="relative">
                            <DocumentTextIcon className="absolute left-3 top-4 w-4 h-4 text-gray-400" />
                            <textarea 
                                rows={4}
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 pl-10 focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:text-white resize-none"
                                placeholder="Termos específicos para esta assinatura..."
                                value={formData.terms}
                                onChange={e => setFormData({ ...formData, terms: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl flex gap-3 border border-blue-100 dark:border-blue-800/30">
                        <InformationCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                            A assinatura criará faturas automáticas com base no ciclo de faturamento definido. Certifique-se de que os dados fiscais do cliente estão corretos.
                        </p>
                    </div>
                </form>

                <div className="p-6 border-t border-gray-100 dark:border-slate-800 flex items-center justify-end gap-3 bg-gray-50/50 dark:bg-slate-800/50">
                    <button 
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={loading}
                        className="px-8 py-2.5 rounded-xl font-bold text-sm bg-slate-800 dark:bg-blue-600 hover:bg-slate-700 dark:hover:bg-blue-700 text-white transition-all shadow-lg flex items-center gap-2"
                    >
                        {loading && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
                        Salvar Assinatura
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CRMSubscriptionForm;
