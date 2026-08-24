import React, { useState, useEffect } from 'react';
import type { Company, Plan, KBArticle, ServiceStatusItem, SecurityAlert, ResourceDocument, WellnessItem, Employee, Recognition, TIRequest } from '../types';
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
import ReservationsManager from './ReservationsManager';
import TrainingAdminManager from './TrainingAdminManager';
import JobsAdminManager from './JobsAdminManager';
import SchedulingPage from './SchedulingPage';

interface AdminPageProps {
    company: Company;
    setCompany: (company: Company) => void;
    plan: Plan;
    customFeatures?: Record<string, boolean>;
    onNavigate?: (page: any) => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ company, setCompany, plan, customFeatures, onNavigate }) => {
    const { profile } = useAuth();
    const [activeTab, setActiveTab] = useState('users');
    const [activeCategory, setActiveCategory] = useState('DP (Departamento Pessoal)');
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
        // DP (Departamento Pessoal)
        { id: 'users', label: 'Usuários', category: 'DP (Departamento Pessoal)' },
        { id: 'departments', label: 'Departamentos', category: 'DP (Departamento Pessoal)' },
        { id: 'teams', label: 'Equipes', category: 'DP (Departamento Pessoal)' },
        { id: 'training', label: 'Treinamentos', category: 'DP (Departamento Pessoal)' },
        { id: 'forms', label: 'Formulários', category: 'DP (Departamento Pessoal)' },
        { id: 'policies', label: 'Políticas', category: 'DP (Departamento Pessoal)', featureId: 'policies' },
        { id: 'onboarding', label: 'Onboarding (Integração)', category: 'DP (Departamento Pessoal)' },
        { id: 'documentos', label: 'Biblioteca Corporativa', category: 'DP (Departamento Pessoal)' },
        { id: 'benefits', label: 'Benefícios', category: 'DP (Departamento Pessoal)' },

        // RH
        { id: 'hr', label: 'Gestão RH', category: 'RH' },
        { id: 'jobs', label: 'Gestão de Vagas', category: 'RH', featureId: 'jobs' },
        { id: 'org-flow', label: 'Organograma (Fluxo)', category: 'RH' },

        // Administrativo
        { id: 'badges', label: 'Selos, Elos & Gamificação', category: 'Administrativo' },
        { id: 'reservas_admin', label: 'Reservas', category: 'Administrativo' },

        // Social
        { id: 'dashboard', label: 'Feed/Mural', category: 'Social', featureId: 'feed' },
        { id: 'mural', label: 'Reconhecimentos', category: 'Social' },
        { id: 'polls', label: 'Enquetes', category: 'Social' },
        { id: 'events', label: 'Eventos', category: 'Social', featureId: 'events' },
        { id: 'marketplace', label: 'Marketplace', category: 'Social', featureId: 'marketplace' },
        { id: 'bem-estar', label: 'Bem Estar', category: 'Social', featureId: 'wellness' },

        // Tecnologia & TI
        { id: 'ti-requests', label: 'Chamados T.I.', category: 'Tecnologia & TI' },
        { id: 'status', label: 'Status TI', category: 'Tecnologia & TI' },
        { id: 'kb', label: 'Base de Con.', category: 'Tecnologia & TI', featureId: 'kb' },
        { id: 'infosec', label: 'Segurança', category: 'Tecnologia & TI' },

        // Comercial
        { id: 'scheduling', label: 'Agendamentos', category: 'Comercial', featureId: 'scheduling' },
        { id: 'scheduling-events', label: 'Espaços', category: 'Comercial', featureId: 'scheduling' },

        // Configurações
        { id: 'settings', label: 'Geral', category: 'Configurações' },
    ];

    const categories = ['DP (Departamento Pessoal)', 'RH', 'Administrativo', 'Social', 'Tecnologia & TI', 'Comercial', 'Configurações'].filter(cat => {
        if (profile?.role === 'Super Admin') return true;
        const permissions = profile?.permissions || {};
        const catMap: Record<string, string> = {
            'DP (Departamento Pessoal)': 'admin_view_dp',
            'RH': 'admin_view_gestao_rh',
            'Administrativo': 'admin_view_administrativo',
            'Social': 'admin_view_social',
            'Tecnologia & TI': 'admin_view_ti',
            'Comercial': 'admin_view_comercial',
            'Configurações': 'admin_view_configuracoes'
        };
        const catKey = catMap[cat];
        if (!catKey) return true;
        return profile?.isAdmin ? permissions[catKey] !== false : !!permissions[catKey];
    });

    const tabs = allTabs.filter(tab => {
        if (tab.category !== activeCategory) return false;
        if (tab.featureId && customFeatures && customFeatures[tab.featureId] === false) return false;

        // Permissões granulares para não-Super Admins
        if (profile?.role !== 'Super Admin') {
            const permissions = profile?.permissions || {};
            const catMap: Record<string, string> = {
                'DP (Departamento Pessoal)': 'admin_view_dp',
                'RH': 'admin_view_gestao_rh',
                'Administrativo': 'admin_view_administrativo',
                'Social': 'admin_view_social',
                'Tecnologia & TI': 'admin_view_ti',
                'Comercial': 'admin_view_comercial',
                'Configurações': 'admin_view_configuracoes'
            };
            const catKey = catMap[tab.category];

            const tabMap: Record<string, string> = {
                'users': 'admin_tab_users',
                'departments': 'admin_tab_departments',
                'teams': 'admin_tab_teams',
                'training': 'admin_tab_training',
                'hr': 'admin_tab_hr',
                'forms': 'admin_tab_forms',
                'policies': 'admin_tab_policies',
                'onboarding': 'admin_tab_onboarding',
                'documentos': 'admin_tab_documentos',
                'benefits': 'admin_tab_benefits',
                'jobs': 'admin_tab_jobs',
                'org-flow': 'admin_tab_org_flow',
                'badges': 'admin_tab_badges',
                'reservas_admin': 'admin_tab_reservas_admin',
                'dashboard': 'admin_tab_dashboard',
                'mural': 'admin_tab_mural',
                'polls': 'admin_tab_polls',
                'events': 'admin_tab_events',
                'marketplace': 'admin_tab_marketplace',
                'bem-estar': 'admin_tab_wellbeing',
                'ti-requests': 'admin_tab_ti_requests',
                'status': 'admin_tab_status',
                'kb': 'admin_tab_kb',
                'infosec': 'admin_tab_infosec',
                'scheduling': 'admin_tab_scheduling',
                'scheduling-events': 'admin_tab_scheduling_events',
                'settings': 'admin_tab_settings'
            };
            const tabKey = tabMap[tab.id];

            const hasCatAccess = catKey ? (profile?.isAdmin ? permissions[catKey] !== false : !!permissions[catKey]) : true;
            const hasTabAccess = tabKey ? (profile?.isAdmin ? permissions[tabKey] !== false : !!permissions[tabKey]) : true;

            if (!hasCatAccess || !hasTabAccess) {
                return false;
            }
        }

        return true;
    });

    // Auto-select first authorized category and tab on mount or profile load
    useEffect(() => {
        if (categories.length > 0) {
            const firstCat = categories[0];
            setActiveCategory(firstCat);

            const firstTab = allTabs.find(t => {
                if (t.category !== firstCat) return false;
                if (t.featureId && customFeatures && customFeatures[t.featureId] === false) return false;
                if (profile?.role !== 'Super Admin') {
                    const permissions = profile?.permissions || {};
                    const tabMap: Record<string, string> = {
                        'users': 'admin_tab_users',
                        'departments': 'admin_tab_departments',
                        'teams': 'admin_tab_teams',
                        'training': 'admin_tab_training',
                        'hr': 'admin_tab_hr',
                        'forms': 'admin_tab_forms',
                        'policies': 'admin_tab_policies',
                        'onboarding': 'admin_tab_onboarding',
                        'documentos': 'admin_tab_documentos',
                        'benefits': 'admin_tab_benefits',
                        'jobs': 'admin_tab_jobs',
                        'org-flow': 'admin_tab_org_flow',
                        'badges': 'admin_tab_badges',
                        'reservas_admin': 'admin_tab_reservas_admin',
                        'dashboard': 'admin_tab_dashboard',
                        'mural': 'admin_tab_mural',
                        'polls': 'admin_tab_polls',
                        'events': 'admin_tab_events',
                        'marketplace': 'admin_tab_marketplace',
                        'bem-estar': 'admin_tab_wellbeing',
                        'ti-requests': 'admin_tab_ti_requests',
                        'status': 'admin_tab_status',
                        'kb': 'admin_tab_kb',
                        'infosec': 'admin_tab_infosec',
                        'scheduling': 'admin_tab_scheduling',
                        'scheduling-events': 'admin_tab_scheduling_events',
                        'settings': 'admin_tab_settings'
                    };
                    const tabKey = tabMap[t.id];
                    if (tabKey) {
                        return profile?.isAdmin ? permissions[tabKey] !== false : !!permissions[tabKey];
                    }
                }
                return true;
            });

            if (firstTab) {
                setActiveTab(firstTab.id);
            }
        }
    }, [profile, company?.id]);

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
                return <TrainingAdminManager employees={employees} />;
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
            case 'onboarding':
                return <SupabaseGenericManager<any>
                    title="Passos do Onboarding"
                    tableName="onboarding_steps"
                    companyId={company.id}
                    orderBy="order"
                    orderAscending={true}
                    newItemTemplate={{ title: '', description: '', link_url: '', link_text: '', order: 0 }}
                    fields={[
                        { key: 'title', label: 'Título' },
                        { key: 'description', label: 'Descrição/Instruções', type: 'textarea' },
                        { key: 'link_url', label: 'Link de Destino (Opcional)', optional: true },
                        { key: 'link_text', label: 'Texto do Link (Opcional)', optional: true },
                        { key: 'order', label: 'Ordem de Exibição', type: 'text' }
                    ]}
                    renderItem={(i) => <div><p className="font-bold">{i.title}</p><p className="text-sm">{i.description}</p></div>}
                />;
            case 'polls':
                return <PollManager />;
            case 'bem-estar':
                return <SupabaseGenericManager<WellnessItem>
                    title="Itens de Bem-Estar"
                    tableName="wellness_items"
                    companyId={company.id}
                    newItemTemplate={{ title: '', description: '', category: 'Saúde Mental', showLink: true, videoUrl: '', linkUrl: '', linkText: 'Saiba mais' } as any}
                    fields={[
                        { key: 'title', label: 'Título' },
                        { key: 'description', label: 'Descrição', type: 'textarea' },
                        { key: 'category', label: 'Categoria', type: 'select', options: ['Saúde Mental', 'Atividade Física', 'Nutrição', 'Outro'] },
                        { key: 'showLink', label: 'Habilitar Vídeo / Link de Saiba Mais', type: 'checkbox', excludeFromDb: true },
                        { key: 'videoUrl', label: 'Vídeo (URL)', type: 'text', dbColumn: 'video_url', optional: true, condition: (data) => !!data.showLink },
                        { key: 'linkUrl', label: 'Link (URL)', type: 'text', dbColumn: 'link_url', optional: true, condition: (data) => !!data.showLink },
                        { key: 'linkText', label: 'Texto do Link', type: 'text', dbColumn: 'link_text', optional: true, condition: (data) => !!data.showLink }
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
                return <JobsAdminManager employees={employees} />;
            case 'hr':
                return <HRManager />;
            case 'reservas_admin':
                return <ReservationsManager />;
            case 'documentos':
                return <SupabaseGenericManager<any>
                    title="Biblioteca Corporativa"
                    tableName="documents"
                    storageBucket="documents"
                    companyId={company.id}
                    orderBy="updated_at"
                    orderAscending={false}
                    users={employees}
                    departments={departments}
                    newItemTemplate={{ title: '', category: 'RH & Cultura', type: 'PDF', url: '', target_type: 'all', target_users: [], target_departments: [] }}
                    fields={[
                        { key: 'title', label: 'Título' },
                        { key: 'category', label: 'Categoria', list: ['RH & Cultura', 'Departamento Pessoal', 'Comercial', 'Tecnologia', 'Financeiro', 'Manuais', 'Políticas'] },
                        { key: 'type', label: 'Tipo de Arquivo', type: 'select', options: ['PDF', 'DOCX', 'PPTX', 'XLSX', 'OUTRO'] },
                        { key: 'url', label: 'Arquivo (Upload)', type: 'file' },
                        { key: 'target_type', label: 'Tipo de Destinatário', type: 'select', options: ['all', 'departments', 'users'] },
                        {
                            key: 'target_departments',
                            label: 'Departamentos Destinatários',
                            type: 'department_list',
                            optional: true,
                            condition: (formData) => formData.target_type === 'departments'
                        },
                        {
                            key: 'target_users',
                            label: 'Usuários Destinatários',
                            type: 'user_list',
                            optional: true,
                            condition: (formData) => formData.target_type === 'users'
                        }
                    ]}
                    renderItem={(i) => <div><p className="font-bold">{i.title}</p><p className="text-sm">{i.category} - {i.type}</p></div>}
                />;
            case 'benefits':
                return <SupabaseGenericManager<any>
                    title="Gestão de Benefícios"
                    tableName="benefits"
                    storageBucket="feed-media"
                    companyId={company.id}
                    newItemTemplate={{ title: '', description: '', features: [], hasLink: true, link: '', image_url: '' }}
                    fields={[
                        { key: 'title', label: 'Título' },
                        { key: 'description', label: 'Descrição', type: 'textarea' },
                        { key: 'features', label: 'Características (um por linha)', type: 'textarea' },
                        { key: 'hasLink', label: 'Possui Link (Saiba Mais)?', type: 'checkbox', excludeFromDb: true },
                        { key: 'link', label: 'Link (Saiba Mais)', condition: (formData) => formData.hasLink },
                        { key: 'image_url', label: 'Imagem do Benefício (Upload)', type: 'file', dbColumn: 'image_url', optional: true }
                    ]}
                    renderItem={(i) => <div><p className="font-bold">{i.title}</p><p className="text-sm">{i.description}</p></div>}
                />;
            case 'scheduling':
                return <SchedulingPage customFeatures={customFeatures} mode="appointments" />;
            case 'scheduling-events':
                return <SchedulingPage customFeatures={customFeatures} mode="events" />;
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
                                const firstAllowedTab = allTabs.find(t => {
                                    if (t.category !== cat) return false;
                                    if (t.featureId && customFeatures && customFeatures[t.featureId] === false) return false;
                                    if (profile?.role !== 'Super Admin') {
                                        const permissions = profile?.permissions || {};
                                        const tabMap: Record<string, string> = {
                                            'users': 'admin_tab_users',
                                            'departments': 'admin_tab_departments',
                                            'teams': 'admin_tab_teams',
                                            'training': 'admin_tab_training',
                                            'hr': 'admin_tab_hr',
                                            'forms': 'admin_tab_forms',
                                            'policies': 'admin_tab_policies',
                                            'onboarding': 'admin_tab_onboarding',
                                            'documentos': 'admin_tab_documentos',
                                            'benefits': 'admin_tab_benefits',
                                            'jobs': 'admin_tab_jobs',
                                            'org-flow': 'admin_tab_org_flow',
                                            'badges': 'admin_tab_badges',
                                            'reservas_admin': 'admin_tab_reservas_admin',
                                            'dashboard': 'admin_tab_dashboard',
                                            'mural': 'admin_tab_mural',
                                            'polls': 'admin_tab_polls',
                                            'events': 'admin_tab_events',
                                            'marketplace': 'admin_tab_marketplace',
                                            'bem-estar': 'admin_tab_wellbeing',
                                            'ti-requests': 'admin_tab_ti_requests',
                                            'status': 'admin_tab_status',
                                            'kb': 'admin_tab_kb',
                                            'infosec': 'admin_tab_infosec',
                                            'scheduling': 'admin_tab_scheduling',
                                            'scheduling-events': 'admin_tab_scheduling_events',
                                            'settings': 'admin_tab_settings'
                                        };
                                        const tabKey = tabMap[t.id];
                                        if (tabKey) {
                                            return profile?.isAdmin ? permissions[tabKey] !== false : !!permissions[tabKey];
                                        }
                                    }
                                    return true;
                                });
                                if (firstAllowedTab) {
                                    setActiveTab(firstAllowedTab.id);
                                } else {
                                    setActiveTab('');
                                }
                            }}
                            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all ${activeCategory === cat
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
                                className={`${activeTab === tab.id
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