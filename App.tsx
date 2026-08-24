
import React, { useState, useEffect, useCallback } from 'react';
import { mockCompanies, superAdmin } from './mockData';
import type { Company, Employee, Page, AppData, Announcement, EmployeePermissions, Notification, Post, Ticket, Conversation, CalendarEvent } from './types';

import Layout from './components/Layout';
import { LanguageProvider } from './components/LanguageContext';
import { AuthProvider, useAuth } from './components/AuthContext';
import LoginPage from './components/LoginPage';
import { supabase } from './supabaseClient';

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
    const { session, loading } = useAuth();

    // Authentication & Tenant State
    const [companies, setCompanies] = useState<Company[]>(mockCompanies);
    const [currentCompany, setCurrentCompany] = useState<Company | null>(mockCompanies[0]);
    // Allow mock user initially for dev/testing if needed, but ideally we sync with session
    const [currentUser, setCurrentUser] = useState<Employee | null>(mockCompanies[0].data.employees[0]);
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

    const [companyData, setCompanyData] = useState<AppData | null>(mockCompanies[0].data);
    const [companySettings, setCompanySettings] = useState(mockCompanies[0].settings);

    const [notifications, setNotifications] = useState<Notification[]>([]);

    const handleMarkAsRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    };

    const handleClearAllNotifications = () => {
        setNotifications([]);
    };

    useEffect(() => {
        if (authStage === 'logged_in' && currentCompany && companyData) {
            const loadAnnouncements = async () => {
                const fetchedAnnouncements = await fetchAnnouncements();
                if (fetchedAnnouncements.length > 0 && fetchedAnnouncements[0].title !== 'Erro de API: Não foi possível buscar notícias') {
                    setCompanyData(prevData => prevData ? { ...prevData, announcements: fetchedAnnouncements } : null);
                }
            };
            loadAnnouncements();
        }
    }, [authStage, currentCompany]);

    useEffect(() => {
        if (companyData && currentUser) {
            const currentTeams = Array.from(new Set(companyData.employees.map(e => e.team).filter(t => t && t !== 'Sem Equipe')));

            setCompanyData(prevData => {
                if (!prevData) return null;

                let updatedConversations = [...prevData.conversations];
                let hasChanges = false;

                currentTeams.forEach((teamName: string) => {
                    const exists = updatedConversations.find(c => c.isGroup && c.groupName === teamName);
                    const isMember = prevData.employees.some(e => e.id === currentUser.id && e.team === teamName);

                    if (!exists && isMember) {
                        const newConversation: Conversation = {
                            id: Date.now() + Math.random(),
                            participantName: teamName,
                            groupName: teamName,
                            isGroup: true,
                            participantAvatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(teamName)}&background=random`,
                            messages: [],
                            lastMessage: 'Grupo criado',
                            lastMessageTimestamp: 'Agora',
                            unreadCount: 0
                        };
                        updatedConversations.push(newConversation);
                        hasChanges = true;
                    }
                });

                return hasChanges ? { ...prevData, conversations: updatedConversations } : prevData;
            });
        }
    }, [companyData?.employees, currentUser?.team]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        // window.location.reload(); // Not needed as state change will trigger re-render
    };

    const handleImpersonateStart = (company: Company) => {
        const freshCompany = companies.find(c => c.domain === company.domain);
        if (!freshCompany) return;

        const superAdminUser: Employee = {
            id: 0,
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
        setCurrentCompany(mockCompanies[0]);
        setCurrentUser(mockCompanies[0].data.employees[0]);
        setCompanyData(mockCompanies[0].data);
        setCompanySettings(mockCompanies[0].settings);
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
            case 'feed': return <FeedPage posts={companyData.feedPosts} setPosts={handleUpdateFeedPosts} currentUser={currentUser} allEmployees={companyData.employees} events={companyData.events} recognitions={companyData.recognitions} />;
            case 'messages': return canAccess('viewMessages') ? <Messages conversations={companyData.conversations} setConversations={handleUpdateConversations} currentUser={currentUser} allEmployees={companyData.employees} /> : null;
            case 'tickets': return canAccess('openTickets') ? <TicketPage tickets={companyData.tickets} setTickets={handleUpdateTickets} currentUser={currentUser} allEmployees={companyData.employees} /> : null;
            case 'calendar': return canAccess('viewCalendar') ? <CalendarPage allEmployees={companyData.employees} userEvents={calendarEvents} onEventCreate={handleAddEvent} /> : null;
            case 'directory': return canAccess('viewDirectory') ? <DirectoryPage employees={companyData.employees} /> : null;
            case 'documentos': return canAccess('viewDocuments') ? <ResourceCenter documents={companyData.documents} setDocuments={(d) => setCompanyData({ ...companyData, documents: d })} currentUser={currentUser} /> : null;
            case 'recognition': return canAccess('viewRecognition') ? <RecognitionPage /> : null;
            case 'marketplace': return canAccess('useMarketplace') ? <MarketplacePage items={companyData.marketplaceItems} setItems={(i) => setCompanyData({ ...companyData, marketplaceItems: i })} currentUser={currentUser} /> : null;
            case 'forms': return canAccess('viewForms') ? <FormsPage submissions={companyData.formSubmissions} setSubmissions={(s) => setCompanyData({ ...companyData, formSubmissions: s })} currentUser={currentUser} /> : null;
            case 'benefits': return canAccess('viewBenefits') ? <BeneficiosPage benefits={companyData.benefits} setBenefits={(b) => setCompanyData({ ...companyData, benefits: b })} currentUser={currentUser} /> : null;
            case 'bem-estar': return canAccess('viewWellbeing') ? <BemEstarPage items={companyData.wellnessItems} /> : null;
            case 'onboarding': return canAccess('viewOnboarding') ? <OnboardingPage /> : null;
            case 'ti-dashboard': return canAccess('viewTiDashboard') ? <TIPage onNavigate={handleNavigate} /> : null;
            case 'ti-requests': return canAccess('openTiRequests') ? <TIRequestsPage submissions={companyData.tiRequests} setSubmissions={(s) => setCompanyData({ ...companyData, tiRequests: s })} currentUser={currentUser} /> : null;
            case 'profile': return <ProfilePage currentUser={currentUser} onUpdateUser={handleUpdateUser} feedPosts={companyData.feedPosts} setFeedPosts={(p) => setCompanyData({ ...companyData, feedPosts: p })} allEmployees={companyData.employees} />;
            case 'admin': return currentUser.isAdmin ? <AdminPage company={currentCompany!} setCompany={handleSetCompanyForAdmin} plan={currentCompany!.plan} /> : <p>Acesso negado.</p>;
            case 'training': return canAccess('viewTraining') ? <TrainingPage trainings={companyData.trainings} /> : null;
            case 'surveys': return canAccess('viewSurveys') ? <SurveysPage polls={companyData.polls} /> : null;
            case 'policies': return canAccess('viewPolicies') ? <PoliciesPage policies={companyData.documents} /> : null;
            case 'knowledge-base': return canAccess('viewKnowledgeBase') ? <KnowledgeBasePage articles={companyData.kbArticles} /> : null;
            case 'service-status': return canAccess('viewServiceStatus') ? <StatusPage services={companyData.services} /> : null;
            case 'infosec': return canAccess('viewInfoSec') ? <InfoSecPage alerts={companyData.securityAlerts} /> : null;
            case 'events': return <EventsPage events={companyData.events} onJoinEvent={handleJoinEvent} onDeclineEvent={handleDeclineEvent} currentUser={currentUser} />;
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
                currentCompany={mockCompanies[0]}
                companySettings={companyData.settings || mockCompanies[0].settings}
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

    return <div className="flex items-center justify-center h-screen">Carregando Pixel Intranet...</div>;
};

const App: React.FC = () => {
    return (
        <LanguageProvider>
            <AuthProvider>
                <AppContent />
            </AuthProvider>
        </LanguageProvider>
    );
};

export default App;
