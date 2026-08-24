import React, { useState } from 'react';
import Card from './Card';
import { 
    PlayIcon, 
    BookOpenIcon, 
    RocketLaunchIcon, 
    AcademicCapIcon, 
    LightBulbIcon, 
    ChevronRightIcon,
    CalendarDaysIcon,
    ArrowPathIcon,
    StarIcon,
    QuestionMarkCircleIcon
} from './icons';
import type { ManualVideo, ManualCategory, UpdatePatch } from '../types';

const categories: ManualCategory[] = [
    { id: 'roadmap', title: 'Roadmap do sistema', description: 'Veja as novidades que vêm por aí.', icon: 'RocketLaunchIcon', type: 'info' },
    { id: 'university', title: 'Universidade Panda', description: 'Implante o ERP de forma guiada.', icon: 'AcademicCapIcon', type: 'video' },
    { id: 'ecosystem', title: 'Ecossistema Digital', description: 'Portal com soluções complementares.', icon: 'StarIcon', type: 'info' },
    { id: 'certs', title: 'Certificações', description: 'Capacitação gratuita no sistema.', icon: 'BookOpenIcon', type: 'video' },
    { id: 'academy', title: 'Panda Academy', description: 'Cursos, palestras e entrevistas.', icon: 'LightBulbIcon', type: 'video' },
    { id: 'guide', title: 'Guia do Usuário', description: 'Manual completo com treinamentos.', icon: 'QuestionMarkCircleIcon', type: 'info' },
];

const videos: ManualVideo[] = [
    { 
        id: '1', 
        title: 'Pedidos de compra sem geração de contas a receber', 
        url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', 
        thumbnail: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?q=80&w=400&h=225&fit=crop', 
        duration: '09:34', 
        category: 'Financeiro',
        description: 'Aprenda como gerenciar pedidos de compra de forma eficiente.'
    },
    { 
        id: '2', 
        title: 'Propostas e pedidos de venda sem geração de contas a receber', 
        url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', 
        thumbnail: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=400&h=225&fit=crop', 
        duration: '11:18', 
        category: 'Vendas',
        description: 'Fluxo simplificado para pedidos de venda.'
    },
    { 
        id: '3', 
        title: 'Gerar parcelas considerando data de entrega do item', 
        url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', 
        thumbnail: 'https://images.unsplash.com/photo-1454165833772-d99628a5ffef?q=80&w=400&h=225&fit=crop', 
        duration: '14:45', 
        category: 'Financeiro',
        description: 'Configuração avançada de parcelamento.'
    },
];

const patches: UpdatePatch[] = [
    {
        id: 'p1',
        version: 'v1.2.4',
        date: '05 FEV 2026',
        title: 'Melhorias no Módulo Financeiro',
        description: 'Esta atualização traz correções importantes no fluxo de caixa e novos relatórios.',
        changes: ['Novo relatório de DRE', 'Correção no cálculo de juros', 'Melhoria na performance de busca']
    },
    {
        id: 'p2',
        version: 'v1.2.3',
        date: '28 JAN 2026',
        title: 'Integração com API de Logística',
        description: 'Agora é possível rastrear pedidos diretamente pelo painel principal.',
        changes: ['Integração com Correios e Jadlog', 'Notificações push de entrega']
    }
];

const ManualPage: React.FC = () => {
    const [selectedVideo, setSelectedVideo] = useState<ManualVideo | null>(videos[0]);
    const [activeTab, setActiveTab] = useState<'videos' | 'updates'>('videos');

    const renderIcon = (iconName: string) => {
        const icons: any = { RocketLaunchIcon, AcademicCapIcon, StarIcon, BookOpenIcon, LightBulbIcon, QuestionMarkCircleIcon };
        const Icon = icons[iconName] || QuestionMarkCircleIcon;
        return <Icon className="w-6 h-6" />;
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-500 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10 max-w-2xl">
                    <h1 className="text-3xl font-bold mb-2">Manual do Usuário & Central de Ajuda</h1>
                    <p className="text-emerald-50 opacity-90">Tudo o que você precisa para dominar o sistema, de tutoriais em vídeo a notas de atualização.</p>
                </div>
                <RocketLaunchIcon className="absolute right-[-20px] bottom-[-20px] w-64 h-64 text-white opacity-10 rotate-12" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Left Sidebar: Categories */}
                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-gray-800 px-2">Links Importantes</h2>
                    <div className="space-y-2">
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-transparent shadow-sm hover:shadow-md hover:border-emerald-200 transition-all group active:scale-[0.98]"
                            >
                                <div className="flex items-center space-x-4">
                                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                        {renderIcon(cat.icon)}
                                    </div>
                                    <div className="text-left">
                                        <p className="font-bold text-sm text-gray-900">{cat.title}</p>
                                        <p className="text-xs text-gray-500">{cat.description}</p>
                                    </div>
                                </div>
                                <ChevronRightIcon className="w-4 h-4 text-gray-400 group-hover:text-emerald-500 transform group-hover:translate-x-1 transition-all" />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Center Content: Main Video or Updates */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100 max-w-xs">
                        <button 
                            onClick={() => setActiveTab('videos')}
                            className={`flex-1 py-2 px-4 rounded-xl text-sm font-bold transition-all ${activeTab === 'videos' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            Vídeos
                        </button>
                        <button 
                            onClick={() => setActiveTab('updates')}
                            className={`flex-1 py-2 px-4 rounded-xl text-sm font-bold transition-all ${activeTab === 'updates' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            Atualizações
                        </button>
                    </div>

                    {activeTab === 'videos' ? (
                        <Card title={selectedVideo?.title || "Destaque"}>
                            {selectedVideo && (
                                <div className="space-y-6">
                                    <div className="aspect-video bg-black rounded-2xl overflow-hidden shadow-inner border border-gray-100 relative group">
                                        <iframe
                                            src={selectedVideo.url}
                                            title={selectedVideo.title}
                                            className="w-full h-full"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                        ></iframe>
                                    </div>
                                    <div>
                                        <div className="flex items-center space-x-2 mb-2">
                                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full uppercase tracking-wider">{selectedVideo.category}</span>
                                            <span className="text-gray-400 text-sm">•</span>
                                            <span className="text-gray-500 text-sm">{selectedVideo.duration} min</span>
                                        </div>
                                        <p className="text-gray-600 leading-relaxed">{selectedVideo.description}</p>
                                    </div>
                                    <div className="pt-6 border-t border-gray-100">
                                        <button className="flex items-center space-x-2 px-6 py-3 bg-gray-900 text-white font-bold rounded-2xl hover:bg-emerald-600 transition-all shadow-lg active:scale-95">
                                            <span>Confira este tutorial na íntegra</span>
                                            <ChevronRightIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {patches.map(patch => (
                                <Card key={patch.id} title={patch.title} headerAction={
                                    <div className="flex items-center space-x-2 bg-emerald-50 px-3 py-1 rounded-full">
                                        <ArrowPathIcon className="w-4 h-4 text-emerald-600" />
                                        <span className="text-xs font-bold text-emerald-700">{patch.version}</span>
                                    </div>
                                }>
                                    <div className="flex items-center text-sm text-gray-400 mb-4">
                                        <CalendarDaysIcon className="w-4 h-4 mr-1" />
                                        <span>{patch.date}</span>
                                    </div>
                                    <p className="text-gray-600 mb-4">{patch.description}</p>
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">O que mudou:</p>
                                        <ul className="space-y-1">
                                            {patch.changes.map((change, i) => (
                                                <li key={i} className="flex items-start space-x-2 text-sm text-gray-600">
                                                    <span className="text-emerald-500 mt-1">•</span>
                                                    <span>{change}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right Sidebar: Recent Videos */}
                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-gray-800 px-2">Novos Vídeos</h2>
                    <div className="space-y-4">
                        {videos.map((video) => (
                            <button
                                key={video.id}
                                onClick={() => {
                                    setSelectedVideo(video);
                                    setActiveTab('videos');
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className={`w-full text-left bg-white rounded-2xl overflow-hidden border transition-all hover:shadow-md group ${selectedVideo?.id === video.id ? 'border-emerald-500 ring-4 ring-emerald-50' : 'border-transparent shadow-sm'}`}
                            >
                                <div className="relative aspect-video">
                                    <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                        {video.duration}
                                    </div>
                                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 duration-300">
                                        <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center text-emerald-600 shadow-xl transform translate-y-2 group-hover:translate-y-0 transition-transform">
                                            <PlayIcon className="w-5 h-5 ml-0.5" />
                                        </div>
                                    </div>
                                </div>
                                <div className="p-3">
                                    <p className="font-bold text-xs text-gray-800 line-clamp-2 group-hover:text-emerald-600 transition-colors leading-relaxed">
                                        {video.title}
                                    </p>
                                </div>
                            </button>
                        ))}
                        <button className="w-full py-4 bg-emerald-50 text-emerald-700 font-bold rounded-2xl hover:bg-emerald-100 transition-all border border-emerald-100 flex items-center justify-center space-x-2 active:scale-[0.98]">
                            <span>Acessar todos os vídeos</span>
                            <ChevronRightIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Bottom Section: Success Cases/Promotion */}
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm overflow-hidden relative">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div className="relative z-10">
                        <span className="inline-block px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full mb-4 uppercase tracking-widest">Destaque</span>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">O que falta para você ser nosso próximo caso de sucesso?</h2>
                        <p className="text-gray-600 mb-6 leading-relaxed">
                            Nossa equipe está pronta para te ajudar a extrair o máximo do sistema. 
                            Converse com seu analista para descobrir novos caminhos de eficiência.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                <p className="text-xs text-amber-800 opacity-70 mb-1">Para você:</p>
                                <p className="font-bold text-amber-900">Vale-presente de R$100</p>
                            </div>
                            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                <p className="text-xs text-emerald-800 opacity-70 mb-1">Para sua empresa:</p>
                                <p className="font-bold text-emerald-900">BÔNUS no Método Lean</p>
                            </div>
                        </div>
                    </div>
                    <div className="hidden md:block">
                        <img 
                            src="https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=600&h=400&fit=crop" 
                            alt="Sucesso" 
                            className="rounded-2xl shadow-xl border-4 border-white"
                        />
                    </div>
                </div>
            </div>
            
            <div className="text-center py-4 text-gray-400 text-xs">
                Carregar mais novidades ▼
            </div>
        </div>
    );
};

export default ManualPage;
