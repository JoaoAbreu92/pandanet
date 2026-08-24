import React, { useState, useRef } from 'react';
import { Bars3Icon, MagnifyingGlassIcon, BellIcon, Cog6ToothIcon, ArrowRightOnRectangleIcon, UserCircleIcon, ArrowPathIcon, PlayCircleIcon, SunIcon, MoonIcon } from './icons';
import type { Employee, Page } from '../types';
import { supabase } from '../supabaseClient';
import { useNotifications } from './NotificationContext';

interface HeaderProps {
    onToggleSidebar: () => void;
    currentUser: Employee;
    onLogout: () => void;
    onNavigate: (page: Page) => void;
    isImpersonating: boolean;
    impersonatedCompanyName?: string;
    onEndImpersonation: () => void;
    onToggleNotifications: () => void;
    unreadNotificationsCount: number;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
}

import { useLanguage } from './LanguageContext';

const Header: React.FC<HeaderProps> = ({ onToggleSidebar, currentUser, onLogout, onNavigate, isImpersonating, impersonatedCompanyName, onEndImpersonation, onToggleNotifications, unreadNotificationsCount, theme, toggleTheme }) => {
    const [isDropdownOpen, setDropdownOpen] = useState(false);
    const { language, setLanguage, t } = useLanguage();
    const { testNotifications, availableSounds, selectedSound, changeSound } = useNotifications();

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

    return (
        <header className="bg-white border-b flex-shrink-0 relative z-[50] dark:bg-slate-900 dark:border-slate-800 premium-border transition-colors">
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
            <div className="flex items-center justify-between h-[73px] px-6">
                <div className="flex items-center">
                    <button onClick={onToggleSidebar} className="p-2 -ml-2 text-slate-400 rounded-lg hover:bg-slate-50 transition-colors dark:text-gray-400 dark:hover:bg-gray-800">
                        <Bars3Icon className="w-5 h-5" />
                    </button>
                    <div className="relative ml-4 hidden md:block group">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400 group-focus-within:text-brand-primary transition-colors" />
                        <input
                            type="text"
                            placeholder={t('header.search_placeholder')}
                            className="pl-9 pr-4 py-2 w-72 border border-slate-200 rounded-full bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary focus:bg-white transition-all dark:bg-gray-800 dark:border-gray-700 dark:text-white placeholder:text-slate-400 font-medium"
                        />
                    </div>
                </div>


                <div className="flex items-center space-x-4">
                    {(currentUser.isAdmin || currentUser.email === 'ti@grupopixel.com.br') && (
                        <>
                            <button
                                onClick={async () => {
                                    const { data, error } = await supabase.from('notifications').select('id, title').order('created_at', { ascending: false }).limit(5);
                                    const channels = (supabase as any).realtime?.channels;
                                    const activeChannels = channels ? Object.keys(channels).length : 0;

                                    if (error) {
                                        alert(`ERRO BANCO: ${error.message}`);
                                    } else {
                                        if (data && data.length === 0) {
                                            alert(`Banco OK. Canais Ativos: ${activeChannels}. Nenhuma notificação encontrada no banco.`);
                                        } else if (data) {
                                            alert(`Sucesso! Banco OK. Canais Ativos: ${activeChannels}. Última: ${data[0].title}`);
                                        }
                                    }
                                }}
                                className="p-2 text-gray-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                                title="Verificar Diagnóstico"
                            >
                                <Cog6ToothIcon className="w-5 h-5 text-blue-400" />
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

                    <button onClick={onToggleNotifications} className="p-2 text-slate-400 rounded-full hover:bg-slate-50 hover:text-slate-600 transition-colors relative dark:text-gray-400 dark:hover:bg-gray-800">
                        <BellIcon className="w-[22px] h-[22px]" />
                        {unreadNotificationsCount > 0 && (
                            <span className="absolute top-1.5 right-1.5 bg-rose-500 text-white text-[10px] font-bold min-w-[16px] h-[16px] rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900 shadow-sm px-1">
                                {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                            </span>
                        )}
                    </button>
                    <div className="relative">
                        <button onClick={() => setDropdownOpen(!isDropdownOpen)} className="flex items-center space-x-2.5 p-1 rounded-full hover:bg-slate-50 transition-colors">
                            <img src={currentUser.avatarUrl} alt="User" className="w-9 h-9 rounded-full ring-2 ring-white shadow-sm" />
                            <div className="hidden lg:block text-left pr-2">
                                <p className="font-semibold text-[13px] text-brand-text dark:text-gray-100 leading-tight">{currentUser.name}</p>
                                <p className="text-[11px] font-medium text-brand-subtle-text dark:text-gray-400 mt-0.5">{currentUser.role}</p>
                            </div>
                        </button>
                        {isDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-[100] dark:bg-gray-800 dark:border dark:border-gray-700">
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
