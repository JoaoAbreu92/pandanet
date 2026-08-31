import ModalPortal from './ui/ModalPortal';
import React, { useState, useEffect, useMemo } from 'react';
import { handleTabKeyDown } from '../utils/tabAccessibility';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import Card from './Card';
import {
    PlusIcon,
    TrashIcon,
    PencilIcon,
    CheckCircleIcon,
    CheckIcon,
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
    ChevronDownIcon,
    ExclamationTriangleIcon,
    PaperClipIcon,
    XMarkIcon,
    DocumentTextIcon
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
    responsible_id?: string | null;
    checklist_items?: string[];
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
    start_date?: string | null;
    cover_url?: string | null;
    timesheets?: ProjectTimesheet[];
    checklist_status?: Record<string, Record<string, boolean>>;
    checklist_items?: Record<string, string[]>;
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

const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'hoje';
    if (diffDays === 1) return 'ontem';
    return `criado há ${diffDays} dias`;
};

interface ProjectsPageProps {
    defaultTab?: 'kanban' | 'planning' | 'list' | 'calendar' | 'timesheet';
    customFeatures?: Record<string, any>;
    onNavigate?: (page: string, context?: any) => void;
}

const ProjectsPage: React.FC<ProjectsPageProps> = ({ defaultTab, customFeatures, onNavigate }) => {
    const { currentUser } = useAuth();
    const { showToast } = useToast();

    // Estado principal
    const [projects, setProjects] = useState<Project[]>([]);

    const isProjectsLimited = (customFeatures?.projects as any) === 'limited';
    const reachedProjectLimit = isProjectsLimited && projects.length >= 3;
    const [selectedProject, setSelectedProjectState] = useState<Project | null>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('pixel_selected_project');
            return saved ? JSON.parse(saved) : null;
        }
        return null;
    });

    const setSelectedProject = (proj: Project | null) => {
        setSelectedProjectState(proj);
        if (typeof window !== 'undefined') {
            if (proj) {
                localStorage.setItem('pixel_selected_project', JSON.stringify(proj));
            } else {
                localStorage.removeItem('pixel_selected_project');
            }
            window.dispatchEvent(new Event('pixel_selected_project_changed'));
        }
    };

    const handleTabClick = (tab: 'kanban' | 'planning' | 'list' | 'calendar' | 'timesheet') => {
        setActiveTab(tab);
        if (onNavigate) {
            let route = 'projects';
            if (tab === 'planning') route = 'projects-planning';
            else if (tab === 'list') route = 'projects-list';
            else if (tab === 'calendar') route = 'projects-calendar';
            else if (tab === 'timesheet') route = 'projects-metrics';
            onNavigate(route);
        }
    };

    const handleBackToProjects = () => {
        setSelectedProject(null);
        if (onNavigate) {
            onNavigate('projects');
        }
    };
    const [stages, setStages] = useState<ProjectStage[]>([]);
    const [tasks, setTasks] = useState<ProjectTask[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);

    // Visualizações e Filtros
    const [activeTab, setActiveTab] = useState<'kanban' | 'planning' | 'list' | 'calendar' | 'timesheet'>('kanban');

    useEffect(() => {
        if (defaultTab) {
            setActiveTab(defaultTab);
        }
    }, [defaultTab]);
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
        start_date: '',
        cover_url: '',
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
    const [selectedCollabId, setSelectedCollabId] = useState<string>('');

    const [departments, setDepartments] = useState<any[]>([]);
    const [isStageModalOpen, setIsStageModalOpen] = useState(false);
    const [editingStage, setEditingStage] = useState<ProjectStage | null>(null);
    const [stageForm, setStageForm] = useState({ name: '', department_id: '' });

    // Custom flow states
    const [projectStagesForm, setProjectStagesForm] = useState<any[]>([]);
    const [taskHistory, setTaskHistory] = useState<any[]>([]);
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [justDroppedTaskId, setJustDroppedTaskId] = useState<string | null>(null);

    // Cronômetro (Timer) State
    const [timerState, setTimerState] = useState<any>(null);
    const [elapsedTimeStr, setElapsedTimeStr] = useState('00:00:00');
    const [stopDescription, setStopDescription] = useState('');
    const [showStopConfirm, setShowStopConfirm] = useState(false);
    const [showPauseMenu, setShowPauseMenu] = useState(false);

    // Mudar Setor / Transição Modal State
    const [transitionData, setTransitionData] = useState<{
        taskId: string;
        fromStageId: string;
        toStageId: string;
        nextStageName: string;
        checklist: string[];
        uploadedFiles: { name: string; url: string }[];
    } | null>(null);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [newTransitionItem, setNewTransitionItem] = useState('');

    useEffect(() => {
        if (isProjectModalOpen) {
            if (editingProject) {
                const loadProjectStages = async () => {
                    const { data, error } = await supabase
                        .from('project_stages')
                        .select('id, name, responsible_id, checklist_items, position')
                        .eq('project_id', editingProject.id)
                        .order('position', { ascending: true });
                    if (data && !error) {
                        setProjectStagesForm(data.map(d => ({
                            id: d.id,
                            name: d.name,
                            responsible_id: d.responsible_id || '',
                            checklist_items: Array.isArray(d.checklist_items) ? d.checklist_items : []
                        })));
                    }
                };
                loadProjectStages();
            } else {
                setProjectStagesForm([
                    { name: 'Setor Comercial', responsible_id: '', checklist_items: ['Validar briefing', 'Montar proposta'] },
                    { name: 'Setor de Criação', responsible_id: '', checklist_items: ['Definir layout', 'Aprovar com cliente'] },
                    { name: 'Setor de Desenvolvimento', responsible_id: '', checklist_items: ['Desenvolver frontend', 'Integrar API'] }
                ]);
            }
        }
    }, [isProjectModalOpen, editingProject]);

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

            if (data) {
                const mapped = data.map((e: any) => ({
                    ...e,
                    name: e.full_name || 'Usuário',
                    avatarUrl: e.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(e.full_name || 'User')}`
                }));
                setEmployees(mapped as unknown as Employee[]);
            }
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
                .select('*, assignee:profiles!assigned_to(full_name, avatar_url), subtasks:project_subtasks(*), timesheets:project_timesheets(*)')
                .eq('project_id', project.id)
                .order('position', { ascending: true });

            if (taskError) throw taskError;
            
            const mappedTasks = (taskData || []).map((t: any) => ({
                ...t,
                subtasks: t.subtasks || [],
                timesheets: t.timesheets || [],
                checklist_status: t.checklist_status || {},
                checklist_items: t.checklist_items || {}
            }));
            setTasks(mappedTasks);
        } catch (e: any) {
            showToast('Erro ao carregar detalhes do projeto: ' + e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Cronômetro poll effect
    useEffect(() => {
        const interval = setInterval(() => {
            const active = localStorage.getItem('pixel_active_timer');
            if (active) {
                try {
                    const parsed = JSON.parse(active);
                    setTimerState(parsed);
                    
                    // Se o timer for desta tarefa, atualizar string
                    if (selectedTask && parsed.taskId === selectedTask.id) {
                        let totalMs = parsed.accumulatedTime || 0;
                        if (!parsed.isPaused) {
                            totalMs += (Date.now() - parsed.startTime);
                        }
                        
                        const seconds = Math.floor((totalMs / 1000) % 60);
                        const minutes = Math.floor((totalMs / (1000 * 60)) % 60);
                        const hours = Math.floor((totalMs / (1000 * 60 * 60)));
                        
                        const pad = (n: number) => String(n).padStart(2, '0');
                        setElapsedTimeStr(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
                    } else {
                        setElapsedTimeStr('00:00:00');
                    }
                } catch {
                    localStorage.removeItem('pixel_active_timer');
                    setTimerState(null);
                }
            } else {
                setTimerState(null);
                setElapsedTimeStr('00:00:00');
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [selectedTask]);

    // Auto-carregar detalhes se o projeto já estiver selecionado no localStorage
    useEffect(() => {
        const saved = localStorage.getItem('pixel_selected_project');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                handleSelectProject(parsed);
            } catch (err) {
                console.error('Erro ao fazer parse do projeto salvo:', err);
            }
        }
    }, []);

    // Criar / Editar Projeto
    const handleSaveProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectForm.name) {
            showToast('O nome do projeto é obrigatório.', 'warning');
            return;
        }
        if (projectStagesForm.length === 0) {
            showToast('O projeto precisa ter pelo menos um setor/estágio.', 'warning');
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

            let projectId = editingProject?.id;

            if (editingProject) {
                const { error } = await supabase
                    .from('projects')
                    .update(payload)
                    .eq('id', editingProject.id);

                if (error) throw error;
            } else {
                const { data: insertData, error: insertError } = await supabase
                    .from('projects')
                    .insert([payload])
                    .select()
                    .single();

                if (insertError) throw insertError;
                projectId = insertData.id;
            }

            // --- SALVAR ESTÁGIOS / SETORES ---
            // 1. Apagar estágios que foram removidos
            if (editingProject) {
                const currentStageIds = projectStagesForm.filter(s => s.id).map(s => s.id);
                const { data: dbStages } = await supabase
                    .from('project_stages')
                    .select('id')
                    .eq('project_id', editingProject.id);
                if (dbStages) {
                    const stagesToDelete = dbStages.filter(s => !currentStageIds.includes(s.id)).map(s => s.id);
                    if (stagesToDelete.length > 0) {
                        // Deletar tarefas associadas ou soltá-las (cascade ou RLS cuidará disso)
                        await supabase.from('project_stages').delete().in('id', stagesToDelete);
                    }
                }
            }

            // 2. Inserir ou atualizar estágios
            for (let i = 0; i < projectStagesForm.length; i++) {
                const stage = projectStagesForm[i];
                const stagePayload = {
                    project_id: projectId,
                    name: stage.name,
                    position: i + 1,
                    responsible_id: stage.responsible_id || null,
                    checklist_items: stage.checklist_items
                };

                if (stage.id) {
                    const { error: stageErr } = await supabase
                        .from('project_stages')
                        .update(stagePayload)
                        .eq('id', stage.id);
                    if (stageErr) throw stageErr;
                } else {
                    const { error: stageErr } = await supabase
                        .from('project_stages')
                        .insert([stagePayload]);
                    if (stageErr) throw stageErr;
                }
            }

            showToast(editingProject ? 'Projeto atualizado com sucesso!' : 'Projeto criado com sucesso!', 'success');
            setIsProjectModalOpen(false);
            setEditingProject(null);
            setProjectForm({ name: '', description: '', color: '#10B981', manager_id: '' });
            setProjectStagesForm([]);
            fetchProjects();
            if (selectedProject && selectedProject.id === projectId) {
                handleSelectProject(selectedProject);
            }
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
            start_date: '',
            cover_url: '',
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
            start_date: task.start_date ? task.start_date.split('T')[0] : '',
            cover_url: task.cover_url || '',
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

            // Histórico de Movimentação
            const { data: historyData } = await supabase
                .from('project_task_history')
                .select('*, moved_by_user:profiles!moved_by(full_name, avatar_url), from_stage:project_stages!from_stage_id(name), to_stage:project_stages!to_stage_id(name)')
                .eq('task_id', taskId)
                .order('moved_at', { ascending: true });
            setTaskHistory(historyData || []);
        } catch (e) {
            console.error('Erro ao carregar detalhes da tarefa:', e);
        }
    };

    // Salvar Tarefa (Criar ou Atualizar)
    const handleSaveTask = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const currentStage = selectedTask ? stages.find(s => s.id === selectedTask.stage_id) : null;
        const isReadOnly = !isNewTaskMode && !canUserModifyTaskInStage(selectedTask, currentStage);
        if (isReadOnly) {
            showToast('Você não tem permissão para editar esta tarefa.', 'error');
            return;
        }
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
                start_date: taskForm.start_date ? new Date(taskForm.start_date).toISOString() : null,
                cover_url: taskForm.cover_url || null,
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
                setTasks(prev => prev.map(t => {
                    if (t.id === selectedTask.id) {
                        return {
                            ...t,
                            subtasks: [...(t.subtasks || []), data[0]]
                        };
                    }
                    return t;
                }));
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
            setTasks(prev => prev.map(t => {
                if (t.id === subtask.task_id) {
                    return {
                        ...t,
                        subtasks: (t.subtasks || []).map(s => s.id === subtask.id ? { ...s, is_completed: !s.is_completed } : s)
                    };
                }
                return t;
            }));
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
            setTasks(prev => prev.map(t => {
                if (t.id === selectedTask?.id) {
                    return {
                        ...t,
                        subtasks: (t.subtasks || []).filter(s => s.id !== id)
                    };
                }
                return t;
            }));
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

    // --- TIMER / CRONÔMETRO OPERATIONS ---
    const startTimer = async (task: ProjectTask) => {
        const active = localStorage.getItem('pixel_active_timer');
        if (active) {
            showToast('Você já possui um cronômetro ativo em outra tarefa.', 'warning');
            return;
        }

        const newState = {
            taskId: task.id,
            taskTitle: task.title,
            startTime: Date.now(),
            accumulatedTime: 0,
            isPaused: false
        };
        localStorage.setItem('pixel_active_timer', JSON.stringify(newState));
        setTimerState(newState);

        try {
            await supabase.from('project_task_comments').insert([{
                task_id: task.id,
                user_id: currentUser?.id,
                comment: `[CRONÔMETRO] Usuário iniciou a contagem de tempo.`
            }]);
            fetchTaskDetails(task.id);
        } catch (e) {
            console.error('Error logging timer start:', e);
        }
    };

    const pauseTimer = async (reason: string, durationMinutes?: number) => {
        if (!timerState || !selectedTask) return;

        let newAccumulated = timerState.accumulatedTime || 0;
        if (!timerState.isPaused) {
            newAccumulated += (Date.now() - timerState.startTime);
        }

        let pauseExpectedEndTime: number | undefined;
        if (durationMinutes) {
            pauseExpectedEndTime = Date.now() + durationMinutes * 60 * 1000;
        }

        const updated = {
            ...timerState,
            isPaused: true,
            pauseTime: Date.now(),
            accumulatedTime: newAccumulated,
            pauseReason: reason,
            pauseExpectedEndTime
        };

        localStorage.setItem('pixel_active_timer', JSON.stringify(updated));
        setTimerState(updated);
        setShowPauseMenu(false);

        try {
            await supabase.from('project_task_comments').insert([{
                task_id: selectedTask.id,
                user_id: currentUser?.id,
                comment: `[CRONÔMETRO] Usuário pausou a contagem. Motivo: ${reason}`
            }]);
            fetchTaskDetails(selectedTask.id);
        } catch (e) {
            console.error('Error logging timer pause:', e);
        }
    };

    const resumeTimer = async () => {
        if (!timerState || !selectedTask) return;

        const updated = {
            ...timerState,
            isPaused: false,
            startTime: Date.now(),
            pauseTime: undefined,
            pauseReason: undefined,
            pauseExpectedEndTime: undefined
        };

        localStorage.setItem('pixel_active_timer', JSON.stringify(updated));
        setTimerState(updated);

        try {
            await supabase.from('project_task_comments').insert([{
                task_id: selectedTask.id,
                user_id: currentUser?.id,
                comment: `[CRONÔMETRO] Usuário retomou a contagem de tempo.`
            }]);
            fetchTaskDetails(selectedTask.id);
        } catch (e) {
            console.error('Error logging timer resume:', e);
        }
    };

    const stopTimer = async () => {
        if (!timerState || !selectedTask) return;

        let totalMs = timerState.accumulatedTime || 0;
        if (!timerState.isPaused) {
            totalMs += (Date.now() - timerState.startTime);
        }

        const hours = parseFloat((totalMs / (1000 * 60 * 60)).toFixed(2));

        if (hours <= 0.01) {
            localStorage.removeItem('pixel_active_timer');
            setTimerState(null);
            setShowStopConfirm(false);
            setStopDescription('');
            showToast('Cronômetro finalizado (tempo inferior a 30 segundos, descartado).', 'warning');
            return;
        }

        try {
            const { error: timesheetError } = await supabase
                .from('project_timesheets')
                .insert([{
                    task_id: selectedTask.id,
                    user_id: currentUser?.id,
                    hours: hours,
                    description: stopDescription || 'Apontamento via cronômetro',
                    date: new Date().toISOString().split('T')[0]
                }]);

            if (timesheetError) throw timesheetError;

            const mins = Math.round((totalMs / (1000 * 60)) % 60);
            const hrs = Math.floor(totalMs / (1000 * 60 * 60));
            const timeStr = `${hrs}h ${mins}m`;

            await supabase.from('project_task_comments').insert([{
                task_id: selectedTask.id,
                user_id: currentUser?.id,
                comment: `[CRONÔMETRO] Usuário finalizou a contagem de tempo. Total apontado: ${timeStr}. Descrição: ${stopDescription || 'Apontamento via cronômetro'}`
            }]);

            localStorage.removeItem('pixel_active_timer');
            setTimerState(null);
            setShowStopConfirm(false);
            setStopDescription('');

            showToast('Apontamento de horas lançado com sucesso!', 'success');
            fetchTaskDetails(selectedTask.id);
        } catch (e: any) {
            showToast('Erro ao finalizar cronômetro: ' + e.message, 'error');
        }
    };

    // --- TRANSITION FILES & CUSTOM CHECKLISTS ---
    const handleTransitionFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !transitionData) return;

        const currentCount = transitionData.uploadedFiles.length;
        if (currentCount + files.length > 5) {
            showToast('Você pode anexar no máximo 5 arquivos.', 'error');
            return;
        }

        setUploadingFile(true);
        try {
            const newUploadedFiles = [...transitionData.uploadedFiles];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileExt = file.name.split('.').pop();
                const fileName = `task_transition_${transitionData.taskId}_${Date.now()}_${i}.${fileExt}`;
                const filePath = `${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('feed-media')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from('feed-media').getPublicUrl(filePath);
                newUploadedFiles.push({ name: file.name, url: data.publicUrl });
            }

            setTransitionData(prev => prev ? {
                ...prev,
                uploadedFiles: newUploadedFiles
            } : null);
            showToast(files.length > 1 ? 'Arquivos enviados com sucesso!' : 'Arquivo enviado com sucesso!', 'success');
        } catch (err: any) {
            showToast('Erro ao enviar arquivo: ' + err.message, 'error');
        } finally {
            setUploadingFile(false);
            e.target.value = '';
        }
    };

    const handleConfirmTransition = async () => {
        if (!transitionData || !currentUser) return;
        const { taskId, fromStageId, toStageId, checklist, uploadedFiles } = transitionData;

        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        const targetStage = stages.find(s => s.id === toStageId);
        if (!targetStage) return;

        try {
            // 1. Gravar arquivos se houver
            for (const file of uploadedFiles) {
                await supabase.from('project_task_comments').insert([{
                    task_id: taskId,
                    user_id: currentUser.id,
                    comment: `[ARQUIVO] ${file.name}|${file.url}`
                }]);
            }

            // 2. Gravar modificações no checklist se houver
            const defaultChecklist = targetStage.checklist_items || [];
            const added = checklist.filter(item => !defaultChecklist.includes(item));
            const deleted = defaultChecklist.filter(item => !checklist.includes(item));

            let historyLog = '';
            if (added.length > 0) {
                historyLog += `Adicionados itens no checklist do setor ${targetStage.name}: ${added.join(', ')}. `;
            }
            if (deleted.length > 0) {
                historyLog += `Removidos itens no checklist do setor ${targetStage.name}: ${deleted.join(', ')}. `;
            }

            if (historyLog) {
                await supabase.from('project_task_comments').insert([{
                    task_id: taskId,
                    user_id: currentUser.id,
                    comment: `[HISTÓRICO] ${historyLog}`
                }]);
            }

            // 3. Atualizar o checklist customizado do task no banco
            const updatedChecklists = {
                ...(task.checklist_items || {}),
                [toStageId]: checklist
            };

            const { error: checklistError } = await supabase
                .from('project_tasks')
                .update({ checklist_items: updatedChecklists })
                .eq('id', taskId);

            if (checklistError) throw checklistError;

            // Atualiza localmente
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, checklist_items: updatedChecklists } : t));
            if (selectedTask && selectedTask.id === taskId) {
                setSelectedTask(prev => prev ? { ...prev, checklist_items: updatedChecklists } : null);
            }

            // 4. Executar transição forçada de estágio
            await moveTaskStage(taskId, fromStageId, toStageId, true);

            // Fechar modal
            setTransitionData(null);
        } catch (e: any) {
            showToast('Erro ao confirmar transição: ' + e.message, 'error');
        }
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    };

    const isTaskCompleted = (task: ProjectTask) => {
        const taskStage = stages.find(s => s.id === task.stage_id);
        if (!taskStage) return false;
        const sortedStages = [...stages].sort((a, b) => a.position - b.position);
        const finalStage = sortedStages[sortedStages.length - 1];
        return taskStage.id === finalStage?.id || taskStage.name.toLowerCase() === 'concluído' || taskStage.name.toLowerCase() === 'done';
    };

    // --- HELPERS PARA FLUXO E PERMISSÕES DE SETOR ---
    const canUserModifyTaskInStage = (task: ProjectTask | null, stage: ProjectStage | null | undefined) => {
        if (!task || !stage) return false;
        if (currentUser?.isAdmin || currentUser?.isCompanyAdmin || currentUser?.role === 'Super Admin' || selectedProject?.manager_id === currentUser?.id) {
            return true;
        }
        if (stage.responsible_id === currentUser?.id) {
            return true;
        }
        return false;
    };

    const getIncompleteStageChecklistItems = (task: ProjectTask, stage: ProjectStage | undefined) => {
        if (!stage) return [];
        const items = task.checklist_items?.[stage.id] || stage.checklist_items || [];
        if (items.length === 0) {
            return [];
        }
        const status = task.checklist_status?.[stage.id] || {};
        return items.filter((item: string) => !status[item]);
    };

    // --- DRAG AND DROP KANBAN ---
    const handleDragStart = (e: React.DragEvent, task: ProjectTask) => {
        e.dataTransfer.setData('taskId', task.id);
        e.dataTransfer.effectAllowed = 'move';
        setDraggedTaskId(task.id);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDragEnd = () => {
        setDraggedTaskId(null);
    };

    const moveTaskStage = async (taskId: string, fromStageId: string, toStageId: string, force = false) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const sourceStage = stages.find(s => s.id === fromStageId);
        const targetStage = stages.find(s => s.id === toStageId);
        if (!sourceStage || !targetStage) return;

        // 1. Verificar permissão de modificação no estágio de origem
        if (!canUserModifyTaskInStage(task, sourceStage)) {
            const respName = employees.find(emp => emp.id === sourceStage.responsible_id)?.name || 'Sem responsável';
            showToast(`Bloqueio: Apenas o responsável pelo setor "${sourceStage.name}" (${respName}), o gerente do projeto ou administradores podem movimentar este projeto.`, 'error');
            return;
        }

        // 2. Verificar checklist completo no estágio de origem (somente para avanço)
        const isMovingForward = targetStage.position > sourceStage.position;
        if (isMovingForward) {
            const incompleteItems = getIncompleteStageChecklistItems(task, sourceStage);
            if (incompleteItems.length > 0) {
                showToast(`Bloqueio: Conclua todos os itens de checklist do setor "${sourceStage.name}" (${incompleteItems.length} pendentes) antes de transferir para o próximo setor.`, 'error');
                return;
            }
        }

        // Se estiver avançando e não forçado, abre o modal de transição
        if (isMovingForward && !force) {
            setTransitionData({
                taskId,
                fromStageId,
                toStageId,
                nextStageName: targetStage.name,
                checklist: task.checklist_items?.[toStageId] || targetStage.checklist_items || [],
                uploadedFiles: []
            });
            return;
        }

        // Atualização Otimista local
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, stage_id: toStageId } : t));
        if (selectedTask && selectedTask.id === taskId) {
            setSelectedTask(prev => prev ? { ...prev, stage_id: toStageId } : null);
        }

        // Feedback de tremor sutil
        setJustDroppedTaskId(taskId);
        setTimeout(() => setJustDroppedTaskId(null), 800);

        try {
            // 1. Atualizar estágio no banco
            const { error: updateError } = await supabase
                .from('project_tasks')
                .update({ stage_id: toStageId })
                .eq('id', taskId);

            if (updateError) throw updateError;

            // 2. Gravar histórico
            const { error: historyError } = await supabase
                .from('project_task_history')
                .insert([{
                    task_id: taskId,
                    from_stage_id: fromStageId,
                    to_stage_id: toStageId,
                    moved_by: currentUser?.id
                }]);

            if (historyError) {
                console.error("Erro ao registrar histórico de movimentação:", historyError);
            } else {
                fetchTaskDetails(taskId);
            }

            // Zerar Cronômetro Automaticamente na Conclusão da Tarefa
            const sortedStages = [...stages].sort((a, b) => a.position - b.position);
            const finalStage = sortedStages[sortedStages.length - 1];
            const isFinal = finalStage && toStageId === finalStage.id;

            if (isFinal) {
                const active = localStorage.getItem('pixel_active_timer');
                if (active) {
                    try {
                        const activeTimer = JSON.parse(active);
                        if (activeTimer && activeTimer.taskId === taskId) {
                            let totalMs = activeTimer.accumulatedTime || 0;
                            if (!activeTimer.isPaused) {
                                totalMs += (Date.now() - activeTimer.startTime);
                            }
                            const hours = parseFloat((totalMs / (1000 * 60 * 60)).toFixed(2));
                            
                            if (hours > 0.01) {
                                const { error: timesheetError } = await supabase
                                    .from('project_timesheets')
                                    .insert([{
                                        task_id: taskId,
                                        user_id: currentUser?.id,
                                        hours: hours,
                                        description: 'Apontamento automático - Conclusão da Tarefa',
                                        date: new Date().toISOString().split('T')[0]
                                    }]);
                                    
                                if (!timesheetError) {
                                    const mins = Math.round((totalMs / (1000 * 60)) % 60);
                                    const hrs = Math.floor(totalMs / (1000 * 60 * 60));
                                    const timeStr = `${hrs}h ${mins}m`;
                                    
                                    await supabase.from('project_task_comments').insert([{
                                        task_id: taskId,
                                        user_id: currentUser?.id,
                                        comment: `[CRONÔMETRO AUTOMÁTICO] Tarefa concluída. Cronômetro finalizado automaticamente. Total apontado: ${timeStr}.`
                                    }]);
                                }
                            }
                            localStorage.removeItem('pixel_active_timer');
                            setTimerState(null);
                            showToast('Cronômetro finalizado automaticamente pois a tarefa foi concluída.', 'info');
                        }
                    } catch (err) {
                        console.error('Erro ao processar cronômetro automático:', err);
                    }
                }
            }

            if (selectedProject) {
                await handleSelectProject(selectedProject);
            }

            showToast(`Projeto movido para "${targetStage.name}" com sucesso!`, 'success');
        } catch (err: any) {
            showToast('Erro ao atualizar estágio do projeto: ' + err.message, 'error');
            if (selectedProject) handleSelectProject(selectedProject);
        }
    };

    const handleDrop = async (e: React.DragEvent, targetStageId: string) => {
        e.preventDefault();
        setDraggedTaskId(null);
        const taskId = e.dataTransfer.getData('taskId');
        if (!taskId) return;

        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        if (task.stage_id === targetStageId) return;

        await moveTaskStage(taskId, task.stage_id, targetStageId);
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
                                    onClick={handleBackToProjects}
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
                        {selectedProject ? selectedProject.description || 'Gestão de tarefas do projeto' : 'Organize, planeje e acompanhe projetos e equipes'}
                    </p>
                </div>

                {!selectedProject && (
                    reachedProjectLimit ? (
                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-250 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2">
                            <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0" />
                            <span>Limite do plano (3 projetos ativos) atingido. Faça upgrade para ilimitado.</span>
                        </div>
                    ) : (
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
                    )
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
                                                    <img src={proj.manager.avatar_url} className="w-6 h-6 rounded-full object-cover"  alt="Imagem relacionada ao projeto" />
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

                        {/* Abas responsivas */}
                        <div className="overflow-x-auto no-scrollbar w-full lg:w-auto">
                            <div
                                className="flex items-center gap-2 min-w-max"
                                role="tablist"
                                aria-label="Visualizações do projeto"
                            >
                                <button
                                    type="button"
                                    role="tab"
                                    id="projects-tab-kanban"
                                    aria-selected={activeTab === 'kanban'}
                                    tabIndex={activeTab === 'kanban' ? 0 : -1}
                                    onKeyDown={handleTabKeyDown}
                                    onClick={() => handleTabClick('kanban')}
                                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                                        activeTab === 'kanban'
                                            ? 'bg-brand-primary text-white shadow-lg shadow-emerald-900/40'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                    }`}
                                >
                                    Painel
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    id="projects-tab-planning"
                                    aria-selected={activeTab === 'planning'}
                                    tabIndex={activeTab === 'planning' ? 0 : -1}
                                    onKeyDown={handleTabKeyDown}
                                    onClick={() => handleTabClick('planning')}
                                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                                        activeTab === 'planning'
                                            ? 'bg-brand-primary text-white shadow-lg shadow-emerald-900/40'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                    }`}
                                >
                                    Planejamento
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    id="projects-tab-list"
                                    aria-selected={activeTab === 'list'}
                                    tabIndex={activeTab === 'list' ? 0 : -1}
                                    onKeyDown={handleTabKeyDown}
                                    onClick={() => handleTabClick('list')}
                                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                                        activeTab === 'list'
                                            ? 'bg-brand-primary text-white shadow-lg shadow-emerald-900/40'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                    }`}
                                >
                                    Lista
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    id="projects-tab-calendar"
                                    aria-selected={activeTab === 'calendar'}
                                    tabIndex={activeTab === 'calendar' ? 0 : -1}
                                    onKeyDown={handleTabKeyDown}
                                    onClick={() => handleTabClick('calendar')}
                                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                                        activeTab === 'calendar'
                                            ? 'bg-brand-primary text-white shadow-lg shadow-emerald-900/40'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                    }`}
                                >
                                    Calendário
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    id="projects-tab-timesheet"
                                    aria-selected={activeTab === 'timesheet'}
                                    tabIndex={activeTab === 'timesheet' ? 0 : -1}
                                    onKeyDown={handleTabKeyDown}
                                    onClick={() => handleTabClick('timesheet')}
                                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                                        activeTab === 'timesheet'
                                            ? 'bg-brand-primary text-white shadow-lg shadow-emerald-900/40'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                    }`}
                                >
                                    Métricas
                                </button>
                            </div>
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
                                {activeTab === 'planning' && (
                                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/25 space-y-6">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b dark:border-slate-800 pb-4">
                                            <div>
                                                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">
                                                    Planejamento Semanal
                                                </h3>
                                                <p className="text-[10px] text-slate-450 dark:text-slate-500 mt-0.5">
                                                    Visualize e gerencie a alocação de tarefas dos colaboradores
                                                </p>
                                            </div>

                                            {/* Controles de Semana */}
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => {
                                                        const d = new Date(currentCalendarDate);
                                                        d.setDate(d.getDate() - 7);
                                                        setCurrentCalendarDate(d);
                                                    }}
                                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 text-xs font-bold rounded-xl transition-all"
                                                >
                                                    ← Semana Anterior
                                                </button>
                                                <span className="text-xs font-black text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-850 px-3 py-1.5 rounded-xl border dark:border-slate-800">
                                                    {(() => {
                                                        const startOfWeek = new Date(currentCalendarDate);
                                                        const day = startOfWeek.getDay();
                                                        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday
                                                        startOfWeek.setDate(diff);
                                                        
                                                        const endOfWeek = new Date(startOfWeek);
                                                        endOfWeek.setDate(startOfWeek.getDate() + 6);
                                                        
                                                        return `Semana: ${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}`;
                                                    })()}
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        const d = new Date(currentCalendarDate);
                                                        d.setDate(d.getDate() + 7);
                                                        setCurrentCalendarDate(d);
                                                    }}
                                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 text-xs font-bold rounded-xl transition-all"
                                                >
                                                    Próxima Semana →
                                                </button>
                                            </div>
                                        </div>

                                        {/* Grade Gantt */}
                                        <div className="overflow-x-auto rounded-2xl border dark:border-slate-800">
                                            <table className="w-full text-left border-collapse min-w-[800px]">
                                                <thead>
                                                    <tr className="border-b dark:border-slate-800 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-900/50">
                                                        <th className="px-4 py-4 w-64 border-r dark:border-slate-800">Colaborador</th>
                                                        {(() => {
                                                            const days = [];
                                                            const start = new Date(currentCalendarDate);
                                                            const day = start.getDay();
                                                            const diff = start.getDate() - day + (day === 0 ? -6 : 1);
                                                            start.setDate(diff);
                                                            
                                                            for (let i = 0; i < 7; i++) {
                                                                const current = new Date(start);
                                                                current.setDate(start.getDate() + i);
                                                                days.push(current);
                                                            }
                                                            
                                                            const weekDayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
                                                            return days.map((d, i) => {
                                                                const todayFlag = isToday(d);
                                                                return (
                                                                    <th key={i} className={`px-3 py-4 text-center border-r dark:border-slate-800 last:border-r-0 ${todayFlag ? 'bg-emerald-500/10 border-x border-emerald-500/30' : ''}`}>
                                                                        <div className={`font-bold ${todayFlag ? 'text-brand-primary' : 'text-slate-700 dark:text-slate-200'}`}>
                                                                            {weekDayNames[i]} {todayFlag && <span className="text-[8px] bg-brand-primary text-white font-black px-1 py-0.5 rounded ml-1 uppercase">Hoje</span>}
                                                                        </div>
                                                                        <div className={`text-[9px] font-medium mt-0.5 ${todayFlag ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}`}>
                                                                            {d.getDate()} / {d.getMonth() + 1}
                                                                        </div>
                                                                    </th>
                                                                );
                                                            });
                                                        })()}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                                                    {employees.map(emp => {
                                                        const start = new Date(currentCalendarDate);
                                                        const day = start.getDay();
                                                        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
                                                        start.setDate(diff);
                                                        
                                                        const days: Date[] = [];
                                                        for (let i = 0; i < 7; i++) {
                                                            const current = new Date(start);
                                                            current.setDate(start.getDate() + i);
                                                            days.push(current);
                                                        }

                                                        return (
                                                            <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                                                                <td className="px-4 py-4 w-64 border-r dark:border-slate-800 flex items-center gap-3">
                                                                    <img src={emp.avatarUrl} className="w-8 h-8 rounded-full object-cover" alt="" />
                                                                    <div>
                                                                        <div className="font-bold text-slate-800 dark:text-slate-200">{emp.name}</div>
                                                                        <div className="text-[9px] text-slate-450 truncate max-w-[150px]">{emp.role}</div>
                                                                    </div>
                                                                </td>
                                                                
                                                                {days.map((d, i) => {
                                                                    const dayTasks = tasks.filter(task => {
                                                                        if (task.assigned_to !== emp.id) return false;
                                                                        const dayTime = new Date(d);
                                                                        dayTime.setHours(0,0,0,0);
                                                                        const taskStart = new Date(task.start_date || task.created_at);
                                                                        taskStart.setHours(0,0,0,0);
                                                                        const taskEnd = task.due_date ? new Date(task.due_date) : taskStart;
                                                                        taskEnd.setHours(0,0,0,0);
                                                                        return dayTime >= taskStart && dayTime <= taskEnd;
                                                                    });

                                                                    const todayFlag = isToday(d);
                                                                    return (
                                                                        <td key={i} className={`p-2 border-r dark:border-slate-800 last:border-r-0 text-center min-h-[80px] align-top transition-colors ${todayFlag ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-x border-emerald-500/20' : 'bg-slate-50/10 dark:bg-slate-950/5'}`}>
                                                                            <div className="flex flex-col gap-1.5 h-full justify-start items-stretch">
                                                                                {dayTasks.map(t => {
                                                                                    const completed = isTaskCompleted(t);
                                                                                    return (
                                                                                        <div
                                                                                            key={t.id}
                                                                                            onClick={() => openEditTaskModal(t)}
                                                                                            style={{ borderLeft: `3px solid ${completed ? '#10B981' : (selectedProject?.color || '#10B981')}` }}
                                                                                            className={`text-left p-2 rounded-xl bg-white dark:bg-slate-850 border border-slate-100 dark:border-slate-800 text-[10px] font-bold shadow-sm cursor-pointer hover:shadow-md hover:bg-slate-50/50 dark:hover:bg-slate-750 transition-all select-none truncate ${completed ? 'opacity-60 bg-emerald-50/20 dark:bg-emerald-950/20' : ''}`}
                                                                                            title={`${t.title} - Clique para ver/editar`}
                                                                                        >
                                                                                            <div className={`truncate flex items-center gap-1 ${completed ? 'line-through text-slate-450 dark:text-slate-500' : 'text-slate-750 dark:text-slate-200'}`}>
                                                                                                {completed && <CheckIcon className="w-3 h-3 text-emerald-500 flex-shrink-0" />}
                                                                                                <span className="truncate">{t.title}</span>
                                                                                            </div>
                                                                                            <div className="flex items-center gap-1.5 mt-1 text-[8px] text-slate-400 font-medium">
                                                                                                {t.priority > 0 && !completed && <StarIcon className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />}
                                                                                                <span>{t.subtasks?.filter(s => s.is_completed).length || 0}/{t.subtasks?.length || 0} sub</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                                {dayTasks.length === 0 && (
                                                                                    <span className="text-[10px] text-slate-300 dark:text-slate-700 italic block py-4">-</span>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 1: KANBAN BOARD */}
                                {activeTab === 'kanban' && (
                                    <div className="flex gap-6 items-start overflow-x-auto pb-4 no-scrollbar">
                                        {stages.map(stage => {
                                            const stageTasks = filteredTasks.filter(t => t.stage_id === stage.id);
                                            
                                            const totalStageItems = stageTasks.reduce((acc, t) => {
                                                const items = t.checklist_items?.[stage.id] || stage.checklist_items || [];
                                                return acc + items.length;
                                            }, 0);
                                            const completedStageItems = stageTasks.reduce((acc, t) => {
                                                const items = t.checklist_items?.[stage.id] || stage.checklist_items || [];
                                                const statusObj = t.checklist_status?.[stage.id] || {};
                                                const completedCount = items.filter(item => statusObj[item]).length;
                                                return acc + completedCount;
                                            }, 0);
                                            
                                            const columnProgress = totalStageItems > 0
                                                ? Math.round((completedStageItems / totalStageItems) * 100)
                                                : (stageTasks.length > 0
                                                    ? Math.round((stageTasks.filter(t => {
                                                        const stageName = stages.find(s => s.id === t.stage_id)?.name || '';
                                                        return stageName === 'Concluído' || stageName === 'Done';
                                                    }).length / stageTasks.length) * 100)
                                                    : 0);
                                            return (
                                                <div
                                                    key={stage.id}
                                                    onDragOver={handleDragOver}
                                                    onDrop={(e) => handleDrop(e, stage.id)}
                                                    className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/30 dark:shadow-none min-h-[450px] flex flex-col flex-shrink-0 w-80"
                                                >
                                                    {/* Header do Estágio */}
                                                    <div className="flex justify-between items-center mb-1 pb-1">
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

                                                    {/* Barra de Progresso do Estágio */}
                                                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2">
                                                        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${columnProgress}%`, backgroundColor: selectedProject?.color || '#10B981' }}></div>
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
                                                            const currentStage = stages.find(s => s.id === task.stage_id);
                                                            return (
                                                                <div
                                                                    key={task.id}
                                                                    draggable
                                                                    onDragStart={(e) => handleDragStart(e, task)}
                                                                    onClick={() => openEditTaskModal(task)}
                                                                    className={`bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl cursor-grab active:cursor-grabbing transition-all duration-205 shadow-sm hover:shadow-md group relative ${draggedTaskId === task.id ? 'rotate-[25deg] scale-95 opacity-50' : ''} ${justDroppedTaskId === task.id ? 'animate-wiggle-shake' : ''}`}
                                                                >
                                                                    {task.cover_url && (
                                                                        <img src={task.cover_url} className="w-full h-24 object-cover rounded-xl mb-3" alt="" />
                                                                    )}

                                                                    <span className="text-[9px] text-slate-400 font-semibold block mb-1">
                                                                        {getRelativeTime(task.created_at)}
                                                                    </span>

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

                                                                    {/* Barra de Progresso dos Setores (Fases) */}
                                                                    {(() => {
                                                                        const stageIdx = stages.findIndex(s => s.id === task.stage_id);
                                                                        const progressPct = stages.length > 1 ? Math.round((stageIdx / (stages.length - 1)) * 100) : 0;
                                                                        return (
                                                                            <div className="mt-3 mb-2">
                                                                                <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 dark:text-slate-500 mb-1">
                                                                                    <span>Setores (Fases)</span>
                                                                                    <span>{progressPct}%</span>
                                                                                </div>
                                                                                <div className="w-full bg-slate-100 dark:bg-slate-700/50 h-1.5 rounded-full overflow-hidden">
                                                                                    <div 
                                                                                        className="h-full rounded-full transition-all duration-500" 
                                                                                        style={{ width: `${progressPct}%`, backgroundColor: selectedProject?.color || '#10B981' }}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })()}

                                                                    {(() => {
                                                                        const items = task.checklist_items?.[currentStage.id] || currentStage.checklist_items || [];
                                                                        if (!currentStage || items.length === 0) return null;
                                                                        return (
                                                                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
                                                                                <div className="text-[9px] font-bold text-slate-450 dark:text-slate-500 mb-1 uppercase">Checklist do Setor</div>
                                                                                {items.map((item, idx) => {
                                                                                    const isCompleted = !!task.checklist_status?.[currentStage.id]?.[item];
                                                                                    const isReadOnly = !canUserModifyTaskInStage(task, currentStage);
                                                                                    return (
                                                                                        <label
                                                                                            key={idx}
                                                                                            onClick={(e) => e.stopPropagation()}
                                                                                            className="flex items-center space-x-2 text-[10px] text-slate-600 dark:text-slate-450 cursor-pointer hover:text-brand-primary"
                                                                                        >
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                checked={isCompleted}
                                                                                                disabled={isReadOnly}
                                                                                                onChange={async () => {
                                                                                                    if (isReadOnly) {
                                                                                                        showToast("Sem permissão para alterar o checklist deste setor.", "error");
                                                                                                        return;
                                                                                                    }
                                                                                                    const updatedStatus = {
                                                                                                        ...(task.checklist_status || {}),
                                                                                                        [currentStage.id]: {
                                                                                                            ...(task.checklist_status?.[currentStage.id] || {}),
                                                                                                            [item]: !isCompleted
                                                                                                        }
                                                                                                    };
                                                                                                    try {
                                                                                                        const { error } = await supabase
                                                                                                            .from('project_tasks')
                                                                                                            .update({ checklist_status: updatedStatus })
                                                                                                            .eq('id', task.id);
                                                                                                        if (error) throw error;
                                                                                                        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, checklist_status: updatedStatus } : t));
                                                                                                        showToast("Checklist atualizado!", "success");
                                                                                                    } catch (err: any) {
                                                                                                        showToast("Erro ao atualizar checklist: " + err.message, "error");
                                                                                                    }
                                                                                                }}
                                                                                                className="rounded text-brand-primary focus:ring-emerald-500 w-3 h-3"
                                                                                            />
                                                                                            <span className={isCompleted ? 'line-through opacity-50' : ''}>{item}</span>
                                                                                        </label>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        );
                                                                    })()}

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
                                                                            {/* Apontamento de Horas */}
                                                                            {(() => {
                                                                                const hours = task.timesheets?.reduce((acc, curr) => acc + curr.hours, 0) || 0;
                                                                                return hours > 0 ? (
                                                                                    <div className="flex items-center gap-1 text-slate-450">
                                                                                        <ClockIcon className="w-3.5 h-3.5" />
                                                                                        <span className="font-bold text-[9px] bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded-lg">{hours}h</span>
                                                                                    </div>
                                                                                ) : null;
                                                                            })()}

                                                                            {/* Chatter Button */}
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    openEditTaskModal(task);
                                                                                }}
                                                                                className="p-1 text-slate-455 hover:text-brand-primary hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg transition-colors"
                                                                                title="Clique para conversar"
                                                                            >
                                                                                <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                                                                            </button>

                                                                            {/* Estrela de Prioridade */}
                                                                            {task.priority > 0 && (
                                                                                <StarIcon className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                                                            )}

                                                                            {/* Avatar do Responsável */}
                                                                            {task.assignee?.avatar_url ? (
                                                                                <img src={task.assignee.avatar_url} className="w-5 h-5 rounded-full object-cover" title={task.assignee.full_name}  alt="Imagem relacionada ao projeto" />
                                                                            ) : (
                                                                                <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[8px] font-bold text-slate-400 dark:text-slate-355 uppercase" title={task.assignee?.full_name || 'Sem responsável'}>
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
                                                        <th className="px-6 py-4">Horas Apontadas</th>
                                                        <th className="px-6 py-4">Data Limite</th>
                                                        <th className="px-6 py-4">Tags</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-xs divide-y divide-slate-100 dark:divide-slate-800/50">
                                                    {filteredTasks.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={7} className="text-center py-10 text-slate-400 italic">Nenhuma tarefa encontrada.</td>
                                                        </tr>
                                                    ) : (
                                                        filteredTasks.map(task => {
                                                            const stageName = stages.find(s => s.id === task.stage_id)?.name || 'Sem estágio';
                                                            const isCompleted = isTaskCompleted(task);
                                                            const subtasks = task.subtasks || [];
                                                            const completedSubtasks = subtasks.filter(s => s.is_completed).length;
                                                            const subtasksPct = subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;
                                                            
                                                            const isOverdue = task.due_date && !isCompleted && new Date(task.due_date) < new Date();
                                                            const taskHours = task.timesheets?.reduce((acc, curr) => acc + curr.hours, 0) || 0;
                                                            
                                                            return (
                                                                <tr
                                                                    key={task.id}
                                                                    onClick={() => openEditTaskModal(task)}
                                                                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                                                                >
                                                                    <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">
                                                                        <div className="flex flex-col gap-1.5">
                                                                            <span className={`font-bold ${isCompleted ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-750 dark:text-slate-200'}`}>
                                                                                {task.title}
                                                                            </span>
                                                                            {subtasks.length > 0 && (
                                                                                <div className="w-40 mt-1">
                                                                                    <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase mb-0.5">
                                                                                        <span>Checklist</span>
                                                                                        <span>{subtasksPct}%</span>
                                                                                    </div>
                                                                                    <div className="w-full bg-gray-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                                                                                        <div className="bg-brand-primary h-full rounded-full" style={{ width: `${subtasksPct}%` }}></div>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-4">
                                                                        <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase">
                                                                            {stageName}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-semibold">{task.assignee?.full_name || '-'}</td>
                                                                    <td className="px-6 py-4">
                                                                        {task.priority === 1 ? (
                                                                            <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 text-[10px] font-bold border border-red-100 dark:border-red-900/30">
                                                                                ⭐ Alta
                                                                            </span>
                                                                        ) : (
                                                                            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 text-[10px] font-medium border border-transparent">
                                                                                Normal
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-6 py-4 font-bold text-slate-600 dark:text-slate-350">
                                                                        {taskHours > 0 ? `${taskHours.toFixed(2)}h` : '-'}
                                                                    </td>
                                                                    <td className={`px-6 py-4 font-semibold ${isOverdue ? 'text-red-500 font-bold flex items-center gap-1' : 'text-slate-500'}`}>
                                                                        {isOverdue && <ExclamationTriangleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />}
                                                                        {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                                                                    </td>
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
                                                const todayFlag = day ? isToday(day) : false;
                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`min-h-[100px] border p-2 rounded-xl flex flex-col justify-between transition-all ${
                                                            todayFlag 
                                                                ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-brand-primary ring-1 ring-brand-primary shadow-sm' 
                                                                : day 
                                                                    ? 'bg-slate-50/20 dark:bg-slate-900 border-slate-100 dark:border-slate-800' 
                                                                    : 'bg-slate-50/50 dark:bg-slate-950/20 opacity-30 border-transparent'
                                                        }`}
                                                    >
                                                        {day && (
                                                            <>
                                                                <div className="flex justify-between items-center">
                                                                    <span className={`text-xs font-black ${todayFlag ? 'text-brand-primary' : 'text-slate-400 dark:text-slate-500'}`}>{day.getDate()}</span>
                                                                    {todayFlag && <span className="text-[8px] bg-brand-primary text-white font-black px-1 py-0.2 rounded uppercase">Hoje</span>}
                                                                </div>
                                                                <div className="space-y-1 mt-2 overflow-y-auto max-h-[75px] no-scrollbar">
                                                                    {dayTasks.map(t => {
                                                                        const completed = isTaskCompleted(t);
                                                                        return (
                                                                            <button
                                                                                key={t.id}
                                                                                onClick={() => openEditTaskModal(t)}
                                                                                style={{ borderLeft: `3px solid ${completed ? '#10B981' : selectedProject.color}` }}
                                                                                className={`w-full text-left p-1 rounded border dark:border-slate-700 text-[8px] font-bold truncate transition-colors flex items-center gap-1 ${
                                                                                    completed 
                                                                                        ? 'bg-emerald-50/30 dark:bg-emerald-950/20 line-through text-slate-400 dark:text-slate-500 hover:bg-emerald-100/30' 
                                                                                        : 'bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750'
                                                                                }`}
                                                                            >
                                                                                {completed && <CheckIcon className="w-2.5 h-2.5 text-emerald-500 flex-shrink-0" />}
                                                                                <span className="truncate">{t.title}</span>
                                                                            </button>
                                                                        );
                                                                    })}
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
                                {activeTab === 'timesheet' && (() => {
                                    const realTotalHours = tasks.reduce((acc, t) => {
                                        const taskHours = t.timesheets?.reduce((sum, ts) => sum + ts.hours, 0) || 0;
                                        return acc + taskHours;
                                    }, 0);

                                    const tasksWithHours = tasks.map(t => {
                                        const totalHours = t.timesheets?.reduce((sum, ts) => sum + ts.hours, 0) || 0;
                                        return {
                                            id: t.id,
                                            title: t.title,
                                            totalHours
                                        };
                                    }).filter(t => t.totalHours > 0);

                                    // Integrantes do projeto (gerente ou designado em tarefa ou com horas apontadas)
                                    const projectMembers = (() => {
                                        const memberIds = new Set<string>();
                                        if (selectedProject?.manager_id) {
                                            memberIds.add(selectedProject.manager_id);
                                        }
                                        tasks.forEach(task => {
                                            if (task.assigned_to) {
                                                memberIds.add(task.assigned_to);
                                            }
                                            task.timesheets?.forEach(ts => {
                                                if (ts.user_id) {
                                                    memberIds.add(ts.user_id);
                                                }
                                            });
                                        });
                                        return employees.filter(emp => memberIds.has(emp.id));
                                    })();

                                    const collabChartData = (() => {
                                        if (!selectedCollabId) return [];
                                        return tasks.map(task => {
                                            const collabHours = task.timesheets
                                                ?.filter(ts => ts.user_id === selectedCollabId)
                                                .reduce((sum, ts) => sum + ts.hours, 0) || 0;
                                            return {
                                                name: task.title.length > 15 ? task.title.substring(0, 15) + '...' : task.title,
                                                fullName: task.title,
                                                horas: parseFloat(collabHours.toFixed(2))
                                            };
                                        }).filter(t => t.horas > 0);
                                    })();

                                    const completedTasksCount = tasks.filter(t => isTaskCompleted(t)).length;
                                    const completionRate = tasks.length > 0 ? Math.round((completedTasksCount / tasks.length) * 100) : 0;
                                    const overdueTasksCount = tasks.filter(t => t.due_date && !isTaskCompleted(t) && new Date(t.due_date) < new Date()).length;
                                    const activeCollaboratorsCount = projectMembers.length;

                                    return (
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                            {/* Cartões Estatísticos e Distribuição */}
                                            <div className="lg:col-span-2 space-y-6">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/10 flex flex-col justify-between">
                                                        <p className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider mb-2">Total de Tarefas</p>
                                                        <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{tasks.length}</p>
                                                    </div>
                                                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/10 flex flex-col justify-between">
                                                        <p className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider mb-2">Concluídas</p>
                                                        <p className="text-3xl font-black text-emerald-500">{completedTasksCount}</p>
                                                    </div>
                                                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/10 flex flex-col justify-between">
                                                        <p className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider mb-2">Taxa Conclusão</p>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-3xl font-black text-indigo-500">{completionRate}%</p>
                                                            <div className="w-10 bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden shrink-0">
                                                                <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${completionRate}%` }}></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/10 flex flex-col justify-between">
                                                        <p className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider mb-2">Atrasadas</p>
                                                        <p className={`text-3xl font-black ${overdueTasksCount > 0 ? 'text-red-500 animate-pulse' : 'text-slate-400 dark:text-slate-500'}`}>
                                                            {overdueTasksCount}
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

                                                {/* Soma de Horas por Tarefa */}
                                                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/25">
                                                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-6 flex items-center gap-2">
                                                        <ListBulletIcon className="w-5 h-5 text-brand-primary" />
                                                        Tempo Gasto por Tarefa
                                                    </h4>
                                                    {tasksWithHours.length > 0 ? (
                                                        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto pr-2">
                                                            {tasksWithHours.map(task => {
                                                                const percentage = realTotalHours > 0 ? Math.round((task.totalHours / realTotalHours) * 100) : 0;
                                                                return (
                                                                    <div key={task.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                                                                        <div className="min-w-0 flex-1">
                                                                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{task.title}</p>
                                                                            <div className="mt-2 w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                                                                <div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: selectedProject.color || '#10B981' }}></div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-right shrink-0">
                                                                            <span className="text-sm font-black text-slate-800 dark:text-slate-100">{task.totalHours.toFixed(2)}h</span>
                                                                            <p className="text-[10px] text-slate-450 font-bold uppercase">{percentage}% do total</p>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-center text-slate-400 py-8">Nenhuma tarefa deste projeto registrou tempo apontado até o momento.</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Coluna Direita: Progresso de Horas e Gráfico */}
                                            <div className="space-y-6">
                                                {/* Progresso de Horas do Projeto */}
                                                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/25 flex flex-col justify-between">
                                                    <div>
                                                        <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-4 flex items-center gap-2">
                                                            <ClockIcon className="w-5 h-5 text-brand-primary" />
                                                            Apontamento de Horas
                                                        </h4>
                                                        <p className="text-xs text-slate-450 dark:text-slate-500 mb-6">Total de horas reais registradas na equipe para este projeto.</p>
                                                        
                                                        <div className="flex items-baseline gap-2 mb-6">
                                                            <span className="text-5xl font-black text-slate-800 dark:text-slate-100">
                                                                {realTotalHours.toFixed(2)}
                                                            </span>
                                                            <span className="text-xs font-bold text-slate-450 uppercase">horas totais</span>
                                                        </div>
                                                    </div>

                                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border dark:border-slate-800 text-xs">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <p className="font-bold text-slate-700 dark:text-slate-300">Equipe Dedicada</p>
                                                            <span className="text-[10px] bg-brand-primary/10 text-brand-primary font-bold px-2 py-0.5 rounded-full border border-brand-primary/20">{activeCollaboratorsCount} ativos</span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {projectMembers.slice(0, 5).map(e => (
                                                                <div key={e.id} className="flex items-center gap-1.5 bg-white dark:bg-slate-850 px-2.5 py-1 rounded-full border dark:border-slate-800">
                                                                    {e.avatarUrl ? (
                                                                        <img src={e.avatarUrl} className="w-4 h-4 rounded-full object-cover"  alt="Imagem relacionada ao projeto" />
                                                                    ) : (
                                                                        <div className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[7px] font-bold text-slate-400 uppercase">{e.name.substring(0,2)}</div>
                                                                    )}
                                                                    <span className="font-semibold text-slate-500">{e.name.split(' ')[0]}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Seção Gráfico por Colaborador */}
                                                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/25 space-y-4">
                                                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                                                        <UsersIcon className="w-5 h-5 text-brand-primary" />
                                                        Métricas por Colaborador
                                                    </h4>
                                                    <p className="text-xs text-slate-450 dark:text-slate-500">Selecione um membro da equipe para visualizar o detalhamento de horas por tarefa.</p>
                                                    
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Selecionar Colaborador</label>
                                                        <select
                                                            value={selectedCollabId}
                                                            onChange={(e) => setSelectedCollabId(e.target.value)}
                                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent dark:text-slate-200"
                                                        >
                                                            <option value="">Selecione um colaborador...</option>
                                                            {projectMembers.map(member => (
                                                                <option key={member.id} value={member.id}>
                                                                    {member.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {selectedCollabId ? (
                                                        collabChartData.length > 0 ? (
                                                            <div className="h-64 mt-4 w-full min-w-0">
                                                                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                                                    <BarChart data={collabChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-slate-800" />
                                                                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                                                                        <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} />
                                                                        <Tooltip 
                                                                            contentStyle={{ 
                                                                                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                                                                                border: 'none', 
                                                                                borderRadius: '12px',
                                                                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                                                                color: '#1E293B' 
                                                                            }} 
                                                                            labelFormatter={(label, items) => {
                                                                                const fullItem = items[0]?.payload;
                                                                                return fullItem ? fullItem.fullName : label;
                                                                            }}
                                                                        />
                                                                        <Bar dataKey="horas" fill={selectedProject.color || '#10B981'} radius={[4, 4, 0, 0]} />
                                                                    </BarChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-center text-slate-400 py-8">Este colaborador não possui horas apontadas neste projeto.</p>
                                                        )
                                                    ) : (
                                                        <p className="text-xs text-center text-slate-400 py-8">Selecione um colaborador para ver o gráfico.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </>
                        )}
                    </div>
                </Card>
            )}

            {/* --- MODAL 1: CRIAR / EDITAR PROJETO --- */}
            {isProjectModalOpen && (
                <ModalPortal className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 pandanet-modal-viewport">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-scale-in">
                        <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center">
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                                {editingProject ? 'Editar Projeto' : 'Novo Projeto'}
                            </h3>
                            <button onClick={() => { setIsProjectModalOpen(false); setProjectStagesForm([]); }} className="text-slate-450 hover:text-slate-600 font-bold">✕</button>
                        </div>

                        <form onSubmit={handleSaveProject} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
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
                                    rows={2}
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

                            {/* --- SETORES E CHECKLISTS DO PROJETO --- */}
                            <div className="border-t pt-4 dark:border-slate-800 space-y-4">
                                <div className="flex justify-between items-center">
                                    <label className="block text-[10px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-widest">Setores / Estágios do Projeto</label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setProjectStagesForm([
                                                ...projectStagesForm,
                                                { name: `Setor ${projectStagesForm.length + 1}`, responsible_id: '', checklist_items: [] }
                                            ]);
                                        }}
                                        className="text-xs font-black text-brand-primary hover:text-emerald-600 flex items-center gap-1"
                                    >
                                        + Adicionar Setor
                                    </button>
                                </div>

                                <div className="space-y-4 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                                    {projectStagesForm.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic text-center py-4">Nenhum setor configurado. Adicione setores para este projeto.</p>
                                    ) : (
                                        projectStagesForm.map((stage, sIdx) => (
                                            <div key={sIdx} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border dark:border-slate-800/80 space-y-3 relative group/stage">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setProjectStagesForm(projectStagesForm.filter((_, i) => i !== sIdx));
                                                    }}
                                                    className="absolute top-3 right-3 text-slate-400 hover:text-red-500 text-xs font-bold opacity-0 group-hover/stage:opacity-100 transition-opacity"
                                                    title="Remover Setor"
                                                >
                                                    ✕
                                                </button>
                                                
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">Nome do Setor</label>
                                                        <input
                                                            type="text"
                                                            required
                                                            value={stage.name}
                                                            onChange={(e) => {
                                                                const newStages = [...projectStagesForm];
                                                                newStages[sIdx].name = e.target.value;
                                                                setProjectStagesForm(newStages);
                                                            }}
                                                            placeholder="Ex: Comercial"
                                                            className="w-full p-2 border rounded-xl text-xs outline-none dark:bg-slate-850 dark:border-slate-750 dark:text-white"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">Responsável pelo Setor</label>
                                                        <select
                                                            value={stage.responsible_id}
                                                            onChange={(e) => {
                                                                const newStages = [...projectStagesForm];
                                                                newStages[sIdx].responsible_id = e.target.value;
                                                                setProjectStagesForm(newStages);
                                                            }}
                                                            className="w-full p-2 border rounded-xl text-xs outline-none dark:bg-slate-850 dark:border-slate-750 dark:text-white bg-white"
                                                        >
                                                            <option value="">Selecione o responsável</option>
                                                            {employees.map(emp => (
                                                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Checklist do Setor */}
                                                <div className="space-y-2">
                                                    <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">Itens de Checklist</label>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {stage.checklist_items.map((item: string, iIdx: number) => (
                                                            <div key={iIdx} className="flex items-center gap-1 bg-white dark:bg-slate-850 px-2 py-1 rounded-lg border dark:border-slate-750 text-[10px] font-semibold text-slate-600 dark:text-slate-350">
                                                                <span>{item}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newStages = [...projectStagesForm];
                                                                        newStages[sIdx].checklist_items = stage.checklist_items.filter((_: any, i: number) => i !== iIdx);
                                                                        setProjectStagesForm(newStages);
                                                                    }}
                                                                    className="text-slate-400 hover:text-red-500 font-bold"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            placeholder="Novo item de checklist..."
                                                            id={`new-item-${sIdx}`}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    const val = (e.target as HTMLInputElement).value.trim();
                                                                    if (val) {
                                                                        const newStages = [...projectStagesForm];
                                                                        newStages[sIdx].checklist_items = [...stage.checklist_items, val];
                                                                        setProjectStagesForm(newStages);
                                                                        (e.target as HTMLInputElement).value = '';
                                                                    }
                                                                }
                                                            }}
                                                            className="flex-grow p-2 border rounded-xl text-xs outline-none dark:bg-slate-850 dark:border-slate-750 dark:text-white"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const input = document.getElementById(`new-item-${sIdx}`) as HTMLInputElement;
                                                                const val = input?.value.trim();
                                                                if (val) {
                                                                    const newStages = [...projectStagesForm];
                                                                    newStages[sIdx].checklist_items = [...stage.checklist_items, val];
                                                                    setProjectStagesForm(newStages);
                                                                    input.value = '';
                                                                }
                                                            }}
                                                            className="px-3 bg-brand-primary text-white text-xs font-bold rounded-xl"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-800">
                                <button type="button" onClick={() => { setIsProjectModalOpen(false); setProjectStagesForm([]); }} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-xl text-xs font-bold uppercase">Cancelar</button>
                                <button type="submit" className="px-6 py-2 bg-brand-primary text-white hover:bg-emerald-600 rounded-xl text-xs font-bold uppercase shadow-lg shadow-emerald-100">Confirmar</button>
                            </div>
                        </form>
                    </div>
                </ModalPortal>
            )}

             {isTaskModalOpen && (() => {
                const currentStage = selectedTask ? stages.find(s => s.id === selectedTask.stage_id) : null;
                const isReadOnly = !isNewTaskMode && !canUserModifyTaskInStage(selectedTask, currentStage);
                return (
                    <ModalPortal className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in pandanet-modal-viewport">
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
                                    {!isNewTaskMode && !isReadOnly && (
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

                            {/* Status Bar / Workflow Transitions (Odoo-Style) */}
                            {!isNewTaskMode && selectedTask && (
                                <div className="px-6 py-3 border-b dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/30 flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase overflow-x-auto no-scrollbar">
                                        {stages.map((stage, idx) => {
                                            const isCurrent = stage.id === selectedTask.stage_id;
                                            return (
                                                <React.Fragment key={stage.id}>
                                                    {idx > 0 && <span className="text-slate-300 dark:text-slate-700 mx-1">→</span>}
                                                    <span className={`px-2 py-1 rounded-md transition-all ${isCurrent ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/30' : 'text-slate-400 dark:text-slate-500'}`}>
                                                        {stage.name}
                                                    </span>
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {(() => {
                                            const currentStageIdx = stages.findIndex(s => s.id === selectedTask.stage_id);
                                            const prevStage = currentStageIdx > 0 ? stages[currentStageIdx - 1] : null;
                                            const nextStage = currentStageIdx !== -1 && currentStageIdx < stages.length - 1 ? stages[currentStageIdx + 1] : null;
                                            
                                            const incompleteItems = getIncompleteStageChecklistItems(selectedTask, currentStage);
                                            const isChecklistComplete = incompleteItems.length === 0;

                                            return (
                                                <>
                                                    {prevStage && (
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                if (isReadOnly) {
                                                                    showToast("Sem permissão para movimentar esta tarefa.", "error");
                                                                    return;
                                                                }
                                                                if (confirm(`Deseja devolver o projeto para o setor "${prevStage.name}"?`)) {
                                                                    await moveTaskStage(selectedTask.id, selectedTask.stage_id, prevStage.id);
                                                                }
                                                            }}
                                                            disabled={isReadOnly}
                                                            className={`px-3 py-1.5 border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        >
                                                            <span>↩ Devolver para: {prevStage.name}</span>
                                                        </button>
                                                    )}

                                                    {nextStage && (
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                if (isReadOnly) {
                                                                    showToast("Sem permissão para movimentar esta tarefa.", "error");
                                                                    return;
                                                                }
                                                                if (!isChecklistComplete) {
                                                                    showToast(`Bloqueio: Conclua todos os itens de checklist do setor atual (${incompleteItems.length} pendentes) antes de avançar.`, 'error');
                                                                    return;
                                                                }
                                                                await moveTaskStage(selectedTask.id, selectedTask.stage_id, nextStage.id);
                                                            }}
                                                            disabled={isReadOnly || !isChecklistComplete}
                                                            className={`px-3 py-1.5 text-white bg-brand-primary hover:bg-emerald-600 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-1 shadow-sm ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''} ${!isChecklistComplete ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed hover:bg-slate-300' : ''}`}
                                                            title={!isChecklistComplete ? `Finalize o checklist de ${currentStage?.name} para avançar` : ''}
                                                        >
                                                            <span>Avançar para: {nextStage.name} ➔</span>
                                                        </button>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}

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
                                                disabled={isReadOnly}
                                                value={taskForm.title}
                                                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                                                placeholder="Ex: Implementar menu lateral"
                                                className={`w-full p-2.5 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-primary/20 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-bold ${isReadOnly ? 'bg-slate-100 dark:bg-slate-850 cursor-not-allowed opacity-75' : ''}`}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Descrição</label>
                                            <textarea
                                                disabled={isReadOnly}
                                                value={taskForm.description}
                                                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                                                placeholder="Descreva as especificações desta tarefa..."
                                                rows={4}
                                                className={`w-full p-3 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-primary/20 dark:bg-slate-800 dark:border-slate-700 dark:text-white ${isReadOnly ? 'bg-slate-100 dark:bg-slate-850 cursor-not-allowed opacity-75' : ''}`}
                                            />
                                        </div>

                                        {/* Mapeamento de Tags */}
                                        <div>
                                            <label className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Etiquetas (Tags)</label>
                                            <div className="flex flex-wrap gap-1.5 mb-2">
                                                {taskForm.tags.map((tag, i) => (
                                                    <span key={i} className="px-2 py-0.5 rounded bg-brand-primary/10 text-brand-primary text-[9px] font-black uppercase flex items-center gap-1">
                                                        {tag}
                                                        {!isReadOnly && (
                                                            <button type="button" onClick={() => handleRemoveTag(tag)} className="text-brand-primary font-bold hover:text-red-500">✕</button>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                            {!isReadOnly && (
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
                                            )}
                                        </div>

                                        {/* Barra de Progresso dos Setores (Fases) no Modal */}
                                        {!isNewTaskMode && (
                                            <div className="pt-2">
                                                {(() => {
                                                    const stageIdx = stages.findIndex(s => s.id === selectedTask?.stage_id);
                                                    const progressPct = stages.length > 1 ? Math.round((stageIdx / (stages.length - 1)) * 100) : 0;
                                                    return (
                                                        <>
                                                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-wider">
                                                                <span>Progresso nos Setores</span>
                                                                <span>{progressPct}%</span>
                                                            </div>
                                                            <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                                                                <div 
                                                                    className="h-full rounded-full transition-all duration-500" 
                                                                    style={{ width: `${progressPct}%`, backgroundColor: selectedProject?.color || '#10B981' }}
                                                                />
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>

                                    {/* CHECKLIST DO SETOR ATUAL */}
                                    {/* CHECKLIST DO SETOR ATUAL */}
                                    {!isNewTaskMode && currentStage && (
                                        (() => {
                                            const items = selectedTask?.checklist_items?.[currentStage.id] || currentStage.checklist_items || [];
                                            if (items.length === 0) {
                                                return (
                                                    <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-dashed dark:border-slate-800 text-center py-6">
                                                        <ClipboardDocumentCheckIcon className="w-8 h-8 text-slate-300 dark:text-slate-650 mx-auto mb-2" />
                                                        <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                                            Sem checklist para o setor {currentStage.name}
                                                        </h4>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border dark:border-slate-800 space-y-4">
                                                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-250 uppercase tracking-wider flex items-center gap-2">
                                                        <ClipboardDocumentCheckIcon className="w-4 h-4 text-brand-primary" />
                                                        Checklist do Setor: {currentStage.name}
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {items.map((item, idx) => {
                                                            const isCompleted = !!selectedTask?.checklist_status?.[currentStage.id]?.[item];
                                                            return (
                                                                <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl">
                                                                    <label className={`flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-650 dark:text-slate-350 ${isReadOnly ? 'cursor-not-allowed opacity-80' : ''}`}>
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isCompleted}
                                                                            disabled={isReadOnly}
                                                                            onChange={async () => {
                                                                                if (!selectedTask) return;
                                                                                if (isReadOnly) {
                                                                                    showToast("Sem permissão para alterar o checklist deste setor.", "error");
                                                                                    return;
                                                                                }
                                                                                const updatedStatus = {
                                                                                    ...(selectedTask.checklist_status || {}),
                                                                                    [currentStage.id]: {
                                                                                        ...(selectedTask.checklist_status?.[currentStage.id] || {}),
                                                                                        [item]: !isCompleted
                                                                                    }
                                                                                };
                                                                                try {
                                                                                    const { error } = await supabase
                                                                                        .from('project_tasks')
                                                                                        .update({ checklist_status: updatedStatus })
                                                                                        .eq('id', selectedTask.id);
                                                                                    if (error) throw error;
                                                                                    
                                                                                    setSelectedTask({
                                                                                        ...selectedTask,
                                                                                        checklist_status: updatedStatus
                                                                                    });
                                                                                    setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, checklist_status: updatedStatus } : t));
                                                                                    showToast("Checklist atualizado!", "success");
                                                                                } catch (err: any) {
                                                                                    showToast("Erro ao atualizar checklist: " + err.message, "error");
                                                                                }
                                                                            }}
                                                                            className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary w-4 h-4 cursor-pointer"
                                                                        />
                                                                        <span className={isCompleted ? 'line-through text-slate-400 dark:text-slate-500 font-normal' : ''}>
                                                                            {item}
                                                                        </span>
                                                                    </label>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })()
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
                                    {/* TIMER WIDGET (CRONÔMETRO DE TAREFA) */}
                                    {!isNewTaskMode && (
                                        <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border dark:border-slate-800 space-y-4">
                                            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest border-b pb-2 flex items-center gap-1.5">
                                                <ClockIcon className="w-4 h-4 text-brand-primary" />
                                                Apontamento em Tempo Real
                                            </h4>
                                            
                                            {timerState ? (
                                                timerState.taskId === selectedTask?.id ? (
                                                    <div className="flex flex-col items-center justify-center py-4 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl space-y-3 relative">
                                                        {timerState.isPaused && (
                                                            <div className="absolute top-1.5 left-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase">
                                                                Pausado ({timerState.pauseReason})
                                                            </div>
                                                        )}
                                                        <div className={`text-3xl font-black tracking-widest tabular-nums ${timerState.isPaused ? 'text-slate-400' : 'text-brand-primary'}`}>
                                                            {elapsedTimeStr}
                                                        </div>
                                                        
                                                        <div className="flex w-full px-3 gap-2">
                                                            {timerState.isPaused ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={resumeTimer}
                                                                    className="flex-1 py-2 bg-brand-primary text-white text-xs font-bold rounded-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-1"
                                                                >
                                                                    <span>Retomar</span>
                                                                </button>
                                                            ) : (
                                                                <div className="relative flex-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setShowPauseMenu(!showPauseMenu)}
                                                                        className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-650 dark:text-slate-350 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1"
                                                                    >
                                                                        <span>Pausar</span>
                                                                        <ChevronDownIcon className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    
                                                                    {showPauseMenu && (
                                                                        <div className="absolute bottom-full mb-1 left-0 w-44 bg-white dark:bg-slate-950 border dark:border-slate-800 rounded-xl shadow-xl z-10 py-1 overflow-hidden">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => pauseTimer('Intervalo de 10 min', 10)}
                                                                                className="w-full text-left px-3.5 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold"
                                                                            >
                                                                                10 minutos
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => pauseTimer('Intervalo de 20 min', 20)}
                                                                                className="w-full text-left px-3.5 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold"
                                                                            >
                                                                                20 minutos
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => pauseTimer('Intervalo de 30 min', 30)}
                                                                                className="w-full text-left px-3.5 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold"
                                                                            >
                                                                                30 minutos
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => pauseTimer('Almoço', 60)}
                                                                                className="w-full text-left px-3.5 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold"
                                                                            >
                                                                                Almoço
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => pauseTimer('Pausa Livre')}
                                                                                className="w-full text-left px-3.5 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold border-t dark:border-slate-800"
                                                                            >
                                                                                Pausa Livre
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowStopConfirm(true)}
                                                                className="flex-1 py-2 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all flex items-center justify-center gap-1"
                                                            >
                                                                <span>Finalizar</span>
                                                            </button>
                                                        </div>

                                                        {showStopConfirm && (
                                                            <div className="absolute inset-0 bg-white dark:bg-slate-900 p-3 flex flex-col justify-between z-20 rounded-xl">
                                                                <div className="space-y-2">
                                                                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">Lançar Apontamento</p>
                                                                    <input
                                                                        type="text"
                                                                        placeholder="O que você desenvolveu?"
                                                                        value={stopDescription}
                                                                        onChange={(e) => setStopDescription(e.target.value)}
                                                                        className="w-full p-2 border rounded-lg text-xs outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white bg-slate-50 dark:bg-slate-950"
                                                                    />
                                                                </div>
                                                                <div className="flex gap-2 mt-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => { setShowStopConfirm(false); setStopDescription(''); }}
                                                                        className="flex-1 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-lg"
                                                                    >
                                                                        Voltar
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={stopTimer}
                                                                        className="flex-1 py-1.5 bg-brand-primary text-white text-xs font-bold rounded-lg hover:bg-emerald-600"
                                                                    >
                                                                        Confirmar
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-700 dark:text-amber-400 font-semibold leading-relaxed">
                                                        <ExclamationTriangleIcon className="w-4 h-4 inline mr-1 mb-0.5" />
                                                        Você possui um cronômetro ativo em: <strong className="underline">{timerState.taskTitle}</strong>.
                                                        Finalize-o lá para poder iniciar o controle nesta tarefa.
                                                    </div>
                                                )
                                            ) : (
                                                <button
                                                    type="button"
                                                    disabled={isReadOnly}
                                                    onClick={() => selectedTask && startTimer(selectedTask)}
                                                    className="w-full py-2.5 bg-brand-primary text-white hover:bg-emerald-600 rounded-xl text-xs font-bold uppercase transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                                                >
                                                    <ClockIcon className="w-4 h-4" />
                                                    Iniciar Cronômetro
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Definições Rápidas */}
                                    <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border dark:border-slate-800 space-y-4 text-xs">
                                        <h4 className="text-xs font-black text-slate-850 dark:text-slate-200 uppercase tracking-widest border-b pb-2 mb-4">Informações Gerais</h4>
                                        
                                        <div>
                                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Atribuído a (Responsável)</label>
                                            <select
                                                disabled={isReadOnly}
                                                value={taskForm.assigned_to}
                                                onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value })}
                                                className={`w-full p-2.5 border rounded-xl outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white bg-white ${isReadOnly ? 'bg-slate-100 dark:bg-slate-850 cursor-not-allowed opacity-75' : ''}`}
                                            >
                                                <option value="">Sem responsável</option>
                                                {employees.map(e => (
                                                    <option key={e.id} value={e.id}>{e.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Data de Início (Start Date)</label>
                                            <input
                                                type="date"
                                                disabled={isReadOnly}
                                                value={taskForm.start_date}
                                                onChange={(e) => setTaskForm({ ...taskForm, start_date: e.target.value })}
                                                className={`w-full p-2.5 border rounded-xl outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white bg-white ${isReadOnly ? 'bg-slate-100 dark:bg-slate-850 cursor-not-allowed opacity-75' : ''}`}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Prazo Limite (Due Date)</label>
                                            <input
                                                type="date"
                                                disabled={isReadOnly}
                                                value={taskForm.due_date}
                                                onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                                                className={`w-full p-2.5 border rounded-xl outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white bg-white ${isReadOnly ? 'bg-slate-100 dark:bg-slate-850 cursor-not-allowed opacity-75' : ''}`}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">URL da Imagem de Capa</label>
                                            <input
                                                type="text"
                                                disabled={isReadOnly}
                                                value={taskForm.cover_url}
                                                onChange={(e) => setTaskForm({ ...taskForm, cover_url: e.target.value })}
                                                placeholder="https://exemplo.com/imagem.png"
                                                className={`w-full p-2.5 border rounded-xl outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white bg-white ${isReadOnly ? 'bg-slate-100 dark:bg-slate-850 cursor-not-allowed opacity-75' : ''}`}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Prioridade da Tarefa</label>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    disabled={isReadOnly}
                                                    onClick={() => setTaskForm({ ...taskForm, priority: 0 })}
                                                    className={`flex-1 py-2 rounded-xl border text-center transition-all ${isReadOnly ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''} ${taskForm.priority === 0 ? 'bg-slate-200 dark:bg-slate-700 border-slate-350 dark:border-slate-500 font-bold' : 'border-slate-200 dark:border-slate-800'}`}
                                                >
                                                    ⭐ Normal
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={isReadOnly}
                                                    onClick={() => setTaskForm({ ...taskForm, priority: 1 })}
                                                    className={`flex-1 py-2 rounded-xl border text-center transition-all ${isReadOnly ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''} ${taskForm.priority === 1 ? 'bg-amber-500/10 text-amber-500 border-amber-500/40 font-bold' : 'border-slate-200 dark:border-slate-800'}`}
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

                                            {/* Lista de Comentários e Histórico Combinado */}
                                            <div className="flex-grow overflow-y-auto space-y-3 pr-1 text-xs">
                                                {(() => {
                                                    const feed: any[] = [];
                                                    taskComments.forEach(c => {
                                                        feed.push({
                                                            id: `comment-${c.id}`,
                                                            type: 'comment',
                                                            date: new Date(c.created_at),
                                                            user: c.user,
                                                            content: c.comment
                                                        });
                                                    });
                                                    taskHistory.forEach(h => {
                                                        feed.push({
                                                            id: `history-${h.id}`,
                                                            type: 'history',
                                                            date: new Date(h.moved_at),
                                                            user: h.moved_by_user,
                                                            fromStage: h.from_stage?.name || 'Sem setor',
                                                            toStage: h.to_stage?.name || 'Sem setor'
                                                        });
                                                    });
                                                    feed.sort((a, b) => a.date.getTime() - b.date.getTime());

                                                    if (feed.length === 0) {
                                                        return <p className="text-slate-450 italic text-center py-6">Sem atividades registradas.</p>;
                                                    }

                                                    return feed.map(item => {
                                                        if (item.type === 'comment') {
                                                            return (
                                                                <div key={item.id} className="flex gap-2.5 items-start">
                                                                    {item.user?.avatar_url ? (
                                                                        <img src={item.user.avatar_url} className="w-6 h-6 rounded-full object-cover mt-0.5 animate-fade-in"  alt="Imagem relacionada ao projeto" />
                                                                    ) : (
                                                                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[7px] font-bold text-slate-400 dark:text-slate-300 uppercase mt-0.5">
                                                                            {item.user?.full_name?.substring(0,2) || 'US'}
                                                                        </div>
                                                                    )}
                                                                    <div className="flex-grow bg-white dark:bg-slate-900 border dark:border-slate-800 p-2.5 rounded-2xl relative shadow-sm">
                                                                        <p className="font-bold text-[10px] text-slate-500">{item.user?.full_name || 'Usuário'}</p>
                                                                        {(() => {
                                                                            if (item.content.startsWith('[ARQUIVO]')) {
                                                                                const filePart = item.content.replace('[ARQUIVO]', '').trim();
                                                                                const parts = filePart.split('|');
                                                                                const fileName = parts[0];
                                                                                const fileUrl = parts[1] || fileName;
                                                                                
                                                                                let downloadUrl = fileUrl;
                                                                                if (downloadUrl && !downloadUrl.startsWith('http')) {
                                                                                    downloadUrl = supabase.storage.from('feed-media').getPublicUrl(downloadUrl).data.publicUrl;
                                                                                }

                                                                                return (
                                                                                    <div className="flex flex-col gap-1.5 p-2 bg-emerald-500/5 border border-emerald-500/10 rounded-xl mt-1 text-[11px]">
                                                                                        <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                                                                                            <PaperClipIcon className="w-3.5 h-3.5" />
                                                                                            <span>Arquivo de Transição Anexado</span>
                                                                                        </div>
                                                                                        <a 
                                                                                            href={downloadUrl} 
                                                                                            download={fileName || 'arquivo'}
                                                                                            onClick={(e) => e.stopPropagation()}
                                                                                            target="_blank" 
                                                                                            rel="noopener noreferrer" 
                                                                                            className="text-slate-800 dark:text-slate-200 underline font-medium break-all hover:text-brand-primary"
                                                                                        >
                                                                                            {fileName || 'Download do arquivo'}
                                                                                        </a>
                                                                                    </div>
                                                                                );
                                                                            } else if (item.content.startsWith('[HISTÓRICO]')) {
                                                                                const historyText = item.content.replace('[HISTÓRICO]', '').trim();
                                                                                return (
                                                                                    <div className="flex flex-col gap-1 p-2 bg-amber-500/5 border border-amber-500/10 rounded-xl mt-1 text-[11px]">
                                                                                        <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                                                                                            <ClockIcon className="w-3.5 h-3.5" />
                                                                                            <span>Histórico de Checklist</span>
                                                                                        </div>
                                                                                        <p className="text-slate-650 dark:text-slate-350">{historyText}</p>
                                                                                    </div>
                                                                                );
                                                                            } else if (item.content.startsWith('[CRONÔMETRO]')) {
                                                                                const timerText = item.content.replace('[CRONÔMETRO]', '').trim();
                                                                                return (
                                                                                    <div className="flex flex-col gap-1 p-2 bg-blue-500/5 border border-blue-500/10 rounded-xl mt-1 text-[11px]">
                                                                                        <div className="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400">
                                                                                            <ClockIcon className="w-3.5 h-3.5 animate-pulse" />
                                                                                            <span>Apontamento de Tempo</span>
                                                                                        </div>
                                                                                        <p className="text-slate-650 dark:text-slate-350">{timerText}</p>
                                                                                    </div>
                                                                                );
                                                                            }
                                                                            return <p className="text-slate-700 dark:text-slate-200 mt-1 leading-normal">{item.content}</p>;
                                                                        })()}
                                                                        <span className="text-[8px] text-slate-400 absolute bottom-1 right-2">
                                                                            {item.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        } else {
                                                            return (
                                                                <div key={item.id} className="flex items-center gap-2 pl-2 border-l-2 border-slate-200 dark:border-slate-750 text-[10px] text-slate-450 dark:text-slate-500 font-semibold italic py-1 bg-slate-100/30 dark:bg-slate-900/10 px-2 rounded-lg">
                                                                    <ClockIcon className="w-3.5 h-3.5 text-brand-primary animate-pulse" />
                                                                    <span>
                                                                        <strong>{item.user?.full_name || 'Alguém'}</strong> moveu de <em>{item.fromStage}</em> para <em>{item.toStage}</em>
                                                                    </span>
                                                                    <span className="text-[8px] text-slate-400 not-italic ml-auto">
                                                                        {item.date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                </div>
                                                            );
                                                        }
                                                    });
                                                })()}
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
                                {!isReadOnly && (
                                    <button type="button" onClick={() => handleSaveTask()} className="px-6 py-2.5 bg-brand-primary text-white hover:bg-emerald-600 rounded-xl text-xs font-bold uppercase shadow-lg shadow-emerald-100">Salvar Alterações</button>
                                )}
                            </div>
                        </div>
                    </ModalPortal>
                );
            })()}

            {/* --- MODAL 4: TRANSIÇÃO SETOR / PRÓXIMO CHECKLIST --- */}
            {transitionData && (
                <ModalPortal className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in pandanet-modal-viewport">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-scale-in flex flex-col max-h-[85vh]">
                        <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                            <div>
                                <h3 className="text-lg font-black text-slate-850 dark:text-slate-100">
                                    Avançar para: {transitionData.nextStageName}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Configure o checklist do próximo setor e anexe arquivos importantes.
                                </p>
                            </div>
                            <button onClick={() => setTransitionData(null)} className="text-slate-450 hover:text-slate-600 font-bold">✕</button>
                        </div>

                        <div className="p-6 space-y-6 overflow-y-auto flex-1">
                            {/* Checklist Section */}
                            <div className="space-y-3">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">
                                    Checklist do Próximo Setor
                                </label>
                                
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Adicionar novo item de checklist..."
                                        value={newTransitionItem}
                                        onChange={(e) => setNewTransitionItem(e.target.value)}
                                        className="flex-grow p-2.5 border rounded-xl text-xs outline-none dark:bg-slate-850 dark:border-slate-750 dark:text-white"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!newTransitionItem.trim()) return;
                                            setTransitionData(prev => prev ? {
                                                ...prev,
                                                checklist: [...prev.checklist, newTransitionItem.trim()]
                                            } : null);
                                            setNewTransitionItem('');
                                        }}
                                        className="px-4 py-2.5 bg-brand-primary hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                                    >
                                        Adicionar
                                    </button>
                                </div>

                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                    {transitionData.checklist.length === 0 ? (
                                        <p className="text-xs text-slate-450 italic text-center py-4 bg-slate-50 dark:bg-slate-850/50 rounded-xl">
                                            Nenhum item definido. O setor começará sem checklist ou você pode adicionar acima.
                                        </p>
                                    ) : (
                                        transitionData.checklist.map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-100 dark:border-slate-800">
                                                <span className="text-xs font-medium text-slate-750 dark:text-slate-300">{item}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setTransitionData(prev => prev ? {
                                                            ...prev,
                                                            checklist: prev.checklist.filter((_, i) => i !== idx)
                                                        } : null);
                                                    }}
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 p-1.5 rounded-lg transition-all"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Files Section */}
                            <div className="space-y-3 pt-4 border-t dark:border-slate-800">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">
                                    Anexar Arquivos para o Próximo Setor (Máx. 5)
                                </label>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                    Formatos aceitos: PDF, DOC, Planilhas, PNG, JPEG.
                                </p>

                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-150 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-750 dark:text-slate-200 rounded-xl cursor-pointer text-xs font-bold transition-all border dark:border-slate-700">
                                        <PaperClipIcon className="w-4 h-4" />
                                        <span>{uploadingFile ? 'Enviando...' : 'Selecionar Arquivos'}</span>
                                        <input
                                            type="file"
                                            multiple
                                            className="hidden"
                                            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                                            onChange={handleTransitionFileUpload}
                                            disabled={uploadingFile}
                                        />
                                    </label>
                                </div>

                                {transitionData.uploadedFiles.length > 0 && (
                                    <div className="space-y-2 mt-2">
                                        {transitionData.uploadedFiles.map((file, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2.5 bg-brand-primary/5 border border-brand-primary/10 rounded-xl">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <DocumentTextIcon className="w-4 h-4 text-brand-primary flex-shrink-0" />
                                                    <span className="text-xs font-semibold text-brand-primary truncate">{file.name}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setTransitionData(prev => prev ? {
                                                            ...prev,
                                                            uploadedFiles: prev.uploadedFiles.filter((_, i) => i !== idx)
                                                        } : null);
                                                    }}
                                                    className="text-red-500 hover:text-red-700 p-1 rounded-lg"
                                                >
                                                    <XMarkIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 border-t dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-900/50">
                            <button
                                type="button"
                                onClick={() => setTransitionData(null)}
                                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-xl text-xs font-bold uppercase"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmTransition}
                                disabled={uploadingFile}
                                className="px-6 py-2.5 bg-brand-primary text-white hover:bg-emerald-600 rounded-xl text-xs font-bold uppercase shadow-lg shadow-emerald-100 disabled:opacity-50"
                            >
                                Avançar Setor
                            </button>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* --- MODAL 3: GERENCIAR ESTÁGIO (COLUNAS) --- */}
            {isStageModalOpen && (
                <ModalPortal className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 pandanet-modal-viewport">
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
                </ModalPortal>
            )}
        </div>
    );
};

export default ProjectsPage;
