import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { useAuth } from '../../../components/AuthContext';
import { Save, Clock, MessageSquare, Sliders, VolumeX, UserCheck, Check, Loader2, RefreshCw, Key } from 'lucide-react';

interface WhatsAppSettingsData {
    id: string;
    connection_name: string;
    phone_number?: string;
    business_hours_start?: string;
    business_hours_end?: string;
    business_hours?: any;
    away_message?: string;
    reject_calls?: boolean;
    rejection_message?: string;
    auto_assign?: boolean;
    transfer_message_client?: string;
    transfer_message_agent?: string;
    send_transfer_message_to_client?: boolean;
    keyword_transfers?: any[];
    close_message?: string;
    isolate_chat_history?: boolean;
}

const DAYS_OF_WEEK = [
    { value: '1', label: 'Segunda-feira' },
    { value: '2', label: 'Terça-feira' },
    { value: '3', label: 'Quarta-feira' },
    { value: '4', label: 'Quinta-feira' },
    { value: '5', label: 'Sexta-feira' },
    { value: '6', label: 'Sábado' },
    { value: '0', label: 'Domingo' }
];

const GeneralTab: React.FC = () => {
    const { profile, currentUser } = useAuth();
    const [connections, setConnections] = useState<WhatsAppSettingsData[]>([]);
    const [selectedConnId, setSelectedConnId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [businessHoursStart, setBusinessHoursStart] = useState('08:00');
    const [businessHoursEnd, setBusinessHoursEnd] = useState('18:00');
    const [awayMessage, setAwayMessage] = useState('');
    const [closeMessage, setCloseMessage] = useState('');
    const [rejectCalls, setRejectCalls] = useState(false);
    const [rejectionMessage, setRejectionMessage] = useState('');
    const [autoAssign, setAutoAssign] = useState(false);
    const [isolateChatHistory, setIsolateChatHistory] = useState(false);

    // Transfer Settings State
    const [transferMessageClient, setTransferMessageClient] = useState('Seu atendimento foi transferido para {target}. Por favor, aguarde.');
    const [transferMessageAgent, setTransferMessageAgent] = useState('Atendimento transferido para {target} por {sender}.');
    const [sendTransferMessageToClient, setSendTransferMessageToClient] = useState(true);

    // Advanced Business Hours State
    const [queues, setQueues] = useState<any[]>([]);
    const [businessHours, setBusinessHours] = useState<any>({ general: {}, queues: {} });
    const [activeTarget, setActiveTarget] = useState<string>('general');

    // Keyword Transfers State
    const [keywordTransfers, setKeywordTransfers] = useState<any[]>([]);
    const [agents, setAgents] = useState<any[]>([]);
    const [newKeyword, setNewKeyword] = useState('');
    const [newTargetType, setNewTargetType] = useState<'queue' | 'agent'>('queue');
    const [newTargetId, setNewTargetId] = useState('');

    useEffect(() => {
        fetchConnections();
    }, [currentUser?.company_id]);

    const fetchConnections = async () => {
        const companyId = currentUser?.company_id || profile?.company_id;
        if (!companyId) return;

        setLoading(true);
        try {
            // Fetch WhatsApp connection settings
            const { data: settingsData, error: settingsError } = await supabase
                .from('whatsapp_settings')
                .select('id, connection_name, phone_number, business_hours_start, business_hours_end, business_hours, away_message, reject_calls, rejection_message, auto_assign, transfer_message_client, transfer_message_agent, send_transfer_message_to_client, keyword_transfers, close_message, isolate_chat_history')
                .eq('company_id', companyId);

            if (settingsError) throw settingsError;

            // Fetch WhatsApp queues (sectors)
            const { data: queuesData } = await supabase
                .from('whatsapp_queues')
                .select('id, name')
                .eq('company_id', companyId);

            if (queuesData) setQueues(queuesData);

            // Fetch agents
            const { data: agentsData } = await supabase
                .from('profiles')
                .select('id, full_name')
                .eq('company_id', companyId)
                .order('full_name', { ascending: true });

            if (agentsData) setAgents(agentsData);

            if (settingsData && settingsData.length > 0) {
                setConnections(settingsData);
                const activeConn = settingsData[0];
                setSelectedConnId(activeConn.id);
                loadConnectionData(activeConn);
            }
        } catch (err) {
            console.error('Error fetching settings data:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadConnectionData = (conn: WhatsAppSettingsData) => {
        setBusinessHoursStart(conn.business_hours_start?.slice(0, 5) || '08:00');
        setBusinessHoursEnd(conn.business_hours_end?.slice(0, 5) || '18:00');
        setBusinessHours(conn.business_hours || { general: {}, queues: {} });
        setAwayMessage(conn.away_message || '');
        setCloseMessage(conn.close_message || '');
        setRejectCalls(!!conn.reject_calls);
        setRejectionMessage(conn.rejection_message || '');
        setAutoAssign(!!conn.auto_assign);
        setIsolateChatHistory(!!conn.isolate_chat_history);
        setTransferMessageClient(conn.transfer_message_client || 'Seu atendimento foi transferido para {target}. Por favor, aguarde.');
        setTransferMessageAgent(conn.transfer_message_agent || 'Atendimento transferido para {target} por {sender}.');
        setSendTransferMessageToClient(conn.send_transfer_message_to_client !== false);
        setKeywordTransfers(conn.keyword_transfers || []);
    };

    const getTargetHours = (target: string) => {
        if (target === 'general') {
            return businessHours.general || {};
        }
        return businessHours.queues?.[target] || {};
    };

    const updateTargetHours = (target: string, day: string, intervals: Array<{ start: string; end: string }> | null) => {
        const copy = JSON.parse(JSON.stringify(businessHours));
        if (!copy.general) copy.general = {};
        if (!copy.queues) copy.queues = {};

        if (target === 'general') {
            if (intervals === null || intervals.length === 0) {
                delete copy.general[day];
            } else {
                copy.general[day] = intervals;
            }
        } else {
            if (!copy.queues[target]) copy.queues[target] = {};
            if (intervals === null || intervals.length === 0) {
                delete copy.queues[target][day];
            } else {
                copy.queues[target][day] = intervals;
            }
        }
        setBusinessHours(copy);
    };

    const handleConnectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const connId = e.target.value;
        setSelectedConnId(connId);
        const conn = connections.find(c => c.id === connId);
        if (conn) {
            loadConnectionData(conn);
        }
    };

    const handleAddKeywordRule = () => {
        if (!newKeyword.trim()) {
            alert('Por favor, digite uma palavra-chave.');
            return;
        }
        if (!newTargetId) {
            alert('Por favor, selecione um destino.');
            return;
        }

        const newRule = {
            id: Math.random().toString(36).substring(2, 9),
            keyword: newKeyword.trim().toLowerCase(),
            target_type: newTargetType,
            target_id: newTargetId
        };

        setKeywordTransfers(prev => [...prev, newRule]);
        setNewKeyword('');
        setNewTargetId('');
    };

    const handleRemoveKeywordRule = (id: string) => {
        setKeywordTransfers(prev => prev.filter(r => r.id !== id));
    };

    const handleSave = async () => {
        if (!selectedConnId) return;

        setSaving(true);
        const updates = {
            business_hours_start: businessHoursStart ? `${businessHoursStart}:00` : null,
            business_hours_end: businessHoursEnd ? `${businessHoursEnd}:00` : null,
            business_hours: businessHours,
            away_message: awayMessage,
            close_message: closeMessage,
            reject_calls: rejectCalls,
            rejection_message: rejectionMessage,
            auto_assign: autoAssign,
            isolate_chat_history: isolateChatHistory,
            transfer_message_client: transferMessageClient,
            transfer_message_agent: transferMessageAgent,
            send_transfer_message_to_client: sendTransferMessageToClient,
            keyword_transfers: keywordTransfers,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('whatsapp_settings')
            .update(updates)
            .eq('id', selectedConnId);

        if (!error) {
            // Call repair endpoint to sync reject call settings with Evolution
            const companyId = currentUser?.company_id || profile?.company_id;
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (token && companyId) {
                fetch(`/api/whatsapp/repair-webhooks/${companyId}/${selectedConnId}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                }).catch(e => console.error('Error syncing settings with Evolution:', e));
            }
        }

        setSaving(false);

        if (error) {
            alert('Erro ao salvar configurações: ' + error.message);
        } else {
            // Update local state list
            setConnections(prev => prev.map(c => c.id === selectedConnId ? { ...c, ...updates } : c));
            alert('Configurações salvas com sucesso!');
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500 animate-pulse">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest opacity-60">Carregando configurações gerais...</p>
            </div>
        );
    }

    if (connections.length === 0) {
        return (
            <div className="text-center py-20 bg-white/50 dark:bg-white/5 backdrop-blur-md rounded-[2rem] border border-gray-100 dark:border-white/5 p-8 shadow-2xl">
                <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] opacity-50 mb-2">Nenhum canal configurado</p>
                <p className="text-xs text-gray-500">Conecte um canal de atendimento em "Canais" antes de definir os parâmetros gerais.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-4xl animate-in fade-in duration-500">
            {/* Header / Connection Selector */}
            <div className="bg-white/50 dark:bg-white/5 backdrop-blur-md p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                        <Sliders className="w-5 h-5 text-emerald-500" /> Parâmetros do Canal
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-bold opacity-75 uppercase tracking-widest mt-1">Selecione o canal para ajustar o comportamento automático.</p>
                </div>
                <div className="relative min-w-[240px]">
                    <select
                        value={selectedConnId}
                        onChange={handleConnectionChange}
                        className="w-full px-6 py-3.5 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all font-semibold appearance-none cursor-pointer text-sm"
                    >
                        {connections.map(c => (
                            <option key={c.id} value={c.id} className="dark:bg-slate-900 font-medium">
                                {c.connection_name} {c.phone_number ? `(${c.phone_number})` : ''}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">


                {/* Away Message */}
                <div className="bg-white/50 dark:bg-white/5 backdrop-blur-md p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-2xl space-y-6">
                    <h4 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-amber-500" /> Mensagem de Ausência
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 opacity-80 leading-relaxed">Resposta automática enviada aos clientes que entrarem em contato fora do horário de atendimento.</p>

                    <div>
                        <textarea
                            value={awayMessage}
                            onChange={(e) => setAwayMessage(e.target.value)}
                            rows={3}
                            placeholder="Olá! Nosso expediente se encerrou. Retornaremos o contato assim que possível."
                            className="w-full px-5 py-4 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all text-sm resize-none font-medium placeholder:text-gray-400"
                        />
                    </div>
                </div>

                {/* Close Message */}
                <div className="bg-white/50 dark:bg-white/5 backdrop-blur-md p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-2xl space-y-6">
                    <h4 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-emerald-500" /> Mensagem de Encerramento
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 opacity-80 leading-relaxed">Resposta automática enviada aos clientes no WhatsApp assim que o atendimento for encerrado pelo atendente.</p>

                    <div>
                        <textarea
                            value={closeMessage}
                            onChange={(e) => setCloseMessage(e.target.value)}
                            rows={3}
                            placeholder="Seu atendimento foi concluído. Obrigado pelo contato!"
                            className="w-full px-5 py-4 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all text-sm resize-none font-medium placeholder:text-gray-400"
                        />
                    </div>
                </div>

                {/* Call Rejection */}
                <div className="bg-white/50 dark:bg-white/5 backdrop-blur-md p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-2xl space-y-6">
                    <div className="flex justify-between items-start">
                        <h4 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                            <VolumeX className="w-5 h-5 text-red-500" /> Rejeição de Chamadas
                        </h4>
                        <label htmlFor="reject-calls-toggle" className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                id="reject-calls-toggle"
                                checked={rejectCalls}
                                onChange={(e) => setRejectCalls(e.target.checked)}
                                className="sr-only peer cursor-pointer"
                            />
                            <div className="w-11 h-6 bg-gray-200 dark:bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 cursor-pointer" />
                        </label>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 opacity-80 leading-relaxed">Se ativado, o WhatsPanda irá rejeitar chamadas de voz ou vídeo automaticamente e responderá com o texto abaixo.</p>

                    <div>
                        <textarea
                            value={rejectionMessage}
                            onChange={(e) => setRejectionMessage(e.target.value)}
                            disabled={!rejectCalls}
                            rows={3}
                            placeholder="Desculpe, este número não aceita ligações. Por favor, envie uma mensagem de texto."
                            className="w-full px-5 py-4 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all text-sm resize-none font-medium placeholder:text-gray-400 disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                    </div>
                </div>

                {/* Auto Assign */}
                <div className="bg-white/50 dark:bg-white/5 backdrop-blur-md p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-2xl space-y-6">
                    <div className="flex justify-between items-start">
                        <h4 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                            <UserCheck className="w-5 h-5 text-indigo-500" /> Atribuição Automática
                        </h4>
                        <label htmlFor="auto-assign-toggle" className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                id="auto-assign-toggle"
                                checked={autoAssign}
                                onChange={(e) => setAutoAssign(e.target.checked)}
                                className="sr-only peer cursor-pointer"
                            />
                            <div className="w-11 h-6 bg-gray-200 dark:bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 cursor-pointer" />
                        </label>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 opacity-80 leading-relaxed">Atribui automaticamente o atendimento ao primeiro atendente que responder à conversa na aba "Aguardando".</p>
                </div>

                {/* Isolate Chat History */}
                <div className="bg-white/50 dark:bg-white/5 backdrop-blur-md p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-2xl space-y-6">
                    <div className="flex justify-between items-start">
                        <h4 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                            <Sliders className="w-5 h-5 text-indigo-500" /> Privacidade de Histórico
                        </h4>
                        <label htmlFor="isolate-history-toggle" className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                id="isolate-history-toggle"
                                checked={isolateChatHistory}
                                onChange={(e) => setIsolateChatHistory(e.target.checked)}
                                className="sr-only peer cursor-pointer"
                            />
                            <div className="w-11 h-6 bg-gray-200 dark:bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 cursor-pointer" />
                        </label>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 opacity-80 leading-relaxed">Se ativado, as mensagens trocadas em um setor (ex: Financeiro) ficam invisíveis para atendentes de outros setores (ex: Suporte) mesmo que pertençam ao mesmo contato de WhatsApp.</p>
                </div>

                {/* Keyword Transfers Configuration */}
                <div className="bg-white/50 dark:bg-white/5 backdrop-blur-md p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-2xl space-y-6 md:col-span-2">
                    <div>
                        <h4 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                            <Key className="w-5 h-5 text-emerald-500" /> Transferência por Palavra-Chave (IA/Regras)
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 opacity-80 leading-relaxed mt-1">
                            Defina palavras-chave que, se identificadas na mensagem do cliente, encaminharão o atendimento imediatamente para um setor ou agente específico, interrompendo o chatbot.
                        </p>
                    </div>

                    {/* Form to add a new rule */}
                    <div className="bg-gray-100/30 dark:bg-white/5 p-6 rounded-2xl border border-gray-100/50 dark:border-white/5 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                        <div className="sm:col-span-2">
                            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                                Palavra-Chave / Frase
                            </label>
                            <input
                                type="text"
                                value={newKeyword}
                                onChange={(e) => setNewKeyword(e.target.value)}
                                placeholder="Ex: suporte, financeiro, boleto, vendas"
                                className="w-full px-5 py-3.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 dark:text-white transition-all text-sm font-medium"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                                Destinar Para
                            </label>
                            <select
                                value={newTargetType}
                                onChange={(e) => {
                                    setNewTargetType(e.target.value as 'queue' | 'agent');
                                    setNewTargetId('');
                                }}
                                className="w-full px-4 py-3.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 dark:text-white transition-all text-sm font-bold appearance-none cursor-pointer"
                            >
                                <option value="queue">Setor (Fila)</option>
                                <option value="agent">Agente (Atendente)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                                Escolha o Destino
                            </label>
                            {newTargetType === 'queue' ? (
                                <select
                                    value={newTargetId}
                                    onChange={(e) => setNewTargetId(e.target.value)}
                                    className="w-full px-4 py-3.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 dark:text-white transition-all text-sm font-semibold appearance-none cursor-pointer"
                                >
                                    <option value="">Selecione o Setor...</option>
                                    {queues.map(q => (
                                        <option key={q.id} value={q.id}>{q.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <select
                                    value={newTargetId}
                                    onChange={(e) => setNewTargetId(e.target.value)}
                                    className="w-full px-4 py-3.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 dark:text-white transition-all text-sm font-semibold appearance-none cursor-pointer"
                                >
                                    <option value="">Selecione o Agente...</option>
                                    {agents.map(a => (
                                        <option key={a.id} value={a.id}>{a.full_name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <div className="sm:col-span-4 flex justify-end">
                            <button
                                type="button"
                                onClick={handleAddKeywordRule}
                                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md"
                            >
                                Adicionar Regra
                            </button>
                        </div>
                    </div>

                    {/* Table / List of current rules */}
                    <div className="space-y-4 pt-2">
                        <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Regras de Redirecionamento Ativas</h5>
                        {keywordTransfers.length === 0 ? (
                            <p className="text-xs text-gray-400 font-medium italic">Nenhuma regra de palavra-chave configurada para este canal.</p>
                        ) : (
                            <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-white/5">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-gray-150/50 dark:bg-white/3 border-b border-gray-150 dark:border-white/5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                            <th className="py-3.5 px-6">Palavra-Chave</th>
                                            <th className="py-3.5 px-6">Tipo</th>
                                            <th className="py-3.5 px-6">Encaminhar Para</th>
                                            <th className="py-3.5 px-6 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-white/5 bg-white/10">
                                        {keywordTransfers.map((rule) => {
                                            let targetName = 'Desconhecido';
                                            if (rule.target_type === 'queue') {
                                                targetName = queues.find(q => q.id === rule.target_id)?.name || 'Setor Removido';
                                            } else {
                                                targetName = agents.find(a => a.id === rule.target_id)?.full_name || 'Agente Removido';
                                            }
                                            return (
                                                <tr key={rule.id} className="hover:bg-gray-50/50 dark:hover:bg-white/3 transition-colors font-semibold dark:text-white">
                                                    <td className="py-3.5 px-6 font-mono text-emerald-500">{rule.keyword}</td>
                                                    <td className="py-3.5 px-6">
                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${rule.target_type === 'queue'
                                                                ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                                                                : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'
                                                            }`}>
                                                            {rule.target_type === 'queue' ? 'Setor' : 'Agente'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-6 text-gray-700 dark:text-gray-300">{targetName}</td>
                                                    <td className="py-3.5 px-6 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveKeywordRule(rule.id)}
                                                            className="text-red-500 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-all font-bold"
                                                        >
                                                            Remover
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Transfer Message Configurations */}
                <div className="bg-white/50 dark:bg-white/5 backdrop-blur-md p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-2xl space-y-6 md:col-span-2">
                    <div className="flex justify-between items-start">
                        <h4 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-indigo-500" /> Mensagens de Transferência de Atendimento
                        </h4>
                        <label htmlFor="send-transfer-msg-toggle" className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                id="send-transfer-msg-toggle"
                                checked={sendTransferMessageToClient}
                                onChange={(e) => setSendTransferMessageToClient(e.target.checked)}
                                className="sr-only peer cursor-pointer"
                            />
                            <div className="w-11 h-6 bg-gray-200 dark:bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 cursor-pointer" />
                        </label>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 opacity-80 leading-relaxed">
                        Defina o comportamento das mensagens enviadas quando um atendimento for transferido para outra fila ou atendente.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                                Mensagem Enviada ao Cliente (WhatsApp)
                            </label>
                            <textarea
                                value={transferMessageClient}
                                onChange={(e) => setTransferMessageClient(e.target.value)}
                                disabled={!sendTransferMessageToClient}
                                rows={3}
                                placeholder="Ex: Seu atendimento foi transferido para {target}. Por favor, aguarde."
                                className="w-full px-5 py-4 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all text-sm resize-none font-medium placeholder:text-gray-400 disabled:opacity-40 disabled:cursor-not-allowed"
                            />
                            <p className="text-[9px] text-gray-400 mt-1 font-bold">Use as tags: <code className="text-emerald-500">{'{target}'}</code> para o destino.</p>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                                Mensagem Interna no Histórico (Chat)
                            </label>
                            <textarea
                                value={transferMessageAgent}
                                onChange={(e) => setTransferMessageAgent(e.target.value)}
                                rows={3}
                                placeholder="Ex: Atendimento transferido para {target} por {sender}."
                                className="w-full px-5 py-4 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all text-sm resize-none font-medium placeholder:text-gray-400"
                            />
                            <p className="text-[9px] text-gray-400 mt-1 font-bold">Use as tags: <code className="text-emerald-500">{'{target}'}</code> para destino, <code className="text-emerald-500">{'{sender}'}</code> para quem transferiu.</p>
                        </div>
                    </div>
                </div>

                {/* Expedientes Complexos por Dia e Setor */}
                <div className="bg-white/50 dark:bg-white/5 backdrop-blur-md p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-2xl space-y-6 md:col-span-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h4 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                <Clock className="w-5 h-5 text-emerald-500 animate-pulse" /> Expedientes Avançados por Dia e Setor
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 opacity-80 leading-relaxed mt-1">
                                Configure faixas de horários específicas por dia da semana e setor (fila). Caso não configure, valerá o horário padrão geral definido no card acima.
                            </p>
                        </div>
                        <div className="relative min-w-[200px]">
                            <select
                                value={activeTarget}
                                onChange={(e) => setActiveTarget(e.target.value)}
                                className="w-full px-4 py-2 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-xl dark:text-white font-bold text-xs"
                            >
                                <option value="general" className="dark:bg-slate-900 font-bold">Geral (Toda a Empresa)</option>
                                {queues.map(q => (
                                    <option key={q.id} value={q.id} className="dark:bg-slate-900 font-semibold">Setor: {q.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 divide-y divide-gray-100 dark:divide-white/5">
                        {DAYS_OF_WEEK.map((day) => {
                            const targetHours = getTargetHours(activeTarget);
                            const intervals = targetHours[day.value] || [];
                            const isOpen = intervals.length > 0;

                            return (
                                <div key={day.value} className="flex flex-col md:flex-row md:items-center justify-between py-4 gap-4 first:pt-0">
                                    <div className="w-40 shrink-0">
                                        <span className="text-xs font-bold text-gray-800 dark:text-white">{day.label}</span>
                                    </div>

                                    <div className="flex-1 flex flex-wrap items-center gap-3">
                                        {!isOpen ? (
                                            <span className="text-xs text-red-500 font-bold bg-red-50 dark:bg-red-500/10 px-3 py-1.5 rounded-full border border-red-200 dark:border-red-500/20">
                                                Fechado (Sem atendimento)
                                            </span>
                                        ) : (
                                            <div className="flex flex-wrap gap-2 items-center">
                                                {intervals.map((interval: any, idx: number) => (
                                                    <div key={idx} className="flex items-center gap-1.5 bg-gray-100/70 dark:bg-white/10 px-3 py-1.5 rounded-xl border border-transparent dark:border-white/5">
                                                        <input
                                                            type="time"
                                                            value={interval.start}
                                                            onChange={(e) => {
                                                                const next = [...intervals];
                                                                next[idx] = { ...interval, start: e.target.value };
                                                                updateTargetHours(activeTarget, day.value, next);
                                                            }}
                                                            className="bg-transparent border-none outline-none text-xs text-gray-800 dark:text-white font-bold p-0 text-center w-14"
                                                        />
                                                        <span className="text-xs text-gray-400 font-bold">até</span>
                                                        <input
                                                            type="time"
                                                            value={interval.end}
                                                            onChange={(e) => {
                                                                const next = [...intervals];
                                                                next[idx] = { ...interval, end: e.target.value };
                                                                updateTargetHours(activeTarget, day.value, next);
                                                            }}
                                                            className="bg-transparent border-none outline-none text-xs text-gray-800 dark:text-white font-bold p-0 text-center w-14"
                                                        />
                                                        <button
                                                            onClick={() => {
                                                                const next = intervals.filter((_: any, i: number) => i !== idx);
                                                                updateTargetHours(activeTarget, day.value, next);
                                                            }}
                                                            className="text-red-500 hover:text-red-650 ml-1 hover:bg-red-50 dark:hover:bg-red-500/10 p-0.5 rounded transition-all"
                                                            title="Remover faixa"
                                                        >
                                                            &times;
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="shrink-0 flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                if (isOpen) {
                                                    // Fechar: apagar todos os intervalos
                                                    updateTargetHours(activeTarget, day.value, null);
                                                } else {
                                                    // Abrir: inicializar com um intervalo padrão
                                                    updateTargetHours(activeTarget, day.value, [{ start: '08:00', end: '18:00' }]);
                                                }
                                            }}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${isOpen
                                                    ? 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200'
                                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-200'
                                                }`}
                                        >
                                            {isOpen ? 'Marcar Fechado' : 'Marcar Aberto'}
                                        </button>

                                        {isOpen && (
                                            <button
                                                onClick={() => {
                                                    updateTargetHours(activeTarget, day.value, [...intervals, { start: '13:00', end: '18:00' }]);
                                                }}
                                                className="px-4 py-2 bg-slate-100/50 hover:bg-slate-200/50 dark:bg-white/10 dark:hover:bg-white/20 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold transition-all border border-transparent dark:border-white/5"
                                            >
                                                + Intervalo
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Actions Bar */}
            <div className="flex justify-end p-4">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full sm:w-auto justify-center px-10 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? <RefreshCw className="w-5 h-5 animate-spin shrink-0" /> : <Save className="w-5 h-5 shrink-0" />}
                    Salvar Parâmetros
                </button>
            </div>
        </div>
    );
};

export default GeneralTab;
