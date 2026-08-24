import React, { useState, useRef } from 'react';
import { Bars3Icon, MagnifyingGlassIcon, BellIcon, Cog6ToothIcon, ArrowRightOnRectangleIcon, UserCircleIcon, ArrowPathIcon, PlayCircleIcon, SunIcon, MoonIcon, BugAntIcon, SparklesIcon } from './icons';
import type { Employee, Page } from '../types';
import { supabase } from '../supabaseClient';
import { useNotifications } from './NotificationContext';
import { useEffect } from 'react';

interface HeaderProps {
    onToggleSidebar: () => void;
    onToggleDebug?: () => void;
    currentUser: Employee;
    onLogout: () => void;
    onNavigate: (page: Page, context?: any) => void;
    isImpersonating: boolean;
    impersonatedCompanyName?: string;
    onEndImpersonation: () => void;
    onToggleNotifications: () => void;
    unreadNotificationsCount: number;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    onSearch?: (term: string) => void;
}

import { useLanguage } from './LanguageContext';

const Header: React.FC<HeaderProps> = ({ onToggleSidebar, onToggleDebug, currentUser, onLogout, onNavigate, isImpersonating, impersonatedCompanyName, onEndImpersonation, onToggleNotifications, unreadNotificationsCount, theme, toggleTheme, onSearch }) => {
    const [isDropdownOpen, setDropdownOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [searchResults, setSearchResults] = useState<{ type: 'menu' | 'user' | 'action', label: string, target: any, icon?: any }[]>([]);
    const { language, setLanguage, t } = useLanguage();
    const { testNotifications, availableSounds, selectedSound, changeSound } = useNotifications();
    const [profiles, setProfiles] = useState<any[]>([]);

    useEffect(() => {
        const fetchProfiles = async () => {
            const { data } = await supabase.from('profiles').select('id, full_name, role, avatar_url').eq('company_id', currentUser.company_id).limit(10);
            if (data) setProfiles(data);
        };
        fetchProfiles();
    }, [currentUser.company_id]);

    const menuItems = [
        { label: 'Home', target: 'home', icon: '🏠' },
        { label: 'Feed', target: 'feed', icon: '📰' },
        { label: 'Mensagens', target: 'messages', icon: '💬' },
        { label: 'WhatsPanda', target: 'whatspanda', icon: '🐼' },
        { label: 'CRM', target: 'crm-dashboard', icon: '💼' },
        { label: 'Calculadoras', target: 'ti-dashboard', icon: '🧮' },
        { label: 'Chamados', target: 'tickets', icon: '🎟️' },
        { label: 'Diretório', target: 'directory', icon: '👥' },
        { label: 'Documentos', target: 'documentos', icon: '📂' },
        { label: 'Perfil', target: 'profile-page', icon: '👤' },
    ];

    useEffect(() => {
        if (!searchTerm.trim()) {
            setSearchResults([]);
            setShowSearchResults(false);
            return;
        }

        const term = searchTerm.toLowerCase();
        const results: any[] = [];

        // Search Menus
        menuItems.forEach(item => {
            if (item.label.toLowerCase().includes(term)) {
                results.push({ type: 'menu', label: item.label, target: item.target, icon: item.icon });
            }
        });

        // Search Users
        profiles.forEach(p => {
            if (p.full_name?.toLowerCase().includes(term)) {
                results.push({ type: 'user', label: p.full_name, target: p.id, icon: '👤' });
            }
        });

        setSearchResults(results.slice(0, 8));
        setShowSearchResults(results.length > 0);
    }, [searchTerm, profiles]);

    const handleResultClick = (result: any) => {
        if (result.type === 'menu') onNavigate(result.target);
        else if (result.type === 'user') onNavigate('profile-page' as Page, { id: result.target });
        setSearchTerm('');
        setShowSearchResults(false);
    };

    // Sound Menu Logic with Delay
    const [isSoundMenuOpen, setSoundMenuOpen] = useState(false);
    const soundMenuTimer = useRef<any>(null);

    const handleSoundMenuEnter = () => {
        if (soundMenuTimer.current) clearTimeout(soundMenuTimer.current);
        setSoundMenuOpen(true);
    };

    const handleSoundMenuLeave = () => {
        soundMenuTimer.current = setTimeout(() => {
            setSoundMenuOpen(false);
        }, 500); // 0.5s delay
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (onSearch && searchTerm.trim()) {
            onSearch(searchTerm);
        }
    };

    return (
        <header className="sticky top-0 right-0 left-0 bg-white/70 backdrop-blur-md border-b flex-shrink-0 z-[60] dark:bg-[#020617]/60 dark:backdrop-blur-xl dark:border-white/5 transition-all duration-300">
            {isImpersonating && (
                <div className="bg-yellow-400 text-black py-2 px-6 text-sm flex items-center justify-center text-center">
                    <p className="font-semibold">
                        {t('header.viewing_as')} <span className="font-bold">{impersonatedCompanyName}</span>.
                    </p>
                    <button onClick={onEndImpersonation} className="ml-4 flex items-center space-x-1.5 px-3 py-1 bg-black/10 rounded-full hover:bg-black/20 transition-colors">
                        <ArrowPathIcon className="w-4 h-4" />
                        <span>{t('header.return_panel')}</span>
                    </button>
                </div>
            )}
            <div className="flex items-center justify-between h-20 px-6">
                <div className="flex items-center">
                    <button onClick={onToggleSidebar} className="p-2 -ml-2 text-gray-500 rounded-md hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
                        <Bars3Icon className="w-6 h-6" />
                    </button>
                    <div className="relative ml-6 hidden md:block group">
                        <MagnifyingGlassIcon className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-300 ${theme === 'dark' ? 'text-gray-500 group-focus-within:text-brand-primary' : 'text-gray-400'}`} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onFocus={() => setShowSearchResults(searchResults.length > 0)}
                            placeholder={t('header.search_placeholder')}
                            className="pl-11 pr-6 py-2.5 w-64 md:w-80 border-0 rounded-2xl bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 dark:bg-white/5 dark:text-white transition-all duration-300 hover:bg-gray-200 dark:hover:bg-white/10"
                        />
                        
                        {/* Search Results Dropdown */}
                        {showSearchResults && (
                            <div className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 z-[100]">
                                <div className="p-2 border-b border-gray-50 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">Resultados</span>
                                    <button onClick={() => setShowSearchResults(false)} className="text-[10px] h-5 w-5 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-white/10 text-gray-400">✕</button>
                                </div>
                                <div className="max-h-80 overflow-y-auto py-2">
                                    {searchResults.map((res, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleResultClick(res)}
                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-50 dark:hover:bg-white/5 transition-colors text-left group"
                                        >
                                            <span className="text-lg group-hover:scale-125 transition-transform">{res.icon}</span>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{res.label}</span>
                                                <span className="text-[10px] text-gray-400 uppercase font-medium">{res.type === 'menu' ? 'Navegação' : 'Usuário'}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>


                <div className="flex items-center space-x-4">
                    {/* Botão AI Assistant no Header */}
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('toggle-panda-ai'))}
                        className="p-2.5 text-brand-primary bg-brand-primary/5 hover:bg-brand-primary/10 dark:bg-emerald-500/10 dark:text-emerald-400 rounded-xl transition-all active:scale-95 group relative border border-brand-primary/10"
                        title="Abrir Assistente com IA"
                    >
                        <SparklesIcon className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                    </button>
                    {currentUser.email === 'ti@grupopixel.com.br' && (
                        <>
                            {/* Diagnóstico Master Admin - Agora no Header */}
                            <button
                                onClick={onToggleDebug}
                                className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all active:scale-95 group"
                                title="Painel de Diagnóstico Lateral"
                            >
                                <BugAntIcon className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                            </button>

                            {/* Botão de Verificação (Engrenagem) - Redireciona para página de diagnóstico */}
                            <button
                                onClick={() => onNavigate('diagnostics' as Page)}
                                className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all active:scale-95 group"
                                title="Página de Diagnóstico"
                            >
                                <Cog6ToothIcon className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
                            </button>
                            
                            <button
                                onClick={() => window.location.reload()}
                                className="p-2 text-gray-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                                title="Recarregar"
                            >
                                <ArrowPathIcon className="w-5 h-5 text-red-400" />
                            </button>
                        </>
                    )}

                    {/* Botão de Ativar Sons + Selector */}
                    <div className="flex items-center">
                        <button
                            onClick={testNotifications}
                            className="flex items-center justify-center gap-1.5 h-8 px-3 bg-emerald-50 text-emerald-600 rounded-l-full hover:bg-emerald-100 transition-all text-xs font-bold border-y border-l border-emerald-200"
                            title="Ativar e Testar Notificações do Windows"
                        >
                            <PlayCircleIcon className="w-4 h-4" />
                            <span className="hidden sm:inline">{t('header.notifications_activate')}</span>
                        </button>
                        <div
                            className="relative"
                            onMouseEnter={handleSoundMenuEnter}
                            onMouseLeave={handleSoundMenuLeave}
                        >
                            <button className="flex items-center justify-center w-8 h-8 bg-emerald-50 text-emerald-600 rounded-r-full hover:bg-emerald-100 border border-emerald-200">
                                <span className="text-[10px]">▼</span>
                            </button>
                            {/* Dropdown de Sons */}
                            {isSoundMenuOpen && (
                                <div className="absolute right-0 top-full pt-4 w-48 z-[100] animate-fade-in-down">
                                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                                        <div className="p-2 text-xs font-semibold text-gray-500 bg-gray-50 dark:bg-gray-700/50 uppercase tracking-wider">
                                            {t('header.notifications_choose_sound')}
                                        </div>
                                        {availableSounds?.map((sound) => (
                                            <button
                                                key={sound.id}
                                                onClick={() => changeSound(sound.id)}
                                                className={`w-full text-left px-4 py-2 text-sm hover:bg-emerald-50 dark:hover:bg-gray-700 flex items-center justify-between ${selectedSound === sound.id ? 'text-emerald-600 font-bold bg-emerald-50/50' : 'text-gray-700 dark:text-gray-200'}`}
                                            >
                                                <span>{sound.name}</span>
                                                {selectedSound === sound.id && <span className="text-emerald-500">✓</span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Botão de Tema (Sol/Lua) */}
                    <button
                        onClick={toggleTheme}
                        className="p-2 text-gray-500 rounded-full hover:bg-gray-100 transition-colors dark:text-gray-400 dark:hover:bg-gray-700"
                        title={theme === 'light' ? t('theme.dark') : t('theme.light')}
                    >
                        {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
                    </button>

                    {/* Botão de Idioma (Ciclo PT -> EN -> ES) com Bandeiras */}
                    <button
                        onClick={() => {
                            const langs: ('pt' | 'en' | 'es')[] = ['pt', 'en', 'es'];
                            const next = langs[(langs.indexOf(language) + 1) % langs.length];
                            setLanguage(next);
                        }}
                        className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-lg hover:bg-gray-200 transition-all dark:bg-gray-700 dark:hover:bg-gray-600"
                        title={t('language.select')}
                    >
                        {language === 'pt' ? (
                            <img src="https://flagcdn.com/w40/br.png" alt="Brasil" className="w-5 h-auto rounded-sm shadow-sm" />
                        ) : language === 'en' ? (
                            <img src="https://flagcdn.com/w40/us.png" alt="USA" className="w-5 h-auto rounded-sm shadow-sm" />
                        ) : (
                            <img src="https://flagcdn.com/w40/es.png" alt="Spain" className="w-5 h-auto rounded-sm shadow-sm" />
                        )}
                    </button>

                    <button onClick={onToggleNotifications} className="p-2 text-gray-500 rounded-full hover:bg-gray-100 relative dark:text-gray-400 dark:hover:bg-gray-700">
                        <BellIcon className="w-6 h-6" />
                        {unreadNotificationsCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-sm px-1">
                                {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                            </span>
                        )}
                    </button>
                    <div className="relative">
                        <button onClick={() => setDropdownOpen(!isDropdownOpen)} className="flex items-center space-x-2">
                            <img src={currentUser.avatarUrl} alt="User" className="w-10 h-10 rounded-full" />
                            <div className="hidden lg:block text-left">
                                <p className="font-semibold text-sm text-brand-text dark:text-gray-100">{currentUser.name}</p>
                                <p className="text-xs text-brand-subtle-text dark:text-gray-400">{currentUser.role}</p>
                            </div>
                        </button>
                        {isDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-56 bg-white rounded-md shadow-lg py-1 z-[100] dark:bg-gray-800 dark:border dark:border-gray-700">
                                <button type="button" onClick={() => { onNavigate('profile-page'); setDropdownOpen(false); }} className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 text-left">
                                    <UserCircleIcon className="w-5 h-5 mr-2" /> {t('header.profile')}
                                </button>
                                {currentUser.isAdmin && !isImpersonating && (
                                    <button type="button" onClick={() => { onNavigate('admin'); setDropdownOpen(false); }} className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 text-left">
                                        <Cog6ToothIcon className="w-5 h-5 mr-2" /> {t('sidebar.admin')}
                                    </button>
                                )}
                                <button type="button" onClick={() => { onLogout(); }} className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 text-left">
                                    <ArrowRightOnRectangleIcon className="w-5 h-5 mr-2" /> {t('header.logout')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
