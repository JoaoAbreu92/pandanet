import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import type { Page, Employee, Company, Notification } from '../types';
import NotificationsPanel from './NotificationsPanel';

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

    return (
        <div className="flex h-screen w-full bg-brand-secondary dark:bg-gray-900">
            <Sidebar
                isOpen={isSidebarOpen}
                onNavigate={onNavigate}
                currentPage={currentPage}
                currentUser={currentUser}
                companyName={companySettings.companyName}
                companyLogo={companySettings.logoUrl}
                isImpersonating={isImpersonating}
            />
            <div className="flex-1 flex flex-col overflow-hidden relative min-w-0 w-full">
                <Header
                    onToggleSidebar={() => setSidebarOpen(!isSidebarOpen)}
                    currentUser={currentUser}
                    onLogout={onLogout}
                    onNavigate={onNavigate}
                    isImpersonating={isImpersonating}
                    impersonatedCompanyName={impersonatedCompanyName}
                    onEndImpersonation={onEndImpersonation}
                    onToggleNotifications={() => setNotificationsOpen(true)}
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
                />
                <main className="flex-1 overflow-x-hidden overflow-y-auto p-8 relative">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default Layout;
