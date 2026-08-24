import React, { useState, useEffect, useCallback } from 'react';
import type { Banner } from '../types';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

// Local fallbacks if no banners are configured
import bannerPersonalDev from '../assets/banners/personal_development.png';
import bannerSecurity from '../assets/banners/internet_security.png';
import bannerWellbeing from '../assets/banners/wellbeing.png';

const fallbackBanners: Banner[] = [
    {
        id: '1',
        imageUrl: bannerPersonalDev,
        title: 'Desenvolvimento Pessoal & Carreira',
        subtitle: 'Invista no seu futuro com nossos programas de mentoria e cursos exclusivos.',
        link: '/training'
    },
    {
        id: '2',
        imageUrl: bannerSecurity,
        title: 'Segurança na Internet',
        subtitle: 'Proteja seus dados e navegue com confiança.',
        link: '/infosec'
    },
    {
        id: '3',
        imageUrl: bannerWellbeing,
        title: 'Bem-Estar & Equilíbrio',
        subtitle: 'Priorize sua saúde mental e física.',
        link: '/bem-estar'
    },
];

const Carousel: React.FC = () => {
    const { currentUser } = useAuth();
    const [banners, setBanners] = useState<Banner[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    if (currentUser?.company?.custom_features?.banners === false) {
        return null;
    }

    const fetchBanners = async () => {
        if (!currentUser?.company_id) return;
        try {
            const { data, error } = await supabase
                .from('banners')
                .select('*')
                .eq('company_id', currentUser.company_id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data && data.length > 0) {
                setBanners(data.map(b => ({
                    id: b.id,
                    imageUrl: b.image_url,
                    title: b.title,
                    subtitle: b.subtitle,
                    link: b.link
                })));
            } else {
                setBanners(fallbackBanners);
            }
        } catch (err) {
            console.error('Error fetching banners:', err);
            setBanners(fallbackBanners);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBanners();
    }, [currentUser?.company_id]);

    const prevSlide = useCallback(() => {
        const isFirstSlide = currentIndex === 0;
        const newIndex = isFirstSlide ? banners.length - 1 : currentIndex - 1;
        setCurrentIndex(newIndex);
    }, [currentIndex, banners.length]);

    const nextSlide = useCallback(() => {
        const isLastSlide = currentIndex === banners.length - 1;
        const newIndex = isLastSlide ? 0 : currentIndex + 1;
        setCurrentIndex(newIndex);
    }, [currentIndex, banners.length]);

    useEffect(() => {
        if (banners.length <= 1) return;
        const slideInterval = setInterval(nextSlide, 6000);
        return () => clearInterval(slideInterval);
    }, [nextSlide, banners.length]);

    const goToSlide = (slideIndex: number) => {
        setCurrentIndex(slideIndex);
    };

    if (loading) return <div className="w-full h-[200px] sm:h-[300px] md:h-[400px] bg-gray-100 rounded-2xl animate-pulse flex items-center justify-center text-gray-400">Carregando destaques...</div>;
    if (banners.length === 0) return null;

    return (
        <div className="relative w-full h-[200px] sm:h-[300px] md:h-[400px] group overflow-hidden rounded-2xl shadow-2xl transition-all duration-300 hover:shadow-cyan-900/20">
            {/* Main Image Background */}
            <div
                style={{ backgroundImage: `url(${banners[currentIndex].imageUrl})` }}
                className="w-full h-full bg-center bg-cover duration-700 ease-in-out transform transition-transform"
            >
                {/* Gradient Overlay for Text Readability */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent flex flex-col justify-center items-start text-left p-6 sm:p-12 md:p-16">
                    <div className="max-w-2xl transform transition-all duration-700 translate-y-0 opacity-100 animate-fade-in-up">
                        <h2 className="text-white text-lg sm:text-3xl md:text-5xl font-semibold drop-shadow-lg mb-2 sm:mb-4 md:mb-6 tracking-tight leading-tight">
                            {banners[currentIndex].title}
                        </h2>
                        <p className="text-gray-100 text-xs sm:text-base md:text-xl font-light drop-shadow-md mb-3 sm:mb-6 md:mb-8 leading-relaxed border-l-4 border-brand-primary pl-4">
                            {banners[currentIndex].subtitle}
                        </p>
                        {banners[currentIndex].link && (
                            <a href={banners[currentIndex].link} className="inline-block px-3 py-1.5 sm:px-6 sm:py-3 bg-brand-primary text-white font-semibold rounded-lg hover:bg-emerald-600 transition-colors shadow-lg text-xs sm:text-base">
                                Saiba Mais
                            </a>
                        )}
                    </div>
                </div>
            </div>

            {/* Left Arrow */}
            {banners.length > 1 && (
                <div onClick={prevSlide} className="hidden group-hover:flex absolute top-1/2 -translate-y-1/2 left-6 text-white cursor-pointer hover:scale-110 transition-transform duration-200">
                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-full border border-white/20 hover:bg-white/20">
                        <ChevronLeftIcon className="w-8 h-8" />
                    </div>
                </div>
            )}
            {/* Right Arrow */}
            {banners.length > 1 && (
                <div onClick={nextSlide} className="hidden group-hover:flex absolute top-1/2 -translate-y-1/2 right-6 text-white cursor-pointer hover:scale-110 transition-transform duration-200">
                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-full border border-white/20 hover:bg-white/20">
                        <ChevronRightIcon className="w-8 h-8" />
                    </div>
                </div>
            )}

            {/* Indicators */}
            {banners.length > 1 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex space-x-3">
                    {banners.map((_, slideIndex) => (
                        <div
                            key={slideIndex}
                            onClick={() => goToSlide(slideIndex)}
                            className={`transition-all duration-300 cursor-pointer rounded-full shadow-sm ${currentIndex === slideIndex
                                ? 'w-8 h-2 bg-brand-primary'
                                : 'w-2 h-2 bg-white/60 hover:bg-white'
                                }`}
                        ></div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Carousel;