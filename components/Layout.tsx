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
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const [isRightSidebarOpen, setRightSidebarOpen] = useState(false);
    const [isNotificationsOpen, setNotificationsOpen] = useState(false);
    const [isDebugOpen, setDebugOpen] = useState(false);

    const isMasterAdmin = currentUser.email === 'ti@grupopixel.com.br';

    // Synchronize currentPage with NotificationContext
    const { setCurrentPage } = useNotifications();
    React.useEffect(() => {
        if (setCurrentPage) {
            setCurrentPage(currentPage);
        }
    }, [currentPage, setCurrentPage]);

    // Sincronizar abertura da sidebar
    React.useEffect(() => {
        setSidebarOpen(false);
    }, [currentPage]);

    return (
        <div className={`flex flex-col h-[100dvh] w-full overflow-hidden bg-slate-50 dark:bg-[#020617] ${isShaking ? 'nudge-shake' : ''}`}>
            {isImpersonating && (
                <div className={`text-white text-xs py-1.5 px-4 text-center z-[60] flex items-center justify-center gap-2 font-medium shadow-sm ${impersonatedUser ? 'bg-purple-600' : 'bg-red-600'}`}>
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/30 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                    </span>
                    <span className="tracking-wide">
                        <strong className="font-bold">MODO FANTASMA:</strong> {impersonatedUser ? (
                            <>Você está auditando o perfil de <span className="underline decoration-purple-300 font-bold">{currentUser.name}</span> na empresa <span className="font-bold">{currentCompany.name}</span>.</>
                        ) : (
                            <>Você está visualizando a intranet da empresa <span className="underline decoration-red-400 font-bold">{impersonatedCompanyName || 'selecionada'}</span>. Suas leituras e visualizações não deixarão rastros no sistema.</>
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
                        className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Área invisível na extrema esquerda para acionar hover no desktop */}
                <div
                    className="hidden md:block fixed left-0 top-0 bottom-0 w-3 z-40 bg-transparent"
                    onMouseEnter={() => {
                        if (window.innerWidth >= 768) {
                            setSidebarOpen(true);
                        }
                    }}
                />

                <div
                    onMouseEnter={() => {
                        if (window.innerWidth >= 768) {
                            setSidebarOpen(true);
                        }
                    }}
                    onMouseLeave={() => {
                        if (window.innerWidth >= 768) {
                            setSidebarOpen(false);
                        }
                    }}
                    className="h-full z-45 flex-shrink-0"
                >
                    <Sidebar
                        isOpen={isSidebarOpen}
                        onNavigate={(page, context) => {
                            onNavigate(page, context);
                            if (window.innerWidth < 768) setSidebarOpen(false); // Close on nav on mobile
                        }}
                        currentPage={currentPage}
                        pageContext={pageContext}
                        currentUser={currentUser}
                        companyName={companySettings.companyName}
                        companyLogo={companySettings.logoUrl}
                        isImpersonating={isImpersonating}
                        isMasterAdmin={isMasterAdmin}
                        customFeatures={currentCompany.custom_features}
                    />
                </div>

                <div className={`flex-1 flex flex-col overflow-hidden relative min-w-0 w-full transition-all duration-300`}>
                    <Header
                        onToggleSidebar={() => setSidebarOpen(!isSidebarOpen)}
                        onToggleDebug={() => setDebugOpen(!isDebugOpen)}
                        currentUser={currentUser}
                        onLogout={onLogout}
                        onNavigate={onNavigate}
                        isImpersonating={isImpersonating}
                        impersonatedCompanyName={impersonatedCompanyName}
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
                    <main className="flex-1 overflow-hidden p-0 relative">
                        <div className={`h-full w-full overflow-x-hidden ${['messages', 'email', 'whatspanda'].includes(currentPage) ? 'overflow-hidden p-0' : 'overflow-y-auto p-4 md:p-8'}`}>
                            {children}
                        </div>
                    </main>
                </div>

                {/* Área invisível na extrema direita para acionar hover no desktop */}
                {onStartDirectChat && (
                    <div
                        className="hidden md:block fixed right-0 top-0 bottom-0 w-3 z-40 bg-transparent"
                        onMouseEnter={() => {
                            if (window.innerWidth >= 768) {
                                setRightSidebarOpen(true);
                            }
                        }}
                    />
                )}

                {onStartDirectChat && (
                    <div 
                        className="hidden md:block h-full z-45"
                        onMouseEnter={() => {
                            if (window.innerWidth >= 768) {
                                setRightSidebarOpen(true);
                            }
                        }}
                        onMouseLeave={() => {
                            if (window.innerWidth >= 768) {
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
