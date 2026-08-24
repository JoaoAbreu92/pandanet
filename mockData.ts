import type { Company, Plan, EmployeePermissions, TicketStatus, TicketPriority, MarketplaceItemCondition, MarketplaceItemStatus, AppData, ResourceDocument, Benefit, Poll, Post } from './types';

const basePermissions: EmployeePermissions = {
    viewMessages: true,
    openTickets: true,
    viewCalendar: true,
    useMarketplace: true,

    canPostText: true,
    canPostImage: true,
    canPostVideo: true,

    viewDirectory: true,
    viewForms: true,
    viewBenefits: true,
    viewOnboarding: true,
    viewRecognition: true,
    viewDocuments: true,
    viewWellbeing: true,
    viewTiDashboard: true,
    openTiRequests: true,

    // New Permissions
    viewTraining: true,
    viewSurveys: true,
    viewPolicies: true,
    viewKnowledgeBase: true,
    viewServiceStatus: true,
    viewInfoSec: true,
};

const proPlanFeatures: Plan['features'] = {
    ...basePermissions,
};

const enterprisePlanFeatures: Plan['features'] = {
    ...proPlanFeatures,
    // Add enterprise-specific features here
};

export const mockPlans: Plan[] = [
    { id: 'free', name: 'Grátis', userLimit: 10, features: { ...basePermissions, viewTiDashboard: false, openTiRequests: false } },
    { id: 'pro', name: 'Pro', userLimit: 50, features: proPlanFeatures },
    { id: 'enterprise', name: 'Empresarial', userLimit: 1000, features: enterprisePlanFeatures },
];

const mockDocuments: ResourceDocument[] = [
    { id: 11, title: 'Calendário de Feriados 2024', category: 'RH & Cultura', type: 'PDF', url: '#', updatedAt: '2023-12-20' },
    { id: 6, title: 'Código de Conduta', category: 'RH & Cultura', type: 'PDF', url: '#', updatedAt: '2023-11-01' },
    { id: 9, title: 'Formulário de Solicitação de Férias', category: 'RH & Cultura', type: 'DOCX', url: '#', updatedAt: '2024-01-10' },
    { id: 2, title: 'Guia de Marca da Empresa', category: 'Marketing', type: 'PDF', url: '#', updatedAt: '2024-06-20' },
    { id: 7, title: 'Guia de Estilo do Frontend', category: 'Engenharia', type: 'DOCX', url: '#', updatedAt: '2024-07-22' },
    { id: 8, title: 'Manual do Colaborador', category: 'RH & Cultura', type: 'PDF', url: '#', updatedAt: '2024-02-01' },
];

const mockBenefits: Benefit[] = [
    {
        id: 1,
        title: 'Plano de Saúde',
        description: 'Cobertura nacional completa para consultas, exames, internações e cirurgias. Cuidar da sua saúde é nossa prioridade.',
        features: ['Consultas médicas em todas as especialidades', 'Exames laboratoriais e de imagem', 'Atendimento de urgência e emergência 24h', 'Internação em apartamento'],
        link: '#'
    },
    {
        id: 2,
        title: 'Plano Odontológico',
        description: 'Um sorriso saudável é fundamental. Nosso plano odontológico oferece uma vasta gama de procedimentos para você e sua família.',
        features: ['Limpeza, prevenção e aplicação de flúor', 'Tratamento de gengiva e canal', 'Restaurações e extrações', 'Documentação ortodôntica'],
        link: '#'
    },
    {
        id: 3,
        title: 'Vale Refeição & Alimentação',
        description: 'Flexibilidade para suas refeições diárias e compras de supermercado com o cartão de benefícios.',
        features: ['Crédito depositado no 1º dia útil do mês', 'Ampla rede de aceitação em restaurantes e supermercados', 'Aplicativo para gerenciamento de saldo'],
        link: '#'
    },
    {
        id: 4,
        title: 'Gympass',
        description: 'Acesso a milhares de academias e estúdios no Brasil e no mundo, além de aulas online e aplicativos de bem-estar.',
        features: ['Planos flexíveis para cada necessidade', 'Atividades como musculação, yoga, pilates e mais', 'Aulas online ao vivo e gravadas', 'Inclui apps de meditação e nutrição'],
        link: '#'
    }
];

const mockPolls: Poll[] = [
    {
        id: 1,
        question: 'Qual benefício você mais gostaria de ver implementado?',
        options: [
            { id: 1, text: 'Plano de academia (Gympass)', votes: 42 },
            { id: 2, text: 'Horário de verão o ano todo', votes: 78 },
            { id: 3, text: 'Mais dias de home office', votes: 61 },
            { id: 4, text: 'Vale-cultura', votes: 19 },
        ],
    }
];

const mockFeedPosts: Post[] = [
    {
        id: 1,
        authorId: 2,
        authorName: 'John Doe',
        authorAvatar: 'https://i.pravatar.cc/150?u=john@acme.com',
        content: 'Acabei de lançar a nova feature de Dashboard! 🚀 Muito orgulho do time de Produto.',
        timestamp: 'Há 2 horas',
        reactions: [
            { emoji: '👍', userId: 1 },
            { emoji: '❤️', userId: 3 }
        ],
        comments: [
            { id: 1, authorId: 1, authorName: 'Ana Williams', authorAvatar: 'https://i.pravatar.cc/150?u=ana@acme.com', text: 'Ficou incrível, John!', timestamp: 'Há 1 hora' }
        ],
        mediaType: 'image',
        mediaUrl: 'https://picsum.photos/id/1004/800/400',
        mentions: []
    },
    {
        id: 2,
        authorId: 4,
        authorName: 'Mary Johnson',
        authorAvatar: 'https://i.pravatar.cc/150?u=mary@acme.com',
        content: 'Alguém tem dicas de livros sobre Design Systems? Estou querendo me aprofundar.',
        timestamp: 'Há 5 horas',
        reactions: [
            { emoji: '👍', userId: 2 }
        ],
        comments: [],
        mentions: []
    }
];

const mockTrainings: any[] = [
    { id: 1, title: 'Onboarding: Bem-vindo à PandaNet', duration: '15 min', thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=60', category: 'RH' },
    { id: 2, title: 'Segurança da Informação: Básico', duration: '30 min', thumbnail: 'https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?w=800&auto=format&fit=crop&q=60', category: 'TI' },
    { id: 3, title: 'Cultura e Valores', duration: '20 min', thumbnail: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&auto=format&fit=crop&q=60', category: 'RH' },
];

const mockKBArticles: any[] = [
    { id: 1, title: 'Como configurar a VPN?', category: 'Rede', views: 342, content: 'Passo a passo para conectar...' },
    { id: 2, title: 'Solicitando acesso ao Jira', category: 'Acessos', views: 128, content: 'Abra um chamado na categoria...' },
    { id: 3, title: 'Configuração de impressora', category: 'Hardware', views: 56, content: 'Encontre o IP da impressora...' },
    { id: 4, title: 'Reset de senha do e-mail', category: 'Contas', views: 890, content: 'Acesse o portal de self-service...' },
];

const mockServices: any[] = [
    { id: 1, name: 'Rede Interna (Wi-Fi)', status: 'operational', uptime: '99.9%' },
    { id: 2, name: 'Servidor de Arquivos', status: 'operational', uptime: '99.8%' },
    { id: 3, name: 'E-mail (Exchange)', status: 'operational', uptime: '100%' },
    { id: 4, name: 'ERP System', status: 'maintenance', uptime: '95.5%' },
    { id: 5, name: 'VPN Access', status: 'operational', uptime: '98.2%' },
];

const mockSecurityAlerts: any[] = [
    { id: 1, title: 'Atualização Crítica do Windows', description: 'Todos os computadores serão reiniciados automaticamente hoje às 20:00 para aplicação de patch de segurança.', level: 'warning', date: '2024-08-01' },
    { id: 2, title: 'Nova Política de Senhas', description: 'A partir do próximo mês, as senhas deverão ter no mínimo 12 caracteres.', level: 'info', date: '2024-07-25' },
];

// FIX: Explicitly typed acmeData with AppData to fix type-widening issues and allow for removing redundant casts.
const acmeData: AppData = {
    employees: [
        { id: 1, name: 'Ana Williams', email: 'ana@acme.com', password: '123', role: 'Desenvolvedora Frontend', team: 'Engenharia', avatarUrl: 'https://i.pravatar.cc/150?u=ana@acme.com', joinDate: '2023-08-15', birthDate: '1995-07-22', isAdmin: true, isOnline: true, permissions: { ...basePermissions }, phone: '(11) 98765-4321', officeLocation: 'São Paulo', bio: 'Entusiasta de React e café. Adoro criar interfaces de usuário intuitivas e resolver quebra-cabeças de CSS.', following: [2, 4] },
        { id: 2, name: 'John Doe', email: 'john@acme.com', password: '123', role: 'Gerente de Projetos', team: 'Produto', avatarUrl: 'https://i.pravatar.cc/150?u=john@acme.com', joinDate: '2022-01-20', birthDate: '1990-05-10', isAdmin: false, isOnline: true, permissions: { ...basePermissions }, phone: '(21) 91234-5678', officeLocation: 'Rio de Janeiro', bio: 'Focado em entregar produtos que os clientes amam. Nas horas vagas, sou corredor de maratona.', following: [1] },
        { id: 3, name: 'Peter Jones', email: 'peter@acme.com', password: '123', role: 'Desenvolvedor Backend', team: 'Engenharia', avatarUrl: 'https://i.pravatar.cc/150?u=peter@acme.com', joinDate: '2021-03-11', birthDate: '1992-11-30', isAdmin: false, isOnline: false, permissions: { ...basePermissions }, phone: '(51) 98888-7777', officeLocation: 'Remoto', bio: 'Construindo APIs robustas e escaláveis.', following: [] },
        { id: 4, name: 'Mary Johnson', email: 'mary@acme.com', password: '123', role: 'Designer UI/UX', team: 'Design', avatarUrl: 'https://i.pravatar.cc/150?u=mary@acme.com', joinDate: '2024-07-01', birthDate: '1998-02-14', isAdmin: false, isOnline: true, permissions: { ...basePermissions }, phone: '(31) 99999-0000', officeLocation: 'Belo Horizonte', bio: 'Apaixonada por design centrado no ser humano e tipografia.', following: [] },
    ],
    announcements: [], // Will be fetched from Gemini
    banners: [
        { id: 1, imageUrl: 'https://picsum.photos/id/1018/1200/400', title: 'Explore Nossos Novos Benefícios', subtitle: 'Programas de bem-estar e desenvolvimento profissional para você.', link: '#' },
        { id: 2, imageUrl: 'https://picsum.photos/id/1025/1200/400', title: 'Reunião Geral do Q3', subtitle: 'Participe e fique por dentro das metas e conquistas da empresa.', link: '#' },
    ],
    conversations: [
        { id: 1, participantName: 'John Doe', participantAvatarUrl: 'https://i.pravatar.cc/150?u=john@acme.com', messages: [{ id: 1, sender: 'John Doe', senderName: 'John Doe', avatarUrl: 'https://i.pravatar.cc/150?u=john@acme.com', text: 'Oi Ana, como está o progresso da nova funcionalidade?', timestamp: '10:30', reactions: [] }], lastMessage: 'Oi Ana, como está o progresso da nova funcionalidade?', lastMessageTimestamp: '10:30', unreadCount: 1 },
        { id: 2, participantName: 'Mary Johnson', participantAvatarUrl: 'https://i.pravatar.cc/150?u=mary@acme.com', messages: [{ id: 1, sender: 'Mary Johnson', senderName: 'Mary Johnson', avatarUrl: 'https://i.pravatar.cc/150?u=mary@acme.com', text: 'Você pode dar uma olhada nos últimos protótipos?', timestamp: 'Ontem', reactions: [] }], lastMessage: 'Você pode dar uma olhada nos últimos protótipos?', lastMessageTimestamp: 'Ontem', unreadCount: 0 },
    ],
    tickets: [
        { id: 101, title: 'Problema de conexão VPN', description: 'Não consigo conectar à VPN da empresa de casa.', requester: 'Ana Williams', assignedTo: 'Peter Jones', status: 'Em Andamento', priority: 'Alta', createdAt: '25/07/2024 09:00', lastUpdate: '25/07/2024 11:20', comments: [{ id: 1, author: 'Peter Jones', authorAvatarUrl: 'https://i.pravatar.cc/150?u=peter@acme.com', text: 'Verificando isso agora.', timestamp: '25/07/2024 11:20' }], hasNotification: true },
        { id: 102, title: 'Solicitação de nova licença de software', description: 'Preciso de uma licença para o Sketch.', requester: 'Mary Johnson', status: 'Resolvido', priority: 'Média', createdAt: '24/07/2024 14:00', lastUpdate: '25/07/2024 15:00', comments: [], rating: 5 }
    ],
    marketplaceItems: [
        { id: 1, title: 'Monitor Dell UltraSharp 27"', description: 'Usado por 1 ano, em perfeitas condições.', price: 800, category: 'Monitores', condition: 'Quase Novo', imageUrls: ['https://picsum.photos/id/1/400/300'], listedBy: 'John Doe', listedAt: '2024-07-20', status: 'Disponível' },
        { id: 2, title: 'Cadeira de Escritório Ergonômica', description: 'Ótima para as costas!', price: 350, category: 'Móveis', condition: 'Bom', imageUrls: ['https://picsum.photos/id/2/400/300'], listedBy: 'Peter Jones', listedAt: '2024-07-18', status: 'Reservado', reservedBy: 'Ana Williams' }
    ],
    formSubmissions: [
        { id: 1, requesterId: 1, requesterName: 'Ana Williams', requesterAvatarUrl: 'https://i.pravatar.cc/150?u=ana@acme.com', formType: 'Solicitação de Férias', status: 'Aprovado', submittedAt: '2024-06-10', startDate: '2024-08-19', endDate: '2024-08-30' }
    ],
    tiRequests: [
        { id: 1, requesterId: 1, requesterName: 'Ana Williams', requesterAvatarUrl: 'https://i.pravatar.cc/150?u=ana@acme.com', requestType: 'Hardware', itemName: 'Magic Mouse', justification: 'Meu mouse atual quebrou.', status: 'Entregue', submittedAt: '2024-07-01' }
    ],
    documents: mockDocuments,
    benefits: mockBenefits,
    polls: mockPolls,
    feedPosts: mockFeedPosts,
    events: [], // Initialize events
    trainings: mockTrainings,
    kbArticles: mockKBArticles,
    services: mockServices,
    securityAlerts: mockSecurityAlerts
};

// FIX: Explicitly typed globexData with AppData to ensure type consistency.
const globexData: AppData = { ...acmeData, polls: [], events: [], trainings: [], kbArticles: [], services: [], securityAlerts: [], employees: [{ id: 1, name: 'Carlos Silva', email: 'carlos@globex.com', password: '123', role: 'Diretor de Vendas', team: 'Vendas', avatarUrl: 'https://i.pravatar.cc/150?u=carlos@globex.com', joinDate: '2020-02-02', birthDate: '1985-10-10', isAdmin: true, isOnline: true, permissions: { ...basePermissions }, phone: '(11) 91111-2222', officeLocation: 'São Paulo', bio: 'Liderando equipes de vendas para o sucesso.', following: [] }] };

export const mockCompanies: Company[] = [
    {
        domain: 'acme',
        name: 'Acme Corporation',
        plan: mockPlans[1], // Pro
        subscriptionEndDate: '2025-08-01',
        settings: {
            companyName: 'Acme Corp',
            logoUrl: 'https://cdn-icons-png.flaticon.com/512/3658/3658959.png' // Default logo for demonstration
        },
        data: acmeData,
    },
    {
        domain: 'globex',
        name: 'Globex Corporation',
        plan: mockPlans[2], // Empresarial
        subscriptionEndDate: '2026-01-01',
        settings: { companyName: 'Globex' },
        data: globexData,
    }
];

export const superAdmin = {
    password: 'superadmin123'
};