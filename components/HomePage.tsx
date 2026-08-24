import React, { useState, useEffect } from 'react';
import Announcements from './Announcements';
import UpcomingEvents from './UpcomingEvents';
import Carousel from './Carousel';
import RecognitionWall from './RecognitionWall';
import CompanyPoll from './CompanyPoll';
import QuickLinks from './QuickLinks';
import { supabase } from '../supabaseClient';
// FIX: Correcting the import path for types.
import type { Employee, AppData } from '../types';
import Card from './Card';
import { GiftIcon, UserPlusIcon } from './icons';

interface HomePageProps {
    onNavigate: (page: string, context?: any) => void;
    employees: Employee[];
    currentUser: Employee;
}

import { useLanguage } from './LanguageContext';

const Birthdays: React.FC<{ employees: Employee[] }> = ({ employees }) => {
    const { t } = useLanguage();
    const currentMonth = new Date().getMonth() + 1;
    const upcomingBirthdays = employees.filter(e => {
        const birthMonth = new Date(e.birthDate).getUTCMonth() + 1;
        return birthMonth === currentMonth;
    }).sort((a, b) => new Date(a.birthDate).getUTCDate() - new Date(b.birthDate).getUTCDate());

    return (
        <Card title={t('home.birthdays_title') || 'Aniversariantes do Mês'}>
            {upcomingBirthdays.length > 0 ? (
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                    {upcomingBirthdays.map(employee => (
                        <div key={employee.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <img src={employee.avatarUrl} alt={employee.name} className="w-10 h-10 rounded-full" />
                            <div>
                                <p className="font-semibold text-sm text-brand-text dark:text-gray-100">{employee.name}</p>
                                <p className="text-xs text-brand-subtle-text dark:text-gray-400">
                                    <GiftIcon className="w-3 h-3 inline-block mr-1" />
                                    {new Date(employee.birthDate).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' })}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                    <p className="text-sm text-brand-subtle-text dark:text-gray-500">{t('home.birthdays_none') || 'Nenhum aniversário este mês.'}</p>
            )}
        </Card>
    );
};

const NewHires: React.FC<{ employees: Employee[] }> = ({ employees }) => {
    const { t } = useLanguage();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newHires = employees.filter(e => new Date(e.joinDate) >= thirtyDaysAgo).sort((a, b) => new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime());

    return (
        <Card title={t('home.welcome_title') || 'Boas-vindas!'}>
            {newHires.length > 0 ? (
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                    {newHires.map(employee => (
                        <div key={employee.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <img src={employee.avatarUrl} alt={employee.name} className="w-10 h-10 rounded-full" />
                            <div>
                                <p className="font-semibold text-sm text-brand-text dark:text-gray-100">{employee.name}</p>
                                <p className="text-xs text-brand-subtle-text dark:text-gray-400">{employee.role}, {employee.team}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                    <UserPlusIcon className="w-3 h-3 inline-block mr-1" />
                                    Entrou em {new Date(employee.joinDate).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' })}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                    <p className="text-sm text-brand-subtle-text dark:text-gray-500">{t('home.welcome_none') || 'Nenhum novo colaborador recentemente.'}</p>
            )}
        </Card>
    );
};

const HomePage: React.FC<HomePageProps> = ({ onNavigate, employees, currentUser }) => {
    const [masterBanner, setMasterBanner] = useState<any>(null);

    useEffect(() => {
        const fetchMasterBanner = async () => {
            try {
                const { data } = await supabase.from('system_settings').select('value').eq('key', 'master_banner').single();
                if (data?.value) {
                    setMasterBanner(JSON.parse(data.value));
                }
            } catch (error) {
                console.error('Error fetching master banner', error);
            }
        };
        fetchMasterBanner();
    }, []);

    return (
        <div className="space-y-8">
            <Carousel />
            
            {masterBanner?.isActive && masterBanner?.imageUrl && (
                <div className="w-full">
                    {masterBanner.link ? (
                        <a href={masterBanner.link} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden rounded-xl shadow-md border border-gray-100 dark:border-gray-800">
                            <img src={masterBanner.imageUrl} alt="Anúncio Especial" className="w-full h-auto object-cover max-h-[300px] transition-transform duration-500 group-hover:scale-[1.01]" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300"></div>
                        </a>
                    ) : (
                        <div className="block relative overflow-hidden rounded-xl shadow-md border border-gray-100 dark:border-gray-800">
                            <img src={masterBanner.imageUrl} alt="Anúncio Especial" className="w-full h-auto object-cover max-h-[300px]" />
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Column */}
                <div className="lg:col-span-2 space-y-8">
                    <Announcements onNavigate={onNavigate} />
                    <RecognitionWall />
                </div>
                {/* Right Sidebar */}
                <div className="space-y-8">
                    <QuickLinks onNavigate={onNavigate} currentUser={currentUser} />
                    <CompanyPoll />
                    <Birthdays employees={employees} />
                    <NewHires employees={employees} />
                    <UpcomingEvents />
                </div>
            </div>
        </div>
    );
};

export default HomePage;