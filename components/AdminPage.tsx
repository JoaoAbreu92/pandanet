import React, { useState, useEffect } from 'react';
import type { Company, Plan, KBArticle, ServiceStatusItem, SecurityAlert, TrainingModule, ResourceDocument, WellnessItem, Employee, Recognition } from '../types';
import Dashboard from './Dashboard';
import UserManager from './UserManager';
import { DepartmentManager } from './DepartmentManager';
import TeamManager from './TeamManager';
import FormSubmissionsManager from './FormSubmissionsManager';
import MarketplaceManager from './MarketplaceManager';
import EventsManager from './EventsManager';
import { SupabaseGenericManager } from './SupabaseGenericManager';
import GeneralSettings from './GeneralSettings';
import PollManager from './PollManager';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import type { Department } from '../types';

interface AdminPageProps {
    company: Company;
    setCompany: (company: Company) => void;
    plan: Plan;
    customFeatures?: Record<string, boolean>;
}

const AdminPage: React.FC<AdminPageProps> = ({ company, setCompany, plan, customFeatures }) => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);

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

        const fetchDepartments = async () => {
            if (!company?.id) return;
            const { data } = await supabase.from('departments').select('*').eq('company_id', company.id);
            if (data) setDepartments(data);
        };

        fetchEmployees();
        fetchDepartments();
    }, [company?.id]);

    const handleSetData = async (key: keyof Company['data'], value: any) => {
        // List of keys that now have dedicated tables
        const dedicatedTables: string[] = ['events', 'banners', 'marketplaceItems', 'announcements', 'tiRequests', 'recognitions', 'wellnessItems', 'kbArticles'];

        if (dedicatedTables.includes(key)) {
            // If it's a dedicated table, we don't update company.data via JSONB anymore
            // The managers themselves now handle their own persistence.
            // We just update the local state to keep UI snappy if needed, 
            // but the source of truth is the dedicated table.
            console.log(`Key ${key} matches a dedicated table. Persistence is handled by the manager.`);
            return;
        }

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
        { id: 'departments', label: 'Departamentos' },
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
        { id: 'mural', label: 'Mural' },
    ].filter(tab => {
        if (!tab.featureId) return true;
        if (!customFeatures) return true;
        return customFeatures[tab.featureId] !== false;
    });

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return <Dashboard />;
            case 'users':
                return <UserManager users={employees} setUsers={setEmployees} plan={plan} departments={departments} />;
            case 'departments':
                return <DepartmentManager companyId={company.id!} />;
            case 'teams':
                return <TeamManager users={employees} setUsers={setEmployees} />;
            case 'forms':
                return <FormSubmissionsManager />;
            case 'marketplace':
                // MarketplaceManager should also be refactored eventually, but leaving as is for now if it works.
                return <MarketplaceManager />;
            case 'events':
                return <EventsManager employees={employees} />;
            case 'training':
                return <SupabaseGenericManager<TrainingModule>
                    title="Módulos de Treinamento"
                    tableName="training_modules"
                    newItemTemplate={{ title: '', duration: '', category: '', thumbnail: '', participants: [] }}
                    users={employees}
                    fields={[
                        { key: 'title', label: 'Título' },
                        { key: 'duration', label: 'Duração' },
                        { key: 'category', label: 'Categoria' },
                        { key: 'thumbnail', label: 'Capa (Imagem)', type: 'file' },
                        { key: 'participants', label: 'Participantes / Convocados', type: 'user_list' }
                    ]}
                    renderItem={(i) => <div><p className="font-bold">{i.title}</p><p className="text-sm">{i.category} - {i.duration} • {(i as any).participants?.length || 0} inscritos</p></div>}
                />;
            case 'kb':
                return <SupabaseGenericManager<KBArticle>
                    title="Base de Conhecimento"
                    tableName="kb_articles"
                    newItemTemplate={{ title: '', category: 'Geral', content: '', mediaUrl: '', mediaType: 'image' }}
                    fields={[
                        { key: 'title', label: 'Título' },
                        { key: 'category', label: 'Categoria' },
                        { key: 'content', label: 'Conteúdo', type: 'textarea' },
                        { key: 'mediaUrl', label: 'Mídia (Imagem/Vídeo)', type: 'file', dbColumn: 'media_url' },
                        { key: 'mediaType', label: 'Tipo de Mídia', type: 'select', options: ['image', 'video'], dbColumn: 'media_type' }
                    ]}
                    renderItem={(i) => <div><p className="font-bold">{i.title}</p><p className="text-sm">{i.category}</p></div>}
                />;
            case 'status':
                // Check if services table exists, otherwise fallback or skip
                return <SupabaseGenericManager<ServiceStatusItem>
                    title="Status de Serviços"
                    tableName="services"
                    newItemTemplate={{ name: '', status: 'operational', uptime: '99%', imageUrl: '' }}
                    fields={[
                        { key: 'name', label: 'Serviço' },
                        { key: 'status', label: 'Status', type: 'select', options: ['operational', 'maintenance', 'outage'] },
                        { key: 'uptime', label: 'Uptime' },
                        { key: 'imageUrl', label: 'Ícone', type: 'file', dbColumn: 'image_url' }
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
                return <SupabaseGenericManager<SecurityAlert>
                    title="Alertas de Segurança"
                    tableName="security_alerts"
                    newItemTemplate={{ title: '', description: '', level: 'info', date: new Date().toISOString().split('T')[0] }}
                    fields={[
                        { key: 'title', label: 'Título' },
                        { key: 'description', label: 'Descrição', type: 'textarea' },
                        { key: 'level', label: 'Nível', type: 'select', options: ['info', 'warning', 'critical'] },
                        { key: 'date', label: 'Data' }
                    ]}
                    renderItem={(i) => <div><p className="font-bold">{i.title}</p><p className="text-sm">{i.description}</p></div>}
                />;
            case 'policies':
                return <SupabaseGenericManager<ResourceDocument>
                    title="Documentos e Políticas"
                    tableName="policies"
                    newItemTemplate={{ title: '', category: 'RH', type: 'PDF', url: '' }}
                    fields={[
                        { key: 'title', label: 'Título' },
                        { key: 'category', label: 'Categoria' },
                        { key: 'type', label: 'Tipo de Arquivo', type: 'select', options: ['PDF', 'DOC', 'XLS', 'IMG'] },
                        { key: 'url', label: 'Arquivo (Upload)', type: 'file' }
                    ]}
                    renderItem={(i) => <div><p className="font-bold">{i.title}</p><p className="text-sm">{i.category} - {i.type}</p></div>}
                />;
            case 'polls':
                return <PollManager />;
            case 'bem-estar':
                return <SupabaseGenericManager<WellnessItem>
                    title="Itens de Bem-Estar"
                    tableName="wellness_items"
                    newItemTemplate={{ title: '', description: '', category: 'Saúde Mental', videoUrl: '', linkUrl: '', linkText: 'Saiba mais' }}
                    fields={[
                        { key: 'title', label: 'Título' },
                        { key: 'description', label: 'Descrição', type: 'textarea' },
                        { key: 'category', label: 'Categoria', type: 'select', options: ['Saúde Mental', 'Atividade Física', 'Nutrição', 'Outro'] },
                        { key: 'videoUrl', label: 'Vídeo (URL)', type: 'text', dbColumn: 'video_url' },
                        { key: 'linkUrl', label: 'Link (URL)', type: 'text', dbColumn: 'link_url' },
                        { key: 'linkText', label: 'Texto do Link', type: 'text', dbColumn: 'link_text' }
                    ]}
                    renderItem={(i) => <div><p className="font-bold">{i.title}</p><p className="text-sm">{i.category}</p></div>}
                />;
            case 'settings':
                return <GeneralSettings settings={company.settings} setSettings={handleSetSettings} />;
            case 'mural':
                return <SupabaseGenericManager<Recognition>
                    title="Mural de Reconhecimentos"
                    tableName="recognitions"
                    newItemTemplate={{ message: '', type: 'Trabalho em Equipe', value: 'Trabalho em Equipe', from_id: '', to_id: '' } as any}
                    fields={[
                        { key: 'message', label: 'Mensagem', type: 'textarea' },
                        { key: 'to_id', label: 'Para (ID do Usuário)', type: 'user_list', dbColumn: 'to_id' },
                        { key: 'from_id', label: 'De (ID do Usuário)', type: 'user_list', dbColumn: 'from_id' },
                        { key: 'type', label: 'Valor', type: 'select', options: ['Trabalho em Equipe', 'Inovação', 'Foco no Cliente', 'Qualidade'] }
                    ]}
                    renderItem={(i) => <div><p className="font-bold">{(i as any).message}</p><p className="text-sm">{(i as any).type}</p></div>}
                />;
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