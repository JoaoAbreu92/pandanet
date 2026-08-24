
import React, { useState, useEffect, useCallback } from 'react';
import { mockCompanies, superAdmin } from './mockData';
import type { Company, Employee, Page, AppData, Announcement, EmployeePermissions, Notification, Post, Ticket, Conversation, CalendarEvent } from './types';

import Layout from './components/Layout';
import { LanguageProvider } from './components/LanguageContext';

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
import { fetchAnnouncements } from './services/geminiService';

const App: React.FC = () => {
    // Authentication & Tenant State - Now initialized with a default company and user
    const [companies, setCompanies] = useState<Company[]>(mockCompanies);
    const [currentCompany, setCurrentCompany] = useState<Company | null>(mockCompanies[0]);
    const [currentUser, setCurrentUser] = useState<Employee | null>(mockCompanies[0].data.employees[0]);
    const [authStage, setAuthStage] = useState<'logged_in' | 'superadmin_panel'>('logged_in');

    // Theme State - Forced to Light as per user request
    const [theme, setTheme] = useState<'light'>('light');

    useEffect(() => {
        // Enforce light mode cleanup
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    }, []);

    const toggleTheme = () => {
        // Disabled toggling to strictly enforce light mode if requested, 
        // or just keep it minimal. The user asked to remove the button, so this function is effectively unused/dead code 
        // but kept to satisfy LayoutProps interface if needed, although we should probably pass a dummy.
        setTheme('light');
    };

    // Super Admin Impersonation State
    const [isImpersonating, setIsImpersonating] = useState(false);
    const [impersonatedCompany, setImpersonatedCompany] = useState<Company | null>(null);

    // Navigation State
    const [currentPage, setCurrentPage] = useState<Page>('home');
    const [pageContext, setPageContext] = useState<any>(null);

    // Data state initialized with the first company
    const [companyData, setCompanyData] = useState<AppData | null>(mockCompanies[0].data);
    const [companySettings, setCompanySettings] = useState(mockCompanies[0].settings);

    // Notification State
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

    const handleLogout = () => {
        // Since auth is removed, we just reset to the default state or refresh
        window.location.reload();
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
        // Returns to the first company as default instead of super admin panel
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
        // Simple logic: If new post count > old count, check the latest post for mentions
        if (companyData && newPosts.length > companyData.feedPosts.length) {
            const latestPost = newPosts[0]; // Assuming new posts are prepended
            // Check if current user is mentioned
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
            // Check for status changes or new assignments would be complex without diffing. 
            // For this demo, we can assume if a ticket has 'hasNotification' flag or just simulate on change.
            // Let's simplified: If we are acting as "Agent", updates might trigger.
            // For now, standard setCompanyData.
            setCompanyData({ ...companyData, tickets: newTickets });
        }
    };

    const handleUpdateConversations = (newConversations: Conversation[]) => {
        // Check for new unread messages
        const oldUnreadCount = companyData?.conversations.reduce((acc, c) => acc + c.unreadCount, 0) || 0;
        const newUnreadCount = newConversations.reduce((acc, c) => acc + c.unreadCount, 0);

        if (newUnreadCount > oldUnreadCount) {
            // Find the conversation with new unread
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

    // Calendar State
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

    const handleAddEvent = (newEvent: CalendarEvent) => {
        setCalendarEvents(prev => [...prev, newEvent]);

        // Check if current user is invited (and not the creator? Creator is implied as local user for now)
        // In local mock, we are always 'me'.
        // If I create an event and add myself, should I get a notification? Maybe.
        // Or if 'someone else' created it.
        // Since we only have single player mode, we can simulate an "Invite" by assuming
        // if we add *other* people, they get notified (we can't see that).
        // To demonstrate notification to THIS user, we'd need another mechanism or just trigger it for demo.
        // Let's trigger it if the user adds THEMSELVES to the list, or just for any created event for feedback.

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

    const renderPage = () => {
        if (!currentUser || !companyData) return null;

        const canAccess = (permission: keyof EmployeePermissions) => {
            return !!currentUser?.permissions[permission];
        };

        switch (currentPage) {
            case 'home': return <HomePage onNavigate={handleNavigate} companyData={companyData} />;
            case 'feed': return <FeedPage posts={companyData.feedPosts} setPosts={handleUpdateFeedPosts} currentUser={currentUser} allEmployees={companyData.employees} />;
            case 'messages': return canAccess('viewMessages') ? <Messages conversations={companyData.conversations} setConversations={handleUpdateConversations} currentUser={currentUser} allEmployees={companyData.employees} /> : null;
            case 'tickets': return canAccess('openTickets') ? <TicketPage tickets={companyData.tickets} setTickets={handleUpdateTickets} currentUser={currentUser} allEmployees={companyData.employees} /> : null;
            case 'calendar': return canAccess('viewCalendar') ? <CalendarPage allEmployees={companyData.employees} userEvents={calendarEvents} onEventCreate={handleAddEvent} /> : null;
            case 'directory': return canAccess('viewDirectory') ? <DirectoryPage employees={companyData.employees} /> : null;
            case 'documentos': return canAccess('viewDocuments') ? <ResourceCenter documents={companyData.documents} setDocuments={(d) => setCompanyData({ ...companyData, documents: d })} currentUser={currentUser} /> : null;
            case 'recognition': return canAccess('viewRecognition') ? <RecognitionPage /> : null;
            case 'marketplace': return canAccess('useMarketplace') ? <MarketplacePage items={companyData.marketplaceItems} setItems={(i) => setCompanyData({ ...companyData, marketplaceItems: i })} currentUser={currentUser} /> : null;
            case 'forms': return canAccess('viewForms') ? <FormsPage submissions={companyData.formSubmissions} setSubmissions={(s) => setCompanyData({ ...companyData, formSubmissions: s })} currentUser={currentUser} /> : null;
            case 'benefits': return canAccess('viewBenefits') ? <BeneficiosPage benefits={companyData.benefits} setBenefits={(b) => setCompanyData({ ...companyData, benefits: b })} currentUser={currentUser} /> : null;
            case 'bem-estar': return canAccess('viewWellbeing') ? <BemEstarPage /> : null;
            case 'onboarding': return canAccess('viewOnboarding') ? <OnboardingPage /> : null;
            case 'ti-dashboard': return canAccess('viewTiDashboard') ? <TIPage onNavigate={handleNavigate} /> : null;
            case 'ti-requests': return canAccess('openTiRequests') ? <TIRequestsPage submissions={companyData.tiRequests} setSubmissions={(s) => setCompanyData({ ...companyData, tiRequests: s })} currentUser={currentUser} /> : null;
            case 'profile': return <ProfilePage currentUser={currentUser} onUpdateUser={handleUpdateUser} feedPosts={companyData.feedPosts} setFeedPosts={(p) => setCompanyData({ ...companyData, feedPosts: p })} allEmployees={companyData.employees} />;
            case 'admin': return currentUser.isAdmin ? <AdminPage company={currentCompany!} setCompany={handleSetCompanyForAdmin} plan={currentCompany!.plan} /> : <p>Acesso negado.</p>;
            case 'announcement-detail': return <AnnouncementDetailPage announcement={pageContext as Announcement} onBack={() => handleNavigate('home')} />;
            default: return <HomePage onNavigate={handleNavigate} companyData={companyData} />;
        }
    };

    if (authStage === 'logged_in' && currentUser && companyData && currentCompany && companySettings) {
        return (
            <LanguageProvider>
                <Layout
                    currentUser={currentUser}
                    currentCompany={mockCompanies[0]} // Always use first company data for now as wrapper
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
            </LanguageProvider>
        );
    }

    return <div className="flex items-center justify-center h-screen">Carregando Pixel Intranet...</div>;
};

export default App;
