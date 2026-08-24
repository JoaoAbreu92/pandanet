import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'pt' | 'en' | 'es';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const translations = {
    pt: {
        'sidebar.home': 'Início',
        'sidebar.feed': 'Feed Social',
        'sidebar.messages': 'Mensagens',
        'sidebar.calendar': 'Calendário',
        'sidebar.marketplace': 'Marketplace',
        'sidebar.wellbeing': 'Bem-Estar',
        'sidebar.directory': 'Diretório',
        'sidebar.forms': 'Formulários',
        'sidebar.benefits': 'Benefícios',
        'sidebar.onboarding': 'Onboarding',
        'sidebar.recognition': 'Reconhecimento',
        'sidebar.documents': 'Documentos',
        'sidebar.ti_dashboard': 'Painel de T.I.',
        'sidebar.my_tickets': 'Meus Chamados',
        'sidebar.request_equipment': 'Solicitar Equipamento',
        'sidebar.admin': 'Admin',
        'sidebar.corporate_intranet': 'Intranet Corporativa',
        'header.search_placeholder': 'Buscar...',
        'header.profile': 'Meu Perfil',
        'header.logout': 'Sair',
        'header.theme': 'Tema',
        'header.viewing_as': 'Você está visualizando a intranet da',
        'header.return_panel': 'Retornar ao Painel',
        'theme.light': 'Claro',
        'theme.dark': 'Escuro',
        'language.select': 'Idioma',

        // Modules
        'users.title': 'Gerenciar Usuários',
        'users.add': 'Adicionar Novo Usuário',
        'users.edit': 'Editar Usuário',
        'users.name': 'Nome',
        'users.email': 'Email',
        'users.password': 'Senha',
        'users.role': 'Cargo',
        'users.team': 'Equipe',
        'users.admin': 'É Administrador?',
        'users.sector_manager': 'Gestor do Setor',
        'users.employee_manager': 'Gerente do Funcionário',
        'users.permissions_feed': 'Permissões de Feed Social',
        'users.permissions_other': 'Outras Permissões',
        'users.save': 'Salvar Usuário',
        'users.cancel': 'Cancelar',
        'users.actions': 'Ações',
        'users.limit_reached': 'Limite de usuários atingido.',

        'forms.title': 'Central de Formulários',
        'forms.available': 'Formulários Disponíveis',
        'forms.my_requests': 'Minhas Solicitações',
        'forms.vacation': 'Solicitação de Férias',
        'forms.vacation_desc': 'Planeje e envie seu pedido de férias.',
        'forms.start_request': 'Iniciar Solicitação',
        'forms.reimbursement': 'Reembolso de Despesas',
        'forms.reimbursement_desc': 'Envie comprovantes para reembolso.',
        'forms.data_change': 'Alteração de Dados',
        'forms.data_change_desc': 'Atualize endereço, telefone, etc.',
        'forms.start_date': 'Data de Início',
        'forms.end_date': 'Data de Fim',
        'forms.reason': 'Motivo (Opcional)',
        'forms.submit': 'Enviar Solicitação',
        'forms.manager_sector': 'Gestor do Setor',
        'forms.manager_employee': 'Gerente Responsável',

        'training.title': 'Treinamentos e Desenvolvimento',
        'training.start': 'Iniciar Curso',
        'training.duration': 'Duração',

        'kb.title': 'Base de Conhecimento T.I.',
        'kb.search_placeholder': 'Como podemos ajudar? Pesquise por tutoriais, erros, acessos...',
        'kb.no_articles': 'Nenhum artigo encontrado.',

        'policies.title': 'Políticas e Diretrizes',
        'policies.download': 'Baixar',

        'status.title': 'Status dos Serviços',
        'status.overview': 'Visão Geral do Sistema',
        'status.all_operational': 'Todos os sistemas operacionais',
        'status.maintenance': 'Manutenção Programada',
        'status.operational': 'Operacional',
        'status.outage': 'Interrupção',

        'generic.save': 'Salvar',
        'generic.cancel': 'Cancelar',
        'generic.delete_confirm': 'Tem certeza que deseja apagar este item?',
        'generic.new_item': 'Novo Item',
        'generic.edit_item': 'Editar Item',
    },
    en: {
        'sidebar.home': 'Home',
        'sidebar.feed': 'Social Feed',
        'sidebar.messages': 'Messages',
        'sidebar.calendar': 'Calendar',
        'sidebar.marketplace': 'Marketplace',
        'sidebar.wellbeing': 'Wellbeing',
        'sidebar.directory': 'Directory',
        'sidebar.forms': 'Forms',
        'sidebar.benefits': 'Benefits',
        'sidebar.onboarding': 'Onboarding',
        'sidebar.recognition': 'Recognition',
        'sidebar.documents': 'Documents',
        'sidebar.ti_dashboard': 'IT Dashboard',
        'sidebar.my_tickets': 'My Tickets',
        'sidebar.request_equipment': 'Request Equipment',
        'sidebar.admin': 'Admin',
        'sidebar.corporate_intranet': 'Corporate Intranet',
        'header.search_placeholder': 'Search...',
        'header.profile': 'My Profile',
        'header.logout': 'Logout',
        'header.theme': 'Theme',
        'header.viewing_as': 'You are viewing the intranet of',
        'header.return_panel': 'Return to Panel',
        'theme.light': 'Light',
        'theme.dark': 'Dark',
        'language.select': 'Language',

        // Modules
        'users.title': 'Manage Users',
        'users.add': 'Add New User',
        'users.edit': 'Edit User',
        'users.name': 'Name',
        'users.email': 'Email',
        'users.password': 'Password',
        'users.role': 'Role',
        'users.team': 'Team',
        'users.admin': 'Is Admin?',
        'users.sector_manager': 'Sector Manager',
        'users.employee_manager': 'Employee Manager',
        'users.permissions_feed': 'Social Feed Permissions',
        'users.permissions_other': 'Other Permissions',
        'users.save': 'Save User',
        'users.cancel': 'Cancel',
        'users.actions': 'Actions',
        'users.limit_reached': 'User limit reached.',

        'forms.title': 'Forms Center',
        'forms.available': 'Available Forms',
        'forms.my_requests': 'My Requests',
        'forms.vacation': 'Vacation Request',
        'forms.vacation_desc': 'Plan and submit your vacation request.',
        'forms.start_request': 'Start Request',
        'forms.reimbursement': 'Expense Reimbursement',
        'forms.reimbursement_desc': 'Submit receipts for reimbursement.',
        'forms.data_change': 'Data Change',
        'forms.data_change_desc': 'Update address, phone, etc.',
        'forms.start_date': 'Start Date',
        'forms.end_date': 'End Date',
        'forms.reason': 'Reason (Optional)',
        'forms.submit': 'Submit Request',
        'forms.manager_sector': 'Sector Manager',
        'forms.manager_employee': 'Responsible Manager',

        'training.title': 'Training & Development',
        'training.start': 'Start Course',
        'training.duration': 'Duration',

        'kb.title': 'IT Knowledge Base',
        'kb.search_placeholder': 'How can we help? Search for tutorials, errors, access...',
        'kb.no_articles': 'No articles found.',

        'policies.title': 'Policies & Guidelines',
        'policies.download': 'Download',

        'status.title': 'Service Status',
        'status.overview': 'System Overview',
        'status.all_operational': 'All systems operational',
        'status.maintenance': 'Scheduled Maintenance',
        'status.operational': 'Operational',
        'status.outage': 'Outage',

        'generic.save': 'Save',
        'generic.cancel': 'Cancel',
        'generic.delete_confirm': 'Are you sure you want to delete this item?',
        'generic.new_item': 'New Item',
        'generic.edit_item': 'Edit Item',
    },
    es: {
        'sidebar.home': 'Inicio',
        'sidebar.feed': 'Feed Social',
        'sidebar.messages': 'Mensajes',
        'sidebar.calendar': 'Calendario',
        'sidebar.marketplace': 'Marketplace',
        'sidebar.wellbeing': 'Bienestar',
        'sidebar.directory': 'Directorio',
        'sidebar.forms': 'Formularios',
        'sidebar.benefits': 'Beneficios',
        'sidebar.onboarding': 'Onboarding',
        'sidebar.recognition': 'Reconocimiento',
        'sidebar.documents': 'Documentos',
        'sidebar.ti_dashboard': 'Panel de TI',
        'sidebar.my_tickets': 'Mis Tickets',
        'sidebar.request_equipment': 'Solicitar Equipo',
        'sidebar.admin': 'Admin',
        'sidebar.corporate_intranet': 'Intranet Corporativa',
        'header.search_placeholder': 'Buscar...',
        'header.profile': 'Mi Perfil',
        'header.logout': 'Salir',
        'header.theme': 'Tema',
        'header.viewing_as': 'Estás viendo la intranet de',
        'header.return_panel': 'Volver al Panel',
        'theme.light': 'Claro',
        'theme.dark': 'Oscuro',
        'language.select': 'Idioma',

        // Modules
        'users.title': 'Gestionar Usuarios',
        'users.add': 'Añadir Nuevo Usuario',
        'users.edit': 'Editar Usuario',
        'users.name': 'Nombre',
        'users.email': 'Correo',
        'users.password': 'Contraseña',
        'users.role': 'Cargo',
        'users.team': 'Equipo',
        'users.admin': '¿Es Administrador?',
        'users.sector_manager': 'Gestor del Sector',
        'users.employee_manager': 'Gerente del Empleado',
        'users.permissions_feed': 'Permisos de Feed Social',
        'users.permissions_other': 'Otros Permisos',
        'users.save': 'Guardar Usuario',
        'users.cancel': 'Cancelar',
        'users.actions': 'Acciones',
        'users.limit_reached': 'Límite de usuarios alcanzado.',

        'forms.title': 'Centro de Formularios',
        'forms.available': 'Formularios Disponibles',
        'forms.my_requests': 'Mis Solicitudes',
        'forms.vacation': 'Solicitud de Vacaciones',
        'forms.vacation_desc': 'Planifica y envía tu solicitud de vacaciones.',
        'forms.start_request': 'Iniciar Solicitud',
        'forms.reimbursement': 'Reembolso de Gastos',
        'forms.reimbursement_desc': 'Envía recibos para reembolso.',
        'forms.data_change': 'Cambio de Datos',
        'forms.data_change_desc': 'Actualiza dirección, teléfono, etc.',
        'forms.start_date': 'Fecha de Inicio',
        'forms.end_date': 'Fecha de Fin',
        'forms.reason': 'Motivo (Opcional)',
        'forms.submit': 'Enviar Solicitud',
        'forms.manager_sector': 'Gestor del Sector',
        'forms.manager_employee': 'Gerente Responsable',

        'training.title': 'Capacitación y Desarrollo',
        'training.start': 'Iniciar Curso',
        'training.duration': 'Duración',

        'kb.title': 'Base de Conocimientos TI',
        'kb.search_placeholder': '¿Cómo podemos ayudar? Busca tutoriales, errores, accesos...',
        'kb.no_articles': 'No se encontraron artículos.',

        'policies.title': 'Políticas y Directrices',
        'policies.download': 'Descargar',

        'status.title': 'Estado de los Servicios',
        'status.overview': 'Visión General del Sistema',
        'status.all_operational': 'Todos los sistemas operativos',
        'status.maintenance': 'Mantenimiento Programado',
        'status.operational': 'Operativo',
        'status.outage': 'Interrupción',

        'generic.save': 'Guardar',
        'generic.cancel': 'Cancelar',
        'generic.delete_confirm': '¿Estás seguro de que quieres eliminar este ítem?',
        'generic.new_item': 'Nuevo Ítem',
        'generic.edit_item': 'Editar Ítem',
    }
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguage] = useState<Language>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('language') as Language) || 'pt';
        }
        return 'pt';
    });

    useEffect(() => {
        localStorage.setItem('language', language);
    }, [language]);

    const t = (key: string): string => {
        // @ts-ignore
        return translations[language][key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
