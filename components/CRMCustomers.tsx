import React, { useState, useEffect } from 'react';
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
import { useAuth } from './AuthContext';
import { supabase } from '../supabaseClient';
import { CRMCustomer } from '../types';
import { useToast } from './ToastContext';

interface CRMCustomersProps {
    onNewCustomer: () => void;
    onViewCustomer: (customer: CRMCustomer) => void;
}

const CRMCustomers: React.FC<CRMCustomersProps> = ({ onNewCustomer, onViewCustomer }) => {
    const { currentUser } = useAuth();
    const { showToast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [customers, setCustomers] = useState<CRMCustomer[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'active' | 'inactive' | 'all'>('all');

    const fetchCustomers = async () => {
        if (!currentUser?.company_id) return;

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('crm_customers')
                .select('*')
                .eq('company_id', currentUser.company_id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCustomers(data || []);
        } catch (error) {
            console.error('Error fetching customers:', error);
            showToast('Erro ao carregar clientes', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, [currentUser?.company_id]);

    const handleDelete = async (id: string) => {
        if (!window.confirm('Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.')) return;

        try {
            const { error } = await supabase
                .from('crm_customers')
                .delete()
                .eq('id', id);

            if (error) throw error;

            showToast('Cliente excluído com sucesso');
            setCustomers(customers.filter(c => c.id !== id));
        } catch (error) {
            console.error('Error deleting customer:', error);
            showToast('Erro ao excluir cliente', 'error');
        }
    };

    const activeCustomers = customers.filter(c => c.status === 'active');
    const inactiveCustomers = customers.filter(c => c.status === 'inactive');

    const stats = [
        { label: 'Total de clientes', value: customers.length, color: 'text-blue-500' },
        { label: 'Clientes Ativos', value: activeCustomers.length, color: 'text-emerald-500' },
        { label: 'Clientes Inativos', value: inactiveCustomers.length, color: 'text-red-500' },
        { label: 'Contatos Ativos', value: activeCustomers.length, color: 'text-blue-500' },
        { label: 'Contatos Inativos', value: inactiveCustomers.length, color: 'text-red-500' },
        { label: 'Contatos logados hoje', value: 0, color: 'text-gray-500' },
    ];

    const filteredCustomers = customers.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.email?.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesView = viewMode === 'all' ||
            (viewMode === 'active' && c.status === 'active') ||
            (viewMode === 'inactive' && c.status === 'inactive');
        return matchesSearch && matchesView;
    });

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
                        <button
                            onClick={fetchCustomers}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded text-gray-400"
                        >
                            <ArrowPathIcon className="w-4 h-4" />
                        </button>
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
                            {filteredCustomers.map((c, idx) => (
                                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <input type="checkbox" className="rounded border-gray-300 dark:bg-slate-800" />
                                    </td>
                                    <td className="px-6 py-4 text-gray-400 font-medium">{idx + 1}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span
                                                onClick={() => onViewCustomer(c)}
                                                className="font-bold text-gray-700 dark:text-slate-200 group-hover:text-blue-500 cursor-pointer transition-colors"
                                            >
                                                {c.name}
                                            </span>
                                            <div className="flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                <button
                                                    onClick={() => onViewCustomer(c)}
                                                    className="text-[10px] text-gray-400 hover:text-blue-500 font-bold uppercase transition-colors"
                                                >
                                                    View
                                                </button>
                                                <span className="text-gray-200 dark:text-slate-800">|</span>
                                                <button
                                                    onClick={() => onViewCustomer(c)} // Contacts tab later
                                                    className="text-[10px] text-gray-400 hover:text-blue-500 font-bold uppercase transition-colors"
                                                >
                                                    Contacts
                                                </button>
                                                <span className="text-gray-200 dark:text-slate-800">|</span>
                                                <button
                                                    onClick={() => handleDelete(c.id)}
                                                    className="text-[10px] text-gray-400 hover:text-red-500 font-bold uppercase transition-colors"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 items-center">
                                        <div className="flex items-center gap-2">
                                            <UserCircleIcon className="w-4 h-4 text-gray-300" />
                                            <span className="text-gray-600 dark:text-slate-300 font-medium">{c.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-blue-500 hover:underline cursor-pointer">{c.email || '-'}</td>
                                    <td className="px-6 py-4 text-gray-500">{c.phone || '-'}</td>
                                    <td className="px-6 py-4">
                                        <div className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={c.status === 'active'} readOnly className="sr-only peer" />
                                            <div className="w-9 h-5 bg-gray-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {c.groups?.map((g, i) => (
                                                <span key={i} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 text-[10px] border border-gray-200 dark:border-slate-700">
                                                    {g}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-400">{new Date(c.created_at).toLocaleDateString()}</td>
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
