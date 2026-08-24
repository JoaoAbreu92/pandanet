import React, { useState } from 'react';
import UsersTab from './settings/UsersTab';
import QueuesTab from './settings/QueuesTab';
import TagsTab from './settings/TagsTab';
import ChatbotSettings from './ChatbotSettings';
import { useAuth } from '../AuthContext';

const Settings: React.FC = () => {
    const { profile } = useAuth();
    const [activeTab, setActiveTab] = useState<'tags' | 'chatbot'>('tags');

    const canAccess = profile?.isAdmin || profile?.isCompanyAdmin || profile?.role === 'Super Admin' || profile?.whatspanda_permissions?.can_manage_settings;

    if (!canAccess) {
        return (
            <div className="p-20 text-center flex flex-col items-center justify-center h-full animate-in fade-in duration-700">
                <div className="w-24 h-24 bg-red-500/10 rounded-[2rem] flex items-center justify-center mb-8 border border-red-500/20 shadow-2xl shadow-red-500/20">
                    <span className="text-4xl font-bold text-red-500">!</span>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-3">Acesso Negado</h2>
                <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-xs opacity-70">Você não tem permissão para acessar esta área.</p>
            </div>
        );
    }

    return (
        <div className="p-10 h-full flex flex-col overflow-hidden dark:bg-transparent transition-colors duration-500">
            <div className="mb-10 bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-2xl">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Configurações</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm font-bold opacity-80 uppercase tracking-widest mt-1">Gerencie etiquetas e chatbot do seu atendimento.</p>
            </div>
            
            <div className="flex space-x-10 mb-10 px-4">
                {[
                    { id: 'tags', label: 'Etiquetas' },
                    { id: 'chatbot', label: 'Chatbot' },
                ].map((tab) => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`pb-4 px-2 text-[11px] font-bold uppercase tracking-[0.2em] transition-all relative ${
                            activeTab === tab.id 
                            ? 'text-emerald-500'
                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                        }`}
                    >
                        {tab.label}
                        {activeTab === tab.id && (
                            <span className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-in slide-in-from-bottom-1 duration-300"></span>
                        )}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto px-4 custom-scrollbar">
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {activeTab === 'tags' && <TagsTab />}
                    {activeTab === 'chatbot' && <ChatbotSettings />}
                </div>
            </div>
        </div>
    );
};

export default Settings;
