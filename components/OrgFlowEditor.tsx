import React, { useState, useMemo } from 'react';
import { Employee } from '../types';
import { supabase } from '../supabaseClient';
import { 
    UsersIcon, 
    CheckCircleIcon,
    ChevronDownIcon,
    MagnifyingGlassIcon,
    UserPlusIcon,
    PhoneIcon,
    UserGroupIcon,
    UserCircleIcon,
    ArrowPathIcon
} from './icons';

interface OrgFlowEditorProps {
    employees: Employee[];
    onUpdateEmployees: (employees: Employee[]) => void;
}

export const OrgFlowEditor: React.FC<OrgFlowEditorProps> = ({ employees, onUpdateEmployees }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [saving, setSaving] = useState(false);
    const [localAssignments, setLocalAssignments] = useState<Record<string, { reports_to: string | null, sector_manager_id: string | null, is_manager: boolean }>>({});

    // Filter employees based on search
    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => 
            emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.team?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [employees, searchTerm]);

    const handleAssignManager = (employeeId: string, managerId: string | null) => {
        setLocalAssignments(prev => {
            const current = prev[employeeId] || {
                reports_to: employees.find(e => e.id === employeeId)?.reports_to || null,
                sector_manager_id: employees.find(e => e.id === employeeId)?.sector_manager_id || null,
                is_manager: employees.find(e => e.id === employeeId)?.is_manager || false
            };
            return {
                ...prev,
                [employeeId]: {
                    ...current,
                    reports_to: managerId === 'none' ? null : managerId,
                    sector_manager_id: current.sector_manager_id || (managerId === 'none' ? null : managerId)
                }
            };
        });
    };

    const handleAssignSectorManager = (employeeId: string, sectorManagerId: string | null) => {
        setLocalAssignments(prev => {
            const current = prev[employeeId] || {
                reports_to: employees.find(e => e.id === employeeId)?.reports_to || null,
                sector_manager_id: employees.find(e => e.id === employeeId)?.sector_manager_id || null,
                is_manager: employees.find(e => e.id === employeeId)?.is_manager || false
            };
            return {
                ...prev,
                [employeeId]: {
                    ...current,
                    sector_manager_id: sectorManagerId === 'none' ? null : sectorManagerId
                }
            };
        });
    };

    const handleToggleManager = (employeeId: string, isManager: boolean) => {
        setLocalAssignments(prev => {
            const current = prev[employeeId] || {
                reports_to: employees.find(e => e.id === employeeId)?.reports_to || null,
                sector_manager_id: employees.find(e => e.id === employeeId)?.sector_manager_id || null,
                is_manager: employees.find(e => e.id === employeeId)?.is_manager || false
            };
            return {
                ...prev,
                [employeeId]: {
                    ...current,
                    is_manager: isManager,
                    // Ao se tornar gestor, removemos a hierarquia de reporte e setor
                    reports_to: isManager ? null : current.reports_to,
                    sector_manager_id: isManager ? null : current.sector_manager_id
                }
            };
        });
    };

    const handleBulkSave = async () => {
        setSaving(true);
        try {
            const updates = Object.entries(localAssignments).map(([empId, data]) => ({
                id: empId,
                reports_to: data.reports_to,
                sector_manager_id: data.sector_manager_id,
                is_manager: data.is_manager
            }));

            for (const update of updates) {
                const { error } = await supabase.rpc('update_user_hierarchy', {
                    p_user_id: update.id,
                    p_reports_to: update.reports_to,
                    p_sector_manager_id: update.sector_manager_id,
                    p_is_manager: update.is_manager
                });

                if (error) throw error;
            }

            // Update local state in parent
            const newEmployees = employees.map(emp => {
                const assignment = localAssignments[emp.id];
                if (assignment) {
                    return { 
                        ...emp, 
                        reports_to: assignment.reports_to,
                        sector_manager_id: assignment.sector_manager_id,
                        is_manager: assignment.is_manager
                    };
                }
                return emp;
            });

            onUpdateEmployees(newEmployees);
            setLocalAssignments({});
            alert('Hierarquia atualizada com sucesso!');
        } catch (error) {
            console.error('Error saving hierarchy:', error);
            alert('Erro ao salvar hierarquia. Verifique o console.');
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = Object.keys(localAssignments).length > 0;

    return (
        <div className="flex flex-col h-[calc(100vh-250px)] bg-gray-50/50 rounded-2xl overflow-hidden border border-gray-200">
            {/* Header Control Panel */}
            <div className="p-4 bg-white border-b border-gray-200 flex flex-wrap items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                        <UsersIcon className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Gestor de Hierarquia</h2>
                        <p className="text-xs text-gray-500">Defina quem responde a quem no organograma</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-1 max-w-md">
                    <div className="relative flex-1">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Buscar colaborador..."
                            className="w-full pl-9 pr-4 py-2 bg-gray-100 border-transparent focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 rounded-xl text-sm transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <button
                        onClick={handleBulkSave}
                        disabled={!hasChanges || saving}
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold shadow-lg transition-all ${
                            hasChanges && !saving
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-105 active:scale-95'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                        }`}
                    >
                        {saving ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <CheckCircleIcon className="w-4 h-4" />
                        )}
                        Salvar Alterações
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Assignment List */}
                <div className="w-full overflow-y-auto p-4 space-y-3">
                    {filteredEmployees.map(emp => {
                        const currentAssignment = localAssignments[emp.id] || { 
                            reports_to: emp.reports_to, 
                            sector_manager_id: emp.sector_manager_id,
                            is_manager: emp.is_manager 
                        };
                        
                        return (
                            <div 
                                key={emp.id} 
                                className={`group flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
                                    localAssignments[emp.id] 
                                    ? 'bg-emerald-50 border-emerald-200 shadow-md ring-1 ring-emerald-200' 
                                    : 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-lg'
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <img 
                                            src={emp.avatarUrl} 
                                            alt={emp.name} 
                                            className="w-12 h-12 rounded-2xl object-cover shadow-sm group-hover:scale-110 transition-transform duration-300" 
                                        />
                                        {localAssignments[emp.id] && (
                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full animate-pulse" />
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">{emp.name}</h3>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium">{emp.role}</span>
                                            <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-400 rounded-full">{emp.team}</span>
                                            {currentAssignment.is_manager && (
                                                <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold">Gestor</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <input
                                                type="checkbox"
                                                id={`is-manager-${emp.id}`}
                                                className="rounded text-brand-primary focus:ring-brand-primary h-3.5 w-3.5 cursor-pointer"
                                                checked={currentAssignment.is_manager}
                                                onChange={(e) => handleToggleManager(emp.id, e.target.checked)}
                                            />
                                            <label htmlFor={`is-manager-${emp.id}`} className="text-[11px] text-gray-500 font-semibold cursor-pointer select-none">
                                                {emp.name.split(' ')[0]} é gestor(a)
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    {currentAssignment.is_manager ? (
                                        <div className="flex items-center min-w-[380px] h-10 justify-center px-4 bg-emerald-50/50 border border-emerald-100 rounded-xl text-xs text-emerald-800 font-bold">
                                            Líder/Gestor(a) - Sem necessidade de atribuição direta
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-6">
                                            <div className="flex flex-col min-w-[180px]">
                                                <label className="text-[9px] font-black text-gray-400 uppercase mb-1 px-1 flex items-center gap-1">
                                                    <ArrowPathIcon className="w-2 h-2" /> Responde a:
                                                </label>
                                                <select
                                                    value={currentAssignment.reports_to || 'none'}
                                                    onChange={(e) => handleAssignManager(emp.id, e.target.value)}
                                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all cursor-pointer hover:bg-white"
                                                >
                                                    <option value="none">Sem Gestor Direto</option>
                                                    {employees
                                                        .filter(m => m.id !== emp.id)
                                                        .map(m => (
                                                            <option key={m.id} value={m.id}>{m.name}</option>
                                                        ))
                                                    }
                                                </select>
                                            </div>

                                            <div className="flex flex-col min-w-[180px]">
                                                <label className="text-[9px] font-black text-gray-400 uppercase mb-1 px-1 flex items-center gap-1">
                                                    <UserGroupIcon className="w-2 h-2" /> Gestor do Setor:
                                                </label>
                                                <select
                                                    value={currentAssignment.sector_manager_id || 'none'}
                                                    onChange={(e) => handleAssignSectorManager(emp.id, e.target.value)}
                                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all cursor-pointer hover:bg-white"
                                                >
                                                    <option value="none">Sem Gestor de Setor</option>
                                                    {employees
                                                        .filter(m => m.id !== emp.id)
                                                        .map(m => (
                                                            <option key={m.id} value={m.id}>{m.name}</option>
                                                        ))
                                                    }
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Live Preview Sidebar */}
                <div className="w-80 border-l border-gray-200 bg-white p-6 hidden lg:block overflow-y-auto">
                    <div className="sticky top-0">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                            <h3 className="font-bold text-gray-800">Visualização Rápida</h3>
                        </div>

                        <div className="space-y-4">
                            {hasChanges ? (
                                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 animate-in fade-in slide-in-from-right-4">
                                    <p className="text-[10px] font-black text-emerald-600 uppercase mb-3">Alterações Pendentes</p>
                                    <div className="space-y-3">
                                        {Object.entries(localAssignments).map(([id, data]) => {
                                            const emp = employees.find(e => e.id === id);
                                            const manager = employees.find(e => e.id === data.reports_to);
                                            return (
                                                <div key={id} className="flex items-center gap-3">
                                                    <img src={emp?.avatarUrl} className="w-6 h-6 rounded-lg object-cover" alt="" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[10px] font-bold text-gray-700 truncate">{emp?.name}</p>
                                                        {data.is_manager !== emp?.is_manager ? (
                                                            <p className="text-[9px] text-emerald-600 font-bold">{data.is_manager ? 'Promovido a Gestor' : 'Removido como Gestor'}</p>
                                                        ) : (
                                                            <p className="text-[9px] text-gray-400">→ {manager?.name || 'Sem Gestor'}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <UserPlusIcon className="w-8 h-8 text-gray-200" />
                                    </div>
                                    <p className="text-sm text-gray-400 font-medium px-4">Nenhuma alteração feita ainda. Selecione os gestores na lista ao lado.</p>
                                </div>
                            )}

                            <div className="pt-6 border-t border-gray-100">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-xs font-bold text-gray-700">Resumo Atual</p>
                                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{employees.length} Colaboradores</span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-xs">
                                        <span className="text-gray-500">Com Gestor</span>
                                        <span className="font-bold text-emerald-600">{employees.filter(e => e.reports_to).length}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-xs">
                                        <span className="text-gray-500">Sem Gestor</span>
                                        <span className="font-bold text-orange-500">{employees.filter(e => !e.reports_to).length}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
