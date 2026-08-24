import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { useAuth } from '../../../components/AuthContext';
import { Save, Clock, MessageSquare, Sliders, VolumeX, UserCheck, Check, Loader2, RefreshCw } from 'lucide-react';

interface WhatsAppSettingsData {
    id: string;
    connection_name: string;
    phone_number?: string;
    business_hours_start?: string;
    business_hours_end?: string;
    away_message?: string;
    reject_calls?: boolean;
    rejection_message?: string;
    auto_assign?: boolean;
}

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
    const [rejectCalls, setRejectCalls] = useState(false);
    const [rejectionMessage, setRejectionMessage] = useState('');
    const [autoAssign, setAutoAssign] = useState(false);

    useEffect(() => {
        fetchConnections();
    }, [currentUser?.company_id]);

    const fetchConnections = async () => {
        const companyId = currentUser?.company_id || profile?.company_id;
        if (!companyId) return;

        setLoading(true);
        const { data, error } = await supabase
            .from('whatsapp_settings')
            .select('id, connection_name, phone_number, business_hours_start, business_hours_end, away_message, reject_calls, rejection_message, auto_assign')
            .eq('company_id', companyId);

        if (error) {
            console.error('Error fetching settings connections:', error);
        } else if (data && data.length > 0) {
            setConnections(data);
            // Default select first connection
            const activeConn = data[0];
            setSelectedConnId(activeConn.id);
            loadConnectionData(activeConn);
        }
        setLoading(false);
    };

    const loadConnectionData = (conn: WhatsAppSettingsData) => {
        setBusinessHoursStart(conn.business_hours_start?.slice(0, 5) || '08:00');
        setBusinessHoursEnd(conn.business_hours_end?.slice(0, 5) || '18:00');
        setAwayMessage(conn.away_message || '');
        setRejectCalls(!!conn.reject_calls);
        setRejectionMessage(conn.rejection_message || '');
        setAutoAssign(!!conn.auto_assign);
    };

    const handleConnectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const connId = e.target.value;
        setSelectedConnId(connId);
        const conn = connections.find(c => c.id === connId);
        if (conn) {
            loadConnectionData(conn);
        }
    };

    const handleSave = async () => {
        if (!selectedConnId) return;

        setSaving(true);
        const updates = {
            business_hours_start: businessHoursStart ? `${businessHoursStart}:00` : null,
            business_hours_end: businessHoursEnd ? `${businessHoursEnd}:00` : null,
            away_message: awayMessage,
            reject_calls: rejectCalls,
            rejection_message: rejectionMessage,
            auto_assign: autoAssign,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('whatsapp_settings')
            .update(updates)
            .eq('id', selectedConnId);

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
                {/* Working Hours */}
                <div className="bg-white/50 dark:bg-white/5 backdrop-blur-md p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-2xl space-y-6">
                    <h4 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <Clock className="w-5 h-5 text-blue-500" /> Horário de Atendimento
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 opacity-80 leading-relaxed">Defina o período do seu expediente. Mensagens recebidas fora deste horário receberão a mensagem de ausência configurada ao lado.</p>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Início do Expediente</label>
                            <input
                                type="time"
                                value={businessHoursStart}
                                onChange={(e) => setBusinessHoursStart(e.target.value)}
                                className="w-full px-5 py-3.5 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all font-bold text-center text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Fim do Expediente</label>
                            <input
                                type="time"
                                value={businessHoursEnd}
                                onChange={(e) => setBusinessHoursEnd(e.target.value)}
                                className="w-full px-5 py-3.5 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all font-bold text-center text-sm"
                            />
                        </div>
                    </div>
                </div>

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

                {/* Call Rejection */}
                <div className="bg-white/50 dark:bg-white/5 backdrop-blur-md p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-2xl space-y-6">
                    <div className="flex justify-between items-start">
                        <h4 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                            <VolumeX className="w-5 h-5 text-red-500" /> Rejeição de Chamadas
                        </h4>
                        <div className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                id="reject-calls-toggle"
                                checked={rejectCalls}
                                onChange={(e) => setRejectCalls(e.target.checked)}
                                className="sr-only peer cursor-pointer"
                            />
                            <div className="w-11 h-6 bg-gray-200 dark:bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 cursor-pointer" />
                        </div>
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
                        <div className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                id="auto-assign-toggle"
                                checked={autoAssign}
                                onChange={(e) => setAutoAssign(e.target.checked)}
                                className="sr-only peer cursor-pointer"
                            />
                            <div className="w-11 h-6 bg-gray-200 dark:bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 cursor-pointer" />
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 opacity-80 leading-relaxed">Atribui automaticamente o atendimento ao primeiro atendente que responder à conversa na aba "Aguardando".</p>
                </div>
            </div>

            {/* Actions Bar */}
            <div className="flex justify-end p-4">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-10 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Salvar Parâmetros
                </button>
            </div>
        </div>
    );
};

export default GeneralTab;
