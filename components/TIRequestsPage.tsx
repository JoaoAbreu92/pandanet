import React, { useState, useEffect } from 'react';
import Card from './Card';
import { PlusIcon, XCircleIcon } from './icons';
import type { TIRequest, TIRequestStatus, TIRequestType, Employee } from '../types';
import { supabase } from '../supabaseClient';

interface TIRequestsPageProps {
    submissions: TIRequest[];
    setSubmissions: (submissions: TIRequest[]) => void;
    currentUser: Employee;
}

const RequestModal: React.FC<{
    onClose: () => void;
    onSubmit: (data: Omit<TIRequest, 'id' | 'requesterId' | 'requesterName' | 'requesterAvatarUrl' | 'status' | 'submittedAt'>) => void;
}> = ({ onClose, onSubmit }) => {
    const [requestType, setRequestType] = useState<TIRequestType>('Hardware');
    const [itemName, setItemName] = useState('');
    const [justification, setJustification] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!itemName.trim() || !justification.trim()) {
            alert('Por favor, preencha todos os campos.');
            return;
        }
        setLoading(true);
        await onSubmit({ requestType, itemName, justification });
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
    const [loading, setLoading] = useState(true);

    const fetchRequests = async () => {
        if (!currentUser?.company_id) return;
        try {
            const { data, error } = await supabase
                .from('ti_requests')
                .select('*')
                .eq('company_id', currentUser.company_id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                const formatted: TIRequest[] = data.map((d: any) => ({
                    id: d.id,
                    requesterId: d.requester_id,
                    requesterName: currentUser.name, // Since we filter by current user's company and later filter for current user
                    requesterAvatarUrl: currentUser.avatarUrl,
                    requestType: d.request_type as TIRequestType,
                    itemName: d.item_name,
                    justification: d.justification,
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

    useEffect(() => {
        fetchRequests();
    }, [currentUser?.id]);

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
                    status: 'Pendente'
                }]);

            if (error) throw error;

            fetchRequests();
            setModalOpen(false);
        } catch (error) {
            console.error('Error creating TI request:', error);
            alert('Erro ao enviar solicitação.');
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
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const userSubmissions = submissions.filter(sub => sub.requesterId === currentUser.id);

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


                <Card title="Minhas Solicitações">
                    <div className="overflow-x-auto">
                        {loading ? (
                            <p className="text-center text-brand-subtle-text py-8">Carregando solicitações...</p>
                        ) : (
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">Item</th>
                                        <th scope="col" className="px-6 py-3">Tipo</th>
                                        <th scope="col" className="px-6 py-3">Data de Envio</th>
                                        <th scope="col" className="px-6 py-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {userSubmissions.map(sub => (
                                        <tr key={sub.id} className="bg-white border-b hover:bg-gray-50">
                                            <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{sub.itemName}</td>
                                            <td className="px-6 py-4">{sub.requestType}</td>
                                            <td className="px-6 py-4">{new Date(sub.submittedAt).toLocaleDateString('pt-BR')}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(sub.status)}`}>{sub.status}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        {!loading && userSubmissions.length === 0 && <p className="text-center text-brand-subtle-text py-4">Você ainda não fez nenhuma solicitação.</p>}
                    </div>
                </Card>
            </div>
            {isModalOpen && <RequestModal onClose={() => setModalOpen(false)} onSubmit={handleNewRequest} />}
        </>
    );
};

export default TIRequestsPage;