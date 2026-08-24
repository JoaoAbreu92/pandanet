import React, { useState } from 'react';
import Card from './Card';
// FIX: Correcting the import path for types.
import type { Task } from '../types';
import { PlusIcon, TrashIcon } from './icons';

const initialTasks: Task[] = [
    { id: '1', text: 'Finalizar apresentação do roadmap Q3', completed: false },
    { id: '2', text: 'Revisar pull request do João', completed: true },
    { id: '3', text: 'Agendar 1-on-1 com a Jane', completed: false },
];

const MyTasks: React.FC = () => {
    const [tasks, setTasks] = useState<Task[]>(initialTasks);
    const [newTask, setNewTask] = useState('');

    const toggleTask = (id: string) => {
        setTasks(tasks.map(task => 
            task.id === id ? { ...task, completed: !task.completed } : task
        ));
    };
    
    const deleteTask = (id: string) => {
        setTasks(tasks.filter(task => task.id !== id));
    };

    const addTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTask.trim() === '') return;
        const newTaskObject: Task = {
            id: Date.now().toString(),
            text: newTask.trim(),
            completed: false,
        };
        setTasks([newTaskObject, ...tasks]);
        setNewTask('');
    };

    return (
        <Card title="Minhas Tarefas">
            <form onSubmit={addTask} className="mb-4 flex items-center space-x-2">
                <input
                    type="text"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    placeholder="Adicionar uma nova tarefa..."
                    className="flex-grow border-gray-300 rounded-md shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm"
                />
                <button type="submit" className="p-2 bg-brand-primary text-white rounded-md hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary">
                    <PlusIcon className="w-5 h-5" />
                </button>
            </form>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {tasks.map(task => (
                    <div key={task.id} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 group">
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                checked={task.completed}
                                onChange={() => toggleTask(task.id)}
                                className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                            />
                            <label className={`ml-3 text-sm ${task.completed ? 'text-gray-400 line-through' : 'text-brand-text'}`}>
                                {task.text}
                            </label>
                        </div>
                        <button onClick={() => deleteTask(task.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </Card>
    );
};

export default MyTasks;