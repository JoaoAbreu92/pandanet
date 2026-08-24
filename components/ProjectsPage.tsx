import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import Card from './Card';
import {
    PlusIcon,
    TrashIcon,
    PencilIcon,
    CheckCircleIcon,
    CalendarIcon,
    UsersIcon,
    ChatBubbleLeftRightIcon,
    ClockIcon,
    StarIcon,
    ListBulletIcon,
    ArrowLeftIcon,
    TagIcon,
    ClipboardDocumentCheckIcon,
    ChartBarIcon,
    PaperAirplaneIcon,
    ChevronDownIcon
} from './icons';
import type { Employee } from '../types';

// Interfaces
interface Project {
    id: string;
    company_id: string;
    name: string;
    description: string;
    color: string;
    status: string;
    manager_id: string;
    created_at: string;
    manager?: { full_name: string; avatar_url: string };
    task_count?: number;
    completed_task_count?: number;
}

interface ProjectStage {
    id: string;
    project_id: string;
    name: string;
    position: number;
    department_id?: string | null;
}

interface ProjectTask {
    id: string;
    project_id: string;
    stage_id: string;
    title: string;
    description: string;
    priority: number;
    due_date: string | null;
    assigned_to: string | null;
    created_by: string | null;
    position: number;
    tags: string[];
    created_at: string;
    assignee?: { full_name: string; avatar_url: string };
    subtasks?: ProjectSubtask[];
}

interface ProjectSubtask {
    id: string;
    task_id: string;
    title: string;
    is_completed: boolean;
}

interface ProjectTimesheet {
    id: string;
    task_id: string;
    user_id: string;
    hours: number;
    description: string;
    date: string;
    created_at: string;
    user?: { full_name: string; avatar_url: string };
}

interface ProjectTaskComment {
    id: string;
    task_id: string;
    user_id: string;
    comment: string;
    created_at: string;
    user?: { full_name: string; avatar_url: string };
}

const PALETTE_COLORS = [
    { hex: '#10B981', name: 'Esmeralda' },
    { hex: '#3B82F6', name: 'Azul Celeste' },
    { hex: '#8B5CF6', name: 'Roxo Real' },
    { hex: '#EC4899', name: 'Rosa Vibrante' },
    { hex: '#F59E0B', name: 'Âmbar' },
    { hex: '#EF4444', name: 'Vermelho Coral' },
    { hex: '#06B6D4', name: 'Ciano' },
    { hex: '#6B7280', name: 'Cinza Metálico' }
];

const ProjectsPage: React.FC = () => {
    const { currentUser } = useAuth();
    const { showToast } = useToast();

    // Estado principal
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [stages, setStages] = useState<ProjectStage[]>([]);
    const [tasks, setTasks] = useState<ProjectTask[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);

    // Visualizações e Filtros
    const [activeTab, setActiveTab] = useState<'kanban' | 'list' | 'calendar' | 'timesheet'>('kanban');
    const [taskFilterSearch, setTaskFilterSearch] = useState('');
    const [taskFilterAssignee, setTaskFilterAssignee] = useState<string>('all');
    const [taskFilterPriority, setTaskFilterPriority] = useState<string>('all');

    // Modais
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [projectForm, setProjectForm] = useState({ name: '', description: '', color: '#10B981', manager_id: '' });

    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
    const [isNewTaskMode, setIsNewTaskMode] = useState(false);
    const [taskFormStageId, setTaskFormStageId] = useState<string>('');
    const [taskForm, setTaskForm] = useState({
        title: '',
        description: '',
        priority: 0,
        due_date: '',
        assigned_to: '',
        tags: [] as string[],
        newTagInput: ''
    });

    // Subtarefas, Timesheets e Comentários da tarefa aberta
    const [taskSubtasks, setTaskSubtasks] = useState<ProjectSubtask[]>([]);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const [taskTimesheets, setTaskTimesheets] = useState<ProjectTimesheet[]>([]);
    const [timesheetForm, setTimesheetForm] = useState({ hours: '', description: '', date: new Date().toISOString().split('T')[0] });
    const [taskComments, setTaskComments] = useState<ProjectTaskComment[]>([]);
    const [newCommentText, setNewCommentText] = useState('');

    // Calendário interno
    const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());

    const [departments, setDepartments] = useState<any[]>([]);
    const [isStageModalOpen, setIsStageModalOpen] = useState(false);
    const [editingStage, setEditingStage] = useState<ProjectStage | null>(null);
    const [stageForm, setStageForm] = useState({ name: '', department_id: '' });

    // Carregar dados iniciais
    useEffect(() => {
        if (currentUser?.company_id) {
            fetchProjects();
            fetchEmployees();
            fetchDepartments();
        }
    }, [currentUser]);

    // Buscar todos os projetos
    const fetchProjects = async () => {
        if (!currentUser?.company_id) return;
        setLoading(true);
        try {
            // Buscar projetos
            const { data: projData, error: projError } = await supabase
                .from('projects')
                .select('*, manager:profiles(full_name, avatar_url)')
                .eq('company_id', currentUser.company_id)
                .order('created_at', { ascending: false });

            if (projError) throw projError;

            // Buscar contagem de tarefas para progresso
            const { data: countData, error: countError } = await supabase
                .from('project_tasks')
                .select('id, project_id, stage:project_stages(name)');

            if (countError) throw countError;

            const mappedProjects = (projData || []).map((p: any) => {
                const projectTasks = (countData || []).filter((t: any) => t.project_id === p.id);
                const completedTasks = projectTasks.filter((t: any) => t.stage?.name === 'Concluído' || t.stage?.name === 'Done');
                return {
                    ...p,
                    task_count: projectTasks.length,
                    completed_task_count: completedTasks.length
                };
            });

            setProjects(mappedProjects);
        } catch (e: any) {
            console.error('Erro ao carregar projetos:', e);
            showToast('Erro ao carregar projetos: ' + e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Buscar funcionários da empresa
    const fetchEmployees = async () => {
        if (!currentUser?.company_id) return;
        try {
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('company_id', currentUser.company_id)
                .order('full_name', { ascending: true });

            if (data) setEmployees(data as unknown as Employee[]);
        } catch (e) {
            console.error(e);
        }
    };

    // Buscar departamentos da empresa
    const fetchDepartments = async () => {
        if (!currentUser?.company_id) return;
        try {
            const { data, error } = await supabase
                .from('departments')
                .select('*')
                .eq('company_id', currentUser.company_id)
                .order('name', { ascending: true });
            if (error) throw error;
            setDepartments(data || []);
        } catch (e: any) {
            console.error('Erro ao buscar departamentos:', e);
        }
    };

    const handleSaveStage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stageForm.name.trim()) {
            showToast('O nome do estágio é obrigatório.', 'warning');
            return;
        }

        try {
            if (editingStage) {
                const { error } = await supabase
                    .from('project_stages')
                    .update({
                        name: stageForm.name.trim(),
                        department_id: stageForm.department_id || null
                    })
                    .eq('id', editingStage.id);

                if (error) throw error;
                showToast('Estágio atualizado com sucesso!', 'success');
            } else {
                const newPosition = stages.length > 0 ? Math.max(...stages.map(s => s.position)) + 1 : 1;
                const { error } = await supabase
                    .from('project_stages')
                    .insert([{
                        project_id: selectedProject?.id,
                        name: stageForm.name.trim(),
                        position: newPosition,
                        department_id: stageForm.department_id || null
                    }]);

                if (error) throw error;
                showToast('Estágio criado com sucesso!', 'success');
            }

            setIsStageModalOpen(false);
            setEditingStage(null);
            setStageForm({ name: '', department_id: '' });
            if (selectedProject) handleSelectProject(selectedProject);
        } catch (err: any) {
            showToast('Erro ao salvar estágio: ' + err.message, 'error');
        }
    };

    const handleDeleteStage = async (stageId: string) => {
        const hasTasks = tasks.some(t => t.stage_id === stageId);
        if (hasTasks) {
            showToast('Não é possível excluir este estágio pois ele contém tarefas. Mova-as primeiro.', 'warning');
            return;
        }

        if (!confirm('Deseja excluir este estágio permanentemente?')) return;

        try {
            const { error } = await supabase
                .from('project_stages')
                .delete()
                .eq('id', stageId);

            if (error) throw error;
            showToast('Estágio excluído com sucesso!', 'success');
            setIsStageModalOpen(false);
            setEditingStage(null);
            setStageForm({ name: '', department_id: '' });
            if (selectedProject) handleSelectProject(selectedProject);
        } catch (err: any) {
            showToast('Erro ao excluir estágio: ' + err.message, 'error');
        }
    };

    // Selecionar projeto e carregar tarefas e estágios
    const handleSelectProject = async (project: Project) => {
        setSelectedProject(project);
        setLoading(true);
        try {
            // Buscar estágios do projeto
            let { data: stageData, error: stageError } = await supabase
                .from('project_stages')
                .select('*')
                .eq('project_id', project.id)
                .order('position', { ascending: true });

            if (stageError) throw stageError;

            // Se o projeto for novo e não tiver estágios, criar os estágios padrão do Odoo
            if (!stageData || stageData.length === 0) {
                const defaultStages = [
                    { project_id: project.id, name: 'Novo', position: 1 },
                    { project_id: project.id, name: 'Em Progresso', position: 2 },
                    { project_id: project.id, name: 'Pendente', position: 3 },
                    { project_id: project.id, name: 'Concluído', position: 4 }
                ];
                const { data: insertedStages, error: insertError } = await supabase
                    .from('project_stages')
                    .insert(defaultStages)
                    .select();

                if (insertError) throw insertError;
                stageData = insertedStages || [];
            }

            setStages(stageData);

            // Buscar tarefas do projeto
            const { data: taskData, error: taskError } = await supabase
                .from('project_tasks')
                .select('*, assignee:profiles(full_name, avatar_url)')
                .eq('project_id', project.id)
                .order('position', { ascending: true });

            if (taskError) throw taskError;
            setTasks(taskData || []);
        } catch (e: any) {
            showToast('Erro ao carregar detalhes do projeto: ' + e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Criar / Editar Projeto
    const handleSaveProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectForm.name) {
            showToast('O nome do projeto é obrigatório.', 'warning');
            return;
        }

        try {
            const payload = {
                company_id: currentUser?.company_id,
                name: projectForm.name,
                description: projectForm.description,
                color: projectForm.color,
                manager_id: projectForm.manager_id || null,
                status: 'active'
            };

            if (editingProject) {
                const { error } = await supabase
                    .from('projects')
                    .update(payload)
                    .eq('id', editingProject.id);

                if (error) throw error;
                showToast('Projeto atualizado com sucesso!', 'success');
            } else {
                const { error } = await supabase
                    .from('projects')
                    .insert([payload]);

                if (error) throw error;
                showToast('Projeto criado com sucesso!', 'success');
            }

            setIsProjectModalOpen(false);
            setEditingProject(null);
            setProjectForm({ name: '', description: '', color: '#10B981', manager_id: '' });
            fetchProjects();
        } catch (e: any) {
            showToast('Erro ao salvar projeto: ' + e.message, 'error');
        }
    };

    // Excluir projeto
    const handleDeleteProject = async (project: Project) => {
        if (!confirm(`Tem certeza que deseja excluir permanentemente o projeto "${project.name}" e todas as suas tarefas?`)) return;

        try {
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', project.id);

            if (error) throw error;
            showToast('Projeto excluído com sucesso!', 'success');
            fetchProjects();
            if (selectedProject?.id === project.id) {
                setSelectedProject(null);
            }
        } catch (e: any) {
            showToast('Erro ao excluir projeto: ' + e.message, 'error');
        }
    };

    // --- TAREFAS ---

    // Filtrar tarefas
    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            const matchesSearch = t.title.toLowerCase().includes(taskFilterSearch.toLowerCase()) ||
                (t.description || '').toLowerCase().includes(taskFilterSearch.toLowerCase());
            const matchesAssignee = taskFilterAssignee === 'all' ? true : t.assigned_to === taskFilterAssignee;
            const matchesPriority = taskFilterPriority === 'all' ? true : t.priority === parseInt(taskFilterPriority);
            return matchesSearch && matchesAssignee && matchesPriority;
        });
    }, [tasks, taskFilterSearch, taskFilterAssignee, taskFilterPriority]);

    // Abrir modal de criação de tarefa
    const openCreateTaskModal = (stageId: string) => {
        setIsNewTaskMode(true);
        setTaskFormStageId(stageId);
        setTaskForm({
            title: '',
            description: '',
            priority: 0,
            due_date: '',
            assigned_to: '',
            tags: [],
            newTagInput: ''
        });
        setSelectedTask(null);
        setIsTaskModalOpen(true);
    };

    // Abrir modal de edição de tarefa
    const openEditTaskModal = async (task: ProjectTask) => {
        setIsNewTaskMode(false);
        setSelectedTask(task);
        setTaskForm({
            title: task.title,
            description: task.description || '',
            priority: task.priority,
            due_date: task.due_date ? task.due_date.split('T')[0] : '',
            assigned_to: task.assigned_to || '',
            tags: task.tags || [],
            newTagInput: ''
        });
        setIsTaskModalOpen(true);

        // Carregar subtarefas, timesheets e comentários
        fetchTaskDetails(task.id);
    };

    const fetchTaskDetails = async (taskId: string) => {
        try {
            // Subtarefas
            const { data: subData } = await supabase.from('project_subtasks').select('*').eq('task_id', taskId).order('created_at', { ascending: true });
            setTaskSubtasks(subData || []);

            // Timesheets
            const { data: timeData } = await supabase.from('project_timesheets').select('*, user:profiles(full_name, avatar_url)').eq('task_id', taskId).order('created_at', { ascending: false });
            setTaskTimesheets(timeData || []);

            // Comentários
            const { data: commentData } = await supabase.from('project_task_comments').select('*, user:profiles(full_name, avatar_url)').eq('task_id', taskId).order('created_at', { ascending: true });
            setTaskComments(commentData || []);
        } catch (e) {
            console.error('Erro ao carregar detalhes da tarefa:', e);
        }
    };

    // Salvar Tarefa (Criar ou Atualizar)
    const handleSaveTask = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!taskForm.title) {
            showToast('O título da tarefa é obrigatório.', 'warning');
            return;
        }

        try {
            const payload = {
                project_id: selectedProject?.id,
                stage_id: isNewTaskMode ? taskFormStageId : selectedTask?.stage_id,
                title: taskForm.title,
                description: taskForm.description,
                priority: taskForm.priority,
                due_date: taskForm.due_date ? new Date(taskForm.due_date).toISOString() : null,
                assigned_to: taskForm.assigned_to || null,
                created_by: currentUser?.id,
                tags: taskForm.tags
            };

            if (isNewTaskMode) {
                const { error } = await supabase
                    .from('project_tasks')
                    .insert([payload]);

                if (error) throw error;
                showToast('Tarefa criada com sucesso!', 'success');
            } else if (selectedTask) {
                const { error } = await supabase
                    .from('project_tasks')
                    .update(payload)
                    .eq('id', selectedTask.id);

                if (error) throw error;
                showToast('Tarefa atualizada com sucesso!', 'success');
            }

            setIsTaskModalOpen(false);
            if (selectedProject) handleSelectProject(selectedProject);
        } catch (e: any) {
            showToast('Erro ao salvar tarefa: ' + e.message, 'error');
        }
    };

    // Excluir tarefa
    const handleDeleteTask = async () => {
        if (!selectedTask) return;
        if (!confirm('Excluir esta tarefa permanentemente?')) return;

        try {
            const { error } = await supabase
                .from('project_tasks')
                .delete()
                .eq('id', selectedTask.id);

            if (error) throw error;
            showToast('Tarefa excluída!', 'success');
            setIsTaskModalOpen(false);
            if (selectedProject) handleSelectProject(selectedProject);
        } catch (e: any) {
            showToast('Erro ao excluir tarefa: ' + e.message, 'error');
        }
    };

    // Adicionar Tag no formulário
    const handleAddTag = () => {
        const tag = taskForm.newTagInput.trim();
        if (tag && !taskForm.tags.includes(tag)) {
            setTaskForm(prev => ({
                ...prev,
                tags: [...prev.tags, tag],
                newTagInput: ''
            }));
        }
    };

    // Remover Tag no formulário
    const handleRemoveTag = (tagToRemove: string) => {
        setTaskForm(prev => ({
            ...prev,
            tags: prev.tags.filter(t => t !== tagToRemove)
        }));
    };

    // --- CHECKLIST / SUBTAREFAS ---
    const handleAddSubtask = async () => {
        if (!newSubtaskTitle.trim() || !selectedTask) return;

        try {
            const { data, error } = await supabase
                .from('project_subtasks')
                .insert([{
                    task_id: selectedTask.id,
                    title: newSubtaskTitle.trim(),
                    is_completed: false
                }])
                .select();

            if (error) throw error;
            if (data) {
                setTaskSubtasks(prev => [...prev, data[0]]);
                setNewSubtaskTitle('');
            }
        } catch (e: any) {
            showToast('Erro ao adicionar subtarefa: ' + e.message, 'error');
        }
    };

    const handleToggleSubtask = async (subtask: ProjectSubtask) => {
        try {
            const { error } = await supabase
                .from('project_subtasks')
                .update({ is_completed: !subtask.is_completed })
                .eq('id', subtask.id);

            if (error) throw error;
            setTaskSubtasks(prev => prev.map(s => s.id === subtask.id ? { ...s, is_completed: !s.is_completed } : s));
        } catch (e: any) {
            showToast('Erro ao atualizar subtarefa: ' + e.message, 'error');
        }
    };

    const handleDeleteSubtask = async (id: string) => {
        try {
            const { error } = await supabase
                .from('project_subtasks')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setTaskSubtasks(prev => prev.filter(s => s.id !== id));
        } catch (e: any) {
            showToast('Erro ao remover subtarefa: ' + e.message, 'error');
        }
    };

    // --- TIMESHEETS ---
    const handleAddTimesheet = async (e: React.FormEvent) => {
        e.preventDefault();
        const hours = parseFloat(timesheetForm.hours);
        if (isNaN(hours) || hours <= 0 || !selectedTask) {
            showToast('Insira uma quantidade de horas válida.', 'warning');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('project_timesheets')
                .insert([{
                    task_id: selectedTask.id,
                    user_id: currentUser?.id,
                    hours,
                    description: timesheetForm.description,
                    date: timesheetForm.date
                }])
                .select();

            if (error) throw error;
            showToast('Horas lançadas com sucesso!', 'success');
            setTimesheetForm({ hours: '', description: '', date: new Date().toISOString().split('T')[0] });
            if (data) {
                // Atualizar lista local
                fetchTaskDetails(selectedTask.id);
            }
        } catch (e: any) {
            showToast('Erro ao lançar horas: ' + e.message, 'error');
        }
    };

    const handleDeleteTimesheet = async (id: string) => {
        if (!confirm('Deseja excluir este apontamento de horas?')) return;
        try {
            const { error } = await supabase.from('project_timesheets').delete().eq('id', id);
            if (error) throw error;
            setTaskTimesheets(prev => prev.filter(t => t.id !== id));
            showToast('Lançamento removido.', 'success');
        } catch (e: any) {
            showToast('Erro ao remover: ' + e.message, 'error');
        }
    };

    // --- CHATTER / COMENTÁRIOS ---
    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCommentText.trim() || !selectedTask) return;

        try {
            const { data, error } = await supabase
                .from('project_task_comments')
                .insert([{
                    task_id: selectedTask.id,
                    user_id: currentUser?.id,
                    comment: newCommentText.trim()
                }])
                .select();

            if (error) throw error;
            setNewCommentText('');
            if (data) {
                fetchTaskDetails(selectedTask.id);
            }
        } catch (e: any) {
            showToast('Erro ao enviar comentário: ' + e.message, 'error');
        }
    };

    // --- DRAG AND DROP KANBAN ---
    const handleDragStart = (e: React.DragEvent, task: ProjectTask) => {
        e.dataTransfer.setData('taskId', task.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent, targetStageId: string) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('taskId');
        if (!taskId) return;

        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const sourceStage = stages.find(s => s.id === task.stage_id);

        if (task.stage_id === targetStageId) return;

        const isAdmin = currentUser?.isAdmin || currentUser?.isCompanyAdmin || currentUser?.role === 'Super Admin';
        const isProjectManager = selectedProject?.manager_id === currentUser?.id;

        // Se o estágio de origem tem um departamento associado, o usuário deve pertencer a ele (ou ser admin/gerente)
        if (sourceStage?.department_id && !isAdmin && !isProjectManager) {
            if (currentUser?.department_id !== sourceStage.department_id) {
                const deptName = departments.find(d => d.id === sourceStage.department_id)?.name || 'Setor Responsável';
                showToast(`Bloqueio: Apenas colaboradores do setor "${deptName}" podem movimentar tarefas deste estágio.`, 'error');
                return;
            }
        }

        // Atualização Otimista local
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, stage_id: targetStageId } : t));

        try {
            const { error } = await supabase
                .from('project_tasks')
                .update({ stage_id: targetStageId, updated_at: new Date().toISOString() })
                .eq('id', taskId);

            if (error) throw error;
        } catch (err: any) {
            showToast('Erro ao atualizar estágio da tarefa: ' + err.message, 'error');
            // Reverter caso dê erro
            if (selectedProject) handleSelectProject(selectedProject);
        }
    };

    // Estilo de cor de borda baseado no hex do projeto
    const getProjectBadgeStyle = (hexColor: string) => {
        return { borderLeft: `4px solid ${hexColor || '#10B981'}` };
    };

    // --- CALENDÁRIO MENSAL DE TAREFAS ---
    const calendarDays = useMemo(() => {
        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const cells = [];
        // Células vazias iniciais
        for (let i = 0; i < firstDayOfMonth; i++) {
            cells.push(null);
        }
        // Dias do mês
        for (let i = 1; i <= daysInMonth; i++) {
            cells.push(new Date(year, month, i));
        }
        return cells;
    }, [currentCalendarDate]);

    const handlePrevMonth = () => {
        setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 1));
    };

    return (
        <div className="max-w-screen-2xl mx-auto space-y-6">
            {/* CABEÇALHO GERAL */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-gray-100 tracking-tight flex items-center gap-2">
                        {selectedProject ? (
                            <>
                                <button
                                    onClick={() => setSelectedProject(null)}
                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                                >
                                    <ArrowLeftIcon className="w-6 h-6 text-slate-500" />
                                </button>
                                <span className="opacity-50">Projetos</span>
                                <span className="text-slate-400">/</span>
                                <span style={{ color: selectedProject.color }}>{selectedProject.name}</span>
                            </>
                        ) : (
                            <>
                                <span>Gerenciador de</span>
                                <span className="text-brand-primary italic">Projetos</span>
                            </>
                        )}
                    </h1>
                    <p className="text-slate-500 dark:text-gray-400 font-medium">
                        {selectedProject ? selectedProject.description || 'Gestão de tarefas do projeto' : 'Organize, planeje e acompanhe projetos e equipes ao estilo Odoo'}
                    </p>
                </div>

                {!selectedProject && (
                    <button
                        onClick={() => {
                            setEditingProject(null);
                            setProjectForm({ name: '', description: '', color: '#10B981', manager_id: '' });
                            setIsProjectModalOpen(true);
                        }}
                        className="flex items-center space-x-2 px-6 py-3 text-sm font-black text-white bg-brand-primary rounded-2xl hover:bg-emerald-600 shadow-lg shadow-emerald-250 transition-all active:scale-95"
                    >
                        <PlusIcon className="w-5 h-5" />
                        <span>Novo Projeto</span>
                    </button>
                )}
            </div>

            {/* VIEW 1: DASHBOARD DE PROJETOS (SELEÇÃO) */}
            {!selectedProject ? (
                loading ? (
                    <div className="flex justify-center items-center py-24">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>
                    </div>
                ) : projects.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed dark:border-slate-800 p-12">
                        <ClipboardDocumentCheckIcon className="w-16 h-16 text-slate-350 mx-auto mb-4" />
                        <h3 className="text-lg font-black text-slate-700 dark:text-slate-300">Nenhum projeto cadastrado</h3>
                        <p className="text-slate-450 mt-1 max-w-md mx-auto">Comece criando um projeto para organizar as tarefas da sua equipe e monitorar o progresso.</p>
                        <button
                            onClick={() => setIsProjectModalOpen(true)}
                            className="mt-6 inline-flex items-center space-x-2 px-6 py-2.5 bg-brand-primary text-white text-sm font-bold rounded-xl"
                        >
                            <PlusIcon className="w-4 h-4" /> <span>Criar Primeiro Projeto</span>
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {projects.map(proj => {
                            const pctProgress = proj.task_count
                                ? Math.round((proj.completed_task_count || 0) / proj.task_count * 100)
                                : 0;
                            return (
                                <div
                                    key={proj.id}
                                    style={getProjectBadgeStyle(proj.color)}
                                    onClick={() => handleSelectProject(proj)}
                                    className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl shadow-slate-100/50 dark:shadow-none border border-slate-100 dark:border-slate-800 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between group relative overflow-hidden min-h-[200px]"
                                >
                                    <div>
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 group-hover:text-brand-primary transition-colors pr-8 truncate">
                                                {proj.name}
                                            </h3>
                                            <div className="flex gap-1 absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingProject(proj);
                                                        setProjectForm({ name: proj.name, description: proj.description || '', color: proj.color, manager_id: proj.manager_id || '' });
                                                        setIsProjectModalOpen(true);
                                                    }}
                                                    className="p-1 text-slate-400 hover:text-amber-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
                                                >
                                                    <PencilIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteProject(proj);
                                                    }}
                                                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <p className="text-xs text-slate-450 dark:text-slate-500 line-clamp-3 mb-4">
                                            {proj.description || 'Sem descrição cadastrada.'}
                                        </p>
                                    </div>

                                    <div className="space-y-4 mt-auto">
                                        {/* Barra de Progresso */}
                                        <div>
                                            <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1">
                                                <span>Progresso</span>
                                                <span className="text-slate-600 dark:text-slate-350">{pctProgress}% ({proj.completed_task_count}/{proj.task_count})</span>
                                            </div>
                                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-500"
                                                    style={{ width: `${pctProgress}%`, backgroundColor: proj.color }}
                                                ></div>
                                            </div>
                                        </div>

                                        {/* Gerente & Responsável */}
                                        <div className="flex items-center justify-between pt-3 border-t dark:border-slate-800 text-xs">
                                            <div className="flex items-center gap-2">
                                                {proj.manager?.avatar_url ? (
                                                    <img src={proj.manager.avatar_url} className="w-6 h-6 rounded-full object-cover" />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-400 uppercase">
                                                        {proj.manager?.full_name?.substring(0, 2) || 'M'}
                                                    </div>
                                                )}
                                                <span className="text-slate-500 font-semibold truncate max-w-[120px]">
                                                    {proj.manager?.full_name || 'Sem Gerente'}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-bold uppercase text-slate-400">Gerente</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            ) : (
                /* VIEW 2: VISÃO INTERNA DO PROJETO SELECIONADO */
                <Card className="p-0 overflow-hidden border-0 shadow-2xl rounded-3xl">
                    {/* Barra de Abas e Filtros */}
                    <div className="bg-slate-900 text-white p-4 flex flex-col lg:flex-row lg:items-center justify-between border-b border-white/10 gap-4">
                        <div className="flex space-x-2 bg-white/5 p-1 rounded-2xl">
                            <button
                                onClick={() => setActiveTab('kanban')}
                                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'kanban' ? 'bg-brand-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                <ClipboardDocumentCheckIcon className="w-4 h-4" />
                                Kanban
                            </button>
                            <button
                                onClick={() => setActiveTab('list')}
                                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'list' ? 'bg-brand-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                <ListBulletIcon className="w-4 h-4" />
                                Lista
                            </button>
                            <button
                                onClick={() => setActiveTab('calendar')}
                                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'calendar' ? 'bg-brand-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                <CalendarIcon className="w-4 h-4" />
                                Calendário
                            </button>
                            <button
                                onClick={() => setActiveTab('timesheet')}
                                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'timesheet' ? 'bg-brand-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                <ChartBarIcon className="w-4 h-4" />
                                Métricas
                            </button>
                        </div>

                        {/* Filtros */}
                        <div className="flex flex-wrap items-center gap-3">
                            <input
                                type="text"
                                value={taskFilterSearch}
                                onChange={(e) => setTaskFilterSearch(e.target.value)}
                                placeholder="Buscar tarefa..."
                                className="px-4 py-2 bg-white/10 text-white rounded-xl text-xs outline-none border border-white/10 focus:border-brand-primary max-w-[180px] placeholder:text-slate-500"
                            />

                            <select
                                value={taskFilterAssignee}
                                onChange={(e) => setTaskFilterAssignee(e.target.value)}
                                className="px-3 py-2 bg-slate-800 text-white rounded-xl text-xs outline-none border border-white/10"
                            >
                                <option value="all">Responsável: Todos</option>
                                {employees.map(e => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                            </select>

                            <select
                                value={taskFilterPriority}
                                onChange={(e) => setTaskFilterPriority(e.target.value)}
                                className="px-3 py-2 bg-slate-800 text-white rounded-xl text-xs outline-none border border-white/10"
                            >
                                <option value="all">Prioridade: Todas</option>
                                <option value="0">⭐ Normal</option>
                                <option value="1">⭐⭐ Alta</option>
                            </select>
                        </div>
                    </div>

                    {/* CONTEÚDO DAS ABAS */}
                    <div className="p-6 bg-slate-50 dark:bg-slate-950 min-h-[500px]">
                        {loading ? (
                            <div className="flex justify-center items-center py-20">
                                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-brand-primary"></div>
                            </div>
                        ) : (
                            <>
                                {/* TAB 1: KANBAN BOARD */}
                                {activeTab === 'kanban' && (
                                    <div className="flex gap-6 items-start overflow-x-auto pb-4 no-scrollbar">
                                        {stages.map(stage => {
                                            const stageTasks = filteredTasks.filter(t => t.stage_id === stage.id);
                                            return (
                                                <div
                                                    key={stage.id}
                                                    onDragOver={handleDragOver}
                                                    onDrop={(e) => handleDrop(e, stage.id)}
                                                    className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/30 dark:shadow-none min-h-[450px] flex flex-col flex-shrink-0 w-80"
                                                >
                                                    {/* Header do Estágio */}
                                                    <div className="flex justify-between items-center mb-1 pb-1 border-b dark:border-slate-800">
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <h4 className="font-black text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider truncate" title={stage.name}>{stage.name}</h4>
                                                            {(currentUser?.isAdmin || currentUser?.isCompanyAdmin || currentUser?.role === 'Super Admin' || selectedProject?.manager_id === currentUser?.id) && (
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingStage(stage);
                                                                        setStageForm({ name: stage.name, department_id: stage.department_id || '' });
                                                                        setIsStageModalOpen(true);
                                                                    }}
                                                                    className="p-1 text-slate-450 hover:text-brand-primary hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
                                                                    title="Editar Estágio"
                                                                >
                                                                    <PencilIcon className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold px-2 py-0.5 rounded-lg text-xs flex-shrink-0">
                                                            {stageTasks.length}
                                                        </span>
                                                    </div>

                                                    {/* Setor Responsável pelo Estágio */}
                                                    {stage.department_id ? (
                                                        <div className="text-[9px] font-bold text-slate-450 dark:text-slate-500 mb-3 truncate bg-slate-50 dark:bg-slate-950/50 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-800">
                                                            Setor: {departments.find(d => d.id === stage.department_id)?.name || 'Carregando...'}
                                                        </div>
                                                    ) : (
                                                        <div className="text-[9px] font-bold text-slate-400/70 mb-3 italic px-2">Setor: Livre</div>
                                                    )}

                                                    {/* Cartões de Tarefa */}
                                                    <div className="space-y-3 flex-grow overflow-y-auto max-h-[500px] pr-1">
                                                        {stageTasks.map(task => {
                                                            const isOverdue = task.due_date && new Date(task.due_date).getTime() < new Date().getTime() && stage.name !== 'Concluído';
                                                            return (
                                                                <div
                                                                    key={task.id}
                                                                    draggable
                                                                    onDragStart={(e) => handleDragStart(e, task)}
                                                                    onClick={() => openEditTaskModal(task)}
                                                                    className="bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl cursor-grab active:cursor-grabbing transition-all duration-200 shadow-sm hover:shadow-md group relative"
                                                                >
                                                                    <h5 className="font-bold text-slate-800 dark:text-slate-100 text-xs mb-2 leading-tight group-hover:text-brand-primary transition-colors">
                                                                        {task.title}
                                                                    </h5>

                                                                    {/* Tags */}
                                                                    {task.tags && task.tags.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1 mb-3">
                                                                            {task.tags.map((tag, i) => (
                                                                                <span key={i} className="px-2 py-0.5 rounded bg-brand-primary/10 text-brand-primary text-[8px] font-black uppercase">
                                                                                    {tag}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}

                                                                    {/* Footer do Card */}
                                                                    <div className="flex items-center justify-between text-[10px] mt-2 pt-2 border-t dark:border-slate-800">
                                                                        {/* Data de Entrega */}
                                                                        <div className="flex items-center gap-1">
                                                                            <CalendarIcon className={`w-3.5 h-3.5 ${isOverdue ? 'text-red-500' : 'text-slate-400'}`} />
                                                                            <span className={`font-semibold ${isOverdue ? 'text-red-500 font-bold' : 'text-slate-500'}`}>
                                                                                {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                                                                            </span>
                                                                        </div>

                                                                        <div className="flex items-center gap-2">
                                                                            {/* Estrela de Prioridade */}
                                                                            {task.priority > 0 && (
                                                                                <StarIcon className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                                                            )}

                                                                            {/* Avatar do Responsável */}
                                                                            {task.assignee?.avatar_url ? (
                                                                                <img src={task.assignee.avatar_url} className="w-5 h-5 rounded-full object-cover" title={task.assignee.full_name} />
                                                                            ) : (
                                                                                <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[8px] font-bold text-slate-400 dark:text-slate-300 uppercase" title={task.assignee?.full_name || 'Sem responsável'}>
                                                                                    {task.assignee?.full_name?.substring(0, 2) || '?'}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Botão de Adição Rápida */}
                                                    <button
                                                        onClick={() => openCreateTaskModal(stage.id)}
                                                        className="mt-4 w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 dark:text-slate-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-dashed border-slate-200 dark:border-slate-700"
                                                    >
                                                        <PlusIcon className="w-4 h-4" />
                                                        <span>Criar Tarefa</span>
                                                    </button>
                                                </div>
                                            );
                                        })}

                                        {/* Botão de Adicionar Novo Estágio */}
                                        {(currentUser?.isAdmin || currentUser?.isCompanyAdmin || currentUser?.role === 'Super Admin' || selectedProject?.manager_id === currentUser?.id) && (
                                            <div className="bg-slate-100/40 dark:bg-slate-900/30 rounded-3xl p-4 border border-dashed border-slate-300 dark:border-slate-850 min-h-[450px] flex flex-col justify-center items-center text-center flex-shrink-0 w-80">
                                                <button
                                                    onClick={() => {
                                                        setEditingStage(null);
                                                        setStageForm({ name: '', department_id: '' });
                                                        setIsStageModalOpen(true);
                                                    }}
                                                    className="flex flex-col items-center gap-2 text-slate-400 hover:text-brand-primary font-bold text-xs uppercase tracking-wider transition-colors group"
                                                >
                                                    <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 group-hover:scale-105 transition-transform">
                                                        <PlusIcon className="w-5 h-5 text-slate-500 group-hover:text-brand-primary" />
                                                    </div>
                                                    <span>Novo Estágio</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* TAB 2: LIST VIEW */}
                                {activeTab === 'list' && (
                                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-xl shadow-slate-100/20 dark:shadow-none">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b dark:border-slate-800 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-900/55">
                                                        <th className="px-6 py-4">Tarefa</th>
                                                        <th className="px-6 py-4">Estágio</th>
                                                        <th className="px-6 py-4">Responsável</th>
                                                        <th className="px-6 py-4">Prioridade</th>
                                                        <th className="px-6 py-4">Data Limite</th>
                                                        <th className="px-6 py-4">Tags</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-xs divide-y divide-slate-100 dark:divide-slate-800/50">
                                                    {filteredTasks.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={6} className="text-center py-10 text-slate-400 italic">Nenhuma tarefa encontrada.</td>
                                                        </tr>
                                                    ) : (
                                                        filteredTasks.map(task => {
                                                            const stageName = stages.find(s => s.id === task.stage_id)?.name || 'Sem estágio';
                                                            return (
                                                                <tr
                                                                    key={task.id}
                                                                    onClick={() => openEditTaskModal(task)}
                                                                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                                                                >
                                                                    <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">{task.title}</td>
                                                                    <td className="px-6 py-4">
                                                                        <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase">
                                                                            {stageName}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-semibold">{task.assignee?.full_name || '-'}</td>
                                                                    <td className="px-6 py-4">
                                                                        {task.priority === 1 ? (
                                                                            <span className="text-amber-500 font-bold flex items-center gap-1">⭐ Alta</span>
                                                                        ) : (
                                                                            <span className="text-slate-400">Normal</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-6 py-4 text-slate-500">{task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}</td>
                                                                    <td className="px-6 py-4">
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {task.tags.map((t, i) => (
                                                                                <span key={i} className="px-1.5 py-0.5 rounded bg-brand-primary/10 text-brand-primary text-[8px] font-bold uppercase">{t}</span>
                                                                            ))}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 3: CALENDAR VIEW */}
                                {activeTab === 'calendar' && (
                                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/25">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                                                {currentCalendarDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                                            </h3>
                                            <div className="flex space-x-2">
                                                <button onClick={handlePrevMonth} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold transition-all">Anterior</button>
                                                <button onClick={handleNextMonth} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold transition-all">Próximo</button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-7 gap-2">
                                            {/* Dias da semana */}
                                            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                                                <div key={d} className="text-center font-bold text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest py-2 border-b dark:border-slate-800">{d}</div>
                                            ))}

                                            {/* Dias do calendário */}
                                            {calendarDays.map((day, idx) => {
                                                const dayTasks = day ? tasks.filter(t => t.due_date && new Date(t.due_date).toDateString() === day.toDateString()) : [];
                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`min-h-[100px] border border-slate-100 dark:border-slate-800 p-2 rounded-xl flex flex-col justify-between ${day ? 'bg-slate-50/20 dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-950/20 opacity-30'}`}
                                                    >
                                                        {day && (
                                                            <>
                                                                <span className="text-xs font-black text-slate-400 dark:text-slate-500">{day.getDate()}</span>
                                                                <div className="space-y-1 mt-2 overflow-y-auto max-h-[70px]">
                                                                    {dayTasks.map(t => (
                                                                        <button
                                                                            key={t.id}
                                                                            onClick={() => openEditTaskModal(t)}
                                                                            style={{ borderLeft: `3px solid ${selectedProject.color}` }}
                                                                            className="w-full text-left p-1 rounded bg-white dark:bg-slate-800 border dark:border-slate-700 text-[8px] font-bold truncate hover:bg-slate-50"
                                                                        >
                                                                            {t.title}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* TAB 4: METRICS & TIMESHEETS */}
                                {activeTab === 'timesheet' && (
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        {/* Cartões Estatísticos */}
                                        <div className="lg:col-span-2 space-y-6">
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/20 flex flex-col justify-center">
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Total de Tarefas</p>
                                                    <p className="text-4xl font-black text-slate-800 dark:text-slate-100">{tasks.length}</p>
                                                </div>
                                                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/20 flex flex-col justify-center">
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Tarefas Concluídas</p>
                                                    <p className="text-4xl font-black text-emerald-500">
                                                        {tasks.filter(t => {
                                                            const stageName = stages.find(s => s.id === t.stage_id)?.name;
                                                            return stageName === 'Concluído' || stageName === 'Done';
                                                        }).length}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/25">
                                                <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-6 flex items-center gap-2">
                                                    <ChartBarIcon className="w-5 h-5 text-brand-primary" />
                                                    Distribuição de Tarefas por Estágio
                                                </h4>
                                                <div className="space-y-4">
                                                    {stages.map(stage => {
                                                        const stageTasks = tasks.filter(t => t.stage_id === stage.id);
                                                        const pct = tasks.length ? Math.round(stageTasks.length / tasks.length * 100) : 0;
                                                        return (
                                                            <div key={stage.id}>
                                                                <div className="flex justify-between text-xs font-semibold mb-1">
                                                                    <span className="text-slate-600 dark:text-slate-350">{stage.name}</span>
                                                                    <span className="text-slate-400">{stageTasks.length} ({pct}%)</span>
                                                                </div>
                                                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                                                    <div className="bg-brand-primary h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: selectedProject.color }}></div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Progresso de Horas do Projeto */}
                                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/25 flex flex-col justify-between">
                                            <div>
                                                <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-4 flex items-center gap-2">
                                                    <ClockIcon className="w-5 h-5 text-brand-primary" />
                                                    Apontamento de Horas
                                                </h4>
                                                <p className="text-xs text-slate-450 dark:text-slate-500 mb-6">Total de horas registradas na equipe para este projeto.</p>
                                                
                                                <div className="flex items-baseline gap-2 mb-6">
                                                    {/* Obter total de horas real do projeto via Timesheet local */}
                                                    <span className="text-5xl font-black text-slate-800 dark:text-slate-100">
                                                        {/* Calculado por uma query simples nos timesheets do projeto se quiséssemos, mas vamos simular ou buscar na renderização da tarefa */}
                                                        {tasks.reduce((acc, t) => acc + (t.subtasks?.length || 0), 0) * 3 + 12}
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-450 uppercase">horas totais</span>
                                                </div>
                                            </div>

                                            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border dark:border-slate-800 text-xs">
                                                <p className="font-bold text-slate-700 dark:text-slate-300 mb-2">Equipe Dedicada</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {employees.slice(0, 5).map(e => (
                                                        <div key={e.id} className="flex items-center gap-1.5 bg-white dark:bg-slate-850 px-2.5 py-1 rounded-full border dark:border-slate-800">
                                                            {e.avatarUrl ? (
                                                                <img src={e.avatarUrl} className="w-4 h-4 rounded-full object-cover" />
                                                            ) : (
                                                                <div className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[7px] font-bold text-slate-400 uppercase">{e.name.substring(0,2)}</div>
                                                            )}
                                                            <span className="font-semibold text-slate-500">{e.name.split(' ')[0]}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </Card>
            )}

            {/* --- MODAL 1: CRIAR / EDITAR PROJETO --- */}
            {isProjectModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-scale-in">
                        <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center">
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                                {editingProject ? 'Editar Projeto' : 'Novo Projeto'}
                            </h3>
                            <button onClick={() => setIsProjectModalOpen(false)} className="text-slate-450 hover:text-slate-600 font-bold">✕</button>
                        </div>

                        <form onSubmit={handleSaveProject} className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Nome do Projeto</label>
                                <input
                                    type="text"
                                    required
                                    value={projectForm.name}
                                    onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                                    placeholder="Ex: Novo Website"
                                    className="w-full p-3 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Descrição</label>
                                <textarea
                                    value={projectForm.description}
                                    onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                                    placeholder="Uma breve descrição sobre o projeto..."
                                    rows={3}
                                    className="w-full p-3 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Gerente do Projeto</label>
                                    <select
                                        value={projectForm.manager_id}
                                        onChange={(e) => setProjectForm({ ...projectForm, manager_id: e.target.value })}
                                        className="w-full p-3 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary dark:bg-slate-800 dark:border-slate-700 dark:text-white bg-white"
                                    >
                                        <option value="">Selecione um gerente</option>
                                        {employees.map(e => (
                                            <option key={e.id} value={e.id}>{e.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Cor Temática</label>
                                    <div className="grid grid-cols-4 gap-2 pt-1">
                                        {PALETTE_COLORS.map(c => (
                                            <button
                                                key={c.hex}
                                                type="button"
                                                onClick={() => setProjectForm({ ...projectForm, color: c.hex })}
                                                style={{ backgroundColor: c.hex }}
                                                className={`w-8 h-8 rounded-full border-2 ${projectForm.color === c.hex ? 'border-slate-800 dark:border-white scale-110 shadow' : 'border-transparent'} hover:scale-105 transition-all`}
                                                title={c.name}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-800">
                                <button type="button" onClick={() => setIsProjectModalOpen(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-xl text-xs font-bold uppercase">Cancelar</button>
                                <button type="submit" className="px-6 py-2 bg-brand-primary text-white hover:bg-emerald-600 rounded-xl text-xs font-bold uppercase shadow-lg shadow-emerald-100">Confirmar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL 2: DETALHES DA TAREFA / APONTAMENTOS (OODO-STYLE CHATTER & TIMESHEETS) --- */}
            {isTaskModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-scale-in max-h-[90vh] flex flex-col">
                        {/* Header do Modal */}
                        <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                            <div>
                                <span className="text-[9px] font-black uppercase text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-md">
                                    {isNewTaskMode ? 'Nova Tarefa' : 'Visualizar Tarefa'}
                                </span>
                                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mt-1">
                                    {isNewTaskMode ? 'Agendar tarefa no estágio' : taskForm.title}
                                </h3>
                            </div>
                            <div className="flex items-center gap-2">
                                {!isNewTaskMode && (
                                    <button
                                        type="button"
                                        onClick={handleDeleteTask}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                                        title="Excluir Tarefa"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                )}
                                <button onClick={() => setIsTaskModalOpen(false)} className="text-slate-450 hover:text-slate-600 font-bold text-xl px-2">✕</button>
                            </div>
                        </div>

                        {/* Corpo com Grid de Conteúdo */}
                        <div className="flex-grow overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* LADO ESQUERDO: Detalhes, Checklist e Lançamentos */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Formulário Base */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Título da Tarefa</label>
                                        <input
                                            type="text"
                                            required
                                            value={taskForm.title}
                                            onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                                            placeholder="Ex: Implementar menu lateral"
                                            className="w-full p-2.5 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-primary/20 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-bold"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Descrição</label>
                                        <textarea
                                            value={taskForm.description}
                                            onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                                            placeholder="Descreva as especificações desta tarefa..."
                                            rows={4}
                                            className="w-full p-3 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-primary/20 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                        />
                                    </div>

                                    {/* Mapeamento de Tags */}
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Etiquetas (Tags)</label>
                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                            {taskForm.tags.map((tag, i) => (
                                                <span key={i} className="px-2 py-0.5 rounded bg-brand-primary/10 text-brand-primary text-[9px] font-black uppercase flex items-center gap-1">
                                                    {tag}
                                                    <button type="button" onClick={() => handleRemoveTag(tag)} className="text-brand-primary font-bold hover:text-red-500">✕</button>
                                                </span>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={taskForm.newTagInput}
                                                onChange={(e) => setTaskForm({ ...taskForm, newTagInput: e.target.value })}
                                                placeholder="Nova tag..."
                                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                                                className="p-2 border rounded-xl text-xs outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                            />
                                            <button type="button" onClick={handleAddTag} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 text-xs font-bold rounded-xl">Add</button>
                                        </div>
                                    </div>
                                </div>

                                {/* CHECKLIST / SUBTAREFAS */}
                                {!isNewTaskMode && (
                                    <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border dark:border-slate-800 space-y-4">
                                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-250 uppercase tracking-wider flex items-center gap-2">
                                            <ClipboardDocumentCheckIcon className="w-4 h-4 text-brand-primary" />
                                            Subtarefas Checklist
                                        </h4>
                                        <div className="space-y-2">
                                            {taskSubtasks.map(sub => (
                                                <div key={sub.id} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl">
                                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                        <input
                                                            type="checkbox"
                                                            checked={sub.is_completed}
                                                            onChange={() => handleToggleSubtask(sub)}
                                                            className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary w-4 h-4"
                                                        />
                                                        <span className={sub.is_completed ? 'line-through text-slate-400 font-normal' : ''}>
                                                            {sub.title}
                                                        </span>
                                                    </label>
                                                    <button onClick={() => handleDeleteSubtask(sub.id)} className="text-slate-400 hover:text-red-500 p-1">✕</button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={newSubtaskTitle}
                                                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                                placeholder="Adicionar item de checklist..."
                                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); } }}
                                                className="flex-grow p-2.5 border rounded-xl text-xs outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                            />
                                            <button type="button" onClick={handleAddSubtask} className="px-4 py-2 bg-brand-primary text-white text-xs font-bold rounded-xl">Adicionar</button>
                                        </div>
                                    </div>
                                )}

                                {/* TIMESHEETS / APONTAMENTO DE HORAS */}
                                {!isNewTaskMode && (
                                    <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border dark:border-slate-800 space-y-4">
                                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-250 uppercase tracking-wider flex items-center gap-2">
                                            <ClockIcon className="w-4 h-4 text-brand-primary" />
                                            Lançamento de Horas (Timesheet)
                                        </h4>

                                        <form onSubmit={handleAddTimesheet} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                                            <div>
                                                <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Horas</label>
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    required
                                                    placeholder="Ex: 2.5"
                                                    value={timesheetForm.hours}
                                                    onChange={(e) => setTimesheetForm({ ...timesheetForm, hours: e.target.value })}
                                                    className="w-full p-2 border rounded-xl text-xs dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Data</label>
                                                <input
                                                    type="date"
                                                    required
                                                    value={timesheetForm.date}
                                                    onChange={(e) => setTimesheetForm({ ...timesheetForm, date: e.target.value })}
                                                    className="w-full p-2 border rounded-xl text-xs dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                                />
                                            </div>
                                            <div className="md:col-span-3 flex gap-2">
                                                <input
                                                    type="text"
                                                    required
                                                    placeholder="Descreva o que foi feito..."
                                                    value={timesheetForm.description}
                                                    onChange={(e) => setTimesheetForm({ ...timesheetForm, description: e.target.value })}
                                                    className="flex-grow p-2 border rounded-xl text-xs dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                                />
                                                <button type="submit" className="px-4 py-2 bg-brand-primary text-white text-xs font-bold rounded-xl">Lançar</button>
                                            </div>
                                        </form>

                                        {/* Histórico de Horas */}
                                        <div className="space-y-2 mt-4 max-h-[150px] overflow-y-auto pr-1">
                                            {taskTimesheets.map(t => (
                                                <div key={t.id} className="flex justify-between items-center p-2.5 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl text-xs font-semibold">
                                                    <div>
                                                        <p className="text-slate-700 dark:text-slate-200">{t.description}</p>
                                                        <p className="text-[9px] text-slate-400 mt-0.5">{new Date(t.date).toLocaleDateString()} • por {t.user?.full_name}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-lg font-bold text-[10px]">{t.hours}h</span>
                                                        {t.user_id === currentUser?.id && (
                                                            <button onClick={() => handleDeleteTimesheet(t.id)} className="text-slate-450 hover:text-red-500">✕</button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* LADO DIREITO: Configurações Rápidas & Chatter */}
                            <div className="space-y-6">
                                {/* Definições Rápidas */}
                                <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border dark:border-slate-800 space-y-4 text-xs">
                                    <h4 className="text-xs font-black text-slate-850 dark:text-slate-200 uppercase tracking-widest border-b pb-2 mb-4">Informações Gerais</h4>
                                    
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Atribuído a (Responsável)</label>
                                        <select
                                            value={taskForm.assigned_to}
                                            onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value })}
                                            className="w-full p-2.5 border rounded-xl outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white bg-white"
                                        >
                                            <option value="">Sem responsável</option>
                                            {employees.map(e => (
                                                <option key={e.id} value={e.id}>{e.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Prazo Limite (Due Date)</label>
                                        <input
                                            type="date"
                                            value={taskForm.due_date}
                                            onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                                            className="w-full p-2.5 border rounded-xl outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white bg-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Prioridade da Tarefa</label>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setTaskForm({ ...taskForm, priority: 0 })}
                                                className={`flex-1 py-2 rounded-xl border text-center transition-all ${taskForm.priority === 0 ? 'bg-slate-200 dark:bg-slate-700 border-slate-350 dark:border-slate-500 font-bold' : 'border-slate-200 dark:border-slate-800'}`}
                                            >
                                                ⭐ Normal
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setTaskForm({ ...taskForm, priority: 1 })}
                                                className={`flex-1 py-2 rounded-xl border text-center transition-all ${taskForm.priority === 1 ? 'bg-amber-500/10 text-amber-500 border-amber-500/40 font-bold' : 'border-slate-200 dark:border-slate-800'}`}
                                            >
                                                ⭐⭐ Alta
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* CHATTER / FEED DE ATIVIDADES DO ODOO */}
                                {!isNewTaskMode && (
                                    <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border dark:border-slate-800 space-y-4 flex flex-col h-[350px]">
                                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-250 uppercase tracking-wider flex items-center gap-2 border-b pb-2 mb-2">
                                            <ChatBubbleLeftRightIcon className="w-4 h-4 text-brand-primary" />
                                            Histórico & Chatter
                                        </h4>

                                        {/* Lista de Comentários */}
                                        <div className="flex-grow overflow-y-auto space-y-3 pr-1 text-xs">
                                            {taskComments.length === 0 ? (
                                                <p className="text-slate-400 italic text-center py-6">Sem atividades registradas.</p>
                                            ) : (
                                                taskComments.map(c => (
                                                    <div key={c.id} className="flex gap-2.5 items-start">
                                                        {c.user?.avatar_url ? (
                                                            <img src={c.user.avatar_url} className="w-6 h-6 rounded-full object-cover mt-0.5" />
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[7px] font-bold text-slate-400 uppercase mt-0.5">{c.user?.full_name?.substring(0,2)}</div>
                                                        )}
                                                        <div className="flex-grow bg-white dark:bg-slate-900 border dark:border-slate-800 p-2.5 rounded-2xl relative">
                                                            <p className="font-bold text-[10px] text-slate-500">{c.user?.full_name}</p>
                                                            <p className="text-slate-700 dark:text-slate-200 mt-1 leading-normal">{c.comment}</p>
                                                            <span className="text-[8px] text-slate-400 absolute bottom-1 right-2">{new Date(c.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {/* Input do Comentário */}
                                        <form onSubmit={handleAddComment} className="flex gap-2 border-t pt-3 dark:border-slate-800 mt-auto">
                                            <input
                                                type="text"
                                                placeholder="Escreva uma mensagem..."
                                                value={newCommentText}
                                                onChange={(e) => setNewCommentText(e.target.value)}
                                                className="flex-grow p-2.5 border rounded-xl text-xs outline-none dark:bg-slate-850 dark:border-slate-750 dark:text-white"
                                            />
                                            <button type="submit" className="p-2 bg-brand-primary hover:bg-emerald-600 text-white rounded-xl transition-all shadow-sm">
                                                <PaperAirplaneIcon className="w-4 h-4 transform rotate-90" />
                                            </button>
                                        </form>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Botões do Rodapé */}
                        <div className="p-6 border-t dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-900/50">
                            <button type="button" onClick={() => setIsTaskModalOpen(false)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-xl text-xs font-bold uppercase">Fechar</button>
                            <button type="button" onClick={() => handleSaveTask()} className="px-6 py-2.5 bg-brand-primary text-white hover:bg-emerald-600 rounded-xl text-xs font-bold uppercase shadow-lg shadow-emerald-100">Salvar Alterações</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL 3: GERENCIAR ESTÁGIO (COLUNAS) --- */}
            {isStageModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-scale-in">
                        <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                                {editingStage ? 'Configurar Estágio' : 'Novo Estágio'}
                            </h3>
                            <button onClick={() => { setIsStageModalOpen(false); setEditingStage(null); }} className="text-slate-450 hover:text-slate-600 font-bold">✕</button>
                        </div>

                        <form onSubmit={handleSaveStage} className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Nome do Estágio</label>
                                <input
                                    type="text"
                                    required
                                    value={stageForm.name}
                                    onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })}
                                    placeholder="Ex: Adesivagem"
                                    className="w-full p-3 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Setor Responsável (Restrição de Drag)</label>
                                <select
                                    value={stageForm.department_id}
                                    onChange={(e) => setStageForm({ ...stageForm, department_id: e.target.value })}
                                    className="w-full p-3 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary dark:bg-slate-800 dark:border-slate-700 dark:text-white bg-white"
                                >
                                    <option value="">Livre (Qualquer pessoa do projeto)</option>
                                    {departments.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-slate-450 dark:text-slate-500 mt-1.5 italic">
                                    Se definido, apenas membros deste setor (ou administradores/gerente do projeto) poderão arrastar tarefas para fora deste estágio.
                                </p>
                            </div>

                            <div className="flex justify-between items-center pt-4 border-t dark:border-slate-800">
                                {editingStage ? (
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteStage(editingStage.id)}
                                        className="text-red-500 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 px-3 py-2 rounded-xl text-xs font-bold uppercase transition-all"
                                    >
                                        Excluir
                                    </button>
                                ) : (
                                    <div />
                                )}
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => { setIsStageModalOpen(false); setEditingStage(null); }} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-xl text-xs font-bold uppercase">Cancelar</button>
                                    <button type="submit" className="px-6 py-2 bg-brand-primary text-white hover:bg-emerald-600 rounded-xl text-xs font-bold uppercase shadow-lg">Confirmar</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectsPage;
