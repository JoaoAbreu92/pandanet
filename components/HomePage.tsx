import React from 'react';
import Announcements from './Announcements';
import UpcomingEvents from './UpcomingEvents';
import Carousel from './Carousel';
import RecognitionWall from './RecognitionWall';
import CompanyPoll from './CompanyPoll';
import QuickLinks from './QuickLinks';
// FIX: Correcting the import path for types.
import type { Employee, AppData } from '../types';
import Card from './Card';
import { GiftIcon, UserPlusIcon } from './icons';

interface HomePageProps {
    onNavigate: (page: string, context?: any) => void;
    companyData: AppData;
}

const Birthdays: React.FC<{ employees: Employee[] }> = ({ employees }) => {
    const currentMonth = new Date().getMonth() + 1;
    const upcomingBirthdays = employees.filter(e => {
        const birthMonth = new Date(e.birthDate).getUTCMonth() + 1;
        return birthMonth === currentMonth;
    }).sort((a, b) => new Date(a.birthDate).getUTCDate() - new Date(b.birthDate).getUTCDate());

    return (
        <Card title="Aniversariantes do Mês">
            {upcomingBirthdays.length > 0 ? (
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                    {upcomingBirthdays.map(employee => (
                        <div key={employee.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50">
                            <img src={employee.avatarUrl} alt={employee.name} className="w-10 h-10 rounded-full" />
                            <div>
                                <p className="font-semibold text-sm text-brand-text">{employee.name}</p>
                                <p className="text-xs text-brand-subtle-text">
                                    <GiftIcon className="w-3 h-3 inline-block mr-1" />
                                    {new Date(employee.birthDate).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' })}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-brand-subtle-text">Nenhum aniversário este mês.</p>
            )}
        </Card>
    );
};

const NewHires: React.FC<{ employees: Employee[] }> = ({ employees }) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newHires = employees.filter(e => new Date(e.joinDate) >= thirtyDaysAgo).sort((a, b) => new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime());

    return (
        <Card title="Boas-vindas!">
            {newHires.length > 0 ? (
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                    {newHires.map(employee => (
                        <div key={employee.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50">
                            <img src={employee.avatarUrl} alt={employee.name} className="w-10 h-10 rounded-full" />
                            <div>
                                <p className="font-semibold text-sm text-brand-text">{employee.name}</p>
                                <p className="text-xs text-brand-subtle-text">{employee.role}, {employee.team}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    <UserPlusIcon className="w-3 h-3 inline-block mr-1" />
                                    Entrou em {new Date(employee.joinDate).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' })}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-brand-subtle-text">Nenhum novo colaborador recentemente.</p>
            )}
        </Card>
    );
};


interface HomePageProps {
    onNavigate: (page: string, context?: any) => void;
    employees: Employee[];
}

const HomePage: React.FC<HomePageProps> = ({ onNavigate, employees }) => {
    return (
        <div className="space-y-8">
            <Carousel />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Column */}
                <div className="lg:col-span-2 space-y-8">
                    <Announcements onNavigate={onNavigate} />
                    <RecognitionWall />
                </div>
                {/* Right Sidebar */}
                <div className="space-y-8">
                    <QuickLinks onNavigate={onNavigate} />
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