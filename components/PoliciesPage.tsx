import React from 'react';
import { ShieldCheckIcon, DocumentTextIcon, ArrowDownTrayIcon } from './icons';
import type { ResourceDocument } from '../types';

interface PoliciesPageProps {
    policies: ResourceDocument[];
}

const PoliciesPage: React.FC<PoliciesPageProps> = ({ policies }) => {

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <ShieldCheckIcon className="w-8 h-8 mr-2 text-brand-primary" />
                Políticas e Diretrizes
            </h1>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="divide-y divide-gray-100">
                    {policies.map(policy => (
                        <div key={policy.id} className="p-4 flex items-center hover:bg-gray-50 transition-colors group">
                            <div className="bg-blue-50 p-3 rounded-lg mr-4 group-hover:bg-blue-100 transition-colors">
                                <DocumentTextIcon className="w-6 h-6 text-blue-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900">{policy.title}</h3>
                                <p className="text-sm text-gray-500">{policy.category} • Atualizado em {new Date(policy.updatedAt).toLocaleDateString()} • {policy.type}</p>
                            </div>
                            <a href={policy.url} target="_blank" rel="noreferrer" className="p-2 text-gray-400 hover:text-brand-primary hover:bg-gray-100 rounded-lg transition-all" title="Baixar">
                                <ArrowDownTrayIcon className="w-5 h-5" />
                            </a>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PoliciesPage;
