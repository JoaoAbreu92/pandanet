import { resolveCommercialFeatures } from '../utils/commercialFeatures';
import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import type { Page, Employee, Company, Notification } from '../types';
import NotificationsPanel from './NotificationsPanel';
import DebugPanel from './DebugPanel';
import SystemUpdateNotification from './SystemUpdateNotification';
import EmailNotifier from './EmailNotifier';
import { useNotifications } from './NotificationContext';
import { OnlineUsersSidebar } from './OnlineUsersSidebar';
import { useAuth } from './AuthContext';

interface LayoutProps {
    children: React.ReactNode;
    currentUser: Employee;
    currentCompany: Company;
    companySettings: Company['settings'];
    isImpersonating: boolean;
    impersonatedCompanyName?: string;
    impersonatedUser?: Employee | null;
    onNavigate: (page: Page, context?: any) => void;
    currentPage: Page;
    pageContext?: any;
    onLogout: () => void;
    onEndImpersonation: () => void;

    // Notifications
    notifications: Notification[];
    onMarkAsRead: (id: string) => void;
    onClearAllNotifications: () => void;

    // Theme
    theme: 'light' | 'dark';
    toggleTheme: () => void;

    // Nudge
    isShaking?: boolean;

    // Search
    onSearch?: (term: string) => void;

    // Chat
    onStartDirectChat?: (userId: string) => void;
}

const Layout: React.FC<LayoutProps> = ({
    children,
    currentUser,
    currentCompany,
    companySettings,
    isImpersonating,
    impersonatedCompanyName,
    impersonatedUser,
    onNavigate,
    currentPage,
    pageContext,
    onLogout,
    onEndImpersonation,
    notifications,
    onMarkAsRead,
    onClearAllNotifications,
    theme,
    toggleTheme,
    isShaking,
    onSearch,
    onStartDirectChat
}) => {
    const { realProfile } = useAuth();
    const [isSidebarOpen, setSidebarOpen] = useState(() => {
        if (typeof window !== 'undefined') {
            if (!window.matchMedia('(min-width: 1024px)').matches) return false;
            const saved = localStorage.getItem('sidebar_open');
            return saved !== null ? saved === 'true' : true;
        }
        return true;
    });
    const [isRightSidebarOpen, setRightSidebarOpen] = useState(false);
    const [isNotificationsOpen, setNotificationsOpen] = useState(false);
    const [isDebugOpen, setDebugOpen] = useState(false);

    const toggleSidebar = () => {
        const nextState = !isSidebarOpen;
        setSidebarOpen(nextState);
        if (typeof window !== 'undefined') {
            localStorage.setItem('sidebar_open', String(nextState));
        }
    };

    const isMasterAdmin =
        realProfile?.role === 'Super Admin';

    // Synchronize currentPage with NotificationContext
    const { setCurrentPage } = useNotifications();
    React.useEffect(() => {
        if (setCurrentPage) {
            setCurrentPage(currentPage);
        }
    }, [currentPage, setCurrentPage]);

    // Sincronizar abertura da sidebar (apenas no celular)
    React.useEffect(() => {
        if (window.innerWidth < 1024) {
            setSidebarOpen(false);
        }
    }, [currentPage]);

    React.useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            if (window.innerWidth < 1024) setSidebarOpen(false);
            setNotificationsOpen(false);
            setDebugOpen(false);
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, []);

    return (
        <div className={`pandanet-shell flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-[#f4f7fb] text-slate-900 dark:bg-[#07111f] dark:text-slate-100 ${isShaking ? 'nudge-shake' : ''}`}>
            {isImpersonating && (
                <div className={`text-white text-xs py-1.5 px-4 text-center z-[60] flex items-center justify-center gap-2 font-medium shadow-sm ${impersonatedUser ? 'bg-purple-600' : 'bg-red-600'}`}>
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/30 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                    </span>
                    <span className="tracking-wide">
                        <strong className="font-bold">MODO FANTASMA:</strong> {impersonatedCompanyName ? (
                            <>Auditoria da empresa <span className="underline decoration-red-400 font-bold">{impersonatedCompanyName}</span> com autoridade de Super Admin.</>
                        ) : impersonatedUser ? (
                            <>Auditoria do usuário <span className="underline decoration-purple-300 font-bold">{impersonatedUser.name || currentUser.name}</span> na empresa <span className="font-bold">{currentCompany.name}</span> com autoridade de Super Admin.</>
                        ) : (
                            <>Modo Ghost ativo. Alvo de auditoria não identificado.</>
                        )}
                    </span>
                </div>
            )}
            <SystemUpdateNotification />
            <EmailNotifier />
            {isMasterAdmin && (
                <DebugPanel
                    currentUser={currentUser}
                    currentCompany={currentCompany}
                    isOpen={isDebugOpen}
                    onClose={() => setDebugOpen(false)}
                />
            )}
            <div className="flex flex-1 w-full overflow-hidden relative">
                {/* Mobile Overlay */}
                {isSidebarOpen && (
                    <div
                        className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                        aria-label="Fechar menu de navegação"
                    />
                )}

                <div className="h-full z-45 flex-shrink-0">
                    <Sidebar
                        isOpen={isSidebarOpen}
                        onNavigate={(page, context) => {
                            onNavigate(page, context);
                            if (window.innerWidth < 1024) setSidebarOpen(false); // Fecha a navegacao em telas compactas
                        }}
                        currentPage={currentPage}
                        pageContext={pageContext}
                        currentUser={currentUser}
                        companyName={companySettings.companyName}
                        companyLogo={companySettings.logoUrl}
                        isImpersonating={isImpersonating}
                        isMasterAdmin={isMasterAdmin}
                        customFeatures={resolveCommercialFeatures(currentCompany)}
                    />
                </div>

                <div className={`flex-1 flex flex-col overflow-hidden relative min-w-0 w-full transition-all duration-300`}>
                    <Header
                        currentPage={currentPage}
                        onToggleSidebar={toggleSidebar}
                        onToggleDebug={() => setDebugOpen(!isDebugOpen)}
                        currentUser={currentUser}
                        onLogout={onLogout}
                        onNavigate={onNavigate}
                        isImpersonating={isImpersonating}
                        impersonatedCompanyName={
                            impersonatedCompanyName
                            || (
                                impersonatedUser
                                    ? `${impersonatedUser.name || currentUser.name} • ${currentCompany.name}`
                                    : undefined
                            )
                        }
                        onEndImpersonation={onEndImpersonation}
                        onToggleNotifications={() => setNotificationsOpen(!isNotificationsOpen)}
                        unreadNotificationsCount={notifications.filter(n => !n.isRead).length}
                        theme={theme}
                        toggleTheme={toggleTheme}
                        onSearch={onSearch}
                    />
                    <NotificationsPanel
                        isOpen={isNotificationsOpen}
                        onClose={() => setNotificationsOpen(false)}
                        notifications={notifications}
                        onMarkAsRead={onMarkAsRead}
                        onClearAll={onClearAllNotifications}
                        onNavigate={onNavigate}
                    />
                    <main className="pandanet-workspace relative flex-1 overflow-hidden p-0">
                        <div className={`pandanet-page h-full w-full overflow-x-hidden ${['messages', 'email', 'whatspanda'].includes(currentPage) ? 'overflow-hidden p-0' : 'overflow-y-auto p-3 sm:p-5 lg:p-6 xl:p-8'}`}>
                            {children}
                        </div>
                    </main>
                </div>

                {/* Área invisível na extrema direita para acionar hover no desktop */}
                {onStartDirectChat && (
                    <div
                        className="hidden xl:block fixed right-0 top-0 bottom-0 w-3 z-40 bg-transparent"
                        onMouseEnter={() => {
                            if (window.innerWidth >= 1280) {
                                setRightSidebarOpen(true);
                            }
                        }}
                    />
                )}

                {onStartDirectChat && (
                    <div
                        className="hidden xl:block h-full z-45"
                        onMouseEnter={() => {
                            if (window.innerWidth >= 1280) {
                                setRightSidebarOpen(true);
                            }
                        }}
                        onMouseLeave={() => {
                            if (window.innerWidth >= 1280) {
                                setRightSidebarOpen(false);
                            }
                        }}
                    >
                        <OnlineUsersSidebar
                            currentUser={currentUser}
                            onStartChat={onStartDirectChat}
                            onNavigate={onNavigate}
                            isOpen={isRightSidebarOpen}
                            setIsOpen={setRightSidebarOpen}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default Layout;
