import React, { useState } from 'react';
import { 
    BanknotesIcon, 
    PlusIcon, 
    ArrowPathIcon, 
    MagnifyingGlassIcon, 
    FunnelIcon,
    ChevronRightIcon,
    DocumentTextIcon,
    CurrencyDollarIcon,
    CalendarDaysIcon
} from '../components/icons';

type SalesTab = 'proposals' | 'estimates' | 'invoices' | 'payments' | 'subscriptions' | 'contracts';

const CRMSales: React.FC<{ initialTab?: SalesTab }> = ({ initialTab = 'invoices' }) => {
    const [activeTab, setActiveTab] = useState<SalesTab>(initialTab);
    const [searchQuery, setSearchQuery] = useState('');

    const tabs = [
        { id: 'proposals', label: 'Propostas', icon: DocumentTextIcon },
        { id: 'estimates', label: 'Estimativas', icon: DocumentTextIcon },
        { id: 'invoices', label: 'Faturas', icon: BanknotesIcon },
        { id: 'payments', label: 'Pagamentos', icon: CurrencyDollarIcon },
        { id: 'subscriptions', label: 'Assinaturas', icon: CalendarDaysIcon },
        { id: 'contracts', label: 'Contratos', icon: DocumentTextIcon },
    ];

    const stats = {
        invoices: [
            { label: 'Não pago', count: 3, amount: 'US$ 1.956,00', color: 'text-red-500' },
            { label: 'Não enviado', count: 7, amount: 'US$ 32.256,00', color: 'text-gray-500' },
            { label: 'Parcialmente pago', count: 4, amount: 'US$ 2.450,00', color: 'text-orange-500' },
            { label: 'Atrasado', count: 0, amount: 'US$ 0,00', color: 'text-red-600' },
            { label: 'Pago', count: 4, amount: 'US$ 37.590,00', color: 'text-emerald-500' },
        ],
        contracts: [
            { label: 'Ativo', count: 5, color: 'text-emerald-500' },
            { label: 'Expirado', count: 1, color: 'text-red-500' },
            { label: 'Sobre a expiração', count: 2, color: 'text-orange-500' },
        ]
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
                    <button className="flex items-center gap-2 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-bold text-sm transition-all shadow-lg">
                        <PlusIcon className="w-4 h-4" />
                        Nova {tabs.find(t => t.id === activeTab)?.label.slice(0, -1)}
                    </button>
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
                                <th className="px-6 py-4">#</th>
                                <th className="px-6 py-4">Valor</th>
                                <th className="px-6 py-4">Imposto total</th>
                                <th className="px-6 py-4">Data</th>
                                <th className="px-6 py-4">Cliente</th>
                                <th className="px-6 py-4">Projeto</th>
                                <th className="px-6 py-4">Data de vencimento</th>
                                <th className="px-6 py-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-slate-800 text-xs">
                            <tr className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-4 font-bold text-blue-500">INV-000001</td>
                                <td className="px-6 py-4 font-bold text-gray-700 dark:text-slate-200">$ 4.412,00</td>
                                <td className="px-6 py-4 text-gray-400">$ 0,00</td>
                                <td className="px-6 py-4 text-gray-500">27/02/2026</td>
                                <td className="px-6 py-4 text-blue-500 font-medium">Carroll-Hyatt</td>
                                <td className="px-6 py-4 text-gray-400">-</td>
                                <td className="px-6 py-4 text-gray-500">27/03/2026</td>
                                <td className="px-6 py-4">
                                    <span className="px-2 py-1 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-[10px] font-bold">Parcialmente pago</span>
                                </td>
                            </tr>
                            <tr className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-4 font-bold text-blue-500">INV-000002</td>
                                <td className="px-6 py-4 font-bold text-gray-700 dark:text-slate-200">$ 1.250,50</td>
                                <td className="px-6 py-4 text-gray-400">$ 12,00</td>
                                <td className="px-6 py-4 text-gray-500">26/02/2026</td>
                                <td className="px-6 py-4 text-blue-500 font-medium">Schmidt PLC</td>
                                <td className="px-6 py-4 text-gray-400">PandaNet Redesign</td>
                                <td className="px-6 py-4 text-gray-500">26/03/2026</td>
                                <td className="px-6 py-4">
                                    <span className="px-2 py-1 rounded bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 text-[10px] font-bold">Rascunho</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
                    <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-full">
                        <MagnifyingGlassIcon className="w-8 h-8 text-gray-300" />
                    </div>
                    <div>
                        <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Fim dos dados</p>
                        <p className="text-gray-300 text-[10px] mt-1">Carregando mais informações do banco de dados...</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CRMSales;
