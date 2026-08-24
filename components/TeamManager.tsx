import React, { useState, useMemo } from 'react';
import Card from './Card';
import type { Employee } from '../types';
import { PlusIcon, PencilIcon, TrashIcon, XCircleIcon, UsersIcon } from './icons';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

interface TeamManagerProps {
    users: Employee[];
    setUsers: (users: Employee[]) => void;
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <XCircleIcon className="w-6 h-6" />
                </button>
                <h3 className="text-xl font-bold text-brand-text mb-4">
                    {teamName ? 'Editar Equipe' : 'Criar Nova Equipe'}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Nome da Equipe</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                            className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text p-2 border"
                            placeholder="Ex: Marketing"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text mb-2">Membros</label>
                        <input
                            type="text"
                            placeholder="Buscar colaboradores..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full mb-2 p-2 text-sm border border-gray-300 rounded-md"
                        />
                        <div className="border border-gray-200 rounded-md max-h-60 overflow-y-auto divide-y">
                            {filteredUsers.map(user => (
                                <div
                                    key={user.id}
                                    onClick={() => toggleMember(user.id)}
                                    className={`p-2 flex items-center space-x-3 cursor-pointer hover:bg-gray-50 ${selectedMemberIds.includes(user.id) ? 'bg-blue-50' : ''}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedMemberIds.includes(user.id)}
                                        readOnly
                                        className="rounded text-brand-primary"
                                    />
                                    <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{user.name}</p>
                                        <p className="text-xs text-gray-500">{user.team || 'Sem Equipe'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            {selectedMemberIds.length} membros selecionados
                        </p>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">
                            Cancelar
                        </button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600">
                            Salvar Equipe
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const TeamManager: React.FC<TeamManagerProps> = ({ users, setUsers }) => {
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingTeamName, setEditingTeamName] = useState<string | null>(null);

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

            // Update selected users to have the new team name
            const updatedUsers = users.map(u => {
                if (memberIds.includes(u.id)) {
                    return { ...u, team: name };
                }
                return u;
            });
            setUsers(updatedUsers);
            setModalOpen(false);
        } catch (err) {
            console.error('Error creating team:', err);
            alert('Erro ao criar equipe.');
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
        } catch (err) {
            console.error('Error editing team:', err);
            alert('Erro ao editar equipe.');
        }
    };

    const openEditModal = (teamName: string) => {
        setEditingTeamName(teamName);
        setModalOpen(true);
    };

    const handleDeleteTeam = async (teamName: string) => {
        if (window.confirm(`Tem certeza que deseja dissolver a equipe "${teamName}"? Os membros ficarão "Sem Equipe".`)) {
            try {
                const { error } = await supabase
                    .from('profiles')
                    .update({ team: 'Sem Equipe' })
                    .eq('team', teamName);

                if (error) throw error;

                const updatedUsers = users.map(u =>
                    u.team === teamName ? { ...u, team: 'Sem Equipe' } : u
                );
                setUsers(updatedUsers);
            } catch (err) {
                console.error('Error deleting team:', err);
                alert('Erro ao excluir equipe.');
            }
        }
    };

    return (
        <>
            <Card title="Gerenciar Equipes" headerAction={
                <button
                    onClick={() => { setEditingTeamName(null); setModalOpen(true); }}
                    className="flex items-center space-x-2 px-3 py-2 text-sm bg-brand-primary text-white rounded-md hover:bg-emerald-600"
                >
                    <PlusIcon className="w-4 h-4" />
                    <span>Criar Equipe</span>
                </button>
            }>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teams.map(({ name, members }) => (
                        <div key={name} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h4 className="font-bold text-lg text-brand-text">{name}</h4>
                                    <p className="text-sm text-gray-500">{members.length} membros</p>
                                </div>
                                <div className="flex space-x-1">
                                    <button
                                        onClick={() => openEditModal(name)}
                                        className="p-1 text-gray-400 hover:text-brand-primary"
                                        title="Editar Membros/Nome"
                                    >
                                        <PencilIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteTeam(name)}
                                        className="p-1 text-gray-400 hover:text-red-500"
                                        title="Dissolver Equipe"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
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
                        </div>
                    ))}
                    {teams.length === 0 && (
                        <div className="col-span-full text-center py-8 text-gray-500">
                            Nenhuma equipe encontrada. Crie uma para começar!
                        </div>
                    )}
                </div>
            </Card>

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
