import React, { useState } from 'react';
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
    PlayIcon
} from './icons';
import type { Page, Employee, EmployeePermissions } from '../types';
import { useLanguage } from './LanguageContext';

interface SidebarProps {
    isOpen: boolean;
    onNavigate: (page: Page) => void;
    currentPage: Page;
    currentUser: Employee;
    companyName: string;
    companyLogo?: string;
    isImpersonating: boolean;
    customFeatures?: Record<string, boolean>;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onNavigate, currentPage, currentUser, companyName, companyLogo, isImpersonating, customFeatures }) => {
    const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({ rh: false, ti: false, portal: false });

    const toggleMenu = (menu: 'rh' | 'ti' | 'portal') => {
        setOpenMenus(prev => ({ ...prev, [menu]: !prev[menu] }));
    };

    const NavItem: React.FC<{ page: Page; label: string; icon: React.FC<any>; permission: keyof EmployeePermissions | true; featureId?: string }> = ({ page, label, icon: Icon, permission, featureId }) => {
        const isAdmin = currentUser.isAdmin || currentUser.isCompanyAdmin || currentUser.role === 'Super Admin';
        const hasPermission = permission === true || (currentUser.permissions && (currentUser.permissions as any)[permission] === true);

        if (!isAdmin && !hasPermission) {
            return null;
        }
        // Check if feature is disabled by company custom_features
        if (featureId && customFeatures && customFeatures[featureId] === false) {
            return null;
        }
        return (
            <button type="button" onClick={() => onNavigate(page)} className={`w-full flex items-center p-2.5 rounded-lg transition-all duration-200 group ${currentPage === page ? 'bg-slate-100/80 text-brand-text font-semibold relative' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-gray-400 dark:hover:bg-slate-800/50 dark:hover:text-gray-200 font-medium'} ${isOpen ? '' : 'justify-center'}`} title={label}>
                {/* Subtle active indicator line */}
                {currentPage === page && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-brand-primary rounded-r-full" />
                )}
                <Icon className={`w-[22px] h-[22px] flex-shrink-0 transition-colors ${currentPage === page ? 'text-brand-primary' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-gray-300'}`} />
                {isOpen && <span className="ml-3.5 text-[15px] tracking-tight truncate">{label}</span>}
            </button>
        );
    };

    const NavMenu: React.FC<{ label: string; icon: React.FC<any>; menuKey: 'rh' | 'ti' | 'portal'; children: React.ReactNode, permission: boolean }> = ({ label, icon: Icon, menuKey, children, permission }) => {
        const isAdmin = currentUser.isAdmin || currentUser.isCompanyAdmin || currentUser.role === 'Super Admin';
        if (!permission && !isAdmin) return null;

        const isActive = React.Children.toArray(children).some(child =>
            React.isValidElement(child) && (child.props as any).page === currentPage
        );

        return (
            <div>
                <button onClick={() => toggleMenu(menuKey)} className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all duration-200 group ${isActive ? 'bg-slate-50 text-brand-text font-semibold' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-gray-400 dark:hover:bg-slate-800/50 dark:hover:text-gray-200 font-medium'}`}>
                    <div className="flex items-center">
                        <Icon className={`w-[22px] h-[22px] flex-shrink-0 transition-colors ${isActive ? 'text-brand-primary' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-gray-300'}`} />
                        {isOpen && <span className="ml-3.5 text-[15px] tracking-tight truncate">{label}</span>}
                    </div>
                    {isOpen && <ChevronDownIcon className={`w-[18px] h-[18px] transition-transform text-slate-400 ${openMenus[menuKey] ? 'rotate-180' : ''}`} />}
                </button>
                {openMenus[menuKey] && isOpen && (
                    <div className="pl-6 pt-1 space-y-0.5 border-l border-slate-100 ml-[1.1rem] mt-1 mb-2 dark:border-slate-800">
                        {children}
                    </div>
                )}
            </div>
        );
    };

    const rhPermissionKeys: (keyof EmployeePermissions)[] = ['viewDirectory', 'viewForms', 'viewBenefits', 'viewOnboarding', 'viewRecognition', 'viewDocuments', 'viewTraining', 'viewSurveys', 'viewPolicies'];
    const hasRhAccess = rhPermissionKeys.some(key => !!currentUser.permissions[key]);

    const tiPermissionKeys: (keyof EmployeePermissions)[] = ['viewTiDashboard', 'openTickets', 'openTiRequests', 'viewKnowledgeBase', 'viewServiceStatus', 'viewInfoSec'];
    const hasTiAccess = tiPermissionKeys.some(key => !!currentUser.permissions[key]);
    const { t } = useLanguage();

    return (
        <aside className={`transition-all duration-300 flex-shrink-0 flex flex-col bg-white border-r border-slate-200 dark:bg-slate-900 dark:border-slate-800
            fixed md:relative z-[60] h-full
            ${isOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full md:w-[72px] md:translate-x-0'}
        `}>
            {/* Elegant Header Area */}
            <div className="h-[73px] flex items-center justify-center bg-white border-b border-slate-100 dark:bg-slate-900 dark:border-slate-800 shrink-0">
                <Logo showText={isOpen} className={isOpen ? 'h-10 mx-auto' : 'h-8 mx-auto ml-1'} />
            </div>
            <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto custom-scrollbar">
                <NavItem page="home" label={t('sidebar.home')} icon={HomeIcon} permission={true} />
                <NavItem page="whatspanda" label={t('sidebar.whatspanda')} icon={ChatBubbleLeftRightIcon} permission="viewWhatsPanda" featureId="whatspanda" />
                <NavItem page="messages" label={t('sidebar.messages')} icon={ChatBubbleLeftRightIcon} permission="viewMessages" featureId="messages" />
                <NavItem page="email" label={t('sidebar.pandamail')} icon={EnvelopeIcon} permission="viewEmail" />
                <NavItem page="feed" label={t('sidebar.feed')} icon={NewspaperIcon} permission={true} featureId="feed" />
                <NavItem page="calendar" label={t('sidebar.calendar')} icon={CalendarDaysIcon} permission="viewCalendar" featureId="calendar" />
                <NavItem page="marketplace" label={t('sidebar.marketplace')} icon={BuildingStorefrontIcon} permission="useMarketplace" featureId="marketplace" />
                <NavItem page="events" label={t('sidebar.events')} icon={CalendarDaysIcon} permission={true} featureId="events" />

                <hr className="my-3 mx-1 border-slate-100 dark:border-slate-800/50" />

                <NavItem page="recognition" label={t('sidebar.recognition')} icon={StarIcon} permission="viewRecognition" featureId="wall" />
                <NavItem page="bem-estar" label={t('sidebar.wellbeing')} icon={HeartIcon} permission="viewWellbeing" featureId="wellness" />
                <NavItem page="kpi-dashboard" label={t('sidebar.metrics')} icon={ShieldCheckIcon} permission="viewKPIDashboard" featureId="kpis" />

                <NavMenu label={t('sidebar.rh_gestao')} icon={UserGroupIcon} menuKey="rh" permission={hasRhAccess}>
                    <NavItem page="directory" label={t('users.title')} icon={UsersIcon} permission="viewDirectory" featureId="org-chart" />
                    <NavItem page="org-chart" label={t('sidebar.org_chart')} icon={ArrowPathIcon} permission="viewOrgChart" featureId="org-chart" />
                    <NavItem page="meu-rh" label={t('sidebar.meu_rh')} icon={BuildingOfficeIcon} permission="viewMeuRH" featureId="meu-rh" />
                    <NavItem page="jobs" label={t('sidebar.jobs')} icon={RocketLaunchIcon} permission="viewJobs" featureId="jobs" />
                    <NavItem page="training" label={t('sidebar.training')} icon={RocketLaunchIcon} permission="viewTraining" featureId="training" />
                    <NavItem page="surveys" label={t('sidebar.surveys_internal')} icon={ChatBubbleLeftRightIcon} permission="viewSurveys" featureId="surveys" />
                    <NavItem page="forms" label={t('sidebar.forms')} icon={DocumentTextIcon} permission="viewForms" />
                    <NavItem page="benefits" label={t('sidebar.benefits')} icon={HeartIcon} permission="viewBenefits" featureId="benefits" />
                    <NavItem page="onboarding" label={t('sidebar.onboarding')} icon={RocketLaunchIcon} permission="viewOnboarding" />
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
                    <button
                        type="button"
                        onClick={() => onNavigate('saas-dashboard')}
                        className={`w-full flex items-center p-2.5 rounded-lg transition-all duration-200 ${currentPage === 'saas-dashboard' ? 'bg-indigo-50/50 text-indigo-700 font-semibold' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 dark:hover:bg-gray-800/50 font-medium'
                            } ${isOpen ? '' : 'justify-center'} mt-3 border border-dashed border-indigo-200 dark:border-indigo-900/50 group`}
                        title="Painel SaaS"
                    >
                        <BuildingOfficeIcon className={`w-[22px] h-[22px] flex-shrink-0 ${currentPage === 'saas-dashboard' ? 'text-indigo-600' : 'text-indigo-400 group-hover:text-indigo-500'}`} />
                        {isOpen && <span className="ml-3.5 text-[15px] tracking-tight truncate">Painel SaaS</span>}
                    </button>
                )}

                {(currentUser.isAdmin || currentUser.isCompanyAdmin) && (
                    <button
                        type="button"
                        onClick={() => onNavigate('admin')}
                        className={`w-full flex items-center p-2.5 rounded-lg transition-all duration-200 mt-1 group ${currentPage === 'admin' ? 'bg-slate-100/80 text-brand-text font-semibold relative' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white dark:hover:bg-slate-800/50 font-medium'
                            } ${isOpen ? '' : 'justify-center'}`}
                        title={t('sidebar.admin')}
                    >
                        {currentPage === 'admin' && (
                            <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-brand-primary rounded-r-full" />
                        )}
                        <ShieldCheckIcon className={`w-[22px] h-[22px] flex-shrink-0 transition-colors ${currentPage === 'admin' ? 'text-brand-primary' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-gray-300'}`} />
                        {isOpen && <span className="ml-3.5 text-[15px] tracking-tight truncate">{t('sidebar.admin')}</span>}
                    </button>
                )}
            </nav>
            {/* Company Logo Footer */}
            <div className={`shrink-0 p-4 border-t border-slate-100 text-center bg-white/50 backdrop-blur-sm dark:bg-slate-900/50 dark:border-slate-800 ${isOpen ? '' : 'hidden md:block md:opacity-0 md:hover:opacity-100 transition-opacity'}`}>
                {companyLogo && (
                    <img src={companyLogo} alt={companyName} className="h-8 mx-auto object-contain drop-shadow-sm opacity-90" />
                )}
                <p className="text-xs font-semibold text-slate-500 truncate mt-2 tracking-tight">{companyName}</p>
            </div>
        </aside>
    );
};
export default Sidebar;