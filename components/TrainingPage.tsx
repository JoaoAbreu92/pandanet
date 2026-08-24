import React, { useState, useEffect } from 'react';
import { RocketLaunchIcon, PlayCircleIcon } from './icons';
import type { TrainingModule } from '../types';
import { supabase, getCleanImageUrl } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';

const TrainingPage: React.FC = () => {
    const { t } = useLanguage();
    const { currentUser } = useAuth();
    const [trainings, setTrainings] = useState<TrainingModule[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser?.company_id) return;

        const fetchTrainings = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('training_modules')
                    .select('*')
                    .eq('company_id', currentUser.company_id);

                if (error) throw error;
                if (data) {
                    setTrainings(data.map((t: any) => ({
                        id: t.id,
                        title: t.title,
                        duration: t.duration || '0 min',
                        thumbnail: getCleanImageUrl(t.thumbnail) || 'https://via.placeholder.com/300x200?text=Training',
                        videoUrl: t.video_url,
                        category: t.category
                    })));
                }
            } catch (err) {
                console.error("Error fetching trainings:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchTrainings();
    }, [currentUser?.company_id]);

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando treinamentos...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <RocketLaunchIcon className="w-8 h-8 mr-2 text-brand-primary" />
                {t('training.title')}
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {trainings.length > 0 ? (
                    trainings.map(training => (
                        <div key={training.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all group cursor-pointer">
                            <div className="relative h-48">
                                <img src={training.thumbnail} alt={training.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                    <PlayCircleIcon className="w-16 h-16 text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                                </div>
                                <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">{training.duration}</span>
                            </div>
                            <div className="p-4">
                                <h3 className="font-bold text-gray-800 group-hover:text-brand-primary transition-colors">{training.title}</h3>
                                <button className="mt-3 w-full py-2 bg-gray-50 text-brand-primary font-medium rounded-lg hover:bg-brand-primary hover:text-white transition-colors text-sm">
                                    {t('training.start')}
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full py-12 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                        <p>Nenhum treinamento disponível no momento.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TrainingPage;
