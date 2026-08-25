
import React, { useState, useEffect, useCallback } from 'react';
import type { Company, Employee, Page, AppData, Announcement, EmployeePermissions, Notification, Post, Ticket, Conversation, CalendarEvent, Recognition, TIRequest, ActiveChatHead, Plan } from './types';

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
import WhatsPanda from './components/WhatsPanda.tsx';
import EmailPage from './components/EmailPage';
import AIAssistant from './components/AIAssistant';
import AICorrector from './components/AICorrector';
import PWAReloadPrompt from './components/PWAReloadPrompt';
import SupportInbox from './components/SupportInbox';
import PersonalNotesPage from './components/PersonalNotesPage';
import PersonalTasksPage from './components/PersonalTasksPage';
import ProjectsPage from './components/ProjectsPage';
import FloatingChatHeads from './components/FloatingChatHeads';
import SchedulingPage from './components/SchedulingPage';
import SchedulingBookPage from './components/SchedulingBookPage';
import AgendaPage from './components/AgendaPage';
import ReservationsPage from './components/ReservationsPage';



const AppContent: React.FC = () => {
    const { session, profile, currentUser, loading, signOut, isGhostMode, setGhostData, impersonatedUser } = useAuth();
    const { onlineUsers } = usePresence();

    // Authentication & Tenant State
    const [companies, setCompanies] = useState<Company[]>([]);
    const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
    const getMergedFeatures = (company: Company | null) => {
        if (!company) return {};
        const planFeatures = company.plan?.features || {};
        const customFeatures: Record<string, any> = company.custom_features || {};
        const merged: Record<string, any> = {};
        
        if (company.plan) {
            Object.keys(planFeatures).forEach(key => {
                const planVal = planFeatures[key];
                const customVal = customFeatures[key];
                
                if (planVal === false || planVal === 'disabled') {
                    merged[key] = false;
                } else if (customVal === false || customVal === 'disabled') {
                    merged[key] = false;
                } else {
                    merged[key] = customVal !== undefined ? customVal : planVal;
                }
            });
        } else {
            Object.assign(merged, customFeatures);
        }
        return merged;
    };
    const mergedFeatures = getMergedFeatures(currentCompany);
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

    const [isImpersonating, setIsImpersonating] = useState(() => localStorage.getItem('pixel_is_impersonating') === 'true');
    const [impersonatedCompany, setImpersonatedCompany] = useState<Company | null>(() => {
        const saved = localStorage.getItem('pixel_impersonated_company');
        return saved ? JSON.parse(saved) : null;
    });

    const [currentPage, setCurrentPage] = useState<Page>(() => {
        const saved = localStorage.getItem('pixel_current_page');
        if (saved && ['home', 'feed', 'messages', 'tickets', 'calendar', 'directory', 'documentos', 'recognition', 'marketplace', 'forms', 'benefits', 'bem-estar', 'onboarding', 'ti-dashboard', 'ti-requests', 'profile-page', 'saas-dashboard', 'admin', 'training', 'surveys', 'policies', 'knowledge-base', 'service-status', 'infosec', 'events', 'announcement-detail', 'manual-usuario', 'whatspanda', 'email', 'personal-notes', 'personal-tasks', 'scheduling', 'scheduling-events', 'scheduling-book'].includes(saved)) {
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

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const hash = window.location.hash;
        const bookParam = searchParams.get('book');
        
        if (bookParam) {
            setCurrentPage('scheduling-book');
            setPageContext({ eventTypeId: bookParam, isPublic: true });
        } else if (hash.startsWith('#/book/')) {
            const parts = hash.split('/');
            const eventId = parts[parts.length - 1];
            setCurrentPage('scheduling-book');
            setPageContext({ eventTypeId: eventId, isPublic: true });
        } else if (window.location.search.includes('page=scheduling-book')) {
            const id = searchParams.get('id');
            setCurrentPage('scheduling-book');
            setPageContext({ eventTypeId: id, isPublic: true });
        }
    }, []);

    const [companyData, setCompanyData] = useState<AppData | null>(null);
    const [companySettings, setCompanySettings] = useState<any>(null);

    // Trigger to reload CRMSales data when modals close

    // Global Search State
    const [globalSearchTerm, setGlobalSearchTerm] = useState('');

    const handleSearch = (term: string) => {
        setGlobalSearchTerm(term);
        // Se estiver em uma página que suporta busca, ela usará o term.
        // Se não, podemos navegar para o diretório ou Whatspanda dependendo do termo.
        if (currentPage !== 'directory' && currentPage !== 'whatspanda' && currentPage !== 'messages') {
            handleNavigate('directory');
        }
    };

    const { notifications, markAsRead, markAllAsRead, playNotificationSound } = useNotifications();

    // Robust Initialization Logic
    useEffect(() => {
        const loadInitialData = async () => {
            if (currentUser) {
                const userEmail = currentUser.email.toLowerCase();
                if (!companyData) {
                    setCompanyLoading(true);
                }
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
                            const rawPlan = company.plan as any;
                            const mappedPlan: Plan | undefined = rawPlan ? {
                                id: rawPlan.id,
                                name: rawPlan.name,
                                userLimit: rawPlan.user_limit,
                                whatsappLimit: rawPlan.whatsapp_limit || 1,
                                emailLimit: rawPlan.email_limit || 1,
                                features: rawPlan.features || {},
                                price: rawPlan.price
                            } : undefined;

                            const mappedCompany: Company = {
                                ...company,
                                plan: mappedPlan
                            } as unknown as Company;
                            const baseData = (mappedCompany.data || {}) as any;
                            // Fetch real employees for this company
                            const { data: realProfiles } = await supabase
                                .from('profiles')
                                .select('*')
                                .eq('company_id', targetCompanyId);

                            console.log(`[PandaNet] Sincronizando perfis para ${mappedCompany.name}. Encontrados: ${realProfiles?.length || 0}`);

                            const mergedData: AppData = {
                                ...baseData,
                                // Prioridade total para a tabela profiles. Ignora any 'employees' do JSONB legado.
                                employees: (realProfiles && realProfiles.length > 0) ? realProfiles.map((p: any) => {
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
                                        isCompanyAdmin: p.is_company_admin || false,
                                        isOnline: false, // Default to false
                                        company_id: p.company_id,
                                        performance: p.performance,
                                        following: p.following || [],
                                        permissions: p.permissions || {},
                                        is_manager: p.is_manager || false,
                                        reports_to: p.reports_to || null,
                                        sector_manager_id: p.sector_manager_id || null,
                                        department_id: p.department_id || null,
                                        email_permissions: p.email_permissions || null,
                                        whatspanda_permissions: p.whatspanda_permissions || null
                                    };
                                }) : [],
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
    }, [currentUser?.id, currentUser?.company_id]);

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
        if (!currentUser) return;
        const ghostUser = {
            ...currentUser,
            company_id: company.id,
            role: 'Super Admin',
            isCompanyAdmin: true
        };
        setGhostData(true, ghostUser); // Define currentUser como o admin desta empresa
        setImpersonatedCompany(company);
        localStorage.setItem('pixel_impersonated_company', JSON.stringify(company));
        localStorage.setItem('pixel_is_impersonating', 'true');
        localStorage.setItem('pixel_current_page', 'home');
        alert(`Entrando em modo fantasma para a empresa: ${company.name}`);
        setTimeout(() => window.location.reload(), 100);
    };

    const handleImpersonateUserStart = (targetEmployee: Employee) => {
        setGhostData(true, targetEmployee); // Auditoria profunda de usuário
        setIsImpersonating(true);
        localStorage.setItem('pixel_is_impersonating', 'true');
        localStorage.removeItem('pixel_impersonated_company');
        localStorage.setItem('pixel_current_page', 'home');
        alert(`Entrando em Modo Auditoria: Agora você vê a intranet como ${targetEmployee.name}. Nenhuma ação sua será registrada.`);
        // Force full reload to ensure useAuth and App's useEffect initialize completely as the new user context
        setTimeout(() => window.location.reload(), 100);
    };

    const handleImpersonateEnd = () => {
        setGhostData(false, null);
        setIsImpersonating(false);
        setImpersonatedCompany(null);
        localStorage.removeItem('pixel_is_impersonating');
        localStorage.removeItem('pixel_impersonated_company');
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

    const [chatHeads, setChatHeads] = useState<ActiveChatHead[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('pixel_chat_heads');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed)) {
                        const unique: ActiveChatHead[] = [];
                        const seen = new Set<string>();
                        parsed.forEach(item => {
                            if (item && item.conversationId && !seen.has(item.conversationId)) {
                                seen.add(item.conversationId);
                                unique.push(item);
                            }
                        });
                        return unique;
                    }
                } catch (e) {
                    console.error('[App] Erro ao analisar chatHeads do localStorage:', e);
                }
            }
        }
        return [];
    });
    const [expandedChatHeadIds, setExpandedChatHeadIds] = useState<string[]>([]);
 
    const handleMinimizeConversation = useCallback((conversationId: string, participantName: string, participantAvatarUrl: string, participantId?: string) => {
        setChatHeads(prev => {
            const cleanPrev = prev.filter(ch => ch.conversationId !== conversationId);
            if (prev.some(ch => ch.conversationId === conversationId)) {
                setExpandedChatHeadIds(ids => {
                    if (ids.includes(conversationId)) return ids;
                    return [...ids, conversationId];
                });
                return prev;
            }
 
            if (prev.length >= 4) {
                const oldest = prev[0];
                const confirmClose = window.confirm(`Você já possui o limite máximo de 4 conversas simultâneas. Deseja fechar a conversa com "${oldest.participantName}" para abrir esta nova?`);
                if (!confirmClose) {
                    return prev;
                }
                const updated = [...prev.slice(1), { conversationId, participantName, participantAvatarUrl, participantId }];
                localStorage.setItem('pixel_chat_heads', JSON.stringify(updated));
                setExpandedChatHeadIds(ids => {
                    const filtered = ids.filter(id => id !== oldest.conversationId && id !== conversationId);
                    return [...filtered, conversationId];
                });
                return updated;
            }
 
            const updated = [...prev, { conversationId, participantName, participantAvatarUrl, participantId }];
            localStorage.setItem('pixel_chat_heads', JSON.stringify(updated));
            setExpandedChatHeadIds(ids => {
                if (ids.includes(conversationId)) return ids;
                return [...ids, conversationId];
            });
            return updated;
        });
        handleNavigate('home');
    }, [handleNavigate]);

    const handleOpenFloatingChat = useCallback((conversationId: string, participantName: string, participantAvatarUrl: string, participantId?: string) => {
        setChatHeads(prev => {
            if (prev.some(ch => ch.conversationId === conversationId)) {
                setExpandedChatHeadIds(ids => {
                    if (ids.includes(conversationId)) return ids;
                    return [...ids, conversationId];
                });
                return prev;
            }

            if (prev.length >= 4) {
                const oldest = prev[0];
                const confirmClose = window.confirm(`Você já possui o limite máximo de 4 conversas simultâneas. Deseja fechar a conversa com "${oldest.participantName}" para abrir esta nova?`);
                if (!confirmClose) {
                    return prev;
                }
                const updated = [...prev.slice(1), { conversationId, participantName, participantAvatarUrl, participantId }];
                localStorage.setItem('pixel_chat_heads', JSON.stringify(updated));
                setExpandedChatHeadIds(ids => {
                    const filtered = ids.filter(id => id !== oldest.conversationId && id !== conversationId);
                    return [...filtered, conversationId];
                });
                return updated;
            }

            const updated = [...prev, { conversationId, participantName, participantAvatarUrl, participantId }];
            localStorage.setItem('pixel_chat_heads', JSON.stringify(updated));
            setExpandedChatHeadIds(ids => {
                if (ids.includes(conversationId)) return ids;
                return [...ids, conversationId];
            });
            return updated;
        });
    }, []);
 
    const handleCloseChatHead = useCallback((conversationId: string) => {
        setChatHeads(prev => {
            const updated = prev.filter(ch => ch.conversationId !== conversationId);
            localStorage.setItem('pixel_chat_heads', JSON.stringify(updated));
            return updated;
        });
        setExpandedChatHeadIds(prev => prev.filter(id => id !== conversationId));
    }, []);

    const handleStartDirectChat = useCallback(async (targetUserId: string) => {
        if (!currentUser?.id) return;
        try {
            // 1. Buscar detalhes do targetUser
            const { data: targetUser, error: userError } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', targetUserId)
                .single();

            if (userError || !targetUser) return;

            const targetName = targetUser.full_name || 'Colega';
            const targetAvatarUrl = targetUser.avatar_url || '';

            // 2. Verificar se já existe uma conversa 1:1 entre esses usuários
            const { data: participations, error: partError } = await supabase
                .from('conversation_participants')
                .select('conversation_id')
                .eq('user_id', currentUser.id);

            if (partError) throw partError;

            const myConvIds = participations.map(p => p.conversation_id);

            if (myConvIds.length > 0) {
                const { data: commonPart, error: commonError } = await supabase
                    .from('conversation_participants')
                    .select('conversation_id, user_id')
                    .in('conversation_id', myConvIds)
                    .eq('user_id', targetUserId);

                if (commonPart && commonPart.length > 0) {
                    // Verificar se alguma dessas conversas em comum NÃO é grupo (é 1:1)
                    const sharedConvIds = commonPart.map(c => c.conversation_id);

                    const { data: convs, error: checkConvError } = await supabase
                        .from('conversations')
                        .select('id, is_closed')
                        .in('id', sharedConvIds)
                        .eq('is_group', false)
                        .limit(1)
                        .maybeSingle();

                    if (checkConvError) {
                        console.error("Erro verificando conversas em comum:", checkConvError);
                    }

                    if (convs) {
                        // Se estiver fechado, reabre
                        if (convs.is_closed) {
                            await supabase
                                .from('conversations')
                                .update({ is_closed: false })
                                .eq('id', convs.id);
                        }

                        // Abre a conversa diretamente no popup flutuante
                        handleOpenFloatingChat(convs.id, targetName, targetAvatarUrl, targetUserId);
                        return;
                    }
                }
            }

            // 3. Se não existe, criar nova conversa
            const { data: newConv, error: createError } = await supabase
                .from('conversations')
                .insert({
                    company_id: currentUser.company_id,
                    is_group: false,
                    last_message: 'Conversa iniciada',
                    last_message_at: new Date().toISOString(),
                    created_by: currentUser.id
                })
                .select()
                .single();

            if (createError) throw createError;

            // 4. Adicionar participantes
            const { error: partInsertError } = await supabase.from('conversation_participants').insert([
                { conversation_id: newConv.id, user_id: currentUser.id, company_id: currentUser.company_id },
                { conversation_id: newConv.id, user_id: targetUserId, company_id: currentUser.company_id }
            ]);

            if (partInsertError) throw partInsertError;

            // Abre a conversa diretamente no popup flutuante
            handleOpenFloatingChat(newConv.id, targetName, targetAvatarUrl, targetUserId);

        } catch (error: any) {
            console.error('Erro ao iniciar conversa direta:', error);
        }
    }, [currentUser, handleOpenFloatingChat]);

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

    const [isReadOnly, setIsReadOnly] = useState(false);


    const canAccess = (permission: keyof EmployeePermissions) => {
        if (!currentUser) return false;
        if (currentUser.role === 'Super Admin') return true;

        if (permission === 'viewWhatsPanda') {
            const hasWhatsPanda = !!currentUser.is_whatsapp_agent || 
                (!!currentUser.whatspanda_permissions && Object.keys(currentUser.whatspanda_permissions).length > 0) ||
                (currentUser.permissions && (currentUser.permissions as any).viewWhatsPanda === true);
            if (!hasWhatsPanda) return false;
        } else if (currentUser.permissions?.[permission] === false) {
            return false;
        }

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
            'viewForms': 'forms',
            'viewDocuments': 'documentos',
            'viewInfoSec': 'infosec',
            'viewKPIDashboard': 'kpis',
            'viewProjects': 'projects',
            'viewScheduling': 'scheduling',
            'viewAgenda': 'new_agenda',
            'viewReservations': 'reservations'
        };

        const featureId = featureMap[permission];
        if (featureId) {
            const feat = mergedFeatures[featureId] as any;
            if (feat === false || feat === 'disabled') {
                return false;
            }
        }

        return true;
    };

    const renderPage = () => {
        if (!currentUser || !companyData) return null;

        switch (currentPage) {
            case 'home': return <HomePage onNavigate={handleNavigate} employees={companyData.employees} currentUser={currentUser} />;
            case 'feed': return <FeedPage currentUser={currentUser} allEmployees={companyData.employees} posts={companyData.feedPosts} setPosts={handleUpdateFeedPosts} onNavigate={handleNavigate} />;
            case 'messages': return <Messages initialConversationId={pageContext?.conversationId} onMinimizeConversation={handleMinimizeConversation} />;
            case 'support-inbox': return <SupportInbox onNavigate={handleNavigate} />;

            case 'tickets': return <TicketPage />;
            case 'calendar': return <CalendarPage events={companyData.events as unknown as CalendarEvent[]} currentUser={currentUser} onNavigate={handleNavigate} initialContext={pageContext} />;
            case 'directory': return <DirectoryPage onNavigate={handleNavigate} employees={companyData.employees} onImpersonateUser={handleImpersonateUserStart} initialSearch={globalSearchTerm} />;
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
                return <ProfilePage userId={targetUserId} currentUser={currentUser} onUpdateUser={handleUpdateUser} feedPosts={companyData.feedPosts} setFeedPosts={handleUpdateFeedPosts} allEmployees={companyData.employees} isAIEnabled={mergedFeatures.ai_assistant !== false} />;
            case 'saas-dashboard': return currentUser.role === 'Super Admin' ? <SaaSDashboard companies={companies} onImpersonate={handleImpersonateStart} /> : <p className="p-8 text-center text-red-600">Área restrita.</p>;
            case 'admin': return (currentUser.isAdmin || currentUser.isCompanyAdmin || currentUser.role === 'Super Admin') && (currentCompany && currentCompany.plan) ? <AdminPage company={currentCompany} setCompany={handleSetCompanyForAdmin} plan={currentCompany.plan} customFeatures={mergedFeatures} onNavigate={handleNavigate} /> : <p className="p-8 text-center text-red-600">Acesso negado ou empresa não carregada.</p>;
            case 'training': return canAccess('viewTraining') ? <TrainingPage /> : null;
            case 'surveys': return canAccess('viewSurveys') ? <SurveysPage /> : null;
            case 'policies': return canAccess('viewPolicies') ? <PoliciesPage /> : null;
            case 'knowledge-base': return canAccess('viewKnowledgeBase') ? <KnowledgeBasePage /> : null;
            case 'service-status': return canAccess('viewServiceStatus') ? <StatusPage /> : null;
            case 'infosec': return canAccess('viewInfoSec') ? <InfoSecPage /> : null;
            case 'events': return <EventsPage initialEventId={pageContext?.eventId} />;
            case 'announcement-detail': return <AnnouncementDetailPage announcement={pageContext as Announcement} onBack={() => handleNavigate('home')} />;
            case 'jobs': return <JobsPage />;
            case 'meu-rh': return canAccess('viewMeuRH') ? <EmployeePortal /> : null;
            case 'org-chart': return <OrgChartPage employees={companyData.employees} />;
            case 'kpi-dashboard': return <KPIDashboard />;
            case 'manual-usuario': return <ManualPage />;
            case 'projects': return canAccess('viewProjects') ? <ProjectsPage defaultTab="kanban" customFeatures={mergedFeatures} onNavigate={handleNavigate} /> : null;
            case 'projects-planning': return canAccess('viewProjects') ? <ProjectsPage defaultTab="planning" customFeatures={mergedFeatures} onNavigate={handleNavigate} /> : null;
            case 'projects-list': return canAccess('viewProjects') ? <ProjectsPage defaultTab="list" customFeatures={mergedFeatures} onNavigate={handleNavigate} /> : null;
            case 'projects-calendar': return canAccess('viewProjects') ? <ProjectsPage defaultTab="calendar" customFeatures={mergedFeatures} onNavigate={handleNavigate} /> : null;
            case 'projects-metrics': return canAccess('viewProjects') ? <ProjectsPage defaultTab="timesheet" customFeatures={mergedFeatures} onNavigate={handleNavigate} /> : null;
            case 'whatspanda': return null;

            case 'email': return <EmailPage currentUser={currentUser} pageContext={pageContext} />;
            case 'scheduling': {
                if (!canAccess('viewScheduling')) return null;
                const schedulingFeat = mergedFeatures.scheduling as any;
                if (schedulingFeat === false || schedulingFeat === 'disabled') {
                    return <div className="p-8 text-center text-red-600 font-extrabold">Acesso negado: O módulo de agendamentos está desativado para a sua empresa.</div>;
                }
                return <SchedulingPage customFeatures={mergedFeatures} mode="appointments" />;
            }
            case 'scheduling-events': {
                if (!canAccess('viewScheduling')) return null;
                const schedulingFeat = mergedFeatures.scheduling as any;
                if (schedulingFeat === false || schedulingFeat === 'disabled') {
                    return <div className="p-8 text-center text-red-600 font-extrabold">Acesso negado: O módulo de agendamentos está desativado para a sua empresa.</div>;
                }
                return <SchedulingPage customFeatures={mergedFeatures} mode="events" />;
            }
            case 'agenda': {
                if (!canAccess('viewAgenda')) return null;
                const agendaFeat = mergedFeatures.new_agenda as any;
                if (agendaFeat === false || agendaFeat === 'disabled') {
                    return <div className="p-8 text-center text-red-600 font-extrabold">Acesso negado: O módulo de agenda está desativado para a sua empresa.</div>;
                }
                return <AgendaPage initialTab={pageContext?.tab} initialDate={pageContext?.date} />;
            }
            case 'reservas': {
                if (!canAccess('viewReservations')) return null;
                const reservationsFeat = mergedFeatures.reservations as any;
                if (reservationsFeat === false || reservationsFeat === 'disabled') {
                    return <div className="p-8 text-center text-red-600 font-extrabold">Acesso negado: O módulo de reservas está desativado para a sua empresa.</div>;
                }
                return <ReservationsPage initialTab={pageContext?.tab} />;
            }
            case 'scheduling-book': return <SchedulingBookPage eventTypeId={pageContext?.eventTypeId} isPublic={false} />;
            case 'personal-notes': return <PersonalNotesPage currentUser={currentUser} isGhostMode={isGhostMode} />;
            case 'personal-tasks': return <PersonalTasksPage currentUser={currentUser} isGhostMode={isGhostMode} pageContext={pageContext} />;
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

    if (currentPage === 'scheduling-book' && (!session || !currentUser)) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 flex items-center justify-center">
                <SchedulingBookPage eventTypeId={pageContext?.eventTypeId} isPublic={true} />
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
                pageContext={pageContext}
                onLogout={handleLogout}
                onEndImpersonation={handleImpersonateEnd}
                notifications={notifications}
                onMarkAsRead={markAsRead}
                onClearAllNotifications={markAllAsRead}
                theme={theme}
                toggleTheme={toggleTheme}
                isShaking={isShaking}
                onSearch={handleSearch}
                onStartDirectChat={handleStartDirectChat}
            >
                <div className="h-full w-full" style={{ display: currentPage === 'whatspanda' ? 'block' : 'none' }}>
                    {canAccess('viewWhatsPanda') && <WhatsPanda initialSearch={globalSearchTerm} />}
                </div>
                {renderPage()}
                <AIAssistant currentUser={currentUser} isAIEnabled={mergedFeatures.ai_assistant !== false} />
                <AICorrector currentUser={currentUser} isAIEnabled={mergedFeatures.ai_assistant !== false} />
                <FloatingChatHeads
                    chatHeads={chatHeads}
                    expandedChatHeadIds={expandedChatHeadIds}
                    setChatHeads={setChatHeads}
                    setExpandedChatHeadIds={setExpandedChatHeadIds}
                    onCloseChatHead={handleCloseChatHead}
                    currentUser={currentUser}
                />

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
