import React, { useState, useEffect, useCallback } from 'react';
// FIX: Correcting the import path for types.
import type { Banner } from '../types';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

// Importing local banner images
import bannerPersonalDev from '../assets/banners/personal_development.png';
import bannerSecurity from '../assets/banners/internet_security.png';
import bannerWellbeing from '../assets/banners/wellbeing.png';

const banners: Banner[] = [
    {
        id: 1,
        imageUrl: bannerPersonalDev,
        title: 'Desenvolvimento Pessoal & Carreira',
        subtitle: 'Invista no seu futuro com nossos programas de mentoria e cursos exclusivos. O seu crescimento é a nossa prioridade.',
        link: '/training'
    },
    {
        id: 2,
        imageUrl: bannerSecurity,
        title: 'Segurança na Internet',
        subtitle: 'Proteja seus dados e navegue com confiança. Aprenda as melhores práticas de cibersegurança e mantenha-se seguro.',
        link: '/infosec'
    },
    {
        id: 3,
        imageUrl: bannerWellbeing,
        title: 'Bem-Estar & Equilíbrio',
        subtitle: 'Priorize sua saúde mental e física. Descubra dicas, atividades e recursos para uma vida mais equilibrada e feliz.',
        link: '/bem-estar'
    },
];

const Carousel: React.FC = () => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const prevSlide = useCallback(() => {
        const isFirstSlide = currentIndex === 0;
        const newIndex = isFirstSlide ? banners.length - 1 : currentIndex - 1;
        setCurrentIndex(newIndex);
    }, [currentIndex]);

    const nextSlide = useCallback(() => {
        const isLastSlide = currentIndex === banners.length - 1;
        const newIndex = isLastSlide ? 0 : currentIndex + 1;
        setCurrentIndex(newIndex);
    }, [currentIndex]);

    useEffect(() => {
        const slideInterval = setInterval(nextSlide, 6000); // Change slide every 6 seconds for better readability
        return () => clearInterval(slideInterval);
    }, [nextSlide]);

    const goToSlide = (slideIndex: number) => {
        setCurrentIndex(slideIndex);
    };

    return (
        <div className="relative w-full h-[400px] group overflow-hidden rounded-2xl shadow-2xl transition-all duration-300 hover:shadow-cyan-900/20">
            {/* Main Image Background */}
            <div
                style={{ backgroundImage: `url(${banners[currentIndex].imageUrl})` }}
                className="w-full h-full bg-center bg-cover duration-700 ease-in-out transform transition-transform"
            >
                {/* Gradient Overlay for Text Readability */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent flex flex-col justify-center items-start text-left p-12 md:p-16">
                    <div className="max-w-2xl transform transition-all duration-700 translate-y-0 opacity-100 animate-fade-in-up">
                        <h2 className="text-white text-5xl md:text-7xl font-extrabold drop-shadow-lg mb-6 tracking-tight leading-tight">
                            {banners[currentIndex].title}
                        </h2>
                        <p className="text-gray-100 text-2xl md:text-3xl font-light drop-shadow-md mb-8 leading-relaxed border-l-4 border-brand-primary pl-4">
                            {banners[currentIndex].subtitle}
                        </p>
                    </div>
                </div>
            </div>

            {/* Left Arrow */}
            <div onClick={prevSlide} className="hidden group-hover:flex absolute top-1/2 -translate-y-1/2 left-6 text-white cursor-pointer hover:scale-110 transition-transform duration-200">
                <div className="bg-white/10 backdrop-blur-md p-3 rounded-full border border-white/20 hover:bg-white/20">
                    <ChevronLeftIcon className="w-8 h-8" />
                </div>
            </div>
            {/* Right Arrow */}
            <div onClick={nextSlide} className="hidden group-hover:flex absolute top-1/2 -translate-y-1/2 right-6 text-white cursor-pointer hover:scale-110 transition-transform duration-200">
                <div className="bg-white/10 backdrop-blur-md p-3 rounded-full border border-white/20 hover:bg-white/20">
                    <ChevronRightIcon className="w-8 h-8" />
                </div>
            </div>

            {/* Indicators */}
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
        </div>
    );
};

export default Carousel;