import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import DOMPurify from 'dompurify';
import {
    EnvelopeIcon,
    Cog6ToothIcon,
    ArrowPathIcon,
    PaperAirplaneIcon,
    MagnifyingGlassIcon,
    TrashIcon,
    ArchiveBoxIcon,
    TagIcon,
    InboxIcon,
    PencilSquareIcon,
    ChevronLeftIcon
} from '@heroicons/react/24/outline'; // Assuming you have these or similar icons from your icon set

// --- Types ---

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
    signature?: string; // HTML Signature
}

interface EmailMessage {
    uid: string;
    seq: string;
    from: string;
    to: string;
    subject: string;
    date: string;
    html?: string;
    text?: string;
    flags: string[];
    metadata?: EmailMetadata; // Expanded locally
}

interface EmailMetadata {
    id?: string;
    tags: { label: string; color: string }[];
    notes?: string;
}

// --- Components ---

const EmailPage: React.FC<{ currentUser: any }> = ({ currentUser }) => {
    // --- State: Navigation & Layout ---
    const [view, setView] = useState<'inbox' | 'compose' | 'settings' | 'read'>('inbox');
    const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true); // For responsive toggle

    // --- State: Data ---
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
        smtp_ssl: true,
        signature: ''
    });
    const [emails, setEmails] = useState<EmailMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    
    // --- State: Search & Filters ---
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTag, setFilterTag] = useState<string | null>(null);

    // --- State: Compose ---
    const [composeTo, setComposeTo] = useState('');
    const [composeSubject, setComposeSubject] = useState('');
    const [composeBody, setComposeBody] = useState('');

    // --- Refs ---
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    // --- State: Context Menu (Moved to proper location) ---
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, email: EmailMessage } | null>(null);

    // --- Actions: Context Menu ---
    const handleContextMenu = (e: React.MouseEvent, email: EmailMessage) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, email });
    };

    const closeContextMenu = () => setContextMenu(null);

    // Click outside to close
    useEffect(() => {
        const handleClick = () => closeContextMenu();
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // --- Effects ---

    useEffect(() => {
        loadSettings();
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [currentUser]);

    // Auto-load emails when settings are ready (fixes "Refresh Required" bug)
    useEffect(() => {
        if (settings.imap_user) {
            fetchEmails(false); // Initial load
            // Poll every 2 minutes
            pollingRef.current = setInterval(() => fetchEmails(true), 120000);
        }
    }, [settings.imap_user]); // Dependency on imap_user ensures it runs after settings load

    // --- Actions ---

    const loadSettings = async () => {
        const { data } = await supabase.from('email_settings').select('*').eq('user_id', currentUser.id).single();
        if (data) {
            setSettings({
                imap_host: data.imap_host,
                imap_port: data.imap_port,
                imap_user: data.imap_user,
                imap_pass: data.imap_pass,
                imap_ssl: data.imap_ssl ?? true,
                smtp_host: data.smtp_host,
                smtp_port: data.smtp_port,
                smtp_user: data.smtp_user,
                smtp_pass: data.smtp_pass,
                smtp_ssl: data.smtp_ssl ?? true,
                signature: data.signature || ''
            });
        }
    };

    const saveSettings = async () => {
        const payload = { user_id: currentUser.id, ...settings };
        const { error } = await supabase.from('email_settings').upsert(payload, { onConflict: 'user_id' });
        if (error) alert('Erro ao salvar: ' + error.message);
        else {
            alert('Configurações salvas!');
            setView('inbox');
            fetchEmails(true); // Force refresh with new settings
        }
    };

    const invokeFunction = async (functionName: string, body: any) => {
        const customUrl = import.meta.env.VITE_SUPABASE_FUNCTION_URL;
        if (customUrl) {
            const url = customUrl.endsWith('/') ? `${customUrl}${functionName}` : `${customUrl}/${functionName}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await response.json();
            if (!response.ok) return { data: null, error: { message: data.error || 'Request failed' } };
            return { data, error: null };
        }
        return await supabase.functions.invoke(functionName, { body });
    };

    const fetchEmails = async (isBackground = false) => {
        if (!settings.imap_user) return;
        if (!isBackground) setLoading(true);
        else setRefreshing(true);

        try {
            const { data, error } = await invokeFunction('email-handler', { action: 'fetch', config: settings });
            if (error) throw error;
            if (data.error) throw new Error(data.error);

            // Fetch Local Metadata (Tags/Notes)
            const { data: metadataList } = await supabase
                .from('email_metadata')
                .select('*')
                .eq('user_id', currentUser.id);

            // Merge metadata
            const mergedEmails = data.map((email: any) => {
                const meta = metadataList?.find((m: any) => m.message_id === email.messageId); // Assuming function returns messageId
                return {
                    ...email,
                    metadata: meta ? { id: meta.id, tags: meta.tags, notes: meta.notes } : { tags: [] }
                };
            });

            setEmails(mergedEmails);
        } catch (err: any) {
            console.error("Fetch Error:", err);
            if (!isBackground) alert(`Erro ao buscar e-mails: ${err.message || "Verifique as configurações."}`);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const sendEmail = async () => {
        setLoading(true);
        try {
            // Append Signature
            const fullBody = `${composeBody}<br/><br/>--<br/>${settings.signature || ''}`;

            const { data, error } = await invokeFunction('email-handler', {
                action: 'send',
                config: settings,
                payload: {
                    to: composeTo,
                    subject: composeSubject,
                    text: composeBody, // Plain text fallback
                    html: fullBody
                }
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            alert('E-mail enviado com sucesso!');
            setComposeTo('');
            setComposeSubject('');
            setComposeBody('');
            setView('inbox');
        } catch (err: any) {
            alert('Erro ao enviar: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Helpers ---

    const handleAddTag = async (email: EmailMessage, label: string, color: string) => {
        const newTags = [...(email.metadata?.tags || []), { label, color }];

        // Optimistic Update
        const updatedEmails = emails.map(e => e.uid === email.uid ? { ...e, metadata: { ...e.metadata, tags: newTags } } : e);
        setEmails(updatedEmails);

        // Persist
        // Note: Needs 'messageId' from IMAP response. If missing, we can't persist accurately.
        if (!email.uid) return; // Should use Message-ID properly

        // Using UID as generic ID for now, but Message-ID is safer for IMAP
        // The DB schema uses message_id. 
        // Strategy: Upsert into email_metadata finding by (user_id, message_id)
        // For now let's hope the Edge Function returns 'messageId'

        // Assuming 'uid' is unique enough for this session or we have messageId
        const messageId = (email as any).messageId || email.uid;

        await supabase.from('email_metadata').upsert({
            user_id: currentUser.id,
            message_id: messageId,
            tags: newTags
        }, { onConflict: 'user_id,message_id' });
    };

    const filteredEmails = emails.filter(email => {
        const matchesSearch =
            email.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            email.from?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTag = filterTag ? email.metadata?.tags.some(t => t.label === filterTag) : true;
        return matchesSearch && matchesTag;
    });

    // --- Render ---

    return (
        <div className="flex bg-white h-[calc(100vh-6rem)] rounded-xl shadow-lg overflow-hidden border border-gray-200">
            {/* --- Left Sidebar (Folders) --- */}
            <div className={`w-64 bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-300 ${sidebarOpen ? '' : '-ml-64 md:ml-0'}`}>
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="font-bold text-gray-700">PandaMail</h2>
                    <button onClick={() => setView('settings')} className="text-gray-400 hover:text-brand-primary">
                        <Cog6ToothIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 space-y-2">
                    <button onClick={() => { setView('compose'); setComposeTo(''); setComposeSubject(''); setComposeBody(''); }} className="w-full bg-brand-primary text-white py-2 px-4 rounded-lg font-medium shadow-sm hover:bg-emerald-600 flex items-center justify-center gap-2 mb-4">
                        <PencilSquareIcon className="w-5 h-5" />
                        Escrever
                    </button>

                    <nav className="space-y-1">
                        <button onClick={() => { setView('inbox'); setFilterTag(null); }} className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md ${view === 'inbox' && !filterTag ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
                            <InboxIcon className="w-5 h-5" />
                            Caixa de Entrada
                            <span className="ml-auto bg-gray-200 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                                {emails.length}
                            </span>
                        </button>
                        <button disabled className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-gray-400 cursor-not-allowed">
                            <PaperAirplaneIcon className="w-5 h-5" />
                            Enviados (Em breve)
                        </button>
                    </nav>

                    <div className="pt-4 mt-4 border-t border-gray-200">
                        <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Tags rápidas
                        </h3>
                        {/* Demo Tags */}
                        {['Urgente', 'Financeiro', 'Pessoal'].map(tag => (
                            <button 
                                key={tag}
                                onClick={() => { setView('inbox'); setFilterTag(tag); }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md ${filterTag === tag ? 'bg-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                                <span className={`w-2 h-2 rounded-full ${tag === 'Urgente' ? 'bg-red-500' : tag === 'Financeiro' ? 'bg-green-500' : 'bg-blue-500'}`}></span>
                                {tag}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* --- Middle: Email List --- */}
            {view === 'inbox' && (
                <div className="flex-1 flex flex-col min-w-0 md:max-w-md border-r border-gray-200 relative">
                    {/* ... Search ... */}

                    {/* List */}
                    <div className="flex-1 overflow-y-auto bg-gray-50">
                        {loading && emails.length === 0 ? (
                            <div className="p-10 text-center text-gray-400">
                                <ArrowPathIcon className="w-8 h-8 mx-auto animate-spin mb-2" />
                                Carregando...
                            </div>
                        ) : filteredEmails.length === 0 ? (
                            <div className="p-10 text-center text-gray-400">Nenhum e-mail encontrado.</div>
                        ) : (
                            filteredEmails.map(email => (
                                <div
                                    key={email.uid}
                                    onClick={() => { setSelectedEmail(email); setView('read'); }}
                                    onContextMenu={(e) => handleContextMenu(e, email)}
                                    className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-white hover:shadow-sm transition-all ${selectedEmail?.uid === email.uid ? 'bg-white border-l-4 border-l-brand-primary shadow-sm' : 'bg-transparent'}`}
                                >
                                    {/* ... Email Item Content ... */}
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`font-medium text-sm truncate pr-2 ${email.flags && email.flags.includes('\\Seen') ? 'text-gray-600' : 'text-gray-900 font-bold'}`}>
                                            {email.from.replace(/<.*>/, '')}
                                        </span>
                                        <span className="text-xs text-gray-400 whitespace-nowrap">
                                            {new Date(email.date).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className={`text-sm mb-1 truncate ${email.flags && email.flags.includes('\\Seen') ? 'text-gray-600' : 'text-gray-900 font-semibold'}`}>
                                        {email.subject}
                                    </div>
                                    <div className="text-xs text-gray-500 line-clamp-2">
                                        {email.text ? email.text.substring(0, 100) : 'Sem pré-visualização...'}
                                    </div>
                                    {email.metadata?.tags && email.metadata.tags.length > 0 && (
                                        <div className="flex gap-1 mt-2">
                                            {email.metadata.tags.map(t => (
                                                <span key={t.label} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200" style={{ borderColor: t.color, color: t.color }}>
                                                    {t.label}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Context Menu */}
                    {contextMenu && (
                        <div
                            className="fixed bg-white shadow-xl rounded-lg border border-gray-200 z-50 w-48 py-1"
                            style={{ top: contextMenu.y, left: contextMenu.x }}
                            onClick={(e) => e.stopPropagation()} // Prevent closing immediately
                        >
                            <div className="px-3 py-2 text-xs font-bold text-gray-500 border-b bg-gray-50">
                                Adicionar Tag
                            </div>
                            {['Urgente|#ef4444', 'Financeiro|#22c55e', 'Pessoal|#3b82f6', 'Trabalho|#f59e0b'].map(opt => {
                                const [lbl, clr] = opt.split('|');
                                return (
                                    <button 
                                        key={lbl}
                                        onClick={() => { handleAddTag(contextMenu.email, lbl, clr); closeContextMenu(); }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                    >
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: clr }}></span>
                                        {lbl}
                                    </button>
                                );
                            })}
                            <div className="border-t mt-1 pt-1">
                                <button onClick={() => { /* Delete Logic */ closeContextMenu(); alert('Em breve'); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                                    <TrashIcon className="w-4 h-4" />
                                    Excluir
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ... Rest of component ... */}

            {/* --- Right: Detail View OR Compose OR Settings --- */}
            <div className={`flex-1 bg-white flex flex-col overflow-hidden ${view === 'inbox' ? 'hidden md:flex' : 'flex z-20 absolute inset-0 md:static'}`}>

                {/* Mobile Header for Full Views */}
                <div className="md:hidden p-3 border-b flex items-center gap-3">
                    <button onClick={() => setView('inbox')} className="p-2 -ml-2 text-gray-600">
                        <ChevronLeftIcon className="w-6 h-6" />
                        </button>
                    <span className="font-bold text-gray-700">
                        {view === 'read' ? 'Mensagem' : view === 'compose' ? 'Nova Mensagem' : 'Configurações'}
                    </span>
                    </div>

                {view === 'read' && selectedEmail ? (
                    <div className="flex-1 flex flex-col h-full overflow-hidden">
                        {/* Toolbar */}
                        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <h2 className="text-lg font-bold text-gray-800 truncate pr-4">{selectedEmail.subject}</h2>
                            <div className="flex gap-2">
                                <button className="p-2 hover:bg-gray-200 rounded-full text-gray-500" title="Apagar (Demo)">
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                                <div className="relative group">
                                    <button className="p-2 hover:bg-gray-200 rounded-full text-gray-500" title="Adicionar Tag">
                                        <TagIcon className="w-5 h-5" />
                                    </button>
                                    <div className="absolute right-0 top-full mt-1 bg-white shadow-lg rounded-lg border border-gray-200 p-2 hidden group-hover:block min-w-[150px] z-50">
                                        {['Urgente|#ef4444', 'Financeiro|#22c55e', 'Pessoal|#3b82f6'].map(opt => {
                                            const [lbl, clr] = opt.split('|');
                                            return (
                                                <button key={lbl} onClick={() => handleAddTag(selectedEmail, lbl, clr)} className="block w-full text-left px-3 py-1 text-sm hover:bg-gray-100 rounded flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: clr }}></span> {lbl}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Metadata */}
                        <div className="p-6 pb-2">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary font-bold">
                                    {selectedEmail.from.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="font-semibold text-gray-900">{selectedEmail.from}</div>
                                    <div className="text-sm text-gray-500">Para: {selectedEmail.to || 'mim'}</div>
                                </div>
                                <div className="ml-auto text-sm text-gray-500">
                                    {new Date(selectedEmail.date).toLocaleString()}
                                </div>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6 pt-0">
                            {/* IFRAME for isolation is safer, but DangerousSetInnerHTML with DOMPurify is standard for Webmail Clients */}
                            <div
                                className="prose max-w-none text-gray-800"
                                dangerouslySetInnerHTML={{
                                    __html: DOMPurify.sanitize(selectedEmail.html || selectedEmail.text || '')
                                }}
                            />
                        </div>
                    </div>
                ) : view === 'read' && !selectedEmail ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <EnvelopeIcon className="w-16 h-16 mb-4 opacity-20" />
                        <p>Selecione um e-mail para ler</p>
                    </div>
                ) : view === 'compose' ? (
                    <div className="flex-1 flex flex-col h-full bg-white">
                        <div className="p-6 flex-1 flex flex-col space-y-4">
                            <input 
                                        className="w-full border-b border-gray-200 py-2 bg-transparent focus:outline-none focus:border-brand-primary placeholder-gray-400"
                                        placeholder="Para:"
                                value={composeTo}
                                        onChange={e => setComposeTo(e.target.value)}
                                    />
                            <input 
                                        className="w-full border-b border-gray-200 py-2 bg-transparent focus:outline-none focus:border-brand-primary font-medium placeholder-gray-400"
                                        placeholder="Assunto"
                                value={composeSubject}
                                        onChange={e => setComposeSubject(e.target.value)}
                            />

                                    <div className="flex-1 border rounded-lg overflow-hidden flex flex-col">
                                        <ReactQuill
                                            theme="snow"
                                            value={composeBody}
                                            onChange={setComposeBody}
                                            className="h-full flex-1 flex flex-col"
                                            modules={{
                                                toolbar: [
                                                    [{ 'header': [1, 2, false] }],
                                                    ['bold', 'italic', 'underline', 'strike'],
                                                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                                    ['link', 'image'],
                                                    ['clean']
                                                ],
                                            }}
                                        />
                                    </div>

                                    <div className="flex justify-between items-center pt-2">
                                        <span className="text-xs text-gray-400 ml-1">
                                            {settings.signature ? 'Sua assinatura será adicionada automaticamente.' : 'Sem assinatura configurada.'}
                                        </span>
                                        <div className="flex gap-2">
                                            <button onClick={() => setView('inbox')} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md font-medium">Cancelar</button>
                                            <button
                                                onClick={sendEmail}
                                                disabled={loading}
                                                className="px-6 py-2 bg-brand-primary text-white rounded-md font-medium hover:bg-emerald-600 shadow-lg flex items-center gap-2"
                                            >
                                                <PaperAirplaneIcon className="w-4 h-4" />
                                                {loading ? 'Enviando...' : 'Enviar'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : view === 'settings' ? (
                            <div className="flex-1 p-8 overflow-y-auto">
                                <h2 className="text-2xl font-bold text-gray-800 mb-6">Configurações de E-mail</h2>

                                    <div className="grid gap-6 max-w-3xl">
                                        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-4">
                                            <h3 className="font-semibold text-gray-700 mb-4">Servidor de Entrada (IMAP)</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs font-bold text-gray-500 uppercase">Host IMAP</label>
                                                    <input value={settings.imap_host} onChange={e => setSettings(s => ({ ...s, imap_host: e.target.value }))} className="w-full mt-1 border rounded p-2" placeholder="imap.gmail.com" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-gray-500 uppercase">Porta</label>
                                                    <input type="number" value={settings.imap_port} onChange={e => setSettings(s => ({ ...s, imap_port: parseInt(e.target.value) }))} className="w-full mt-1 border rounded p-2" placeholder="993" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-gray-500 uppercase">Usuário</label>
                                                    <input value={settings.imap_user} onChange={e => setSettings(s => ({ ...s, imap_user: e.target.value, smtp_user: e.target.value }))} className="w-full mt-1 border rounded p-2" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-gray-500 uppercase">Senha do App</label>
                                                    <input type="password" value={settings.imap_pass} onChange={e => setSettings(s => ({ ...s, imap_pass: e.target.value, smtp_pass: e.target.value }))} className="w-full mt-1 border rounded p-2" />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input type="checkbox" checked={settings.imap_ssl} onChange={e => setSettings(s => ({ ...s, imap_ssl: e.target.checked }))} />
                                                    <label className="text-sm">Usar SSL/TLS</label>
                                                </div>
                                            </div>

                                            <h3 className="font-semibold text-gray-700 mb-4 mt-6">Servidor de Saída (SMTP)</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs font-bold text-gray-500 uppercase">Host SMTP</label>
                                                    <input value={settings.smtp_host} onChange={e => setSettings(s => ({ ...s, smtp_host: e.target.value }))} className="w-full mt-1 border rounded p-2" placeholder="smtp.gmail.com" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-gray-500 uppercase">Porta</label>
                                                    <input type="number" value={settings.smtp_port} onChange={e => setSettings(s => ({ ...s, smtp_port: parseInt(e.target.value) }))} className="w-full mt-1 border rounded p-2" placeholder="465" />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input type="checkbox" checked={settings.smtp_ssl} onChange={e => setSettings(s => ({ ...s, smtp_ssl: e.target.checked }))} />
                                                    <label className="text-sm">Usar SSL/TLS</label>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Signature Editor */}
                                        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                            <h3 className="font-semibold text-gray-700 mb-4">Assinatura Automática</h3>
                                            <p className="text-sm text-gray-500 mb-2">Esta assinatura será adicionada ao final de todos os e-mails enviados.</p>
                                            <div className="h-48 mb-12">
                                                <ReactQuill
                                                    theme="snow"
                                                    value={settings.signature}
                                                    onChange={val => setSettings(s => ({ ...s, signature: val }))}
                                                    style={{ height: '150px' }}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex justify-end gap-3 pt-4 border-t">
                                            <button onClick={() => setView('inbox')} className="px-4 py-2 text-gray-600">Cancelar</button>
                                            <button onClick={saveSettings} className="px-6 py-2 bg-brand-primary text-white rounded font-medium shadow">Salvar Configurações</button>
                                        </div>
                                    </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default EmailPage;
