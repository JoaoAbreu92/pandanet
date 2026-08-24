
import React, { useState, useEffect, useCallback } from 'react';
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

const AppContent: React.FC = () => {
    const { session, profile, loading } = useAuth();

    // Authentication & Tenant State
    const [companies, setCompanies] = useState<Company[]>([]);
    const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
    const [currentUser, setCurrentUser] = useState<Employee | null>(null);
    const [authStage, setAuthStage] = useState<'logged_in' | 'superadmin_panel'>('logged_in');

    // Loading & Error States
    const [companyLoading, setCompanyLoading] = useState(false);
    const [initError, setInitError] = useState<string | null>(null);

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

    // Robust Initialization Logic
    useEffect(() => {
        const loadInitialData = async () => {
            if (profile) {
                const userEmail = profile.email.toLowerCase();
                setCurrentUser(profile);
                setCompanyLoading(true);
                setInitError(null);

                try {
                    console.log("Iniciando carregamento para:", userEmail);
                    let targetCompanyId = profile.company_id;

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
                            const mergedData: AppData = {
                                employees: baseData.employees || [],
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
                setCurrentUser(null);
                setCurrentCompany(null);
                setCompanyData(null);
                setCompanySettings(null);
                setCompanyLoading(false);
            }
        };
        loadInitialData();
    }, [profile]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.reload();
    };

    const handleImpersonateStart = (company: Company) => {
        // Simple impersonation for super admins
        setImpersonatedCompany(company);
        setCurrentCompany(company);
        setCompanyData(company.data || { employees: [] } as any);
        setCompanySettings(company.settings || { companyName: company.name });
        setIsImpersonating(true);
        setAuthStage('logged_in');
    };

    const handleImpersonateEnd = () => {
        setIsImpersonating(false);
        setImpersonatedCompany(null);
        // Force refresh to reload real user data
        window.location.reload();
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

    const handleSetCompanyForAdmin = async (updatedCompany: Company) => {
        setCurrentCompany(updatedCompany);
        setCompanyData(updatedCompany.data);
        setCompanySettings(updatedCompany.settings);
        setCompanies(prev => prev.map(c => c.domain === updatedCompany.domain ? updatedCompany : c));

        // Persist to Supabase
        if (updatedCompany.id && updatedCompany.id !== 'root') {
            try {
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
                console.log("Alterações da empresa salvas no Supabase.");
            } catch (err: any) {
                console.error("Erro ao persistir dados da empresa:", err.message);
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

    const handleJoinEvent = (eventId: number) => {
        if (!companyData || !currentUser) return;
        const updatedEvents = companyData.events.map(event => {
            if (event.id === eventId) {
                const isAttending = event.attendees.includes(currentUser.id);
                const newAttendees = isAttending
                    ? event.attendees.filter(id => id !== currentUser.id)
                    : [...event.attendees, currentUser.id];
                return { ...event, attendees: newAttendees };
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
                const newDeclined = [...(event.declined || []).filter(d => d.userId !== currentUser.id), { userId: currentUser.id, reason }];
                return { ...event, attendees: newAttendees, declined: newDeclined };
            }
            return event;
        });
        setCompanyData({ ...companyData, events: updatedEvents });
    };

    const handleAddRecognition = (rec: Recognition) => {
        if (!companyData) return;
        setCompanyData({ ...companyData, recognitions: [rec, ...(companyData.recognitions || [])] });
    };

    const renderPage = () => {
        if (!currentUser || !companyData) return null;

        const canAccess = (permission: keyof EmployeePermissions) => {
            // 1. Check if user has explicit permission
            if (!currentUser?.permissions[permission]) return false;

            // 2. Check if feature is disabled for the company
            const featureMap: Record<string, string> = {
                'viewMessages': 'messages',
                'viewCalendar': 'calendar',
                'useMarketplace': 'marketplace',
                'viewBenefits': 'benefits',
                'viewWellbeing': 'wellness',
                'openTickets': 'tickets',
                'viewKnowledgeBase': 'kb',
                'viewPolicies': 'policies',
                'viewRecognition': 'wall'
            };

            const featureId = featureMap[permission];
            if (featureId && currentCompany?.custom_features && currentCompany.custom_features[featureId] === false) {
                return false;
            }

            return true;
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
            case 'saas-dashboard': return currentUser.role === 'Super Admin' ? <SaaSDashboard companies={companies} /> : <p className="p-8 text-center text-red-600">Área restrita.</p>;
            case 'admin': return (currentUser.isAdmin || currentUser.is_company_admin || currentUser.role === 'Super Admin') && (currentCompany && currentCompany.plan) ? <AdminPage company={currentCompany} setCompany={handleSetCompanyForAdmin} plan={currentCompany.plan} customFeatures={currentCompany.custom_features} /> : <p className="p-8 text-center text-red-600">Acesso negado ou empresa não carregada.</p>;
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

    // Success Block
    if (currentUser && companyData && currentCompany && companySettings) {
        return (
            <Layout
                currentUser={currentUser}
                currentCompany={currentCompany}
                companySettings={companySettings}
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

    // Fallback: Repair Profile
    if (session && (!currentUser || !currentUser.company_id) && !loading) {
        const handleRepairProfile = async () => {
            if (!session.user.email) return;
            const userEmail = session.user.email.toLowerCase();
            const isMaster = userEmail === 'ti@grupopixel.com.br';
            let domain = isMaster ? 'grupopixel.com.br' : userEmail.split('@')[1];
            domain = domain.trim().toLowerCase();

            try {
                const { data: cos } = await supabase.from('companies').select('id, responsible_email').ilike('domain', domain);
                if (cos && cos.length > 0) {
                    const companyId = cos[0].id;
                    const isResp = (cos[0].responsible_email || '').toLowerCase() === userEmail;

                    await supabase.from('profiles').upsert({
                        id: session.user.id,
                        full_name: isMaster ? 'Master TI' : (session.user.user_metadata?.full_name || userEmail.split('@')[0]),
                        email: userEmail,
                        company_id: companyId,
                        role: isMaster ? 'Super Admin' : (isResp ? 'admin' : 'employee'),
                        is_admin: isMaster || isResp,
                        is_company_admin: isMaster || isResp
                    }, { onConflict: 'id' });

                    window.location.reload();
                } else {
                    alert("Domínio " + domain + " não autorizado.");
                }
            } catch (e: any) {
                alert("Erro: " + e.message);
            }
        };

        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
                <div className="bg-white p-10 rounded-2xl shadow-xl max-w-md w-full text-center border border-emerald-100">
                    <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">Quase lá!</h2>
                    <p className="text-gray-600 mb-8 leading-relaxed">Configuramos sua conta automaticamente. Clique abaixo para finalizar seu acesso.</p>
                    <button onClick={handleRepairProfile} className="w-full px-6 py-3 bg-brand-primary text-white font-semibold rounded-xl hover:bg-emerald-600 transition-all shadow-md mb-4">Finalizar Acesso</button>
                    <button onClick={handleLogout} className="w-full px-6 py-3 text-gray-400 font-medium hover:text-gray-600 transition-colors">Voltar ao Login</button>
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
            <ToastProvider>
                <AuthProvider>
                    <AppContent />
                </AuthProvider>
            </ToastProvider>
        </LanguageProvider>
    );
};

export default App;
