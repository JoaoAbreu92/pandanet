import React, { useState, useEffect } from 'react';
import Card from './Card';
import { PlusIcon, XCircleIcon, TrashIcon, CheckCircleIcon, ArchiveBoxIcon, PaperAirplaneIcon } from './icons';
import type { TIRequest, TIRequestStatus, TIRequestType, Employee } from '../types';
import { supabase } from '../supabaseClient';
import { useNotifications } from './NotificationContext';

interface TIRequestsPageProps {
    submissions: TIRequest[];
    setSubmissions: (submissions: TIRequest[]) => void;
    currentUser: Employee;
}

const RequestModal: React.FC<{
    onClose: () => void;
    selectableUsers: Array<{ id: string; full_name: string }>;
    onSubmit: (data: Omit<TIRequest, 'id' | 'requesterId' | 'requesterName' | 'requesterAvatarUrl' | 'status' | 'submittedAt'>) => void;
}> = ({ onClose, selectableUsers, onSubmit }) => {
    const [requestType, setRequestType] = useState<TIRequestType>('Hardware');
    const [itemName, setItemName] = useState('');
    const [justification, setJustification] = useState('');
    const [assignedUserId, setAssignedUserId] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!itemName.trim() || !justification.trim() || !assignedUserId) {
            alert('Por favor, preencha todos os campos, incluindo o usuário responsável.');
            return;
        }
        setLoading(true);
        await onSubmit({ requestType, itemName, justification, assignedUserId });
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><XCircleIcon className="w-6 h-6" /></button>
                <h3 className="text-xl font-bold text-brand-text mb-4">Solicitar Equipamento ou Software</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Tipo de Solicitação</label>
                        <select value={requestType} onChange={e => setRequestType(e.target.value as TIRequestType)} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text">
                            <option value="Hardware">Hardware</option>
                            <option value="Software">Software</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Nome do Item</label>
                        <input type="text" value={itemName} onChange={e => setItemName(e.target.value)} required placeholder={requestType === 'Hardware' ? 'Ex: Mouse ergonômico' : 'Ex: Licença do Photoshop'} className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Justificativa</label>
                        <textarea value={justification} onChange={e => setJustification(e.target.value)} rows={4} required placeholder="Descreva por que você precisa deste item para o seu trabalho." className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"></textarea>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Usuário Responsável (TI / Admins)</label>
                        <select
                            value={assignedUserId}
                            onChange={e => setAssignedUserId(e.target.value)}
                            required
                            className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"
                        >
                            <option value="">Selecione um usuário</option>
                            {selectableUsers.map(user => (
                                <option key={user.id} value={user.id}>{user.full_name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Cancelar</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 disabled:opacity-50">
                            {loading ? 'Enviando...' : 'Enviar Solicitação'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const TIRequestsPage: React.FC<TIRequestsPageProps> = ({ submissions, setSubmissions, currentUser }) => {
    const [isModalOpen, setModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'active' | 'finalized'>('active');
    const [selectedRequest, setSelectedRequest] = useState<TIRequest | null>(null);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectableUsers, setSelectableUsers] = useState<Array<{ id: string; full_name: string }>>([]);
    const { addNotification } = useNotifications();

    const fetchRequests = async () => {
        if (!currentUser?.company_id) return;
        try {
            const { data, error } = await supabase
                .from('ti_requests')
                .select(`
                    *,
                    requester:requester_id(full_name, avatar_url),
                    assigned:assigned_user_id(full_name, avatar_url)
                `)
                .eq('company_id', currentUser.company_id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                const formatted: TIRequest[] = data.map((d: any) => ({
                    id: d.id,
                    requesterId: d.requester_id,
                    requesterName: d.requester?.full_name || 'Desconhecido',
                    requesterAvatarUrl: d.requester?.avatar_url,
                    requestType: d.request_type as TIRequestType,
                    itemName: d.item_name,
                    justification: d.justification,
                    assignedUserId: d.assigned_user_id,
                    assignedUserName: d.assigned?.full_name || 'Não atribuído',
                    assignedUserAvatarUrl: d.assigned?.avatar_url,
                    comments: d.comments || [],
                    status: d.status as TIRequestStatus,
                    submittedAt: d.created_at
                }));
                setSubmissions(formatted);
            }
        } catch (err) {
            console.error('Error fetching TI requests:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSelectableUsers = async () => {
        if (!currentUser?.company_id) return;
        try {
            // Primeiro, pegamos o ID do departamento de TI da empresa
            const { data: deptData } = await supabase
                .from('departments')
                .select('id')
                .eq('company_id', currentUser.company_id)
                .ilike('name', 'TI')
                .single();

            const tiDeptId = deptData?.id;

            // Agora buscamos usuários que são admins OU do departamento de TI
            let query = supabase
                .from('profiles')
                .select('id, full_name')
                .eq('company_id', currentUser.company_id);

            const filter = [`is_admin.eq.true`, `is_company_admin.eq.true`];
            if (tiDeptId) {
                filter.push(`department_id.eq.${tiDeptId}`);
            }

            const { data, error } = await query.or(filter.join(','));

            if (error) throw error;
            if (data) setSelectableUsers(data);
        } catch (err) {
            console.error('Error fetching selectable users:', err);
        }
    };

    useEffect(() => {
        fetchRequests();
        fetchSelectableUsers();

        if (!currentUser?.company_id) return;

        console.log('[TIRequestsPage] Subscribing to ti_requests realtime changes...');
        const channel = supabase
            .channel(`public:ti_requests:${currentUser.company_id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'ti_requests',
                filter: `company_id=eq.${currentUser.company_id}`
            }, (payload) => {
                console.log('[TIRequestsPage] Realtime change detected (postgres):', payload);
                fetchRequests();
                if (selectedRequest && payload.new && (payload.new as any).id === selectedRequest.id) {
                    const updatedData = payload.new as any;
                    setSelectedRequest(prev => prev ? {
                        ...prev,
                        status: updatedData.status as TIRequestStatus,
                        comments: updatedData.comments || []
                    } : null);
                }
            })
            .on('broadcast', { event: 'comment_update' }, (payload) => {
                console.log('[TIRequestsPage] Realtime change detected (broadcast):', payload);
                const { requestId } = payload.payload;
                fetchRequests();
                if (selectedRequest && requestId === selectedRequest.id) {
                    // Force refresh comments if this is the open request
                    fetchRequests().then(() => {
                        // The fetchRequests updates the submissions list, we need to update selectedRequest too
                        supabase.from('ti_requests').select('*, requester:requester_id(full_name, avatar_url), assigned:assigned_user_id(full_name, avatar_url)').eq('id', requestId).single().then(({ data }) => {
                            if (data) {
                                setSelectedRequest({
                                    id: data.id,
                                    requesterId: data.requester_id,
                                    requesterName: data.requester?.full_name || 'Desconhecido',
                                    requesterAvatarUrl: data.requester?.avatar_url,
                                    requestType: data.request_type as TIRequestType,
                                    itemName: data.item_name,
                                    justification: data.justification,
                                    assignedUserId: data.assigned_user_id,
                                    assignedUserName: data.assigned?.full_name || 'Não atribuído',
                                    assignedUserAvatarUrl: data.assigned?.avatar_url,
                                    comments: data.comments || [],
                                    status: data.status as TIRequestStatus,
                                    submittedAt: data.created_at
                                });
                            }
                        });
                    });
                }
            })
            .subscribe();

        return () => {
            console.log('[TIRequestsPage] Unsubscribing from ti_requests realtime');
            supabase.removeChannel(channel);
        };
    }, [currentUser?.id, currentUser?.company_id, selectedRequest?.id]);

    const handleNewRequest = async (data: Omit<TIRequest, 'id' | 'requesterId' | 'requesterName' | 'requesterAvatarUrl' | 'status' | 'submittedAt'>) => {
        try {
            const { error } = await supabase
                .from('ti_requests')
                .insert([{
                    company_id: currentUser.company_id,
                    requester_id: currentUser.id,
                    request_type: data.requestType,
                    item_name: data.itemName,
                    justification: data.justification,
                    assigned_user_id: data.assignedUserId,
                    status: 'Pendente',
                    comments: []
                }]);

            if (error) throw error;

            // Send notification to the assigned user
            if (data.assignedUserId) {
                const assignedUser = selectableUsers.find(u => u.id === data.assignedUserId);
                await addNotification({
                    type: 'system',
                    title: 'Nova Solicitação de TI Atribuída',
                    description: `${currentUser.name} atribuiu a você uma solicitação: ${data.itemName}`,
                    user_id: data.assignedUserId,
                    avatarUrl: currentUser.avatarUrl,
                    link: '/ti-requests'
                });
            }

            fetchRequests();
            setModalOpen(false);
        } catch (error) {
            console.error('Error creating TI request:', error);
            alert('Erro ao enviar solicitação.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta solicitação?')) return;
        try {
            const { error } = await supabase
                .from('ti_requests')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchRequests();
        } catch (error) {
            console.error('Error deleting TI request:', error);
            alert('Erro ao excluir solicitação.');
        }
    };

    const handleUpdateStatus = async (id: string, newStatus: TIRequestStatus) => {
        try {
            const { error } = await supabase
                .from('ti_requests')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;

            // Broadcast the update
            const channel = supabase.channel(`public:ti_requests:${currentUser.company_id}`);
            channel.send({
                type: 'broadcast',
                event: 'comment_update',
                payload: { requestId: id, status: newStatus }
            });

            fetchRequests();
        } catch (error) {
            console.error('Error updating TI request status:', error);
            alert('Erro ao atualizar status.');
        }
    };

    const getStatusColor = (status: TIRequestStatus) => {
        switch (status) {
            case 'Pendente': return 'bg-yellow-100 text-yellow-800';
            case 'Em Análise': return 'bg-blue-100 text-blue-800';
            case 'Aprovado': return 'bg-teal-100 text-teal-800';
            case 'Pedido Realizado': return 'bg-indigo-100 text-indigo-800';
            case 'Entregue': return 'bg-green-100 text-green-800';
            case 'Rejeitado': return 'bg-red-100 text-red-800';
            case 'Finalizado': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const isTIUser = currentUser.department_name?.toUpperCase().includes('TI') || currentUser.team?.toUpperCase().includes('TI');
    const isAdmin = currentUser.isAdmin || currentUser.isCompanyAdmin;

    const filteredSubmissions = submissions.filter(sub => {
        const belongsToUser = sub.requesterId === currentUser.id;
        const isAssignedToUser = sub.assignedUserId === currentUser.id;
        const isVisible = isTIUser || isAdmin || belongsToUser || isAssignedToUser;
        if (!isVisible) return false;

        if (activeTab === 'active') {
            return sub.status !== 'Finalizado';
        } else {
            return sub.status === 'Finalizado';
        }
    });

    return (
        <>
            <div className="space-y-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-brand-text">Solicitações de T.I.</h1>
                        <p className="mt-1 text-brand-subtle-text">Gerencie suas solicitações de hardware e software.</p>
                    </div>
                    <button onClick={() => setModalOpen(true)} className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600">
                        <PlusIcon className="w-4 h-4" />
                        <span>Nova Solicitação</span>
                    </button>
                </div>


                <div className="flex bg-gray-100 p-1 rounded-lg w-fit">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'active' ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Solicitações Ativas
                    </button>
                    <button
                        onClick={() => setActiveTab('finalized')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'finalized' ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Finalizadas
                    </button>
                </div>

                <Card title={activeTab === 'active' ? (isTIUser ? "Solicitações da Empresa" : "Minhas Solicitações") : "Solicitações Finalizadas"}>
                    <div className="overflow-x-auto">
                        {loading ? (
                            <p className="text-center text-brand-subtle-text py-8">Carregando solicitações...</p>
                        ) : (
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                        <tr>
                                            {isTIUser && <th scope="col" className="px-6 py-3">Solicitante</th>}
                                            <th scope="col" className="px-6 py-3">Item</th>
                                            <th scope="col" className="px-6 py-3">Usuário</th>
                                            <th scope="col" className="px-6 py-3">Tipo</th>
                                            <th scope="col" className="px-6 py-3">Data de Envio</th>
                                            <th scope="col" className="px-6 py-3">Status</th>
                                            {isTIUser && <th scope="col" className="px-6 py-3 text-right">Ações</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSubmissions.map(sub => (
                                            <tr key={sub.id} className="bg-white border-b hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedRequest(sub)}>
                                                {isTIUser && (
                                                    <td className="px-6 py-4 font-medium text-gray-900">
                                                        <div className="flex items-center space-x-2">
                                                            {sub.comments && sub.comments.length > 0 && (
                                                                <span className="w-2 h-2 bg-brand-primary rounded-full" title="Possui mensagens"></span>
                                                            )}
                                                            <span>{sub.requesterName}</span>
                                                        </div>
                                                    </td>
                                                )}
                                                <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{sub.itemName}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center space-x-2">
                                                        {sub.assignedUserAvatarUrl ? (
                                                            <img src={sub.assignedUserAvatarUrl} alt="" className="w-6 h-6 rounded-full" />
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-500">?</div>
                                                        )}
                                                        <span>{sub.assignedUserName}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">{sub.requestType}</td>
                                                <td className="px-6 py-4">{new Date(sub.submittedAt).toLocaleDateString('pt-BR')}</td>
                                            <td className="px-6 py-4">
                                                    {isTIUser && activeTab === 'active' ? (
                                                        <select
                                                            value={sub.status}
                                                            onChange={(e) => handleUpdateStatus(sub.id, e.target.value as TIRequestStatus)}
                                                            className={`px-2 py-1 rounded-full text-xs font-medium border-none focus:ring-0 ${getStatusColor(sub.status)}`}
                                                        >
                                                            <option value="Pendente">Pendente</option>
                                                            <option value="Em Análise">Em Análise</option>
                                                            <option value="Aprovado">Aprovado</option>
                                                            <option value="Pedido Realizado">Pedido Realizado</option>
                                                            <option value="Entregue">Entregue</option>
                                                            <option value="Rejeitado">Rejeitado</option>
                                                        </select>
                                                    ) : (
                                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(sub.status)}`}>{sub.status}</span>
                                                    )}
                                                </td>
                                                {isTIUser && (
                                                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex justify-end space-x-2">
                                                            {activeTab === 'active' && sub.status !== 'Finalizado' && (
                                                                <button
                                                                    onClick={() => handleUpdateStatus(sub.id, 'Finalizado')}
                                                                    className="text-emerald-600 hover:text-emerald-900 p-1"
                                                                    title="Finalizar"
                                                                >
                                                                    <CheckCircleIcon className="w-5 h-5" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleDelete(sub.id)}
                                                                className="text-red-600 hover:text-red-900 p-1"
                                                                title="Excluir"
                                                            >
                                                                <TrashIcon className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        {!loading && filteredSubmissions.length === 0 && <p className="text-center text-brand-subtle-text py-4">Nenhuma solicitação encontrada.</p>}
                    </div>
                </Card>
            </div>
            {isModalOpen && <RequestModal onClose={() => setModalOpen(false)} selectableUsers={selectableUsers} onSubmit={handleNewRequest} />}

            {selectedRequest && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl relative animate-fade-in-up max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-brand-text">Detalhes da Solicitação</h3>
                            <button onClick={() => setSelectedRequest(null)} className="text-gray-400 hover:text-gray-600">
                                <XCircleIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4 text-sm text-brand-text">
                                <div>
                                    <p className="text-gray-500">Solicitante</p>
                                    <p className="font-medium">{selectedRequest.requesterName}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">Responsável</p>
                                    <p className="font-medium">{selectedRequest.assignedUserName}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">Tipo</p>
                                    <p className="font-medium">{selectedRequest.requestType}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">Status</p>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedRequest.status)}`}>{selectedRequest.status}</span>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-semibold text-brand-text mb-2">Item</h4>
                                <p className="text-brand-subtle-text">{selectedRequest.itemName}</p>
                            </div>

                            <div>
                                <h4 className="font-semibold text-brand-text mb-2">Justificativa</h4>
                                <p className="text-brand-subtle-text">{selectedRequest.justification}</p>
                            </div>

                            {(isAdmin || isTIUser || selectedRequest.assignedUserId === currentUser.id) && selectedRequest.status !== 'Finalizado' && (
                                <div className="flex space-x-3 pt-2">
                                    <button
                                        onClick={() => { handleUpdateStatus(selectedRequest.id, 'Aprovado'); setSelectedRequest(null); }}
                                        className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-md hover:bg-emerald-700 transition-colors"
                                    >
                                        Aprovar / Atender
                                    </button>
                                    <button
                                        onClick={() => { handleUpdateStatus(selectedRequest.id, 'Rejeitado'); setSelectedRequest(null); }}
                                        className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-md hover:bg-red-700 transition-colors"
                                    >
                                        Recusar
                                    </button>
                                </div>
                            )}

                            <div>
                                <h4 className="font-semibold text-brand-text mb-4">Mensagens ({selectedRequest.comments.length})</h4>
                                <div className="space-y-4">
                                    {selectedRequest.comments.length === 0 ? (
                                        <p className="text-sm text-gray-400 italic">Nenhuma mensagem ainda.</p>
                                    ) : (
                                        selectedRequest.comments.map((comment, index) => (
                                            <div key={index} className={`flex items-start space-x-3 ${comment.author === currentUser.name ? 'flex-row-reverse' : ''}`}>
                                                <img src={comment.authorAvatarUrl || 'https://via.placeholder.com/40'} alt={comment.author} className="w-8 h-8 rounded-full object-cover" />
                                                <div className={`flex flex-col ${comment.author === currentUser.name ? 'items-end' : ''}`}>
                                                    <div className={`p-3 rounded-lg ${comment.author === currentUser.name ? 'bg-brand-primary text-white rounded-tr-none' : 'bg-gray-100 text-brand-text rounded-tl-none'}`}>
                                                        <p className="font-semibold text-[10px] mb-1 opacity-70">{comment.author}</p>
                                                        <p className="text-sm">{comment.text}</p>
                                                    </div>
                                                    <p className="text-[10px] text-gray-400 mt-1">{comment.timestamp}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100">
                            <form
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    if (!newComment.trim()) return;
                                    const comment = {
                                        id: Date.now().toString(),
                                        author: currentUser.name,
                                        authorAvatarUrl: currentUser.avatarUrl,
                                        text: newComment,
                                        timestamp: new Date().toLocaleString('pt-BR')
                                    };
                                    const updatedComments = [...selectedRequest.comments, comment];
                                    try {
                                        const { error } = await supabase
                                            .from('ti_requests')
                                            .update({ comments: updatedComments })
                                            .eq('id', selectedRequest.id);
                                        if (error) throw error;

                                        // Broadcast the update
                                        const channel = supabase.channel(`public:ti_requests:${currentUser.company_id}`);
                                        channel.send({
                                            type: 'broadcast',
                                            event: 'comment_update',
                                            payload: { requestId: selectedRequest.id }
                                        });

                                        setSelectedRequest({ ...selectedRequest, comments: updatedComments });
                                        setNewComment('');
                                        // Também atualizar na lista principal para que ao fechar o modal a lista esteja certa
                                        fetchRequests();
                                    } catch (err) {
                                        console.error('Error adding comment:', err);
                                        alert('Erro ao enviar mensagem.');
                                    }
                                }}
                                className="flex items-center space-x-3"
                            >
                                <img src={currentUser.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        placeholder="Digite sua mensagem..."
                                        className="w-full pl-4 pr-12 py-2 bg-gray-100 border border-transparent rounded-full focus:outline-none focus:ring-2 focus:ring-brand-primary text-brand-text"
                                    />
                                    <button type="submit" disabled={!newComment.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-brand-primary text-white rounded-full hover:bg-emerald-600 disabled:opacity-50">
                                        <PaperAirplaneIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default TIRequestsPage;