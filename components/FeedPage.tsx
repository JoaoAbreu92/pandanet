import React, { useState, useRef } from 'react';
import Card from './Card';
import EventsCarouselMini from './EventsCarouselMini';
import RecognitionWidget from './RecognitionWidget';
import RecognitionModal from './RecognitionModal';
import type { Post, Employee, Event, Recognition } from '../types';
import { VideoCameraIcon, PhotoIcon, HandThumbUpIcon, ChatBubbleLeftIcon, PaperAirplaneIcon, ShareIcon, FaceSmileIcon, UserGroupIcon, HashtagIcon, CakeIcon } from './icons';

interface FeedPageProps {
    posts: Post[];
    setPosts: (posts: Post[]) => void;
    currentUser: Employee;
    allEmployees?: Employee[];
    events?: Event[];
    recognitions?: Recognition[];
    onAddRecognition?: (rec: Recognition) => void;
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
        setShowReactionMenu(true);
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
                <img src={post.authorAvatar} alt={post.authorName} className="w-10 h-10 rounded-full mr-3" />
                <div>
                    <h4 className="font-bold text-brand-text">{post.authorName}</h4>
                    <p className="text-xs text-gray-500">{post.timestamp}</p>
                </div>
            </div>

            {/* Content */}
            <div className="text-brand-text whitespace-pre-wrap mb-4">
                {renderContent(post.content)}
            </div>

            {/* Media */}
            {post.mediaUrl && (
                <div className="mb-4 rounded-lg overflow-hidden bg-gray-100 border">
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
                        className={`flex items-center justify-center w-full py-2 space-x-2 rounded-md hover:bg-gray-50 transition-colors ${userReaction ? 'text-brand-primary font-semibold' : 'text-gray-600'}`}
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
                                <img src={comment.authorAvatar} alt={comment.authorName} className="w-8 h-8 rounded-full" />
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
                    <img src={currentUser.avatarUrl} alt="User" className="w-8 h-8 rounded-full" />
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

const FeedPage: React.FC<FeedPageProps> = ({ posts, setPosts, currentUser, allEmployees = [], events = [], recognitions = [], onAddRecognition }) => {
    const [newPostContent, setNewPostContent] = useState('');
    const [mediaFile, setMediaFile] = useState<{ url: string, type: 'image' | 'video' } | null>(null);
    const [showRecognitionModal, setShowRecognitionModal] = useState(false);

    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const postTextareaRef = useRef<HTMLTextAreaElement>(null);

    const handleRecognitionSubmit = (data: Omit<Recognition, 'id' | 'from' | 'fromAvatar'>) => {
        if (onAddRecognition) {
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
            setMediaFile({ url, type });
        }
    };

    const handlePostSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPostContent.trim() && !mediaFile) return;

        // Detect mentions
        const mentions: string[] = [];
        if (allEmployees) {
            allEmployees.forEach(emp => {
                if (newPostContent.includes(`@${emp.name}`)) {
                    mentions.push(emp.id);
                }
            });
        }

        const newPost: Post = {
            id: Date.now().toString(),
            authorId: currentUser.id,
            authorName: currentUser.name,
            authorAvatar: currentUser.avatarUrl,
            content: newPostContent,
            timestamp: 'Agora mesmo',
            reactions: [],
            comments: [],
            mentions: mentions,
            ...(mediaFile && { mediaUrl: mediaFile.url, mediaType: mediaFile.type })
        };

        setPosts([newPost, ...posts]);
        setNewPostContent('');
        setMediaFile(null);
    };

    const handleToggleReaction = (postId: number, emoji: string) => {
        setPosts(posts.map(post => {
            if (post.id === postId) {
                const existingReactionIndex = post.reactions.findIndex(r => r.userId === currentUser.id);
                let newReactions = [...post.reactions];

                if (existingReactionIndex > -1) {
                    if (newReactions[existingReactionIndex].emoji === emoji) {
                        // Toggle off
                        newReactions = newReactions.filter(r => r.userId !== currentUser.id);
                    } else {
                        // Change emoji
                        newReactions[existingReactionIndex].emoji = emoji;
                    }
                } else {
                    // Add new reaction
                    newReactions.push({ emoji, userId: currentUser.id });
                }
                return { ...post, reactions: newReactions };
            }
            return post;
        }));
    };

    const handleSubmitComment = (postId: number, text: string) => {
        setPosts(posts.map(post => {
            if (post.id === postId) {
                return {
                    ...post,
                    comments: [...post.comments, {
                        id: Date.now(),
                        authorId: currentUser.id,
                        authorName: currentUser.name,
                        authorAvatar: currentUser.avatarUrl,
                        text: text,
                        timestamp: 'Agora'
                    }]
                };
            }
            return post;
        }));
    };

    const handleShare = (post: Post) => {
        const shareUrl = `${window.location.origin}/feed/${post.id}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert('Link da publicação copiado para a área de transferência!');
        });
    };

    // Determine Employee of the Month (Removed mock logic)

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
                        <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-20 h-20 rounded-full border-4 border-white shadow-md mb-2" />
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
                            <a href="#" className="flex items-center space-x-2 text-sm text-gray-600 hover:text-brand-primary">
                                <UserGroupIcon className="w-5 h-5 text-purple-500" />
                                <span>Grupos</span>
                            </a>
                        </li>
                        <li>
                            <a href="#" className="flex items-center space-x-2 text-sm text-gray-600 hover:text-brand-primary">
                                <HashtagIcon className="w-5 h-5 text-blue-500" />
                                <span>Tópicos</span>
                            </a>
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
                <h1 className="text-3xl font-bold text-brand-text">Feed Social</h1>

                {/* Create Post Card */}
                <Card title="">
                    <div className="flex space-x-4">
                        <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-10 h-10 rounded-full" />
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