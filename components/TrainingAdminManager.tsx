import React, { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, DocumentTextIcon, UsersIcon } from './icons';
import { supabase, getCleanImageUrl } from '../supabaseClient';
import type { Employee, TrainingModule } from '../types';
import { useAuth } from './AuthContext';

interface TrainingAdminManagerProps {
    employees: Employee[];
}

interface QuizQuestion {
    questionText: string;
    options: string[];
    correctOptionIndex: number;
}

interface Submission {
    id: string;
    user_id: string;
    score: number;
    completed: boolean;
    answers: number[];
    created_at: string;
    profile?: {
        full_name: string;
    };
}

const TrainingAdminManager: React.FC<TrainingAdminManagerProps> = ({ employees }) => {
    const { currentUser } = useAuth();
    const [trainings, setTrainings] = useState<TrainingModule[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTraining, setEditingTraining] = useState<TrainingModule | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Selected training for viewing progress/submissions
    const [selectedTrainingForProgress, setSelectedTrainingForProgress] = useState<TrainingModule | null>(null);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loadingSubmissions, setLoadingSubmissions] = useState(false);

    // Form fields state
    const [title, setTitle] = useState('');
    const [duration, setDuration] = useState('');
    const [category, setCategory] = useState('');
    const [videoUrl, setVideoUrl] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [participants, setParticipants] = useState<string[]>([]);
    const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);

    // Files state
    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [existingThumbnailUrl, setExistingThumbnailUrl] = useState('');
    const [existingPdfUrl, setExistingPdfUrl] = useState('');

    const fetchTrainings = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('training_modules')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) {
                setTrainings(data.map((t: any) => ({
                    id: t.id,
                    title: t.title,
                    duration: t.duration || '0 min',
                    thumbnail: t.thumbnail || '',
                    videoUrl: t.video_url || '',
                    category: t.category || '',
                    participants: t.participants || [],
                    startDate: t.start_date || '',
                    endDate: t.end_date || '',
                    pdfUrl: t.pdf_url || '',
                    quiz: t.quiz || []
                })));
            }
        } catch (err) {
            console.error('Error fetching training modules:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTrainings();
    }, []);

    const fetchSubmissions = async (trainingId: string) => {
        setLoadingSubmissions(true);
        try {
            const { data, error } = await supabase
                .from('training_submissions')
                .select(`
                    id,
                    employee_id,
                    score,
                    answers,
                    completed_at,
                    profiles:employee_id (
                        full_name
                    )
                `)
                .eq('training_id', trainingId);

            if (error) throw error;
            if (data) {
                setSubmissions(data.map((s: any) => ({
                    id: s.id,
                    user_id: s.employee_id,
                    score: s.score,
                    completed: true,
                    answers: s.answers || [],
                    created_at: s.completed_at,
                    profile: {
                        full_name: s.profiles?.full_name || 'Desconhecido'
                    }
                })));
            }
        } catch (err) {
            console.error('Error fetching submissions:', err);
        } finally {
            setLoadingSubmissions(false);
        }
    };

    const handleOpenModal = (training?: TrainingModule) => {
        if (training) {
            setEditingTraining(training);
            setTitle(training.title);
            setDuration(training.duration);
            setCategory(training.category || '');
            setVideoUrl(training.videoUrl || '');
            setStartDate(training.startDate || '');
            setEndDate(training.endDate || '');
            setParticipants(training.participants || []);
            setQuizQuestions(training.quiz || []);
            setExistingThumbnailUrl(training.thumbnail);
            setExistingPdfUrl(training.pdfUrl || '');
        } else {
            setEditingTraining(null);
            setTitle('');
            setDuration('');
            setCategory('');
            setVideoUrl('');
            setStartDate('');
            setEndDate('');
            setParticipants([]);
            setQuizQuestions([]);
            setExistingThumbnailUrl('');
            setExistingPdfUrl('');
        }
        setThumbnailFile(null);
        setPdfFile(null);
        setIsModalOpen(true);
    };

    const handleAddQuizQuestion = () => {
        if (quizQuestions.length >= 5) {
            alert('Um quiz pode conter no máximo 5 perguntas.');
            return;
        }
        setQuizQuestions(prev => [
            ...prev,
            { questionText: '', options: ['', '', '', ''], correctOptionIndex: 0 }
        ]);
    };

    const handleRemoveQuizQuestion = (index: number) => {
        setQuizQuestions(prev => prev.filter((_, idx) => idx !== index));
    };

    const handleQuizQuestionChange = (index: number, field: string, value: any) => {
        setQuizQuestions(prev => prev.map((q, idx) => {
            if (idx === index) {
                return { ...q, [field]: value };
            }
            return q;
        }));
    };

    const handleQuizOptionChange = (qIndex: number, optIndex: number, value: string) => {
        setQuizQuestions(prev => prev.map((q, idx) => {
            if (idx === qIndex) {
                const newOptions = [...q.options];
                newOptions[optIndex] = value;
                return { ...q, options: newOptions };
            }
            return q;
        }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);

        try {
            // Upload thumbnail if changed
            let finalThumbnailUrl = existingThumbnailUrl;
            if (thumbnailFile) {
                const fileName = `thumb_${Date.now()}_${thumbnailFile.name}`;
                const { error: uploadError } = await supabase.storage
                    .from('announcements-media')
                    .upload(fileName, thumbnailFile);

                if (uploadError) throw uploadError;

                const { data } = supabase.storage
                    .from('announcements-media')
                    .getPublicUrl(fileName);

                finalThumbnailUrl = data.publicUrl;
            }

            // Upload PDF if changed
            let finalPdfUrl = existingPdfUrl;
            if (pdfFile) {
                const fileName = `pdf_${Date.now()}_${pdfFile.name}`;
                const { error: uploadError } = await supabase.storage
                    .from('documents')
                    .upload(fileName, pdfFile);

                if (uploadError) throw uploadError;

                const { data } = supabase.storage
                    .from('documents')
                    .getPublicUrl(fileName);

                finalPdfUrl = data.publicUrl;
            }

            const payload = {
                title,
                duration,
                category,
                video_url: videoUrl,
                start_date: startDate || null,
                end_date: endDate || null,
                participants,
                thumbnail: finalThumbnailUrl,
                pdf_url: finalPdfUrl,
                quiz: quizQuestions,
                company_id: employees[0]?.company_id
            };

            let trainingId = editingTraining?.id;

            if (editingTraining) {
                const { error } = await supabase
                    .from('training_modules')
                    .update(payload)
                    .eq('id', editingTraining.id);

                if (error) throw error;
            } else {
                const { data: insertedData, error } = await supabase
                    .from('training_modules')
                    .insert([payload])
                    .select();

                if (error) throw error;
                if (insertedData && insertedData[0]) {
                    trainingId = insertedData[0].id;
                }
            }

            // Create notification and calendar event for new participants
            if (participants && participants.length > 0 && currentUser) {
                const { data: calEvent, error: calError } = await supabase
                    .from('calendar_events')
                    .insert([{
                        company_id: employees[0]?.company_id,
                        creator_id: currentUser.id,
                        title: `Treinamento: ${title}`,
                        description: `Prazo final para conclusão do treinamento: ${title}.`,
                        date: endDate || new Date().toISOString().split('T')[0],
                        start_time: '09:00',
                        end_time: '18:00',
                        category: 'Treinamento',
                        is_system: true
                    }])
                    .select()
                    .single();

                if (!calError && calEvent) {
                    const invites = participants.map(userId => ({
                        event_id: calEvent.id,
                        user_id: userId,
                        status: 'pending'
                    }));
                    await supabase.from('calendar_invites').insert(invites);
                }

                // Insert notifications
                const notifications = participants.map(userId => ({
                    user_id: userId,
                    company_id: employees[0]?.company_id,
                    type: 'event',
                    title: 'Novo Treinamento Convocado',
                    description: `Você foi convocado para o treinamento: "${title}". Conclua até ${endDate ? new Date(endDate).toLocaleDateString('pt-BR') : 'o prazo estabelecido'}.`,
                    is_read: false,
                    link: '/training'
                }));
                await supabase.from('notifications').insert(notifications);
            }

            fetchTrainings();
            setIsModalOpen(false);
            if (selectedTrainingForProgress && selectedTrainingForProgress.id === editingTraining?.id) {
                // Refresh progress view if editing the selected one
                setSelectedTrainingForProgress(null);
            }
        } catch (err: any) {
            console.error('Error saving training module:', err);
            alert('Erro ao salvar treinamento: ' + (err?.message || JSON.stringify(err)));
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Tem certeza que deseja apagar este treinamento?")) {
            try {
                const { error } = await supabase
                    .from('training_modules')
                    .delete()
                    .eq('id', id);

                if (error) throw error;
                fetchTrainings();
                if (selectedTrainingForProgress?.id === id) {
                    setSelectedTrainingForProgress(null);
                }
            } catch (err) {
                console.error('Error deleting training:', err);
                alert('Erro ao apagar treinamento.');
            }
        }
    };

    const handleSelectTrainingForProgress = (training: TrainingModule) => {
        setSelectedTrainingForProgress(training);
        fetchSubmissions(training.id);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">Gerenciar Treinamentos</h3>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center space-x-2 px-4 py-2 text-sm bg-brand-primary text-white rounded-lg hover:bg-emerald-600 font-semibold"
                >
                    <PlusIcon className="w-4 h-4" />
                    <span>Novo Treinamento</span>
                </button>
            </div>

            {loading ? (
                <div className="p-8 text-center text-gray-500">Carregando treinamentos...</div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {trainings.length === 0 ? (
                        <p className="p-8 text-center text-gray-500 bg-white rounded-xl border">Nenhum treinamento cadastrado.</p>
                    ) : (
                        trainings.map(t => (
                            <div
                                key={t.id}
                                className={`p-4 bg-white dark:bg-slate-800 rounded-xl border dark:border-white/5 shadow-sm transition-all hover:shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                                    selectedTrainingForProgress?.id === t.id ? 'ring-2 ring-brand-primary' : ''
                                }`}
                            >
                                <div className="flex items-center space-x-4">
                                    {t.thumbnail ? (
                                        <img src={getCleanImageUrl(t.thumbnail)} alt="" className="w-16 h-16 object-cover rounded-lg border dark:border-white/5" />
                                    ) : (
                                        <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-lg flex items-center justify-center text-gray-400">
                                            <DocumentTextIcon className="w-8 h-8" />
                                        </div>
                                    )}
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-white">{t.title}</h4>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {t.category} • {t.duration}
                                        </p>
                                        {t.startDate && t.endDate && (
                                            <p className="text-xs text-brand-primary font-medium mt-1">
                                                Período: {new Date(t.startDate).toLocaleDateString('pt-BR')} até {new Date(t.endDate).toLocaleDateString('pt-BR')}
                                            </p>
                                        )}
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {t.participants?.length || 0} colaboradores convocados • {t.quiz?.length || 0} perguntas no quiz
                                        </p>
                                    </div>
                                </div>
                                <div className="flex space-x-2 w-full md:w-auto justify-end">
                                    <button
                                        onClick={() => handleSelectTrainingForProgress(t)}
                                        className="px-3 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-lg flex items-center space-x-1"
                                    >
                                        <UsersIcon className="w-4 h-4" />
                                        <span>Progresso</span>
                                    </button>
                                    <button
                                        onClick={() => handleOpenModal(t)}
                                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                                    >
                                        <PencilIcon className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(t.id)}
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

            {/* Submissions / Progress Section */}
            {selectedTrainingForProgress && (
                <div className="mt-8 p-6 bg-white dark:bg-slate-800 rounded-xl border dark:border-white/5 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b dark:border-white/5 pb-3">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Progresso de Convocados: {selectedTrainingForProgress.title}</h3>
                            <p className="text-sm text-gray-500">Acompanhe as respostas e a pontuação dos colaboradores no quiz.</p>
                        </div>
                        <button
                            onClick={() => setSelectedTrainingForProgress(null)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"
                        >
                            <XMarkIcon className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    {loadingSubmissions ? (
                        <div className="text-center py-6 text-gray-500">Carregando progresso...</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-white/5 text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-slate-700/50 text-gray-700 dark:text-gray-300 font-semibold">
                                    <tr>
                                        <th className="px-4 py-3">Colaborador</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3">Nota / Acertos</th>
                                        <th className="px-4 py-3">Conclusão</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                    {selectedTrainingForProgress.participants?.map(userId => {
                                        const employee = employees.find(e => e.id === userId);
                                        const sub = submissions.find(s => s.user_id === userId);

                                        return (
                                            <tr key={userId} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                                                <td className="px-4 py-3 flex items-center space-x-3">
                                                    {employee ? (
                                                        <>
                                                            <img src={employee.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                                                            <span className="font-medium text-gray-900 dark:text-white">{employee.name}</span>
                                                        </>
                                                    ) : (
                                                        <span className="text-gray-400">Usuário removido / não encontrado</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {sub?.completed ? (
                                                        <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800 rounded-full">Concluído</span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full">Pendente</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {sub?.completed ? (
                                                        <span className="font-semibold text-gray-900 dark:text-white">
                                                            {sub.score}% ({sub.answers?.length ? Math.round((sub.score / 100) * selectedTrainingForProgress.quiz?.length) : 0}/{selectedTrainingForProgress.quiz?.length})
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-gray-500">
                                                    {sub?.completed ? new Date(sub.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {(!selectedTrainingForProgress.participants || selectedTrainingForProgress.participants.length === 0) && (
                                        <tr>
                                            <td colSpan={4} className="text-center py-6 text-gray-500">Nenhum colaborador convocado para este treinamento.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Add / Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 relative animate-in fade-in zoom-in-95 duration-200">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                            disabled={isProcessing}
                        >
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                            {editingTraining ? 'Editar Treinamento' : 'Novo Treinamento'}
                        </h3>
                        <form onSubmit={handleSave} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Título</label>
                                    <input
                                        type="text"
                                        required
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        className="mt-1 w-full border border-gray-350 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Duração</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: 45 min"
                                        value={duration}
                                        onChange={e => setDuration(e.target.value)}
                                        className="mt-1 w-full border border-gray-350 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Categoria</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Compliance, Vendas"
                                        value={category}
                                        onChange={e => setCategory(e.target.value)}
                                        className="mt-1 w-full border border-gray-350 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Vídeo (URL do YouTube/Vimeo)</label>
                                    <input
                                        type="url"
                                        value={videoUrl}
                                        onChange={e => setVideoUrl(e.target.value)}
                                        className="mt-1 w-full border border-gray-350 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Data de Início</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={e => setStartDate(e.target.value)}
                                        className="mt-1 w-full border border-gray-350 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Data de Término</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={e => setEndDate(e.target.value)}
                                        className="mt-1 w-full border border-gray-350 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            {/* Files Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Capa do Treinamento (Imagem)</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={e => e.target.files && setThumbnailFile(e.target.files[0])}
                                        className="mt-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-brand-primary hover:file:bg-emerald-100 cursor-pointer"
                                    />
                                    {existingThumbnailUrl && <p className="text-xs text-gray-400 mt-1">Capa cadastrada: <a href={existingThumbnailUrl} target="_blank" rel="noreferrer" className="text-brand-primary underline">Ver</a></p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Documento de Apoio (PDF)</label>
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        onChange={e => e.target.files && setPdfFile(e.target.files[0])}
                                        className="mt-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-brand-primary hover:file:bg-emerald-100 cursor-pointer"
                                    />
                                    {existingPdfUrl && <p className="text-xs text-gray-400 mt-1">PDF cadastrado: <a href={existingPdfUrl} target="_blank" rel="noreferrer" className="text-brand-primary underline">Ver</a></p>}
                                </div>
                            </div>

                            {/* Convocados Selector */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Convocados / Participantes</label>
                                <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-3 max-h-40 overflow-y-auto bg-gray-50 dark:bg-slate-800 space-y-2">
                                    {employees.map(u => (
                                        <label key={u.id} className="flex items-center space-x-3 p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="rounded text-brand-primary focus:ring-brand-primary"
                                                checked={participants.includes(u.id)}
                                                onChange={e => {
                                                    if (e.target.checked) {
                                                        setParticipants(prev => [...prev, u.id]);
                                                    } else {
                                                        setParticipants(prev => prev.filter(id => id !== u.id));
                                                    }
                                                }}
                                            />
                                            <div className="flex items-center space-x-2">
                                                <img src={u.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{u.name}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Quiz Builder */}
                            <div className="border-t dark:border-white/5 pt-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-md font-bold text-gray-900 dark:text-white">Teste / Quiz Avaliativo</h4>
                                    <button
                                        type="button"
                                        onClick={handleAddQuizQuestion}
                                        disabled={quizQuestions.length >= 5}
                                        className="text-xs font-semibold bg-emerald-50 text-brand-primary hover:bg-emerald-100 dark:bg-slate-850 px-3 py-1.5 rounded-lg border border-brand-primary/20 disabled:opacity-50"
                                    >
                                        + Adicionar Pergunta ({quizQuestions.length}/5)
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    {quizQuestions.map((q, qIndex) => (
                                        <div key={qIndex} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border dark:border-white/5 relative space-y-3">
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveQuizQuestion(qIndex)}
                                                className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-xs font-bold"
                                            >
                                                Remover
                                            </button>
                                            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Pergunta {qIndex + 1}</p>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-500 uppercase">Enunciado</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={q.questionText}
                                                    onChange={e => handleQuizQuestionChange(qIndex, 'questionText', e.target.value)}
                                                    className="mt-1 w-full border border-gray-350 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm"
                                                    placeholder="Ex: Qual é o principal valor do código de conduta?"
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {q.options.map((opt, oIndex) => (
                                                    <div key={oIndex} className="flex items-center space-x-2">
                                                        <input
                                                            type="radio"
                                                            name={`correct_${qIndex}`}
                                                            checked={q.correctOptionIndex === oIndex}
                                                            onChange={() => handleQuizQuestionChange(qIndex, 'correctOptionIndex', oIndex)}
                                                            className="text-brand-primary focus:ring-brand-primary"
                                                        />
                                                        <input
                                                            type="text"
                                                            required
                                                            value={opt}
                                                            onChange={e => handleQuizOptionChange(qIndex, oIndex, e.target.value)}
                                                            className="w-full border border-gray-305 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm"
                                                            placeholder={`Opção ${oIndex + 1}`}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="text-[11px] text-gray-400">Selecione o botão radial correspondente à alternativa correta.</p>
                                        </div>
                                    ))}
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
                                    {isProcessing ? 'Salvando...' : 'Salvar Treinamento'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrainingAdminManager;
