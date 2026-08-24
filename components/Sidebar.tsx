import React, { useState, useRef, useEffect } from 'react';
import Logo from './Logo';
import {
    HomeIcon,
    ChatBubbleLeftRightIcon,
    TicketIcon,
    CalendarDaysIcon,
    UsersIcon,
    FolderIcon,
    SparklesIcon,
    BuildingStorefrontIcon,
    DocumentTextIcon,
    HeartIcon,
    RocketLaunchIcon,
    Cog6ToothIcon,
    ShieldCheckIcon,
    ChevronDownIcon,
    QuestionMarkCircleIcon,
    ArrowPathIcon,
    PlusIcon,
    NewspaperIcon,
    BuildingOfficeIcon,
    StarIcon,
    FaceSmileIcon,
    LifebuoyIcon,
    UserGroupIcon,
    EnvelopeIcon,
    PlayIcon,
    ChartBarIcon,
    BanknotesIcon,
    CurrencyDollarIcon
} from './icons';
import type { Page, Employee, EmployeePermissions } from '../types';
import { useLanguage } from './LanguageContext';
import { useNotifications } from './NotificationContext';

interface SidebarProps {
    isOpen: boolean;
    onNavigate: (page: Page) => void;
    currentPage: Page;
    currentUser: Employee;
    companyName: string;
    companyLogo?: string;
    isImpersonating: boolean;
    isMasterAdmin?: boolean; // New prop
    customFeatures?: Record<string, boolean>;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onNavigate, currentPage, currentUser, companyName, companyLogo, isImpersonating, isMasterAdmin, customFeatures }) => {
    const { notifications, moduleUnreadCounts } = useNotifications();
    const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({ rh: false, ti: false, portal: false });
    const navRef = useRef<HTMLDivElement>(null);

    const toggleMenu = (menu: 'rh' | 'ti' | 'portal') => {
        setOpenMenus(prev => {
            const newState = { ...prev, [menu]: !prev[menu] };
            // Se estamos abrindo o menu, vamos rolar para ele
            if (newState[menu]) {
                setTimeout(() => {
                    const menuElement = document.getElementById(`menu-${menu}`);
                    if (menuElement && navRef.current) {
                        const navRect = navRef.current.getBoundingClientRect();
                        const menuRect = menuElement.getBoundingClientRect();
                        const relativeOffset = menuRect.top - navRect.top;
                        const scrollTarget = navRef.current.scrollTop + relativeOffset - (navRect.height / 2) + (menuRect.height / 2);

                        navRef.current.scrollTo({
                            top: scrollTarget,
                            behavior: 'smooth'
                        });
                    }
                }, 300); // Aguarda a animação de expansão
            }
            return newState;
        });
    };

    const NavItem: React.FC<{ page: Page; label: string; icon: React.FC<any>; permission: keyof EmployeePermissions | true; featureId?: string }> = ({ page, label, icon: Icon, permission, featureId }) => {
        const isAdmin = currentUser.isAdmin || currentUser.isCompanyAdmin || currentUser.role === 'Super Admin' || (isImpersonating && isMasterAdmin);
        const hasPermission = permission === true || (isImpersonating && isMasterAdmin) || (currentUser.permissions && (currentUser.permissions as any)[permission] === true);

        if (!isAdmin && !hasPermission) {
            return null;
        }
        // Se a feature não foi aprovada pelo SaaS, não exibir
        if (featureId && customFeatures) {
            if (customFeatures[featureId] === false) {
                return null;
            }
        }

        // --- Notification Badge Logic ---
        let badgeCount = 0;

        // 1. Check explicit module counts first (Email, Messages, WhatsPanda)
        if (moduleUnreadCounts[page]) {
            badgeCount = moduleUnreadCounts[page];
        }

        // 2. Generic lookup for other modules via global notifications array
        if (badgeCount === 0) {
            badgeCount = notifications.filter(n => {
                if (n.isRead) return false;

                // Maps page to keywords in link or type
                const pageKeywords: Record<string, string[]> = {
                    'feed': ['feed', 'like', 'mention'],
                    'calendar': ['calendar', 'event'],
                    'events': ['events', 'event'],
                    'marketplace': ['marketplace'],
                    'tickets': ['ticket', 'tickets'],
                    'recognition': ['recognition'],
                    'meu-rh': ['vacation', 'forms', 'benefit'],
                    'training': ['training']
                };

                const keywords = pageKeywords[page] || [page];
                return keywords.some(k =>
                    (n.link && n.link.toLowerCase().includes(k)) ||
                    (n.type && n.type.toLowerCase().includes(k))
                );
            }).length;
        }

        return (
            <button
                type="button"
                onClick={() => onNavigate(page)}
                className={`w-full flex items-center p-2.5 md:p-3 rounded-xl transition-all duration-300 relative group 
                    ${currentPage === page
                        ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30 dark:shadow-brand-primary/10 scale-[1.02] border border-white/10'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white'
                    } ${isOpen ? '' : 'justify-center'}`}
                title={badgeCount > 0 ? `${label} (${badgeCount})` : label}
            >
                <div className="relative">
                    <Icon className={`w-5 h-5 md:w-6 md:h-6 flex-shrink-0 transition-transform duration-300 group-hover:scale-110 ${currentPage === page ? 'text-white' : ''}`} />
                    {badgeCount > 0 && (
                        <span className="absolute -top-2 -right-2 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-lg border border-white dark:border-slate-950 animate-pulse">
                            {badgeCount > 99 ? '99+' : badgeCount}
                        </span>
                    )}
                </div>
                {isOpen && <span className={`ml-3.5 md:ml-4 truncate text-sm md:text-base font-medium ${currentPage === page ? 'font-bold' : ''}`}>{label}</span>}

                {/* Visual indicator for active item */}
                {currentPage === page && (
                    <div className="absolute left-0 w-1 h-6 bg-white rounded-r-full shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                )}
            </button>
        );
    };

    const NavMenu: React.FC<{ label: string; icon: React.FC<any>; menuKey: 'rh' | 'ti' | 'portal'; children: React.ReactNode, permission: boolean, featureId?: string }> = ({ label, icon: Icon, menuKey, children, permission, featureId }) => {
        const isAdmin = currentUser.isAdmin || currentUser.isCompanyAdmin || currentUser.role === 'Super Admin';

        // Se a feature não existe na listagem de customFeatures de uma empresa, assuma false caso seja um módulo restrito 
        if (featureId) {
            const isExplicitlyDisabled = customFeatures && customFeatures[featureId] === false;
            if (isExplicitlyDisabled) {
                return null;
            }
        }

        if (!isAdmin && !permission && !(isImpersonating && isMasterAdmin)) return null;

        const isActive = React.Children.toArray(children).some(child =>
            React.isValidElement(child) && (child.props as any).page === currentPage
        );

        // --- NavMenu Badge Logic (Aggregation) ---
        let menuBadgeCount = 0;
        if (menuKey === 'ti') {
            menuBadgeCount = notifications.filter(n => !n.isRead && (n.type === 'ticket' || (n.link && n.link.includes('ticket')))).length;
        } else if (menuKey === 'rh') {
            menuBadgeCount = notifications.filter(n => !n.isRead && (n.type === 'event' || (n.link && (n.link.includes('survey') || n.link.includes('training') || n.link.includes('form'))))).length;
        }

        return (
            <div id={`menu-${menuKey}`}>
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleMenu(menuKey);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 md:p-3 rounded-xl transition-all duration-300 relative group
                        ${isActive
                            ? 'bg-brand-primary/10 text-brand-primary dark:text-brand-primary border border-brand-primary/20'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white'
                        }`}
                >
                    <div className="flex items-center">
                        <div className="relative">
                            <Icon className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0 group-hover:scale-110 transition-transform duration-300" />
                            {menuBadgeCount > 0 && !openMenus[menuKey] && (
                                <span className="absolute -top-2 -right-2 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm border border-white dark:border-slate-900 animate-pulse">
                                    {menuBadgeCount > 99 ? '99+' : menuBadgeCount}
                                </span>
                            )}
                        </div>
                        {isOpen && <span className="ml-3.5 md:ml-4 truncate font-bold text-xs md:text-sm tracking-wide uppercase opacity-80">{label}</span>}
                    </div>
                    {isOpen && <ChevronDownIcon className={`w-3 h-3 md:w-4 md:h-4 transition-transform duration-300 ${openMenus[menuKey] ? 'rotate-180' : ''}`} />}
                </button>
                {openMenus[menuKey] && isOpen && (
                    <div className="pl-4 mt-1 space-y-1 animate-in slide-in-from-top-2 duration-500">
                        <div className="absolute left-6 top-0 bottom-0 w-px bg-gray-100 dark:bg-white/5" />
                        {children}
                    </div>
                )}
            </div>
        );
    };

    const rhPermissionKeys: (keyof EmployeePermissions)[] = ['viewDirectory', 'viewForms', 'viewBenefits', 'viewOnboarding', 'viewRecognition', 'viewDocuments', 'viewTraining', 'viewSurveys', 'viewPolicies'];
    const hasRhAccess = rhPermissionKeys.some(key => !!currentUser.permissions[key]) || (isImpersonating && isMasterAdmin);

    const tiPermissionKeys: (keyof EmployeePermissions)[] = ['viewTiDashboard', 'openTickets', 'openTiRequests', 'viewKnowledgeBase', 'viewServiceStatus', 'viewInfoSec'];
    const hasTiAccess = tiPermissionKeys.some(key => !!currentUser.permissions[key]) || (isImpersonating && isMasterAdmin);
    const { t } = useLanguage();

    return (
        <aside className={`transition-all duration-500 ease-in-out flex-shrink-0 flex flex-col shadow-2xl 
            bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl border-r border-gray-200 dark:border-white/5 
            fixed md:relative z-50 h-full overflow-hidden
            ${isOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full md:w-20 md:translate-x-0'}
            ${isImpersonating ? 'border-t-4 border-t-red-500' : ''}
        `}>
            <div className="h-20 md:h-24 flex items-center justify-center bg-white/50 dark:bg-transparent border-b border-gray-100 dark:border-white/5 backdrop-blur-sm">
                <div className="hover:scale-105 transition-transform duration-300 transition-all">
                    <Logo showText={isOpen} className={isOpen ? 'h-10 md:h-12' : 'h-8 md:h-10'} />
                </div>
            </div>
            <nav
                ref={navRef}
                className="flex-1 px-3 md:px-4 py-4 md:py-6 space-y-1.5 md:space-y-2 overflow-y-auto no-scrollbar"
            >
                <NavItem page="home" label={t('sidebar.home')} icon={HomeIcon} permission={true} />
                <NavItem page="whatspanda" label={t('sidebar.whatspanda')} icon={ChatBubbleLeftRightIcon} permission="viewWhatsPanda" featureId="whatspanda" />
                <NavItem page="messages" label={t('sidebar.messages')} icon={ChatBubbleLeftRightIcon} permission="viewMessages" featureId="messages" />
                <NavItem page="email" label={t('sidebar.pandamail')} icon={EnvelopeIcon} permission="viewEmail" featureId="email" />
                <NavItem page="feed" label={t('sidebar.feed')} icon={NewspaperIcon} permission={true} featureId="feed" />
                <NavItem page="calendar" label={t('sidebar.calendar')} icon={CalendarDaysIcon} permission="viewCalendar" featureId="calendar" />
                <NavItem page="marketplace" label={t('sidebar.marketplace')} icon={BuildingStorefrontIcon} permission="useMarketplace" featureId="marketplace" />
                <NavItem page="events" label={t('sidebar.events')} icon={CalendarDaysIcon} permission={true} featureId="events" />

                <hr className="my-2 border-gray-100 dark:border-slate-800" />

                <NavItem page="recognition" label={t('sidebar.recognition')} icon={StarIcon} permission="viewRecognition" featureId="wall" />
                <NavItem page="bem-estar" label={t('sidebar.wellbeing')} icon={HeartIcon} permission="viewWellbeing" featureId="wellness" />
                {/* <NavItem page="kpi-dashboard" label={t('sidebar.metrics')} icon={ShieldCheckIcon} permission="viewKPIDashboard" featureId="kpis" /> */}

                <NavMenu label={t('sidebar.rh_gestao')} icon={UserGroupIcon} menuKey="rh" permission={hasRhAccess}>
                    <NavItem page="directory" label={t('users.title')} icon={UsersIcon} permission="viewDirectory" featureId="org-chart" />
                    <NavItem page="org-chart" label={t('sidebar.org_chart')} icon={ArrowPathIcon} permission="viewOrgChart" featureId="org-chart" />
                    <NavItem page="meu-rh" label={t('sidebar.meu_rh')} icon={BuildingOfficeIcon} permission="viewMeuRH" featureId="meu-rh" />
                    <NavItem page="jobs" label={t('sidebar.jobs')} icon={RocketLaunchIcon} permission="viewJobs" featureId="jobs" />
                    <NavItem page="training" label={t('sidebar.training')} icon={RocketLaunchIcon} permission="viewTraining" featureId="training" />
                    <NavItem page="surveys" label={t('sidebar.surveys_internal')} icon={ChatBubbleLeftRightIcon} permission="viewSurveys" featureId="surveys" />
                    <NavItem page="forms" label={t('sidebar.forms')} icon={DocumentTextIcon} permission="viewForms" />
                    <NavItem page="benefits" label={t('sidebar.benefits')} icon={HeartIcon} permission="viewBenefits" featureId="benefits" />
                    <NavItem page="onboarding" label={t('sidebar.onboarding')} icon={RocketLaunchIcon} permission="viewOnboarding" featureId="onboarding" />
                    <NavItem page="documentos" label={t('sidebar.library')} icon={FolderIcon} permission="viewDocuments" />
                    <NavItem page="policies" label={t('policies.title')} icon={ShieldCheckIcon} permission="viewPolicies" featureId="policies" />
                </NavMenu>

                <NavMenu label={t('sidebar.ti_suporte')} icon={LifebuoyIcon} menuKey="ti" permission={hasTiAccess}>
                    <NavItem page="ti-dashboard" label={t('sidebar.ti_dashboard')} icon={Cog6ToothIcon} permission="viewTiDashboard" featureId="tickets" />
                    <NavItem page="tickets" label={t('sidebar.my_tickets')} icon={TicketIcon} permission="openTickets" featureId="tickets" />
                    <NavItem page="ti-requests" label={t('sidebar.request_equipment')} icon={PlusIcon} permission="openTiRequests" featureId="equip" />
                    <NavItem page="knowledge-base" label={t('kb.title')} icon={QuestionMarkCircleIcon} permission="viewKnowledgeBase" featureId="kb" />
                    <NavItem page="manual-usuario" label={t('sidebar.user_manual')} icon={PlayIcon} permission={true} />
                    <NavItem page="service-status" label={t('status.title')} icon={ArrowPathIcon} permission="viewServiceStatus" />
                    <NavItem page="infosec" label="Segurança Info." icon={ShieldCheckIcon} permission="viewInfoSec" featureId="infosec" />
                </NavMenu>


                {/* SaaS Super Admin Button */}
                {currentUser.role === 'Super Admin' && (
                    <>
                        <NavItem page="support-inbox" label="Suporte (Master)" icon={LifebuoyIcon} permission={true} />
                        <button
                            type="button"
                            onClick={() => onNavigate('saas-dashboard')}
                            className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 ${currentPage === 'saas-dashboard' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-gray-600 hover:bg-purple-50 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 dark:hover:bg-gray-700'
                                } ${isOpen ? '' : 'justify-center'} mt-2 border-2 border-dashed border-purple-200 dark:border-gray-700`}
                            title="Painel SaaS"
                        >
                            <BuildingOfficeIcon className="w-6 h-6 flex-shrink-0" />
                            {isOpen && <span className="ml-4 truncate font-bold">{t('sidebar.saas_panel')}</span>}
                        </button>
                    </>
                )}

                {(currentUser.isAdmin || currentUser.isCompanyAdmin) && (
                    <button
                        type="button"
                        onClick={() => onNavigate('admin')}
                        className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 ${currentPage === 'admin' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700'
                            } ${isOpen ? '' : 'justify-center'}`}
                        title={t('sidebar.admin')}
                    >
                        <ShieldCheckIcon className="w-6 h-6 flex-shrink-0" />
                        {isOpen && <span className="ml-4 truncate">{t('sidebar.admin')}</span>}
                    </button>
                )}
            </nav>
            {/* Company Logo Footer */}
            <div className={`mt-auto p-3 lg:p-4 border-t border-gray-100 dark:border-white/5 text-center bg-white/50 dark:bg-white/5 backdrop-blur-sm 
                ${isOpen ? 'block' : 'hidden md:block md:opacity-0 md:hover:opacity-100 transition-opacity'}`}>
                {companyLogo && (
                    <img src={companyLogo} alt={companyName} className="h-8 md:h-10 mx-auto object-contain" />
                )}
                <p className="text-xs md:text-sm font-bold text-gray-800 dark:text-gray-200 truncate mt-2">{companyName}</p>
            </div>
        </aside>
    );
};
export default Sidebar;