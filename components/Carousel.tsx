import React, { useState, useEffect, useCallback } from 'react';
// FIX: Correcting the import path for types.
import type { Banner } from '../types';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

const banners: Banner[] = [
    { id: 1, imageUrl: 'https://picsum.photos/id/1018/1200/400', title: 'Explore Nossos Novos Benefícios', subtitle: 'Programas de bem-estar e desenvolvimento profissional para você.', link: '#' },
    { id: 2, imageUrl: 'https://picsum.photos/id/1025/1200/400', title: 'Reunião Geral do Q3', subtitle: 'Participe e fique por dentro das metas e conquistas da empresa.', link: '#' },
    { id: 3, imageUrl: 'https://picsum.photos/id/1043/1200/400', title: 'Inovação em Foco', subtitle: 'Conheça os projetos que estão moldando o nosso futuro.', link: '#' },
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
        const slideInterval = setInterval(nextSlide, 5000); // Change slide every 5 seconds
        return () => clearInterval(slideInterval);
    }, [nextSlide]);

    const goToSlide = (slideIndex: number) => {
        setCurrentIndex(slideIndex);
    };

    return (
        <div className="relative w-full h-64 md:h-80 group">
            <div
                style={{ backgroundImage: `url(${banners[currentIndex].imageUrl})` }}
                className="w-full h-full rounded-xl bg-center bg-cover duration-500"
            >
                <div className="absolute inset-0 bg-black/50 rounded-xl flex flex-col justify-center items-center text-center p-4">
                    <h2 className="text-white text-3xl md:text-4xl font-bold drop-shadow-lg">{banners[currentIndex].title}</h2>
                    <p className="text-gray-200 mt-2 text-lg drop-shadow-md">{banners[currentIndex].subtitle}</p>
                     <a href={banners[currentIndex].link} className="mt-4 px-6 py-2 bg-brand-primary text-white font-semibold rounded-full hover:bg-emerald-600 transition-colors">
                        Saiba Mais
                    </a>
                </div>
            </div>
            
            {/* Left Arrow */}
            <div onClick={prevSlide} className="hidden group-hover:block absolute top-1/2 -translate-y-1/2 left-5 text-2xl rounded-full p-2 bg-black/20 text-white cursor-pointer">
                <ChevronLeftIcon className="w-6 h-6" />
            </div>
            {/* Right Arrow */}
            <div onClick={nextSlide} className="hidden group-hover:block absolute top-1/2 -translate-y-1/2 right-5 text-2xl rounded-full p-2 bg-black/20 text-white cursor-pointer">
                <ChevronRightIcon className="w-6 h-6" />
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex justify-center py-2 space-x-2">
                {banners.map((_, slideIndex) => (
                    <div
                        key={slideIndex}
                        onClick={() => goToSlide(slideIndex)}
                        className={`w-3 h-3 rounded-full cursor-pointer transition-colors ${currentIndex === slideIndex ? 'bg-white' : 'bg-white/50'}`}
                    ></div>
                ))}
            </div>
        </div>
    );
};

export default Carousel;