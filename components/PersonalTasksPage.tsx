import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import type { Employee } from '../types';

interface PersonalTasksPageProps {
    currentUser: Employee;
    isGhostMode: boolean;
    pageContext?: any;
}

interface SubTask {
    id: string;
    text: string;
    completed: boolean;
}

interface Task {
    id: string;
    user_id: string;
    title: string;
    date: string | null; // Data no formato YYYY-MM-DD para o calendário (Data de Início)
    limit_date: string | null; // Data limite / prazo final
    items: SubTask[];
    completed: boolean;
    completed_at: string | null; // Data de conclusão
    notify_daily: boolean; // Enviar lembrete diário por notificação
    created_at: string;
    updated_at: string;
}

const PersonalTasksPage: React.FC<PersonalTasksPageProps> = ({ currentUser, isGhostMode, pageContext }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'Todas' | 'Pendentes' | 'Concluídas'>('Todas');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [dbError, setDbError] = useState<string | null>(null);

    // Estados do formulário do painel lateral de edição
    const [editTitle, setEditTitle] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editLimitDate, setEditLimitDate] = useState('');
    const [editCompletedDate, setEditCompletedDate] = useState('');
    const [editNotifyDaily, setEditNotifyDaily] = useState(false);
    const [newSubTaskText, setNewSubTaskText] = useState('');

    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const latestTaskRef = useRef<Task | null>(null);

    // Sincronizar a ref com a tarefa selecionada mais recente
    useEffect(() => {
        latestTaskRef.current = selectedTask;
    }, [selectedTask]);

    // Script SQL para exibição em caso de tabela inexistente
    const sqlInstruction = `-- CRIE A TABELA DE TAREFAS PESSOAIS NO SEU BANCO DE DADOS
CREATE TABLE IF NOT EXISTS personal_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'Nova Tarefa',
    date DATE,
    limit_date DATE,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    completed BOOLEAN NOT NULL DEFAULT false,
    completed_at DATE,
    notify_daily BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE personal_tasks ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can manage their own personal tasks" 
ON personal_tasks 
FOR ALL 
USING (
    auth.uid() = user_id 
    OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'Super Admin' OR profiles.email = 'ti@grupopixel.com.br')
    )
)
WITH CHECK (
    auth.uid() = user_id 
    OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'Super Admin' OR profiles.email = 'ti@grupopixel.com.br')
    )
);`;

    // Função para tocar um som triunfante (arpejo maior C4 -> E4 -> G4 -> C5)
    const playVictorySound = () => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;

            const ctx = new AudioContext();
            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const now = ctx.currentTime;
            const notes = [261.63, 329.63, 392.00, 523.25]; // Frequências C4, E4, G4, C5
            const noteLength = 0.12; // Duração de cada nota do arpejo

            notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.frequency.setValueAtTime(freq, now + idx * noteLength);

                if (idx === notes.length - 1) {
                    osc.type = 'triangle'; // Timbre mais quente na última nota
                    gain.gain.setValueAtTime(0.25, now + idx * noteLength);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * noteLength + 0.85); // Toca por 0.85s
                    osc.start(now + idx * noteLength);
                    osc.stop(now + idx * noteLength + 0.85);
                } else {
                    osc.type = 'sine';
                    gain.gain.setValueAtTime(0.18, now + idx * noteLength);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * noteLength + 0.25); // Toca por 0.25s
                    osc.start(now + idx * noteLength);
                    osc.stop(now + idx * noteLength + 0.25);
                }
            });
            console.log('[PandaNet] Som de vitória executado com sucesso.');
        } catch (err) {
            console.error('Falha ao tocar som de vitória:', err);
        }
    };

    // 1. Carregar tarefas do Supabase
    const fetchTasks = async () => {
        setIsLoading(true);
        setDbError(null);
        try {
            const { data, error } = await supabase
                .from('personal_tasks')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('updated_at', { ascending: false });

            if (error) {
                if (error.code === '42P01') {
                    setDbError('Tabela de tarefas pessoais não encontrada no banco de dados.');
                } else {
                    throw error;
                }
            } else if (data) {
                setTasks(data);
            }
        } catch (err: any) {
            console.error('Error fetching tasks:', err);
            setDbError(err.message || 'Erro ao carregar as tarefas pessoais.');
        } finally {
            setIsLoading(false);
        }
    };

    // Efeito de carregamento e salvamento forçado no desmonte (flush)
    useEffect(() => {
        fetchTasks();
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                // Salvar imediatamente no desmonte do componente se houver alteração pendente
                if (latestTaskRef.current) {
                    saveTaskToDb(latestTaskRef.current);
                }
            }
        };
    }, [currentUser.id]);

    // Selecionar tarefa baseado no pageContext
    useEffect(() => {
        if (tasks.length > 0) {
            const targetTaskId = pageContext?.taskId;
            if (targetTaskId) {
                const foundTask = tasks.find(t => t.id === targetTaskId);
                if (foundTask) {
                    setSelectedTask(foundTask);
                    setEditTitle(foundTask.title);
                    setEditDate(foundTask.date || '');
                    setEditLimitDate(foundTask.limit_date || '');
                    setEditCompletedDate(foundTask.completed_at || '');
                    setEditNotifyDaily(foundTask.notify_daily || false);
                    return;
                }
            }
            if (!latestTaskRef.current) {
                const initialTask = tasks[0];
                setSelectedTask(initialTask);
                setEditTitle(initialTask.title);
                setEditDate(initialTask.date || '');
                setEditLimitDate(initialTask.limit_date || '');
                setEditCompletedDate(initialTask.completed_at || '');
                setEditNotifyDaily(initialTask.notify_daily || false);
            }
        }
    }, [tasks, pageContext?.taskId]);

    const selectTask = (task: Task) => {
        setSelectedTask(task);
        setEditTitle(task.title);
        setEditDate(task.date || '');
        setEditLimitDate(task.limit_date || '');
        setEditCompletedDate(task.completed_at || '');
        setEditNotifyDaily(task.notify_daily || false);
        setNewSubTaskText('');
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };

    // Função síncrona que grava no Supabase
    const saveTaskToDb = async (taskToSave: Task) => {
        if (isGhostMode) return;
        try {
            const { error } = await supabase
                .from('personal_tasks')
                .update({
                    title: taskToSave.title,
                    date: taskToSave.date ? taskToSave.date : null,
                    limit_date: taskToSave.limit_date ? taskToSave.limit_date : null,
                    items: taskToSave.items,
                    completed: taskToSave.completed,
                    completed_at: taskToSave.completed_at ? taskToSave.completed_at : null,
                    notify_daily: taskToSave.notify_daily,
                    updated_at: new Date().toISOString()
                })
                .eq('id', taskToSave.id);

            if (error) throw error;
        } catch (err) {
            console.error('Error saving task to Supabase:', err);
        }
    };

    // 2. Criar nova tarefa
    const handleCreateTask = async () => {
        setDbError(null);
        try {
            const newTask = {
                user_id: currentUser.id,
                title: 'Nova Tarefa',
                date: null,
                limit_date: null,
                items: [],
                completed: false,
                completed_at: null,
                notify_daily: false
            };

            const { data, error } = await supabase
                .from('personal_tasks')
                .insert(newTask)
                .select()
                .single();

            if (error) throw error;

            if (data) {
                setTasks([data, ...tasks]);
                selectTask(data);
            }
        } catch (err: any) {
            console.error('Error creating task:', err);
            alert('Não foi possível criar a tarefa.');
        }
    };

    // 3. Gerenciador de Atualizações com controle de Debounce
    const triggerAutoSave = (updatedFields: Partial<Task>, debounce = false) => {
        if (!selectedTask) return;

        // Lógica de cálculo de checklist automático
        let itemsToCheck = updatedFields.items ?? selectedTask.items;
        let finalCompleted = selectedTask.completed;
        let finalCompletedAt = selectedTask.completed_at;

        if (updatedFields.items !== undefined) {
            const allChecked = itemsToCheck.length > 0 && itemsToCheck.every(item => item.completed);
            
            if (allChecked && !selectedTask.completed) {
                finalCompleted = true;
                finalCompletedAt = new Date().toISOString().split('T')[0];
                setEditCompletedDate(finalCompletedAt);
                // Executar som triunfante
                playVictorySound();
            } else if (!allChecked && selectedTask.completed) {
                finalCompleted = false;
                finalCompletedAt = null;
                setEditCompletedDate('');
            }
        }

        const updatedTask = { 
            ...selectedTask, 
            ...updatedFields,
            completed: updatedFields.completed ?? finalCompleted,
            completed_at: updatedFields.completed_at !== undefined ? updatedFields.completed_at : finalCompletedAt
        } as Task;

        // Atualizar estado de forma instantânea na UI
        setSelectedTask(updatedTask);
        setTasks(prevTasks => prevTasks.map(t => t.id === selectedTask.id ? updatedTask : t));

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        setIsSaving(true);

        if (debounce) {
            // Salvar com debounce (para digitação rápida no teclado)
            saveTimeoutRef.current = setTimeout(async () => {
                await saveTaskToDb(updatedTask);
                setIsSaving(false);
            }, 1000);
        } else {
            // Salvar imediatamente no banco (para cliques em checkbox e seletores de data)
            saveTaskToDb(updatedTask).then(() => {
                setIsSaving(false);
            });
        }
    };

    // 4. Excluir tarefa
    const handleDeleteTask = async (taskId: string) => {
        if (!window.confirm('Tem certeza de que deseja excluir esta tarefa pessoal permanentemente?')) return;

        setDbError(null);
        try {
            const { error } = await supabase
                .from('personal_tasks')
                .delete()
                .eq('id', taskId);

            if (error) throw error;

            const remainingTasks = tasks.filter(t => t.id !== taskId);
            setTasks(remainingTasks);
            
            if (selectedTask?.id === taskId) {
                if (remainingTasks.length > 0) {
                    selectTask(remainingTasks[0]);
                } else {
                    setSelectedTask(null);
                    setEditTitle('');
                    setEditDate('');
                    setEditCompletedDate('');
                }
            }
        } catch (err: any) {
            console.error('Error deleting task:', err);
            alert('Erro ao excluir a tarefa.');
        }
    };

    // 5. Adicionar nova subtarefa (Salva imediatamente)
    const handleAddSubTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTask || !newSubTaskText.trim()) return;

        const newItem: SubTask = {
            id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
            text: newSubTaskText.trim(),
            completed: false
        };

        const updatedItems = [...selectedTask.items, newItem];
        triggerAutoSave({ items: updatedItems }, false); // Salva imediatamente ao adicionar
        setNewSubTaskText('');
    };

    // 6. Atualizar estado de uma subtarefa individual (Salva imediatamente)
    const handleToggleSubTask = (itemId: string, completed: boolean) => {
        if (!selectedTask) return;

        const updatedItems = selectedTask.items.map(item => 
            item.id === itemId ? { ...item, completed } : item
        );

        triggerAutoSave({ items: updatedItems }, false); // Salva imediatamente
    };

    // 7. Excluir uma subtarefa individual (Salva imediatamente)
    const handleDeleteSubTask = (itemId: string) => {
        if (!selectedTask) return;

        const updatedItems = selectedTask.items.filter(item => item.id !== itemId);
        triggerAutoSave({ items: updatedItems }, false); // Salva imediatamente
    };

    // 8. Editar o texto de uma subtarefa individual (Usa Debounce para digitação)
    const handleEditSubTaskText = (itemId: string, text: string) => {
        if (!selectedTask) return;

        const updatedItems = selectedTask.items.map(item => 
            item.id === itemId ? { ...item, text } : item
        );

        triggerAutoSave({ items: updatedItems }, true); // Debounce ativado para digitação
    };

    // 9. Concluir/Desmarcar tarefa principal manualmente (Salva imediatamente)
    const handleToggleTaskCompleted = (completed: boolean) => {
        if (!selectedTask) return;

        const completedAt = completed ? (editCompletedDate || new Date().toISOString().split('T')[0]) : null;
        setEditCompletedDate(completedAt || '');

        if (completed) {
            playVictorySound();
        }

        // Marcar todas as subtarefas como concluídas se fechar manualmente
        let updatedItems = [...selectedTask.items];
        if (completed) {
            updatedItems = updatedItems.map(item => ({ ...item, completed: true }));
        } else {
            // Se reabrir, desmarca a primeira subtarefa para manter a pendência consistente
            const allChecked = updatedItems.length > 0 && updatedItems.every(item => item.completed);
            if (allChecked && updatedItems.length > 0) {
                updatedItems[0] = { ...updatedItems[0], completed: false };
            }
        }

        triggerAutoSave({ 
            completed, 
            completed_at: completedAt,
            items: updatedItems
        }, false); // Salva imediatamente
    };

    // Filtrar tarefas baseado na busca e filtros rápidos
    const filteredTasks = tasks.filter(task => {
        const matchesSearch = 
            task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            task.items.some(item => item.text.toLowerCase().includes(searchQuery.toLowerCase()));

        if (!matchesSearch) return false;

        if (statusFilter === 'Pendentes') return !task.completed;
        if (statusFilter === 'Concluídas') return task.completed;
        return true;
    });

    const formatShortDate = (dateString: string | null) => {
        if (!dateString) return '';
        try {
            const [year, month, day] = dateString.split('-');
            return `${day}/${month}/${year}`;
        } catch (e) {
            return '';
        }
    };

    const handleCopySQL = () => {
        navigator.clipboard.writeText(sqlInstruction);
        alert('Script SQL copiado com sucesso! Execute-o no console SQL do seu Supabase.');
    };

    // Se houver erro de tabela inexistente
    if (dbError && dbError.includes('não encontrada')) {
        return (
            <div className="max-w-4xl mx-auto p-6 animate-fade-in">
                <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">
                    <div className="flex items-center gap-4 text-red-500 mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-10 h-10">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
                        </svg>
                        <div>
                            <h2 className="text-xl font-bold dark:text-white">Instalação Necessária - Minhas Tarefas</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Como você utiliza um banco de dados hospedado por conta própria (self-hosted), é necessário criar a tabela de Tarefas Pessoais.</p>
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-[#1e293b] rounded-xl p-4 border border-slate-100 dark:border-slate-700/50 mb-6">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Script SQL de Criação</span>
                            <button
                                onClick={handleCopySQL}
                                className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-all flex items-center gap-1.5"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25D" />
                                </svg>
                                Copiar SQL
                            </button>
                        </div>
                        <pre className="text-xs text-slate-600 dark:text-slate-300 font-mono overflow-x-auto max-h-[300px] leading-relaxed custom-scrollbar">
                            {sqlInstruction}
                        </pre>
                    </div>

                    <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-400">Após rodar o script SQL no editor do Supabase, você pode recarregar a página.</p>
                        <button
                            onClick={fetchTasks}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold transition-all"
                        >
                            Tentar Novamente
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-7xl mx-auto h-[calc(100vh-10rem)] min-h-[500px] flex flex-col md:flex-row gap-6 animate-fade-in font-brand">
            
            {/* Barra Lateral Esquerda: Filtros e Lista de Tarefas */}
            <div className="w-full md:w-80 flex flex-col bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex-shrink-0 shadow-sm">
                
                {/* Cabeçalho da Barra Lateral */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <span>📋</span> Minhas Tarefas
                        </h2>
                        <button
                            onClick={handleCreateTask}
                            className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shadow-md shadow-emerald-500/20 active:scale-95 transition-all text-xs font-bold flex items-center gap-1"
                            title="Nova Tarefa"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            Nova
                        </button>
                    </div>

                    {/* Campo de Busca */}
                    <div className="relative">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
                        </svg>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar tarefas..."
                            className="w-full pl-9 pr-4 py-1.5 border-0 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                    </div>
                </div>

                {/* Filtro de Status */}
                <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex gap-1.5 overflow-x-auto custom-scrollbar flex-shrink-0">
                    {(['Todas', 'Pendentes', 'Concluídas'] as const).map((filter) => {
                        const count = 
                            filter === 'Todas' ? tasks.length : 
                            filter === 'Pendentes' ? tasks.filter(t => !t.completed).length : 
                            tasks.filter(t => t.completed).length;

                        return (
                            <button
                                key={filter}
                                onClick={() => setStatusFilter(filter)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-colors ${statusFilter === filter ? 'bg-emerald-500 text-white' : 'bg-slate-50 hover:bg-slate-100 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700/80 dark:text-slate-300'}`}
                            >
                                {filter} ({count})
                            </button>
                        );
                    })}
                </div>

                {/* Lista de Tarefas */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
                            <div className="w-5 h-5 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div>
                            <span className="text-[10px] font-semibold tracking-wider uppercase">Carregando tarefas...</span>
                        </div>
                    ) : filteredTasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-center p-4">
                            <span className="text-2xl mb-1.5">📋</span>
                            <p className="text-xs font-bold">Nenhuma tarefa encontrada</p>
                            <p className="text-[10px] opacity-75 mt-0.5">Crie uma nova tarefa para começar.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1.5">
                            {filteredTasks.map((task) => {
                                const completedCount = task.items.filter(i => i.completed).length;
                                const totalCount = task.items.length;

                                return (
                                    <button
                                        key={task.id}
                                        onClick={() => selectTask(task)}
                                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                                            selectedTask?.id === task.id 
                                                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 shadow-sm' 
                                                : 'bg-white hover:bg-slate-50 dark:bg-transparent dark:hover:bg-slate-800/40 border-transparent'
                                        } ${task.completed ? 'opacity-60' : ''}`}
                                    >
                                        <div className="flex justify-between items-start gap-1">
                                            <h3 className={`text-xs font-bold text-slate-800 dark:text-slate-100 truncate flex-1 ${task.completed ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>
                                                {task.title || 'Sem Título'}
                                            </h3>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${
                                                task.completed 
                                                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' 
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                            }`}>
                                                {task.completed ? 'Concluída' : 'Pendente'}
                                            </span>
                                        </div>
                                        
                                        <div className="flex justify-between items-center mt-3 text-[10px] text-slate-400 dark:text-slate-500">
                                            {task.date ? (
                                                <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                                                    📅 {formatShortDate(task.date)}
                                                    {task.limit_date && ` até ${formatShortDate(task.limit_date)}`}
                                                </span>
                                            ) : task.limit_date ? (
                                                <span className="flex items-center gap-1 font-semibold text-red-500 dark:text-red-400">
                                                    📅 Limite: {formatShortDate(task.limit_date)}
                                                </span>
                                            ) : (
                                                <span className="italic">Sem prazo/data final</span>
                                            )}
                                            
                                            <div className="flex items-center gap-1.5">
                                                {task.notify_daily && (
                                                    <span className="text-emerald-500 font-bold" title="Lembrete diário ativo">🔔</span>
                                                )}
                                                {totalCount > 0 ? (
                                                    <span>{completedCount}/{totalCount} itens</span>
                                                ) : (
                                                    <span className="italic text-[9px]">Checklist vazio</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center mt-2.5 pt-1.5 border-t border-slate-100/50 dark:border-slate-800/40 text-[9px] text-slate-400">
                                            <span>Modificada em {new Date(task.updated_at).toLocaleDateString('pt-BR')}</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteTask(task.id);
                                                }}
                                                className="text-red-400 hover:text-red-600 transition-colors p-1"
                                                title="Excluir Tarefa"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                </svg>
                                            </button>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Painel da Direita: Edição e Detalhes da Tarefa */}
            <div className="flex-1 bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden relative">
                {selectedTask ? (
                    <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar">
                        
                        {/* Seção 1: Cabeçalho com Checkbox Mestre e Título */}
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/20 dark:bg-slate-900/10">
                            <div className="flex items-center gap-3.5 flex-1">
                                <input
                                    type="checkbox"
                                    checked={selectedTask.completed}
                                    onChange={(e) => handleToggleTaskCompleted(e.target.checked)}
                                    className="w-5 h-5 rounded-lg border-2 border-slate-300 dark:border-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 transition-colors cursor-pointer"
                                    title="Marcar tarefa inteira como concluída"
                                />
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => {
                                        setEditTitle(e.target.value);
                                        triggerAutoSave({ title: e.target.value }, true);
                                    }}
                                    placeholder="Nome da tarefa..."
                                    className={`w-full text-base sm:text-lg font-bold border-0 bg-transparent text-slate-800 dark:text-white focus:outline-none focus:ring-0 p-0 ${
                                        selectedTask.completed ? 'line-through text-slate-400 dark:text-slate-500' : ''
                                    }`}
                                />
                            </div>
                        </div>

                        {/* Seção 2: Metadados (Data de Início, Prazo Limite, Data de Conclusão e Lembrete Diário) */}
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/10 dark:bg-slate-900/5">
                            {/* Data de Início */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                    📅 Data de Início / Calendário
                                </label>
                                <input
                                    type="date"
                                    value={editDate}
                                    onChange={(e) => {
                                        setEditDate(e.target.value);
                                        triggerAutoSave({ date: e.target.value || null }, false); // Salva imediatamente
                                    }}
                                    className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 w-full"
                                />
                            </div>

                            {/* Data Limite / Prazo */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                    🏁 Data Limite / Prazo Final
                                </label>
                                <input
                                    type="date"
                                    value={editLimitDate}
                                    onChange={(e) => {
                                        setEditLimitDate(e.target.value);
                                        triggerAutoSave({ limit_date: e.target.value || null }, false); // Salva imediatamente
                                    }}
                                    className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 w-full"
                                />
                            </div>

                            {/* Data de Conclusão */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                    ✅ Data de Conclusão
                                </label>
                                <input
                                    type="date"
                                    value={editCompletedDate}
                                    disabled={!selectedTask.completed}
                                    onChange={(e) => {
                                        setEditCompletedDate(e.target.value);
                                        triggerAutoSave({ completed_at: e.target.value || null }, false); // Salva imediatamente
                                    }}
                                    className="px-3 py-2 bg-slate-50 disabled:bg-slate-100/50 dark:bg-slate-800 dark:disabled:bg-slate-900/50 text-slate-700 dark:text-slate-200 disabled:text-slate-400 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 w-full"
                                />
                            </div>

                            {/* Notificação Diária */}
                            <div className="sm:col-span-3 flex items-center space-x-3 p-3 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-xl border border-emerald-100/50 dark:border-emerald-900/20">
                                <input
                                    type="checkbox"
                                    id="notifyDaily"
                                    checked={editNotifyDaily}
                                    onChange={(e) => {
                                        setEditNotifyDaily(e.target.checked);
                                        triggerAutoSave({ notify_daily: e.target.checked }, false); // Salva imediatamente
                                    }}
                                    className="w-4 h-4 rounded text-emerald-500 border-slate-300 dark:border-slate-700 focus:ring-emerald-500 cursor-pointer"
                                />
                                <label htmlFor="notifyDaily" className="flex-1 cursor-pointer">
                                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">🔔 Lembrar diariamente por Notificação</div>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Você receberá uma notificação de alerta todos os dias até concluir a tarefa.</p>
                                </label>
                            </div>
                        </div>

                        {/* Seção 3: Checklist (Subtarefas) */}
                        <div className="p-5 flex-1 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black text-slate-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                    📋 Checklist de Subtarefas (Edite os textos diretamente clicando neles)
                                </h3>
                            </div>

                            {/* Formulário para adicionar nova subtarefa */}
                            <form onSubmit={handleAddSubTask} className="flex gap-2">
                                <input
                                    type="text"
                                    value={newSubTaskText}
                                    onChange={(e) => setNewSubTaskText(e.target.value)}
                                    placeholder="Adicionar um item a fazer..."
                                    className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                />
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center transition-all"
                                >
                                    Adicionar
                                </button>
                            </form>

                            {/* Lista de subtarefas */}
                            <div className="flex flex-col gap-2.5 mt-2">
                                {selectedTask.items.length === 0 ? (
                                    <div className="text-center py-8 text-slate-400 dark:text-slate-500 italic text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                        Nenhuma subtarefa adicionada. Digite acima para criar checklist!
                                    </div>
                                ) : (
                                    selectedTask.items.map((item, idx) => (
                                        <div 
                                            key={item.id} 
                                            className={`flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/10 hover:border-slate-200 dark:hover:border-slate-700/60 transition-colors group`}
                                        >
                                            <div className="flex items-center gap-3 flex-1">
                                                <input
                                                    type="checkbox"
                                                    checked={item.completed}
                                                    onChange={(e) => handleToggleSubTask(item.id, e.target.checked)}
                                                    className="w-4 h-4 rounded text-emerald-500 border-slate-300 dark:border-slate-700 focus:ring-emerald-500 cursor-pointer"
                                                />
                                                <input
                                                    type="text"
                                                    value={item.text}
                                                    onChange={(e) => handleEditSubTaskText(item.id, e.target.value)}
                                                    className={`w-full text-xs border-0 bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-0 p-0 font-medium ${
                                                        item.completed ? 'line-through text-slate-400 dark:text-slate-500' : ''
                                                    }`}
                                                    title="Clique para editar o texto deste item"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteSubTask(item.id)}
                                                className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1 ml-2"
                                                title="Excluir item"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Indicador de Salvamento Automático */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                            <div className="bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50 flex items-center gap-1.5">
                                {isSaving ? (
                                    <>
                                        <div className="w-2 h-2 border border-slate-300 border-t-emerald-500 rounded-full animate-spin"></div>
                                        <span>Salvando...</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-emerald-500 font-bold">✓</span>
                                        <span>Salvo automaticamente</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-slate-50/20 dark:bg-slate-900/10">
                        <span className="text-5xl animate-bounce-slow mb-3">📋</span>
                        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Nenhuma Tarefa Selecionada</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mt-1">Selecione uma tarefa na barra lateral ou crie uma nova para acompanhar seu checklist diário e organizar suas atividades no calendário.</p>
                        <button
                            onClick={handleCreateTask}
                            className="mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-emerald-500/20 active:scale-95 flex items-center gap-1.5"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            Criar Minha Primeira Tarefa
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PersonalTasksPage;
