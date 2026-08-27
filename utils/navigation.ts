import type { Page } from '../types';

export interface NavigationState {
    page: Page;
    context: any;
}

export const APP_PAGES: readonly Page[] = [
    'home', 'personal-notes', 'personal-tasks', 'messages', 'email', 'tickets',
    'calendar', 'directory', 'resources', 'recognition', 'marketplace', 'forms',
    'benefits', 'bem-estar', 'onboarding', 'ti-dashboard', 'ti-requests',
    'profile-page', 'saas-dashboard', 'admin', 'support-inbox',
    'announcement-detail', 'documentos', 'feed', 'events', 'training', 'surveys',
    'policies', 'knowledge-base', 'service-status', 'infosec', 'jobs', 'meu-rh',
    'org-chart', 'kpi-dashboard', 'job-manager', 'manual-usuario', 'projects',
    'projects-planning', 'projects-list', 'projects-calendar', 'projects-metrics',
    'whatspanda', 'scheduling', 'scheduling-events', 'scheduling-book', 'agenda',
    'reservas'
];

export const PAGE_LABELS: Partial<Record<Page, string>> = {
    home: 'Visão geral', feed: 'Feed social', messages: 'Mensagens', email: 'PandaMail',
    whatspanda: 'WhatsPanda', calendar: 'Calendário', agenda: 'Agenda', reservas: 'Reservas',
    events: 'Eventos', recognition: 'Reconhecimento', directory: 'Colaboradores',
    documentos: 'Biblioteca corporativa', projects: 'Projetos',
    'projects-planning': 'Planejamento', 'projects-list': 'Lista de projetos',
    'projects-calendar': 'Calendário de projetos', 'projects-metrics': 'Métricas de projetos',
    tickets: 'Chamados', 'ti-dashboard': 'Painel de T.I.', 'ti-requests': 'Solicitações de T.I.',
    training: 'Treinamentos', surveys: 'Pesquisas', policies: 'Políticas',
    benefits: 'Benefícios', onboarding: 'Onboarding', 'bem-estar': 'Bem-estar',
    jobs: 'Vagas', 'meu-rh': 'Meu RH', 'org-chart': 'Organograma',
    'knowledge-base': 'Base de conhecimento', 'service-status': 'Status dos serviços',
    infosec: 'Segurança da informação', admin: 'Administração',
    'saas-dashboard': 'Central SaaS', 'support-inbox': 'Suporte Master',
    'profile-page': 'Meu perfil', 'personal-notes': 'Notas pessoais',
    'personal-tasks': 'Minhas tarefas', 'manual-usuario': 'Manual do usuário'
};

const isPage = (value: string | null): value is Page =>
    !!value && (APP_PAGES as readonly string[]).includes(value);

const readStoredContext = () => {
    try {
        const value = localStorage.getItem('pixel_page_context');
        return value ? JSON.parse(value) : null;
    } catch {
        return null;
    }
};

export const readNavigation = (): NavigationState => {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    const book = params.get('book');

    if (book) return { page: 'scheduling-book', context: { eventTypeId: book, isPublic: true } };
    if (hash.startsWith('#/book/')) {
        return { page: 'scheduling-book', context: { eventTypeId: hash.split('/').pop(), isPublic: true } };
    }
    if (params.get('page') === 'scheduling-book') {
        return { page: 'scheduling-book', context: { eventTypeId: params.get('id'), isPublic: true } };
    }

    const historyState = window.history.state?.pandanet;
    if (historyState && isPage(historyState.page)) {
        return { page: historyState.page, context: historyState.context ?? null };
    }

    const urlPage = params.get('page');
    if (isPage(urlPage)) {
        const tab = params.get('tab');
        return { page: urlPage, context: tab ? { tab } : null };
    }

    const storedPage = localStorage.getItem('pixel_current_page');
    return { page: isPage(storedPage) ? storedPage : 'home', context: readStoredContext() };
};

export const persistNavigation = (page: Page, context?: any) => {
    localStorage.setItem('pixel_current_page', page);
    if (context == null) localStorage.removeItem('pixel_page_context');
    else localStorage.setItem('pixel_page_context', JSON.stringify(context));
};

export const writeNavigation = (page: Page, context?: any, replace = false) => {
    persistNavigation(page, context);
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    if (page !== 'home') url.searchParams.set('page', page);
    if (context && typeof context.tab === 'string') url.searchParams.set('tab', context.tab);
    const state = { ...(window.history.state || {}), pandanet: { page, context: context ?? null } };
    window.history[replace ? 'replaceState' : 'pushState'](state, '', `${url.pathname}${url.search}`);
};
