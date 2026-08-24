import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { CRMTask } from '../types';
import CRMTaskForm from './CRMTaskForm';
import toast from 'react-hot-toast';
import { PlusIcon, FunnelIcon, ArrowPathIcon, CheckCircleIcon, ArrowDownTrayIcon, MagnifyingGlassIcon, XMarkIcon } from '../components/icons';

const CRMTasks: React.FC = () => {
    const { currentUser } = useAuth();
    const [tasks, setTasks] = useState<CRMTask[]>([]);
    const [allEmployees, setAllEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<CRMTask | undefined>(undefined);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchTasks = async () => {
        if (!currentUser?.company_id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('crm_tasks')
                .select('*')
                .eq('company_id', currentUser.company_id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setTasks(data || []);
        } catch (error: any) {
            console.error('Error fetching tasks:', error);
            toast.error('Erro ao carregar tarefas');
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        if (!currentUser?.company_id) return;
        const { data } = await supabase
            .from('users')
            .select('id, full_name, avatar_url')
            .eq('company_id', currentUser.company_id);
        if (data) setAllEmployees(data);
    };

    useEffect(() => {
        fetchTasks();
        fetchUsers();
    }, [currentUser?.company_id]);

    const handleUpdateStatus = async (taskId: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from('crm_tasks')
                .update({ status: newStatus })
                .eq('id', taskId);
            
            if (error) throw error;
            
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as any } : t));
            toast.success('Status atualizado');
        } catch (error: any) {
            console.error('Error updating status:', error);
            toast.error('Erro ao atualizar status');
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!window.confirm('Tem certeza que deseja excluir esta tarefa?')) return;
        try {
            const { error } = await supabase.from('crm_tasks').delete().eq('id', taskId);
            if (error) throw error;
            setTasks(prev => prev.filter(t => t.id !== taskId));
            toast.success('Tarefa excluída');
        } catch (error: any) {
             console.error('Error deleting task:', error);
             toast.error('Erro ao excluir tarefa');
        }
    };

    // Derived Statistics
    const myTasks = tasks.filter(t => t.assigned_to?.includes(currentUser?.id || ''));
    
    const stats = [
        { id: 'not_started', label: 'Não iniciado', count: tasks.filter(t => t.status === 'not_started').length, myCount: myTasks.filter(t => t.status === 'not_started').length, color: 'text-gray-500', bg: 'bg-gray-100', border: 'border-gray-200' },
        { id: 'in_progress', label: 'Em andamento', count: tasks.filter(t => t.status === 'in_progress').length, myCount: myTasks.filter(t => t.status === 'in_progress').length, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200' },
        { id: 'testing', label: 'Testando', count: tasks.filter(t => t.status === 'testing').length, myCount: myTasks.filter(t => t.status === 'testing').length, color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-200' },
        { id: 'awaiting_feedback', label: 'Aguardando feedback', count: tasks.filter(t => t.status === 'awaiting_feedback').length, myCount: myTasks.filter(t => t.status === 'awaiting_feedback').length, color: 'text-lime-600', bg: 'bg-lime-50', border: 'border-lime-200' },
        { id: 'completed', label: 'Completo', count: tasks.filter(t => t.status === 'completed').length, myCount: myTasks.filter(t => t.status === 'completed').length, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' }
    ];

    const filteredTasks = tasks.filter(t => 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (t.tags && t.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
    );

    return (
        <div className="p-4 md:p-8 bg-gray-50 dark:bg-slate-950 min-h-full space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Tarefas</h1>
                <div className="flex items-center gap-1 text-xs text-blue-500 font-medium">
                    Visão geral das tarefas &rarr;
                </div>
            </div>

            {/* Top Kanban Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {stats.map(stat => (
                    <div key={stat.id} className={`bg-white dark:bg-slate-900 border ${stat.border} dark:border-slate-800 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow`}>
                        <div className="flex items-center gap-2 mb-2 text-sm font-bold">
                            <span className={stat.color}>{stat.count} {stat.label}</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">Minhas tarefas: {stat.myCount}</p>
                    </div>
                ))}
            </div>

            {/* List Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-8">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => { setEditingTask(undefined); setIsFormOpen(true); }}
                        className="flex items-center gap-2 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-bold text-sm shadow-lg transition-all"
                    >
                        <PlusIcon className="w-4 h-4" /> Nova Tarefa
                    </button>
                    <button className="p-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                        <FunnelIcon className="w-4 h-4" />
                    </button>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="flex bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                        <select className="bg-transparent text-sm text-gray-600 dark:text-slate-300 border-none focus:ring-0 py-2.5 pl-3 pr-8 w-20">
                            <option>25</option>
                            <option>50</option>
                            <option>100</option>
                        </select>
                        <div className="w-px bg-gray-200 dark:bg-slate-700"></div>
                        <button className="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">Exportar</button>
                        <div className="w-px bg-gray-200 dark:bg-slate-700"></div>
                        <button className="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">Ações em massa</button>
                        <div className="w-px bg-gray-200 dark:bg-slate-700"></div>
                        <button onClick={fetchTasks} className="px-3 py-2.5 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                            <ArrowPathIcon className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="relative flex-1 md:w-64">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Procurar..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden mt-6 min-h-[400px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-slate-800/50 text-[10px] uppercase text-gray-500 font-bold border-b border-gray-100 dark:border-slate-800">
                            <tr>
                                <th className="px-6 py-4 w-10">
                                    <input type="checkbox" className="rounded border-gray-300 text-blue-500 focus:ring-blue-500" />
                                </th>
                                <th className="px-6 py-4">#</th>
                                <th className="px-6 py-4">Nome</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Data de início</th>
                                <th className="px-6 py-4">Data de vencimento</th>
                                <th className="px-6 py-4">Atribuído a</th>
                                <th className="px-6 py-4">Etiquetas</th>
                                <th className="px-6 py-4">Prioridade</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-slate-800 text-xs">
                            {filteredTasks.map((task, idx) => (
                                <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <input type="checkbox" className="rounded border-gray-300 text-blue-500 focus:ring-blue-500" />
                                    </td>
                                    <td className="px-6 py-4 text-gray-400 font-medium">{idx + 1}</td>
                                    <td className="px-6 py-4">
                                        <button 
                                            onClick={() => { setEditingTask(task); setIsFormOpen(true); }}
                                            className="font-bold text-gray-700 dark:text-slate-200 hover:text-blue-500 transition-colors text-left"
                                        >
                                            {task.title}
                                        </button>
                                        {(task.rel_type || task.rel_id) && (
                                            <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wide">
                                                {task.rel_type && `#${task.rel_type}`} {task.rel_id && `- ${task.rel_id}`}
                                            </p>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <select 
                                            value={task.status}
                                            onChange={(e) => handleUpdateStatus(task.id, e.target.value)}
                                            className={`text-xs font-bold rounded px-2 py-1 border p-0 focus:ring-0 cursor-pointer outline-none bg-transparent ${
                                                task.status === 'not_started' ? 'text-gray-500 border-gray-200 bg-gray-50' :
                                                task.status === 'in_progress' ? 'text-blue-600 border-blue-200 bg-blue-50' :
                                                task.status === 'testing' ? 'text-purple-600 border-purple-200 bg-purple-50' :
                                                task.status === 'awaiting_feedback' ? 'text-lime-600 border-lime-200 bg-lime-50' :
                                                'text-emerald-600 border-emerald-200 bg-emerald-50'
                                            }`}
                                        >
                                            <option value="not_started">Não iniciado</option>
                                            <option value="in_progress">Em andamento</option>
                                            <option value="testing">Testando</option>
                                            <option value="awaiting_feedback">Aguardando feedback</option>
                                            <option value="completed">Completo</option>
                                        </select>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">
                                        {task.start_date ? new Date(task.start_date).toLocaleDateString('pt-BR') : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">
                                        {task.due_date ? new Date(task.due_date).toLocaleDateString('pt-BR') : '-'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center -space-x-2">
                                            {task.assigned_to?.map((assigneeId, j) => {
                                                const emp = allEmployees.find(e => e.id === assigneeId);
                                                return emp ? (
                                                    <div key={j} className="w-6 h-6 rounded-full border border-white dark:border-slate-800 bg-gray-100 overflow-hidden" title={emp.full_name}>
                                                        {emp.avatar_url ? (
                                                            <img src={emp.avatar_url} alt={emp.full_name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-gray-400 uppercase">
                                                                {emp.full_name.charAt(0)}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : null;
                                            })}
                                            {(!task.assigned_to || task.assigned_to.length === 0) && (
                                                <div className="w-6 h-6 rounded-full border border-dashed border-gray-300 dark:border-slate-600 flex items-center justify-center text-gray-300">
                                                    <PlusIcon className="w-3 h-3" />
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1 flex-wrap w-32">
                                            {task.tags?.map((tag, j) => (
                                                <span key={j} className="bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 text-[10px] font-medium px-2 py-0.5 rounded border border-gray-200 dark:border-slate-700">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`font-bold transition-colors ${
                                            task.priority === 'urgent' ? 'text-red-500 hover:text-red-600' :
                                            task.priority === 'high' ? 'text-orange-500 hover:text-orange-600' :
                                            task.priority === 'medium' ? 'text-blue-500 hover:text-blue-600' :
                                            'text-gray-400 hover:text-gray-500'
                                        }`}>
                                            {task.priority === 'urgent' ? 'Urgente' :
                                             task.priority === 'high' ? 'Alto' :
                                             task.priority === 'medium' ? 'Médio' : 'Baixo'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleDeleteTask(task.id)} className="text-gray-400 hover:text-red-500 font-bold p-1">
                                            <XMarkIcon className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredTasks.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={10} className="px-6 py-20 text-center text-gray-500">
                                        Nenhuma tarefa encontrada.
                                    </td>
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
                        <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Carregando tarefas...</p>
                    </div>
                )}
            </div>

            {isFormOpen && (
                <CRMTaskForm 
                    initialData={editingTask}
                    onClose={() => setIsFormOpen(false)}
                    onSave={() => {
                        setIsFormOpen(false);
                        fetchTasks();
                    }}
                />
            )}
        </div>
    );
};

export default CRMTasks;
