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
        totalInvoices: 0,
        paidInvoices: 0,
        convertedLeads: 0,
        activeProjects: 0,
        completedTasks: 0,
        totalTasks: 0
    });
    const [financials, setFinancials] = useState({
        pending: 0,
        overdue: 0,
        paid: 0
    });
    const [invoiceVision, setInvoiceVision] = useState<any[]>([]);
    const [estimateVision, setEstimateVision] = useState<any[]>([]);
    const [proposalVision, setProposalVision] = useState<any[]>([]);
    const [leadVision, setLeadVision] = useState<any[]>([]);
    const [recentTasks, setRecentTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!currentUser?.company_id) return;

            try {
                setLoading(true);

                // Fetch everything in parallel
                const [
                    { data: invoices },
                    { data: leads },
                    { data: projects },
                    { data: tasks },
                    { data: proposals },
                    { data: estimates }
                ] = await Promise.all([
                    supabase.from('crm_invoices').select('*').eq('company_id', currentUser.company_id),
                    supabase.from('crm_leads').select('*').eq('company_id', currentUser.company_id),
                    supabase.from('crm_projects').select('*').eq('company_id', currentUser.company_id),
                    supabase.from('crm_tasks').select('*').eq('company_id', currentUser.company_id),
                    supabase.from('crm_proposals').select('*').eq('company_id', currentUser.company_id),
                    supabase.from('crm_estimates').select('*').eq('company_id', currentUser.company_id)
                ]);

                // Calculate Stats
                const totalInv = invoices?.length || 0;
                const unpaidInv = invoices?.filter(i => i.status === 'unpaid' || i.status === 'overdue' || i.status === 'partially_paid').length || 0;
                const convLeads = leads?.filter(l => l.status === 'customer' || l.converted).length || 0;
                const activeProj = projects?.filter(p => p.status === 'in_progress' || p.status === 'not_started').length || 0;
                const completedT = tasks?.filter(t => t.status === 'completed').length || 0;

                setStats({
                    totalInvoices: totalInv,
                    paidInvoices: unpaidInv, // Using this for "Aguardando Pagamento" widget
                    convertedLeads: convLeads,
                    activeProjects: activeProj,
                    completedTasks: completedT,
                    totalTasks: tasks?.length || 0
                });

                // Financial Totals
                const pendingSum = invoices?.filter(i => i.status === 'unpaid' || i.status === 'partially_paid').reduce((acc, curr) => acc + Number(curr.total), 0) || 0;
                const overdueSum = invoices?.filter(i => i.status === 'overdue').reduce((acc, curr) => acc + Number(curr.total), 0) || 0;
                const paidSum = invoices?.filter(i => i.status === 'paid').reduce((acc, curr) => acc + Number(curr.total), 0) || 0;
                setFinancials({ pending: pendingSum, overdue: overdueSum, paid: paidSum });

                // Vision Data - Invoices
                const invStatuses = [
                    { id: 'draft', name: 'Rascunho', color: '#94a3b8' },
                    { id: 'unpaid', name: 'Não pago', color: '#ef4444' },
                    { id: 'partially_paid', name: 'Parcialmente pago', color: '#f59e0b' },
                    { id: 'overdue', name: 'Atrasado', color: '#dc2626' },
                    { id: 'paid', name: 'Pago', color: '#10b981' },
                ];
                setInvoiceVision(invStatuses.map(s => {
                    const count = invoices?.filter(i => i.status === s.id).length || 0;
                    return {
                        name: s.name,
                        value: count,
                        percentage: totalInv > 0 ? Math.round((count / totalInv) * 100) : 0,
                        color: s.color
                    };
                }));

                // Vision Data - Estimates
                const estStatuses = [
                    { id: 'draft', name: 'Rascunho', color: '#94a3b8' },
                    { id: 'sent', name: 'Enviado', color: '#3b82f6' },
                    { id: 'expired', name: 'Expirado', color: '#ef4444' },
                    { id: 'declined', name: 'Recusado', color: '#dc2626' },
                    { id: 'accepted', name: 'Aceito', color: '#10b981' },
                ];
                const totalEst = estimates?.length || 0;
                setEstimateVision(estStatuses.map(s => {
                    const count = estimates?.filter(e => e.status === s.id).length || 0;
                    return {
                        name: s.name,
                        value: count,
                        percentage: totalEst > 0 ? Math.round((count / totalEst) * 100) : 0,
                        color: s.color
                    };
                }));

                // Vision Data - Proposals
                const propStatuses = [
                    { id: 'draft', name: 'Rascunho', color: '#94a3b8' },
                    { id: 'sent', name: 'Enviado', color: '#3b82f6' },
                    { id: 'open', name: 'Aberto', color: '#0ea5e9' },
                    { id: 'revised', name: 'Revisado', color: '#6366f1' },
                    { id: 'declined', name: 'Recusado', color: '#ef4444' },
                    { id: 'accepted', name: 'Aceito', color: '#10b981' },
                ];
                const totalProp = proposals?.length || 0;
                setProposalVision(propStatuses.map(s => {
                    const count = proposals?.filter(p => p.status === s.id).length || 0;
                    return {
                        name: s.name,
                        value: count,
                        percentage: totalProp > 0 ? Math.round((count / totalProp) * 100) : 0,
                        color: s.color
                    };
                }));

                // Vision Data - Leads
                if (leads) {
                    const leadStatuses = [
                        { id: 'new', name: 'Novo', color: '#3b82f6' },
                        { id: 'contacted', name: 'Contactado', color: '#6366f1' },
                        { id: 'qualified', name: 'Qualificado', color: '#8b5cf6' },
                        { id: 'working', name: 'Trabalhando', color: '#10b981' },
                        { id: 'proposal_sent', name: 'Proposta Enviada', color: '#f59e0b' },
                        { id: 'customer', name: 'Cliente', color: '#84cc16' },
                        { id: 'lost', name: 'Leads Perdidos', color: '#ef4444' },
                    ];
                    setLeadVision(leadStatuses.map(s => ({
                        name: s.name,
                        value: leads.filter(l => l.status === s.id).length,
                        color: s.color
                    })));
                }

                // Recent Tasks
                if (tasks) {
                    const sortedTasks = [...tasks].sort((a, b) =>
                        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    ).slice(0, 5);
                    setRecentTasks(sortedTasks);
                }
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [currentUser?.company_id]);

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
                    <VisionCard title="Visão geral da fatura" items={invoiceVision} icon={DocumentTextIcon} />
                    <VisionCard title="Visão geral da estimativa" items={estimateVision} icon={DocumentTextIcon} />
                    <VisionCard title="Visão geral da proposta" items={proposalVision} icon={DocumentTextIcon} />

                    {/* Pending Totals Row */}
                    <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm">
                            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">Faturas pendentes</p>
                            <p className="text-xl font-bold text-gray-800 dark:text-white">
                                {financials.pending.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm">
                            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">Faturas vencidas</p>
                            <p className="text-xl font-bold text-red-500">
                                {financials.overdue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm">
                            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">Faturas pagas</p>
                            <p className="text-xl font-bold text-emerald-500">
                                {financials.paid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
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
                                {recentTasks.map((task, i) => (
                                    <div key={task.id || i} className="group flex items-start gap-3 p-2 hover:bg-gray-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors border border-transparent hover:border-gray-100 dark:hover:border-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={task.status === 'completed'}
                                            onChange={() => { }} // TODO: Implement status update
                                            className="mt-1 rounded border-gray-300 dark:border-slate-700 dark:bg-slate-800 text-blue-500"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-gray-700 dark:text-slate-300 line-clamp-2 leading-relaxed">{task.title}</p>
                                            <p className="text-[10px] text-gray-400 mt-1">{new Date(task.created_at).toLocaleString()}</p>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-1 text-gray-400 hover:text-blue-500"><PencilSquareIcon className="w-3 h-3" /></button>
                                            <button className="p-1 text-gray-400 hover:text-red-500"><XMarkIcon className="w-3 h-3" /></button>
                                        </div>
                                    </div>
                                ))}
                                {recentTasks.length === 0 && (
                                    <p className="text-xs text-gray-500 text-center py-4">Nenhuma tarefa recente encontrada.</p>
                                )}
                            </div>

                            <div className="space-y-3 pt-4 border-t border-gray-50 dark:border-slate-800">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
                                    <CheckCircleIcon className="w-3 h-3" />
                                    Últimas tarefas concluídas
                                </div>
                                {recentTasks.filter(t => t.status === 'completed').slice(0, 3).map((task, i) => (
                                    <div key={task.id || i} className="flex items-start gap-3 p-2 opacity-60">
                                        <div className="mt-1 w-4 h-4 rounded bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                                            <CheckCircleIcon className="w-3 h-3" />
                                        </div>
                                        <div className="flex-1 min-w-0 text-xs text-gray-500 line-through">{task.title}</div>
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
                                        data={leadVision}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {leadVision.map((entry: any, index: number) => (
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
                            {leadVision.map((item: any, idx: number) => (
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
                <div className="flex items-center border-b border-gray-50 dark:border-slate-800 px-4 overflow-x-auto no-scrollbar">
                    <button className="px-6 py-4 text-xs font-bold text-blue-500 border-b-2 border-blue-500 bg-blue-50/30 dark:bg-blue-900/10 whitespace-nowrap">Minhas Tarefas</button>
                    <button className="px-6 py-4 text-xs font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800/50 whitespace-nowrap">Meus Projetos</button>
                    <button className="px-6 py-4 text-xs font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800/50 whitespace-nowrap">Meus lembretes</button>
                    <button className="px-6 py-4 text-xs font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800/50 whitespace-nowrap">Anúncios</button>
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
                            {recentTasks.map((task, idx) => (
                                <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4 text-gray-400">{idx + 1}</td>
                                    <td className="px-6 py-4">
                                        <p className="font-semibold text-gray-700 dark:text-slate-300">{task.title}</p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">{task.rel_type ? `#${task.rel_id} - ${task.rel_type}` : 'Tarefa Geral'}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${task.status === 'completed' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' :
                                            task.status === 'in_progress' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' :
                                                'bg-gray-50 dark:bg-slate-800 text-gray-600'
                                            }`}>
                                            {task.status === 'not_started' ? 'Não Iniciado' :
                                                task.status === 'in_progress' ? 'Em Andamento' :
                                                    task.status === 'awaiting_feedback' ? 'Aguardando Feedback' :
                                                        task.status === 'completed' ? 'Concluído' : task.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">{task.start_date ? new Date(task.start_date).toLocaleDateString() : '-'}</td>
                                    <td className="px-6 py-4">
                                        <span className={`font-medium ${task.priority === 'urgent' ? 'text-red-600' :
                                            task.priority === 'high' ? 'text-orange-500' :
                                                task.priority === 'medium' ? 'text-blue-500' : 'text-gray-400'
                                            }`}>{task.priority}</span>
                                    </td>
                                </tr>
                            ))}
                            {recentTasks.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Nenhuma tarefa encontrada.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CRMDashboard;
