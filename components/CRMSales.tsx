import React, { useState, useEffect } from 'react';
import { 
    BanknotesIcon, 
    PlusIcon, 
    ArrowPathIcon, 
    MagnifyingGlassIcon, 
    FunnelIcon,
    ChevronRightIcon,
    DocumentTextIcon,
    CurrencyDollarIcon,
    CalendarDaysIcon,
    QueueListIcon
} from '../components/icons';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

type SalesTab = 'proposals' | 'estimates' | 'invoices' | 'payments' | 'subscriptions' | 'contracts' | 'items';

const CRMSales: React.FC<{
    initialTab?: SalesTab,
    onViewCustomer?: (id: string) => void,
    onNewRequest?: (type: string) => void,
    refreshTrigger?: number
}> = ({ initialTab = 'invoices', onViewCustomer, onNewRequest, refreshTrigger = 0 }) => {
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState<SalesTab>(initialTab);
    const [searchQuery, setSearchQuery] = useState('');
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const tabs = [
        { id: 'proposals', label: 'Propostas', icon: DocumentTextIcon, table: 'crm_proposals' },
        { id: 'estimates', label: 'Estimativas', icon: DocumentTextIcon, table: 'crm_estimates' },
        { id: 'invoices', label: 'Faturas', icon: BanknotesIcon, table: 'crm_invoices' },
        { id: 'items', label: 'Itens', icon: QueueListIcon, table: 'crm_items' },
        { id: 'payments', label: 'Pagamentos', icon: CurrencyDollarIcon, table: 'crm_payments' },
        { id: 'subscriptions', label: 'Assinaturas', icon: CalendarDaysIcon, table: 'crm_subscriptions' },
        { id: 'contracts', label: 'Contratos', icon: DocumentTextIcon, table: 'crm_contracts' },
    ];

    const fetchData = async () => {
        if (!currentUser?.company_id) return;

        try {
            setLoading(true);
            const currentTab = tabs.find(t => t.id === activeTab);
            if (!currentTab) return;

            let query;

            if (activeTab === 'items') {
                query = supabase
                    .from('crm_items')
                    .select('*')
                    .eq('company_id', currentUser.company_id);
            } else if (activeTab === 'contracts') {
                query = supabase
                    .from('crm_contracts')
                    .select('*, customer:crm_customers(name)')
                    .eq('company_id', currentUser.company_id);
            } else if (activeTab === 'payments') {
                query = supabase
                    .from('crm_payments')
                    .select('*, customer:crm_customers(name), invoice:crm_invoices(id)')
                    .eq('company_id', currentUser.company_id);
            } else {
                query = supabase
                    .from(currentTab.table)
                    .select('*, customer:crm_customers(name), project:crm_projects(name)')
                    .eq('company_id', currentUser.company_id);
            }

            const { data: result, error } = await query;

            if (error) throw error;
            setData(result || []);
        } catch (error) {
            console.error(`Error fetching ${activeTab}:`, error);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAsPaid = async (invoice: any) => {
        if (!currentUser?.company_id) return;

        try {
            setLoading(true);
            // 1. Update invoice status
            const { error: invError } = await supabase
                .from('crm_invoices')
                .update({ status: 'paid' })
                .eq('id', invoice.id);

            if (invError) throw invError;

            // 2. Create payment record
            const { error: payError } = await supabase
                .from('crm_payments')
                .insert([{
                    company_id: currentUser.company_id,
                    invoice_id: invoice.id,
                    customer_id: invoice.customer_id,
                    amount: invoice.total,
                    payment_mode: 'Manual',
                    date: new Date().toISOString().split('T')[0],
                    note: 'Pagamento registrado via sistema CRM'
                }]);

            if (payError) throw payError;

            fetchData();
        } catch (error) {
            console.error('Error marking as paid:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Deseja realmente excluir este registro permanentemente?')) return;

        try {
            const currentTab = tabs.find(t => t.id === activeTab);
            if (!currentTab) return;

            setLoading(true);
            const { error } = await supabase
                .from(currentTab.table)
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchData();
        } catch (error: any) {
            console.error('Error deleting:', error);
            alert('Erro ao excluir: ' + (error.message || error));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeTab, currentUser?.company_id, refreshTrigger]);

    const stats = {
        invoices: [
            { label: 'Total', count: data.length, amount: `R$ ${data.reduce((acc, curr) => acc + (curr.total || 0), 0).toLocaleString()}`, color: 'text-blue-500' },
            { label: 'Não pago', count: data.filter(d => d.status === 'unpaid').length, color: 'text-red-500' },
            { label: 'Pago', count: data.filter(d => d.status === 'paid').length, color: 'text-emerald-500' },
        ],
    };

    return (
        <div className="p-4 md:p-8 bg-gray-50 dark:bg-slate-950 min-h-full space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Vendas</h1>
                <div className="flex items-center gap-1 text-xs text-blue-500 font-medium">
                    Gestão Financeira <ChevronRightIcon className="w-3 h-3" /> {tabs.find(t => t.id === activeTab)?.label}
                </div>
            </div>

            {/* Quick Stats Overlay */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {(activeTab === 'invoices' ? stats.invoices : []).map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-4 rounded-xl shadow-sm">
                        <p className={`text-lg font-bold ${stat.color}`}>{stat.amount || stat.count}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stat.label}</p>
                        {stat.amount && <p className="text-[10px] text-gray-300 mt-1">{stat.count} faturas</p>}
                    </div>
                ))}
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as SalesTab)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
                            activeTab === tab.id 
                                ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-lg shadow-blue-500/10' 
                                : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* List Control actions */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    {activeTab !== 'payments' && (
                        <button
                            onClick={() => {
                                if (['proposals', 'estimates', 'invoices', 'subscriptions', 'items', 'contracts'].includes(activeTab)) {
                                    // Remove trailing 's' for simple type names
                                    const type = activeTab.endsWith('s') ? activeTab.slice(0, -1) : activeTab;
                                    onNewRequest?.(type);
                                }
                            }}
                            className="flex items-center gap-2 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-bold text-sm transition-all shadow-lg"
                        >
                            <PlusIcon className="w-4 h-4" />
                            Novo {tabs.find(t => t.id === activeTab)?.label.slice(0, -1)}
                        </button>
                    )}
                    <button className="flex items-center gap-2 text-gray-600 dark:text-slate-300 px-4 py-2.5 rounded-lg font-bold text-xs border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all">
                        <ArrowPathIcon className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative flex-1 lg:w-80">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Buscar..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-2.5 pl-10 text-sm focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 overflow-hidden min-h-[400px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-slate-800/50 text-[10px] uppercase text-gray-400 font-bold border-b border-gray-100 dark:border-slate-800">
                            <tr>
                                <th className="px-6 py-4">{activeTab === 'items' ? 'Nome do Item' : '#'}</th>
                                {activeTab === 'items' ? (
                                    <>
                                        <th className="px-6 py-4">Descrição</th>
                                        <th className="px-6 py-4">Taxa</th>
                                        <th className="px-6 py-4">Unidade</th>
                                        <th className="px-6 py-4">Grupo</th>
                                    </>
                                ) : activeTab === 'subscriptions' ? (
                                    <>
                                        <th className="px-6 py-4">Assinatura</th>
                                        <th className="px-6 py-4">Cliente</th>
                                        <th className="px-6 py-4">Quantidade</th>
                                        <th className="px-6 py-4">Próximo Faturamento</th>
                                    </>
                                ) : (
                                    <>
                                                <th className="px-6 py-4">Valor</th>
                                                <th className="px-6 py-4">Imposto total</th>
                                                <th className="px-6 py-4">Data</th>
                                                <th className="px-6 py-4">Cliente</th>
                                                <th className="px-6 py-4">Projeto</th>
                                                <th className="px-6 py-4">Data de vencimento</th>
                                    </>
                                )}
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-slate-800 text-xs">
                            {data.map((item, idx) => (
                                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors group">
                                    <td className="px-6 py-4 font-bold text-blue-500">
                                        {activeTab === 'invoices' ? `INV-${item.id.slice(0, 6)}` :
                                            activeTab === 'proposals' ? `PROP-${item.id.slice(0, 6)}` :
                                                activeTab === 'estimates' ? `EST-${item.id.slice(0, 6)}` :
                                                    activeTab === 'items' ? item.description : item.id.slice(0, 8)}
                                    </td>

                                    {activeTab === 'items' ? (
                                        <>
                                            <td className="px-6 py-4 font-bold text-gray-700 dark:text-slate-200">{item.long_description || '-'}</td>
                                            <td className="px-6 py-4 font-bold text-gray-700 dark:text-slate-200">
                                                {Number(item.rate || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </td>
                                            <td className="px-6 py-4 text-gray-500">{item.unit || '-'}</td>
                                            <td className="px-6 py-4 text-gray-500">{item.group_name || '-'}</td>
                                        </>
                                    ) : activeTab === 'subscriptions' ? (
                                        <>
                                            <td className="px-6 py-4 font-bold text-gray-700 dark:text-slate-200">{item.name}</td>
                                            <td className="px-6 py-4">
                                                <button onClick={() => onViewCustomer?.(item.customer_id)} className="text-blue-500 hover:underline">{item.customer?.name || item.customer_id}</button>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500">{item.quantity}</td>
                                            <td className="px-6 py-4 text-gray-500">
                                                {item.next_billing_cycle ? new Date(item.next_billing_cycle).toLocaleDateString() : '-'}
                                            </td>
                                            </>
                                        ) : (
                                            <>
                                                    <td className="px-6 py-4 font-bold text-gray-700 dark:text-slate-200">
                                                        {item.total ? `R$ ${item.total.toLocaleString()}` :
                                                            item.value ? `R$ ${item.value.toLocaleString()}` :
                                                                item.amount ? `R$ ${item.amount.toLocaleString()}` : '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-400">
                                                        {item.total_tax ? `R$ ${item.total_tax.toLocaleString()}` : 'R$ 0,00'}
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-500">
                                                        {new Date(item.date || item.created_at).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {item.customer?.name ? (
                                                            <button
                                                                onClick={() => onViewCustomer?.(item.customer_id)}
                                                                className="text-blue-500 font-medium hover:underline"
                                                            >
                                                                {item.customer.name}
                                                            </button>
                                                        ) : (
                                                            <span className="text-gray-400">{item.customer_id || '-'}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-400">
                                                        {item.project?.name || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-500">
                                                        {item.duedate || item.open_till ? new Date(item.duedate || item.open_till).toLocaleDateString() : '-'}
                                                    </td>
                                        </>
                                    )}

                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${['paid', 'accepted', 'active'].includes(item.status) ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' :
                                            ['unpaid', 'declined', 'expired'].includes(item.status) ? 'bg-red-100 dark:bg-red-900/30 text-red-600' :
                                                'bg-orange-100 dark:bg-orange-900/30 text-orange-600'
                                            }`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => alert("Visualização completa em breve!")}
                                                className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg text-gray-400 hover:text-blue-500 transition-colors"
                                                title="Ver Detalhes"
                                            >
                                                <DocumentTextIcon className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => alert("Janela de edição em breve!")}
                                                className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg text-gray-400 hover:text-emerald-500 transition-colors"
                                                title="Editar"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                                                title="Excluir"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                                            </button>

                                            {activeTab === 'invoices' && item.status === 'unpaid' && (
                                                <button
                                                    onClick={() => handleMarkAsPaid(item)}
                                                    className="ml-2 text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-2 py-1 rounded shadow-sm"
                                                >
                                                    Pagar
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {data.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-20 text-center text-gray-500">Nenhum registro encontrado.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {loading && (
                    <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
                        <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-full animate-pulse">
                            <ArrowPathIcon className="w-8 h-8 text-gray-300 animate-spin" />
                        </div>
                        <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Carregando dados...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CRMSales;
