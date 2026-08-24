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
    ChevronLeftIcon,
    FolderIcon,
    NoSymbolIcon,
    UsersIcon,
    UserPlusIcon,
    ArrowUturnLeftIcon,
    ArrowRightOnRectangleIcon,
    ExclamationTriangleIcon
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
    attachments?: Array<{ id: number; filename: string; contentType: string; size: number }>;
}

interface EmailMetadata {
    id?: string;
    tags: { label: string; color: string }[];
    notes?: string;
}

interface Contact {
    id: string;
    name: string;
    email: string;
}

// --- Module-level cache (persists while tab is open, zero Supabase cost) ---
const emailCache: Record<string, { emails: any[]; total: number; unseen: number; timestamp: number }> = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
    // Tracks the saved imap_user (from DB), NOT the form input — prevents fetchEmails from firing on every keystroke
    const [savedImapUser, setSavedImapUser] = useState('');
    const [showEmailPass, setShowEmailPass] = useState(false);
    const [loadingBody, setLoadingBody] = useState(false);
    const [folders, setFolders] = useState<any[]>([]);
    const [currentFolder, setCurrentFolder] = useState('INBOX');
    
    // --- State: Tags ---
    const [availableTags, setAvailableTags] = useState<{ id: string, label: string, color: string }[]>([]);
    const [showTagModal, setShowTagModal] = useState(false);
    const [newTagLabel, setNewTagLabel] = useState('');
    const [newTagColor, setNewTagColor] = useState('#EF4444'); // Default Red

    // --- State: Pagination ---
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10); // User requested 10
    const [totalEmails, setTotalEmails] = useState(0);
    const [unseenCount, setUnseenCount] = useState(0);

    const [searchQuery, setSearchQuery] = useState('');
    const [filterTag, setFilterTag] = useState<string | null>(null);

    // --- State: Compose ---
    const [composeTo, setComposeTo] = useState('');
    const [composeCc, setComposeCc] = useState('');
    const [composeBcc, setComposeBcc] = useState('');
    const [composeReplyTo, setComposeReplyTo] = useState('');
    const [composeSubject, setComposeSubject] = useState('');
    const [composeBody, setComposeBody] = useState('');
    const [showCc, setShowCc] = useState(false);

    // --- State: Contacts ---
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [showContactsModal, setShowContactsModal] = useState(false);
    const [newContactName, setNewContactName] = useState('');
    const [newContactEmail, setNewContactEmail] = useState('');

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
    // Uses savedImapUser (set only by loadSettings) to avoid triggering on every keystroke in the settings form
    useEffect(() => {
        if (savedImapUser) {
            fetchEmails(false); // Initial load
            // Poll every 2 minutes
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = setInterval(() => fetchEmails(true), 120000);
            fetchFolders(); // Load folders once
            fetchTags();    // Load tags once
            fetchContacts(); // Load contacts once
        }
    }, [savedImapUser]); // Only fires when settings are loaded from DB, not when user types

    // --- Actions ---

    const loadSettings = async () => {
        // maybeSingle() returns null (not 406 error) when no row exists
        const { data } = await supabase.from('email_settings').select('*').eq('user_id', currentUser.id).maybeSingle();
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
            // Only update savedImapUser if there's a valid saved configuration
            setSavedImapUser(data.imap_user || '');
        }
    };

    const saveSettings = async () => {
        const payload = { user_id: currentUser.id, ...settings };
        const { error } = await supabase.from('email_settings').upsert(payload, { onConflict: 'user_id' });
        if (error) alert('Erro ao salvar: ' + error.message);
        else {
            alert('Configurações salvas!');
            setView('inbox');
            setSavedImapUser(settings.imap_user); // Update savedImapUser so polling uses new config
            fetchEmails(true); // Force refresh with new settings
        }
    };

    // Calls the Node.js email server (bypasses Deno edge function which cannot do TLS/IMAP)
    const EMAIL_SERVER_URL = (import.meta.env.VITE_EMAIL_SERVER_URL as string) ||
        `${(import.meta.env.VITE_SUPABASE_URL as string).replace(':8000', ':3001')}/api/email`;

    const callEmailServer = async (action: string, body: any) => {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        try {
            const response = await fetch(`${EMAIL_SERVER_URL}/${action}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });
            const data = await response.json();
            if (!response.ok) return { data: null, error: { message: data.error || 'Servidor de email indisponível' } };
            return { data, error: null };
        } catch (err: any) {
            return { data: null, error: { message: err.message || 'Falha ao conectar ao servidor de email' } };
        }
    };

    const fetchEmailBody = async (uid: string, folder: string) => {
        if (!settings.imap_host) return;

        setLoadingBody(true);
        try {
            const { data, error } = await callEmailServer('fetch-body', {
                config: settings,
                uid,
                path: folder
            });
            if (error) throw error;
            if (data.error) throw new Error(data.error);

            // Update local emails list with the body
            setEmails(prev => prev.map(e => e.uid === uid ? { ...e, text: data.text, html: data.html, attachments: data.attachments } : e));

            // Mark as seen locally if needed
            setEmails(prev => prev.map(e => {
                const flags = e.flags || [];
                if (e.uid === uid && !flags.includes('\\Seen')) {
                    return { ...e, flags: [...flags, '\\Seen'] };
                }
                return e;
            }));

            // Update selected e-mail
            setSelectedEmail(prev => {
                if (!prev || prev.uid !== uid) return prev;
                const flags = prev.flags || [];
                return {
                    ...prev,
                    text: data.text,
                    html: data.html, 
                    attachments: data.attachments,
                    flags: flags.includes('\\Seen') ? flags : [...flags, '\\Seen'] 
                };
            });

            // Update cache
            const cacheKey = `${currentUser.id}_${folder}_${page}`;
            if (emailCache[cacheKey]) {
                emailCache[cacheKey].emails = emailCache[cacheKey].emails.map(e => {
                    if (e.uid !== uid) return e;
                    const flags = e.flags || [];
                    return {
                        ...e,
                        text: data.text,
                        html: data.html, 
                        attachments: data.attachments,
                        flags: flags.includes('\\Seen') ? flags : [...flags, '\\Seen'] 
                    };
                });
            }

            // Background update Seen flag on server if not seen
            const email = emails.find(e => e.uid === uid);
            if (email && !(email.flags || []).includes('\\Seen')) {
                toggleFlag(email, '\\Seen', true);
            }

        } catch (err: any) {
            console.error("Fetch Body Error:", err);
        } finally {
            setLoadingBody(false);
        }
    };

    const downloadAttachment = async (email: EmailMessage, attachmentId: number, filename: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const response = await fetch(`${EMAIL_SERVER_URL}/attachment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    config: settings,
                    uid: email.uid,
                    path: currentFolder,
                    attachmentId
                })
            });

            if (!response.ok) throw new Error('Falha ao baixar anexo');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err: any) {
            alert('Erro ao baixar: ' + err.message);
        }
    };
    const toggleFlag = async (email: EmailMessage, flag: string, add: boolean) => {
        // Optimistic update
        const updateFlags = (flags: string[]) => {
            if (add) return [...flags, flag];
            return flags.filter(f => f !== flag);
        };

        const newFlags = updateFlags(email.flags || []);

        setEmails(prev => prev.map(e => e.uid === email.uid ? { ...e, flags: newFlags } : e));
        if (selectedEmail?.uid === email.uid) {
            setSelectedEmail(prev => prev ? { ...prev, flags: newFlags } : null);
        }

        // Update unseen count badge immediately when marking as read/unread
        if (flag === '\\Seen') {
            const wasUnread = !(email.flags || []).includes('\\Seen');
            if (add && wasUnread) setUnseenCount(prev => Math.max(0, prev - 1));
            else if (!add && !wasUnread) setUnseenCount(prev => prev + 1);
        }

        // Invalidate cache for current folder so next switch-away reloads fresh
        const cacheKey = `${currentUser.id}_${currentFolder}_${page}`;
        delete emailCache[cacheKey];

        // Call Server
        await callEmailServer('flags', {
            config: settings,
            uids: [email.uid],
            operation: add ? 'add' : 'remove',
            flags: [flag],
            path: currentFolder
        });
    };

    const createFolder = async () => {
        const folderName = prompt('Nome da nova pasta:');
        if (!folderName) return;

        const { error } = await callEmailServer('folders', {
            config: settings,
            action: 'create',
            path: folderName
        });

        if (error) alert('Erro ao criar pasta: ' + error.message);
        else {
            alert('Pasta criada com sucesso!');
            fetchFolders();
        }
    };

    const fetchFolders = async () => {
        if (!settings.imap_host) return;
        const { data, error } = await callEmailServer('folders', { config: settings, action: 'list' });
        if (data && !error) {
            setFolders(data);
        } else {
            console.error("Falha ao buscar pastas:", error);
            // Silent fail for UI mostly, but log it. 
            // If it's 404, it means backend is old.
            if (error?.message?.includes('404') || error?.message?.includes('Cannot POST')) {
                alert("Aviso: As pastas não carregaram. O servidor de e-mail parece desatualizado. Por favor, reinicie o backend (server).");
            }
        }
    };

    const fetchTags = async () => {
        const { data } = await supabase.from('email_tags').select('*').eq('user_id', currentUser.id);
        if (data) setAvailableTags(data);
    };

    const createTag = async () => {
        if (!newTagLabel) return;
        const { data, error } = await supabase.from('email_tags').insert({
            user_id: currentUser.id,
            label: newTagLabel,
            color: newTagColor
        }).select();

        if (error) alert('Erro ao criar tag: ' + error.message);
        else if (data) {
            setAvailableTags(prev => [...prev, data[0]]);
            setNewTagLabel('');
            // Optional: Close modal if intended, but keeping open for multiple adds
        }
    };

    const deleteTag = async (tagId: string) => {
        if (!confirm('Excluir esta tag?')) return;
        const { error } = await supabase.from('email_tags').delete().eq('id', tagId);
        if (error) alert('Erro ao excluir: ' + error.message);
        else {
            setAvailableTags(prev => prev.filter(t => t.id !== tagId));
        }
    };

    const moveEmail = async (emailUids: string[], toFolder: string) => {
        try {
            const { error } = await callEmailServer('move', {
                config: settings,
                uids: emailUids,
                fromPath: currentFolder,
                toPath: toFolder
            });
            if (error) throw error;

            // Optimistic UI Update
            setEmails(prev => prev.filter(e => !emailUids.includes(e.uid)));

            // Invalidate current folder cache
            const cacheKey = `${currentUser.id}_${currentFolder}_${page}`;
            delete emailCache[cacheKey];

            // If background refreshing is on, it will eventually re-fetch
        } catch (err: any) {
            alert('Erro ao mover: ' + err.message);
        }
    };

    const handleDragStart = (e: React.DragEvent, email: EmailMessage) => {
        e.dataTransfer.setData('emailUid', email.uid);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetFolder: string) => {
        e.preventDefault();
        const emailUid = e.dataTransfer.getData('emailUid');
        if (emailUid && targetFolder !== currentFolder) {
            moveEmail([emailUid], targetFolder);
        }
    };

    const deleteEmail = async (email: EmailMessage) => {
        if (!confirm('Tem certeza que deseja mover este e-mail para a lixeira?')) return;

        // Optimistic remove
        setEmails(prev => prev.filter(e => e.uid !== email.uid));
        if (selectedEmail?.uid === email.uid) {
            setSelectedEmail(null);
            setView('inbox');
        }

        // Detect Trash Folder
        // 1. Look for specialUse: \Trash
        // 2. Look for common names
        const trashFolderObj = folders.find((f: any) => f.specialUse === '\\Trash') ||
            folders.find((f: any) => ['Trash', 'Bin', 'Lixeira', 'Deleted', 'Itens Excluídos'].includes(f.path));

        const trashPath = trashFolderObj ? trashFolderObj.path : 'Trash';

        const { error } = await callEmailServer('move', {
            config: settings,
            uids: [email.uid],
            fromPath: currentFolder,
            toPath: trashPath
        });

        if (error) {
            console.error('Error deleting email:', error);
            alert(`Erro ao mover para lixeira (${trashPath}). O e-mail reaparecerá se a pasta não existir.`);
            fetchFolders(); // Retry fetching folders in case they changed
        }
    };


    const fetchEmails = async (isBackground = false, forceRefresh = false) => {
        if (!settings.imap_user) return;

        const cacheKey = `${currentUser.id}_${currentFolder}_${page}`;
        const cached = emailCache[cacheKey];

        // Use cache on initial load (not background polling, not forced refresh)
        if (!isBackground && !forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
            setEmails(cached.emails);
            setTotalEmails(cached.total);
            if (currentFolder === 'INBOX') setUnseenCount(cached.unseen);
            return;
        }

        if (!isBackground) setLoading(true);
        else setRefreshing(true);

        try {
            const { data, error } = await callEmailServer('fetch', {
                config: settings,
                path: currentFolder,
                page,
                pageSize
            });
            if (error) throw error;
            if (data.error) throw new Error(data.error);

            // Handle Response (Array or Object with total)
            const emailList = (Array.isArray(data) ? data : data.emails) || [];
            const total = (Array.isArray(data) ? data.length : data.total) || 0;
            const unseen = data.unseen || 0;

            setTotalEmails(total);
            if (currentFolder === 'INBOX') setUnseenCount(unseen);

            // Fetch Local Metadata (Tags/Notes)
            const { data: metadataList } = await supabase
                .from('email_metadata')
                .select('*')
                .eq('user_id', currentUser.id);

            // Merge metadata
            const mergedEmails = emailList.map((email: any) => {
                const meta = metadataList?.find((m: any) => m.message_id === (email.messageId || email.uid));
                return {
                    ...email,
                    metadata: meta ? { id: meta.id, tags: meta.tags || [], notes: meta.notes } : { tags: [] }
                };
            });

            setEmails(mergedEmails);

            // Save to cache
            emailCache[cacheKey] = { emails: mergedEmails, total, unseen, timestamp: Date.now() };
        } catch (err: any) {
            console.error("Fetch Error:", err);
            if (!isBackground) alert(`Erro ao buscar e-mails: ${err.message || "Verifique as configurações."}`);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };


    // Refresh when page or folder changes
    useEffect(() => {
        if (savedImapUser) fetchEmails();
    }, [page, pageSize, currentFolder]);

    const sendEmail = async () => {
        setLoading(true);
        try {
            // Append Signature
            const fullBody = `${composeBody}<br/><br/>--<br/>${settings.signature || ''}`;

            const { data, error } = await callEmailServer('send', {
                config: settings,
                payload: {
                    to: composeTo,
                    cc: composeCc,
                    bcc: composeBcc,
                    replyTo: composeReplyTo,
                    subject: composeSubject,
                    text: composeBody,
                    html: fullBody
                }
            });



            if (error) throw error;
            if (data.error) throw new Error(data.error);

            alert('E-mail enviado com sucesso!');
            setComposeTo('');
            setComposeCc('');
            setComposeBcc('');
            setComposeReplyTo('');
            setComposeSubject('');
            setComposeBody('');
            setView('inbox');
        } catch (err: any) {
            alert('Erro ao enviar: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Contacts & Folders Helpers ---

    const getFolderName = (path: string) => {
        if (path === 'INBOX') return 'Caixa de Entrada';

        // Remove prefix like 'INBOX.' or 'INBOX/'
        let cleanPath = path.replace(/^INBOX[\./]/i, '');

        // Standard translation mapping
        const translations: Record<string, string> = {
            'Sent': 'Enviados',
            'Sent Messages': 'Enviados',
            'Drafts': 'Rascunhos',
            'Trash': 'Lixeira',
            'Deleted Items': 'Lixeira',
            'Junk': 'Spam',
            'Spam': 'Spam',
            'Archive': 'Arquivo',
            'Outbox': 'Caixa de Saída'
        };

        const parts = cleanPath.split(/[\./]/);
        const lastPart = parts[parts.length - 1];

        return translations[lastPart] || lastPart || path;
    }

    const fetchContacts = async () => {
        const { data } = await supabase.from('email_contacts').select('*').eq('user_id', currentUser.id).order('name', { ascending: true });
        if (data) setContacts(data);
    };

    const addContact = async () => {
        if (!newContactEmail) return;
        const { data, error } = await supabase.from('email_contacts').insert({
            user_id: currentUser.id,
            name: newContactName || newContactEmail.split('@')[0],
            email: newContactEmail
        }).select();

        if (error) alert('Erro ao salvar contato: ' + error.message);
        else if (data) {
            setContacts(prev => [...prev, data[0]].sort((a, b) => a.name.localeCompare(b.name)));
            setNewContactName('');
            setNewContactEmail('');
            // Optional: alert('Contato salvo!');
        }
    };

    const deleteContact = async (id: string) => {
        if (!confirm('Excluir este contato?')) return;
        const { error } = await supabase.from('email_contacts').delete().eq('id', id);
        if (error) alert('Erro ao excluir: ' + error.message);
        else setContacts(prev => prev.filter(c => c.id !== id));
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
        const subject = email.subject || '';
        const from = email.from || '';
        const matchesSearch =
            subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
            from.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTag = filterTag ? (email.metadata?.tags || []).some(t => t.label === filterTag) : true;
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

                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    <button onClick={() => { setView('compose'); setComposeTo(''); setComposeSubject(''); setComposeBody(''); }} className="w-full bg-brand-primary text-white py-2 px-4 rounded-lg font-medium shadow-sm hover:bg-emerald-600 flex items-center justify-center gap-2 mb-4">
                        <PencilSquareIcon className="w-5 h-5" />
                        Escrever
                    </button>

                    <nav className="space-y-1">
                        {/* Always show INBOX first */}
                        <button
                            onClick={() => { setView('inbox'); setCurrentFolder('INBOX'); setFilterTag(null); setPage(1); }} 
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, 'INBOX')}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all ${view === 'inbox' && currentFolder === 'INBOX' && !filterTag ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <InboxIcon className="w-5 h-5" />
                            Caixa de Entrada
                            {unseenCount > 0 && (
                                <span className="ml-auto bg-red-500 text-white py-0.5 px-2 rounded-full text-[10px] font-bold">
                                    {unseenCount}
                                </span>
                            )}
                        </button>

                        {/* Render other folders */}
                        {folders
                            .filter((f: any) => f.path !== 'INBOX')
                            .map((folder: any) => {
                                const isSpecial = folder.specialUse;
                                let Icon = FolderIcon;
                                if (isSpecial === '\\Sent' || folder.path.toLowerCase().includes('sent')) Icon = PaperAirplaneIcon;
                                if (isSpecial === '\\Trash' || folder.path.toLowerCase().includes('trash') || folder.path.toLowerCase().includes('deleted')) Icon = TrashIcon;
                                if (isSpecial === '\\Drafts' || folder.path.toLowerCase().includes('draft')) Icon = PencilSquareIcon;
                                if (isSpecial === '\\Junk' || folder.path.toLowerCase().includes('junk') || folder.path.toLowerCase().includes('spam')) Icon = NoSymbolIcon;

                                // Calculate depth for indentation
                                const depth = (folder.path.split(/[\./]/).length) - (folder.path.startsWith('INBOX') ? 1 : 0);
                                const paddingLeft = Math.max(0, (depth - 1) * 16);

                                return (
                                    <button
                                        key={folder.path}
                                        onClick={() => { setView('inbox'); setCurrentFolder(folder.path); setFilterTag(null); setPage(1); }}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, folder.path)}
                                        style={{ paddingLeft: `${12 + paddingLeft}px` }}
                                        className={`w-full flex items-center gap-3 py-2 text-sm font-medium rounded-md transition-colors ${view === 'inbox' && currentFolder === folder.path ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                                    >
                                        <Icon className={`w-5 h-5 ${view === 'inbox' && currentFolder === folder.path ? 'text-brand-primary' : 'text-gray-400'}`} />
                                        <span className="truncate">{getFolderName(folder.path)}</span>
                                    </button>
                                );
                            })}

                        <button onClick={createFolder} className="w-full text-left px-3 py-2 text-xs text-brand-primary hover:bg-gray-100 rounded flex items-center gap-2 mt-2 font-semibold">
                            + Nova Pasta
                        </button>
                    </nav>

                    <div className="pt-4 mt-4 border-t border-gray-200">
                        <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex justify-between items-center">
                            Tags rápidas
                            <button onClick={() => setShowTagModal(true)} className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-brand-primary" title="Gerenciar Tags">
                                <Cog6ToothIcon className="w-3 h-3" />
                            </button>
                        </h3>
                        {/* User Tags */}
                        {availableTags.length === 0 && (
                            <p className="px-3 text-xs text-gray-400 italic">Nenhuma tag criada.</p>
                        )}
                        {availableTags.map(tag => (
                            <button 
                                key={tag.id}
                                onClick={() => { setView('inbox'); setFilterTag(tag.label); setPage(1); }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md ${filterTag === tag.label ? 'bg-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }}></span>
                                {tag.label}
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
                                    onClick={() => { setSelectedEmail(email); setView('read'); fetchEmailBody(email.uid, currentFolder); }}
                                    onContextMenu={(e) => handleContextMenu(e, email)}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, email)}
                                    className={`p-4 border-b border-gray-200 cursor-pointer transition-all hover:bg-white flex flex-col gap-1 relative ${selectedEmail?.uid === email.uid ? 'bg-white border-l-4 border-l-brand-primary shadow-sm' : ''} ${!(email.flags || []).includes('\\Seen') ? 'bg-emerald-50/30' : ''}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className={`text-sm truncate pr-2 ${!(email.flags || []).includes('\\Seen') ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                                            {email.from}
                                        </div>
                                        <div className="text-[10px] text-gray-400 whitespace-nowrap">
                                            {new Date(email.date).toLocaleDateString()}
                                    </div>
                                    </div>
                                    <div className={`text-sm line-clamp-1 ${!(email.flags || []).includes('\\Seen') ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
                                        {email.subject}
                                    </div>
                                    <div className="text-xs text-gray-500 line-clamp-2">
                                        {email.text ? email.text.substring(0, 100) : 'Sem pré-visualização...'}
                                    </div>
                                    {email.metadata?.tags && (email.metadata.tags || []).length > 0 && (
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
                            className="fixed bg-white shadow-2xl rounded-xl border border-gray-200 z-[100] w-56 py-2 overflow-hidden animate-in fade-in zoom-in duration-200"
                            style={{ top: contextMenu.y, left: contextMenu.x }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b bg-gray-50/50">
                                Ações Rápidas
                            </div>

                            <button
                                onClick={() => {
                                    const isSeen = (contextMenu.email.flags || []).includes('\\Seen');
                                    toggleFlag(contextMenu.email, '\\Seen', !isSeen);
                                    closeContextMenu();
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3 transition-colors"
                            >
                                <EnvelopeIcon className="w-4 h-4 text-gray-400" />
                                Marcar como {(contextMenu.email.flags || []).includes('\\Seen') ? 'Não Lido' : 'Lido'}
                            </button>

                            {/* Tags Submenu Header */}
                            <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-t mt-1 bg-gray-50/50">
                                Adicionar Tag
                            </div>
                            <div className="max-h-32 overflow-y-auto">
                                {availableTags.length > 0 ? availableTags.map(tag => (
                                    <button
                                        key={tag.id}
                                        onClick={() => { handleAddTag(contextMenu.email, tag.label, tag.color); closeContextMenu(); }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3 transition-colors"
                                    >
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }}></span>
                                        {tag.label}
                                    </button>
                                )) : (
                                    <div className="px-4 py-2 text-xs text-gray-400 italic">Nenhuma tag cadastrada</div>
                                )}
                            </div>

                            {/* Move to Folder Submenu */}
                            <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-t mt-1 bg-gray-50/50">
                                Mover para
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                                {folders.map(f => (
                                    <button 
                                        key={f.path}
                                        disabled={f.path === currentFolder}
                                        onClick={() => { moveEmail([contextMenu.email.uid], f.path); closeContextMenu(); }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent flex items-center gap-3 transition-colors"
                                    >
                                        <FolderIcon className="w-4 h-4 text-gray-400" />
                                        <span className="truncate">{getFolderName(f.path)}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="border-t mt-1 pt-1">
                                <button onClick={() => { deleteEmail(contextMenu.email); closeContextMenu(); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors">
                                    <TrashIcon className="w-4 h-4" />
                                    Mover para Lixeira
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Pagination Controls */}
                    {view === 'inbox' && (
                        <div className="p-4 border-t border-gray-200 bg-white flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                                Página {page} de {Math.ceil(totalEmails / pageSize) || 1}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1 || loading}
                                    className="px-2 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Anterior
                                </button>
                                <button
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={page * pageSize >= totalEmails || loading}
                                    className="px-2 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Próxima
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
                        <div className="p-2 border-b border-gray-200 flex flex-wrap gap-2 items-center bg-gray-50">
                            <button onClick={() => setView('inbox')} className="md:hidden p-2 text-gray-600">
                                <ChevronLeftIcon className="w-5 h-5" />
                            </button>
                            <button onClick={() => {
                                setView('compose');
                                setComposeTo(selectedEmail.from.match(/<(.+)>/)?.[1] || selectedEmail.from);
                                setComposeSubject('Re: ' + selectedEmail.subject);
                                setComposeBody(`<br/><br/><blockquote style="border-left: 2px solid #ccc; padding-left: 10px; margin-left: 5px;">Em ${new Date(selectedEmail.date).toLocaleString()}, ${selectedEmail.from} escreveu:<br/>${selectedEmail.html || selectedEmail.text}</blockquote>`);
                            }} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100 text-xs font-medium text-gray-700">
                                <ArrowUturnLeftIcon className="w-4 h-4" /> Responder
                            </button>
                            <button onClick={() => {
                                setView('compose');
                                const from = selectedEmail.from.match(/<(.+)>/)?.[1] || selectedEmail.from;
                                const ccs = selectedEmail.to; // Simplification
                                setComposeTo(from);
                                setComposeCc(ccs);
                                setComposeSubject('Re: ' + selectedEmail.subject);
                                setComposeBody(`<br/><br/><blockquote style="border-left: 2px solid #ccc; padding-left: 10px; margin-left: 5px;">Em ${new Date(selectedEmail.date).toLocaleString()}, ${selectedEmail.from} escreveu:<br/>${selectedEmail.html || selectedEmail.text}</blockquote>`);
                            }} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100 text-xs font-medium text-gray-700">
                                <UsersIcon className="w-4 h-4" /> Todos
                            </button>
                            <button onClick={() => {
                                setView('compose');
                                setComposeSubject('Fwd: ' + selectedEmail.subject);
                                setComposeBody(`<br/><br/>---------- Forwarded message ---------<br/>From: ${selectedEmail.from}<br/>Date: ${new Date(selectedEmail.date).toLocaleString()}<br/>Subject: ${selectedEmail.subject}<br/><br/>${selectedEmail.html || selectedEmail.text}`);
                            }} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100 text-xs font-medium text-gray-700">
                                <ArrowRightOnRectangleIcon className="w-4 h-4" /> Encaminhar
                            </button>
                            <div className="h-6 w-px bg-gray-300 mx-1"></div>
                            <button onClick={() => deleteEmail(selectedEmail)} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-red-50 text-xs font-medium text-red-600">
                                <TrashIcon className="w-4 h-4" /> Excluir
                            </button>
                            <button onClick={() => {
                                // Move to Junk/Spam
                                const spamFolder = folders.find(f => f.specialUse === '\\Junk' || f.path.includes('Junk') || f.path.includes('Spam'))?.path || 'Junk';
                                callEmailServer('move', { config: settings, uids: [selectedEmail.uid], path: spamFolder });
                                alert('Movido para Spam');
                                setView('inbox');
                            }} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100 text-xs font-medium text-gray-700">
                                <ExclamationTriangleIcon className="w-4 h-4" /> Spam
                            </button>
                            <button onClick={() => {
                                toggleFlag(selectedEmail, '\\Seen', false);
                                setView('inbox');
                            }} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100 text-xs font-medium text-gray-700">
                                <EnvelopeIcon className="w-4 h-4" /> Não lido
                            </button>
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
                            {loadingBody ? (
                                <div className="flex items-center justify-center h-40">
                                    <ArrowPathIcon className="w-8 h-8 text-gray-400 animate-spin" />
                                    <span className="ml-2 text-gray-400">Carregando conteúdo...</span>
                                </div>
                            ) : (
                                    <>
                                        <div
                                            className="prose max-w-none text-gray-800"
                                            dangerouslySetInnerHTML={{
                                            __html: DOMPurify.sanitize(selectedEmail.html || selectedEmail.text || '<div class="text-gray-400 italic">Sem conteúdo disponível ou falha ao carregar.</div>')
                                        }}
                                    />

                                        {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                                            <div className="mt-8 border-t pt-6">
                                                <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                                                    <FolderIcon className="w-4 h-4" />
                                                    Anexos ({selectedEmail.attachments.length})
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {selectedEmail.attachments.map(att => (
                                                        <div key={att.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-brand-primary transition-colors group">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="w-8 h-8 bg-white rounded flex items-center justify-center border text-gray-400">
                                                                    <PaperAirplaneIcon className="w-4 h-4 rotate-90" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-medium text-gray-700 truncate">{att.filename}</p>
                                                                    <p className="text-[10px] text-gray-400">{(att.size / 1024).toFixed(1)} KB</p>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); downloadAttachment(selectedEmail, att.id, att.filename); }}
                                                                className="p-2 text-gray-400 hover:text-brand-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                                                title="Baixar"
                                                            >
                                                                <ArrowPathIcon className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                            )}
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
                                    <div className="space-y-2">
                                        <div className="flex gap-2 items-center">
                                            <input 
                                                className="flex-1 border-b border-gray-200 py-2 bg-transparent focus:outline-none focus:border-brand-primary placeholder-gray-400"
                                        placeholder="Para:"
                                                value={composeTo}
                                        onChange={e => setComposeTo(e.target.value)}
                                    />
                                            <button onClick={() => setShowContactsModal(true)} className="text-gray-400 hover:text-brand-primary" title="Contatos">
                                                <UsersIcon className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => setShowCc(!showCc)} className="text-xs text-gray-500 hover:text-brand-primary font-medium">
                                                CC/CCO
                                            </button>
                                        </div>
                                        {showCc && (
                                            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-2 rounded">
                                                <input
                                                    className="border-b border-gray-200 py-1 bg-transparent focus:outline-none text-sm"
                                                    placeholder="CC:"
                                                    value={composeCc}
                                                    onChange={e => setComposeCc(e.target.value)}
                                                />
                                                <input
                                                    className="border-b border-gray-200 py-1 bg-transparent focus:outline-none text-sm"
                                                    placeholder="CCO:"
                                                    value={composeBcc}
                                                    onChange={e => setComposeBcc(e.target.value)}
                                                />
                                                <input
                                                    className="col-span-2 border-b border-gray-200 py-1 bg-transparent focus:outline-none text-sm"
                                                    placeholder="Reply-To (Opcional):"
                                                    value={composeReplyTo}
                                                    onChange={e => setComposeReplyTo(e.target.value)}
                                                />
                                            </div>
                                        )}
                                        <input
                                            className="w-full border-b border-gray-200 py-2 bg-transparent focus:outline-none focus:border-brand-primary font-medium placeholder-gray-400"
                                            placeholder="Assunto"
                                            value={composeSubject}
                                            onChange={e => setComposeSubject(e.target.value)}
                                        />
                                    </div>

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
                                                    <div className="relative mt-1">
                                                        <input type={showEmailPass ? 'text' : 'password'} value={settings.imap_pass} onChange={e => setSettings(s => ({ ...s, imap_pass: e.target.value, smtp_pass: e.target.value }))} className="w-full border rounded p-2 pr-10" />
                                                        <button type="button" onClick={() => setShowEmailPass(p => !p)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600">
                                                            {showEmailPass ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                                                        </button>
                                                    </div>
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

            {/* --- Tag Management Modal --- */}
            {showTagModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
                        <h3 className="text-lg font-bold mb-4">Gerenciar Tags</h3>

                        <div className="flex gap-2 mb-4">
                            <input
                                className="flex-1 border rounded px-2"
                                placeholder="Nova tag..."
                                value={newTagLabel}
                                onChange={e => setNewTagLabel(e.target.value)}
                            />
                            <input
                                type="color"
                                value={newTagColor}
                                onChange={e => setNewTagColor(e.target.value)}
                                className="w-8 h-8 rounded cursor-pointer border-none"
                            />
                            <button onClick={createTag} className="bg-brand-primary text-white p-2 rounded hover:bg-emerald-600">
                                <PaperAirplaneIcon className="w-4 h-4 transform rotate-90" />
                            </button>
                        </div>

                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {availableTags.map(tag => (
                                <div key={tag.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }}></span>
                                        <span>{tag.label}</span>
                                    </div>
                                    <button onClick={() => deleteTag(tag.id)} className="text-red-400 hover:text-red-600">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button onClick={() => setShowTagModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Fechar</button>
                        </div>
                    </div>
                </div>
            )}
            {/* --- Contacts Modal --- */}
            {showContactsModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-700">Contatos</h3>
                            <button onClick={() => setShowContactsModal(false)} className="text-gray-400 hover:text-gray-600">
                                <span className="text-2xl">&times;</span>
                            </button>
                        </div>
                        <div className="p-4 border-b bg-gray-50">
                            <div className="flex gap-2">
                                <input
                                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
                                    placeholder="Nome (Opcional)"
                                    value={newContactName}
                                    onChange={e => setNewContactName(e.target.value)}
                                />
                                <input
                                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
                                    placeholder="Email"
                                    value={newContactEmail}
                                    onChange={e => setNewContactEmail(e.target.value)}
                                />
                                <button onClick={addContact} disabled={!newContactEmail} className="bg-brand-primary text-white px-3 py-2 rounded text-sm font-medium hover:bg-emerald-600 disabled:opacity-50">
                                    <UserPlusIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {contacts.length === 0 ? (
                                <p className="text-center text-gray-500 text-sm">Nenhum contato salvo.</p>
                            ) : (
                                contacts.map(contact => (
                                    <div key={contact.id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded border border-transparent hover:border-gray-200 group">
                                        <div>
                                            <div className="font-medium text-gray-800">{contact.name}</div>
                                            <div className="text-xs text-gray-500">{contact.email}</div>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => {
                                                    setComposeTo(prev => prev ? `${prev}, ${contact.email}` : contact.email);
                                                    setShowContactsModal(false);
                                                }}
                                                className="text-brand-primary hover:underline text-xs font-bold"
                                            >
                                                Usar
                                            </button>
                                            <button onClick={() => deleteContact(contact.id)} className="text-red-500 hover:underline text-xs">
                                                Excluir
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmailPage;
