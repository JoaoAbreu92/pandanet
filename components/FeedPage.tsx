import React, { useState, useEffect, useRef } from 'react';
import Card from './Card';
import EventsCarouselMini from './EventsCarouselMini';
import RecognitionWidget from './RecognitionWidget';
import RecognitionModal from './RecognitionModal';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import { useLanguage } from './LanguageContext';
import { FaceSmileIcon, UserGroupIcon, PaperAirplaneIcon, PlusIcon, ChatBubbleLeftRightIcon, VideoCameraIcon, PhotoIcon, HandThumbUpIcon, ChatBubbleLeftIcon, ShareIcon, HashtagIcon, CakeIcon, XCircleIcon, TrashIcon } from './icons';
import type { Post, Employee, Event, Recognition, PostComment, PostReaction, Page } from '../types';

export const PostCard: React.FC<{
    post: Post;
    currentUser: Employee;
    onToggleReaction: (postId: string, emoji: string) => void;
    onSubmitComment: (postId: string, text: string) => void;
    onShare: (post: Post) => void;
    onDelete: (postId: string) => void;
}> = ({ post, currentUser, onToggleReaction, onSubmitComment, onShare, onDelete }) => {
    const [commentText, setCommentText] = useState('');
    const [showReactionMenu, setShowReactionMenu] = useState(false);
    const timeoutRef = useRef<any>(null);
    const commentInputRef = useRef<HTMLInputElement>(null);
    const { t } = useLanguage();

    const reactions = ['👍', '❤️', '😂', '😮', '😢', '😡', '🤔', '🎉', '🔥', '👀', '🚀', '💯'];

    const handleCommentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (commentText.trim()) {
            onSubmitComment(post.id, commentText);
            setCommentText('');
        }
    };

    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setShowReactionMenu(true);
        }, 1000);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setShowReactionMenu(false);
        }, 1500);
    };

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

    return (
        <Card title="" className="pb-2 overflow-visible">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                    <img src={post.authorAvatar} alt={post.authorName} className="w-10 h-10 rounded-full mr-3 object-cover" />
                    <div>
                        <h4 className="font-bold text-brand-text dark:text-gray-100">{post.authorName}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(post.timestamp).toLocaleString()}</p>
                    </div>
                </div>
                {isAuthor && (
                    <button onClick={() => onDelete(post.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title={t('feed.delete_post')}>
                        <TrashIcon className="w-5 h-5" />
                    </button>
                )}
            </div>

            <div className="text-brand-text dark:text-gray-200 whitespace-pre-wrap mb-4">
                {renderContent(post.content)}
            </div>

            {post.mediaUrl && (
                <div className="mb-4 rounded-lg overflow-hidden bg-gray-100 border border-gray-100 dark:bg-slate-700 dark:border-slate-600 text-center">
                    <img src={post.mediaUrl} alt="Post content" className="w-full h-auto object-cover max-h-[500px]" />
                </div>
            )}

            {!post.mediaUrl && getEmbedUrl(post.content) && (
                <div className={`mb-4 rounded-lg overflow-hidden bg-black shadow-inner ${getEmbedUrl(post.content)?.type === 'youtube' || getEmbedUrl(post.content)?.type === 'vimeo' ? 'aspect-video' : 'aspect-[9/16] max-h-[600px] w-full max-w-[400px] mx-auto'}`}>
                    <iframe
                        width="100%"
                        height="100%"
                        src={getEmbedUrl(post.content)?.url}
                        title="Video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                    ></iframe>
                </div>
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
                <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className="flex-1">
                    <button className={`w-full flex items-center justify-center space-x-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${post.reactions.some(r => r.userId === currentUser.id) ? 'text-brand-primary font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                        <HandThumbUpIcon className="w-5 h-5" /><span>{t('feed.react')}</span>
                    </button>
                    {showReactionMenu && (
                        <div className="absolute bottom-full mb-2 left-0 bg-white dark:bg-slate-800 shadow-xl border dark:border-slate-700 rounded-full p-2 flex space-x-2 animate-fade-in-up z-20">
                            {reactions.map(emoji => (
                                <button key={emoji} onClick={() => { onToggleReaction(post.id, emoji); setShowReactionMenu(false); }} className="text-2xl hover:scale-125 transition-transform p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full">
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <button onClick={() => commentInputRef.current?.focus()} className="flex-1 flex items-center justify-center space-x-2 py-2 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <ChatBubbleLeftIcon className="w-5 h-5" /><span>{t('feed.comment')}</span>
                </button>
                <button onClick={() => onShare(post)} className="flex-1 flex items-center justify-center space-x-2 py-2 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <ShareIcon className="w-5 h-5" /><span>{t('feed.share')}</span>
                </button>
            </div>

            {post.comments.length > 0 && (
                <div className="mt-4 space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {post.comments.map(comment => (
                        <div key={comment.id} className="flex space-x-3">
                            <img src={comment.authorAvatar} alt={comment.authorName} className="w-8 h-8 rounded-full object-cover shrink-0" />
                            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-2xl px-4 py-2 flex-1">
                                <h5 className="font-bold text-xs text-brand-text dark:text-gray-100">{comment.authorName}</h5>
                                <p className="text-sm text-brand-text dark:text-gray-200">{comment.text}</p>
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{new Date(comment.timestamp).toLocaleDateString()}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <form onSubmit={handleCommentSubmit} className="mt-4 flex space-x-3 items-center">
                <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                <div className="flex-1 relative">
                    <input
                        ref={commentInputRef}
                        type="text"
                        placeholder={t('feed.write_comment')}
                        className="w-full bg-gray-50 dark:bg-slate-700/50 border-none rounded-full px-4 py-2 text-sm focus:ring-1 focus:ring-brand-primary outline-none dark:text-gray-100"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                    />
                    <button type="submit" className="absolute right-2 top-1.5 text-brand-primary p-1 rounded-full hover:bg-emerald-50 transition-colors">
                        <PaperAirplaneIcon className="w-4 h-4" />
                    </button>
                </div>
            </form>
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
                            <div key={user.id} onClick={() => onNavigate('profile-page', user.id)} className="flex items-center space-x-3 group hover:bg-gray-50 dark:hover:bg-slate-700/50 p-2 -mx-2 rounded-lg transition-colors cursor-pointer">
                                <div className="relative">
                                    <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-full object-cover border border-gray-100 dark:border-slate-700" />
                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-slate-800 rounded-full"></span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-brand-text dark:text-gray-100 truncate group-hover:text-brand-primary transition-colors">{user.name}</p>
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
                            <div key={user.id} onClick={() => onNavigate('profile-page', user.id)} className="flex items-center space-x-3 group hover:bg-gray-50 dark:hover:bg-slate-700/50 p-2 -mx-2 rounded-lg transition-colors cursor-pointer">
                                <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-full object-cover border border-gray-100 dark:border-slate-700" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-brand-text dark:text-gray-100 truncate group-hover:text-brand-primary transition-colors">{user.name}</p>
                                    <p className="text-xs text-brand-subtle-text dark:text-gray-400 truncate">{user.role}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
            <button className="w-full mt-4 text-xs font-bold text-brand-primary hover:text-emerald-700 transition-colors uppercase tracking-wider">{t('feed.discover_more')}</button>
        </Card>
    );
};

const FeedPage: React.FC<FeedPageProps> = ({ currentUser, allEmployees = [], events = [], recognitions = [], onAddRecognition, onNavigate }) => {
    const { addNotification } = useNotifications();
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
                    profiles: author_id(full_name, avatar_url),
                    post_reactions(id, emoji, user_id),
                    comments(id, content, created_at, author_id, profiles: author_id(full_name, avatar_url))
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
            const { data, error } = await supabase
                .from('recognitions')
                .select(`
                    id, message, type, from_id, to_id,
                    from_profile:from_id(full_name, avatar_url),
                    to_profile:to_id(full_name, avatar_url)
                `)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;

            const formatted: Recognition[] = data.map((item: any) => ({
                id: item.id,
                fromId: item.from_id,
                toId: item.to_id,
                from: item.from_profile?.full_name || 'Usuário Excluído',
                to: item.to_profile?.full_name || 'Usuário Excluído',
                fromAvatar: item.from_profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.from_profile?.full_name || 'Usuario Excluido')}&background=random`,
                toAvatar: item.to_profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.to_profile?.full_name || 'Usuario Excluido')}&background=random`,
                message: item.message,
                value: item.type as any
            }));
            setLocalRecognitions(formatted);
        } catch (err) {
            console.error('Error fetching recognitions:', err);
        }
    };

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchPosts(), fetchRecognitions()]).finally(() => setLoading(false));

        const channel = supabase
            .channel('public:posts_and_recognitions')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => fetchPosts())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => fetchPosts())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'post_reactions' }, () => fetchPosts())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'recognitions' }, () => fetchRecognitions())
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

    const handleCreatePost = async (e: React.FormEvent) => {
        e.preventDefault();
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
            alert('Erro ao publicar post: ' + (error.message || 'Erro desconhecido.'));
        }
    };

    const handleRecognitionSubmit = async (data: Omit<Recognition, 'id' | 'from' | 'fromAvatar'>) => {
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
        try {
            const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', currentUser.id).single();
            const { error } = await supabase.from('comments').insert({ post_id: postId, author_id: currentUser.id, company_id: profile?.company_id, content: text });
            if (!error) fetchPosts(); // Refresh immediately to show the comment
        } catch (err) {
            console.error(err);
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
                                <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-20 h-20 rounded-full border-4 border-white shadow-md object-cover" />
                            </div>
                        </div>
                        <div className="px-6 pt-2">
                            <h3 className="text-lg font-bold text-brand-text dark:text-gray-100 mb-1">{currentUser.name}</h3>
                            <p className="text-sm text-brand-subtle-text dark:text-gray-400 mb-4">{currentUser.role} • {currentUser.team}</p>
                            <hr className="mb-4 dark:border-slate-800" />
                            <div className="grid grid-cols-3 gap-2 border-t border-gray-100 dark:border-slate-800 pt-5 mt-2">
                                <div className="flex flex-col items-center">
                                    <span className="font-bold text-brand-text dark:text-gray-100 text-xl">{(currentUser.following || []).length}</span>
                                    <span className="text-[9px] text-brand-subtle-text dark:text-gray-500 font-semibold uppercase tracking-tight mt-1">{t('feed.followers')}</span>
                                </div>
                                <div className="flex flex-col items-center border-x border-gray-100 dark:border-slate-800">
                                    <span className="font-bold text-brand-text dark:text-gray-100 text-xl">{allEmployees.length}</span>
                                    <span className="text-[9px] text-brand-subtle-text dark:text-gray-500 font-semibold uppercase tracking-tight mt-1">{t('feed.users')}</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="font-bold text-brand-text dark:text-gray-100 text-xl">{allEmployees.length > 0 ? allEmployees.length - 1 : 0}</span>
                                    <span className="text-[9px] text-brand-subtle-text dark:text-gray-500 font-semibold uppercase tracking-tight mt-1">{t('feed.interactions')}</span>
                                </div>
                            </div>
                        </div>
                    </Card>
                    <RecognitionWidget recognitions={localRecognitions} onRecognize={() => setShowRecognitionModal(true)} currentUser={currentUser} onDelete={fetchRecognitions} />
                </div>

                <div className="lg:col-span-8 space-y-6">
                    <Card title="" className="p-0 border-none shadow-sm overflow-visible">
                        <div className="premium-card p-4 mb-6">
                            <div className="flex space-x-4 mb-4">
                                <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-12 h-12 rounded-full object-cover" />
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
                                                    <div key={user.id} onClick={() => selectMention(user)} className="flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer border-b dark:border-slate-700 last:border-0 transition-colors">
                                                        <img src={user.avatarUrl || 'https://via.placeholder.com/32'} className="w-8 h-8 rounded-full object-cover" alt="" />
                                                        <div><p className="text-sm font-bold text-brand-text dark:text-gray-100">{user.name}</p><p className="text-xs text-brand-subtle-text dark:text-gray-400">{user.role}</p></div>
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {mediaFile && (
                                <div className="relative mb-4 group ring-2 ring-brand-primary/20 rounded-xl overflow-hidden shadow-inner bg-gray-50 dark:bg-slate-800">
                                    <img src={mediaFile.url} className="w-full h-48 object-cover rounded-xl" alt="" />
                                    <button onClick={() => setMediaFile(null)} className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 transition-all shadow-lg scale-90 group-hover:scale-100 opacity-0 group-hover:opacity-100"><XCircleIcon className="w-5 h-5" /></button>
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between pt-4 border-t border-gray-100 dark:border-slate-800 gap-4">
                                <div className="flex justify-around sm:justify-start space-x-2">
                                    <button onClick={() => imageInputRef.current?.click()} className="flex items-center space-x-2 px-3 py-2 text-gray-500 dark:text-gray-400 hover:bg-brand-primary/5 hover:text-brand-primary rounded-lg transition-all"><PhotoIcon className="w-5 h-5 text-emerald-500" /><span className="text-sm font-medium">{t('feed.photo')}</span></button>
                                    <button onClick={() => setShowRecognitionModal(true)} className="flex items-center space-x-2 px-3 py-2 text-gray-500 dark:text-gray-400 hover:bg-brand-primary/5 hover:text-brand-primary rounded-lg transition-all"><CakeIcon className="w-5 h-5 text-purple-500" /><span className="text-sm font-medium">{t('feed.recognize')}</span></button>
                                </div>
                                <button onClick={handleCreatePost} disabled={!newPostContent.trim() && !mediaFile} className="flex items-center justify-center space-x-2 px-6 py-2 sm:py-2.5 bg-brand-primary text-white font-bold rounded-xl hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-brand-primary transition-all shadow-md shadow-brand-primary/20 active:scale-95 w-full sm:w-auto"><PaperAirplaneIcon className="w-5 h-5" /><span>{t('feed.post')}</span></button>
                            </div>
                            <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between text-[11px] text-gray-400 font-medium border-t border-gray-50 dark:border-slate-800 pt-3 gap-2">
                                <div className="flex items-start space-x-2">
                                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse mt-1 shrink-0"></div>
                                    <span className="text-orange-600 font-bold leading-tight">{t('feed.important')}</span>
                                </div>
                                <span className="italic whitespace-nowrap hidden sm:inline text-right">{t('feed.motto') || 'Acervo organizado e eficiente'}</span>
                            </div>

                            <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) setMediaFile({ url: URL.createObjectURL(file), type: 'image', file }); }} />
                        </div>
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
        </div>
    );
};

export default FeedPage;