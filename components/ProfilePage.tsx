import React, { useState, useRef, useEffect, useMemo } from 'react';
import Card from './Card';
import { PencilIcon, SparklesIcon, CheckIcon } from './icons';
import type { Employee, Post, CompanyBadge, UserBadge } from '../types';
import { PostCard } from './FeedPage';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import BadgeDetailModal from './BadgeDetailModal';

const PRESET_AVATARS = [
    'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?auto=format&fit=crop&w=150&q=80', // Panda
    'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=150&q=80', // Gato
    'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=150&q=80', // Cachorro
    'https://images.unsplash.com/photo-1474511320723-9a56873867b5?auto=format&fit=crop&w=150&q=80', // Raposa
    'https://images.unsplash.com/photo-1546182990-dffeafbe841d?auto=format&fit=crop&w=150&q=80', // Leão
    'https://images.unsplash.com/photo-1501820488136-72669a482d0e?auto=format&fit=crop&w=150&q=80', // Esquilo (Link Corrigido)
    'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?auto=format&fit=crop&w=150&q=80', // Coelho
    'https://images.unsplash.com/photo-1517783999520-f068d7431a60?auto=format&fit=crop&w=150&q=80', // Pinguim
    'https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?auto=format&fit=crop&w=150&q=80', // Coala
    'https://images.unsplash.com/photo-1555685812-4b943f1cb0eb?auto=format&fit=crop&w=150&q=80'  // Lontra
];

const PRESET_BANNERS = [
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&h=300&q=80',
    'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=1200&h=300&q=80',
    'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1200&h=300&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&h=300&q=80',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&h=300&q=80',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&h=300&q=80', // Paisagem de Montanhas (Link Corrigido)
    'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1200&h=300&q=80',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&h=300&q=80'
];

interface ProfilePageProps {
    userId?: string;
    currentUser: Employee;
    onUpdateUser: (user: Employee) => void;
    feedPosts?: Post[];
    setFeedPosts?: (posts: Post[]) => void;
    allEmployees?: Employee[];
    isAIEnabled?: boolean;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ userId, currentUser, onUpdateUser, feedPosts = [], setFeedPosts, allEmployees = [], isAIEnabled }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [targetUser, setTargetUser] = useState<Employee | null>(null);
    const [tempUserData, setTempUserData] = useState<Employee>(currentUser);
    const [activeTab, setActiveTab] = useState<'info' | 'activity' | 'security' | 'ai' | 'conquistas'>(userId && userId !== currentUser.id ? 'activity' : 'info');
    const [loading, setLoading] = useState(false);
    const [userPosts, setUserPosts] = useState<Post[]>([]);
    const [isFollowLoading, setIsFollowLoading] = useState(false);
    const [selectedBadgeForComments, setSelectedBadgeForComments] = useState<UserBadge | null>(null);
    const { refreshProfile } = useAuth();

    // Password change state
    const [passwordData, setPasswordData] = useState({ newPassword: '', confirmPassword: '' });
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handlePasswordChange = async () => {
        setPasswordMessage(null);
        if (passwordData.newPassword.length < 6) {
            setPasswordMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' });
            return;
        }
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPasswordMessage({ type: 'error', text: 'As senhas não coincidem.' });
            return;
        }
        setPasswordLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
            if (error) throw error;
            setPasswordMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
            setPasswordData({ newPassword: '', confirmPassword: '' });
        } catch (err: any) {
            setPasswordMessage({ type: 'error', text: err.message || 'Erro ao alterar senha.' });
        } finally {
            setPasswordLoading(false);
        }
    };

    const isOwnProfile = !userId || userId === currentUser.id;

    useEffect(() => {
        if (isOwnProfile) {
            // Fetch fresh data for current user to ensure we have department_id etc.
            const fetchFreshProfile = async () => {
                const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
                if (data) {
                    const freshUser: Employee = {
                        ...currentUser,
                        id: data.id,
                        name: data.full_name,
                        email: data.email,
                        role: data.role,
                        team: data.team,
                        avatarUrl: data.avatar_url,
                        coverUrl: data.cover_url,
                        bio: data.bio,
                        phone: data.phone,
                        officeLocation: data.office_location,
                        joinDate: data.join_date || data.created_at, // Use real join_date if exists
                        birthDate: data.birth_date,
                        company_id: data.company_id,
                        permissions: data.permissions || {},
                        following: data.following || [],
                        status_text: data.status_text
                    };
                    // Manually append department_id as it might not be in Employee type definition yet
                    (freshUser as any).department_id = data.department_id;

                    setTargetUser(freshUser);
                    setTempUserData(freshUser);
                }
            };
            fetchFreshProfile();
            setActiveTab('info');
        } else {
            // ... existing fetchTargetUser code ...
            const fetchTargetUser = async () => {
                setLoading(true);
                try {
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', userId)
                        .single();
                    if (data) {
                        const mapped: Employee = {
                            id: data.id,
                            name: data.full_name,
                            email: data.email,
                            role: data.role,
                            team: data.team,
                            avatarUrl: data.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.full_name)}&background=E2E8F0&color=475569`,
                            coverUrl: data.cover_url,
                            bio: data.bio,
                            phone: data.phone,
                            officeLocation: data.office_location,
                            joinDate: data.join_date || data.created_at,
                            birthDate: data.birth_date,
                            isAdmin: data.is_admin,
                            company_id: data.company_id,
                            following: data.following || [],
                            permissions: data.permissions || {},
                            status_text: data.status_text
                        };
                        (mapped as any).department_id = data.department_id;
                        setTargetUser(mapped);
                    }
                } catch (err) {
                    console.error("Error fetching target user:", err);
                } finally {
                    setLoading(false);
                }
            };
            fetchTargetUser();
            setActiveTab('activity');
        }
    }, [userId, currentUser.id]); // Removed currentUser dependency to avoid loop, just ID needs to be stable

    const fetchUserPosts = async (targetId: string) => {
        try {
            const { data, error } = await supabase
                .from('posts')
                .select(`
                    id, content, created_at, media_url, media_type, mentions, author_id,
                    profiles: author_id(full_name, avatar_url),
                    post_reactions(id, emoji, user_id),
                    comments(id, content, created_at, author_id, profiles: author_id(full_name, avatar_url))
                `)
                .or(`author_id.eq.${targetId},mentions.cs.{${targetId}}`)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const formattedPosts: Post[] = data.map((item: any) => ({
                id: item.id,
                authorId: item.author_id,
                authorName: item.profiles?.full_name || 'Usuário Excluído',
                authorAvatar: item.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.profiles?.full_name || 'Usuario Excluido')}&background=random`,
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
                    authorName: c.profiles?.full_name || 'Usuário Excluído',
                    authorAvatar: c.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.profiles?.full_name || 'Usuario Excluido')}&background=random`,
                    text: c.content,
                    timestamp: c.created_at
                })).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            }));

            setUserPosts(formattedPosts);
        } catch (error) {
            console.error('Error fetching user posts:', error);
        }
    };

    const effectiveUser = targetUser || currentUser;

    useEffect(() => {
        if (effectiveUser.id) {
            fetchUserPosts(effectiveUser.id);
        }
    }, [effectiveUser.id]);

    const [profileBadges, setProfileBadges] = useState<UserBadge[]>([]);

    useEffect(() => {
        const fetchProfileBadges = async () => {
            if (!effectiveUser.id) return;
            const { data } = await supabase
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
                .eq('user_id', effectiveUser.id);
            if (data) {
                setProfileBadges(data as any[]);
            }
        };
        fetchProfileBadges();
    }, [effectiveUser.id]);

    const avatarInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    const [departments, setDepartments] = useState<any[]>([]);

    useEffect(() => {
        const fetchDepartments = async () => {
            if (currentUser.company_id) {
                const { data } = await supabase.from('departments').select('*').eq('company_id', currentUser.company_id);
                if (data) setDepartments(data);
            }
        };
        fetchDepartments();
    }, [currentUser.company_id]);

    const handleSave = async () => {
        try {
            console.log("[Profile] ========== INICIANDO SALVAMENTO ==========");
            console.log("[Profile] Dados atuais:", tempUserData);
            console.log("[Profile] Current User ID:", currentUser.id);
            console.log("[Profile] Current User:", currentUser);
            
            // Verificar se temos um ID válido
            if (!currentUser?.id) {
                throw new Error("ID do usuário não encontrado. Faça login novamente.");
            }

            // Buscar o ID do usuário autenticado
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error("Usuário não autenticado. Faça login novamente.");
            }

            console.log("[Profile] Auth User ID:", user.id);
            
            console.log("[Profile] Verificando se perfil existe para o alvo que estamos editando...");
            const targetUserId = tempUserData.id;

            if (!targetUserId) {
                throw new Error("ID do usuário a ser editado não foi encontrado no estado.");
            }

            const { data: existingProfile, error: checkError } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', targetUserId)
                .single();

            if (checkError) {
                console.error("[Profile] Erro ao verificar perfil:", checkError);
                throw new Error("Erro ao verificar perfil existente.");
            }

            if (!existingProfile) {
                console.error("[Profile] Perfil não encontrado para ID alvo:", targetUserId);
                throw new Error("Perfil não encontrado. Entre em contato com o suporte.");
            }

            console.log("[Profile] Perfil existe, prosseguindo com UPDATE");
            
            // Converter datas para formato YYYY-MM-DD (sem timestamp)
            const formatDateForDB = (dateString: string | undefined) => {
                if (!dateString) return null;
                try {
                    const date = new Date(dateString);
                    return date.toISOString().split('T')[0]; // Retorna apenas YYYY-MM-DD
                } catch {
                    return null;
                }
            };
            
            const dbUpdates: any = {
                full_name: tempUserData.name,
                role: tempUserData.role,
                team: tempUserData.team,
                bio: tempUserData.bio,
                phone: tempUserData.phone,
                office_location: tempUserData.officeLocation,
                avatar_url: (tempUserData.avatarUrl && !tempUserData.avatarUrl.includes('ui-avatars.com')) ? tempUserData.avatarUrl : null,
                cover_url: tempUserData.coverUrl,
                birth_date: formatDateForDB(tempUserData.birthDate),
                join_date: formatDateForDB(tempUserData.joinDate),
                department_id: (tempUserData as any).department_id,
                ai_api_key: tempUserData.ai_api_key,
                ai_provider: tempUserData.ai_provider,
                ai_behavior: tempUserData.ai_behavior,
                status_text: (tempUserData as any).status_text,
                updated_at: new Date().toISOString()
            };

            console.log("[Profile] Dados para atualizar:", dbUpdates);
            console.log("[Profile] Executando UPDATE na tabela profiles...");

            // Fazer UPDATE direto sem .select() para evitar trigger de INSERT
            const { error: updateError } = await supabase
                .from('profiles')
                .update(dbUpdates)
                .eq('id', targetUserId);

            console.log("[Profile] Resposta do UPDATE:");
            console.log("[Profile] - error:", updateError);

            if (updateError) {
                console.error("[Profile] ❌ ERRO DO SUPABASE:");
                console.error("[Profile] - message:", updateError.message);
                console.error("[Profile] - details:", updateError.details);
                console.error("[Profile] - hint:", updateError.hint);
                console.error("[Profile] - code:", updateError.code);
                throw updateError;
            }

            console.log("[Profile] ✅ Registro atualizado com sucesso!");

            // Recarregar perfil do banco para garantir dados atualizados
            console.log("[Profile] Recarregando perfil do banco...");
            const { data: freshProfile, error: reloadError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', targetUserId)
                .single();

            if (!reloadError && freshProfile) {
                console.log("[Profile] Perfil recarregado:", freshProfile);
                
                // Atualizar tempUserData com dados frescos do banco
                const reloadedUser: Employee = {
                    id: freshProfile.id,
                    name: freshProfile.full_name,
                    email: freshProfile.email || '',
                    role: freshProfile.role,
                    team: freshProfile.team,
                    avatarUrl: freshProfile.avatar_url,
                    joinDate: freshProfile.join_date || freshProfile.created_at,
                    birthDate: freshProfile.birth_date,
                    isAdmin: freshProfile.is_admin,
                    isOnline: false,
                    permissions: freshProfile.permissions || {},
                    company_id: freshProfile.company_id,
                    following: freshProfile.following || [],
                    phone: freshProfile.phone,
                    officeLocation: freshProfile.office_location,
                    bio: freshProfile.bio,
                    coverUrl: freshProfile.cover_url,
                    ai_api_key: freshProfile.ai_api_key,
                    ai_provider: freshProfile.ai_provider,
                    ai_behavior: freshProfile.ai_behavior,
                    status_text: freshProfile.status_text
                };
                
                setTempUserData(reloadedUser);
                setTargetUser(reloadedUser);
                onUpdateUser(reloadedUser);
            }
            
            // Forçar refresh do perfil no AuthContext
            if (refreshProfile) {
                console.log("[Profile] Chamando refreshProfile...");
                await refreshProfile();
                console.log("[Profile] refreshProfile concluído");
            } else {
                console.warn("[Profile] ⚠️ refreshProfile não disponível");
            }
            
            setIsEditing(false);
            alert('Perfil atualizado com sucesso!');
            console.log("[Profile] ========== SALVAMENTO CONCLUÍDO ==========");
            
        } catch (error: any) {
            console.error("[Profile] ========== ERRO NO SALVAMENTO ==========");
            console.error("[Profile] Erro completo:", error);
            console.error("[Profile] Stack trace:", error.stack);
            alert(`Erro ao atualizar perfil: ${error.message || 'Erro desconhecido'}\n\nVerifique o console (F12) para mais detalhes.`);
        }
    };

    const handleCancel = () => {
        setTempUserData(currentUser);
        setIsEditing(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        console.log(`[Profile] Input change: ${name} = ${value}`);
        setTempUserData(prev => ({
            ...prev,
            [name]: value === '' ? null : value
        }));
    };

    const uploadImage = async (file: File, bucket: 'avatars' | 'covers') => {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
            return data.publicUrl;
        } catch (error) {
            console.error(`Error uploading ${bucket}:`, error);
            alert(`Erro ao fazer upload da imagem de ${bucket}.`);
            return null;
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
        const file = e.target.files?.[0];
        if (file) {
            setIsUploading(true);
            // Show preview immediately
            const newUrl = URL.createObjectURL(file);
            if (type === 'avatar') {
                setTempUserData(prev => ({ ...prev, avatarUrl: newUrl }));
            } else {
                setTempUserData(prev => ({ ...prev, coverUrl: newUrl }));
            }

            try {
                const publicUrl = await uploadImage(file, type === 'avatar' ? 'avatars' : 'covers');
                if (publicUrl) {
                    if (type === 'avatar') {
                        setTempUserData(prev => ({ ...prev, avatarUrl: publicUrl }));
                    } else {
                        setTempUserData(prev => ({ ...prev, coverUrl: publicUrl }));
                    }
                }
            } finally {
                setIsUploading(false);
            }
        }
    };

    const filteredPosts = userPosts;

    const handleFollowToggle = async () => {
        if (!currentUser || !effectiveUser || isFollowLoading) return;
        setIsFollowLoading(true);

        try {
            const isFollowing = currentUser.following?.includes(effectiveUser.id);
            let newFollowing = [...(currentUser.following || [])];

            if (isFollowing) {
                newFollowing = newFollowing.filter(id => id !== effectiveUser.id);
                console.log('Unfollowing user:', effectiveUser.id);
            } else {
                newFollowing.push(effectiveUser.id);
                console.log('Following user:', effectiveUser.id);
            }

            console.log('New following list:', newFollowing);

            const { error } = await supabase
                .from('profiles')
                .update({ following: newFollowing })
                .eq('id', currentUser.id);

            if (error) throw error;

            console.log('Database updated successfully');
            await refreshProfile(); // Sync global state
            onUpdateUser({ ...currentUser, following: newFollowing });

            // If it's the target user profile, update it locally too to reflect follower count if we had one
            if (targetUser && !isOwnProfile) {
                // No change needed to targetUser as we are the one following them, 
                // but we can force a re-render of the follow button by just state change
            }
        } catch (err) {
            console.error("Error toggling follow:", err);
            alert("Erro ao processar solicitação de seguir.");
        } finally {
            setIsFollowLoading(false);
        }
    };

    // Feed manipulation handlers (copied logic, ideally should be shared context or hook)
    const handleToggleReaction = (postId: string, emoji: string) => {
        if (!setFeedPosts) return;
        setFeedPosts(feedPosts.map(post => {
            if (post.id === postId) {
                const existingReactionIndex = post.reactions.findIndex(r => r.userId === currentUser.id);
                let newReactions = [...post.reactions];

                if (existingReactionIndex > -1) {
                    if (newReactions[existingReactionIndex].emoji === emoji) {
                        newReactions = newReactions.filter(r => r.userId !== currentUser.id);
                    } else {
                        newReactions[existingReactionIndex].emoji = emoji;
                    }
                } else {
                    newReactions.push({ emoji, userId: currentUser.id });
                }
                return { ...post, reactions: newReactions };
            }
            return post;
        }));
    };

    const handleSubmitComment = (postId: string, text: string) => { // Removed postId type annotation as it's inferred or matches signature
        if (!setFeedPosts) return;
        setFeedPosts(feedPosts.map(post => {
            if (post.id === postId) {
                return {
                    ...post,
                    comments: [...post.comments, {
                        id: Date.now().toString(), // Convert to string to match type
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

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando perfil...</div>;

    const userData = isEditing ? tempUserData : effectiveUser;

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-brand-text">{isOwnProfile ? 'Meu Perfil' : `Perfil de ${userData.name}`}</h2>
                {!isOwnProfile && (
                    <button
                        onClick={handleFollowToggle}
                        disabled={isFollowLoading}
                        className={`px-6 py-2 rounded-full font-bold transition-all shadow-md ${currentUser.following?.includes(effectiveUser.id)
                            ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            : 'bg-brand-primary text-white hover:bg-emerald-600'
                            }`}
                    >
                        {isFollowLoading ? '...' : currentUser.following?.includes(effectiveUser.id) ? 'Seguindo' : 'Seguir'}
                    </button>
                )}
            </div>

            <div className="relative">
                <div className="h-48 bg-gray-200 rounded-t-lg relative group">
                    <img src={userData.coverUrl || 'https://picsum.photos/id/1015/1200/300'} alt="Cover" className="w-full h-full object-cover rounded-t-lg" />
                    {isEditing && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-t-lg">
                            <button
                                onClick={() => coverInputRef.current?.click()}
                                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-black bg-white/80 rounded-md hover:bg-white"
                            >
                                <PencilIcon className="w-4 h-4" />
                                <span>Alterar Capa</span>
                            </button>
                            <input
                                type="file"
                                ref={coverInputRef}
                                hidden
                                accept="image/*"
                                onChange={(e) => handleFileChange(e, 'cover')}
                            />
                        </div>
                    )}
                </div>
                <div className="absolute -bottom-12 left-6">
                    <div className="relative group">
                        <img src={userData.avatarUrl} alt="User Avatar" className="w-24 h-24 rounded-full border-4 border-white object-cover" />
                        {isEditing && (
                            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => avatarInputRef.current?.click()}
                                    className="p-2 text-black bg-white/80 rounded-full hover:bg-white"
                                >
                                    <PencilIcon className="w-5 h-5" />
                                </button>
                                <input
                                    type="file"
                                    ref={avatarInputRef}
                                    hidden
                                    accept="image/*"
                                    onChange={(e) => handleFileChange(e, 'avatar')}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* PERFIL HEADER: NOME, CARGO E SELOS EM DESTAQUE */}
            <div className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-b-xl px-6 pb-6 pt-16 -mt-2 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-slate-800 dark:text-white">
                <div>
                    <h3 className="text-2xl font-black leading-tight">{userData.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">{userData.role} • {userData.team}</p>
                    {(userData as any).status_text && (
                        <p className="text-xs text-brand-primary dark:text-brand-primary font-bold italic mt-1.5">
                            Status: "{(userData as any).status_text}"
                        </p>
                    )}
                </div>
                {/* Equipped Badges Row */}
                <div className="flex gap-3 flex-wrap select-none mt-2 md:mt-0">
                    {profileBadges.filter(ub => ub.is_equipped).slice(0, 3).map(ub => {
                        const badge = ub.company_badges;
                        if (!badge) return null;
                        const isUrl = badge.icon.startsWith('http://') || badge.icon.startsWith('https://');
                        return (
                            <div 
                                key={ub.id} 
                                onClick={() => setSelectedBadgeForComments(ub)}
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
                    })}
                </div>
            </div>

            <div className="pt-4">
                {/* Tabs */}
                <div className="border-b border-gray-200 mb-6 overflow-x-auto no-scrollbar">
                    <nav className="-mb-px flex space-x-8 min-w-max">
                        {isOwnProfile && (
                            <button
                                onClick={() => setActiveTab('info')}
                                className={`${activeTab === 'info' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                            >
                                Informações Pessoais
                            </button>
                        )}
                        <button
                            onClick={() => setActiveTab('activity')}
                            className={`${activeTab === 'activity' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                            {isOwnProfile ? 'Minha Atividade' : 'Atividade'}
                        </button>
                        {isOwnProfile && (
                            <button
                                onClick={() => setActiveTab('security')}
                                className={`${activeTab === 'security' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                            >
                                Segurança
                            </button>
                        )}
                        {isOwnProfile && isAIEnabled && (
                            <button
                                onClick={() => setActiveTab('ai')}
                                className={`${activeTab === 'ai' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                            >
                                <SparklesIcon className="w-4 h-4 text-emerald-500" />
                                Assistente IA
                            </button>
                        )}
                        <button
                            onClick={() => setActiveTab('conquistas')}
                            className={`${activeTab === 'conquistas' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                            Conquistas
                        </button>
                    </nav>
                </div>

                {activeTab === 'info' ? (
                    <Card title="">
                        <div className="flex justify-end mb-4">
                            {!isEditing && (
                                <button onClick={() => setIsEditing(true)} className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 transition-colors">
                                    <PencilIcon className="w-4 h-4" />
                                    <span>Editar Perfil</span>
                                </button>
                            )}
                        </div>

                        {isEditing ? (
                            <div className="space-y-6">
                                {/* Presets Gallery */}
                                <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border dark:border-slate-800 space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest block">Banners de Capa Disponíveis</label>
                                        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                                            {PRESET_BANNERS.map((url, i) => (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    onClick={() => setTempUserData(prev => ({ ...prev, coverUrl: url }))}
                                                    className={`h-10 w-full rounded-lg overflow-hidden border-2 transition-all relative ${tempUserData.coverUrl === url ? 'border-brand-primary scale-95 shadow-md' : 'border-transparent opacity-80 hover:opacity-100'}`}
                                                >
                                                    <img src={url} className="w-full h-full object-cover" alt={`Banner ${i+1}`} />
                                                    {tempUserData.coverUrl === url && (
                                                        <div className="absolute inset-0 bg-brand-primary/20 flex items-center justify-center">
                                                            <CheckIcon className="w-4 h-4 text-white filter drop-shadow-md" />
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-2 border-t dark:border-slate-800">
                                        <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest block">Avatares de Perfil Disponíveis</label>
                                        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                                            {PRESET_AVATARS.map((url, i) => (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    onClick={() => setTempUserData(prev => ({ ...prev, avatarUrl: url }))}
                                                    className={`h-10 w-10 rounded-full overflow-hidden border-2 transition-all relative ${tempUserData.avatarUrl === url ? 'border-brand-primary scale-95 shadow-md' : 'border-transparent opacity-80 hover:opacity-100'}`}
                                                >
                                                    <img src={url} className="w-full h-full object-cover" alt={`Avatar ${i+1}`} />
                                                    {tempUserData.avatarUrl === url && (
                                                        <div className="absolute inset-0 bg-brand-primary/20 flex items-center justify-center rounded-full">
                                                            <CheckIcon className="w-4 h-4 text-white filter drop-shadow-md" />
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-brand-subtle-text">Nome</label>
                                        <input name="name" value={tempUserData.name} onChange={handleInputChange} className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-brand-subtle-text">E-mail</label>
                                        <input name="email" value={tempUserData.email} onChange={handleInputChange} className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-brand-subtle-text">Cargo</label>
                                        <input name="role" value={tempUserData.role} onChange={handleInputChange} className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-brand-subtle-text">Equipe</label>
                                        <input name="team" value={tempUserData.team} onChange={handleInputChange} className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-brand-subtle-text">Telefone</label>
                                        <input name="phone" value={tempUserData.phone || ''} onChange={handleInputChange} placeholder="(XX) XXXXX-XXXX" className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-brand-subtle-text">Escritório</label>
                                        <input name="officeLocation" value={tempUserData.officeLocation || ''} onChange={handleInputChange} placeholder="Ex: São Paulo ou Remoto" className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="text-sm font-medium text-brand-subtle-text">Frase de Status (Aparece no Chat Rápido)</label>
                                        <input 
                                            name="status_text" 
                                            value={(tempUserData as any).status_text || ''} 
                                            onChange={handleInputChange} 
                                            placeholder="Ex: Focado em reuniões ou Disponível para café ☕"
                                            className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" 
                                            maxLength={50}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-brand-subtle-text">Data de Nascimento</label>
                                        <input 
                                            type="date" 
                                            name="birthDate" 
                                            value={tempUserData.birthDate ? tempUserData.birthDate.substring(0, 10) : ''} 
                                            onChange={handleInputChange} 
                                            className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" 
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-brand-subtle-text">Data de Início (Empresa)</label>
                                        <input 
                                            type="date" 
                                            name="joinDate" 
                                            value={tempUserData.joinDate ? tempUserData.joinDate.substring(0, 10) : ''} 
                                            onChange={handleInputChange} 
                                            className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" 
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="text-sm font-medium text-brand-subtle-text">Departamento</label>
                                        <select
                                            name="department_id"
                                            value={(tempUserData as any).department_id || ''}
                                            onChange={(e) => setTempUserData(prev => ({ ...prev, department_id: e.target.value } as any))}
                                            className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"
                                        >
                                            <option value="">Selecione um departamento</option>
                                            {departments.map(dept => (
                                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="text-sm font-medium text-brand-subtle-text">Sobre mim</label>
                                        <textarea name="bio" value={tempUserData.bio || ''} onChange={handleInputChange} rows={3} placeholder="Fale um pouco sobre você..." className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"></textarea>
                                    </div>
                                </div>
                                <div className="flex justify-end space-x-3 pt-4">
                                    <button onClick={handleCancel} className="px-4 py-2 text-sm font-medium bg-gray-200 rounded-md hover:bg-gray-300">Cancelar</button>
                                    <button onClick={handleSave} disabled={isUploading} className={`px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        {isUploading ? 'Enviando...' : 'Salvar Alterações'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-2xl font-bold text-brand-text">{userData.name}</h3>
                                    <p className="text-brand-subtle-text">{userData.role} | {userData.team}</p>
                                </div>
                                {userData.bio && <p className="text-brand-text italic">"{userData.bio}"</p>}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                                    <div>
                                        <h4 className="text-sm font-semibold text-brand-subtle-text">E-mail</h4>
                                        <p className="text-brand-text">{userData.email}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-brand-subtle-text">Telefone</h4>
                                        <p className="text-brand-text">{userData.phone || 'Não informado'}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-brand-subtle-text">Escritório</h4>
                                        <p className="text-brand-text">{userData.officeLocation || 'Não informado'}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-brand-subtle-text">Departamento</h4>
                                        <p className="text-brand-text">
                                            {departments.find(d => d.id === (userData as any).department_id)?.name || 'Não informado'}
                                        </p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-brand-subtle-text">Data de Nascimento</h4>
                                            <p className="text-brand-text">
                                                {userData.birthDate ? new Date(userData.birthDate.substring(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : 'Não informada'}
                                            </p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-brand-subtle-text">Data de Início</h4>
                                        <p className="text-brand-text">
                                            {userData.joinDate && !isNaN(new Date(userData.joinDate).getTime())
                                                    ? new Date(userData.joinDate.substring(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR')
                                                : 'Não informada'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>
                ) : activeTab === 'security' ? (
                    <Card title="Alterar Senha">
                        <div className="space-y-4 max-w-md">
                            <div>
                                <label className="text-sm font-medium text-brand-subtle-text">Nova Senha</label>
                                    <div className="relative mt-1">
                                        <input
                                            type={showNewPassword ? 'text' : 'password'}
                                            value={passwordData.newPassword}
                                            onChange={e => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                                            placeholder="Mínimo 6 caracteres"
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 pr-10 text-sm bg-white text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                        />
                                        <button type="button" onClick={() => setShowNewPassword(p => !p)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600">
                                            {showNewPassword ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                                        </button>
                                    </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-brand-subtle-text">Confirmar Nova Senha</label>
                                    <div className="relative mt-1">
                                        <input
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            value={passwordData.confirmPassword}
                                            onChange={e => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                            placeholder="Repita a nova senha"
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 pr-10 text-sm bg-white text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                        />
                                        <button type="button" onClick={() => setShowConfirmPassword(p => !p)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600">
                                            {showConfirmPassword ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                                        </button>
                                    </div>
                                </div>

                            {passwordMessage && (
                                <div className={`p-3 rounded-md text-sm font-medium ${passwordMessage.type === 'success'
                                        ? 'bg-green-50 text-green-700 border border-green-200'
                                        : 'bg-red-50 text-red-700 border border-red-200'
                                    }`}>
                                    {passwordMessage.text}
                                </div>
                            )}
                            <button
                                onClick={handlePasswordChange}
                                disabled={passwordLoading}
                                className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 transition-colors disabled:opacity-50"
                            >
                                {passwordLoading ? 'Salvando...' : 'Alterar Senha'}
                            </button>
                        </div>
                    </Card>
                    ) : activeTab === 'ai' && isAIEnabled ? (
                        <Card title="Assistente Panda IA">
                            <div className="space-y-6 max-w-2xl bg-white dark:bg-slate-800">
                                <div className="bg-emerald-50 border border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/40 p-4 rounded-xl text-sm text-emerald-800 dark:text-emerald-300">
                                    <p><strong>Panda IA</strong> é o seu assistente virtual integrado nas atividades do dia-a-dia da empresa. Cole abaixo sua chave da API escolhida para desbloquear seus super poderes!</p>
                                </div>

                                {!isEditing ? (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <h4 className="text-sm font-semibold text-brand-subtle-text">Provedor de IA</h4>
                                                <p className="text-brand-text flex items-center gap-2 mt-1">
                                                    <span className="capitalize">{userData.ai_provider || 'Gemini (Google)'}</span>
                                                </p>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-semibold text-brand-subtle-text">Abertura do Chat</h4>
                                                <p className="text-brand-text capitalize mt-1">
                                                    {userData.ai_behavior || 'Popup Central'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="pt-2">
                                            <h4 className="text-sm font-semibold text-brand-subtle-text mb-1">Status da API Key</h4>
                                            <div className="flex items-center gap-2">
                                                {userData.ai_api_key ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Conectado (Chave Oculta)
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Nenhuma chave fornecida
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="pt-4 flex justify-end">
                                            <button onClick={() => setIsEditing(true)} className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 transition-colors">
                                                <PencilIcon className="w-4 h-4" />
                                                <span>Configurar Assistente</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-5">
                                        <div>
                                            <label className="text-sm font-medium text-brand-subtle-text">Provedor da Inteligência Artificial</label>
                                            <select
                                                name="ai_provider"
                                                value={tempUserData.ai_provider || 'gemini'}
                                                onChange={(e) => setTempUserData(prev => ({ ...prev, ai_provider: e.target.value as any }))}
                                                className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text p-2 border focus:ring-emerald-500 focus:border-emerald-500"
                                            >
                                                <option value="gemini">Google Gemini (Recomendado / Mais Rápido)</option>
                                                <option value="openai">ChatGPT (OpenAI GPT-4o)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-brand-subtle-text">Chave da API (API Key)</label>
                                            <input
                                                type="password"
                                                name="ai_api_key"
                                                value={tempUserData.ai_api_key || ''}
                                                onChange={handleInputChange}
                                                placeholder="Cole aqui sua sk-xxxx... ou AIzaSy..."
                                                className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text p-2 border focus:ring-emerald-500 focus:border-emerald-500"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Sua chave é salva com segurança no banco de dados e utilizada apenas pelo seu navegador.</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-brand-subtle-text">Abertura e Comportamento do Botão</label>
                                            <select
                                                name="ai_behavior"
                                                value={tempUserData.ai_behavior || 'popup'}
                                                onChange={(e) => setTempUserData(prev => ({ ...prev, ai_behavior: e.target.value as any }))}
                                                className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text p-2 border focus:ring-emerald-500 focus:border-emerald-500"
                                            >
                                                <option value="popup">Janela Deslizante (Popup flutuante no Centro)</option>
                                                <option value="sidebar">Painel Lateral (Abre aba na direita da tela)</option>
                                                <option value="tab">Nova Página (Vai para página inteira exclusiva da IA)</option>
                                            </select>
                                        </div>
                                        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                                            <button onClick={handleCancel} className="px-4 py-2 text-sm font-medium bg-gray-200 rounded-md hover:bg-gray-300">
                                                Cancelar
                                            </button>
                                            <button onClick={handleSave} disabled={isUploading} className={`px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 transition-colors ${isUploading ? 'opacity-50' : ''}`}>
                                                {isUploading ? 'Salvando...' : 'Salvar Preferências da IA'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                ) : activeTab === 'conquistas' ? (
                    <Card title="🏆 Selos & Conquistas" className="bg-white dark:bg-slate-800">
                        {profileBadges.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-8">
                                Nenhuma conquista registrada para este perfil ainda.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                                {profileBadges.map(ub => {
                                    const badge = ub.company_badges;
                                    if (!badge) return null;
                                    const isUrl = badge.icon.startsWith('http://') || badge.icon.startsWith('https://');
                                    return (
                                        <div 
                                            key={ub.id}
                                            onClick={() => setSelectedBadgeForComments(ub)}
                                            className="flex items-start space-x-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30 shadow-sm hover:shadow hover:bg-slate-100/30 dark:hover:bg-slate-800/50 transition-all cursor-pointer"
                                        >
                                            <div className={`w-14 h-14 rounded-2xl ${badge.color} border flex items-center justify-center text-3xl shadow-sm shrink-0 select-none transform hover:scale-105 transition-transform animate-float overflow-hidden`}>
                                                {isUrl ? (
                                                    <img src={badge.icon} className="w-full h-full object-cover rounded-2xl border border-white/10" alt={badge.name} />
                                                ) : (
                                                    badge.icon
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-slate-850 dark:text-white text-base truncate">{badge.name}</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{badge.description}</p>
                                                {ub.reason && (
                                                    <p className="text-xs text-slate-600 dark:text-slate-350 mt-2 bg-white dark:bg-slate-700/50 p-2.5 rounded-xl italic border border-slate-100 dark:border-slate-750 font-medium">
                                                        "{ub.reason}"
                                                    </p>
                                                )}
                                                <p className="text-[10px] text-slate-400 mt-2">
                                                    Conquistado em: {new Date(ub.created_at).toLocaleDateString('pt-BR')}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Card>
                ) : (
                    <div className="space-y-6">
                        {filteredPosts.length > 0 ? (
                            filteredPosts.map(post => (
                                <PostCard
                                    key={post.id}
                                    post={post}
                                    currentUser={currentUser}
                                    onToggleReaction={handleToggleReaction}
                                    onSubmitComment={handleSubmitComment}
                                    onShare={handleShare}
                                    onDelete={(postId) => console.log('Delete post', postId)}
                                />
                            ))
                        ) : (
                            <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow">
                                <p>Nenhuma atividade recente.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {selectedBadgeForComments && (
                <BadgeDetailModal 
                    userBadge={selectedBadgeForComments}
                    onClose={() => setSelectedBadgeForComments(null)}
                />
            )}
        </div>
    );
};

export default ProfilePage;