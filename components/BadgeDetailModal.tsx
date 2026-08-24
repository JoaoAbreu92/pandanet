import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { 
    XMarkIcon, 
    HandThumbUpIcon, 
    ChatBubbleLeftIcon, 
    SparklesIcon, 
    TrashIcon, 
    PaperAirplaneIcon 
} from './icons';
import type { UserBadge } from '../types';

interface BadgeDetailModalProps {
    userBadge: UserBadge;
    onClose: () => void;
}

interface PostComment {
    id: string;
    authorId: string;
    authorName: string;
    authorAvatar: string;
    text: string;
    timestamp: string;
}

interface PostReaction {
    emoji: string;
    userId: string;
}

interface PostData {
    id: string;
    authorId: string;
    content: string;
    timestamp: string;
    reactions: PostReaction[];
    comments: PostComment[];
}

const QUICK_REACTIONS = ['👏', '🔥', '❤️', '🏆', '⭐', '🙌'];

const BadgeDetailModal: React.FC<BadgeDetailModalProps> = ({ userBadge, onClose }) => {
    const { currentUser } = useAuth();
    const [post, setPost] = useState<PostData | null>(null);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);
    const [showReactionMenu, setShowReactionMenu] = useState(false);

    const commentsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (userBadge) {
            fetchPostData();
        }
    }, [userBadge]);

    const fetchPostData = async () => {
        setLoading(true);
        try {
            // Garante que temos o company_id correto
            let companyId = userBadge.company_id;
            if (!companyId) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('company_id')
                    .eq('id', currentUser.id)
                    .single();
                companyId = profile?.company_id;
            }

            if (!companyId) {
                throw new Error("Company ID não informado.");
            }

            // Buscar todos os posts de premiação de selo para encontrar o correspondente
            const { data, error } = await supabase
                .from('posts')
                .select(`
                    id, content, created_at, author_id,
                    profiles: author_id(full_name, avatar_url),
                    post_reactions(id, emoji, user_id),
                    comments(id, content, created_at, author_id, profiles: author_id(full_name, avatar_url))
                `)
                .eq('company_id', companyId)
                .like('content', `[BADGE_AWARD]%`);

            if (error) throw error;

            let matchedPost = data?.find(p => {
                try {
                    const payload = JSON.parse(p.content.replace('[BADGE_AWARD]', ''));
                    return payload.badge_id === userBadge.badge_id && payload.recipient_id === userBadge.user_id;
                } catch {
                    return false;
                }
            });

            if (matchedPost) {
                setPost(formatPost(matchedPost));
            } else {
                // Se o post do selo não existir no mural (ex: legado), criar na hora para suportar comentários
                const createdPost = await createBadgePost(companyId);
                if (createdPost) {
                    setPost(formatPost(createdPost));
                } else {
                    console.error('Não foi possível carregar ou criar o post do selo.');
                }
            }
        } catch (err) {
            console.error('Erro ao buscar post do selo:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatPost = (item: any): PostData => {
        return {
            id: item.id,
            authorId: item.author_id,
            content: item.content,
            timestamp: item.created_at,
            reactions: (item.post_reactions || []).map((r: any) => ({
                emoji: r.emoji,
                userId: r.user_id
            })),
            comments: (item.comments || []).map((c: any) => ({
                id: c.id,
                authorId: c.author_id,
                authorName: c.profiles?.full_name || 'Usuário Excluído',
                authorAvatar: c.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.profiles?.full_name || 'Usuario Excluido')}&background=random`,
                text: c.content,
                timestamp: c.created_at
            })).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        };
    };

    const createBadgePost = async (companyId: string) => {
        try {
            // Buscar nome de quem concedeu o selo
            let awardedByName = 'Administrador';
            if (userBadge.awarded_by) {
                const { data: authorProfile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', userBadge.awarded_by)
                    .single();
                if (authorProfile) awardedByName = authorProfile.full_name;
            }

            // Buscar nome e avatar de quem recebeu
            let recipientName = 'Colaborador';
            let recipientAvatar = '';
            const { data: recipientProfile } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', userBadge.user_id)
                .single();
            if (recipientProfile) {
                recipientName = recipientProfile.full_name;
                recipientAvatar = recipientProfile.avatar_url || '';
            }

            const awardPayload = {
                type: 'badge_award',
                recipient_id: userBadge.user_id,
                recipient_name: recipientName,
                recipient_avatar: recipientAvatar,
                badge_id: userBadge.badge_id,
                badge_name: userBadge.company_badges?.name || 'Selo',
                badge_icon: userBadge.company_badges?.icon || '🏆',
                badge_color: userBadge.company_badges?.color || 'bg-gradient-to-br from-yellow-300 to-yellow-600',
                reason: userBadge.reason || '',
                awarded_by_name: awardedByName
            };

            const { data: newPost, error } = await supabase
                .from('posts')
                .insert({
                    author_id: currentUser.id, // IMPORTANTE: Autor precisa ser o usuário logado para passar no RLS
                    company_id: companyId,
                    content: `[BADGE_AWARD]${JSON.stringify(awardPayload)}`,
                    media_url: null,
                    media_type: null,
                    mentions: [userBadge.user_id]
                })
                .select(`
                    id, content, created_at, author_id,
                    profiles: author_id(full_name, avatar_url),
                    post_reactions(id, emoji, user_id),
                    comments(id, content, created_at, author_id, profiles: author_id(full_name, avatar_url))
                `)
                .single();

            if (error) throw error;
            return newPost;
        } catch (err) {
            console.error('Erro ao gerar post de premiação:', err);
            return null;
        }
    };

    const handleCommentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentText.trim() || !post || submittingComment) return;

        setSubmittingComment(true);
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('company_id')
                .eq('id', currentUser.id)
                .single();

            const { error } = await supabase
                .from('comments')
                .insert({
                    post_id: post.id,
                    author_id: currentUser.id,
                    company_id: profile?.company_id,
                    content: commentText.trim()
                });

            if (error) throw error;
            setCommentText('');
            await fetchPostData();
            setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        } catch (err: any) {
            alert('Erro ao enviar comentário: ' + err.message);
        } finally {
            setSubmittingComment(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!confirm('Deseja realmente deletar este comentário?')) return;
        try {
            const { error } = await supabase
                .from('comments')
                .delete()
                .eq('id', commentId);

            if (error) throw error;
            await fetchPostData();
        } catch (err: any) {
            alert('Erro ao deletar comentário: ' + err.message);
        }
    };

    const handleToggleReaction = async (emoji: string) => {
        if (!post) return;

        const existingReaction = post.reactions.find(
            r => r.userId === currentUser.id && r.emoji === emoji
        );

        try {
            if (existingReaction) {
                // Remover reação
                await supabase
                    .from('post_reactions')
                    .delete()
                    .eq('post_id', post.id)
                    .eq('user_id', currentUser.id)
                    .eq('emoji', emoji);
            } else {
                // Inserir reação
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('company_id')
                    .eq('id', currentUser.id)
                    .single();

                await supabase
                    .from('post_reactions')
                    .insert({
                        post_id: post.id,
                        user_id: currentUser.id,
                        company_id: profile?.company_id,
                        emoji: emoji
                    });
            }
            await fetchPostData();
        } catch (err: any) {
            console.error('Erro ao alternar reação:', err);
        }
    };

    const badge = userBadge.company_badges;
    if (!badge) return null;

    const isUrl = badge.icon.startsWith('http://') || badge.icon.startsWith('https://');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div 
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 max-w-2xl w-full overflow-hidden flex flex-col md:flex-row min-h-[500px] max-h-[90vh] animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Left Side: Badge Display */}
                <div className="w-full md:w-[260px] bg-slate-50 dark:bg-slate-950/40 p-6 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center text-center relative overflow-hidden select-none">
                    {/* Glowing background rays */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-amber-400/10 rounded-full blur-2xl -z-10 animate-pulse"></div>

                    <div className={`w-28 h-28 rounded-3xl ${badge.color} border-2 border-white/40 flex items-center justify-center text-5xl shadow-xl shadow-slate-300/40 dark:shadow-slate-950/50 transform hover:scale-105 hover:rotate-3 transition-all duration-300 cursor-pointer animate-float overflow-hidden`}>
                        {isUrl ? (
                            <img src={badge.icon} className="w-full h-full object-cover rounded-3xl border border-white/10" alt={badge.name} />
                        ) : (
                            badge.icon
                        )}
                    </div>

                    <h3 className="mt-4 font-black text-slate-800 dark:text-white text-lg tracking-tight leading-snug">
                        {badge.name}
                    </h3>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed px-2">
                        {badge.description || 'Selo de excelência e reconhecimento da empresa.'}
                    </p>

                    {userBadge.created_at && (
                        <span className="mt-6 text-[10px] bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full text-slate-500 dark:text-slate-400 font-bold">
                            Conquistado em {new Date(userBadge.created_at).toLocaleDateString('pt-BR')}
                        </span>
                    )}
                </div>

                {/* Right Side: Comments and Interactions */}
                <div className="flex-1 flex flex-col justify-between max-h-[50vh] md:max-h-full">
                    {/* Header */}
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
                        <span className="inline-flex items-center gap-1 text-xs font-black text-brand-primary dark:text-emerald-400 uppercase tracking-wider">
                            <SparklesIcon className="w-4 h-4" />
                            Comentários do Selo
                        </span>
                        <button 
                            onClick={onClose}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Reason / Award details */}
                    {userBadge.reason && (
                        <div className="px-5 pt-4">
                            <div className="relative p-3 rounded-2xl bg-amber-50/30 dark:bg-amber-950/10 border border-amber-100/50 dark:border-amber-950/20 italic text-slate-600 dark:text-slate-300 text-xs font-medium leading-relaxed">
                                <span className="absolute -top-2 left-3 text-2xl text-brand-primary font-serif select-none">“</span>
                                <p className="px-1.5">{userBadge.reason}</p>
                            </div>
                        </div>
                    )}

                    {/* Comments Area */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-full py-10">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                                <span className="text-xs text-slate-400 mt-2">Carregando comentários...</span>
                            </div>
                        ) : !post || post.comments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full py-12 text-center text-slate-400 dark:text-slate-500">
                                <ChatBubbleLeftIcon className="w-8 h-8 mb-2 opacity-50" />
                                <span className="text-xs font-medium">Nenhum comentário ainda.</span>
                                <span className="text-[10px] mt-1 opacity-70">Seja o primeiro a parabenizar!</span>
                            </div>
                        ) : (
                            post.comments.map(comment => {
                                const isCommentAuthor = comment.authorId === currentUser.id;
                                return (
                                    <div key={comment.id} className="flex space-x-3 group animate-in fade-in duration-200">
                                        <img src={comment.authorAvatar} alt={comment.authorName} className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-100 dark:border-slate-800" />
                                        <div className="bg-slate-50 dark:bg-slate-850 rounded-2xl px-3 py-1.5 flex-1 relative min-w-0">
                                            <div className="flex justify-between items-start gap-2">
                                                <h5 className="font-bold text-[11px] text-slate-800 dark:text-white truncate">
                                                    {comment.authorName}
                                                </h5>
                                                {isCommentAuthor && (
                                                    <button 
                                                        onClick={() => handleDeleteComment(comment.id)}
                                                        className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-500 transition-all rounded"
                                                        title="Excluir comentário"
                                                    >
                                                        <TrashIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-650 dark:text-slate-200 mt-0.5 whitespace-pre-wrap break-words leading-relaxed font-medium">
                                                {comment.text}
                                            </p>
                                            <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1">
                                                {new Date(comment.timestamp).toLocaleString('pt-BR')}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={commentsEndRef} />
                    </div>

                    {/* Interactions and Form Footer */}
                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                        {/* Reactions row */}
                        {post && (
                            <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                                {QUICK_REACTIONS.map(emoji => {
                                    const userReactions = post.reactions.filter(r => r.emoji === emoji);
                                    const hasReacted = userReactions.some(r => r.userId === currentUser.id);
                                    return (
                                        <button
                                            key={emoji}
                                            onClick={() => handleToggleReaction(emoji)}
                                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all border ${
                                                hasReacted 
                                                    ? 'bg-brand-primary/10 border-brand-primary text-brand-primary scale-105'
                                                    : 'bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-brand-primary/35'
                                            }`}
                                        >
                                            <span>{emoji}</span>
                                            {userReactions.length > 0 && (
                                                <span className="text-[10px] font-black">{userReactions.length}</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Input form */}
                        <form onSubmit={handleCommentSubmit} className="flex gap-2 items-center">
                            <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-800" />
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    placeholder="Escreva um comentário parabenizando..."
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full px-4 py-2 text-xs focus:outline-none focus:border-brand-primary dark:text-white"
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={!commentText.trim() || submittingComment}
                                className="bg-brand-primary hover:bg-emerald-600 disabled:opacity-50 text-white p-2 rounded-full transition-all shadow-md shadow-brand-primary/20 shrink-0"
                            >
                                <PaperAirplaneIcon className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BadgeDetailModal;
