import React, { useState, useEffect } from 'react';
import Card from './Card';
import type { Benefit } from '../types';
import { supabase, getCleanImageUrl } from '../supabaseClient';
import { useAuth } from './AuthContext';

const BeneficiosPage: React.FC = () => {
    const { currentUser } = useAuth();
    const [benefits, setBenefits] = useState<Benefit[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchBenefits = async () => {
        if (!currentUser?.company_id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('benefits')
                .select('*')
                .eq('company_id', currentUser.company_id);

            if (error) throw error;
            if (data) {
                setBenefits(data.map((b: any) => ({
                    id: b.id,
                    title: b.title,
                    description: b.description,
                    features: b.features || [],
                    link: b.link || '#',
                    imageUrl: b.image_url
                })));
            }
        } catch (error) {
            console.error('Error fetching benefits:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBenefits();
    }, [currentUser?.company_id]);

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando benefícios...</div>;

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="text-center md:text-left">
                <h1 className="text-3xl font-bold text-brand-text">Portal de Benefícios</h1>
                <p className="mt-2 text-lg text-brand-subtle-text">Conheça os benefícios que a empresa oferece para cuidar de você.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {benefits.length === 0 ? (
                    <div className="col-span-2 text-center py-12 text-gray-500 bg-white rounded-xl shadow border border-gray-100 dark:bg-slate-800 dark:border-slate-700">Nenhum benefício disponível no momento.</div>
                ) : (
                    benefits.map(benefit => (
                        <Card key={benefit.id} noPadding={true} className="hover:shadow-lg transition-shadow relative overflow-hidden flex flex-col">
                            {benefit.imageUrl && (
                                <img
                                    src={getCleanImageUrl(benefit.imageUrl)}
                                    alt={benefit.title}
                                    className="w-full h-48 object-cover border-b dark:border-slate-700"
                                />
                            )}
                            <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                                <div className="space-y-3">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{benefit.title}</h3>
                                    <p className="text-brand-subtle-text text-sm leading-relaxed">{benefit.description}</p>
                                    {benefit.features && benefit.features.length > 0 && (
                                        <div>
                                            <h4 className="font-semibold text-brand-text text-sm">Principais Coberturas:</h4>
                                            <ul className="list-disc list-inside text-brand-subtle-text text-xs space-y-1 mt-2">
                                                {benefit.features.map((feature, index) => <li key={index}>{feature}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                                {benefit.link && benefit.link !== '#' && benefit.link !== '' && (
                                    <div className="pt-2 border-t dark:border-white/5">
                                        <a
                                            href={benefit.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center text-sm font-semibold text-brand-primary hover:text-emerald-600 transition-colors"
                                        >
                                            Saiba mais &rarr;
                                        </a>
                                    </div>
                                )}
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
};

export default BeneficiosPage;