import React, { useState } from 'react';
import { 
    PlusIcon, 
    ArrowPathIcon, 
    MagnifyingGlassIcon, 
    FunnelIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    EllipsisVerticalIcon,
    PencilSquareIcon,
    TrashIcon,
    CheckCircleIcon,
    NoSymbolIcon,
    UserCircleIcon,
    IdentificationIcon
} from '../components/icons';

const CRMCustomers: React.FC<{ onNewCustomer: () => void }> = ({ onNewCustomer }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'active' | 'inactive' | 'all'>('all');

    const stats = [
        { label: 'Total de clientes', value: 10, color: 'text-blue-500' },
        { label: 'Clientes Ativos', value: 10, color: 'text-emerald-500' },
        { label: 'Clientes Inativos', value: 0, color: 'text-red-500' },
        { label: 'Contatos Ativos', value: 10, color: 'text-blue-500' },
        { label: 'Contatos Inativos', value: 0, color: 'text-red-500' },
        { label: 'Contatos logados hoje', value: 0, color: 'text-gray-500' },
    ];

    const customers = [
        { id: 1, company: 'Bednar LLC', contact: 'Ewell Bashirian', email: 'client@test.com', phone: '1-908-628-0123', active: true, groups: [], created: '27/02/2026 00:00:21' },
        { id: 9, company: 'Bergnaum-Raynor', contact: 'César Crona', email: 'giovanny.beier@example.com', phone: '1-415-867-3143', active: true, groups: ['Alto orçamento'], created: '27/02/2026 00:00:21' },
        { id: 6, company: 'Carroll-Hyatt', contact: 'Vidal Denesik', email: 'damaris12@example.com', phone: '(936) 355-5000', active: true, groups: ['Alto orçamento', 'Atacadista'], created: '27/02/2026 00:00:21' },
        { id: 7, company: 'Fay-Bogisich', contact: 'Dillon Hodkiewicz', email: 'hahn.ena@example.org', phone: '623-232-5028', active: true, groups: ['Atacadista'], created: '27/02/2026 00:00:21' },
        { id: 8, company: 'Gorczany, McLaughlin e Hills', contact: 'Zackary Oberbrunner', email: 'lilyan.haag@example.com', phone: '+19305944717', active: true, groups: ['Baixo orçamento', 'Alto orçamento'], created: '27/02/2026 00:00:21' },
        { id: 5, company: 'Hamill, Bosco e Rosenbaum', contact: 'Norval Leannon', email: 'annabel22@example.net', phone: '+1-708-733-4261', active: true, groups: ['Alto orçamento'], created: '27/02/2026 00:00:21' },
        { id: 3, company: 'Homem Ltda', contact: 'Bloco Rowland', email: 'terry.lang@example.org', phone: '580-204-2615', active: true, groups: ['Baixo orçamento'], created: '27/02/2026 00:00:21' },
        { id: 10, company: 'Runolfsdottir PLC', contact: 'Adrian Cartwright', email: 'gilbert.schoen@example.com', phone: '458-484-1347', active: true, groups: ['Baixo orçamento', 'Alto orçamento'], created: '27/02/2026 00:00:21' },
        { id: 2, company: 'Schmidt PLC', contact: 'Kameron Rutherford', email: 'doyle.yolanda@example.com', phone: '(423) 493-9891', active: true, groups: ['VIP', 'Atacadista'], created: '27/02/2026 00:00:21' },
        { id: 4, company: 'Stracke Ltda', contact: 'Ansel Wilderman', email: 'bwehner@example.com', phone: '1-770-500-9138', active: true, groups: ['VIP', 'Atacadista'], created: '27/02/2026 00:00:21' },
    ];

    return (
        <div className="p-4 md:p-8 bg-gray-50 dark:bg-slate-950 min-h-full space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Clientes</h1>
                <div className="flex items-center gap-1 text-xs text-blue-500 font-medium">
                    Contatos <ChevronRightIcon className="w-3 h-3" />
                </div>
            </div>

            {/* Stats Bar */}
            <div className="flex flex-wrap gap-4">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 px-6 py-4 rounded-xl shadow-sm flex-1 min-w-[180px]">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`text-lg font-bold ${stat.color}`}>{stat.value}</span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stat.label}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Actions & Filters */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onNewCustomer}
                        className="flex items-center gap-2 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-bold text-sm transition-all shadow-lg"
                    >
                        <PlusIcon className="w-4 h-4" />
                        Novo Cliente
                    </button>
                    <button className="flex items-center gap-2 text-gray-600 dark:text-slate-300 px-4 py-2.5 rounded-lg font-bold text-xs border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all">
                        <IdentificationIcon className="w-4 h-4" />
                        Importar clientes
                    </button>
                    <button className="flex items-center gap-2 text-gray-600 dark:text-slate-300 px-4 py-2.5 rounded-lg font-bold text-xs border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all ml-auto md:ml-0">
                        <FunnelIcon className="w-4 h-4" />
                        Filtros
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative flex-1 lg:w-80">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Procurar..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-2.5 pl-10 text-sm focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex items-center gap-1 border border-gray-200 dark:border-slate-700 rounded-lg p-1">
                        <button className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded text-gray-400"><EllipsisVerticalIcon className="w-4 h-4" /></button>
                        <button className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded text-gray-400"><ArrowPathIcon className="w-4 h-4" /></button>
                    </div>
                </div>
            </div>

            {/* Members Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-slate-800/50 text-[10px] uppercase text-gray-400 font-bold border-b border-gray-100 dark:border-slate-800">
                            <tr>
                                <th className="px-6 py-4 w-10">
                                    <input type="checkbox" className="rounded border-gray-300 dark:bg-slate-800" />
                                </th>
                                <th className="px-6 py-4">#</th>
                                <th className="px-6 py-4">Empresa</th>
                                <th className="px-6 py-4">Contato principal</th>
                                <th className="px-6 py-4">E-mail principal</th>
                                <th className="px-6 py-4">Telefone</th>
                                <th className="px-6 py-4">Ativo</th>
                                <th className="px-6 py-4">Grupos</th>
                                <th className="px-6 py-4">Data de criação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-slate-800 text-xs">
                            {customers.map((c) => (
                                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <input type="checkbox" className="rounded border-gray-300 dark:bg-slate-800" />
                                    </td>
                                    <td className="px-6 py-4 text-gray-400 font-medium">{c.id}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-700 dark:text-slate-200 group-hover:text-blue-500 cursor-pointer">{c.company}</span>
                                            <div className="flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="text-[10px] text-gray-400 hover:text-blue-500 font-bold uppercase transition-colors">Editar</button>
                                                <span className="text-gray-200 dark:text-slate-800">|</span>
                                                <button className="text-[10px] text-gray-400 hover:text-red-500 font-bold uppercase transition-colors">Excluir</button>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 items-center">
                                        <div className="flex items-center gap-2">
                                            <UserCircleIcon className="w-4 h-4 text-gray-300" />
                                            <span className="text-gray-600 dark:text-slate-300 font-medium">{c.contact}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-blue-500 hover:underline cursor-pointer">{c.email}</td>
                                    <td className="px-6 py-4 text-gray-500">{c.phone}</td>
                                    <td className="px-6 py-4">
                                        <div className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={c.active} readOnly className="sr-only peer" />
                                            <div className="w-9 h-5 bg-gray-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {c.groups.map((g, i) => (
                                                <span key={i} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 text-[10px] border border-gray-200 dark:border-slate-700">
                                                    {g}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-400">{c.created}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer Pagination */}
                <div className="p-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Mostrando 1 a {customers.length} de {customers.length} entradas</span>
                    <div className="flex items-center gap-2">
                        <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 disabled:opacity-30" disabled>
                            <span className="text-xs font-bold">Anterior</span>
                        </button>
                        <button className="w-8 h-8 rounded-lg bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20">1</button>
                        <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 disabled:opacity-30" disabled>
                            <span className="text-xs font-bold">Próximo</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CRMCustomers;
