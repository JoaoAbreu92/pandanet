import React, { useState, useEffect } from 'react';
import Card from './Card';
import { PlusIcon, XCircleIcon } from './icons';
import type { FormSubmission, FormStatus } from '../types';
import { useLanguage } from './LanguageContext';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

const VacationRequestModal: React.FC<{
    onClose: () => void;
    onSubmit: (data: { startDate: string, endDate: string, reason: string, sectorManager: string, employeeManager: string }) => void;
    submitting?: boolean;
}> = ({ onClose, onSubmit, submitting }) => {
    const { t } = useLanguage();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');
    const [sectorManager, setSectorManager] = useState('');
    const [employeeManager, setEmployeeManager] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ startDate, endDate, reason, sectorManager, employeeManager });
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up">
                <button onClick={onClose} disabled={submitting} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><XCircleIcon className="w-6 h-6" /></button>
                <h3 className="text-xl font-bold text-brand-text mb-4">{t('forms.vacation')}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text">{t('forms.manager_sector')}</label>
                            <input type="text" value={sectorManager} onChange={e => setSectorManager(e.target.value)} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text border p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text">{t('forms.manager_employee')}</label>
                            <input type="text" value={employeeManager} onChange={e => setEmployeeManager(e.target.value)} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text border p-2" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text">{t('forms.start_date')}</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text border p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-brand-subtle-text">{t('forms.end_date')}</label>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text border p-2" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">{t('forms.reason')}</label>
                        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text border p-2"></textarea>
                    </div>
                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">{t('generic.cancel')}</button>
                        <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600 transition-colors">
                            {submitting ? 'Enviando...' : t('forms.submit')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const FormsPage: React.FC = () => {
    const { t } = useLanguage();
    const { currentUser } = useAuth();
    const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const fetchSubmissions = async () => {
        if (!currentUser?.id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('form_submissions')
                .select('*')
                .eq('requester_id', currentUser.id)
                .order('submitted_at', { ascending: false });

            if (error) throw error;

            setSubmissions((data || []).map(s => ({
                id: s.id,
                requesterId: s.requester_id,
                requesterName: currentUser.name || '',
                requesterAvatarUrl: currentUser.avatarUrl || '',
                formType: s.form_type,
                status: s.status as FormStatus,
                submittedAt: s.submitted_at,
                startDate: s.start_date,
                endDate: s.end_date,
                reason: s.reason,
                sectorManager: s.sector_manager,
                employeeManager: s.employee_manager
            })));
        } catch (err) {
            console.error('Error fetching submissions:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSubmissions();
    }, [currentUser?.id]);

    const handleNewRequest = async (data: { startDate: string, endDate: string, reason: string, sectorManager: string, employeeManager: string }) => {
        if (!currentUser?.id || !currentUser?.company_id) return;

        setSubmitting(true);
        try {
            const { error } = await supabase
                .from('form_submissions')
                .insert([{
                    company_id: currentUser.company_id,
                    requester_id: currentUser.id,
                    form_type: 'Solicitação de Férias',
                    status: 'Pendente',
                    start_date: data.startDate,
                    end_date: data.endDate,
                    reason: data.reason,
                    sector_manager: data.sectorManager,
                    employee_manager: data.employeeManager
                }]);

            if (error) throw error;

            setModalOpen(false);
            fetchSubmissions();
        } catch (err) {
            console.error('Error submitting form:', err);
            alert('Erro ao enviar solicitação.');
        } finally {
            setSubmitting(false);
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

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando formulários...</div>;

    return (
        <>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold text-brand-text">{t('forms.title')}</h1>
                <Card title={t('forms.available')}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div onClick={() => setModalOpen(true)} className="p-6 bg-gray-50 rounded-lg hover:bg-emerald-50 border hover:border-emerald-300 cursor-pointer transition-colors text-center group">
                            <h3 className="font-bold text-lg text-brand-text group-hover:text-brand-primary transition-colors">{t('forms.vacation')}</h3>
                            <p className="text-sm text-brand-subtle-text mt-1">{t('forms.vacation_desc')}</p>
                            <button className="mt-4 flex items-center justify-center w-full space-x-2 px-3 py-2 text-sm bg-brand-primary text-white rounded-md hover:bg-emerald-600 transition-colors shadow-md">
                                <PlusIcon className="w-4 h-4" />
                                <span>{t('forms.start_request')}</span>
                            </button>
                        </div>
                        <div onClick={() => alert('Em breve')} className="p-6 bg-gray-50 rounded-lg opacity-60 border cursor-not-allowed text-center">
                            <h3 className="font-bold text-lg text-brand-text">{t('forms.reimbursement')}</h3>
                            <p className="text-sm text-brand-subtle-text mt-1">{t('forms.reimbursement_desc')}</p>
                            <button disabled className="mt-4 flex items-center justify-center w-full space-x-2 px-3 py-2 text-sm bg-gray-300 text-white rounded-md cursor-not-allowed">
                                <PlusIcon className="w-4 h-4" />
                                <span>{t('forms.start_request')}</span>
                            </button>
                        </div>
                        <div onClick={() => alert('Em breve')} className="p-6 bg-gray-50 rounded-lg opacity-60 border cursor-not-allowed text-center">
                            <h3 className="font-bold text-lg text-brand-text">{t('forms.data_change')}</h3>
                            <p className="text-sm text-brand-subtle-text mt-1">{t('forms.data_change_desc')}</p>
                            <button disabled className="mt-4 flex items-center justify-center w-full space-x-2 px-3 py-2 text-sm bg-gray-300 text-white rounded-md cursor-not-allowed">
                                <PlusIcon className="w-4 h-4" />
                                <span>{t('forms.start_request')}</span>
                            </button>
                        </div>
                    </div>
                </Card>

                <Card title={t('forms.my_requests')}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Tipo</th>
                                    <th scope="col" className="px-6 py-3">Período</th>
                                    <th scope="col" className="px-6 py-3">Data</th>
                                    <th scope="col" className="px-6 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {submissions.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-gray-400 italic">Nenhuma solicitação encontrada.</td>
                                    </tr>
                                ) : (
                                    submissions.map(sub => (
                                        <tr key={sub.id} className="bg-white border-b hover:bg-gray-50">
                                            <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{sub.formType}</td>
                                            <td className="px-6 py-4">
                                                {sub.startDate ? new Date(sub.startDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : ''}
                                                {sub.endDate ? ` - ${new Date(sub.endDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}` : ''}
                                            </td>
                                            <td className="px-6 py-4">{new Date(sub.submittedAt).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusColor(sub.status)}`}>{sub.status}</span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
            {isModalOpen && <VacationRequestModal onClose={() => setModalOpen(false)} onSubmit={handleNewRequest} submitting={submitting} />}
        </>
    );
};

export default FormsPage;
