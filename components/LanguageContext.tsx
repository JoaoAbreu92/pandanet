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
