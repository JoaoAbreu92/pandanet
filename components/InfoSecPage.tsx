import React from 'react';
import { ShieldCheckIcon, UserGroupIcon, LockClosedIcon } from './icons';
import type { SecurityAlert } from '../types';

interface InfoSecPageProps {
    alerts?: SecurityAlert[];
}

const InfoSecPage: React.FC<InfoSecPageProps> = ({ alerts = [] }) => {
    return (
        <div className="p-6 max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <ShieldCheckIcon className="w-8 h-8 mr-2 text-brand-primary" />
                Segurança da Informação
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                    <LockClosedIcon className="w-10 h-10 mb-4 opacity-80" />
                    <h3 className="text-xl font-bold mb-2">Bloqueie sua Tela</h3>
                    <p className="text-blue-100 text-sm">Sempre que se ausentar da mesa, pressione Widows + L para bloquear seu computador.</p>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                    <UserGroupIcon className="w-10 h-10 mb-4 opacity-80" />
                    <h3 className="text-xl font-bold mb-2">Phishing Alert</h3>
                    <p className="text-purple-100 text-sm">Não clique em links suspeitos. Verifique sempre o remetente do e-mail antes de abrir anexos.</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
                    <ShieldCheckIcon className="w-10 h-10 mb-4 opacity-80" />
                    <h3 className="text-xl font-bold mb-2">Senhas Fortes</h3>
                    <p className="text-emerald-100 text-sm">Use senhas complexas e ative a autenticação de dois fatores (2FA) sempre que possível.</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Comunicados de Segurança</h2>
                <div className="space-y-4">
                    {alerts.length === 0 ? <p className="text-gray-500">Nenhum comunicado recente.</p> : alerts.map(alert => (
                        <div key={alert.id} className={`border-l-4 p-4 rounded-r-lg ${alert.level === 'critical' || alert.level === 'warning' ? 'border-orange-500 bg-orange-50' : 'border-blue-500 bg-blue-50'}`}>
                            <h4 className={`font-bold ${alert.level === 'critical' || alert.level === 'warning' ? 'text-orange-800' : 'text-blue-800'}`}>{alert.title}</h4>
                            <p className={`text-sm mt-1 ${alert.level === 'critical' || alert.level === 'warning' ? 'text-orange-700' : 'text-blue-700'}`}>{alert.description}</p>
                            <span className="text-xs opacity-70 mt-2 block">{new Date(alert.date).toLocaleDateString()}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default InfoSecPage;
