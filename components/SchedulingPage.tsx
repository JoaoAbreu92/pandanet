import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import { 
    CalendarIcon, 
    PlusIcon, 
    LinkIcon, 
    CheckIcon, 
    XMarkIcon, 
    DocumentTextIcon, 
    TrashIcon, 
    EnvelopeIcon, 
    ExclamationTriangleIcon,
    SparklesIcon
} from './icons';
import type { SchedulingEventType, SchedulingBooking, SchedulingTemplate } from '../types';

const SchedulingPage: React.FC = () => {
    const { currentUser } = useAuth();
    const { addNotification } = useNotifications();
    const [activeTab, setActiveTab] = useState<'events' | 'bookings' | 'templates'>('events');
    const [bookingFilter, setBookingFilter] = useState<'pending' | 'confirmed' | 'past_cancelled'>('pending');

    // Data lists
    const [eventTypes, setEventTypes] = useState<SchedulingEventType[]>([]);
    const [bookings, setBookings] = useState<SchedulingBooking[]>([]);
    const [templates, setTemplates] = useState<SchedulingTemplate[]>([]);
    const [emailAccounts, setEmailAccounts] = useState<any[]>([]);

    // Loading states
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    
    // Modals & Forms State
    const [showEventModal, setShowEventModal] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState<SchedulingBooking | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Event Type Form
    const [editingEvent, setEditingEvent] = useState<Partial<SchedulingEventType> | null>(null);
    const [eventForm, setEventForm] = useState({
        name: '',
        slug: '',
        description: '',
        duration: 30,
        is_paid: false,
        price: 0.00,
        requirements: {
            phone: true,
            cnpj: false,
            company_name: false
        },
        availability: {
            days: [1, 2, 3, 4, 5],
            startTime: '09:00',
            endTime: '18:00'
        },
        is_active: true
    });

    // Template Form
    const [editingTemplate, setEditingTemplate] = useState<Partial<SchedulingTemplate> | null>(null);
    const [templateForm, setTemplateForm] = useState({
        name: '',
        subject: '',
        body: '',
        is_default: false
    });

    // Confirmation Email Preview Form
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [customSubject, setCustomSubject] = useState('');
    const [customBody, setCustomBody] = useState('');

    // Fetch initial data
    useEffect(() => {
        if (!currentUser?.company_id) return;
        fetchEventTypes();
        fetchBookings();
        fetchTemplates();
        fetchEmailAccounts();
    }, [currentUser]);

    const fetchEventTypes = async () => {
        setLoading(true);
        try {
            // Se for admin, pode ver todos os tipos da empresa, senão apenas os seus
            let query = supabase.from('scheduling_event_types').select('*').eq('company_id', currentUser.company_id);
            if (!currentUser.isAdmin && !currentUser.isCompanyAdmin && currentUser.role !== 'Super Admin') {
                query = query.eq('owner_id', currentUser.id);
            }
            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;
            setEventTypes(data || []);
        } catch (err: any) {
            console.error('Erro ao buscar tipos de eventos:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchBookings = async () => {
        try {
            let query = supabase.from('scheduling_bookings').select('*, event_types:scheduling_event_types(*)').eq('company_id', currentUser.company_id);
            if (!currentUser.isAdmin && !currentUser.isCompanyAdmin && currentUser.role !== 'Super Admin') {
                query = query.eq('host_id', currentUser.id);
            }
            const { data, error } = await query.order('booking_date', { ascending: true }).order('booking_time', { ascending: true });
            if (error) throw error;
            setBookings(data || []);
        } catch (err: any) {
            console.error('Erro ao buscar agendamentos:', err);
        }
    };

    const fetchTemplates = async () => {
        try {
            let query = supabase.from('scheduling_templates').select('*').eq('company_id', currentUser.company_id);
            if (!currentUser.isAdmin && !currentUser.isCompanyAdmin && currentUser.role !== 'Super Admin') {
                query = query.eq('owner_id', currentUser.id);
            }
            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;
            setTemplates(data || []);
        } catch (err: any) {
            console.error('Erro ao buscar templates:', err);
        }
    };

    const fetchEmailAccounts = async () => {
        try {
            const { data, error } = await supabase
                .from('email_settings')
                .select('*')
                .eq('company_id', currentUser.company_id)
                .eq('user_id', currentUser.id);
            if (!error && data) {
                setEmailAccounts(data);
            }
        } catch (err) {
            console.error('Erro ao buscar configurações de email:', err);
        }
    };

    // Actions for Event Types
    const handleSaveEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            const payload = {
                company_id: currentUser.company_id,
                owner_id: currentUser.id,
                name: eventForm.name,
                slug: eventForm.slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
                description: eventForm.description,
                duration: Number(eventForm.duration),
                is_paid: eventForm.is_paid,
                price: eventForm.is_paid ? Number(eventForm.price) : 0,
                requirements: eventForm.requirements,
                availability: eventForm.availability,
                is_active: eventForm.is_active
            };

            let error;
            if (editingEvent?.id) {
                const { error: err } = await supabase
                    .from('scheduling_event_types')
                    .update(payload)
                    .eq('id', editingEvent.id);
                error = err;
            } else {
                const { error: err } = await supabase
                    .from('scheduling_event_types')
                    .insert(payload);
                error = err;
            }

            if (error) throw error;
            
            setShowEventModal(false);
            setEditingEvent(null);
            fetchEventTypes();
            // Reset form
            setEventForm({
                name: '', slug: '', description: '', duration: 30, is_paid: false, price: 0,
                requirements: { phone: true, cnpj: false, company_name: false },
                availability: { days: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '18:00' },
                is_active: true
            });
        } catch (err: any) {
            alert('Erro ao salvar tipo de evento: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleEditEvent = (event: SchedulingEventType) => {
        setEditingEvent(event);
        setEventForm({
            name: event.name,
            slug: event.slug,
            description: event.description || '',
            duration: event.duration,
            is_paid: event.is_paid,
            price: event.price,
            requirements: {
                phone: event.requirements?.phone ?? true,
                cnpj: event.requirements?.cnpj ?? false,
                company_name: event.requirements?.company_name ?? false
            },
            availability: {
                days: event.availability?.days ?? [1, 2, 3, 4, 5],
                startTime: event.availability?.startTime ?? '09:00',
                endTime: event.availability?.endTime ?? '18:00'
            },
            is_active: event.is_active
        });
        setShowEventModal(true);
    };

    const handleDeleteEvent = async (id: string) => {
        if (!window.confirm('Tem certeza que deseja excluir esta agenda?')) return;
        try {
            const { error } = await supabase.from('scheduling_event_types').delete().eq('id', id);
            if (error) throw error;
            fetchEventTypes();
        } catch (err: any) {
            alert('Erro ao excluir: ' + err.message);
        }
    };

    // Actions for Templates
    const handleSaveTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            const payload = {
                company_id: currentUser.company_id,
                owner_id: currentUser.id,
                name: templateForm.name,
                subject: templateForm.subject,
                body: templateForm.body,
                is_default: templateForm.is_default
            };

            // Se for marcado como default, remove o default dos outros templates deste owner
            if (templateForm.is_default) {
                await supabase
                    .from('scheduling_templates')
                    .update({ is_default: false })
                    .eq('owner_id', currentUser.id);
            }

            let error;
            if (editingTemplate?.id) {
                const { error: err } = await supabase
                    .from('scheduling_templates')
                    .update(payload)
                    .eq('id', editingTemplate.id);
                error = err;
            } else {
                const { error: err } = await supabase
                    .from('scheduling_templates')
                    .insert(payload);
                error = err;
            }

            if (error) throw error;

            setShowTemplateModal(false);
            setEditingTemplate(null);
            fetchTemplates();
            setTemplateForm({ name: '', subject: '', body: '', is_default: false });
        } catch (err: any) {
            alert('Erro ao salvar template: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleEditTemplate = (tpl: SchedulingTemplate) => {
        setEditingTemplate(tpl);
        setTemplateForm({
            name: tpl.name,
            subject: tpl.subject,
            body: tpl.body,
            is_default: tpl.is_default
        });
        setShowTemplateModal(true);
    };

    const handleDeleteTemplate = async (id: string) => {
        if (!window.confirm('Excluir este modelo de e-mail?')) return;
        try {
            const { error } = await supabase.from('scheduling_templates').delete().eq('id', id);
            if (error) throw error;
            fetchTemplates();
        } catch (err: any) {
            alert('Erro ao excluir template: ' + err.message);
        }
    };

    // Booking actions
    const handleRejectBooking = async (booking: SchedulingBooking) => {
        if (!window.confirm(`Tem certeza que deseja recusar o agendamento de ${booking.guest_name}?`)) return;
        try {
            const { error } = await supabase
                .from('scheduling_bookings')
                .update({ status: 'rejected' })
                .eq('id', booking.id);
            if (error) throw error;
            fetchBookings();
        } catch (err: any) {
            alert('Erro ao recusar reserva: ' + err.message);
        }
    };

    // Replace template variables
    const getReplacedContent = (text: string, booking: SchedulingBooking) => {
        if (!text) return '';
        const eventName = booking.event_types?.name || 'Agendamento';
        const formattedDate = new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('pt-BR');
        
        return text
            .replace(/{guest_name}/g, booking.guest_name)
            .replace(/{guest_email}/g, booking.guest_email)
            .replace(/{guest_phone}/g, booking.guest_phone || 'N/A')
            .replace(/{guest_company_name}/g, booking.guest_company_name || 'N/A')
            .replace(/{guest_cnpj}/g, booking.guest_cnpj || 'N/A')
            .replace(/{event_name}/g, eventName)
            .replace(/{booking_date}/g, formattedDate)
            .replace(/{booking_time}/g, booking.booking_time)
            .replace(/{price}/g, booking.price > 0 ? `R$ ${booking.price.toFixed(2)}` : 'Grátis');
    };

    // Trigger confirmation modal open
    const openConfirmBookingModal = (booking: SchedulingBooking) => {
        setShowConfirmModal(booking);
        // Procure o template padrão
        const defaultTpl = templates.find(t => t.is_default) || templates[0];
        if (defaultTpl) {
            setSelectedTemplateId(defaultTpl.id);
            setCustomSubject(getReplacedContent(defaultTpl.subject, booking));
            setCustomBody(getReplacedContent(defaultTpl.body, booking));
        } else {
            // Default Fallback
            setSelectedTemplateId('');
            setCustomSubject(`Reserva Confirmada: ${booking.event_types?.name || 'Agendamento'}`);
            setCustomBody(`Olá ${booking.guest_name},\n\nSua reserva para o evento "${booking.event_types?.name}" foi confirmada com sucesso!\n\nDetalhes:\nData: ${new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('pt-BR')}\nHorário: ${booking.booking_time}\n\nAtenciosamente,\n${currentUser.full_name || 'Equipe'}`);
        }
    };

    // Update custom body on template select change
    const handleTemplateChange = (templateId: string, booking: SchedulingBooking) => {
        setSelectedTemplateId(templateId);
        const tpl = templates.find(t => t.id === templateId);
        if (tpl) {
            setCustomSubject(getReplacedContent(tpl.subject, booking));
            setCustomBody(getReplacedContent(tpl.body, booking));
        }
    };

    // Confirm booking and send SMTP Email
    const handleConfirmBooking = async () => {
        if (!showConfirmModal) return;
        setActionLoading(true);
        const booking = showConfirmModal;

        try {
            // 1. Atualizar status da reserva no banco de dados
            const { error: dbError } = await supabase
                .from('scheduling_bookings')
                .update({ 
                    status: 'confirmed',
                    payment_status: booking.price > 0 ? 'paid' : 'free' // marca como pago se confirmado
                })
                .eq('id', booking.id);
            if (dbError) throw dbError;

            // 2. Enviar e-mail de confirmação usando a conta conectada se houver
            if (emailAccounts.length > 0) {
                const activeAccount = emailAccounts[0]; // usa a primeira conta de email do anfitrião
                const smtpConfig = {
                    imap_host: activeAccount.imap_host,
                    imap_port: activeAccount.imap_port,
                    imap_user: activeAccount.imap_user,
                    imap_pass: activeAccount.imap_pass,
                    imap_ssl: activeAccount.imap_ssl,
                    smtp_host: activeAccount.smtp_host,
                    smtp_port: activeAccount.smtp_port,
                    smtp_user: activeAccount.smtp_user,
                    smtp_pass: activeAccount.smtp_pass,
                    smtp_ssl: activeAccount.smtp_ssl,
                };

                const emailBodyHtml = customBody.replace(/\n/g, '<br/>');

                // Envia pelo backend /api/email/send
                const session = await supabase.auth.getSession();
                const token = session.data.session?.access_token;
                
                await fetch('/api/email/send', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        config: smtpConfig,
                        payload: {
                            to: booking.guest_email,
                            subject: customSubject,
                            text: customBody,
                            html: `<div style="font-family: sans-serif; color: #334155; line-height: 1.6;">${emailBodyHtml}</div>`
                        },
                        user_id: currentUser.id
                    })
                });
            } else {
                console.warn('Nenhuma conta SMTP conectada ao anfitrião. Email não pôde ser enviado, apenas confirmado no painel.');
            }

            // 3. Enviar notificação interna ou toast
            addNotification({
                type: 'system',
                title: 'Reserva Confirmada',
                description: `A reserva de ${booking.guest_name} foi confirmada e o e-mail enviado.`,
                link: `/scheduling`,
                avatarUrl: '/logo.png'
            });

            setShowConfirmModal(null);
            fetchBookings();
        } catch (err: any) {
            alert('Reserva confirmada no painel, mas houve erro ao enviar e-mail: ' + err.message);
            // Mesmo com erro de email, atualiza a lista
            setShowConfirmModal(null);
            fetchBookings();
        } finally {
            setActionLoading(false);
        }
    };

    // Helper to generate public booking link
    const getBookingLink = (event: SchedulingEventType) => {
        return `${window.location.origin}/?book=${event.id}`;
    };

    const copyToClipboard = (text: string, eventId: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(eventId);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Filtered bookings
    const filteredBookings = bookings.filter(b => {
        if (bookingFilter === 'pending') return b.status === 'pending';
        if (bookingFilter === 'confirmed') return b.status === 'confirmed';
        return b.status === 'rejected' || b.status === 'cancelled' || new Date(b.booking_date) < new Date();
    });

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                        <CalendarIcon className="w-8 h-8 text-brand-primary" />
                        Agendamentos
                        <span className="text-xs bg-brand-primary/10 text-brand-primary font-bold px-2.5 py-1 rounded-full border border-brand-primary/20 flex items-center gap-1">
                            <SparklesIcon className="w-3.5 h-3.5" />
                            Premium Cal.com
                        </span>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-sm">
                        Crie agendas de reuniões, jantares, consultas ou eventos. Compartilhe o link e receba reservas profissionais.
                    </p>
                </div>
                
                <div className="flex gap-2">
                    {activeTab === 'events' && (
                        <button
                            onClick={() => {
                                setEditingEvent(null);
                                setEventForm({
                                    name: '', slug: '', description: '', duration: 30, is_paid: false, price: 0,
                                    requirements: { phone: true, cnpj: false, company_name: false },
                                    availability: { days: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '18:00' },
                                    is_active: true
                                });
                                setShowEventModal(true);
                            }}
                            className="bg-brand-primary hover:bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-brand-primary/20 flex items-center gap-2 transition-all hover:scale-[1.02]"
                        >
                            <PlusIcon className="w-5 h-5" />
                            Criar Nova Agenda
                        </button>
                    )}
                    {activeTab === 'templates' && (
                        <button
                            onClick={() => {
                                setEditingTemplate(null);
                                setTemplateForm({ name: '', subject: '', body: '', is_default: false });
                                setShowTemplateModal(true);
                            }}
                            className="bg-brand-primary hover:bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-brand-primary/20 flex items-center gap-2 transition-all hover:scale-[1.02]"
                        >
                            <PlusIcon className="w-5 h-5" />
                            Criar Modelo de E-mail
                        </button>
                    )}
                </div>
            </div>

            {/* Warning if no SMTP configured */}
            {emailAccounts.length === 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 flex gap-3 text-amber-800 dark:text-amber-300 text-sm">
                    <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <span className="font-bold">E-mails de confirmação desativados:</span> Você ainda não configurou uma conta de e-mail no painel PandaMail. Suas reservas serão marcadas como confirmadas, mas os convidados não receberão e-mails automatizados a partir do seu endereço eletrônico até que as credenciais SMTP/IMAP sejam salvas.
                    </div>
                </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800">
                <button
                    onClick={() => setActiveTab('events')}
                    className={`px-5 py-3 border-b-2 font-bold text-sm transition-all ${
                        activeTab === 'events' 
                            ? 'border-brand-primary text-brand-primary' 
                            : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                    }`}
                >
                    Suas Agendas
                </button>
                <button
                    onClick={() => setActiveTab('bookings')}
                    className={`px-5 py-3 border-b-2 font-bold text-sm transition-all relative ${
                        activeTab === 'bookings' 
                            ? 'border-brand-primary text-brand-primary' 
                            : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                    }`}
                >
                    Reservas Recebidas
                    {bookings.filter(b => b.status === 'pending').length > 0 && (
                        <span className="ml-2 bg-red-500 text-white rounded-full text-[10px] font-bold px-1.5 py-0.5">
                            {bookings.filter(b => b.status === 'pending').length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('templates')}
                    className={`px-5 py-3 border-b-2 font-bold text-sm transition-all ${
                        activeTab === 'templates' 
                            ? 'border-brand-primary text-brand-primary' 
                            : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                    }`}
                >
                    Modelos de E-mail
                </button>
            </div>

            {/* Content Tabs */}
            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary"></div>
                </div>
            ) : (
                <>
                    {/* Tab: Events */}
                    {activeTab === 'events' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {eventTypes.length === 0 ? (
                                <div className="col-span-full text-center py-16 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                                    <CalendarIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nenhuma agenda criada</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Crie seu primeiro tipo de evento para compartilhar com seus clientes.</p>
                                </div>
                            ) : (
                                eventTypes.map(event => (
                                    <div 
                                        key={event.id}
                                        className={`bg-white dark:bg-slate-900 border ${event.is_active ? 'border-slate-100 dark:border-slate-800' : 'border-slate-200 opacity-60'} rounded-2xl shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between relative group`}
                                    >
                                        <div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold px-2 py-1 rounded-md">
                                                    {event.duration} min
                                                </span>
                                                <span className={`text-xs px-2 py-1 rounded-md font-bold ${event.is_paid ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
                                                    {event.is_paid ? `R$ ${event.price.toFixed(2)}` : 'Grátis'}
                                                </span>
                                            </div>

                                            <h3 className="font-extrabold text-lg text-slate-900 dark:text-white mt-3 truncate">{event.name}</h3>
                                            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1.5 line-clamp-2 h-8">
                                                {event.description || 'Sem descrição.'}
                                            </p>
                                            
                                            <div className="mt-4 bg-slate-50 dark:bg-slate-950 rounded-xl p-3 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 space-y-1">
                                                <div className="font-semibold text-slate-700 dark:text-slate-300">Requisitos obrigatórios:</div>
                                                <div className="flex flex-wrap gap-1.5 mt-1">
                                                    <span className="bg-white dark:bg-slate-900 border px-1.5 py-0.5 rounded">Nome e E-mail</span>
                                                    {event.requirements?.phone && <span className="bg-white dark:bg-slate-900 border px-1.5 py-0.5 rounded">Telefone</span>}
                                                    {event.requirements?.cnpj && <span className="bg-white dark:bg-slate-900 border px-1.5 py-0.5 rounded">CNPJ</span>}
                                                    {event.requirements?.company_name && <span className="bg-white dark:bg-slate-900 border px-1.5 py-0.5 rounded">Empresa</span>}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                                            <button
                                                onClick={() => copyToClipboard(getBookingLink(event), event.id)}
                                                className="flex-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-200/50 dark:border-slate-800"
                                            >
                                                {copiedId === event.id ? (
                                                    <>
                                                        <CheckIcon className="w-4 h-4 text-green-500" />
                                                        Copiado!
                                                    </>
                                                ) : (
                                                    <>
                                                        <LinkIcon className="w-4 h-4" />
                                                        Copiar Link
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleEditEvent(event)}
                                                className="px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold py-2 rounded-xl text-xs border border-slate-200/50 dark:border-slate-800"
                                            >
                                                Editar
                                            </button>
                                            <button
                                                onClick={() => handleDeleteEvent(event.id)}
                                                className="px-3 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:hover:bg-red-950/40 font-bold py-2 rounded-xl text-xs"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Tab: Bookings */}
                    {activeTab === 'bookings' && (
                        <div className="space-y-4">
                            {/* Filter Sub-Tabs */}
                            <div className="flex gap-2 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-xl max-w-md">
                                <button
                                    onClick={() => setBookingFilter('pending')}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                        bookingFilter === 'pending'
                                            ? 'bg-white dark:bg-slate-900 text-brand-primary shadow-sm'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                    }`}
                                >
                                    Pendentes ({bookings.filter(b => b.status === 'pending').length})
                                </button>
                                <button
                                    onClick={() => setBookingFilter('confirmed')}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                        bookingFilter === 'confirmed'
                                            ? 'bg-white dark:bg-slate-900 text-brand-primary shadow-sm'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                    }`}
                                >
                                    Confirmadas ({bookings.filter(b => b.status === 'confirmed').length})
                                </button>
                                <button
                                    onClick={() => setBookingFilter('past_cancelled')}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                        bookingFilter === 'past_cancelled'
                                            ? 'bg-white dark:bg-slate-900 text-brand-primary shadow-sm'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                    }`}
                                >
                                    Histórico ({bookings.filter(b => b.status !== 'pending' && b.status !== 'confirmed').length})
                                </button>
                            </div>

                            {/* Bookings List */}
                            <div className="space-y-3">
                                {filteredBookings.length === 0 ? (
                                    <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl">
                                        <EnvelopeIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nenhum agendamento encontrado</h3>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Os agendamentos desta categoria aparecerão aqui.</p>
                                    </div>
                                ) : (
                                    filteredBookings.map(booking => {
                                        const bDate = new Date(booking.booking_date + 'T00:00:00');
                                        return (
                                            <div 
                                                key={booking.id}
                                                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-sm transition-all"
                                            >
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-extrabold text-slate-900 dark:text-white text-base">
                                                            {booking.guest_name}
                                                        </span>
                                                        <span className="text-slate-400 dark:text-slate-500 text-xs">•</span>
                                                        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-300">
                                                            {booking.event_types?.name || 'Evento'}
                                                        </span>
                                                        {booking.price > 0 && (
                                                            <span className="text-xs bg-amber-50 dark:bg-amber-950/20 text-amber-600 border border-amber-200 px-2 py-0.5 rounded font-bold">
                                                                R$ {booking.price.toFixed(2)} ({booking.payment_status === 'paid' ? 'Pago' : 'Pendente'})
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                                        <div><span className="font-semibold">Email:</span> {booking.guest_email}</div>
                                                        <div><span className="font-semibold">Celular:</span> {booking.guest_phone || 'Não informado'}</div>
                                                        {booking.guest_company_name && (
                                                            <div><span className="font-semibold">Empresa:</span> {booking.guest_company_name}</div>
                                                        )}
                                                        {booking.guest_cnpj && (
                                                            <div><span className="font-semibold">CNPJ:</span> {booking.guest_cnpj}</div>
                                                        )}
                                                        <div><span className="font-semibold">Data:</span> {bDate.toLocaleDateString('pt-BR')} às {booking.booking_time}</div>
                                                    </div>

                                                    {booking.notes && (
                                                        <div className="bg-slate-50 dark:bg-slate-950 border rounded-xl p-3 text-xs text-slate-600 dark:text-slate-400 mt-2">
                                                            <span className="font-bold">Observações:</span> {booking.notes}
                                                        </div>
                                                    )}
                                                </div>

                                                {booking.status === 'pending' && (
                                                    <div className="flex gap-2 self-start md:self-center">
                                                        <button
                                                            onClick={() => openConfirmBookingModal(booking)}
                                                            className="bg-brand-primary hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-brand-primary/10"
                                                        >
                                                            <CheckIcon className="w-4 h-4" />
                                                            Confirmar
                                                        </button>
                                                        <button
                                                            onClick={() => handleRejectBooking(booking)}
                                                            className="bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:hover:bg-red-950/45 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all"
                                                        >
                                                            <XMarkIcon className="w-4 h-4" />
                                                            Recusar
                                                        </button>
                                                    </div>
                                                )}
                                                {booking.status === 'confirmed' && (
                                                    <span className="text-xs bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400 border border-green-200 px-3 py-1.5 rounded-full font-bold self-start md:self-center">
                                                        Confirmado
                                                    </span>
                                                )}
                                                {booking.status === 'rejected' && (
                                                    <span className="text-xs bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 border border-red-200 px-3 py-1.5 rounded-full font-bold self-start md:self-center">
                                                        Recusado
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {/* Tab: Templates */}
                    {activeTab === 'templates' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {templates.length === 0 ? (
                                    <div className="col-span-full text-center py-16 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                                        <DocumentTextIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nenhum modelo de e-mail criado</h3>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Crie mensagens padrões para enviar aos convidados ao confirmar uma reserva.</p>
                                    </div>
                                ) : (
                                    templates.map(tpl => (
                                        <div 
                                            key={tpl.id}
                                            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:shadow-sm transition-all"
                                        >
                                            <div>
                                                <div className="flex items-center justify-between">
                                                    <h3 className="font-extrabold text-slate-900 dark:text-white text-base truncate">
                                                        {tpl.name}
                                                    </h3>
                                                    {tpl.is_default && (
                                                        <span className="text-[10px] bg-brand-primary/10 text-brand-primary border border-brand-primary/20 font-bold px-2 py-0.5 rounded-full">
                                                            Padrão
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 truncate">
                                                    <span className="font-bold">Assunto:</span> {tpl.subject}
                                                </div>
                                                <pre className="mt-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-xl p-3 text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-sans h-24 overflow-y-auto">
                                                    {tpl.body}
                                                </pre>
                                            </div>

                                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleEditTemplate(tpl)}
                                                    className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold px-3 py-2 rounded-xl text-xs border border-slate-200/50 dark:border-slate-800"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTemplate(tpl.id)}
                                                    className="bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:hover:bg-red-950/45 font-bold px-3 py-2 rounded-xl text-xs"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Modal: Create/Edit Event Type */}
            {showEventModal && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                                <CalendarIcon className="w-6 h-6 text-brand-primary" />
                                {editingEvent ? 'Editar Agenda' : 'Criar Nova Agenda'}
                            </h2>
                            <button onClick={() => setShowEventModal(false)} className="text-slate-400 hover:text-slate-600">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEvent} className="p-6 space-y-4 overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Nome da Agenda *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        value={eventForm.name}
                                        onChange={e => setEventForm({ ...eventForm, name: e.target.value })}
                                        placeholder="Ex: Jantar de Aniversário"
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Slug da URL *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        value={eventForm.slug}
                                        onChange={e => setEventForm({ ...eventForm, slug: e.target.value })}
                                        placeholder="Ex: jantar-aniversario"
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Descrição</label>
                                <textarea 
                                    value={eventForm.description}
                                    onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
                                    placeholder="Explique o que é este evento, local, traje, etc."
                                    rows={3}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Duração (Minutos) *</label>
                                    <input 
                                        type="number" 
                                        required 
                                        value={eventForm.duration}
                                        onChange={e => setEventForm({ ...eventForm, duration: Number(e.target.value) })}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">É pago? *</label>
                                    <select 
                                        value={eventForm.is_paid ? 'true' : 'false'}
                                        onChange={e => setEventForm({ ...eventForm, is_paid: e.target.value === 'true' })}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary"
                                    >
                                        <option value="false">Não (Gratuito)</option>
                                        <option value="true">Sim (Pago)</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Valor de Reserva (R$)</label>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        disabled={!eventForm.is_paid}
                                        value={eventForm.price}
                                        onChange={e => setEventForm({ ...eventForm, price: Number(e.target.value) })}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary disabled:opacity-50"
                                    />
                                </div>
                            </div>

                            {/* Requirements Checklist */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase block">Campos obrigatórios do convidado</label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                                        <input type="checkbox" disabled checked className="rounded text-brand-primary" />
                                        <span>Nome e E-mail</span>
                                    </label>
                                    <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={eventForm.requirements.phone} 
                                            onChange={e => setEventForm({ 
                                                ...eventForm, 
                                                requirements: { ...eventForm.requirements, phone: e.target.checked } 
                                            })}
                                            className="rounded text-brand-primary focus:ring-brand-primary" 
                                        />
                                        <span>Celular</span>
                                    </label>
                                    <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={eventForm.requirements.company_name} 
                                            onChange={e => setEventForm({ 
                                                ...eventForm, 
                                                requirements: { ...eventForm.requirements, company_name: e.target.checked } 
                                            })}
                                            className="rounded text-brand-primary focus:ring-brand-primary" 
                                        />
                                        <span>Nome da Empresa</span>
                                    </label>
                                    <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={eventForm.requirements.cnpj} 
                                            onChange={e => setEventForm({ 
                                                ...eventForm, 
                                                requirements: { ...eventForm.requirements, cnpj: e.target.checked } 
                                            })}
                                            className="rounded text-brand-primary focus:ring-brand-primary" 
                                        />
                                        <span>CNPJ</span>
                                    </label>
                                </div>
                            </div>

                            {/* Hours and active state */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Início do Expediente</label>
                                    <input 
                                        type="time" 
                                        value={eventForm.availability.startTime}
                                        onChange={e => setEventForm({ 
                                            ...eventForm, 
                                            availability: { ...eventForm.availability, startTime: e.target.value } 
                                        })}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Fim do Expediente</label>
                                    <input 
                                        type="time" 
                                        value={eventForm.availability.endTime}
                                        onChange={e => setEventForm({ 
                                            ...eventForm, 
                                            availability: { ...eventForm.availability, endTime: e.target.value } 
                                        })}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Ativo? *</label>
                                    <select 
                                        value={eventForm.is_active ? 'true' : 'false'}
                                        onChange={e => setEventForm({ ...eventForm, is_active: e.target.value === 'true' })}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary"
                                    >
                                        <option value="true">Sim (Disponível)</option>
                                        <option value="false">Não (Pausado)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 pt-6">
                                <button 
                                    type="button" 
                                    onClick={() => setShowEventModal(false)}
                                    className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-5 py-2.5 rounded-xl text-sm"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={actionLoading}
                                    className="bg-brand-primary hover:bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow-lg shadow-brand-primary/20"
                                >
                                    {actionLoading ? 'Salvando...' : 'Salvar Agenda'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Create/Edit Template */}
            {showTemplateModal && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                                <DocumentTextIcon className="w-6 h-6 text-brand-primary" />
                                {editingTemplate ? 'Editar Modelo' : 'Criar Novo Modelo'}
                            </h2>
                            <button onClick={() => setShowTemplateModal(false)} className="text-slate-400 hover:text-slate-600">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveTemplate} className="p-6 space-y-4 overflow-y-auto flex-1">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Nome do Modelo *</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={templateForm.name}
                                    onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                                    placeholder="Ex: Confirmação Jantar"
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Assunto do E-mail *</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={templateForm.subject}
                                    onChange={e => setTemplateForm({ ...templateForm, subject: e.target.value })}
                                    placeholder="Ex: Confirmação: {event_name}"
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary"
                                />
                            </div>

                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Corpo do E-mail *</label>
                                    <span className="text-[10px] text-brand-primary font-bold">Placeholders dinâmicos suportados</span>
                                </div>
                                <textarea 
                                    required
                                    value={templateForm.body}
                                    onChange={e => setTemplateForm({ ...templateForm, body: e.target.value })}
                                    placeholder="Olá {guest_name},\n\nSua reserva para o evento {event_name} foi confirmada!\n\nData: {booking_date} às {booking_time}."
                                    rows={8}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary font-mono text-xs"
                                />
                            </div>

                            {/* Help Guide for placeholders */}
                            <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 space-y-1">
                                <div className="font-bold text-slate-700 dark:text-slate-300 uppercase">Placeholders disponíveis:</div>
                                <div className="grid grid-cols-2 gap-2 mt-1.5 font-mono text-[10px]">
                                    <div><span className="text-brand-primary">{`{guest_name}`}</span> - Nome do convidado</div>
                                    <div><span className="text-brand-primary">{`{guest_email}`}</span> - Email do convidado</div>
                                    <div><span className="text-brand-primary">{`{guest_phone}`}</span> - Telefone do convidado</div>
                                    <div><span className="text-brand-primary">{`{guest_company_name}`}</span> - Empresa do convidado</div>
                                    <div><span className="text-brand-primary">{`{guest_cnpj}`}</span> - CNPJ do convidado</div>
                                    <div><span className="text-brand-primary">{`{event_name}`}</span> - Nome da agenda</div>
                                    <div><span className="text-brand-primary">{`{booking_date}`}</span> - Data da reserva</div>
                                    <div><span className="text-brand-primary">{`{booking_time}`}</span> - Horário da reserva</div>
                                </div>
                            </div>

                            <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer pt-2">
                                <input 
                                    type="checkbox" 
                                    checked={templateForm.is_default}
                                    onChange={e => setTemplateForm({ ...templateForm, is_default: e.target.checked })}
                                    className="rounded text-brand-primary focus:ring-brand-primary" 
                                />
                                <span className="font-semibold">Definir como modelo de confirmação padrão</span>
                            </label>

                            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 pt-6">
                                <button 
                                    type="button" 
                                    onClick={() => setShowTemplateModal(false)}
                                    className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-855 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-5 py-2.5 rounded-xl text-sm"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={actionLoading}
                                    className="bg-brand-primary hover:bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow-lg shadow-brand-primary/20"
                                >
                                    {actionLoading ? 'Salvando...' : 'Salvar Modelo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Confirm Booking (Email Preview & Edit) */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                                <EnvelopeIcon className="w-6 h-6 text-brand-primary" />
                                Confirmar e Enviar E-mail de Confirmação
                            </h2>
                            <button onClick={() => setShowConfirmModal(null)} className="text-slate-400 hover:text-slate-600">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            {/* Choose template */}
                            {templates.length > 0 ? (
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Escolher Modelo de E-mail</label>
                                    <select
                                        value={selectedTemplateId}
                                        onChange={e => handleTemplateChange(e.target.value, showConfirmModal)}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary"
                                    >
                                        {templates.map(t => (
                                            <option key={t.id} value={t.id}>{t.name} {t.is_default ? '(Padrão)' : ''}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-950 border p-3 rounded-xl">
                                    Nenhum modelo personalizado cadastrado. Usando o texto padrão de fábrica.
                                </div>
                            )}

                            {/* Email Preview & Edit Form */}
                            <div className="space-y-3 pt-2">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Assunto</label>
                                    <input
                                        type="text"
                                        value={customSubject}
                                        onChange={e => setCustomSubject(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Mensagem</label>
                                    <textarea
                                        value={customBody}
                                        onChange={e => setCustomBody(e.target.value)}
                                        rows={8}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary font-mono text-xs"
                                    />
                                </div>
                            </div>

                            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 pt-6">
                                <button 
                                    type="button" 
                                    onClick={() => setShowConfirmModal(null)}
                                    className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-855 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-5 py-2.5 rounded-xl text-sm"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleConfirmBooking}
                                    disabled={actionLoading}
                                    className="bg-brand-primary hover:bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow-lg shadow-brand-primary/20 flex items-center gap-1.5"
                                >
                                    {actionLoading ? 'Confirmando...' : 'Confirmar e Enviar E-mail'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SchedulingPage;
