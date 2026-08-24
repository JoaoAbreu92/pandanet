import React, { useState } from 'react';
import UsersTab from './settings/UsersTab';
import QueuesTab from './settings/QueuesTab';
import TagsTab from './settings/TagsTab';
import { useAuth } from '../AuthContext';

const Settings: React.FC = () => {
    const { profile } = useAuth();
    const [activeTab, setActiveTab] = useState<'users' | 'queues' | 'tags'>('users');

    const canAccess = profile?.isAdmin || profile?.isCompanyAdmin || profile?.role === 'Super Admin';

    if (!canAccess) {
        return (
            <div className="p-8 text-center text-red-500">
                <h2 className="text-xl font-bold">Acesso Negado</h2>
                <p>Você não tem permissão para acessar esta área.</p>
            </div>
        );
    }

    return (
        <div className="p-6 h-full flex flex-col overflow-hidden">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Configurações</h2>
            
            <div className="flex space-x-6 border-b border-gray-200 mb-6">
                {[
                    { id: 'users', label: 'Usuários' },
                    { id: 'queues', label: 'Filas' },
                    { id: 'tags', label: 'Etiquetas' },
                ].map((tab) => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`pb-3 px-2 text-sm font-medium transition-colors relative ${
                            activeTab === tab.id 
                            ? 'text-green-600' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {tab.label}
                        {activeTab === tab.id && (
                            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-green-600 rounded-t-full"></span>
                        )}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto">
                {activeTab === 'users' && <UsersTab />}
                {activeTab === 'queues' && <QueuesTab />}
                {activeTab === 'tags' && <TagsTab />}
            </div>
        </div>
    );
};

export default Settings;
