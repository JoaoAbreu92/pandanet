import React, { useState } from 'react';
// FIX: Correcting the import path for types.
import type { Company, Plan } from '../types';
import Dashboard from './Dashboard';
// FIX: Correcting the import path for UserManager.
import UserManager from './UserManager';
import GeneralSettings from './GeneralSettings';
import FormSubmissionsManager from './FormSubmissionsManager';
import MarketplaceManager from './MarketplaceManager';
import PollManager from './PollManager';

interface AdminPageProps {
    company: Company;
    setCompany: (company: Company) => void;
    plan: Plan;
}

const AdminPage: React.FC<AdminPageProps> = ({ company, setCompany, plan }) => {
    const [activeTab, setActiveTab] = useState('dashboard');

    const handleSetData = (key: keyof Company['data'], value: any) => {
        setCompany({
            ...company,
            data: {
                ...company.data,
                [key]: value,
            }
        });
    };

    const handleSetSettings = (settings: Company['settings']) => {
        setCompany({ ...company, settings });
    };

    const tabs = [
        { id: 'dashboard', label: 'Conteúdo' },
        { id: 'users', label: 'Usuários' },
        { id: 'forms', label: 'Formulários' },
        { id: 'marketplace', label: 'Marketplace' },
        { id: 'polls', label: 'Enquetes' },
        { id: 'settings', label: 'Geral' },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return <Dashboard 
                            banners={company.data.banners} 
                            setBanners={(b) => handleSetData('banners', b)}
                            announcements={company.data.announcements}
                            setAnnouncements={(a) => handleSetData('announcements', a)}
                        />;
            case 'users':
                return <UserManager users={company.data.employees} setUsers={(u) => handleSetData('employees', u)} plan={plan} />;
            case 'forms':
                return <FormSubmissionsManager submissions={company.data.formSubmissions} setSubmissions={(s) => handleSetData('formSubmissions', s)} />;
            case 'marketplace':
                return <MarketplaceManager items={company.data.marketplaceItems} setItems={(i) => handleSetData('marketplaceItems', i)} />;
            case 'polls':
                return <PollManager polls={company.data.polls} setPolls={(p) => handleSetData('polls', p)} />;
            case 'settings':
                return <GeneralSettings settings={company.settings} setSettings={handleSetSettings} />;
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-brand-text">Painel do Administrador</h1>

            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`${
                                activeTab === tab.id
                                    ? 'border-brand-primary text-brand-primary'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            <div>
                {renderContent()}
            </div>
        </div>
    );
};

export default AdminPage;