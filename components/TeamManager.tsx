import ModalPortal from './ui/ModalPortal';
import React, { useState, useMemo } from 'react';
import Card from './Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import ConfirmModal from './ui/ConfirmModal';
import { useToast } from './ToastContext';
import type { Employee } from '../types';
import { PlusIcon, PencilIcon, TrashIcon, XCircleIcon, UsersIcon } from './icons';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

interface TeamManagerProps {
    users: Employee[];
    setUsers: (users: Employee[]) => void;
    onNavigate?: (page: string) => void;
}

interface TeamFormModalProps {
    teamName: string | null; // null for creating new
    initialMembers?: Employee[];
    allUsers: Employee[];
    onClose: () => void;
    onSave: (name: string, members: string[]) => void;
}

const TeamFormModal: React.FC<TeamFormModalProps> = ({ teamName, initialMembers = [], allUsers, onClose, onSave }) => {
    const [name, setName] = useState(teamName || '');
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(initialMembers.map(m => m.id));
    const [searchTerm, setSearchTerm] = useState('');

    const toggleMember = (id: string) => {
        setSelectedMemberIds(prev =>
            prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
        );
    };

    const filteredUsers = allUsers.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(name, selectedMemberIds);
    };

    return (
        <ModalPortal
            className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[3px] pandanet-modal-viewport"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="team-modal-title"
                className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_30px_80px_-24px_rgba(2,6,23,0.55)] animate-fade-in-up dark:border-white/10 dark:bg-[#101d2e] sm:p-6"
            >
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Fechar"
                    onClick={onClose}
                    className="absolute right-3 top-3"
                >
                    <XCircleIcon className="h-5 w-5" />
                </Button>
                <h3
                    id="team-modal-title"
                    className="mb-5 pr-12 text-xl font-bold text-slate-950 dark:text-white"
                >
                    {teamName ? 'Editar Equipe' : 'Criar Nova Equipe'}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label="Nome da equipe"
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        required
                        autoFocus
                        placeholder="Ex.: Marketing"
                    />

                    <div>
                        <Input
                            label="Membros"
                            type="search"
                            placeholder="Buscar colaboradores..."
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            wrapperClassName="mb-3"
                        />
                        <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 divide-y divide-slate-200 dark:border-white/10 dark:bg-slate-950/30 dark:divide-white/[0.08]">
                            {filteredUsers.map(user => {
                                const selected = selectedMemberIds.includes(user.id);

                                return (
                                    <label
                                        key={user.id}
                                        className={`flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-emerald-50/70 dark:hover:bg-emerald-400/[0.08] ${selected ? 'bg-emerald-50 dark:bg-emerald-400/10' : ''}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selected}
                                            onChange={() => toggleMember(user.id)}
                                            className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-4 focus:ring-emerald-500/20 dark:border-white/20 dark:bg-slate-900"
                                        />
                                        <img
                                            src={user.avatarUrl}
                                            alt=""
                                            className="h-9 w-9 rounded-full object-cover ring-2 ring-white dark:ring-white/10"
                                        />
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                                                {user.name}
                                            </span>
                                            <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                                                {user.team || 'Sem Equipe'}
                                            </span>
                                        </span>
                                    </label>
                                );
                            })}
                            {filteredUsers.length === 0 && (
                                <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                                    Nenhum colaborador encontrado.
                                </p>
                            )}
                        </div>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            {selectedMemberIds.length} membros selecionados
                        </p>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <Button type="button" variant="ghost" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit">
                            Salvar equipe
                        </Button>
                    </div>
                </form>
            </div>
        </ModalPortal>
    );
};

const TeamManager: React.FC<TeamManagerProps> = ({ users, setUsers, onNavigate }) => {
    const { currentUser } = useAuth();
    const { showToast } = useToast();
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingTeamName, setEditingTeamName] = useState<string | null>(null);
    const [teamToDelete, setTeamToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Extract unique teams
    const teams = useMemo(() => {
        const teamMap = new Map<string, Employee[]>();
        users.forEach(u => {
            if (u.team && u.team !== 'Sem Equipe') {
                if (!teamMap.has(u.team)) {
                    teamMap.set(u.team, []);
                }
                teamMap.get(u.team)!.push(u);
            }
        });
        return Array.from(teamMap.entries()).map(([name, members]) => ({ name, members }));
    }, [users]);

    const handleCreateTeam = async (name: string, memberIds: string[]) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ team: name })
                .in('id', memberIds);

            if (error) throw error;

            // Sync: create group chat conversation
            if (currentUser) {
                const compId = currentUser.company_id;
                const { data: newConv, error: createError } = await supabase
                    .from('conversations')
                    .insert({
                        company_id: compId,
                        is_group: true,
                        group_name: name,
                        last_message: 'Grupo da equipe criado',
                        last_message_at: new Date().toISOString(),
                        created_by: currentUser.id
                    })
                    .select()
                    .single();

                if (createError) throw createError;

                if (newConv && memberIds.length > 0) {
                    const participants = memberIds.map(userId => ({
                        conversation_id: newConv.id,
                        user_id: userId,
                        company_id: compId
                    }));

                    const { error: partError } = await supabase
                        .from('conversation_participants')
                        .insert(participants);

                    if (partError) throw partError;
                }
            }

            // Update selected users to have the new team name
            const updatedUsers = users.map(u => {
                if (memberIds.includes(u.id)) {
                    return { ...u, team: name };
                }
                return u;
            });
            setUsers(updatedUsers);
            setModalOpen(false);
            showToast('Equipe criada com sucesso.', 'success');
        } catch (err: any) {
            console.error('Error creating team:', err);
            showToast(
                `Erro ao criar equipe: ${err?.message || 'Erro desconhecido'}`,
                'error'
            );
        }
    };

    const handleEditTeam = async (newName: string, memberIds: string[]) => {
        const currentTeamName = editingTeamName;
        if (!currentTeamName) return;

        try {
            // 1. Remove users who were in this team but are NOT in the new list
            const membersToRemove = users
                .filter(u => u.team === currentTeamName && !memberIds.includes(u.id))
                .map(u => u.id);

            if (membersToRemove.length > 0) {
                const { error: removeError } = await supabase
                    .from('profiles')
                    .update({ team: 'Sem Equipe' })
                    .in('id', membersToRemove);
                if (removeError) throw removeError;
            }

            // 2. Update users who ARE in the new list to this team
            if (memberIds.length > 0) {
                const { error: addError } = await supabase
                    .from('profiles')
                    .update({ team: newName })
                    .in('id', memberIds);
                if (addError) throw addError;
            }

            // 3. Sync: update group chat conversation name and participants
            if (currentUser) {
                const compId = currentUser.company_id;
                
                // Find existing team conversation
                const { data: existingConv } = await supabase
                    .from('conversations')
                    .select('id')
                    .eq('is_group', true)
                    .eq('group_name', currentTeamName)
                    .eq('company_id', compId)
                    .maybeSingle();

                if (existingConv) {
                    // Update group name if renamed
                    if (newName !== currentTeamName) {
                        const { error: updateError } = await supabase
                            .from('conversations')
                            .update({ group_name: newName })
                            .eq('id', existingConv.id);
                        if (updateError) throw updateError;
                    }

                    // Delete old participants
                    const { error: deletePartsError } = await supabase
                        .from('conversation_participants')
                        .delete()
                        .eq('conversation_id', existingConv.id);
                    if (deletePartsError) throw deletePartsError;

                    // Insert new participants
                    if (memberIds.length > 0) {
                        const participants = memberIds.map(userId => ({
                            conversation_id: existingConv.id,
                            user_id: userId,
                            company_id: compId
                        }));
                        const { error: partError } = await supabase
                            .from('conversation_participants')
                            .insert(participants);
                        if (partError) throw partError;
                    }
                } else {
                    // If not found, create new group
                    const { data: newConv, error: createError } = await supabase
                        .from('conversations')
                        .insert({
                            company_id: compId,
                            is_group: true,
                            group_name: newName,
                            last_message: 'Grupo da equipe criado',
                            last_message_at: new Date().toISOString(),
                            created_by: currentUser.id
                        })
                        .select()
                        .single();

                    if (createError) throw createError;

                    if (newConv && memberIds.length > 0) {
                        const participants = memberIds.map(userId => ({
                            conversation_id: newConv.id,
                            user_id: userId,
                            company_id: compId
                        }));
                        const { error: partError } = await supabase
                            .from('conversation_participants')
                            .insert(participants);
                        if (partError) throw partError;
                    }
                }
            }

            const updatedUsers = users.map(u => {
                // Check if user is in the new member list
                const isSelected = memberIds.includes(u.id);
                // If user was in this team (by name)
                const wasInTeam = u.team === currentTeamName;

                if (isSelected) {
                    return { ...u, team: newName };
                } else if (wasInTeam) {
                    return { ...u, team: 'Sem Equipe' };
                }
                return u;
            });

            setUsers(updatedUsers);
            setModalOpen(false);
            setEditingTeamName(null);
            showToast('Equipe atualizada com sucesso.', 'success');
        } catch (err: any) {
            console.error('Error editing team:', err);
            showToast(
                `Erro ao editar equipe: ${err?.message || 'Erro desconhecido'}`,
                'error'
            );
        }
    };

    const openEditModal = (teamName: string) => {
        setEditingTeamName(teamName);
        setModalOpen(true);
    };

    const handleDeleteTeam = async (teamName: string) => {
        if (isDeleting) return;
        setIsDeleting(true);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ team: 'Sem Equipe' })
                .eq('team', teamName);

            if (error) throw error;

            // Mantém a sincronização existente com a conversa da equipe.
            if (currentUser) {
                const compId = currentUser.company_id;
                const { data: existingConv } = await supabase
                    .from('conversations')
                    .select('id')
                    .eq('is_group', true)
                    .eq('group_name', teamName)
                    .eq('company_id', compId)
                    .maybeSingle();

                if (existingConv) {
                    const { error: deleteError } = await supabase
                        .from('conversations')
                        .delete()
                        .eq('id', existingConv.id);

                    if (deleteError) throw deleteError;
                }
            }

            const updatedUsers = users.map(user =>
                user.team === teamName
                    ? { ...user, team: 'Sem Equipe' }
                    : user
            );

            setUsers(updatedUsers);
            showToast('Equipe dissolvida com sucesso.', 'success');
        } catch (err: any) {
            console.error('Error deleting team:', err);
            showToast(
                `Erro ao excluir equipe: ${err?.message || 'Erro desconhecido'}`,
                'error'
            );
        } finally {
            setIsDeleting(false);
            setTeamToDelete(null);
        }
    };

    return (
        <>
            <Card title="Gerenciar Equipes" headerAction={
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        size="sm"
                        leftIcon={<PlusIcon className="h-4 w-4" />}
                        onClick={() => {
                            setEditingTeamName(null);
                            setModalOpen(true);
                        }}
                    >
                        Criar equipe
                    </Button>
                    {onNavigate && (
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            leftIcon={<UsersIcon className="h-4 w-4" />}
                            onClick={() => onNavigate('org-chart')}
                        >
                            Ver organograma
                        </Button>
                    )}
                </div>
            }>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teams.map(({ name, members }) => (
                        <article
                            key={name}
                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-emerald-400/30"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h4 className="text-lg font-bold text-slate-950 dark:text-white">{name}</h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {members.length} {members.length === 1 ? 'membro' : 'membros'}
                                    </p>
                                </div>
                                <div className="flex space-x-1">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Editar equipe ${name}`}
                                        title="Editar equipe"
                                        onClick={() => openEditModal(name)}
                                        className="h-8 w-8"
                                    >
                                        <PencilIcon className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Dissolver equipe ${name}`}
                                        title="Dissolver equipe"
                                        onClick={() => setTeamToDelete(name)}
                                        className="h-8 w-8 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="flex -space-x-2 overflow-hidden mb-3">
                                {members.slice(0, 5).map(m => (
                                    <img
                                        key={m.id}
                                        src={m.avatarUrl}
                                        alt={m.name}
                                        className="inline-block h-8 w-8 rounded-full ring-2 ring-white"
                                        title={m.name}
                                    />
                                ))}
                                {members.length > 5 && (
                                    <div className="flex items-center justify-center h-8 w-8 rounded-full ring-2 ring-white bg-gray-100 text-xs font-medium text-gray-600">
                                        +{members.length - 5}
                                    </div>
                                )}
                            </div>
                        </article>
                    ))}
                    {teams.length === 0 && (
                        <div className="col-span-full rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
                            Nenhuma equipe encontrada. Crie uma para começar.
                        </div>
                    )}
                </div>
            </Card>

            <ConfirmModal
                isOpen={teamToDelete !== null}
                type="danger"
                title="Dissolver equipe?"
                message={teamToDelete
                    ? `Os membros da equipe "${teamToDelete}" ficarão sem equipe e a conversa vinculada será removida.`
                    : ''}
                confirmText={isDeleting ? 'Dissolvendo...' : 'Dissolver equipe'}
                cancelText="Cancelar"
                onCancel={() => {
                    if (!isDeleting) setTeamToDelete(null);
                }}
                onConfirm={() => {
                    if (teamToDelete) {
                        void handleDeleteTeam(teamToDelete);
                    }
                }}
            />

            {isModalOpen && (
                <TeamFormModal
                    teamName={editingTeamName}
                    initialMembers={editingTeamName ? users.filter(u => u.team === editingTeamName) : []}
                    allUsers={users}
                    onClose={() => { setModalOpen(false); setEditingTeamName(null); }}
                    onSave={editingTeamName ? handleEditTeam : handleCreateTeam}
                />
            )}
        </>
    );
};

export default TeamManager;
