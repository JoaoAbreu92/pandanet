import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { BriefcaseIcon, MapPinIcon, ClockIcon } from '@heroicons/react/24/outline';

interface Job {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  location: string;
  type: string;
  status: string;
  salary_range?: string;
}

const JobsPage: React.FC = () => {
    const { profile } = useAuth();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [applying, setApplying] = useState(false);

    useEffect(() => {
        const fetchJobs = async () => {
            if (!profile?.company_id) return;
            const { data, error } = await supabase
                .from('jobs')
                .select('*')
                .eq('company_id', profile.company_id)
                .eq('status', 'open');
            
            if (data) setJobs(data);
            setLoading(false);
        };
        fetchJobs();
    }, [profile?.company_id]);

    const handleApply = async (jobId: string) => {
        if (!profile) return;
        setApplying(true);
        try {
            const { error } = await supabase.from('job_applications').insert({
                job_id: jobId,
                employee_id: profile.id,
                status: 'pending'
            });
            if (error) throw error;
            alert('Candidatura enviada com sucesso!');
            setSelectedJob(null);
        } catch (err: any) {
            alert('Erro ao candidatar: ' + err.message);
        } finally {
            setApplying(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando vagas...</div>;

    return (
        <div className="max-w-6xl mx-auto space-y-8 p-4">
            <header>
                <h1 className="text-3xl font-bold text-gray-900">Portal de Vagas Internas</h1>
                <p className="text-gray-500 mt-2">Explore novas oportunidades dentro do {profile?.company_id ? 'Grupo' : 'seu time'}.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {jobs.map(job => (
                    <div key={job.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-brand-primary/10 rounded-xl text-brand-primary">
                                <BriefcaseIcon className="w-6 h-6" />
                            </div>
                            <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full uppercase">
                                {job.type}
                            </span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{job.title}</h3>
                        <div className="flex items-center text-gray-500 text-sm space-x-4 mb-4">
                            <span className="flex items-center"><MapPinIcon className="w-4 h-4 mr-1" /> {job.location}</span>
                            <span className="flex items-center"><ClockIcon className="w-4 h-4 mr-1" /> Aberta recentemente</span>
                        </div>
                        <button 
                            onClick={() => setSelectedJob(job)}
                            className="w-full py-2 bg-gray-50 text-gray-700 font-semibold rounded-xl hover:bg-brand-primary hover:text-white transition-all"
                        >
                            Ver Detalhes
                        </button>
                    </div>
                ))}
            </div>

            {jobs.length === 0 && (
                <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <BriefcaseIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">Nenhuma vaga aberta no momento.</p>
                </div>
            )}

            {/* Modal de Detalhes */}
            {selectedJob && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-8">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">{selectedJob.title}</h2>
                                    <p className="text-brand-primary font-medium">{selectedJob.location} • {selectedJob.type}</p>
                                </div>
                                <button onClick={() => setSelectedJob(null)} className="text-gray-400 hover:text-gray-600">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                                <div>
                                    <h4 className="font-bold text-gray-900 mb-2">Descrição</h4>
                                    <p className="text-gray-600 leading-relaxed whitespace-pre-line">{selectedJob.description}</p>
                                </div>
                                {selectedJob.requirements && selectedJob.requirements.length > 0 && (
                                    <div>
                                        <h4 className="font-bold text-gray-900 mb-2">Requisitos</h4>
                                        <ul className="list-disc list-inside text-gray-600 space-y-1">
                                            {selectedJob.requirements.map((req, i) => <li key={i}>{req}</li>)}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 flex space-x-4">
                                <button 
                                    disabled={applying}
                                    onClick={() => handleApply(selectedJob.id)}
                                    className="flex-1 py-4 bg-brand-primary text-white font-bold rounded-2xl hover:bg-emerald-600 transition-all disabled:opacity-50"
                                >
                                    {applying ? 'Enviando...' : 'Candidatar-se à Vaga'}
                                </button>
                                <button onClick={() => setSelectedJob(null)} className="px-8 py-4 bg-gray-100 text-gray-700 font-bold rounded-2xl hover:bg-gray-200 transition-all">
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default JobsPage;
