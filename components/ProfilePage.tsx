import React, { useState, useRef, useEffect, useMemo } from 'react';
import Card from './Card';
import { PencilIcon } from './icons';
import type { Employee, Post } from '../types';
import { PostCard } from './FeedPage';
import { supabase } from '../supabaseClient';

interface ProfilePageProps {
    userId?: string;
    currentUser: Employee;
    onUpdateUser: (user: Employee) => void;
    feedPosts?: Post[];
    setFeedPosts?: (posts: Post[]) => void;
    allEmployees?: Employee[];
}

const ProfilePage: React.FC<ProfilePageProps> = ({ userId, currentUser, onUpdateUser, feedPosts = [], setFeedPosts, allEmployees = [] }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [targetUser, setTargetUser] = useState<Employee | null>(null);
    const [tempUserData, setTempUserData] = useState<Employee>(currentUser);
    const [activeTab, setActiveTab] = useState<'info' | 'activity'>(userId && userId !== currentUser.id ? 'activity' : 'info');
    const [loading, setLoading] = useState(false);

    const isOwnProfile = !userId || userId === currentUser.id;

    useEffect(() => {
        if (isOwnProfile) {
            setTargetUser(currentUser);
            setTempUserData(currentUser);
            setActiveTab('info');
        } else {
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
                            avatarUrl: data.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.full_name)}&background=random`,
                            coverUrl: data.cover_url,
                            bio: data.bio,
                            phone: data.phone,
                            officeLocation: data.office_location,
                            joinDate: data.join_date,
                            birthDate: data.birth_date,
                            isAdmin: data.is_admin,
                            company_id: data.company_id,
                            following: data.following || [],
                            permissions: data.permissions || {}
                        };
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
    }, [userId, currentUser]);

    const avatarInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    const handleSave = async () => {
        try {
            const updates: any = {
                ...tempUserData,
                id: currentUser.id,
                updated_at: new Date(),
            };

            // Needs to map tempUserData fields to DB columns if names differ?
            // "role", "team" are in DB. "name" -> "full_name". 
            // "bio", "phone", "officeLocation" -> "office_location"

            const dbUpdates: any = {
                id: currentUser.id,
                full_name: tempUserData.name,
                role: tempUserData.role,
                team: tempUserData.team,
                bio: tempUserData.bio,
                phone: tempUserData.phone,
                office_location: tempUserData.officeLocation,
                avatar_url: tempUserData.avatarUrl,
                cover_url: tempUserData.coverUrl,
                birth_date: tempUserData.birthDate,
                updated_at: new Date()
            };

            // Se o usuário já tiver um company_id no estado, mantemos ele no upsert
            if (currentUser.company_id) {
                dbUpdates.company_id = currentUser.company_id;
            }

            const { error } = await supabase
                .from('profiles')
                .upsert(dbUpdates, { onConflict: 'id' });

            if (error) throw error;

            onUpdateUser(tempUserData);
            setIsEditing(false);
            alert('Perfil atualizado com sucesso!');
        } catch (error: any) {
            console.error("Error updating profile:", error);
            alert('Erro ao atualizar perfil.');
        }
    };

    const handleCancel = () => {
        setTempUserData(currentUser);
        setIsEditing(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setTempUserData(prev => ({ ...prev, [name]: value }));
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

    const effectiveUser = targetUser || currentUser;

    const filteredPosts = useMemo(() => {
        const userIdToFilter = effectiveUser.id;
        return feedPosts.filter(post =>
            post.authorId === userIdToFilter || // Posts do usuário do perfil
            post.mentions.includes(userIdToFilter) // Menções ao usuário do perfil
        ).sort((a, b) => b.id - a.id);
    }, [feedPosts, effectiveUser]);

    // Feed manipulation handlers (copied logic, ideally should be shared context or hook)
    const handleToggleReaction = (postId: number, emoji: string) => {
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

    const handleSubmitComment = (postId: number, text: string) => { // Removed postId type annotation as it's inferred or matches signature
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
            <h2 className="text-2xl font-bold text-brand-text">{isOwnProfile ? 'Meu Perfil' : `Perfil de ${userData.name}`}</h2>

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

            <div className="pt-16">
                {/* Tabs */}
                <div className="border-b border-gray-200 mb-6">
                    <nav className="-mb-px flex space-x-8">
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
                            <div className="space-y-4">
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
                                    <h3 className="text-2xl font-bold text-brand-text">{currentUser.name}</h3>
                                    <p className="text-brand-subtle-text">{currentUser.role} | {currentUser.team}</p>
                                </div>
                                {currentUser.bio && <p className="text-brand-text italic">"{currentUser.bio}"</p>}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                                    <div>
                                        <h4 className="text-sm font-semibold text-brand-subtle-text">E-mail</h4>
                                        <p className="text-brand-text">{currentUser.email}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-brand-subtle-text">Telefone</h4>
                                        <p className="text-brand-text">{currentUser.phone || 'Não informado'}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-brand-subtle-text">Escritório</h4>
                                        <p className="text-brand-text">{currentUser.officeLocation || 'Não informado'}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-brand-subtle-text">Data de Início</h4>
                                        <p className="text-brand-text">{new Date(currentUser.joinDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                                    </div>
                                </div>
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
        </div>
    );
};

export default ProfilePage;