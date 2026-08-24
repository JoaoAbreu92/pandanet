import React from 'react';
import Card from './Card';
// FIX: Correcting the import path for types.
import type { FormSubmission, FormStatus } from '../types';

interface FormSubmissionsManagerProps {
    submissions: FormSubmission[];
    setSubmissions: React.Dispatch<React.SetStateAction<FormSubmission[]>>;
}

const FormSubmissionsManager: React.FC<FormSubmissionsManagerProps> = ({ submissions, setSubmissions }) => {

    const handleUpdateStatus = (submissionId: number, status: FormStatus) => {
        setSubmissions(submissions.map(s => 
            s.id === submissionId ? { ...s, status } : s
        ));
    };

    const getStatusColor = (status: FormStatus) => {
        switch (status) {
            case 'Pendente': return 'bg-yellow-100 text-yellow-800';
            case 'Aprovado': return 'bg-green-100 text-green-800';
            case 'Rejeitado': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

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
                        {submissions.map(sub => (
                            <tr key={sub.id} className="bg-white hover:bg-gray-50">
                                <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                    <div className="flex items-center space-x-3">
                                        <img src={sub.requesterAvatarUrl} alt={sub.requesterName} className="w-8 h-8 rounded-full" />
                                        <span>{sub.requesterName}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">{sub.formType}</td>
                                <td className="px-6 py-4">{new Date(sub.startDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'})} - {new Date(sub.endDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(sub.status)}`}>{sub.status}</span>
                                </td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    {sub.status === 'Pendente' && (
                                        <>
                                            <button onClick={() => handleUpdateStatus(sub.id, 'Aprovado')} className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-md hover:bg-green-200">Aprovar</button>
                                            <button onClick={() => handleUpdateStatus(sub.id, 'Rejeitado')} className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200">Rejeitar</button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

export default FormSubmissionsManager;