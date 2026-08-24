import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../AuthContext';
import { QrCode, RefreshCw, CheckCircle, Smartphone, Save, PhoneOff, MessageSquare, Plus, Trash2, Edit2, Send, Instagram, MessageCircle, ArrowLeft, Key } from 'lucide-react';
import QRCode from 'react-qr-code';
import { WhatsAppSettings } from '../../types';

const Channels: React.FC = () => {
    const { user, profile } = useAuth();

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

        if (view === 'qr' && currentId && !isConnected) {
            pollingInterval = setInterval(async () => {
                const { data, error } = await supabase
                    .from('whatsapp_settings')
                    .select('qr_code, is_connected')
                    .eq('id', currentId)
                    .single();

                if (!error && data) {
                    if (data.qr_code && data.qr_code !== qrCode) {
                        setQrCode(data.qr_code);
                    }
                    if (data.is_connected) {
                        setIsConnected(true);
                        setTimeout(() => setView('list'), 2000);
                    }
                }
            }, 3000);
        }

        const subscription = supabase
            .channel(`whatsapp_settings_qr_${companyId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'whatsapp_settings',
                filter: `company_id=eq.${companyId}`
            }, (payload) => {
                fetchSettings(); // Refresh list on any change

                // If we are currently waiting for QR of this specific channel:
                if (payload.new && (payload.new as any).id === currentId && view === 'qr') {
                    const newData = payload.new as WhatsAppSettings;
                    setIsConnected(newData.is_connected);
                    setQrCode(newData.qr_code || null);
                    if (newData.is_connected) {
                        setTimeout(() => setView('list'), 2000); // go back to list on connect
                    }
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
            if (pollingInterval) clearInterval(pollingInterval);
        };
    }, [profile?.company_id, user?.user_metadata?.company_id, currentId, view, isConnected, qrCode]);

    const fetchSettings = async () => {
        setLoading(true);
        const companyId = profile?.company_id || user?.user_metadata?.company_id;

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
        try {
            await fetch(`https://pandanet.grupopixel.com.br/api/sessions/${companyId}/start/${connectionId}`, { method: 'POST' });
        } catch (error) {
            console.error('[startSession] Error:', error);
        }
    };

    const stopSession = async (companyId: string, connectionId: string) => {
        try {
            await fetch(`https://pandanet.grupopixel.com.br/api/sessions/${companyId}/stop/${connectionId}`, { method: 'POST' });
            fetchSettings();
        } catch (error) {
            console.error('Erro ao parar sessão:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Deseja realmente remover esta conexão?')) return;
        const { error } = await supabase.from('whatsapp_settings').delete().eq('id', id);
        if (!error) fetchSettings();
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
        <div className="p-8 max-w-6xl mx-auto h-full flex flex-col">

            {view === 'list' && (
                <div className="animate-in fade-in duration-300">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Canais de Atendimento</h2>
                            <p className="text-gray-500">Gerencie seus números de WhatsApp e redes sociais.</p>
                        </div>
                        <button
                            onClick={handleNew}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
                        >
                            <Plus className="w-5 h-5" /> Adicionar Canal
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center p-10"><RefreshCw className="w-8 h-8 animate-spin text-emerald-500" /></div>
                    ) : channels.length === 0 ? (
                        <div className="bg-white border border-gray-100 rounded-2xl p-12 flex flex-col items-center text-center">
                            <MessageSquare className="w-16 h-16 text-gray-200 mb-4" />
                            <h3 className="text-xl font-bold text-gray-800">Nenhum canal configurado</h3>
                            <p className="text-gray-500 mt-2 max-w-md">Adicione contas de WhatsApp, Instagram, Telegram ou Messenger para começar a atender seus clientes.</p>
                            <button onClick={handleNew} className="mt-6 border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-6 py-2 rounded-lg font-medium transition-colors">
                                Configurar Primeiro Canal
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {channels.map(channel => (
                                <div key={channel.id} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100">
                                                {getChannelIcon(channel.channel_type)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 leading-tight">{channel.connection_name}</h3>
                                                <span className="text-xs text-gray-500 capitalize">{channel.channel_type || 'whatsapp'}</span>
                                            </div>
                                        </div>
                                        <div className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${channel.is_connected ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {channel.is_connected ? 'Conectado' : 'Desconectado'}
                                        </div>
                                    </div>

                                    {channel.channel_type === 'whatsapp' && (
                                        <p className="text-sm text-gray-600 mb-4 font-mono">{channel.phone_number}</p>
                                    )}

                                    <div className="flex gap-2 mt-4 pt-4 border-t border-gray-50">
                                        <button onClick={() => handleEdit(channel)} className="flex-1 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors flex justify-center items-center gap-1">
                                            <Edit2 className="w-3.5 h-3.5" /> Editar
                                        </button>

                                        {channel.channel_type === 'whatsapp' && !channel.is_connected && (
                                            <button onClick={() => { setCurrentId(channel.id); setView('qr'); }} className="flex-1 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors flex justify-center items-center gap-1">
                                                <QrCode className="w-3.5 h-3.5" /> QR Code
                                            </button>
                                        )}

                                        <button onClick={() => handleDelete(channel.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {view === 'form' && (
                <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-xl mx-auto border border-gray-100 animate-in fade-in zoom-in duration-300">
                    <button onClick={() => setView('list')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Voltar para lista
                    </button>

                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                            {getChannelIcon(channelType)}
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">{currentId ? 'Editar Canal' : 'Configurar Novo Canal'}</h2>
                    </div>

                    <div className="space-y-5">
                        {!currentId && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Plataforma</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {(['whatsapp', 'telegram', 'instagram', 'messenger'] as const).map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setChannelType(type)}
                                            className={`py-3 px-2 flex flex-col items-center justify-center gap-2 border rounded-xl transition-all ${channelType === type ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                                        >
                                            {getChannelIcon(type)}
                                            <span className="text-[10px] font-bold text-gray-600 capitalize">{type}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome de Exibição (Interno)</label>
                            <input 
                                type="text" 
                                value={connectionName}
                                onChange={e => setConnectionName(e.target.value)}
                                placeholder="Ex: Suporte Nível 1"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                            />
                        </div>

                        {channelType === 'whatsapp' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Número do Telefone</label>
                                    <input
                                        type="text"
                                        value={phoneNumber}
                                        onChange={e => setPhoneNumber(e.target.value)}
                                        placeholder="Ex: 5511999999999"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                                    />
                                </div>
                                <div className="pt-4 border-t border-gray-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <PhoneOff className="w-5 h-5 text-red-500" />
                                            <span className="font-medium text-gray-900">Rejeitar Chamadas (Áudio/Vídeo)?</span>
                                        </div>
                                        <button
                                            onClick={() => setRejectCalls(!rejectCalls)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${rejectCalls ? 'bg-red-500' : 'bg-gray-200'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${rejectCalls ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>

                                    {rejectCalls && (
                                        <div className="animate-in slide-in-from-top-2 duration-200">
                                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                                                <MessageSquare className="w-4 h-4" /> Mensagem de Rejeição Automática
                                            </label>
                                            <textarea
                                                value={rejectionMessage}
                                                onChange={e => setRejectionMessage(e.target.value)}
                                                rows={3}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                                            />
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {channelType !== 'whatsapp' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                                    <Key className="w-4 h-4" /> Token da API / Page Access Token
                                </label>
                                <input
                                    type="password"
                                    value={apiToken}
                                    onChange={e => setApiToken(e.target.value)}
                                    placeholder={`Cole aqui o token do ${channelType}`}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 font-mono text-sm"
                                />
                                <p className="text-xs text-gray-500 mt-2">
                                    {channelType === 'telegram' ? 'Obtenha este token através do @BotFather no Telegram.' : 'Obtenha este token no painel Meta for Developers.'}
                                </p>
                            </div>
                        )}

                        <button 
                            onClick={handleSaveConfig}
                            className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 mt-4"
                        >
                            <Save className="w-5 h-5" />
                            {channelType === 'whatsapp' ? 'Salvar e Ver QR Code' : 'Salvar e Conectar'}
                        </button>
                    </div>
                </div>
            )}

            {view === 'qr' && (
                <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-lg text-center border border-gray-100 animate-in fade-in zoom-in duration-300 mx-auto">
                    {isConnected ? (
                        <>
                            <div className="mb-6 flex justify-center">
                                <div className="w-20 h-20 rounded-full flex items-center justify-center bg-green-100 text-green-600">
                                    <CheckCircle className="w-10 h-10 animate-in zoom-in" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">WhatsApp Conectado!</h2>
                            <p className="text-gray-500 mb-6">Aguarde, retornando aos canais...</p>
                        </>
                    ) : (
                        <>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Escaneie o QR Code</h2>
                            <p className="text-gray-500 mb-6">Abra o WhatsApp &gt; Aparelhos Conectados &gt; Conectar</p>

                                <div className="bg-white p-4 inline-block border-4 border-gray-900 rounded-xl mb-6">
                                    {qrCode ? (
                                        <QRCode value={qrCode} size={256} />
                                    ) : (
                                        <div className="w-64 h-64 flex flex-col items-center justify-center bg-gray-50 text-gray-400 space-y-2">
                                            <RefreshCw className="w-8 h-8 animate-spin" />
                                            <span className="text-sm font-medium">Iniciando Sessão...</span>
                                        </div>
                                    )}
                                </div>
                        </>
                    )}

                    <div className="flex flex-col gap-2">
                        <button
                            onClick={() => {
                                const companyId = profile?.company_id || user?.user_metadata?.company_id;
                                if (companyId && currentId) startSession(companyId, currentId);
                            }}
                            className="text-sm text-emerald-600 hover:text-emerald-800 underline font-medium"
                        >
                            Refazer / Forçar Início
                        </button>
                        <button
                            onClick={() => setView('list')}
                            className="text-sm text-gray-500 hover:text-gray-900 underline mt-4"
                        >
                            Cancelar e Voltar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Channels;
