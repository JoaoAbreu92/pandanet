import React, { useState, useEffect } from 'react';
import Card from './Card';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon } from './icons';
import { supabase } from '../supabaseClient';
import type { Department } from '../types';

interface DepartmentManagerProps {
    companyId: string;
}

export const DepartmentManager: React.FC<DepartmentManagerProps> = ({ companyId }) => {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDept, setEditingDept] = useState<Department | null>(null);
    const [name, setName] = useState('');

    const fetchDepartments = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('departments')
            .select('*')
            .eq('company_id', companyId)
            .order('name');

        if (data) setDepartments(data);
        setLoading(false);
    };

    useEffect(() => {
        if (companyId) fetchDepartments();
    }, [companyId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingDept) {
                const { error } = await supabase
                    .from('departments')
                    .update({ name })
                    .eq('id', editingDept.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('departments')
                    .insert({ name, company_id: companyId });
                if (error) throw error;
            }
            setName('');
            setEditingDept(null);
            setIsModalOpen(false);
            fetchDepartments();
        } catch (err) {
            console.error(err);
            alert('Erro ao salvar departamento');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este departamento? Funcionários vinculados ficarão sem departamento.')) return;
        try {
            const { error } = await supabase.from('departments').delete().eq('id', id);
            if (error) throw error;
            fetchDepartments();
        } catch (err) {
            console.error(err);
            alert('Erro ao excluir departamento');
        }
    };

    return (
        <Card title="Gerenciar Departamentos">
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-500">Crie e gerencie os departamentos da sua empresa para organizar chamados e eventos.</p>
                    <button
                        onClick={() => { setName(''); setEditingDept(null); setIsModalOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-emerald-600 transition-colors"
                    >
                        <PlusIcon className="w-5 h-5" />
                        <span>Novo Departamento</span>
                    </button>
                </div>

                {loading ? (
                    <div className="py-8 text-center text-gray-400 font-medium">Carregando departamentos...</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {departments.map(dept => (
                            <div key={dept.id} className="p-4 border rounded-xl flex justify-between items-center hover:bg-gray-50 transition-colors group">
                                <span className="font-semibold text-brand-text">{dept.name}</span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setEditingDept(dept); setName(dept.name); setIsModalOpen(true); }}
                                        className="p-1.5 text-gray-400 hover:text-brand-primary hover:bg-emerald-50 rounded-lg transition-all"
                                    >
                                        <PencilIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(dept.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
                        <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                        <h3 className="text-xl font-bold text-brand-text mb-4">
                            {editingDept ? 'Editar Departamento' : 'Novo Departamento'}
                        </h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Departamento</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    placeholder="Ex: TI, RH, Financeiro"
                                    className="w-full border-gray-300 rounded-lg focus:ring-brand-primary focus:border-brand-primary"
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium">Cancelar</button>
                                <button type="submit" className="px-6 py-2 bg-brand-primary text-white font-semibold rounded-lg hover:bg-emerald-600 transition-all shadow-md">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Card>
    );
};
