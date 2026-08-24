import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BugAntIcon, XCircleIcon, CheckCircleIcon, ExclamationTriangleIcon, TrashIcon } from './icons';
import type { Employee, Company } from '../types';
import { useAuth } from './AuthContext';

interface DebugPanelProps {
    currentUser: Employee;
    currentCompany: Company;
    isOpen: boolean;
    onClose: () => void;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ currentUser, currentCompany, isOpen, onClose }) => {
    const { realProfile } = useAuth();
    const [dbStatus, setDbStatus] = useState<'checking' | 'ok' | 'error'>('checking');
    const [tables, setTables] = useState<{ name: string; count: number | null; error: boolean }[]>([]);
    const [logs, setLogs] = useState<{ type: 'info' | 'error'; msg: string; time: string }[]>([]);

    const isMasterAdmin = realProfile?.email === 'ti@grupopixel.com.br';

    const addLog = (type: 'info' | 'error', msg: string) => {
        setLogs(prev => [{ type, msg, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 50));
    };

    const checkDatabase = async () => {
        setDbStatus('checking');
        const requiredTables = [
            'profiles', 'companies', 'events', 'training_modules',
            'kb_articles', 'form_submissions', 'ti_requests', 'departments'
        ];

        const results = [];
        let allOk = true;

        for (const table of requiredTables) {
            try {
                const { count, error } = await supabase
                    .from(table)
                    .select('*', { count: 'exact', head: true });

                if (error) {
                    results.push({ name: table, count: null, error: true });
                    addLog('error', `Erro na tabela ${table}: ${error.message}`);
                    allOk = false;
                } else {
                    results.push({ name: table, count: count || 0, error: false });
                }
            } catch (err: any) {
                results.push({ name: table, count: null, error: true });
                allOk = false;
            }
        }

        setTables(results);
        setDbStatus(allOk ? 'ok' : 'error');
        if (allOk) addLog('info', 'Banco de dados verificado com sucesso.');
    };

    useEffect(() => {
        if (isOpen) {
            checkDatabase();
        }
    }, [isOpen]);

    if (!isMasterAdmin || !isOpen) return null;

    const clearStorage = () => {
        localStorage.clear();
        addLog('info', 'Local Storage limpo. Recarregue a página.');
        if (confirm('Local Storage limpo. Deseja recarregar agora?')) {
            window.location.reload();
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            {/* Panel */}
            <div className="relative w-full max-w-2xl max-h-[85dvh] bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 bg-gray-50 dark:bg-gray-900 border-b flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-primary/10 rounded-xl">
                            <BugAntIcon className="w-6 h-6 text-brand-primary" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white">
                                Painel de Diagnóstico
                            </h3>
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Acesso Restrito: Master Admin</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={checkDatabase}
                            className="p-2.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl text-brand-primary transition-all active:scale-95"
                            title="Recarregar Dados"
                        >
                            <svg className={`w-5 h-5 ${dbStatus === 'checking' ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-xl transition-all active:scale-95"
                        >
                            <XCircleIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                    {/* System Meta */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">ID Empresa</p>
                            <p className="text-sm font-mono font-bold text-gray-700 dark:text-slate-300">{currentCompany.id}</p>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Plano Atual</p>
                            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{currentCompany.plan?.name || 'Standard'}</p>
                        </div>
                    </div>

                    {/* DB Health */}
                    <section className="space-y-3">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                            Saúde do Banco (Supabase)
                            {dbStatus === 'ok' && <CheckCircleIcon className="w-4 h-4 text-emerald-500" />}
                            {dbStatus === 'error' && <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />}
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {tables.map(t => (
                                <div key={t.name} className={`p-3 rounded-2xl border transition-all ${t.error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50/50 border-gray-100 dark:border-slate-800 text-gray-700 dark:text-slate-300'}`}>
                                    <p className="text-[9px] font-mono opacity-60 truncate">{t.name}</p>
                                    <p className="text-sm font-black">{t.error ? 'ERRO' : t.count}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* User State */}
                    <section className="space-y-3">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Estado Sensível do Usuário</h4>
                        <div className="p-4 bg-slate-900 text-emerald-400 rounded-2xl font-mono text-[11px] whitespace-pre overflow-x-auto shadow-inner border border-slate-800">
                            {JSON.stringify({
                                db_id: currentUser.id,
                                display_name: currentUser.name,
                                system_role: currentUser.role,
                                context_company: currentUser.company_id,
                                context_dept: currentUser.team,
                                auth_email: currentUser.email
                            }, null, 2)}
                        </div>
                    </section>

                    {/* Actions */}
                    <section className="space-y-3">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Ações Críticas</h4>
                        <div className="flex gap-4">
                            <button onClick={clearStorage} className="flex-1 flex items-center justify-center gap-3 p-4 bg-orange-50 text-orange-700 border border-orange-200 rounded-2xl hover:bg-orange-100 transition-all font-bold text-xs shadow-sm active:scale-95">
                                <TrashIcon className="w-5 h-5" />
                                Limpar Cache & Local Storage
                            </button>
                        </div>
                    </section>

                    {/* Console */}
                    <section className="space-y-3">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Console de Eventos</h4>
                        <div className="bg-black text-emerald-500 p-4 rounded-2xl font-mono text-[10px] h-40 overflow-y-auto space-y-1.5 shadow-2xl border border-white/5 no-scrollbar">
                            {logs.length === 0 && <p className="text-gray-700 italic">Aguardando telemetria...</p>}
                            {logs.map((log, i) => (
                                <div key={i} className={`flex gap-3 ${log.type === 'error' ? 'text-red-400' : ''}`}>
                                    <span className="text-gray-600 flex-shrink-0">[{log.time}]</span>
                                    <span className="flex-1 leading-relaxed">{log.msg}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-900/80 text-center text-[10px] text-gray-400 font-bold tracking-widest uppercase border-t border-gray-100 dark:border-slate-800">
                    PandaNet Diagnostic Engine &bull; Kernel v1.2.4-GP
                </div>
            </div>
        </div>
    );
};

export default DebugPanel;
