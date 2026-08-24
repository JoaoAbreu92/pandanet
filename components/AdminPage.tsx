import React, { useState, useEffect } from 'react';
import type { Company, Plan, KBArticle, ServiceStatusItem, SecurityAlert, TrainingModule, ResourceDocument, WellnessItem, Employee } from '../types';
import Dashboard from './Dashboard';
import UserManager from './UserManager';
import GeneralSettings from './GeneralSettings';
import FormSubmissionsManager from './FormSubmissionsManager';
import MarketplaceManager from './MarketplaceManager';
import PollManager from './PollManager';
import TeamManager from './TeamManager';
import EventsManager from './EventsManager';
import TrainingManager from './TrainingManager';
import { GenericManager } from './GenericManager';
import { supabase } from '../supabaseClient';

interface AdminPageProps {
    company: Company;
    setCompany: (company: Company) => void;
    plan: Plan;
    customFeatures?: Record<string, boolean>;
}

const AdminPage: React.FC<AdminPageProps> = ({ company, setCompany, plan, customFeatures }) => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [employees, setEmployees] = useState<Employee[]>([]);

    useEffect(() => {
        const fetchEmployees = async () => {
            if (!company?.id) return;
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('company_id', company.id);

            if (data) {
                const mappedEmployees: Employee[] = data.map(p => ({
                    id: p.id,
                    name: p.full_name,
                    email: p.email || '',
                    role: p.role,
                    team: p.team,
                    avatarUrl: p.avatar_url || `https://i.pravatar.cc/150?u=${p.email}`,
                    joinDate: p.join_date,
                    birthDate: p.birth_date,
                    isAdmin: p.is_admin,
                    isOnline: false,
                    permissions: p.permissions || {},
                    company_id: p.company_id,
                    following: p.following || [],
                    phone: p.phone,
                    officeLocation: p.office_location,
                    bio: p.bio,
                    sectorManager: p.sector_manager,
                    employeeManager: p.employee_manager,
                    coverUrl: p.cover_url
                }));
                setEmployees(mappedEmployees);
            }
        };

        fetchEmployees();
    }, [company?.id]);

    const handleSetData = async (key: keyof Company['data'], value: any) => {
        const newData = {
            ...company.data,
            [key]: value,
        };

        setCompany({ ...company, data: newData });

        const { error } = await supabase
            .from('companies')
            .update({ data: newData })
            .eq('id', company.id);

        if (error) {
            console.error('Error updating company data:', error);
        }
    };

    const handleSetSettings = async (settings: Company['settings']) => {
        setCompany({ ...company, settings });

        const { error } = await supabase
            .from('companies')
            .update({ settings })
            .eq('id', company.id);

        if (error) {
            console.error('Error updating company settings:', error);
        }
    };

    const tabs = [
        { id: 'dashboard', label: 'Conteúdo', featureId: 'feed' },
        { id: 'users', label: 'Usuários' },
        { id: 'teams', label: 'Equipes' },
        { id: 'forms', label: 'Formulários' },
        { id: 'marketplace', label: 'Marketplace', featureId: 'marketplace' },
        { id: 'events', label: 'Eventos', featureId: 'events' },
        { id: 'training', label: 'Treinamentos' },
        { id: 'kb', label: 'Base de Con.', featureId: 'kb' },
        { id: 'status', label: 'Status TI' },
        { id: 'infosec', label: 'Segurança' },
        { id: 'policies', label: 'Políticas', featureId: 'policies' },
        { id: 'polls', label: 'Enquetes' },
        { id: 'bem-estar', label: 'Bem Estar', featureId: 'wellness' },
        { id: 'settings', label: 'Geral' },
    ].filter(tab => {
        if (!tab.featureId) return true;
        if (!customFeatures) return true;
        return customFeatures[tab.featureId] !== false;
    });

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return <Dashboard
                    banners={company.data?.banners || []}
                    setBanners={(b) => handleSetData('banners', b)}
                />;
            case 'users':
                return <UserManager users={employees} setUsers={setEmployees} plan={plan} />;
            case 'teams':
                return <TeamManager users={employees} setUsers={setEmployees} />;
            case 'forms':
                return <FormSubmissionsManager submissions={company.data?.formSubmissions || []} setSubmissions={(s) => handleSetData('formSubmissions', s)} />;
            case 'marketplace':
                return <MarketplaceManager items={company.data?.marketplaceItems || []} setItems={(i) => handleSetData('marketplaceItems', i)} />;
            case 'events':
                return <EventsManager events={company.data?.events || []} setEvents={(e) => handleSetData('events', e)} employees={employees} />;
            case 'training':
                return <TrainingManager trainings={company.data?.trainings || []} setTrainings={(t) => handleSetData('trainings', t)} />;
            case 'kb':
                return <GenericManager<KBArticle>
                    title="Base de Conhecimento"
                    items={company.data?.kbArticles || []}
                    setItems={(i) => handleSetData('kbArticles', i)}
                    newItemTemplate={{ id: '', title: '', category: 'Geral', content: '', views: 0, mediaUrl: '', mediaType: 'image' }}
                    fields={[
                        { key: 'title', label: 'Título' },
                        { key: 'category', label: 'Categoria' },
                        { key: 'content', label: 'Conteúdo', type: 'textarea' },
                        { key: 'mediaUrl', label: 'URL da Mídia (Imagem/Vídeo)', type: 'text' },
                        { key: 'mediaType', label: 'Tipo de Mídia', type: 'select', options: ['image', 'video'] }
                    ]}
                    renderItem={(i) => <div><p className="font-bold">{i.title}</p><p className="text-sm">{i.category}</p></div>}
                />;
            case 'status':
                return <GenericManager<ServiceStatusItem>
                    title="Status de Serviços"
                    items={company.data?.services || []}
                    setItems={(i) => handleSetData('services', i)}
                    newItemTemplate={{ id: '', name: '', status: 'operational', uptime: '99%', imageUrl: '' }}
                    fields={[
                        { key: 'name', label: 'Serviço' },
                        { key: 'status', label: 'Status', type: 'select', options: ['operational', 'maintenance', 'outage'] },
                        { key: 'uptime', label: 'Uptime' },
                        { key: 'imageUrl', label: 'URL do Ícone/Imagem', type: 'text' }
                    ]}
                    renderItem={(i) => (
                        <div className="flex items-center">
                            {i.imageUrl && <img src={i.imageUrl} alt="" className="w-8 h-8 rounded-full mr-2 object-cover" />}
                            <div>
                                <p className="font-bold">{i.name}</p>
                                <p className={`text-sm ${i.status === 'operational' ? 'text-green-600' : 'text-red-600'}`}>{i.status}</p>
                            </div>
                        </div>
                    )}
                />;
            case 'infosec':
                return <GenericManager<SecurityAlert>
                    title="Alertas de Segurança"
                    items={company.data?.securityAlerts || []}
                    setItems={(i) => handleSetData('securityAlerts', i)}
                    newItemTemplate={{ id: '', title: '', description: '', level: 'info', date: new Date().toISOString().split('T')[0] }}
                    fields={[{ key: 'title', label: 'Título' }, { key: 'description', label: 'Descrição', type: 'textarea' }, { key: 'level', label: 'Nível', type: 'select', options: ['info', 'warning', 'critical'] }, { key: 'date', label: 'Data' }]}
                    renderItem={(i) => <div><p className="font-bold">{i.title}</p><p className="text-sm">{i.description}</p></div>}
                />;
            case 'policies':
                return <GenericManager<ResourceDocument>
                    title="Documentos e Políticas"
                    items={company.data?.documents || []}
                    setItems={(i) => handleSetData('documents', i)}
                    newItemTemplate={{ id: '', title: '', category: 'RH', type: 'PDF', url: '#', updatedAt: new Date().toISOString().split('T')[0] }}
                    fields={[
                        { key: 'title', label: 'Título' },
                        { key: 'category', label: 'Categoria' },
                        // Type is auto-detected, removed from manual fields
                        { key: 'url', label: 'Arquivo (Anexo)', type: 'file' }
                    ]}
                    renderItem={(i) => <div><p className="font-bold">{i.title}</p><p className="text-sm">{i.category} - {i.type}</p></div>}
                />;
            case 'polls':
                return <PollManager polls={company.data?.polls || []} setPolls={(p) => handleSetData('polls', p)} />;
            case 'bem-estar':
                return <GenericManager<WellnessItem>
                    title="Itens de Bem-Estar"
                    items={company.data?.wellnessItems || []}
                    setItems={(i) => handleSetData('wellnessItems', i)}
                    newItemTemplate={{ id: '', title: '', description: '', category: 'Saúde Mental', videoUrl: '', linkUrl: '', linkText: 'Saiba mais' }}
                    fields={[
                        { key: 'title', label: 'Título' },
                        { key: 'description', label: 'Descrição', type: 'textarea' },
                        { key: 'category', label: 'Categoria', type: 'select', options: ['Saúde Mental', 'Atividade Física', 'Nutrição', 'Outro'] },
                        { key: 'videoUrl', label: 'URL do Vídeo (Embed)', type: 'text' },
                        { key: 'linkUrl', label: 'Link Externo', type: 'text' },
                        { key: 'linkText', label: 'Texto do Link', type: 'text' }
                    ]}
                    renderItem={(i) => <div><p className="font-bold">{i.title}</p><p className="text-sm">{i.category}</p></div>}
                />;
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