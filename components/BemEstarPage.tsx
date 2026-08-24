import React, { useState, useEffect, useMemo } from 'react';
import Card from './Card';
import { VideoCameraIcon, LinkIcon } from './icons';
import type { WellnessItem } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

const BemEstarPage: React.FC = () => {
    const { profile: currentUser } = useAuth();
    const [items, setItems] = useState<WellnessItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchItems = async () => {
        if (!currentUser?.company_id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('wellness_items')
                .select('*')
                .eq('company_id', currentUser.company_id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            setItems((data || []).map(i => ({
                id: i.id,
                title: i.title,
                description: i.description,
                category: i.category,
                videoUrl: i.video_url,
                linkUrl: i.link_url,
                linkText: i.link_text
            })));
        } catch (err) {
            console.error('Error fetching wellness items:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, [currentUser?.company_id]);

    const groupedItems = useMemo(() => {
        const groups: Record<string, WellnessItem[]> = {};
        items.forEach(item => {
            if (!groups[item.category]) {
                groups[item.category] = [];
            }
            groups[item.category].push(item);
        });
        return groups;
    }, [items]);

    const categories = Object.keys(groupedItems);

    if (loading) return <div className="p-8 text-center text-gray-500 font-brand">Carregando portal de bem-estar...</div>;

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="text-center">
                <h1 className="text-3xl font-bold text-brand-text">Portal de Bem-Estar</h1>
                <p className="mt-2 text-lg text-brand-subtle-text">Recursos e dicas para cuidar da sua saúde física e mental.</p>
            </div>

            {categories.length === 0 && (
                <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <p className="text-gray-400 font-medium">Nenhum item de bem-estar encontrado no momento.</p>
                </div>
            )}

            <div className="grid grid-cols-1 gap-8">
                {categories.map((category) => {
                    const categoryItems = groupedItems[category];
                    let cardClass = "bg-white border-gray-100 shadow-lg hover:shadow-xl transition-shadow duration-300";

                    return (
                        <Card key={category} title={category} className={cardClass}>
                            <div className="space-y-8">
                                {categoryItems.map(item => (
                                    <div key={item.id} className="border-b last:border-0 pb-6 last:pb-0 border-gray-50">
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-2 max-w-2xl">
                                                <h4 className="font-bold text-brand-text text-xl flex items-center gap-2">
                                                    {item.title}
                                                    {item.videoUrl && <VideoCameraIcon className="w-5 h-5 text-brand-primary animate-pulse" />}
                                                </h4>
                                                <p className="text-brand-subtle-text text-base leading-relaxed">{item.description}</p>
                                            </div>

                                            {(item.linkUrl && item.linkUrl !== '#') && (
                                                <a href={item.linkUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-brand-primary bg-emerald-50 rounded-full hover:bg-emerald-100 transition-colors">
                                                    <LinkIcon className="w-4 h-4" />
                                                    {item.linkText || 'Acessar'}
                                                </a>
                                            )}
                                        </div>

                                        {item.videoUrl && (
                                            <div className="mt-4 relative w-full aspect-video rounded-xl overflow-hidden shadow-md border border-gray-100">
                                                <iframe
                                                    src={item.videoUrl.includes('youtube.com/watch?v=') ? item.videoUrl.replace('watch?v=', 'embed/') : item.videoUrl}
                                                    title={item.title}
                                                    className="absolute inset-0 w-full h-full"
                                                    frameBorder="0"
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                    allowFullScreen
                                                ></iframe>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};

export default BemEstarPage;
