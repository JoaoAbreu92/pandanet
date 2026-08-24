import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from './LanguageContext';
import { useNotifications } from './NotificationContext';
import { useAuth } from './AuthContext';
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
    PaperClipIcon, ArrowDownTrayIcon,
    Bars3Icon, ChevronDownIcon, ChevronRightIcon, CheckIcon,
    UserGroupIcon
} from '@heroicons/react/24/outline'; // Assuming you have these or similar icons from your icon set
import { useToast } from './ToastContext';
import ConfirmModal from './ui/ConfirmModal';

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
    cc?: string;
    to_full?: { address: string; name: string }[];
    cc_full?: { address: string; name: string }[];
    subject: string;
    date: string;
    html?: string;
    text?: string;
    flags: string[];
    metadata?: EmailMetadata; // Expanded locally
    attachments?: Array<{ id: number; filename: string; contentType: string; size: number }>;
    snippet?: string;
    folder?: string;
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

const EmailPage: React.FC<{ currentUser: any, pageContext?: any }> = ({ currentUser, pageContext }) => {
    const { t, language } = useLanguage();
    const { showToast } = useToast();
    const { setModuleUnreadCount, notifications, markAsRead, markNotificationsByLink } = useNotifications();
    const { isGhostMode } = useAuth();

    const canManageAccounts = currentUser?.email_permissions?.can_manage_accounts || 
                            currentUser?.isAdmin || 
                            currentUser?.isCompanyAdmin || 
                            currentUser?.email === 'ti@grupopixel.com.br';

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
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768); // Auto-hide on mobile
    const [isFullScreen, setIsFullScreen] = useState(false); // New Full Screen Mode

    // --- State: View Preferences ---
    const [openMode, setOpenMode] = useState<'split' | 'modal' | 'window'>(() => {
        return (localStorage.getItem('pandamail_open_mode') as 'split' | 'modal' | 'window') || 'split';
    });
    const [previewMode, setPreviewMode] = useState<'full' | 'sender_subject' | 'sender'>(() => {
        return (localStorage.getItem('pandamail_preview_mode') as 'full' | 'sender_subject' | 'sender') || 'full';
    });
    const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'from_asc' | 'from_desc'>(() => {
        return (localStorage.getItem('pandamail_sort_by') as any) || 'date_desc';
    });
    const [filterDateRange, setFilterDateRange] = useState<'all' | '24h' | 'week' | 'month'>('all');

    // --- State: Dragging for window mode ---
    const [windowPosition, setWindowPosition] = useState({ x: 100, y: 80 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const positionStart = useRef({ x: 0, y: 0 });

    const handleWindowMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.window-title-bar')) {
            setIsDragging(true);
            dragStart.current = { x: e.clientX, y: e.clientY };
            positionStart.current = { x: windowPosition.x, y: windowPosition.y };
            e.preventDefault();
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            const dx = e.clientX - dragStart.current.x;
            const dy = e.clientY - dragStart.current.y;
            setWindowPosition({
                x: positionStart.current.x + dx,
                y: positionStart.current.y + dy
            });
        };
        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

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
    const [isSending, setIsSending] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    // Tracks the saved imap_user (from DB), NOT the form input — prevents fetchEmails from firing on every keystroke
    const [savedImapUser, setSavedImapUser] = useState('');
    const [showEmailPass, setShowEmailPass] = useState(false);
    const [loadingBody, setLoadingBody] = useState(false);
    const [bodyError, setBodyError] = useState<string | null>(null);

    // --- State: Multi-Account ---
    const [accounts, setAccounts] = useState<any[]>([]);
    const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
    const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
    const [accountUnseenCounts, setAccountUnseenCounts] = useState<Record<string, number>>({});

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

    const getCacheKey = (folderName: string, pageNum: number, configOverride?: EmailSettings) => {
        const activeConfig = configOverride || settings;
        const imapUser = activeConfig?.imap_user || 'no_user';
        const currentUserId = currentUser?.id || 'unknown';
        return `${currentUserId}_${imapUser}_${folderName}_${pageNum}`;
    };
    const [pageSize, setPageSize] = useState(10); // User requested 10
    const [totalEmails, setTotalEmails] = useState(0);
    const [unseenCount, setUnseenCount] = useState(0);
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [filterTag, setFilterTag] = useState<string | null>(null);

    const fetchInProgress = useRef(false);

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
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
    const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>({});
    const [showContactsModal, setShowContactsModal] = useState(false);
    const [newContactName, setNewContactName] = useState('');
    const [newContactEmail, setNewContactEmail] = useState('');
    const [attachments, setAttachments] = useState<any[]>([]);
    const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024; // 20MB

    // --- State: Contact Groups ---
    interface ContactGroup { id: string; name: string; description?: string; }
    interface ContactGroupMember { id: string; group_id: string; contact_name: string; contact_email: string; }
    const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
    const [showGroupsModal, setShowGroupsModal] = useState(false);
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDesc, setNewGroupDesc] = useState('');
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [groupMembers, setGroupMembers] = useState<ContactGroupMember[]>([]);
    const [groupMemberSearch, setGroupMemberSearch] = useState('');
    const [addMemberEmail, setAddMemberEmail] = useState('');
    const [addMemberName, setAddMemberName] = useState('');

    // --- Refs ---
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    // --- State: Context Menu ---
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, email: EmailMessage } | null>(null);
    const [accountContextMenu, setAccountContextMenu] = useState<{ x: number, y: number, account: any } | null>(null);
    const [disabledNotifications, setDisabledNotifications] = useState<Set<string>>(new Set());
    const [selectedEmailUids, setSelectedEmailUids] = useState<string[]>([]);
    const [locallySeenUids, setLocallySeenUids] = useState<Set<string>>(new Set());

    // --- Actions: Context Menu ---
    const handleContextMenu = (e: React.MouseEvent, email: EmailMessage) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, email });
    };

    const closeContextMenu = () => {
        setContextMenu(null);
    };

    const handleAccountContextMenu = (e: React.MouseEvent, account: any) => {
        e.preventDefault();
        setAccountContextMenu({ x: e.clientX, y: e.clientY, account });
    };

    const toggleNotificationForAccount = (accountId: string) => {
        setDisabledNotifications(prev => {
            const next = new Set(prev);
            if (next.has(accountId)) {
                next.delete(accountId);
            } else {
                next.add(accountId);
            }
            if (currentUser?.id) {
                localStorage.setItem(`panda_email_disabled_notifications_${currentUser.id}`, JSON.stringify(Array.from(next)));
            }
            return next;
        });
        showToast("Preferência de notificação atualizada.", "success");
        setAccountContextMenu(null);
    };

    // --- Persistence (localStorage) ---
    useEffect(() => {
        const savedView = localStorage.getItem(`panda_email_view_${currentUser.id}`);
        const savedFolder = localStorage.getItem(`panda_email_folder_${currentUser.id}`);
        const savedSelected = localStorage.getItem(`panda_email_selected_${currentUser.id}`);
        const savedLocallySeen = localStorage.getItem(`panda_email_seen_${currentUser.id}`);

        // Nunca restaurar a view de compose — sempre começar da inbox
        if (savedView && savedView !== 'compose') setView(savedView as any);
        if (savedFolder) setCurrentFolder(savedFolder);
        if (savedLocallySeen) {
            try {
                const seenArray = JSON.parse(savedLocallySeen);
                setLocallySeenUids(new Set(seenArray));
            } catch (e) { console.error("Error parsing saved seen UIDs", e); }
        }
        if (savedSelected) {
            try {
                const email = JSON.parse(savedSelected);
                setSelectedEmail(email);
            } catch (e) { console.error("Error parsing saved selected email", e); }
        }
    }, [currentUser.id]);

    // Carregar notificações desabilitadas do localStorage e registrar listener de clique global
    useEffect(() => {
        if (!currentUser?.id) return;
        
        const saved = localStorage.getItem(`panda_email_disabled_notifications_${currentUser.id}`);
        if (saved) {
            try {
                setDisabledNotifications(new Set(JSON.parse(saved)));
            } catch (e) {
                console.error("Error parsing disabled notifications", e);
            }
        }

        const handleGlobalClick = () => {
            setContextMenu(null);
            setAccountContextMenu(null);
        };
        document.addEventListener('click', handleGlobalClick);
        return () => {
            document.removeEventListener('click', handleGlobalClick);
        };
    }, [currentUser?.id]);

    // Fetch body for restored email only after settings are loaded
    useEffect(() => {
        if (savedImapUser && view === 'read' && selectedEmail && !selectedEmail.html && !selectedEmail.text) {
            fetchEmailBody(selectedEmail.uid, selectedEmail.folder || currentFolder || 'INBOX');
        }
    }, [savedImapUser, view, selectedEmail]);

    const refreshAllAccountBadges = async () => {
        if (!accounts || accounts.length === 0) return;
        
        console.log("[EmailPage] Refreshing all account badges...");
        const newCounts: Record<string, number> = {};
        
        // Use Promise.all to fetch counts in parallel
        await Promise.all(accounts.map(async (acc) => {
            try {
                const { data } = await callEmailServer('status', {
                    config: acc,
                    folder: 'INBOX'
                });
                if (data && typeof data.unseen === 'number') {
                    newCounts[acc.id] = data.unseen;
                }
            } catch (err) {
                console.error(`[EmailPage] Error fetching status for account ${acc.imap_user}:`, err);
            }
        }));
        
        setAccountUnseenCounts(newCounts);
        
        // Also update main unseenCount if the active account is among them
        if (activeAccountId && newCounts[activeAccountId] !== undefined) {
            setUnseenCount(newCounts[activeAccountId]);
        }
    };

    // --- Polling and Refresh ---
    useEffect(() => {
        // Initial badge refresh
        if (accounts.length > 0) refreshAllAccountBadges();

        const badgeInterval = setInterval(refreshAllAccountBadges, 60000); // Every minute
        const activeAccountInterval = setInterval(() => {
            if (activeAccountId && view === 'inbox' && !loading) {
                fetchEmails(false);
            }
        }, 30000); // Every 30s for active account

        return () => {
            clearInterval(badgeInterval);
            clearInterval(activeAccountInterval);
        };
    }, [accounts.length, activeAccountId, view]);

    useEffect(() => {
        if (!currentUser?.id) return;
        localStorage.setItem(`panda_email_view_${currentUser.id}`, view);
        localStorage.setItem(`panda_email_folder_${currentUser.id}`, currentFolder);
        if (selectedEmail) {
            localStorage.setItem(`panda_email_selected_${currentUser.id}`, JSON.stringify(selectedEmail));
        } else {
            localStorage.removeItem(`panda_email_selected_${currentUser.id}`);
        }
    }, [view, currentFolder, selectedEmail, currentUser.id]);

    useEffect(() => {
        if (!currentUser?.id) return;
        localStorage.setItem(`panda_email_seen_${currentUser.id}`, JSON.stringify(Array.from(locallySeenUids)));
    }, [locallySeenUids, currentUser.id]);

    // Sincroniza o contador local de não lidos com o badge global do Sidebar
    useEffect(() => {
        setModuleUnreadCount('email', unseenCount);
    }, [unseenCount, setModuleUnreadCount]);

    // Close sidebar on mobile when view changes to a subview (settings, compose, read)
    useEffect(() => {
        if (window.innerWidth < 768 && (view === 'settings' || view === 'compose' || view === 'read')) {
            setSidebarOpen(false);
        }
    }, [view]);

    // --- Effects ---

    useEffect(() => {
        const initialize = async () => {
            await fetchAccounts();
        };
        initialize();
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [currentUser]);

    // Load settings when active account changes
    useEffect(() => {
        if (activeAccountId) {
            const activeAccount = accounts.find(a => a.id === activeAccountId);
            if (activeAccount) {
                const config: EmailSettings = {
                    imap_host: activeAccount.imap_host,
                    imap_port: activeAccount.imap_port,
                    imap_user: activeAccount.imap_user,
                    imap_pass: activeAccount.imap_pass,
                    imap_ssl: activeAccount.imap_ssl ?? true,
                    smtp_host: activeAccount.smtp_host,
                    smtp_port: activeAccount.smtp_port,
                    smtp_user: activeAccount.smtp_user,
                    smtp_pass: activeAccount.smtp_pass,
                    smtp_ssl: activeAccount.smtp_ssl ?? true,
                    signature: activeAccount.signature || ''
                };
                setSettings(config);
                setSavedImapUser(activeAccount.imap_user || '');
                // Clear state for new account
                setEmails([]);
                setTotalEmails(0);
                setUnseenCount(0);
                setFolders([]);
                setPage(1);

                // Fetch folders and emails directly using this active config to avoid race conditions or stale state
                fetchFolders(config);
                fetchEmails(false, false, config, activeAccountId);
            }
        }
    }, [activeAccountId, accounts]);

    // Auto-load emails when settings are ready (fixes "Refresh Required" bug)
    // Uses savedImapUser (set only by loadSettings) to avoid triggering on every keystroke in the settings form
    useEffect(() => {
        if (savedImapUser) {
            // Poll every 2 minutes
            // @ts-ignore
            if (pollingRef.current) clearInterval(pollingRef.current);
            // @ts-ignore - Bypass Deno vs Browser typing on setInterval
            pollingRef.current = setInterval(() => fetchEmails(true), 120000);
            fetchTags();    // Load tags once
            fetchContacts(); // Load contacts once
            fetchContactGroups(); // Load contact groups
        }
    }, [savedImapUser]); // Only fires when settings are loaded from DB, not when user types

    // --- Actions ---

    const fetchAccounts = async () => {
        if (!currentUser?.company_id) return;
        
        let query = supabase.from('email_settings').select('*').eq('company_id', currentUser.company_id);
        
        const perms = currentUser.email_permissions;
        const isSuperOrMaster = currentUser.role === 'Super Admin' || currentUser.email === 'ti@grupopixel.com.br';
        const canViewAll = isSuperOrMaster || perms?.can_view_all_accounts === true;
        
        if (!canViewAll) {
            if (perms?.allowed_accounts && perms.allowed_accounts.length > 0) {
                query = query.or(`user_id.eq.${currentUser.id},id.in.(${perms.allowed_accounts.join(',')})`);
            } else {
                query = query.eq('user_id', currentUser.id);
            }
        }

        const { data, error } = await query;
        
        if (data && !error) {
            setAccounts(data);
            if (data.length > 0) {
                // Prioridade para a conta da notificação, depois localStorage, depois primeira conta
                const lastAccountId = localStorage.getItem(`panda_active_email_account_${currentUser.id}`);
                let targetAccountId = (pageContext?.accountId && data.find(a => a.id === pageContext.accountId))
                    ? pageContext.accountId
                    : (lastAccountId && data.find(a => a.id === lastAccountId) ? lastAccountId : data[0].id);

                if (targetAccountId === 'undefined' || targetAccountId === 'null') {
                    targetAccountId = data[0]?.id || null;
                }

                setActiveAccountId(targetAccountId);
                setExpandedAccounts(new Set([targetAccountId]));
            }
        }
    };

    const toggleAccountExpansion = (accountId: string) => {
        setExpandedAccounts(new Set([accountId]));
        setActiveAccountId(accountId);
        if (currentUser?.id) {
            localStorage.setItem(`panda_active_email_account_${currentUser.id}`, accountId);
        }
    };

    const loadSettings = async () => {
        // Now handled by fetchAccounts and useEffect(activeAccountId)
    };

    const saveSettings = async () => {
        if (!currentUser?.company_id) return;
        
        // Verificação de limite individual ou do plano
        const currentLimit = currentUser.email_permissions?.account_limit || 1;
        if (!activeAccountId && accounts.length >= currentLimit) {
            showToast(`Você atingiu o seu limite de ${currentLimit} conta(s) de e-mail.`, 'warning');
            return;
        }
        
        const payload = { 
            id: activeAccountId || undefined, 
            company_id: currentUser.company_id,
            user_id: currentUser.id, 
            ...settings 
        };
        
        const { data, error } = await supabase.from('email_settings').upsert(payload).select();
        
        if (error) {
            showToast('Erro ao salvar as configurações: ' + error.message, 'error');
        } else {
            showToast('Configurações salvas com sucesso!', 'success');
            await fetchAccounts();
            setView('inbox');
            if (data && data.length > 0) {
                setActiveAccountId(data[0].id);
                setSavedImapUser(data[0].imap_user);
            }
        }
    };

    const deleteAccount = async (accountId: string) => {
        if (!canManageAccounts) {
            showToast('Você não tem permissão para remover contas.', 'error');
            return;
        }

        const account = accounts.find(a => a.id === accountId);
        if (!account) return;

        const isOwner = account.user_id === currentUser.id;

        if (!isOwner) {
            const perms = currentUser.email_permissions || {};
            const allowed = perms.allowed_accounts || [];
            
            if (allowed.includes(accountId)) {
                openConfirm(
                    'Remover Acesso Compartilhado',
                    `Tem certeza que deseja remover o seu acesso à conta de e-mail "${account.imap_user}"? A conta continuará ativa para o usuário proprietário.`,
                    async () => {
                        closeConfirm();
                        const newAllowed = allowed.filter((id: string) => id !== accountId);
                        const newPerms = { ...perms, allowed_accounts: newAllowed };
                        
                        const { error } = await supabase.from('profiles')
                            .update({ email_permissions: newPerms })
                            .eq('id', currentUser.id);
                            
                        if (error) {
                            showToast('Erro ao remover acesso compartilhado: ' + error.message, 'error');
                        } else {
                            showToast('Acesso compartilhado removido com sucesso.', 'success');
                            currentUser.email_permissions = newPerms;
                            await fetchAccounts();
                            if (activeAccountId === accountId) {
                                setActiveAccountId(null);
                            }
                        }
                    }
                );
            } else {
                showToast('Você não é o proprietário desta conta de e-mail. Apenas o proprietário pode excluí-la de forma definitiva.', 'error');
            }
            return;
        }

        openConfirm(
            'Remover Conta',
            'Tem certeza que deseja remover esta conta de e-mail? Todos os metadados e tags associados serão excluídos.',
            async () => {
                closeConfirm();
                const { error } = await supabase.from('email_settings').delete().eq('id', accountId);
                if (error) {
                    showToast('Erro ao excluir conta: ' + error.message, 'error');
                } else {
                    showToast('Conta removida com sucesso.', 'success');
                    await fetchAccounts();
                    if (activeAccountId === accountId) {
                        setActiveAccountId(null);
                        setSettings({
                            imap_host: 'imap.gmail.com', imap_port: 993, imap_user: '', imap_pass: '', imap_ssl: true,
                            smtp_host: 'smtp.gmail.com', smtp_port: 465, smtp_user: '', smtp_pass: '', smtp_ssl: true,
                            signature: ''
                        });
                    }
                }
            },
            'danger'
        );
    };

    // Calls the Node.js email server (bypasses Deno edge function which cannot do TLS/IMAP)
    const EMAIL_SERVER_URL = "/api/email";

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
            setEmails(prev => prev.map(e => e.uid === uid ? { ...e, text: data.text, html: data.html, attachments: data.attachments, cc: data.cc } : e));

            // Mark local real-state emails as seen
            if (!isGhostMode) {
                setEmails(prev => prev.map(e => {
                    const flags = e.flags || [];
                    if (e.uid === uid && !flags.includes('\\Seen')) {
                        setLocallySeenUids(prevSet => new Set(prevSet).add(uid));
                        return { ...e, flags: [...flags, '\\Seen'] };
                    }
                    return e;
                }));
            }

            // Integration: Mark related notifications as read
            const relatedNotifs = notifications.filter(n => !n.isRead && (n.link?.includes(`uid=${uid}`) || (n.link === '/email' && n.title.toLowerCase().includes('e-mail'))));
            relatedNotifs.forEach(n => markAsRead(n.id));

            // Update selected e-mail
            setSelectedEmail(prev => {
                if (!prev || prev.uid !== uid) return prev;
                const flags = prev.flags || [];
                return {
                    ...prev,
                    text: data.text,
                    html: data.html, 
                    attachments: data.attachments,
                    cc: data.cc,
                    subject: prev.subject === 'Carregando e-mail...' ? (data.subject || prev.subject) : prev.subject,
                    from: !prev.from || prev.from === '' ? (data.from || prev.from) : prev.from,
                    date: !prev.date || prev.date === '' ? (data.date || prev.date) : prev.date,
                    flags: (!isGhostMode && !flags.includes('\\Seen')) ? [...flags, '\\Seen'] : flags 
                };
            });

            // Always update cache with the new body data
            const cacheKey = getCacheKey(folder, page);
            if (emailCache[cacheKey]) {
                emailCache[cacheKey].emails = emailCache[cacheKey].emails.map(e => {
                    if (e.uid === uid) {
                        const newFlags = (!isGhostMode && !(e.flags || []).includes('\\Seen')) ? [...(e.flags || []), '\\Seen'] : (e.flags || []);
                        return { ...e, flags: newFlags, text: data.text, html: data.html, attachments: data.attachments, cc: data.cc };
                    }
                    return e;
                });
            }

            // Background update Seen flag on server if not seen
            if (!isGhostMode) {
                callEmailServer('flags', {
                    config: settings,
                    uids: [uid],
                    operation: 'add',
                    flags: ['\\Seen'],
                    path: folder
                }).catch(e => console.error("Error setting Seen flag:", e));
                
                // Also clean notification
                markNotificationsByLink(`/email?uid=${uid}`);
                if (activeAccountId) {
                    markNotificationsByLink(`/email?accountId=${activeAccountId}&uid=${uid}`);
                }
            }
        } catch (err: any) {
            console.error("Fetch Body Error:", err);
            setBodyError(err.message || "Falha ao carregar conteúdo do e-mail.");
        } finally {
            setLoadingBody(false);
            // Mark global notification as read if it looks like an email notification
            if (currentUser?.id && !isGhostMode) {
                supabase.from('notifications')
                    .update({ is_read: true })
                    .eq('user_id', currentUser.id)
                    .eq('is_read', false)
                    .or(`link.eq./email,link.eq./email?uid=${uid}`)
                    .then(() => { });
            }
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
        if (isGhostMode && flag === '\\Seen' && add) return; // Auditoria não deixa rastro
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

        if (flag === '\\Seen') {
            setLocallySeenUids(prev => {
                const next = new Set(prev);
                if (add) next.add(email.uid);
                else next.delete(email.uid);
                return next;
            });
        }

        // Update unseen count badge immediately when marking as read/unread
        if (flag === '\\Seen') {
            const wasUnread = !(email.flags || []).includes('\\Seen');
            if (add && wasUnread) {
                setUnseenCount(prev => Math.max(0, prev - 1));
                markNotificationsByLink(`/email?uid=${email.uid}`);
            }
            else if (!add && !wasUnread) setUnseenCount(prev => prev + 1);
        }

        // Update the cache directly so returning to the folder shows correct read status without waiting for network
        const cacheKey = getCacheKey(currentFolder, page);
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
        try {
            const { error } = await callEmailServer('flags', {
                config: settings,
                uids: [email.uid],
                operation: add ? 'add' : 'remove',
                flags: [flag],
                path: currentFolder
            });
            if (error) {
                console.error("[EmailPage] Error updating flags on server:", error);
                showToast(`Erro ao sincronizar status no servidor: ${error.message}`, 'error');
                // Revert optimistic update? For now just log, but in a real app we should revert.
            }
        } catch (err) {
            console.error("[EmailPage] Exception in toggleFlag:", err);
        }
    };

    const markAllAsRead = async () => {
        if (isGhostMode) {
            showToast("Modo Auditoria: Não é possível marcar como lido.", "warning");
            return;
        }
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
        const cacheKey = getCacheKey(currentFolder, page);
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

    const fetchFolders = async (configOverride?: EmailSettings) => {
        const activeConfig = configOverride || settings;
        if (!activeConfig.imap_host) return;
        const { data, error } = await callEmailServer('folders', { config: activeConfig, action: 'list' });
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
        if (!activeAccountId || activeAccountId === 'undefined' || activeAccountId === 'null') return;
        const { data } = await supabase.from('email_tags').select('*').eq('account_id', activeAccountId);
        if (data) {
            // Map 'name' from DB to 'label' for UI compatibility
            setAvailableTags(data.map((t: any) => ({ ...t, label: t.name })));
        }
    };

    const createTag = async () => {
        if (!newTagLabel || !activeAccountId) return;
        const { data, error } = await supabase.from('email_tags').insert({
            account_id: activeAccountId,
            name: newTagLabel,
            color: newTagColor
        }).select();

        if (error) {
            showToast('Erro ao criar tag: ' + error.message, 'error');
        } else if (data) {
            setAvailableTags(prev => [...prev, { ...data[0], label: data[0].name }]);
            setNewTagLabel('');
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
            const cacheKey = getCacheKey(currentFolder, page);
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



    const handleSearch = (e: React.FormEvent | React.KeyboardEvent) => {
        if ('key' in e && e.key !== 'Enter') return;
        e.preventDefault();
        setPage(1);
        fetchEmails(false, true);
    };

    const fetchEmails = async (isBackground = false, forceRefresh = false, configOverride?: EmailSettings, accountIdOverride?: string) => {
        const activeConfig = configOverride || settings;
        if (!activeConfig.imap_user || fetchInProgress.current) return;
        fetchInProgress.current = true;

        try {
            const currentUserId = currentUser?.id || 'unknown';
            const isSearchingGlobal = searchQuery.trim().length > 0;
            const cacheKey = getCacheKey(isSearchingGlobal ? 'SEARCH_' + searchQuery : currentFolder, page, activeConfig);
            const cached = emailCache[cacheKey];

            // Use cache on initial load (not background polling, not forced refresh)
            if (!isBackground && !forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
                setEmails(cached.emails);
                setTotalEmails(cached.total);
                if (!isSearchingGlobal && currentFolder === 'INBOX') setUnseenCount(cached.unseen);
                fetchInProgress.current = false; // RELEASE LOCK!
                return;
            }

            if (!isBackground) setLoading(true);
            else setRefreshing(true);

            // Check for Tag Filter
            if (filterTag && !isSearchingGlobal) {
                const { data: allMeta } = await supabase.from('email_metadata').select('id, message_id, tags, notes').eq('user_id', currentUserId);
                const taggedIds = (allMeta || [])
                    .filter(m => Array.isArray(m.tags) && m.tags.some((t: any) => t.label?.toLowerCase() === filterTag?.toLowerCase()))
                    .map(m => m.message_id)
                    .filter(Boolean);

                if (taggedIds.length === 0) {
                    setEmails([]);
                    setTotalEmails(0);
                    fetchInProgress.current = false; // RELEASE LOCK!
                    return;
                }

                const { data, error } = await callEmailServer('fetch-by-ids', { config: activeConfig, messageIds: taggedIds });
                
                if (error) {
                    if (error.message?.includes('429')) console.warn("[EmailPage] Rate limit hit (429).");
                    throw error;
                }
                if (data.error) throw new Error(data.error);

                const emailList = data.emails || [];
                const mergedEmails = emailList.map((email: any) => {
                    const emailId = email.messageId || email.uid;
                    const meta = allMeta?.find((m: any) => m.message_id === emailId);
                    const isLocallySeen = locallySeenUids.has(email.uid);
                    const currentFlags = email.flags || [];
                    const finalFlags = isLocallySeen && !currentFlags.includes('\\Seen')
                        ? [...currentFlags, '\\Seen']
                        : currentFlags;
                    return {
                        ...email,
                        flags: finalFlags,
                        metadata: meta ? { id: meta.id, tags: meta.tags || [], notes: meta.notes } : { tags: [] }
                    };
                });
                
                setEmails(mergedEmails);
                setTotalEmails(mergedEmails.length);
                fetchInProgress.current = false; // RELEASE LOCK!
                return;
            }

            const action = isSearchingGlobal ? 'search' : 'fetch';
            const payload = isSearchingGlobal 
                ? { config: activeConfig, query: searchQuery.trim() }
                : { config: activeConfig, path: currentFolder, page, pageSize };

            const { data, error } = await callEmailServer(action, payload);
            
            if (error) {
                if (error.message?.includes('429')) {
                    console.warn("[EmailPage] Rate limit hit (429).");
                }
                throw error;
            }
            if (data.error) throw new Error(data.error);


            // Handle Response (Array or Object with total)
            const emailList = (Array.isArray(data) ? data : data.emails) || [];
            const total = (Array.isArray(data) ? data.length : data.total) || 0;
            const unseen = data.unseen || 0;

            setTotalEmails(total);
            if (!isSearchingGlobal && currentFolder === 'INBOX') setUnseenCount(unseen);

            // Fetch local metadata (tags, notes) from Supabase
            let metadataList: any[] = [];
            const targetAccountId = accountIdOverride || activeAccountId;
            if (targetAccountId && targetAccountId !== 'undefined' && targetAccountId !== 'null') {
                const { data } = await supabase
                    .from('email_metadata')
                    .select('*')
                    .eq('account_id', targetAccountId)
                    .in('message_id', emailList.map((e: any) => e.messageId || e.uid));
                if (data) metadataList = data;
            }

            // Merge metadata and override Seen status from local state
            const mergedEmails = emailList.map((email: any) => {
                const meta = metadataList?.find((m: any) => m.message_id === (email.messageId || email.uid));
                const isLocallySeen = locallySeenUids.has(email.uid);
                const currentFlags = email.flags || [];
                const finalFlags = isLocallySeen && !currentFlags.includes('\\Seen')
                    ? [...currentFlags, '\\Seen']
                    : currentFlags;

                return {
                    ...email,
                    flags: finalFlags,
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
            fetchInProgress.current = false;
        }
    };



    // Refresh when page or folder changes
    useEffect(() => {
        if (savedImapUser) fetchEmails();
    }, [page, pageSize, currentFolder, filterTag]);

    // Switch account based on notification context
    useEffect(() => {
        if (pageContext?.accountId && accounts.length > 0) {
            const acc = accounts.find(a => a.id === pageContext.accountId);
            if (acc && activeAccountId !== acc.id) {
                setActiveAccountId(acc.id);
                setExpandedAccounts(new Set([acc.id]));
                setSettings({
                    imap_host: acc.imap_host,
                    imap_port: acc.imap_port,
                    imap_user: acc.imap_user,
                    imap_pass: acc.imap_pass,
                    imap_ssl: acc.imap_ssl,
                    smtp_host: acc.smtp_host,
                    smtp_port: acc.smtp_port,
                    smtp_user: acc.smtp_user,
                    smtp_pass: acc.smtp_pass,
                    smtp_ssl: acc.smtp_ssl,
                    signature: acc.signature || ''
                });
                setSavedImapUser(acc.imap_user);
            }
        }
    }, [pageContext?.accountId, accounts, activeAccountId]);

    // Handle initial email from context (notifications)
    useEffect(() => {
        if (pageContext?.uid) {
            const email = emails.find(e => e.uid === pageContext.uid);
            if (email) {
                setSelectedEmail(email);
                setView('read');
                fetchEmailBody(email.uid, currentFolder);
            } else {
                // E-mail não está na página carregada. Criar um placeholder e carregar.
                const placeholderEmail = {
                    uid: pageContext.uid,
                    subject: 'Carregando e-mail...',
                    from: '',
                    date: '',
                    flags: [],
                    metadata: { tags: [] }
                } as any;
                setSelectedEmail(placeholderEmail);
                setView('read');
                fetchEmailBody(pageContext.uid, currentFolder);
            }
        }
    }, [pageContext, emails.length]);

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
                    html: composeBody,
                    attachments: attachments
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
        if (isSending) return;
        setIsSending(true);
        setLoading(true);
        try {
            const finalTo = toTags.join(', ');
            const finalCc = ccTags.join(', ');
            const finalBcc = bccTags.join(', ');

            // Validation: prevent sending empty body
            const plainBody = composeBody.replace(/<[^>]*>/g, '').trim();
            if (!plainBody && !composeSubject.trim()) {
                showToast('O assunto ou o corpo do e-mail deve ser preenchido.', 'error');
                setIsSending(false);
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
            showToast('Erro ao enviar e-mail: ' + (err.message || 'Falha na comunicação com o servidor'), 'error');
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

    // --- Contact Groups CRUD ---
    const fetchContactGroups = async () => {
        const { data } = await supabase.from('email_contact_groups').select('*').eq('user_id', currentUser.id).order('name');
        if (data) setContactGroups(data as any);
    };

    const fetchGroupMembers = async (groupId: string) => {
        const { data } = await supabase.from('email_contact_group_members').select('*').eq('group_id', groupId);
        if (data) setGroupMembers(data as any);
    };

    const createContactGroup = async () => {
        if (!newGroupName.trim()) return;
        const { data, error } = await supabase.from('email_contact_groups').insert({
            user_id: currentUser.id,
            company_id: currentUser.company_id,
            name: newGroupName.trim(),
            description: newGroupDesc.trim() || null
        }).select();
        if (error) { showToast('Erro ao criar grupo: ' + error.message, 'error'); return; }
        if (data) {
            setContactGroups(prev => [...prev, data[0] as any]);
            setNewGroupName('');
            setNewGroupDesc('');
            setShowCreateGroupModal(false);
            showToast('Grupo criado!', 'success');
        }
    };

    const addMemberToGroup = async (groupId: string) => {
        if (!addMemberEmail.trim()) return;
        const { data, error } = await supabase.from('email_contact_group_members').insert({
            group_id: groupId,
            contact_name: addMemberName.trim() || addMemberEmail.split('@')[0],
            contact_email: addMemberEmail.trim()
        }).select();
        if (error) { showToast('Erro: ' + error.message, 'error'); return; }
        if (data) {
            setGroupMembers(prev => [...prev, data[0] as any]);
            setAddMemberEmail('');
            setAddMemberName('');
            showToast('Contato adicionado ao grupo!', 'success');
        }
    };

    const addContactToGroup = async (groupId: string, contact: Contact) => {
        const { data, error } = await supabase.from('email_contact_group_members').insert({
            group_id: groupId,
            contact_name: contact.name,
            contact_email: contact.email
        }).select();
        if (error) { showToast('Erro: ' + error.message, 'error'); return; }
        if (data) {
            setGroupMembers(prev => [...prev, data[0] as any]);
            showToast(`${contact.name} adicionado ao grupo!`, 'success');
        }
    };

    const removeMemberFromGroup = async (memberId: string) => {
        const { error } = await supabase.from('email_contact_group_members').delete().eq('id', memberId);
        if (!error) setGroupMembers(prev => prev.filter(m => m.id !== memberId));
    };

    const deleteContactGroup = async (groupId: string) => {
        openConfirm('Excluir Grupo', 'Todos os membros serão removidos. Confirmar?', async () => {
            closeConfirm();
            await supabase.from('email_contact_group_members').delete().eq('group_id', groupId);
            const { error } = await supabase.from('email_contact_groups').delete().eq('id', groupId);
            if (!error) {
                setContactGroups(prev => prev.filter(g => g.id !== groupId));
                if (selectedGroupId === groupId) setSelectedGroupId(null);
                showToast('Grupo excluído.', 'success');
            }
        }, 'danger');
    };

    const applyGroupToCompose = async (group: any) => {
        const { data } = await supabase.from('email_contact_group_members').select('contact_email').eq('group_id', group.id);
        if (data && data.length > 0) {
            const emails = data.map((m: any) => m.contact_email);
            setToTags(prev => Array.from(new Set([...prev, ...emails])));
            setView('compose');
            showToast(`${emails.length} e-mail(s) do grupo "${group.name}" adicionados!`, 'success');
        } else {
            showToast('Este grupo não tem membros.', 'warning');
        }
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

    const handleToggleTag = async (email: EmailMessage, label: string, color: string) => {
        const currentTags = email.metadata?.tags || [];
        const hasTag = currentTags.some(t => t.label === label);
        
        let newTags;
        if (hasTag) {
            newTags = currentTags.filter(t => t.label !== label);
        } else {
            newTags = [...currentTags, { label, color }];
        }

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

        // Prefer messageId for persistence as UID can change
        const messageId = email.messageId || email.uid;

        const { error } = await supabase.from('email_metadata').upsert({
            account_id: activeAccountId,
            message_id: messageId,
            tags: newTags
        }, { onConflict: 'account_id,message_id' });

        if (error) {
            console.error('[EmailPage] Error saving tags:', error);
            showToast('Erro ao sincronizar etiqueta com o servidor.', 'error');
        }
    };

    const filteredEmails = emails.filter(email => {
        const subject = email.subject || '';
        const from = email.from || '';
        const matchesSearch =
            subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
            from.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTag = filterTag ? (email.metadata?.tags || []).some(t => t.label?.toLowerCase() === filterTag?.toLowerCase()) : true;
        
        let matchesDate = true;
        if (filterDateRange !== 'all') {
            const emailDate = new Date(email.date);
            const now = new Date();
            const diffMs = now.getTime() - emailDate.getTime();
            if (filterDateRange === '24h') {
                matchesDate = diffMs <= 24 * 60 * 60 * 1000;
            } else if (filterDateRange === 'week') {
                matchesDate = diffMs <= 7 * 24 * 60 * 60 * 1000;
            } else if (filterDateRange === 'month') {
                matchesDate = diffMs <= 30 * 24 * 60 * 60 * 1000;
            }
        }

        return matchesSearch && matchesTag && matchesDate;
    }).sort((a, b) => {
        if (sortBy === 'date_desc') {
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        } else if (sortBy === 'date_asc') {
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        } else if (sortBy === 'from_asc') {
            return (a.from || '').localeCompare(b.from || '');
        } else if (sortBy === 'from_desc') {
            return (b.from || '').localeCompare(a.from || '');
        }
        return 0;
    });

    // --- Render ---

    return (
        <div className="flex bg-white/70 dark:bg-[#020617]/40 backdrop-blur-xl h-[calc(100vh-6rem)] rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-white/5 transition-all duration-500 relative">
            {/* --- Mobile Sidebar Overlay --- */}
            {sidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-20 md:hidden transition-opacity"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
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

                    <nav className="space-y-4">
                        {accounts.map(account => {
                            const isExpanded = expandedAccounts.has(account.id);
                            const isActive = activeAccountId === account.id;
                            const unseen = accountUnseenCounts[account.id] || 0;

                            return (
                                <div key={account.id} className="space-y-1">
                                    {/* Account Accordion Header */}
                                    <button
                                        onClick={() => toggleAccountExpansion(account.id)}
                                        onContextMenu={(e) => handleAccountContextMenu(e, account)}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-300 border ${isActive ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 shadow-sm' : 'hover:bg-gray-100 border-transparent text-gray-500 dark:text-gray-400 dark:hover:bg-white/5'}`}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] shadow-sm transition-all duration-300 ${isActive ? 'bg-brand-primary text-white scale-110' : 'bg-gray-200 text-gray-500'}`}>
                                                {account.imap_user.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div className="flex flex-col items-start min-w-0">
                                                <span className={`text-xs font-bold truncate w-full ${isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                                    {account.imap_user}
                                                </span>
                                                <span className="text-[9px] opacity-60 truncate w-full">Corporativo</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {unseen > 0 && (
                                                <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                                                    {unseen}
                                                </span>
                                            )}
                                            {isExpanded ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
                                        </div>
                                    </button>

                                    {/* Account Content (Folders) */}
                                    {isExpanded && (
                                        <div className="pl-4 pr-1 py-1 space-y-1 animate-in slide-in-from-top-1 duration-200">
                                            {/* Folder: INBOX */}
                                            <button
                                                onClick={() => { 
                                                    setView('inbox'); 
                                                    setCurrentFolder('INBOX'); 
                                                    setFilterTag(null); 
                                                    setPage(1); 
                                                    if (window.innerWidth < 768) setSidebarOpen(false);
                                                }} 
                                                onDragOver={handleDragOver}
                                                onDrop={(e) => handleDrop(e, 'INBOX')}
                                                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold rounded-lg transition-all ${currentFolder === 'INBOX' && !filterTag ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white'}`}
                                            >
                                                <InboxIcon className="w-4 h-4" />
                                                {t('sidebar.inbox') || 'Entrada'}
                                                {unseenCount > 0 && isActive && (
                                                    <span className="ml-auto bg-red-500 text-white text-[10px] px-1.5 rounded-full">{unseenCount}</span>
                                                )}
                                            </button>

                                            {/* Render other folders for this account */}
                                            {isActive && folders
                                                .filter((f: any) => f.path !== 'INBOX')
                                                .map((folder: any) => {
                                                    const isSpecial = folder.specialUse;
                                                    let Icon = FolderIcon;
                                                    if (isSpecial === '\\Sent' || folder.path.toLowerCase().includes('sent')) Icon = PaperAirplaneIcon;
                                                    if (isSpecial === '\\Trash' || folder.path.toLowerCase().includes('trash') || folder.path.toLowerCase().includes('deleted')) Icon = TrashIcon;
                                                    if (isSpecial === '\\Drafts' || folder.path.toLowerCase().includes('draft')) Icon = PencilSquareIcon;
                                                    if (isSpecial === '\\Junk' || folder.path.toLowerCase().includes('junk') || folder.path.toLowerCase().includes('spam')) Icon = NoSymbolIcon;

                                                    return (
                                                        <button
                                                            key={folder.path}
                                                            onClick={() => { 
                                                                setView('inbox'); 
                                                                setCurrentFolder(folder.path); 
                                                                setFilterTag(null); 
                                                                setPage(1); 
                                                                if (window.innerWidth < 768) setSidebarOpen(false);
                                                            }}
                                                            onDragOver={handleDragOver}
                                                            onDrop={(e) => handleDrop(e, folder.path)}
                                                            className={`w-full flex items-center gap-3 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${currentFolder === folder.path ? 'bg-brand-primary/10 text-brand-primary' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5'}`}
                                                        >
                                                            <Icon className={`w-4 h-4 ${currentFolder === folder.path ? 'text-brand-primary' : 'text-gray-400'}`} />
                                                            <span className="truncate">{getFolderName(folder.path)}</span>
                                                        </button>
                                                    );
                                                })}
                                            
                                            {isActive && (
                                                <button onClick={() => setShowFolderModal(true)} className="w-full text-left px-3 py-1.5 text-[10px] text-brand-primary hover:bg-gray-100 rounded-lg flex items-center gap-2 font-bold opacity-80">
                                                    + {t('email.new_folder')}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
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
                                onClick={() => { 
                                    setView('inbox'); 
                                    setFilterTag(tag.label); 
                                    setPage(1); 
                                    if (window.innerWidth < 768) setSidebarOpen(false);
                                }}
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

                        {/* Groups Section */}
                        <div className="mt-4 border-t pt-4">
                            <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex justify-between items-center">
                                Grupos de Contatos
                                <button onClick={() => setShowGroupsModal(true)} className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-brand-primary" title="Gerenciar Grupos">
                                    <UserGroupIcon className="w-3 h-3" />
                                </button>
                            </h3>
                            {contactGroups.length === 0 && (
                                <p className="px-3 text-xs text-gray-400 italic">Nenhum grupo criado.</p>
                            )}
                            {contactGroups.map(group => (
                                <button
                                    key={group.id}
                                    onClick={() => applyGroupToCompose(group)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-md transition-colors group"
                                    title={`Enviar email para o grupo: ${group.name}`}
                                >
                                    <UserGroupIcon className="w-4 h-4 text-emerald-400 group-hover:text-emerald-600" />
                                    <span className="truncate font-medium">{group.name}</span>
                                    <span className="ml-auto text-[10px] text-emerald-500 font-bold opacity-0 group-hover:opacity-100">→ Compose</span>
                                </button>
                            ))}
                            <button
                                onClick={() => setShowGroupsModal(true)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-brand-primary hover:bg-gray-100 rounded-md font-semibold mt-1"
                            >
                                + Gerenciar Grupos
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* === Groups Modal === */}
            {showGroupsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowGroupsModal(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl p-6 mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Grupos de Contatos</h2>
                            <div className="flex gap-2">
                                <button onClick={() => setShowCreateGroupModal(true)} className="px-4 py-2 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition">+ Novo Grupo</button>
                                <button onClick={() => setShowGroupsModal(false)} className="p-2 text-gray-400 hover:text-gray-600"><XMarkIcon className="w-5 h-5" /></button>
                            </div>
                        </div>

                        {contactGroups.length === 0 && (
                            <div className="text-center py-12 text-gray-400">
                                <UserGroupIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p>Nenhum grupo criado ainda.</p>
                                <button onClick={() => setShowCreateGroupModal(true)} className="mt-4 px-4 py-2 bg-brand-primary text-white rounded-xl text-sm font-semibold">Criar primeiro grupo</button>
                            </div>
                        )}

                        <div className="space-y-3">
                            {contactGroups.map(group => (
                                <div key={group.id} className="border border-gray-100 dark:border-white/10 rounded-xl overflow-hidden">
                                    <div
                                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5"
                                        onClick={() => {
                                            if (selectedGroupId === group.id) {
                                                setSelectedGroupId(null);
                                            } else {
                                                setSelectedGroupId(group.id);
                                                fetchGroupMembers(group.id);
                                            }
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl flex items-center justify-center">
                                                <UserGroupIcon className="w-5 h-5 text-emerald-600" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900 dark:text-white">{group.name}</p>
                                                {group.description && <p className="text-xs text-gray-500">{group.description}</p>}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={(e) => { e.stopPropagation(); applyGroupToCompose(group); setShowGroupsModal(false); }} className="px-3 py-1 text-xs bg-emerald-50 text-emerald-700 rounded-lg font-semibold hover:bg-emerald-100">Enviar E-mail</button>
                                            <button onClick={(e) => { e.stopPropagation(); deleteContactGroup(group.id); }} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><TrashIcon className="w-4 h-4" /></button>
                                        </div>
                                    </div>

                                    {selectedGroupId === group.id && (
                                        <div className="border-t border-gray-100 dark:border-white/10 p-4 bg-gray-50 dark:bg-white/5">
                                            {/* Add member from existing contacts */}
                                            <div className="mb-3">
                                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Adicionar dos Meus Contatos</p>
                                                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                                    {contacts
                                                        .filter(c => !groupMembers.some(m => m.contact_email === c.email))
                                                        .map(contact => (
                                                            <button
                                                                key={contact.id}
                                                                onClick={() => addContactToGroup(group.id, contact)}
                                                                className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-full text-xs hover:border-emerald-400 hover:text-emerald-600 transition-colors"
                                                            >
                                                                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold">{contact.name[0]}</span>
                                                                {contact.name}
                                                                <span className="text-[10px] text-blue-400">+</span>
                                                            </button>
                                                        ))
                                                    }
                                                    {contacts.filter(c => !groupMembers.some(m => m.contact_email === c.email)).length === 0 && (
                                                        <p className="text-xs text-gray-400 italic">Todos os contatos já estão no grupo.</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Add member manually */}
                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Adicionar Manualmente</p>
                                            <div className="flex gap-2 mb-4">
                                                <input type="text" placeholder="Nome (opcional)" value={addMemberName} onChange={e => setAddMemberName(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-brand-primary dark:bg-slate-800 dark:border-white/10 dark:text-white" />
                                                <input type="email" placeholder="E-mail*" value={addMemberEmail} onChange={e => setAddMemberEmail(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-brand-primary dark:bg-slate-800 dark:border-white/10 dark:text-white" />
                                                <button onClick={() => addMemberToGroup(group.id)} className="px-4 py-2 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-emerald-600">+</button>
                                            </div>

                                            {/* Members list */}
                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Membros ({groupMembers.length})</p>
                                            {groupMembers.length === 0 && <p className="text-xs text-gray-400 italic mb-2">Nenhum membro ainda.</p>}
                                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                                {groupMembers.map(member => (
                                                    <div key={member.id} className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-white/10">
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900 dark:text-white">{member.contact_name}</p>
                                                            <p className="text-xs text-gray-500">{member.contact_email}</p>
                                                        </div>
                                                        <button onClick={() => removeMemberFromGroup(member.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors"><XMarkIcon className="w-4 h-4" /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* === Create Group Modal === */}
            {showCreateGroupModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateGroupModal(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Criar Grupo de Contatos</h3>
                        <div className="space-y-3">
                            <input type="text" placeholder="Nome do grupo *" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary dark:bg-slate-800 dark:border-white/10 dark:text-white" />
                            <input type="text" placeholder="Descrição (opcional)" value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary dark:bg-slate-800 dark:border-white/10 dark:text-white" />
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setShowCreateGroupModal(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancelar</button>
                            <button onClick={createContactGroup} className="flex-1 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-emerald-600">Criar Grupo</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Middle: Email List --- */}
            {(view === 'inbox' || view === 'read') && (
                <div className={`flex flex-col min-w-0 border-r border-gray-200 relative ${
                    openMode === 'split' 
                        ? ((view === 'read' && isFullScreen) ? 'hidden' : view === 'read' ? 'hidden md:flex md:max-w-md md:w-80' : 'flex-1 md:flex-none md:w-80 md:max-w-md')
                        : 'flex-1'
                }`}>
                    {/* Toolbar for List */}
                    <div className="p-4 border-b border-gray-100 dark:border-white/5 flex flex-col gap-3 bg-white/50 dark:bg-[#020617]/60 backdrop-blur-xl z-20 sticky top-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {!sidebarOpen && (
                                    <button 
                                        onClick={() => setSidebarOpen(true)} 
                                        className="md:hidden p-1.5 -ml-1 text-gray-400 hover:bg-gray-100 rounded-lg"
                                        title="Menu"
                                    >
                                        <Bars3Icon className="w-5 h-5" />
                                    </button>
                                )}
                                {isSelectionMode ? (
                                    <input
                                        type="checkbox"
                                        checked={selectedEmailUids.length > 0 && selectedEmailUids.length === filteredEmails.length}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary cursor-pointer transition-all"
                                        title="Selecionar todos"
                                    />
                                ) : (
                                    <button
                                        onClick={() => setIsSelectionMode(true)}
                                            className="p-1 px-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-400 hover:text-brand-primary transition-all flex items-center gap-1.5"
                                        title="Selecionar e-mails"
                                    >
                                        <TagIcon className="w-4 h-4" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Selecionar</span>
                                    </button>
                                )}
                                <h2 className="font-bold text-gray-900 dark:text-white truncate tracking-tight">{getFolderName(currentFolder)}</h2>
                            </div>
                            <div className="flex items-center gap-3">
                                {isSelectionMode && selectedEmailUids.length > 0 && (
                                    <button
                                        onClick={deleteSelectedEmails}
                                        className="p-1 px-2 text-red-500 hover:bg-red-50 rounded-lg flex items-center gap-1 transition-all"
                                        title="Excluir selecionados"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{selectedEmailUids.length}</span>
                                    </button>
                                )}
                                {isSelectionMode ? (
                                    <button
                                        onClick={() => { setIsSelectionMode(false); setSelectedEmailUids([]); }}
                                        className="text-[10px] font-black text-gray-400 hover:text-gray-600 uppercase tracking-widest transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                ) : (
                                        <button
                                            onClick={markAllAsRead}
                                            className="text-[10px] font-black text-brand-primary hover:text-emerald-500 uppercase tracking-widest transition-colors"
                                            title="Marcar todos como lidos"
                                        >
                                            Lidos
                                        </button>
                                )}
                            </div>
                        </div>
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={handleSearch}
                                placeholder="Pesquisar em tudo..."
                                className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all dark:text-white"
                            />
                        </div>
                        <div className="flex gap-2">
                            <select
                                value={sortBy}
                                onChange={e => {
                                    const val = e.target.value as any;
                                    setSortBy(val);
                                    localStorage.setItem('pandamail_sort_by', val);
                                }}
                                className="flex-1 text-[10px] font-bold uppercase tracking-wider py-1.5 px-2 bg-gray-100 dark:bg-white/5 rounded-lg border border-transparent dark:border-white/5 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
                            >
                                <option value="date_desc">Data: Recentes</option>
                                <option value="date_asc">Data: Antigos</option>
                                <option value="from_asc">Remetente: A-Z</option>
                                <option value="from_desc">Remetente: Z-A</option>
                            </select>
                            
                            <select
                                value={filterDateRange}
                                onChange={e => setFilterDateRange(e.target.value as any)}
                                className="flex-1 text-[10px] font-bold uppercase tracking-wider py-1.5 px-2 bg-gray-100 dark:bg-white/5 rounded-lg border border-transparent dark:border-white/5 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
                            >
                                <option value="all">Todas as Datas</option>
                                <option value="24h">Últimas 24h</option>
                                <option value="week">Última Semana</option>
                                <option value="month">Último Mês</option>
                            </select>
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
                                    onClick={() => {
                                        if (isSelectionMode) {
                                            toggleEmailSelection(email.uid);
                                        } else {
                                            setSelectedEmail(email);
                                            fetchEmailBody(email.uid, currentFolder);
                                            if (openMode === 'split') {
                                                setView('read');
                                            }
                                        }
                                    }}
                                    onContextMenu={(e) => handleContextMenu(e, email)}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, email)}
                                    className={`p-4 rounded-2xl cursor-pointer transition-all duration-300 flex items-start gap-3 relative border mb-1 group ${selectedEmail?.uid === email.uid
                                        ? 'bg-brand-primary/10 border-brand-primary/30 shadow-lg shadow-brand-primary/5'
                                        : 'border-transparent hover:bg-white dark:hover:bg-white/5'} ${!(email.flags || []).includes('\\Seen') ? 'bg-emerald-50/40 dark:bg-brand-primary/10' : ''}`}
                                >
                                    {isSelectionMode && (
                                        <div className="flex flex-col mt-0.5" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={selectedEmailUids.includes(email.uid)}
                                                onChange={() => toggleEmailSelection(email.uid)}
                                                className="w-4 h-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary cursor-pointer transition-all transition-opacity duration-200"
                                            />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                                        <div className="flex justify-between items-start">
                                            <div className={`text-sm truncate pr-2 tracking-tight ${!(email.flags || []).includes('\\Seen') ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                                                {email.from}
                                            </div>
                                            <div className="text-[10px] text-gray-400 font-medium whitespace-nowrap opacity-60 flex flex-col items-end">
                                                <span>{new Date(email.date).toLocaleDateString()}</span>
                                                {(email as any).folder && (
                                                    <span className="text-[8px] font-bold text-brand-primary uppercase mt-1">{(email as any).folder}</span>
                                                )}
                                            </div>
                                        </div>
                                        {previewMode !== 'sender' && (
                                            <div className={`text-sm line-clamp-1 tracking-tight ${!(email.flags || []).includes('\\Seen') ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'}`}>
                                                {email.subject}
                                            </div>
                                        )}
                                        {previewMode === 'full' && (
                                            <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 opacity-70 group-hover:opacity-100 transition-opacity">
                                                {email.snippet || t('email.no_preview')}
                                            </div>
                                        )}
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
                                        onClick={() => { handleToggleTag(contextMenu.email, tag.label, tag.color); closeContextMenu(); }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center justify-between transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }}></span>
                                            {tag.label}
                                        </div>
                                        {(contextMenu.email.metadata?.tags || []).some(t => t.label === tag.label) && (
                                            <CheckIcon className="w-4 h-4 text-emerald-500" />
                                        )}
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

                    {/* Account Context Menu */}
                    {accountContextMenu && (
                        <div
                            className="fixed bg-white dark:bg-slate-800 shadow-2xl rounded-xl border border-gray-200 dark:border-slate-700 z-[100] w-64 py-2 overflow-hidden animate-in fade-in zoom-in duration-200"
                            style={{ top: accountContextMenu.y, left: accountContextMenu.x }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800 truncate">
                                {accountContextMenu.account.imap_user}
                            </div>

                            <button
                                onClick={() => toggleNotificationForAccount(accountContextMenu.account.id)}
                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
                            >
                                <EnvelopeIcon className="w-4 h-4 text-gray-400" />
                                {disabledNotifications.has(accountContextMenu.account.id) ? (
                                    <span className="text-emerald-600 font-bold">Ativar Notificações</span>
                                ) : (
                                    <span className="text-gray-600 dark:text-gray-400">Silenciar Notificações</span>
                                )}
                            </button>

                            <div className="border-t dark:border-slate-700 mt-1 pt-1">
                                <button
                                    onClick={() => {
                                        deleteAccount(accountContextMenu.account.id);
                                        setAccountContextMenu(null);
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-3 transition-colors"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                    Remover / Excluir Conta
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
            {((openMode === 'split') || (view === 'settings' || view === 'compose' || view === 'read')) && (
                <div className={`flex-1 bg-white/50 dark:bg-transparent flex flex-col overflow-hidden ${view === 'inbox' ? (openMode !== 'split' ? 'hidden' : 'hidden md:flex') : 'flex z-20 absolute inset-0 md:static'}`}>

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
                                // Combine To and CC for Reply All, excluding self
                                const originalTo = (selectedEmail.to_full || []).map(e => e.address).filter(e => e && e !== settings.imap_user && e !== from);
                                const originalCc = (selectedEmail.cc_full || []).map(e => e.address).filter(e => e && e !== settings.imap_user && e !== from);
                                
                                setToTags([from, ...originalTo]);
                                setCcTags(originalCc);
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
                        <div className="p-4 sm:p-6 pb-2">
                            <div className="flex flex-col mb-4 gap-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary font-bold flex-shrink-0">
                                            {selectedEmail.from.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-gray-900 dark:text-white tracking-tight truncate max-w-[200px] xs:max-w-[250px] sm:max-w-none" title={selectedEmail.from}>{selectedEmail.from}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-col gap-0.5">
                                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                    <span className="flex-shrink-0">Para:</span>
                                                    <span className="truncate max-w-[120px] xs:max-w-[180px] sm:max-w-[300px]" title={selectedEmail.to || 'mim'}>{selectedEmail.to || 'mim'}</span>
                                                    <button onClick={() => setShowDetails(!showDetails)} className="px-2 py-0.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 transition-colors rounded text-[10px] font-bold uppercase cursor-pointer flex-shrink-0">
                                                        {showDetails ? 'Ocultar Detalhes' : 'Ver Detalhes'}
                                                    </button>
                                                </div>
                                                {selectedEmail.cc && (
                                                    <div className="text-[10px] opacity-80 truncate max-w-[150px] xs:max-w-[220px] sm:max-w-[400px]" title={selectedEmail.cc}>
                                                        Cc: {selectedEmail.cc}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-xs font-medium text-gray-400 bg-gray-100 dark:bg-white/5 py-1 px-3 rounded-full w-fit sm:ml-auto">
                                        {new Date(selectedEmail.date).toLocaleString()}
                                    </div>
                                </div>
 
                                {showDetails && (
                                    <div className="mt-4 p-4 bg-gray-50 dark:bg-slate-900/40 rounded-xl border border-gray-100 dark:border-white/5 text-xs text-gray-600 dark:text-gray-300 space-y-2 relative overflow-hidden break-words">
                                        <div className="break-all sm:break-words"><strong>De:</strong> {selectedEmail.from}</div>
                                        <div className="break-all sm:break-words"><strong>Para:</strong> {selectedEmail.to || (selectedEmail.from === settings.imap_user ? 'mim' : '-')}</div>
                                        {selectedEmail.cc && <div className="break-all sm:break-words"><strong>Cc:</strong> {selectedEmail.cc}</div>}
                                        <div className="break-all sm:break-words"><strong>Data:</strong> {new Date(selectedEmail.date).toString()}</div>
                                        <div className="break-all sm:break-words"><strong>Assunto:</strong> {selectedEmail.subject}</div>
                                        {selectedEmail.messageId && <div className="break-all text-[10px]"><strong>Mensagem-ID:</strong> {selectedEmail.messageId}</div>}
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
                                    <div className="bg-white dark:bg-slate-900/50 rounded-xl p-4 sm:p-6 shadow-inner min-h-[300px] overflow-x-auto">
                                        <div
                                            className="prose dark:prose-invert max-w-none text-gray-800 dark:text-gray-200"
                                            dangerouslySetInnerHTML={{
                                                __html: DOMPurify.sanitize(selectedEmail.html || selectedEmail.text || `<div class="text-gray-400 italic">${t('email.no_content')}</div>`, {
                                                    RETURN_TRUSTED_TYPE: true,
                                                    ADD_TAGS: ['iframe', 'style'],
                                                    ADD_ATTR: ['allowfullscreen', 'frameborder', 'scrolling']
                                                }).toString().replace(/src="http:\/\//g, 'src="https://').replace(/href="http:\/\//g, 'href="https://')
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
                            <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden">
                                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                                    {/* Edit Area */}
                                    <div className="flex-1 p-6 flex flex-col space-y-4 overflow-y-auto border-r border-gray-100 dark:border-white/5">
                                        <div className="space-y-2">
                                            <div className="flex flex-wrap gap-2 items-center border-b border-gray-200 dark:border-white/5 py-2">
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
                                                                    className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 flex flex-col border-b border-gray-100 dark:border-white/5 last:border-0"
                                                                >
                                                                    <span className="text-sm font-medium text-gray-800 dark:text-white">{c.name}</span>
                                                                    <span className="text-xs text-gray-500 dark:text-gray-400">{c.email}</span>
                                                                </button>
                                                            ))}
                                                            {!toTags.includes(composeTo) && composeTo.includes('@') && (
                                                                <button
                                                                    onClick={() => handleAddRecipientTag('to', composeTo)}
                                                                    className="w-full text-left px-4 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-brand-primary text-xs font-bold"
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
                                                <div className="space-y-2 bg-gray-50 dark:bg-slate-800/40 p-2 rounded border dark:border-white/5">
                                                    {/* CC */}
                                                    <div className="flex flex-wrap gap-2 items-center border-b border-gray-200 dark:border-white/5 py-1">
                                                        <span className="text-xs text-gray-400 min-w-[30px]">CC:</span>
                                                        {ccTags.map(tag => (
                                                            <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded text-[11px]">
                                                                {tag}
                                                                <button onClick={() => removeRecipientTag('cc', tag)} className="hover:text-red-500">
                                                                    <XMarkIcon className="w-3 h-3" />
                                                                </button>
                                                            </span>
                                                        ))}
                                                        <input
                                                            className="flex-1 min-w-[100px] bg-transparent focus:outline-none text-sm dark:text-white"
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
                                                    <div className="flex flex-wrap gap-2 items-center border-b border-gray-200 dark:border-white/5 py-1">
                                                        <span className="text-xs text-gray-400 min-w-[30px]">CCO:</span>
                                                        {bccTags.map(tag => (
                                                            <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded text-[11px]">
                                                                {tag}
                                                                <button onClick={() => removeRecipientTag('bcc', tag)} className="hover:text-red-500">
                                                                    <XMarkIcon className="w-3 h-3" />
                                                                </button>
                                                            </span>
                                                        ))}
                                                        <input
                                                            className="flex-1 min-w-[100px] bg-transparent focus:outline-none text-sm dark:text-white"
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
                                                        className="w-full border-b border-gray-200 dark:border-white/5 py-1 bg-transparent focus:outline-none text-sm dark:text-white"
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

                                        <div className="flex-1 border border-gray-200 dark:border-white/5 rounded-lg overflow-hidden flex flex-col min-h-[300px]">
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
                                    <div className="w-full lg:w-80 bg-gray-50 dark:bg-slate-900/40 p-6 flex flex-col overflow-y-auto shrink-0 border-l border-gray-100 dark:border-white/5">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">Anexos</h3>
                                            <span className="text-[10px] bg-gray-200 dark:bg-slate-800 px-2 py-0.5 rounded text-gray-500 dark:text-gray-400 font-bold">LIMITE 20MB</span>
                                        </div>

                                        <button
                                            className="w-full flex flex-col items-center justify-center gap-2 bg-white dark:bg-slate-800/40 border-2 border-dashed border-gray-200 dark:border-white/10 hover:border-brand-primary hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-gray-400 hover:text-brand-primary p-8 rounded-2xl transition-all group shadow-sm"
                                            onClick={() => document.getElementById('file-upload')?.click()}
                                        >
                                            <input id="file-upload" type="file" multiple className="hidden" onChange={handleFileChange} />
                                            <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-full group-hover:bg-brand-primary/10 transition-colors">
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
                                                    <div key={idx} className="flex items-center justify-between bg-white dark:bg-slate-800/60 p-3 rounded-xl border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all group">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="bg-brand-primary/10 p-2 rounded-lg">
                                                                <PaperClipIcon className="w-4 h-4 text-brand-primary" />
                                                            </div>
                                                            <div className="truncate pr-2">
                                                                <div className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">{file.filename}</div>
                                                                <div className="text-[10px] font-medium text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => removeAttachment(idx)}
                                                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/20 text-gray-300 dark:text-gray-500 hover:text-red-500 rounded-lg transition-all"
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
                                                <div className="w-16 h-16 bg-gray-200 dark:bg-slate-800 rounded-full mb-4 flex items-center justify-center">
                                                    <ArrowDownTrayIcon className="w-8 h-8 text-gray-400" />
                                                </div>
                                                <p className="text-xs font-medium text-gray-600">Nenhum arquivo<br />adicionado ainda</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="p-4 border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-slate-900/40 flex justify-between items-center shrink-0">
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
                                            disabled={loading || isSending}
                                            className={`px-8 py-2.5 bg-brand-primary text-white rounded-xl font-bold hover:bg-emerald-600 shadow-lg hover:shadow-emerald-200 active:scale-95 transition-all flex items-center gap-2 ${isSending ? 'opacity-70 cursor-not-allowed' : ''}`}
                                        >
                                            {isSending ? (
                                                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <PaperAirplaneIcon className="w-4 h-4" />
                                            )}
                                            {isSending ? t('email.sending') : t('email.send')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : view === 'settings' ? (
                            <div className="flex-1 p-8 overflow-y-auto bg-gray-50/30 dark:bg-transparent">
                                <div className="max-w-4xl mx-auto">
                                    <div className="flex justify-between items-center mb-8">
                                        <div>
                                            <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Gerenciar Contas</h2>
                                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Configure múltiplos e-mails para sua empresa.</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Suas Contas</p>
                                                <p className="text-sm font-black text-gray-900 dark:text-white">{accounts.length} / {currentUser.email_permissions?.account_limit || 1}</p>
                                            </div>
                                            {canManageAccounts && (
                                                <button 
                                                    onClick={() => {
                                                        setActiveAccountId(null);
                                                        setSettings({
                                                            imap_host: '', imap_port: 993, imap_user: '', imap_pass: '', imap_ssl: true,
                                                            smtp_host: '', smtp_port: 465, smtp_user: '', smtp_pass: '', smtp_ssl: true,
                                                            signature: ''
                                                        });
                                                        showToast('Formulário pronto para nova conta.', 'info');
                                                    }}
                                                    className={`px-4 py-2.5 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 ${accounts.length >= (currentUser.email_permissions?.account_limit || 1) ? 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-gray-500 cursor-not-allowed' : 'bg-brand-primary text-white hover:bg-emerald-600 active:scale-95'}`}
                                                    disabled={accounts.length >= (currentUser.email_permissions?.account_limit || 1)}
                                                >
                                                    <UserPlusIcon className="w-5 h-5" />
                                                    Adicionar Nova Conta
                                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                                        {accounts.map(acc => (
                                            <div key={acc.id} className={`p-6 rounded-3xl border transition-all cursor-pointer group ${activeAccountId === acc.id ? 'bg-white dark:bg-slate-800 border-emerald-200 dark:border-emerald-500/30 shadow-xl ring-2 ring-emerald-500/20' : 'bg-white/50 dark:bg-slate-900/50 border-gray-100 dark:border-white/5 hover:border-gray-200 shadow-sm'}`} onClick={() => setActiveAccountId(acc.id)} onContextMenu={(e) => handleAccountContextMenu(e, acc)}>
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${activeAccountId === acc.id ? 'bg-brand-primary text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-gray-500'}`}>
                                                        {acc.imap_user.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={(e) => { e.stopPropagation(); deleteAccount(acc.id); }} className="p-2 text-gray-300 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-lg">
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="font-bold text-gray-900 dark:text-white truncate mb-1">{acc.imap_user}</div>
                                                <div className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">{acc.imap_host}</div>
                                                {activeAccountId === acc.id && (
                                                    <div className="mt-4 flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase">
                                                        <CheckIcon className="w-3 h-3" /> Editando Agora
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="bg-white dark:bg-slate-900/60 p-8 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl">
                                            <h3 className="font-black text-gray-900 dark:text-white mb-6 text-xl tracking-tight flex items-center gap-3">
                                                <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg text-brand-primary"><InboxIcon className="w-5 h-5" /></div>
                                                {t('email.incoming_server')}
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('email.host_imap')}</label>
                                                    <input value={settings.imap_host} onChange={e => setSettings(s => ({ ...s, imap_host: e.target.value }))} className="w-full mt-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-white/5 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all dark:text-white" placeholder="imap.gmail.com" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('email.port')}</label>
                                                    <input type="number" value={settings.imap_port} onChange={e => setSettings(s => ({ ...s, imap_port: parseInt(e.target.value) }))} className="w-full mt-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-white/5 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all dark:text-white" placeholder="993" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('email.user')}</label>
                                                    <input value={settings.imap_user} onChange={e => setSettings(s => ({ ...s, imap_user: e.target.value, smtp_user: e.target.value }))} className="w-full mt-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-white/5 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all dark:text-white" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('email.pass')}</label>
                                                    <div className="relative mt-2">
                                                        <input type={showEmailPass ? 'text' : 'password'} value={settings.imap_pass} onChange={e => setSettings(s => ({ ...s, imap_pass: e.target.value, smtp_pass: e.target.value }))} className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-white/5 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all pr-10 dark:text-white" />
                                                        <button type="button" onClick={() => setShowEmailPass(p => !p)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600">
                                                            {showEmailPass ? <XMarkIcon className="w-5 h-5" /> : <MagnifyingGlassIcon className="w-5 h-5" />}
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-100 dark:border-white/5">
                                                    <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary" checked={settings.imap_ssl} onChange={e => setSettings(s => ({ ...s, imap_ssl: e.target.checked }))} />
                                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">{t('email.use_ssl')}</label>
                                                </div>
                                            </div>

                                            <h3 className="font-black text-gray-900 dark:text-white mb-6 mt-12 text-xl tracking-tight flex items-center gap-3">
                                                <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-blue-600"><PaperAirplaneIcon className="w-5 h-5" /></div>
                                                {t('email.outgoing_server')}
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('email.host_smtp')}</label>
                                                    <input value={settings.smtp_host} onChange={e => setSettings(s => ({ ...s, smtp_host: e.target.value }))} className="w-full mt-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-white/5 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all dark:text-white" placeholder="smtp.gmail.com" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('email.port')}</label>
                                                    <input type="number" value={settings.smtp_port} onChange={e => setSettings(s => ({ ...s, smtp_port: parseInt(e.target.value) }))} className="w-full mt-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-white/5 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all dark:text-white" placeholder="465" />
                                                </div>
                                                <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-100 dark:border-white/5">
                                                    <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary" checked={settings.smtp_ssl} onChange={e => setSettings(s => ({ ...s, smtp_ssl: e.target.checked }))} />
                                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">{t('email.use_ssl')}</label>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white dark:bg-slate-900/60 p-8 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl">
                                            <h3 className="font-black text-gray-900 dark:text-white mb-2 text-xl tracking-tight">{t('email.signature_title')}</h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('email.signature_desc')}</p>
                                            <div className="min-h-[250px] mb-8">
                                                <ReactQuill
                                                    theme="snow"
                                                    value={settings.signature}
                                                    onChange={val => setSettings(s => ({ ...s, signature: val }))}
                                                    className="h-48"
                                                />
                                            </div>
                                        </div>
 
                                        <div className="bg-white dark:bg-slate-900/60 p-8 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl">
                                            <h3 className="font-black text-gray-900 dark:text-white mb-2 text-xl tracking-tight flex items-center gap-3">
                                                <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg text-brand-primary">
                                                    <Cog6ToothIcon className="w-5 h-5" />
                                                </div>
                                                Preferências do PandaMail
                                            </h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Personalize como as mensagens de e-mail são exibidas e abertas no seu PandaMail.</p>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Forma de Abrir Mensagens</label>
                                                    <select
                                                        value={openMode}
                                                        onChange={e => {
                                                            const val = e.target.value as any;
                                                            setOpenMode(val);
                                                            localStorage.setItem('pandamail_open_mode', val);
                                                            showToast('Preferência de abertura salva!', 'success');
                                                        }}
                                                        className="w-full mt-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-white/5 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all dark:text-white"
                                                    >
                                                        <option value="split">Lado a Lado (Split Screen)</option>
                                                        <option value="modal">Modal (Popup de Tela Inteira)</option>
                                                        <option value="window">Janela Flutuante (Arrastável)</option>
                                                    </select>
                                                </div>
                                                
                                                <div>
                                                    <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Pré-visualização na Listagem</label>
                                                    <select
                                                        value={previewMode}
                                                        onChange={e => {
                                                            const val = e.target.value as any;
                                                            setPreviewMode(val);
                                                            localStorage.setItem('pandamail_preview_mode', val);
                                                            showToast('Preferência de visualização salva!', 'success');
                                                        }}
                                                        className="w-full mt-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-white/5 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all dark:text-white"
                                                    >
                                                        <option value="full">Completo (Remetente, Assunto e Snippet)</option>
                                                        <option value="sender_subject">Apenas Remetente e Assunto</option>
                                                        <option value="sender">Apenas Remetente</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-end gap-4 p-8 bg-white dark:bg-slate-900/60 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                            <button onClick={() => setView('inbox')} className="px-6 py-3 text-gray-500 dark:text-gray-400 font-bold hover:text-gray-700 dark:hover:text-gray-200 transition-colors">{t('generic.cancel')}</button>
                                            <button onClick={saveSettings} className="px-10 py-3 bg-brand-primary text-white rounded-2xl font-black shadow-lg hover:bg-emerald-600 transition-all active:scale-95">{t('email.save_settings')}</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                ) : null}
            </div>
            )}

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
                    <div className="bg-white dark:bg-slate-900 rounded-lg p-6 w-96 shadow-xl border dark:border-white/5">
                        <h3 className="text-lg font-bold mb-4 dark:text-white">{t('email.manage_tags')}</h3>

                        <div className="flex gap-2 mb-4">
                            <input
                                className="flex-1 border dark:border-white/10 rounded px-2 dark:bg-slate-800 dark:text-white"
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
                                <div key={tag.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-800/40 border dark:border-white/5 rounded">
                                    <div className="flex items-center gap-2 dark:text-gray-200">
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
                            <button onClick={() => setShowTagModal(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded">{t('email.close')}</button>
                        </div>
                    </div>
                </div>
            )}
            {/* --- Contacts Modal --- */}
            {showContactsModal && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] border dark:border-white/5">
                        {/* Header */}
                        <div className="p-4 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/80 dark:bg-slate-900">
                            <div className="flex items-center gap-2">
                                <UsersIcon className="w-5 h-5 text-brand-primary" />
                                <h3 className="font-bold text-gray-800 dark:text-white text-lg">Diretório de Contatos</h3>
                            </div>
                            <button onClick={() => setShowContactsModal(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-white/5 rounded-full transition-colors">
                                <XMarkIcon className="w-6 h-6 text-gray-500" />
                            </button>
                        </div>

                        {/* Add New Contact Form */}
                        <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/10 border-b border-emerald-100 dark:border-emerald-500/20">
                            <h4 className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-3">Novo Contato</h4>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <div className="flex-1">
                                    <input
                                        className="w-full border border-gray-300 dark:border-white/10 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all dark:text-white"
                                        placeholder="Nome"
                                        value={newContactName}
                                        onChange={e => setNewContactName(e.target.value)}
                                    />
                                </div>
                                <div className="flex-1">
                                    <input
                                        className="w-full border border-gray-300 dark:border-white/10 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all dark:text-white"
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
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50 dark:bg-slate-950/30">
                            {(() => {
                                if (contacts.length === 0) {
                                    return (
                                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                            <UsersIcon className="w-12 h-12 mb-2 opacity-20" />
                                            <p className="text-sm font-medium">Nenhum contato encontrado</p>
                                        </div>
                                    );
                                }

                                const grouped = contacts.reduce((acc, contact) => {
                                    const domain = contact.email.split('@')[1] || 'Outros';
                                    if (!acc[domain]) acc[domain] = [];
                                    acc[domain].push(contact);
                                    return acc;
                                }, {} as Record<string, typeof contacts>);

                                return Object.entries(grouped).sort(([d1], [d2]) => d1.localeCompare(d2)).map(([domain, domainContacts]) => (
                                    <div key={domain} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
                                        <button
                                            onClick={() => setExpandedDomains(prev => ({ ...prev, [domain]: !prev[domain] }))}
                                            className="w-full flex justify-between items-center p-4 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                                                    {domain.charAt(0)}
                                                </div>
                                                <div className="text-left font-bold text-gray-800 dark:text-white tracking-tight text-sm">{domain}</div>
                                                <span className="text-[10px] bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full font-bold">{domainContacts.length}</span>
                                            </div>
                                            <div className="text-gray-400">
                                                {expandedDomains[domain] !== false ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
                                            </div>
                                        </button>
                                        {expandedDomains[domain] !== false && (
                                            <div className="px-2 pb-2 space-y-1">
                                                {domainContacts.map(contact => (
                                                    <div key={contact.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-all group">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedContacts.includes(contact.email)}
                                                            onChange={() => {
                                                                setSelectedContacts(prev => prev.includes(contact.email) ? prev.filter(e => e !== contact.email) : [...prev, contact.email]);
                                                            }}
                                                            className="w-4 h-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                                        />
                                                        <div className="w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-sm">
                                                            {contact.name?.substring(0, 1).toUpperCase() || '?'}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-bold text-gray-800 dark:text-gray-200 text-sm truncate">{contact.name}</div>
                                                            <div className="text-[11px] text-gray-500 truncate">{contact.email}</div>
                                                        </div>
                                                        <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => {
                                                                    handleAddRecipientTag('to', contact.email);
                                                                    setShowContactsModal(false);
                                                                }}
                                                                className="bg-emerald-100 text-brand-primary p-2 rounded-lg hover:bg-brand-primary hover:text-white transition-colors"
                                                                title="Escrever E-mail Direto"
                                                            >
                                                                <EnvelopeIcon className="w-4 h-4" />
                                                            </button>
                                                            <button onClick={() => deleteContact(contact.id)} className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-lg transition-colors">
                                                                <TrashIcon className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ));
                            })()}
                        </div>
                        {selectedContacts.length > 0 && (
                            <div className="p-4 bg-brand-primary/5 dark:bg-brand-primary/10 border-t border-brand-primary/10 dark:border-brand-primary/20 flex justify-between items-center animate-fade-in-up flex-shrink-0">
                                <span className="text-sm font-bold text-brand-primary">{selectedContacts.length} contato{selectedContacts.length > 1 ? 's' : ''} selecionado{selectedContacts.length > 1 ? 's' : ''}</span>
                                <button
                                    onClick={() => {
                                        const newCcTags = [...ccTags];
                                        selectedContacts.forEach(email => {
                                            if (!newCcTags.includes(email)) newCcTags.push(email);
                                        });
                                        setCcTags(newCcTags);
                                        setShowCc(true);
                                        setView('compose');
                                        setShowContactsModal(false);
                                        setSelectedContacts([]);
                                    }}
                                    className="bg-brand-primary text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-emerald-600 shrink-0 transition-transform active:scale-95 flex items-center gap-2"
                                >
                                    <EnvelopeIcon className="w-4 h-4" />
                                    Criar Msg em Cópia
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* === Modal View Mode === */}
            {openMode === 'modal' && selectedEmail && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4" onClick={() => setSelectedEmail(null)}>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl border dark:border-white/5 overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
                        {/* Title bar */}
                        <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/40">
                            <h3 className="font-bold text-gray-900 dark:text-white truncate pr-4 text-base">{selectedEmail.subject}</h3>
                            <button onClick={() => setSelectedEmail(null)} className="p-1 hover:bg-gray-250 dark:hover:bg-slate-850 rounded-full transition-colors">
                                <XMarkIcon className="w-6 h-6 text-gray-500" />
                            </button>
                        </div>
                        {/* Details and content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {/* Metadata */}
                            <div className="flex justify-between items-start border-b dark:border-slate-800 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary font-bold">
                                        {selectedEmail.from.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-900 dark:text-white text-sm">{selectedEmail.from}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">Para: {selectedEmail.to || 'mim'}</div>
                                    </div>
                                </div>
                                <div className="text-xs text-gray-400 bg-gray-100 dark:bg-white/5 py-1 px-3 rounded-full">
                                    {new Date(selectedEmail.date).toLocaleString()}
                                </div>
                            </div>
                            {/* Body html */}
                            {loadingBody ? (
                                <div className="flex items-center justify-center h-40">
                                    <ArrowPathIcon className="w-8 h-8 text-gray-400 animate-spin" />
                                    <span className="ml-2 text-gray-400">{t('email.loading_content')}</span>
                                </div>
                            ) : bodyError ? (
                                <div className="text-center py-10 text-red-500">{bodyError}</div>
                            ) : (
                                <div className="bg-white dark:bg-slate-950/20 rounded-xl p-4 sm:p-6 shadow-inner min-h-[300px] overflow-x-auto">
                                    <div
                                        className="prose dark:prose-invert max-w-none text-gray-800 dark:text-gray-200"
                                        dangerouslySetInnerHTML={{
                                            __html: DOMPurify.sanitize(selectedEmail.html || selectedEmail.text || `<div class="text-gray-400 italic">${t('email.no_content')}</div>`, {
                                                RETURN_TRUSTED_TYPE: true,
                                                ADD_TAGS: ['iframe', 'style'],
                                                ADD_ATTR: ['allowfullscreen', 'frameborder', 'scrolling']
                                            }).toString().replace(/src="http:\/\//g, 'src="https://').replace(/href="http:\/\//g, 'href="https://')
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* === Window View Mode === */}
            {openMode === 'window' && selectedEmail && (
                <div 
                    style={{ top: windowPosition.y, left: windowPosition.x }}
                    className="fixed z-[100] w-full max-w-2xl h-[500px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 flex flex-col overflow-hidden animate-scale-in"
                    onMouseDown={handleWindowMouseDown}
                >
                    {/* Window title bar / Drag handle */}
                    <div className="window-title-bar p-3 bg-gray-105 dark:bg-slate-800 flex justify-between items-center cursor-move select-none border-b dark:border-slate-700">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-red-500 cursor-pointer" onClick={() => setSelectedEmail(null)}></span>
                            <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
                            <span className="w-3 h-3 rounded-full bg-green-500"></span>
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-300 ml-2 truncate max-w-[400px]" title={selectedEmail.subject}>
                                {selectedEmail.subject}
                            </span>
                        </div>
                        <button onClick={() => setSelectedEmail(null)} className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-colors">
                            <XMarkIcon className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>
                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {/* Header details */}
                        <div className="flex justify-between items-center text-xs border-b dark:border-slate-800 pb-2">
                            <div className="min-w-0">
                                <span className="font-bold text-gray-700 dark:text-gray-300">De: </span>
                                <span className="text-gray-500 truncate" title={selectedEmail.from}>{selectedEmail.from}</span>
                            </div>
                            <span className="text-gray-400 flex-shrink-0">{new Date(selectedEmail.date).toLocaleDateString()}</span>
                        </div>
                        {/* Body content */}
                        {loadingBody ? (
                            <div className="flex items-center justify-center h-32">
                                <ArrowPathIcon className="w-6 h-6 text-gray-400 animate-spin" />
                            </div>
                        ) : bodyError ? (
                            <div className="text-center py-10 text-red-500 text-xs">{bodyError}</div>
                        ) : (
                            <div className="bg-white dark:bg-slate-950/20 rounded-xl p-4 shadow-inner min-h-[250px] overflow-x-auto text-xs">
                                <div
                                    className="prose dark:prose-invert max-w-none text-gray-800 dark:text-gray-200"
                                    dangerouslySetInnerHTML={{
                                        __html: DOMPurify.sanitize(selectedEmail.html || selectedEmail.text || `<div class="text-gray-400 italic">${t('email.no_content')}</div>`, {
                                            RETURN_TRUSTED_TYPE: true,
                                            ADD_TAGS: ['iframe', 'style'],
                                            ADD_ATTR: ['allowfullscreen', 'frameborder', 'scrolling']
                                        }).toString().replace(/src="http:\/\//g, 'src="https://').replace(/href="http:\/\//g, 'href="https://')
                                    }}
                                />
                            </div>
                        )}
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
