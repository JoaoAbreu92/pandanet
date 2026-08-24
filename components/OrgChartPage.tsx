import React, { useState, useEffect } from 'react';
import { Employee } from '../types';
import { useAuth } from './AuthContext';
import { supabase } from '../supabaseClient';

interface OrgChartPageProps {
  employees: Employee[];
}

const OrgChartPage: React.FC<OrgChartPageProps> = ({ employees }) => {
    const { profile } = useAuth();
    const [localEmployees, setLocalEmployees] = useState<Employee[]>(employees);
    const [draggedOverNodeId, setDraggedOverNodeId] = useState<string | null>(null);
    const [isDraggingRoot, setIsDraggingRoot] = useState(false);

    useEffect(() => {
        setLocalEmployees(employees);
    }, [employees]);

    const isAdmin = profile?.isAdmin || profile?.role === 'Super Admin';

    // build tree structure from local state with recursion protection and orphaned node recovery
    const buildOrgTree = (managerId: string | null = null, visited = new Set<string>()): any[] => {
        return localEmployees
            .filter(e => {
                if (visited.has(e.id)) return false;
                
                if (managerId === null) {
                    // É um nó raiz se não tem gestor definido (null/undefined)
                    // OU se o gestor definido não existe na lista de colaboradores da empresa (nó órfão)
                    return !e.reports_to || !localEmployees.some(emp => emp.id === e.reports_to);
                } else {
                    return e.reports_to === managerId;
                }
            })
            .map(e => {
                const newVisited = new Set(visited);
                newVisited.add(e.id);
                return {
                    ...e,
                    subordinates: buildOrgTree(e.id, newVisited)
                };
            });
    };

    const treeData = buildOrgTree();

    const handleDragStart = (e: React.DragEvent, employeeId: string) => {
        e.dataTransfer.setData('text/plain', employeeId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDragEnter = (e: React.DragEvent, nodeId: string | null) => {
        e.preventDefault();
        setDraggedOverNodeId(nodeId);
    };

    const handleDragLeave = () => {
        setDraggedOverNodeId(null);
    };

    const handleDrop = async (e: React.DragEvent, targetManagerId: string | null) => {
        e.preventDefault();
        setDraggedOverNodeId(null);
        setIsDraggingRoot(false);
        const employeeId = e.dataTransfer.getData('text/plain');
        if (!employeeId) return;

        // Prevent setting themselves as their own manager
        if (employeeId === targetManagerId) {
            alert('Um colaborador não pode responder a si mesmo.');
            return;
        }

        // Circular reference check
        const isSubordinate = (parent: string, child: string): boolean => {
            const childEmp = localEmployees.find(emp => emp.id === child);
            if (!childEmp || !childEmp.reports_to) return false;
            if (childEmp.reports_to === parent) return true;
            return isSubordinate(parent, childEmp.reports_to);
        };

        if (targetManagerId && isSubordinate(employeeId, targetManagerId)) {
            alert('Referência circular detectada! Você não pode definir um subordinado como gestor de seu próprio gestor.');
            return;
        }

        const employeeObj = localEmployees.find(emp => emp.id === employeeId);
        const targetManagerObj = targetManagerId ? localEmployees.find(emp => emp.id === targetManagerId) : null;

        const confirmMsg = targetManagerId
            ? `Deseja definir "${targetManagerObj?.name}" como gestor de "${employeeObj?.name}"?`
            : `Deseja remover o gestor de "${employeeObj?.name}" e torná-lo um colaborador sem gestor direto (nó raiz)?`;

        if (!window.confirm(confirmMsg)) return;

        // Optimistically update UI
        const updated = localEmployees.map(emp => {
            if (emp.id === employeeId) {
                return { ...emp, reports_to: targetManagerId };
            }
            return emp;
        });
        setLocalEmployees(updated);

        // Update database
        try {
            const { error } = await supabase.rpc('update_user_profile', {
                p_user_id: employeeId,
                p_reports_to: targetManagerId,
                p_clear_reports_to: targetManagerId === null
            });
            if (error) throw error;
        } catch (err: any) {
            console.error('Error saving hierarchy via drag-and-drop:', err);
            alert('Erro ao salvar alteração de hierarquia: ' + err.message);
            // Revert state
            setLocalEmployees(localEmployees);
        }
    };

    const renderNode = (node: any) => (
        <div key={node.id} className="flex flex-col items-center">
            <div 
                draggable={isAdmin}
                onDragStart={(e) => handleDragStart(e, node.id)}
                onDragOver={handleDragOver}
                onDragEnter={(e) => handleDragEnter(e, node.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, node.id)}
                className={`border-2 rounded-2xl p-4 shadow-sm transition-all duration-300 min-w-[180px] text-center z-10 relative select-none ${
                    isAdmin ? 'cursor-grab active:cursor-grabbing hover:scale-105 duration-200' : ''
                } ${
                    draggedOverNodeId === node.id 
                    ? 'border-emerald-500 bg-emerald-50 ring-4 ring-emerald-500/20 scale-105' 
                    : 'border-emerald-100 bg-white hover:border-emerald-500'
                }`}
            >
                {node.is_manager && (
                    <span className="absolute -top-2.5 -right-2 bg-amber-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm border border-white">
                        Gestor
                    </span>
                )}
                <img src={node.avatarUrl} className="w-12 h-12 rounded-full mx-auto mb-2 border-2 border-emerald-50 shadow-sm object-cover" alt="" />
                <p className="font-bold text-gray-900 text-sm">{node.name}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">{node.role}</p>
                <div className="mt-1">
                    <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{node.team}</span>
                </div>
            </div>

            {node.subordinates.length > 0 && (
                <>
                    <div className="w-px h-8 bg-emerald-200"></div>
                    <div className="relative pt-8 flex gap-8">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[calc(100%-4rem)] h-px bg-emerald-200"></div>
                        {node.subordinates.map((sub: any) => (
                            <div key={sub.id} className="relative">
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-px h-8 bg-emerald-200"></div>
                                {renderNode(sub)}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );

    return (
        <div className="max-w-full mx-auto space-y-8 p-4 bg-gray-50/30 min-h-screen">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Organograma Corporativo</h1>
                    <p className="text-gray-500 mt-1 font-medium italic">Estrutura oficial de hierarquia e gestão.</p>
                    {isAdmin && (
                        <p className="text-xs text-brand-primary mt-1.5 font-bold flex items-center gap-1">
                            <span>💡</span> Dica de Admin: Arraste e solte os cartões de colaboradores para organizar a hierarquia de forma interativa.
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2 text-xs bg-white border border-gray-100 px-4 py-2 rounded-2xl shadow-sm">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-gray-600 font-bold">Atualizado em Tempo Real</span>
                </div>
            </header>

            {isAdmin && (
                <div 
                    onDragOver={handleDragOver}
                    onDragEnter={(e) => { e.preventDefault(); setIsDraggingRoot(true); }}
                    onDragLeave={() => setIsDraggingRoot(false)}
                    onDrop={(e) => handleDrop(e, null)}
                    className={`w-full py-4 border-2 border-dashed rounded-2xl text-center text-xs transition-all duration-300 ${
                        isDraggingRoot 
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold scale-[1.01]' 
                        : 'border-gray-200 bg-white text-gray-400 hover:border-emerald-300'
                    }`}
                >
                    Solte aqui para remover o gestor do colaborador e torná-lo um membro de nível superior (raiz)
                </div>
            )}

            <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl p-12 overflow-auto min-h-[700px] flex justify-center custom-scrollbar">
                <div className="inline-block pt-8">
                    {treeData.length > 0 ? (
                        <div className="flex gap-16">
                            {treeData.map(rootNode => renderNode(rootNode))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <p className="text-lg font-bold">Nenhum dado de hierarquia encontrado.</p>
                            <p className="text-sm">Defina as relações de gestor no painel Admin.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OrgChartPage;
