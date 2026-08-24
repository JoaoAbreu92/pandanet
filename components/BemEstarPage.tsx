import React, { useMemo } from 'react';
import Card from './Card';
import { HeartIcon, SparklesIcon, VideoCameraIcon, LinkIcon } from './icons';
import type { WellnessItem } from '../types';

interface BemEstarPageProps {
    items: WellnessItem[];
}

const BemEstarPage: React.FC<BemEstarPageProps> = ({ items }) => {

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

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="text-center">
                <h1 className="text-3xl font-bold text-brand-text">Portal de Bem-Estar</h1>
                <p className="mt-2 text-lg text-brand-subtle-text">Recursos e dicas para cuidar da sua saúde física e mental.</p>
            </div>

            {categories.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                    Nenhum item de bem-estar encontrado no momento.
                </div>
            )}

            <div className="grid grid-cols-1 gap-8">
                {categories.map((category) => {
                    const categoryItems = groupedItems[category];
                    // Customize colors based on category if desired, or use generic
                    let cardClass = "bg-white border-gray-200";
                    if (category === 'Saúde Mental') cardClass = "bg-blue-50 border-blue-200";
                    else if (category === 'Atividade Física') cardClass = "bg-green-50 border-green-200";
                    else if (category === 'Nutrição') cardClass = "bg-yellow-50 border-yellow-200";

                    return (
                        <Card key={category} title={category} className={cardClass}>
                            <div className="space-y-6">
                                {categoryItems.map(item => (
                                    <div key={item.id} className="border-b last:border-0 pb-4 last:pb-0 border-black/5">
                                        <h4 className="font-semibold text-brand-text text-lg flex items-center gap-2">
                                            {item.title}
                                            {item.videoUrl && <VideoCameraIcon className="w-4 h-4 text-brand-primary" />}
                                        </h4>
                                        <p className="text-brand-subtle-text mt-1">{item.description}</p>

                                        {item.videoUrl && (
                                            <div className="mt-3 relative w-full aspect-video rounded-lg overflow-hidden shadow-sm">
                                                <iframe
                                                    src={item.videoUrl}
                                                    title={item.title}
                                                    className="absolute inset-0 w-full h-full"
                                                    frameBorder="0"
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                    allowFullScreen
                                                ></iframe>
                                            </div>
                                        )}

                                        {(item.linkUrl && item.linkUrl !== '#') && (
                                            <a href={item.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-brand-primary hover:underline">
                                                <LinkIcon className="w-4 h-4" />
                                                {item.linkText || 'Acessar link'}
                                            </a>
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
