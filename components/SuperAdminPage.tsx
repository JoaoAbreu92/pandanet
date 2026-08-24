import React, { useState } from 'react';
import type { Company, Plan, EmployeePermissions } from '../types';
import Card from './Card';
import { mockPlans } from '../mockData';
import PlanManager from './PlanManager';
import { XCircleIcon, CalendarDaysIcon, ArrowPathIcon, BuildingOffice2Icon, PencilIcon } from './icons';

interface SuperAdminPageProps {
    companies: Company[];
    setCompanies: (companies: Company[]) => void;
    onLogout: () => void;
    onImpersonate: (company: Company) => void;
}

const SubscriptionModal: React.FC<{
    company: Company;
    onClose: () => void;
    onSave: (companyId: string, newEndDate: string) => void;
}> = ({ company, onClose, onSave }) => {
    
    const addTime = (unit: 'days' | 'months' | 'years', amount: number) => {
        const currentDate = new Date(company.subscriptionEndDate);
        if (unit === 'days') currentDate.setDate(currentDate.getDate() + amount);
        if (unit === 'months') currentDate.setMonth(currentDate.getMonth() + amount);
        if (unit === 'years') currentDate.setFullYear(currentDate.getFullYear() + amount);
        onSave(company.domain, currentDate.toISOString().split('T')[0]);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><XCircleIcon className="w-6 h-6" /></button>
                <h3 className="text-xl font-bold text-brand-text mb-2">Gerenciar Assinatura</h3>
                <p className="text-sm text-brand-subtle-text mb-4">Empresa: <span className="font-semibold">{company.name}</span></p>
                <div className="space-y-4">
                    <p className="text-brand-text">A assinatura atual vence em: <span className="font-bold">{new Date(company.subscriptionEndDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span></p>
                    <div>
                        <h4 className="text-md font-semibold text-brand-text mb-2">Adicionar tempo:</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <button onClick={() => addTime('days', 30)} className="p-2 border border-gray-300 bg-white text-brand-text rounded-md hover:bg-gray-100 text-sm font-medium transition-colors">30 Dias</button>
                            <button onClick={() => addTime('months', 3)} className="p-2 border border-gray-300 bg-white text-brand-text rounded-md hover:bg-gray-100 text-sm font-medium transition-colors">3 Meses</button>
                            <button onClick={() => addTime('months', 6)} className="p-2 border border-gray-300 bg-white text-brand-text rounded-md hover:bg-gray-100 text-sm font-medium transition-colors">6 Meses</button>
                            <button onClick={() => addTime('years', 1)} className="p-2 border border-gray-300 bg-white text-brand-text rounded-md hover:bg-gray-100 text-sm font-medium transition-colors">1 Ano</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const CompanyFeaturesModal: React.FC<{
    company: Company;
    onClose: () => void;
    onSave: (companyDomain: string, newFeatures: Plan['features']) => void;
}> = ({ company, onClose, onSave }) => {
    const [features, setFeatures] = useState(company.plan.features);

    const RH_PERMISSIONS: (keyof EmployeePermissions)[] = ['viewDirectory', 'viewForms', 'viewBenefits', 'viewOnboarding', 'viewRecognition', 'viewDocuments'];
    const TI_PERMISSIONS: (keyof EmployeePermissions)[] = ['viewTiDashboard', 'openTickets', 'openTiRequests'];

    const handleFeatureChange = (feature: keyof EmployeePermissions, value: boolean) => {
        setFeatures(prev => ({...prev, [feature]: value}));
    };
    
    const handleGroupChange = (groupPermissions: (keyof EmployeePermissions)[], value: boolean) => {
        const newFeatures = {...features};
        groupPermissions.forEach(perm => {
            newFeatures[perm] = value;
        });
        setFeatures(newFeatures);
    };

    const isGroupEnabled = (groupPermissions: (keyof EmployeePermissions)[]) => {
        return groupPermissions.every(perm => features[perm]);
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(company.domain, features);
        onClose();
    };

    const FeatureCheckbox: React.FC<{label: string, featureKey: keyof EmployeePermissions}> = ({ label, featureKey }) => (
         <label className="flex items-center space-x-2 p-2 bg-gray-50 hover:bg-gray-100 rounded-md cursor-pointer border border-gray-200">
            <input
                type="checkbox"
                checked={!!features[featureKey]}
                onChange={e => handleFeatureChange(featureKey, e.target.checked)}
                className="rounded text-brand-primary focus:ring-brand-primary border-gray-300"
            />
            <span className="text-brand-text font-medium">{label}</span>
        </label>
    );

    const GroupCheckbox: React.FC<{label: string, permissions: (keyof EmployeePermissions)[]}> = ({label, permissions}) => (
        <label className="flex items-center space-x-2 p-2 bg-gray-100 hover:bg-gray-200 rounded-md font-bold cursor-pointer border border-gray-300">
            <input
                type="checkbox"
                checked={isGroupEnabled(permissions)}
                onChange={e => handleGroupChange(permissions, e.target.checked)}
                className="rounded text-brand-primary focus:ring-brand-primary border-gray-300"
            />
            <span className="text-brand-text">{label}</span>
        </label>
    );

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><XCircleIcon className="w-6 h-6" /></button>
                <h3 className="text-xl font-bold text-brand-text mb-2">Editar Acessos do Plano</h3>
                <p className="text-sm text-brand-subtle-text mb-4">Empresa: <span className="font-semibold">{company.name}</span> ({company.plan.name})</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <h4 className="font-semibold text-brand-text">Módulos Gerais</h4>
                           <FeatureCheckbox label="Mensagens" featureKey="viewMessages" />
                           <FeatureCheckbox label="Calendário" featureKey="viewCalendar" />
                           <FeatureCheckbox label="Marketplace" featureKey="useMarketplace" />
                           <FeatureCheckbox label="Bem-Estar" featureKey="viewWellbeing" />
                            <FeatureCheckbox label="WhatsPanda" featureKey="viewWhatsPanda" />
                        </div>
                        <div className="space-y-2">
                           <h4 className="font-semibold text-brand-text">Módulos Agrupados</h4>
                           <GroupCheckbox label="Recursos Humanos" permissions={RH_PERMISSIONS} />
                           <GroupCheckbox label="T.I." permissions={TI_PERMISSIONS} />
                        </div>
                    </div>
                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors">Cancelar</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 transition-colors">Salvar Alterações</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const SuperAdminPage: React.FC<SuperAdminPageProps> = ({ companies, setCompanies, onLogout, onImpersonate }) => {
    const [activeTab, setActiveTab] = useState('companies');
    const [managingSubscriptionFor, setManagingSubscriptionFor] = useState<Company | null>(null);
    const [editingCompanyFeatures, setEditingCompanyFeatures] = useState<Company | null>(null);

    const handleSaveSubscription = (companyDomain: string, newEndDate: string) => {
        setCompanies(companies.map(c => c.domain === companyDomain ? { ...c, subscriptionEndDate: newEndDate } : c));
    };

    const handleSaveCompanyFeatures = (companyDomain: string, newFeatures: Plan['features']) => {
        setCompanies(companies.map(c => {
            if (c.domain === companyDomain) {
                return {
                    ...c,
                    plan: {
                        ...c.plan,
                        name: 'Custom',
                        features: newFeatures
                    }
                };
            }
            return c;
        }));
    };

    const getSubscriptionStatus = (endDateString: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(endDateString);

        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);

        if (endDate < today) {
            return { text: 'Vencido', color: 'bg-red-100 text-red-800' };
        }
        if (endDate <= thirtyDaysFromNow) {
            return { text: 'Vence em breve', color: 'bg-yellow-100 text-yellow-800' };
        }
        return { text: 'Ativo', color: 'bg-green-100 text-green-800' };
    };

    return (
        <>
            <div className="min-h-screen bg-gray-100">
                <header className="bg-white shadow-sm">
                    <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                        <h1 className="text-2xl font-bold text-brand-primary">Super Admin</h1>
                        <button onClick={onLogout} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 transition-colors">Sair</button>
                    </div>
                </header>
                <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 space-y-8">
                     <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                            <button onClick={() => setActiveTab('companies')} className={`${activeTab === 'companies' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700'} py-4 px-1 border-b-2 font-medium text-sm transition-colors`}>Empresas</button>
                            <button onClick={() => setActiveTab('plans')} className={`${activeTab === 'plans' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700'} py-4 px-1 border-b-2 font-medium text-sm transition-colors`}>Planos</button>
                        </nav>
                    </div>

                    {activeTab === 'companies' && (
                        <Card title="Empresas Cadastradas">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-gray-500">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                        <tr>
                                            <th scope="col" className="px-6 py-3">Empresa</th>
                                            <th scope="col" className="px-6 py-3">Plano</th>
                                            <th scope="col" className="px-6 py-3">Usuários</th>
                                            <th scope="col" className="px-6 py-3">Vencimento</th>
                                            <th scope="col" className="px-6 py-3 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {companies.map(company => {
                                            const status = getSubscriptionStatus(company.subscriptionEndDate);
                                            return (
                                                <tr key={company.domain} className="bg-white border-b hover:bg-gray-50">
                                                    <td className="px-6 py-4 font-medium text-gray-900">{company.name} <span className="text-gray-400">({company.domain})</span></td>
                                                    <td className="px-6 py-4 text-brand-text">{company.plan.name}</td>
                                                    <td className="px-6 py-4 text-brand-text">{company.data.employees.length} / {company.plan.userLimit}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-brand-text">{new Date(company.subscriptionEndDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</span>
                                                            <span className={`mt-1 px-2 py-0.5 text-xs font-semibold rounded-full text-center w-fit ${status.color}`}>
                                                                {status.text}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right space-x-1">
                                                        <button onClick={() => onImpersonate(company)} className="p-2 text-brand-subtle-text hover:text-brand-primary rounded-full hover:bg-gray-100 transition-colors" title="Acessar Intranet">
                                                            <BuildingOffice2Icon className="w-5 h-5"/>
                                                        </button>
                                                        <button onClick={() => setEditingCompanyFeatures(company)} className="p-2 text-brand-subtle-text hover:text-brand-primary rounded-full hover:bg-gray-100 transition-colors" title="Editar Acessos do Plano">
                                                            <PencilIcon className="w-5 h-5"/>
                                                        </button>
                                                        <button onClick={() => setManagingSubscriptionFor(company)} className="p-2 text-brand-subtle-text hover:text-brand-primary rounded-full hover:bg-gray-100 transition-colors" title="Gerenciar Assinatura">
                                                            <CalendarDaysIcon className="w-5 h-5"/>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}
                    
                    {activeTab === 'plans' && <PlanManager plans={mockPlans} />}
                </main>
            </div>
            {managingSubscriptionFor && (
                <SubscriptionModal 
                    company={managingSubscriptionFor}
                    onClose={() => setManagingSubscriptionFor(null)}
                    onSave={handleSaveSubscription}
                />
            )}
            {editingCompanyFeatures && (
                <CompanyFeaturesModal 
                    company={editingCompanyFeatures}
                    onClose={() => setEditingCompanyFeatures(null)}
                    onSave={handleSaveCompanyFeatures}
                />
            )}
        </>
    );
};

export default SuperAdminPage;