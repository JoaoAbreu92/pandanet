import React, { useState, useRef } from 'react';
import { Bars3Icon, MagnifyingGlassIcon, BellIcon, Cog6ToothIcon, ArrowRightOnRectangleIcon, UserCircleIcon, ArrowPathIcon, PlayCircleIcon, SunIcon, MoonIcon, BugAntIcon, SparklesIcon } from './icons';
import type { Employee, Page } from '../types';
import { supabase } from '../supabaseClient';
import { useNotifications } from './NotificationContext';
import { useEffect } from 'react';
import { UserAvatar } from './UserAvatar';
import { PAGE_LABELS } from '../utils/navigation';

interface HeaderProps {
    currentPage: Page;
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

const Header: React.FC<HeaderProps> = ({ currentPage, onToggleSidebar, onToggleDebug, currentUser, onLogout, onNavigate, isImpersonating, impersonatedCompanyName, onEndImpersonation, onToggleNotifications, unreadNotificationsCount, theme, toggleTheme, onSearch }) => {
    const [isDropdownOpen, setDropdownOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [searchResults, setSearchResults] = useState<{ type: 'menu' | 'user' | 'action', label: string, target: any, icon?: any }[]>([]);
    const { language, setLanguage, t } = useLanguage();
    const { testNotifications, availableSounds, selectedSound, changeSound } = useNotifications();
    const [profiles, setProfiles] = useState<any[]>([]);
    const [isMobileSoundSelectorOpen, setIsMobileSoundSelectorOpen] = useState(false);

    useEffect(() => {
        if (!isDropdownOpen) {
            setIsMobileSoundSelectorOpen(false);
        }
    }, [isDropdownOpen]);

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
        <header className={`pandanet-topbar sticky left-0 right-0 top-0 flex-shrink-0 border-b border-white/10 bg-[#0b1727]/95 text-white shadow-[0_12px_35px_-28px_rgba(2,8,23,0.95)] backdrop-blur-xl ${isDropdownOpen || isSoundMenuOpen || showSearchResults ? 'z-[9999]' : 'z-30'}`}>
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
            <div className="flex h-16 items-center justify-between gap-3 px-3 sm:px-5 lg:px-6">
                <div className="flex min-w-0 items-center">
                    <button onClick={onToggleSidebar} className="-ml-1 rounded-xl border border-transparent p-2 text-slate-500 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:hover:border-white/10 dark:hover:bg-white/5" aria-label="Abrir ou recolher menu">
                        <Bars3Icon className="h-5 w-5" />
                    </button>
                    <div className="ml-3 hidden min-w-0 border-l border-slate-200 pl-4 dark:border-white/10 sm:block">
                        <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">PandaNet</p>
                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{PAGE_LABELS[currentPage] || 'Área de trabalho'}</p>
                    </div>
                    <div className="relative ml-5 hidden lg:block group">
                        <MagnifyingGlassIcon className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-300 ${theme === 'dark' ? 'text-gray-500 group-focus-within:text-brand-primary' : 'text-gray-400'}`} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onFocus={() => setShowSearchResults(searchResults.length > 0)}
                            placeholder={t('header.search_placeholder')}
                            className="w-64 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm outline-none placeholder:text-slate-400 focus:border-brand-primary/50 focus:bg-white focus:ring-4 focus:ring-brand-primary/10 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:bg-white/10 xl:w-80"
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


                <div className="flex items-center gap-1.5 sm:gap-2">
                    {/* Botão AI Assistant no Header */}
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('toggle-panda-ai'))}
                        className="hidden lg:flex p-2.5 text-brand-primary bg-brand-primary/5 hover:bg-brand-primary/10 dark:bg-emerald-500/10 dark:text-emerald-400 rounded-xl transition-all active:scale-95 group relative border border-brand-primary/10"
                        title="Abrir Assistente com IA"
                    >
                        <SparklesIcon className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                    </button>
                    {currentUser.email === 'ti@grupopixel.com.br' && (
                        <div className="hidden lg:flex items-center space-x-2">
                             {/* Diagnóstico Master Admin - Agora no Header */}
                            <button
                                onClick={onToggleDebug}
                                className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all active:scale-95 group"
                                title="Painel de Diagnóstico Lateral"
                            >
                                < BugAntIcon className="w-6 h-6 group-hover:rotate-12 transition-transform" />
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
                        </div>
                    )}

                    {/* Central premium de sons e notificacoes */}
                    <div
                        className="relative hidden lg:block"
                        onMouseEnter={handleSoundMenuEnter}
                        onMouseLeave={handleSoundMenuLeave}
                    >
                        <button
                            type="button"
                            onClick={() => setSoundMenuOpen((open) => !open)}
                            className={`group relative flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${isSoundMenuOpen
                                ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-300 shadow-[0_8px_24px_-12px_rgba(0,214,143,.9)]'
                                : 'border-white/10 bg-white/[0.06] text-slate-300 hover:-translate-y-0.5 hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-emerald-300'
                                }`}
                            title="Sons e notificações"
                            aria-label="Abrir sons e notificações"
                            aria-expanded={isSoundMenuOpen}
                        >
                            <BellIcon className="h-[18px] w-[18px]" />
                            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 ring-2 ring-[#0b1727]" />
                        </button>

                        {isSoundMenuOpen && (
                            <div className="absolute right-0 top-full z-[100] w-72 pt-3 animate-fade-in-down">
                                <div className="pandanet-topbar-menu overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_-24px_rgba(15,23,42,.45)] dark:border-white/10 dark:bg-slate-900">
                                    <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
                                        <p className="text-sm font-bold text-gray-800 dark:text-white">Sons e notificações</p>
                                        <p className="mt-0.5 text-[11px] text-gray-500 dark:text-slate-400">Escolha o toque usado nos alertas.</p>
                                    </div>
                                    <div className="space-y-1 p-2">
                                        {availableSounds?.map((sound) => (
                                            <button
                                                key={sound.id}
                                                type="button"
                                                onClick={() => changeSound(sound.id)}
                                                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${selectedSound === sound.id
                                                    ? 'bg-emerald-50 font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300'
                                                    : 'text-gray-700 hover:bg-slate-100 dark:text-gray-200 dark:hover:bg-white/[0.06]'
                                                    }`}
                                            >
                                                <span>{sound.name}</span>
                                                <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${selectedSound === sound.id ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 text-transparent dark:border-slate-700'}`}>✓</span>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="border-t border-slate-100 p-2 dark:border-white/10">
                                        <button
                                            type="button"
                                            onClick={testNotifications}
                                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-bold text-white transition-all hover:bg-emerald-600 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
                                        >
                                            <PlayCircleIcon className="h-4 w-4" />
                                            Testar notificação
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Botão de Tema (Sol/Lua) */}
                    <button
                        onClick={toggleTheme}
                        className="hidden lg:flex p-2 text-gray-500 rounded-full hover:bg-gray-100 transition-colors dark:text-gray-400 dark:hover:bg-gray-700"
                        title={theme === 'light' ? t('theme.mode_dark') : t('theme.mode_light')}
                    >
                        {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
                    </button>

                    {/* Botão de Idioma (Ciclo PT -> EN -> ES) com Bandeiras */}
                    <div className="hidden lg:flex">
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
                    </div>

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
                            <UserAvatar src={currentUser.avatarUrl} name={currentUser.name} level={currentUser.level} size="sm" />
                            <div className="hidden lg:block text-left">
                                <p className="font-semibold text-sm text-brand-text dark:text-gray-100">{currentUser.name}</p>
                                <p className="text-xs text-brand-subtle-text dark:text-gray-400">{currentUser.role}</p>
                            </div>
                        </button>
                        {isDropdownOpen && (
                             <div className="pandanet-topbar-menu absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-64 bg-white rounded-2xl shadow-2xl py-2 z-[10000] dark:bg-gray-800 border border-gray-100 dark:border-white/5 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                                 {isMobileSoundSelectorOpen ? (
                                     <div className="px-2 py-1 space-y-1">
                                         <button
                                             type="button"
                                             onClick={() => setIsMobileSoundSelectorOpen(false)}
                                             className="w-full flex items-center px-2 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                         >
                                             ← Voltar
                                         </button>
                                         <div className="p-1.5 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                             {t('header.notifications_choose_sound')}
                                         </div>
                                         {availableSounds?.map((sound) => (
                                             <button
                                                 key={sound.id}
                                                 type="button"
                                                 onClick={() => { changeSound(sound.id); }}
                                                 className={`w-full text-left px-3 py-1.5 rounded-xl text-xs flex items-center justify-between transition-all ${selectedSound === sound.id ? 'text-emerald-600 font-semibold bg-emerald-50/50' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5'}`}
                                             >
                                                 <span>{sound.name}</span>
                                                 {selectedSound === sound.id && <span className="text-emerald-500">✓</span>}
                                             </button>
                                         ))}
                                     </div>
                                 ) : (
                                     <>
                                         <div className="px-4 py-3 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 lg:hidden">
                                             <p className="font-semibold text-sm text-gray-800 dark:text-white">{currentUser.name}</p>
                                             <p className="text-[10px] text-gray-500 uppercase font-semibold tracking-widest">{currentUser.role}</p>
                                         </div>

                                         <button type="button" onClick={() => { onNavigate('profile-page'); setDropdownOpen(false); }} className="w-full flex items-center px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-emerald-50 dark:text-gray-200 dark:hover:bg-white/5 text-left">
                                             <UserCircleIcon className="w-5 h-5 mr-3 text-emerald-500" /> {t('header.profile')}
                                         </button>

                                         <button type="button" onClick={() => { onNavigate('personal-notes' as Page); setDropdownOpen(false); }} className="w-full flex items-center px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-emerald-50 dark:text-gray-200 dark:hover:bg-white/5 text-left border-t border-gray-50 dark:border-white/5 lg:border-t-0">
                                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-3 text-amber-500">
                                                 <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                             </svg>
                                             {language === 'pt' ? 'Notas Pessoais' : language === 'en' ? 'Personal Notes' : 'Notas Personales'}
                                         </button>

                                         <button type="button" onClick={() => { onNavigate('personal-tasks' as Page); setDropdownOpen(false); }} className="w-full flex items-center px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-emerald-50 dark:text-gray-200 dark:hover:bg-white/5 text-left">
                                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-3 text-emerald-500">
                                                 <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                             </svg>
                                             {language === 'pt' ? 'Minhas Tarefas' : language === 'en' ? 'My Tasks' : 'Mis Tareas'}
                                         </button>

                                         <button type="button" onClick={() => { onNavigate('manual-usuario' as Page); setDropdownOpen(false); }} className="w-full flex items-center px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-emerald-50 dark:text-gray-200 dark:hover:bg-white/5 text-left">
                                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-3 text-blue-500">
                                                 <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                                             </svg>
                                             {language === 'pt' ? 'Manual do Usuário' : language === 'en' ? 'User Manual' : 'Manual del Usuario'}
                                         </button>

                                         {/* Mobile Only Items */}
                                         <div className="lg:hidden border-t border-gray-50 dark:border-white/5 mt-1 pt-1">
                                             <button type="button" onClick={toggleTheme} className="w-full flex items-center px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-emerald-50 dark:text-gray-200 dark:hover:bg-white/5 text-left">
                                                 {theme === 'light' ? <MoonIcon className="w-5 h-5 mr-3 text-slate-500" /> : <SunIcon className="w-5 h-5 mr-3 text-yellow-500" />} {theme === 'light' ? t('theme.mode_dark') : t('theme.mode_light')}
                                             </button>
                                             <button type="button" onClick={() => { const langs: ('pt' | 'en' | 'es')[] = ['pt', 'en', 'es']; setLanguage(langs[(langs.indexOf(language) + 1) % langs.length]); }} className="w-full flex items-center px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-emerald-50 dark:text-gray-200 dark:hover:bg-white/5 text-left">
                                                 <SparklesIcon className="w-5 h-5 mr-3 text-blue-500" /> {t('language.label')}: {language.toUpperCase()}
                                             </button>
                                             <button type="button" onClick={() => { window.dispatchEvent(new CustomEvent('toggle-panda-ai')); setDropdownOpen(false); }} className="w-full flex items-center px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-emerald-50 dark:text-gray-200 dark:hover:bg-white/5 text-left">
                                                 <SparklesIcon className="w-5 h-5 mr-3 text-brand-primary" /> Panda IA
                                             </button>
                                             <button type="button" onClick={() => setIsMobileSoundSelectorOpen(true)} className="w-full flex items-center px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-emerald-50 dark:text-gray-200 dark:hover:bg-white/5 text-left">
                                                 <BellIcon className="w-5 h-5 mr-3 text-orange-500" /> {t('header.notifications_choose_sound')}
                                             </button>
                                         </div>

                                         {(currentUser.isAdmin || currentUser.isCompanyAdmin || currentUser.role === 'Super Admin') && !isImpersonating && (
                                             <button type="button" onClick={() => { onNavigate('admin'); setDropdownOpen(false); }} className="w-full flex items-center px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-emerald-50 dark:text-gray-200 dark:hover:bg-white/5 text-left border-t border-gray-50 dark:border-white/5 mt-1">
                                                 <Cog6ToothIcon className="w-5 h-5 mr-3 text-slate-500" /> {t('sidebar.admin')}
                                             </button>
                                         )}

                                         <button type="button" onClick={() => { onLogout(); }} className="w-full flex items-center px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/10 text-left border-t border-gray-50 dark:border-white/5 mt-1">
                                             <ArrowRightOnRectangleIcon className="w-5 h-5 mr-3" /> {t('header.logout')}
                                         </button>
                                     </>
                                 )}
                             </div>
                         )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
