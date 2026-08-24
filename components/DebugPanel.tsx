import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BugAntIcon, XCircleIcon, CheckCircleIcon, ExclamationTriangleIcon, TrashIcon } from './icons';
import type { Employee, Company } from '../types';

interface DebugPanelProps {
    currentUser: Employee;
    currentCompany: Company;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ currentUser, currentCompany }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dbStatus, setDbStatus] = useState<'checking' | 'ok' | 'error'>('checking');
    const [tables, setTables] = useState<{ name: string; count: number | null; error: boolean }[]>([]);
    const [logs, setLogs] = useState<{ type: 'info' | 'error'; msg: string; time: string }[]>([]);

    const isMasterAdmin = currentUser.email === 'ti@grupopixel.com.br';

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

    if (!isMasterAdmin) return null;

    const clearStorage = () => {
        localStorage.clear();
        addLog('info', 'Local Storage limpo. Recarregue a página.');
        if (confirm('Local Storage limpo. Deseja recarregar agora?')) {
            window.location.reload();
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-[9999]">
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-center w-12 h-12 rounded-full shadow-2xl transition-all duration-300 ${isOpen ? 'bg-red-500 rotate-90' : 'bg-brand-primary hover:scale-110 active:scale-95'}`}
            >
                {isOpen ? <XCircleIcon className="w-7 h-7 text-white" /> : <BugAntIcon className="w-7 h-7 text-white" />}
            </button>

            {/* Panel */}
            {isOpen && (
                <div className="absolute bottom-16 right-0 w-[450px] max-h-[600px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden animate-fade-in-up">
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <BugAntIcon className="w-5 h-5 text-brand-primary" />
                                Painel de Diagnóstico (Master Admin)
                            </h3>
                            <p className="text-[10px] text-gray-500">ID Empresa: {currentCompany.id} | Plan: {currentCompany.plan?.name || 'N/A'}</p>
                        </div>
                        <button onClick={checkDatabase} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-brand-primary transition-colors">
                            <svg className={`w-5 h-5 ${dbStatus === 'checking' ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {/* DB Health */}
                        <section className="space-y-2">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                Saúde do Banco (Supabase)
                                {dbStatus === 'ok' && <CheckCircleIcon className="w-4 h-4 text-emerald-500" />}
                                {dbStatus === 'error' && <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />}
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                                {tables.map(t => (
                                    <div key={t.name} className={`p-2 rounded-lg border text-xs flex justify-between items-center ${t.error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-100 text-gray-700'}`}>
                                        <span className="font-mono">{t.name}</span>
                                        <span className="font-bold">{t.error ? 'ERRO' : t.count}</span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* User State */}
                        <section className="space-y-2">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Estado do Usuário</h4>
                            <div className="p-3 bg-gray-50 rounded-lg font-mono text-[11px] text-gray-600 whitespace-pre overflow-x-auto">
                                {JSON.stringify({
                                    id: currentUser.id,
                                    name: currentUser.name,
                                    role: currentUser.role,
                                    company: currentUser.company_id,
                                    dept: currentUser.team
                                }, null, 2)}
                            </div>
                        </section>

                        {/* Permissions */}
                        <section className="space-y-2">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Permissões (Flags)</h4>
                            <div className="grid grid-cols-2 gap-1 text-[10px]">
                                {Object.entries(currentUser.permissions || {}).map(([key, val]) => (
                                    <div key={key} className={`flex justify-between p-1 rounded ${val ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-400'}`}>
                                        <span>{key}</span>
                                        <span>{val ? 'TRUE' : 'FALSE'}</span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Actions */}
                        <section className="space-y-2">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ações de Emergência</h4>
                            <div className="flex gap-2">
                                <button onClick={clearStorage} className="flex-1 flex items-center justify-center gap-2 p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors text-xs font-semibold">
                                    <TrashIcon className="w-4 h-4" />
                                    Limpar Cache/Storage
                                </button>
                            </div>
                        </section>

                        {/* Recent logs */}
                        <section className="space-y-2">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Console Interno</h4>
                            <div className="bg-black text-emerald-400 p-3 rounded-lg font-mono text-[10px] h-32 overflow-y-auto space-y-1">
                                {logs.length === 0 && <p className="text-gray-600 italic">Sem logs recentes...</p>}
                                {logs.map((log, i) => (
                                    <div key={i} className={log.type === 'error' ? 'text-red-400' : ''}>
                                        <span className="text-gray-500">[{log.time}]</span> {log.msg}
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    <div className="p-3 bg-gray-100 dark:bg-gray-900 text-center text-[10px] text-gray-400">
                        PandaNet Debugger v1.0 • Apenas para usuários master.
                    </div>
                </div>
            )}
        </div>
    );
};

export default DebugPanel;
