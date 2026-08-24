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
    InformationCircleIcon,
    CreditCardIcon,
    TagIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { CRMCustomer } from '../types';
import toast from 'react-hot-toast';

interface CRMSubscriptionFormProps {
    initialData?: any;
    onClose: () => void;
    onSave: () => void;
}

const CRMSubscriptionForm: React.FC<CRMSubscriptionFormProps> = ({ initialData, onClose, onSave }) => {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [customers, setCustomers] = useState<CRMCustomer[]>([]);
    const [loadingCustomers, setLoadingCustomers] = useState(false);

    const [formData, setFormData] = useState({
        customer_id: initialData?.customer_id || '',
        name: initialData?.name || '', // Nome da Assinatura
        stripe_plan_id: initialData?.stripe_plan_id || '', // Plano para Inscrição (Stripe)
        tax_1: initialData?.tax_1 || 0,
        tax_2: initialData?.tax_2 || 0,
        description: initialData?.description || '', // Descrição na Fatura
        include_description_in_item: initialData?.include_description_in_item || false,
        first_billing_date: initialData?.next_billing_cycle ? new Date(initialData.next_billing_cycle).toISOString().split('T')[0] : '', // Data da 1ª Fatura
        currency: initialData?.currency || 'BRL',
        quantity: initialData?.quantity || 1,
        terms: initialData?.terms || ''
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
            const dbData = {
                company_id: currentUser.company_id,
                customer_id: formData.customer_id,
                name: formData.name,
                description: formData.description,
                quantity: formData.quantity,
                currency: formData.currency,
                stripe_plan_id: formData.stripe_plan_id,
                terms: formData.terms,
                next_billing_cycle: formData.first_billing_date || null,
                status: 'active'
            };

            let query;
            if (initialData?.id) {
                query = supabase
                    .from('crm_subscriptions')
                    .update(dbData)
                    .eq('id', initialData.id);
            } else {
                query = supabase
                    .from('crm_subscriptions')
                    .insert([dbData]);
            }

            const { error } = await query;

            if (error) throw error;
            toast.success(initialData ? 'Assinatura atualizada com sucesso!' : 'Assinatura criada com sucesso!');
            onSave();
            onClose();
        } catch (error: any) {
            console.error('Error saving subscription:', error);
            if (error.code === '42P01') {
                toast.error('SQL Error: A tabela crm_subscriptions não foi encontrada.');
            } else {
                toast.error('Erro ao salvar assinatura.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 border border-white/10 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-800/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <DocumentTextIcon className="w-6 h-6 text-brand-primary" />
                            Nova Assinatura
                        </h2>
                        <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-bold">Configuração de Faturamento Recorrente e Contrato</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <XMarkIcon className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar max-h-[75vh]">

                    {/* Linha 1: Seleções principais */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                                <span className="text-red-500">*</span> Faturar Cliente
                            </label>
                            <div className="relative">
                                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <select 
                                    required
                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 pl-10 focus:ring-2 focus:ring-brand-primary outline-none text-sm dark:text-white appearance-none"
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
                                <span className="text-red-500">*</span> Plano para a Inscrição (Stripe)
                            </label>
                            <div className="relative">
                                <CreditCardIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <select
                                    required
                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 pl-10 focus:ring-2 focus:ring-brand-primary outline-none text-sm dark:text-white appearance-none"
                                    value={formData.stripe_plan_id}
                                    onChange={e => setFormData({ ...formData, stripe_plan_id: e.target.value })}
                                >
                                    <option value="">Nenhum plano selecionado</option>
                                    <option value="plano_mensal_basico">Mensal Básico R$ 99</option>
                                    <option value="plano_mensal_pro">Mensal Pro R$ 199</option>
                                    <option value="plano_anual">Anual com Desconto R$ 999</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Linha 2: Quantidade e Datas */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Moeda</label>
                            <div className="relative">
                                <BanknotesIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <select 
                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 pl-10 focus:ring-2 focus:ring-brand-primary outline-none text-sm dark:text-white appearance-none"
                                    value={formData.currency}
                                    onChange={e => setFormData({ ...formData, currency: e.target.value })}
                                >
                                    <option value="BRL">BRL - Real</option>
                                    <option value="USD">USD - Dólar</option>
                                    <option value="EUR">EUR - Euro</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Quantidade do Plano</label>
                            <input 
                                type="number"
                                min="1"
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none text-sm dark:text-white"
                                value={formData.quantity}
                                onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Data da Primeira Fatura</label>
                            <div className="relative">
                                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input 
                                    type="date"
                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 pl-10 focus:ring-2 focus:ring-brand-primary outline-none text-sm dark:text-white"
                                    value={formData.first_billing_date}
                                    onChange={e => setFormData({ ...formData, first_billing_date: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Descricao em Lote e Impostos */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-gray-100 dark:border-slate-800 pt-6 mt-6">

                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Nome da Assinatura (Contrato Interno)</label>
                                <div className="relative">
                                    <TagIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        required
                                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 pl-10 focus:ring-2 focus:ring-brand-primary outline-none text-sm dark:text-white"
                                        placeholder="Ex: Contrato de Suporte Nível 1"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Descrição Fatura (Opcional)</label>
                                <textarea
                                    rows={3}
                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none text-sm dark:text-white resize-none"
                                    placeholder="Descrição explícita apresentada na fatura recorrente gerada..."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                    checked={formData.include_description_in_item}
                                    onChange={e => setFormData({ ...formData, include_description_in_item: e.target.checked })}
                                />
                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Incluir as informações da assinatura na descrição do item da fatura</span>
                            </label>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Imposto (%) - Nível 1</label>
                                <select
                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none text-sm dark:text-white appearance-none"
                                    value={formData.tax_1}
                                    onChange={e => setFormData({ ...formData, tax_1: Number(e.target.value) })}
                                >
                                    <option value={0}>Sem Imposto (0%)</option>
                                    <option value={5}>ISS (5%)</option>
                                    <option value={10}>PIS/COFINS (10%)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Imposto (%) - Nível 2</label>
                                <select
                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none text-sm dark:text-white appearance-none"
                                    value={formData.tax_2}
                                    onChange={e => setFormData({ ...formData, tax_2: Number(e.target.value) })}
                                >
                                    <option value={0}>Sem Imposto 2 (0%)</option>
                                    <option value={2}>Outro (2%)</option>
                                    <option value={5}>Outro (5%)</option>
                                </select>
                            </div>
                        </div>

                    </div>

                    <div className="border-t border-gray-100 dark:border-slate-800 pt-6 mt-6">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Termos e Condições Específicos</label>
                        <div className="relative">
                            <DocumentTextIcon className="absolute left-3 top-4 w-4 h-4 text-gray-400" />
                            <textarea 
                                rows={4}
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 pl-10 focus:ring-2 focus:ring-brand-primary outline-none text-sm dark:text-white resize-none"
                                placeholder="Ao adicionar novos termos, os termos base padrão são completamente substituídos nas faturas dessa assinatura..."
                                value={formData.terms}
                                onChange={e => setFormData({ ...formData, terms: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-2xl flex gap-3 border border-blue-100 dark:border-blue-800/30">
                        <InformationCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                            Configurar uma assinatura fará com que o sistema gere as notas no ciclo estipulado pelo plano Stripe de forma automática.
                        </p>
                    </div>
                </form>

                <div className="p-6 border-t border-gray-100 dark:border-slate-800 flex items-center justify-end gap-3 bg-gray-50/50 dark:bg-slate-800/50">
                    <button 
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-slate-700 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={loading || !formData.stripe_plan_id || !formData.customer_id || !formData.name}
                        className="px-8 py-2.5 rounded-xl font-bold text-sm bg-brand-primary hover:bg-brand-primary/90 text-white transition-all shadow-lg flex items-center gap-2 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    >
                        {loading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-5 h-5" />}
                        Salvar Assinatura
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CRMSubscriptionForm;
