import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../AuthContext';
import { QrCode, RefreshCw, CheckCircle, Smartphone, Save, PhoneOff, MessageSquare, Plus, Trash2, Edit2, Send, Instagram, MessageCircle, ArrowLeft, Key, ShieldCheck, Zap } from 'lucide-react';
import QRCode from 'react-qr-code';
import { WhatsAppSettings } from '../../types';

const Channels: React.FC = () => {
    const { profile, user, currentUser } = useAuth();

    const [channels, setChannels] = useState<WhatsAppSettings[]>([]);
    const [loading, setLoading] = useState(true);
    
    // View State
    const [view, setView] = useState<'list' | 'form' | 'qr'>('list');

    // Form State
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [channelType, setChannelType] = useState<'whatsapp' | 'telegram' | 'instagram' | 'messenger'>('whatsapp');
    const [connectionName, setConnectionName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [apiToken, setApiToken] = useState('');
    const [rejectCalls, setRejectCalls] = useState(false);
    const [rejectionMessage, setRejectionMessage] = useState('No momento não atendemos ligações por este canal. Por favor, envie uma mensagem de texto.');

    // QR State
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    // Debug State
    const [showDebug, setShowDebug] = useState(false);
    const [debugLogs, setDebugLogs] = useState<{ time: string, msg: string, type: 'info' | 'error' | 'success' }[]>([]);

    const addDebugLog = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
        setDebugLogs(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 20));
        console.log(`[WP-DEBUG] ${msg}`);
    };

    // Limpar o estado da tela sempre que o usuário trocar de empresa no painel SaaS
    useEffect(() => {
        setView('list');
        setCurrentId(null);
        setQrCode(null);
        setIsConnected(false);
    }, [profile?.company_id, user?.user_metadata?.company_id]);

    useEffect(() => {
        const companyId = profile?.company_id || user?.user_metadata?.company_id;
        if (!companyId) return;

        fetchSettings();

        // Fallback Polling (3 seconds) to ensure QR gets loaded if Realtime fails
        let pollingInterval: NodeJS.Timeout;
        let pollingAttempts = 0;

        if (view === 'qr' && currentId && !isConnected) {
            addDebugLog(`Iniciando polling para conexão: ${currentId}`, 'info');
            pollingInterval = setInterval(async () => {
                pollingAttempts++;
                if (pollingAttempts > 15) {
                    addDebugLog('Timeout: O QR Code demorou muito para ser gerado. O backend WhatsPanda (Baileys) pode estar fora do ar.', 'error');
                    setShowDebug(true);
                    clearInterval(pollingInterval);
                    return;
                }

                const { data, error } = await supabase
                    .from('whatsapp_settings')
                    .select('qr_code, is_connected')
                    .eq('id', currentId)
                    .single();

                if (error) {
                    addDebugLog(`Erro no polling: ${error.message}`, 'error');
                } else if (data) {
                    if (data.qr_code && data.qr_code !== qrCode) {
                        addDebugLog('QR Code recebido via polling!', 'success');
                        setQrCode(data.qr_code);
                    }
                    if (data.is_connected) {
                        addDebugLog('Conexão detectada via polling!', 'success');
                        setIsConnected(true);
                        setTimeout(() => setView('list'), 2000);
                        clearInterval(pollingInterval);
                    }
                }
            }, 3000);
        }

        addDebugLog(`Inscrevendo no Realtime: whatsapp_settings_qr_${companyId}`, 'info');
        const subscription = supabase
            .channel(`whatsapp_settings_qr_${companyId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'whatsapp_settings',
                filter: `company_id=eq.${companyId}`
            }, (payload) => {
                addDebugLog(`Realtime: Evento ${payload.eventType} recebido`, 'info');
                fetchSettings(); // Refresh list on any change

                // If we are currently waiting for QR of this specific channel:
                if (payload.new && (payload.new as any).id === currentId && view === 'qr') {
                    const newData = payload.new as WhatsAppSettings;
                    addDebugLog(`Realtime: Update na conexão atual! Conectado=${newData.is_connected}, QR=${!!newData.qr_code}`, 'info');
                    setIsConnected(newData.is_connected);
                    setQrCode(newData.qr_code || null);
                    if (newData.is_connected) {
                        addDebugLog('Conexão detectada via Realtime!', 'success');
                        setTimeout(() => setView('list'), 2000); // go back to list on connect
                    }
                }
            })
            .subscribe((status) => {
                addDebugLog(`Realtime Status: ${status}`, status === 'SUBSCRIBED' ? 'success' : 'info');
            });

        return () => {
            supabase.removeChannel(subscription);
            if (pollingInterval) clearInterval(pollingInterval);
        };
    }, [profile?.company_id, user?.user_metadata?.company_id, currentId, view, isConnected, qrCode]);

    const fetchSettings = async () => {
        setLoading(true);
        const companyId = currentUser?.company_id;
        if (!companyId) {
            setLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from('whatsapp_settings')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: true });

        if (!error && data) {
            setChannels(data as WhatsAppSettings[]);
        }
        setLoading(false);
    };

    const startSession = async (companyId: string, connectionId: string) => {
        addDebugLog(`Iniciando sessão: Empresa=${companyId}, Conexão=${connectionId}`, 'info');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                addDebugLog('Erro: Nascunha sessão Supabase encontrada!', 'error');
            }

            const url = `https://pandanet.grupopixel.com.br/api/sessions/${companyId}/start/${connectionId}`;
            addDebugLog(`Chamando API: ${url}`, 'info');

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json'
                }
            });
            const jsonResp = await res.json().catch(() => null);

            if (res.ok) {
                addDebugLog('API retornou SUCESSO. Aguardando QR no Banco...', 'success');
            } else {
                addDebugLog(`API retornou ERRO (${res.status}): ${JSON.stringify(jsonResp)}`, 'error');
                setShowDebug(true); // Auto-open debug panel on error
            }

            console.log('[startSession] Status:', res.status, 'Response:', jsonResp);
        } catch (error: any) {
            addDebugLog(`Erro de Rede/Fetch: ${error.message}`, 'error');
            setShowDebug(true); // Auto-open debug panel on fetch error
            console.error('[startSession] Network/Fetch Error:', error);
        }
    };

    const stopSession = async (companyId: string, connectionId: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            await fetch(`https://pandanet.grupopixel.com.br/api/sessions/${companyId}/stop/${connectionId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                }
            });
            fetchSettings();
        } catch (error) {
            console.error('Erro ao parar sessão:', error);
        }
    };

    const repairWebhook = async (companyId: string, connectionId: string) => {
        addDebugLog(`Iniciando REPARO de webhook para: ${connectionId}`, 'info');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`https://pandanet.grupopixel.com.br/api/repair-webhooks/${companyId}/${connectionId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                }
            });
            
            if (res.ok) {
                addDebugLog('Webhook reparado com sucesso!', 'success');
                alert('Conexão reparada com sucesso! As mensagens agora devem chegar corretamente.');
                fetchSettings();
            } else {
                const err = await res.json();
                addDebugLog(`Erro ao reparar: ${err.error || 'Erro desconhecido'}`, 'error');
                alert('Falha ao reparar conexão. Veja o painel de diagnóstico.');
                setShowDebug(true);
            }
        } catch (error: any) {
            addDebugLog(`Erro de rede no reparo: ${error.message}`, 'error');
            setShowDebug(true);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Deseja realmente remover esta conexão? ATENÇÃO: Se houverem contatos e conversas vinculadas, a exclusão será bloqueada.')) return;
        const { error } = await supabase.from('whatsapp_settings').delete().eq('id', id);
        if (error) {
            alert('Não foi possível excluir a conexão.\n\nMotivo: Existem contatos/conversas atrelados a ela.\nVá na aba "Contatos", selecione todos e clique em "Excluir Selecionados" para limpar o histórico, depois tente novamente.');
        } else {
            fetchSettings();
        }
    };

    const handleEdit = (channel: WhatsAppSettings) => {
        setCurrentId(channel.id);
        setChannelType(channel.channel_type || 'whatsapp');
        setConnectionName(channel.connection_name || '');
        setPhoneNumber(channel.phone_number || '');
        setApiToken(channel.api_token || '');
        setRejectCalls(channel.reject_calls || false);
        setRejectionMessage(channel.rejection_message || '');
        setView('form');
    };

    const handleNew = () => {
        setCurrentId(null);
        setChannelType('whatsapp');
        setConnectionName('');
        setPhoneNumber('');
        setApiToken('');
        setRejectCalls(false);
        setRejectionMessage('No momento não atendemos ligações por este canal. Por favor, envie uma mensagem de texto.');
        setView('form');
    };

    const handleSaveConfig = async () => {
        if (!connectionName) {
            alert('Por favor, preencha o Nome da Conexão.');
            return;
        }

        const companyId = profile?.company_id || user?.user_metadata?.company_id;
        if (!companyId) return;

        const updates: Partial<WhatsAppSettings> = {
            company_id: companyId,
            connection_name: connectionName,
            channel_type: channelType,
            phone_number: phoneNumber,
            api_token: apiToken,
            reject_calls: rejectCalls,
            rejection_message: rejectionMessage,
            is_connected: channelType !== 'whatsapp' ? true : false, // Outros canais conectam via API key instantaneamente
        };

        let result;
        if (currentId) {
            updates.id = currentId;
            result = await supabase.from('whatsapp_settings').update(updates).eq('id', currentId).select().single();
        } else {
            result = await supabase.from('whatsapp_settings').insert([updates]).select().single();
        }

        if (result.error) {
            alert(`Erro ao salvar configurações: ${result.error.message}`);
        } else {
            const savedChannel = result.data as WhatsAppSettings;
            if (channelType === 'whatsapp') {
                setCurrentId(savedChannel.id);
                setQrCode(savedChannel.qr_code || null);
                setIsConnected(savedChannel.is_connected || false);
                await startSession(companyId, savedChannel.id);
                setView('qr');
            } else {
                fetchSettings();
                setView('list');
            }
        }
    };

    const getChannelIcon = (type?: string) => {
        switch (type) {
            case 'telegram': return <Send className="w-5 h-5 text-blue-500" />;
            case 'instagram': return <Instagram className="w-5 h-5 text-pink-600" />;
            case 'messenger': return <MessageCircle className="w-5 h-5 text-blue-600 fill-current" />;
            default: return <Smartphone className="w-5 h-5 text-green-500" />;
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto h-full flex flex-col dark:bg-transparent transition-colors duration-500">

            {view === 'list' && (
                <div className="animate-in fade-in duration-500">
                    <div className="flex justify-between items-center mb-10 bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-2xl">
                        <div>
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Canais de Atendimento</h2>
                            <p className="text-gray-500 dark:text-gray-400 text-sm font-bold opacity-80 uppercase tracking-widest mt-1">Gerencie seus números de WhatsApp e redes sociais.</p>
                        </div>
                        <button
                            onClick={handleNew}
                            className="bg-emerald-500 hover:bg-emerald-600 dark:hover:bg-emerald-400 text-white px-8 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all duration-300 shadow-xl shadow-emerald-500/20 flex items-center gap-3"
                        >
                            <Plus className="w-4 h-4" /> Adicionar Canal
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center p-20"><RefreshCw className="w-10 h-10 animate-spin text-emerald-500 opacity-50" /></div>
                    ) : channels.length === 0 ? (
                            <div className="bg-white/50 dark:bg-white/5 backdrop-blur-xl border border-gray-100 dark:border-white/5 rounded-[2.5rem] p-20 flex flex-col items-center text-center shadow-2xl">
                                <div className="w-24 h-24 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-8 border border-white/10">
                                    <MessageSquare className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Nenhum canal configurado</h3>
                                <p className="text-gray-500 dark:text-gray-400 mt-3 max-w-md font-medium">Adicione contas de WhatsApp, Instagram, Telegram ou Messenger para começar a atender seus clientes com excelência.</p>
                                <button onClick={handleNew} className="mt-10 px-10 py-4 bg-emerald-500 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20">
                                Configurar Primeiro Canal
                            </button>
                        </div>
                    ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {channels.map(channel => (
                                <div key={channel.id} className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-[2rem] p-8 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 relative overflow-hidden group backdrop-blur-sm">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-white/5 flex items-center justify-center border border-gray-100 dark:border-white/5 shadow-inner group-hover:scale-110 transition-transform duration-500">
                                                {getChannelIcon(channel.channel_type)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 dark:text-white tracking-tight text-lg leading-tight">{channel.connection_name}</h3>
                                                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest opacity-60">{channel.channel_type || 'whatsapp'}</span>
                                            </div>
                                        </div>
                                        <div className={`px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-[0.15em] border ${channel.is_connected ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                                            {channel.is_connected ? 'Conectado' : 'Desconectado'}
                                        </div>
                                    </div>

                                    {channel.channel_type === 'whatsapp' && (
                                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-6 bg-gray-100 dark:bg-white/5 py-2 px-4 rounded-xl inline-block tracking-widest">{channel.phone_number}</p>
                                    )}

                                    <div className="flex gap-3 mt-4 pt-6 border-t border-gray-50 dark:border-white/5">
                                        <button onClick={() => handleEdit(channel)} className="flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-600 dark:text-gray-400 hover:text-white dark:hover:text-white bg-gray-100 dark:bg-white/5 hover:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all duration-300 flex justify-center items-center gap-2">
                                            <Edit2 className="w-3.5 h-3.5" /> Editar
                                        </button>

                                        {channel.channel_type === 'whatsapp' && !channel.is_connected && (
                                            <button onClick={() => {
                                                setCurrentId(channel.id);
                                                setView('qr');
                                                const companyId = profile?.company_id || user?.user_metadata?.company_id;
                                                if (companyId) startSession(companyId, channel.id);
                                            }} className="flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white rounded-xl transition-all duration-300 flex justify-center items-center gap-2">
                                                <QrCode className="w-3.5 h-3.5" /> QR Code
                                            </button>
                                        )}

                                        {channel.channel_type === 'whatsapp' && channel.is_connected && (
                                            <button 
                                                onClick={() => {
                                                    const companyId = profile?.company_id || user?.user_metadata?.company_id;
                                                    if (companyId) repairWebhook(companyId, channel.id);
                                                }} 
                                                className="flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500 hover:text-white rounded-xl transition-all duration-300 flex justify-center items-center gap-2"
                                                title="Reparar Webhooks (Use se mensagens não chegarem)"
                                            >
                                                <ShieldCheck className="w-3.5 h-3.5" /> Reparar
                                            </button>
                                        )}

                                        <button onClick={() => handleDelete(channel.id)} className="p-2.5 text-gray-400 hover:text-red-500 bg-gray-100 dark:bg-white/5 hover:bg-red-500/10 rounded-xl transition-all duration-300">
                                            <Trash2 className="w-4.5 h-4.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {view === 'form' && (
                <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-2xl p-10 rounded-[3rem] shadow-2xl w-full max-w-2xl mx-auto border border-white/20 dark:border-white/5 animate-in fade-in zoom-in duration-500 max-h-[85vh] overflow-y-auto">
                    <button onClick={() => setView('list')} className="group flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 hover:text-emerald-500 mb-10 transition-all">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Voltar para lista
                    </button>

                    <div className="text-center mb-10">
                        <div className="w-24 h-24 bg-emerald-50/50 dark:bg-emerald-500/10 text-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-emerald-500/20 shadow-xl group">
                            <div className="group-hover:scale-110 transition-transform duration-500">
                                {getChannelIcon(channelType)}
                            </div>
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{currentId ? 'Editar Canal' : 'Configurar Novo Canal'}</h2>
                    </div>

                    <div className="space-y-8">
                        {!currentId && (
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">Selecione a Plataforma</label>
                                <div className="grid grid-cols-4 gap-4">
                                    {(['whatsapp', 'telegram', 'instagram', 'messenger'] as const).map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setChannelType(type)}
                                            className={`py-6 px-3 flex flex-col items-center justify-center gap-3 border rounded-3xl transition-all duration-300 ${channelType === type ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20 ring-4 ring-emerald-500/20 shadow-lg' : 'border-gray-100 dark:border-white/5 bg-white/50 dark:bg-white/5 hover:border-gray-300 dark:hover:border-white/20'}`}
                                        >
                                            <div className={`${channelType === type ? 'scale-110' : 'opacity-60'} transition-all`}>
                                                {getChannelIcon(type)}
                                            </div>
                                            <span className={`text-[10px] font-bold uppercase tracking-widest ${channelType === type ? 'text-emerald-500' : 'text-gray-500'}`}>{type}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Nome de Exibição (Interno)</label>
                            <input 
                                type="text" 
                                value={connectionName}
                                onChange={e => setConnectionName(e.target.value)}
                                placeholder="Ex: Suporte Nível 1"
                                className="w-full px-6 py-4 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all font-medium placeholder-gray-400"
                            />
                        </div>

                        {channelType === 'whatsapp' && (
                            <>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Número do Telefone</label>
                                    <input
                                        type="text"
                                        value={phoneNumber}
                                        onChange={e => setPhoneNumber(e.target.value)}
                                        placeholder="Ex: 5511999999999"
                                        className="w-full px-6 py-4 bg-gray-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-white/10 dark:text-white transition-all font-medium placeholder-gray-400"

                                    />
                                </div>
                                <div className="pt-8 border-t border-gray-100 dark:border-white/5">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-red-500/10 rounded-xl">
                                                <PhoneOff className="w-5 h-5 text-red-500" />
                                            </div>
                                            <div>
                                                <span className="font-bold text-gray-900 dark:text-white tracking-tight">Rejeitar Chamadas?</span>
                                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Áudio e Vídeo</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setRejectCalls(!rejectCalls)}
                                            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-500 ${rejectCalls ? 'bg-red-500 shadow-lg shadow-red-500/30' : 'bg-gray-200 dark:bg-white/10'}`}
                                        >
                                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-500 ${rejectCalls ? 'translate-x-8 shadow-md' : 'translate-x-1'}`} />
                                        </button>
                                    </div>

                                    {rejectCalls && (
                                        <div className="animate-in slide-in-from-top-4 duration-500 bg-red-500/5 dark:bg-red-500/10 p-6 rounded-[2rem] border border-red-500/10">
                                            <label className="block text-[11px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <MessageSquare className="w-4 h-4" /> Mensagem de Rejeição Automática
                                            </label>
                                            <textarea
                                                value={rejectionMessage}
                                                onChange={e => setRejectionMessage(e.target.value)}
                                                rows={4}
                                                className="w-full px-5 py-3.5 bg-white dark:bg-black/20 border border-red-500/20 rounded-2xl focus:ring-2 focus:ring-red-500/20 dark:text-white transition-all font-medium text-sm resize-none"
                                            />
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {channelType !== 'whatsapp' && (
                            <div className="bg-blue-500/5 dark:bg-blue-500/10 p-8 rounded-[2.5rem] border border-blue-500/10">
                                <label className="block text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-3">
                                    <Key className="w-4.5 h-4.5" /> Token da API / Page Access Token
                                </label>
                                <input
                                    type="password"
                                    value={apiToken}
                                    onChange={e => setApiToken(e.target.value)}
                                    placeholder={`Cole aqui o token do ${channelType}`}
                                    className="w-full px-6 py-4 bg-white dark:bg-black/20 border border-blue-500/20 rounded-2xl focus:ring-2 focus:ring-blue-500/20 dark:text-white transition-all font-mono text-xs tracking-widest"
                                />
                                <p className="text-[10px] text-blue-500/70 dark:text-blue-400/60 mt-4 font-bold uppercase tracking-widest leading-relaxed">
                                    {channelType === 'telegram' ? 'Obtenha este token através do @BotFather no Telegram.' : 'Obtenha este token no painel oficial Meta for Developers.'}
                                </p>
                            </div>
                        )}

                        <button 
                            onClick={handleSaveConfig}
                            className="w-full py-5 bg-emerald-500 text-white rounded-[1.5rem] font-bold text-xs uppercase tracking-[0.2em] shadow-2xl shadow-emerald-500/30 hover:bg-emerald-600 hover:-translate-y-1 transition-all duration-300 flex items-center justify-center gap-4 mt-6"
                        >
                            <Save className="w-5 h-5" />
                            {channelType === 'whatsapp' ? 'Salvar e Ver QR Code' : 'Salvar e Conectar'}
                        </button>
                    </div>
                </div>
            )}

            {view === 'qr' && (
                <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-2xl p-12 rounded-[3.5rem] shadow-2xl w-full max-w-xl text-center border border-white/20 dark:border-white/5 animate-in fade-in zoom-in duration-500 mx-auto">
                    {isConnected ? (
                        <div className="py-10">
                            <div className="mb-10 flex justify-center">
                                <div className="w-28 h-28 rounded-[2.5rem] flex items-center justify-center bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 shadow-2xl shadow-emerald-500/20">
                                    <CheckCircle className="w-14 h-14 animate-in zoom-in spin-in-90 duration-700" />
                                </div>
                            </div>
                            <h2 className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight mb-4">WhatsApp Conectado!</h2>
                            <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider text-[10px] opacity-70">Sua sessão foi iniciada com sucesso. Redirecionando...</p>
                        </div>
                    ) : (
                        <>
                                <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-4">Escaneie o QR Code</h2>
                                <p className="text-gray-500 dark:text-gray-400 text-[11px] font-bold uppercase tracking-widest mb-10 opacity-80 leading-relaxed">
                                    Abra o WhatsApp em seu celular <br />
                                    <span className="text-emerald-500">Menu &gt; Aparelhos Conectados &gt; Conectar</span>
                                </p>

                                <div className="bg-white p-8 inline-block border-[12px] border-slate-900 dark:border-white/5 rounded-[3rem] shadow-2xl mb-10 transform scale-110">
                                    {qrCode ? (
                                        <div className="rounded-2xl overflow-hidden shadow-inner">
                                            {qrCode.length > 1000 || qrCode.startsWith('data:image/') ? (
                                                <img src={qrCode.startsWith('data:image/') ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code" className="w-[256px] h-[256px] object-contain" />
                                            ) : (
                                                <QRCode value={qrCode} size={256} fgColor="#0f172a" />
                                            )}
                                        </div>
                                    ) : (
                                            <div className="w-64 h-64 flex flex-col items-center justify-center bg-gray-50 dark:bg-transparent text-gray-400 space-y-4">
                                                <RefreshCw className="w-10 h-10 animate-spin text-emerald-500 opacity-50" />
                                                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Iniciando Sessão...</span>
                                        </div>
                                    )}
                                </div>
                        </>
                    )}

                    <div className="flex flex-col gap-4 mt-6">
                        <button
                            onClick={() => {
                                const companyId = profile?.company_id || user?.user_metadata?.company_id;
                                if (companyId && currentId) startSession(companyId, currentId);
                            }}
                            className="text-[10px] text-emerald-500 hover:text-emerald-400 font-bold uppercase tracking-[0.2em] transition-all bg-emerald-500/5 hover:bg-emerald-500/10 py-3 rounded-xl border border-emerald-500/10"
                        >
                            Refazer / Forçar Início
                        </button>
                        <button
                            onClick={() => setView('list')}
                            className="text-[10px] text-gray-400 hover:text-gray-200 font-bold uppercase tracking-[0.2em] py-2 transition-all"
                        >
                            Cancelar e Voltar
                        </button>
                    </div>
                </div>
            )}
            {/* Debug Toggle & Panel */}
            <div className="mt-auto pt-10">
                <button
                    onClick={() => setShowDebug(!showDebug)}
                    className="text-[9px] font-bold text-gray-400 hover:text-gray-600 uppercase tracking-[0.3em] flex items-center gap-2 mx-auto transition-all"
                >
                    <Smartphone className="w-3 h-3" /> {showDebug ? 'Ocultar Diagnóstico' : 'Mostrar Diagnóstico'}
                </button>

                {showDebug && (
                    <div className="mt-6 bg-slate-900 border border-white/5 rounded-3xl p-6 font-mono text-[10px] text-gray-400 animate-in slide-in-from-bottom-4 duration-500 overflow-hidden shadow-2xl">
                        <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/5">
                            <span className="text-emerald-500 font-bold uppercase tracking-widest">Painel de Diagnóstico WhatsPanda</span>
                            <span className="text-[9px] opacity-50 uppercase">v1.2.0</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                <p className="opacity-50 mb-1">Empresa ID:</p>
                                <p className="text-white truncate">{profile?.company_id || user?.user_metadata?.company_id || 'N/A'}</p>
                            </div>
                            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                <p className="opacity-50 mb-1">Conexão Ativa:</p>
                                <p className="text-white truncate">{currentId || 'NENHUMA'}</p>
                            </div>
                        </div>
                        <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                            {debugLogs.length === 0 ? (
                                <p className="opacity-30 italic">Aguardando eventos...</p>
                            ) : debugLogs.map((log, i) => (
                                <div key={i} className="flex gap-3 leading-relaxed">
                                    <span className="opacity-30 flex-shrink-0">[{log.time}]</span>
                                    <span className={
                                        log.type === 'error' ? 'text-red-400' :
                                            log.type === 'success' ? 'text-emerald-400' :
                                                'text-gray-300'
                                    }>{log.msg}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Channels;
