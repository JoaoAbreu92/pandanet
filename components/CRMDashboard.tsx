import React, { useState, useEffect } from 'react';
import {
    BanknotesIcon,
    UserGroupIcon,
    FolderIcon,
    CheckCircleIcon,
    ChartBarIcon,
    DocumentTextIcon,
    ArrowTrendingUpIcon,
    ClockIcon,
    ExclamationTriangleIcon,
    PlusIcon,
    ChevronRightIcon,
    PencilSquareIcon,
    XMarkIcon
} from '../components/icons';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { supabase } from '../supabaseClient';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

interface DashboardStats {
    totalInvoices: number;
    paidInvoices: number;
    convertedLeads: number;
    activeProjects: number;
    completedTasks: number;
    totalTasks: number;
}

const CRMDashboard: React.FC = () => {
    const { currentUser } = useAuth();
    const { t } = useLanguage();
    const [stats, setStats] = useState<DashboardStats>({
        totalInvoices: 11,
        paidInvoices: 7,
        convertedLeads: 7,
        activeProjects: 4,
        completedTasks: 46,
        totalTasks: 62
    });

    const [loading, setLoading] = useState(true);

    // Mock Data for Vision Charts
    const invoiceVisionData = [
        { name: 'Rascunho', value: 0, percentage: 0, color: '#94a3b8' },
        { name: 'Não enviado', value: 7, percentage: 63, color: '#475569' },
        { name: 'Não pago', value: 3, percentage: 27, color: '#ef4444' },
        { name: 'Parcialmente pago', value: 4, percentage: 36, color: '#f59e0b' },
        { name: 'Atrasado', value: 0, percentage: 0, color: '#dc2626' },
        { name: 'Pago', value: 4, percentage: 36, color: '#10b981' },
    ];

    const leadVisionData = [
        { name: 'Novo', value: 15, color: '#3b82f6' },
        { name: 'Contactado', value: 10, color: '#6366f1' },
        { name: 'Qualificado', value: 8, color: '#8b5cf6' },
        { name: 'Trabalhando', value: 12, color: '#10b981' },
        { name: 'Proposta Enviada', value: 5, color: '#f59e0b' },
        { name: 'Cliente', value: 7, color: '#84cc16' },
        { name: 'Leads Perdidos', value: 3, color: '#ef4444' },
    ];

    useEffect(() => {
        // Here we would fetch real data from Supabase
        const fetchStats = async () => {
            setLoading(false);
        };
        fetchStats();
    }, []);

    const StatWidget = ({ title, current, total, color, icon: Icon }: any) => (
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${color.bg} ${color.text}`}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <span className="font-semibold text-gray-700 dark:text-slate-300 text-sm">{title}</span>
                </div>
                <span className="text-lg font-bold text-gray-800 dark:text-white">{current}/{total}</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                    className={`h-full ${color.progress} transition-all duration-500`} 
                    style={{ width: `${(current / total) * 100}%` }}
                />
            </div>
        </div>
    );

    const VisionCard = ({ title, items, icon: Icon }: any) => (
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6 border-b border-gray-50 dark:border-slate-800 pb-3">
                <Icon className="w-5 h-5 text-gray-400" />
                <h3 className="font-bold text-gray-800 dark:text-white text-sm uppercase tracking-wider">{title}</h3>
            </div>
            <div className="space-y-4">
                {items.map((item: any, idx: number) => (
                    <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                            <span className="text-gray-600 dark:text-slate-400">{item.name}</span>
                            <span className="text-gray-400">{item.percentage}%</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-gray-50 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{ backgroundColor: item.color, width: `${item.percentage}%` }}
                                />
                            </div>
                            <span className="text-[10px] font-bold w-4 text-right" style={{ color: item.color }}>{item.value}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="p-4 md:p-8 bg-gray-50 dark:bg-slate-950 min-h-full space-y-6">
            {/* Header / Alert */}
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 p-4 rounded-xl flex items-center justify-between">
                <p className="text-emerald-700 dark:text-emerald-400 text-sm">
                    A demonstração é redefinida a cada 12 horas. Sinta-se à vontade para testar todos os recursos antes de comprar.
                </p>
                <span className="text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-900/50 px-2 py-1 rounded text-emerald-700 dark:text-emerald-400">Versão CRM: 1.0.0</span>
            </div>

            {/* Top Widgets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatWidget 
                    title="Faturas Aguardando Pagamento" 
                    current={stats.paidInvoices} 
                    total={stats.totalInvoices}
                    icon={BanknotesIcon}
                    color={{ bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-500', progress: 'bg-red-500' }}
                />
                <StatWidget 
                    title="Leads convertidos" 
                    current={stats.convertedLeads} 
                    total={50}
                    icon={ArrowTrendingUpIcon}
                    color={{ bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-500', progress: 'bg-emerald-500' }}
                />
                <StatWidget 
                    title="Projetos em andamento" 
                    current={stats.activeProjects} 
                    total={stats.activeProjects}
                    icon={FolderIcon}
                    color={{ bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-500', progress: 'bg-blue-500' }}
                />
                <StatWidget 
                    title="Tarefas concluídas" 
                    current={stats.completedTasks} 
                    total={stats.totalTasks}
                    icon={CheckCircleIcon}
                    color={{ bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-500', progress: 'bg-slate-600' }}
                />
            </div>

            {/* Middle Section: Visions & Tasks */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Vision Cards Column */}
                <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <VisionCard title="Visão geral da fatura" items={invoiceVisionData} icon={DocumentTextIcon} />
                    <VisionCard title="Visão geral da estimativa" items={[
                        { name: 'Rascunho', value: 4, percentage: 40, color: '#94a3b8' },
                        { name: 'Não enviado', value: 4, percentage: 40, color: '#475569' },
                        { name: 'Enviado', value: 1, percentage: 10, color: '#3b82f6' },
                        { name: 'Expirado', value: 0, percentage: 0, color: '#ef4444' },
                        { name: 'Recusado', value: 5, percentage: 50, color: '#dc2626' },
                        { name: 'Aceito', value: 0, percentage: 0, color: '#10b981' },
                    ]} icon={DocumentTextIcon} />
                    <VisionCard title="Visão geral da proposta" items={[
                        { name: 'Rascunho', value: 0, percentage: 0, color: '#94a3b8' },
                        { name: 'Enviado', value: 1, percentage: 50, color: '#3b82f6' },
                        { name: 'Abrir', value: 1, percentage: 50, color: '#0ea5e9' },
                        { name: 'Revisado', value: 0, percentage: 0, color: '#6366f1' },
                        { name: 'Recusado', value: 0, percentage: 0, color: '#ef4444' },
                        { name: 'Aceito', value: 0, percentage: 0, color: '#10b981' },
                    ]} icon={DocumentTextIcon} />

                    {/* Pending Totals Row */}
                    <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm">
                            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">Faturas pendentes</p>
                            <p className="text-xl font-bold text-gray-800 dark:text-white">$ 22.212,00</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm">
                            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">Faturas vencidas</p>
                            <p className="text-xl font-bold text-red-500">$ 0,00</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm">
                            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">Faturas pagas</p>
                            <p className="text-xl font-bold text-emerald-500">US$ 37.590,00</p>
                        </div>
                    </div>
                </div>

                {/* Sidebar Column: Task List & Lead Chart */}
                <div className="space-y-6">
                    {/* Items de Tarefas */}
                    <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col h-full max-h-[500px]">
                        <div className="p-4 border-b border-gray-50 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CheckCircleIcon className="w-5 h-5 text-gray-400" />
                                <h3 className="font-bold text-gray-800 dark:text-white text-sm">Meus itens de tarefas</h3>
                            </div>
                            <div className="flex items-center gap-3">
                                <button className="text-[10px] font-bold text-blue-500 hover:underline">Ver tudo</button>
                                <button className="text-[10px] font-bold text-blue-500 hover:underline">Novo para fazer</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-orange-500 uppercase tracking-wider">
                                    <ExclamationTriangleIcon className="w-3 h-3" />
                                    Últimas tarefas
                                </div>
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="group flex items-start gap-3 p-2 hover:bg-gray-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors border border-transparent hover:border-gray-100 dark:hover:border-slate-700">
                                        <input type="checkbox" className="mt-1 rounded border-gray-300 dark:border-slate-700 dark:bg-slate-800 text-blue-500" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-gray-700 dark:text-slate-300 line-clamp-2 leading-relaxed">Tarefa exemplo #{i}: Revisar propostas pendentes para novos clientes do setor de TI.</p>
                                            <p className="text-[10px] text-gray-400 mt-1">27/02/2026 00:00:22</p>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-1 text-gray-400 hover:text-blue-500"><PencilSquareIcon className="w-3 h-3" /></button>
                                            <button className="p-1 text-gray-400 hover:text-red-500"><XMarkIcon className="w-3 h-3" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-3 pt-4 border-t border-gray-50 dark:border-slate-800">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
                                    <CheckCircleIcon className="w-3 h-3" />
                                    Últimas tarefas concluídas
                                </div>
                                {[1, 2].map(i => (
                                    <div key={i} className="flex items-start gap-3 p-2 opacity-60">
                                        <div className="mt-1 w-4 h-4 rounded bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                                            <CheckCircleIcon className="w-3 h-3" />
                                        </div>
                                        <div className="flex-1 min-w-0 text-xs text-gray-500 line-through">Finalizado o suporte severamente.</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Lead Chart */}
                    <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-6 border-b border-gray-50 dark:border-slate-800 pb-3">
                            <ChartBarIcon className="w-5 h-5 text-gray-400" />
                            <h3 className="font-bold text-gray-800 dark:text-white text-sm uppercase tracking-wider">Visão geral dos leads</h3>
                        </div>
                        <div className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={leadVisionData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {leadVisionData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                        itemStyle={{ color: '#fff', fontSize: '10px' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-4">
                            {leadVisionData.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-slate-400">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span className="truncate">{item.name}</span>
                                    <span className="ml-auto font-bold">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Section: Tabs & Detailed Table */}
            <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center border-b border-gray-50 dark:border-slate-800 px-4">
                    <button className="px-6 py-4 text-xs font-bold text-blue-500 border-b-2 border-blue-500 bg-blue-50/30 dark:bg-blue-900/10">Minhas Tarefas</button>
                    <button className="px-6 py-4 text-xs font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800/50">Meus Projetos</button>
                    <button className="px-6 py-4 text-xs font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800/50">Meus lembretes</button>
                    <button className="px-6 py-4 text-xs font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800/50">Anúncios</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-slate-800/50 text-[10px] uppercase text-gray-400 font-bold border-b border-gray-100 dark:border-slate-800">
                            <tr>
                                <th className="px-6 py-3 font-bold">#</th>
                                <th className="px-6 py-3 font-bold">Tarefa</th>
                                <th className="px-6 py-3 font-bold">Status</th>
                                <th className="px-6 py-3 font-bold">Data de início</th>
                                <th className="px-6 py-3 font-bold">Prioridade</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-slate-800 text-xs">
                            {[1, 2, 3, 4].map(idx => (
                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4 text-gray-400">{idx * 15}</td>
                                    <td className="px-6 py-4">
                                        <p className="font-semibold text-gray-700 dark:text-slate-300">Corrigir um problema aberto em nosso software</p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">#4 - Redesenho do site - Carroll-Hyatt</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold">Em andamento</span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">27/02/2026</td>
                                    <td className="px-6 py-4">
                                        <span className="text-gray-400 font-medium">Baixa</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CRMDashboard;
