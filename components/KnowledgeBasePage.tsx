import React, { useState, useEffect } from 'react';
import { QuestionMarkCircleIcon, MagnifyingGlassIcon, ChevronDownIcon } from './icons';
import type { KBArticle } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';

const KnowledgeBasePage: React.FC = () => {
    const { t } = useLanguage();
    const { currentUser, isGhostMode } = useAuth();
    const [articles, setArticles] = useState<KBArticle[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedIds, setExpandedIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    const toggleExpand = async (id: string) => {
        const isExpanding = !expandedIds.includes(id);
        setExpandedIds(prev => isExpanding ? [...prev, id] : prev.filter(i => i !== id));

        // Increment view count if expanding and not in ghost mode
        if (isExpanding && !isGhostMode) {
            const { error } = await supabase.rpc('increment_kb_views', { article_id: id });
            // If RPC doesn't exist, ignore for now.
        }
    };

    const fetchArticles = async () => {
        if (!currentUser?.company_id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('kb_articles')
                .select('*')
                .eq('company_id', currentUser.company_id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                const formattedArticles: KBArticle[] = data.map((a: any) => ({
                    id: a.id,
                    title: a.title,
                    category: a.category,
                    content: a.content,
                    views: a.views || 0,
                    mediaUrl: a.media_url,
                    mediaType: a.media_type
                }));
                setArticles(formattedArticles);
            }
        } catch (error) {
            console.error('Error fetching KB articles:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchArticles();
    }, [currentUser?.company_id]);

    const filtered = articles.filter(a => a.title.toLowerCase().includes(searchTerm.toLowerCase()));

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando base de conhecimento...</div>;

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <QuestionMarkCircleIcon className="w-8 h-8 mr-2 text-brand-primary" />
                {t('kb.title')}
            </h1>

            <div className="relative mb-8">
                <input
                    type="text"
                    placeholder={t('kb.search_placeholder')}
                    className="w-full pl-12 pr-4 py-6 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-xl"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                <MagnifyingGlassIcon className="w-8 h-8 text-gray-400 absolute left-4 top-1/2 transform -translate-y-1/2" />
            </div>

            <div className="space-y-6">
                {filtered.length === 0 ? <p className="text-gray-500 text-center">{t('kb.no_articles')}</p> : filtered.map(article => (
                    <div key={article.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:border-brand-primary transition-all cursor-pointer group" onClick={() => toggleExpand(article.id)}>
                        <div className="flex justify-between items-start">
                            <div className="flex-1 w-full relative">
                                <h3 className="text-xl font-semibold text-gray-800 group-hover:text-brand-primary mb-2">{article.title}</h3>
                                <p className="text-sm text-gray-500 mb-4">Category: {article.category} • {article.views} views</p>

                                {article.mediaUrl && expandedIds.includes(article.id) && (
                                    <div className="mb-4">
                                        {article.mediaType === 'video' ? (
                                            <video src={article.mediaUrl} controls className="w-full max-h-96 rounded-lg bg-black" />
                                        ) : (
                                            <img src={article.mediaUrl} alt={article.title} className="w-full max-h-96 object-contain rounded-lg bg-gray-50" />
                                        )}
                                    </div>
                                )}

                                <p className={`text-gray-600 ${expandedIds.includes(article.id) ? '' : 'line-clamp-2'}`}>
                                    {article.content}
                                </p>
                            </div>
                            <ChevronDownIcon className={`w-6 h-6 text-gray-300 group-hover:text-brand-primary transition-transform mt-1 ml-4 ${expandedIds.includes(article.id) ? 'rotate-180' : ''}`} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default KnowledgeBasePage;
