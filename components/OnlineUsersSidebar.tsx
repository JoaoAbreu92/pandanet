import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { usePresence } from './PresenceContext';
import {
    ChatBubbleLeftRightIcon,
    NoSymbolIcon,
    BellIcon,
    UserCircleIcon,
    ChevronRightIcon,
    ChevronLeftIcon,
    XMarkIcon
} from './icons';
import type { Employee } from '../types';

interface OnlineUsersSidebarProps {
    currentUser: Employee;
    onStartChat: (userId: string) => void;
    onNavigate: (page: string, context?: any) => void;
    isOpen?: boolean;
    setIsOpen?: (open: boolean) => void;
}

export const OnlineUsersSidebar: React.FC<OnlineUsersSidebarProps> = ({
    currentUser,
    onStartChat,
    onNavigate,
    isOpen: controlledIsOpen,
    setIsOpen: controlledSetIsOpen
}) => {
    const { onlineUsers } = usePresence();
    const [users, setUsers] = useState<any[]>([]);
    const [localIsOpen, setLocalIsOpen] = useState(true); // Controla visualização no desktop
    const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : localIsOpen;
    const setIsOpen = controlledSetIsOpen !== undefined ? controlledSetIsOpen : setLocalIsOpen;
    const [selectedUser, setSelectedUser] = useState<any | null>(null);
    const [mutedUsers, setMutedUsers] = useState<Set<string>>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('pixel_muted_users');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        }
        return new Set();
    });

    useEffect(() => {
        if (!currentUser?.company_id) return;

        const fetchUsers = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, full_name, email, role, avatar_url, status_text')
                    .eq('company_id', currentUser.company_id);
                
                if (data && !error) {
                    setUsers(data);
                }
            } catch (err) {
                console.error('Erro ao carregar colaboradores para presença:', err);
            }
        };

        fetchUsers();

        // Realtime subscription para alterações de status_text ou avatar
        const channel = supabase
            .channel('presence-sidebar-changes')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `company_id=eq.${currentUser.company_id}`
            }, (payload) => {
                const updated = payload.new as any;
                setUsers(prev => prev.map(u => u.id === updated.id ? { ...u, ...updated } : u));
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUser?.company_id]);

    const handleMuteToggle = (userId: string) => {
        const updated = new Set(mutedUsers);
        if (updated.has(userId)) {
            updated.delete(userId);
        } else {
            updated.add(userId);
        }
        setMutedUsers(updated);
        localStorage.setItem('pixel_muted_users', JSON.stringify(Array.from(updated)));
    };

    // Ordenar: Online primeiro, depois Offline
    const sortedUsers = [...users]
        .filter(u => u.id !== currentUser.id) // remover eu mesmo da barra lateral direita
        .sort((a, b) => {
            const aOnline = onlineUsers.has(a.id);
            const bOnline = onlineUsers.has(b.id);
            if (aOnline && !bOnline) return -1;
            if (!aOnline && bOnline) return 1;
            return (a.full_name || '').localeCompare(b.full_name || '');
        });

    return (
        <div className={`relative h-full flex transition-all duration-300 ${isOpen ? 'w-64 lg:w-72' : 'w-12'} border-l border-gray-150 dark:border-white/5 bg-white/70 dark:bg-[#020617]/40 backdrop-blur-xl shrink-0`}>
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="absolute top-1/2 -left-3.5 transform -translate-y-1/2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-full p-1 shadow-md hover:bg-slate-50 dark:hover:bg-slate-800 text-gray-500 hover:text-gray-700 dark:hover:text-white transition-all z-20 md:hidden"
                title={isOpen ? 'Recolher Barra' : 'Expandir Barra'}
            >
                {isOpen ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeftIcon className="w-4 h-4" />}
            </button>

            {isOpen ? (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                        <h3 className="font-black text-xs uppercase tracking-wider text-slate-400 dark:text-gray-500">
                            Colaboradores ({users.length - 1 || 0})
                        </h3>
                        <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {Array.from(onlineUsers).filter(id => id !== currentUser.id && users.some(u => u.id === id)).length} ONLINE
                        </span>
                    </div>

                    {/* User List */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 hover-scrollbar">
                        {sortedUsers.map(user => {
                            const isOnline = onlineUsers.has(user.id);
                            const isMuted = mutedUsers.has(user.id);

                            return (
                                <div
                                    key={user.id}
                                    className="relative"
                                >
                                    <div
                                        onClick={() => setSelectedUser(selectedUser?.id === user.id ? null : user)}
                                        className={`group flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all duration-200 border ${
                                            selectedUser?.id === user.id
                                                ? 'bg-brand-primary/10 border-brand-primary/20'
                                                : 'border-transparent hover:bg-slate-100/50 dark:hover:bg-white/5'
                                        }`}
                                    >
                                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                                            {/* Avatar with Status indicator */}
                                            <div className="relative shrink-0">
                                                {user.avatar_url ? (
                                                    <img
                                                        src={user.avatar_url}
                                                        alt={user.full_name}
                                                        className="w-9 h-9 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-gray-300">
                                                        {user.full_name ? user.full_name.substring(0, 2).toUpperCase() : 'CO'}
                                                    </div>
                                                )}
                                                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#0f172a] ${
                                                    isOnline ? 'bg-emerald-500' : 'bg-gray-400'
                                                }`} />
                                            </div>

                                            {/* Info */}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs font-bold text-slate-800 dark:text-gray-250 truncate">
                                                        {user.full_name}
                                                    </p>
                                                    {isMuted && (
                                                        <NoSymbolIcon className="w-3.5 h-3.5 text-slate-400 dark:text-gray-600 shrink-0 ml-1" />
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-slate-400 dark:text-gray-500 truncate">
                                                    {user.status_text ? (
                                                        <span className="italic text-brand-primary">"{user.status_text}"</span>
                                                    ) : (
                                                        user.role || 'Colaborador'
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Popover */}
                                    {selectedUser?.id === user.id && (
                                        <div className="absolute right-2 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-150 dark:border-white/10 rounded-2xl shadow-xl p-2.5 z-30 w-48 space-y-1 animate-in fade-in slide-in-from-top-2">
                                            <div className="flex justify-between items-center mb-1 pb-1 border-b border-gray-100 dark:border-white/5">
                                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Ações</span>
                                                <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-slate-600 dark:text-gray-500 dark:hover:text-gray-300"><XMarkIcon className="w-3.5 h-3.5" /></button>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    onStartChat(user.id);
                                                    setSelectedUser(null);
                                                }}
                                                className="w-full flex items-center space-x-2 p-2 rounded-xl text-xs font-bold text-slate-700 dark:text-gray-200 hover:bg-brand-primary hover:text-white transition-all"
                                            >
                                                <ChatBubbleLeftRightIcon className="w-4 h-4" />
                                                <span>Conversar</span>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    onNavigate('profile-page', user.id);
                                                    setSelectedUser(null);
                                                }}
                                                className="w-full flex items-center space-x-2 p-2 rounded-xl text-xs font-bold text-slate-700 dark:text-gray-200 hover:bg-brand-primary hover:text-white transition-all"
                                            >
                                                <UserCircleIcon className="w-4 h-4" />
                                                <span>Abrir Feed</span>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    handleMuteToggle(user.id);
                                                    setSelectedUser(null);
                                                }}
                                                className={`w-full flex items-center space-x-2 p-2 rounded-xl text-xs font-bold transition-all ${
                                                    isMuted
                                                        ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
                                                        : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20'
                                                }`}
                                            >
                                                {isMuted ? <BellIcon className="w-4 h-4" /> : <NoSymbolIcon className="w-4 h-4" />}
                                                <span>{isMuted ? 'Ativar Som' : 'Silenciar'}</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center pt-6 space-y-4 overflow-y-auto scrollbar-none">
                    <span className="flex h-3.5 w-3.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                    </span>

                    {/* Render minimal avatars for vertical stack */}
                    <div className="space-y-3 pb-4">
                        {sortedUsers.map(user => {
                            const isOnline = onlineUsers.has(user.id);
                            return (
                                <div
                                    key={user.id}
                                    className="relative group cursor-pointer"
                                    onClick={() => {
                                        setIsOpen(true);
                                        setSelectedUser(user);
                                    }}
                                >
                                    {user.avatar_url ? (
                                        <img
                                            src={user.avatar_url}
                                            alt={user.full_name}
                                            className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-800"
                                        />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-gray-300">
                                            {user.full_name ? user.full_name.substring(0, 2).toUpperCase() : 'CO'}
                                        </div>
                                    )}
                                    <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white dark:border-[#0f172a] ${
                                        isOnline ? 'bg-emerald-500' : 'bg-gray-400'
                                    }`} />

                                    {/* Minimal Tooltip */}
                                    <div className="absolute right-full mr-2 top-1/2 transform -translate-y-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30">
                                        {user.full_name}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
