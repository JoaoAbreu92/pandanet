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
    CurrencyDollarIcon,
    ClipboardDocumentCheckIcon,
    WhatsAppIcon,
    CalendarIcon,
    ListBulletIcon
} from './icons';
import type { Page, Employee, EmployeePermissions } from '../types';
import { useLanguage } from './LanguageContext';
import { useNotifications } from './NotificationContext';
import { useAuth } from './AuthContext';

interface SidebarProps {
    isOpen: boolean;
    onNavigate: (page: Page, context?: any) => void;
    currentPage: Page;
    currentUser: Employee;
    companyName: string;
    companyLogo?: string;
    isImpersonating: boolean;
    isMasterAdmin?: boolean; // New prop
    customFeatures?: Record<string, boolean>;
    pageContext?: any;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onNavigate, currentPage, currentUser, companyName, companyLogo, isImpersonating, isMasterAdmin, customFeatures, pageContext }) => {

    const {
        realProfile,
        isGhostMode
    } = useAuth();


    const { notifications, moduleUnreadCounts } = useNotifications();

    const ghostSuperAdmin =
        isGhostMode
        && realProfile?.role === 'Super Admin';

    const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({ rh: false, ti: false, portal: false, projects: false, social: false, agenda: false, newAgenda: false, reservations: false });
    const navRef = useRef<HTMLDivElement>(null);

    const [hasSelectedProject, setHasSelectedProject] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('pixel_selected_project') !== null;
        }
        return false;
    });

    useEffect(() => {
        const handleProjectChange = () => {
            setHasSelectedProject(localStorage.getItem('pixel_selected_project') !== null);
        };
        window.addEventListener('pixel_selected_project_changed', handleProjectChange);
        return () => window.removeEventListener('pixel_selected_project_changed', handleProjectChange);
    }, []);

    const toggleMenu = (menu: 'rh' | 'ti' | 'portal' | 'projects' | 'social' | 'agenda' | 'newAgenda' | 'reservations') => {
        setOpenMenus(prev => {
            const isCurrentlyOpen = prev[menu];
            const newState = { rh: false, ti: false, portal: false, projects: false, social: false, agenda: false, newAgenda: false, reservations: false };
            newState[menu] = !isCurrentlyOpen;
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

    useEffect(() => {
        if (['directory', 'org-chart', 'meu-rh', 'jobs', 'training', 'surveys', 'policies'].includes(currentPage)) {
            setOpenMenus(prev => ({ ...prev, rh: true }));
        }
        if (['knowledge-base', 'service-status', 'infosec'].includes(currentPage)) {
            setOpenMenus(prev => ({ ...prev, ti: true }));
        }
        if (['projects', 'projects-planning', 'projects-list', 'projects-calendar', 'projects-metrics'].includes(currentPage)) {
            setOpenMenus(prev => ({ ...prev, projects: true }));
        }
        if (['messages', 'feed'].includes(currentPage)) {
            setOpenMenus(prev => ({ ...prev, social: true }));
        }
        if (['scheduling', 'scheduling-events'].includes(currentPage)) {
            setOpenMenus(prev => ({ ...prev, agenda: true }));
        }
        if (['agenda'].includes(currentPage)) {
            setOpenMenus(prev => ({ ...prev, newAgenda: true }));
        }
        if (['reservas'].includes(currentPage)) {
            setOpenMenus(prev => ({ ...prev, reservations: true }));
        }
    }, [currentPage]);

    const NavItem: React.FC<{ page: Page; label: string; icon: React.FC<any>; permission: keyof EmployeePermissions | true; featureId?: string; context?: any }> = ({ page, label, icon: Icon, permission, featureId, context }) => {
        const isAdmin =
            ghostSuperAdmin
            || currentUser.isAdmin
            || currentUser.isCompanyAdmin
            || currentUser.role === 'Super Admin'
            || (isImpersonating && isMasterAdmin);

        let hasPermission =
            ghostSuperAdmin
            || permission === true
            || (isImpersonating && isMasterAdmin)
            || (
                currentUser.permissions
                && (currentUser.permissions as any)[permission] === true
            );

        if (
            permission === 'viewWhatsPanda'
            && !ghostSuperAdmin
        ) {
            const hasWhatsPanda = !!currentUser.is_whatsapp_agent ||
                (!!currentUser.whatspanda_permissions && Object.keys(currentUser.whatspanda_permissions).length > 0) ||
                (currentUser.permissions && (currentUser.permissions as any).viewWhatsPanda === true);
            if (hasWhatsPanda) {
                hasPermission = true;
            }
        }

        if (!isAdmin && !hasPermission) {
            return null;
        }

        const isActive = currentPage === page && (
            !context
                ? true
                : (pageContext && pageContext.tab
                    ? pageContext.tab === context.tab
                    : (page === 'agenda' ? context.tab === 'visits' : page === 'reservas' ? context.tab === 'rooms' : true)
                  )
        );

        // Se a feature não foi aprovada pelo SaaS, não exibir
        if (
            !ghostSuperAdmin
            && featureId
            && customFeatures
        ) {
            const feat = customFeatures[featureId] as any;
            if (feat === false || feat === 'disabled') {
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
                    'calendar': ['calendar', 'event', 'personal-tasks'],
                    'events': ['events'],
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
                onClick={() => onNavigate(page, context)}
                aria-current={isActive ? 'page' : undefined}
                className={`group relative flex w-full items-center rounded-xl px-3 py-2.5 text-left transition-all duration-200 ease-out
                    ${isActive
                        ? 'bg-brand-primary text-slate-950 shadow-[0_8px_24px_-12px_rgba(16,185,129,0.8)]'
                        : 'text-slate-300 hover:translate-x-1 hover:bg-brand-primary/15 hover:text-white hover:shadow-[inset_3px_0_0_#00d68f,0_10px_22px_-18px_rgba(0,214,143,0.9)]'
                    } ${isOpen ? '' : 'justify-center'}`}
                title={badgeCount > 0 ? `${label} (${badgeCount})` : label}
            >
                <div className="relative">
                    <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-slate-950' : 'text-slate-400 group-hover:text-brand-primary'}`} />
                    {badgeCount > 0 && (
                        <span className="absolute -right-2 -top-2 flex h-4 min-w-[1rem] items-center justify-center rounded-full border border-[#0b1727] bg-rose-500 px-1 text-[10px] font-bold text-white">
                            {badgeCount > 99 ? '99+' : badgeCount}
                        </span>
                    )}
                </div>
                {isOpen && <span className={`ml-3 truncate text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>{label}</span>}

                {/* Visual indicator for active item */}
                {isActive && (
                    <div className="absolute left-0 h-5 w-0.5 rounded-r-full bg-slate-950/70" />
                )}
            </button>
        );
    };

    const NavMenu: React.FC<{ label: string; icon: React.FC<any>; menuKey: 'rh' | 'ti' | 'portal' | 'projects' | 'social' | 'agenda' | 'newAgenda' | 'reservations'; children: React.ReactNode, permission: boolean, featureId?: string }> = ({ label, icon: Icon, menuKey, children, permission, featureId }) => {
        const isAdmin = currentUser.isAdmin || currentUser.isCompanyAdmin || currentUser.role === 'Super Admin';

        // Se a feature não existe na listagem de customFeatures de uma empresa, assuma false caso seja um módulo restrito
        if (
            !ghostSuperAdmin
            && featureId
        ) {
            const feat = customFeatures ? (customFeatures[featureId] as any) : null;
            const isExplicitlyDisabled = feat === false || feat === 'disabled';
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
        } else if (menuKey === 'social') {
            const feedBadgeCount = notifications.filter(n => {
                if (n.isRead) return false;
                const keywords = ['feed', 'like', 'mention'];
                return keywords.some(k =>
                    (n.link && n.link.toLowerCase().includes(k)) ||
                    (n.type && n.type.toLowerCase().includes(k))
                );
            }).length;
            menuBadgeCount = (moduleUnreadCounts['messages'] || 0) + feedBadgeCount;
        }

        return (
            <div id={`menu-${menuKey}`}>
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleMenu(menuKey);
                    }}
                    aria-expanded={openMenus[menuKey]}
                    className={`group relative flex w-full items-center justify-between rounded-xl px-3 py-2.5 transition-all duration-200 ease-out
                        ${isActive
                            ? 'bg-white/10 text-brand-primary'
                            : 'text-slate-300 hover:translate-x-1 hover:bg-brand-primary/15 hover:text-white hover:shadow-[inset_3px_0_0_#00d68f]'
                        }`}
                >
                    <div className="flex items-center">
                        <div className="relative">
                            <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-brand-primary' : 'text-slate-400 group-hover:text-brand-primary'}`} />
                            {menuBadgeCount > 0 && !openMenus[menuKey] && (
                                <span className="absolute -top-2 -right-2 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm border border-white dark:border-slate-900 animate-pulse">
                                    {menuBadgeCount > 99 ? '99+' : menuBadgeCount}
                                </span>
                            )}
                        </div>
                        {isOpen && <span className="ml-3 truncate text-[11px] font-bold uppercase tracking-[0.12em]">{label}</span>}
                    </div>
                    {isOpen && <ChevronDownIcon className={`w-3 h-3 md:w-4 md:h-4 transition-transform duration-300 ${openMenus[menuKey] ? 'rotate-180' : ''}`} />}
                </button>
                {openMenus[menuKey] && isOpen && (
                    <div className="relative mt-1 space-y-1 pl-4">
                        <div className="absolute bottom-1 left-6 top-1 w-px bg-white/10" />
                        {children}
                    </div>
                )}
            </div>
        );
    };

    const rhPermissionKeys: (keyof EmployeePermissions)[] = ['viewDirectory', 'viewForms', 'viewBenefits', 'viewOnboarding', 'viewRecognition', 'viewDocuments', 'viewTraining', 'viewSurveys', 'viewPolicies', 'viewMeuRH'];
    const hasRhAccess = rhPermissionKeys.some(key => !!currentUser.permissions[key]) || (isImpersonating && isMasterAdmin);

    const tiPermissionKeys: (keyof EmployeePermissions)[] = ['viewTiDashboard', 'openTickets', 'openTiRequests', 'viewKnowledgeBase', 'viewServiceStatus', 'viewInfoSec'];
    const hasTiAccess = tiPermissionKeys.some(key => !!currentUser.permissions[key]) || (isImpersonating && isMasterAdmin);
    const { t } = useLanguage();

    return (
        <aside className={`pandanet-sidebar fixed z-50 flex h-full flex-shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[#0b1727] text-white shadow-2xl transition-[width,transform] duration-300 lg:relative
            ${isOpen ? 'w-[17rem] translate-x-0' : 'w-[17rem] -translate-x-full lg:w-[4.75rem] lg:translate-x-0'}
            ${isImpersonating ? 'border-t-4 border-t-red-500' : ''}
        `}>
            <div className="flex h-16 items-center justify-center border-b border-white/10 bg-white/[0.02]">
                <div>
                    <Logo showText={isOpen} className={isOpen ? 'h-8 md:h-9' : 'h-6 md:h-7'} />
                </div>
            </div>
            <nav
                ref={navRef}
                className="flex-1 space-y-1 overflow-y-auto px-3 py-4 no-scrollbar"
            >
                <NavItem page="home" label={t('sidebar.home')} icon={HomeIcon} permission={true} />
                <NavItem page="whatspanda" label={t('sidebar.whatspanda')} icon={WhatsAppIcon} permission="viewWhatsPanda" featureId="whatspanda" />
                <NavMenu label="Social" icon={UserGroupIcon} menuKey="social" permission={true}>
                    <NavItem page="messages" label={t('sidebar.messages')} icon={ChatBubbleLeftRightIcon} permission="viewMessages" featureId="messages" />
                    <NavItem page="feed" label={t('sidebar.feed')} icon={NewspaperIcon} permission={true} featureId="feed" />
                    <NavItem page="marketplace" label={t('sidebar.marketplace')} icon={BuildingStorefrontIcon} permission="useMarketplace" featureId="marketplace" />
                </NavMenu>
                <NavItem page="email" label={t('sidebar.pandamail')} icon={EnvelopeIcon} permission="viewEmail" featureId="email" />
                <NavItem page="calendar" label={t('sidebar.calendar')} icon={CalendarDaysIcon} permission="viewCalendar" featureId="calendar" />
                <NavMenu label="Agenda" icon={CalendarIcon} menuKey="newAgenda" permission={ghostSuperAdmin || !!currentUser.permissions?.viewAgenda} featureId="new_agenda">
                    <NavItem page="agenda" label="Visitas" icon={UsersIcon} permission="viewAgenda" featureId="new_agenda" context={{ tab: 'visits' }} />
                    <NavItem page="agenda" label="Reuniões" icon={UserGroupIcon} permission="viewAgenda" featureId="new_agenda" context={{ tab: 'meetings' }} />
                    <NavItem page="agenda" label="Treinamentos" icon={PlayIcon} permission="viewAgenda" featureId="new_agenda" context={{ tab: 'trainings' }} />
                </NavMenu>
                <NavItem page="reservas" label="Reservas" icon={BuildingOfficeIcon} permission="viewReservations" featureId="reservations" />
                <NavItem page="events" label={t('sidebar.events')} icon={CalendarDaysIcon} permission={true} featureId="events" />
                <NavMenu label={t('sidebar.projects')} icon={ClipboardDocumentCheckIcon} menuKey="projects" permission={ghostSuperAdmin || !!currentUser.permissions.viewProjects} featureId="projects">
                    <NavItem page="projects" label="Painel de Controle" icon={ClipboardDocumentCheckIcon} permission="viewProjects" featureId="projects" />
                    {hasSelectedProject && (
                        <>
                            {(ghostSuperAdmin || (customFeatures?.projects as any) !== 'limited') && <NavItem page="projects-planning" label="Planejamento" icon={CalendarDaysIcon} permission="viewProjects" featureId="projects" />}
                            <NavItem page="projects-list" label="Lista" icon={ListBulletIcon} permission="viewProjects" featureId="projects" />
                            <NavItem page="projects-calendar" label="Calendário" icon={CalendarIcon} permission="viewProjects" featureId="projects" />
                            {(ghostSuperAdmin || (customFeatures?.projects as any) !== 'limited') && <NavItem page="projects-metrics" label="Métricas" icon={ChartBarIcon} permission="viewProjects" featureId="projects" />}
                        </>
                    )}
                </NavMenu>

                <hr className="my-3 border-white/10" />

                <NavItem page="recognition" label={t('sidebar.recognition')} icon={StarIcon} permission="viewRecognition" featureId="wall" />
                {/* <NavItem page="kpi-dashboard" label={t('sidebar.metrics')} icon={ShieldCheckIcon} permission="viewKPIDashboard" featureId="kpis" /> */}

                <NavMenu label={t('sidebar.rh_gestao')} icon={UserGroupIcon} menuKey="rh" permission={hasRhAccess}>
                    <NavItem page="directory" label="Colaboradores" icon={UsersIcon} permission="viewDirectory" featureId="org-chart" />
                    <NavItem page="org-chart" label={t('sidebar.org_chart')} icon={ArrowPathIcon} permission="viewOrgChart" featureId="org-chart" />
                    <NavItem page="meu-rh" label={t('sidebar.meu_rh')} icon={BuildingOfficeIcon} permission="viewMeuRH" featureId="meu-rh" />
                    <NavItem page="jobs" label={t('sidebar.jobs')} icon={RocketLaunchIcon} permission="viewJobs" featureId="jobs" />
                    <NavItem page="training" label={t('sidebar.training')} icon={RocketLaunchIcon} permission="viewTraining" featureId="training" />
                    <NavItem page="surveys" label={t('sidebar.surveys_internal')} icon={ChatBubbleLeftRightIcon} permission="viewSurveys" featureId="surveys" />
                    <NavItem page="benefits" label={t('sidebar.benefits')} icon={HeartIcon} permission="viewBenefits" featureId="benefits" />
                    <NavItem page="onboarding" label={t('sidebar.onboarding')} icon={RocketLaunchIcon} permission="viewOnboarding" featureId="onboarding" />
                    <NavItem page="policies" label={t('policies.title')} icon={ShieldCheckIcon} permission="viewPolicies" featureId="policies" />
                    <NavItem page="bem-estar" label={t('sidebar.wellbeing')} icon={HeartIcon} permission="viewWellbeing" featureId="wellness" />
                </NavMenu>

                <NavMenu label={t('sidebar.ti_suporte')} icon={LifebuoyIcon} menuKey="ti" permission={hasTiAccess}>
                    <NavItem page="ti-dashboard" label={t('sidebar.ti_dashboard')} icon={Cog6ToothIcon} permission="viewTiDashboard" featureId="tickets" />
                    <NavItem page="tickets" label={t('sidebar.my_tickets')} icon={TicketIcon} permission="openTickets" featureId="tickets" />
                    <NavItem page="ti-requests" label={t('sidebar.request_equipment')} icon={PlusIcon} permission="openTiRequests" featureId="equip" />
                    <NavItem page="knowledge-base" label={t('kb.title')} icon={QuestionMarkCircleIcon} permission="viewKnowledgeBase" featureId="kb" />
                    <NavItem page="service-status" label={t('status.title')} icon={ArrowPathIcon} permission="viewServiceStatus" />
                    <NavItem page="infosec" label={t('sidebar.infosec')} icon={ShieldCheckIcon} permission="viewInfoSec" featureId="infosec" />
                </NavMenu>
                <NavItem page="documentos" label="Biblioteca Corporativa" icon={FolderIcon} permission="viewDocuments" />


                {/* SaaS Super Admin Button */}
                {realProfile?.role === 'Super Admin' && !isGhostMode && (
                    <>
                        <NavItem page="support-inbox" label={t('sidebar.support_master')} icon={LifebuoyIcon} permission={true} />
                        <button
                            type="button"
                            onClick={() => onNavigate('saas-dashboard')}
                            className={`mt-2 flex w-full items-center rounded-xl border px-3 py-2.5 transition-colors ${currentPage === 'saas-dashboard' ? 'border-violet-400/40 bg-violet-500 text-white' : 'border-violet-400/25 bg-violet-400/5 text-violet-200 hover:bg-violet-400/10 hover:text-white'} ${isOpen ? '' : 'justify-center'}`}
                            aria-current={currentPage === 'saas-dashboard' ? 'page' : undefined}
                            title="Painel SaaS"
                        >
                            <BuildingOfficeIcon className="w-6 h-6 flex-shrink-0" />
                            {isOpen && <span className="ml-4 truncate font-semibold">{t('sidebar.saas_panel')}</span>}
                        </button>
                    </>
                )}

            </nav>
            {/* Company Logo Footer */}
            <div className={`mt-auto border-t border-white/10 bg-white/[0.03] p-3 text-center
                ${isOpen ? 'block' : 'hidden md:block md:opacity-0 md:hover:opacity-100 transition-opacity'}`}>
                {companyLogo && (
                    <img src={companyLogo} alt={companyName} className="h-8 md:h-10 mx-auto object-contain" />
                )}
                <p className="mt-2 truncate text-xs font-semibold text-slate-200">{companyName}</p>
            </div>
        </aside>
    );
};
export default Sidebar;
