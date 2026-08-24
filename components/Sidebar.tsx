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
            <button type="button" onClick={() => onNavigate(page)} className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 ${currentPage === page ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-slate-700/50 dark:hover:text-white'} ${isOpen ? '' : 'justify-center'}`} title={label}>
                <Icon className="w-6 h-6 flex-shrink-0" />
                {isOpen && <span className="ml-4 truncate">{label}</span>}
            </button>
        );
    };

    const NavMenu: React.FC<{ label: string; icon: React.FC<any>; menuKey: 'rh' | 'ti' | 'portal'; children: React.ReactNode, permission: boolean }> = ({ label, icon: Icon, menuKey, children, permission }) => {
        const isAdmin = currentUser.isAdmin || currentUser.isCompanyAdmin || currentUser.role === 'Super Admin';
        if (!permission && !isAdmin) return null;

        const isActive = React.Children.toArray(children).some(child =>
            React.isValidElement(child) && child.props.page === currentPage
        );

        return (
            <div>
                <button onClick={() => toggleMenu(menuKey)} className={`w-full flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${isActive ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-slate-700/50 dark:hover:text-white'}`}>
                    <div className="flex items-center">
                        <Icon className="w-6 h-6 flex-shrink-0" />
                        {isOpen && <span className="ml-4 truncate font-semibold">{label}</span>}
                    </div>
                    {isOpen && <ChevronDownIcon className={`w-5 h-5 transition-transform ${openMenus[menuKey] ? 'rotate-180' : ''}`} />}
                </button>
                {openMenus[menuKey] && isOpen && (
                    <div className="pl-8 pt-2 space-y-1">
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
        <aside className={`transition-all duration-300 flex-shrink-0 flex flex-col shadow-xl bg-white border-r border-gray-200 dark:bg-slate-900 dark:border-slate-800 premium-card
            fixed md:relative z-50 h-full
            ${isOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full md:w-20 md:translate-x-0'}
        `}>
            <div className="p-6 flex items-center justify-center bg-white border-b border-gray-100">
                {isOpen ? (
                    <img src="/logo-full.png" alt="Logo" className="h-10 object-contain" />
                ) : (
                    <img src="/logo-icon.png" alt="Logo" className="w-10 h-10 object-contain" />
                )}
            </div>
            <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto no-scrollbar">
                <NavItem page="home" label={t('sidebar.home')} icon={HomeIcon} permission={true} />
                <NavItem page="whatspanda" label={t('sidebar.whatspanda')} icon={ChatBubbleLeftRightIcon} permission="viewWhatsPanda" featureId="whatspanda" />
                <NavItem page="messages" label={t('sidebar.messages')} icon={ChatBubbleLeftRightIcon} permission="viewMessages" featureId="messages" />
                <NavItem page="email" label={t('sidebar.pandamail')} icon={EnvelopeIcon} permission="viewEmail" />
                <NavItem page="feed" label={t('sidebar.feed')} icon={NewspaperIcon} permission={true} featureId="feed" />
                <NavItem page="calendar" label={t('sidebar.calendar')} icon={CalendarDaysIcon} permission="viewCalendar" featureId="calendar" />
                <NavItem page="marketplace" label={t('sidebar.marketplace')} icon={BuildingStorefrontIcon} permission="useMarketplace" featureId="marketplace" />
                <NavItem page="events" label={t('sidebar.events')} icon={CalendarDaysIcon} permission={true} featureId="events" />

                <hr className="my-2 border-gray-100 dark:border-slate-800" />

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
                        className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 ${currentPage === 'saas-dashboard' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-gray-600 hover:bg-purple-50 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 dark:hover:bg-gray-700'
                            } ${isOpen ? '' : 'justify-center'} mt-2 border-2 border-dashed border-purple-200 dark:border-gray-700`}
                        title="Painel SaaS"
                    >
                        <BuildingOfficeIcon className="w-6 h-6 flex-shrink-0" />
                        {isOpen && <span className="ml-4 truncate font-bold">{t('sidebar.saas_panel')}</span>}
                    </button>
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
            <div className={`mt-auto p-4 border-t border-gray-100 text-center bg-white ${isOpen ? '' : 'hidden md:block md:opacity-0 md:hover:opacity-100 transition-opacity'}`}>
                {companyLogo && (
                    <img src={companyLogo} alt={companyName} className="h-10 mx-auto object-contain" />
                )}
                <p className="text-sm font-bold text-gray-800 truncate mt-2">{companyName}</p>
            </div>
        </aside>
    );
};
export default Sidebar;