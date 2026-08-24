
import React, { useState, useEffect, useCallback } from 'react';
import { mockCompanies } from './mockData';
import type { Company, Employee, Page, AppData, Announcement, EmployeePermissions, Notification, Post, Ticket, Conversation, CalendarEvent, Recognition } from './types';

import Layout from './components/Layout';
import { LanguageProvider } from './components/LanguageContext';
import { AuthProvider, useAuth } from './components/AuthContext';
import LoginPage from './components/LoginPage';
import { supabase } from './supabaseClient';
import { ToastProvider } from './components/ToastContext';

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
import { fetchAnnouncements } from './services/geminiService';


const AppContent: React.FC = () => {
    const { session, profile, loading } = useAuth();

    // Authentication & Tenant State
    const [companies, setCompanies] = useState<Company[]>([]);
    const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
    // Initialize currentUser as null, waiting for AuthContext
    const [currentUser, setCurrentUser] = useState<Employee | null>(null);
    const [authStage, setAuthStage] = useState<'logged_in' | 'superadmin_panel'>('logged_in');

    const [theme, setTheme] = useState<'light'>('light');

    useEffect(() => {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    }, []);

    const toggleTheme = () => {
        setTheme('light');
    };

    const [isImpersonating, setIsImpersonating] = useState(false);
    const [impersonatedCompany, setImpersonatedCompany] = useState<Company | null>(null);

    const [currentPage, setCurrentPage] = useState<Page>('home');
    const [pageContext, setPageContext] = useState<any>(null);

    const [companyData, setCompanyData] = useState<AppData | null>(null);
    const [companySettings, setCompanySettings] = useState<any>(null);

    const [notifications, setNotifications] = useState<Notification[]>([]);

    const handleMarkAsRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    };

    const handleClearAllNotifications = () => {
        setNotifications([]);
    };

    useEffect(() => {
        const loadInitialData = async () => {
            if (profile) {
                setCurrentUser(profile);

                if (profile.company_id) {
                    const { data: company, error } = await supabase
                        .from('companies')
                        .select('*, plan:plans(*)')
                        .eq('id', profile.company_id)
                        .single();

                    if (!error && company) {
                        const mappedCompany = company as unknown as Company;
                        setCurrentCompany(mappedCompany);
                        setCompanyData(mappedCompany.data || {
                            employees: [], announcements: [], banners: [], conversations: [], tickets: [], marketplaceItems: [],
                            formSubmissions: [], tiRequests: [], documents: [], benefits: [], polls: [], feedPosts: [],
                            events: [], trainings: [], kbArticles: [], services: [], securityAlerts: [], recognitions: [], wellnessItems: []
                        });
                        setCompanySettings(mappedCompany.settings || { companyName: mappedCompany.name });
                    }
                }
            } else {
                setCurrentUser(null);
                setCurrentCompany(null);
                setCompanyData(null);
                setCompanySettings(null);
            }
        };
        loadInitialData();
    }, [profile]);

    // Cleanup or additional side effects when session changes can be handled here if needed.

    const handleLogout = async () => {
        await supabase.auth.signOut();
        // State updates handled by AuthProvider and useEffect above
    };

    const handleImpersonateStart = (company: Company) => {
        const freshCompany = companies.find(c => c.domain === company.domain);
        if (!freshCompany) return;

        const superAdminUser: Employee = {
            id: '0',
            name: 'Super Admin',
            email: 'super@admin.com',
            role: 'Administrador da Plataforma',
            team: 'Admin',
            avatarUrl: 'https://i.pravatar.cc/150?u=superadmin',
            joinDate: new Date().toISOString(),
            birthDate: new Date().toISOString(),
            isAdmin: true,
            permissions: { ...freshCompany.plan.features },
            following: []
        };

        setImpersonatedCompany(freshCompany);
        setCurrentCompany(freshCompany);
        setCompanyData(freshCompany.data);
        setCompanySettings(freshCompany.settings);
        setCurrentUser(superAdminUser);
        setIsImpersonating(true);
        setAuthStage('logged_in');
    };

    const handleImpersonateEnd = () => {
        setIsImpersonating(false);
        setImpersonatedCompany(null);
        // Revert to real user
        if (profile) {
            setCurrentUser(profile);
            setCurrentCompany(mockCompanies[0]);
            setCompanyData(mockCompanies[0].data);
            setCompanySettings(mockCompanies[0].settings);
        }
        setAuthStage('logged_in');
    };

    const handleNavigate = useCallback((page: Page, context?: any) => {
        setCurrentPage(page);
        setPageContext(context ?? null);
    }, []);

    const handleUpdateUser = (updatedUser: Employee) => {
        setCurrentUser(updatedUser);
        if (companyData) {
            setCompanyData({
                ...companyData,
                employees: companyData.employees.map(e => e.id === updatedUser.id ? updatedUser : e)
            });
        }
    };

    const handleSetCompanyForAdmin = (updatedCompany: Company) => {
        setCurrentCompany(updatedCompany);
        setCompanyData(updatedCompany.data);
        setCompanySettings(updatedCompany.settings);
        setCompanies(companies.map(c => c.domain === updatedCompany.domain ? updatedCompany : c));
    };

    const handleUpdateFeedPosts = (newPosts: Post[]) => {
        if (companyData && newPosts.length > companyData.feedPosts.length) {
            const latestPost = newPosts[0];
            if (currentUser && latestPost.mentions.includes(currentUser.id) && latestPost.authorId !== currentUser.id) {
                const newNotification: Notification = {
                    id: Date.now().toString(),
                    type: 'mention',
                    title: 'Você foi mencionado',
                    description: `${latestPost.authorName} mencionou você em uma publicação.`,
                    timestamp: 'Agora',
                    isRead: false,
                    linkTo: 'feed',
                    avatarUrl: latestPost.authorAvatar
                };
                setNotifications(prev => [newNotification, ...prev]);
            }
        }
        if (companyData) setCompanyData({ ...companyData, feedPosts: newPosts });
    };

    const handleUpdateTickets = (newTickets: Ticket[]) => {
        if (companyData) {
            setCompanyData({ ...companyData, tickets: newTickets });
        }
    };

    const handleUpdateConversations = (newConversations: Conversation[]) => {
        const oldUnreadCount = companyData?.conversations.reduce((acc, c) => acc + c.unreadCount, 0) || 0;
        const newUnreadCount = newConversations.reduce((acc, c) => acc + c.unreadCount, 0);

        if (newUnreadCount > oldUnreadCount) {
            const changedConv = newConversations.find(c => {
                const oldConv = companyData?.conversations.find(oc => oc.id === c.id);
                return c.unreadCount > (oldConv?.unreadCount || 0);
            });

            if (changedConv) {
                const newNotification: Notification = {
                    id: Date.now().toString(),
                    type: 'message',
                    title: 'Nova Mensagem',
                    description: `Você recebeu uma mensagem de ${changedConv.participantName}`,
                    timestamp: 'Agora',
                    isRead: false,
                    linkTo: 'messages',
                    avatarUrl: changedConv.participantAvatarUrl
                };
                setNotifications(prev => [newNotification, ...prev]);
            }
        }

        if (companyData) setCompanyData({ ...companyData, conversations: newConversations });
    };

    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

    const handleAddEvent = (newEvent: CalendarEvent) => {
        setCalendarEvents(prev => [...prev, newEvent]);
        if (currentUser && newEvent.attendees.some(a => a.id === currentUser.id)) {
            const newNotification: Notification = {
                id: Date.now().toString(),
                type: 'event',
                title: 'Convite de Evento',
                description: `Você foi adicionado ao evento: ${newEvent.title}`,
                timestamp: 'Agora',
                isRead: false,
                linkTo: 'calendar',
                actionLabel: 'Ver Calendário'
            };
            setNotifications(prev => [newNotification, ...prev]);
        }
    };

    const handleJoinEvent = (eventId: number) => {
        if (!companyData || !currentUser) return;

        const updatedEvents = companyData.events.map(event => {
            if (event.id === eventId) {
                const isAttending = event.attendees.includes(currentUser.id);
                const newAttendees = isAttending
                    ? event.attendees.filter(id => id !== currentUser.id)
                    : [...event.attendees, currentUser.id];
                const newDeclined = (event.declined || []).filter(d => d.userId !== currentUser.id);
                return { ...event, attendees: newAttendees, declined: newDeclined };
            }
            return event;
        });

        setCompanyData({ ...companyData, events: updatedEvents });
    };

    const handleDeclineEvent = (eventId: number, reason: string) => {
        if (!companyData || !currentUser) return;

        const updatedEvents = companyData.events.map(event => {
            if (event.id === eventId) {
                const newAttendees = event.attendees.filter(id => id !== currentUser.id);
                const currentDeclined = event.declined || [];
                const newDeclined = [...currentDeclined.filter(d => d.userId !== currentUser.id), { userId: currentUser.id, reason }];
                return { ...event, attendees: newAttendees, declined: newDeclined };
            }
            return event;
        });

        setCompanyData({ ...companyData, events: updatedEvents });
    };

    const handleAddRecognition = (rec: Recognition) => {
        if (!companyData) return;
        const updatedRecognitions = [rec, ...(companyData.recognitions || [])];
        setCompanyData({ ...companyData, recognitions: updatedRecognitions });

        // Notify the receiver if possible (simple local notification check)
        const receiver = companyData.employees.find(e => e.name === rec.to);
        if (receiver && currentUser) {
            const newNotification: Notification = {
                id: Date.now().toString(),
                type: 'message', // reusing message icon for simplicity or add 'recognition' type
                title: 'Você recebeu um reconhecimento!',
                description: `${currentUser.name} te reconheceu por: ${rec.value}`,
                timestamp: 'Agora',
                isRead: false,
                linkTo: 'recognition',
                avatarUrl: currentUser.avatarUrl
            };
            // Note: This only sets notification for CURRENT user in this state-based mock. 
            // In real Supabase, we'd insert into notifications table.
            // For now, if I'm recognizing myself (test) it shows up. 
            // If I recognize others, they won't see it unless we persist to DB.
        }
    };

    useEffect(() => {
        if (companyData && currentUser) {
            const pendingInvites = companyData.events.filter(event =>
                (event.invitees || []).includes(currentUser.id) &&
                !event.attendees.includes(currentUser.id) &&
                !(event.declined || []).some(d => d.userId === currentUser.id)
            );

            if (pendingInvites.length > 0) {
                const inviteNotification: Notification = {
                    id: 'event-invites',
                    type: 'event',
                    title: 'Convocações Pendentes',
                    description: `Você tem ${pendingInvites.length} evento(s) com presença obrigatória pendente.`,
                    timestamp: 'Agora',
                    isRead: false,
                    linkTo: 'events',
                    actionLabel: 'Ver Eventos'
                };

                setNotifications(prev => {
                    if (prev.length > 0 && prev[0].id === 'event-invites' && prev[0].description === inviteNotification.description) return prev;
                    return [inviteNotification, ...prev.filter(n => n.id !== 'event-invites')];
                });
            } else {
                setNotifications(prev => prev.filter(n => n.id !== 'event-invites'));
            }
        }
    }, [companyData?.events, currentUser?.id]);

    const renderPage = () => {
        if (!currentUser || !companyData) return null;

        const canAccess = (permission: keyof EmployeePermissions) => {
            return !!currentUser?.permissions[permission];
        };

        switch (currentPage) {
            case 'home': return <HomePage onNavigate={handleNavigate} companyData={companyData} />;
            case 'feed': return <FeedPage currentUser={currentUser} allEmployees={companyData.employees} events={companyData.events} recognitions={companyData.recognitions} onAddRecognition={handleAddRecognition} />;
            case 'messages': return canAccess('viewMessages') ? <Messages /> : null;
            case 'tickets': return canAccess('openTickets') ? <TicketPage /> : null;
            case 'calendar': return canAccess('viewCalendar') ? <CalendarPage /> : null;
            case 'directory': return canAccess('viewDirectory') ? <DirectoryPage employees={companyData.employees} /> : null;
            case 'documentos': return canAccess('viewDocuments') ? <ResourceCenter /> : null;
            case 'recognition': return canAccess('viewRecognition') ? <RecognitionPage /> : null;
            case 'marketplace': return canAccess('useMarketplace') ? <MarketplacePage /> : null;
            case 'forms': return canAccess('viewForms') ? <FormsPage submissions={companyData.formSubmissions} setSubmissions={(s) => setCompanyData({ ...companyData, formSubmissions: s })} currentUser={currentUser} /> : null;
            case 'benefits': return canAccess('viewBenefits') ? <BeneficiosPage /> : null;
            case 'bem-estar': return canAccess('viewWellbeing') ? <BemEstarPage items={companyData.wellnessItems} /> : null;
            case 'onboarding': return canAccess('viewOnboarding') ? <OnboardingPage /> : null;
            case 'ti-dashboard': return canAccess('viewTiDashboard') ? <TIPage onNavigate={handleNavigate} /> : null;
            case 'ti-requests': return canAccess('openTiRequests') ? <TIRequestsPage submissions={companyData.tiRequests} setSubmissions={(s) => setCompanyData({ ...companyData, tiRequests: s })} currentUser={currentUser} /> : null;
            case 'profile': return <ProfilePage currentUser={currentUser} onUpdateUser={handleUpdateUser} feedPosts={companyData.feedPosts} setFeedPosts={(p) => setCompanyData({ ...companyData, feedPosts: p })} allEmployees={companyData.employees} />;
            case 'saas-dashboard': return currentUser.role === 'Super Admin' ? <SaaSDashboard companies={companies} /> : <p className="p-8 text-center text-red-600">Acesso negado. Esta área é restrita.</p>;
            case 'admin': return currentUser.role === 'Super Admin' ? <AdminPage company={currentCompany!} setCompany={handleSetCompanyForAdmin} plan={currentCompany!.plan} /> : <p className="p-8 text-center text-red-600">Acesso negado. Apenas o Master TI tem acesso a esta área.</p>;
            case 'training': return canAccess('viewTraining') ? <TrainingPage /> : null;
            case 'surveys': return canAccess('viewSurveys') ? <SurveysPage /> : null;
            case 'policies': return canAccess('viewPolicies') ? <PoliciesPage /> : null;
            case 'knowledge-base': return canAccess('viewKnowledgeBase') ? <KnowledgeBasePage /> : null;
            case 'service-status': return canAccess('viewServiceStatus') ? <StatusPage /> : null;
            case 'infosec': return canAccess('viewInfoSec') ? <InfoSecPage /> : null;
            case 'events': return <EventsPage />;
            case 'announcement-detail': return <AnnouncementDetailPage announcement={pageContext as Announcement} onBack={() => handleNavigate('home')} />;
            default: return <HomePage onNavigate={handleNavigate} companyData={companyData} />;
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div></div>;
    }

    if (!session) {
        return <LoginPage />;
    }

    if (authStage === 'logged_in' && currentUser && companyData && currentCompany && companySettings) {
        return (
            <Layout
                currentUser={currentUser}
                currentCompany={currentCompany || {} as Company}
                companySettings={companySettings || {}}
                isImpersonating={isImpersonating}
                impersonatedCompanyName={impersonatedCompany?.name}
                onNavigate={handleNavigate}
                currentPage={currentPage}
                onLogout={handleLogout}
                onEndImpersonation={handleImpersonateEnd}
                notifications={notifications}
                onMarkAsRead={handleMarkAsRead}
                onClearAllNotifications={handleClearAllNotifications}
                theme={theme}
                toggleTheme={toggleTheme}
            >
                {renderPage()}
            </Layout>
        );
    }

    if (session && !currentUser && !loading) {
        const handleRepairProfile = async () => {
            if (!session.user.email) return;

            // 1. Find Company
            const domain = session.user.email.split('@')[1];
            // Search by domain OR search by responsible email (for master admins)
            const { data: companies } = await supabase.from('companies')
                .select('id, responsible_email')
                .or(`domain.ilike.${domain},responsible_email.eq.${session.user.email}`);

            if (companies && companies.length > 0) {
                const companyId = companies[0].id;
                const isResp = (companies[0].responsible_email || '').toLowerCase() === session.user.email.toLowerCase();
                const isMaster = session.user.email.toLowerCase() === 'ti@acrilight.com.br';

                // 2. Insert or Update Profile (Upsert)
                const { error } = await supabase.from('profiles').upsert({
                    id: session.user.id,
                    full_name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
                    email: session.user.email,
                    company_id: companyId,
                    role: isMaster ? 'Super Admin' : (isResp ? 'admin' : 'employee'),
                    is_admin: isMaster || isResp,
                    is_company_admin: isMaster || isResp
                }, { onConflict: 'id' });

                if (error) {
                    alert("Erro ao recuperar perfil: " + error.message);
                } else {
                    alert("Perfil recuperado! A página será recarregada.");
                    window.location.reload();
                }
            } else {
                alert("Não encontramos uma empresa para o domínio " + domain + ". Entre em contato com o suporte.");
            }
        };

        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50 space-y-4 p-4 text-center">
                <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Finalizar Cadastro</h2>
                    <p className="text-gray-600 mb-6">
                        Detectamos que sua conta existe, mas está incompleta. Clique abaixo para finalizar a configuração.
                    </p>
                    <button
                        onClick={handleRepairProfile}
                        className="w-full px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors mb-4"
                    >
                        Concluir Configuração
                    </button>
                    <button
                        onClick={handleLogout}
                        className="w-full px-4 py-2 text-gray-600 font-medium hover:text-gray-800 transition-colors"
                    >
                        Voltar ao Login
                    </button>
                </div>
            </div>
        );
    }

    return <div className="flex items-center justify-center h-screen">Carregando Pixel Intranet...</div>;
};

const App: React.FC = () => {
    return (
        <LanguageProvider>
            <ToastProvider>
                <AuthProvider>
                    <AppContent />
                </AuthProvider>
            </ToastProvider>
        </LanguageProvider>
    );
};

export default App;
