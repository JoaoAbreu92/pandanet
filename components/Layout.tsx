import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import type { Page, Employee, Company, Notification } from '../types';
import NotificationsPanel from './NotificationsPanel';
import DebugPanel from './DebugPanel';
import SystemUpdateNotification from './SystemUpdateNotification';

interface LayoutProps {
    children: React.ReactNode;
    currentUser: Employee;
    currentCompany: Company;
    companySettings: Company['settings'];
    isImpersonating: boolean;
    impersonatedCompanyName?: string;
    onNavigate: (page: Page) => void;
    currentPage: Page;
    onLogout: () => void;
    onEndImpersonation: () => void;

    // Notifications
    notifications: Notification[];
    onMarkAsRead: (id: string) => void;
    onClearAllNotifications: () => void;

    // Theme
    theme: 'light' | 'dark';
    toggleTheme: () => void;
}

const Layout: React.FC<LayoutProps> = ({
    children,
    currentUser,
    currentCompany,
    companySettings,
    isImpersonating,
    impersonatedCompanyName,
    onNavigate,
    currentPage,
    onLogout,
    onEndImpersonation,
    notifications,
    onMarkAsRead,
    onClearAllNotifications,
    theme,
    toggleTheme
}) => {
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const [isNotificationsOpen, setNotificationsOpen] = useState(false);

    // Initial check for mobile
    React.useEffect(() => {
        if (window.innerWidth < 768) {
            setSidebarOpen(false);
        }
    }, []);

    return (
        <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-slate-50 dark:bg-gray-900">
            <SystemUpdateNotification />
            <div className="flex flex-1 w-full overflow-hidden relative">
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <Sidebar
                isOpen={isSidebarOpen}
                onNavigate={(page) => {
                    onNavigate(page);
                    if (window.innerWidth < 768) setSidebarOpen(false); // Close on nav on mobile
                }}
                currentPage={currentPage}
                currentUser={currentUser}
                companyName={companySettings.companyName}
                companyLogo={companySettings.logoUrl}
                isImpersonating={isImpersonating}
                customFeatures={currentCompany.custom_features}
            />
            <div className={`flex-1 flex flex-col overflow-hidden relative min-w-0 w-full transition-all duration-300 ${isSidebarOpen ? 'md:pl-0' : 'md:pl-0'}`}>
                <Header
                    onToggleSidebar={() => setSidebarOpen(!isSidebarOpen)}
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
                    <div className={`h-full w-full overflow-x-hidden ${currentPage === 'messages' ? 'overflow-hidden p-0' : 'overflow-y-auto p-4 md:p-8'}`}>
                        {children}
                    </div>
                </main>
                <DebugPanel currentUser={currentUser} currentCompany={currentCompany} />
            </div>
        </div>
    </div>
);
};

export default Layout;
