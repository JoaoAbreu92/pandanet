import React, { useState, useEffect, useRef } from 'react';
import Card from './Card';
import EventsCarouselMini from './EventsCarouselMini';
import RecognitionWidget from './RecognitionWidget';
import RecognitionModal from './RecognitionModal';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import { FaceSmileIcon, UserGroupIcon, PaperAirplaneIcon, PlusIcon, ChatBubbleLeftRightIcon, VideoCameraIcon, PhotoIcon, HandThumbUpIcon, ChatBubbleLeftIcon, ShareIcon, HashtagIcon, CakeIcon, XCircleIcon } from './icons';
import type { Post, Employee, Event, Recognition, PostComment, PostReaction } from '../types';

export const PostCard: React.FC<{
    post: Post;
    currentUser: Employee;
    onToggleReaction: (postId: string, emoji: string) => void;
    onSubmitComment: (postId: string, text: string) => void;
    onShare: (post: Post) => void;
}> = ({ post, currentUser, onToggleReaction, onSubmitComment, onShare }) => {
    const [commentText, setCommentText] = useState('');
    const [showReactionMenu, setShowReactionMenu] = useState(false);
    const timeoutRef = useRef<any>(null);
    const commentInputRef = useRef<HTMLInputElement>(null);

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
        }, 1500);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setShowReactionMenu(false);
        }, 1200);
    };

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
            <div className="flex items-center mb-4">
                <img src={post.authorAvatar} alt={post.authorName} className="w-10 h-10 rounded-full mr-3 object-cover" />
                <div>
                    <h4 className="font-bold text-brand-text">{post.authorName}</h4>
                    <p className="text-xs text-gray-500">{new Date(post.timestamp).toLocaleString()}</p>
                </div>
            </div>

            <div className="text-brand-text whitespace-pre-wrap mb-4">
                {renderContent(post.content)}
            </div>

            {post.mediaUrl && (
                <div className="mb-4 rounded-lg overflow-hidden bg-gray-100 border text-center">
                    {post.mediaType === 'image' ? (
                        <img src={post.mediaUrl} alt="Post content" className="w-full h-auto object-cover max-h-[500px]" />
                    ) : (
                        <video src={post.mediaUrl} controls className="w-full max-h-[500px]" />
                    )}
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
                    <span>{post.reactions.length} reações</span>
                </div>
                <span>{post.comments.length} comentários</span>
            </div>

            <div className="flex justify-around py-1 relative">
                <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className="flex-1">
                    <button className={`w-full flex items-center justify-center space-x-2 py-2 rounded-lg hover:bg-gray-50 transition-colors ${post.reactions.some(r => r.userId === currentUser.id) ? 'text-brand-primary font-bold' : 'text-gray-500'}`}>
                        <HandThumbUpIcon className="w-5 h-5" /><span>Reagir</span>
                    </button>
                    {showReactionMenu && (
                        <div className="absolute bottom-full mb-2 left-0 bg-white shadow-xl border rounded-full p-2 flex space-x-2 animate-fade-in-up z-20">
                            {reactions.map(emoji => (
                                <button key={emoji} onClick={() => { onToggleReaction(post.id, emoji); setShowReactionMenu(false); }} className="text-2xl hover:scale-125 transition-transform p-1">
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <button onClick={() => commentInputRef.current?.focus()} className="flex-1 flex items-center justify-center space-x-2 py-2 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors">
                    <ChatBubbleLeftIcon className="w-5 h-5" /><span>Comentar</span>
                </button>
                <button onClick={() => onShare(post)} className="flex-1 flex items-center justify-center space-x-2 py-2 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors">
                    <ShareIcon className="w-5 h-5" /><span>Compartilhar</span>
                </button>
            </div>

            {post.comments.length > 0 && (
                <div className="mt-4 space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {post.comments.map(comment => (
                        <div key={comment.id} className="flex space-x-3">
                            <img src={comment.authorAvatar} alt={comment.authorName} className="w-8 h-8 rounded-full object-cover shrink-0" />
                            <div className="bg-gray-50 rounded-2xl px-4 py-2 flex-1">
                                <h5 className="font-bold text-xs text-brand-text">{comment.authorName}</h5>
                                <p className="text-sm text-brand-text">{comment.text}</p>
                                <p className="text-[10px] text-gray-400 mt-1">{new Date(comment.timestamp).toLocaleDateString()}</p>
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
                        placeholder="Escreva um comentário..."
                        className="w-full bg-gray-50 border-none rounded-full px-4 py-2 text-sm focus:ring-1 focus:ring-brand-primary outline-none"
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
}

const FeedPage: React.FC<FeedPageProps> = ({ currentUser, allEmployees = [], events = [], recognitions = [], onAddRecognition }) => {
    const { addNotification } = useNotifications();
    const [posts, setPosts] = useState<Post[]>([]);
    const [newPostContent, setNewPostContent] = useState('');
    const [mediaFile, setMediaFile] = useState<{ url: string, type: 'image' | 'video', file?: File } | null>(null);
    const [showRecognitionModal, setShowRecognitionModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [mentionSearch, setMentionSearch] = useState('');
    const [mentionIndex, setMentionIndex] = useState(-1);
    const [mentions, setMentions] = useState<{ id: string, name: string }[]>([]);

    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLTextAreaElement>(null); // Wrong ref type in original, fixed
    const postTextareaRef = useRef<HTMLTextAreaElement>(null);

    const fetchPosts = async () => {
        try {
            const { data, error } = await supabase
                .from('posts')
                .select(`
                    id, content, created_at, media_url, media_type, mentions, author_id,
                    profiles: author_id(full_name, avatar_url),
                    post_reactions(id, emoji, user_id),
                    comments(id, content, created_at, author_id, profiles: author_id(full_name, avatar_url))
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
                    text: c.content,
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

    const handleCreatePost = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (!newPostContent.trim() && !mediaFile) return;

            let uploadedMediaUrl = null;
            if (mediaFile && mediaFile.file) {
                const fileExt = mediaFile.file.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `${currentUser.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('posts')
                    .upload(filePath, mediaFile.file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('posts')
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

            finalMentionIds.forEach(id => {
                if (id !== currentUser.id) {
                    addNotification({
                        user_id: id,
                        type: 'mention',
                        title: 'Você foi mencionado!',
                        description: `${currentUser.name} mencionou você em um post.`,
                        avatarUrl: currentUser.avatarUrl,
                        link: '/'
                    } as any);
                }
            });

            setNewPostContent('');
            setMediaFile(null);
            setMentions([]);
        } catch (error) {
            console.error('Error creating post:', error);
            alert('Erro ao publicar post.');
        }
    };

    const handleRecognitionSubmit = async (data: Omit<Recognition, 'id' | 'from' | 'fromAvatar'>) => {
        try {
            const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', currentUser.id).single();
            await supabase.from('recognitions').insert({
                from_id: currentUser.id,
                to_id: data.to, // assuming data.to is the user ID
                company_id: profile?.company_id,
                message: data.message,
                type: data.value
            });
            if (onAddRecognition) {
                onAddRecognition({
                    id: Date.now().toString(),
                    from: currentUser.name,
                    fromAvatar: currentUser.avatarUrl,
                    ...data
                });
            }
        } catch (err) {
            console.error(err);
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
                newReactions.push({ postId, userId: currentUser.id, emoji });
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

    const handleSubmitComment = async (postId: string, text: string) => {
        try {
            const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', currentUser.id).single();
            await supabase.from('comments').insert({ post_id: postId, author_id: currentUser.id, company_id: profile?.company_id, content: text });
        } catch (err) {
            console.error(err);
        }
    };

    const recentRecognitions = [...recognitions].sort((a, b) => {
        const idA = parseInt(a.id) || 0;
        const idB = parseInt(b.id) || 0;
        return idB - idA;
    }).slice(0, 3);

    return (
        <div className="max-w-full mx-auto py-8 px-4 lg:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Card title="" className="text-center pb-6">
                        <div className="relative mb-4">
                            <div className="h-20 bg-brand-primary rounded-t-xl -mx-6 -mt-6 mb-10"></div>
                            <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-20 h-20 rounded-full border-4 border-white absolute left-1/2 -translate-x-1/2 top-10 shadow-md object-cover" />
                        </div>
                        <h3 className="text-lg font-bold text-brand-text mb-1">{currentUser.name}</h3>
                        <p className="text-sm text-brand-subtle-text mb-4">{currentUser.role} • {currentUser.team}</p>
                        <hr className="mb-4" />
                        <div className="flex justify-around">
                            <div><p className="font-bold text-brand-text">{posts.filter(p => p.authorId === currentUser.id).length}</p><p className="text-[10px] text-brand-subtle-text uppercase">Posts</p></div>
                            <div className="border-x px-6">
                                <p className="font-bold text-brand-text">{allEmployees.length}</p><p className="text-[10px] text-brand-subtle-text uppercase">Usuários</p>
                            </div>
                            <div><p className="font-bold text-brand-text">{allEmployees.length > 0 ? allEmployees.length - 1 : 0}</p><p className="text-[10px] text-brand-subtle-text uppercase">Interações</p></div>
                        </div>
                    </Card>
                    <RecognitionWidget recognitions={recentRecognitions} onRecognize={() => setShowRecognitionModal(true)} />
                </div>

                <div className="lg:col-span-8 space-y-6">
                    <Card title="" className="p-0 border-none shadow-sm overflow-visible">
                        <div className="p-4 bg-white rounded-xl shadow-sm border relative">
                            <div className="flex space-x-4 mb-4">
                                <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-12 h-12 rounded-full object-cover" />
                                <div className="flex-1 relative">
                                    <textarea
                                        ref={postTextareaRef}
                                        placeholder="O que está acontecendo na empresa?"
                                        className="w-full p-4 border border-gray-100 rounded-xl bg-gray-50/50 text-brand-text focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary/20 outline-none transition-all resize-none min-h-[120px]"
                                        value={newPostContent}
                                        onChange={handlePostContentChange}
                                    ></textarea>
                                    {mentionSearch !== '' && (
                                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                            {allEmployees
                                                .filter(emp => emp.name.toLowerCase().includes(mentionSearch.toLowerCase()))
                                                .map(user => (
                                                    <div key={user.id} onClick={() => selectMention(user)} className="flex items-center space-x-3 p-3 hover:bg-gray-50 cursor-pointer border-b last:border-0 transition-colors">
                                                        <img src={user.avatarUrl || 'https://via.placeholder.com/32'} className="w-8 h-8 rounded-full object-cover" alt="" />
                                                        <div><p className="text-sm font-bold text-brand-text">{user.name}</p><p className="text-xs text-brand-subtle-text">{user.role}</p></div>
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {mediaFile && (
                                <div className="relative mb-4 group ring-2 ring-brand-primary/20 rounded-xl overflow-hidden shadow-inner bg-gray-50">
                                    {mediaFile.type === 'image' ? (
                                        <img src={mediaFile.url} className="w-full h-48 object-cover rounded-xl" alt="" />
                                    ) : (
                                        <video src={mediaFile.url} className="w-full h-48 object-cover rounded-xl" />
                                    )}
                                    <button onClick={() => setMediaFile(null)} className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 transition-all shadow-lg scale-90 group-hover:scale-100 opacity-0 group-hover:opacity-100"><XCircleIcon className="w-5 h-5" /></button>
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                <div className="flex space-x-2">
                                    <button onClick={() => imageInputRef.current?.click()} className="flex items-center space-x-2 px-3 py-2 text-gray-500 hover:bg-brand-primary/5 hover:text-brand-primary rounded-lg transition-all"><PhotoIcon className="w-5 h-5 text-emerald-500" /><span className="text-sm font-medium">Foto</span></button>
                                    <button onClick={() => videoInputRef.current?.click()} className="flex items-center space-x-2 px-3 py-2 text-gray-500 hover:bg-brand-primary/5 hover:text-brand-primary rounded-lg transition-all"><VideoCameraIcon className="w-5 h-5 text-blue-500" /><span className="text-sm font-medium">Video</span></button>
                                    <button onClick={() => setShowRecognitionModal(true)} className="flex items-center space-x-2 px-3 py-2 text-gray-500 hover:bg-brand-primary/5 hover:text-brand-primary rounded-lg transition-all"><CakeIcon className="w-5 h-5 text-purple-500" /><span className="text-sm font-medium">Reconhecer</span></button>
                                </div>
                                <button onClick={handleCreatePost} disabled={!newPostContent.trim() && !mediaFile} className="flex items-center space-x-2 px-6 py-2.5 bg-brand-primary text-white font-bold rounded-xl hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-brand-primary transition-all shadow-md shadow-brand-primary/20 active:scale-95"><PaperAirplaneIcon className="w-5 h-5" /><span>Publicar</span></button>
                            </div>

                            <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) setMediaFile({ url: URL.createObjectURL(file), type: 'image', file }); }} />
                            <input type="file" ref={videoInputRef as any} className="hidden" accept="video/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) setMediaFile({ url: URL.createObjectURL(file), type: 'video', file }); }} />
                        </div>
                    </Card>

                    {loading ? (
                        <div className="space-y-6">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="bg-white rounded-xl h-64 animate-pulse"></div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {posts.map(post => (
                                <PostCard key={post.id} post={post} currentUser={currentUser} onToggleReaction={handleToggleReaction} onSubmitComment={handleSubmitComment} onShare={() => { }} />
                            ))}
                        </div>
                    )}
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <EventsCarouselMini events={events} />
                </div>
            </div>

            {showRecognitionModal && (
                <RecognitionModal
                    isOpen={showRecognitionModal}
                    onClose={() => setShowRecognitionModal(false)}
                    onSubmit={(data) => { handleRecognitionSubmit(data as any); setShowRecognitionModal(false); }}
                    employees={allEmployees}
                    currentUserId={currentUser.id}
                />
            )}
        </div>
    );
};

export default FeedPage;