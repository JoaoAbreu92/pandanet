
import React, { useState, useEffect, useCallback } from 'react';
import type { Company, Employee, Page, AppData, Announcement, EmployeePermissions, Notification, Post, Ticket, Conversation, CalendarEvent, Recognition, TIRequest } from './types';

import Layout from './components/Layout';
import { LanguageProvider } from './components/LanguageContext';
import { AuthProvider, useAuth } from './components/AuthContext';
import LoginPage from './components/LoginPage';
import { supabase } from './supabaseClient';
import { ToastProvider } from './components/ToastContext';
import { NotificationProvider, useNotifications } from './components/NotificationContext';
import { PresenceProvider, usePresence } from './components/PresenceContext';


import HomePage from './components/HomePage';
import Messages from './components/Messages';
import TicketPage from './components/TicketPage';
import CalendarPage from './components/CalendarPage';
import DirectoryPage from './components/DirectoryPage';
import ResourceCenter from './components/ResourceCenter';
import RecognitionPage from './components/RecognitionPage';
import MarketplacePage from './components/MarketplacePage';
import FormsPage from './components/FormsPage';
import BeneficiosPage from './components/BeneficiosPage';
import BemEstarPage from './components/BemEstarPage';
import OnboardingPage from './components/OnboardingPage';
import TIPage from './components/TIPage';
import TIRequestsPage from './components/TIRequestsPage';
import ProfilePage from './components/ProfilePage';
import SaaSDashboard from './components/SaaSDashboard';
import AdminPage from './components/AdminPage';
import AnnouncementDetailPage from './components/AnnouncementDetailPage';
import FeedPage from './components/FeedPage';
import EventsPage from './components/EventsPage';
import TrainingPage from './components/TrainingPage';
import SurveysPage from './components/SurveysPage';
import PoliciesPage from './components/PoliciesPage';
import KnowledgeBasePage from './components/KnowledgeBasePage';
import StatusPage from './components/StatusPage';
import InfoSecPage from './components/InfoSecPage';
import JobsPage from './components/JobsPage.tsx';
import EmployeePortal from './components/EmployeePortal.tsx';
import OrgChartPage from './components/OrgChartPage.tsx';
import KPIDashboard from './components/KPIDashboard.tsx';
import ManualPage from './components/ManualPage.tsx';
import CRMDashboard from './components/CRMDashboard';
import CRMCustomers from './components/CRMCustomers';
import CRMCustomerDetail from './components/CRMCustomerDetail';
import CRMNewCustomerForm from './components/CRMNewCustomerForm';
import CRMFinanceForm from './components/CRMFinanceForm';
import CRMItemForm from './components/CRMItemForm';
import CRMSubscriptionForm from './components/CRMSubscriptionForm';
import CRMContractForm from './components/CRMContractForm';
import CRMCalendar from './components/CRMCalendar';
import CRMSales from './components/CRMSales';
import WhatsPanda from './components/WhatsPanda.tsx';
import EmailPage from './components/EmailPage';
import CRMTasks from './components/CRMTasks';
import AIAssistant from './components/AIAssistant';
import PWAReloadPrompt from './components/PWAReloadPrompt';
import SupportInbox from './components/SupportInbox';
import { CRMCustomer } from './types';


const AppContent: React.FC = () => {
    const { session, profile, currentUser, loading, signOut, isGhostMode, setGhostData, impersonatedUser } = useAuth();
    const { onlineUsers } = usePresence();

    // Authentication & Tenant State
    const [companies, setCompanies] = useState<Company[]>([]);
    const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
    const [authStage, setAuthStage] = useState<'logged_in' | 'superadmin_panel'>('logged_in');

    // Loading & Error States
    const [companyLoading, setCompanyLoading] = useState(false);
    const [initError, setInitError] = useState<string | null>(null);

    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
        }
        return 'light';
    });
    const [isShaking, setIsShaking] = useState(false);

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Global Nudge Listener
    useEffect(() => {
        if (!currentUser?.id) return;

        console.log(`[PandaNet] 🎧 REGISTERING NUDGE LISTENER for user: ${currentUser.id}`);

        const channel = supabase
            .channel('global-nudges')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages'
            }, async (payload) => {
                const newMsg = payload.new;
                if (newMsg.file_type === 'nudge') {
                    console.log('[PandaNet] DB Nudge detectado:', newMsg);
                    handleNudge(newMsg.sender_id, newMsg.conversation_id);
                }
            })
            // LISTENER 2: Dedicated NUDGES Table (High Reliability - Client Side Filtering)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'nudges'
                // Filter removed to ensure reception, filtering manually below
            }, async (payload) => {
                console.log('[PandaNet] 🔔 RAW EVENT RECEIVED FROM NUDGES TABLE');
                console.log('[PandaNet] Full payload:', JSON.stringify(payload, null, 2));

                const newNudge = payload.new as any;
                console.log('[PandaNet] NUDGE TABLE EVENT (RAW):', newNudge);

                if (newNudge.receiver_id === currentUser.id) {
                    console.log('[PandaNet] Nudge match! Executing shake.');
                    // DEBUG: Force visual confirmation
                    if (localStorage.getItem('debug_nudge')) {
                        alert(`DEBUG: Recebi Nudge de ${newNudge.sender_id}`);
                    }
                    handleNudge(newNudge.sender_id, newNudge.conversation_id);
                } else {
                    console.log(`[PandaNet] Ignoring nudge for ${newNudge.receiver_id} (I am ${currentUser.id})`);
                }
            })
            .on('broadcast', { event: 'nudge' }, (payload) => {
                console.log('[PandaNet] 📡 BROADCAST NUDGE RECEIVED');
                console.log('[PandaNet] Full broadcast payload:', JSON.stringify(payload, null, 2));

                const { sender_id, conversation_id, receiver_id } = payload.payload;
                console.log('[PandaNet] Sender ID from broadcast:', sender_id);
                console.log('[PandaNet] Receiver ID from broadcast:', receiver_id);
                console.log('[PandaNet] My User ID:', currentUser.id);

                // Validate receiver if present in payload
                if (receiver_id && receiver_id !== currentUser.id) {
                    console.log(`[PandaNet] ❌ Ignoring broadcast nudge for ${receiver_id} (I am ${currentUser.id})`);
                    return;
                }

                console.log('[PandaNet] ✅ Broadcast nudge is for me! Calling handleNudge...');
                handleNudge(sender_id, conversation_id);
            })
            .subscribe((status) => {
                console.log('[PandaNet] Realtime Connection Status:', status);
            });

        const handleNudge = (senderId: string, conversationId: string) => {
            const isSender = senderId === currentUser.id;
            const testMode = localStorage.getItem('nudge_test_mode') === 'true';

            console.log(`[PandaNet] ========== NUDGE HANDLER START ==========`);
            console.log(`[PandaNet] Sender ID: ${senderId}`);
            console.log(`[PandaNet] Current User ID: ${currentUser.id}`);
            console.log(`[PandaNet] Is Sender? ${isSender}`);
            console.log(`[PandaNet] Test Mode? ${testMode}`);
            console.log(`[PandaNet] Conversation ID: ${conversationId}`);

            // Play sound
            console.log(`[PandaNet] Playing nudge sound...`);
            playNotificationSound('nudge');

            // Force navigation only for receiver (or in test mode, treat as receiver)
            if (!isSender || testMode) {
                console.log(`[PandaNet] ${testMode ? 'TEST MODE' : 'RECEIVER MODE'}: Navigating to messages page...`);
                setCurrentPage('messages');
                setPageContext({ conversationId: conversationId });
            } else {
                console.log(`[PandaNet] SENDER MODE: Skipping navigation`);
            }

            // TREMER A TELA (SHAKE)
            console.log(`[PandaNet] Initiating shake animation...`);
            console.log(`[PandaNet] Current isShaking state: ${isShaking}`);
            setIsShaking(false);
            setTimeout(() => {
                console.log(`[PandaNet] Setting isShaking to TRUE`);
                setIsShaking(true);
            }, 50);
            setTimeout(() => {
                console.log(`[PandaNet] Resetting isShaking to FALSE after 5s`);
                setIsShaking(false);
            }, 5050);
            console.log(`[PandaNet] ========== NUDGE HANDLER END ==========`);
        };

        // DEV: Allow manual triggering via console
        (window as any).triggerDetectionShake = () => {
            console.log('Manual Shake Triggered');
            setIsShaking(true);
            setTimeout(() => setIsShaking(false), 2000);
        };

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUser?.id, currentUser?.company_id]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    const [isImpersonating, setIsImpersonating] = useState(false);
    const [impersonatedCompany, setImpersonatedCompany] = useState<Company | null>(null);

    const [currentPage, setCurrentPage] = useState<Page>(() => {
        const saved = localStorage.getItem('pixel_current_page');
        if (saved && ['home', 'feed', 'messages', 'tickets', 'calendar', 'directory', 'documentos', 'recognition', 'marketplace', 'forms', 'benefits', 'bem-estar', 'onboarding', 'ti-dashboard', 'ti-requests', 'profile-page', 'saas-dashboard', 'admin', 'training', 'surveys', 'policies', 'knowledge-base', 'service-status', 'infosec', 'events', 'announcement-detail', 'manual-usuario'].includes(saved)) {
            return saved as Page;
        }
        return 'home';
    });
    const [pageContext, setPageContext] = useState<any>(() => {
        const saved = localStorage.getItem('pixel_page_context');
        try {
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });

    const [companyData, setCompanyData] = useState<AppData | null>(null);
    const [companySettings, setCompanySettings] = useState<any>(null);

    // Trigger to reload CRMSales data when modals close
    const [crmRefreshTrigger, setCrmRefreshTrigger] = useState(0);

    const { notifications, markAsRead, markAllAsRead, playNotificationSound } = useNotifications();

    // Robust Initialization Logic
    useEffect(() => {
        const loadInitialData = async () => {
            if (currentUser) {
                const userEmail = currentUser.email.toLowerCase();
                setCompanyLoading(true);
                setInitError(null);

                try {
                    console.log("Iniciando carregamento para:", userEmail);
                    let targetCompanyId = currentUser.company_id;

                    // Fallback para Master Admin sem ID de empresa
                    const isMaster = userEmail === 'ti@grupopixel.com.br';
                    if (!targetCompanyId && isMaster) {
                        console.log("Master Admin sem company_id. Buscando domínio grupopixel.com.br...");
                        const { data: companyByDomain } = await supabase
                            .from('companies')
                            .select('id')
                            .eq('domain', 'grupopixel.com.br')
                            .single();
                        if (companyByDomain) targetCompanyId = companyByDomain.id;
                    }

                    if (targetCompanyId) {
                        const { data: company, error } = await supabase
                            .from('companies')
                            .select('*, plan:plans(*)')
                            .eq('id', targetCompanyId)
                            .single();

                        if (error) throw error;

                        if (company) {
                            const mappedCompany = company as unknown as Company;
                            const baseData = (mappedCompany.data || {}) as any;
                            // Fetch real employees for this company
                            const { data: realProfiles } = await supabase
                                .from('profiles')
                                .select('*')
                                .eq('company_id', targetCompanyId);

                            const mergedData: AppData = {
                                ...baseData,
                                employees: (realProfiles || []).map((p: any) => {
                                    // Helper para URL do avatar
                                    let avatarUrl = p.avatar_url;
                                    if (avatarUrl && !avatarUrl.startsWith('http')) {
                                        const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(avatarUrl);
                                        avatarUrl = publicUrl.publicUrl;
                                    }
                                    if (!avatarUrl) {
                                        avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(p.full_name)}&background=random`;
                                    }
                                    return {
                                        id: p.id,
                                        name: p.full_name,
                                        email: p.email,
                                        avatarUrl: avatarUrl,
                                        coverUrl: p.cover_url,
                                        role: p.role || 'Colaborador',
                                        team: p.team || p.department || 'Geral',
                                        isAdmin: p.is_admin || false,
                                        isOnline: false, // Default to false
                                        company_id: p.company_id,
                                        performance: p.performance,
                                        following: p.following || [],
                                        permissions: p.permissions || {}
                                    };
                                }),
                                announcements: baseData.announcements || [],
                                banners: baseData.banners || [],
                                conversations: baseData.conversations || [],
                                tickets: baseData.tickets || [],
                                marketplaceItems: baseData.marketplaceItems || [],
                                formSubmissions: baseData.formSubmissions || [],
                                tiRequests: baseData.tiRequests || [],
                                documents: baseData.documents || [],
                                benefits: baseData.benefits || [],
                                polls: baseData.polls || [],
                                feedPosts: baseData.feedPosts || [],
                                events: baseData.events || [],
                                trainings: baseData.trainings || [],
                                kbArticles: baseData.kbArticles || [],
                                services: baseData.services || [],
                                securityAlerts: baseData.securityAlerts || [],
                                recognitions: baseData.recognitions || [],
                                wellnessItems: baseData.wellnessItems || []
                            };

                            const mergedCompany: Company = {
                                ...mappedCompany,
                                data: mergedData
                            };

                            setCurrentCompany(mergedCompany);
                            setCompanyData(mergedData);
                            setCompanySettings(mappedCompany.settings || { companyName: mappedCompany.name });
                            console.log("Empresa carregada com sucesso:", mappedCompany.name);
                        } else {
                            throw new Error("Dados da empresa não encontrados.");
                        }
                    } else if (isMaster) {
                        // ROOT ACCESS: Se for Master e não achou empresa, carrega um contexto mock "Root"
                        console.log("ROOT ACCESS: Master Admin sem empresa vinculada. Carregando contexto administrativo.");
                        const rootCompany: Company = {
                            id: 'root',
                            name: 'Grupo Pixel (Administração)',
                            domain: 'grupopixel.com.br',
                            status: 'active',
                            plan: { id: 'root-plan', name: 'Master Plan', features: profile.permissions } as any,
                            settings: { companyName: 'Grupo Pixel' },
                            data: {
                                employees: [profile], announcements: [], banners: [], conversations: [], tickets: [], marketplaceItems: [],
                                formSubmissions: [], tiRequests: [], documents: [], benefits: [], polls: [], feedPosts: [],
                                events: [], trainings: [], kbArticles: [], services: [], securityAlerts: [], recognitions: [], wellnessItems: []
                            }
                        };
                        setCurrentCompany(rootCompany);
                        setCompanyData({
                            employees: [profile], announcements: [], banners: [], conversations: [], tickets: [], marketplaceItems: [],
                            formSubmissions: [], tiRequests: [], documents: [], benefits: [], polls: [], feedPosts: [],
                            events: [], trainings: [], kbArticles: [], services: [], securityAlerts: [], recognitions: [], wellnessItems: []
                        });
                        setCompanySettings({ companyName: 'Grupo Pixel' });
                    } else {
                        console.log("Usuário sem empresa vinculada. Aguardando RepairProfile.");
                    }
                } catch (err: any) {
                    console.error("Erro crítico de inicialização:", err);
                    setInitError(err.message || "Falha ao sincronizar com o servidor.");
                } finally {
                    setCompanyLoading(false);
                }
            } else {
                setCurrentCompany(null);
                setCompanyData(null);
                setCompanySettings(null);
                setCompanyLoading(false);
            }
        };
        loadInitialData();
    }, [currentUser]);

    // Sync Online Status
    useEffect(() => {
        setCompanyData(prev => {
            if (!prev) return null;
            const hasChanges = prev.employees.some(e => e.isOnline !== onlineUsers.has(e.id));
            if (!hasChanges) return prev;

            return {
                ...prev,
                employees: prev.employees.map(e => ({
                    ...e,
                    isOnline: onlineUsers.has(e.id)
                }))
            };
        });
    }, [onlineUsers]);

    const handleLogout = async () => {
        try {
            await signOut();

            // Preserve user preferences that should persist across sessions
            const stickers = localStorage.getItem('custom_stickers');
            const notes = localStorage.getItem('sticky_notes');

            // Aggressive Cleanup (but keep stickers/notes)
            localStorage.clear();
            sessionStorage.clear();

            if (stickers) localStorage.setItem('custom_stickers', stickers);
            if (notes) localStorage.setItem('sticky_notes', notes);

            // Give a tiny moment for storage events to propogate
            setTimeout(() => {
                window.location.href = window.location.origin;
            }, 100);
        } catch (error) {
            console.error("Erro ao deslogar:", error);
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = window.location.origin;
        }
    };


    const handleImpersonateStart = (company: Company) => {
        setGhostData(true, null); // Auditoria de empresa
        setImpersonatedCompany(company);
        setCurrentCompany(company);
        setCompanyData(company.data || { employees: [] } as any);
        setCompanySettings(company.settings || { companyName: company.name });
        setIsImpersonating(true);
        localStorage.setItem('pixel_is_impersonating', 'true');
        setCurrentPage('home');
        setAuthStage('logged_in');
    };

    const handleImpersonateUserStart = (targetEmployee: Employee) => {
        setGhostData(true, targetEmployee); // Auditoria profunda de usuário
        setIsImpersonating(true);
        localStorage.setItem('pixel_is_impersonating', 'true');
        alert(`Entrando em Modo Auditoria: Agora você vê a intranet como ${targetEmployee.name}. Nenhuma ação sua será registrada.`);
        // Force full reload to ensure useAuth and App's useEffect initialize completely as the new user context
        setTimeout(() => window.location.reload(), 100);
    };

    const handleImpersonateEnd = () => {
        setGhostData(false, null);
        setIsImpersonating(false);
        setImpersonatedCompany(null);
        localStorage.removeItem('pixel_is_impersonating');
        window.location.reload();
    };

    const handleNavigate = useCallback((page: Page, context?: any) => {
        setCurrentPage(page);
        setPageContext(context ?? null);
        localStorage.setItem('pixel_current_page', page);
        if (context) {
            localStorage.setItem('pixel_page_context', JSON.stringify(context));
        } else {
            localStorage.removeItem('pixel_page_context');
        }
        window.scrollTo(0, 0);
    }, []);

    const handleUpdateUser = (updatedUser: Employee) => {
        if (companyData) {
            setCompanyData({
                ...companyData,
                employees: companyData.employees.map(e => e.id === updatedUser.id ? updatedUser : e)
            });
        }
    };

    const handleSetCompanyForAdmin = async (updatedCompany: Company) => {
        console.log("[App] Atualizando empresa:", updatedCompany);
        
        setCurrentCompany(updatedCompany);
        setCompanyData(updatedCompany.data);
        setCompanySettings(updatedCompany.settings);
        setCompanies(prev => prev.map(c => c.domain === updatedCompany.domain ? updatedCompany : c));

        // Persist to Supabase
        if (updatedCompany.id && updatedCompany.id !== 'root') {
            try {
                console.log("[App] Salvando no Supabase...");
                const { error } = await supabase
                    .from('companies')
                    .update({
                        data: updatedCompany.data,
                        settings: updatedCompany.settings,
                        name: updatedCompany.name,
                        domain: updatedCompany.domain
                    })
                    .eq('id', updatedCompany.id);
                if (error) throw error;
                console.log("[App] ✅ Alterações da empresa salvas no Supabase.");
                
                // Recarregar do banco para garantir sincronização
                console.log("[App] Recarregando empresa do banco...");
                const { data: freshCompany, error: reloadError } = await supabase
                    .from('companies')
                    .select('*')
                    .eq('id', updatedCompany.id)
                    .single();
                
                if (!reloadError && freshCompany) {
                    console.log("[App] ✅ Empresa recarregada:", freshCompany);
                    setCompanySettings(freshCompany.settings || { companyName: freshCompany.name });
                }
            } catch (err: any) {
                console.error("[App] ❌ Erro ao persistir dados da empresa:", err.message);
                alert("Erro ao salvar no banco de dados: " + err.message);
            }
        }
    };

    const handleUpdateFeedPosts = (newPosts: Post[]) => {
        if (companyData) setCompanyData({ ...companyData, feedPosts: newPosts });
    };

    const handleUpdateTickets = (newTickets: Ticket[]) => {
        if (companyData) setCompanyData({ ...companyData, tickets: newTickets });
    };

    const handleUpdateConversations = (newConversations: Conversation[]) => {
        if (companyData) setCompanyData({ ...companyData, conversations: newConversations });
    };

    const handleUpdateTIRequests = (newRequests: TIRequest[]) => {
        if (companyData) setCompanyData({ ...companyData, tiRequests: newRequests });
    };

    const handleJoinEvent = (eventId: number | string) => {
        if (!companyData || !currentUser) return;
        const updatedEvents = companyData.events.map(event => {
            if (String(event.id) === String(eventId)) {
                // Cast to avoid string/number mismatch
                const isAttending = (event.attendees as string[]).includes(String(currentUser.id));
                const newAttendees = isAttending
                    ? event.attendees.filter(id => String(id) !== String(currentUser.id))
                    : [...event.attendees, String(currentUser.id)];
                return { ...event, attendees: newAttendees } as any;
            }
            return event;
        });
        setCompanyData({ ...companyData, events: updatedEvents as any });
    };

    const handleDeclineEvent = (eventId: number | string, reason: string) => {
        if (!companyData || !currentUser) return;
        const updatedEvents = companyData.events.map(event => {
            if (String(event.id) === String(eventId)) {
                const newAttendees = event.attendees.filter(id => String(id) !== String(currentUser.id));
                const newDeclined = [...(event.declined || []).filter(d => String(d.userId) !== String(currentUser.id)), { userId: currentUser.id, reason }];
                return { ...event, attendees: newAttendees, declined: newDeclined } as any;
            }
            return event;
        });
        setCompanyData({ ...companyData, events: updatedEvents as any });
    };

    const handleAddRecognition = (rec: Recognition) => {
        if (!companyData) return;
        setCompanyData({ ...companyData, recognitions: [rec, ...(companyData.recognitions || [])] });
    };

    const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<CRMCustomer | null>(null);
    const [financeFormType, setFinanceFormType] = useState<'invoice' | 'proposal' | 'estimate' | null>(null);
    const [showItemForm, setShowItemForm] = useState(false);
    const [showSubscriptionForm, setShowSubscriptionForm] = useState(false);
    const [showContractForm, setShowContractForm] = useState(false);
    const [crmCustomers, setCrmCustomers] = useState<CRMCustomer[]>([]);

    const fetchCRMCustomers = useCallback(async () => {
        if (!currentUser?.company_id) return;
        try {
            const { data, error } = await supabase
                .from('crm_customers')
                .select('*')
                .eq('company_id', currentUser.company_id)
                .order('name');
            if (error) throw error;
            setCrmCustomers(data || []);
        } catch (error) {
            console.error('Error fetching CRM customers:', error);
        }
    }, [currentUser?.company_id]);

    useEffect(() => {
        if (currentUser?.company_id) {
            fetchCRMCustomers();
        }
    }, [currentUser?.company_id, fetchCRMCustomers]);

    const handleViewCustomer = async (customerOrId: CRMCustomer | string) => {
        console.log('[App] handleViewCustomer called with:', customerOrId);
        if (typeof customerOrId === 'string') {
            // Se receber apenas o ID (ex: do módulo de Vendas), busca os dados completos
            const { data, error } = await supabase
                .from('crm_customers')
                .select('*')
                .eq('id', customerOrId)
                .single();

            if (!error && data) {
                setSelectedCustomer(data);
                setCurrentPage('crm-customer-detail');
            }
        } else {
            setSelectedCustomer(customerOrId);
            setCurrentPage('crm-customer-detail');
        }
    };

    const renderPage = () => {
        if (!currentUser || !companyData) return null;

        const canAccess = (permission: keyof EmployeePermissions) => {
            if (currentUser.role === 'Super Admin') return true;
            if (currentUser.permissions?.[permission] === false) return false;

            const featureMap: Record<string, string> = {
                'viewMessages': 'messages',
                'viewCalendar': 'calendar',
                'useMarketplace': 'marketplace',
                'viewBenefits': 'benefits',
                'viewWellbeing': 'wellness',
                'openTickets': 'tickets',
                'viewKnowledgeBase': 'kb',
                'viewPolicies': 'policies',
                'viewRecognition': 'wall',
                'viewWhatsPanda': 'whatspanda',
                'viewEmail': 'email',
                'viewOnboarding': 'onboarding',
                'viewJobs': 'jobs',
                'viewTraining': 'training',
                'viewSurveys': 'surveys',
                'viewOrgChart': 'org-chart',
                'viewMeuRH': 'meu-rh',
                'viewDirectory': 'org-chart',
                'viewInfoSec': 'infosec',
                'viewKPIDashboard': 'kpis',
                'crm-dashboard': 'crm',
                'crm-customers': 'crm',
                'crm-sales': 'crm',
                'crm-invoices': 'crm',
                'crm-proposals': 'crm',
                'crm-estimates': 'crm',
                'crm-payments': 'crm',
                'crm-subscriptions': 'crm',
                'crm-contracts': 'crm'
            };

            const featureId = featureMap[permission];
            if (featureId && currentCompany?.custom_features && currentCompany.custom_features[featureId] === false) {
                return false;
            }

            return true;
        };

        switch (currentPage) {
            case 'crm-dashboard':
                return <CRMDashboard />;
            case 'crm-customers':
                return <CRMCustomers
                    onNewCustomer={() => setIsNewCustomerModalOpen(true)}
                    onViewCustomer={handleViewCustomer}
                />;
            case 'crm-customer-detail':
                return selectedCustomer ? (
                    <CRMCustomerDetail
                        customer={selectedCustomer}
                        onClose={() => setCurrentPage('crm-customers')}
                        onUpdate={() => { }}
                    />
                ) : <CRMCustomers onNewCustomer={() => setIsNewCustomerModalOpen(true)} onViewCustomer={handleViewCustomer} />;
            case 'crm-calendar':
                return <CRMCalendar />;
            case 'crm-tasks':
                return <CRMTasks />;
            case 'crm-sales':
            case 'crm-invoices':
            case 'crm-proposals':
            case 'crm-estimates':
            case 'crm-payments':
            case 'crm-credit-notes':
            case 'crm-items':
                return (
                    <CRMSales
                        initialTab={currentPage === 'crm-sales' ? 'invoices' : currentPage.replace('crm-', '') as any}
                        onViewCustomer={handleViewCustomer}
                        refreshTrigger={crmRefreshTrigger}
                        onNewRequest={(type, item) => {
                            if (type === 'item') setShowItemForm(true);
                            else if (type === 'subscription') setShowSubscriptionForm(true);
                            else setFinanceFormType(type as any);
                            // TODO: Pass item to forms for editing
                        }}
                    />
                );
            case 'crm-subscriptions':
                return (
                    <CRMSales
                        initialTab="subscriptions"
                        onViewCustomer={handleViewCustomer}
                        refreshTrigger={crmRefreshTrigger}
                        onNewRequest={(type, item) => setShowSubscriptionForm(true)}
                    />
                );
            case 'crm-contracts':
                return (
                    <CRMSales
                        initialTab="contracts"
                        onViewCustomer={handleViewCustomer}
                        refreshTrigger={crmRefreshTrigger}
                        onNewRequest={(type, item) => setShowContractForm(true)}
                    />
                );
            case 'home': return <HomePage onNavigate={handleNavigate} employees={companyData.employees} currentUser={currentUser} />;
            case 'feed': return <FeedPage currentUser={currentUser} allEmployees={companyData.employees} posts={companyData.feedPosts} setPosts={handleUpdateFeedPosts} onNavigate={handleNavigate} />;
            case 'messages': return <Messages initialConversationId={pageContext?.conversationId} />;
            case 'support-inbox': return <SupportInbox onNavigate={handleNavigate} />;

            case 'tickets': return <TicketPage />;
            case 'calendar': return <CalendarPage events={companyData.events as unknown as CalendarEvent[]} currentUser={currentUser} />;
            case 'directory': return <DirectoryPage onNavigate={handleNavigate} employees={companyData.employees} onImpersonateUser={handleImpersonateUserStart} />;
            case 'documentos': return canAccess('viewDocuments') ? <ResourceCenter /> : null;
            case 'recognition': return canAccess('viewRecognition') ? <RecognitionPage /> : null;
            case 'marketplace': return canAccess('useMarketplace') ? <MarketplacePage /> : null;
            case 'forms': return canAccess('viewForms') ? <FormsPage /> : null;
            case 'benefits': return canAccess('viewBenefits') ? <BeneficiosPage /> : null;
            case 'bem-estar': return canAccess('viewWellbeing') ? <BemEstarPage /> : null;
            case 'onboarding': return canAccess('viewOnboarding') ? <OnboardingPage /> : null;
            case 'ti-dashboard': return canAccess('viewTiDashboard') ? <TIPage onNavigate={handleNavigate} /> : null;
            case 'ti-requests': return canAccess('openTiRequests') ? <TIRequestsPage submissions={companyData.tiRequests} setSubmissions={handleUpdateTIRequests} currentUser={currentUser} /> : null;
            case 'profile-page':
                const targetUserId = typeof pageContext === 'string' ? pageContext : (pageContext?.id || currentUser?.id);
                return <ProfilePage userId={targetUserId} currentUser={currentUser} onUpdateUser={handleUpdateUser} feedPosts={companyData.feedPosts} setFeedPosts={handleUpdateFeedPosts} allEmployees={companyData.employees} isAIEnabled={currentCompany?.custom_features?.ai_assistant !== false} />;
            case 'saas-dashboard': return currentUser.role === 'Super Admin' ? <SaaSDashboard companies={companies} onImpersonate={handleImpersonateStart} /> : <p className="p-8 text-center text-red-600">Área restrita.</p>;
            case 'admin': return (currentUser.isAdmin || currentUser.isCompanyAdmin || currentUser.role === 'Super Admin') && (currentCompany && currentCompany.plan) ? <AdminPage company={currentCompany} setCompany={handleSetCompanyForAdmin} plan={currentCompany.plan} customFeatures={currentCompany.custom_features} onNavigate={handleNavigate} /> : <p className="p-8 text-center text-red-600">Acesso negado ou empresa não carregada.</p>;
            case 'training': return canAccess('viewTraining') ? <TrainingPage /> : null;
            case 'surveys': return canAccess('viewSurveys') ? <SurveysPage /> : null;
            case 'policies': return canAccess('viewPolicies') ? <PoliciesPage /> : null;
            case 'knowledge-base': return canAccess('viewKnowledgeBase') ? <KnowledgeBasePage /> : null;
            case 'service-status': return canAccess('viewServiceStatus') ? <StatusPage /> : null;
            case 'infosec': return canAccess('viewInfoSec') ? <InfoSecPage /> : null;
            case 'events': return <EventsPage initialEventId={pageContext?.eventId} />;
            case 'announcement-detail': return <AnnouncementDetailPage announcement={pageContext as Announcement} onBack={() => handleNavigate('home')} />;
            case 'jobs': return <JobsPage />;
            case 'meu-rh': return <EmployeePortal />;
            case 'org-chart': return <OrgChartPage employees={companyData.employees} />;
            case 'kpi-dashboard': return <KPIDashboard />;
            case 'manual-usuario': return <ManualPage />;
            case 'whatspanda': return canAccess('viewWhatsPanda') ? <WhatsPanda /> : null;

            case 'email': return <EmailPage currentUser={currentUser} />;
            default: return <HomePage onNavigate={handleNavigate} employees={companyData.employees} currentUser={currentUser} />;
        }
    };

    // Global UI Blocks
    if (loading || companyLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col space-y-4">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
                    <p className="text-gray-600 font-medium font-brand">Iniciando Pixel Intranet...</p>
                </div>
            </div>
        );
    }

    if (initError) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-red-100">
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">Ops! Algo deu errado</h2>
                    <p className="text-gray-600 mb-8 leading-relaxed">{initError}</p>
                    <div className="space-y-3">
                        <button onClick={() => window.location.reload()} className="w-full px-6 py-3 bg-brand-primary text-white font-semibold rounded-xl hover:bg-emerald-600 transition-all shadow-md">Tentar Novamente</button>
                        <button onClick={handleLogout} className="w-full px-6 py-3 text-gray-500 font-medium hover:text-gray-700 transition-colors">Sair da Conta</button>
                    </div>
                </div>
            </div>
        );
    }

    if (!session) {
        return <LoginPage />;
    }

    // Pending Approval Block
    if (currentUser && currentUser.status === 'pending') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
                <div className="bg-white p-10 rounded-2xl shadow-xl max-w-md w-full text-center border border-amber-100">
                    <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Aguardando Validação</h2>
                    <p className="text-gray-600 mb-8 leading-relaxed">
                        Seu cadastro foi recebido com sucesso! Para garantir a segurança da plataforma, um administrador do <b>Grupo Pixel</b> revisará seu acesso em breve.
                    </p>
                    <div className="bg-amber-50 rounded-xl p-4 mb-8 text-sm text-amber-800 text-left flex gap-3">
                        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Você receberá um e-mail assim que sua conta for liberada. Geralmente leva menos de 24h.</span>
                    </div>
                    <button onClick={handleLogout} className="w-full px-6 py-3 text-gray-500 font-medium hover:text-gray-700 transition-colors">Sair da Conta</button>
                </div>
            </div>
        );
    }

    // Rejected Access Block
    if (currentUser && currentUser.status === 'rejected') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
                <div className="bg-white p-10 rounded-2xl shadow-xl max-w-md w-full text-center border border-red-100">
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">Acesso Rejeitado</h2>
                    <p className="text-gray-600 mb-8 leading-relaxed">
                        Infelizmente, sua solicitação de acesso não foi aprovada pelo administrador do sistema.
                        Se você acredita que isso é um erro, entre em contato com o suporte.
                    </p>
                    <button onClick={handleLogout} className="w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-all shadow-md">Voltar ao Login</button>
                </div>
            </div>
        );
    }

    // Success Block
    if (currentUser && companyData && currentCompany && companySettings) {
        return (
            <Layout
                currentUser={currentUser}
                currentCompany={currentCompany}
                companySettings={companySettings}
                isImpersonating={isImpersonating}
                impersonatedUser={impersonatedUser}
                impersonatedCompanyName={impersonatedCompany?.name}
                onNavigate={handleNavigate}
                currentPage={currentPage}
                onLogout={handleLogout}
                onEndImpersonation={handleImpersonateEnd}
                notifications={notifications}
                onMarkAsRead={markAsRead}
                onClearAllNotifications={markAllAsRead}
                theme={theme}
                toggleTheme={toggleTheme}
                isShaking={isShaking}
            >
                {renderPage()}
                <AIAssistant currentUser={currentUser} isAIEnabled={currentCompany?.custom_features?.ai_assistant !== false} />

                {isNewCustomerModalOpen && (
                    <CRMNewCustomerForm
                        onClose={() => setIsNewCustomerModalOpen(false)}
                        onSuccess={() => {
                            setIsNewCustomerModalOpen(false);
                            fetchCRMCustomers();
                        }}
                    />
                )}

                {financeFormType && (
                    <CRMFinanceForm
                        type={financeFormType}
                        customers={crmCustomers}
                        currentUser={currentUser}
                        onClose={() => setFinanceFormType(null)}
                        onSuccess={() => {
                            setFinanceFormType(null);
                            setCrmRefreshTrigger(prev => prev + 1);
                        }}
                    />
                )}

                {showItemForm && (
                    <CRMItemForm
                        onClose={() => setShowItemForm(false)}
                        onSave={() => {
                            setShowItemForm(false);
                            setCrmRefreshTrigger(prev => prev + 1);
                        }}
                    />
                )}

                {showSubscriptionForm && (
                    <CRMSubscriptionForm
                        onClose={() => setShowSubscriptionForm(false)}
                        onSave={() => {
                            setShowSubscriptionForm(false);
                            setCrmRefreshTrigger(prev => prev + 1);
                        }}
                    />
                )}

                {showContractForm && (
                    <CRMContractForm
                        onClose={() => setShowContractForm(false)}
                        onSave={() => {
                            setShowContractForm(false);
                            setCrmRefreshTrigger(prev => prev + 1);
                        }}
                    />
                )}
            </Layout>
        );
    }

    // Fallback: Repair Profile
    // Fallback: If session exists but profile is missing, and it's not loading
    if (session && (!currentUser || (!currentUser.company_id && !currentUser.isAdmin)) && !loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
                <div className="bg-white p-10 rounded-2xl shadow-xl max-w-md w-full text-center border border-red-100">
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">Acesso Não Autorizado</h2>
                    <p className="text-gray-600 mb-8 leading-relaxed">
                        Não encontramos um perfil ativo para sua conta ou seu acesso foi removido.
                        Por favor, entre em contato com o administrador da sua empresa.
                    </p>
                    <button
                        onClick={handleLogout}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-red-200"
                    >
                        Sair do Sistema
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
                <p className="text-gray-600 font-medium">Sincronizando portal...</p>
            </div>
        </div>
    );
};


const App: React.FC = () => {
    return (
        <LanguageProvider>
            <AuthProvider>
                <PresenceProvider>
                    <NotificationProvider>
                        <ToastProvider>
                            <AppContent />
                            <PWAReloadPrompt />
                        </ToastProvider>
                    </NotificationProvider>
                </PresenceProvider>
            </AuthProvider>
        </LanguageProvider>
    );
};

export default App;
