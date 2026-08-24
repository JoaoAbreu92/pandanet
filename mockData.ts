import type { Company, Plan, EmployeePermissions, AppData, ResourceDocument, Benefit, Poll, Post, Conversation, Employee } from './types';

const basePermissions: EmployeePermissions = {
    viewMessages: true,
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
    openTickets: true,
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
};

export const mockPlans: Plan[] = [
    { id: 'free', name: 'Grátis', userLimit: 10, features: { ...basePermissions, viewTiDashboard: false, openTiRequests: false } },
    { id: 'pro', name: 'Pro', userLimit: 50, features: proPlanFeatures },
    { id: 'enterprise', name: 'Empresarial', userLimit: 1000, features: enterprisePlanFeatures },
];

const mockDocuments: ResourceDocument[] = [
    { id: '11', title: 'Calendário de Feriados 2024', category: 'RH & Cultura', type: 'PDF', url: '#', updatedAt: '2023-12-20' },
    { id: '6', title: 'Código de Conduta', category: 'RH & Cultura', type: 'PDF', url: '#', updatedAt: '2023-11-01' },
    { id: '9', title: 'Formulário de Solicitação de Férias', category: 'RH & Cultura', type: 'DOCX', url: '#', updatedAt: '2024-01-10' },
    { id: '2', title: 'Guia de Marca da Empresa', category: 'Marketing', type: 'PDF', url: '#', updatedAt: '2024-06-20' },
    { id: '7', title: 'Guia de Estilo do Frontend', category: 'Engenharia', type: 'DOCX', url: '#', updatedAt: '2024-07-22' },
    { id: '8', title: 'Manual do Colaborador', category: 'RH & Cultura', type: 'PDF', url: '#', updatedAt: '2024-02-01' },
];

const mockBenefits: Benefit[] = [
    {
        id: '1',
        title: 'Plano de Saúde',
        description: 'Cobertura nacional completa para consultas, exames, internações e cirurgias. Cuidar da sua saúde é nossa prioridade.',
        features: ['Consultas médicas em todas as especialidades', 'Exames laboratoriais e de imagem', 'Atendimento de urgência e emergência 24h', 'Internação em apartamento'],
        link: '#'
    },
    {
        id: '2',
        title: 'Plano Odontológico',
        description: 'Um sorriso saudável é fundamental. Nosso plano odontológico oferece uma vasta gama de procedimentos para você e sua família.',
        features: ['Limpeza, prevenção e aplicação de flúor', 'Tratamento de gengiva e canal', 'Restaurações e extrações', 'Documentação ortodôntica'],
        link: '#'
    },
    {
        id: '3',
        title: 'Vale Refeição & Alimentação',
        description: 'Flexibilidade para suas refeições diárias e compras de supermercado com o cartão de benefícios.',
        features: ['Crédito depositado no 1º dia útil do mês', 'Ampla rede de aceitação em restaurantes e supermercados', 'Aplicativo para gerenciamento de saldo'],
        link: '#'
    },
    {
        id: '4',
        title: 'Gympass',
        description: 'Acesso a milhares de academias e estúdios no Brasil e no mundo, além de aulas online e aplicativos de bem-estar.',
        features: ['Planos flexíveis para cada necessidade', 'Atividades como musculação, yoga, pilates e mais', 'Aulas online ao vivo e gravadas', 'Inclui apps de meditação e nutrição'],
        link: '#'
    }
];

const mockPolls: Poll[] = [
    {
        id: '1',
        question: 'Qual benefício você mais gostaria de ver implementado?',
        options: [
            { id: '1', text: 'Plano de academia (Gympass)', votes: 42 },
            { id: '2', text: 'Horário de verão o ano todo', votes: 78 },
            { id: '3', text: 'Mais dias de home office', votes: 61 },
            { id: '4', text: 'Vale-cultura', votes: 19 },
        ],
    }
];

// Usuários Fictícios (Funcionários)
const employees: Employee[] = [];

const mockFeedPosts: Post[] = [
    {
        id: '1',
        authorId: '1',
        authorName: 'João Abreu',
        authorAvatar: 'https://ui-avatars.com/api/?name=Joao+Abreu&background=0D8ABC&color=fff',
        content: 'Bem-vindos à nova intranet da Pixel! 🎉',
        timestamp: '2h',
        reactions: [
            { emoji: '👍', userId: '2' },
            { emoji: '🚀', userId: '3' }
        ],
        comments: [
            { id: '1', authorId: '2', authorName: 'Maria Silva', authorAvatar: 'https://ui-avatars.com/api/?name=Maria+Silva&background=FF5722&color=fff', text: 'Ficou incrível!', timestamp: '1h' }
        ],
        mentions: []
    },
    {
        id: '2',
        authorId: '2',
        authorName: 'Maria Silva',
        authorAvatar: 'https://ui-avatars.com/api/?name=Maria+Silva&background=FF5722&color=fff',
        content: 'Lembrete: Reunião geral amanhã às 10h. Conto com a presença de todos!',
        timestamp: '4h',
        reactions: [],
        comments: [],
        mentions: ['1', '3']
    }
];

const mockTrainings: any[] = [
    { id: '1', title: 'Onboarding: Bem-vindo à PandaNet', duration: '15 min', thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=60', category: 'RH' },
    { id: '2', title: 'Segurança da Informação: Básico', duration: '30 min', thumbnail: 'https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?w=800&auto=format&fit=crop&q=60', category: 'TI' },
    { id: '3', title: 'Cultura e Valores', duration: '20 min', thumbnail: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&auto=format&fit=crop&q=60', category: 'RH' },
];

const mockKBArticles: any[] = [
    { id: '1', title: 'Como configurar a VPN?', category: 'Rede', views: 342, content: 'Passo a passo para conectar...' },
    { id: '2', title: 'Solicitando acesso ao Jira', category: 'Acessos', views: 128, content: 'Abra um chamado na categoria...' },
    { id: '3', title: 'Configuração de impressora', category: 'Hardware', views: 56, content: 'Encontre o IP da impressora...' },
    { id: '4', title: 'Reset de senha do e-mail', category: 'Contas', views: 890, content: 'Acesse o portal de self-service...' },
];

const mockServices: any[] = [
    { id: '1', name: 'Rede Interna (Wi-Fi)', status: 'operational', uptime: '99.9%' },
    { id: '2', name: 'Servidor de Arquivos', status: 'operational', uptime: '99.8%' },
    { id: '3', name: 'E-mail (Exchange)', status: 'operational', uptime: '100%' },
    { id: '4', name: 'ERP System', status: 'maintenance', uptime: '95.5%' },
    { id: '5', name: 'VPN Access', status: 'operational', uptime: '98.2%' },
];

const mockSecurityAlerts: any[] = [
    { id: '1', title: 'Atualização Crítica do Windows', description: 'Todos os computadores serão reiniciados automaticamente hoje às 20:00 para aplicação de patch de segurança.', level: 'warning', date: '2024-08-01' },
    { id: '2', title: 'Nova Política de Senhas', description: 'A partir do próximo mês, as senhas deverão ter no mínimo 12 caracteres.', level: 'info', date: '2024-07-25' },
];

const conversations: Conversation[] = [
    {
        id: '1',
        participantName: 'Maria Silva',
        participantAvatarUrl: 'https://ui-avatars.com/api/?name=Maria+Silva&background=FF5722&color=fff',
        lastMessage: 'Você viu o relatório?',
        lastMessageTimestamp: '10:30',
        unreadCount: 2,
        messages: [
            { id: '1', sender: 'Maria Silva', senderName: 'Maria Silva', avatarUrl: 'https://ui-avatars.com/api/?name=Maria+Silva&background=FF5722&color=fff', text: 'Oi João, tudo bem?', timestamp: '10:28', reactions: [] },
            { id: '2', sender: 'Maria Silva', senderName: 'Maria Silva', avatarUrl: 'https://ui-avatars.com/api/?name=Maria+Silva&background=FF5722&color=fff', text: 'Você viu o relatório?', timestamp: '10:30', reactions: [] }
        ]
    },
    {
        id: '2',
        participantName: 'Equipe TI',
        participantAvatarUrl: 'https://ui-avatars.com/api/?name=TI&background=000',
        lastMessage: 'Servidor atualizado.',
        lastMessageTimestamp: 'Ontem',
        unreadCount: 0,
        isGroup: true,
        groupName: 'Equipe TI',
        messages: []
    }
];

export const mockCompanies: Company[] = [
    {
        domain: 'pixel.com.br',
        name: 'Pixel Inc',
        plan: {
            id: 'enterprise',
            name: 'Enterprise',
            userLimit: 1000,
            features: {
                viewMessages: true, viewCalendar: true, useMarketplace: true,
                canPostText: true, canPostImage: true, canPostVideo: true,
                viewDirectory: true, viewForms: true, viewBenefits: true,
                viewOnboarding: true, viewRecognition: true, viewDocuments: true, viewWellbeing: true,
                viewTiDashboard: true, openTickets: true, openTiRequests: true,
                viewTraining: true, viewSurveys: true, viewPolicies: true, viewKnowledgeBase: true, viewServiceStatus: true, viewInfoSec: true
            }
        },
        subscriptionEndDate: '2026-12-31',
        settings: {
            companyName: 'Pixel Intranet',
            logoUrl: '/logo.png'
        },
        data: {
            employees: employees,
            announcements: [],
            banners: [
                { id: '1', imageUrl: 'https://picsum.photos/id/1018/1200/400', title: 'Explore Nossos Novos Benefícios', subtitle: 'Programas de bem-estar e desenvolvimento profissional para você.', link: '#' },
                { id: '2', imageUrl: 'https://picsum.photos/id/1025/1200/400', title: 'Reunião Geral do Q3', subtitle: 'Participe e fique por dentro das metas e conquistas da empresa.', link: '#' },
            ],
            conversations: conversations,
            tickets: [
                { id: '101', title: 'Problema de conexão VPN', description: 'Não consigo conectar à VPN da empresa de casa.', requester: 'Ana Williams', assignedTo: 'Peter Jones', status: 'Em Andamento', priority: 'Alta', createdAt: '25/07/2024 09:00', lastUpdate: '25/07/2024 11:20', comments: [{ id: '1', author: 'Peter Jones', authorAvatarUrl: 'https://i.pravatar.cc/150?u=peter@acme.com', text: 'Verificando isso agora.', timestamp: '25/07/2024 11:20' }], hasNotification: true },
                { id: '102', title: 'Solicitação de nova licença de software', description: 'Preciso de uma licença para o Sketch.', requester: 'Mary Johnson', status: 'Resolvido', priority: 'Média', createdAt: '24/07/2024 14:00', lastUpdate: '25/07/2024 15:00', comments: [], rating: 5 }
            ],
            marketplaceItems: [
                { id: '1', title: 'Monitor Dell UltraSharp 27"', description: 'Usado por 1 ano, em perfeitas condições.', price: 800, category: 'Monitores', condition: 'Quase Novo', imageUrls: ['https://picsum.photos/id/1/400/300'], listedBy: 'John Doe', listedAt: '2024-07-20', status: 'Disponível' },
                { id: '2', title: 'Cadeira de Escritório Ergonômica', description: 'Ótima para as costas!', price: 350, category: 'Móveis', condition: 'Bom', imageUrls: ['https://picsum.photos/id/2/400/300'], listedBy: 'Peter Jones', listedAt: '2024-07-18', status: 'Reservado', reservedBy: 'Ana Williams' }
            ],
            formSubmissions: [
                { id: '1', requesterId: '1', requesterName: 'Ana Williams', requesterAvatarUrl: 'https://i.pravatar.cc/150?u=ana@acme.com', formType: 'Solicitação de Férias', status: 'Aprovado', submittedAt: '2024-06-10', startDate: '2024-08-19', endDate: '2024-08-30' }
            ],
            tiRequests: [
                { id: '1', requesterId: '1', requesterName: 'Ana Williams', requesterAvatarUrl: 'https://i.pravatar.cc/150?u=ana@acme.com', requestType: 'Hardware', itemName: 'Magic Mouse', justification: 'Meu mouse atual quebrou.', status: 'Entregue', submittedAt: '2024-07-01' }
            ],
            documents: mockDocuments,
            benefits: mockBenefits,
            polls: mockPolls,
            feedPosts: mockFeedPosts,
            events: [
                {
                    id: '1',
                    title: 'Happy Hour Mensal',
                    description: 'Venha celebrar os aniversariantes do mês!',
                    date: new Date(Date.now() + 86400000 * 2).toISOString(), // +2 days
                    time: '18:00',
                    location: 'Terraço',
                    category: 'Social',
                    imageUrl: 'https://images.unsplash.com/photo-1514525253440-b393452e8d26?w=400&q=80',
                    attendees: [],
                },
                {
                    id: '2',
                    title: 'Workshop de React Avançado',
                    description: 'Aprenda sobre Server Components e Hooks.',
                    date: new Date(Date.now() + 86400000 * 5).toISOString(), // +5 days
                    time: '14:00',
                    location: 'Sala de Treinamento',
                    category: 'Treinamento',
                    imageUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&q=80',
                    attendees: [],
                },
                {
                    id: '3',
                    title: 'Reunião Geral (All-Hands)',
                    description: 'Atualização trimestral de resultados.',
                    date: new Date(Date.now() + 86400000 * 10).toISOString(), // +10 days
                    time: '10:00',
                    location: 'Auditório Principal',
                    category: 'Corporativo',
                    imageUrl: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=400&q=80',
                    attendees: [],
                }
            ],
            trainings: mockTrainings,
            kbArticles: mockKBArticles,
            services: mockServices,
            securityAlerts: mockSecurityAlerts,
            recognitions: [
                {
                    id: '1',
                    to: 'Ana Williams',
                    from: 'John Doe',
                    toAvatar: 'https://i.pravatar.cc/150?u=ana@acme.com',
                    fromAvatar: 'https://i.pravatar.cc/150?u=john@acme.com',
                    message: 'Obrigado por me ajudar com o bug crítico ontem! Você arrasou.',
                    value: 'Trabalho em Equipe'
                },
                {
                    id: '2',
                    to: 'Peter Jones',
                    from: 'Ana Williams',
                    toAvatar: 'https://i.pravatar.cc/150?u=peter@acme.com',
                    fromAvatar: 'https://i.pravatar.cc/150?u=ana@acme.com',
                    message: 'Excelente trabalho na otimização da API.',
                    value: 'Qualidade'
                },
                {
                    id: '3',
                    to: 'Mary Johnson',
                    from: 'Carlos Silva',
                    toAvatar: 'https://i.pravatar.cc/150?u=mary@acme.com',
                    fromAvatar: 'https://i.pravatar.cc/150?u=carlos@globex.com',
                    message: 'Os novos designs estão incríveis! O cliente adorou.',
                    value: 'Inovação'
                }
            ],
            wellnessItems: [
                {
                    id: '1',
                    title: 'Saúde Mental no Trabalho',
                    description: 'Dicas importantes para manter o equilíbrio mental durante a jornada de trabalho.',
                    category: 'Saúde Mental',
                    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                    linkUrl: '#',
                    linkText: 'Saiba mais'
                },
                {
                    id: '2',
                    title: 'Exercícios de Alongamento',
                    description: 'Faça pausas regulares para alongar. Veja este guia rápido.',
                    category: 'Atividade Física',
                    videoUrl: '',
                    linkUrl: '#',
                    linkText: 'Ver guia PDF'
                },
                {
                    id: '3',
                    title: 'Alimentação Balanceada',
                    description: 'Como preparar marmitas saudáveis para a semana.',
                    category: 'Nutrição',
                    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                    linkUrl: '#',
                    linkText: 'Ver Receitas'
                }
            ]
        }
    }
];

export const superAdmin = employees[0]; 