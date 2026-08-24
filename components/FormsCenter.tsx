import React, { useState } from 'react';
import Card from './Card';
import { PlusIcon, XCircleIcon } from './icons';
// FIX: Correcting the import path for types.
import type { FormSubmission, FormStatus, Employee } from '../types';

interface FormsCenterProps {
    submissions: FormSubmission[];
    setSubmissions: (submissions: FormSubmission[]) => void;
    currentUser: Employee;
}

const VacationRequestModal: React.FC<{
    onClose: () => void;
    onSubmit: (data: Omit<FormSubmission, 'id' | 'requesterId' | 'requesterName' | 'requesterAvatarUrl' | 'status' | 'submittedAt' | 'formType'>) => void;
}> = ({ onClose, onSubmit }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ startDate, endDate, reason });
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><XCircleIcon className="w-6 h-6" /></button>
                <h3 className="text-xl font-bold text-brand-text mb-4">Solicitar Férias</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text">Data de Início</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text">Data de Fim</label>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Motivo (Opcional)</label>
                        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"></textarea>
                    </div>
                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Cancelar</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600">Enviar Solicitação</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const FormsCenter: React.FC<FormsCenterProps> = ({ submissions, setSubmissions, currentUser }) => {
    const [isModalOpen, setModalOpen] = useState(false);

    const handleNewRequest = (data: Omit<FormSubmission, 'id' | 'requesterId' | 'requesterName' | 'requesterAvatarUrl' | 'status' | 'submittedAt' | 'formType'>) => {
        const newSubmission: FormSubmission = {
            ...data,
            id: Date.now().toString(),
            requesterId: currentUser.id,
            requesterName: currentUser.name,
            requesterAvatarUrl: currentUser.avatarUrl,
            formType: 'Solicitação de Férias',
            status: 'Pendente',
            submittedAt: new Date().toISOString().split('T')[0],
        };
        setSubmissions([newSubmission, ...submissions]);
        setModalOpen(false);
    };

    const getStatusColor = (status: FormStatus) => {
        switch (status) {
            case 'Pendente': return 'bg-yellow-100 text-yellow-800';
            case 'Aprovado': return 'bg-green-100 text-green-800';
            case 'Rejeitado': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const userSubmissions = submissions.filter(sub => sub.requesterId === currentUser.id);

    return (
        <>
            <div className="space-y-6">
                <Card title="Formulários Disponíveis">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div onClick={() => setModalOpen(true)} className="p-6 bg-gray-50 rounded-lg hover:bg-emerald-50 border hover:border-emerald-300 cursor-pointer transition-colors text-center">
                            <h3 className="font-bold text-lg text-brand-text">Solicitação de Férias</h3>
                            <p className="text-sm text-brand-subtle-text mt-1">Planeje e envie seu pedido de férias.</p>
                             <button className="mt-4 flex items-center justify-center w-full space-x-2 px-3 py-2 text-sm bg-brand-primary text-white rounded-md hover:bg-emerald-600">
                                <PlusIcon className="w-4 h-4" />
                                <span>Iniciar Solicitação</span>
                            </button>
                        </div>
                        {/* Outros formulários podem ser adicionados aqui */}
                    </div>
                </Card>

                <Card title="Minhas Solicitações">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Tipo</th>
                                    <th scope="col" className="px-6 py-3">Período</th>
                                    <th scope="col" className="px-6 py-3">Data de Envio</th>
                                    <th scope="col" className="px-6 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {userSubmissions.map(sub => (
                                    <tr key={sub.id} className="bg-white border-b hover:bg-gray-50">
                                        <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{sub.formType}</td>
                                        <td className="px-6 py-4">{new Date(sub.startDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'})} - {new Date(sub.endDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                                        <td className="px-6 py-4">{new Date(sub.submittedAt).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(sub.status)}`}>{sub.status}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
            {isModalOpen && <VacationRequestModal onClose={() => setModalOpen(false)} onSubmit={handleNewRequest} />}
        </>
    );
};

export default FormsCenter;