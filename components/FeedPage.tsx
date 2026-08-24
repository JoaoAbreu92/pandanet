import React, { useState, useEffect, useRef } from 'react';
import Card from './Card';
import EventsCarouselMini from './EventsCarouselMini';
import RecognitionWidget from './RecognitionWidget';
import RecognitionModal from './RecognitionModal';
import { supabase, getCleanImageUrl } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import { useLanguage } from './LanguageContext';
import { FaceSmileIcon, UserGroupIcon, PaperAirplaneIcon, PlusIcon, ChatBubbleLeftRightIcon, VideoCameraIcon, PhotoIcon, HandThumbUpIcon, ChatBubbleLeftIcon, ShareIcon, HashtagIcon, CakeIcon, XCircleIcon, TrashIcon, ShieldCheckIcon as ShieldCheck } from './icons';
import type { Post, Employee, Event, Recognition, PostComment, PostReaction, Page, CompanyBadge, UserBadge } from '../types';
import BadgeDetailModal from './BadgeDetailModal';
import { UserAvatar } from './UserAvatar';

export const PostCard: React.FC<{
    post: Post;
    currentUser: Employee;
    onToggleReaction: (postId: string, emoji: string) => void;
    onSubmitComment: (postId: string, text: string) => void;
    onShare: (post: Post) => void;
    onDelete: (postId: string) => void;
    isGhostMode?: boolean;
}> = ({ post, currentUser, onToggleReaction, onSubmitComment, onShare, onDelete, isGhostMode }) => {
    const [commentText, setCommentText] = useState('');
    const [showReactionMenu, setShowReactionMenu] = useState(false);
    const [showFullReactions, setShowFullReactions] = useState(false);
    const reactionMenuRef = useRef<HTMLDivElement>(null);
    const commentInputRef = useRef<HTMLInputElement>(null);
    const { t } = useLanguage();

    const quickReactions = ['👍', '❤️', '😂', '🔥', '😮'];
    const allReactions = ['👍', '❤️', '😂', '🔥', '😮', '😢', '😡', '🤔', '🎉', '👀', '🚀', '💯', '🥳', '😍', '🙏', '💪', '🤝', '😎'];

    const handleCommentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (commentText.trim()) {
            onSubmitComment(post.id, commentText);
            setCommentText('');
        }
    };

    // Fechar popup ao clicar fora
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (reactionMenuRef.current && !reactionMenuRef.current.contains(e.target as Node)) {
                setShowReactionMenu(false);
                setShowFullReactions(false);
            }
        };
        if (showReactionMenu) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showReactionMenu]);

    const getEmbedUrl = (content: string) => {
        const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
        const vimeoRegex = /(?:https?:\/\/)?(?:www\.)?(?:vimeo\.com\/)([0-9]+)/;
        const instagramRegex = /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com)\/(?:p|reels|reel)\/([a-zA-Z0-9_-]+)/;
        const tiktokRegex = /(?:https?:\/\/)?(?:www\.)?(?:tiktok\.com)\/(?:@[\w.-]+\/video\/|v\/|embed\/v3\/)([0-9]+)/;

        const ytMatch = content.match(youtubeRegex);
        if (ytMatch) return { type: 'youtube', id: ytMatch[1], url: `https://www.youtube.com/embed/${ytMatch[1]}` };

        const igMatch = content.match(instagramRegex);
        if (igMatch) return { type: 'instagram', id: igMatch[1], url: `https://www.instagram.com/p/${igMatch[1]}/embed/` };

        const ttMatch = content.match(tiktokRegex);
        if (ttMatch) return { type: 'tiktok', id: ttMatch[1], url: `https://www.tiktok.com/embed/v3/${ttMatch[1]}` };

        const vimeoMatch = content.match(vimeoRegex);
        if (vimeoMatch) return { type: 'vimeo', id: vimeoMatch[1], url: `https://player.vimeo.com/video/${vimeoMatch[1]}` };

        return null;
    };

    const renderContent = (content: string) => {
        // Primeiro, resolve as menções
        const parts = content.split(/(@[\w\s]+)/g);
        return parts.map((part, i) => {
            if (part.startsWith('@')) {
                return <span key={i} className="text-brand-primary font-bold bg-emerald-50 dark:bg-emerald-900/30 px-1 rounded">{part}</span>;
            }
            // Detectar links e transformá-los em links clicáveis (opcional, mas bom para UX)
            return part;
        });
    };

    const isAuthor = currentUser.id === post.authorId;

    const isBadgeAward = post.content.startsWith('[BADGE_AWARD]');
    let badgeData: any = null;
    if (isBadgeAward) {
        try {
            badgeData = JSON.parse(post.content.replace('[BADGE_AWARD]', ''));
        } catch (e) {
            console.error('Failed to parse badge award json', e);
        }
    }

    const isLevelUp = post.content.startsWith('[LEVEL_UP]');
    let levelUpData: any = null;
    if (isLevelUp) {
        try {
            levelUpData = JSON.parse(post.content.replace('[LEVEL_UP]', ''));
        } catch (e) {
            console.error('Failed to parse level up json', e);
        }
    }

    return (
        <Card 
            title="" 
            className={`pb-2 overflow-visible transition-all duration-500 ${
                badgeData 
                    ? 'border-2 border-amber-300/80 bg-gradient-to-br from-amber-50/40 via-white to-rose-50/40 shadow-xl shadow-amber-500/5 dark:from-slate-800/90 dark:via-slate-900/95 dark:to-slate-800/90 relative overflow-hidden dark:border-amber-400/40 rounded-3xl' 
                    : levelUpData
                        ? 'border-2 border-purple-500/40 bg-gradient-to-br from-indigo-50/30 via-white to-purple-50/30 shadow-xl shadow-purple-500/5 dark:from-slate-800/90 dark:via-slate-900/95 dark:to-slate-800/90 relative overflow-hidden dark:border-purple-500/30 rounded-3xl'
                        : ''
            }`}
        >
            {badgeData ? (
                <div className="py-6 px-5 flex flex-col md:flex-row items-center gap-6 relative select-none">
                    {/* Glowing background rays */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-amber-400/20 rounded-full blur-3xl -z-10 animate-pulse"></div>
                    
                    {/* Delete button for badge award post */}
                    {isAuthor && (
                        <button 
                            onClick={() => onDelete(post.id)} 
                            className="absolute right-2 top-2 p-2 text-slate-400 hover:text-red-500 transition-colors z-10" 
                            title={t('feed.delete_post')}
                        >
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    )}

                    {/* Left Side: Large Badge */}
                    <div className="flex-shrink-0 relative">
                        <div className={`w-32 h-32 md:w-36 md:h-36 rounded-3xl ${badgeData.badge_color} border-2 border-white/40 flex items-center justify-center text-6xl shadow-xl shadow-slate-300/40 dark:shadow-slate-950/50 transform hover:scale-105 hover:rotate-3 transition-all duration-300 cursor-pointer animate-float overflow-hidden`}>
                            {badgeData.badge_icon.startsWith('http') ? (
                                <img src={badgeData.badge_icon} className="w-full h-full object-cover rounded-3xl border border-white/10" alt="" />
                            ) : (
                                badgeData.badge_icon
                            )}
                        </div>
                    </div>
                    
                    {/* Right Side: Information */}
                    <div className="flex-1 min-w-0 text-left space-y-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 uppercase tracking-widest">
                            🏆 Nova Conquista Registrada
                        </span>
                        
                        <h3 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white leading-tight">
                            Parabéns, {badgeData.recipient_name}! 🎉
                        </h3>
                        
                        <p className="text-sm text-slate-650 dark:text-slate-300 font-medium">
                            Conquistou o selo <span className="font-extrabold text-brand-primary dark:text-emerald-400">{badgeData.badge_name}</span>
                        </p>
                        
                        <div className="relative w-full p-4 rounded-2xl bg-white/60 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/50 italic text-slate-700 dark:text-slate-200 text-sm font-medium shadow-sm leading-relaxed">
                            <span className="absolute -top-3.5 left-4 text-3xl text-brand-primary font-serif select-none">“</span>
                            <p className="px-2">{badgeData.reason}</p>
                            <span className="absolute -bottom-6 right-4 text-3xl text-brand-primary font-serif select-none">”</span>
                        </div>

                        <div className="flex items-center gap-2 pt-1 text-slate-550 dark:text-slate-400">
                            <UserAvatar src={badgeData.recipient_avatar} name={badgeData.recipient_name} level={1} size="xs" className="w-5 h-5 shrink-0" />
                            <span className="text-[10px] font-bold">
                                Premiação concedida por {badgeData.awarded_by_name}
                            </span>
                        </div>
                    </div>
                </div>
            ) : levelUpData ? (
                <div className="py-6 px-5 flex flex-col md:flex-row items-center gap-6 relative select-none">
                    {/* Glowing background rays */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl -z-10 animate-pulse"></div>
                    
                    {/* Delete button for level up post */}
                    {isAuthor && (
                        <button 
                            onClick={() => onDelete(post.id)} 
                            className="absolute right-2 top-2 p-2 text-slate-400 hover:text-red-500 transition-colors z-10" 
                            title={t('feed.delete_post')}
                        >
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    )}

                    {/* Left Side: Avatar with Special Level Ring */}
                    <div className="flex-shrink-0 relative">
                        <UserAvatar 
                            src={levelUpData.recipient_avatar} 
                            name={levelUpData.recipient_name} 
                            level={levelUpData.new_level} 
                            size="xl" 
                            className="shadow-2xl scale-110" 
                        />
                    </div>
                    
                    {/* Right Side: Information */}
                    <div className="flex-1 min-w-0 text-left space-y-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400 uppercase tracking-widest">
                            ⚔️ Evolução de Nível (RPG)
                        </span>
                        
                        <h3 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white leading-tight">
                            {levelUpData.recipient_name} subiu para o Nível {levelUpData.new_level}! 🚀
                        </h3>
                        
                        <p className="text-sm text-slate-650 dark:text-slate-300 font-medium">
                            {levelUpData.message}
                        </p>
                        
                        <div className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 bg-purple-50 dark:bg-purple-950/20 p-2.5 rounded-xl border border-purple-100 dark:border-purple-900/30">
                            <span>✨ Incentive o seu colega reagindo e comentando abaixo!</span>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                            <UserAvatar src={post.authorAvatar} name={post.authorName} level={post.authorLevel} size="sm" className="mr-3 shrink-0" />
                            <div>
                                <h4 className="font-bold text-brand-text dark:text-gray-100">{post.authorName}</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(post.timestamp).toLocaleString()}</p>
                            </div>
                        </div>
                        {isAuthor && (
                            <button onClick={() => onDelete(post.id)} className="p-2 text-gray-400 transition-colors" title={t('feed.delete_post')}>
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    <div className="text-brand-text dark:text-gray-200 whitespace-pre-wrap mb-4">
                        {renderContent(post.content)}
                    </div>

                    {post.mediaUrl && (
                        <div className="mb-4 rounded-lg overflow-hidden bg-gray-100 border border-gray-100 dark:bg-slate-700 dark:border-slate-600 text-center">
                            <img src={post.mediaUrl} alt="Post content" className="w-full h-auto object-contain max-h-[500px]" />
                        </div>
                    )}

                    {!post.mediaUrl && getEmbedUrl(post.content) && (
                        <div className={`mb-4 rounded-lg overflow-hidden bg-black shadow-inner flex justify-center items-center ${getEmbedUrl(post.content)?.type === 'youtube' || getEmbedUrl(post.content)?.type === 'vimeo' ? 'aspect-video w-full' : 'max-h-[600px] w-full max-w-[400px] mx-auto'}`}>
                            <iframe
                                width="100%"
                                height="105%"
                                src={getEmbedUrl(post.content)?.url}
                                title="Video player"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                            ></iframe>
                        </div>
                    )}
                </>
            )}

            <div className="flex justify-between text-sm text-gray-500 pb-2 border-b">
                <div className="flex items-center space-x-2">
                    {post.reactions.length > 0 && (
                        <div className="flex -space-x-1">
                            {Array.from(new Set(post.reactions.map(r => r.emoji))).slice(0, 3).map((emoji, i) => (
                                <span key={i} className="bg-white rounded-full px-0.5 border text-xs">{emoji}</span>
                            ))}
                        </div>
                    )}
                    <span>{post.reactions.length} {t('feed.interactions')}</span>
                </div>
                <span>{post.comments.length} {t('feed.comment')}s</span>
            </div>

            <div className="flex justify-around py-1 relative">
                <div 
                    className="flex-1 relative" 
                    ref={reactionMenuRef}
                    onMouseEnter={() => { if (!isGhostMode) setShowReactionMenu(true); }}
                    onMouseLeave={() => { setShowReactionMenu(false); setShowFullReactions(false); }}
                >
                    <button 
                        disabled={isGhostMode}
                        onClick={() => { if (!isGhostMode) setShowReactionMenu(!showReactionMenu); }}
                        className={`w-full flex items-center justify-center space-x-2 py-2 rounded-lg ${isGhostMode ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98]'} transition-all duration-300 ${post.reactions.some(r => r.userId === currentUser.id) ? 'text-brand-primary font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                        <HandThumbUpIcon className="w-5 h-5" /><span>{t('feed.react')}</span>
                    </button>
                    {showReactionMenu && (
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-xl shadow-2xl border border-white/10 rounded-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center gap-1">
                                {quickReactions.map(emoji => (
                                    <button 
                                        key={emoji} 
                                        onClick={() => { onToggleReaction(post.id, emoji); setShowReactionMenu(false); setShowFullReactions(false); }} 
                                        className="text-2xl w-10 h-10 flex items-center justify-center rounded-xl active:scale-95 hover:scale-125 hover:-translate-y-1 transition-all duration-200 text-white"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setShowFullReactions(!showFullReactions)}
                                    className="w-8 h-8 flex items-center justify-center text-white/60 rounded-xl transition-all text-sm font-bold hover:bg-white/10"
                                    title="Ver todos"
                                >
                                    {showFullReactions ? '✕' : '+'}
                                </button>
                            </div>
                            {showFullReactions && (
                                <div className="grid grid-cols-6 gap-1 mt-2 pt-2 border-t border-white/10 max-h-40 overflow-y-auto custom-scrollbar">
                                    {allReactions.filter(e => !quickReactions.includes(e)).map(emoji => (
                                        <button 
                                            key={emoji} 
                                            onClick={() => { onToggleReaction(post.id, emoji); setShowReactionMenu(false); setShowFullReactions(false); }} 
                                            className="text-xl w-9 h-9 flex items-center justify-center rounded-xl active:scale-95 hover:scale-125 hover:-translate-y-1 transition-all duration-200 text-white"
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <button onClick={() => commentInputRef.current?.focus()} className="flex-1 flex items-center justify-center space-x-2 py-2 text-gray-500 dark:text-gray-400 rounded-lg active:scale-[0.98] transition-all duration-300">
                    <ChatBubbleLeftIcon className="w-5 h-5" /><span>{t('feed.comment')}</span>
                </button>
                <button onClick={() => isGhostMode ? null : onShare(post)} className="flex-1 flex items-center justify-center space-x-2 py-2 text-gray-500 dark:text-gray-400 rounded-lg active:scale-[0.98] transition-all duration-300">
                    <ShareIcon className="w-5 h-5" /><span>{t('feed.share')}</span>
                </button>
            </div>

            {post.comments.length > 0 && (
                <div className="mt-4 space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {post.comments.map(comment => (
                        <div key={comment.id} className="flex space-x-3">
                            <UserAvatar src={comment.authorAvatar} name={comment.authorName} level={comment.authorLevel} size="xs" className="shrink-0" />
                            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-2xl px-4 py-2 flex-1">
                                <h5 className="font-bold text-xs text-brand-text dark:text-gray-100">{comment.authorName}</h5>
                                <p className="text-sm text-brand-text dark:text-gray-200">{comment.text}</p>
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{new Date(comment.timestamp).toLocaleDateString()}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!isGhostMode && (
                <form onSubmit={handleCommentSubmit} className="mt-4 flex space-x-3 items-center">
                    <UserAvatar src={currentUser.avatarUrl} name={currentUser.name} level={currentUser.level} size="xs" className="shrink-0" />
                    <div className="flex-1 relative">
                        <input
                            ref={commentInputRef}
                            type="text"
                            placeholder={t('feed.write_comment')}
                            className="w-full bg-gray-50 dark:bg-slate-700/50 border-none rounded-full px-4 py-2 text-sm focus:ring-1 focus:ring-brand-primary outline-none dark:text-gray-100"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                        />
                        <button type="submit" className="absolute right-2 top-1.5 text-brand-primary p-1 rounded-full transition-colors">
                            <PaperAirplaneIcon className="w-4 h-4" />
                        </button>
                    </div>
                </form>
            )}
        </Card>
    );
};

interface FeedPageProps {
    currentUser: Employee;
    allEmployees?: Employee[];
    events?: Event[];
    recognitions?: Recognition[];
    onAddRecognition?: (rec: Recognition) => void;
    posts?: Post[];
    setPosts?: (posts: Post[]) => void;
    onNavigate: (page: Page, context?: any) => void;
}

// Widget de Clima removido a pedido do usuário

const OnlineUsersWidget: React.FC<{ users: Employee[], onNavigate: (page: Page, context?: any) => void }> = ({ users, onNavigate }) => {
    const onlineUsers = users.filter(u => u.isOnline);
    // Sugerimos pessoas que NÃO estão online no momento para "descobrir"
    const suggestedUsers = users.filter(u => !u.isOnline).slice(0, 10);
    // Fallback: se não houver "offline", mostra qualquer um exceto o atual? 
    // Por enquanto vamos apenas garantir que mostre algo se a lista existir
    const displaySuggestions = suggestedUsers.length > 0 ? suggestedUsers : users.slice(0, 10);

    const { t } = useLanguage();
    return (
        <Card title={t('feed.people')} className="pb-4">
            <div className="space-y-4">
                {onlineUsers.length > 0 && (
                    <div className="space-y-3">
                        <p className="text-[10px] font-bold text-green-500 uppercase tracking-wider">{t('feed.online_now')}</p>
                        {onlineUsers.map(user => (
                            <div key={user.id} onClick={() => onNavigate('profile-page', user.id)} className="flex items-center space-x-3 p-2 -mx-2 rounded-lg transition-colors cursor-pointer">
                                <div className="relative shrink-0">
                                    <UserAvatar src={user.avatarUrl} name={user.name} level={user.level} size="sm" />
                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-slate-800 rounded-full"></span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-brand-text dark:text-gray-100 truncate transition-colors">{user.name}</p>
                                    <p className="text-xs text-brand-subtle-text dark:text-gray-400 truncate">{user.role}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="space-y-3 pt-2">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('feed.suggestions')}</p>
                    {displaySuggestions.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">{t('common.no_results') || 'Nenhum outro usuário encontrado.'}</p>
                    ) : (
                        displaySuggestions.map(user => (
                            <div key={user.id} onClick={() => onNavigate('profile-page', user.id)} className="flex items-center space-x-3 p-2 -mx-2 rounded-lg transition-colors cursor-pointer">
                                <UserAvatar src={user.avatarUrl} name={user.name} level={user.level} size="sm" className="shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-brand-text dark:text-gray-100 truncate transition-colors">{user.name}</p>
                                    <p className="text-xs text-brand-subtle-text dark:text-gray-400 truncate">{user.role}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
            <button className="w-full mt-4 text-xs font-bold text-brand-primary transition-colors uppercase tracking-wider">{t('feed.discover_more')}</button>
        </Card>
    );
};

const FeedPage: React.FC<FeedPageProps> = ({ currentUser, allEmployees = [], events = [], recognitions = [], onAddRecognition, onNavigate }) => {
    const { addNotification } = useNotifications();
    const { isGhostMode } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [localRecognitions, setLocalRecognitions] = useState<Recognition[]>([]);
    const [newPostContent, setNewPostContent] = useState('');
    const [mediaFile, setMediaFile] = useState<{ url: string, type: 'image', file?: File } | null>(null);
    const [showRecognitionModal, setShowRecognitionModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [mentionSearch, setMentionSearch] = useState('');
    const [mentionIndex, setMentionIndex] = useState(-1);
    const [mentions, setMentions] = useState<{ id: string, name: string }[]>([]);
    const { t } = useLanguage();

    // Gamification states
    const [showGalleryModal, setShowGalleryModal] = useState(false);
    const [allCompanyBadges, setAllCompanyBadges] = useState<CompanyBadge[]>([]);
    const [earnedBadges, setEarnedBadges] = useState<UserBadge[]>([]);
    const [equippedBadges, setEquippedBadges] = useState<UserBadge[]>([]);
    const [selectedBadgeForComments, setSelectedBadgeForComments] = useState<UserBadge | null>(null);

    const recentBadgeAwards = posts.filter(post => {
        if (!post.content.startsWith('[BADGE_AWARD]')) return false;
        const createdDate = new Date(post.timestamp).getTime();
        const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
        return createdDate > threeDaysAgo;
    });

    const fetchUserBadgesData = async () => {
        try {
            const { data: profileData } = await supabase.from('profiles').select('company_id').eq('id', currentUser.id).single();
            if (!profileData?.company_id) return;

            const { data: companyBadgesData } = await supabase
                .from('company_badges')
                .select('*')
                .eq('company_id', profileData.company_id)
                .order('created_at', { ascending: false });

            if (companyBadgesData) setAllCompanyBadges(companyBadgesData);

            const { data: userBadgesData } = await supabase
                .from('user_badges')
                .select(`
                    id,
                    company_id,
                    user_id,
                    badge_id,
                    awarded_by,
                    reason,
                    is_equipped,
                    created_at,
                    company_badges (
                        id,
                        name,
                        description,
                        icon,
                        color
                    )
                `)
                .eq('user_id', currentUser.id);

            if (userBadgesData) {
                setEarnedBadges(userBadgesData as any[]);
                setEquippedBadges((userBadgesData as any[]).filter(ub => ub.is_equipped));
            }
        } catch (err) {
            console.error('Erro ao buscar selos:', err);
        }
    };

    const imageInputRef = useRef<HTMLInputElement>(null);
    const postTextareaRef = useRef<HTMLTextAreaElement>(null);

    const fetchPosts = async () => {
        try {
            const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', currentUser.id).single();
            if (!profile?.company_id) return;

            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

            const { data, error } = await supabase
                .from('posts')
                .select(`
                    id, content, created_at, media_url, media_type, mentions, author_id,
                    profiles: author_id(full_name, avatar_url, level),
                    post_reactions(id, emoji, user_id),
                    comments(id, content, created_at, author_id, profiles: author_id(full_name, avatar_url, level))
                `)
                .eq('company_id', profile.company_id)
                .gte('created_at', ninetyDaysAgo.toISOString())
                .order('created_at', { ascending: false });

            if (error) throw error;

            const formattedPosts: Post[] = data.map((item: any) => ({
                id: item.id,
                authorId: item.author_id,
                authorName: item.profiles?.full_name || 'Usuário Excluído',
                authorAvatar: item.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.profiles?.full_name || 'Usuario Excluido')}&background=random`,
                authorLevel: item.profiles?.level || 1,
                content: item.content,
                mediaUrl: item.media_url,
                mediaType: item.media_type as 'image',
                timestamp: item.created_at,
                mentions: item.mentions || [],
                reactions: item.post_reactions.map((r: any) => ({
                    emoji: r.emoji,
                    userId: r.user_id
                })),
                comments: item.comments.map((c: any) => ({
                    id: c.id,
                    authorId: c.author_id,
                    authorName: c.profiles?.full_name || 'Usuário Excluído',
                    authorAvatar: c.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.profiles?.full_name || 'Usuario Excluido')}&background=random`,
                    authorLevel: c.profiles?.level || 1,
                    text: c.content,
                    timestamp: c.created_at
                })).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            }));

            setPosts(formattedPosts);
        } catch (error) {
            console.error('Error fetching posts:', error);
        }
    };

    const fetchRecognitions = async () => {
        try {
            const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', currentUser.id).single();
            if (!profile?.company_id) return;

            const { data, error } = await supabase
                .from('recognitions')
                .select(`
                    id, message, type, from_id, to_id,
                    from_profile:from_id(full_name, avatar_url),
                    to_profile:to_id(full_name, avatar_url)
                `)
                .eq('company_id', profile.company_id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;

            const getAvatarUrl = (avatarUrl: string | null | undefined, fullName: string) => {
                if (!avatarUrl) {
                    return `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`;
                }
                if (avatarUrl.startsWith('http') || avatarUrl.startsWith('blob:')) {
                    return getCleanImageUrl(avatarUrl);
                }
                const { data } = supabase.storage.from('avatars').getPublicUrl(avatarUrl);
                return getCleanImageUrl(data?.publicUrl || avatarUrl);
            };

            const formatted: Recognition[] = data.map((item: any) => {
                const fromName = item.from_profile?.full_name || 'Usuário Excluído';
                const toName = item.to_profile?.full_name || 'Usuário Excluído';
                return {
                    id: item.id,
                    fromId: item.from_id,
                    toId: item.to_id,
                    from: fromName,
                    to: toName,
                    fromAvatar: getAvatarUrl(item.from_profile?.avatar_url, fromName),
                    toAvatar: getAvatarUrl(item.to_profile?.avatar_url, toName),
                    message: item.message,
                    value: item.type as any
                };
            });
            setLocalRecognitions(formatted);
        } catch (err) {
            console.error('Error fetching recognitions:', err);
        }
    };

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchPosts(), fetchRecognitions(), fetchUserBadgesData()]).finally(() => setLoading(false));

        const channel = supabase
            .channel('public:posts_and_recognitions')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => fetchPosts())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => fetchPosts())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'post_reactions' }, () => fetchPosts())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'recognitions' }, () => fetchRecognitions())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'user_badges' }, () => fetchUserBadgesData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'company_badges' }, () => fetchUserBadgesData())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handlePostContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        const cursorPosition = e.target.selectionStart;
        setNewPostContent(value);

        const lastAtChar = value.lastIndexOf('@', cursorPosition - 1);
        if (lastAtChar !== -1) {
            const query = value.slice(lastAtChar + 1, cursorPosition);
            if (!query.includes(' ') && !query.includes('\n')) {
                setMentionSearch(query);
                setMentionIndex(lastAtChar);
                return;
            }
        }
        setMentionSearch('');
    };

    const selectMention = (user: Employee) => {
        const before = newPostContent.slice(0, mentionIndex);
        const after = newPostContent.slice(postTextareaRef.current?.selectionStart || 0);
        setNewPostContent(`${before}@${user.name} ${after}`);
        setMentions(prev => [...prev, { id: user.id, name: user.name }]);
        setMentionSearch('');
        postTextareaRef.current?.focus();
    };

    const compressImage = (file: File): Promise<File> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Redimensionar se for muito grande (max 1200px)
                    const MAX_WIDTH = 1200;
                    const MAX_HEIGHT = 1200;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        if (blob) {
                            const compressedFile = new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now(),
                            });
                            resolve(compressedFile);
                        } else {
                            resolve(file);
                        }
                    }, 'image/jpeg', 0.7); // 70% de qualidade
                };
            };
        });
    };

    const handleRotateImage = () => {
        if (!mediaFile) return;
        const img = new Image();
        img.src = mediaFile.url;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.height;
            canvas.height = img.width;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate((90 * Math.PI) / 180);
                ctx.drawImage(img, -img.width / 2, -img.height / 2);
                canvas.toBlob((blob) => {
                    if (blob) {
                        const rotatedFile = new File([blob], mediaFile.file?.name || 'rotated.jpg', {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        setMediaFile({
                            url: URL.createObjectURL(rotatedFile),
                            type: 'image',
                            file: rotatedFile
                        });
                    }
                }, 'image/jpeg', 0.9);
            }
        };
    };

    const handleCreatePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isGhostMode) {
            alert("Modo Fantasma: Publicações desativadas durante a auditoria.");
            return;
        }
        try {
            if (!newPostContent.trim() && !mediaFile) return;

            let uploadedMediaUrl = null;
            if (mediaFile && mediaFile.file) {
                // Compress image before upload
                const fileToUpload = await compressImage(mediaFile.file);

                const fileExt = fileToUpload.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `${currentUser.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('feed-media')
                    .upload(filePath, fileToUpload);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('feed-media')
                    .getPublicUrl(filePath);

                if (publicUrl) uploadedMediaUrl = publicUrl;
            }

            const finalMentionIds = mentions
                .filter(m => newPostContent.includes(`@${m.name}`))
                .map(m => m.id);

            const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', currentUser.id).single();
            if (!profile?.company_id) throw new Error('Company ID not found');

            const { error } = await supabase.from('posts').insert({
                author_id: currentUser.id,
                company_id: profile.company_id,
                content: newPostContent,
                media_url: uploadedMediaUrl,
                media_type: mediaFile ? mediaFile.type : null,
                mentions: finalMentionIds
            });

            if (error) throw error;

            for (const id of finalMentionIds) {
                if (id !== currentUser.id) {
                    await addNotification({
                        user_id: id,
                        company_id: profile.company_id,
                        type: 'mention',
                        title: 'Você foi mencionado!',
                        description: `${currentUser.name} mencionou você em um post.`,
                        avatarUrl: currentUser.avatarUrl,
                        link: '/'
                    });
                }
            }

            setNewPostContent('');
            setMediaFile(null);
            setMentions([]);
            fetchPosts(); // Refresh immediately for the author
        } catch (error: any) {
            console.error('Error creating post:', error);
            const msg = error.message || 'Erro desconhecido.';
            if (msg.includes('row-level security') || msg.includes('security policy')) {
                alert('Erro de permissão ao publicar. O bucket de mídia "feed-media" pode não estar configurado no banco de dados. Verifique as políticas de Storage no Supabase ou execute o script SQL de correção (MIGRATION_FEED_STORAGE.sql).');
            } else {
                alert('Erro ao publicar post: ' + msg);
            }
        }
    };

    const handleRecognitionSubmit = async (data: Omit<Recognition, 'id' | 'from' | 'fromAvatar'>) => {
        if (isGhostMode) return;
        try {
            const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', currentUser.id).single();

            // If current user has no company_id (Super Admin), try to get from recipient
            let targetCompanyId = profile?.company_id;
            if (!targetCompanyId) {
                const { data: recipientProfile } = await supabase.from('profiles').select('company_id').eq('id', (data as any).toUserId).single();
                targetCompanyId = recipientProfile?.company_id;
            }

            if (!targetCompanyId) {
                throw new Error("Não foi possível determinar a empresa para este reconhecimento.");
            }

            const { error } = await supabase.from('recognitions').insert({
                from_id: currentUser.id,
                to_id: (data as any).toUserId,
                company_id: targetCompanyId,
                message: data.message,
                type: data.value
            });

            if (error) throw error;

            // Enviar notificação para o usuário reconhecido
            await addNotification({
                user_id: (data as any).toUserId,
                company_id: targetCompanyId,
                type: 'mention',
                title: 'Novo Reconhecimento!',
                description: `${currentUser.name} enviou um reconhecimento para você: "${data.value}"`,
                avatarUrl: currentUser.avatarUrl,
                link: '/'
            });

            alert('Reconhecimento enviado com sucesso!');
            fetchRecognitions(); // Refresh list immediately
        } catch (err: any) {
            console.error('Error in recognition:', err);
            alert('Erro ao enviar reconhecimento: ' + (err.message || 'Erro desconhecido'));
        }
    };

    const handleToggleReaction = async (postId: string, emoji: string) => {
        if (isGhostMode) return;
        setPosts(currentPosts => currentPosts.map(p => {
            if (p.id !== postId) return p;
            const existingIdx = p.reactions.findIndex(r => r.userId === currentUser.id);
            let newReactions = [...p.reactions];
            if (existingIdx > -1) {
                if (newReactions[existingIdx].emoji === emoji) newReactions.splice(existingIdx, 1);
                else newReactions[existingIdx] = { ...newReactions[existingIdx], emoji };
            } else {
                newReactions.push({ userId: currentUser.id, emoji });
            }
            return { ...p, reactions: newReactions };
        }));

        try {
            const { data: existing } = await supabase.from('post_reactions').select('*').eq('post_id', postId).eq('user_id', currentUser.id).single();
            if (existing) {
                if (existing.emoji === emoji) await supabase.from('post_reactions').delete().eq('id', existing.id);
                else await supabase.from('post_reactions').update({ emoji }).eq('id', existing.id);
            } else {
                const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', currentUser.id).single();
                await supabase.from('post_reactions').insert({ post_id: postId, user_id: currentUser.id, company_id: profile?.company_id, emoji });
            }
        } catch (err) {
            console.error('Error toggling reaction:', err);
        }
    };

    const handleDeletePost = async (postId: string) => {
        if (isGhostMode) return;
        if (!window.confirm(t('feed.delete_confirm'))) return;

        // Optimistic update
        setPosts(prev => prev.filter(p => p.id !== postId));

        try {
            const { error } = await supabase.from('posts').delete().eq('id', postId);
            if (error) {
                console.error("Error deleting post:", error);
                alert("Erro ao excluir postagem: " + (error.details || error.message || "Permissão negada."));
                fetchPosts(); // Revert
            }
        } catch (err: any) {
            console.error("Error deleting post:", err);
            alert("Erro inesperado ao excluir: " + (err.message || "Erro desconhecido."));
            fetchPosts(); // Revert
        }
    };


    const handleSubmitComment = async (postId: string, text: string) => {
        if (isGhostMode) return;
        try {
            const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', currentUser.id).single();
            const { error } = await supabase.from('comments').insert({ post_id: postId, author_id: currentUser.id, company_id: profile?.company_id, content: text });
            if (!error) fetchPosts(); // Refresh immediately to show the comment
        } catch (err) {
            console.error(err);
        }
    };

    const handleShare = async (post: Post) => {
        const url = `${window.location.protocol}//${window.location.host}/feed?post=${post.id}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Post de ${post.authorName}`,
                    text: post.content.substring(0, 100) + '...',
                    url: url,
                });
            } catch (err) {
                console.error("Error sharing:", err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(url);
                alert(t('feed.link_copied') || 'Link copiado para a área de transferência!');
            } catch (err) {
                console.error("Error copying link:", err);
            }
        }
    };

    const recentRecognitions = [...localRecognitions].sort((a, b) => {
        // IDs are now UUIDs, so simple parsing won't work for sorting implies latest is first
        // But we already sort by created_at desc in fetch
        return 0;
    }).slice(0, 3);

    return (
        <div className="max-w-full mx-auto py-8 px-4 lg:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Card title="" noPadding hideTypeBorder className="text-center pb-6 overflow-hidden">
                        <div className="relative mb-14">
                            {currentUser.coverUrl ? (
                                <img src={currentUser.coverUrl} alt="Capa" className="h-24 w-full object-cover" />
                            ) : (
                                <div className="h-24 bg-brand-primary"></div>
                            )}
                            <div className="absolute left-1/2 -translate-x-1/2 -bottom-10">
                                <UserAvatar src={currentUser.avatarUrl} name={currentUser.name} level={currentUser.level} size="lg" className="border-4 border-white shadow-md rounded-full bg-white" />
                            </div>
                        </div>
                        <div className="px-6 pt-2">
                            <h3 className="text-lg font-bold text-brand-text dark:text-gray-100 mb-1">{currentUser.name}</h3>
                            <p className="text-sm text-brand-subtle-text dark:text-gray-400 mb-4">{currentUser.role} • {currentUser.team}</p>
                            <hr className="mb-4 dark:border-slate-800" />
                            <div className="grid grid-cols-3 gap-2 border-t border-gray-100 dark:border-slate-800 pt-5 mt-2">
                                <div className="flex flex-col items-center">
                                    <span className="font-bold text-brand-text dark:text-gray-100 text-xl">{allEmployees.filter(emp => emp.following?.includes(currentUser.id)).length}</span>
                                    <span className="text-[9px] text-brand-subtle-text dark:text-gray-500 font-semibold uppercase tracking-tight mt-1">{t('feed.followers')}</span>
                                </div>
                                <div className="flex flex-col items-center border-x border-gray-100 dark:border-slate-800">
                                    <span className="font-bold text-brand-text dark:text-gray-100 text-xl">{allEmployees.length}</span>
                                    <span className="text-[9px] text-brand-subtle-text dark:text-gray-500 font-semibold uppercase tracking-tight mt-1">{t('feed.users')}</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="font-bold text-brand-text dark:text-gray-100 text-xl">{posts.filter(p => p.authorId === currentUser.id).reduce((acc, p) => acc + p.reactions.length + p.comments.length, 0)}</span>
                                    <span className="text-[9px] text-brand-subtle-text dark:text-gray-500 font-semibold uppercase tracking-tight mt-1">{t('feed.interactions')}</span>
                                </div>
                            </div>

                            {/* ESPAÇO RETANGULAR VERMELHO DO PRINT: GALERIA DE 3 ÚLTIMOS SELOS */}
                            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-800">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-[10px] font-bold text-brand-subtle-text dark:text-gray-500 uppercase tracking-wider">Selos em Destaque</span>
                                    <button 
                                        onClick={() => setShowGalleryModal(true)}
                                        className="text-[10px] font-bold text-brand-primary hover:underline flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-lg"
                                    >
                                        🏆 Galeria
                                    </button>
                                </div>
                                
                                <div className="flex justify-around items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 min-h-[80px]">
                                    {Array.from({ length: 3 }).map((_, idx) => {
                                        const userBadge = equippedBadges[idx];
                                        if (userBadge && userBadge.company_badges) {
                                            const badge = userBadge.company_badges;
                                            const isUrl = badge.icon.startsWith('http://') || badge.icon.startsWith('https://');
                                            return (
                                                <div 
                                                    key={userBadge.id} 
                                                    onClick={() => setSelectedBadgeForComments(userBadge)}
                                                    className={`w-16 h-16 rounded-2xl ${badge.color} border flex items-center justify-center text-3xl shadow-md select-none transform hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer animate-float overflow-hidden`}
                                                    title={`${badge.name}: ${badge.description || ''}`}
                                                >
                                                    {isUrl ? (
                                                        <img src={badge.icon} className="w-full h-full object-cover rounded-2xl border border-white/10" alt={badge.name} />
                                                    ) : (
                                                        badge.icon
                                                    )}
                                                </div>
                                            );
                                        }
                                        return (
                                            <div 
                                                key={idx} 
                                                className="w-16 h-16 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-800/60 flex items-center justify-center text-lg text-gray-300 dark:text-slate-700 select-none font-bold"
                                                title="Slot de Selo Vazio"
                                            >
                                                +
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </Card>
                    <RecognitionWidget recognitions={localRecognitions} onRecognize={() => setShowRecognitionModal(true)} currentUser={currentUser} onDelete={fetchRecognitions} />
                </div>

                <div className="lg:col-span-8 space-y-6">
                    <Card title="" className="p-0 border-none shadow-sm overflow-visible">
                        {isGhostMode ? (
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 p-6 rounded-2xl flex items-center justify-center space-x-3 shadow-md animate-pulse">
                                <ShieldCheck className="w-8 h-8 text-amber-500" />
                                <div className="text-center">
                                    <h4 className="text-amber-800 dark:text-amber-200 font-bold uppercase tracking-widest text-sm">Modo Auditoria Ativo</h4>
                                    <p className="text-amber-600 dark:text-amber-400 text-xs mt-1">Interação e publicações desativadas para garantir zero rastros.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="premium-card p-4 mb-6">
                                <div className="flex space-x-4 mb-4">
                                    <UserAvatar src={currentUser.avatarUrl} name={currentUser.name} level={currentUser.level} size="md" className="shrink-0" />
                                    <div className="flex-1 relative">
                                        <textarea
                                            ref={postTextareaRef}
                                            placeholder={t('feed.placeholder')}
                                            className="w-full p-4 border border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/50 dark:bg-slate-700/30 text-brand-text dark:text-gray-100 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary/20 outline-none transition-all resize-none min-h-[120px]"
                                            value={newPostContent}
                                            onChange={handlePostContentChange}
                                        ></textarea>
                                        {mentionSearch !== '' && (
                                            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                                {allEmployees
                                                    .filter(emp => emp.name.toLowerCase().includes(mentionSearch.toLowerCase()))
                                                    .map(user => (
                                                        <div key={user.id} onClick={() => selectMention(user)} className="flex items-center space-x-3 p-3 cursor-pointer border-b dark:border-slate-700 last:border-0 transition-colors">
                                                            <UserAvatar src={user.avatarUrl} name={user.name} level={user.level} size="xs" className="shrink-0" />
                                                            <div><p className="text-sm font-bold text-brand-text dark:text-gray-100">{user.name}</p><p className="text-xs text-brand-subtle-text dark:text-gray-400">{user.role}</p></div>
                                                        </div>
                                                    ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
    
                                {mediaFile && (
                                    <div className="relative mb-4 ring-2 ring-brand-primary/20 rounded-xl overflow-hidden shadow-inner bg-gray-50 dark:bg-slate-800 p-2 flex flex-col items-center">
                                        <img src={mediaFile.url} className="max-w-full h-auto object-contain max-h-[350px] rounded-lg" alt="Preview" />
                                        <div className="flex gap-2 mt-2 w-full justify-center">
                                            <button 
                                                type="button" 
                                                onClick={handleRotateImage}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-brand-primary bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 rounded-lg transition-colors border border-emerald-100 dark:border-emerald-500/20"
                                            >
                                                🔄 Girar 90° (Mudar Orientação)
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={() => setMediaFile(null)} 
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 rounded-lg transition-colors border border-red-100"
                                            >
                                                ✕ Remover
                                            </button>
                                        </div>
                                    </div>
                                )}
    
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between pt-4 border-t border-gray-100 dark:border-slate-800 gap-4">
                                    <div className="flex justify-around sm:justify-start space-x-2">
                                        <button onClick={() => imageInputRef.current?.click()} className="flex items-center space-x-2 px-3 py-2 text-gray-500 dark:text-gray-400 rounded-lg transition-all"><PhotoIcon className="w-5 h-5 text-emerald-500" /><span className="text-sm font-medium">{t('feed.photo')}</span></button>
                                        <button onClick={() => setShowRecognitionModal(true)} className="flex items-center space-x-2 px-3 py-2 text-gray-500 dark:text-gray-400 rounded-lg transition-all"><CakeIcon className="w-5 h-5 text-purple-500" /><span className="text-sm font-medium">{t('feed.recognize')}</span></button>
                                    </div>
                                    <button onClick={handleCreatePost} disabled={!newPostContent.trim() && !mediaFile} className="flex items-center justify-center space-x-2 px-6 py-2 sm:py-2.5 bg-brand-primary text-white font-bold rounded-xl disabled:opacity-50 transition-all shadow-md shadow-brand-primary/20 active:scale-95 w-full sm:w-auto"><PaperAirplaneIcon className="w-5 h-5" /><span>{t('feed.post')}</span></button>
                                </div>
                                <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between text-[11px] text-gray-400 font-medium border-t border-gray-50 dark:border-slate-800 pt-3 gap-2">
                                    <div className="flex items-start space-x-2">
                                        <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse mt-1 shrink-0"></div>
                                        <span className="text-orange-600 font-bold leading-tight">{t('feed.important')}</span>
                                    </div>
                                    <span className="italic whitespace-nowrap hidden sm:inline text-right">{t('feed.motto') || 'Acervo organized e eficiente'}</span>
                                </div>
    
                                <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) setMediaFile({ url: URL.createObjectURL(file), type: 'image', file }); }} />
                            </div>
                        )}
                    </Card>

                    {/* Espaço para mural removendo o clima */}

                    {loading ? (
                        <div className="space-y-6">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="bg-white dark:bg-slate-800 rounded-xl h-64 animate-pulse"></div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-6">

                            <div className="space-y-6">
                                {posts.map(post => (
                                    <PostCard
                                        key={post.id}
                                        post={post}
                                        currentUser={currentUser}
                                        onToggleReaction={handleToggleReaction}
                                        onSubmitComment={handleSubmitComment}
                                        onShare={() => { }}
                                        onDelete={handleDeletePost}
                                        isGhostMode={isGhostMode}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <EventsCarouselMini events={events} />
                    <div className="lg:block hidden space-y-6">
                        <OnlineUsersWidget users={allEmployees} onNavigate={onNavigate} />
                    </div>
                </div>
            </div>

            {
                showRecognitionModal && (
                    <RecognitionModal
                        isOpen={showRecognitionModal}
                        onClose={() => setShowRecognitionModal(false)}
                        onSubmit={(data) => { handleRecognitionSubmit(data as any); setShowRecognitionModal(false); }}
                        employees={allEmployees}
                        currentUserId={currentUser.id}
                    />
                )
            }

            {/* MODAL DA GALERIA DE SELOS (DUOLINGO STYLE) */}
            {showGalleryModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-950 rounded-3xl border border-slate-100 dark:border-slate-850 shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 text-slate-800 dark:text-white">
                        <div className="flex justify-between items-center p-6 border-b dark:border-slate-800">
                            <div>
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    🏆 Minha Galeria de Selos
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Equipe até 3 selos conquistados para exibir em seu perfil
                                </p>
                            </div>
                            <button 
                                onClick={() => setShowGalleryModal(false)}
                                className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center font-bold text-slate-500 transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-500/10 p-3.5 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
                                <span className="text-xs text-emerald-800 dark:text-emerald-400 font-bold">
                                    Painel de Destaques
                                </span>
                                <span className="text-xs bg-brand-primary text-white font-bold px-2.5 py-1 rounded-full">
                                    {equippedBadges.length} / 3 Equipados
                                </span>
                            </div>
                            
                            {allCompanyBadges.length === 0 ? (
                                <p className="text-sm text-slate-500 text-center py-6">
                                    Nenhum selo cadastrado pela empresa até o momento.
                                </p>
                            ) : (
                                <div className="grid grid-cols-3 gap-4">
                                    {allCompanyBadges.map(badge => {
                                        const earned = earnedBadges.find(ub => ub.badge_id === badge.id);
                                        const isEquipped = earned?.is_equipped || false;
                                        
                                        return (
                                            <button
                                                key={badge.id}
                                                onClick={async () => {
                                                    if (!earned) return; // Locked badge
                                                    
                                                    const newEquippedState = !isEquipped;
                                                    if (newEquippedState && equippedBadges.length >= 3) {
                                                        alert("Você só pode equipar no máximo 3 selos em destaque!");
                                                        return;
                                                    }
                                                    
                                                    const { error } = await supabase
                                                        .from('user_badges')
                                                        .update({ is_equipped: newEquippedState })
                                                        .eq('id', earned.id);
                                                    
                                                    if (!error) {
                                                        fetchUserBadgesData();
                                                    }
                                                }}
                                                className={`relative flex flex-col items-center p-3.5 rounded-2xl border transition-all duration-300 outline-none ${
                                                    earned 
                                                        ? isEquipped 
                                                            ? 'border-brand-primary bg-emerald-50/10 dark:bg-emerald-500/5 shadow-md scale-105' 
                                                            : 'border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-900 hover:scale-[1.02] hover:border-slate-300 dark:hover:border-slate-700'
                                                        : 'border-slate-50 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/30 opacity-60 cursor-not-allowed'
                                                }`}
                                            >
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-sm mb-3 select-none overflow-hidden ${
                                                    earned 
                                                        ? badge.color 
                                                        : 'bg-slate-200 dark:bg-slate-800 text-slate-455 dark:text-slate-650 grayscale'
                                                }`}>
                                                    {badge.icon.startsWith('http') ? (
                                                        <img src={badge.icon} className={`w-full h-full object-cover rounded-2xl ${earned ? '' : 'grayscale'}`} alt="" />
                                                    ) : (
                                                        badge.icon
                                                    )}
                                                </div>
                                                
                                                <span className="text-[10px] font-bold text-center truncate w-full">
                                                    {badge.name}
                                                </span>
                                                
                                                {earned ? (
                                                    isEquipped ? (
                                                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-brand-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white dark:border-slate-950">
                                                            ✓
                                                        </span>
                                                    ) : (
                                                        <span className="text-[8px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase mt-1 tracking-wider">
                                                            Conquistado
                                                        </span>
                                                    )
                                                ) : (
                                                    <span className="text-[8px] font-extrabold text-slate-400 uppercase mt-1 tracking-wider flex items-center gap-0.5">
                                                        🔒 Bloqueado
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {selectedBadgeForComments && (
                <BadgeDetailModal 
                    userBadge={selectedBadgeForComments}
                    onClose={() => setSelectedBadgeForComments(null)}
                />
            )}
        </div>
    );
};

export default FeedPage;