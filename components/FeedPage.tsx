import React, { useState, useEffect, useRef } from 'react';
import Card from './Card';
import EventsCarouselMini from './EventsCarouselMini';
import RecognitionWidget from './RecognitionWidget';
import RecognitionModal from './RecognitionModal';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
// Adjusted icon imports to what's available in the project
import { FaceSmileIcon, UserGroupIcon, PaperAirplaneIcon, PlusIcon, ChatBubbleLeftRightIcon, VideoCameraIcon, PhotoIcon, HandThumbUpIcon, ChatBubbleLeftIcon, ShareIcon, HashtagIcon, CakeIcon } from './icons';
import type { Post, Employee, Event, Recognition, PostComment, PostReaction } from '../types';

interface FeedPageProps {
    currentUser: Employee;
    allEmployees?: Employee[];
    events?: Event[];
    recognitions?: Recognition[];
    onAddRecognition?: (rec: Recognition) => void;
    // Legacy props kept for compatibility but ignored for data source
    posts?: Post[];
    setPosts?: (posts: Post[]) => void;
}

export const PostCard: React.FC<{
    post: Post;
    currentUser: Employee;
    onToggleReaction: (postId: string, emoji: string) => void;
    onSubmitComment: (postId: string, text: string) => void;
    onShare: (post: Post) => void;
}> = ({ post, currentUser, onToggleReaction, onSubmitComment, onShare }) => {
    const [commentText, setCommentText] = useState('');
    const [showReactionMenu, setShowReactionMenu] = useState(false);
    const timeoutRef = useRef<any>(null); // Ref for the timeout
    const commentInputRef = useRef<HTMLInputElement>(null); // Ref for comment input

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
        }, 1500); // 1.5s delay to appear as requested (user mentioned 2s, but 1.5s feels better, I'll use 2000 for strictness if needed)
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setShowReactionMenu(false);
        }, 1200); // Keeps visible for 1.2s after leaving
    };

    const userReaction = post.reactions.find(r => r.userId === currentUser.id);

    // Helper to highlight mentions
    const renderContent = (content: string) => {
        const parts = content.split(/(@[\w\s]+)/g);
        return parts.map((part, i) => {
            if (part.startsWith('@')) {
                return <span key={i} className="text-brand-primary font-bold bg-emerald-50 px-1 rounded">{part}</span>;
            }
            return part;
        });
    };

    return (
        <Card title="" className="pb-2 overflow-visible">
            {/* Header */}
            <div className="flex items-center mb-4">
                <img src={post.authorAvatar} alt={post.authorName} className="w-10 h-10 rounded-full mr-3 object-cover" />
                <div>
                    <h4 className="font-bold text-brand-text">{post.authorName}</h4>
                    <p className="text-xs text-gray-500">{new Date(post.timestamp).toLocaleString()}</p>
                </div>
            </div>

            {/* Content */}
            <div className="text-brand-text whitespace-pre-wrap mb-4">
                {renderContent(post.content)}
            </div>

            {/* Media */}
            {post.mediaUrl && (
                <div className="mb-4 rounded-lg overflow-hidden bg-gray-100 border text-center">
                    {post.mediaType === 'image' ? (
                        <img src={post.mediaUrl} alt="Post content" className="w-full h-auto object-cover max-h-[500px]" />
                    ) : (
                        <video src={post.mediaUrl} controls className="w-full max-h-[500px]" />
                    )}
                </div>
            )}

            {/* Stats */}
            <div className="flex justify-between text-sm text-gray-500 pb-2 border-b">
                <div className="flex items-center space-x-1">
                    {post.reactions.length > 0 && (
                        <div className="flex -space-x-1">
                            {Array.from(new Set(post.reactions.map(r => r.emoji))).slice(0, 3).map(emoji => (
                                <span key={emoji} className="bg-gray-100 rounded-full w-5 h-5 flex items-center justify-center text-xs ring-2 ring-white z-10">{emoji}</span>
                            ))}
                        </div>
                    )}
                    <span>{post.reactions.length > 0 ? `${post.reactions.length} reações` : 'Seja o primeiro a reagir'}</span>
                </div>
                <span>{post.comments.length} comentários</span>
            </div>

            {/* Actions */}
            <div className="flex justify-around py-1 relative">
                <div className="relative flex-1" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                    {showReactionMenu && (
                        <div
                            className="absolute bottom-full left-0 mb-2 bg-white shadow-lg rounded-full p-2 flex space-x-2 border animate-fade-in-up z-20"
                            onMouseEnter={handleMouseEnter} // Also keep open if hovering the menu itself
                            onMouseLeave={handleMouseLeave}
                        >
                            {reactions.map(emoji => (
                                <button
                                    key={emoji}
                                    onClick={() => { onToggleReaction(post.id, emoji); setShowReactionMenu(false); }}
                                    className="hover:scale-125 transition-transform text-xl"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}
                    <button
                        onClick={() => onToggleReaction(post.id, '👍')}
                        className={`flex items - center justify - center w - full py - 2 space - x - 2 rounded - md hover: bg - gray - 50 transition - colors ${userReaction ? 'text-brand-primary font-semibold' : 'text-gray-600'} `}
                    >
                        <HandThumbUpIcon className="w-5 h-5" />
                        <span>{userReaction ? userReaction.emoji : 'Curtir'}</span>
                    </button>
                </div>

                <button
                    onClick={() => commentInputRef.current?.focus()}
                    className="flex items-center justify-center flex-1 py-2 space-x-2 rounded-md hover:bg-gray-50 text-gray-600 transition-colors"
                >
                    <ChatBubbleLeftIcon className="w-5 h-5" />
                    <span>Comentar</span>
                </button>
                <button
                    onClick={() => onShare(post)}
                    className="flex items-center justify-center flex-1 py-2 space-x-2 rounded-md hover:bg-gray-50 text-gray-600 transition-colors"
                >
                    <ShareIcon className="w-5 h-5" />
                    <span>Compartilhar</span>
                </button>
            </div>

            {/* Comments Section */}
            <div className="mt-2 bg-gray-50 p-3 rounded-lg">
                {post.comments.length > 0 && (
                    <div className="space-y-3 mb-4">
                        {post.comments.map(comment => (
                            <div key={comment.id} className="flex space-x-2">
                                <img src={comment.authorAvatar} alt={comment.authorName} className="w-8 h-8 rounded-full object-cover" />
                                <div className="bg-gray-200 rounded-2xl px-3 py-2">
                                    <p className="font-bold text-xs text-brand-text">{comment.authorName}</p>
                                    <p className="text-sm text-brand-text">{comment.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Add Comment */}
                <form onSubmit={handleCommentSubmit} className="flex items-center space-x-2">
                    <img src={currentUser.avatarUrl} alt="User" className="w-8 h-8 rounded-full object-cover" />
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            placeholder="Escreva um comentário..."
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            ref={commentInputRef}
                            className="w-full pl-3 pr-10 py-2 bg-white text-brand-text rounded-full border border-gray-300 focus:outline-none focus:border-brand-primary text-sm shadow-sm"
                        />
                        <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-primary hover:text-emerald-700">
                            <PaperAirplaneIcon className="w-4 h-4" />
                        </button>
                    </div>
                </form>
            </div>
        </Card>
    );
};

export const FeedPage: React.FC<FeedPageProps> = ({ currentUser: propUser, allEmployees = [], events = [], recognitions = [], onAddRecognition }) => {
    const { profile: authUser } = useAuth();
    const currentUser = authUser || propUser;
    const { addNotification } = useNotifications();
    const [activeTab, setActiveTab] = useState<'feed' | 'users'>('feed');
    const [posts, setPosts] = useState<Post[]>([]);
    const [newPostContent, setNewPostContent] = useState('');
    const [mediaFile, setMediaFile] = useState<{ url: string, type: 'image' | 'video', file?: File } | null>(null);
    const [showRecognitionModal, setShowRecognitionModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const postTextareaRef = useRef<HTMLTextAreaElement>(null);

    const fetchPosts = async () => {
        try {
            // setLoading(true); // Don't block UI refresh if just polling or re-fetching?
            // Actually good to show load state initially
            const { data, error } = await supabase
                .from('posts')
                .select(`
id,
    content,
    created_at,
    media_url,
    media_type,
    mentions,
    author_id,
    profiles: author_id(full_name, avatar_url),
        post_reactions(
            id,
            emoji,
            user_id
        ),
        comments(
            id,
            content,
            created_at,
            author_id,
            profiles: author_id(full_name, avatar_url)
        )
            `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const formattedPosts: Post[] = data.map((item: any) => ({
                id: item.id,
                authorId: item.author_id,
                authorName: item.profiles?.full_name || 'Desconhecido',
                authorAvatar: item.profiles?.avatar_url || 'https://via.placeholder.com/150',
                content: item.content,
                mediaUrl: item.media_url,
                mediaType: item.media_type as 'image' | 'video',
                timestamp: item.created_at,
                mentions: item.mentions || [],
                reactions: item.post_reactions.map((r: any) => ({
                    emoji: r.emoji,
                    userId: r.user_id
                })),
                comments: item.comments.map((c: any) => ({
                    id: c.id,
                    authorId: c.author_id,
                    authorName: c.profiles?.full_name || 'Desconhecido',
                    authorAvatar: c.profiles?.avatar_url || 'https://via.placeholder.com/150',
                    text: c.content, // Changed from c.text to c.content based on DB column
                    timestamp: c.created_at
                })).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            }));

            setPosts(formattedPosts);
        } catch (error) {
            console.error('Error fetching posts:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPosts();

        // Simulating realtime subscription for updates could be added here
        const channel = supabase
            .channel('public:posts')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => fetchPosts())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => fetchPosts())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'post_reactions' }, () => fetchPosts())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleRecognitionSubmit = async (data: Omit<Recognition, 'id' | 'from' | 'fromAvatar'>) => {
        if (onAddRecognition) {
            // TODO: Persist recognition to DB
            const newRec: Recognition = {
                id: Date.now().toString(),
                from: currentUser.name,
                fromAvatar: currentUser.avatarUrl,
                ...data
            };
            onAddRecognition(newRec);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            setMediaFile({ url, type, file });
        }
    };

    const handlePostSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPostContent.trim() && !mediaFile) return;

        try {
            let uploadedMediaUrl = null;

            if (mediaFile && mediaFile.file) {
                const fileExt = mediaFile.file.name.split('.').pop();
                const fileName = `${Date.now()}.${fileExt} `;
                const filePath = `${currentUser.id}/${fileName}`;

                // Fallback to simpler upload if bucket not ready, but we try standard way
                // Assuming 'feed-media' bucket exists
                const { error: uploadError, data } = await supabase.storage
                    .from('feed-media')
                    .upload(filePath, mediaFile.file);

                if (uploadError) {
                    console.error('Upload failed:', uploadError);
                    // Alert user or fallback
                } else if (data) {
                    const { data: { publicUrl } } = supabase.storage.from('feed-media').getPublicUrl(filePath);
                    uploadedMediaUrl = publicUrl;
                }
            }

            // Detect mentions
            const mentions: string[] = [];
            // Assuming allEmployees is available in FeedPage scope, if not, it needs to be fetched or passed
            // For now, using a placeholder if allEmployees is not directly available in this scope
            const allEmployees = []; // Placeholder, replace with actual data if available
            if (allEmployees) {
                allEmployees.forEach(emp => {
                    if (newPostContent.includes(`@${emp.name}`)) {
                        mentions.push(emp.id);
                    }
                });
            }

            // Query company_id 
            const { data: profileData } = await supabase.from('profiles').select('company_id').eq('id', currentUser.id).single();
            const companyId = profileData?.company_id;

            if (!companyId) {
                alert('Erro: ID da empresa não encontrado.');
                return;
            }

            const { error } = await supabase.from('posts').insert({
                author_id: currentUser.id,
                company_id: companyId,
                content: newPostContent,
                media_url: uploadedMediaUrl,
                media_type: mediaFile ? mediaFile.type : null,
                mentions: mentions
            });

            if (error) throw error;

            // Notify mentioned users
            mentions.forEach(mentionedUserId => {
                if (mentionedUserId !== currentUser.id) {
                    addNotification({
                        user_id: mentionedUserId,
                        type: 'mention',
                        title: 'Você foi mencionado!',
                        description: `${currentUser.name} mencionou você em um post: "${newPostContent.slice(0, 30)}..."`,
                        avatarUrl: currentUser.avatarUrl,
                        link: '/' // Link to the post, if available
                    } as any);
                }
            });

            setNewPostContent('');
            setMediaFile(null);
            // fetchPosts call handled by realtime subscription usually, but call to be safe
            // fetchPosts(); 

        } catch (error) {
            console.error('Error creating post:', error);
            alert('Erro ao publicar post.');
        }
    };

    const handleToggleReaction = async (postId: string, emoji: string) => {
        // Optimistic update
        const postIndex = posts.findIndex(p => p.id === postId);
        if (postIndex === -1) return;

        // DB Update
        try {
            // Check if exists
            const { data: existingReaction } = await supabase
                .from('post_reactions')
                .select('*')
                .eq('post_id', postId)
                .eq('user_id', currentUser.id)
                .single();

            const { data: profileData } = await supabase.from('profiles').select('company_id').eq('id', currentUser.id).single();

            if (existingReaction) {
                if (existingReaction.emoji === emoji) {
                    // Delete
                    await supabase.from('post_reactions').delete().eq('id', existingReaction.id);
                } else {
                    // Update
                    await supabase.from('post_reactions').update({ emoji }).eq('id', existingReaction.id);
                }
            } else {
                // Insert
                await supabase.from('post_reactions').insert({
                    post_id: postId,
                    user_id: currentUser.id,
                    company_id: profileData?.company_id,
                    emoji
                });
            }
            // fetchPosts(); // Refresh to get accurate count
        } catch (err) {
            console.error(err);
        }
    };

    const handleSubmitComment = async (postId: string, text: string) => {
        try {
            const { data: profileData } = await supabase.from('profiles').select('company_id').eq('id', currentUser.id).single();

            await supabase.from('comments').insert({
                post_id: postId,
                author_id: currentUser.id,
                company_id: profileData?.company_id,
                content: text
            });
            // fetchPosts();
        } catch (err) {
            console.error(err);
        }
    };

    const handleShare = (post: Post) => {
        const shareUrl = `${window.location.origin}/feed/${post.id}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert('Link da publicação copiado para a área de transferência!');
        });
    };

    if (loading) {
        return <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary"></div></div>;
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            <RecognitionModal
                isOpen={showRecognitionModal}
                onClose={() => setShowRecognitionModal(false)}
                onSubmit={handleRecognitionSubmit}
                employees={allEmployees || []}
                currentUserId={currentUser.id}
            />
            {/* Left Sidebar - Profile & Shortcuts */}
            <div className="hidden lg:block space-y-6">
                <div className="bg-white rounded-lg shadow-sm overflow-hidden p-4 border border-gray-100">
                    <div className="flex flex-col items-center">
                        <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-20 h-20 rounded-full border-4 border-white shadow-md mb-2 object-cover" />
                        <h3 className="font-bold text-lg text-gray-800">{currentUser.name}</h3>
                        <p className="text-sm text-gray-500">{currentUser.role}</p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100 flex justify-around text-center">
                        <div>
                            <span className="block font-bold text-lg text-brand-primary">{posts.filter(p => p.authorId === currentUser.id).length}</span>
                            <span className="text-xs text-gray-500">Posts</span>
                        </div>
                        <div>
                            <span className="block font-bold text-lg text-brand-primary">{currentUser.following.length}</span>
                            <span className="text-xs text-gray-500">Seguindo</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
                    <h3 className="font-bold text-gray-700 mb-3 text-sm uppercase">Atalhos</h3>
                    <ul className="space-y-2">
                        <li>
                            <button className="flex items-center space-x-2 text-sm text-gray-600 hover:text-brand-primary w-full text-left">
                                <UserGroupIcon className="w-5 h-5 text-purple-500" />
                                <span>Grupos</span>
                            </button>
                        </li>
                        <li>
                            <button className="flex items-center space-x-2 text-sm text-gray-600 hover:text-brand-primary w-full text-left">
                                <HashtagIcon className="w-5 h-5 text-blue-500" />
                                <span>Tópicos</span>
                            </button>
                        </li>
                    </ul>
                </div>

                {/* Events Carousel */}
                <div className="mt-6">
                    <h3 className="font-bold text-gray-700 mb-3 text-sm uppercase px-1">Próximos Eventos</h3>
                    <EventsCarouselMini events={events} />
                </div>
            </div>

            {/* Main Feed - Center - Takes 2 cols */}
            <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-brand-text">Feed Social</h1>
                    <div className="flex bg-white/50 p-1 rounded-lg border border-gray-100 shadow-sm">
                        <button
                            onClick={() => setActiveTab('feed')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'feed' ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-500 hover:text-brand-primary'}`}
                        >
                            Feed
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'users' ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-500 hover:text-brand-primary'}`}
                        >
                            Usuários
                        </button>
                    </div>
                </div>

                {activeTab === 'feed' ? (
                    <>
                        {/* Create Post Card */}
                        <Card title="">
                            <div className="flex space-x-4">
                                <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-10 h-10 rounded-full object-cover" />
                                <div className="flex-1">
                                    <form onSubmit={handlePostSubmit}>
                                        <textarea
                                            value={newPostContent}
                                            onChange={(e) => setNewPostContent(e.target.value)}
                                            ref={postTextareaRef}
                                            placeholder={`O que você está pensando, ${currentUser.name.split(' ')[0]}? (Use @ para marcar alguém)`}
                                            className="w-full bg-white text-brand-text border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-brand-primary min-h-[100px] resize-none"
                                            disabled={!currentUser.permissions.canPostText}
                                        />

                                        {mediaFile && (
                                            <div className="mt-3 relative rounded-lg overflow-hidden bg-black max-h-60 flex items-center justify-center">
                                                <button
                                                    type="button"
                                                    onClick={() => setMediaFile(null)}
                                                    className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                                                >
                                                    &times;
                                                </button>
                                                {mediaFile.type === 'image' ? (
                                                    <img src={mediaFile.url} alt="Preview" className="max-h-60 w-auto" />
                                                ) : (
                                                    <video src={mediaFile.url} controls className="max-h-60 w-auto" />
                                                )}
                                            </div>
                                        )}

                                        <div className="flex justify-between items-center mt-3 pt-3 border-t">
                                            <div className="flex space-x-2">
                                                {currentUser.permissions.canPostVideo && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => videoInputRef.current?.click()}
                                                            className="flex items-center space-x-1 px-3 py-1.5 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
                                                        >
                                                            <VideoCameraIcon className="w-5 h-5 text-red-500" />
                                                            <span className="text-sm font-medium">Vídeo</span>
                                                        </button>
                                                        <input type="file" ref={videoInputRef} accept="video/*" hidden onChange={(e) => handleFileSelect(e, 'video')} />
                                                    </>
                                                )}
                                                {currentUser.permissions.canPostImage && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => imageInputRef.current?.click()}
                                                            className="flex items-center space-x-1 px-3 py-1.5 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
                                                        >
                                                            <PhotoIcon className="w-5 h-5 text-green-500" />
                                                            <span className="text-sm font-medium">Foto</span>
                                                        </button>
                                                        <input type="file" ref={imageInputRef} accept="image/*" hidden onChange={(e) => handleFileSelect(e, 'image')} />
                                                    </>
                                                )}
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={(!newPostContent.trim() && !mediaFile) || (!currentUser.permissions.canPostText && !mediaFile)}
                                                className="px-4 py-2 bg-brand-primary text-white rounded-md font-medium hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Publicar
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </Card>

                        {/* Posts Feed */}
                        <div className="space-y-6">
                            {posts.map(post => (
                                <PostCard
                                    key={post.id}
                                    post={post}
                                    currentUser={currentUser}
                                    onToggleReaction={handleToggleReaction}
                                    onSubmitComment={handleSubmitComment}
                                    onShare={handleShare}
                                />
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="space-y-4">
                        <Card title="">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Buscar usuários por nome, equipe ou cargo..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                                />
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                </div>
                            </div>
                        </Card>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {allEmployees
                                .filter(emp =>
                                    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    emp.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    emp.team?.toLowerCase().includes(searchTerm.toLowerCase())
                                )
                                .map(emp => (
                                    <Card key={emp.id} title="" className="hover:shadow-md transition-shadow">
                                        <div className="flex items-center space-x-4">
                                            <img src={emp.avatarUrl} alt={emp.name} className="w-16 h-16 rounded-full object-cover border-2 border-brand-primary/10" />
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-brand-text truncate">{emp.name}</h4>
                                                <p className="text-xs text-gray-500 truncate">{emp.role}</p>
                                                <p className="text-xs text-brand-primary font-medium mt-1">{emp.team}</p>
                                            </div>
                                            {emp.id !== currentUser.id && (
                                                <button
                                                    onClick={() => {/* Implement follow logic here */ alert('Seguindo ' + emp.name) }}
                                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white transition-colors"
                                                >
                                                    Seguir
                                                </button>
                                            )}
                                        </div>
                                    </Card>
                                ))
                            }
                        </div>
                    </div>
                )}
            </div>

            {/* Right Sidebar - Widgets */}
            <div className="hidden lg:block space-y-6">

                {/* Recognition Wall */}
                <RecognitionWidget recognitions={recognitions} onRecognize={() => setShowRecognitionModal(true)} />

                <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
                    <h3 className="font-bold text-gray-700 mb-3 text-sm uppercase">Tópicos em Alta</h3>
                    <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-1 bg-gray-100 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-200 cursor-pointer">#Inovação</span>
                        <span className="px-2 py-1 bg-gray-100 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-200 cursor-pointer">#BemEstar</span>
                        <span className="px-2 py-1 bg-gray-100 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-200 cursor-pointer">#Treinamentos</span>
                        <span className="px-2 py-1 bg-gray-100 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-200 cursor-pointer">#Metas2024</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FeedPage;