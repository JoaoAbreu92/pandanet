import React from 'react';
import { ArrowPathIcon, CheckCircleIcon, XCircleIcon } from './icons';
import type { ServiceStatusItem } from '../types';

interface StatusPageProps {
    services: ServiceStatusItem[];
}

const StatusPage: React.FC<StatusPageProps> = ({ services }) => {

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <ArrowPathIcon className="w-8 h-8 mr-2 text-brand-primary" />
                Status dos Serviços
            </h1>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                    <span className="font-semibold text-gray-700">Visão Geral do Sistema</span>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-bold">Todos os sistemas operacionais</span>
                </div>
                <div className="divide-y divide-gray-100">
                    {services.map((service, idx) => (
                        <div key={idx} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                            <div className="flex items-center">
                                {service.status === 'operational' ? (
                                    <CheckCircleIcon className="w-5 h-5 text-green-500 mr-3" />
                                ) : (
                                    <XCircleIcon className="w-5 h-5 text-orange-500 mr-3 animate-pulse" />
                                )}
                                <div>
                                    <h3 className="font-medium text-gray-900">{service.name}</h3>
                                    {service.status === 'maintenance' && <p className="text-xs text-orange-600">Manutenção Programada</p>}
                                </div>
                            </div>
                            <div className="text-right">
                                <span className={`text-sm font-bold ${service.status === 'operational' ? 'text-green-600' : 'text-orange-600'}`}>
                                    {service.status === 'operational' ? 'Operacional' : 'Manutenção'}
                                </span>
                                <p className="text-xs text-gray-400">Uptime: {service.uptime}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default StatusPage;
