import React, { useState, useMemo } from 'react';
import Card from './Card';
// FIX: Correcting the import path for types.
import type { Announcement } from '../types';
import { CalendarDaysIcon } from './icons';

interface AnnouncementsProps {
    announcements: Announcement[];
    onNavigate: (page: string, context: any) => void;
}

const AnnouncementSkeleton: React.FC = () => (
    <div className="animate-pulse space-y-4">
        <div className="h-40 bg-gray-200 rounded-lg"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
        </div>
        <div className="h-3 bg-gray-200 rounded w-1/4 mt-2"></div>
    </div>
);

const Announcements: React.FC<AnnouncementsProps> = ({ announcements, onNavigate }) => {
    const [localAnnouncements, setLocalAnnouncements] = useState(announcements);
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

    const currentUser = 'Ana Williams';
    const availableReactions = ['👍', '❤️', '🎉', '🤔'];
    
    const parsePtBrDate = (dateString: string): Date => {
        const months: { [key: string]: number } = { 'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3, 'maio': 4, 'junho': 5, 'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11 };
        const parts = dateString.toLowerCase().replace('de ', '').split(' ');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = months[parts[1]];
            const year = parseInt(parts[2], 10);
            if (!isNaN(day) && month !== undefined && !isNaN(year)) {
                return new Date(year, month, day);
            }
        }
        return new Date(0);
    };

    const sortedAnnouncements = useMemo(() => {
        const sorted = [...localAnnouncements].sort((a, b) => {
            const dateA = parsePtBrDate(a.date);
            const dateB = parsePtBrDate(b.date);
            return dateB.getTime() - dateA.getTime();
        });

        if (sortOrder === 'oldest') {
            return sorted.reverse();
        }
        return sorted;

    }, [localAnnouncements, sortOrder]);


    const handleReact = (announcementTitle: string, emoji: string) => {
        const newAnnouncements = localAnnouncements.map(announcement => {
            if (announcement.title === announcementTitle) {
                const reaction = announcement.reactions?.find(r => r.emoji === emoji);
                if (reaction) {
                    const userIndex = reaction.users.indexOf(currentUser);
                    if (userIndex > -1) {
                        reaction.users.splice(userIndex, 1);
                    } else {
                        reaction.users.push(currentUser);
                    }
                } else if (announcement.reactions) {
                    announcement.reactions.push({ emoji, users: [currentUser] });
                } else {
                    announcement.reactions = [{ emoji, users: [currentUser] }];
                }
                return { ...announcement };
            }
            return announcement;
        });
        setLocalAnnouncements(newAnnouncements);
    };

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
        <Card title="Anúncios da Empresa" headerAction={
            <div className="flex items-center space-x-2 text-sm">
                <span className="text-gray-500">Ordenar por:</span>
                <button onClick={() => setSortOrder('newest')} className={`px-2 py-1 rounded-md transition-colors ${sortOrder === 'newest' ? 'bg-emerald-100 text-brand-primary font-semibold' : 'hover:bg-gray-100'}`}>Mais Recentes</button>
                <button onClick={() => setSortOrder('oldest')} className={`px-2 py-1 rounded-md transition-colors ${sortOrder === 'oldest' ? 'bg-emerald-100 text-brand-primary font-semibold' : 'hover:bg-gray-100'}`}>Mais Antigos</button>
            </div>
        }>
            <div className="space-y-8">
                {announcements.length === 0 ? (
                     [...Array(2)].map((_, i) => <AnnouncementSkeleton key={i} />)
                ) : (
                    sortedAnnouncements.map((item, index) => (
                        <div 
                            key={index} 
                            className="announcement-item border-b border-gray-100 pb-6 last:border-b-0 last:pb-0"
                            style={{ animationDelay: `${index * 150}ms`, opacity: 0 }}
                        >
                            {item.imageUrl && (
                                <div className="w-full h-64 bg-gray-50 rounded-lg mb-4 flex items-center justify-center overflow-hidden border border-gray-100">
                                    <img src={item.imageUrl} alt={item.title} className="w-full h-full object-contain" />
                                </div>
                            )}
                            <div className="flex items-center space-x-4 mb-2">
                                <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${getCategoryStyle(item.category)}`}>
                                    {item.category}
                                </span>
                                <div className="flex items-center text-sm text-brand-subtle-text">
                                    <CalendarDaysIcon className="w-4 h-4 mr-1.5"/>
                                    <span>{item.date}</span>
                                </div>
                            </div>
                            <h4 className="font-bold text-lg text-brand-text mb-1">{item.title}</h4>
                            <p className="text-brand-subtle-text text-sm mb-3">{item.summary}</p>
                            <div className="flex justify-between items-center">
                                 <div className="flex items-center space-x-2">
                                    {(item.reactions || availableReactions.map(e => ({emoji: e, users: []}))).map(reaction => {
                                        const userHasReacted = reaction.users.includes(currentUser);
                                        return (
                                            <button 
                                                key={reaction.emoji}
                                                onClick={() => handleReact(item.title, reaction.emoji)}
                                                className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs transform transition-all duration-150 ease-in-out active:scale-110 ${userHasReacted ? 'bg-emerald-100 text-brand-primary font-semibold' : 'bg-gray-100 hover:bg-gray-200'}`}
                                            >
                                                <span>{reaction.emoji}</span>
                                                <span className="text-brand-subtle-text">{reaction.users.length}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                             <button onClick={() => onNavigate('announcement-detail', item)} className="mt-4 w-full text-center px-4 py-2 text-sm font-medium text-brand-primary bg-emerald-50 rounded-md hover:bg-emerald-100 transition-colors">
                                Ver Detalhes
                            </button>
                        </div>
                    ))
                )}
            </div>
        </Card>
    );
};

export default Announcements;