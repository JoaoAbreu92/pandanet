import React, { useState } from 'react';
import { QuestionMarkCircleIcon, MagnifyingGlassIcon, ChevronDownIcon } from './icons';
import type { KBArticle } from '../types';

interface KnowledgeBasePageProps {
    articles: KBArticle[];
}

const KnowledgeBasePage: React.FC<KnowledgeBasePageProps> = ({ articles }) => {
    const [searchTerm, setSearchTerm] = useState('');


    const filtered = articles.filter(a => a.title.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <QuestionMarkCircleIcon className="w-8 h-8 mr-2 text-brand-primary" />
                Base de Conhecimento T.I.
            </h1>

            <div className="relative mb-8">
                <input
                    type="text"
                    placeholder="Como podemos ajudar? Pesquise por tutoriais, erros, acessos..."
                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-lg"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                <MagnifyingGlassIcon className="w-6 h-6 text-gray-400 absolute left-4 top-1/2 transform -translate-y-1/2" />
            </div>

            <div className="space-y-4">
                {filtered.length === 0 ? <p className="text-gray-500">Nenhum artigo encontrado.</p> : filtered.map(article => (
                    <div key={article.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-brand-primary transition-all cursor-pointer group">
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-gray-800 group-hover:text-brand-primary mb-1">{article.title}</h3>
                                <p className="text-sm text-gray-500 mb-2">Categoria: {article.category} • {article.views} visualizações</p>
                                <p className="text-gray-600 line-clamp-2">{article.content}</p>
                            </div>
                            <ChevronDownIcon className="w-5 h-5 text-gray-300 group-hover:text-brand-primary -rotate-90 mt-1" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default KnowledgeBasePage;
