import React, { useState, useEffect, useMemo } from 'react';
import Card from './Card';
import type { Announcement } from '../types';
import { CalendarDaysIcon } from './icons';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

interface AnnouncementsProps {
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

const Announcements: React.FC<AnnouncementsProps> = ({ onNavigate }) => {
    const { profile: currentUser } = useAuth();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
    const [loading, setLoading] = useState(true);

    const availableReactions = ['👍', '❤️', '🎉', '🤔'];

    const getCompanyId = async () => {
        if (!currentUser) return null;
        if (currentUser.is_company_admin && currentUser.permissions) return null; // Logic might vary, let's fetch from profile
        const { data } = await supabase.from('profiles').select('company_id').eq('id', currentUser.id).single();
        return data?.company_id;
    };

    const fetchAnnouncements = async () => {
        try {
            setLoading(true);
            const companyId = await getCompanyId();
            if (!companyId) return;

            const { data, error } = await supabase
                .from('announcements')
                .select('*')
                .eq('company_id', companyId)
                .order('date', { ascending: false });

            if (error) throw error;

            const formatted: Announcement[] = data.map(a => ({
                id: a.id, // Keep UUID
                title: a.title,
                summary: a.summary,
                category: a.category,
                // Ensure date string is compatible or formatted
                date: new Date(a.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
                imageUrl: a.image_url,
                videoUrl: a.video_url,
                reactions: a.reactions || []
            }));

            setAnnouncements(formatted);
        } catch (error) {
            console.error('Error fetching announcements:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnnouncements();

        const channel = supabase
            .channel('public:announcements')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => fetchAnnouncements())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [currentUser]);

    const parsePtBrDate = (dateString: string): Date => {
        // ... existing logic or use actual Date object comparison if source is Date
        // Since we formatted it for display, we might need original date for sorting if we rely on display string.
        // But wait, our `formatted` list has strings.
        // Better to store original timestamp in state? Or just parse.
        // Let's stick to existing parse logic for now as it handles the 'de ' format if present.
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
        const sorted = [...announcements].sort((a, b) => {
            const dateA = parsePtBrDate(a.date);
            const dateB = parsePtBrDate(b.date);
            return dateB.getTime() - dateA.getTime();
        });

        if (sortOrder === 'oldest') {
            return sorted.reverse();
        }
        return sorted;

    }, [announcements, sortOrder]);


    const handleReact = async (announcement: Announcement, emoji: string) => {
        if (!currentUser) return;

        const currentReactions = announcement.reactions || [];
        // Find if this emoji group exists
        const reactionGroupIndex = currentReactions.findIndex(r => r.emoji === emoji);
        let newReactions = [...currentReactions];

        if (reactionGroupIndex > -1) {
            const users = newReactions[reactionGroupIndex].users;
            const userIndex = users.indexOf(currentUser.name); // Using name as per schema/Types? Schema uses JSONB. Types uses {emoji, users: string[]}. Ideally use ID but preserving existing logic.

            if (userIndex > -1) {
                users.splice(userIndex, 1);
                if (users.length === 0) {
                    newReactions.splice(reactionGroupIndex, 1);
                }
            } else {
                users.push(currentUser.name);
            }
        } else {
            newReactions.push({ emoji, users: [currentUser.name] });
        }

        // Optimistic update
        setAnnouncements(prev => prev.map(a => a.id === announcement.id ? { ...a, reactions: newReactions } : a)); // Match by ID now!

        try {
            await supabase.from('announcements').update({ reactions: newReactions }).eq('id', announcement.id); // Match by ID
        } catch (error) {
            console.error('Error updating reaction:', error);
            fetchAnnouncements(); // Revert on error
        }
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
                {loading && announcements.length === 0 ? (
                    [...Array(2)].map((_, i) => <AnnouncementSkeleton key={i} />)
                ) : announcements.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">Nenhum anúncio encontrado.</div>
                ) : (
                    sortedAnnouncements.map((item, index) => (
                        <div
                            key={item.id || index}
                            className="announcement-item border-b border-gray-100 pb-6 last:border-b-0 last:pb-0"
                            style={{ animationDelay: `${index * 150}ms` }}
                        >
                            {/* Same UI as before */}
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
                                    <CalendarDaysIcon className="w-4 h-4 mr-1.5" />
                                    <span>{item.date}</span>
                                </div>
                            </div>
                            <h4 className="font-bold text-lg text-brand-text mb-1">{item.title}</h4>
                            <p className="text-brand-subtle-text text-sm mb-3">{item.summary}</p>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center space-x-2">
                                    {(item.reactions || availableReactions.map(e => ({ emoji: e, users: [] }))).map(reaction => {
                                        const userHasReacted = reaction.users.includes(currentUser?.name || '');
                                        return (
                                            <button
                                                key={reaction.emoji}
                                                onClick={() => handleReact(item, reaction.emoji)}
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