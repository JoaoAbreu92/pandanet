import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { usePresence } from './PresenceContext';
import { UserAvatar } from './UserAvatar';
import {
    ChatBubbleLeftRightIcon,
    NoSymbolIcon,
    BellIcon,
    UserCircleIcon,
    ChevronRightIcon,
    ChevronLeftIcon,
    XMarkIcon,
    SearchIcon
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
    const [userSearch, setUserSearch] = useState('');
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
                    .select('id, full_name, email, role, avatar_url, status_text, level')
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
    const onlineCount = sortedUsers.filter(user => onlineUsers.has(user.id)).length;
    const normalizedUserSearch = userSearch.trim().toLocaleLowerCase('pt-BR');
    const visibleUsers = normalizedUserSearch
        ? sortedUsers.filter(user =>
            [user.full_name, user.email, user.role, user.status_text]
                .some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(normalizedUserSearch))
        )
        : sortedUsers;

    return (
        <div className={`relative h-full flex transition-[width] duration-300 ${isOpen ? 'w-64 lg:w-72 border-l' : 'w-0'} border-gray-150 dark:border-white/5 bg-white/70 dark:bg-[#020617]/40 backdrop-blur-xl shrink-0`}>
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="absolute top-1/2 -left-8 transform -translate-y-1/2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-l-xl p-2 shadow-md hover:bg-slate-50 dark:hover:bg-slate-800 text-gray-500 hover:text-gray-700 dark:hover:text-white transition-all z-50"
                aria-label={`${isOpen ? 'Recolher' : 'Abrir'} colaboradores. ${onlineCount} online`}
                title={isOpen ? 'Recolher Barra' : 'Expandir Barra'}
            >
                {isOpen ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeftIcon className="w-4 h-4" />}
                <span className="absolute -left-2 -top-2 flex min-w-5 h-5 items-center justify-center rounded-full border-2 border-white dark:border-slate-900 bg-emerald-500 px-1 text-[10px] font-black leading-none text-white shadow-md">
                    {onlineCount}
                </span>
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

                    <div className="border-b border-gray-100 p-2 dark:border-white/5">
                        <label className="relative block">
                            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input type="search" value={userSearch} onChange={event => setUserSearch(event.target.value)} placeholder="Buscar colaborador..." className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15 dark:border-white/10 dark:bg-slate-900 dark:text-white" />
                        </label>
                    </div>

                    {/* User List */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 hover-scrollbar">
                        {visibleUsers.map(user => {
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
                                                <UserAvatar
                                                    src={user.avatar_url}
                                                    name={user.full_name}
                                                    level={user.level}
                                                    size="sm"
                                                />
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
                        {visibleUsers.length === 0 && <p className="px-3 py-6 text-center text-xs text-slate-400">Nenhum colaborador encontrado.</p>}
                    </div>
                </div>
            ) : null}
        </div>
    );
};
