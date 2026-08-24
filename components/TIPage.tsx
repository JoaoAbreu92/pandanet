import React, { useState } from 'react';
import Card from './Card';
import { Cog6ToothIcon, PlusIcon, ServerIcon, ShieldCheckIcon, ChevronDownIcon } from './icons';

interface TIPageProps {
    onNavigate: (page: string) => void;
}

const SystemStatus: React.FC = () => {
    const systems = [
        { name: 'Rede Wi-Fi Corporativa', status: 'Operacional' },
        { name: 'Servidores de Email', status: 'Operacional' },
        { name: 'Intranet (Pixel)', status: 'Operacional' },
        { name: 'Sistema de RH', status: 'Manutenção Programada' },
        { name: 'Servidor de Arquivos', status: 'Operacional' },
    ];

    const getStatusIndicator = (status: string) => {
        switch (status) {
            case 'Operacional':
                return <div className="w-3 h-3 bg-green-500 rounded-full" title="Operacional"></div>;
            case 'Manutenção Programada':
                return <div className="w-3 h-3 bg-yellow-500 rounded-full" title="Manutenção Programada"></div>;
            case 'Fora do Ar':
                return <div className="w-3 h-3 bg-red-500 rounded-full" title="Fora do Ar"></div>;
            default:
                return <div className="w-3 h-3 bg-gray-400 rounded-full"></div>;
        }
    };

    return (
        <Card title="Status dos Sistemas" headerAction={<ServerIcon className="w-6 h-6 text-gray-400" />}>
            <div className="space-y-3">
                {systems.map((system, index) => (
                    <div key={index} className="flex justify-between items-center p-2 rounded-md hover:bg-gray-50 dark:hover:bg-slate-800/50">
                        <span className="text-brand-text dark:text-white">{system.name}</span>
                        <div className="flex items-center space-x-2">
                            <span className="text-sm text-brand-subtle-text dark:text-gray-400">{system.status}</span>
                            {getStatusIndicator(system.status)}
                        </div>
                    </div>
                ))}
            </div>
             <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 text-right">Atualizado agora</p>
        </Card>
    );
};

const SecurityTips: React.FC = () => {
    const tips = [
        "Use senhas fortes e únicas para cada serviço.",
        "Desconfie de e-mails inesperados que solicitam informações pessoais.",
        "Mantenha seus softwares e sistemas operacionais sempre atualizados.",
        "Faça logout de suas contas ao usar computadores compartilhados.",
    ];
    const randomTip = tips[Math.floor(Math.random() * tips.length)];

    return (
        <Card title="Dica de Segurança" headerAction={<ShieldCheckIcon className="w-6 h-6 text-gray-400" />}>
            <p className="text-brand-subtle-text dark:text-gray-300 italic">"{randomTip}"</p>
        </Card>
    );
}

const KnowledgeBase: React.FC = () => {
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const faqs = [
        { q: 'Como redefinir minha senha?', a: 'Você pode redefinir sua senha através do portal de login, clicando em "Esqueceu a senha?". Se precisar de ajuda, abra um chamado para o suporte de TI.' },
        { q: 'Como configurar a VPN?', a: 'O guia completo para configuração da VPN em diferentes sistemas operacionais está disponível na nossa Central de Recursos, na pasta de TI & Segurança.' },
        { q: 'Como solicitar acesso a um novo software?', a: 'Use a opção "Solicitar Equipamento" nesta página e selecione o tipo "Software". Descreva o software e a justificativa para o uso.' },
    ];
    return (
        <Card title="Base de Conhecimento">
            <div className="space-y-2">
                {faqs.map((faq, index) => (
                    <div key={index} className="border-b dark:border-white/5 last:border-b-0">
                        <button onClick={() => setOpenFaq(openFaq === index ? null : index)} className="w-full flex justify-between items-center py-3 text-left font-semibold text-brand-text dark:text-white">
                            <span>{faq.q}</span>
                            <ChevronDownIcon className={`w-5 h-5 transition-transform ${openFaq === index ? 'rotate-180' : ''}`} />
                        </button>
                        {openFaq === index && (
                            <div className="pb-3 text-brand-subtle-text dark:text-gray-400">
                                {faq.a}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </Card>
    );
};


const TIPage: React.FC<TIPageProps> = ({ onNavigate }) => {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-brand-text dark:text-white">Painel de TI</h1>
                <p className="mt-1 text-lg text-brand-subtle-text dark:text-gray-400">Seu portal para recursos e suporte de tecnologia.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div onClick={() => onNavigate('tickets')} className="p-8 bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-2xl shadow-md hover:shadow-lg transition-all cursor-pointer flex flex-col items-center text-center">
                    <Cog6ToothIcon className="w-12 h-12 text-brand-primary mb-4"/>
                    <h2 className="text-xl font-bold text-brand-text dark:text-white">Abrir um Chamado</h2>
                    <p className="text-brand-subtle-text dark:text-gray-400 mt-2">Precisa de ajuda? Abra um chamado para nossa equipe de suporte técnico.</p>
                </div>
                 <div onClick={() => onNavigate('ti-requests')} className="p-8 bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/5 rounded-2xl shadow-md hover:shadow-lg transition-all cursor-pointer flex flex-col items-center text-center">
                    <PlusIcon className="w-12 h-12 text-brand-primary mb-4"/>
                    <h2 className="text-xl font-bold text-brand-text dark:text-white">Solicitar Equipamento</h2>
                    <p className="text-brand-subtle-text dark:text-gray-400 mt-2">Solicite um novo hardware ou software para suas atividades.</p>
                </div>
            </div>
            
            <KnowledgeBase />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <SystemStatus />
                <SecurityTips />
            </div>

        </div>
    );
};

export default TIPage;