import React, { useState, useRef } from 'react';
import { Bars3Icon, MagnifyingGlassIcon, BellIcon, Cog6ToothIcon, ArrowRightOnRectangleIcon, UserCircleIcon, ArrowPathIcon, PlayCircleIcon } from './icons';
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
        <header className="bg-white border-b flex-shrink-0 relative z-[60] dark:bg-gray-800 dark:border-gray-700 premium-card">
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
                    <div className="relative ml-6 hidden md:block">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder={t('header.search_placeholder')}
                            className="pl-10 pr-4 py-2 w-64 border rounded-full bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
                    <div className="flex items-center gap-1">
                        <button
                            onClick={testNotifications}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-l-full hover:bg-emerald-100 transition-all text-xs font-bold border border-emerald-200"
                            title="Testar Sons e Notificações"
                        >
                            <PlayCircleIcon className="w-4 h-4" />
                            <span className="hidden sm:inline">Ativar Toques</span>
                        </button>

                        <div
                            className="relative"
                            onMouseEnter={handleSoundMenuEnter}
                            onMouseLeave={handleSoundMenuLeave}
                        >
                            <button className="px-2 py-1.5 bg-emerald-50 text-emerald-600 rounded-r-full hover:bg-emerald-100 border-t border-b border-r border-emerald-200">
                                <span className="text-xs">▼</span>
                            </button>
                            {/* Dropdown de Sons */}
                            {isSoundMenuOpen && (
                                <div className="absolute right-0 top-full pt-4 w-48 z-[100] animate-fade-in-down">
                                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                                        <div className="p-2 text-xs font-semibold text-gray-500 bg-gray-50 dark:bg-gray-700/50 uppercase tracking-wider">
                                            Escolher Toque
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
                                <p className="font-semibold text-sm text-brand-text dark:text-gray-200">{currentUser.name}</p>
                                <p className="text-xs text-brand-subtle-text dark:text-gray-400">{currentUser.role}</p>
                            </div>
                        </button>
                        {isDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-[100] dark:bg-gray-800 dark:border dark:border-gray-700">

                                <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                                    <p className="text-xs text-gray-500 mb-2 dark:text-gray-400">{t('language.select')}</p>
                                    <div className="flex items-center justify-between bg-gray-100 rounded-lg p-1 dark:bg-gray-700 space-x-1">
                                        {(['pt', 'en', 'es'] as const).map((lang) => (
                                            <button
                                                key={lang}
                                                onClick={() => setLanguage(lang)}
                                                className={`flex-1 text-xs py-1 rounded-md transition-colors flex items-center justify-center ${language === lang ? 'bg-white shadow-sm text-brand-primary font-medium dark:bg-gray-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                                            >
                                                {lang.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button type="button" onClick={() => { onNavigate('profile'); setDropdownOpen(false); }} className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 text-left">
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
