import React, { useState, useEffect } from 'react';
import Card from './Card';
import type { FormSubmission, FormStatus } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

const FormSubmissionsManager: React.FC = () => {
    const { currentUser } = useAuth();
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const canView = currentUser?.isAdmin || currentUser?.permissions?.viewVacationRequests;
    const canManage = currentUser?.isAdmin || currentUser?.permissions?.manageVacationRequests;

    const fetchSubmissions = async () => {
        if (!currentUser?.company_id || !canView) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('form_submissions')
                .select('*, profiles(full_name, avatar_url)')
                .eq('company_id', currentUser.company_id)
                .order('submitted_at', { ascending: false });

            if (error) throw error;

            // Map table columns to component expectations
            setSubmissions((data || []).map(s => ({
                id: s.id,
                requesterId: s.requester_id,
                requesterName: s.profiles?.full_name || 'Usuário',
                requesterAvatarUrl: s.profiles?.avatar_url || '',
                formType: s.form_type,
                status: s.status as FormStatus,
                submittedAt: s.submitted_at,
                startDate: s.start_date,
                endDate: s.end_date,
                reason: s.reason
            })));
        } catch (err) {
            console.error('Error fetching submissions:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSubmissions();
    }, [currentUser?.company_id]);

    const handleUpdateStatus = async (submissionId: string | number, status: FormStatus) => {
        try {
            const { error } = await supabase
                .from('form_submissions')
                .update({ status })
                .eq('id', submissionId);

            if (error) throw error;
            fetchSubmissions();
        } catch (err) {
            console.error('Error updating submission status:', err);
            alert('Erro ao atualizar status.');
        }
    };

    const getStatusColor = (status: FormStatus) => {
        switch (status) {
            case 'Pendente': return 'bg-yellow-100 text-yellow-800';
            case 'Aprovado': return 'bg-green-100 text-green-800';
            case 'Rejeitado': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (!canView) return <div className="p-8 text-center text-red-500 font-bold bg-red-50 rounded-lg border border-red-100">Acesso Negado: Você não tem permissão para visualizar solicitações de RH.</div>;

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando solicitações...</div>;

    return (
        <Card title="Gerenciar Solicitações de Formulários">
            <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                        <tr>
                            <th scope="col" className="px-6 py-3">Solicitante</th>
                            <th scope="col" className="px-6 py-3">Tipo</th>
                            <th scope="col" className="px-6 py-3">Período</th>
                            <th scope="col" className="px-6 py-3">Status</th>
                            <th scope="col" className="px-6 py-3 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {submissions.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-400">Nenhuma solicitação encontrada.</td>
                            </tr>
                        ) : (
                            submissions.map(sub => (
                                <tr key={sub.id} className="bg-white hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                        <div className="flex items-center space-x-3">
                                            <img src={sub.requesterAvatarUrl} alt={sub.requesterName} className="w-8 h-8 rounded-full border" />
                                            <span>{sub.requesterName}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">{sub.formType}</td>
                                    <td className="px-6 py-4">
                                        {sub.startDate ? new Date(sub.startDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : ''}
                                        {sub.endDate ? ` - ${new Date(sub.endDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}` : ''}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusColor(sub.status)}`}>{sub.status}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        {canManage && sub.status === 'Pendente' && (
                                            <>
                                                <button onClick={() => handleUpdateStatus(sub.id, 'Aprovado')} className="px-3 py-1 text-xs font-bold text-green-700 bg-green-100 rounded-md hover:bg-green-200 transition-colors">Aprovar</button>
                                                <button onClick={() => handleUpdateStatus(sub.id, 'Rejeitado')} className="px-3 py-1 text-xs font-bold text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors">Rejeitar</button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

export default FormSubmissionsManager;