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

    const isAdmin = currentUser?.isAdmin || currentUser?.role === 'admin' || currentUser?.role === 'Super Admin';

    // Fetch E-mails e Tags
    useEffect(() => {
        if (!currentUser) return;

        const fetchData = async () => {
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
            } catch (err) {
                console.error('Erro ao buscar dados:', err);
            } finally {
                setLoading(false);
            }
        };

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
        const files = Array.from(e.target.files || []);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAttachments(prev => [...prev, {
                    file,
                    preview: file.type.startsWith('image/') ? reader.result as string : '',
                    id: Math.random().toString(36).substring(7)
                }]);
            };
            if (file.type.startsWith('image/')) {
                reader.readAsDataURL(file);
            } else {
                setAttachments(prev => [...prev, {
                    file,
                    preview: '',
                    id: Math.random().toString(36).substring(7)
                }]);
            }
        });
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
                attachments: attachments.map((a: { file: File; preview: string; id: string }) => ({
                    name: a.file.name,
                    size: (a.file.size / 1024).toFixed(1) + ' KB',
                    type: a.file.type
                }))
            })
            .select()
            .single();

        if (!error && data) {
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
        <div className="h-[calc(100vh-140px)] flex flex-col gap-4">
            <div className="flex justify-between items-center mb-2">
                <h1 className="text-3xl font-bold text-brand-text flex items-center gap-3">
                    <EnvelopeIcon className="w-8 h-8 text-brand-primary" />
                    E-mail Corporativo
                </h1>
                <button 
                    onClick={() => setIsComposeOpen(true)}
                    className="flex items-center gap-2 bg-brand-primary text-white px-6 py-2.5 rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-brand-primary/20"
                >
                    <PlusIcon className="w-5 h-5" />
                    Novo E-mail
                </button>
            </div>

            <div className="flex-1 flex gap-4 overflow-hidden">
                {/* Coluna 1: Pastas */}
                <div className={`w-64 flex flex-col gap-2 ${mobileView !== 'folders' ? 'hidden md:flex' : 'flex w-full'}`}>
                    <Card className="p-3 flex flex-col gap-1">
                        <button 
                            onClick={() => {
                                setActiveTab('inbox');
                                if (window.innerWidth < 768) setMobileView('list');
                            }}
                            className={`flex items-center justify-between p-3 rounded-xl transition-all ${activeTab === 'inbox' ? 'bg-brand-primary/10 text-brand-primary font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            <div className="flex items-center gap-3">
                                <InboxIcon className="w-5 h-5" />
                                <span>Entrada</span>
                            </div>
                            <span className="bg-brand-primary text-white text-[10px] px-1.5 py-0.5 rounded-full">2</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('sent')}
                            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'sent' ? 'bg-brand-primary/10 text-brand-primary font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            <PaperAirplaneIcon className="w-5 h-5" />
                            <span>Enviados</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('drafts')}
                            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'drafts' ? 'bg-brand-primary/10 text-brand-primary font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            <PencilSquareIcon className="w-5 h-5" />
                            <span>Rascunhos</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('trash')}
                            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'trash' ? 'bg-brand-primary/10 text-brand-primary font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            <TrashIcon className="w-5 h-5" />
                            <span>Lixeira</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('favorites')}
                            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'favorites' ? 'bg-brand-primary/10 text-brand-primary font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            <StarIcon className="w-5 h-5 text-amber-500" />
                            <span>Favoritos</span>
                        </button>

                        <hr className="my-1 border-gray-100" />

                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-brand-primary/10 text-brand-primary font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            <Cog6ToothIcon className="w-5 h-5" />
                            <span>Configurações</span>
                        </button>
                    </Card>

                    <Card className="p-4 mt-auto">
                        <div className="flex flex-col gap-3">
                            <div className="flex justify-between items-center text-xs text-gray-400 uppercase font-bold tracking-wider">
                                <span>Contas</span>
                                {isAdmin && <PlusIcon className="w-4 h-4 cursor-pointer hover:text-brand-primary" />}
                            </div>
                            <div className="flex items-center gap-3 p-2 rounded-lg border border-emerald-100 bg-emerald-50/30">
                                <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white text-xs font-bold">
                                    {currentUser?.name?.charAt(0) || 'U'}
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-xs font-bold truncate">{currentUser?.email || 'usuario@empresa.com'}</span>
                                    <span className="text-[10px] text-brand-primary">Conectado (SMTP/IMAP)</span>
                                </div>
                            </div>
                            {!isAdmin && (
                                <p className="text-[9px] text-gray-400 italic">Usuários comuns podem ter apenas uma conta vinculada.</p>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Coluna 2: Lista de E-mails */}
                <div className={`w-full md:w-1/3 flex flex-col gap-4 overflow-hidden ${mobileView !== 'list' && activeTab !== 'settings' ? 'hidden md:flex' : 'flex'}`}>
                    <Card className="p-3">
                        <div className="relative flex items-center gap-2">
                            <button
                                onClick={() => setMobileView('folders')}
                                className="md:hidden p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                            >
                                <Bars3Icon className="w-5 h-5" />
                            </button>
                            <div className="relative flex-1">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                type="text"
                                    placeholder="Pesquisar..."
                                className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-brand-primary transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        </div>
                    </Card>

                    <Card className="flex-1 overflow-y-auto no-scrollbar p-1">
                        <div className="divide-y divide-gray-100">
                            {filteredEmails.map((email) => {
                                const mainTag = email.tags?.[0];
                                return (
                                    <div
                                        key={email.id}
                                        onClick={() => handleSelectEmail(email)}
                                        onContextMenu={(e) => handleContextMenu(e, email.id)}
                                        className={`p-4 cursor-pointer transition-all hover:bg-gray-50 group border-l-4 ${selectedEmail?.id === email.id ? 'bg-emerald-50/50 border-brand-primary' : 'border-transparent'}`}
                                        style={mainTag ? { backgroundColor: mainTag.color + '15', borderLeftColor: mainTag.color } : {}}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm ${!email.is_read ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                                                    {email.from_name}
                                                </span>
                                                {email.tags && email.tags.length > 0 && email.tags.map(tag => (
                                                    <span
                                                        key={tag.id}
                                                        className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
                                                        style={{ backgroundColor: tag.color, color: '#fff' }}
                                                    >
                                                        {tag.label}
                                                    </span>
                                                ))}
                                            </div>
                                            <span className="text-[10px] text-gray-400 font-medium">
                                                {new Date(email.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <h3 className={`text-sm truncate mb-1 ${!email.is_read ? 'font-bold' : 'text-gray-700'}`}>
                                            {email.subject}
                                        </h3>
                                        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                                            {showPreview ? email.preview : '...'}
                                        </p>
                                        <div className="mt-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); toggleStar(email.id); }}>
                                                {email.is_starred ? (
                                                    <StarIcon className="w-4 h-4 text-amber-400 fill-amber-400" />
                                                ) : (
                                                    <StarIcon className="w-4 h-4 text-gray-300 hover:text-amber-400" />
                                                )}
                                            </button>
                                            {email.attachments && <PaperClipIcon className="w-4 h-4 text-gray-300" />}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                </div>

                {/* Coluna 3: Leitura ou Configurações */}
                <div className={`flex-1 overflow-hidden ${mobileView !== 'reading' && activeTab !== 'settings' ? 'hidden md:flex' : 'flex'}`}>
                    {activeTab === 'settings' ? (
                        <Card className="h-full flex flex-col overflow-hidden bg-gray-50/10">
                            <div className="p-8 space-y-8 overflow-y-auto no-scrollbar">
                                <div className="flex items-center gap-4 mb-2">
                                    <div className="p-3 bg-brand-primary/10 rounded-2xl text-brand-primary">
                                        <Cog6ToothIcon className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-900">Configurações</h2>
                                        <p className="text-sm text-gray-400">Personalize sua experiência de e-mail</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Perfil e Identidade */}
                                    <Card className="p-6 space-y-4">
                                        <h3 className="font-bold flex items-center gap-2 text-gray-700">
                                            <IdentificationIcon className="w-5 h-5 text-brand-primary" />
                                            Identidade e Assinatura
                                        </h3>
                                        <div className="space-y-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-xs font-bold text-gray-400 uppercase">Assinatura do E-mail</label>
                                                <textarea
                                                    value={signature}
                                                    onChange={(e) => setSignature(e.target.value)}
                                                    className="w-full h-24 p-3 text-sm border-gray-100 rounded-xl focus:ring-brand-primary bg-gray-50/50 resize-none mb-2"
                                                    placeholder="Digite sua assinatura aqui..."
                                                />
                                                <label className="text-xs font-bold text-gray-400 uppercase">Imagem da Assinatura</label>
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex gap-2">
                                                        <label className="w-full cursor-pointer bg-white border border-gray-100 px-4 py-3 rounded-xl text-sm font-bold text-gray-400 hover:text-brand-primary hover:border-brand-primary hover:bg-brand-primary/5 transition-all flex items-center justify-center gap-3 shadow-sm border-dashed border-2">
                                                            <PlusIcon className="w-5 h-5" />
                                                            Clique para Selecionar Imagem da Assinatura
                                                            <input
                                                                type="file"
                                                                className="hidden"
                                                                accept="image/*"
                                                                onChange={handleImageUpload}
                                                            />
                                                        </label>
                                                    </div>
                                                </div>
                                                {signatureImage && (
                                                    <div className="mt-2 p-2 border border-gray-100 rounded-lg bg-white inline-block">
                                                        <img src={signatureImage} alt="Preview" className="max-h-12 object-contain" />
                                                    </div>
                                                )}
                                                <p className="text-[10px] text-gray-400 italic mt-1">Esta assinatura e imagem serão adicionadas automaticamente ao final de novos e-mails.</p>
                                            </div>
                                        </div>
                                    </Card>

                                    {/* Marcadores e Tags */}
                                    <Card className="p-6 space-y-4">
                                        <h3 className="font-bold flex items-center gap-2 text-gray-700">
                                            <PaintBrushIcon className="w-5 h-5 text-brand-primary" />
                                            Gerenciar Marcadores
                                        </h3>
                                        <div className="space-y-2">
                                            {tags.map(tag => (
                                                <div key={tag.id} className="flex items-center justify-between p-2 rounded-lg border border-gray-50 bg-white shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-4 h-4 rounded shadow-sm" style={{ backgroundColor: tag.color }} />
                                                        <span className="text-sm font-medium">{tag.label}</span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button className="text-[10px] text-gray-400 font-bold hover:text-brand-primary transition-colors">Editar</button>
                                                        <button
                                                            onClick={async () => {
                                                                await supabase.from('email_tags').delete().eq('id', tag.id);
                                                                setTags(prev => prev.filter(t => t.id !== tag.id));
                                                            }}
                                                            className="text-[10px] text-red-400 font-bold hover:text-red-600 transition-colors"
                                                        >
                                                            Excluir
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            <button
                                                onClick={() => setIsTagModalOpen(true)}
                                                className="w-full py-2 border-2 border-dashed border-gray-100 rounded-xl text-xs font-bold text-gray-400 hover:border-brand-primary hover:text-brand-primary transition-all mt-2"
                                            >
                                                + Novo Marcador
                                            </button>
                                        </div>
                                    </Card>

                                    {/* Exibição */}
                                    <Card className="p-6 space-y-4">
                                        <h3 className="font-bold flex items-center gap-2 text-gray-700">
                                            <Bars3Icon className="w-5 h-5 text-brand-primary" />
                                            Preferências de Exibição
                                        </h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-600">Mostrar visualização da mensagem</span>
                                                <button
                                                    onClick={() => setShowPreview(!showPreview)}
                                                    className={`w-10 h-5 rounded-full relative transition-colors ${showPreview ? 'bg-brand-primary' : 'bg-gray-200'}`}
                                                >
                                                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${showPreview ? 'right-0.5' : 'left-0.5'}`} />
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-600">Agrupar por conversas (Threads)</span>
                                                <button
                                                    onClick={() => setGroupThreads(!groupThreads)}
                                                    className={`w-10 h-5 rounded-full relative transition-colors ${groupThreads ? 'bg-brand-primary' : 'bg-gray-200'}`}
                                                >
                                                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${groupThreads ? 'right-0.5' : 'left-0.5'}`} />
                                                </button>
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                            </div>
                        </Card>
                    ) : selectedEmail ? (
                        <Card className="h-full flex flex-col overflow-hidden">
                            {/* Toolbar */}
                            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/30">
                                <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setMobileView('list')}
                                            className="md:hidden p-2 hover:bg-white rounded-lg transition-all text-gray-500 mr-2"
                                        >
                                            <ChevronLeftIcon className="w-5 h-5" />
                                        </button>
                                    <button className="p-2 hover:bg-white rounded-lg transition-all text-gray-500 hover:text-brand-primary shadow-sm border border-transparent hover:border-gray-100">
                                        <ArchiveBoxIcon className="w-5 h-5" />
                                    </button>
                                    <button className="p-2 hover:bg-white rounded-lg transition-all text-gray-500 hover:text-red-500 shadow-sm border border-transparent hover:border-gray-100">
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                    <button className="p-2 hover:bg-white rounded-lg transition-all text-gray-500 hover:text-amber-500 shadow-sm border border-transparent hover:border-gray-100">
                                        <ExclamationCircleIcon className="w-5 h-5" />
                                    </button>
                                        <div className="h-4 w-px bg-gray-200 mx-1" />
                                        <button
                                            onClick={() => handleScheduleEvent(selectedEmail)}
                                            className="flex items-center gap-2 p-2 hover:bg-white rounded-lg transition-all text-gray-500 hover:text-indigo-500 shadow-sm border border-transparent hover:border-gray-100 group"
                                            title="Agendar Evento"
                                        >
                                            <CalendarIcon className="w-5 h-5" />
                                            <span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">Agendar</span>
                                        </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button className="p-2 hover:bg-white rounded-lg transition-all text-gray-500 shadow-sm border border-transparent hover:border-gray-100">
                                        <ChevronLeftIcon className="w-5 h-5" />
                                    </button>
                                    <button className="p-2 hover:bg-white rounded-lg transition-all text-gray-500 shadow-sm border border-transparent hover:border-gray-100">
                                        <ChevronRightIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Conteúdo */}
                            <div className="flex-1 overflow-y-auto p-8 space-y-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-6">{selectedEmail.subject}</h2>
                                        <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-4">
                                                {selectedEmail.from_email ? (
                                                    <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold text-lg shadow-sm border border-brand-primary/20">
                                                        {selectedEmail.from_name.charAt(0)}
                                                    </div>
                                            ) : (
                                                <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold text-lg shadow-sm border border-brand-primary/20">
                                                            ?
                                                </div>
                                            )}
                                            <div className="flex flex-col">
                                                    <span className="font-bold text-gray-900">{selectedEmail.from_name}</span>
                                                    <span className="text-xs text-gray-400">{selectedEmail.from_email}</span>
                                                </div>
                                            </div>
                                            <div className="text-right flex flex-col items-end gap-3">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleReply(selectedEmail)}
                                                        className="flex items-center gap-2 px-3 py-1.5 bg-brand-primary/10 text-brand-primary rounded-lg text-xs font-bold hover:bg-brand-primary/20 transition-all border border-brand-primary/20"
                                                    >
                                                        <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
                                                        Responder
                                                    </button>
                                                    <button
                                                        onClick={() => handleReply(selectedEmail, true)}
                                                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 transition-all border border-gray-200"
                                                    >
                                                        <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                                                        Responder Todos
                                                    </button>
                                                </div>
                                                <span className="text-sm font-medium text-gray-500">{new Date(selectedEmail.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            <span className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-bold">Via Servidor Corporativo</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed border-t border-gray-50 pt-8" 
                                     dangerouslySetInnerHTML={{ __html: selectedEmail.content }} />

                                    {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                                    <div className="mt-8 pt-8 border-t border-gray-50">
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                                <PaperClipIcon className="w-4 h-4" />
                                                Anexos ({selectedEmail.attachments.length})
                                            </h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {selectedEmail.attachments.map((file, idx) => {
                                                    const isImage = file.type?.includes('image');
                                                    return (
                                                        <div key={idx} className="group relative flex items-center gap-3 p-3 rounded-2xl border border-gray-100 bg-white hover:border-brand-primary/30 hover:shadow-lg hover:shadow-brand-primary/5 transition-all cursor-pointer overflow-hidden">
                                                            <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-brand-primary shrink-0 overflow-hidden border border-gray-50">
                                                                {isImage ? (
                                                                    <div className="w-full h-full bg-gray-200 animate-pulse" /> // Fallback visual
                                                                ) : (
                                                                    <PaperClipIcon className="w-6 h-6 opacity-40" />
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col min-w-0 flex-1">
                                                                <span className="text-xs font-bold text-gray-900 truncate group-hover:text-brand-primary transition-colors">{file.name}</span>
                                                                <span className="text-[10px] text-gray-400">{file.size}</span>
                                                            </div>
                                                            <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button className="p-1.5 bg-brand-primary text-white rounded-lg shadow-sm hover:bg-emerald-600">
                                                                    <ArrowPathIcon className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Resposta Rápida */}
                            <div className="p-4 border-t border-gray-100 bg-gray-50/20">
                                <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-brand-primary/20 transition-all">
                                    <input 
                                        type="text" 
                                        placeholder="Clique para responder rápido..." 
                                        className="flex-1 border-none focus:ring-0 text-sm bg-transparent"
                                    />
                                    <button className="bg-brand-primary text-white p-2 rounded-xl hover:bg-emerald-600 transition-all shadow-md">
                                        <PaperAirplaneIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </Card>
                    ) : (
                        <Card className="h-full flex items-center justify-center text-gray-400 flex-col gap-4 opacity-70">
                            <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center">
                                <EnvelopeIcon className="w-10 h-10" />
                            </div>
                            <p className="font-medium">Selecione uma mensagem para visualizar</p>
                        </Card>
                    )}
                </div>
            </div>

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
