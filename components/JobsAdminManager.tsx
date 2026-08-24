import React, { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, UsersIcon } from './icons';
import { supabase, getCleanImageUrl } from '../supabaseClient';
import type { Employee } from '../types';

import { useAuth } from './AuthContext';

interface JobsAdminManagerProps {
    employees: Employee[];
}

interface Job {
    id: string;
    title: string;
    description: string;
    requirements: string[];
    location: string;
    type: string;
    status: string;
    salary_range?: string;
    cover_url?: string;
    description_image?: string;
}

interface JobApplication {
    id: string;
    job_id: string;
    employee_id: string;
    status: 'pending' | 'reviewing' | 'interviewing' | 'accepted' | 'rejected';
    notes?: string;
    created_at: string;
    profile?: {
        full_name: string;
        role: string;
        avatar_url: string;
    };
}

const JobsAdminManager: React.FC<JobsAdminManagerProps> = ({ employees }) => {
    const { currentUser } = useAuth();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingJob, setEditingJob] = useState<Job | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Candidate details view state
    const [selectedJobForCandidates, setSelectedJobForCandidates] = useState<Job | null>(null);
    const [applications, setApplications] = useState<JobApplication[]>([]);
    const [loadingApplications, setLoadingApplications] = useState(false);

    // Form fields state
    const [title, setTitle] = useState('');
    const [jobStatus, setJobStatus] = useState('open');
    const [jobType, setJobType] = useState('Tempo Integral');
    const [location, setLocation] = useState('');
    const [salaryRange, setSalaryRange] = useState('');
    const [description, setDescription] = useState('');
    const [requirements, setRequirements] = useState('');

    // Files state
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [descImageFile, setDescImageFile] = useState<File | null>(null);
    const [existingCoverUrl, setExistingCoverUrl] = useState('');
    const [existingDescImageUrl, setExistingDescImageUrl] = useState('');

    const fetchJobs = async () => {
        if (!currentUser?.company_id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('jobs')
                .select('*')
                .eq('company_id', currentUser.company_id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) {
                setJobs(data.map((j: any) => ({
                    id: j.id,
                    title: j.title,
                    description: j.description || '',
                    requirements: j.requirements || [],
                    location: j.location || '',
                    type: j.type || '',
                    status: j.status || 'open',
                    salary_range: j.salary_range || '',
                    cover_url: j.cover_url || '',
                    description_image: j.description_image || ''
                })));
            }
        } catch (err) {
            console.error('Error fetching jobs:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentUser?.company_id) {
            fetchJobs();
        }
    }, [currentUser?.company_id]);

    const fetchApplications = async (jobId: string) => {
        setLoadingApplications(true);
        try {
            const { data, error } = await supabase
                .from('job_applications')
                .select(`
                    id,
                    job_id,
                    employee_id,
                    status,
                    notes,
                    created_at,
                    profiles:employee_id (
                        full_name,
                        role,
                        avatar_url
                    )
                `)
                .eq('job_id', jobId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) {
                setApplications(data.map((a: any) => ({
                    id: a.id,
                    job_id: a.job_id,
                    employee_id: a.employee_id,
                    status: a.status,
                    notes: a.notes || '',
                    created_at: a.created_at,
                    profile: {
                        full_name: a.profiles?.full_name || 'Desconhecido',
                        role: a.profiles?.role || 'Colaborador',
                        avatar_url: a.profiles?.avatar_url || ''
                    }
                })));
            }
        } catch (err) {
            console.error('Error fetching applications:', err);
        } finally {
            setLoadingApplications(false);
        }
    };

    const handleOpenModal = (job?: Job) => {
        if (job) {
            setEditingJob(job);
            setTitle(job.title);
            setJobStatus(job.status);
            setJobType(job.type);
            setLocation(job.location);
            setSalaryRange(job.salary_range || '');
            setDescription(job.description || '');
            setRequirements(job.requirements?.join('\n') || '');
            setExistingCoverUrl(job.cover_url || '');
            setExistingDescImageUrl(job.description_image || '');
        } else {
            setEditingJob(null);
            setTitle('');
            setJobStatus('open');
            setJobType('Tempo Integral');
            setLocation('');
            setSalaryRange('');
            setDescription('');
            setRequirements('');
            setExistingCoverUrl('');
            setExistingDescImageUrl('');
        }
        setCoverFile(null);
        setDescImageFile(null);
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);

        try {
            // Upload cover image
            let finalCoverUrl = existingCoverUrl;
            if (coverFile) {
                const fileName = `job_cover_${Date.now()}_${coverFile.name}`;
                const { error: uploadError } = await supabase.storage
                    .from('feed-media')
                    .upload(fileName, coverFile);

                if (uploadError) throw uploadError;

                const { data } = supabase.storage
                    .from('feed-media')
                    .getPublicUrl(fileName);

                finalCoverUrl = data.publicUrl;
            }

            // Upload description image
            let finalDescImageUrl = existingDescImageUrl;
            if (descImageFile) {
                const fileName = `job_desc_${Date.now()}_${descImageFile.name}`;
                const { error: uploadError } = await supabase.storage
                    .from('feed-media')
                    .upload(fileName, descImageFile);

                if (uploadError) throw uploadError;

                const { data } = supabase.storage
                    .from('feed-media')
                    .getPublicUrl(fileName);

                finalDescImageUrl = data.publicUrl;
            }

            const payload = {
                title,
                status: jobStatus,
                type: jobType,
                location,
                salary_range: salaryRange || null,
                description,
                requirements: requirements.split('\n').map(r => r.trim()).filter(Boolean),
                cover_url: finalCoverUrl,
                description_image: finalDescImageUrl,
                company_id: currentUser?.company_id
            };

            if (editingJob) {
                const { error } = await supabase
                    .from('jobs')
                    .update(payload)
                    .eq('id', editingJob.id);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('jobs')
                    .insert([payload]);

                if (error) throw error;
            }

            fetchJobs();
            setIsModalOpen(false);
            if (selectedJobForCandidates && selectedJobForCandidates.id === editingJob?.id) {
                setSelectedJobForCandidates(null);
            }
        } catch (err: any) {
            console.error('Error saving job:', err);
            alert('Erro ao salvar vaga: ' + (err?.message || JSON.stringify(err)));
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Tem certeza que deseja apagar esta vaga?")) {
            try {
                const { error } = await supabase
                    .from('jobs')
                    .delete()
                    .eq('id', id);

                if (error) throw error;
                fetchJobs();
                if (selectedJobForCandidates?.id === id) {
                    setSelectedJobForCandidates(null);
                }
            } catch (err) {
                console.error('Error deleting job:', err);
                alert('Erro ao apagar vaga.');
            }
        }
    };

    const handleSelectJobForCandidates = (job: Job) => {
        setSelectedJobForCandidates(job);
        fetchApplications(job.id);
    };

    const handleUpdateApplicationStatus = async (app: JobApplication, newStatus: JobApplication['status']) => {
        try {
            const { error } = await supabase
                .from('job_applications')
                .update({ status: newStatus })
                .eq('id', app.id);

            if (error) throw error;

            // Notify candidate
            const statusNames: Record<string, string> = {
                pending: 'Pendente',
                reviewing: 'Em Análise',
                interviewing: 'Entrevista Agendada',
                accepted: 'Aprovado',
                rejected: 'Reprovado/Não selecionado'
            };

            await supabase.from('notifications').insert([{
                user_id: app.employee_id,
                type: 'system',
                title: 'Status de Vaga Atualizado',
                description: `Sua candidatura para a vaga: "${selectedJobForCandidates?.title}" foi atualizada para: ${statusNames[newStatus]}`,
                is_read: false,
                link: '/jobs',
                avatar_url: employees.find(e => e.id === app.employee_id)?.avatarUrl || ''
            }]);

            // Refresh candidate list
            if (selectedJobForCandidates) {
                fetchApplications(selectedJobForCandidates.id);
            }
        } catch (err: any) {
            console.error('Error updating application status:', err);
            alert('Erro ao atualizar status: ' + err.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">Gestão de Vagas Internas</h3>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center space-x-2 px-4 py-2 text-sm bg-brand-primary text-white rounded-lg hover:bg-emerald-600 font-semibold"
                >
                    <PlusIcon className="w-4 h-4" />
                    <span>Nova Vaga</span>
                </button>
            </div>

            {loading ? (
                <div className="p-8 text-center text-gray-500">Carregando vagas...</div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {jobs.length === 0 ? (
                        <p className="p-8 text-center text-gray-500 bg-white rounded-xl border">Nenhuma vaga cadastrada.</p>
                    ) : (
                        jobs.map(j => (
                            <div
                                key={j.id}
                                className={`p-4 bg-white dark:bg-slate-800 rounded-xl border dark:border-white/5 shadow-sm transition-all hover:shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                                    selectedJobForCandidates?.id === j.id ? 'ring-2 ring-brand-primary' : ''
                                }`}
                            >
                                <div className="flex items-center space-x-4">
                                    {j.cover_url ? (
                                        <img src={getCleanImageUrl(j.cover_url)} alt="" className="w-16 h-16 object-cover rounded-lg border dark:border-white/5" />
                                    ) : (
                                        <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-lg flex items-center justify-center text-gray-400">
                                            <UsersIcon className="w-8 h-8" />
                                        </div>
                                    )}
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-white">{j.title}</h4>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {j.location} • {j.type} • {j.salary_range || 'Salário a combinar'}
                                        </p>
                                        <p className="text-xs font-semibold mt-1">
                                            Status: {j.status === 'open' ? (
                                                <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded-full dark:bg-green-950/20">Aberta</span>
                                            ) : (
                                                <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded-full dark:bg-red-950/20">Fechada</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex space-x-2 w-full md:w-auto justify-end">
                                    <button
                                        onClick={() => handleSelectJobForCandidates(j)}
                                        className="px-3 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-lg flex items-center space-x-1"
                                    >
                                        <UsersIcon className="w-4 h-4" />
                                        <span>Candidatos</span>
                                    </button>
                                    <button
                                        onClick={() => handleOpenModal(j)}
                                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                                    >
                                        <PencilIcon className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(j.id)}
                                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Candidates Section */}
            {selectedJobForCandidates && (
                <div className="mt-8 p-6 bg-white dark:bg-slate-800 rounded-xl border dark:border-white/5 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b dark:border-white/5 pb-3">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Candidatos inscritos: {selectedJobForCandidates.title}</h3>
                            <p className="text-sm text-gray-500">Acompanhe as candidaturas e altere o status de seleção.</p>
                        </div>
                        <button
                            onClick={() => setSelectedJobForCandidates(null)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"
                        >
                            <XMarkIcon className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    {loadingApplications ? (
                        <div className="text-center py-6 text-gray-500">Carregando candidatos...</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-white/5 text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-slate-700/50 text-gray-700 dark:text-gray-300 font-semibold">
                                    <tr>
                                        <th className="px-4 py-3">Colaborador</th>
                                        <th className="px-4 py-3">Cargo Atual</th>
                                        <th className="px-4 py-3">Data de Inscrição</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Ações de Seleção</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                    {applications.map(app => (
                                        <tr key={app.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                                            <td className="px-4 py-3 flex items-center space-x-3">
                                                <img src={app.profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(app.profile?.full_name || 'U')}`} alt="" className="w-8 h-8 rounded-full object-cover border" />
                                                <span className="font-semibold text-gray-900 dark:text-white">{app.profile?.full_name}</span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{app.profile?.role}</td>
                                            <td className="px-4 py-3 text-gray-500">{new Date(app.created_at).toLocaleDateString('pt-BR')}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                                                    ${app.status === 'pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/20' : ''}
                                                    ${app.status === 'reviewing' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/20' : ''}
                                                    ${app.status === 'interviewing' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/20' : ''}
                                                    ${app.status === 'accepted' ? 'bg-green-100 text-green-800 dark:bg-green-950/20' : ''}
                                                    ${app.status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-950/20' : ''}
                                                `}>
                                                    {app.status === 'pending' && 'Pendente'}
                                                    {app.status === 'reviewing' && 'Em Análise'}
                                                    {app.status === 'interviewing' && 'Entrevista'}
                                                    {app.status === 'accepted' && 'Aprovado'}
                                                    {app.status === 'rejected' && 'Reprovado'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right space-x-1">
                                                <select
                                                    value={app.status}
                                                    onChange={(e) => handleUpdateApplicationStatus(app, e.target.value as any)}
                                                    className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-900 rounded-lg p-1 text-xs font-semibold text-gray-700 dark:text-gray-200"
                                                >
                                                    <option value="pending">Pendente</option>
                                                    <option value="reviewing">Em Análise</option>
                                                    <option value="interviewing">Entrevista</option>
                                                    <option value="accepted">Aprovar</option>
                                                    <option value="rejected">Reprovar</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                    {applications.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="text-center py-6 text-gray-500">Nenhum colaborador se candidatou a esta vaga ainda.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Form Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 relative animate-in fade-in zoom-in-95 duration-200">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                            disabled={isProcessing}
                        >
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                            {editingJob ? 'Editar Vaga Interna' : 'Nova Vaga Interna'}
                        </h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Título da Vaga</label>
                                <input
                                    type="text"
                                    required
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="mt-1 w-full border border-gray-350 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Vaga</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: Tempo Integral, Meio Período"
                                        value={jobType}
                                        onChange={e => setJobType(e.target.value)}
                                        className="mt-1 w-full border border-gray-350 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                                    <select
                                        value={jobStatus}
                                        onChange={e => setJobStatus(e.target.value)}
                                        className="mt-1 w-full border border-gray-350 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                    >
                                        <option value="open">Aberta</option>
                                        <option value="closed">Fechada</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Localização</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: Matriz - São Paulo / Remoto"
                                        value={location}
                                        onChange={e => setLocation(e.target.value)}
                                        className="mt-1 w-full border border-gray-350 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Faixa Salarial (Opcional)</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: R$ 5.000 - R$ 6.500"
                                        value={salaryRange}
                                        onChange={e => setSalaryRange(e.target.value)}
                                        className="mt-1 w-full border border-gray-350 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Descrição (Texto)</label>
                                <textarea
                                    rows={4}
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="mt-1 w-full border border-gray-350 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Requisitos (um por linha)</label>
                                <textarea
                                    rows={3}
                                    placeholder="Ex: Superior Completo&#10;Experiência de 2 anos"
                                    value={requirements}
                                    onChange={e => setRequirements(e.target.value)}
                                    className="mt-1 w-full border border-gray-350 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Imagem de Capa (Upload)</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={e => e.target.files && setCoverFile(e.target.files[0])}
                                        className="mt-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-brand-primary hover:file:bg-emerald-100 cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Imagem Descrição (Opcional)</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={e => e.target.files && setDescImageFile(e.target.files[0])}
                                        className="mt-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-brand-primary hover:file:bg-emerald-100 cursor-pointer"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t dark:border-white/5">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    disabled={isProcessing}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-250 dark:bg-slate-800 dark:text-gray-300 rounded-lg hover:bg-gray-300"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isProcessing}
                                    className="px-6 py-2 text-sm font-medium text-white bg-brand-primary rounded-lg hover:bg-emerald-600 disabled:opacity-50"
                                >
                                    {isProcessing ? 'Salvando...' : 'Salvar Vaga'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default JobsAdminManager;
