import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from './LanguageContext';
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
    ExclamationTriangleIcon, XMarkIcon,
    PaperClipIcon, ArrowDownTrayIcon
} from '@heroicons/react/24/outline'; // Assuming you have these or similar icons from your icon set
import { useToast } from './ToastContext';
import ConfirmModal from './ui/ConfirmModal';
import { useNotifications } from './NotificationContext';

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
    messageId?: string;
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
    snippet?: string;
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
    const { t, language } = useLanguage();
    const { showToast } = useToast();
    const { setModuleUnreadCount } = useNotifications();

    // --- State: Confirm Modal ---
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        type?: 'danger' | 'warning' | 'info' | 'success';
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        type: 'warning'
    });

    const openConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'warning' | 'info' | 'success' = 'warning') => {
        setConfirmState({ isOpen: true, title, message, onConfirm, type });
    };

    const closeConfirm = () => setConfirmState(prev => ({ ...prev, isOpen: false }));

    // --- State: Navigation & Layout ---
    const [view, setView] = useState<'inbox' | 'compose' | 'settings' | 'read'>('inbox');
    const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true); // For responsive toggle
    const [isFullScreen, setIsFullScreen] = useState(false); // New Full Screen Mode

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
    const [bodyError, setBodyError] = useState<string | null>(null);
    const [folders, setFolders] = useState<any[]>([]);
    const [currentFolder, setCurrentFolder] = useState('INBOX');
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    
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
    const [toTags, setToTags] = useState<string[]>([]);
    const [ccTags, setCcTags] = useState<string[]>([]);
    const [bccTags, setBccTags] = useState<string[]>([]);
    const [showDetails, setShowDetails] = useState(false);
    const [composeReplyTo, setComposeReplyTo] = useState('');
    const [composeSubject, setComposeSubject] = useState('');
    const [composeBody, setComposeBody] = useState('');
    const [showCc, setShowCc] = useState(false);

    // --- State: Contacts ---
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [showContactsModal, setShowContactsModal] = useState(false);
    const [newContactName, setNewContactName] = useState('');
    const [newContactEmail, setNewContactEmail] = useState('');
    const [attachments, setAttachments] = useState<any[]>([]);
    const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024; // 20MB

    // --- Refs ---
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    // --- State: Context Menu ---
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, email: EmailMessage } | null>(null);
    const [selectedEmailUids, setSelectedEmailUids] = useState<string[]>([]);

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

    // Sincroniza o contador local de nÃ£o lidos com o badge global do Sidebar
    useEffect(() => {
        setModuleUnreadCount('email', unseenCount);
    }, [unseenCount, setModuleUnreadCount]);

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
            // @ts-ignore
            if (pollingRef.current) clearInterval(pollingRef.current);
            // @ts-ignore - Bypass Deno vs Browser typing on setInterval
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
        if (error) {
            showToast('Erro ao salvar as configurações: ' + error.message, 'error');
        } else {
            showToast('Configurações salvas com sucesso!', 'success');
            setView('inbox');
            setSavedImapUser(settings.imap_user); // Update savedImapUser so polling uses new config
            fetchEmails(true); // Force refresh with new settings
        }
    };

    // Calls the Node.js email server (bypasses Deno edge function which cannot do TLS/IMAP)
    // @ts-ignore
    const EMAIL_SERVER_URL = (import.meta.env.VITE_EMAIL_SERVER_URL as string) ||
    // @ts-ignore
        `${(import.meta.env.VITE_SUPABASE_URL as string).replace(':8000', ':3001')}/api/email`;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const validFiles: any[] = [];

        for (const file of files) {
            if (file.size > MAX_ATTACHMENT_SIZE) {
                showToast(`O arquivo "${file.name}" excede o limite de 20MB e não será adicionado.`, 'warning');
                continue;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                const base64Content = (event.target?.result as string).split(',')[1];
                setAttachments(prev => [...prev, {
                    filename: file.name,
                    content: base64Content,
                    contentType: file.type,
                    size: file.size
                }]);
            };
            reader.readAsDataURL(file);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

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
        setBodyError(null);
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

            // Mark local real-state emails as seen
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

            // Always update cache with the new body data
            const cacheKey = `${currentUser.id}_${folder}_${page}`;
            if (emailCache[cacheKey]) {
                emailCache[cacheKey].emails = emailCache[cacheKey].emails.map(e =>
                    e.uid === uid ? { ...e, flags: [...(e.flags || []), '\\Seen'], text: data.text, html: data.html, attachments: data.attachments } : e
                );
            }

            // Background update Seen flag on server if not seen (using stale reference, but that's fine for calling the server)
            const email = emails.find(e => e.uid === uid);
            if (email && !(email.flags || []).includes('\\Seen')) {
                // Background call to server, don't await to avoid blocking UI
                toggleFlag(email, '\\Seen', true).catch(e => console.error("Error setting Seen flag:", e));
            }
        } catch (err: any) {
            console.error("Fetch Body Error:", err);
            setBodyError(err.message || "Falha ao carregar conteúdo do e-mail.");
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
            showToast('Erro ao baixar anexo: ' + err.message, 'error');
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

        // Update the cache directly so returning to the folder shows correct read status without waiting for network
        const cacheKey = `${currentUser.id}_${currentFolder}_${page}`;
        if (emailCache[cacheKey]) {
            emailCache[cacheKey].emails = emailCache[cacheKey].emails.map(e =>
                e.uid === email.uid ? { ...e, flags: newFlags } : e
            );
            // Optionally update unseen count in cache
            if (currentFolder === 'INBOX' && flag === '\\Seen') {
                const wasUnread = !(email.flags || []).includes('\\Seen');
                if (add && wasUnread) emailCache[cacheKey].unseen = Math.max(0, emailCache[cacheKey].unseen - 1);
                else if (!add && !wasUnread) emailCache[cacheKey].unseen += 1;
            }
        }

        // Call Server
        await callEmailServer('flags', {
            config: settings,
            uids: [email.uid],
            operation: add ? 'add' : 'remove',
            flags: [flag],
            path: currentFolder
        });
    };

    const markAllAsRead = async () => {
        const unreadEmails = emails.filter(e => !(e.flags || []).includes('\\Seen'));
        if (unreadEmails.length === 0) return;

        // Optimistic UI Update
        setEmails(prev => prev.map(e => ({ ...e, flags: [...(e.flags || []), '\\Seen'] })));
        setUnseenCount(0);

        // Call Server for each or batch if supported. The /flags API supports multiple UIDs.
        await callEmailServer('flags', {
            config: settings,
            uids: unreadEmails.map(e => e.uid),
            operation: 'add',
            flags: ['\\Seen'],
            path: currentFolder
        });

        // Invalidate cache
        const cacheKey = `${currentUser.id}_${currentFolder}_${page}`;
        delete emailCache[cacheKey];
    };

    const createFolder = async () => {
        if (!newFolderName.trim()) return;

        const { error } = await callEmailServer('folders', {
            config: settings,
            action: 'create',
            path: newFolderName.trim()
        });

        if (error) {
            showToast('Erro ao criar pasta: ' + error.message, 'error');
        } else {
            showToast('Pasta criada com sucesso!', 'success');
            setShowFolderModal(false);
            setNewFolderName('');
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
                showToast("Aviso: As pastas não carregaram. O servidor de e-mail parece desatualizado. Por favor, reinicie o backend (server).", "warning");
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

        if (error) {
            showToast('Erro ao criar tag: ' + error.message, 'error');
        } else if (data) {
            setAvailableTags(prev => [...prev, data[0]]);
            setNewTagLabel('');
            // Optional: Close modal if intended, but keeping open for multiple adds
        }
    };

    const deleteTag = async (tagId: string) => {
        openConfirm(
            'Excluir Tag',
            'Tem certeza que deseja excluir esta tag?',
            async () => {
                closeConfirm();
                const { error } = await supabase.from('email_tags').delete().eq('id', tagId);
                if (error) {
                    showToast('Erro ao excluir tag: ' + error.message, 'error');
                } else {
                    setAvailableTags(prev => prev.filter(t => t.id !== tagId));
                    showToast('Tag excluída com sucesso.', 'success');
                }
            },
            'danger'
        );
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
            showToast('Erro ao mover e-mail: ' + err.message, 'error');
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
        const trashFolder = folders.find((f: any) => f.specialUse === '\\Trash' || f.path.toLowerCase().includes('trash') || f.path.toLowerCase().includes('lixeira'))?.path || 'INBOX.Trash';

        openConfirm(
            'Lixeira',
            'Tem certeza que deseja mover este e-mail para a lixeira?',
            async () => {
                closeConfirm();
                await moveEmail([email.uid], trashFolder);
                if (selectedEmail?.uid === email.uid) {
                    setView('inbox');
                    setSelectedEmail(null);
                }
            },
            'danger'
        );
    };

    const deleteSelectedEmails = async () => {
        if (selectedEmailUids.length === 0) return;
        const trashFolder = folders.find((f: any) => f.specialUse === '\\Trash' || f.path.toLowerCase().includes('trash') || f.path.toLowerCase().includes('lixeira'))?.path || 'INBOX.Trash';

        openConfirm(
            'Excluir Selecionados',
            `Deseja mover ${selectedEmailUids.length} e-mails para a lixeira?`,
            async () => {
                closeConfirm();
                await moveEmail(selectedEmailUids, trashFolder);
                setSelectedEmailUids([]);
                if (selectedEmail && selectedEmailUids.includes(selectedEmail.uid)) {
                    setView('inbox');
                    setSelectedEmail(null);
                }
                showToast(`${selectedEmailUids.length} e-mails movidos para a lixeira.`, 'success');
                // Força atualização da lista em background para refletir a nova listagem do Server bypassando o cache otimista local
                fetchEmails(true, true);
            },
            'danger'
        );
    };

    const toggleEmailSelection = (uid: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSelectedEmailUids(prev =>
            prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
        );
    };

    const toggleSelectAll = () => {
        if (selectedEmailUids.length === filteredEmails.length) {
            setSelectedEmailUids([]);
        } else {
            setSelectedEmailUids(filteredEmails.map(e => e.uid));
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
            if (!isBackground) showToast(`Erro ao buscar e-mails: ${err.message || "Verifique as configurações."}`, "error");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };


    // Refresh when page or folder changes
    useEffect(() => {
        if (savedImapUser) fetchEmails();
    }, [page, pageSize, currentFolder]);

    const handleAddRecipientTag = (type: 'to' | 'cc' | 'bcc', value: string) => {
        const email = value.trim().replace(/[,;]$/, ''); // Remove trailing comma or semicolon
        if (!email || !email.includes('@')) return;
        if (type === 'to') {
            if (!toTags.includes(email)) setToTags([...toTags, email]);
            setComposeTo('');
        } else if (type === 'cc') {
            if (!ccTags.includes(email)) setCcTags([...ccTags, email]);
            setComposeCc('');
        } else if (type === 'bcc') {
            if (!bccTags.includes(email)) setBccTags([...bccTags, email]);
            setComposeBcc('');
        }
    };

    const removeRecipientTag = (type: 'to' | 'cc' | 'bcc', email: string) => {
        if (type === 'to') setToTags(toTags.filter(t => t !== email));
        else if (type === 'cc') setCcTags(ccTags.filter(t => t !== email));
        else if (type === 'bcc') setBccTags(bccTags.filter(t => t !== email));
    };

    const saveDraft = async (showNotification = true) => {
        setLoading(true);
        console.log("[EmailPage] Saving draft payload:", {
            to: toTags.join(', '),
            subject: composeSubject,
            html_len: composeBody.length
        });

        try {
            const { data, error } = await callEmailServer('save-draft', {
                config: settings,
                payload: {
                    to: toTags.join(', '),
                    subject: composeSubject,
                    text: composeBody.replace(/<[^>]*>?/gm, ''),
                    html: composeBody
                }
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            if (showNotification) showToast('Rascunho salvo com sucesso!', 'success');
        } catch (err: any) {
            console.error("Save Draft Error:", err);
            if (showNotification) showToast('Erro ao salvar rascunho: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const sendEmail = async () => {
        setLoading(true);
        try {
            const finalTo = toTags.join(', ');
            const finalCc = ccTags.join(', ');
            const finalBcc = bccTags.join(', ');

            // Validation: prevent sending empty body
            const plainBody = composeBody.replace(/<[^>]*>/g, '').trim();
            if (!plainBody && !composeSubject.trim()) {
                showToast('O assunto ou o corpo do e-mail deve ser preenchido.', 'error');
                setLoading(false);
                return;
            }

            console.log("[EmailPage] Sending email payload:", {
                to: finalTo,
                subject: composeSubject,
                html_len: composeBody.length,
                attachments: attachments.length
            });

            const { data, error } = await callEmailServer('send', {
                config: settings,
                payload: {
                    to: finalTo,
                    cc: finalCc,
                    bcc: finalBcc,
                    replyTo: composeReplyTo,
                    subject: composeSubject,
                    text: composeBody.replace(/<[^>]*>?/gm, ''), // Plain text version
                    html: composeBody,
                    attachments: attachments // Send attachments
                },
                user_id: currentUser.id
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            showToast('E-mail enviado com sucesso!', 'success');
            setComposeTo('');
            setComposeCc('');
            setComposeBcc('');
            setComposeReplyTo('');
            setComposeSubject('');
            setComposeBody(`<br/><br/>${settings.signature || ''}`);
            setAttachments([]); // Reset attachments
            setToTags([]);
            setCcTags([]);
            setBccTags([]);
            setView('inbox');
        } catch (err: any) {
            console.error("Send Email Error:", err);
            if (err.message?.includes('413')) {
                showToast('Erro: O e-mail é muito grande (imagens ou anexos). Tente reduzir o tamanho.', 'error');
            } else {
                showToast('Erro ao enviar o e-mail: Verifique se as configurações de SMTP estão corretas.', 'error');
            }
            showToast('Sua mensagem está sendo salva em Rascunhos para segurança.', 'info');

            // Backup save as draft
            saveDraft(false).catch(() => { });
        } finally {
            setLoading(false);
        }
    };

    // --- Contacts & Folders Helpers ---

    const getFolderName = (path: string) => {
        if (path === 'INBOX') return t('sidebar.inbox') || 'Caixa de Entrada';

        // Remove prefix like 'INBOX.' or 'INBOX/'
        let cleanPath = path.replace(/^INBOX[\./]/i, '');

        // Standard translation mapping
        const folderTranslations: Record<string, string> = {
            'Sent': t('email.sent_folder') || 'Enviados',
            'Sent Messages': t('email.sent_folder') || 'Enviados',
            'Drafts': t('email.drafts_folder') || 'Rascunhos',
            'Trash': t('email.trash_folder') || 'Lixeira',
            'Deleted Items': t('email.trash_folder') || 'Lixeira',
            'Junk': t('email.spam') || 'Spam',
            'Spam': t('email.spam') || 'Spam',
            'Archive': t('email.archive_folder') || 'Arquivo',
            'Outbox': t('email.outbox_folder') || 'Caixa de Saída'
        };

        const parts = cleanPath.split(/[\./]/);
        const lastPart = parts[parts.length - 1];

        return folderTranslations[lastPart] || lastPart || path;
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

        if (error) {
            showToast('Erro ao salvar contato: ' + error.message, 'error');
        } else if (data) {
            setContacts(prev => [...prev, data[0]].sort((a, b) => a.name.localeCompare(b.name)));
            setNewContactName('');
            setNewContactEmail('');
            showToast('Contato salvo com sucesso!', 'success');
        }
    };

    const deleteContact = async (id: string) => {
        openConfirm(
            'Excluir Contato',
            'Tem certeza que deseja excluir este contato?',
            async () => {
                closeConfirm();
                const { error } = await supabase.from('email_contacts').delete().eq('id', id);
                if (error) {
                    showToast('Erro ao excluir contato: ' + error.message, 'error');
                } else {
                    setContacts(prev => prev.filter(c => c.id !== id));
                    showToast('Contato excluído!', 'success');
                }
            },
            'danger'
        );
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
        <div className="flex bg-white/70 dark:bg-[#020617]/40 backdrop-blur-xl h-[calc(100vh-6rem)] rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-white/5 transition-all duration-500">
            {/* --- Left Sidebar (Folders) --- */}
            <div className={`w-64 bg-white dark:bg-slate-900 md:bg-gray-50/50 md:dark:bg-transparent border-r border-gray-100 dark:border-white/5 flex flex-col transition-all duration-500 absolute z-30 h-full md:relative ${sidebarOpen && !(view === 'read' && isFullScreen) ? 'translate-x-0 ml-0' : '-translate-x-full md:translate-x-0 -ml-64 md:ml-0'} ${(view === 'read' && isFullScreen) ? 'md:-ml-64' : ''}`}>
                <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                    <h2 className="font-bold text-gray-900 dark:text-white tracking-tight uppercase text-sm opacity-80">PandaMail</h2>
                    <button onClick={() => setView('settings')} className="text-gray-400 hover:text-brand-primary">
                        <Cog6ToothIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    <button onClick={() => {
                        setView('compose');
                        setComposeTo('');
                        setComposeSubject('');
                        setComposeBody(`<br/><br/>${settings.signature || ''}`);
                    }} className="w-full bg-brand-primary text-white py-2 px-4 rounded-lg font-medium shadow-sm hover:bg-emerald-600 flex items-center justify-center gap-2 mb-4">
                        <PencilSquareIcon className="w-5 h-5" />
                        {t('email.write')}
                    </button>

                    <nav className="space-y-1">
                        {/* Always show INBOX first */}
                        <button
                            onClick={() => { setView('inbox'); setCurrentFolder('INBOX'); setFilterTag(null); setPage(1); }} 
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, 'INBOX')}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all duration-300 ${view === 'inbox' && currentFolder === 'INBOX' && !filterTag ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white'}`}
                        >
                            <InboxIcon className="w-5 h-5" />
                            {t('sidebar.inbox') || 'Caixa de Entrada'}
                            {unseenCount > 0 && (
                                <span className="ml-auto bg-red-500 text-white py-0.5 px-2.5 rounded-full text-[10px] font-black shadow-lg border border-white dark:border-slate-900">
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
                                        style={{ paddingLeft: `${16 + paddingLeft}px` }}
                                        className={`w-full flex items-center gap-3 py-2.5 text-sm font-bold rounded-xl transition-all ${view === 'inbox' && currentFolder === folder.path ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white'}`}
                                    >
                                        <Icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${view === 'inbox' && currentFolder === folder.path ? 'text-brand-primary' : 'text-gray-400 opacity-60'}`} />
                                        <span className="truncate">{getFolderName(folder.path)}</span>
                                    </button>
                                );
                            })}

                        <button onClick={() => setShowFolderModal(true)} className="w-full text-left px-3 py-2 text-xs text-brand-primary hover:bg-gray-100 rounded flex items-center gap-2 mt-2 font-semibold">
                            {t('email.new_folder')}
                        </button>
                    </nav>

                    <div className="pt-4 mt-4 border-t border-gray-200">
                        <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex justify-between items-center">
                            {t('email.quick_tags')}
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

                        <div className="mt-8 border-t pt-4">
                            <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex justify-between items-center">
                                Contatos
                                <button onClick={() => setShowContactsModal(true)} className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-brand-primary" title="Gerenciar Contatos">
                                    <UsersIcon className="w-3 h-3" />
                                </button>
                            </h3>
                            <button
                                onClick={() => setShowContactsModal(true)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                            >
                                <UsersIcon className="w-4 h-4 text-emerald-500" />
                                <span className="font-medium">Meus Contatos</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Middle: Email List --- */}
            {(view === 'inbox' || view === 'read') && (
                <div className={`flex flex-col min-w-0 md:max-w-md border-r border-gray-200 relative ${(view === 'read' && isFullScreen) ? 'hidden' : view === 'read' ? 'hidden md:flex' : 'flex-1 md:flex-none md:w-80'}`}>
                    {/* Toolbar for List */}
                    <div className="p-4 border-b border-gray-100 dark:border-white/5 flex flex-col gap-3 bg-white/50 dark:bg-[#020617]/60 backdrop-blur-xl z-20 sticky top-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={selectedEmailUids.length > 0 && selectedEmailUids.length === filteredEmails.length}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary cursor-pointer transition-all"
                                    title="Selecionar todos"
                                />
                                <h2 className="font-bold text-gray-900 dark:text-white truncate tracking-tight">{getFolderName(currentFolder)}</h2>
                            </div>
                            <div className="flex items-center gap-3">
                                {selectedEmailUids.length > 0 && (
                                    <button
                                        onClick={deleteSelectedEmails}
                                        className="p-1 px-2 text-red-500 hover:bg-red-50 rounded-lg flex items-center gap-1 transition-all"
                                        title="Excluir selecionados"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{selectedEmailUids.length}</span>
                                    </button>
                                )}
                                <button
                                    onClick={markAllAsRead}
                                    className="text-[10px] font-black text-brand-primary hover:text-emerald-500 uppercase tracking-widest transition-colors"
                                    title="Marcar todos como lidos"
                                >
                                    Lidos
                                </button>
                            </div>
                        </div>
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Pesquisar e-mails..."
                                className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all dark:text-white"
                            />
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto bg-gray-50/30 dark:bg-transparent p-2 space-y-1">
                        {loading && emails.length === 0 ? (
                            <div className="p-10 text-center text-gray-400">
                                <ArrowPathIcon className="w-8 h-8 mx-auto animate-spin mb-2" />
                                {t('email.loading')}
                            </div>
                        ) : filteredEmails.length === 0 ? (
                                <div className="p-10 text-center text-gray-400">{t('email.no_emails')}</div>
                        ) : (
                            filteredEmails.map(email => (
                                <div
                                    key={email.uid}
                                    onClick={() => { setSelectedEmail(email); setView('read'); fetchEmailBody(email.uid, currentFolder); }}
                                    onContextMenu={(e) => handleContextMenu(e, email)}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, email)}
                                    className={`p-4 rounded-2xl cursor-pointer transition-all duration-300 flex items-start gap-3 relative border mb-1 group ${selectedEmail?.uid === email.uid
                                        ? 'bg-brand-primary/10 border-brand-primary/30 shadow-lg shadow-brand-primary/5'
                                        : 'border-transparent hover:bg-white dark:hover:bg-white/5'} ${!(email.flags || []).includes('\\Seen') ? 'bg-emerald-50/40 dark:bg-brand-primary/10' : ''}`}
                                >
                                    <div className="flex flex-col mt-0.5" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={selectedEmailUids.includes(email.uid)}
                                            onChange={() => toggleEmailSelection(email.uid)}
                                            className="w-4 h-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary cursor-pointer transition-all transition-opacity duration-200"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                                        <div className="flex justify-between items-start">
                                            <div className={`text-sm truncate pr-2 tracking-tight ${!(email.flags || []).includes('\\Seen') ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                                                {email.from}
                                            </div>
                                            <div className="text-[10px] text-gray-400 font-medium whitespace-nowrap opacity-60">
                                                {new Date(email.date).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <div className={`text-sm line-clamp-1 tracking-tight ${!(email.flags || []).includes('\\Seen') ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'}`}>
                                            {email.subject}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 opacity-70 group-hover:opacity-100 transition-opacity">
                                            {email.snippet || t('email.no_preview')}
                                        </div>
                                        {email.metadata?.tags && (email.metadata.tags || []).length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {email.metadata.tags.map(t => (
                                                    <span key={t.label} className="text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border" style={{ borderColor: `${t.color}40`, backgroundColor: `${t.color}10`, color: t.color }}>
                                                        {t.label}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Context Menu */}
                    {contextMenu && (
                        <div
                            className="fixed bg-white dark:bg-slate-800 shadow-2xl rounded-xl border border-gray-200 dark:border-slate-700 z-[100] w-56 py-2 overflow-hidden animate-in fade-in zoom-in duration-200"
                            style={{ top: contextMenu.y, left: contextMenu.x }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800">
                                {t('email.actions')}
                            </div>

                            <button
                                onClick={() => {
                                    const isSeen = (contextMenu.email.flags || []).includes('\\Seen');
                                    toggleFlag(contextMenu.email, '\\Seen', !isSeen);
                                    closeContextMenu();
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
                            >
                                <EnvelopeIcon className="w-4 h-4 text-gray-400" />
                                {t('email.unread').split(' ')[0]} / {t('email.read')}
                            </button>

                            {/* Tags Submenu Header */}
                            <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-t dark:border-slate-700 mt-1 bg-gray-50/50 dark:bg-slate-800">
                                {t('email.add_tag')}
                            </div>
                            <div className="max-h-32 overflow-y-auto">
                                {availableTags.length > 0 ? availableTags.map(tag => (
                                    <button
                                        key={tag.id}
                                        onClick={() => { handleAddTag(contextMenu.email, tag.label, tag.color); closeContextMenu(); }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
                                    >
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }}></span>
                                        {tag.label}
                                    </button>
                                )) : (
                                        <div className="px-4 py-2 text-xs text-gray-400 italic">{t('email.no_tags')}</div>
                                )}
                            </div>

                            {/* Move to Folder Submenu */}
                            <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-t dark:border-slate-700 mt-1 bg-gray-50/50 dark:bg-slate-800">
                                {t('email.move_to')}
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                                {folders.map(f => (
                                    <button 
                                        key={f.path}
                                        disabled={f.path === currentFolder}
                                        onClick={() => { moveEmail([contextMenu.email.uid], f.path); closeContextMenu(); }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent flex items-center gap-3 transition-colors"
                                    >
                                        <FolderIcon className="w-4 h-4 text-gray-400" />
                                        <span className="truncate">{getFolderName(f.path)}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="border-t mt-1 pt-1">
                                <button onClick={() => { deleteEmail(contextMenu.email); closeContextMenu(); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors">
                                    <TrashIcon className="w-4 h-4" />
                                    {t('email.trash')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Pagination Controls */}
                    {view === 'inbox' && (
                        <div className="p-4 border-t border-gray-100 dark:border-white/5 bg-white/50 dark:bg-slate-900/20 backdrop-blur-xl flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                                {t('email.page')} {page} {t('email.of')} {Math.ceil(totalEmails / pageSize) || 1}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1 || loading}
                                    className="px-2 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50"
                                >
                                    {t('email.previous')}
                                </button>
                                <button
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={page * pageSize >= totalEmails || loading}
                                    className="px-2 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50"
                                >
                                    {t('email.next')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ... Rest of component ... */}

            {/* --- Right: Detail View OR Compose OR Settings --- */}
            <div className={`flex-1 bg-white/50 dark:bg-transparent flex flex-col overflow-hidden ${view === 'inbox' ? 'hidden md:flex' : 'flex z-20 absolute inset-0 md:static'}`}>

                {/* Mobile Header for Full Views */}
                <div className="md:hidden p-3 border-b flex items-center gap-3">
                    <button onClick={() => setView('inbox')} className="p-2 -ml-2 text-gray-600">
                        <ChevronLeftIcon className="w-6 h-6" />
                        </button>
                    <span className="font-bold text-gray-700">
                        {view === 'read' ? t('email.message') : view === 'compose' ? t('email.new_message') : t('email.settings')}
                    </span>
                    </div>

                {view === 'read' && selectedEmail ? (
                    <div className="flex-1 flex flex-col h-full overflow-hidden">
                        {/* Toolbar */}
                        <div className="p-3 border-b border-gray-100 dark:border-white/5 flex flex-wrap gap-2 items-center bg-gray-50/50 dark:bg-slate-900/40 backdrop-blur-xl sticky top-0 z-10">
                            <button onClick={() => setView('inbox')} className={`${isFullScreen ? 'flex' : 'md:hidden'} p-2 text-gray-600 hover:bg-gray-200 rounded-full transition-colors`}>
                                <ChevronLeftIcon className="w-5 h-5" />
                                {isFullScreen && <span className="text-xs font-bold ml-1">Voltar</span>}
                            </button>
                            <button onClick={() => {
                                setView('compose');
                                const from = selectedEmail.from.match(/<(.+)>/)?.[1] || selectedEmail.from;
                                setToTags([from]);
                                setCcTags([]);
                                setBccTags([]);
                                setComposeSubject('Re: ' + selectedEmail.subject);
                                setComposeBody(`<br/><br/>${settings.signature || ''}<br/><br/><blockquote style="border-left: 2px solid #ccc; padding-left: 10px; margin-left: 5px;">Em ${new Date(selectedEmail.date).toLocaleString()}, ${selectedEmail.from} escreveu:<br/>${selectedEmail.html || selectedEmail.text}</blockquote>`);
                            }} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 text-xs font-bold text-gray-700 dark:text-gray-200 transition-all">
                                <ArrowUturnLeftIcon className="w-4 h-4" /> {t('email.reply')}
                            </button>
                            <button onClick={() => {
                                setView('compose');
                                const from = selectedEmail.from.match(/<(.+)>/)?.[1] || selectedEmail.from;
                                const ccs = (selectedEmail.to || '').split(',').map(e => e.match(/<(.+)>/)?.[1] || e.trim()).filter(e => e && e !== settings.imap_user);
                                setToTags([from]);
                                setCcTags(ccs);
                                setBccTags([]);
                                setComposeSubject('Re: ' + selectedEmail.subject);
                                setComposeBody(`<br/><br/>${settings.signature || ''}<br/><br/><blockquote style="border-left: 2px solid #ccc; padding-left: 10px; margin-left: 5px;">Em ${new Date(selectedEmail.date).toLocaleString()}, ${selectedEmail.from} escreveu:<br/>${selectedEmail.html || selectedEmail.text}</blockquote>`);
                            }} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 text-xs font-bold text-gray-700 dark:text-gray-200 transition-all">
                                <UsersIcon className="w-4 h-4" /> {t('email.reply_all')}
                            </button>
                            <div className="h-6 w-px bg-gray-200 dark:bg-white/10 mx-1"></div>
                            <button onClick={() => deleteEmail(selectedEmail)} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-xl hover:bg-red-500 text-xs font-bold text-red-500 hover:text-white transition-all">
                                <TrashIcon className="w-4 h-4" /> {t('email.delete')}
                            </button>
                            <button onClick={() => {
                                // Move to Junk/Spam
                                const spamFolder = folders.find((f: any) => f.specialUse === '\\Junk' || f.path.includes('Junk') || f.path.includes('Spam'))?.path || 'Junk';
                                callEmailServer('move', { config: settings, uids: [selectedEmail.uid], path: spamFolder });
                                showToast('Movido para Spam', 'success');
                                setView('inbox');
                            }} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 text-xs font-bold text-gray-700 dark:text-gray-200 transition-all">
                                <ExclamationTriangleIcon className="w-4 h-4" /> Spam
                            </button>
                            <button onClick={() => {
                                toggleFlag(selectedEmail, '\\Seen', false);
                                setView('inbox');
                            }} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 text-xs font-bold text-gray-700 dark:text-gray-200 transition-all">
                                <EnvelopeIcon className="w-4 h-4" /> {t('email.unread')}
                            </button>
                        </div>

                        {/* Metadata */}
                        <div className="p-6 pb-2">
                            <div className="flex flex-col mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary font-bold">
                                        {selectedEmail.from.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-900 dark:text-white tracking-tight">{selectedEmail.from}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                            Para: <span className="truncate max-w-[200px]">{selectedEmail.to || 'mim'}</span>
                                            <button onClick={() => setShowDetails(!showDetails)} className="px-2 py-0.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 transition-colors rounded text-[10px] font-bold uppercase cursor-pointer">
                                                {showDetails ? 'Ocultar Detalhes' : 'Ver Detalhes'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="ml-auto text-xs font-medium text-gray-400 bg-gray-100 dark:bg-white/5 py-1 px-3 rounded-full">
                                        {new Date(selectedEmail.date).toLocaleString()}
                                    </div>
                                </div>

                                {showDetails && (
                                    <div className="mt-4 p-4 bg-gray-50 dark:bg-slate-900/40 rounded-xl border border-gray-100 dark:border-white/5 text-xs text-gray-600 dark:text-gray-300 space-y-2 relative overflow-hidden break-words">
                                        <div><strong>De:</strong> {selectedEmail.from}</div>
                                        <div><strong>Para:</strong> {selectedEmail.to || '-'}</div>
                                        <div><strong>Data:</strong> {new Date(selectedEmail.date).toString()}</div>
                                        <div><strong>Assunto:</strong> {selectedEmail.subject}</div>
                                        {selectedEmail.messageId && <div><strong>Mensagem-ID:</strong> {selectedEmail.messageId}</div>}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6 pt-0">
                            {loadingBody ? (
                                <div className="flex items-center justify-center h-40">
                                    <ArrowPathIcon className="w-8 h-8 text-gray-400 animate-spin" />
                                    <span className="ml-2 text-gray-400">{t('email.loading_content')}</span>
                                </div>
                            ) : bodyError ? (
                                <div className="flex flex-col items-center justify-center h-40 text-red-500 text-center">
                                        <ExclamationTriangleIcon className="w-8 h-8 mb-2" />
                                    <span className="text-sm font-medium">{bodyError}</span>
                                    <button
                                        onClick={() => fetchEmailBody(selectedEmail.uid, currentFolder)}
                                        className="mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 transition-colors text-xs font-bold uppercase"
                                    >
                                        Tentar Novamente
                                    </button>
                                </div>
                            ) : (
                                    <>
                                            <div className="bg-white dark:bg-gray-50 rounded-xl p-6 shadow-inner min-h-[300px] overflow-hidden">
                                                <div
                                                    className="prose max-w-none text-gray-800"
                                                    dangerouslySetInnerHTML={{
                                                        __html: DOMPurify.sanitize(selectedEmail.html || selectedEmail.text || `<div class="text-gray-400 italic">${t('email.no_content')}</div>`)
                                                    }}
                                                />
                                            </div>

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
                            <p>{t('email.select_to_read')}</p>
                    </div>
                ) : view === 'compose' ? (
                            <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
                                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                                    {/* Edit Area */}
                                    <div className="flex-1 p-6 flex flex-col space-y-4 overflow-y-auto border-r border-gray-100">
                                        <div className="space-y-2">
                                            <div className="flex flex-wrap gap-2 items-center border-b border-gray-200 py-2">
                                                {toTags.map(tag => (
                                                    <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-brand-primary/10 text-brand-primary rounded text-sm group">
                                                        {tag}
                                                        <button onClick={() => removeRecipientTag('to', tag)} className="hover:text-red-500">
                                                            <XMarkIcon className="w-3 h-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                                <div className="relative flex-1 min-w-[150px]">
                                                    <input
                                                        className="w-full bg-transparent focus:outline-none placeholder-gray-400 dark:text-white"
                                                        placeholder={toTags.length === 0 ? "Para:" : ""}
                                                        value={composeTo}
                                                        onChange={e => setComposeTo(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter' || e.key === ',') {
                                                                e.preventDefault();
                                                                handleAddRecipientTag('to', composeTo);
                                                            } else if (e.key === 'Backspace' && !composeTo && toTags.length > 0) {
                                                                removeRecipientTag('to', toTags[toTags.length - 1]);
                                                            }
                                                        }}
                                                    />
                                                    {composeTo && (
                                                        <div className="absolute left-0 top-full mt-2 w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-gray-100 dark:border-white/5 rounded-2xl shadow-2xl z-50 overflow-hidden">
                                                            {contacts.filter(c => c.email.toLowerCase().includes(composeTo.toLowerCase()) || c.name.toLowerCase().includes(composeTo.toLowerCase())).slice(0, 5).map(c => (
                                                                <button
                                                                    key={c.id}
                                                                    onClick={() => handleAddRecipientTag('to', c.email)}
                                                                    className="w-full text-left px-4 py-2 hover:bg-gray-50 flex flex-col border-b border-gray-100 last:border-0"
                                                                >
                                                                    <span className="text-sm font-medium text-gray-800">{c.name}</span>
                                                                    <span className="text-xs text-gray-500">{c.email}</span>
                                                                </button>
                                                            ))}
                                                            {!toTags.includes(composeTo) && composeTo.includes('@') && (
                                                                <button
                                                                    onClick={() => handleAddRecipientTag('to', composeTo)}
                                                                    className="w-full text-left px-4 py-2 hover:bg-emerald-50 text-brand-primary text-xs font-bold"
                                                                >
                                                                    Adicionar "{composeTo}"
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <button onClick={() => setShowContactsModal(true)} className="text-gray-400 hover:text-brand-primary" title="Contatos">
                                                    <UsersIcon className="w-5 h-5" />
                                                </button>
                                                <button onClick={() => setShowCc(!showCc)} className="text-xs text-gray-500 hover:text-brand-primary font-medium">
                                                    CC/CCO
                                                </button>
                                            </div>
                                            {showCc && (
                                                <div className="space-y-2 bg-gray-50 p-2 rounded">
                                                    {/* CC */}
                                                    <div className="flex flex-wrap gap-2 items-center border-b border-gray-200 py-1">
                                                        <span className="text-xs text-gray-400 min-w-[30px]">CC:</span>
                                                        {ccTags.map(tag => (
                                                            <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-[11px]">
                                                                {tag}
                                                                <button onClick={() => removeRecipientTag('cc', tag)} className="hover:text-red-500">
                                                                    <XMarkIcon className="w-3 h-3" />
                                                                </button>
                                                            </span>
                                                        ))}
                                                        <input
                                                            className="flex-1 min-w-[100px] bg-transparent focus:outline-none text-sm"
                                                            value={composeCc}
                                                            onChange={e => setComposeCc(e.target.value)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter' || e.key === ',') {
                                                                    e.preventDefault();
                                                                    handleAddRecipientTag('cc', composeCc);
                                                                } else if (e.key === 'Backspace' && !composeCc && ccTags.length > 0) {
                                                                    removeRecipientTag('cc', ccTags[ccTags.length - 1]);
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                    {/* BCC */}
                                                    <div className="flex flex-wrap gap-2 items-center border-b border-gray-200 py-1">
                                                        <span className="text-xs text-gray-400 min-w-[30px]">CCO:</span>
                                                        {bccTags.map(tag => (
                                                            <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-[11px]">
                                                                {tag}
                                                                <button onClick={() => removeRecipientTag('bcc', tag)} className="hover:text-red-500">
                                                                    <XMarkIcon className="w-3 h-3" />
                                                                </button>
                                                            </span>
                                                        ))}
                                                        <input
                                                            className="flex-1 min-w-[100px] bg-transparent focus:outline-none text-sm"
                                                            value={composeBcc}
                                                            onChange={e => setComposeBcc(e.target.value)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter' || e.key === ',') {
                                                                    e.preventDefault();
                                                                    handleAddRecipientTag('bcc', composeBcc);
                                                                } else if (e.key === 'Backspace' && !composeBcc && bccTags.length > 0) {
                                                                    removeRecipientTag('bcc', bccTags[bccTags.length - 1]);
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                    <input
                                                        className="w-full border-b border-gray-200 py-1 bg-transparent focus:outline-none text-sm"
                                                        placeholder="Reply-To (Opcional):"
                                                        value={composeReplyTo}
                                                        onChange={e => setComposeReplyTo(e.target.value)}
                                                    />
                                                </div>
                                            )}
                                            <input
                                                className="w-full border-b border-gray-100 dark:border-white/5 py-3 bg-transparent focus:outline-none focus:border-brand-primary font-bold text-gray-900 dark:text-white placeholder-gray-400 transition-all text-lg"
                                                placeholder={t('email.placeholder_subject')}
                                                value={composeSubject}
                                                onChange={e => setComposeSubject(e.target.value)}
                                            />
                                        </div>

                                        <div className="flex-1 border rounded-lg overflow-hidden flex flex-col min-h-[300px]">
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
                                    </div>

                                    {/* --- Attachments Sidebar --- */}
                                    <div className="w-full lg:w-80 bg-gray-50 p-6 flex flex-col overflow-y-auto shrink-0 border-l border-gray-100">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400">Anexos</h3>
                                            <span className="text-[10px] bg-gray-200 px-2 py-0.5 rounded text-gray-500 font-bold">LIMITE 20MB</span>
                                        </div>

                                        <button
                                            className="w-full flex flex-col items-center justify-center gap-2 bg-white border-2 border-dashed border-gray-200 hover:border-brand-primary hover:bg-emerald-50 text-gray-400 hover:text-brand-primary p-8 rounded-2xl transition-all group shadow-sm"
                                            onClick={() => document.getElementById('file-upload')?.click()}
                                        >
                                            <input id="file-upload" type="file" multiple className="hidden" onChange={handleFileChange} />
                                            <div className="p-3 bg-gray-50 rounded-full group-hover:bg-brand-primary/10 transition-colors">
                                                <PaperClipIcon className="w-6 h-6" />
                                            </div>
                                            <span className="text-sm font-bold">Anexar Arquivo</span>
                                            <span className="text-[10px] text-gray-400">Clique ou arraste</span>
                                        </button>

                                        {/* Attachment List */}
                                        {attachments.length > 0 && (
                                            <div className="space-y-3 mt-8">
                                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-2">Arquivos Carregados ({attachments.length})</div>
                                                {attachments.map((file, idx) => (
                                                    <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="bg-brand-primary/10 p-2 rounded-lg">
                                                                <PaperClipIcon className="w-4 h-4 text-brand-primary" />
                                                            </div>
                                                            <div className="truncate pr-2">
                                                                <div className="text-xs font-bold text-gray-700 truncate">{file.filename}</div>
                                                                <div className="text-[10px] font-medium text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => removeAttachment(idx)}
                                                            className="p-1.5 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-lg transition-all"
                                                            title="Remover"
                                                        >
                                                            <XMarkIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {!attachments.length && (
                                            <div className="mt-8 flex flex-col items-center justify-center text-center opacity-30 select-none">
                                                <div className="w-16 h-16 bg-gray-200 rounded-full mb-4 flex items-center justify-center">
                                                    <ArrowDownTrayIcon className="w-8 h-8 text-gray-400" />
                                                </div>
                                                <p className="text-xs font-medium text-gray-600">Nenhum arquivo<br />adicionado ainda</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="p-4 border-t bg-gray-50 flex justify-between items-center shrink-0">
                                    <span className="text-xs text-gray-400 ml-1">
                                        {settings.signature ? t('email.signature_warning') : t('email.no_signature')}
                                    </span>
                                    <div className="flex gap-2">
                                        <button onClick={() => setView('inbox')} className="px-4 py-2 text-gray-400 hover:text-gray-600 rounded-md font-bold text-sm transition-colors">{t('generic.cancel')}</button>
                                        <button
                                            onClick={() => saveDraft()}
                                            disabled={loading}
                                            className="px-4 py-2 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-white/10 transition-all flex items-center gap-2 border border-gray-100 dark:border-white/5"
                                        >
                                            <PencilSquareIcon className="w-4 h-4" />
                                            Salvar rascunho
                                        </button>
                                        <button
                                            onClick={sendEmail}
                                            disabled={loading}
                                            className="px-8 py-2.5 bg-brand-primary text-white rounded-xl font-bold hover:bg-emerald-600 shadow-lg hover:shadow-emerald-200 active:scale-95 transition-all flex items-center gap-2"
                                        >
                                            <PaperAirplaneIcon className="w-4 h-4" />
                                            {loading ? t('email.sending') : t('email.send')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : view === 'settings' ? (
                            <div className="flex-1 p-8 overflow-y-auto">
                                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">{t('email.settings_title')}</h2>

                                    <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                                        <div className="bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl p-8 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl">
                                            <h3 className="font-bold text-gray-900 dark:text-white mb-6 text-xl tracking-tight">{t('email.incoming_server')}</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">{t('email.host_imap')}</label>
                                                    <input value={settings.imap_host} onChange={e => setSettings(s => ({ ...s, imap_host: e.target.value }))} className="w-full mt-2 bg-gray-100 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all dark:text-white" placeholder="imap.gmail.com" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">{t('email.port')}</label>
                                                    <input type="number" value={settings.imap_port} onChange={e => setSettings(s => ({ ...s, imap_port: parseInt(e.target.value) }))} className="w-full mt-2 bg-gray-100 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all dark:text-white" placeholder="993" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">{t('email.user')}</label>
                                                    <input value={settings.imap_user} onChange={e => setSettings(s => ({ ...s, imap_user: e.target.value, smtp_user: e.target.value }))} className="w-full mt-2 bg-gray-100 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all dark:text-white" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-gray-500 uppercase">{t('email.pass')}</label>
                                                    <div className="relative mt-1">
                                                        <input type={showEmailPass ? 'text' : 'password'} value={settings.imap_pass} onChange={e => setSettings(s => ({ ...s, imap_pass: e.target.value, smtp_pass: e.target.value }))} className="w-full mt-2 bg-gray-100 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all dark:text-white pr-10" />
                                                        <button type="button" onClick={() => setShowEmailPass(p => !p)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600">
                                                            {showEmailPass ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input type="checkbox" checked={settings.imap_ssl} onChange={e => setSettings(s => ({ ...s, imap_ssl: e.target.checked }))} />
                                                    <label className="text-sm">{t('email.use_ssl')}</label>
                                                </div>
                                            </div>

                                            <h3 className="font-semibold text-gray-700 mb-4 mt-6">{t('email.outgoing_server')}</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs font-bold text-gray-500 uppercase">{t('email.host_smtp')}</label>
                                                    <input value={settings.smtp_host} onChange={e => setSettings(s => ({ ...s, smtp_host: e.target.value }))} className="w-full mt-1 border rounded p-2" placeholder="smtp.gmail.com" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-gray-500 uppercase">{t('email.port')}</label>
                                                    <input type="number" value={settings.smtp_port} onChange={e => setSettings(s => ({ ...s, smtp_port: parseInt(e.target.value) }))} className="w-full mt-1 border rounded p-2" placeholder="465" />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input type="checkbox" checked={settings.smtp_ssl} onChange={e => setSettings(s => ({ ...s, smtp_ssl: e.target.checked }))} />
                                                    <label className="text-sm">{t('email.use_ssl')}</label>
                                                </div>
                                            </div>

                                            <h3 className="font-semibold text-gray-700 mb-4 mt-6">Preferências de Visualização</h3>
                                            <div className="bg-white p-4 rounded border border-gray-200 flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm font-bold text-gray-700">Abrir e-mail em tela cheia</div>
                                                    <div className="text-xs text-gray-500">Esconde a lista de e-mails ao abrir uma mensagem.</div>
                                                </div>
                                                <button
                                                    onClick={() => setIsFullScreen(!isFullScreen)}
                                                    className={`w-12 h-6 rounded-full transition-colors relative ${isFullScreen ? 'bg-brand-primary' : 'bg-gray-300'}`}
                                                >
                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isFullScreen ? 'left-7' : 'left-1'}`} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Signature Editor */}
                                        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                            <h3 className="font-semibold text-gray-700 mb-4">{t('email.signature_title')}</h3>
                                            <p className="text-sm text-gray-500 mb-2">{t('email.signature_desc')}</p>
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
                                            <button onClick={() => setView('inbox')} className="px-4 py-2 text-gray-600">{t('generic.cancel')}</button>
                                            <button onClick={saveSettings} className="px-6 py-2 bg-brand-primary text-white rounded font-medium shadow">{t('email.save_settings')}</button>
                                        </div>
                                    </div>
                    </div>
                ) : null}
            </div>

            {/* --- Create Folder Modal --- */}
            {showFolderModal && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[110] backdrop-blur-xl">
                    <div className="bg-white/90 dark:bg-slate-900/90 rounded-3xl p-4 sm:p-8 w-[calc(100vw-2rem)] sm:w-[450px] max-w-full shadow-2xl border border-gray-100 dark:border-white/5 transform transition-all animate-scale-in">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                                <FolderIcon className="w-5 h-5" />
                            </div>
                            <h3 className="text-xl font-bold font-brand text-gray-900">Nova Pasta</h3>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Pasta</label>
                                <input
                                    type="text"
                                    autoFocus
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:border-brand-primary focus:ring-brand-primary p-2 border"
                                    placeholder="Ex: Projetos Importantes"
                                    value={newFolderName}
                                    onChange={e => setNewFolderName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && createFolder()}
                                />
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-3">
                            <button
                                onClick={() => { setShowFolderModal(false); setNewFolderName(''); }}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={createFolder}
                                disabled={!newFolderName.trim()}
                                className="px-6 py-2 bg-brand-primary text-white rounded-xl shadow hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-brand-primary font-bold transition-colors"
                            >
                                Criar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Tag Management Modal --- */}
            {showTagModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
                        <h3 className="text-lg font-bold mb-4">{t('email.manage_tags')}</h3>

                        <div className="flex gap-2 mb-4">
                            <input
                                className="flex-1 border rounded px-2"
                                placeholder={t('email.new_tag')}
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
                            <button onClick={() => setShowTagModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">{t('email.close')}</button>
                        </div>
                    </div>
                </div>
            )}
            {/* --- Contacts Modal --- */}
            {showContactsModal && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
                        {/* Header */}
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50/80">
                            <div className="flex items-center gap-2">
                                <UsersIcon className="w-5 h-5 text-brand-primary" />
                                <h3 className="font-bold text-gray-800 text-lg">Diretório de Contatos</h3>
                            </div>
                            <button onClick={() => setShowContactsModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                <XMarkIcon className="w-6 h-6 text-gray-500" />
                            </button>
                        </div>

                        {/* Add New Contact Form */}
                        <div className="p-4 bg-emerald-50/50 border-b border-emerald-100">
                            <h4 className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-3">Novo Contato</h4>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <div className="flex-1">
                                    <input
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all"
                                        placeholder="Nome"
                                        value={newContactName}
                                        onChange={e => setNewContactName(e.target.value)}
                                    />
                                </div>
                                <div className="flex-1">
                                    <input
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all"
                                        placeholder="Email"
                                        value={newContactEmail}
                                        onChange={e => setNewContactEmail(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={addContact}
                                    disabled={!newContactEmail}
                                    className="bg-brand-primary text-white p-2 rounded-lg hover:bg-emerald-600 disabled:opacity-50 shadow-md flex items-center justify-center min-w-[44px]"
                                    title="Salvar Contato"
                                >
                                    <UserPlusIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Contacts List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
                            {contacts.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                    <UsersIcon className="w-12 h-12 mb-2 opacity-20" />
                                    <p className="text-sm font-medium">Nenhum contato encontrado</p>
                                </div>
                            ) : (
                                contacts.map(contact => (
                                    <div key={contact.id} className="flex items-center gap-3 p-3 hover:bg-emerald-50 rounded-xl border border-gray-100 hover:border-emerald-200 transition-all group">
                                        <div className="w-10 h-10 rounded-full bg-brand-primary text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-sm">
                                            {contact.name?.substring(0, 1).toUpperCase() || '?'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-gray-800 truncate">{contact.name}</div>
                                            <div className="text-sm text-gray-500 truncate">{contact.email}</div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => {
                                                    handleAddRecipientTag('to', contact.email);
                                                    setShowContactsModal(false);
                                                }}
                                                className="bg-emerald-100 text-brand-primary px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-brand-primary hover:text-white transition-colors flex items-center gap-1"
                                            >
                                                <EnvelopeIcon className="w-3 h-3" />
                                                Escrever
                                            </button>
                                            <button onClick={() => deleteContact(contact.id)} className="p-1.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmState.isOpen}
                title={confirmState.title}
                message={confirmState.message}
                onConfirm={confirmState.onConfirm}
                onCancel={closeConfirm}
                type={confirmState.type}
            />
        </div>
    );
};

export default EmailPage;
