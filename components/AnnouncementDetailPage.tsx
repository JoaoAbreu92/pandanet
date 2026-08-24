import React from 'react';
// FIX: Correcting the import path for types.
import type { Announcement } from '../types';
import Card from './Card';

interface AnnouncementDetailProps {
    announcement: Announcement;
    onBack: () => void;
}

const AnnouncementDetailPage: React.FC<AnnouncementDetailProps> = ({ announcement, onBack }) => {

    const getYoutubeEmbedUrl = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        if (match && match[2].length === 11) {
            return `https://www.youtube.com/embed/${match[2]}`;
        }
        return null;
    };

    const embedUrl = announcement.videoUrl ? getYoutubeEmbedUrl(announcement.videoUrl) : null;
    
    const getCategoryStyle = (category: Announcement['category']) => {
        switch (category) {
            case 'Notícias da Empresa': return 'bg-blue-100 text-blue-800';
            case 'Atualização de Produto': return 'bg-purple-100 text-purple-800';
            case 'RH & Cultura': return 'bg-green-100 text-green-800';
            case 'Evento': return 'bg-yellow-100 text-yellow-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <button onClick={onBack} className="mb-6 text-sm font-medium text-brand-primary hover:underline">
                &larr; Voltar para Home
            </button>
            <Card title="">
                {announcement.imageUrl && (
                    <div className="w-full max-h-[600px] bg-gray-50 rounded-t-lg mb-6 flex items-center justify-center overflow-hidden">
                        <img src={announcement.imageUrl} alt={announcement.title} className="w-full aspect-[3/1] object-cover rounded-t-lg" />
                    </div>
                )}
                <div className="p-2">
                    <div className="mb-4">
                        <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full mr-3 ${getCategoryStyle(announcement.category)}`}>
                            {announcement.category}
                        </span>
                        <span className="text-sm text-gray-500">{announcement.date}</span>
                    </div>
                    <h1 className="text-3xl font-bold text-brand-text mb-4">{announcement.title}</h1>
                    <p className="text-brand-subtle-text text-base leading-relaxed whitespace-pre-wrap">{announcement.summary}</p>
                    
                    {announcement.videoFile && (
                        <div className="mt-8">
                            <h3 className="text-xl font-bold text-brand-text mb-4">Vídeo</h3>
                            <div className="w-full rounded-lg overflow-hidden bg-black">
                                <video controls className="w-full max-h-[500px]">
                                    <source src={announcement.videoFile} type="video/mp4" />
                                    Seu navegador não suporta o elemento de vídeo.
                                </video>
                            </div>
                        </div>
                    )}

                    {embedUrl && (
                        <div className="mt-8">
                            <h3 className="text-xl font-bold text-brand-text mb-4">Vídeo Relacionado</h3>
                            <div className="aspect-w-16 aspect-h-9">
                                <iframe 
                                    src={embedUrl}
                                    title={announcement.title}
                                    frameBorder="0" 
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                    allowFullScreen
                                    className="w-full h-full rounded-lg"
                                ></iframe>
                            </div>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default AnnouncementDetailPage;