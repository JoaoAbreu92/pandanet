import ModalPortal from './ui/ModalPortal';
import React, { useState, useEffect } from 'react';
import Card from './Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import ConfirmModal from './ui/ConfirmModal';
import { useToast } from './ToastContext';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon } from './icons';
import { supabase } from '../supabaseClient';
import type { Department } from '../types';

interface DepartmentManagerProps {
    companyId: string;
}

export const DepartmentManager: React.FC<DepartmentManagerProps> = ({ companyId }) => {
    const { showToast } = useToast();
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDept, setEditingDept] = useState<Department | null>(null);
    const [name, setName] = useState('');
    const [departmentToDelete, setDepartmentToDelete] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

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
        if (isSaving) return;
        setIsSaving(true);

        try {
            if (!companyId) throw new Error('Company ID is required to save department');
            if (editingDept) {
                const { error } = await supabase
                    .from('departments')
                    .update({ name })
                    .eq('id', editingDept.id);
                if (error) throw error;
            } else {
                const { error, data } = await supabase
                    .from('departments')
                    .insert({ name, company_id: companyId })
                    .select();
                if (error) throw error;
                console.log('Department created:', data);
            }
            setName('');
            setEditingDept(null);
            setIsModalOpen(false);
            await fetchDepartments();
            showToast(
                editingDept
                    ? 'Departamento atualizado com sucesso.'
                    : 'Departamento criado com sucesso.',
                'success'
            );
        } catch (err: any) {
            console.error('Error saving department:', err);
            showToast(
                `Erro ao salvar departamento: ${err?.message || 'Erro desconhecido'}`,
                'error'
            );
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (isDeleting) return;
        setIsDeleting(true);

        try {
            const { error } = await supabase
                .from('departments')
                .delete()
                .eq('id', id);

            if (error) throw error;

            await fetchDepartments();
            showToast('Departamento excluído com sucesso.', 'success');
        } catch (err: any) {
            console.error(err);
            showToast(
                `Erro ao excluir departamento: ${err?.message || 'Erro desconhecido'}`,
                'error'
            );
        } finally {
            setIsDeleting(false);
            setDepartmentToDelete(null);
        }
    };

    return (
        <Card title="Gerenciar Departamentos">
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-500">Crie e gerencie os departamentos da sua empresa para organizar chamados e eventos.</p>
                    <Button
                        type="button"
                        size="sm"
                        leftIcon={<PlusIcon className="h-4 w-4" />}
                        onClick={() => {
                            setName('');
                            setEditingDept(null);
                            setIsModalOpen(true);
                        }}
                    >
                        Novo departamento
                    </Button>
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
                                        onClick={() => setDepartmentToDelete(dept.id)}
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
                <ModalPortal
                    className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[3px] pandanet-modal-viewport"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setIsModalOpen(false);
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="department-modal-title"
                        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_30px_80px_-24px_rgba(2,6,23,0.55)] dark:border-white/10 dark:bg-[#101d2e]"
                    >
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Fechar"
                            onClick={() => setIsModalOpen(false)}
                            className="absolute right-3 top-3"
                        >
                            <XMarkIcon className="h-5 w-5" />
                        </Button>
                        <h3
                            id="department-modal-title"
                            className="mb-5 pr-12 text-xl font-bold text-slate-950 dark:text-white"
                        >
                            {editingDept ? 'Editar Departamento' : 'Novo Departamento'}
                        </h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <Input
                                label="Nome do departamento"
                                type="text"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                required
                                autoFocus
                                placeholder="Ex.: TI, RH ou Financeiro"
                            />
                            <div className="flex justify-end gap-3 mt-6">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    isLoading={isSaving}
                                    loadingText="Salvando..."
                                >
                                    Salvar
                                </Button>
                            </div>
                        </form>
                    </div>
                </ModalPortal>
            )}

            <ConfirmModal
                isOpen={departmentToDelete !== null}
                type="danger"
                title="Excluir departamento?"
                message="Os funcionários vinculados ficarão sem departamento. Esta ação não pode ser desfeita."
                confirmText={isDeleting ? 'Excluindo...' : 'Excluir departamento'}
                cancelText="Cancelar"
                onCancel={() => {
                    if (!isDeleting) setDepartmentToDelete(null);
                }}
                onConfirm={() => {
                    if (departmentToDelete) {
                        void handleDelete(departmentToDelete);
                    }
                }}
            />
        </Card>
    );
};
