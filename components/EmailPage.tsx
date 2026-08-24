import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import Card from './Card';
import { EnvelopeIcon, Cog6ToothIcon, ArrowPathIcon, PaperAirplaneIcon, PlusCircleIcon } from './icons';

interface EmailSettings {
    imap_host: string;
    imap_port: number;
    imap_user: string;
    imap_pass: string;
    imap_ssl: boolean;
    smtp_host: string;
    smtp_port: number;
    smtp_user: string;
    smtp_pass: string;
    smtp_ssl: boolean;
}

const EmailPage: React.FC<{ currentUser: any }> = ({ currentUser }) => {
    const [activeTab, setActiveTab] = useState<'inbox' | 'compose' | 'settings'>('inbox');
    const [settings, setSettings] = useState<EmailSettings>({
        imap_host: 'imap.gmail.com',
        imap_port: 993,
        imap_user: '',
        imap_pass: '',
        imap_ssl: true,
        smtp_host: 'smtp.gmail.com',
        smtp_port: 465,
        smtp_user: '',
        smtp_pass: '',
        smtp_ssl: true
    });
    const [emails, setEmails] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    
    // Compose State
    const [composeTo, setComposeTo] = useState('');
    const [composeSubject, setComposeSubject] = useState('');
    const [composeBody, setComposeBody] = useState('');

    useEffect(() => {
        loadSettings();
    }, [currentUser]);

    useEffect(() => {
        if (activeTab === 'inbox' && settings.imap_user) {
            fetchEmails();
        }
    }, [activeTab]);

    const loadSettings = async () => {
        const { data } = await supabase.from('email_settings').select('*').eq('user_id', currentUser.id).single();
        if (data) {
            setSettings({
                imap_host: data.imap_host,
                imap_port: data.imap_port,
                imap_user: data.imap_user,
                imap_pass: data.imap_pass, // Note: In prod, decrypt this
                imap_ssl: data.imap_ssl ?? true,
                smtp_host: data.smtp_host,
                smtp_port: data.smtp_port,
                smtp_user: data.smtp_user,
                smtp_pass: data.smtp_pass, // Note: In prod, decrypt this
                smtp_ssl: data.smtp_ssl ?? true
            });
        }
    };

    const saveSettings = async () => {
        const payload = {
            user_id: currentUser.id,
            ...settings
        };
        
        // Upsert by user_id
        const { error } = await supabase.from('email_settings').upsert(payload, { onConflict: 'user_id' });
        
        if (error) alert('Erro ao salvar: ' + error.message);
        else {
            alert('Configurações salvas!');
            setActiveTab('inbox');
        }
    };

    const testConnection = async () => {
        setTesting(true);
        try {
            const { data, error } = await invokeFunction('email-handler', {
                action: 'test', config: settings 
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            alert(`Teste Concluído!\nIMAP: ${data.imap ? 'OK' : 'Falha'}\nSMTP: ${data.smtp ? 'OK' : 'Falha'}`);
        } catch (err: any) {
            alert('Erro no teste: ' + err.message);
        } finally {
            setTesting(false);
        }
    };

    const getFunctionUrl = (name: string) => {
        const customUrl = import.meta.env.VITE_SUPABASE_FUNCTION_URL;
        if (customUrl) return customUrl.endsWith('/') ? `${customUrl}${name}` : `${customUrl}/${name}`;
        // Default Supabase behavior
        return undefined; 
    };

    const invokeFunction = async (functionName: string, body: any) => {
        const customUrl = import.meta.env.VITE_SUPABASE_FUNCTION_URL;
        if (customUrl) {
            // Manual Fetch for custom URL (Self-Hosted workaround)
            const url = customUrl.endsWith('/') ? `${customUrl}${functionName}` : `${customUrl}/${functionName}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Add any auth headers if needed
                }, 
                body: JSON.stringify(body)
            });
            const data = await response.json();
            if (!response.ok) return { data: null, error: { message: data.error || 'Request failed' } };
            return { data, error: null };
        }
        
        // Standard Supabase Invoke
        return await supabase.functions.invoke(functionName, { body });
    };

    const fetchEmails = async () => {
        setLoading(true);
        try {
            const { data, error } = await invokeFunction('email-handler', {
                action: 'fetch', config: settings 
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            setEmails(data);
        } catch (err: any) {
            console.error(err);
             // Silent fail or toast
        } finally {
            setLoading(false);
        }
    };

    const sendEmail = async () => {
        setLoading(true);
        try {
            const { data, error } = await invokeFunction('email-handler', {
                    action: 'send', 
                    config: settings,
                    payload: {
                        to: composeTo,
                        subject: composeSubject,
                        text: composeBody,
                        html: composeBody 
                    } 
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            alert('E-mail enviado com sucesso!');
            setComposeTo('');
            setComposeSubject('');
            setComposeBody('');
            setActiveTab('inbox');
        } catch (err: any) {
            alert('Erro ao enviar: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <EnvelopeIcon className="w-8 h-8 text-brand-primary" />
                    Webmail
                </h1>
                <div className="flex bg-white rounded-lg shadow-sm p-1">
                    <button 
                        onClick={() => setActiveTab('inbox')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'inbox' ? 'bg-brand-primary text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        Caixa de Entrada
                    </button>
                    <button 
                        onClick={() => setActiveTab('compose')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'compose' ? 'bg-brand-primary text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        Novo E-mail
                    </button>
                    <button 
                         onClick={() => setActiveTab('settings')}
                         className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'settings' ? 'bg-brand-primary text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        <Cog6ToothIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {activeTab === 'inbox' && (
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-gray-700">Caixa de Entrada</h2>
                        <button onClick={fetchEmails} className="p-2 text-gray-500 hover:text-brand-primary rounded-full hover:bg-gray-100">
                            <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                    
                    {!settings.imap_user ? (
                        <div className="text-center py-10 text-gray-500">
                            <p>Configure sua conta de e-mail na aba de Configurações para ver suas mensagens.</p>
                            <button onClick={() => setActiveTab('settings')} className="mt-4 text-brand-primary font-medium hover:underline">Ir para Configurações</button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Remetente</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Assunto</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {emails.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-8 text-center text-gray-500">Nenhum e-mail encontrado.</td>
                                        </tr>
                                    )}
                                    {emails.map((email: any) => (
                                        <tr key={email.uid} className="hover:bg-gray-50 transition-colors cursor-pointer">
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900 truncate max-w-xs">{email.from}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-md">{email.subject}</td>
                                            <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{new Date(email.date).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            )}

            {activeTab === 'compose' && (
                <Card className="max-w-2xl mx-auto">
                    <h2 className="text-xl font-semibold text-gray-700 mb-6 flex items-center gap-2">
                        <PaperAirplaneIcon className="w-5 h-5" />
                        Novo E-mail
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Para</label>
                            <input 
                                type="email" 
                                value={composeTo}
                                onChange={e => setComposeTo(e.target.value)}
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary"
                                placeholder="destinatario@exemplo.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Assunto</label>
                            <input 
                                type="text"
                                value={composeSubject}
                                onChange={e => setComposeSubject(e.target.value)}
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary"
                                placeholder="Assunto do e-mail"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem</label>
                            <textarea 
                                value={composeBody}
                                onChange={e => setComposeBody(e.target.value)}
                                rows={8}
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary"
                                placeholder="Escreva sua mensagem aqui..."
                            />
                        </div>
                        <div className="flex justify-end pt-4">
                            <button 
                                onClick={sendEmail}
                                disabled={loading}
                                className="px-6 py-2 bg-brand-primary text-white rounded-md font-medium hover:bg-emerald-600 shadow-md flex items-center gap-2 disabled:opacity-50"
                            >
                                {loading && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
                                {loading ? 'Enviando...' : 'Enviar Mensagem'}
                            </button>
                        </div>
                    </div>
                </Card>
            )}

            {activeTab === 'settings' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card title="Servidor de Entrada (IMAP)">
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Host IMAP</label>
                                <input value={settings.imap_host} onChange={e => setSettings({...settings, imap_host: e.target.value})} className="w-full mt-1 rounded-md border-gray-300" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Porta</label>
                                    <input type="number" value={settings.imap_port} onChange={e => setSettings({...settings, imap_port: parseInt(e.target.value)})} className="w-full mt-1 rounded-md border-gray-300" />
                                </div>
                                <div className="flex items-end pb-3">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input type="checkbox" checked={settings.imap_ssl} onChange={e => setSettings({...settings, imap_ssl: e.target.checked})} className="rounded text-brand-primary focus:ring-brand-primary" />
                                        <span className="text-sm text-gray-700">Usar SSL/TLS</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Usuário</label>
                                <input value={settings.imap_user} onChange={e => setSettings({...settings, imap_user: e.target.value})} className="w-full mt-1 rounded-md border-gray-300" placeholder="seu-email@exemplo.com" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Senha do App</label>
                                <input type="password" value={settings.imap_pass} onChange={e => setSettings({...settings, imap_pass: e.target.value})} className="w-full mt-1 rounded-md border-gray-300" />
                            </div>
                        </div>
                    </Card>

                    <Card title="Servidor de Saída (SMTP)">
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Host SMTP</label>
                                <input value={settings.smtp_host} onChange={e => setSettings({...settings, smtp_host: e.target.value})} className="w-full mt-1 rounded-md border-gray-300" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Porta</label>
                                    <input type="number" value={settings.smtp_port} onChange={e => setSettings({...settings, smtp_port: parseInt(e.target.value)})} className="w-full mt-1 rounded-md border-gray-300" />
                                </div>
                                <div className="flex items-end pb-3">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input type="checkbox" checked={settings.smtp_ssl} onChange={e => setSettings({...settings, smtp_ssl: e.target.checked})} className="rounded text-brand-primary focus:ring-brand-primary" />
                                        <span className="text-sm text-gray-700">Usar SSL/TLS</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Usuário</label>
                                <input value={settings.smtp_user} onChange={e => setSettings({...settings, smtp_user: e.target.value})} className="w-full mt-1 rounded-md border-gray-300" placeholder="Mesmo do IMAP" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Senha</label>
                                <input type="password" value={settings.smtp_pass} onChange={e => setSettings({...settings, smtp_pass: e.target.value})} className="w-full mt-1 rounded-md border-gray-300" placeholder="Mesma do IMAP" />
                            </div>
                        </div>
                    </Card>
                    
                    <div className="md:col-span-2 flex justify-end space-x-3 pt-4 border-t">
                        <button 
                            onClick={testConnection} 
                            disabled={testing}
                            className="px-6 py-2 bg-gray-500 text-white rounded-md font-medium hover:bg-gray-600 disabled:opacity-50"
                        >
                            {testing ? 'Testando...' : 'Testar Conexão'}
                        </button>
                        <button 
                            onClick={saveSettings} 
                            className="px-6 py-2 bg-brand-primary text-white rounded-md font-medium hover:bg-emerald-600 shadow-md"
                        >
                            Salvar Configurações
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmailPage;
