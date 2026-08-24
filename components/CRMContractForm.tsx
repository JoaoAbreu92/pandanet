import React, { useState, useEffect } from 'react';
import { 
    XMarkIcon, 
    CheckIcon,
    DocumentTextIcon,
    CalendarDaysIcon,
    UserIcon,
    CurrencyDollarIcon,
    TagIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { CRMCustomer } from '../types';
import toast from 'react-hot-toast';

interface CRMContractFormProps {
    initialData?: any;
    onClose: () => void;
    onSave: () => void;
}

const CRMContractForm: React.FC<CRMContractFormProps> = ({ initialData, onClose, onSave }) => {
    const { currentUser } = useAuth();
    const [customers, setCustomers] = useState<CRMCustomer[]>([]);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        customer_id: initialData?.customer_id || '',
        subject: initialData?.subject || '',
        contract_value: initialData?.contract_value || 0,
        contract_type: initialData?.contract_type || 'Service',
        start_date: initialData?.start_date || new Date().toISOString().split('T')[0],
        end_date: initialData?.end_date || '',
        description: initialData?.description || '',
        status: initialData?.status || 'active'
    });

    useEffect(() => {
        const fetchCustomers = async () => {
            if (!currentUser?.company_id) return;
            const { data } = await supabase
                .from('crm_customers')
                .select('*')
                .eq('company_id', currentUser.company_id)
                .order('name');
            if (data) setCustomers(data);
        };
        fetchCustomers();
    }, [currentUser]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser?.company_id) return;
        if (!formData.customer_id || !formData.subject) {
            toast.error('Preencha os campos obrigatórios.');
            return;
        }

        try {
            setLoading(true);
            const dbData = {
                customer_id: formData.customer_id,
                subject: formData.subject,
                contract_value: formData.contract_value,
                contract_type: formData.contract_type,
                start_date: formData.start_date,
                end_date: formData.end_date || null,
                description: formData.description,
                status: formData.status,
                company_id: currentUser.company_id
            };

            let query;
            if (initialData?.id) {
                query = supabase
                    .from('crm_contracts')
                    .update(dbData)
                    .eq('id', initialData.id);
            } else {
                query = supabase
                    .from('crm_contracts')
                    .insert([dbData]);
            }

            const { error } = await query;

            if (error) {
                console.error('Error saving contract:', error);
                toast.error(`Erro ao salvar contrato: ${error.message || 'Erro desconhecido'}`);
                throw error;
            }
            toast.success(initialData ? 'Contrato atualizado com sucesso!' : 'Contrato criado com sucesso!');
            onSave();
            onClose();
        } catch (error) {
            console.error('Error saving contract:', error);
            toast.error('Erro ao salvar contrato.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 border border-white/10 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <DocumentTextIcon className="w-6 h-6 text-brand-primary" />
                            {initialData?.id ? 'Editar Contrato' : 'Novo Contrato'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <XMarkIcon className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[70dvh]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Assunto *</label>
                            <input 
                                required
                                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none transition-all text-gray-900 dark:text-white"
                                value={formData.subject}
                                onChange={e => setFormData({...formData, subject: e.target.value})}
                                placeholder="Ex: Contrato de Manutenção 2024"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                <UserIcon className="w-4 h-4" /> Cliente *
                            </label>
                            <select 
                                required
                                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none transition-all text-gray-900 dark:text-white"
                                value={formData.customer_id}
                                onChange={e => setFormData({...formData, customer_id: e.target.value})}
                            >
                                <option value="">Selecionar Cliente</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                <CurrencyDollarIcon className="w-4 h-4" /> Valor do Contrato
                            </label>
                            <input 
                                type="number"
                                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none transition-all dark:text-white font-bold"
                                value={formData.contract_value}
                                onChange={e => setFormData({...formData, contract_value: Number(e.target.value)})}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                <TagIcon className="w-4 h-4" /> Tipo de Contrato
                            </label>
                            <select 
                                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none transition-all text-gray-900 dark:text-white"
                                value={formData.contract_type}
                                onChange={e => setFormData({...formData, contract_type: e.target.value})}
                            >
                                <option value="Service">Serviço</option>
                                <option value="Product">Produto</option>
                                <option value="Maintenance">Manutenção</option>
                                <option value="Other">Outro</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                <TagIcon className="w-4 h-4" /> Status
                            </label>
                            <select 
                                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none transition-all text-gray-900 dark:text-white"
                                value={formData.status}
                                onChange={e => setFormData({...formData, status: e.target.value})}
                            >
                                <option value="active">Ativo</option>
                                <option value="expired">Expirado</option>
                                <option value="cancelled">Cancelado</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                <CalendarDaysIcon className="w-4 h-4" /> Data de Início
                            </label>
                            <input 
                                type="date"
                                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none transition-all text-gray-900 dark:text-white"
                                value={formData.start_date}
                                onChange={e => setFormData({...formData, start_date: e.target.value})}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                <CalendarDaysIcon className="w-4 h-4" /> Data de Término
                            </label>
                            <input 
                                type="date"
                                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none transition-all text-gray-900 dark:text-white"
                                value={formData.end_date}
                                onChange={e => setFormData({...formData, end_date: e.target.value})}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 italic">Descrição</label>
                            <textarea 
                                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none transition-all dark:text-white min-h-[100px]"
                                value={formData.description}
                                onChange={e => setFormData({...formData, description: e.target.value})}
                                placeholder="Detalhes adicionais do contrato..."
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button 
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-all uppercase tracking-widest text-xs"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit"
                            disabled={loading}
                            className="bg-brand-primary text-white px-10 py-3 rounded-xl font-black hover:shadow-lg transition-all flex items-center gap-2 uppercase tracking-widest text-xs disabled:opacity-50"
                        >
                            {loading ? 'Salvando...' : <><CheckIcon className="w-4 h-4" /> {initialData?.id ? 'Atualizar Contrato' : 'Criar Contrato'}</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CRMContractForm;
