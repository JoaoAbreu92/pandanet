import React, { useState, useEffect } from 'react';
import { 
    XMarkIcon, 
    PlusIcon, 
    TrashIcon, 
    DocumentTextIcon,
    ChevronDownIcon,
    CalendarDaysIcon,
    UserIcon,
    CurrencyDollarIcon,
    TagIcon,
    CheckIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../supabaseClient';
import type { CRMCustomer, Employee } from '../types';
import toast from 'react-hot-toast';

interface CRMItemLine {
    id: string;
    description: string;
    long_description: string;
    qty: number;
    rate: number;
    tax?: string;
    amount: number;
}

interface CRMFinanceFormProps {
    type: 'invoice' | 'proposal' | 'estimate';
    onClose: () => void;
    onSuccess: (data: any) => void;
    customers: CRMCustomer[];
    currentUser: Employee;
}

const CRMFinanceForm: React.FC<CRMFinanceFormProps> = ({ type, onClose, onSuccess, customers, currentUser }) => {
    const [formData, setFormData] = useState({
        subject: '',
        customer_id: '',
        date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        currency: 'BRL',
        status: 'draft',
        assigned_to: currentUser.id,
        items: [] as CRMItemLine[],
        discount: 0,
        discount_type: 'percent',
        adjustment: 0,
        billing_address: '',
        shipping_address: '',
        notes: '',
        terms: ''
    });

    const [subTotal, setSubTotal] = useState(0);
    const [total, setTotal] = useState(0);

    // Calculate totals whenever items, discount or adjustment changes
    useEffect(() => {
        const sub = formData.items.reduce((acc, item) => acc + (item.qty * item.rate), 0);
        setSubTotal(sub);

        let finalTotal = sub;
        if (formData.discount > 0) {
            if (formData.discount_type === 'percent') {
                finalTotal -= (sub * formData.discount) / 100;
            } else {
                finalTotal -= formData.discount;
            }
        }
        finalTotal += Number(formData.adjustment || 0);
        setTotal(finalTotal);
    }, [formData.items, formData.discount, formData.discount_type, formData.adjustment]);

    const addItem = () => {
        const newItem: CRMItemLine = {
            id: crypto.randomUUID(),
            description: '',
            long_description: '',
            qty: 1,
            rate: 0,
            amount: 0
        };
        setFormData(prev => ({ ...prev, items: [...prev.items, newItem] }));
    };

    const removeItem = (id: string) => {
        setFormData(prev => ({ ...prev, items: prev.items.filter(item => item.id !== id) }));
    };

    const updateItem = (id: string, field: keyof CRMItemLine, value: any) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.map(item => 
                item.id === id ? { ...item, [field]: value } : item
            )
        }));
    };

    const handleSave = async () => {
        if (!formData.customer_id) {
            toast.error('Por favor, selecione um cliente.');
            return;
        }

        try {
            // Logic to persist in Supabase would go here based on 'type'
            // For now, we call the onSuccess prop
            onSuccess({ ...formData, subTotal, total });
            toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} salva com sucesso!`);
            onClose();
        } catch (error) {
            console.error('Error saving finance form:', error);
            toast.error('Erro ao salvar. Verifique o console.');
        }
    };

    const title = {
        invoice: 'Criar Nova Fatura',
        proposal: 'Criar Nova Proposta',
        estimate: 'Criar Nova Estimativa'
    }[type];

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-7xl max-h-[95dvh] rounded-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 border border-white/10 overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-800/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <DocumentTextIcon className="w-6 h-6 text-brand-primary" />
                            {title}
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wider font-semibold">
                            Preencha os detalhes financeiros abaixo
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <XMarkIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                {/* Form Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                    {/* Top Section: Main Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                    <DocumentTextIcon className="w-4 h-4" /> Assunto
                                </label>
                                <input 
                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none transition-all dark:text-white"
                                    placeholder="Ex: Consultoria Mensal"
                                    value={formData.subject}
                                    onChange={e => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                    <UserIcon className="w-4 h-4" /> Cliente
                                </label>
                                <select 
                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none transition-all dark:text-white"
                                    value={formData.customer_id}
                                    onChange={e => setFormData(prev => ({ ...prev, customer_id: e.target.value }))}
                                >
                                    <option value="">Selecione um cliente</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                        <CalendarDaysIcon className="w-4 h-4" /> Data
                                    </label>
                                    <input 
                                        type="date"
                                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none transition-all dark:text-white"
                                        value={formData.date}
                                        onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                        <CalendarDaysIcon className="w-4 h-4" /> {type === 'proposal' ? 'Aberto até' : 'Vencimento'}
                                    </label>
                                    <input 
                                        type="date"
                                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none transition-all dark:text-white"
                                        value={formData.due_date}
                                        onChange={e => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                    <CurrencyDollarIcon className="w-4 h-4" /> Moeda
                                </label>
                                <select 
                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none transition-all dark:text-white"
                                    value={formData.currency}
                                    onChange={e => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                                >
                                    <option value="BRL">Real (BRL)</option>
                                    <option value="USD">Dólar (USD)</option>
                                    <option value="EUR">Euro (EUR)</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                    <TagIcon className="w-4 h-4" /> Status
                                </label>
                                <select 
                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none transition-all dark:text-white"
                                    value={formData.status}
                                    onChange={e => setFormData(prev => ({ ...prev, status: e.target.value }))}
                                >
                                    <option value="draft">Rascunho</option>
                                    <option value="sent">Enviado</option>
                                    <option value="open">Aberto</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                    <UserIcon className="w-4 h-4" /> Atribuído
                                </label>
                                <input 
                                    disabled
                                    className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none text-gray-500 cursor-not-allowed"
                                    value={currentUser.name}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Item Table */}
                    <div className="mt-8">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Itens do Documento</h3>
                            <button 
                                onClick={addItem}
                                className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-xl font-bold hover:shadow-lg hover:shadow-brand-primary/30 transition-all text-sm"
                            >
                                <PlusIcon className="w-5 h-5" /> Adicionar Item
                            </button>
                        </div>
                        
                        <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-slate-800">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 dark:bg-slate-800/80">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Item</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Descrição</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-24 text-center">Qtd</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Taxa</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Total</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                    {formData.items.map((item) => (
                                        <tr key={item.id}>
                                            <td className="px-6 py-4">
                                                <input 
                                                    className="w-full bg-transparent outline-none dark:text-white font-medium" 
                                                    placeholder="Nome do Item"
                                                    value={item.description}
                                                    onChange={e => updateItem(item.id, 'description', e.target.value)}
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <input 
                                                    className="w-full bg-transparent outline-none dark:text-white text-sm" 
                                                    placeholder="Descrição detalhada..."
                                                    value={item.long_description}
                                                    onChange={e => updateItem(item.id, 'long_description', e.target.value)}
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <input 
                                                    type="number"
                                                    className="w-full bg-transparent outline-none dark:text-white text-center font-bold"
                                                    value={item.qty}
                                                    onChange={e => updateItem(item.id, 'qty', Number(e.target.value))}
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <input 
                                                    type="number"
                                                    className="w-full bg-transparent outline-none dark:text-white font-bold"
                                                    value={item.rate}
                                                    onChange={e => updateItem(item.id, 'rate', Number(e.target.value))}
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-bold text-brand-primary">
                                                    {(item.qty * item.rate).toLocaleString('pt-BR', { style: 'currency', currency: formData.currency })}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-600 p-1">
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {formData.items.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                                Nenhum item adicionado. Clique em "Adicionar Item" para começar.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Totals Section */}
                    <div className="flex flex-col md:flex-row gap-8 justify-between bg-slate-50 dark:bg-slate-800/30 p-8 rounded-3xl border border-gray-100 dark:border-slate-800">
                        <div className="flex-1 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 italic">Observações</label>
                                <textarea 
                                    className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 min-h-[100px] outline-none transition-all dark:text-white text-sm"
                                    placeholder="Mensagem para o cliente..."
                                    value={formData.notes}
                                    onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="w-full md:w-80 space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500 font-bold uppercase tracking-wider">Sub Total:</span>
                                <span className="dark:text-white font-bold">{subTotal.toLocaleString('pt-BR', { style: 'currency', currency: formData.currency })}</span>
                            </div>
                            
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500 font-bold uppercase tracking-wider">Desconto:</span>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number"
                                            className="w-20 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1 text-right text-xs outline-none dark:text-white font-bold"
                                            value={formData.discount}
                                            onChange={e => setFormData(prev => ({ ...prev, discount: Number(e.target.value) }))}
                                        />
                                        <select 
                                            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs outline-none dark:text-white font-bold"
                                            value={formData.discount_type}
                                            onChange={e => setFormData(prev => ({ ...prev, discount_type: e.target.value as any }))}
                                        >
                                            <option value="percent">%</option>
                                            <option value="fixed">Vlr</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center text-sm border-b border-gray-200 dark:border-slate-700 pb-4">
                                <span className="text-gray-500 font-bold uppercase tracking-wider">Ajuste:</span>
                                <input 
                                    type="number"
                                    className="w-24 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1 text-right text-xs outline-none dark:text-white font-bold"
                                    value={formData.adjustment}
                                    onChange={e => setFormData(prev => ({ ...prev, adjustment: Number(e.target.value) }))}
                                />
                            </div>

                            <div className="flex justify-between items-center pt-2">
                                <span className="text-lg font-black text-gray-900 dark:text-white uppercase">Total:</span>
                                <span className="text-2xl font-black text-brand-primary">
                                    {total.toLocaleString('pt-BR', { style: 'currency', currency: formData.currency })}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex justify-end gap-4">
                    <button 
                        onClick={onClose}
                        className="px-6 py-3 rounded-2xl font-bold text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-slate-700 transition-all uppercase tracking-widest text-xs"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSave}
                        className="px-10 py-3 bg-brand-primary text-white rounded-2xl font-black hover:shadow-xl hover:shadow-brand-primary/40 transition-all flex items-center gap-2 uppercase tracking-widest text-xs"
                    >
                        <CheckIcon className="w-5 h-5" /> Salvar {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CRMFinanceForm;
