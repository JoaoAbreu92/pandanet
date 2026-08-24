import React, { useState, useEffect } from 'react';
import Card from './Card';
import { 
    EnvelopeIcon, 
    InboxIcon, 
    PaperAirplaneIcon, 
    PencilSquareIcon, 
    TrashIcon, 
    ArchiveBoxIcon, 
    ExclamationCircleIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    MagnifyingGlassIcon,
    ArrowPathIcon,
    StarIcon,
    Cog6ToothIcon,
    Bars3Icon,
    IdentificationIcon,
    PaintBrushIcon,
    PlusIcon,
    XMarkIcon,
    PaperClipIcon,
    FaceSmileIcon,
    EllipsisVerticalIcon,
    ArrowUturnLeftIcon,
    ChatBubbleLeftRightIcon,
    CalendarIcon
} from './icons';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import { supabase } from '../supabaseClient';

interface Email {
    id: string;
    user_id: string;
    company_id: string;
    from_name: string;
    from_email: string;
    subject: string;
    preview: string;
    content: string;
    folder: string;
    is_read: boolean;
    is_starred: boolean;
    created_at: string;
    tags?: Tag[];
    attachments?: { name: string; size: string; type: string }[];
}

interface Tag {
    id: string;
    user_id: string;
    company_id: string;
    label: string;
    color: string;
    bg_color: string;
}

interface EmailServerConfig {
    imap_host: string;
    imap_port: number;
    smtp_host: string;
    smtp_port: number;
    user: string;
    pass: string;
    use_ssl: boolean;
}

interface EmailPageProps {
    onNavigate?: (page: string, context?: any) => void;
}

const EmailPage: React.FC<EmailPageProps> = ({ onNavigate }) => {
    const { currentUser } = useAuth();
    const { addNotification } = useNotifications();
    const [emails, setEmails] = useState<Email[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'inbox' | 'sent' | 'drafts' | 'trash' | 'favorites' | 'settings'>('inbox');
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [composeData, setComposeData] = useState<{ to?: string, subject?: string, body?: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [signature, setSignature] = useState('Atenciosamente,\nEquipe PandaNet');
    const [signatureImage, setSignatureImage] = useState('https://raw.githubusercontent.com/JoaoAbreu92/pandanet/main/public/logo-pandanet.png');
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, emailId: string, type?: 'main' | 'tags' } | null>(null);
    const [mobileView, setMobileView] = useState<'folders' | 'list' | 'reading'>('list');
    const [showPreview, setShowPreview] = useState(true);
    const [groupThreads, setGroupThreads] = useState(false);
    const [attachments, setAttachments] = useState<{ file: File, preview: string, id: string }[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isTagModalOpen, setIsTagModalOpen] = useState(false);
    const [newTagData, setNewTagData] = useState<{ label: string, color: string }>({ label: '', color: '#10B981' });
    const [serverConfig, setServerConfig] = useState<EmailServerConfig>({
        imap_host: '',
        imap_port: 993,
        smtp_host: '',
        smtp_port: 465,
        user: '',
        pass: '',
        use_ssl: true
    });
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const isAdmin = currentUser?.isAdmin || currentUser?.role === 'admin' || currentUser?.role === 'Super Admin';

    // Fetch E-mails e Tags
    const fetchData = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            // Fetch Tags
            const { data: tagsData } = await supabase
                .from('email_tags')
                .select('*')
                .eq('company_id', currentUser.company_id);

            if (tagsData) setTags(tagsData);

            // Fetch E-mails (simplificado por enquanto)
            const { data: emailsData, error } = await supabase
                .from('emails')
                .select('*, tags:email_tag_relations(tag:email_tags(*))')
                .eq('company_id', currentUser.company_id)
                .order('created_at', { ascending: false });

            if (emailsData) {
                const formattedEmails = emailsData.map((e: any) => ({
                    ...e,
                    tags: e.tags?.map((t: any) => t.tag).filter(Boolean) || []
                }));
                setEmails(formattedEmails);
                if (formattedEmails.length > 0) setSelectedEmail(formattedEmails[0]);
            }

            // Carregar configurações de servidor
            const { data: settingsData } = await supabase
                .from('email_settings')
                .select('*')
                .eq('user_id', currentUser.id)
                .single();

            if (settingsData) {
                setServerConfig({
                    imap_host: settingsData.imap_host,
                    imap_port: settingsData.imap_port,
                    smtp_host: settingsData.smtp_host,
                    smtp_port: settingsData.smtp_port,
                    user: settingsData.email_user,
                    pass: settingsData.email_pass,
                    use_ssl: settingsData.use_ssl
                });
            }
        } catch (err) {
            console.error('Erro ao buscar dados:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!currentUser) return;
        fetchData();

        // Real-time Canal
        const channel = supabase
            .channel('email_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'emails' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const newEmail = payload.new as Email;
                    setEmails(prev => [newEmail, ...prev]);
                    addNotification({
                        title: 'Novo E-mail',
                        message: `De: ${newEmail.from_name}`,
                        type: 'message',
                        user_id: currentUser.id
                    });
                } else if (payload.eventType === 'UPDATE') {
                    setEmails(prev => prev.map(e => e.id === payload.new.id ? { ...e, ...payload.new } : e));
                } else if (payload.eventType === 'DELETE') {
                    setEmails(prev => prev.filter(e => e.id === payload.old.id));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUser]);

    const handleContextMenu = (e: React.MouseEvent, emailId: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, emailId });
    };

    const toggleStar = async (emailId: string) => {
        const email = emails.find(e => e.id === emailId);
        if (!email) return;

        setEmails(prev => prev.map(e =>
            e.id === emailId ? { ...e, is_starred: !e.is_starred } : e
        ));

        await supabase
            .from('emails')
            .update({ is_starred: !email.is_starred })
            .eq('id', emailId);
    };

    const setTag = async (emailId: string, tagId?: string) => {
        if (tagId) {
            await supabase
                .from('email_tag_relations')
                .upsert({ email_id: emailId, tag_id: tagId });
        } else {
            await supabase
                .from('email_tag_relations')
                .delete()
                .eq('email_id', emailId);
        }

        setContextMenu(null);
        // Recarregar tags localmente ou via real-time
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSignatureImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleReply = (email: Email, all: boolean = false) => {
        const dateStr = new Date(email.created_at).toLocaleString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Formatação premium do histórico
        const historyHeader = `\n\n\n--- Mensagem Original ---\nDe: ${email.from_name} <${email.from_email}>\nEnviada em: ${dateStr}\nAssunto: ${email.subject}\n\n`;
        const cleanContent = (email.content || '').replace(/<[^>]*>?/gm, ''); // Remove HTML para o reply simples
        const quotedContent = cleanContent
            .split('\n')
            .map(line => `> ${line}`)
            .join('\n');

        setComposeData({
            to: all ? `${email.from_email}, ${currentUser?.email}` : email.from_email,
            subject: (email.subject || '').startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
            body: historyHeader + quotedContent
        });
        setIsComposeOpen(true);
        setContextMenu(null);
    };

    const handleCreateTag = async () => {
        if (!currentUser || !newTagData.label) return;
        const { data, error } = await supabase
            .from('email_tags')
            .insert({
                label: newTagData.label,
                color: newTagData.color,
                company_id: currentUser.company_id,
                user_id: currentUser.id
            })
            .select()
            .single();

        if (data) {
            setTags(prev => [...prev, data]);
            setNewTagData({ label: '', color: '#10B981' });
            setIsTagModalOpen(false);
        }
    };

    const handleScheduleEvent = (email: Email) => {
        if (onNavigate) {
            onNavigate('calendar', {
                title: email.subject,
                notes: `Agendado a partir do e-mail de ${email.from_name}.\n\n--- Conteúdo ---\n${email.preview}`
            });
        }
    };

    const handleSelectEmail = async (email: Email) => {
        setSelectedEmail(email);
        setMobileView('reading');

        if (!email.is_read) {
            setEmails(prev => prev.map(e => e.id === email.id ? { ...e, is_read: true } : e));
            await supabase.from('emails').update({ is_read: true }).eq('id', email.id);
        }
    };

    const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files: File[] = Array.from(e.target.files || []);
        files.forEach((file: File) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAttachments((prev: { file: File; preview: string; id: string }[]) => [...prev, {
                    file,
                    preview: file.type.startsWith('image/') ? reader.result as string : '',
                    id: Math.random().toString(36).substring(7)
                }]);
            };
            if (file.type.startsWith('image/')) {
                reader.readAsDataURL(file);
            } else {
                setAttachments((prev: { file: File; preview: string; id: string }[]) => [...prev, {
                    file,
                    preview: '',
                    id: Math.random().toString(36).substring(7)
                }]);
            }
        });
    };

    const handleTestConnection = async () => {
        setIsTestingConnection(true);
        try {
            const { data, error } = await supabase.functions.invoke('email-handler', {
                body: {
                    action: 'test-connection',
                    settings: serverConfig
                }
            });

            if (error || !data.success) throw new Error(error?.message || data?.error || 'Falha na conexão');

            addNotification({
                title: 'Conexão Testada',
                message: 'Conectado com sucesso!',
                type: 'success',
                user_id: currentUser?.id || ''
            });
        } catch (err: any) {
            addNotification({
                title: 'Erro de Conexão',
                message: err.message || 'Não foi possível conectar ao servidor.',
                type: 'error',
                user_id: currentUser?.id || ''
            });
        } finally {
            setIsTestingConnection(false);
        }
    };

    const handleSyncEmails = async () => {
        if (!currentUser || !serverConfig.imap_host) return;
        setIsSyncing(true);
        try {
            const { data, error } = await supabase.functions.invoke('email-handler', {
                body: {
                    action: 'sync-emails',
                    settings: {
                        ...serverConfig,
                        user_id: currentUser.id,
                        company_id: currentUser.company_id
                    }
                }
            });

            if (error || !data.success) throw new Error(error?.message || data?.error || 'Falha na sincronização');

            addNotification({
                title: 'Sincronização Concluída',
                message: `${data.count} e-mails sincronizados com sucesso.`,
                type: 'success',
                user_id: currentUser.id
            });

            // Recarregar a lista local
            fetchData();
        } catch (err: any) {
            console.error('Sync Error:', err);
            addNotification({
                title: 'Erro na Sincronização',
                message: err.message || 'Não foi possível sincronizar seus e-mails.',
                type: 'error',
                user_id: currentUser.id
            });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSaveServerConfig = async () => {
        if (!currentUser) return;

        const { error } = await supabase
            .from('email_settings')
            .upsert({
                user_id: currentUser.id,
                company_id: currentUser.company_id,
                imap_host: serverConfig.imap_host,
                imap_port: serverConfig.imap_port,
                smtp_host: serverConfig.smtp_host,
                smtp_port: serverConfig.smtp_port,
                email_user: serverConfig.user,
                email_pass: serverConfig.pass,
                use_ssl: serverConfig.use_ssl,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (!error) {
            addNotification({
                title: 'Configurações Salvas',
                message: 'Suas configurações de servidor foram atualizadas.',
                type: 'success',
                user_id: currentUser.id
            });
        } else {
            console.error('Erro ao salvar configurações:', error);
            addNotification({
                title: 'Erro ao Salvar',
                message: 'Não foi possível salvar as configurações de e-mail.',
                type: 'error',
                user_id: currentUser.id
            });
        }
    };

    const removeAttachment = (id: string) => {
        setAttachments(prev => prev.filter(a => a.id !== id));
    };

    // Auto-save logic
    useEffect(() => {
        if (!isComposeOpen || !composeData || activeTab === 'settings') return;

        const timer = setTimeout(async () => {
            setIsSaving(true);
            try {
                // Aqui salvaríamos o rascunho no Supabase
                // const { data } = await supabase.from('emails').upsert({...})
                setLastSaved(new Date());
            } finally {
                setIsSaving(false);
            }
        }, 3000);

        return () => clearTimeout(timer);
    }, [composeData, isComposeOpen]);

    const handleSendEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser || !composeData?.to) return;

        const newEmail = {
            user_id: currentUser.id,
            company_id: currentUser.company_id,
            from_name: currentUser.name,
            from_email: currentUser.email,
            subject: composeData.subject || '(Sem assunto)',
            content: composeData.body || '',
            preview: composeData.body?.substring(0, 100) || '',
            folder: 'sent',
            is_read: true,
            is_starred: false
        };

        const { data, error } = await supabase
            .from('emails')
            .insert({
                ...newEmail,
                attachments: (attachments as { file: File; preview: string; id: string }[]).map(a => ({
                    name: a.file.name,
                    size: (a.file.size / 1024).toFixed(1) + ' KB',
                    type: a.file.type
                }))
            })
            .select()
            .single();

        if (!error && data) {
            // Se as configurações de servidor estiverem preenchidas, tenta enviar via SMTP real
            if (serverConfig.smtp_host && serverConfig.user && serverConfig.pass) {
                await supabase.functions.invoke('email-handler', {
                    body: {
                        action: 'send-email',
                        settings: serverConfig,
                        emailData: {
                            ...newEmail,
                            body: newEmail.content
                        }
                    }
                });
            }

            setEmails(prev => [data, ...prev]);
            setIsComposeOpen(false);
            setComposeData(null);
            setAttachments([]);
            addNotification({
                title: 'E-mail Enviado',
                message: 'Sua mensagem foi enviada com sucesso.',
                type: 'success',
                user_id: currentUser.id
            });
        }
    };

    const filteredEmails = emails.filter(email => {
        if (activeTab === 'favorites') return email.is_starred;
        if (activeTab === 'inbox') return email.folder === 'inbox';
        if (activeTab === 'sent') return email.folder === 'sent';
        if (activeTab === 'trash') return email.folder === 'trash';
        return true;
    }).filter(email =>
        email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        email.from_name.toLowerCase().includes(searchQuery.toLowerCase())
    );


    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-black text-brand-text flex items-center gap-3 tracking-tight">
                    <div className="p-2 bg-brand-primary/10 rounded-xl">
                        <EnvelopeIcon className="w-6 h-6 text-brand-primary" />
                    </div>
                    E-mail Corporativo
                </h1>
                <button 
                    onClick={() => setIsComposeOpen(true)}
                    className="flex items-center gap-2 bg-brand-primary text-white px-6 py-2.5 rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-brand-primary/20 hover:scale-[1.02] active:scale-[0.98]"
                >
                    <PlusIcon className="w-5 h-5" />
                    Novo E-mail
                </button>
            </div>

            <Card noPadding hideTypeBorder className="flex-1 overflow-hidden border-gray-100/50 shadow-2xl shadow-brand-primary/5">
                <div className="flex flex-row h-full w-full overflow-hidden">
                    {/* Coluna 1: Barra Lateral */}
                    <div className={`w-64 shrink-0 border-r border-gray-50 flex flex-col bg-gray-50/30 ${mobileView !== 'folders' ? 'hidden md:flex' : 'flex w-full'}`}>
                        <div className="p-4 flex flex-col gap-1 flex-1">
                            {[
                                { id: 'inbox', label: 'Entrada', icon: InboxIcon, badge: 2 },
                                { id: 'sent', label: 'Enviados', icon: PaperAirplaneIcon },
                                { id: 'drafts', label: 'Rascunhos', icon: PencilSquareIcon },
                                { id: 'trash', label: 'Lixeira', icon: TrashIcon },
                                { id: 'favorites', label: 'Favoritos', icon: StarIcon, iconClass: 'text-amber-500' }
                            ].map(item => (
                                <button 
                                    key={item.id}
                                    onClick={() => {
                                        setActiveTab(item.id as any);
                                        if (window.innerWidth < 768) setMobileView('list');
                                    }}
                                    className={`flex items-center justify-between p-3 rounded-xl transition-all group ${activeTab === item.id ? 'bg-brand-primary text-white font-bold shadow-md shadow-brand-primary/20' : 'text-gray-500 hover:bg-white hover:text-brand-primary'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <item.icon className={`w-5 h-5 ${item.iconClass || (activeTab === item.id ? 'text-white' : 'text-gray-400 group-hover:text-brand-primary')}`} />
                                        <span>{item.label}</span>
                                    </div>
                                    {item.badge && (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === item.id ? 'bg-white text-brand-primary' : 'bg-brand-primary text-white'}`}>{item.badge}</span>
                                    )}
                                </button>
                            ))}

                            <div className="mt-4 pt-4 border-t border-gray-100/50">
                                <button
                                    onClick={handleSyncEmails}
                                    disabled={isSyncing}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all font-bold ${isSyncing ? 'text-gray-400' : 'text-emerald-600 hover:bg-emerald-50'}`}
                                >
                                    <ArrowPathIcon className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                                    <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}</span>
                                </button>

                                <button
                                    onClick={() => setActiveTab('settings')}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all mt-1 ${activeTab === 'settings' ? 'bg-brand-primary text-white font-bold shadow-md shadow-brand-primary/20' : 'text-gray-500 hover:bg-white hover:text-brand-primary'}`}
                                >
                                    <Cog6ToothIcon className={`w-5 h-5 ${activeTab === 'settings' ? 'text-white' : 'text-gray-400'}`} />
                                    <span>Configurações</span>
                                </button>
                            </div>
                        </div>

                        <div className="p-4 mt-auto border-t border-gray-100/50">
                            <div className="bg-white/50 rounded-2xl p-3 border border-gray-100">
                                <div className="flex justify-between items-center text-[10px] text-gray-400 uppercase font-black tracking-widest mb-3">
                                    <span>Conta Ativa</span>
                                    {isAdmin && <PlusIcon className="w-3.5 h-3.5 cursor-pointer hover:text-brand-primary" />}
                            </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-brand-primary flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                    {currentUser?.name?.charAt(0) || 'U'}
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                        <span className="text-[11px] font-bold text-gray-900 truncate tracking-tight">{currentUser?.email}</span>
                                        <div className="flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider">Online</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                </div>

                {/* Coluna 2: Lista de E-mails */}
                    {/* Coluna 2: Lista de E-mails - Oculta quando em configurações ou lendo e-mail no mobile */}
                    {activeTab !== 'settings' && (
                        <div className={`w-full md:w-[380px] flex flex-col border-r border-gray-50 bg-white ${mobileView !== 'list' ? 'hidden md:flex' : 'flex'}`}>
                            <div className="p-4 border-b border-gray-50 flex items-center gap-3">
                            <button
                                onClick={() => setMobileView('folders')}
                                    className="md:hidden p-2 hover:bg-gray-100 rounded-lg text-gray-400"
                            >
                                <Bars3Icon className="w-5 h-5" />
                            </button>
                            <div className="relative flex-1">
                                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                        type="text"
                                    placeholder="Pesquisar..."
                                        className="w-full bg-gray-50/50 border-gray-100/50 rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-2 focus:ring-brand-primary focus:bg-white transition-all outline-none"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto no-scrollbar">
                                <div className="divide-y divide-gray-50/50">
                                    {filteredEmails.length > 0 ? filteredEmails.map((email) => {
                                        const mainTag = email.tags?.[0];
                                        return (
                                            <div
                                                key={email.id}
                                                onClick={() => handleSelectEmail(email)}
                                                onContextMenu={(e) => handleContextMenu(e, email.id)}
                                                className={`p-4 cursor-pointer transition-all hover:bg-gray-50 group border-l-[3px] relative ${selectedEmail?.id === email.id ? 'bg-brand-primary/[0.03] border-brand-primary' : 'border-transparent'}`}
                                            >
                                                <div className="flex justify-between items-start mb-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xs ${!email.is_read ? 'font-black text-gray-900' : 'text-gray-500 font-medium'}`}>
                                                            {email.from_name}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-gray-400 font-bold tabular-nums">
                                                        {new Date(email.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <h3 className={`text-xs truncate mb-1 shadow-none border-none ${!email.is_read ? 'font-black text-brand-text' : 'text-gray-600 font-medium'}`}>
                                                    {email.subject}
                                                </h3>
                                                <p className="text-[11px] text-gray-400 line-clamp-1 leading-relaxed">
                                                    {showPreview ? email.preview : '...'}
                                                </p>

                                                <div className="mt-2.5 flex items-center justify-between">
                                                    <div className="flex gap-1">
                                                        {email.tags?.map(tag => (
                                                            <span
                                                                key={tag.id}
                                                                className="text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter"
                                                                style={{ backgroundColor: tag.color + '20', color: tag.color }}
                                                            >
                                                                {tag.label}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {email.attachments && <PaperClipIcon className="w-3.5 h-3.5 text-gray-300" />}
                                                        <button onClick={(e) => { e.stopPropagation(); toggleStar(email.id); }}>
                                                            {email.is_starred ? (
                                                                <StarIcon className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                                                            ) : (
                                                                <StarIcon className="w-3.5 h-3.5 text-gray-200 hover:text-amber-400 transition-colors" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }) : (
                                        <div className="p-12 text-center text-gray-300">
                                            <InboxIcon className="w-8 h-8 mx-auto mb-3 opacity-20" />
                                            <p className="text-xs font-bold uppercase tracking-widest">Nenhuma mensagem</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                {/* Coluna 3: Leitura ou Configurações */}
                    <div className={`flex-1 flex flex-col min-w-0 overflow-hidden bg-white ${mobileView !== 'reading' && activeTab !== 'settings' ? 'hidden md:flex' : 'flex'}`}>
                    {activeTab === 'settings' ? (
                            <div className="flex-1 overflow-y-auto bg-gray-50/10">
                                <div className="p-8 pb-32 space-y-8 max-w-5xl mx-auto">
                                <div className="flex items-center gap-4 mb-2">
                                    <div className="p-3 bg-brand-primary/10 rounded-2xl text-brand-primary">
                                        <Cog6ToothIcon className="w-8 h-8" />
                                    </div>
                                    <div>
                                            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Configurações</h2>
                                            <p className="text-sm text-gray-400 font-medium">Personalize sua experiência de e-mail corporativo</p>
                                    </div>
                                </div>

                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                    {/* Perfil e Identidade */}
                                        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
                                            <h3 className="font-black flex items-center gap-2 text-gray-700 tracking-tight">
                                            <IdentificationIcon className="w-5 h-5 text-brand-primary" />
                                            Identidade e Assinatura
                                        </h3>
                                        <div className="space-y-4">
                                            <div className="flex flex-col gap-1.5">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Assinatura do E-mail</label>
                                                <textarea
                                                    value={signature}
                                                    onChange={(e) => setSignature(e.target.value)}
                                                        className="w-full h-24 p-3 text-xs border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-transparent bg-gray-50/50 resize-none outline-none"
                                                    placeholder="Digite sua assinatura aqui..."
                                                />
                                                    <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase mt-2">Imagem da Assinatura</label>
                                                    <label className="w-full cursor-pointer bg-white border-2 border-dashed border-gray-100 px-4 py-6 rounded-2xl text-xs font-bold text-gray-400 hover:text-brand-primary hover:border-brand-primary hover:bg-brand-primary/5 transition-all flex flex-col items-center justify-center gap-2">
                                                        <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-white transition-colors">
                                                            <PlusIcon className="w-5 h-5" />
                                                        </div>
                                                        <span>Clique para Carregar Logo</span>
                                                        <input
                                                            type="file"
                                                            className="hidden"
                                                            accept="image/*"
                                                            onChange={handleImageUpload}
                                                        />
                                                    </label>
                                                {signatureImage && (
                                                        <div className="mt-3 p-3 border border-gray-100 rounded-xl bg-white shadow-sm self-start">
                                                        <img src={signatureImage} alt="Preview" className="max-h-12 object-contain" />
                                                    </div>
                                                )}
                                                    <p className="text-[10px] text-gray-400 italic mt-3 bg-gray-50 p-2 rounded-lg">Sua assinatura será anexada automaticamente ao final de novos e-mails.</p>
                                            </div>
                                        </div>
                                        </div>

                                    {/* Marcadores e Tags */}
                                        <div className="space-y-6">
                                            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <h3 className="font-black flex items-center gap-2 text-gray-700 tracking-tight">
                                                        <PaintBrushIcon className="w-5 h-5 text-brand-primary" />
                                                        Marcadores de Organização
                                                    </h3>
                                                    <button
                                                        onClick={() => setIsTagModalOpen(true)}
                                                        className="text-[10px] font-black uppercase text-brand-primary hover:text-emerald-600 transition-colors"
                                                    >
                                                        + Novo
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {tags.map(tag => (
                                                        <div key={tag.id} className="flex items-center justify-between p-2 rounded-xl border border-gray-50 bg-gray-50/30">
                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                                                                <span className="text-[11px] font-bold text-gray-600 truncate">{tag.label}</span>
                                                            </div>
                                                        <button
                                                            onClick={async () => {
                                                                await supabase.from('email_tags').delete().eq('id', tag.id);
                                                                setTags(prev => prev.filter(t => t.id !== tag.id));
                                                            }}
                                                                className="text-gray-300 hover:text-red-500 transition-colors"
                                                        >
                                                                <XMarkIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Configuração de Servidor IMAP/SMTP */}
                                            <div className="bg-white rounded-3xl p-6 border-2 border-brand-primary/20 shadow-xl shadow-brand-primary/5 space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <h3 className="font-black flex items-center gap-2 text-gray-700 tracking-tight">
                                                        <ArrowPathIcon className="w-5 h-5 text-brand-primary" />
                                                        Conexão com Servidor
                                                    </h3>
                                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-[9px] font-black rounded-full uppercase tracking-widest">Ativo</span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Servidor IMAP</label>
                                                        <input
                                                            type="text"
                                                            placeholder="imap.hostinger.com"
                                                            className="w-full p-2.5 text-xs border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary bg-gray-50/50 outline-none"
                                                            value={serverConfig.imap_host}
                                                            onChange={(e) => setServerConfig(prev => ({ ...prev, imap_host: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Porta IMAP</label>
                                                        <input
                                                            type="number"
                                                            className="w-full p-2.5 text-xs border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary bg-gray-50/50 outline-none"
                                                            value={serverConfig.imap_port}
                                                            onChange={(e) => setServerConfig(prev => ({ ...prev, imap_port: parseInt(e.target.value) }))}
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Servidor SMTP</label>
                                                        <input
                                                            type="text"
                                                            placeholder="smtp.hostinger.com"
                                                            className="w-full p-2.5 text-xs border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary bg-gray-50/50 outline-none"
                                                            value={serverConfig.smtp_host}
                                                            onChange={(e) => setServerConfig(prev => ({ ...prev, smtp_host: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Porta SMTP</label>
                                                        <input
                                                            type="number"
                                                            className="w-full p-2.5 text-xs border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary bg-gray-50/50 outline-none"
                                                            value={serverConfig.smtp_port}
                                                            onChange={(e) => setServerConfig(prev => ({ ...prev, smtp_port: parseInt(e.target.value) }))}
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1.5 col-span-2">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">E-mail Corporativo</label>
                                                        <input
                                                            type="email"
                                                            placeholder="exemplo@pixel.com.br"
                                                            className="w-full p-2.5 text-xs border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary bg-gray-50/50 outline-none"
                                                            value={serverConfig.user}
                                                            onChange={(e) => setServerConfig(prev => ({ ...prev, user: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1.5 col-span-2">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Senha de Acesso</label>
                                                        <input
                                                            type="password"
                                                            placeholder="••••••••••••"
                                                            className="w-full p-2.5 text-xs border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary bg-gray-50/50 outline-none font-sans"
                                                            value={serverConfig.pass}
                                                            onChange={(e) => setServerConfig(prev => ({ ...prev, pass: e.target.value }))}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex gap-2 pt-2">
                                                <button
                                                        onClick={handleTestConnection}
                                                        disabled={isTestingConnection}
                                                        className="flex-1 py-3 border-2 border-gray-100 text-gray-600 font-black rounded-xl hover:bg-gray-50 transition-all text-[10px] uppercase tracking-widest disabled:opacity-50"
                                                >
                                                        {isTestingConnection ? '...' : 'Testar'}
                                                    </button>
                                                <button
                                                        onClick={handleSaveServerConfig}
                                                        className="flex-[2] py-3 bg-brand-primary text-white font-black rounded-xl hover:bg-emerald-600 transition-all text-[10px] uppercase tracking-widest shadow-lg shadow-brand-primary/20"
                                                >
                                                        Salvar Alterações
                                                </button>
                                            </div>
                                                <p className="text-[9px] text-gray-400 text-center font-bold italic tracking-wide">As credenciais são armazenadas de forma segura e criptografada.</p>
                                            </div>
                                        </div>

                                        {/* Opções extras em uma linha única */}
                                        <div className="col-span-1 xl:col-span-2 bg-gray-50/50 rounded-2xl p-4 flex flex-wrap gap-6 items-center border border-gray-100">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-4 rounded-full relative transition-colors cursor-pointer ${showPreview ? 'bg-brand-primary' : 'bg-gray-300'}`} onClick={() => setShowPreview(!showPreview)}>
                                                    <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${showPreview ? 'left-[18px]' : 'left-0.5'}`} />
                                                </div>
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Mostrar Prévias</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-4 rounded-full relative transition-colors cursor-pointer ${groupThreads ? 'bg-brand-primary' : 'bg-gray-300'}`} onClick={() => setGroupThreads(!groupThreads)}>
                                                    <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${groupThreads ? 'left-[18px]' : 'left-0.5'}`} />
                                                </div>
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Agrupar Conversas</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                    ) : selectedEmail ? (
                                <div className="h-full w-full flex flex-col overflow-hidden">
                                    {/* Toolbar de Leitura */}
                                    <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-white">
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => setMobileView('list')} className="md:hidden p-2 hover:bg-gray-50 rounded-lg text-gray-400"><ChevronLeftIcon className="w-5 h-5" /></button>
                                            <button className="p-2 hover:bg-red-50 rounded-xl text-gray-400 hover:text-red-500 transition-all" title="Excluir"><TrashIcon className="w-5 h-5" /></button>
                                            <button className="p-2 hover:bg-amber-50 rounded-xl text-gray-400 hover:text-amber-500 transition-all" title="Arquivar"><ArchiveBoxIcon className="w-5 h-5" /></button>
                                            <div className="w-px h-5 bg-gray-100 mx-2" />
                                            <button onClick={() => handleScheduleEvent(selectedEmail)} className="flex items-center gap-2 p-2 hover:bg-indigo-50 rounded-xl text-gray-400 hover:text-indigo-600 transition-all group" title="Agendar"><CalendarIcon className="w-5 h-5" /></button>
                                </div>
                                        <div className="flex items-center gap-1">
                                            <button className="p-2 hover:bg-gray-50 rounded-xl text-gray-400 transition-all"><ChevronLeftIcon className="w-5 h-5" /></button>
                                            <button className="p-2 hover:bg-gray-50 rounded-xl text-gray-400 transition-all"><ChevronRightIcon className="w-5 h-5" /></button>
                                </div>
                            </div>

                                    {/* Conteúdo do E-mail */}
                                    <div className="flex-1 overflow-y-auto p-10 space-y-8 bg-white no-scrollbar">
                                        <header className="space-y-6">
                                            <h2 className="text-3xl font-black text-gray-900 tracking-tight leading-tight">{selectedEmail.subject}</h2>
                                            <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-brand-primary text-white flex items-center justify-center font-black text-xl shadow-lg shadow-brand-primary/20">
                                                        {selectedEmail.from_name.charAt(0)}
                                                    </div>
                                            <div className="flex flex-col">
                                                        <span className="font-black text-gray-900 leading-none">{selectedEmail.from_name}</span>
                                                        <span className="text-xs text-gray-400 font-medium">{selectedEmail.from_email}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{new Date(selectedEmail.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })} às {new Date(selectedEmail.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleReply(selectedEmail)} className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-md shadow-brand-primary/10"><ArrowUturnLeftIcon className="w-3.5 h-3.5" /> Responder</button>
                                                <button onClick={() => handleReply(selectedEmail, true)} className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all border border-gray-100"><ChatBubbleLeftRightIcon className="w-3.5 h-3.5" /> Responder Todos</button>
                                            </div>
                                        </header>

                                        <article className="prose prose-sm max-w-none text-gray-600 leading-relaxed font-medium bg-gray-50/30 p-8 rounded-3xl border border-gray-50"
                                            dangerouslySetInnerHTML={{ __html: selectedEmail.content }} />

                                    {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                                            <div className="space-y-4">
                                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                <PaperClipIcon className="w-4 h-4" />
                                                Anexos ({selectedEmail.attachments.length})
                                            </h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {selectedEmail.attachments.map((file: any, idx: number) => (
                                                        <div key={idx} className="group relative flex items-center gap-3 p-3 rounded-2xl border border-gray-100 bg-white hover:border-brand-primary/50 transition-all cursor-pointer shadow-sm">
                                                            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-brand-primary shrink-0 border border-gray-100">
                                                                <PaperClipIcon className="w-5 h-5 opacity-40" />
                                                            </div>
                                                            <div className="flex flex-col min-w-0 flex-1">
                                                                <span className="text-[11px] font-black text-gray-900 truncate tracking-tight">{file.name}</span>
                                                                <span className="text-[9px] text-gray-400 font-bold uppercase">{file.size}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                                    {/* Campo de Resposta Rápida Integrado */}
                                    <div className="p-6 border-t border-gray-50 bg-white">
                                        <div className="flex items-center gap-3 bg-gray-50 rounded-2xl p-2.5 border border-gray-100 focus-within:ring-2 focus-within:ring-brand-primary/20 focus-within:bg-white transition-all">
                                            <div className="w-8 h-8 rounded-lg bg-gray-200 animate-pulse hidden sm:flex" />
                                    <input 
                                        type="text" 
                                                placeholder="Resposta rápida..."
                                                className="flex-1 border-none focus:ring-0 text-sm bg-transparent outline-none"
                                    />
                                    <button className="bg-brand-primary text-white p-2 rounded-xl hover:bg-emerald-600 transition-all shadow-md">
                                        <PaperAirplaneIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                                </div>
                    ) : (
                                    <div className="h-full w-full flex items-center justify-center text-gray-300 flex-col gap-4 bg-gray-50/30">
                                        <div className="w-24 h-24 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-inner">
                                            <EnvelopeIcon className="w-10 h-10 opacity-20" />
                            </div>
                                        <p className="text-xs font-black uppercase tracking-[0.2em]">Selecione uma mensagem</p>
                                    </div>
                    )}
                </div>
            </div>
            </Card>

            {/* Menu de Contexto Expandido */}

            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-[140]" onClick={() => setContextMenu(null)} />
                    <div
                        className="fixed z-[150] bg-white shadow-2xl rounded-xl border border-gray-100 p-2 min-w-[220px] animate-in fade-in zoom-in duration-200"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        {contextMenu.type === 'tags' ? (
                            <>
                                <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-50 mb-1">
                                    <button onClick={() => setContextMenu({ ...contextMenu, type: 'main' })} className="p-1 hover:bg-gray-100 rounded">
                                        <ChevronLeftIcon className="w-4 h-4 text-gray-400" />
                                    </button>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Etiquetas</span>
                        </div>
                                {tags.map(tag => (
                            <button
                                key={tag.id}
                                onClick={() => setTag(contextMenu.emailId, tag.id)}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-all text-sm group"
                            >
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                                <span className="flex-1 text-left">{tag.label}</span>
                            </button>
                        ))}
                        <button
                            onClick={() => setTag(contextMenu.emailId, undefined)}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 text-red-500 transition-all text-sm mt-1 border-t border-gray-50 pt-2"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                    <span>Remover Etiqueta</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50 mb-1">
                                    Ações
                                </div>
                                <button
                                    onClick={() => {
                                        const email = emails.find(e => e.id === contextMenu.emailId);
                                        if (email) handleReply(email);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-brand-primary/10 hover:text-brand-primary transition-all text-sm"
                                >
                                    <ArrowUturnLeftIcon className="w-4 h-4" />
                                    <span>Responder</span>
                                </button>
                                <button
                                    onClick={() => {
                                        const email = emails.find(e => e.id === contextMenu.emailId);
                                        if (email) handleReply(email, true);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-brand-primary/10 hover:text-brand-primary transition-all text-sm"
                                >
                                    <ChatBubbleLeftRightIcon className="w-4 h-4" />
                                    <span>Responder Todos</span>
                                </button>

                                <button
                                    onClick={async () => {
                                        const email = emails.find(e => e.id === contextMenu.emailId);
                                        if (email) {
                                            const newStatus = !email.is_read;
                                            setEmails(prev => prev.map(ev => ev.id === email.id ? { ...ev, is_read: newStatus } : ev));
                                            await supabase.from('emails').update({ is_read: newStatus }).eq('id', email.id);
                                        }
                                        setContextMenu(null);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-all text-sm"
                                >
                                    <EnvelopeIcon className="w-4 h-4 text-gray-400" />
                                    <span>Marcar como {emails.find(e => e.id === contextMenu.emailId)?.is_read ? 'Não Lida' : 'Lida'}</span>
                                </button>

                                <div className="my-1 border-t border-gray-50" />

                                <button
                                    onClick={() => setContextMenu({ ...contextMenu, type: 'tags' })}
                                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 transition-all text-sm"
                                >
                                    <div className="flex items-center gap-3">
                                        <PaintBrushIcon className="w-4 h-4 text-gray-400" />
                                        <span>Marcar como...</span>
                                    </div>
                                    <ChevronRightIcon className="w-4 h-4 text-gray-300" />
                                </button>

                                <button
                                    onClick={async () => {
                                        await supabase.from('emails').update({ folder: 'trash' }).eq('id', contextMenu.emailId);
                                        setEmails(prev => prev.map(e => e.id === contextMenu.emailId ? { ...e, folder: 'trash' } : e));
                                        setContextMenu(null);
                                    }}
                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 text-red-500 transition-all text-sm mt-1"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                        <span>Mover para Lixeira</span>
                                    </button>
                            </>
                        )}
                    </div>
                </>
            )}

            {/* Modal de Composição */}
            {isComposeOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-end justify-end p-6 pointer-events-none">
                    <Card className="w-full max-w-2xl h-[600px] shadow-2xl flex flex-col overflow-hidden pointer-events-auto animate-in slide-in-from-bottom duration-300">
                        <form onSubmit={handleSendEmail} className="flex flex-col h-full bg-white relative">
                            <div className="p-4 bg-brand-primary text-white flex justify-between items-center">
                                <h3 className="font-bold">Nova Mensagem</h3>
                                <div className="flex items-center gap-2">
                                    <button type="button" className="p-1 hover:bg-white/20 rounded transition-all" onClick={() => setIsComposeOpen(false)}><XMarkIcon className="w-5 h-5" /></button>
                                </div>
                            </div>
                            <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                                <span className="text-gray-400 text-sm font-bold min-w-[60px]">Para:</span>
                                <input
                                    type="text"
                                    className="flex-1 border-none focus:ring-0 text-sm"
                                    placeholder="nome@exemplo.com"
                                    value={composeData?.to || ''}
                                    onChange={(e) => setComposeData(prev => ({ ...prev, to: e.target.value }))}
                                />
                            </div>
                            <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                                <span className="text-gray-400 text-sm font-bold min-w-[60px]">Assunto:</span>
                                <input
                                    type="text"
                                    className="flex-1 border-none focus:ring-0 text-sm"
                                    placeholder="Digite o assunto"
                                    value={composeData?.subject || ''}
                                    onChange={(e) => setComposeData(prev => ({ ...prev, subject: e.target.value }))}
                                />
                            </div>
                            <div className="flex-1 p-6 overflow-y-auto no-scrollbar">
                                <textarea
                                    className="w-full h-40 border-none focus:ring-0 resize-none text-sm placeholder:text-gray-300"
                                    placeholder="Escreva sua mensagem aqui..."
                                    value={composeData?.body || ''}
                                    onChange={(e) => setComposeData(prev => ({ ...prev, body: e.target.value }))}
                                />

                                {/* Miniaturas de Anexos no Compose */}
                                {attachments.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-4 p-2 bg-gray-50 rounded-xl">
                                        {attachments.map((att) => (
                                            <div key={att.id} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-white">
                                                {att.preview ? (
                                                    <img src={att.preview} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-400">
                                                        <PaperClipIcon className="w-6 h-6" />
                                                    </div>
                                                )}
                                                <button
                                                    onClick={() => removeAttachment(att.id)}
                                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <XMarkIcon className="w-3 h-3" />
                                                </button>
                                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] px-1 truncate">
                                                    {att.file.name}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {signatureImage && (
                                    <div className="mt-4 opacity-80 grayscale hover:grayscale-0 transition-all border-t border-gray-50 pt-4">
                                        <div className="text-sm text-gray-500 mb-2 whitespace-pre-wrap">{signature}</div>
                                        <img src={signatureImage} alt="Assinatura" className="max-h-16 object-contain" />
                                    </div>
                                )}
                            </div>
                            <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <label className="p-2 hover:bg-white rounded-lg text-gray-500 hover:text-brand-primary transition-all cursor-pointer">
                                        <PaperClipIcon className="w-5 h-5" />
                                        <input type="file" multiple className="hidden" onChange={handleFileAttach} />
                                    </label>
                                    <div className="h-4 w-px bg-gray-200 mx-1" />
                                    <div className="flex items-center gap-1.5 px-2">
                                        {isSaving ? (
                                            <span className="text-[10px] text-gray-400 animate-pulse">Salvando...</span>
                                        ) : lastSaved ? (
                                            <span className="text-[10px] text-gray-400">Salvo às {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        ) : null}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setIsComposeOpen(false);
                                            setComposeData(null);
                                        }}
                                        className="px-6 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-white rounded-xl transition-all"
                                    >
                                        Descartar
                                    </button>
                                    <button type="submit" className="flex items-center gap-2 bg-brand-primary text-white px-8 py-2.5 rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-brand-primary/20">
                                        Enviar
                                        <PaperAirplaneIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {/* Modal de Gestão de Etiquetas */}
            {isTagModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
                    <Card className="w-full max-w-sm p-6 space-y-4 animate-in zoom-in duration-300">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-gray-900">Novo Marcador</h3>
                            <button onClick={() => setIsTagModalOpen(false)} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Nome</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Urgente, Financeiro..."
                                    className="w-full p-2.5 text-sm border-gray-100 rounded-xl focus:ring-brand-primary bg-gray-50/50"
                                    value={newTagData.label}
                                    onChange={(e) => setNewTagData(prev => ({ ...prev, label: e.target.value }))}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Cor</label>
                                <div className="flex flex-wrap gap-2">
                                    {['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#6B7280'].map(color => (
                                        <button
                                            key={color}
                                            onClick={() => setNewTagData(prev => ({ ...prev, color }))}
                                            className={`w-8 h-8 rounded-full border-2 transition-all ${newTagData.color === color ? 'border-brand-text scale-110 shadow-lg' : 'border-transparent opacity-80 hover:opacity-100'}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>
                            <button
                                onClick={handleCreateTag}
                                className="w-full py-3 bg-brand-primary text-white font-bold rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-brand-primary/20"
                            >
                                Criar Marcador
                            </button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default EmailPage;
