import React, { useState } from 'react';
import type { Company } from '../types';
import { useLanguage } from './LanguageContext';
import Card from './Card';
import {
    BuildingOfficeIcon,
    UsersIcon,
    CurrencyDollarIcon,
    ChartBarIcon,
    PlusIcon,
    ArrowRightOnRectangleIcon
} from './icons';

interface SaaSDashboardProps {
    companies: Company[];
}

const SaaSDashboard: React.FC<SaaSDashboardProps> = ({ companies }) => {
    const { t } = useLanguage();
    const [selectedMetric, setSelectedMetric] = useState<'users' | 'revenue'>('users');

    const totalUsers = companies.reduce((acc, company) => acc + company.employees.length, 0);
    const activeCompanies = companies.length;
    // Mock revenue calculation
    const totalRevenue = activeCompanies * 299; // Mock pricing

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Painel Super Admin SaaS</h1>
                    <p className="text-gray-500 dark:text-gray-400">Gerenciamento global da plataforma</p>
                </div>
                <button className="flex items-center px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors">
                    <PlusIcon className="w-5 h-5 mr-2" />
                    Nova Empresa
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-blue-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Empresas Ativas</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeCompanies}</p>
                        </div>
                        <BuildingOfficeIcon className="w-8 h-8 text-blue-500 opacity-20" />
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-green-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total de Usuários</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalUsers}</p>
                        </div>
                        <UsersIcon className="w-8 h-8 text-green-500 opacity-20" />
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-purple-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Receita Mensal (Estimada)</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">R$ {totalRevenue.toLocaleString('pt-BR')}</p>
                        </div>
                        <CurrencyDollarIcon className="w-8 h-8 text-purple-500 opacity-20" />
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-yellow-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Sistemas Saudáveis</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">100%</p>
                        </div>
                        <ChartBarIcon className="w-8 h-8 text-yellow-500 opacity-20" />
                    </div>
                </div>
            </div>

            <Card title="Empresas Cadastradas">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Empresa</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Usuários</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Plano</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {companies.map((company) => (
                                <tr key={company.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-xl">
                                                {company.logo ? (
                                                    <img className="h-10 w-10 rounded-full object-cover" src={company.logo} alt="" />
                                                ) : (
                                                    <span>🏢</span>
                                                )}
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">{company.name}</div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400">{company.domain}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900 dark:text-white">{company.employees.length}</div>
                                        <div className="text-xs text-green-500">Ativos</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                            Enterprise
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                            Ativo
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <a href="#" className="text-brand-primary hover:text-brand-secondary dark:text-blue-400 dark:hover:text-blue-300">Gerenciar</a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default SaaSDashboard;
