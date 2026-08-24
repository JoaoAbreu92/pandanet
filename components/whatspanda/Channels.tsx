import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../AuthContext';
import { QrCode, RefreshCw, CheckCircle, Smartphone, Save, PhoneOff, MessageSquare } from 'lucide-react';
import QRCode from 'react-qr-code';

const Channels: React.FC = () => {
    const { user, profile } = useAuth();

    const [qrCode, setQrCode] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    
    // Form State
    const [step, setStep] = useState<'form' | 'qr' | 'connected'>('form');
    const [connectionName, setConnectionName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [rejectCalls, setRejectCalls] = useState(false);
    const [rejectionMessage, setRejectionMessage] = useState('No momento não atendemos ligações por este canal. Por favor, envie uma mensagem de texto.');

    useEffect(() => {
        const companyId = profile?.company_id || user?.user_metadata?.company_id;

        if (!companyId) {
            console.log('[Channels] No company_id available yet, skipping setup');
            return;
        }

        console.log('[Channels] Setting up Realtime subscription for company:', companyId);
        fetchSettings();

        const subscription = supabase
            .channel(`whatsapp_settings_qr_${companyId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'whatsapp_settings',
                filter: `company_id=eq.${companyId}` // Filter by company_id
            }, (payload) => {
                console.log('[Channels] Realtime UPDATE received:', payload);
                const newData = payload.new;
                if (newData) {
                    console.log('[Channels] QR Code:', newData.qr_code ? 'EXISTS' : 'NULL');
                    console.log('[Channels] Is Connected:', newData.is_connected);
                    setIsConnected(newData.is_connected);
                    setQrCode(newData.qr_code);
                    if (newData.is_connected) setStep('connected');
                    else if (newData.qr_code && step !== 'connected') setStep('qr');
                }
            })
            .subscribe();

        return () => {
            console.log('[Channels] Cleaning up Realtime subscription');
            supabase.removeChannel(subscription);
        };
    }, [profile?.company_id, user?.user_metadata?.company_id]); // Only re-run if company_id changes

    // Polling mechanism as fallback when on QR step
    useEffect(() => {
        if (step !== 'qr') return;

        const companyId = profile?.company_id || user?.user_metadata?.company_id;
        if (!companyId) return;

        console.log('[Polling] Starting QR code polling...');

        const pollInterval = setInterval(async () => {
            console.log('[Polling] Checking for QR code...');
            const { data } = await supabase
                .from('whatsapp_settings')
                .select('qr_code, is_connected')
                .eq('company_id', companyId)
                .maybeSingle();

            if (data) {
                console.log('[Polling] QR Code:', data.qr_code ? 'EXISTS' : 'NULL');
                console.log('[Polling] Is Connected:', data.is_connected);

                if (data.qr_code && !qrCode) {
                    console.log('[Polling] QR Code found! Updating state...');
                    setQrCode(data.qr_code);
                }

                if (data.is_connected) {
                    console.log('[Polling] Connected! Switching to connected step...');
                    setIsConnected(true);
                    setStep('connected');
                }
            }
        }, 2000); // Poll every 2 seconds

        return () => {
            console.log('[Polling] Stopping QR code polling');
            clearInterval(pollInterval);
        };
    }, [step, profile?.company_id, user?.user_metadata?.company_id, qrCode]);

    const fetchSettings = async () => {
        setLoading(true);
        const companyId = profile?.company_id || user?.user_metadata?.company_id;
        console.log('[fetchSettings] Fetching for company:', companyId);

        const { data, error } = await supabase
            .from('whatsapp_settings')
            .select('*')
            .eq('company_id', companyId)
            .maybeSingle();

        if (error) {
            console.error('[fetchSettings] Error:', error);
        }

        console.log('[fetchSettings] Data:', data);
        
        if (data) {
            setIsConnected(data.is_connected);
            setConnectionName(data.connection_name || '');
            setPhoneNumber(data.phone_number || '');
            setRejectCalls(data.reject_calls || false);
            if (data.rejection_message) setRejectionMessage(data.rejection_message);
            
            if (data.is_connected) {
                setStep('connected');
            } else if (data.qr_code) {
                console.log('[fetchSettings] QR Code found, switching to QR step');
                setQrCode(data.qr_code);
                setStep('qr');
            } else {
                setStep('form');
            }
        }
        setLoading(false);
    };

    const startSession = async (companyId: string) => {
        try {
            console.log('[startSession] Calling backend API for company:', companyId);
            const response = await fetch(`https://pandanet.grupopixel.com.br/api/sessions/${companyId}/start`, { method: 'POST' });
            console.log('[startSession] Response status:', response.status);
            const data = await response.text();
            console.log('[startSession] Response:', data);
        } catch (error) {
            console.error('[startSession] Error:', error);
        }
    };

    const stopSession = async (companyId: string) => {
        try {
            await fetch(`https://pandanet.grupopixel.com.br/api/sessions/${companyId}/stop`, { method: 'POST' });
        } catch (error) {
            console.error('Erro ao parar sessão:', error);
        }
    };



    const handleSaveConfig = async () => {
        if (!connectionName || !phoneNumber) {
            alert('Por favor, preencha o Nome e o Número.');
            return;
        }

        const companyId = profile?.company_id || user?.user_metadata?.company_id || '15d38706-59a6-43b8-9366-2371904d90ce'; 
        console.log('[handleSaveConfig] Company ID:', companyId);

        const updates = {
            company_id: companyId,
            connection_name: connectionName,
            phone_number: phoneNumber,
            reject_calls: rejectCalls,
            rejection_message: rejectionMessage,
            updated_at: new Date().toISOString()
        };

        console.log('[handleSaveConfig] Upserting settings:', updates);

        const { error } = await supabase
            .from('whatsapp_settings')
            .upsert(updates, { onConflict: 'company_id' });

        if (error) {
            console.error('[handleSaveConfig] Error saving settings:', error);
            alert(`Erro ao salvar configurações: ${error.message}`);
        } else {
            console.log('[handleSaveConfig] Settings saved successfully');
            console.log('[handleSaveConfig] Starting session for company:', companyId);
            // Trigger backend session start
            await startSession(companyId);
            setStep('qr');
        }
    };

    const checkDbStatus = async () => {
        const companyId = profile?.company_id || user?.user_metadata?.company_id;
        if (!companyId) return alert('Sem Company ID');

        try {
            const { data, error } = await supabase
                .from('whatsapp_settings')
                .select('*')
                .eq('company_id', companyId)
                .maybeSingle();

            console.log('[Debug] DB Status:', data, error);
            alert(JSON.stringify({ data, error }, null, 2));
        } catch (e) {
            alert('Erro ao checar DB: ' + e);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto h-full flex flex-col items-center justify-center">
            
            {step === 'form' && (
                <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-lg border border-gray-100 animate-in fade-in zoom-in duration-300">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Smartphone className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Configurar Canal WhatsApp</h2>
                        <p className="text-gray-500">Defina as opções antes de conectar.</p>
                    </div>

                    <div className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Conexão</label>
                            <input 
                                type="text" 
                                value={connectionName}
                                onChange={e => setConnectionName(e.target.value)}
                                placeholder="Ex: WhatsApp Comercial"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Número do Telefone</label>
                            <input 
                                type="text" 
                                value={phoneNumber}
                                onChange={e => setPhoneNumber(e.target.value)}
                                placeholder="Ex: 5511999999999"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Conexão</label>
                            <div className="w-full px-4 py-2 border border-gray-200 bg-gray-50 text-gray-500 rounded-lg cursor-not-allowed">
                                Baileys (Padrão)
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <PhoneOff className="w-5 h-5 text-red-500" />
                                    <span className="font-medium text-gray-900">Rejeitar Chamadas?</span>
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
                                        <MessageSquare className="w-4 h-4" /> Mensagem de Rejeição
                                    </label>
                                    <textarea 
                                        value={rejectionMessage}
                                        onChange={e => setRejectionMessage(e.target.value)}
                                        rows={3}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-sm"
                                    />
                                </div>
                            )}
                        </div>

                        <button 
                            onClick={handleSaveConfig}
                            className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 mt-4"
                        >
                            <Save className="w-5 h-5" />
                            Salvar e Iniciar Conexão
                        </button>
                    </div>
                </div>
            )}

            {step === 'qr' && (
                 <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-lg text-center border border-gray-100 animate-in fade-in zoom-in duration-300">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Escaneie o QR Code</h2>
                    <p className="text-gray-500 mb-6">Abra o WhatsApp &gt; Aparelhos Conectados &gt; Conectar</p>

                    <div className="bg-white p-4 inline-block border-4 border-gray-900 rounded-xl mb-6">
                        {qrCode ? (
                            <QRCode value={qrCode} size={256} />
                        ) : (
                            <div className="w-64 h-64 flex flex-col items-center justify-center bg-gray-50 text-gray-400 space-y-2">
                                <RefreshCw className="w-8 h-8 animate-spin" />
                                    <span className="text-sm">Iniciando Sessão...</span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="flex gap-2 justify-center">
                            <button
                                onClick={() => {
                                    const companyId = profile?.company_id || user?.user_metadata?.company_id;
                                    if (companyId) stopSession(companyId);
                                }}
                                className="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-200"
                            >
                                Parar Conexão
                            </button>
                            <button
                                onClick={checkDbStatus}
                                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200"
                            >
                                Debug (Ver DB)
                            </button>
                        </div>

                        <button
                            onClick={() => {
                                const companyId = profile?.company_id || user?.user_metadata?.company_id;
                                if (companyId) startSession(companyId);
                            }}
                            className="text-sm text-green-600 hover:text-green-800 underline font-medium"
                        >
                            Forçar Início de Sessão
                        </button>
                        <button
                            onClick={() => setStep('form')}
                            className="text-sm text-gray-500 hover:text-gray-900 underline"
                        >
                            Voltar para Configurações
                        </button>
                    </div>
                </div>
            )}

            {step === 'connected' && (
                <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-lg text-center border border-gray-100 animate-in fade-in zoom-in duration-300">
                     <div className="mb-6 flex justify-center">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center bg-green-100 text-green-600">
                            <CheckCircle className="w-10 h-10" />
                        </div>
                    </div>
                    
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">WhatsApp Conectado!</h2>
                    <p className="text-gray-500 mb-6">
                        O número <strong>{phoneNumber}</strong> está sincronizado.
                    </p>

                    <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left text-sm space-y-2">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Nome:</span>
                            <span className="font-medium">{connectionName}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Rejeitar Chamadas:</span>
                            <span className={`font-medium ${rejectCalls ? 'text-green-600' : 'text-gray-600'}`}>
                                {rejectCalls ? 'Ativado' : 'Desativado'}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-3">
                         <button 
                            onClick={() => setStep('form')}
                            className="flex-1 py-2 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                            Editar Config
                        </button>
                        <button 
                            onClick={async () => {
                                const companyId = profile?.company_id || user?.user_metadata?.company_id;
                                if (confirm('Tem certeza que deseja desconectar?')) {
                                    await stopSession(companyId);
                                    setStep('form');
                                    setQrCode(null);
                                }
                            }}
                            className="flex-1 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                        >
                            Desconectar
                        </button>
                    </div>

                    <div className="mt-4">
                        <button
                            onClick={() => {
                                const companyId = profile?.company_id || user?.user_metadata?.company_id;
                                if (companyId) startSession(companyId);
                            }}
                            className="text-xs text-gray-400 hover:text-gray-600 underline"
                        >
                            Debug: Reiniciar Conexão
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Channels;
