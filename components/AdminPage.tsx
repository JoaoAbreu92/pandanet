import React, { useState, useEffect } from 'react';
import type { Company, Plan, KBArticle, ServiceStatusItem, SecurityAlert, TrainingModule, ResourceDocument, WellnessItem, Employee, Recognition, TIRequest } from '../types';
import Dashboard from './Dashboard';
import UserManager from './UserManager';
import { DepartmentManager } from './DepartmentManager';
import TeamManager from './TeamManager';
import FormSubmissionsManager from './FormSubmissionsManager';
import MarketplaceManager from './MarketplaceManager';
import EventsManager from './EventsManager';
import { SupabaseGenericManager } from './SupabaseGenericManager';
import HRManager from './HRManager';
import GeneralSettings from './GeneralSettings';
import PollManager from './PollManager';
import { OrgFlowEditor } from './OrgFlowEditor';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import type { Department } from '../types';
import BadgesManager from './BadgesManager';

interface AdminPageProps {
    company: Company;
    setCompany: (company: Company) => void;
    plan: Plan;
    customFeatures?: Record<string, boolean>;
    onNavigate?: (page: any) => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ company, setCompany, plan, customFeatures, onNavigate }) => {
    const { profile } = useAuth();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [activeCategory, setActiveCategory] = useState('Social');
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
                    avatarUrl: p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.full_name || 'User')}&background=E2E8F0&color=475569`,
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
                    reports_to: p.reports_to,
                    sector_manager_id: p.sector_manager_id,
                    coverUrl: p.cover_url,
                    email_permissions: p.email_permissions,
                    whatspanda_permissions: p.whatspanda_permissions,
                    can_nudge: p.can_nudge,
                    nudge_cooldown: p.nudge_cooldown,
                    is_whatsapp_agent: p.is_whatsapp_agent,
                    is_manager: p.is_manager,
                    department_id: p.department_id
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
        const dedicatedTables: string[] = ['events', 'banners', 'marketplaceItems', 'announcements', 'tiRequests', 'recognitions', 'wellnessItems', 'kbArticles'];

        if (dedicatedTables.includes(key)) {
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
        console.log("[AdminPage] ========== SALVANDO SETTINGS DA EMPRESA ==========");
        console.log("[AdminPage] Company ID:", company.id);
        console.log("[AdminPage] Novos settings:", settings);
        
        setCompany({ ...company, settings });

        console.log("[AdminPage] Atualizando no Supabase...");
        const { data, error } = await supabase
            .from('companies')
            .update({ settings })
            .eq('id', company.id)
            .select();

        if (error) {
            console.error('[AdminPage] ❌ Erro ao atualizar company settings:', error);
        } else {
            console.log('[AdminPage] ✅ Settings salvos com sucesso:', data);
        }
        console.log("[AdminPage] ========== SALVAMENTO CONCLUÍDO ==========");
    };

    const allTabs = [
        { id: 'dashboard', label: 'Feed/Mural', category: 'Social', featureId: 'feed' },
        { id: 'mural', label: 'Reconhecimentos', category: 'Social' },
        { id: 'polls', label: 'Enquetes', category: 'Social' },
        { id: 'events', label: 'Eventos', category: 'Social', featureId: 'events' },
        { id: 'marketplace', label: 'Marketplace', category: 'Social', featureId: 'marketplace' },
        { id: 'bem-estar', label: 'Bem Estar', category: 'Social', featureId: 'wellness' },

        { id: 'users', label: 'Usuários', category: 'Recursos Humanos (RH)' },
        { id: 'badges', label: 'Selos / Gamificação', category: 'Recursos Humanos (RH)' },
        { id: 'departments', label: 'Departamentos', category: 'Recursos Humanos (RH)' },
        { id: 'teams', label: 'Equipes', category: 'Recursos Humanos (RH)' },
        { id: 'org-flow', label: 'Organograma (Fluxo)', category: 'Recursos Humanos (RH)' },
        { id: 'training', label: 'Treinamentos', category: 'Recursos Humanos (RH)' },
        { id: 'jobs', label: 'Gestão de Vagas', category: 'Recursos Humanos (RH)', featureId: 'jobs' },
        { id: 'hr', label: 'Gestão RH', category: 'Recursos Humanos (RH)' },
        { id: 'forms', label: 'Formulários', category: 'Recursos Humanos (RH)' },

        { id: 'ti-requests', label: 'Chamados T.I.', category: 'Tecnologia & TI' },
        { id: 'status', label: 'Status TI', category: 'Tecnologia & TI' },
        { id: 'kb', label: 'Base de Con.', category: 'Tecnologia & TI', featureId: 'kb' },
        { id: 'infosec', label: 'Segurança', category: 'Tecnologia & TI' },
        { id: 'policies', label: 'Políticas', category: 'Tecnologia & TI', featureId: 'policies' },

        { id: 'crm_settings', label: 'CRM / Vendas', category: 'Operações & Vendas', featureId: 'crm' },
        { id: 'kpis', label: 'Metas/KPIs', category: 'Operações & Vendas', featureId: 'kpis' },

        { id: 'settings', label: 'Geral', category: 'Configurações' },
    ];

    const categories = ['Social', 'Recursos Humanos (RH)', 'Tecnologia & TI', 'Operações & Vendas', 'Configurações'];

    const tabs = allTabs.filter(tab => {
        if (tab.category !== activeCategory) return false;
        if (tab.featureId && customFeatures && customFeatures[tab.featureId] === false) return false;

        // Permissões granulares para não-Super Admins
        if (profile?.role !== 'Super Admin') {
            const permissions = profile?.permissions;
            if (tab.id === 'users' && !permissions?.viewEmployeeDetails && !profile?.isAdmin) return false;
            if (tab.id === 'forms' && !permissions?.viewVacationRequests && !profile?.isAdmin) return false;
        }

        return true;
    });

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return <Dashboard />;
            case 'users':
                return <UserManager users={employees} setUsers={setEmployees} plan={plan} departments={departments} />;
            case 'badges':
                return <BadgesManager company={company} employees={employees} />;
            case 'departments':
                return <DepartmentManager companyId={company.id!} />;
            case 'teams':
                return <TeamManager users={employees} setUsers={setEmployees} onNavigate={onNavigate} />;
            case 'org-flow':
                return <OrgFlowEditor 
                    employees={employees} 
                    onUpdateEmployees={setEmployees}
                />;
            case 'forms':
                return <FormSubmissionsManager />;
            case 'marketplace':
                return <MarketplaceManager />;
            case 'events':
                return <EventsManager employees={employees} />;
            case 'training':
                return <SupabaseGenericManager<TrainingModule>
                    title="Módulos de Treinamento"
                    tableName="training_modules"
                    companyId={company.id}
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
                    companyId={company.id}
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
                return <SupabaseGenericManager<ServiceStatusItem>
                    title="Status de Serviços"
                    tableName="services"
                    companyId={company.id}
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
                    companyId={company.id}
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
                    companyId={company.id}
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
                    companyId={company.id}
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
                    companyId={company.id}
                    newItemTemplate={{ message: '', type: 'Trabalho em Equipe', value: 'Trabalho em Equipe', from_id: '', to_id: '' } as any}
                    fields={[
                        { key: 'message', label: 'Mensagem', type: 'textarea' },
                        { key: 'to_id', label: 'Para (ID do Usuário)', type: 'user_list', dbColumn: 'to_id' },
                        { key: 'from_id', label: 'De (ID do Usuário)', type: 'user_list', dbColumn: 'from_id' },
                        { key: 'type', label: 'Valor', type: 'select', options: ['Trabalho em Equipe', 'Inovação', 'Foco no Cliente', 'Qualidade'] }
                    ]}
                    renderItem={(i) => <div><p className="font-bold">{(i as any).message}</p><p className="text-sm">{(i as any).type}</p></div>}
                />;
            case 'ti-requests':
                return <SupabaseGenericManager<TIRequest>
                    title="Gerenciamento de Solicitações de T.I."
                    tableName="ti_requests"
                    companyId={company.id}
                    newItemTemplate={{ itemName: '', justification: '', requestType: 'Hardware', status: 'Pendente' } as any}
                    fields={[
                        { key: 'itemName', label: 'Item', dbColumn: 'item_name' },
                        { key: 'requestType', label: 'Tipo', type: 'select', options: ['Hardware', 'Software', 'Acesso', 'Outro'], dbColumn: 'request_type' },
                        { key: 'justification', label: 'Justificativa', type: 'textarea' },
                        { key: 'status', label: 'Status', type: 'select', options: ['Pendente', 'Em Análise', 'Aprovado', 'Pedido Realizado', 'Entregue', 'Rejeitado', 'Finalizado'] }
                    ]}
                    renderItem={(i) => (
                        <div className="flex flex-col">
                            <p className="font-bold">{i.itemName}</p>
                            <p className="text-xs text-gray-500">{i.requestType} • {i.status}</p>
                            <p className="text-xs italic mt-1 text-gray-400">ID: {i.id}</p>
                        </div>
                    )}
                />;
            case 'jobs':
                return <SupabaseGenericManager<any>
                    title="Gestão de Vagas Internas"
                    tableName="jobs"
                    companyId={company.id}
                    storageBucket="feed-media"
                    newItemTemplate={{ title: '', description: '', requirements: [], location: '', type: 'Tempo Integral', status: 'open', salary_range: '', cover_url: '', description_image: '' }}
                    fields={[
                        { key: 'title', label: 'Título da Vaga' },
                        { key: 'status', label: 'Status', type: 'select', options: ['open', 'closed'] },
                        { key: 'type', label: 'Tipo de Vaga (ex: Tempo Integral, Meio Período)' },
                        { key: 'location', label: 'Localização' },
                        { key: 'salary_range', label: 'Faixa Salarial', optional: true },
                        { key: 'cover_url', label: 'Imagem de Capa (Upload)', type: 'file', dbColumn: 'cover_url' },
                        { key: 'description_image', label: 'Imagem da Descrição (Opcional)', type: 'file', dbColumn: 'description_image' },
                        { key: 'description', label: 'Descrição (Texto)', type: 'textarea', optional: true },
                        { key: 'requirements', label: 'Requisitos (um por linha)', type: 'textarea', optional: true }
                    ]}
                    renderItem={(i) => <div><p className="font-bold">{i.title}</p><p className="text-xs">{i.location} • {i.status} • {i.type}</p></div>}
                />;
            case 'kpis':
                return <SupabaseGenericManager<any>
                    title="Gestão de Metas e KPIs"
                    tableName="kpis"
                    companyId={company.id}
                    newItemTemplate={{ name: '', target: 100, current: 0, unit: '%', category: 'Geral', period: 'Mensal', powerbi_url: '' }}
                    fields={[
                        { key: 'name', label: 'Nome do Indicador' },
                        { key: 'category', label: 'Categoria' },
                        { key: 'unit', label: 'Unidade (ex: %, R$, un)' },
                        { key: 'target', label: 'Meta (Valor)', type: 'text' },
                        { key: 'current', label: 'Valor Atual', type: 'text' },
                        { key: 'period', label: 'Período', type: 'select', options: ['Mensal', 'Trimestral', 'Anual'] },
                        { key: 'powerbi_url', label: 'Power BI URL (Opcional)', type: 'text' }
                    ]}
                    renderItem={(i) => <div><p className="font-bold">{i.name}</p><p className="text-xs">{i.current} / {i.target} {i.unit}</p></div>}
                />;
            case 'hr':
                return <HRManager />;
            case 'crm_settings':
                return <SupabaseGenericManager<any>
                    title="Configurações CRM / Vendas"
                    tableName="crm_settings"
                    companyId={company.id}
                    newItemTemplate={{ name: 'Perfex CRM', url: '', api_key: '', active: true }}
                    fields={[
                        { key: 'name', label: 'Nome da Integração' },
                        { key: 'url', label: 'URL do CRM (ex: https://crm.dominio.com)' },
                        { key: 'api_key', label: 'Token/Chave API' },
                        { key: 'active', label: 'Ativo', type: 'select', options: ['true', 'false'] as any }
                    ]}
                    renderItem={(i) => <div><p className="font-bold">{i.name}</p><p className="text-xs">{i.url}</p></div>}
                />;
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-brand-text">Painel do Administrador</h1>

            <div className="space-y-4">
                <div className="flex space-x-2 border-b border-gray-100 pb-2 overflow-x-auto no-scrollbar">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => {
                                setActiveCategory(cat);
                                const firstTabOfCat = allTabs.find(t => t.category === cat);
                                if (firstTabOfCat) setActiveTab(firstTabOfCat.id);
                            }}
                            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all ${
                                activeCategory === cat 
                                ? 'bg-brand-primary text-white' 
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto no-scrollbar" aria-label="Tabs">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`${
                                    activeTab === tab.id
                                        ? 'border-brand-primary text-brand-primary'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-all`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            <div>
                {renderContent()}
            </div>
        </div>
    );
};

export default AdminPage;