import React, { useState, useEffect } from 'react';
import type { Event } from '../types';
import { CalendarDaysIcon, MapPinIcon } from './icons';

interface EventsCarouselMiniProps {
    events: Event[];
}

const EventsCarouselMini: React.FC<EventsCarouselMiniProps> = ({ events }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const upcomingEvents = events
        .filter(e => new Date(e.date) >= new Date())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 5); // Take top 5 upcoming

    useEffect(() => {
        if (upcomingEvents.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % upcomingEvents.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [upcomingEvents.length]);

    if (upcomingEvents.length === 0) {
        return (
            <div className="bg-white rounded-lg p-4 text-center border border-gray-100 shadow-sm">
                <p className="text-sm text-gray-500">Sem eventos próximos.</p>
            </div>
        );
    }

    const event = upcomingEvents[currentIndex];

    return (
        <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-100 group hover:shadow-md transition-all">
            <div className="h-32 overflow-hidden relative">
                <img
                    src={event.imageUrl || `https://source.unsplash.com/random/400x300/?event,${event.id}`}
                    alt={event.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold text-brand-primary uppercase">
                    {event.category}
                </div>
            </div>
            <div className="p-3">
                <p className="text-xs text-brand-primary font-bold mb-1 uppercase tracking-wide">
                    {new Date(event.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                </p>
                <h4 className="font-bold text-gray-800 text-sm mb-1 leading-tight line-clamp-2">{event.title}</h4>
                <div className="flex items-center text-xs text-gray-500 mt-2">
                    <MapPinIcon className="w-3 h-3 mr-1" /> {event.location}
                </div>

                <div className="flex justify-center mt-3 space-x-1">
                    {upcomingEvents.map((_, idx) => (
                        <div
                            key={idx}
                            className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === currentIndex ? 'bg-brand-primary' : 'bg-gray-200'}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default EventsCarouselMini;
