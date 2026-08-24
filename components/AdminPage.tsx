import React, { useState } from 'react';
// FIX: Correcting the import path for types.
import type { Company, Plan, KBArticle, ServiceStatusItem, SecurityAlert, TrainingModule, ResourceDocument } from '../types';
import Dashboard from './Dashboard';
// FIX: Correcting the import path for UserManager.
import UserManager from './UserManager';
import GeneralSettings from './GeneralSettings';
import FormSubmissionsManager from './FormSubmissionsManager';
import MarketplaceManager from './MarketplaceManager';
import PollManager from './PollManager';
import TeamManager from './TeamManager';
import EventsManager from './EventsManager';
import TrainingManager from './TrainingManager';
import { GenericManager } from './GenericManager';

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
        { id: 'teams', label: 'Equipes' },
        { id: 'forms', label: 'Formulários' },
        { id: 'marketplace', label: 'Marketplace' },
        { id: 'events', label: 'Eventos' },
        { id: 'training', label: 'Treinamentos' },
        { id: 'kb', label: 'Base de Con.' },
        { id: 'status', label: 'Status TI' },
        { id: 'infosec', label: 'Segurança' },
        { id: 'policies', label: 'Políticas' },
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
            case 'teams':
                return <TeamManager users={company.data.employees} setUsers={(u) => handleSetData('employees', u)} />;
            case 'forms':
                return <FormSubmissionsManager submissions={company.data.formSubmissions} setSubmissions={(s) => handleSetData('formSubmissions', s)} />;
            case 'marketplace':
                return <MarketplaceManager items={company.data.marketplaceItems} setItems={(i) => handleSetData('marketplaceItems', i)} />;
            case 'events':
                return <EventsManager events={company.data.events} setEvents={(e) => handleSetData('events', e)} employees={company.data.employees} />;
            case 'training':
                return <TrainingManager trainings={company.data.trainings} setTrainings={(t) => handleSetData('trainings', t)} />;
            case 'kb':
                return <GenericManager<KBArticle>
                    title="Base de Conhecimento"
                    items={company.data.kbArticles}
                    setItems={(i) => handleSetData('kbArticles', i)}
                    newItemTemplate={{ id: 0, title: '', category: 'Geral', content: '', views: 0 }}
                    fields={[{ key: 'title', label: 'Título' }, { key: 'category', label: 'Categoria' }, { key: 'content', label: 'Conteúdo' }]}
                    renderItem={(i) => <div><p className="font-bold">{i.title}</p><p className="text-sm">{i.category}</p></div>}
                />;
            case 'status':
                return <GenericManager<ServiceStatusItem>
                    title="Status de Serviços"
                    items={company.data.services}
                    setItems={(i) => handleSetData('services', i)}
                    newItemTemplate={{ id: 0, name: '', status: 'operational', uptime: '99%' }}
                    fields={[{ key: 'name', label: 'Serviço' }, { key: 'status', label: 'Status (operational/maintenance/outage)', type: 'select', options: ['operational', 'maintenance', 'outage'] }, { key: 'uptime', label: 'Uptime' }]}
                    renderItem={(i) => <div><p className="font-bold">{i.name}</p><p className={`text-sm ${i.status === 'operational' ? 'text-green-600' : 'text-red-600'}`}>{i.status}</p></div>}
                />;
            case 'infosec':
                return <GenericManager<SecurityAlert>
                    title="Alertas de Segurança"
                    items={company.data.securityAlerts}
                    setItems={(i) => handleSetData('securityAlerts', i)}
                    newItemTemplate={{ id: 0, title: '', description: '', level: 'info', date: new Date().toISOString().split('T')[0] }}
                    fields={[{ key: 'title', label: 'Título' }, { key: 'description', label: 'Descrição' }, { key: 'level', label: 'Nível (info/warning/critical)', type: 'select', options: ['info', 'warning', 'critical'] }, { key: 'date', label: 'Data' }]}
                    renderItem={(i) => <div><p className="font-bold">{i.title}</p><p className="text-sm">{i.description}</p></div>}
                />;
            case 'policies':
                // Filter to only show policy documents? Or just manage all documents? Let's use documents but maybe add filtering later. For now, simple document manager.
                // Actually PoliciesPage uses 'documents'. Let's reuse GenericManager but for documents.
                return <GenericManager<ResourceDocument>
                    title="Documentos e Políticas"
                    items={company.data.documents}
                    setItems={(i) => handleSetData('documents', i)}
                    newItemTemplate={{ id: 0, title: '', category: 'RH', type: 'PDF', url: '#', updatedAt: new Date().toISOString().split('T')[0] }}
                    fields={[{ key: 'title', label: 'Título' }, { key: 'category', label: 'Categoria' }, { key: 'type', label: 'Tipo' }, { key: 'url', label: 'URL' }]}
                    renderItem={(i) => <div><p className="font-bold">{i.title}</p><p className="text-sm">{i.category} - {i.type}</p></div>}
                />;
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
                            className={`${activeTab === tab.id
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